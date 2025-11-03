import { vi } from 'vitest';

/**
 * Comprehensive Chrome API mock for testing
 * Provides realistic Chrome extension APIs with spies and state management
 */
export const chromeMock = {
  // Storage API
  storage: {
    local: {
      _data: {},
      get(keys, callback) {
        const result = {};
        if (typeof keys === 'string') {
          result[keys] = this._data[keys];
        } else if (Array.isArray(keys)) {
          for (const key of keys) {
            result[key] = this._data[key];
          }
        } else if (typeof keys === 'object') {
          for (const key of Object.keys(keys)) {
            result[key] = this._data[key] ?? keys[key];
          }
        } else {
          Object.assign(result, this._data);
        }
        if (callback) callback(result);
        return Promise.resolve(result);
      },
      set(items, callback) {
        Object.assign(this._data, items);
        if (callback) callback();
        return Promise.resolve();
      },
      remove(keys, callback) {
        const keysArray = Array.isArray(keys) ? keys : [keys];
        for (const key of keysArray) {
          delete this._data[key];
        }
        if (callback) callback();
        return Promise.resolve();
      },
      clear(callback) {
        this._data = {};
        if (callback) callback();
        return Promise.resolve();
      },
    },
    onChanged: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
      hasListener: vi.fn(),
    },
  },

  // Runtime API
  runtime: {
    lastError: null,
    onInstalled: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    },
    onStartup: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    },
    onMessage: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    },
    sendMessage: vi.fn((message, callback) => {
      if (callback) callback({ success: true });
      return Promise.resolve({ success: true });
    }),
  },

  // Context Menus API
  contextMenus: {
    _menus: [],
    create(createProperties, callback) {
      const menu = { ...createProperties, id: createProperties.id || `menu_${Date.now()}` };
      this._menus.push(menu);
      if (callback) callback();
      return menu.id;
    },
    removeAll(callback) {
      this._menus = [];
      if (callback) callback();
      return Promise.resolve();
    },
    update: vi.fn((id, updateProperties, callback) => {
      const menu = chromeMock.contextMenus._menus.find((m) => m.id === id);
      if (menu) {
        Object.assign(menu, updateProperties);
      }
      if (callback) callback();
      return Promise.resolve();
    }),
    remove: vi.fn((id, callback) => {
      chromeMock.contextMenus._menus = chromeMock.contextMenus._menus.filter((m) => m.id !== id);
      if (callback) callback();
      return Promise.resolve();
    }),
    onClicked: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    },
  },

  // Tabs API
  tabs: {
    _tabs: [],
    create: vi.fn((createProperties) => {
      const tab = {
        id: Math.floor(Math.random() * 10000),
        url: createProperties.url,
        active: createProperties.active ?? true,
        status: 'loading',
        ...createProperties,
      };
      chromeMock.tabs._tabs.push(tab);
      return Promise.resolve(tab);
    }),
    query: vi.fn((queryInfo) => {
      const tabs = chromeMock.tabs._tabs.filter((tab) => {
        if (queryInfo.active !== undefined && tab.active !== queryInfo.active) return false;
        if (queryInfo.currentWindow !== undefined && tab.windowId !== 1) return false;
        return true;
      });
      return Promise.resolve(tabs);
    }),
    sendMessage: vi.fn((tabId, message, callback) => {
      const response = { success: true, data: null };
      if (callback) callback(response);
      return Promise.resolve(response);
    }),
    remove: vi.fn((tabId) => {
      chromeMock.tabs._tabs = chromeMock.tabs._tabs.filter((tab) => tab.id !== tabId);
      return Promise.resolve();
    }),
    onUpdated: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    },
    onRemoved: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    },
  },

  // Scripting API
  scripting: {
    executeScript: vi.fn((injection, callback) => {
      const results = [{ result: null }];
      if (callback) callback(results);
      return Promise.resolve(results);
    }),
  },

  // Notifications API
  notifications: {
    _notifications: {},
    create: vi.fn((notificationIdOrOptions, optionsOrCallback, callbackOrUndefined) => {
      // Handle both signatures: create(options) and create(id, options)
      let id;
      let options;
      let callback;

      if (typeof notificationIdOrOptions === 'string') {
        id = notificationIdOrOptions;
        options = optionsOrCallback;
        callback = callbackOrUndefined;
      } else {
        id = `notification_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        options = notificationIdOrOptions;
        callback = optionsOrCallback;
      }

      chromeMock.notifications._notifications[id] = options;
      if (callback) callback(id);
      return Promise.resolve(id);
    }),
    clear: vi.fn((notificationId, callback) => {
      delete chromeMock.notifications._notifications[notificationId];
      if (callback) callback(true);
      return Promise.resolve(true);
    }),
    getAll: vi.fn((callback) => {
      if (callback) callback(chromeMock.notifications._notifications);
      return Promise.resolve(chromeMock.notifications._notifications);
    }),
  },

  // Helper methods for testing
  reset() {
    this.storage.local._data = {};
    this.contextMenus._menus = [];
    this.tabs._tabs = [];
    this.notifications._notifications = {};
    this.runtime.lastError = null;
    vi.clearAllMocks();
  },

  setLastError(message) {
    this.runtime.lastError = { message };
  },

  clearLastError() {
    this.runtime.lastError = null;
  },

  // Trigger event listeners
  triggerEvent(apiPath, ...args) {
    const parts = apiPath.split('.');
    let obj = this;
    for (let i = 0; i < parts.length; i++) {
      obj = obj[parts[i]];
    }
    if (obj && obj.addListener && obj.addListener.mock) {
      const listeners = obj.addListener.mock.calls.map((call) => call[0]);
      for (const listener of listeners) {
        listener(...args);
      }
    }
  },
};

export default chromeMock;
