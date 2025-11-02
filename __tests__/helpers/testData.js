/**
 * Test data fixtures for webhook extension tests
 */

export const mockWebhooks = [
  {
    name: 'Test Webhook 1',
    url: 'https://webhook.site/test1',
    rateLimit: 0,
  },
  {
    name: 'Test Webhook 2',
    url: 'https://n8n.example.com/webhook/test2',
    rateLimit: 30,
  },
  {
    name: 'Discord Webhook',
    url: 'https://discord.com/api/webhooks/123/abc',
    rateLimit: 5,
  },
];

export const mockSettings = {
  notificationInterval: 5,
  linkedinAutoDetect: false,
  linkedinAutoMutualConnections: false,
  linkedinBidirectional: false,
  linkedinWebhooks: 'all',
  selectedLinkedinWebhooks: [],
  linkedinDelay: 3,
};

export const mockLinkedInProfile = {
  name: 'John Doe',
  title: 'Software Engineer at Tech Corp',
  location: 'San Francisco, California, United States',
  profileUrl: 'https://www.linkedin.com/in/johndoe/',
  profileImageUrl: 'https://media.licdn.com/dms/image/123/profile.jpg',
  about: 'Experienced software engineer with a passion for building scalable systems.',
  connectionsCount: '500',
  followersCount: '1200',
  mutualConnectionsCount: 42,
  mutualConnectionsUrl: 'https://www.linkedin.com/search/results/people/?facetConnectionOf=%5B%22ACoAAABCDEF%22%5D',
  isPremium: false,
  linkedinId: 'johndoe',
  experience: [
    {
      title: 'Senior Software Engineer',
      company: 'Tech Corp',
      duration: 'Jan 2020 - Present · 4 yrs',
      location: 'San Francisco, CA',
      description: 'Leading backend development for cloud infrastructure.',
    },
    {
      title: 'Software Engineer',
      company: 'StartupCo',
      duration: 'Jun 2018 - Dec 2019 · 1 yr 7 mos',
      location: 'Palo Alto, CA',
      description: 'Full-stack development with React and Node.js.',
    },
  ],
  education: [
    {
      school: 'Stanford University',
      degree: 'Bachelor of Science - BS',
      fieldOfStudy: 'Computer Science',
      duration: '2014 - 2018',
      description: null,
    },
  ],
  skills: [
    { name: 'JavaScript', endorsements: '99+' },
    { name: 'Python', endorsements: '50' },
    { name: 'React', endorsements: '75' },
  ],
  extractedAt: '2025-01-15T12:00:00.000Z',
};

export const mockMutualConnections = [
  {
    name: 'Jane Smith',
    profileUrl: 'https://www.linkedin.com/in/janesmith/',
    headline: 'Product Manager at BigTech',
    location: 'Seattle, WA',
    profileImageUrl: 'https://media.licdn.com/dms/image/456/profile.jpg',
    connectionDegree: '2nd',
    isPremium: true,
    extractedAt: '2025-01-15T12:05:00.000Z',
  },
  {
    name: 'Bob Johnson',
    profileUrl: 'https://www.linkedin.com/in/bobjohnson/',
    headline: 'CTO at StartupXYZ',
    location: 'Austin, TX',
    profileImageUrl: 'https://media.licdn.com/dms/image/789/profile.jpg',
    connectionDegree: '2nd',
    isPremium: false,
    extractedAt: '2025-01-15T12:05:30.000Z',
  },
];

export const mockContextMenuInfo = {
  page: {
    menuItemId: 'sendTo_Test_Webhook_1_0_normal',
    pageUrl: 'https://example.com/article',
    frameUrl: 'https://example.com/article',
    editable: false,
  },
  link: {
    menuItemId: 'sendTo_Test_Webhook_1_0_normal',
    pageUrl: 'https://example.com',
    linkUrl: 'https://example.com/article',
    editable: false,
  },
  image: {
    menuItemId: 'sendTo_Test_Webhook_1_0_normal',
    pageUrl: 'https://example.com',
    srcUrl: 'https://example.com/image.jpg',
    editable: false,
  },
  selection: {
    menuItemId: 'sendTo_Test_Webhook_1_0_selection',
    pageUrl: 'https://example.com',
    selectionText: 'This is selected text',
    editable: false,
  },
};

export const mockTab = {
  id: 12345,
  url: 'https://www.linkedin.com/in/johndoe/',
  title: 'John Doe - LinkedIn',
  active: true,
  windowId: 1,
  index: 0,
};

export const mockDOMElements = {
  profilePage: {
    profileName: '<h1 class="text-heading-xlarge">John Doe</h1>',
    profileTitle: '<div class="text-body-medium break-words">Software Engineer at Tech Corp</div>',
    profileLocation: '<span class="text-body-small inline t-black--light break-words">San Francisco, California, United States</span>',
    profileImage: '<img class="pv-top-card-profile-picture__image" src="https://media.licdn.com/dms/image/123/profile.jpg" alt="John Doe">',
    connectionsCount: '<span class="t-black--light">500 connections</span>',
    mutualConnectionsLink: '<a href="https://www.linkedin.com/search/results/people/?facetConnectionOf=%5B%22ACoAAABCDEF%22%5D">42 mutual connections</a>',
  },
  searchResults: {
    resultItem: `
      <li class="reusable-search__result-container">
        <div class="entity-result">
          <div class="entity-result__title-text">
            <a href="https://www.linkedin.com/in/janesmith/">
              <span dir="ltr">Jane Smith</span>
            </a>
          </div>
          <div class="entity-result__primary-subtitle">Product Manager at BigTech</div>
          <div class="entity-result__secondary-subtitle">Seattle, WA</div>
          <img class="entity-result__image" src="https://media.licdn.com/dms/image/456/profile.jpg" alt="Jane Smith">
          <span class="entity-result__badge-text">2nd</span>
          <li-icon type="linkedin-bug"></li-icon>
        </div>
      </li>
    `,
  },
};

export const mockWebhookPayload = {
  page: {
    url: 'https://example.com/article',
    timestamp: '2025-01-15T12:00:00.000Z',
    type: 'page',
    title: 'Example Article',
    description: 'This is an example article',
    keywords: 'example, test',
    favicon: 'https://example.com/favicon.ico',
  },
  link: {
    url: 'https://example.com/article',
    timestamp: '2025-01-15T12:00:00.000Z',
    type: 'link',
    title: 'Article Link',
    linkTitle: 'Article Link',
  },
  image: {
    url: 'https://example.com/image.jpg',
    timestamp: '2025-01-15T12:00:00.000Z',
    type: 'image',
    title: 'Example Image',
    altText: 'Example Image',
  },
  selection: {
    url: 'https://example.com',
    timestamp: '2025-01-15T12:00:00.000Z',
    type: 'selection',
    title: 'Example Page',
    description: 'This is an example page',
    keywords: 'example, test',
    favicon: 'https://example.com/favicon.ico',
    selectedText: 'This is selected text',
  },
  linkedinProfile: {
    url: 'https://www.linkedin.com/in/johndoe/',
    timestamp: '2025-01-15T12:00:00.000Z',
    type: 'linkedin_profile',
    profile: mockLinkedInProfile,
    source: 'chrome_extension_linkedin_parser',
  },
};
