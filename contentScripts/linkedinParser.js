// LinkedIn Mutual Connections Parser
// Content script for parsing LinkedIn mutual connections without triggering anti-bot detection

class LinkedInMutualConnectionsParser {
  constructor() {
    this.config = {
      delays: {
        minPageDelay: 2000,
        maxPageDelay: 7000,
        minActionDelay: 500,
        maxActionDelay: 2000,
        scrollDelay: 100
      },
      selectors: {
        // Search results page selectors
        mutualConnectionsLink: 'a[href*="facetConnectionOf"], a[href*="mutual"]',
        connectionName: 'span.entity-result__title-text a span[dir="ltr"], .entity-result__title-text a span',
        profileUrl: 'a.app-aware-link[href*="/in/"], a[href*="/in/"]',
        profileHeadline: '.entity-result__primary-subtitle, .entity-result__summary',
        location: '.entity-result__secondary-subtitle, .entity-result__location',
        profileImage: 'img.presence-entity__image, .entity-result__image img',
        connectionBadge: '.entity-result__badge-text, .entity-result__badge',
        premiumIndicator: 'li-icon[type="linkedin-bug"], .premium-icon',
        searchContainer: '.search-results-container, .search-results__list',
        resultItems: 'li.reusable-search__result-container, .entity-result, .search-result',
        paginationContainer: '.artdeco-pagination, .pagination',
        nextPageButton: 'button[aria-label*="Next"], .artdeco-pagination__button--next',
        
        // Profile page selectors
        profileName: 'h1.text-heading-xlarge, .text-heading-xlarge, .pv-text-details__title h1, .pv-top-card--list h1',
        profileTitle: '.text-body-medium.break-words, .pv-text-details__title + div, .pv-top-card--list-bullet .text-body-medium',
        profileLocation: '.text-body-small.inline.t-black--light.break-words, .pv-text-details__left-panel .geo-text',
        profileImage: '.pv-top-card-profile-picture__image, .pv-member-photo-edit__image, img.pv-top-card-profile-picture__image--show',
        aboutSection: '.pv-about-section .pv-about__summary-text, .pv-shared-text-with-see-more .inline-show-more-text',
        experienceSection: '.pv-profile-section.experience-section, .pvs-list__container',
        educationSection: '.pv-profile-section.education-section, .pvs-list__container',
        skillsSection: '.pv-skill-categories-section, .pvs-list__container',
        connectionsCount: '.pv-top-card--list-bullet .t-black--light span:contains("connection"), .pv-top-card--list-bullet a[href*="overlay/connections"]',
        followersCount: '.pv-top-card--list-bullet .t-black--light span:contains("follower")',
        mutualConnectionsText: '.pv-top-card--list-bullet a[href*="facetConnectionOf"], .pv-top-card--list-bullet a[href*="mutual"]'
      },
      maxPagesPerSession: 50,
      maxConnectionsPerPage: 10,
      sessionTimeout: 300000 // 5 minutes
    };
    
    this.antiDetection = new AntiDetectionManager();
    this.isProcessing = false;
    this.currentSession = null;
  }

  // Parse individual LinkedIn profile page
  parseProfilePage() {
    try {
      console.log('Parsing LinkedIn profile page...');
      
      // Extract profile data using enhanced selectors
      const profile = {
        name: this.extractTextContent(this.config.selectors.profileName),
        title: this.extractTextContent(this.config.selectors.profileTitle),
        location: this.extractTextContent(this.config.selectors.profileLocation),
        profileImageUrl: this.extractAttribute(this.config.selectors.profileImage, 'src'),
        profileUrl: window.location.href,
        about: this.extractTextContent(this.config.selectors.aboutSection),
        extractedAt: new Date().toISOString()
      };

      // Extract connections information
      const connectionsElement = document.querySelector(this.config.selectors.connectionsCount);
      if (connectionsElement) {
        const connectionsText = connectionsElement.textContent || '';
        const connectionsMatch = connectionsText.match(/(\d+(?:,\d+)*)\s+connections?/i);
        profile.connectionsCount = connectionsMatch ? connectionsMatch[1].replace(/,/g, '') : null;
      }

      // Extract followers information  
      const followersElement = document.querySelector(this.config.selectors.followersCount);
      if (followersElement) {
        const followersText = followersElement.textContent || '';
        const followersMatch = followersText.match(/(\d+(?:,\d+)*)\s+followers?/i);
        profile.followersCount = followersMatch ? followersMatch[1].replace(/,/g, '') : null;
      }

      // Extract mutual connections information
      const mutualConnectionsElement = document.querySelector(this.config.selectors.mutualConnectionsText);
      if (mutualConnectionsElement) {
        const mutualText = mutualConnectionsElement.textContent || '';
        const mutualMatch = mutualText.match(/(\d+)\s+(?:other\s+)?mutual\s+connections?/i);
        profile.mutualConnectionsCount = mutualMatch ? parseInt(mutualMatch[1]) : null;
        profile.mutualConnectionsUrl = mutualConnectionsElement.href;
      }

      // Check for premium indicator
      profile.isPremium = !!document.querySelector(this.config.selectors.premiumIndicator);

      // Extract LinkedIn profile ID from URL
      const urlMatch = profile.profileUrl.match(/\/in\/([^\/]+)/);
      profile.linkedinId = urlMatch ? urlMatch[1] : null;

      console.log('Profile parsing completed:', profile);
      return profile;
      
    } catch (error) {
      console.error('Error parsing LinkedIn profile page:', error);
      return null;
    }
  }

  // Helper method to extract text content with fallbacks
  extractTextContent(selector) {
    try {
      const element = document.querySelector(selector);
      return element ? (element.textContent || element.innerText || '').trim() : null;
    } catch (error) {
      return null;
    }
  }

  // Helper method to extract attribute with fallbacks
  extractAttribute(selector, attribute) {
    try {
      const element = document.querySelector(selector);
      return element ? element.getAttribute(attribute) : null;
    } catch (error) {
      return null;
    }
  }

  // Detect if current page has mutual connections section
  detectMutualConnections() {
    try {
      const mutualConnectionsElement = document.querySelector(this.config.selectors.mutualConnectionsLink);
      if (!mutualConnectionsElement) {
        console.log('No mutual connections link found on page');
        return null;
      }

      const href = mutualConnectionsElement.href;
      if (!href) {
        console.log('Mutual connections link has no href');
        return null;
      }

      const url = new URL(href);
      
      // Extract encoded profile ID
      const encodedId = url.searchParams.get('facetConnectionOf');
      if (!encodedId) {
        console.log('No facetConnectionOf parameter found in URL:', href);
        return null;
      }

      // Extract connection count from text
      const text = mutualConnectionsElement.textContent || '';
      const countMatch = text.match(/(\d+)\s+(?:other\s+)?mutual\s+connections/i);
      const totalCount = countMatch ? parseInt(countMatch[1]) + 2 : null; // +2 for the named ones

      console.log('Detected mutual connections:', { encodedId, totalCount, text: text.trim() });

      return {
        searchUrl: href,
        encodedId: encodedId,
        totalCount: totalCount,
        text: text.trim()
      };
    } catch (error) {
      console.error('Error detecting mutual connections:', error);
      return null;
    }
  }

  // Parse connections from search results page
  async parseSearchResults() {
    try {
      await this.antiDetection.randomDelay();
      
      if (this.antiDetection.detectBotProtection()) {
        throw new Error('Bot protection detected - aborting parsing');
      }

      const connections = [];
      const resultItems = document.querySelectorAll(this.config.selectors.resultItems);
      
      console.log(`Found ${resultItems.length} result items on page`);
      
      if (resultItems.length === 0) {
        // Try alternative selectors
        const alternativeItems = document.querySelectorAll('.entity-result, .search-result__wrapper');
        console.log(`Trying alternative selectors, found ${alternativeItems.length} items`);
        
        if (alternativeItems.length === 0) {
          console.warn('No result items found with any selector');
          return connections;
        }
        
        // Use alternative items
        for (const item of alternativeItems) {
          try {
            const connection = await this.extractConnectionData(item);
            if (connection) {
              connections.push(connection);
            }
          } catch (error) {
            console.warn('Failed to extract connection data from alternative selector:', error);
          }
          await this.antiDetection.randomDelay(200, 500);
        }
      } else {
        // Use primary selector
        for (const item of resultItems) {
          try {
            const connection = await this.extractConnectionData(item);
            if (connection) {
              connections.push(connection);
            }
          } catch (error) {
            console.warn('Failed to extract connection data:', error);
          }
          
          // Small delay between items to appear human-like
          await this.antiDetection.randomDelay(200, 500);
        }
      }

      console.log(`Successfully parsed ${connections.length} connections from page`);
      return connections;
      
    } catch (error) {
      console.error('Error parsing search results:', error);
      throw error;
    }
  }

  // Extract data from individual connection element
  async extractConnectionData(element) {
    try {
      // Try multiple selectors for name
      let nameElement = element.querySelector(this.config.selectors.connectionName);
      if (!nameElement) {
        nameElement = element.querySelector('.entity-result__title-text a, .search-result__title a, .actor-name');
      }
      
      // Try multiple selectors for profile URL
      let profileUrlElement = element.querySelector(this.config.selectors.profileUrl);
      if (!profileUrlElement) {
        profileUrlElement = element.querySelector('a[href*="/in/"], .entity-result__title-text a');
      }
      
      if (!nameElement || !profileUrlElement) {
        console.warn('Essential data missing for connection:', {
          hasName: !!nameElement,
          hasUrl: !!profileUrlElement
        });
        return null; // Skip if essential data missing
      }

      // Extract with fallbacks
      const headlineElement = element.querySelector(this.config.selectors.profileHeadline) ||
                              element.querySelector('.entity-result__summary, .search-result__summary');
      
      const locationElement = element.querySelector(this.config.selectors.location) ||
                              element.querySelector('.entity-result__location, .search-result__location');
      
      const imageElement = element.querySelector(this.config.selectors.profileImage) ||
                           element.querySelector('img[alt*="profile"], .entity-result__image img');
      
      const badgeElement = element.querySelector(this.config.selectors.connectionBadge) ||
                           element.querySelector('.entity-result__badge, .search-result__badge');
      
      const premiumElement = element.querySelector(this.config.selectors.premiumIndicator) ||
                             element.querySelector('.premium-icon, [data-test-id*="premium"]');

      const connection = {
        name: (nameElement.textContent || nameElement.innerText || '').trim(),
        profileUrl: profileUrlElement.href || '',
        headline: (headlineElement?.textContent || headlineElement?.innerText || '').trim(),
        location: (locationElement?.textContent || locationElement?.innerText || '').trim(),
        profileImageUrl: imageElement?.src || '',
        connectionDegree: (badgeElement?.textContent || badgeElement?.innerText || '').trim(),
        isPremium: !!premiumElement,
        extractedAt: new Date().toISOString()
      };

      // Validate essential fields
      if (!connection.name || !connection.profileUrl) {
        console.warn('Connection missing essential data after extraction:', connection);
        return null;
      }

      return connection;
      
    } catch (error) {
      console.error('Error extracting connection data:', error);
      return null;
    }
  }

  // Check if there are more pages to parse
  hasNextPage() {
    const nextButton = document.querySelector(this.config.selectors.nextPageButton);
    return nextButton && !nextButton.disabled && !nextButton.getAttribute('aria-disabled');
  }

  // Navigate to next page
  async navigateToNextPage() {
    const nextButton = document.querySelector(this.config.selectors.nextPageButton);
    if (!nextButton) throw new Error('Next page button not found');

    await this.antiDetection.humanScroll(nextButton);
    await this.antiDetection.randomDelay();
    
    // Simulate human-like click
    nextButton.click();
    
    // Wait for page to load
    await this.waitForPageLoad();
  }

  // Wait for page to load completely
  async waitForPageLoad() {
    return new Promise((resolve) => {
      const timeout = setTimeout(resolve, 10000); // 10 second timeout
      
      const observer = new MutationObserver((mutations) => {
        const hasResults = document.querySelector(this.config.selectors.searchContainer);
        if (hasResults) {
          clearTimeout(timeout);
          observer.disconnect();
          resolve();
        }
      });
      
      observer.observe(document.body, { childList: true, subtree: true });
    });
  }

  // Main parsing function for search results pages
  async parseAllMutualConnections(profileData) {
    if (this.isProcessing) {
      throw new Error('Parsing already in progress');
    }

    this.isProcessing = true;
    this.currentSession = {
      profileData,
      startTime: Date.now(),
      connections: [],
      pagesProcessed: 0
    };

    try {
      let currentPage = 1;
      
      while (currentPage <= this.config.maxPagesPerSession) {
        console.log(`Processing page ${currentPage}...`);
        
        // Check session timeout
        if (Date.now() - this.currentSession.startTime > this.config.sessionTimeout) {
          throw new Error('Session timeout exceeded');
        }

        // Parse current page
        const pageConnections = await this.parseSearchResults();
        this.currentSession.connections.push(...pageConnections);
        this.currentSession.pagesProcessed++;

        // Check if there are more pages
        if (!this.hasNextPage()) {
          console.log('No more pages found, parsing complete');
          break;
        }

        // Navigate to next page with human-like delay
        await this.antiDetection.randomDelay(
          this.config.delays.minPageDelay,
          this.config.delays.maxPageDelay
        );
        
        await this.navigateToNextPage();
        currentPage++;
      }

      return this.buildWebhookPayload();
      
    } finally {
      this.isProcessing = false;
    }
  }

  // Build final payload for webhook
  buildWebhookPayload() {
    const session = this.currentSession;
    
    return {
      profileViewed: {
        name: session.profileData.profileName || '',
        profileUrl: session.profileData.profileUrl || '',
        encodedId: session.profileData.encodedId || ''
      },
      mutualConnections: session.connections,
      totalCount: session.connections.length,
      pagesScraped: session.pagesProcessed,
      extractionDuration: Date.now() - session.startTime,
      metadata: {
        timestamp: new Date().toISOString(),
        sessionId: this.generateSessionId(),
        version: '2.0',
        source: 'linkedin-mutual-connections'
      }
    };
  }

  // Build bi-directional payloads for mutual connections
  buildBidirectionalPayloads() {
    const session = this.currentSession;
    const sourceProfile = session.profileData;
    const payloads = [];

    // Create main payload with all mutual connections
    const mainPayload = this.buildWebhookPayload();
    payloads.push(mainPayload);

    // Create individual payloads for each mutual connection with bi-directional linking
    session.connections.forEach(connection => {
      const bidirectionalPayload = {
        profileViewed: {
          name: connection.name,
          profileUrl: connection.profileUrl,
          linkedinId: this.extractLinkedInIdFromUrl(connection.profileUrl)
        },
        mutualConnectionsWith: {
          name: sourceProfile.profileName || '',
          profileUrl: sourceProfile.profileUrl || '',
          linkedinId: this.extractLinkedInIdFromUrl(sourceProfile.profileUrl || ''),
          encodedId: sourceProfile.encodedId || ''
        },
        connectionDetails: {
          headline: connection.headline,
          location: connection.location,
          profileImageUrl: connection.profileImageUrl,
          connectionDegree: connection.connectionDegree,
          isPremium: connection.isPremium,
          extractedAt: connection.extractedAt
        },
        metadata: {
          timestamp: new Date().toISOString(),
          sessionId: this.generateSessionId(),
          version: '2.0',
          source: 'linkedin-bidirectional-connection',
          relationType: 'mutual_connection'
        }
      };
      
      payloads.push(bidirectionalPayload);
    });

    return payloads;
  }

  // Extract LinkedIn ID from profile URL
  extractLinkedInIdFromUrl(url) {
    try {
      const match = url.match(/\/in\/([^\/\?]+)/);
      return match ? match[1] : null;
    } catch (error) {
      return null;
    }
  }

  generateSessionId() {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
  }

  // Test function to validate selectors on current page
  testSelectors() {
    console.log('Testing LinkedIn selectors on current page...');
    const results = {};
    
    for (const [key, selector] of Object.entries(this.config.selectors)) {
      const elements = document.querySelectorAll(selector);
      results[key] = {
        selector: selector,
        count: elements.length,
        elements: elements.length > 0 ? Array.from(elements).slice(0, 3) : []
      };
      
      console.log(`${key}: ${elements.length} elements found with selector "${selector}"`);
    }
    
    return results;
  }
}

// Anti-detection utilities
class AntiDetectionManager {
  constructor() {
    this.config = {
      minDelay: 2000,
      maxDelay: 7000,
      scrollSpeed: { min: 50, max: 200 },
      mouseMovements: true,
      maxRequestsPerMinute: 10
    };
  }

  // Human-like delays
  async randomDelay(min = this.config.minDelay, max = this.config.maxDelay) {
    const delay = Math.floor(Math.random() * (max - min + 1)) + min;
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  // Simulate human scrolling
  async humanScroll(targetElement) {
    if (!targetElement) return;
    
    const targetPosition = targetElement.offsetTop - window.innerHeight / 2;
    const currentPosition = window.scrollY;
    const distance = Math.abs(targetPosition - currentPosition);
    
    if (distance < 100) return; // Already close enough
    
    const scrollDuration = Math.random() * 2000 + 1000;
    const scrollSteps = Math.floor(scrollDuration / 16);
    const scrollStep = (targetPosition - currentPosition) / scrollSteps;
    
    let step = 0;
    const scrollInterval = setInterval(() => {
      if (step < scrollSteps) {
        window.scrollBy(0, scrollStep);
        step++;
      } else {
        clearInterval(scrollInterval);
      }
    }, 16);
    
    await new Promise(resolve => setTimeout(resolve, scrollDuration));
  }

  // Simulate mouse movements
  simulateMouseMovement() {
    const event = new MouseEvent('mousemove', {
      clientX: Math.random() * window.innerWidth,
      clientY: Math.random() * window.innerHeight,
      bubbles: true,
      cancelable: true
    });
    document.dispatchEvent(event);
  }

  // Detect bot protection signals
  detectBotProtection() {
    const indicators = [
      // Check for captcha
      document.querySelector('[id*="captcha"]'),
      document.querySelector('[class*="challenge"]'),
      // Check for rate limit messages
      document.body.textContent.includes('slow down'),
      document.body.textContent.includes('too many requests'),
      document.body.textContent.includes('unusual activity'),
      // Check for account restriction
      document.querySelector('[data-test-id="auth-wall"]'),
      // Check for LinkedIn specific blocks
      document.querySelector('.challenge-page'),
      document.querySelector('.security-challenge')
    ];
    
    return indicators.some(indicator => !!indicator);
  }

  // Perform random actions to appear human
  async performRandomActions() {
    const actions = [
      () => this.simulateMouseMovement(),
      () => window.scrollBy(0, Math.random() * 100 - 50),
      () => {
        const randomElement = document.elementFromPoint(
          Math.random() * window.innerWidth,
          Math.random() * window.innerHeight
        );
        if (randomElement && randomElement.focus) {
          randomElement.focus();
        }
      }
    ];
    
    const randomAction = actions[Math.floor(Math.random() * actions.length)];
    try {
      randomAction();
    } catch (error) {
      // Ignore errors from random actions
    }
  }
}

// Message listener for communication with background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  const parser = new LinkedInMutualConnectionsParser();
  
  if (request.action === 'parseLinkedInProfile') {
    const profileData = parser.parseProfilePage();
    sendResponse({ success: true, data: profileData });
    return true;
  }
  
  if (request.action === 'detectMutualConnections') {
    const detectionResult = parser.detectMutualConnections();
    sendResponse({ success: true, data: detectionResult });
    return true;
  }
  
  if (request.action === 'parseAllMutualConnections') {
    parser.parseAllMutualConnections(request.profileData)
      .then(result => {
        sendResponse({ success: true, data: result });
      })
      .catch(error => {
        sendResponse({ success: false, error: error.message });
      });
    return true; // Keep channel open for async response
  }
  
  if (request.action === 'parseAllMutualConnectionsBidirectional') {
    parser.parseAllMutualConnections(request.profileData)
      .then(result => {
        const bidirectionalPayloads = parser.buildBidirectionalPayloads();
        sendResponse({ success: true, data: bidirectionalPayloads });
      })
      .catch(error => {
        sendResponse({ success: false, error: error.message });
      });
    return true; // Keep channel open for async response
  }
  
  if (request.action === 'checkBotProtection') {
    const antiDetection = new AntiDetectionManager();
    const isBlocked = antiDetection.detectBotProtection();
    sendResponse({ success: true, isBlocked });
    return true;
  }
  
  if (request.action === 'testSelectors') {
    const selectorResults = parser.testSelectors();
    sendResponse({ success: true, data: selectorResults });
    return true;
  }
});

// Auto-detect mutual connections when page loads (if enabled in settings)
document.addEventListener('DOMContentLoaded', () => {
  // Check if auto-detection is enabled
  chrome.storage.local.get({ linkedinAutoDetect: false }, (data) => {
    if (data.linkedinAutoDetect) {
      const parser = new LinkedInMutualConnectionsParser();
      const mutualConnections = parser.detectMutualConnections();
      
      if (mutualConnections) {
        chrome.runtime.sendMessage({
          action: 'linkedinMutualConnectionsDetected',
          data: mutualConnections
        });
      }
    }
  });
});

console.log('LinkedIn Mutual Connections Parser loaded');