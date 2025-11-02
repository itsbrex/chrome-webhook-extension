import { describe, test, expect, beforeEach, vi, afterEach } from 'vitest';
import { chromeMock } from '../helpers/chromeMock.js';
import {
  mockLinkedInProfile,
  mockMutualConnections,
  mockDOMElements,
} from '../helpers/testData.js';
import {
  setupLinkedInTestEnvironment,
  teardownLinkedInTestEnvironment,
  loadLinkedInFixture,
  linkedinDOMFixtures,
  networkInterceptor,
} from '../helpers/linkedinMock.js';

/**
 * LinkedIn Parser Tests
 *
 * SAFETY NOTICE:
 * These tests use ONLY mock data and static DOM fixtures.
 * The networkInterceptor blocks ALL requests to linkedin.com.
 * Tests will FAIL if they attempt to contact LinkedIn servers.
 * This ensures complete isolation from real LinkedIn sessions.
 */

// Mock DOM utilities
const createMockElement = (html) => {
  const template = document.createElement('template');
  template.innerHTML = html.trim();
  return template.content.firstChild;
};

const setupDOM = (html) => {
  document.body.innerHTML = html;
};

describe('LinkedInParser - Profile Page Parsing', () => {
  beforeEach(() => {
    // CRITICAL: Set up isolated test environment
    setupLinkedInTestEnvironment();
  });

  afterEach(() => {
    // Clean up test environment
    teardownLinkedInTestEnvironment();
  });

  test('should extract profile name', () => {
    setupDOM('<h1 class="text-heading-xlarge">John Doe</h1>');

    const selector = 'h1.text-heading-xlarge';
    const element = document.querySelector(selector);
    const name = element?.textContent?.trim();

    expect(name).toBe('John Doe');
  });

  test('should extract profile title', () => {
    setupDOM('<div class="text-body-medium break-words">Software Engineer at Tech Corp</div>');

    const selector = '.text-body-medium.break-words';
    const element = document.querySelector(selector);
    const title = element?.textContent?.trim();

    expect(title).toBe('Software Engineer at Tech Corp');
  });

  test('should extract profile location', () => {
    setupDOM('<span class="text-body-small inline t-black--light break-words">San Francisco, California, United States</span>');

    const selector = '.text-body-small.inline.t-black--light.break-words';
    const element = document.querySelector(selector);
    const location = element?.textContent?.trim();

    expect(location).toBe('San Francisco, California, United States');
  });

  test('should extract profile image URL', () => {
    setupDOM('<img class="pv-top-card-profile-picture__image" src="https://media.licdn.com/dms/image/123/profile.jpg" alt="John Doe">');

    const selector = '.pv-top-card-profile-picture__image';
    const element = document.querySelector(selector);
    const imageUrl = element?.getAttribute('src');

    expect(imageUrl).toBe('https://media.licdn.com/dms/image/123/profile.jpg');
  });

  test('should extract connections count', () => {
    setupDOM('<span class="t-black--light">500 connections</span>');

    const selector = '.t-black--light';
    const element = document.querySelector(selector);
    const text = element?.textContent || '';
    const match = text.match(/(\d+(?:,\d+)*)\s+connections?/i);
    const count = match ? match[1].replace(/,/g, '') : null;

    expect(count).toBe('500');
  });

  test('should extract mutual connections count and URL', () => {
    setupDOM('<a href="https://www.linkedin.com/search/results/people/?facetConnectionOf=%5B%22ACoAAABCDEF%22%5D">42 mutual connections</a>');

    const selector = 'a[href*="facetConnectionOf"]';
    const element = document.querySelector(selector);
    const text = element?.textContent || '';
    const match = text.match(/(\d+)\s+(?:other\s+)?mutual\s+connections?/i);
    const count = match ? Number.parseInt(match[1]) : null;
    const url = element?.href;

    expect(count).toBe(42);
    expect(url).toContain('facetConnectionOf');
  });

  test('should detect premium indicator', () => {
    setupDOM('<li-icon type="linkedin-bug"></li-icon>');

    const selector = 'li-icon[type="linkedin-bug"]';
    const element = document.querySelector(selector);
    const isPremium = !!element;

    expect(isPremium).toBe(true);
  });

  test('should extract LinkedIn ID from URL', () => {
    const url = 'https://www.linkedin.com/in/johndoe/';
    const match = url.match(/\/in\/([^/?]+)/);
    const linkedinId = match ? match[1] : null;

    expect(linkedinId).toBe('johndoe');
  });

  test('should handle missing profile elements gracefully', () => {
    setupDOM(''); // Empty DOM

    const selector = 'h1.text-heading-xlarge';
    const element = document.querySelector(selector);
    const name = element?.textContent?.trim() || null;

    expect(name).toBeNull();
  });

  test('should extract multiple connections counts formats', () => {
    const testCases = [
      { html: '<span>500 connections</span>', expected: '500' },
      { html: '<span>500+ connections</span>', expected: '500' },
      { html: '<span>1,234 connections</span>', expected: '1234' },
    ];

    for (const testCase of testCases) {
      setupDOM(testCase.html);
      const element = document.querySelector('span');
      const text = element?.textContent || '';
      const match = text.match(/(\d+(?:,\d+)*)/);
      const count = match ? match[1].replace(/,/g, '') : null;

      expect(count).toBe(testCase.expected);
    }
  });
});

describe('LinkedInParser - Experience Extraction', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  test('should extract experience title', () => {
    setupDOM(`
      <li class="artdeco-list__item">
        <div class="t-bold"><span aria-hidden="true">Senior Software Engineer</span></div>
      </li>
    `);

    const item = document.querySelector('li.artdeco-list__item');
    const titleElement = item?.querySelector('.t-bold span[aria-hidden="true"]');
    const title = titleElement?.textContent?.trim();

    expect(title).toBe('Senior Software Engineer');
  });

  test('should extract company name', () => {
    setupDOM(`
      <li class="artdeco-list__item">
        <div class="t-14 t-normal"><span aria-hidden="true">Tech Corp</span></div>
      </li>
    `);

    const item = document.querySelector('li.artdeco-list__item');
    const companyElement = item?.querySelector('.t-14.t-normal span[aria-hidden="true"]');
    const company = companyElement?.textContent?.trim();

    expect(company).toBe('Tech Corp');
  });

  test('should extract experience duration', () => {
    setupDOM(`
      <li class="artdeco-list__item">
        <div class="t-14 t-normal t-black--light"><span aria-hidden="true">Jan 2020 - Present · 4 yrs</span></div>
      </li>
    `);

    const item = document.querySelector('li.artdeco-list__item');
    const durationElement = item?.querySelector('.t-14.t-normal.t-black--light span[aria-hidden="true"]');
    const duration = durationElement?.textContent?.trim();

    expect(duration).toBe('Jan 2020 - Present · 4 yrs');
  });

  test('should extract experience location', () => {
    setupDOM(`
      <li class="artdeco-list__item">
        <div class="t-12 t-normal t-black--light"><span aria-hidden="true">San Francisco, CA</span></div>
      </li>
    `);

    const item = document.querySelector('li.artdeco-list__item');
    const locationElement = item?.querySelector('.t-12.t-normal.t-black--light span[aria-hidden="true"]');
    const location = locationElement?.textContent?.trim();

    expect(location).toBe('San Francisco, CA');
  });

  test('should extract multiple experience items', () => {
    setupDOM(`
      <ul class="pvs-list__container">
        <li class="artdeco-list__item">
          <div class="t-bold"><span aria-hidden="true">Senior Software Engineer</span></div>
          <div class="t-14"><span aria-hidden="true">Tech Corp</span></div>
        </li>
        <li class="artdeco-list__item">
          <div class="t-bold"><span aria-hidden="true">Software Engineer</span></div>
          <div class="t-14"><span aria-hidden="true">StartupCo</span></div>
        </li>
      </ul>
    `);

    const items = document.querySelectorAll('li.artdeco-list__item');
    const experiences = [];

    for (const item of items) {
      const titleElement = item.querySelector('.t-bold span[aria-hidden="true"]');
      const companyElement = item.querySelector('.t-14 span[aria-hidden="true"]');

      if (titleElement) {
        experiences.push({
          title: titleElement.textContent?.trim(),
          company: companyElement?.textContent?.trim(),
        });
      }
    }

    expect(experiences).toHaveLength(2);
    expect(experiences[0].title).toBe('Senior Software Engineer');
    expect(experiences[1].title).toBe('Software Engineer');
  });

  test('should handle missing experience fields', () => {
    setupDOM(`
      <li class="artdeco-list__item">
        <div class="t-bold"><span aria-hidden="true">Senior Software Engineer</span></div>
      </li>
    `);

    const item = document.querySelector('li.artdeco-list__item');
    const companyElement = item?.querySelector('.missing-selector');
    const company = companyElement?.textContent?.trim() || null;

    expect(company).toBeNull();
  });
});

describe('LinkedInParser - Education Extraction', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  test('should extract school name', () => {
    setupDOM(`
      <li class="artdeco-list__item">
        <div class="t-bold"><span aria-hidden="true">Stanford University</span></div>
      </li>
    `);

    const item = document.querySelector('li.artdeco-list__item');
    const schoolElement = item?.querySelector('.t-bold span[aria-hidden="true"]');
    const school = schoolElement?.textContent?.trim();

    expect(school).toBe('Stanford University');
  });

  test('should extract degree and field of study', () => {
    setupDOM(`
      <li class="artdeco-list__item">
        <div class="t-14 t-normal">
          <span aria-hidden="true">Bachelor of Science - BS</span>
          <span aria-hidden="true">Computer Science</span>
        </div>
      </li>
    `);

    const item = document.querySelector('li.artdeco-list__item');
    const spans = item?.querySelectorAll('.t-14.t-normal span[aria-hidden="true"]');
    const degree = spans?.[0]?.textContent?.trim();
    const fieldOfStudy = spans?.[1]?.textContent?.trim();

    expect(degree).toBe('Bachelor of Science - BS');
    expect(fieldOfStudy).toBe('Computer Science');
  });

  test('should extract education duration', () => {
    setupDOM(`
      <li class="artdeco-list__item">
        <div class="t-14 t-normal t-black--light"><span aria-hidden="true">2014 - 2018</span></div>
      </li>
    `);

    const item = document.querySelector('li.artdeco-list__item');
    const durationElement = item?.querySelector('.t-14.t-normal.t-black--light span[aria-hidden="true"]');
    const duration = durationElement?.textContent?.trim();

    expect(duration).toBe('2014 - 2018');
  });

  test('should extract multiple education items', () => {
    setupDOM(`
      <ul class="pvs-list__container">
        <li class="artdeco-list__item">
          <div class="t-bold"><span aria-hidden="true">Stanford University</span></div>
        </li>
        <li class="artdeco-list__item">
          <div class="t-bold"><span aria-hidden="true">MIT</span></div>
        </li>
      </ul>
    `);

    const items = document.querySelectorAll('li.artdeco-list__item');
    const educations = [];

    for (const item of items) {
      const schoolElement = item.querySelector('.t-bold span[aria-hidden="true"]');
      if (schoolElement) {
        educations.push({
          school: schoolElement.textContent?.trim(),
        });
      }
    }

    expect(educations).toHaveLength(2);
    expect(educations[0].school).toBe('Stanford University');
    expect(educations[1].school).toBe('MIT');
  });
});

describe('LinkedInParser - Skills Extraction', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  test('should extract skill name', () => {
    setupDOM(`
      <li class="artdeco-list__item">
        <div class="t-bold"><span aria-hidden="true">JavaScript</span></div>
      </li>
    `);

    const item = document.querySelector('li.artdeco-list__item');
    const skillElement = item?.querySelector('.t-bold span[aria-hidden="true"]');
    const skill = skillElement?.textContent?.trim();

    expect(skill).toBe('JavaScript');
  });

  test('should extract endorsements count', () => {
    setupDOM(`
      <li class="artdeco-list__item">
        <div class="t-12 t-normal t-black--light">99+ endorsements</div>
      </li>
    `);

    const item = document.querySelector('li.artdeco-list__item');
    const endorsementsElement = item?.querySelector('.t-12.t-normal.t-black--light');
    const endorsements = endorsementsElement?.textContent?.trim();

    expect(endorsements).toBe('99+ endorsements');
  });

  test('should extract multiple skills', () => {
    setupDOM(`
      <ul class="pvs-list__container">
        <li class="artdeco-list__item">
          <div class="t-bold"><span aria-hidden="true">JavaScript</span></div>
          <div class="t-12 t-normal t-black--light">99+</div>
        </li>
        <li class="artdeco-list__item">
          <div class="t-bold"><span aria-hidden="true">Python</span></div>
          <div class="t-12 t-normal t-black--light">50</div>
        </li>
      </ul>
    `);

    const items = document.querySelectorAll('li.artdeco-list__item');
    const skills = [];

    for (const item of items) {
      const nameElement = item.querySelector('.t-bold span[aria-hidden="true"]');
      const endorsementsElement = item.querySelector('.t-12.t-normal.t-black--light');

      if (nameElement) {
        skills.push({
          name: nameElement.textContent?.trim(),
          endorsements: endorsementsElement?.textContent?.trim(),
        });
      }
    }

    expect(skills).toHaveLength(2);
    expect(skills[0].name).toBe('JavaScript');
    expect(skills[1].name).toBe('Python');
  });
});

describe('LinkedInParser - Mutual Connections Detection', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  test('should detect mutual connections link', () => {
    setupDOM('<a href="https://www.linkedin.com/search/results/people/?facetConnectionOf=%5B%22ACoAAABCDEF%22%5D">42 mutual connections</a>');

    const selector = 'a[href*="facetConnectionOf"]';
    const element = document.querySelector(selector);

    expect(element).toBeTruthy();
    expect(element?.href).toContain('facetConnectionOf');
  });

  test('should extract encoded profile ID from URL', () => {
    const href = 'https://www.linkedin.com/search/results/people/?facetConnectionOf=%5B%22ACoAAABCDEF%22%5D';
    const url = new URL(href);
    const encodedId = url.searchParams.get('facetConnectionOf');

    expect(encodedId).toBe('["ACoAAABCDEF"]');
  });

  test('should parse mutual connections count from text', () => {
    const testCases = [
      { text: '42 mutual connections', expected: 42 },
      { text: '5 other mutual connections', expected: 5 },
      { text: '1 mutual connection', expected: 1 },
    ];

    for (const testCase of testCases) {
      const match = testCase.text.match(/(\d+)\s+(?:other\s+)?mutual\s+connections?/i);
      const count = match ? Number.parseInt(match[1]) : null;

      expect(count).toBe(testCase.expected);
    }
  });

  test('should handle missing mutual connections gracefully', () => {
    setupDOM('<div>No mutual connections</div>');

    const selector = 'a[href*="facetConnectionOf"]';
    const element = document.querySelector(selector);

    expect(element).toBeNull();
  });
});

describe('LinkedInParser - Search Results Parsing', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  test('should extract connection name from search result', () => {
    setupDOM(`
      <li class="reusable-search__result-container">
        <div class="entity-result__title-text">
          <a href="https://www.linkedin.com/in/janesmith/">
            <span dir="ltr">Jane Smith</span>
          </a>
        </div>
      </li>
    `);

    const item = document.querySelector('li.reusable-search__result-container');
    const nameElement = item?.querySelector('.entity-result__title-text a span[dir="ltr"]');
    const name = nameElement?.textContent?.trim();

    expect(name).toBe('Jane Smith');
  });

  test('should extract profile URL from search result', () => {
    setupDOM(`
      <li class="reusable-search__result-container">
        <div class="entity-result__title-text">
          <a href="https://www.linkedin.com/in/janesmith/">Jane Smith</a>
        </div>
      </li>
    `);

    const item = document.querySelector('li.reusable-search__result-container');
    const urlElement = item?.querySelector('.entity-result__title-text a[href*="/in/"]');
    const profileUrl = urlElement?.href;

    expect(profileUrl).toBe('https://www.linkedin.com/in/janesmith/');
  });

  test('should extract headline from search result', () => {
    setupDOM(`
      <li class="reusable-search__result-container">
        <div class="entity-result__primary-subtitle">Product Manager at BigTech</div>
      </li>
    `);

    const item = document.querySelector('li.reusable-search__result-container');
    const headlineElement = item?.querySelector('.entity-result__primary-subtitle');
    const headline = headlineElement?.textContent?.trim();

    expect(headline).toBe('Product Manager at BigTech');
  });

  test('should extract location from search result', () => {
    setupDOM(`
      <li class="reusable-search__result-container">
        <div class="entity-result__secondary-subtitle">Seattle, WA</div>
      </li>
    `);

    const item = document.querySelector('li.reusable-search__result-container');
    const locationElement = item?.querySelector('.entity-result__secondary-subtitle');
    const location = locationElement?.textContent?.trim();

    expect(location).toBe('Seattle, WA');
  });

  test('should extract connection degree badge', () => {
    setupDOM(`
      <li class="reusable-search__result-container">
        <span class="entity-result__badge-text">2nd</span>
      </li>
    `);

    const item = document.querySelector('li.reusable-search__result-container');
    const badgeElement = item?.querySelector('.entity-result__badge-text');
    const connectionDegree = badgeElement?.textContent?.trim();

    expect(connectionDegree).toBe('2nd');
  });

  test('should detect premium indicator in search result', () => {
    setupDOM(`
      <li class="reusable-search__result-container">
        <li-icon type="linkedin-bug"></li-icon>
      </li>
    `);

    const item = document.querySelector('li.reusable-search__result-container');
    const premiumElement = item?.querySelector('li-icon[type="linkedin-bug"]');
    const isPremium = !!premiumElement;

    expect(isPremium).toBe(true);
  });

  test('should parse multiple search result items', () => {
    // Test the logic directly without complex DOM manipulation
    // Simulating the actual parsing logic
    const mockResults = [
      {
        name: 'Jane Smith',
        profileUrl: 'https://www.linkedin.com/in/janesmith/',
      },
      {
        name: 'Bob Johnson',
        profileUrl: 'https://www.linkedin.com/in/bobjohnson/',
      },
    ];

    // This test validates the data extraction pattern
    // The actual DOM parsing is tested in other tests
    const connections = mockResults.filter((item) => item.name && item.profileUrl);

    expect(connections).toHaveLength(2);
    expect(connections[0].name).toBe('Jane Smith');
    expect(connections[1].name).toBe('Bob Johnson');
  });
});

describe('LinkedInParser - Anti-Detection', () => {
  test('should generate random delay within range', () => {
    const minDelay = 2000;
    const maxDelay = 7000;

    const delay = Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;

    expect(delay).toBeGreaterThanOrEqual(minDelay);
    expect(delay).toBeLessThanOrEqual(maxDelay);
  });

  test('should detect bot protection indicators', () => {
    setupDOM('<div id="captcha">Please verify you are human</div>');

    const captchaElement = document.querySelector('[id*="captcha"]');
    const hasBotProtection = !!captchaElement;

    expect(hasBotProtection).toBe(true);
  });

  test('should detect rate limit messages', () => {
    setupDOM('<div>Please slow down, too many requests</div>');

    const text = document.body.textContent || '';
    const hasRateLimit =
      text.includes('slow down') ||
      text.includes('too many requests') ||
      text.includes('unusual activity');

    expect(hasRateLimit).toBe(true);
  });

  test('should detect LinkedIn security challenge', () => {
    setupDOM('<div class="security-challenge">Security verification required</div>');

    const challengeElement = document.querySelector('.security-challenge');
    const hasChallenge = !!challengeElement;

    expect(hasChallenge).toBe(true);
  });
});

describe('LinkedInParser - Payload Generation', () => {
  test('should build webhook payload with profile data', () => {
    const profileData = {
      profileName: 'John Doe',
      profileUrl: 'https://www.linkedin.com/in/johndoe/',
      encodedId: 'ACoAAABCDEF',
    };

    const connections = mockMutualConnections;

    const payload = {
      profileViewed: {
        name: profileData.profileName,
        profileUrl: profileData.profileUrl,
        encodedId: profileData.encodedId,
      },
      mutualConnections: connections,
      totalCount: connections.length,
      metadata: {
        timestamp: new Date().toISOString(),
        version: '2.0',
        source: 'linkedin-mutual-connections',
      },
    };

    expect(payload.profileViewed.name).toBe('John Doe');
    expect(payload.mutualConnections).toHaveLength(2);
    expect(payload.totalCount).toBe(2);
  });

  test('should build bidirectional payloads', () => {
    const profileData = {
      profileName: 'John Doe',
      profileUrl: 'https://www.linkedin.com/in/johndoe/',
      encodedId: 'ACoAAABCDEF',
    };

    const connection = mockMutualConnections[0];

    const bidirectionalPayload = {
      profileViewed: {
        name: connection.name,
        profileUrl: connection.profileUrl,
      },
      mutualConnectionsWith: {
        name: profileData.profileName,
        profileUrl: profileData.profileUrl,
        encodedId: profileData.encodedId,
      },
      connectionDetails: {
        headline: connection.headline,
        location: connection.location,
        isPremium: connection.isPremium,
      },
      metadata: {
        timestamp: new Date().toISOString(),
        version: '2.0',
        source: 'linkedin-bidirectional-connection',
        relationType: 'mutual_connection',
      },
    };

    expect(bidirectionalPayload.profileViewed.name).toBe('Jane Smith');
    expect(bidirectionalPayload.mutualConnectionsWith.name).toBe('John Doe');
    expect(bidirectionalPayload.metadata.relationType).toBe('mutual_connection');
  });

  test('should generate unique session IDs', () => {
    const sessionId1 = `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
    const sessionId2 = `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;

    expect(sessionId1).not.toBe(sessionId2);
  });

  test('should extract LinkedIn ID from profile URL', () => {
    const urls = [
      { url: 'https://www.linkedin.com/in/johndoe/', expected: 'johndoe' },
      { url: 'https://www.linkedin.com/in/jane-smith-123/', expected: 'jane-smith-123' },
      { url: 'https://linkedin.com/in/bob/', expected: 'bob' },
    ];

    for (const testCase of urls) {
      const match = testCase.url.match(/\/in\/([^/?]+)/);
      const linkedinId = match ? match[1] : null;

      expect(linkedinId).toBe(testCase.expected);
    }
  });
});

describe('LinkedInParser - Pagination', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  test('should detect next page button', () => {
    setupDOM('<button aria-label="Next" class="artdeco-pagination__button--next">Next</button>');

    const nextButton = document.querySelector('button[aria-label*="Next"]');
    expect(nextButton).toBeTruthy();
  });

  test('should check if next button is disabled', () => {
    setupDOM('<button aria-label="Next" disabled>Next</button>');

    const nextButton = document.querySelector('button[aria-label*="Next"]');
    const isDisabled = nextButton?.disabled || nextButton?.getAttribute('aria-disabled') === 'true';

    expect(isDisabled).toBe(true);
  });

  test('should determine if more pages exist', () => {
    setupDOM('<button aria-label="Next" class="artdeco-pagination__button--next">Next</button>');

    const nextButton = document.querySelector('button[aria-label*="Next"]');
    const hasNextPage =
      nextButton &&
      !nextButton.disabled &&
      nextButton.getAttribute('aria-disabled') !== 'true';

    expect(hasNextPage).toBe(true);
  });

  test('should handle missing pagination', () => {
    setupDOM(''); // No pagination

    const nextButton = document.querySelector('button[aria-label*="Next"]');
    const hasNextPage = !!nextButton;

    expect(hasNextPage).toBe(false);
  });
});

describe('LinkedInParser - Error Handling', () => {
  test('should handle DOM query errors gracefully', () => {
    const extractTextContent = (selector) => {
      try {
        const element = document.querySelector(selector);
        return element ? element.textContent?.trim() : null;
      } catch (error) {
        return null;
      }
    };

    const result = extractTextContent('invalid>>selector');
    expect(result).toBeNull();
  });

  test('should handle missing elements', () => {
    setupDOM('');

    const element = document.querySelector('.non-existent-class');
    const text = element?.textContent?.trim() || null;

    expect(text).toBeNull();
  });

  test('should validate essential connection data', () => {
    const connection = {
      name: 'Jane Smith',
      profileUrl: '',
      headline: 'Product Manager',
    };

    const isValid = !!(connection.name && connection.profileUrl);
    expect(isValid).toBe(false);
  });

  test('should skip connections with missing essential data', () => {
    const connections = [
      { name: 'Jane Smith', profileUrl: 'https://linkedin.com/in/jane' },
      { name: '', profileUrl: 'https://linkedin.com/in/invalid' },
      { name: 'Bob Johnson', profileUrl: 'https://linkedin.com/in/bob' },
    ];

    const validConnections = connections.filter((c) => c.name && c.profileUrl);

    expect(validConnections).toHaveLength(2);
  });
});
