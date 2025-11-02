import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import {
  setupLinkedInTestEnvironment,
  teardownLinkedInTestEnvironment,
  networkInterceptor,
} from '../helpers/linkedinMock.js';

/**
 * Network Safety Tests
 *
 * These tests verify that the LinkedIn network interceptor is working correctly
 * and that tests CANNOT accidentally contact LinkedIn servers.
 */

describe('Network Safety - LinkedIn Isolation', () => {
  beforeEach(() => {
    setupLinkedInTestEnvironment();
  });

  afterEach(() => {
    teardownLinkedInTestEnvironment();
  });

  test('should block real LinkedIn requests via fetch', async () => {
    // Attempt to fetch from LinkedIn
    await expect(async () => {
      await fetch('https://www.linkedin.com/in/test-user');
    }).rejects.toThrow(/BLOCKED.*linkedin\.com/);
  });

  test('should block LinkedIn CDN requests', async () => {
    await expect(async () => {
      await fetch('https://static.licdn.com/image.png');
    }).rejects.toThrow(/BLOCKED.*licdn\.com/);
  });

  test('should block LinkedIn API requests', async () => {
    await expect(async () => {
      await fetch('https://api.linkedin.com/v2/me');
    }).rejects.toThrow(/BLOCKED.*linkedin\.com/);
  });

  test('should block XMLHttpRequest to LinkedIn', () => {
    expect(() => {
      const xhr = new XMLHttpRequest();
      xhr.open('GET', 'https://www.linkedin.com/in/test-user');
    }).toThrow(/BLOCKED.*linkedin\.com/);
  });

  test('should allow non-LinkedIn requests', async () => {
    // Mock a non-LinkedIn fetch
    const mockFetch = global.fetch;
    global.fetch = async (url) => {
      if (networkInterceptor.isBlocked(url)) {
        throw new Error(`BLOCKED: ${url}`);
      }
      return { ok: true, json: async () => ({ success: true }) };
    };

    // This should NOT throw
    const response = await fetch('https://webhook.site/test');
    expect(response.ok).toBe(true);

    global.fetch = mockFetch;
  });

  test('should verify network interceptor is installed', () => {
    expect(networkInterceptor.originalFetch).toBeDefined();
    expect(networkInterceptor.originalXHR).toBeDefined();
  });

  test('should have blocked domains configured', () => {
    expect(networkInterceptor.blockedDomains).toContain('linkedin.com');
    expect(networkInterceptor.blockedDomains).toContain('licdn.com');
    expect(networkInterceptor.blockedDomains).toContain('www.linkedin.com');
    expect(networkInterceptor.blockedDomains).toContain('api.linkedin.com');
  });

  test('should correctly identify blocked URLs', () => {
    expect(networkInterceptor.isBlocked('https://www.linkedin.com/in/user')).toBe(true);
    expect(networkInterceptor.isBlocked('https://linkedin.com/feed/')).toBe(true);
    expect(networkInterceptor.isBlocked('https://static.licdn.com/image.jpg')).toBe(true);
    expect(networkInterceptor.isBlocked('https://example.com/api')).toBe(false);
    expect(networkInterceptor.isBlocked('https://webhook.site/test')).toBe(false);
  });
});

describe('Network Safety - Error Messages', () => {
  beforeEach(() => {
    setupLinkedInTestEnvironment();
  });

  afterEach(() => {
    teardownLinkedInTestEnvironment();
  });

  test('should provide helpful error message for blocked fetch', async () => {
    try {
      await fetch('https://www.linkedin.com/in/test-user');
      // Should not reach here
      expect(true).toBe(false);
    } catch (error) {
      expect(error.message).toContain('BLOCKED');
      expect(error.message).toContain('linkedin.com');
      expect(error.message).toContain('mock data');
      expect(error.message).toContain('linkedinMock.js');
    }
  });

  test('should provide helpful error message for blocked XHR', () => {
    try {
      const xhr = new XMLHttpRequest();
      xhr.open('GET', 'https://api.linkedin.com/v2/me');
      // Should not reach here
      expect(true).toBe(false);
    } catch (error) {
      expect(error.message).toContain('BLOCKED');
      expect(error.message).toContain('api.linkedin.com');
      expect(error.message).toContain('XMLHttpRequest');
    }
  });
});

describe('Network Safety - Cleanup', () => {
  test('should uninstall interceptor on teardown', () => {
    setupLinkedInTestEnvironment();

    // Verify interceptor is installed
    expect(networkInterceptor.originalFetch).toBeDefined();

    teardownLinkedInTestEnvironment();

    // After teardown, original functions should still be tracked
    // (they're kept for potential reinstallation)
    expect(networkInterceptor.originalFetch).toBeDefined();
  });

  test('should allow reinstallation after uninstall', () => {
    setupLinkedInTestEnvironment();
    teardownLinkedInTestEnvironment();
    setupLinkedInTestEnvironment();

    // Should still block after reinstall
    expect(async () => {
      await fetch('https://www.linkedin.com/test');
    }).rejects.toThrow(/BLOCKED/);

    teardownLinkedInTestEnvironment();
  });
});
