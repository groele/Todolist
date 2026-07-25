// Service Worker for Todolist Chrome Extension

// Set up side panel behavior and context menu on install
chrome.runtime.onInstalled.addListener(async () => {
  updateBadge();
  setupAlarm();
  await setupContextMenu();

  // Configure side panel to open on action click if supported
  if (chrome.sidePanel && typeof chrome.sidePanel.setPanelBehavior === 'function') {
    try {
      await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
    } catch (e) {
      console.warn('Could not set sidePanel behavior:', e);
    }
  }
});

// Open new tab when clicking the extension icon if sidepanel is not openable on action click
chrome.action.onClicked.addListener(async (tab) => {
  // If side panel is available, sidepanel API handles action click.
  // Fallback: check if there's already a Todolist tab open
  try {
    const tabs = await chrome.tabs.query({ url: chrome.runtime.getURL('index.html') });
    if (tabs.length > 0) {
      await chrome.tabs.update(tabs[0].id, { active: true });
      await chrome.windows.update(tabs[0].windowId, { focused: true });
    } else {
      await chrome.tabs.create({ url: chrome.runtime.getURL('index.html') });
    }
  } catch (e) {
    console.error('Error handling action click:', e);
  }
});

// Set up context menu items
function setupContextMenu() {
  return new Promise((resolve) => {
    chrome.contextMenus.removeAll(() => {
      chrome.contextMenus.create({
        id: 'add-task-from-selection',
        title: '添加为任务: "%s"',
        contexts: ['selection']
      });

      chrome.contextMenus.create({
        id: 'add-task-from-link',
        title: '添加链接为任务',
        contexts: ['link']
      });

      chrome.contextMenus.create({
        id: 'add-task-from-page',
        title: '添加页面为任务: "%s"',
        contexts: ['page']
      });

      resolve();
    });
  });
}

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  let taskTitle = '';
  let taskDescription = '';

  if (info.menuItemId === 'add-task-from-selection') {
    taskTitle = info.selectionText?.substring(0, 100) || '来自网页的任务';
    taskDescription = `来源: ${tab?.title || ''}\n${tab?.url || ''}`;
  } else if (info.menuItemId === 'add-task-from-link') {
    taskTitle = `链接: ${info.linkText?.substring(0, 50) || '网页链接'}`;
    taskDescription = info.linkUrl || '';
  } else if (info.menuItemId === 'add-task-from-page') {
    taskTitle = info.selectionText?.substring(0, 100) || tab?.title || '来自网页的任务';
    taskDescription = tab?.url || '';
  }

  if (taskTitle) {
    // Store the task data for the side panel to pick up
    await chrome.storage.local.set({
      pendingTask: {
        title: taskTitle,
        description: taskDescription,
        createdAt: new Date().toISOString()
      }
    });

    // Open the side panel safely
    if (chrome.sidePanel?.open && tab?.id) {
      try {
        await chrome.sidePanel.open({ tabId: tab.id });
      } catch (e) {
        console.warn('Could not open side panel:', e);
      }
    }

    // Send message to side panel
    try {
      await chrome.runtime.sendMessage({ type: 'CONTEXT_MENU_TASK' });
    } catch (e) {
      // Side panel might not be ready yet
    }
  }
});

// Set up alarm to check for overdue tasks periodically
function setupAlarm() {
  chrome.alarms.create('checkOverdue', { periodInMinutes: 15 });
  chrome.alarms.create('checkReminders', { periodInMinutes: 1 });
}

// Listen for alarms
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'checkOverdue') {
    await updateBadge();
    await checkOverdueTasks();
  }

  if (alarm.name === 'checkReminders') {
    await checkReminders();
  }
});

// Listen for storage changes to update badge
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local' && changes.tasks) {
    updateBadge();
  }
});

// Listen for messages from UI
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'TASKS_UPDATED') {
    updateBadge();
    sendResponse({ success: true });
  }
  if (message.type === 'SHOW_NOTIFICATION') {
    showNotification(message.title, message.body);
    sendResponse({ success: true });
  }
  return true;
});

// Update badge with incomplete task count
async function updateBadge() {
  try {
    const result = await chrome.storage.local.get('tasks');
    const tasks = result.tasks || [];
    const incompleteCount = tasks.filter(t => !t.completed).length;

    await chrome.action.setBadgeText({
      text: incompleteCount > 0 ? String(incompleteCount) : ''
    });
    await chrome.action.setBadgeBackgroundColor({ color: '#6366f1' });
  } catch (error) {
    console.error('Failed to update badge:', error);
  }
}

// Check for overdue tasks and send notification
async function checkOverdueTasks() {
  try {
    const result = await chrome.storage.local.get(['tasks', 'lastOverdueCheck']);
    const tasks = result.tasks || [];
    const lastCheck = result.lastOverdueCheck || 0;
    const now = Date.now();

    // Only check once per hour
    if (now - lastCheck < 3600000) return;

    const overdueTasks = tasks.filter(t => {
      if (t.completed || !t.dueDate) return false;
      const due = new Date(t.dueDate + 'T' + (t.dueTime || '23:59'));
      return due < new Date();
    });

    if (overdueTasks.length > 0) {
      showNotification(
        '📋 任务逾期提醒',
        `您有 ${overdueTasks.length} 个任务已逾期`
      );
    }

    await chrome.storage.local.set({ lastOverdueCheck: now });
  } catch (error) {
    console.error('Failed to check overdue tasks:', error);
  }
}

// Check for task reminders
async function checkReminders() {
  try {
    const result = await chrome.storage.local.get('tasks');
    const tasks = result.tasks || [];
    const now = new Date();

    for (const task of tasks) {
      if (task.completed || !task.dueDate) continue;
      if (task.reminder?.notified) continue;
      if (!task.reminder?.enabled) continue;

      // Calculate reminder time
      const dueDate = new Date(task.dueDate + 'T' + (task.dueTime || '23:59'));
      const reminderMinutes = task.reminder?.before || 15;
      const reminderTime = new Date(dueDate.getTime() - reminderMinutes * 60 * 1000);

      // Check if it's time for reminder
      if (now >= reminderTime && now < dueDate) {
        const minutesLeft = Math.round((dueDate - now) / (1000 * 60));

        let body = '';
        if (minutesLeft <= 0) {
          body = `任务 "${task.title}" 已到期！`;
        } else if (minutesLeft < 60) {
          body = `任务 "${task.title}" 将在 ${minutesLeft} 分钟后到期`;
        } else {
          const hoursLeft = Math.round(minutesLeft / 60);
          body = `任务 "${task.title}" 将在 ${hoursLeft} 小时后到期`;
        }

        showNotification('🔔 任务提醒', body);

        // Mark as notified
        task.reminder.notified = true;
        const taskIndex = tasks.findIndex(t => t.id === task.id);
        if (taskIndex !== -1) {
          tasks[taskIndex] = task;
          await chrome.storage.local.set({ tasks });
        }
      }
    }
  } catch (error) {
    console.error('Failed to check reminders:', error);
  }
}

// Show notification
function showNotification(title, body) {
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'images/icon-128.png',
    title: title,
    message: body,
    priority: 1,
    requireInteraction: false
  });
}
