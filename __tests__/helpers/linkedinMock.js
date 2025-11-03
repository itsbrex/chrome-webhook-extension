import { vi } from 'vitest';

/**
 * LinkedIn Test Isolation Layer
 *
 * CRITICAL SAFETY FEATURES:
 * - Prevents all real LinkedIn network requests
 * - Uses static DOM fixtures instead of live pages
 * - Intercepts and mocks all external communications
 * - Ensures tests run in complete isolation from LinkedIn sessions
 *
 * This mock ensures tests NEVER touch real LinkedIn infrastructure or sessions.
 */

// Network request interceptor - blocks ALL outbound requests during tests
export const networkInterceptor = {
  blockedDomains: [
    'linkedin.com',
    'licdn.com', // LinkedIn CDN
    'www.linkedin.com',
    'api.linkedin.com',
    'static.licdn.com',
    'media.licdn.com',
  ],

  originalFetch: null,
  originalXHR: null,

  install() {
    // Block fetch API
    this.originalFetch = global.fetch;
    global.fetch = vi.fn((url) => {
      const urlString = typeof url === 'string' ? url : url.url;
      if (this.isBlocked(urlString)) {
        throw new Error(
          `BLOCKED: Test attempted to make network request to ${urlString}. ` +
          `Tests must use mock data only. Check linkedinMock.js fixtures.`
        );
      }
      return this.originalFetch(url);
    });

    // Block XMLHttpRequest
    this.originalXHR = global.XMLHttpRequest;
    global.XMLHttpRequest = class extends this.originalXHR {
      open(method, url, ...args) {
        if (networkInterceptor.isBlocked(url)) {
          throw new Error(
            `BLOCKED: Test attempted XMLHttpRequest to ${url}. ` +
            `Tests must use mock data only.`
          );
        }
        return super.open(method, url, ...args);
      }
    };
  },

  uninstall() {
    if (this.originalFetch) {
      global.fetch = this.originalFetch;
    }
    if (this.originalXHR) {
      global.XMLHttpRequest = this.originalXHR;
    }
  },

  isBlocked(url) {
    return this.blockedDomains.some(domain => url.includes(domain));
  },
};

/**
 * Static LinkedIn Profile DOM Fixtures
 * These are frozen snapshots of LinkedIn DOM structures for testing
 * They represent what the parser expects to find, but contain NO real data
 */
export const linkedinDOMFixtures = {
  // Complete profile page structure
  fullProfile: () => {
    const container = document.createElement('div');
    container.innerHTML = `
      <div class="pv-top-card">
        <div class="text-heading-xlarge">John Test User</div>
        <div class="text-body-medium">Senior Software Engineer at Test Company</div>
        <span class="text-body-small">San Francisco Bay Area</span>
      </div>

      <!-- Experience Section -->
      <section id="experience" class="artdeco-card">
        <div class="pvs-list__outer-container">
          <ul class="pvs-list">
            <li class="pvs-list__item--line-separated">
              <div class="display-flex flex-column full-width">
                <span class="mr1 t-bold">
                  <span aria-hidden="true">Software Engineer</span>
                </span>
                <span class="t-14 t-normal">
                  <span class="t-black--light">
                    <span aria-hidden="true">Test Corp</span>
                  </span>
                </span>
                <span class="t-14 t-normal t-black--light">
                  <span aria-hidden="true">Jan 2020 – Present · 4 yrs</span>
                </span>
                <span class="t-14 t-normal t-black--light">
                  <span aria-hidden="true">Remote</span>
                </span>
              </div>
            </li>
            <li class="pvs-list__item--line-separated">
              <div class="display-flex flex-column full-width">
                <span class="mr1 t-bold">
                  <span aria-hidden="true">Junior Developer</span>
                </span>
                <span class="t-14 t-normal">
                  <span class="t-black--light">
                    <span aria-hidden="true">Startup Inc</span>
                  </span>
                </span>
                <span class="t-14 t-normal t-black--light">
                  <span aria-hidden="true">2018 - 2020 · 2 yrs</span>
                </span>
              </div>
            </li>
          </ul>
        </div>
      </section>

      <!-- Education Section -->
      <section id="education" class="artdeco-card">
        <div class="pvs-list__outer-container">
          <ul class="pvs-list">
            <li class="pvs-list__item--line-separated">
              <div class="display-flex flex-column full-width">
                <span class="mr1 t-bold">
                  <span aria-hidden="true">Test University</span>
                </span>
                <span class="t-14 t-normal t-black--light">
                  <span aria-hidden="true">Bachelor of Science - BS, Computer Science</span>
                </span>
                <span class="t-14 t-normal t-black--light">
                  <span aria-hidden="true">2014 - 2018</span>
                </span>
              </div>
            </li>
          </ul>
        </div>
      </section>

      <!-- Skills Section -->
      <section id="skills" class="artdeco-card">
        <div class="pvs-list__outer-container">
          <ul class="pvs-list">
            <li class="pvs-list__item--line-separated">
              <span class="mr1 hoverable-link-text t-bold">
                <span aria-hidden="true">JavaScript</span>
              </span>
              <span class="t-14 t-normal t-black--light">
                <span aria-hidden="true">50 endorsements</span>
              </span>
            </li>
            <li class="pvs-list__item--line-separated">
              <span class="mr1 hoverable-link-text t-bold">
                <span aria-hidden="true">React</span>
              </span>
              <span class="t-14 t-normal t-black--light">
                <span aria-hidden="true">35 endorsements</span>
              </span>
            </li>
            <li class="pvs-list__item--line-separated">
              <span class="mr1 hoverable-link-text t-bold">
                <span aria-hidden="true">Node.js</span>
              </span>
              <span class="t-14 t-normal t-black--light">
                <span aria-hidden="true">28 endorsements</span>
              </span>
            </li>
          </ul>
        </div>
      </section>
    `;
    return container;
  },

  // Minimal profile (edge case: new user)
  minimalProfile: () => {
    const container = document.createElement('div');
    container.innerHTML = `
      <div class="pv-top-card">
        <div class="text-heading-xlarge">New User</div>
        <div class="text-body-medium">Student</div>
      </div>
    `;
    return container;
  },

  // Profile with no experience
  noExperienceProfile: () => {
    const container = document.createElement('div');
    container.innerHTML = `
      <div class="pv-top-card">
        <div class="text-heading-xlarge">Student User</div>
        <div class="text-body-medium">Seeking Opportunities</div>
        <span class="text-body-small">Boston, MA</span>
      </div>
      <section id="education" class="artdeco-card">
        <div class="pvs-list__outer-container">
          <ul class="pvs-list">
            <li class="pvs-list__item--line-separated">
              <div class="display-flex flex-column full-width">
                <span class="mr1 t-bold">
                  <span aria-hidden="true">Test College</span>
                </span>
                <span class="t-14 t-normal t-black--light">
                  <span aria-hidden="true">Currently Enrolled</span>
                </span>
              </div>
            </li>
          </ul>
        </div>
      </section>
    `;
    return container;
  },

  // Mutual connections section
  mutualConnections: () => {
    const container = document.createElement('div');
    container.innerHTML = `
      <section class="pv-browsemap-section">
        <h2 class="pvs-header__title">
          <span aria-hidden="true">15 mutual connections</span>
        </h2>
        <ul class="pvs-list">
          <li class="pvs-list__item--line-separated">
            <a href="/in/alice-smith">
              <span class="hoverable-link-text t-bold">
                <span aria-hidden="true">Alice Smith</span>
              </span>
            </a>
            <span class="t-14 t-normal t-black--light">
              <span aria-hidden="true">Product Manager at Tech Co</span>
            </span>
          </li>
          <li class="pvs-list__item--line-separated">
            <a href="/in/bob-jones">
              <span class="hoverable-link-text t-bold">
                <span aria-hidden="true">Bob Jones</span>
              </span>
            </a>
            <span class="t-14 t-normal t-black--light">
              <span aria-hidden="true">Designer at Creative Inc</span>
            </span>
          </li>
          <li class="pvs-list__item--line-separated">
            <a href="/in/charlie-brown">
              <span class="hoverable-link-text t-bold">
                <span aria-hidden="true">Charlie Brown</span>
              </span>
            </a>
            <span class="t-14 t-normal t-black--light">
              <span aria-hidden="true">Engineer</span>
            </span>
          </li>
        </ul>
      </section>
    `;
    return container;
  },
};

/**
 * Mock LinkedIn Parser Response
 * Returns what the real parser would return, but using mock data
 */
export const mockLinkedInParserResponse = {
  fullProfile: {
    name: 'John Test User',
    headline: 'Senior Software Engineer at Test Company',
    location: 'San Francisco Bay Area',
    profileUrl: 'https://www.linkedin.com/in/test-user',
    experience: [
      {
        title: 'Software Engineer',
        company: 'Test Corp',
        duration: 'Jan 2020 – Present · 4 yrs',
        location: 'Remote',
      },
      {
        title: 'Junior Developer',
        company: 'Startup Inc',
        duration: '2018 - 2020 · 2 yrs',
        location: '',
      },
    ],
    education: [
      {
        school: 'Test University',
        degree: 'Bachelor of Science - BS, Computer Science',
        dates: '2014 - 2018',
      },
    ],
    skills: [
      { name: 'JavaScript', endorsements: '50 endorsements' },
      { name: 'React', endorsements: '35 endorsements' },
      { name: 'Node.js', endorsements: '28 endorsements' },
    ],
  },

  minimalProfile: {
    name: 'New User',
    headline: 'Student',
    location: '',
    profileUrl: 'https://www.linkedin.com/in/new-user',
    experience: [],
    education: [],
    skills: [],
  },

  mutualConnections: [
    {
      name: 'Alice Smith',
      headline: 'Product Manager at Tech Co',
      profileUrl: 'https://www.linkedin.com/in/alice-smith',
    },
    {
      name: 'Bob Jones',
      headline: 'Designer at Creative Inc',
      profileUrl: 'https://www.linkedin.com/in/bob-jones',
    },
    {
      name: 'Charlie Brown',
      headline: 'Engineer',
      profileUrl: 'https://www.linkedin.com/in/charlie-brown',
    },
  ],
};

/**
 * Test Environment Setup
 * Call this in beforeEach to ensure complete isolation
 */
export const setupLinkedInTestEnvironment = () => {
  // Install network interceptor
  networkInterceptor.install();

  // Set up a clean jsdom environment
  document.body.innerHTML = '';

  // Mock window.location to simulate LinkedIn URLs without actually navigating
  delete window.location;
  window.location = {
    href: 'https://www.linkedin.com/in/test-user',
    origin: 'https://www.linkedin.com',
    pathname: '/in/test-user',
    search: '',
    hash: '',
  };

  // Mock console methods to suppress parser logs in tests
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
};

/**
 * Test Environment Teardown
 * Call this in afterEach to clean up
 */
export const teardownLinkedInTestEnvironment = () => {
  // Uninstall network interceptor
  networkInterceptor.uninstall();

  // Clear DOM
  document.body.innerHTML = '';

  // Restore console
  vi.restoreAllMocks();
};

/**
 * Helper: Load a LinkedIn DOM fixture into the test document
 */
export const loadLinkedInFixture = (fixtureName) => {
  const fixture = linkedinDOMFixtures[fixtureName];
  if (!fixture) {
    throw new Error(`Unknown LinkedIn fixture: ${fixtureName}`);
  }

  const content = fixture();
  document.body.innerHTML = '';
  document.body.appendChild(content);

  return content;
};

/**
 * Helper: Simulate Chrome message passing for LinkedIn parser
 */
export const simulateLinkedInParserMessage = (action, mockResponse) => {
  return vi.fn((message, callback) => {
    if (message.action === action) {
      callback(mockResponse);
      return Promise.resolve(mockResponse);
    }
    callback({ error: 'Unknown action' });
    return Promise.reject(new Error('Unknown action'));
  });
};

export default {
  networkInterceptor,
  linkedinDOMFixtures,
  mockLinkedInParserResponse,
  setupLinkedInTestEnvironment,
  teardownLinkedInTestEnvironment,
  loadLinkedInFixture,
  simulateLinkedInParserMessage,
};
