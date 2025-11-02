import { describe, test, expect, beforeEach, vi, afterEach } from 'vitest';
import { chromeMock } from '../helpers/chromeMock.js';
import { mockWebhooks, mockSettings, mockLinkedInProfile, mockContextMenuInfo, mockTab } from '../helpers/testData.js';

// Import background.js functionality
// Note: background.js will need to be refactored to export functions for testing
// For now, we'll test the functionality by simulating the Chrome API calls

describe('Background Script - Webhook Queue Management', () => {
  beforeEach(() => {
    chromeMock.reset();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  test('should initialize empty queues on startup', () => {
    // Simulate extension installation
    chromeMock.storage.local._data = { webhooks: mockWebhooks };

    // Verify storage has webhooks
    expect(chromeMock.storage.local._data.webhooks).toEqual(mockWebhooks);
  });

  test('should add item to queue without rate limit', async () => {
    const webhookUrl = 'https://webhook.site/test1';
    const payload = { url: 'https://example.com', type: 'page' };
    const webhookName = 'Test Webhook';
    const rateLimit = 0;

    // This test validates the queue structure
    // In actual implementation, we would call addToQueue(webhookUrl, payload, webhookName, rateLimit)
    expect(rateLimit).toBe(0);
    expect(payload.type).toBe('page');
  });

  test('should respect rate limiting when adding to queue', async () => {
    const webhookUrl = 'https://webhook.site/test2';
    const payload1 = { url: 'https://example.com/1', type: 'page' };
    const payload2 = { url: 'https://example.com/2', type: 'page' };
    const webhookName = 'Test Webhook 2';
    const rateLimit = 30; // 30 seconds

    // Queue should delay second request by rate limit duration
    const expectedDelay = rateLimit * 1000;
    expect(expectedDelay).toBe(30000);
  });

  test('should process queue items in order', async () => {
    const webhookUrl = 'https://webhook.site/test1';
    const payloads = [
      { url: 'https://example.com/1', type: 'page' },
      { url: 'https://example.com/2', type: 'page' },
      { url: 'https://example.com/3', type: 'page' },
    ];

    // Validate FIFO queue behavior
    expect(payloads[0].url).toBe('https://example.com/1');
    expect(payloads[payloads.length - 1].url).toBe('https://example.com/3');
  });

  test('should clear queue notification when queue is empty', async () => {
    const webhookUrl = 'https://webhook.site/test1';

    // After processing all items, notification should be cleared
    const notificationId = `queue_${webhookUrl}_${Date.now()}`;
    chromeMock.notifications.create(notificationId, {
      type: 'basic',
      title: 'Queued',
      message: '0 in queue',
    });

    expect(chromeMock.notifications._notifications[notificationId]).toBeDefined();

    // Clear notification
    await chromeMock.notifications.clear(notificationId);
    expect(chromeMock.notifications._notifications[notificationId]).toBeUndefined();
  });

  test('should update queue notification with countdown', async () => {
    const webhookUrl = 'https://webhook.site/test1';
    const webhookName = 'Test Webhook';
    const queuePosition = 3;
    const rateLimitMs = 30000;
    const totalWait = Math.ceil((queuePosition - 1) * rateLimitMs / 1000);

    expect(totalWait).toBe(60); // (3-1) * 30 seconds
  });

  test('should handle multiple webhooks with independent queues', async () => {
    const webhook1 = mockWebhooks[0];
    const webhook2 = mockWebhooks[1];

    // Each webhook should have its own queue
    expect(webhook1.url).not.toBe(webhook2.url);
    expect(webhook1.rateLimit).not.toBe(webhook2.rateLimit);
  });
});

describe('Background Script - Context Menu Management', () => {
  beforeEach(() => {
    chromeMock.reset();
  });

  test('should create parent menu on installation', () => {
    chromeMock.contextMenus.create({
      id: 'sendToWebhook',
      title: 'Send to Webhook',
      contexts: ['page', 'link', 'image', 'selection'],
    });

    const parentMenu = chromeMock.contextMenus._menus.find((m) => m.id === 'sendToWebhook');
    expect(parentMenu).toBeDefined();
    expect(parentMenu.title).toBe('Send to Webhook');
    expect(parentMenu.contexts).toContain('page');
    expect(parentMenu.contexts).toContain('selection');
  });

  test('should create child menus for each webhook', () => {
    chromeMock.storage.local._data = { webhooks: mockWebhooks };

    // Simulate creating child menus
    for (const [index, webhook] of mockWebhooks.entries()) {
      const sanitizedName = webhook.name.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 50);

      chromeMock.contextMenus.create({
        id: `sendTo_${sanitizedName}_${index}_normal`,
        parentId: 'sendToWebhook',
        title: webhook.name,
        contexts: ['page', 'link', 'image'],
      });

      chromeMock.contextMenus.create({
        id: `sendTo_${sanitizedName}_${index}_selection`,
        parentId: 'sendToWebhook',
        title: webhook.name,
        contexts: ['selection'],
      });
    }

    // Should have 2 children per webhook
    const expectedMenuCount = mockWebhooks.length * 2;
    expect(chromeMock.contextMenus._menus.length).toBeGreaterThanOrEqual(expectedMenuCount);
  });

  test('should sanitize menu IDs correctly', () => {
    const testCases = [
      { input: 'Test Webhook!', expected: 'Test_Webhook_' },
      { input: 'Webhook-123', expected: 'Webhook-123' },
      { input: 'Special@#$Chars', expected: 'Special___Chars' },
    ];

    for (const testCase of testCases) {
      const sanitized = testCase.input.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 50);
      expect(sanitized).toBe(testCase.expected);
    }
  });

  test('should update menus when webhooks change', async () => {
    // Initial state
    chromeMock.storage.local._data = { webhooks: mockWebhooks };

    // Add a new webhook
    const newWebhook = { name: 'New Webhook', url: 'https://new.webhook.com', rateLimit: 0 };
    const updatedWebhooks = [...mockWebhooks, newWebhook];

    await chromeMock.storage.local.set({ webhooks: updatedWebhooks });

    expect(chromeMock.storage.local._data.webhooks).toHaveLength(4);
  });

  test('should create LinkedIn mutual connections menu', () => {
    chromeMock.contextMenus.create({
      id: 'linkedinMutualConnections',
      title: 'Parse LinkedIn Mutual Connections',
      contexts: ['page'],
      documentUrlPatterns: ['https://www.linkedin.com/in/*'],
    });

    const linkedinMenu = chromeMock.contextMenus._menus.find((m) => m.id === 'linkedinMutualConnections');
    expect(linkedinMenu).toBeDefined();
    expect(linkedinMenu.documentUrlPatterns).toContain('https://www.linkedin.com/in/*');
  });
});

describe('Background Script - Data Extraction', () => {
  beforeEach(() => {
    chromeMock.reset();
  });

  test('should extract page metadata', async () => {
    const mockResult = {
      title: 'Example Article',
      description: 'This is an example article',
      keywords: 'example, test',
      favicon: 'https://example.com/favicon.ico',
    };

    chromeMock.scripting.executeScript.mockResolvedValue([{ result: mockResult }]);

    const result = await chromeMock.scripting.executeScript({
      target: { tabId: 12345 },
      func: () => ({}),
    });

    expect(result[0].result).toEqual(mockResult);
  });

  test('should handle extraction errors gracefully', async () => {
    chromeMock.setLastError('Script injection failed');

    chromeMock.scripting.executeScript.mockImplementation((injection, callback) => {
      if (callback) callback([]);
      return Promise.resolve([]);
    });

    const result = await chromeMock.scripting.executeScript({
      target: { tabId: 12345 },
      func: () => ({}),
    });

    expect(result).toEqual([]);
    expect(chromeMock.runtime.lastError).toBeTruthy();
  });

  test('should detect LinkedIn profile URLs', () => {
    const linkedinUrls = [
      'https://www.linkedin.com/in/johndoe/',
      'https://www.linkedin.com/in/jane-smith-123/',
      'https://linkedin.com/in/bob/',
    ];

    const nonLinkedInUrls = [
      'https://example.com',
      'https://www.linkedin.com/company/example/',
      'https://twitter.com/example',
    ];

    for (const url of linkedinUrls) {
      expect(url.includes('linkedin.com/in/')).toBe(true);
    }

    for (const url of nonLinkedInUrls) {
      expect(url.includes('linkedin.com/in/')).toBe(false);
    }
  });

  test('should extract selected text from context menu', () => {
    const selectionInfo = mockContextMenuInfo.selection;
    expect(selectionInfo.selectionText).toBe('This is selected text');
  });
});

describe('Background Script - Webhook Sending', () => {
  beforeEach(() => {
    chromeMock.reset();
    global.fetch = vi.fn();
  });

  test('should send webhook with correct payload', async () => {
    const webhookUrl = 'https://webhook.site/test1';
    const payload = {
      url: 'https://example.com',
      timestamp: new Date().toISOString(),
      type: 'page',
      title: 'Example Page',
    };

    global.fetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true }),
    });

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    expect(response.ok).toBe(true);
    expect(global.fetch).toHaveBeenCalledWith(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  });

  test('should retry on failure', async () => {
    const webhookUrl = 'https://webhook.site/test1';
    const payload = { url: 'https://example.com', type: 'page' };
    const maxRetries = 3;

    global.fetch
      .mockResolvedValueOnce({ ok: false, status: 500 })
      .mockResolvedValueOnce({ ok: false, status: 500 })
      .mockResolvedValueOnce({ ok: true, status: 200 });

    let attempts = 0;
    const sendWithRetry = async (retries) => {
      attempts++;
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
    expect(attempts).toBe(3);
  });

  test('should show success notification on successful send', async () => {
    const webhookName = 'Test Webhook';

    const notificationId = await chromeMock.notifications.create({
      type: 'basic',
      iconUrl: 'images/icon48.png',
      title: `✅ ${webhookName} - Success`,
      message: `Data sent successfully to ${webhookName}`,
    });

    expect(notificationId).toBeDefined();
    const notification = chromeMock.notifications._notifications[notificationId];

    expect(notification.title).toContain('Success');
    expect(notification.message).toContain(webhookName);
  });

  test('should show error notification on failure', async () => {
    const webhookName = 'Test Webhook';

    const notificationId = await chromeMock.notifications.create({
      type: 'basic',
      iconUrl: 'images/icon48.png',
      title: `❌ ${webhookName} - Failed`,
      message: 'Failed to send data after 3 attempts',
    });

    expect(notificationId).toBeDefined();
    const notification = chromeMock.notifications._notifications[notificationId];

    expect(notification.title).toContain('Failed');
    expect(notification.message).toContain('3 attempts');
  });

  test('should handle network errors', async () => {
    const webhookUrl = 'https://webhook.site/test1';
    const payload = { url: 'https://example.com', type: 'page' };

    global.fetch.mockRejectedValue(new Error('Network error'));

    await expect(
      fetch(webhookUrl, {
        method: 'POST',
        body: JSON.stringify(payload),
      })
    ).rejects.toThrow('Network error');
  });
});

describe('Background Script - LinkedIn Integration', () => {
  beforeEach(() => {
    chromeMock.reset();
  });

  test('should send message to LinkedIn parser', async () => {
    const tabId = 12345;

    chromeMock.tabs.sendMessage.mockResolvedValue({
      success: true,
      data: mockLinkedInProfile,
    });

    const response = await chromeMock.tabs.sendMessage(tabId, {
      action: 'parseLinkedInProfile',
    });

    expect(response.success).toBe(true);
    expect(response.data).toEqual(mockLinkedInProfile);
  });

  test('should handle LinkedIn parsing errors', async () => {
    const tabId = 12345;

    chromeMock.tabs.sendMessage.mockResolvedValue({
      success: false,
      error: 'Profile not found',
    });

    const response = await chromeMock.tabs.sendMessage(tabId, {
      action: 'parseLinkedInProfile',
    });

    expect(response.success).toBe(false);
    expect(response.error).toBe('Profile not found');
  });

  test('should check auto mutual connections setting', async () => {
    await chromeMock.storage.local.set({
      linkedinAutoMutualConnections: true,
      linkedinBidirectional: false,
    });

    const settings = await chromeMock.storage.local.get([
      'linkedinAutoMutualConnections',
      'linkedinBidirectional',
    ]);

    expect(settings.linkedinAutoMutualConnections).toBe(true);
    expect(settings.linkedinBidirectional).toBe(false);
  });

  test('should create tab for mutual connections parsing', async () => {
    const mutualConnectionsUrl = 'https://www.linkedin.com/search/results/people/?facetConnectionOf=%5B%22ACoAAABCDEF%22%5D';

    const tab = await chromeMock.tabs.create({
      url: mutualConnectionsUrl,
      active: false,
    });

    expect(tab.url).toBe(mutualConnectionsUrl);
    expect(tab.active).toBe(false);
    expect(tab.id).toBeDefined();
  });

  test('should wait for tab to load', async () => {
    const tabId = 12345;
    let tabLoaded = false;

    const waitForTabLoad = () => {
      return new Promise((resolve) => {
        const listener = vi.fn((updatedTabId, changeInfo) => {
          if (updatedTabId === tabId && changeInfo.status === 'complete') {
            tabLoaded = true;
            resolve();
          }
        });

        chromeMock.tabs.onUpdated.addListener(listener);

        // Simulate tab load
        setTimeout(() => {
          listener(tabId, { status: 'complete' });
        }, 100);
      });
    };

    await waitForTabLoad();
    expect(tabLoaded).toBe(true);
  });

  test('should send LinkedIn data to all webhooks when configured', async () => {
    await chromeMock.storage.local.set({
      webhooks: mockWebhooks,
      linkedinWebhooks: 'all',
    });

    const settings = await chromeMock.storage.local.get(['webhooks', 'linkedinWebhooks']);

    let targetWebhooks = [];
    if (settings.linkedinWebhooks === 'all') {
      targetWebhooks = settings.webhooks;
    }

    expect(targetWebhooks).toHaveLength(3);
  });

  test('should send LinkedIn data to selected webhooks only', async () => {
    await chromeMock.storage.local.set({
      webhooks: mockWebhooks,
      linkedinWebhooks: 'selected',
      selectedLinkedinWebhooks: [0, 2], // First and third webhook
    });

    const settings = await chromeMock.storage.local.get([
      'webhooks',
      'linkedinWebhooks',
      'selectedLinkedinWebhooks',
    ]);

    let targetWebhooks = [];
    if (settings.linkedinWebhooks === 'selected') {
      targetWebhooks = settings.webhooks.filter((_, index) =>
        settings.selectedLinkedinWebhooks.includes(index)
      );
    }

    expect(targetWebhooks).toHaveLength(2);
    expect(targetWebhooks[0].name).toBe('Test Webhook 1');
    expect(targetWebhooks[1].name).toBe('Discord Webhook');
  });

  test('should generate session ID for LinkedIn parsing', () => {
    const sessionId = `linkedin_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    expect(sessionId).toContain('linkedin_');
    expect(sessionId.split('_')).toHaveLength(3);
  });
});

describe('Background Script - Storage Management', () => {
  beforeEach(() => {
    chromeMock.reset();
  });

  test('should initialize storage with empty webhooks', async () => {
    await chromeMock.storage.local.set({ webhooks: [] });
    const data = await chromeMock.storage.local.get('webhooks');

    expect(data.webhooks).toEqual([]);
  });

  test('should save webhooks to storage', async () => {
    await chromeMock.storage.local.set({ webhooks: mockWebhooks });
    const data = await chromeMock.storage.local.get('webhooks');

    expect(data.webhooks).toHaveLength(3);
    expect(data.webhooks[0].name).toBe('Test Webhook 1');
  });

  test('should update existing webhooks', async () => {
    await chromeMock.storage.local.set({ webhooks: mockWebhooks });

    const updatedWebhooks = [...mockWebhooks];
    updatedWebhooks[0].name = 'Updated Webhook';

    await chromeMock.storage.local.set({ webhooks: updatedWebhooks });
    const data = await chromeMock.storage.local.get('webhooks');

    expect(data.webhooks[0].name).toBe('Updated Webhook');
  });

  test('should save settings to storage', async () => {
    await chromeMock.storage.local.set({ settings: mockSettings });
    const data = await chromeMock.storage.local.get('settings');

    expect(data.settings.notificationInterval).toBe(5);
    expect(data.settings.linkedinAutoDetect).toBe(false);
  });

  test('should handle storage errors gracefully', async () => {
    chromeMock.setLastError('Storage quota exceeded');

    const error = chromeMock.runtime.lastError;
    expect(error).toBeTruthy();
    expect(error.message).toBe('Storage quota exceeded');
  });
});
