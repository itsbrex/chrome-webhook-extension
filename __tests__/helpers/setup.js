// Test environment setup
import { vi } from 'vitest';
import { chromeMock } from './chromeMock.js';
import { networkInterceptor } from './linkedinMock.js';

// Setup global Chrome API mock
global.chrome = chromeMock;

// CRITICAL: Install LinkedIn network interceptor to prevent real requests
// This BLOCKS all requests to linkedin.com during tests
networkInterceptor.install();

// Mock fetch globally (with LinkedIn blocking)
global.fetch = vi.fn();

// Mock notifications
global.Notification = vi.fn();

// Mock URL if needed
if (!global.URL) {
  global.URL = class URL {
    constructor(url, base) {
      this.href = url;
      this.searchParams = new Map();
      const match = url.match(/[?&]([^=]+)=([^&]*)/g);
      if (match) {
        for (const param of match) {
          const [key, value] = param.slice(1).split('=');
          this.searchParams.set(key, value);
        }
      }
    }
  };
}

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

// Clean up after each test
afterEach(() => {
  vi.clearAllMocks();
  chromeMock.reset();
});
