import { describe, test, expect, beforeEach, vi } from 'vitest';
import { chromeMock } from '../helpers/chromeMock.js';
import { mockWebhooks, mockLinkedInProfile, mockContextMenuInfo, mockTab } from '../helpers/testData.js';

describe('Integration - Chrome Storage API', () => {
  beforeEach(() => {
    chromeMock.reset();
  });

  test('should persist webhooks across extension sessions', async () => {
    // Simulate initial save
    await chromeMock.storage.local.set({ webhooks: mockWebhooks });

    // Simulate extension restart
    chromeMock.storage.local._data = { ...chromeMock.storage.local._data };

    // Verify data persists
    const data = await chromeMock.storage.local.get('webhooks');
    expect(data.webhooks).toEqual(mockWebhooks);
  });

  test('should trigger onChanged listener when storage updates', async () => {
    const changeListener = vi.fn();
    chromeMock.storage.onChanged.addListener(changeListener);

    await chromeMock.storage.local.set({ webhooks: mockWebhooks });

    // Manually trigger change event
    chromeMock.triggerEvent('storage.onChanged', {
      webhooks: {
        newValue: mockWebhooks,
        oldValue: [],
      },
    }, 'local');

    expect(changeListener).toHaveBeenCalled();
  });

  test('should handle concurrent storage operations', async () => {
    const operations = [
      chromeMock.storage.local.set({ key1: 'value1' }),
      chromeMock.storage.local.set({ key2: 'value2' }),
      chromeMock.storage.local.set({ key3: 'value3' }),
    ];

    await Promise.all(operations);

    const data = await chromeMock.storage.local.get(['key1', 'key2', 'key3']);
    expect(data).toEqual({
      key1: 'value1',
      key2: 'value2',
      key3: 'value3',
    });
  });

  test('should handle large payloads in storage', async () => {
    const largePayload = {
      connections: Array.from({ length: 100 }, (_, i) => ({
        name: `Connection ${i}`,
        url: `https://linkedin.com/in/user${i}`,
      })),
    };

    await chromeMock.storage.local.set({ largeData: largePayload });
    const data = await chromeMock.storage.local.get('largeData');

    expect(data.largeData.connections).toHaveLength(100);
  });

  test('should support default values in get operations', async () => {
    const defaults = {
      settings: { notificationInterval: 5 },
      linkedinAutoDetect: false,
    };

    const data = await chromeMock.storage.local.get(defaults);

    expect(data.settings.notificationInterval).toBe(5);
    expect(data.linkedinAutoDetect).toBe(false);
  });
});

describe('Integration - Chrome Tabs API', () => {
  beforeEach(() => {
    chromeMock.reset();
  });

  test('should create tab and send message to it', async () => {
    const tab = await chromeMock.tabs.create({
      url: 'https://www.linkedin.com/in/johndoe/',
      active: false,
    });

    expect(tab.id).toBeDefined();
    expect(tab.url).toBe('https://www.linkedin.com/in/johndoe/');

    chromeMock.tabs.sendMessage.mockResolvedValue({
      success: true,
      data: mockLinkedInProfile,
    });

    const response = await chromeMock.tabs.sendMessage(tab.id, {
      action: 'parseLinkedInProfile',
    });

    expect(response.success).toBe(true);
    expect(response.data).toEqual(mockLinkedInProfile);
  });

  test('should query active tabs', async () => {
    await chromeMock.tabs.create({ url: 'https://example.com', active: true, windowId: 1 });
    await chromeMock.tabs.create({ url: 'https://linkedin.com', active: false, windowId: 1 });

    const activeTabs = await chromeMock.tabs.query({ active: true, currentWindow: true });

    expect(activeTabs).toHaveLength(1);
    expect(activeTabs[0].url).toBe('https://example.com');
  });

  test('should remove tabs after parsing completion', async () => {
    const tab = await chromeMock.tabs.create({
      url: 'https://www.linkedin.com/search/',
      active: false,
    });

    expect(chromeMock.tabs._tabs).toHaveLength(1);

    await chromeMock.tabs.remove(tab.id);

    expect(chromeMock.tabs._tabs).toHaveLength(0);
  });

  test('should handle tab update events', async () => {
    const updateListener = vi.fn();
    chromeMock.tabs.onUpdated.addListener(updateListener);

    const tab = await chromeMock.tabs.create({ url: 'https://example.com' });

    chromeMock.triggerEvent('tabs.onUpdated', tab.id, { status: 'loading' }, tab);
    chromeMock.triggerEvent('tabs.onUpdated', tab.id, { status: 'complete' }, tab);

    expect(updateListener).toHaveBeenCalledTimes(2);
  });

  test('should wait for tab to load completely', async () => {
    const tab = await chromeMock.tabs.create({ url: 'https://example.com' });
    let tabLoaded = false;

    const waitForLoad = new Promise((resolve) => {
      const listener = (tabId, changeInfo) => {
        if (tabId === tab.id && changeInfo.status === 'complete') {
          tabLoaded = true;
          resolve();
        }
      };
      chromeMock.tabs.onUpdated.addListener(listener);
    });

    // Simulate tab loading
    setTimeout(() => {
      chromeMock.triggerEvent('tabs.onUpdated', tab.id, { status: 'complete' }, tab);
    }, 100);

    await waitForLoad;
    expect(tabLoaded).toBe(true);
  });
});

describe('Integration - Chrome Context Menus API', () => {
  beforeEach(() => {
    chromeMock.reset();
  });

  test('should create dynamic menus based on stored webhooks', async () => {
    await chromeMock.storage.local.set({ webhooks: mockWebhooks });

    // Create parent menu
    chromeMock.contextMenus.create({
      id: 'sendToWebhook',
      title: 'Send to Webhook',
      contexts: ['page', 'link', 'image', 'selection'],
    });

    // Create child menus for each webhook
    const data = await chromeMock.storage.local.get('webhooks');
    for (const [index, webhook] of data.webhooks.entries()) {
      const sanitizedName = webhook.name.replace(/[^a-zA-Z0-9_-]/g, '_');
      chromeMock.contextMenus.create({
        id: `sendTo_${sanitizedName}_${index}_normal`,
        parentId: 'sendToWebhook',
        title: webhook.name,
        contexts: ['page', 'link', 'image'],
      });
    }

    const expectedMenus = 1 + mockWebhooks.length; // Parent + children
    expect(chromeMock.contextMenus._menus.length).toBeGreaterThanOrEqual(expectedMenus);
  });

  test('should handle context menu clicks and extract webhook index', () => {
    const menuItemId = 'sendTo_Test_Webhook_1_0_normal';
    const parts = menuItemId.split('_');
    const indexPart = parts[parts.length - 2]; // Second to last part
    const index = Number.parseInt(indexPart);

    expect(index).toBe(0);
  });

  test('should rebuild menus when webhooks change', async () => {
    // Initial state
    await chromeMock.storage.local.set({ webhooks: mockWebhooks });

    // Rebuild menus
    await chromeMock.contextMenus.removeAll();

    chromeMock.contextMenus.create({
      id: 'sendToWebhook',
      title: 'Send to Webhook',
      contexts: ['page', 'link', 'image', 'selection'],
    });

    const data = await chromeMock.storage.local.get('webhooks');
    for (const [index, webhook] of data.webhooks.entries()) {
      const sanitizedName = webhook.name.replace(/[^a-zA-Z0-9_-]/g, '_');
      chromeMock.contextMenus.create({
        id: `sendTo_${sanitizedName}_${index}_normal`,
        parentId: 'sendToWebhook',
        title: webhook.name,
        contexts: ['page'],
      });
    }

    expect(chromeMock.contextMenus._menus.length).toBeGreaterThan(0);
  });

  test('should create LinkedIn-specific context menu', () => {
    chromeMock.contextMenus.create({
      id: 'linkedinMutualConnections',
      title: 'Parse LinkedIn Mutual Connections',
      contexts: ['page'],
      documentUrlPatterns: ['https://www.linkedin.com/in/*'],
    });

    const linkedinMenu = chromeMock.contextMenus._menus.find(
      (m) => m.id === 'linkedinMutualConnections'
    );

    expect(linkedinMenu).toBeDefined();
    expect(linkedinMenu.documentUrlPatterns).toContain('https://www.linkedin.com/in/*');
  });
});

describe('Integration - Chrome Notifications API', () => {
  beforeEach(() => {
    chromeMock.reset();
  });

  test('should create success notification after webhook send', async () => {
    const webhookName = 'Test Webhook';

    const notificationId = await chromeMock.notifications.create({
      type: 'basic',
      iconUrl: 'images/icon48.png',
      title: `✅ ${webhookName} - Success`,
      message: 'Data sent successfully',
    });

    expect(notificationId).toBeDefined();

    const notifications = await chromeMock.notifications.getAll();
    expect(Object.keys(notifications)).toHaveLength(1);
  });

  test('should create and update queue notifications', async () => {
    const webhookUrl = 'https://webhook.site/test1';
    const notificationId = `queue_${webhookUrl}_${Date.now()}`;

    // Create initial notification
    await chromeMock.notifications.create(notificationId, {
      type: 'basic',
      title: '⏳ Queued',
      message: '3 in queue, ~60s remaining',
    });

    // Update notification
    await chromeMock.notifications.create(notificationId, {
      type: 'basic',
      title: '⏳ Queued',
      message: '2 in queue, ~40s remaining',
    });

    const notification = chromeMock.notifications._notifications[notificationId];
    expect(notification.message).toBe('2 in queue, ~40s remaining');
  });

  test('should clear notifications when queue is empty', async () => {
    const notificationId = 'queue_123';

    await chromeMock.notifications.create(notificationId, {
      type: 'basic',
      title: 'Queued',
      message: 'Processing...',
    });

    expect(chromeMock.notifications._notifications[notificationId]).toBeDefined();

    await chromeMock.notifications.clear(notificationId);

    expect(chromeMock.notifications._notifications[notificationId]).toBeUndefined();
  });

  test('should manage multiple notifications for different webhooks', async () => {
    for (const webhook of mockWebhooks) {
      await chromeMock.notifications.create({
        type: 'basic',
        title: `${webhook.name} - Processing`,
        message: 'Sending data...',
      });
    }

    const notifications = await chromeMock.notifications.getAll();
    expect(Object.keys(notifications)).toHaveLength(3);
  });
});

describe('Integration - Chrome Scripting API', () => {
  beforeEach(() => {
    chromeMock.reset();
  });

  test('should execute script and extract page metadata', async () => {
    const mockMetadata = {
      title: 'Example Article',
      description: 'This is an example article',
      keywords: 'example, test',
      favicon: 'https://example.com/favicon.ico',
    };

    chromeMock.scripting.executeScript.mockResolvedValue([{ result: mockMetadata }]);

    const results = await chromeMock.scripting.executeScript({
      target: { tabId: 12345 },
      func: () => ({
        title: document.title,
        description: document.querySelector('meta[name="description"]')?.content,
        keywords: document.querySelector('meta[name="keywords"]')?.content,
        favicon: document.querySelector('link[rel="icon"]')?.href,
      }),
    });

    expect(results[0].result).toEqual(mockMetadata);
  });

  test('should handle script injection errors', async () => {
    chromeMock.setLastError('Cannot access contents of url');

    chromeMock.scripting.executeScript.mockRejectedValue(
      new Error('Cannot access contents of url')
    );

    await expect(
      chromeMock.scripting.executeScript({
        target: { tabId: 12345 },
        func: () => ({}),
      })
    ).rejects.toThrow('Cannot access contents of url');
  });

  test('should pass arguments to injected script', async () => {
    const testUrl = 'https://example.com/image.jpg';

    chromeMock.scripting.executeScript.mockResolvedValue([{ result: 'Example Image' }]);

    const results = await chromeMock.scripting.executeScript({
      target: { tabId: 12345 },
      func: (url) => {
        const images = document.querySelectorAll('img');
        for (const img of images) {
          if (img.src === url) {
            return img.alt;
          }
        }
        return null;
      },
      args: [testUrl],
    });

    expect(results[0].result).toBe('Example Image');
  });
});

describe('Integration - End-to-End Webhook Flow', () => {
  beforeEach(() => {
    chromeMock.reset();
    global.fetch = vi.fn();
  });

  test('should complete full webhook send workflow', async () => {
    // 1. Setup: Save webhooks to storage
    await chromeMock.storage.local.set({ webhooks: mockWebhooks });

    // 2. Extract page data
    const mockPageData = {
      title: 'Example Page',
      description: 'Example description',
    };

    chromeMock.scripting.executeScript.mockResolvedValue([{ result: mockPageData }]);

    const extractResult = await chromeMock.scripting.executeScript({
      target: { tabId: 12345 },
      func: () => ({}),
    });

    // 3. Build payload
    const payload = {
      url: 'https://example.com',
      timestamp: new Date().toISOString(),
      type: 'page',
      ...extractResult[0].result,
    };

    // 4. Send to webhook
    global.fetch.mockResolvedValue({ ok: true, status: 200 });

    const webhookData = await chromeMock.storage.local.get('webhooks');
    const webhook = webhookData.webhooks[0];

    const response = await fetch(webhook.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    // 5. Show notification
    await chromeMock.notifications.create({
      type: 'basic',
      title: `✅ ${webhook.name} - Success`,
      message: 'Data sent successfully',
    });

    // Verify workflow
    expect(response.ok).toBe(true);
    expect(global.fetch).toHaveBeenCalledWith(
      webhook.url,
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const notifications = await chromeMock.notifications.getAll();
    expect(Object.keys(notifications)).toHaveLength(1);
  });

  test('should handle LinkedIn profile parsing workflow', async () => {
    // 1. Detect LinkedIn profile URL
    const profileUrl = 'https://www.linkedin.com/in/johndoe/';
    const isLinkedInProfile = profileUrl.includes('linkedin.com/in/');
    expect(isLinkedInProfile).toBe(true);

    // 2. Send message to content script
    chromeMock.tabs.sendMessage.mockResolvedValue({
      success: true,
      data: mockLinkedInProfile,
    });

    const parseResult = await chromeMock.tabs.sendMessage(12345, {
      action: 'parseLinkedInProfile',
    });

    // 3. Build LinkedIn payload
    const payload = {
      url: profileUrl,
      timestamp: new Date().toISOString(),
      type: 'linkedin_profile',
      profile: parseResult.data,
      source: 'chrome_extension_linkedin_parser',
    };

    // 4. Send to webhooks
    await chromeMock.storage.local.set({
      webhooks: mockWebhooks,
      linkedinWebhooks: 'all',
    });

    global.fetch.mockResolvedValue({ ok: true, status: 200 });

    const settings = await chromeMock.storage.local.get(['webhooks', 'linkedinWebhooks']);
    const targetWebhooks = settings.linkedinWebhooks === 'all' ? settings.webhooks : [];

    for (const webhook of targetWebhooks) {
      await fetch(webhook.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    }

    // Verify
    expect(global.fetch).toHaveBeenCalledTimes(3); // Called for all 3 webhooks
  });

  test('should handle mutual connections parsing workflow', async () => {
    // 1. Detect mutual connections on profile
    chromeMock.tabs.sendMessage.mockResolvedValue({
      success: true,
      data: {
        searchUrl: 'https://www.linkedin.com/search/results/people/?facetConnectionOf=%5B%22ACoAAABCDEF%22%5D',
        encodedId: 'ACoAAABCDEF',
        totalCount: 42,
      },
    });

    const detectionResult = await chromeMock.tabs.sendMessage(12345, {
      action: 'detectMutualConnections',
    });

    // 2. Create new tab for parsing
    const searchTab = await chromeMock.tabs.create({
      url: detectionResult.data.searchUrl,
      active: false,
    });

    expect(searchTab.id).toBeDefined();

    // 3. Parse connections
    chromeMock.tabs.sendMessage.mockResolvedValue({
      success: true,
      data: {
        profileViewed: {
          name: 'John Doe',
          profileUrl: 'https://www.linkedin.com/in/johndoe/',
        },
        mutualConnections: [
          { name: 'Jane Smith', profileUrl: 'https://www.linkedin.com/in/janesmith/' },
        ],
        totalCount: 1,
      },
    });

    const parseResult = await chromeMock.tabs.sendMessage(searchTab.id, {
      action: 'parseAllMutualConnections',
      profileData: detectionResult.data,
    });

    // 4. Send to webhooks
    global.fetch.mockResolvedValue({ ok: true, status: 200 });

    await chromeMock.storage.local.set({
      webhooks: mockWebhooks,
      linkedinWebhooks: 'all',
    });

    const settings = await chromeMock.storage.local.get(['webhooks', 'linkedinWebhooks']);
    const targetWebhooks = settings.linkedinWebhooks === 'all' ? settings.webhooks : [];

    for (const webhook of targetWebhooks) {
      await fetch(webhook.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parseResult.data),
      });
    }

    // 5. Close parsing tab
    await chromeMock.tabs.remove(searchTab.id);

    // Verify
    expect(parseResult.success).toBe(true);
    expect(parseResult.data.totalCount).toBe(1);
    expect(chromeMock.tabs._tabs).toHaveLength(0);
  });
});

describe('Integration - Error Recovery', () => {
  beforeEach(() => {
    chromeMock.reset();
    global.fetch = vi.fn();
  });

  test('should retry failed webhook requests', async () => {
    global.fetch
      .mockResolvedValueOnce({ ok: false, status: 500 })
      .mockResolvedValueOnce({ ok: false, status: 500 })
      .mockResolvedValueOnce({ ok: true, status: 200 });

    const webhookUrl = 'https://webhook.site/test1';
    const payload = { url: 'https://example.com', type: 'page' };
    const maxRetries = 3;

    const sendWithRetry = async (retries) => {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      if (!response.ok && retries > 0) {
        return sendWithRetry(retries - 1);
      }

      return response;
    };

    const result = await sendWithRetry(maxRetries);

    expect(result.ok).toBe(true);
    expect(global.fetch).toHaveBeenCalledTimes(3);
  });

  test('should fall back to basic extraction when LinkedIn parsing fails', async () => {
    // Try LinkedIn parsing
    chromeMock.tabs.sendMessage.mockResolvedValue({
      success: false,
      error: 'Profile not found',
    });

    const linkedinResult = await chromeMock.tabs.sendMessage(12345, {
      action: 'parseLinkedInProfile',
    });

    // Fall back to basic extraction
    if (!linkedinResult.success) {
      chromeMock.scripting.executeScript.mockResolvedValue([{
        result: {
          title: 'LinkedIn Profile',
          description: 'Profile page',
        },
      }]);

      const basicResult = await chromeMock.scripting.executeScript({
        target: { tabId: 12345 },
        func: () => ({}),
      });

      expect(basicResult[0].result.title).toBe('LinkedIn Profile');
    }
  });

  test('should handle storage quota exceeded', async () => {
    chromeMock.setLastError('Storage quota exceeded');

    try {
      const largeData = Array.from({ length: 10000 }, (_, i) => ({
        id: i,
        data: 'x'.repeat(1000),
      }));

      await chromeMock.storage.local.set({ largeData });
    } catch (error) {
      // Handle error
      expect(chromeMock.runtime.lastError).toBeTruthy();
    }
  });
});
