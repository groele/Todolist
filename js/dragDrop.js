// Drag and Drop module for task reordering

const DragDrop = {
  draggedElement: null,
  draggedTaskId: null,
  placeholder: null,
  lastKanbanColumn: null,
  kanbanDropHandled: false,

  // Initialize drag and drop
  init() {
    const container = document.getElementById('task-list');
    if (container && !container.dataset.dragDropBound) {
      container.addEventListener('dragstart', this.handleDragStart.bind(this));
      container.addEventListener('dragend', this.handleDragEnd.bind(this));
      container.addEventListener('dragover', this.handleDragOver.bind(this));
      container.addEventListener('drop', this.handleDrop.bind(this));
      container.addEventListener('dragenter', this.handleDragEnter.bind(this));
      container.addEventListener('dragleave', this.handleDragLeave.bind(this));
      container.dataset.dragDropBound = 'true';
    }

    const kanban = document.getElementById('kanban-view');
    if (kanban && !kanban.dataset.dragDropBound) {
      kanban.addEventListener('dragstart', this.handleKanbanDragStart.bind(this));
      kanban.addEventListener('dragend', this.handleKanbanDragEnd.bind(this));
      kanban.addEventListener('dragover', this.handleKanbanDragOver.bind(this));
      kanban.addEventListener('drop', this.handleKanbanDrop.bind(this));
      kanban.addEventListener('dragenter', this.handleKanbanDragEnter.bind(this));
      kanban.addEventListener('dragleave', this.handleKanbanDragLeave.bind(this));
      kanban.dataset.dragDropBound = 'true';
    }
  },

  // Make task cards draggable
  makeDraggable(taskCard) {
    taskCard.setAttribute('draggable', 'true');
  },

  // Make kanban cards draggable
  makeKanbanDraggable(taskCard) {
    taskCard.setAttribute('draggable', 'true');
  },

  // Resolve the kanban column from any point inside a column.
  getKanbanColumnFromEvent(e) {
    const content = e.target.closest('.kanban-column-content');
    const column = e.target.closest('.kanban-column');

    return {
      content: content || column?.querySelector('.kanban-column-content') || null,
      column: content?.dataset.column || column?.dataset.column || null
    };
  },

  // Handle drag start
  handleDragStart(e) {
    const taskCard = e.target.closest('.task-card');
    if (!taskCard) return;

    this.draggedElement = taskCard;
    this.draggedTaskId = taskCard.dataset.taskId;

    // Add dragging class
    taskCard.classList.add('dragging');

    // Set drag data
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', this.draggedTaskId);

    // Create placeholder
    this.placeholder = document.createElement('div');
    this.placeholder.className = 'drag-placeholder';
    this.placeholder.style.height = taskCard.offsetHeight + 'px';
  },

  // Handle drag end
  handleDragEnd(e) {
    const taskCard = e.target.closest('.task-card');
    if (taskCard) {
      taskCard.classList.remove('dragging');
    }

    // Remove placeholder
    if (this.placeholder && this.placeholder.parentNode) {
      this.placeholder.parentNode.removeChild(this.placeholder);
    }

    // Remove all drag-over classes
    document.querySelectorAll('.drag-over').forEach(el => {
      el.classList.remove('drag-over');
    });

    this.draggedElement = null;
    this.draggedTaskId = null;
    this.placeholder = null;
  },

  // Handle drag over
  handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    const taskCard = e.target.closest('.task-card');
    if (!taskCard || taskCard === this.draggedElement) return;

    const rect = taskCard.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;

    // Insert placeholder before or after the target
    if (e.clientY < midY) {
      taskCard.parentNode.insertBefore(this.placeholder, taskCard);
    } else {
      taskCard.parentNode.insertBefore(this.placeholder, taskCard.nextSibling);
    }
  },

  // Handle drop
  async handleDrop(e) {
    e.preventDefault();

    const targetCard = e.target.closest('.task-card');
    if (!targetCard || !this.draggedTaskId) return;

    const targetTaskId = targetCard.dataset.taskId;
    if (this.draggedTaskId === targetTaskId) return;

    // Get tasks and reorder
    const tasks = TaskManager.getTasks();
    const draggedIndex = tasks.findIndex(t => t.id === this.draggedTaskId);
    const targetIndex = tasks.findIndex(t => t.id === targetTaskId);

    if (draggedIndex === -1 || targetIndex === -1) return;

    // Remove dragged task
    const [draggedTask] = tasks.splice(draggedIndex, 1);

    // Insert at new position
    const rect = targetCard.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    const insertIndex = e.clientY < midY ? targetIndex : targetIndex + 1;

    tasks.splice(insertIndex, 0, draggedTask);

    // Update order property
    tasks.forEach((task, index) => {
      task.order = index;
    });

    // Save and re-render
    await Storage.saveTasks(tasks);
    await TaskManager.loadTasks();
    UI.render();
  },

  // Handle drag enter
  handleDragEnter(e) {
    const taskCard = e.target.closest('.task-card');
    if (taskCard && taskCard !== this.draggedElement) {
      taskCard.classList.add('drag-over');
    }
  },

  // Handle drag leave
  handleDragLeave(e) {
    const taskCard = e.target.closest('.task-card');
    if (taskCard) {
      taskCard.classList.remove('drag-over');
    }
  },

  // Handle kanban drag start
  handleKanbanDragStart(e) {
    const taskCard = e.target.closest('.kanban-task');
    if (!taskCard) return;

    this.draggedElement = taskCard;
    this.draggedTaskId = taskCard.dataset.taskId;
    this.lastKanbanColumn = taskCard.closest('.kanban-column')?.dataset.column || null;
    this.kanbanDropHandled = false;

    taskCard.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', this.draggedTaskId);
  },

  // Handle kanban drag end
  async handleKanbanDragEnd(e) {
    const taskCard = e.target.closest('.kanban-task');
    if (taskCard) {
      taskCard.classList.remove('dragging');
    }

    if (this.draggedTaskId && this.lastKanbanColumn && !this.kanbanDropHandled) {
      await this.completeKanbanMove(this.lastKanbanColumn);
    }

    document.querySelectorAll('.kanban-column-content.drag-over').forEach(el => {
      el.classList.remove('drag-over');
    });

    this.draggedElement = null;
    this.draggedTaskId = null;
    this.lastKanbanColumn = null;
    this.kanbanDropHandled = false;
  },

  // Allow dropping on kanban columns
  handleKanbanDragOver(e) {
    const { column } = this.getKanbanColumnFromEvent(e);
    if (!column || !this.draggedTaskId) return;

    this.lastKanbanColumn = column;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  },

  // Move task to the dropped kanban column
  async handleKanbanDrop(e) {
    const { content, column } = this.getKanbanColumnFromEvent(e);
    if (!column || !this.draggedTaskId) return;

    e.preventDefault();
    this.kanbanDropHandled = true;
    await this.completeKanbanMove(column);

    content?.classList.remove('drag-over');
  },

  // Persist a kanban status change if the task moved to a different column.
  async completeKanbanMove(column) {
    const task = TaskManager.getTaskById(this.draggedTaskId);
    if (!task || TaskManager.getKanbanStatus(task) === column) return null;

    const updated = await TaskManager.moveTaskToKanbanColumn(this.draggedTaskId, column);
    if (updated) {
      UI.renderKanban();
      UI.notifyServiceWorker();
      UI.showToast('任务状态已更新');
    }

    return updated;
  },

  // Highlight kanban drop target
  handleKanbanDragEnter(e) {
    const { content } = this.getKanbanColumnFromEvent(e);
    if (content && this.draggedTaskId) {
      content.classList.add('drag-over');
    }
  },

  // Remove highlight when leaving a kanban drop target
  handleKanbanDragLeave(e) {
    const { content } = this.getKanbanColumnFromEvent(e);
    if (content && !content.closest('.kanban-column')?.contains(e.relatedTarget)) {
      content.classList.remove('drag-over');
    }
  }
};
