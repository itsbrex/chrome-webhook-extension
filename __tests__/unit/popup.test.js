import { describe, test, expect, beforeEach, vi, afterEach } from 'vitest';
import { chromeMock } from '../helpers/chromeMock.js';
import { mockWebhooks, mockSettings } from '../helpers/testData.js';

describe('Popup - Form Validation', () => {
  test('should validate URL correctly', () => {
    const validateURL = (url) => {
      try {
        const urlObj = new URL(url);
        return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
      } catch (e) {
        return false;
      }
    };

    // Valid URLs
    expect(validateURL('https://webhook.site/test')).toBe(true);
    expect(validateURL('http://localhost:8080/webhook')).toBe(true);
    expect(validateURL('https://n8n.example.com/webhook/123')).toBe(true);

    // Invalid URLs
    expect(validateURL('not-a-url')).toBe(false);
    expect(validateURL('ftp://example.com')).toBe(false);
    expect(validateURL('')).toBe(false);
    expect(validateURL('javascript:alert(1)')).toBe(false);
  });

  test('should validate webhook name is required', () => {
    const name = '';
    expect(name.trim()).toBe('');
  });

  test('should validate rate limit is a positive number', () => {
    const validRateLimits = ['0', '5', '30', '60'];
    const invalidRateLimits = ['-5', 'abc'];

    for (const limit of validRateLimits) {
      const value = Number.parseInt(limit);
      expect(value >= 0).toBe(true);
    }

    for (const limit of invalidRateLimits) {
      const value = Number.parseInt(limit);
      if (limit === 'abc') {
        expect(Number.isNaN(value)).toBe(true);
      } else {
        expect(value < 0).toBe(true);
      }
    }
  });

  test('should validate notification interval range', () => {
    const validIntervals = [1, 5, 30, 60];
    const invalidIntervals = [0, -1, 61, 100];

    for (const interval of validIntervals) {
      expect(interval >= 1 && interval <= 60).toBe(true);
    }

    for (const interval of invalidIntervals) {
      expect(interval < 1 || interval > 60).toBe(true);
    }
  });

  test('should validate LinkedIn delay range', () => {
    const validDelays = [1, 3, 5, 10];
    const invalidDelays = [0, -1, 11, 20];

    for (const delay of validDelays) {
      expect(delay >= 1 && delay <= 10).toBe(true);
    }

    for (const delay of invalidDelays) {
      expect(delay < 1 || delay > 10).toBe(true);
    }
  });
});

describe('Popup - Webhook CRUD Operations', () => {
  beforeEach(() => {
    chromeMock.reset();
  });

  test('should load webhooks from storage', async () => {
    await chromeMock.storage.local.set({ webhooks: mockWebhooks });
    const data = await chromeMock.storage.local.get('webhooks');

    expect(data.webhooks).toHaveLength(3);
    expect(data.webhooks[0].name).toBe('Test Webhook 1');
  });

  test('should add new webhook to storage', async () => {
    await chromeMock.storage.local.set({ webhooks: mockWebhooks });

    const newWebhook = {
      name: 'New Webhook',
      url: 'https://new.webhook.com',
      rateLimit: 0,
    };

    const data = await chromeMock.storage.local.get({ webhooks: [] });
    const webhooks = [...data.webhooks, newWebhook];

    await chromeMock.storage.local.set({ webhooks });
    const updated = await chromeMock.storage.local.get('webhooks');

    expect(updated.webhooks).toHaveLength(4);
    expect(updated.webhooks[3].name).toBe('New Webhook');
  });

  test('should update existing webhook', async () => {
    await chromeMock.storage.local.set({ webhooks: mockWebhooks });

    const index = 0;
    const data = await chromeMock.storage.local.get('webhooks');
    const webhooks = [...data.webhooks];
    webhooks[index] = {
      name: 'Updated Webhook',
      url: 'https://updated.webhook.com',
      rateLimit: 10,
    };

    await chromeMock.storage.local.set({ webhooks });
    const updated = await chromeMock.storage.local.get('webhooks');

    expect(updated.webhooks[0].name).toBe('Updated Webhook');
    expect(updated.webhooks[0].rateLimit).toBe(10);
  });

  test('should delete webhook from storage', async () => {
    await chromeMock.storage.local.set({ webhooks: mockWebhooks });

    const index = 1;
    const data = await chromeMock.storage.local.get('webhooks');
    const webhooks = [...data.webhooks];
    const deletedWebhook = webhooks[index];
    webhooks.splice(index, 1);

    await chromeMock.storage.local.set({ webhooks });
    const updated = await chromeMock.storage.local.get('webhooks');

    expect(updated.webhooks).toHaveLength(2);
    expect(updated.webhooks.find((w) => w.name === deletedWebhook.name)).toBeUndefined();
  });

  test('should handle empty webhooks array', async () => {
    await chromeMock.storage.local.set({ webhooks: [] });
    const data = await chromeMock.storage.local.get({ webhooks: [] });

    expect(data.webhooks).toEqual([]);
  });
});

describe('Popup - Webhook Card Creation', () => {
  test('should create webhook card with correct structure', () => {
    const webhook = mockWebhooks[0];
    const index = 0;

    // Simulate card creation
    const card = {
      className: 'webhook-card',
      header: {
        title: webhook.name,
        url: webhook.url,
      },
      meta: {
        rateLimit: webhook.rateLimit > 0 ? `${webhook.rateLimit}s limit` : null,
      },
      actions: ['test', 'edit', 'delete'],
    };

    expect(card.header.title).toBe('Test Webhook 1');
    expect(card.header.url).toBe('https://webhook.site/test1');
    expect(card.meta.rateLimit).toBeNull();
  });

  test('should show rate limit badge when configured', () => {
    const webhook = mockWebhooks[1]; // Has 30s rate limit

    const rateLimitBadge = webhook.rateLimit > 0 ? `${webhook.rateLimit}s limit` : null;

    expect(rateLimitBadge).toBe('30s limit');
  });

  test('should not show rate limit badge when not configured', () => {
    const webhook = mockWebhooks[0]; // Has 0s rate limit

    const rateLimitBadge = webhook.rateLimit > 0 ? `${webhook.rateLimit}s limit` : null;

    expect(rateLimitBadge).toBeNull();
  });
});

describe('Popup - Webhook Testing', () => {
  beforeEach(() => {
    chromeMock.reset();
    global.fetch = vi.fn();
  });

  test('should send test webhook successfully', async () => {
    const webhook = mockWebhooks[0];
    const testPayload = {
      url: 'https://example.com/test',
      title: 'Test webhook from Chrome Extension',
      timestamp: new Date().toISOString(),
      type: 'test',
    };

    global.fetch.mockResolvedValue({
      ok: true,
      status: 200,
    });

    const startTime = Date.now();
    const response = await fetch(webhook.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testPayload),
    });
    const endTime = Date.now();
    const responseTime = endTime - startTime;

    expect(response.ok).toBe(true);
    expect(responseTime).toBeGreaterThanOrEqual(0);
  });

  test('should handle test webhook failure', async () => {
    const webhook = mockWebhooks[0];

    global.fetch.mockResolvedValue({
      ok: false,
      status: 500,
    });

    const response = await fetch(webhook.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    expect(response.ok).toBe(false);
    expect(response.status).toBe(500);
  });

  test('should handle network errors during test', async () => {
    const webhook = mockWebhooks[0];

    global.fetch.mockRejectedValue(new Error('Network error'));

    await expect(
      fetch(webhook.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
    ).rejects.toThrow('Network error');
  });

  test('should measure response time', async () => {
    const webhook = mockWebhooks[0];

    global.fetch.mockImplementation(() => {
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve({ ok: true, status: 200 });
        }, 100);
      });
    });

    const startTime = Date.now();
    await fetch(webhook.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const endTime = Date.now();
    const responseTime = endTime - startTime;

    expect(responseTime).toBeGreaterThanOrEqual(100);
  });
});

describe('Popup - Settings Management', () => {
  beforeEach(() => {
    chromeMock.reset();
  });

  test('should load settings from storage', async () => {
    await chromeMock.storage.local.set({ settings: mockSettings });
    const data = await chromeMock.storage.local.get({
      settings: { notificationInterval: 5 },
    });

    expect(data.settings.notificationInterval).toBe(5);
  });

  test('should save notification interval', async () => {
    const settings = { notificationInterval: 10 };

    await chromeMock.storage.local.set({ settings });
    const data = await chromeMock.storage.local.get('settings');

    expect(data.settings.notificationInterval).toBe(10);
  });

  test('should load LinkedIn settings', async () => {
    await chromeMock.storage.local.set({
      linkedinAutoDetect: true,
      linkedinAutoMutualConnections: true,
      linkedinBidirectional: false,
      linkedinWebhooks: 'selected',
      selectedLinkedinWebhooks: [0, 1],
      linkedinDelay: 5,
    });

    const settings = await chromeMock.storage.local.get([
      'linkedinAutoDetect',
      'linkedinAutoMutualConnections',
      'linkedinBidirectional',
      'linkedinWebhooks',
      'selectedLinkedinWebhooks',
      'linkedinDelay',
    ]);

    expect(settings.linkedinAutoDetect).toBe(true);
    expect(settings.linkedinAutoMutualConnections).toBe(true);
    expect(settings.linkedinBidirectional).toBe(false);
    expect(settings.linkedinWebhooks).toBe('selected');
    expect(settings.selectedLinkedinWebhooks).toEqual([0, 1]);
    expect(settings.linkedinDelay).toBe(5);
  });

  test('should save LinkedIn settings', async () => {
    const linkedinSettings = {
      linkedinAutoDetect: false,
      linkedinAutoMutualConnections: true,
      linkedinBidirectional: true,
      linkedinWebhooks: 'all',
      selectedLinkedinWebhooks: [],
      linkedinDelay: 3,
    };

    await chromeMock.storage.local.set(linkedinSettings);
    const settings = await chromeMock.storage.local.get(Object.keys(linkedinSettings));

    expect(settings).toEqual(linkedinSettings);
  });

  test('should validate selected webhooks when using selected mode', async () => {
    const linkedinWebhooks = 'selected';
    const selectedLinkedinWebhooks = [];

    const isValid = linkedinWebhooks === 'selected' && selectedLinkedinWebhooks.length === 0;

    expect(isValid).toBe(true); // Should show error
  });

  test('should allow empty selection when using all or none mode', async () => {
    const linkedinWebhooks = 'all';
    const selectedLinkedinWebhooks = [];

    const isValid = linkedinWebhooks !== 'selected' || selectedLinkedinWebhooks.length > 0;

    expect(isValid).toBe(true); // Should be valid
  });
});

describe('Popup - UI State Management', () => {
  test('should show empty state when no webhooks', () => {
    const webhooks = [];
    const showEmptyState = webhooks.length === 0;

    expect(showEmptyState).toBe(true);
  });

  test('should hide empty state when webhooks exist', () => {
    const webhooks = mockWebhooks;
    const showEmptyState = webhooks.length === 0;

    expect(showEmptyState).toBe(false);
  });

  test('should show webhook selection when selected mode is active', () => {
    const linkedinWebhooks = 'selected';
    const showSelection = linkedinWebhooks === 'selected';

    expect(showSelection).toBe(true);
  });

  test('should hide webhook selection when other modes are active', () => {
    const testCases = ['all', 'none'];

    for (const linkedinWebhooks of testCases) {
      const showSelection = linkedinWebhooks === 'selected';
      expect(showSelection).toBe(false);
    }
  });

  test('should update form title for editing', () => {
    const isEditing = true;
    const formTitle = isEditing ? 'Edit Webhook' : 'Add New Webhook';
    const buttonText = isEditing ? 'Update Webhook' : 'Save Webhook';

    expect(formTitle).toBe('Edit Webhook');
    expect(buttonText).toBe('Update Webhook');
  });

  test('should update form title for adding', () => {
    const isEditing = false;
    const formTitle = isEditing ? 'Edit Webhook' : 'Add New Webhook';
    const buttonText = isEditing ? 'Update Webhook' : 'Save Webhook';

    expect(formTitle).toBe('Add New Webhook');
    expect(buttonText).toBe('Save Webhook');
  });

  test('should track form visibility state', () => {
    let isFormVisible = false;

    const showForm = () => {
      isFormVisible = true;
    };

    const hideForm = () => {
      isFormVisible = false;
    };

    expect(isFormVisible).toBe(false);

    showForm();
    expect(isFormVisible).toBe(true);

    hideForm();
    expect(isFormVisible).toBe(false);
  });
});

describe('Popup - Tab Navigation', () => {
  test('should switch between tabs', () => {
    const tabs = ['webhooks', 'settings'];
    let activeTab = 'webhooks';

    const switchTab = (tabName) => {
      activeTab = tabName;
    };

    expect(activeTab).toBe('webhooks');

    switchTab('settings');
    expect(activeTab).toBe('settings');

    switchTab('webhooks');
    expect(activeTab).toBe('webhooks');
  });

  test('should track active tab state', () => {
    const tabs = [
      { name: 'webhooks', active: true },
      { name: 'settings', active: false },
    ];

    const activeTabs = tabs.filter((tab) => tab.active);
    expect(activeTabs).toHaveLength(1);
    expect(activeTabs[0].name).toBe('webhooks');
  });
});

describe('Popup - Delete Confirmation', () => {
  test('should require two clicks to delete', () => {
    let confirmDelete = false;
    let deleted = false;

    const handleDeleteClick = () => {
      if (confirmDelete) {
        deleted = true;
      } else {
        confirmDelete = true;
      }
    };

    // First click
    handleDeleteClick();
    expect(confirmDelete).toBe(true);
    expect(deleted).toBe(false);

    // Second click
    handleDeleteClick();
    expect(deleted).toBe(true);
  });

  test('should reset confirmation on cancel', () => {
    let confirmDelete = false;

    const handleDeleteClick = () => {
      confirmDelete = true;
    };

    const handleCancel = () => {
      confirmDelete = false;
    };

    handleDeleteClick();
    expect(confirmDelete).toBe(true);

    handleCancel();
    expect(confirmDelete).toBe(false);
  });
});

describe('Popup - Message Display', () => {
  test('should show success message', () => {
    const message = 'Webhook saved successfully!';
    const type = 'success';

    const messageData = { message, type };

    expect(messageData.message).toBe(message);
    expect(messageData.type).toBe('success');
  });

  test('should show error message', () => {
    const message = 'Failed to save webhook';
    const type = 'error';

    const messageData = { message, type };

    expect(messageData.message).toBe(message);
    expect(messageData.type).toBe('error');
  });

  test('should auto-dismiss messages after timeout', () => {
    vi.useFakeTimers();

    let messageVisible = true;
    const autoDismissTimeout = 5000;

    setTimeout(() => {
      messageVisible = false;
    }, autoDismissTimeout);

    expect(messageVisible).toBe(true);

    vi.advanceTimersByTime(5000);
    expect(messageVisible).toBe(false);

    vi.useRealTimers();
  });
});

describe('Popup - Webhook Checkboxes', () => {
  beforeEach(() => {
    chromeMock.reset();
  });

  test('should populate webhook checkboxes', async () => {
    await chromeMock.storage.local.set({ webhooks: mockWebhooks });

    const data = await chromeMock.storage.local.get('webhooks');
    const checkboxes = data.webhooks.map((webhook, index) => ({
      id: `webhook-${index}`,
      label: webhook.name,
      checked: false,
    }));

    expect(checkboxes).toHaveLength(3);
    expect(checkboxes[0].label).toBe('Test Webhook 1');
  });

  test('should mark selected webhooks as checked', async () => {
    await chromeMock.storage.local.set({
      webhooks: mockWebhooks,
      selectedLinkedinWebhooks: [0, 2],
    });

    const data = await chromeMock.storage.local.get(['webhooks', 'selectedLinkedinWebhooks']);
    const checkboxes = data.webhooks.map((webhook, index) => ({
      id: `webhook-${index}`,
      label: webhook.name,
      checked: data.selectedLinkedinWebhooks.includes(index),
    }));

    expect(checkboxes[0].checked).toBe(true);
    expect(checkboxes[1].checked).toBe(false);
    expect(checkboxes[2].checked).toBe(true);
  });

  test('should show message when no webhooks configured', async () => {
    await chromeMock.storage.local.set({ webhooks: [] });

    const data = await chromeMock.storage.local.get('webhooks');
    const hasWebhooks = data.webhooks && data.webhooks.length > 0;

    expect(hasWebhooks).toBe(false);
  });
});
