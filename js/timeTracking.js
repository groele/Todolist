// Time Tracking module

const TimeTracking = {
  // Active timers
  activeTimers: {},

  // Initialize
  async init() {
    await this.loadTimers();
  },

  // Load active timers from storage
  async loadTimers() {
    const result = await new Promise(resolve => {
      chrome.storage.local.get('activeTimers', resolve);
    });
    this.activeTimers = result.activeTimers || {};
  },

  // Save active timers
  async saveTimers() {
    await new Promise(resolve => {
      chrome.storage.local.set({ activeTimers: this.activeTimers }, resolve);
    });
  },

  // Start timer for task
  async startTimer(taskId) {
    this.activeTimers[taskId] = {
      startTime: Date.now(),
      elapsed: 0
    };
    await this.saveTimers();
    return this.activeTimers[taskId];
  },

  // Stop timer for task
  async stopTimer(taskId) {
    const timer = this.activeTimers[taskId];
    if (!timer) return null;

    const elapsed = Date.now() - timer.startTime;
    delete this.activeTimers[taskId];
    await this.saveTimers();

    // Save to task history
    await this.addTimeEntry(taskId, elapsed);

    return elapsed;
  },

  // Get current elapsed time
  getElapsedTime(taskId) {
    const timer = this.activeTimers[taskId];
    if (!timer) return 0;
    return Date.now() - timer.startTime;
  },

  // Check if timer is running
  isTimerRunning(taskId) {
    return !!this.activeTimers[taskId];
  },

  // Add time entry to task
  async addTimeEntry(taskId, elapsed) {
    const task = await Storage.getTaskById(taskId);
    if (!task) return;

    const timeEntries = task.timeEntries || [];
    timeEntries.push({
      date: new Date().toISOString(),
      duration: elapsed
    });

    await Storage.updateTask(taskId, { timeEntries });
  },

  // Get total time for task
  async getTotalTime(taskId) {
    const task = await Storage.getTaskById(taskId);
    if (!task) return 0;

    const entries = task.timeEntries || [];
    const total = entries.reduce((sum, entry) => sum + entry.duration, 0);

    // Add current timer if running
    if (this.isTimerRunning(taskId)) {
      return total + this.getElapsedTime(taskId);
    }

    return total;
  },

  // Format duration
  formatDuration(ms) {
    if (ms < 1000) return '0秒';

    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}小时${minutes % 60}分钟`;
    } else if (minutes > 0) {
      return `${minutes}分钟${seconds % 60}秒`;
    } else {
      return `${seconds}秒`;
    }
  },

  // Format duration short
  formatDurationShort(ms) {
    if (ms < 1000) return '0s';

    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  },

  // Get time stats for task
  async getTimeStats(taskId) {
    const task = await Storage.getTaskById(taskId);
    if (!task) return null;

    const entries = task.timeEntries || [];
    const totalTime = entries.reduce((sum, entry) => sum + entry.duration, 0);
    const sessionCount = entries.length;
    const avgSession = sessionCount > 0 ? totalTime / sessionCount : 0;

    return {
      totalTime,
      sessionCount,
      avgSession,
      formatted: {
        total: this.formatDuration(totalTime),
        avg: this.formatDuration(avgSession)
      }
    };
  },

  // Render timer button
  renderTimerButton(taskId) {
    const isRunning = this.isTimerRunning(taskId);
    const elapsed = this.getElapsedTime(taskId);

    return `
      <button class="timer-btn ${isRunning ? 'running' : ''}" data-task-id="${taskId}" title="${isRunning ? '停止计时' : '开始计时'}">
        ${isRunning ? '⏸️' : '⏱️'}
        ${isRunning ? `<span class="timer-display">${this.formatDurationShort(elapsed)}</span>` : ''}
      </button>
    `;
  },

  // Render time stats
  renderTimeStats(task) {
    const entries = task.timeEntries || [];
    if (entries.length === 0) return '';

    const totalTime = entries.reduce((sum, entry) => sum + entry.duration, 0);

    return `
      <div class="time-stats">
        <span class="time-stats-icon">⏱️</span>
        <span class="time-stats-value">${this.formatDurationShort(totalTime)}</span>
      </div>
    `;
  }
};
