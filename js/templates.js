// Task Templates module

const Templates = {
  // Built-in templates
  builtinTemplates: [
    {
      id: 'daily-review',
      name: '📋 每日回顾',
      icon: '📋',
      task: {
        title: '每日工作回顾',
        description: '回顾今天的工作，记录完成事项和明日计划',
        priority: 'medium',
        category: '工作',
        subtasks: [
          { title: '回顾今日完成的任务' },
          { title: '记录遇到的问题' },
          { title: '规划明日工作重点' }
        ]
      }
    },
    {
      id: 'meeting-prep',
      name: '🤝 会议准备',
      icon: '🤝',
      task: {
        title: '会议准备',
        description: '准备会议议程和相关材料',
        priority: 'high',
        category: '工作',
        subtasks: [
          { title: '确认会议时间和地点' },
          { title: '准备会议议程' },
          { title: '整理相关资料' },
          { title: '发送会议邀请' }
        ]
      }
    },
    {
      id: 'weekly-report',
      name: '📊 周报',
        icon: '📊',
      task: {
        title: '撰写周报',
        description: '总结本周工作成果，规划下周计划',
        priority: 'medium',
        category: '工作',
        subtasks: [
          { title: '汇总本周完成的任务' },
          { title: '记录本周数据指标' },
          { title: '分析遇到的问题' },
          { title: '制定下周工作计划' }
        ]
      }
    },
    {
      id: 'exercise',
      name: '🏃 运动健身',
      icon: '🏃',
      task: {
        title: '运动健身',
        description: '完成今日运动计划',
        priority: 'medium',
        category: '健康',
        subtasks: [
          { title: '热身运动 10 分钟' },
          { title: '主要训练 30 分钟' },
          { title: '拉伸放松 10 分钟' }
        ]
      }
    },
    {
      id: 'reading',
      name: '📚 阅读计划',
      icon: '📚',
      task: {
        title: '阅读计划',
        description: '完成今日阅读目标',
        priority: 'low',
        category: '学习',
        subtasks: [
          { title: '阅读 30 分钟' },
          { title: '记录读书笔记' },
          { title: '总结今日收获' }
        ]
      }
    },
    {
      id: 'shopping',
      name: '🛒 购物清单',
      icon: '🛒',
      task: {
        title: '购物清单',
        description: '购买生活所需物品',
        priority: 'low',
        category: '生活',
        subtasks: []
      }
    },
    {
      id: 'project-kickoff',
      name: '🚀 项目启动',
      icon: '🚀',
      task: {
        title: '项目启动',
        description: '新项目启动准备工作',
        priority: 'high',
        category: '工作',
        subtasks: [
          { title: '明确项目目标和范围' },
          { title: '确定项目成员和分工' },
          { title: '制定项目时间计划' },
          { title: '准备项目启动会议' },
          { title: '建立项目文档' }
        ]
      }
    },
    {
      id: 'code-review',
      name: '🔍 代码审查',
      icon: '🔍',
      task: {
        title: '代码审查',
        description: '审查团队提交的代码',
        priority: 'medium',
        category: '工作',
        subtasks: [
          { title: '检查代码规范' },
          { title: '验证功能实现' },
          { title: '评估性能影响' },
          { title: '提供反馈意见' }
        ]
      }
    }
  ],

  // Custom templates (stored in local storage)
  customTemplates: [],

  // Load custom templates
  async loadCustomTemplates() {
    const result = await new Promise(resolve => {
      chrome.storage.local.get('customTemplates', resolve);
    });
    this.customTemplates = result.customTemplates || [];
  },

  // Save custom templates
  async saveCustomTemplates() {
    await new Promise(resolve => {
      chrome.storage.local.set({ customTemplates: this.customTemplates }, resolve);
    });
  },

  // Get all templates (builtin + custom)
  getAllTemplates() {
    return [...this.builtinTemplates, ...this.customTemplates];
  },

  // Add custom template from current task
  async addCustomTemplate(name, task) {
    const template = {
      id: 'custom_' + Date.now(),
      name: name,
      icon: '⭐',
      task: {
        title: task.title,
        description: task.description || '',
        priority: task.priority || 'medium',
        category: task.category || '',
        subtasks: (task.subtasks || []).map(st => ({ title: st.title }))
      }
    };

    this.customTemplates.push(template);
    await this.saveCustomTemplates();
    return template;
  },

  // Delete custom template
  async deleteCustomTemplate(templateId) {
    this.customTemplates = this.customTemplates.filter(t => t.id !== templateId);
    await this.saveCustomTemplates();
  },

  // Apply template (create task from template)
  async applyTemplate(templateId) {
    const template = this.getAllTemplates().find(t => t.id === templateId);
    if (!template) return null;

    // Open modal with prefilled data
    Modal.openAdd({
      title: template.task.title,
      description: template.task.description,
      priority: template.task.priority,
      category: template.task.category,
      subtasks: template.task.subtasks.map(st => ({
        id: Utils.generateId(),
        title: st.title,
        completed: false
      }))
    });
  },

  // Render templates panel
  renderTemplatesPanel() {
    const templates = this.getAllTemplates();

    return `
      <div class="templates-panel">
        <div class="templates-header">
          <h3>📝 任务模板</h3>
          <button id="btn-close-templates" class="btn-icon" title="关闭">
            <svg viewBox="0 0 24 24" width="20" height="20">
              <path fill="currentColor" d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
            </svg>
          </button>
        </div>
        <div class="templates-grid">
          ${templates.map(t => `
            <div class="template-card" data-template-id="${t.id}">
              <div class="template-icon">${t.icon}</div>
              <div class="template-name">${t.name}</div>
              <div class="template-desc">${t.task.subtasks.length} 个子任务</div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }
};
