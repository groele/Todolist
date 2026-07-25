// Storage abstraction layer for chrome.storage.local

const Storage = {
  // Default settings
  defaultSettings: {
    defaultView: 'list',
    showCompleted: true,
    sortOrder: 'dueDate',
    theme: 'light',
    dailySummary: false,
    summaryTime: '09:00'
  },

  // Get all data (tasks + settings)
  async getAll() {
    return new Promise((resolve, reject) => {
      chrome.storage.local.get(['tasks', 'settings'], (result) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        resolve({
          tasks: result.tasks || [],
          settings: { ...this.defaultSettings, ...result.settings }
        });
      });
    });
  },

  // Save all data
  async saveAll(data) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.set(data, () => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        resolve();
      });
    });
  },

  // Get tasks array
  async getTasks() {
    const data = await this.getAll();
    return data.tasks;
  },

  // Save tasks array
  async saveTasks(tasks) {
    return this.saveAll({ tasks });
  },

  // Get settings
  async getSettings() {
    const data = await this.getAll();
    return data.settings;
  },

  // Save settings
  async saveSettings(settings) {
    return this.saveAll({ settings });
  },

  // Add a single task
  async addTask(task) {
    const tasks = await this.getTasks();
    tasks.push(task);
    await this.saveTasks(tasks);
    return task;
  },

  // Update a task by ID
  async updateTask(id, changes) {
    const tasks = await this.getTasks();
    const index = tasks.findIndex(t => t.id === id);
    if (index === -1) return null;

    tasks[index] = { ...tasks[index], ...changes };
    await this.saveTasks(tasks);
    return tasks[index];
  },

  // Delete a task by ID
  async deleteTask(id) {
    const tasks = await this.getTasks();
    const index = tasks.findIndex(t => t.id === id);
    if (index === -1) return null;

    const deleted = tasks.splice(index, 1)[0];
    await this.saveTasks(tasks);
    return deleted;
  },

  // Get a single task by ID
  async getTaskById(id) {
    const tasks = await this.getTasks();
    return tasks.find(t => t.id === id) || null;
  },

  // Get all unique categories
  async getCategories() {
    const tasks = await this.getTasks();
    const categories = new Set();
    tasks.forEach(t => {
      if (t.category) categories.add(t.category);
    });
    return Array.from(categories);
  }
};
