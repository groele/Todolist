// Modal module for add/edit task dialogs

const Modal = {
  dialog: null,
  form: null,
  titleElement: null,
  currentTaskId: null,
  currentSubtasks: [],
  currentTags: [],

  // Initialize modal
  async init() {
    this.dialog = document.getElementById('task-modal');
    this.form = document.getElementById('task-form');
    this.titleElement = document.getElementById('modal-title');

    this.setupEventListeners();
    await this.loadCategories();
  },

  // Setup event listeners
  setupEventListeners() {
    // Form submission
    this.form.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleSubmit();
    });

    // Ctrl+Enter / Cmd+Enter shortcut to save task
    this.form.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        this.handleSubmit();
      }
    });

    // Cancel button & X close button
    document.getElementById('btn-cancel')?.addEventListener('click', () => {
      this.close();
    });
    document.getElementById('btn-close-modal-x')?.addEventListener('click', () => {
      this.close();
    });

    // Quick date pills
    document.querySelectorAll('.quick-date-pills .date-pill').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const type = btn.dataset.date;
        const now = new Date();
        let targetDate = new Date();

        if (type === 'tomorrow') {
          targetDate.setDate(now.getDate() + 1);
        } else if (type === 'next-monday') {
          const day = now.getDay();
          const diff = (day === 0 ? 1 : 8 - day);
          targetDate.setDate(now.getDate() + diff);
        }

        const dateInput = document.getElementById('task-due-date');
        if (dateInput) {
          dateInput.value = Utils.formatDate(targetDate);
        }
      });
    });

    // Smart Time Picker UI Update Helper
    this.updateTimePickerUI = (timeVal) => {
      const timeInput = document.getElementById('task-due-time');
      const hourSelect = document.getElementById('task-due-hour');
      const minuteSelect = document.getElementById('task-due-minute');
      const triggerBtn = document.getElementById('btn-toggle-time-picker');
      const triggerText = document.getElementById('time-trigger-text');
      const clearBtn = document.getElementById('btn-clear-due-time');
      const strip = document.getElementById('time-selection-strip');

      // Highlight matching active time pill
      document.querySelectorAll('.time-presets-toolbar .time-pill').forEach(pill => {
        if (timeVal && pill.dataset.time === timeVal) {
          pill.classList.add('active');
        } else {
          pill.classList.remove('active');
        }
      });

      if (timeVal) {
        if (timeInput) timeInput.value = timeVal;
        const [h, m] = timeVal.split(':');
        if (hourSelect) hourSelect.value = h;
        if (minuteSelect) minuteSelect.value = m || '00';
        if (triggerText) triggerText.textContent = `具体时间: ${timeVal}`;
        if (triggerBtn) triggerBtn.classList.add('active');
        if (clearBtn) clearBtn.classList.remove('hidden');
        if (strip) strip.classList.remove('hidden');
      } else {
        if (timeInput) timeInput.value = '';
        if (hourSelect) hourSelect.value = '';
        if (minuteSelect) minuteSelect.value = '00';
        if (triggerText) triggerText.textContent = '设置具体时间 (可选)';
        if (triggerBtn) triggerBtn.classList.remove('active');
        if (clearBtn) clearBtn.classList.add('hidden');
        if (strip) strip.classList.add('hidden');
      }
    };

    // Toggle time picker button
    document.getElementById('btn-toggle-time-picker')?.addEventListener('click', (e) => {
      e.preventDefault();
      const strip = document.getElementById('time-selection-strip');
      if (strip) {
        strip.classList.toggle('hidden');
      }
    });

    // Custom time selectors change
    const hourSelect = document.getElementById('task-due-hour');
    const minuteSelect = document.getElementById('task-due-minute');

    const syncTimeFromDropdowns = () => {
      if (hourSelect && minuteSelect) {
        if (hourSelect.value) {
          this.updateTimePickerUI(`${hourSelect.value}:${minuteSelect.value || '00'}`);
        } else {
          this.updateTimePickerUI('');
        }
      }
    };

    hourSelect?.addEventListener('change', syncTimeFromDropdowns);
    minuteSelect?.addEventListener('change', syncTimeFromDropdowns);

    // Quick time pills
    document.querySelectorAll('.quick-time-pills .time-pill').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const timeVal = btn.dataset.time;
        if (timeVal) {
          this.updateTimePickerUI(timeVal);
        }
      });
    });

    // Clear date and clear time buttons
    document.getElementById('btn-clear-due-date')?.addEventListener('click', (e) => {
      e.preventDefault();
      const dateInput = document.getElementById('task-due-date');
      if (dateInput) dateInput.value = '';
    });
    document.getElementById('btn-clear-due-time')?.addEventListener('click', (e) => {
      e.preventDefault();
      this.updateTimePickerUI('');
    });

    // Close on backdrop click
    this.dialog.addEventListener('click', (e) => {
      if (e.target === this.dialog) {
        this.close();
      }
    });

    // Close on Escape
    this.dialog.addEventListener('cancel', (e) => {
      e.preventDefault();
      this.close();
    });

    // Subtask input
    const subtaskInput = document.getElementById('subtask-input');
    const subtaskAddBtn = document.getElementById('btn-add-subtask');

    if (subtaskInput && subtaskAddBtn) {
      subtaskAddBtn.addEventListener('click', () => {
        this.addSubtaskFromInput();
      });

      subtaskInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          this.addSubtaskFromInput();
        }
      });
    }

    // Reminder checkbox toggle
    const reminderCheckbox = document.getElementById('task-reminder');
    const reminderSelect = document.getElementById('task-reminder-before');
    if (reminderCheckbox && reminderSelect) {
      reminderCheckbox.addEventListener('change', () => {
        reminderSelect.style.display = reminderCheckbox.checked ? 'block' : 'none';
      });
    }
  },

  // Load categories for datalist
  async loadCategories() {
    const categories = await Storage.getCategories();
    const datalist = document.getElementById('category-list');
    if (!datalist) return;
    datalist.innerHTML = '';

    categories.forEach(category => {
      const option = document.createElement('option');
      option.value = category;
      datalist.appendChild(option);
    });
  },

  // Open add modal
  openAdd(prefill = null) {
    this.currentTaskId = null;
    this.currentSubtasks = [];
    this.currentTags = [];
    this.titleElement.textContent = '添加任务';
    const iconEl = this.dialog.querySelector('.modal-header-icon');
    if (iconEl) iconEl.textContent = '✨';

    // Reset form
    this.form.reset();

    this.updateTimePickerUI(prefill?.dueTime || '');

    // Apply prefill if provided
    if (prefill) {
      if (prefill.title) document.getElementById('task-title').value = prefill.title;
      if (prefill.dueDate) document.getElementById('task-due-date').value = prefill.dueDate;
      if (prefill.priority) {
        const radio = this.form.querySelector(`input[name="priority"][value="${prefill.priority}"]`);
        if (radio) radio.checked = true;
      }
      if (prefill.category) document.getElementById('task-category').value = prefill.category;
      if (prefill.tags) this.currentTags = [...prefill.tags];
      if (prefill.subtasks) {
        this.currentSubtasks = prefill.subtasks.map(st => ({
          id: st.id || Utils.generateId(),
          title: st.title || '',
          completed: !!st.completed
        }));
      }
    }

    // Set default priority to medium if not set
    if (!this.form.querySelector('input[name="priority"]:checked')) {
      this.form.querySelector('input[name="priority"][value="medium"]').checked = true;
    }

    // Render subtasks and tags
    this.renderSubtasks();
    this.renderTags();

    this.dialog.showModal();
    document.getElementById('task-title').focus();
  },

  // Open edit modal
  async openEdit(taskId) {
    const task = await Storage.getTaskById(taskId);
    if (!task) return;

    this.currentTaskId = taskId;
    this.currentSubtasks = (task.subtasks || []).map(st => ({
      id: st.id || Utils.generateId(),
      title: st.title || '',
      completed: !!st.completed
    }));
    this.currentTags = task.tags ? [...task.tags] : [];
    this.titleElement.textContent = '编辑任务';
    const iconEl = this.dialog.querySelector('.modal-header-icon');
    if (iconEl) iconEl.textContent = '✏️';

    // Fill form with task data
    document.getElementById('task-id').value = task.id;
    document.getElementById('task-title').value = task.title;
    document.getElementById('task-description').value = task.description || '';
    document.getElementById('task-due-date').value = task.dueDate || '';
    document.getElementById('task-category').value = task.category || '';

    this.updateTimePickerUI(task.dueTime || '');

    // Set priority radio
    const radio = this.form.querySelector(`input[name="priority"][value="${task.priority}"]`);
    if (radio) radio.checked = true;

    // Set reminder checkbox
    const reminderCheckbox = document.getElementById('task-reminder');
    const reminderSelect = document.getElementById('task-reminder-before');
    if (reminderCheckbox) {
      reminderCheckbox.checked = task.reminder?.enabled || false;
      if (reminderSelect) {
        reminderSelect.style.display = reminderCheckbox.checked ? 'block' : 'none';
        reminderSelect.value = task.reminder?.before || 15;
      }
    }

    // Set repeat select
    const repeatSelect = document.getElementById('task-repeat');
    if (repeatSelect) {
      repeatSelect.value = task.repeat || '';
    }

    // Render subtasks and tags
    this.renderSubtasks();
    this.renderTags();

    this.dialog.showModal();
    document.getElementById('task-title').focus();
  },

  // Render subtasks list
  renderSubtasks() {
    const container = document.getElementById('subtasks-list');
    if (!container) return;

    container.innerHTML = '';

    this.currentSubtasks.forEach((subtask, index) => {
      const item = document.createElement('div');
      item.className = 'subtask-item';
      item.innerHTML = `
        <div class="subtask-checkbox ${subtask.completed ? 'checked' : ''}" data-index="${index}"></div>
        <span class="subtask-text ${subtask.completed ? 'completed' : ''}">${Utils.escapeHtml(subtask.title)}</span>
        <button class="subtask-delete" data-index="${index}" title="删除">
          <svg viewBox="0 0 24 24" width="14" height="14">
            <path fill="currentColor" d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
          </svg>
        </button>
      `;

      // Toggle subtask
      item.querySelector('.subtask-checkbox').addEventListener('click', () => {
        this.currentSubtasks[index].completed = !this.currentSubtasks[index].completed;
        this.renderSubtasks();
      });

      // Delete subtask
      item.querySelector('.subtask-delete').addEventListener('click', () => {
        this.currentSubtasks.splice(index, 1);
        this.renderSubtasks();
      });

      container.appendChild(item);
    });
  },

  // Add subtask from input
  addSubtaskFromInput() {
    const input = document.getElementById('subtask-input');
    if (!input) return;

    const title = input.value.trim();
    if (!title) return;

    this.currentSubtasks.push({
      id: Utils.generateId(),
      title: title,
      completed: false
    });

    input.value = '';
    this.renderSubtasks();
    input.focus();
  },

  // Render tags
  renderTags() {
    const container = document.getElementById('tags-container');
    if (!container) return;

    container.innerHTML = Tags.renderTagSelector(this.currentTags);

    // Wire up custom tag add button
    const btnAddCustomTag = container.querySelector('#btn-add-custom-tag');
    if (btnAddCustomTag) {
      btnAddCustomTag.addEventListener('click', async (e) => {
        e.preventDefault();
        const name = prompt('请输入新标签名称：');
        if (name && name.trim()) {
          const randomColor = Tags.colors[Math.floor(Math.random() * Tags.colors.length)].value;
          const tag = await Tags.addCustomTag(name.trim(), randomColor);
          if (!this.currentTags.includes(tag.id)) {
            this.currentTags.push(tag.id);
          }
          this.renderTags();
        }
      });
    }

    // Wire up tag checkboxes
    container.querySelectorAll('.tag-option input').forEach(checkbox => {
      checkbox.addEventListener('change', (e) => {
        const tagId = e.target.value;
        if (e.target.checked) {
          if (!this.currentTags.includes(tagId)) {
            this.currentTags.push(tagId);
          }
        } else {
          this.currentTags = this.currentTags.filter(id => id !== tagId);
        }
      });
    });
  },

  // Handle form submission
  async handleSubmit() {
    const repeatSelect = document.getElementById('task-repeat');
    const reminderBefore = document.getElementById('task-reminder-before');

    const formData = {
      title: document.getElementById('task-title').value.trim(),
      description: document.getElementById('task-description').value.trim(),
      dueDate: document.getElementById('task-due-date').value || null,
      dueTime: document.getElementById('task-due-time').value || null,
      priority: this.form.querySelector('input[name="priority"]:checked')?.value || 'medium',
      category: document.getElementById('task-category').value.trim(),
      subtasks: this.currentSubtasks,
      tags: this.currentTags,
      repeat: repeatSelect?.value || null,
      reminder: {
        enabled: document.getElementById('task-reminder')?.checked || false,
        before: parseInt(reminderBefore?.value || '15'),
        notified: false
      }
    };

    if (!formData.title) {
      document.getElementById('task-title').focus();
      return;
    }

    try {
      if (this.currentTaskId) {
        // Update existing task
        await TaskManager.updateTask(this.currentTaskId, formData);
        UI.showToast('任务已更新');
      } else {
        // Add new task
        await TaskManager.addTask(formData);
        UI.showToast('任务已添加');
      }

      this.close();
      await this.loadCategories();
      UI.render();

      // Notify service worker to update badge
      UI.notifyServiceWorker();
    } catch (error) {
      console.error('Failed to save task:', error);
      UI.showToast('保存失败，请重试');
    }
  },

  // Close modal
  close() {
    this.dialog.close();
    this.form.reset();
    this.currentTaskId = null;
    this.currentSubtasks = [];
    this.currentTags = [];
  }
};
