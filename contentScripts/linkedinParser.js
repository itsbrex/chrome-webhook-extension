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
        mutualConnectionsLink: 'a[href*="facetConnectionOf"]',
        connectionName: 'span.entity-result__title-text a span[dir="ltr"]',
        profileUrl: 'a.app-aware-link[href*="/in/"]',
        profileHeadline: '.entity-result__primary-subtitle',
        location: '.entity-result__secondary-subtitle',
        profileImage: 'img.presence-entity__image',
        connectionBadge: '.entity-result__badge-text',
        premiumIndicator: 'li-icon[type="linkedin-bug"]',
        searchContainer: '.search-results-container',
        resultItems: 'li.reusable-search__result-container',
        paginationContainer: '.artdeco-pagination',
        nextPageButton: 'button[aria-label*="Next"]'
      },
      maxPagesPerSession: 50,
      maxConnectionsPerPage: 10,
      sessionTimeout: 300000 // 5 minutes
    };
    
    this.antiDetection = new AntiDetectionManager();
    this.isProcessing = false;
    this.currentSession = null;
  }

  // Detect if current page has mutual connections section
  detectMutualConnections() {
    const mutualConnectionsElement = document.querySelector(this.config.selectors.mutualConnectionsLink);
    if (!mutualConnectionsElement) return null;

    const href = mutualConnectionsElement.href;
    const url = new URL(href);
    
    // Extract encoded profile ID
    const encodedId = url.searchParams.get('facetConnectionOf');
    if (!encodedId) return null;

    // Extract connection count from text
    const text = mutualConnectionsElement.textContent || '';
    const countMatch = text.match(/(\d+)\s+(?:other\s+)?mutual\s+connections/i);
    const totalCount = countMatch ? parseInt(countMatch[1]) + 2 : null; // +2 for the named ones

    return {
      searchUrl: href,
      encodedId: encodedId,
      totalCount: totalCount,
      text: text
    };
  }

  // Parse connections from search results page
  async parseSearchResults() {
    await this.antiDetection.randomDelay();
    
    if (this.antiDetection.detectBotProtection()) {
      throw new Error('Bot protection detected - aborting parsing');
    }

    const connections = [];
    const resultItems = document.querySelectorAll(this.config.selectors.resultItems);
    
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

    return connections;
  }

  // Extract data from individual connection element
  async extractConnectionData(element) {
    const nameElement = element.querySelector(this.config.selectors.connectionName);
    const profileUrlElement = element.querySelector(this.config.selectors.profileUrl);
    const headlineElement = element.querySelector(this.config.selectors.profileHeadline);
    const locationElement = element.querySelector(this.config.selectors.location);
    const imageElement = element.querySelector(this.config.selectors.profileImage);
    const badgeElement = element.querySelector(this.config.selectors.connectionBadge);
    const premiumElement = element.querySelector(this.config.selectors.premiumIndicator);

    if (!nameElement || !profileUrlElement) {
      return null; // Skip if essential data missing
    }

    return {
      name: nameElement.textContent?.trim() || '',
      profileUrl: profileUrlElement.href || '',
      headline: headlineElement?.textContent?.trim() || '',
      location: locationElement?.textContent?.trim() || '',
      profileImageUrl: imageElement?.src || '',
      connectionDegree: badgeElement?.textContent?.trim() || '',
      isPremium: !!premiumElement,
      extractedAt: new Date().toISOString()
    };
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

  generateSessionId() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
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
  
  if (request.action === 'checkBotProtection') {
    const antiDetection = new AntiDetectionManager();
    const isBlocked = antiDetection.detectBotProtection();
    sendResponse({ success: true, isBlocked });
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