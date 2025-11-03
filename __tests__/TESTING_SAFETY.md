# Testing Safety Guidelines

## 🛡️ LinkedIn Test Isolation

### Critical Safety Features

This test suite is designed with **COMPLETE ISOLATION** from LinkedIn infrastructure to ensure:

1. ✅ **No Real Network Requests**: Tests NEVER contact LinkedIn servers
2. ✅ **No Session Interference**: Your LinkedIn session remains untouched
3. ✅ **Mock Data Only**: All tests use static DOM fixtures
4. ✅ **Automated Protection**: Network interceptor blocks unauthorized requests

### How We Ensure Safety

#### 1. Network Request Interceptor

Located in `__tests__/helpers/linkedinMock.js`, the `networkInterceptor` blocks ALL requests to LinkedIn domains:

```javascript
blockedDomains: [
  'linkedin.com',
  'licdn.com',
  'www.linkedin.com',
  'api.linkedin.com',
  'static.licdn.com',
  'media.licdn.com',
]
```

**If a test attempts to contact LinkedIn, it will FAIL immediately with an error:**

```
BLOCKED: Test attempted to make network request to linkedin.com.
Tests must use mock data only. Check linkedinMock.js fixtures.
```

#### 2. Static DOM Fixtures

All LinkedIn DOM structures are **frozen snapshots** located in `linkedinDOMFixtures`:

- `fullProfile()` - Complete profile with experience, education, skills
- `minimalProfile()` - New user profile (edge case)
- `noExperienceProfile()` - Student profile without work history
- `mutualConnections()` - Connection list structure

**These contain NO real data** - only test-safe placeholder content.

#### 3. Mock Response Data

Pre-defined expected outputs in `mockLinkedInParserResponse`:

```javascript
{
  name: 'John Test User',
  headline: 'Senior Software Engineer at Test Company',
  // ... test data only
}
```

#### 4. Automatic Test Environment Setup

Every test automatically runs in an isolated environment:

```javascript
beforeEach(() => {
  setupLinkedInTestEnvironment(); // Installs network blocker
});

afterEach(() => {
  teardownLinkedInTestEnvironment(); // Cleans up
});
```

### Running Tests Safely

#### Run All Tests

```bash
npm test                    # Watch mode
npm run test:run            # CI mode (single run)
npm run test:ui             # Visual dashboard
```

#### Run Only LinkedIn Tests

```bash
npm test pageHelper     # Watch LinkedIn parser tests
npm run test:run -- pageHelper  # CI mode
```

#### Verify Safety

Run this test to verify the network interceptor is working:

```bash
npm test -- --grep "should block real LinkedIn requests"
```

### What Tests Actually Do

#### ✅ Safe Operations

- Read static HTML fixtures from `linkedinDOMFixtures`
- Parse mock DOM elements using `querySelector`
- Validate extraction logic with test data
- Check error handling with malformed fixtures

#### ❌ Blocked Operations

- `fetch()` to linkedin.com → **BLOCKED**
- `XMLHttpRequest` to linkedin.com → **BLOCKED**
- Loading real LinkedIn pages → **BLOCKED**
- Accessing live DOM → **BLOCKED**

### Test Architecture

```
__tests__/
├── helpers/
│   ├── linkedinMock.js        ← CRITICAL: Network blocker & fixtures
│   ├── chromeMock.js          ← Chrome API mock
│   ├── setup.js               ← Global setup (installs blocker)
│   └── testData.js            ← Test fixtures
│
├── unit/
│   ├── pageHelper.test.js ← Uses isolated environment
│   ├── background.test.js     ← Safe Chrome API mocks
│   └── popup.test.js          ← UI tests (no network)
│
└── integration/
    └── chrome-api.test.js     ← Integration tests (mocked APIs)
```

### Verification Checklist

Before running tests for the first time:

- [ ] Verify `networkInterceptor.install()` is called in `setup.js`
- [ ] Check test output for "BLOCKED" errors (should be none in normal runs)
- [ ] Run `npm test -- --grep "network"` to test blocker functionality
- [ ] Confirm no browser tabs open to LinkedIn during tests

### Emergency Stop

If you suspect tests are contacting LinkedIn:

1. **Immediately stop tests**: `Ctrl+C` in terminal
2. **Check network tab**: Verify no requests to linkedin.com
3. **Review test logs**: Look for fetch/XHR errors
4. **Verify blocker**: Run `npm test -- --grep "should block"`

### CI/CD Safety

For continuous integration:

```yaml
# GitHub Actions example
- name: Run tests in complete isolation
  run: |
    npm run test:run
  env:
    NODE_ENV: test
    # Optional: Verify no network access
    NO_NETWORK: true
```

### Debugging Without Touching LinkedIn

To debug parser logic:

1. **Use browser DevTools on a real profile** (read-only):
   - Open LinkedIn profile manually
   - Open DevTools → Elements
   - Copy HTML structure
   - Add to `linkedinDOMFixtures` as new fixture

2. **Update test fixtures**:
   ```javascript
   // In linkedinMock.js
   newProfileType: () => {
     const container = document.createElement('div');
     container.innerHTML = `<!-- paste copied HTML -->`;
     return container;
   }
   ```

3. **Run tests against new fixture**:
   ```javascript
   test('should parse new profile type', () => {
     loadLinkedInFixture('newProfileType');
     // ... test logic
   });
   ```

### FAQ

**Q: Can tests accidentally log me out of LinkedIn?**
A: No. Tests run in jsdom, a simulated browser environment with no connection to your real browser session.

**Q: Do tests use my LinkedIn cookies?**
A: No. Tests use mock Chrome APIs. No cookies are accessed or transmitted.

**Q: What if I need to test against a real profile structure?**
A: Manually copy the HTML from DevTools and create a new fixture. Never automate fetching real pages.

**Q: How do I know the blocker is working?**
A: Run `npm test` and look for the setup message. If any test attempts a blocked request, it will fail immediately with a clear error message.

**Q: Can I run tests while logged into LinkedIn?**
A: Yes, tests are completely isolated. Your LinkedIn session is unaffected.

### Contact & Support

If you have concerns about test safety:

1. Review `__tests__/helpers/linkedinMock.js` for blocker implementation
2. Check `__tests__/helpers/setup.js` for global setup
3. Run verification tests: `npm run test:run -- --grep "safety"`
4. Review test output for any unexpected network activity

---

**Last Updated**: 2025-11-01
**Reviewed By**: AI Code Review System
**Safety Level**: ✅ Complete Isolation
