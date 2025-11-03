# Test Suite Documentation

Comprehensive test suite for the Chrome Webhook Extension, covering unit tests, integration tests, and end-to-end workflows.

## 🛡️ IMPORTANT: Test Safety

**All tests run in complete isolation from LinkedIn.** See [TESTING_SAFETY.md](./TESTING_SAFETY.md) for details on:
- Network request blocking
- Mock data fixtures
- Session isolation guarantees
- Safety verification steps

**Tests NEVER contact LinkedIn servers or interfere with your session.**

## Table of Contents

- [🛡️ Test Safety](#-important-test-safety)
- [Overview](#overview)
- [Test Structure](#test-structure)
- [Running Tests](#running-tests)
- [Test Coverage](#test-coverage)
- [Writing Tests](#writing-tests)
- [Best Practices](#best-practices)
- [LinkedIn Testing](#linkedin-testing)

## Overview

This test suite follows Test-Driven Development (TDD) principles and modern testing best practices. Tests are written using Vitest, a fast and modern testing framework, with comprehensive mocks for Chrome extension APIs.

### Technology Stack

- **Testing Framework**: Vitest 4.0+
- **DOM Testing**: jsdom / happy-dom
- **Chrome API Mocking**: Custom chromeMock utility
- **Test Utilities**: @testing-library/dom, @testing-library/user-event

### Test Philosophy

1. **Test-First Development**: Write failing tests before implementation
2. **Comprehensive Coverage**: Unit, integration, and E2E tests
3. **Fast Feedback**: Subsecond test execution for quick iteration
4. **Realistic Mocks**: Chrome APIs mocked to behave like production
5. **Clear Intent**: Test names describe expected behavior

## Test Structure

```
__tests__/
├── helpers/             # Test utilities and mocks
│   ├── setup.js        # Global test setup
│   ├── chromeMock.js   # Chrome API mock
│   └── testData.js     # Test fixtures and data
├── unit/               # Unit tests for individual modules
│   ├── background.test.js       # Background script tests
│   ├── popup.test.js            # Popup UI tests
│   └── pageHelper.test.js  # LinkedIn parser tests
├── integration/        # Integration tests
│   └── chrome-api.test.js      # Chrome API integration tests
└── README.md          # This file
```

## Running Tests

### Quick Start

```bash
# Run all tests in watch mode
bun test

# Run all tests once
bun test:run

# Run with UI dashboard
bun test:ui

# Run with coverage report
bun test:coverage

# Run only unit tests
bun test:unit

# Run only integration tests
bun test:integration

# Watch specific test file
bun test background.test.js
```

### Test Scripts

| Command | Description |
|---------|-------------|
| `bun test` | Start Vitest in watch mode |
| `bun test:ui` | Open Vitest UI dashboard |
| `bun test:run` | Run all tests once (CI mode) |
| `bun test:coverage` | Generate coverage report |
| `bun test:watch` | Watch mode (alias for `bun test`) |
| `bun test:unit` | Run unit tests only |
| `bun test:integration` | Run integration tests only |

### CI/CD Integration

For continuous integration, use:

```bash
bun test:run
```

This runs all tests once and exits with appropriate status codes.

## Test Coverage

### Current Coverage

The test suite covers:

#### Background Script (`background.js`)
- ✅ Webhook queue management (FIFO, rate limiting)
- ✅ Context menu creation and updates
- ✅ Data extraction from pages, links, images, selections
- ✅ LinkedIn profile detection and parsing
- ✅ Webhook HTTP requests with retry logic
- ✅ Notification management (success, error, queue status)
- ✅ Chrome storage operations
- ✅ Mutual connections parsing workflow

#### Popup Script (`popup.js`)
- ✅ Form validation (URL, name, rate limit)
- ✅ Webhook CRUD operations (Create, Read, Update, Delete)
- ✅ Webhook testing functionality
- ✅ Settings management (notifications, LinkedIn)
- ✅ UI state management (tabs, forms, messages)
- ✅ Two-click delete confirmation
- ✅ Webhook selection for LinkedIn data

#### LinkedIn Parser (`src/contentScripts/pageHelper.js`)
- ✅ Profile page parsing (name, title, location, image)
- ✅ Experience extraction (title, company, duration, location)
- ✅ Education extraction (school, degree, field, duration)
- ✅ Skills extraction (name, endorsements)
- ✅ Mutual connections detection and parsing
- ✅ Search results parsing
- ✅ Pagination handling
- ✅ Anti-detection mechanisms
- ✅ Bidirectional payload generation
- ✅ Error handling and fallbacks

#### Chrome API Integration
- ✅ Storage API (get, set, remove, onChanged)
- ✅ Tabs API (create, query, sendMessage, remove, onUpdated)
- ✅ Context Menus API (create, update, removeAll, onClicked)
- ✅ Notifications API (create, clear, getAll)
- ✅ Scripting API (executeScript)
- ✅ Runtime API (onInstalled, onStartup, onMessage)

### Coverage Goals

- **Unit Tests**: 90%+ line coverage
- **Integration Tests**: All critical workflows
- **Edge Cases**: Error handling, boundary conditions
- **Browser Compatibility**: Chrome extension APIs

## Writing Tests

### Test Structure

Follow the Arrange-Act-Assert (AAA) pattern:

```javascript
test('should validate webhook URL correctly', () => {
  // Arrange
  const url = 'https://webhook.site/test';

  // Act
  const isValid = validateURL(url);

  // Assert
  expect(isValid).toBe(true);
});
```

### Using Chrome API Mocks

The `chromeMock` utility provides realistic Chrome API behavior:

```javascript
import { chromeMock } from '../helpers/chromeMock.js';

test('should save webhooks to storage', async () => {
  // Arrange
  const webhooks = [{ name: 'Test', url: 'https://example.com' }];

  // Act
  await chromeMock.storage.local.set({ webhooks });

  // Assert
  const data = await chromeMock.storage.local.get('webhooks');
  expect(data.webhooks).toEqual(webhooks);
});
```

### Test Data Fixtures

Use predefined test data from `testData.js`:

```javascript
import { mockWebhooks, mockLinkedInProfile } from '../helpers/testData.js';

test('should parse LinkedIn profile', () => {
  // Use mockLinkedInProfile for consistent test data
  expect(mockLinkedInProfile.name).toBe('John Doe');
});
```

### Async Testing

Always await async operations and use proper error handling:

```javascript
test('should handle async webhook send', async () => {
  global.fetch = vi.fn().mockResolvedValue({ ok: true });

  const response = await fetch('https://webhook.site/test', {
    method: 'POST',
    body: JSON.stringify({ test: true }),
  });

  expect(response.ok).toBe(true);
});
```

### Timer Testing

Use fake timers for time-dependent tests:

```javascript
test('should auto-dismiss messages after timeout', () => {
  vi.useFakeTimers();

  let visible = true;
  setTimeout(() => { visible = false; }, 5000);

  expect(visible).toBe(true);

  vi.advanceTimersByTime(5000);
  expect(visible).toBe(false);

  vi.useRealTimers();
});
```

## Best Practices

### TDD Workflow

1. **Write Failing Test**: Define expected behavior
2. **Run Test**: Verify it fails for the right reason
3. **Implement Code**: Write minimal code to pass
4. **Run Test**: Verify it passes
5. **Refactor**: Improve code while tests remain green

### Test Naming

Use descriptive test names that explain the scenario:

```javascript
// ✅ Good
test('should retry webhook request 3 times on failure', () => {});

// ❌ Bad
test('webhook retry', () => {});
```

### Test Organization

Group related tests using `describe` blocks:

```javascript
describe('Webhook Queue Management', () => {
  describe('Rate Limiting', () => {
    test('should respect rate limit for same webhook', () => {});
    test('should allow immediate send when no rate limit', () => {});
  });

  describe('Queue Processing', () => {
    test('should process queue in FIFO order', () => {});
    test('should clear notification when queue is empty', () => {});
  });
});
```

### Isolation

Each test should be independent:

```javascript
beforeEach(() => {
  chromeMock.reset(); // Reset mocks between tests
  vi.clearAllMocks();
});
```

### Error Testing

Test both success and failure paths:

```javascript
test('should show error notification on webhook failure', async () => {
  global.fetch.mockResolvedValue({ ok: false, status: 500 });

  const response = await sendWebhook('https://example.com', {});

  expect(response.ok).toBe(false);
});
```

### Edge Cases

Test boundary conditions and edge cases:

```javascript
test('should handle empty webhooks array', async () => {
  await chromeMock.storage.local.set({ webhooks: [] });
  const data = await chromeMock.storage.local.get('webhooks');

  expect(data.webhooks).toEqual([]);
});

test('should validate rate limit is not negative', () => {
  const rateLimit = -5;
  const isValid = rateLimit >= 0;

  expect(isValid).toBe(false);
});
```

### Mocking Best Practices

1. **Use vi.fn()** for function spies
2. **Reset mocks** between tests
3. **Mock at the boundary**: Mock external APIs, not internal functions
4. **Verify mock calls** with `toHaveBeenCalledWith()`

```javascript
test('should call fetch with correct parameters', async () => {
  global.fetch = vi.fn().mockResolvedValue({ ok: true });

  await sendWebhook('https://webhook.site/test', { data: 'test' });

  expect(global.fetch).toHaveBeenCalledWith(
    'https://webhook.site/test',
    expect.objectContaining({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })
  );
});
```

### DOM Testing

When testing DOM manipulation:

```javascript
test('should extract profile name from DOM', () => {
  // Setup DOM
  document.body.innerHTML = '<h1 class="profile-name">John Doe</h1>';

  // Extract data
  const element = document.querySelector('.profile-name');
  const name = element?.textContent?.trim();

  // Verify
  expect(name).toBe('John Doe');

  // Cleanup
  document.body.innerHTML = '';
});
```

### Performance Testing

Test that operations complete in reasonable time:

```javascript
test('should complete queue processing in under 1 second', async () => {
  const startTime = Date.now();

  await processQueue('https://webhook.site/test');

  const duration = Date.now() - startTime;
  expect(duration).toBeLessThan(1000);
});
```

## Continuous Improvement

### Adding New Tests

When adding new features:

1. Write failing tests first (TDD)
2. Ensure tests cover success and failure paths
3. Add edge case tests
4. Update test documentation

### Refactoring Tests

When refactoring tests:

1. Keep test intent clear
2. Remove duplication with helper functions
3. Update test data fixtures
4. Maintain test isolation

### Test Metrics

Monitor these metrics:

- **Coverage**: Aim for 90%+ line coverage
- **Speed**: Tests should run in < 5 seconds total
- **Flakiness**: Zero flaky tests (inconsistent results)
- **Maintenance**: Easy to update when requirements change

## Troubleshooting

### Common Issues

**Tests not finding Chrome APIs**

Ensure `chromeMock` is imported in test setup:

```javascript
import { chromeMock } from '../helpers/chromeMock.js';
```

**Async tests timing out**

Always await async operations and use proper timeout:

```javascript
test('async operation', async () => {
  await someAsyncFunction();
}, 10000); // 10 second timeout if needed
```

**Mocks not resetting**

Add `beforeEach` hook to reset mocks:

```javascript
beforeEach(() => {
  chromeMock.reset();
  vi.clearAllMocks();
});
```

**DOM not cleaning up**

Clean up DOM in `beforeEach`:

```javascript
beforeEach(() => {
  document.body.innerHTML = '';
});
```

## LinkedIn Testing

### Safety First

**All LinkedIn tests run in complete isolation.** The test suite includes:

1. **Network Interceptor**: Blocks ALL requests to LinkedIn domains
2. **Static Fixtures**: Pre-defined DOM structures (no real data)
3. **Mock Responses**: Expected parser outputs for validation
4. **Automatic Setup**: Isolation enabled in every test

See [TESTING_SAFETY.md](./TESTING_SAFETY.md) for complete safety documentation.

### Using LinkedIn Fixtures

```javascript
import {
  setupLinkedInTestEnvironment,
  teardownLinkedInTestEnvironment,
  loadLinkedInFixture,
  mockLinkedInParserResponse,
} from '../helpers/linkedinMock.js';

describe('LinkedIn Profile Parsing', () => {
  beforeEach(() => {
    setupLinkedInTestEnvironment(); // Installs network blocker
  });

  afterEach(() => {
    teardownLinkedInTestEnvironment(); // Cleans up
  });

  test('should parse full profile', () => {
    // Load static DOM fixture
    loadLinkedInFixture('fullProfile');

    // Parse using real parser logic
    const profileData = parseLinkedInProfile();

    // Validate against expected output
    expect(profileData).toEqual(mockLinkedInParserResponse.fullProfile);
  });
});
```

### Available Fixtures

Located in `__tests__/helpers/linkedinMock.js`:

- `fullProfile` - Complete profile with experience, education, skills
- `minimalProfile` - New user profile (edge case)
- `noExperienceProfile` - Student profile without work history
- `mutualConnections` - Connection list structure

### Network Safety Verification

Test that the blocker is working:

```bash
npm test -- --grep "should block real LinkedIn requests"
```

If this test passes, the network interceptor is functioning correctly.

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [Testing Library](https://testing-library.com/)
- [Chrome Extensions Testing](https://developer.chrome.com/docs/extensions/mv3/testing/)
- [Test-Driven Development](https://martinfowler.com/bliki/TestDrivenDevelopment.html)
- [Test Safety Guidelines](./TESTING_SAFETY.md) 🛡️

## Contributing

When contributing tests:

1. Follow existing test structure
2. Use descriptive test names
3. Ensure tests are isolated and fast
4. Add documentation for complex test scenarios
5. Run `bun test:coverage` to verify coverage

## License

Same as parent project.
