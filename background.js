// Webhook queue management
const webhookQueues = new Map(); // Map of webhookUrl -> { queue: [], lastSent: timestamp, timer: timeoutId }
const queueNotifications = new Map(); // Map of notificationId -> { webhookUrl, intervalId }

// LinkedIn parsing state
const linkedinSessions = new Map(); // Map of sessionId -> { tabId, profileData, status }

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "sendToWebhook",
    title: "Send to Webhook",
    contexts: ["page", "link", "image", "selection"]
  }, () => {
    if (chrome.runtime.lastError) {
      console.error(`Error creating parent menu: ${chrome.runtime.lastError.message}`);
    }
    updateWebhookMenus();
  });
  
  // Add LinkedIn context menu
  chrome.contextMenus.create({
    id: "linkedinMutualConnections",
    title: "Parse LinkedIn Mutual Connections",
    contexts: ["page"],
    documentUrlPatterns: ["https://www.linkedin.com/in/*"]
  }, () => {
    if (chrome.runtime.lastError) {
      console.error(`Error creating LinkedIn menu: ${chrome.runtime.lastError.message}`);
    }
  });
  
  initializeQueues();
});

chrome.runtime.onStartup.addListener(() => {
  updateWebhookMenus();
  initializeQueues();
});

function initializeQueues() {
  chrome.storage.local.get('webhooks', function (data) {
    if (data.webhooks) {
      data.webhooks.forEach(webhook => {
        if (!webhookQueues.has(webhook.url)) {
          webhookQueues.set(webhook.url, {
            queue: [],
            lastSent: 0,
            timer: null,
            rateLimit: webhook.rateLimit || 0
          });
        } else {
          // Update rate limit if it changed
          const queueData = webhookQueues.get(webhook.url);
          queueData.rateLimit = webhook.rateLimit || 0;
        }
      });
    }
  });
}

function addToQueue(webhookUrl, payload, webhookName, rateLimit = 0) {
  if (!webhookQueues.has(webhookUrl)) {
    webhookQueues.set(webhookUrl, {
      queue: [],
      lastSent: 0,
      timer: null,
      rateLimit: rateLimit
    });
  }
  
  const queueData = webhookQueues.get(webhookUrl);
  queueData.rateLimit = rateLimit; // Update rate limit
  queueData.queue.push({ payload, webhookName, timestamp: Date.now() });
  
  // Check if this item will be queued (not sent immediately)
  const now = Date.now();
  const timeSinceLastSent = now - queueData.lastSent;
  const rateLimitMs = queueData.rateLimit * 1000;
  const willBeQueued = queueData.rateLimit > 0 && (queueData.queue.length > 1 || timeSinceLastSent < rateLimitMs);
  
  if (willBeQueued) {
    showQueueNotification(webhookUrl, webhookName);
  }
  
  processQueue(webhookUrl);
}

function processQueue(webhookUrl) {
  const queueData = webhookQueues.get(webhookUrl);
  if (!queueData || queueData.queue.length === 0) return;
  
  const now = Date.now();
  const timeSinceLastSent = now - queueData.lastSent;
  const rateLimitMs = queueData.rateLimit * 1000;
  
  if (queueData.rateLimit > 0 && timeSinceLastSent < rateLimitMs) {
    // Need to wait before sending
    const waitTime = rateLimitMs - timeSinceLastSent;
    
    if (queueData.timer) {
      clearTimeout(queueData.timer);
    }
    
    queueData.timer = setTimeout(() => {
      processQueue(webhookUrl);
    }, waitTime);
    
    return;
  }
  
  // Send the next item in queue
  const item = queueData.queue.shift();
  queueData.lastSent = now;
  
  // Clear any existing queue notification for this webhook
  clearQueueNotification(webhookUrl);
  
  postToWebhookDirect(webhookUrl, item.payload, 3, item.webhookName);
  
  // Schedule next item if queue has more items
  if (queueData.queue.length > 0) {
    if (queueData.rateLimit > 0) {
      queueData.timer = setTimeout(() => {
        processQueue(webhookUrl);
      }, rateLimitMs);
    } else {
      // No rate limit, process immediately
      processQueue(webhookUrl);
    }
  }
}

function sanitizeMenuId(name) {
  return name.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 50);
}

let updateWebhookMenusTimeout;
function updateWebhookMenus() {
  // Debounce to avoid excessive rebuilds
  clearTimeout(updateWebhookMenusTimeout);
  updateWebhookMenusTimeout = setTimeout(() => {
    // First remove all existing child items (if any)
    chrome.contextMenus.removeAll(() => {
      // Recreate parent menu to avoid reference errors
      chrome.contextMenus.create({
        id: "sendToWebhook",
        title: "Send to Webhook",
        contexts: ["page", "link", "image", "selection"]
      }, () => {
        // Check for errors
        if (chrome.runtime.lastError) {
          console.error(`Error recreating parent menu: ${chrome.runtime.lastError.message}`);
          return;
        }

        // Now add child items
        chrome.storage.local.get('webhooks', function (data) {
          if (data.webhooks && data.webhooks.length > 0) {
            data.webhooks.forEach((webhook, index) => {
              const sanitizedId = sanitizeMenuId(webhook.name);
              
              // Create menu item for page, link, and image contexts
              chrome.contextMenus.create({
                id: `sendTo_${sanitizedId}_${index}_normal`,
                parentId: "sendToWebhook",
                title: webhook.name,
                contexts: ["page", "link", "image"]
              });
              
              // Create separate menu item for selection context
              chrome.contextMenus.create({
                id: `sendTo_${sanitizedId}_${index}_selection`,
                parentId: "sendToWebhook",
                title: webhook.name,
                contexts: ["selection"]
              });
            });
          }
        });
      });
    });
  }, 100);
}

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId.startsWith("sendTo_")) {
    chrome.storage.local.get('webhooks', function (data) {
      // Extract index from menu ID (sendTo_sanitizedName_index_type)
      const parts = info.menuItemId.split('_');
      const indexPart = parts[parts.length - 2]; // Second to last part is the index
      const index = parseInt(indexPart);
      const webhook = data.webhooks[index];
      if (webhook) {
        sendToWebhook(webhook.url, info, tab.id);
      }
    });
  } else if (info.menuItemId === "linkedinMutualConnections") {
    handleLinkedInMutualConnections(tab);
  }
});

function sendToWebhook(webhookUrl, info, tabId) {
  if (info.linkUrl) {
    extractDataAndSend(webhookUrl, info.linkUrl, 'link', tabId, null);
  } else if (info.srcUrl) {
    extractDataAndSend(webhookUrl, info.srcUrl, 'image', tabId, null);
  } else {
    // Page context: check if text is selected
    const type = info.selectionText ? 'selection' : 'page';
    const urlToSend = info.pageUrl;
    extractDataAndSend(webhookUrl, urlToSend, type, tabId, info.selectionText);
  }
}

function extractDataAndSend(webhookUrl, urlToSend, type, tabId, selectionText) {
  // Check if this is a LinkedIn profile page and should use LinkedIn-specific extraction
  if (type === 'page' && urlToSend.includes('linkedin.com/in/')) {
    extractLinkedInProfileAndSend(webhookUrl, urlToSend, tabId);
    return;
  }
  
  let codeToExecute;

  if (type === 'page') {
    codeToExecute = function () {
      return {
        title: document.title,
        description: document.querySelector('meta[name="description"]')?.getAttribute('content') || null,
        keywords: document.querySelector('meta[name="keywords"]')?.getAttribute('content') || null,
        favicon: document.querySelector('link[rel="icon"]')?.href || document.querySelector('link[rel="shortcut icon"]')?.href || null
      };
    };
  } else if (type === 'selection') {
    codeToExecute = function () {
      return {
        title: document.title,
        description: document.querySelector('meta[name="description"]')?.getAttribute('content') || null,
        keywords: document.querySelector('meta[name="keywords"]')?.getAttribute('content') || null,
        favicon: document.querySelector('link[rel="icon"]')?.href || document.querySelector('link[rel="shortcut icon"]')?.href || null
      };
    };
  } else if (type === 'link') {
    codeToExecute = function () {
      const links = document.querySelectorAll('a');
      for (let link of links) {
        if (link.href === arguments[0]) {
          return link.title || null;
        }
      }
      return null;
    };
  } else if (type === 'image') {
    codeToExecute = function () {
      const images = document.querySelectorAll('img');
      for (let img of images) {
        if (img.src === arguments[0]) {
          return img.alt || null;
        }
      }
      return null;
    };
  }

  chrome.scripting.executeScript({
    target: { tabId: tabId },
    func: codeToExecute,
    args: [urlToSend]
  }, (injectionResults) => {
    if (chrome.runtime.lastError) {
      console.error('Script injection failed:', chrome.runtime.lastError.message);
      return;
    }
    const extractedData = injectionResults[0]?.result;
    
    // Find webhook name for notification
    chrome.storage.local.get('webhooks', function (data) {
      const webhook = data.webhooks?.find(wh => wh.url === webhookUrl);
      const webhookName = webhook ? webhook.name : 'Webhook';
      
      // Build enhanced payload
      const payload = {
        url: urlToSend,
        timestamp: new Date().toISOString(),
        type: type
      };

      if (type === 'page') {
        payload.title = extractedData?.title || null;
        payload.description = extractedData?.description || null;
        payload.keywords = extractedData?.keywords || null;
        payload.favicon = extractedData?.favicon || null;
      } else if (type === 'selection') {
        payload.title = extractedData?.title || null;
        payload.description = extractedData?.description || null;
        payload.keywords = extractedData?.keywords || null;
        payload.favicon = extractedData?.favicon || null;
        payload.selectedText = selectionText;
      } else if (type === 'link') {
        payload.title = extractedData;
        payload.linkTitle = extractedData;
      } else if (type === 'image') {
        payload.title = extractedData;
        payload.altText = extractedData;
      }

      // Find webhook to get rate limit
      chrome.storage.local.get('webhooks', function (webhooksData) {
        const webhook = webhooksData.webhooks?.find(wh => wh.url === webhookUrl);
        const rateLimit = webhook ? webhook.rateLimit || 0 : 0;
        
        addToQueue(webhookUrl, payload, webhookName, rateLimit);
      });
    });
  });
}

// Extract LinkedIn profile data and send to webhook
async function extractLinkedInProfileAndSend(webhookUrl, urlToSend, tabId) {
  try {
    // Use LinkedIn-specific parsing
    const parseResult = await chrome.tabs.sendMessage(tabId, {
      action: 'parseLinkedInProfile'
    });
    
    if (!parseResult.success) {
      console.error('LinkedIn profile parsing failed, falling back to basic extraction');
      // Fall back to basic page extraction
      extractDataAndSendBasic(webhookUrl, urlToSend, 'page', tabId, null);
      return;
    }
    
    const profileData = parseResult.data;
    
    // Find webhook name for notification
    chrome.storage.local.get('webhooks', function (data) {
      const webhook = data.webhooks?.find(wh => wh.url === webhookUrl);
      const webhookName = webhook ? webhook.name : 'Webhook';
      
      // Build enhanced LinkedIn payload
      const payload = {
        url: urlToSend,
        timestamp: new Date().toISOString(),
        type: 'linkedin_profile',
        profile: profileData,
        source: 'chrome_extension_linkedin_parser'
      };

      // Find webhook to get rate limit
      chrome.storage.local.get('webhooks', function (webhooksData) {
        const webhook = webhooksData.webhooks?.find(wh => wh.url === webhookUrl);
        const rateLimit = webhook ? webhook.rateLimit || 0 : 0;
        
        addToQueue(webhookUrl, payload, webhookName, rateLimit);
      });
    });
    
    // Check if auto mutual connections parsing is enabled
    chrome.storage.local.get({ linkedinAutoMutualConnections: false }, async function (settings) {
      if (settings.linkedinAutoMutualConnections && profileData.mutualConnectionsUrl) {
        try {
          await handleLinkedInMutualConnectionsAuto(tabId, profileData);
        } catch (error) {
          console.error('Auto mutual connections parsing failed:', error);
        }
      }
    });
    
  } catch (error) {
    console.error('LinkedIn profile extraction failed:', error);
    // Fall back to basic page extraction
    extractDataAndSendBasic(webhookUrl, urlToSend, 'page', tabId, null);
  }
}

// Basic page extraction fallback
function extractDataAndSendBasic(webhookUrl, urlToSend, type, tabId, selectionText) {
  chrome.scripting.executeScript({
    target: { tabId: tabId },
    func: function () {
      return {
        title: document.title,
        description: document.querySelector('meta[name="description"]')?.getAttribute('content') || null,
        keywords: document.querySelector('meta[name="keywords"]')?.getAttribute('content') || null,
        favicon: document.querySelector('link[rel="icon"]')?.href || document.querySelector('link[rel="shortcut icon"]')?.href || null
      };
    }
  }, (injectionResults) => {
    if (chrome.runtime.lastError) {
      console.error('Script injection failed:', chrome.runtime.lastError.message);
      return;
    }
    const extractedData = injectionResults[0]?.result;
    
    chrome.storage.local.get('webhooks', function (data) {
      const webhook = data.webhooks?.find(wh => wh.url === webhookUrl);
      const webhookName = webhook ? webhook.name : 'Webhook';
      
      const payload = {
        url: urlToSend,
        timestamp: new Date().toISOString(),
        type: type,
        title: extractedData?.title || null,
        description: extractedData?.description || null,
        keywords: extractedData?.keywords || null,
        favicon: extractedData?.favicon || null
      };

      if (selectionText) {
        payload.selectedText = selectionText;
      }

      chrome.storage.local.get('webhooks', function (webhooksData) {
        const webhook = webhooksData.webhooks?.find(wh => wh.url === webhookUrl);
        const rateLimit = webhook ? webhook.rateLimit || 0 : 0;
        
        addToQueue(webhookUrl, payload, webhookName, rateLimit);
      });
    });
  });
}

function showNotification(title, message, isSuccess = true) {
  const iconPath = isSuccess ? 'images/icon48.png' : 'images/icon48.png';
  chrome.notifications.create({
    type: 'basic',
    iconUrl: iconPath,
    title: title,
    message: message
  });
}

function showQueueNotification(webhookUrl, webhookName) {
  const notificationId = `queue_${webhookUrl}_${Date.now()}`;
  
  // Clear any existing notification for this webhook
  clearQueueNotification(webhookUrl);
  
  // Get notification interval from settings
  chrome.storage.local.get({ settings: { notificationInterval: 5 } }, function (data) {
    const updateIntervalMs = data.settings.notificationInterval * 1000;
    
    function updateNotification() {
      const queueData = webhookQueues.get(webhookUrl);
      if (!queueData || queueData.queue.length === 0) {
        clearQueueNotification(webhookUrl);
        return;
      }
      
      const now = Date.now();
      const timeSinceLastSent = now - queueData.lastSent;
      const rateLimitMs = queueData.rateLimit * 1000;
      const waitTime = Math.max(0, rateLimitMs - timeSinceLastSent);
      const queuePosition = queueData.queue.length;
      const totalWait = Math.ceil((waitTime + (queuePosition - 1) * rateLimitMs) / 1000);
      
      chrome.notifications.create(notificationId, {
        type: 'basic',
        iconUrl: 'images/icon48.png',
        title: `⏳ ${webhookName} - Queued`,
        message: `${queuePosition} in queue, ~${totalWait}s remaining`
      });
    }
    
    // Initial notification
    updateNotification();
    
    // Update at configured interval
    const intervalId = setInterval(updateNotification, updateIntervalMs);
    
    queueNotifications.set(webhookUrl, { notificationId, intervalId });
    
    // Auto-clear after 60 seconds to prevent indefinite notifications
    setTimeout(() => clearQueueNotification(webhookUrl), 60000);
  });
}

function clearQueueNotification(webhookUrl) {
  const notification = queueNotifications.get(webhookUrl);
  if (notification) {
    clearInterval(notification.intervalId);
    chrome.notifications.clear(notification.notificationId);
    queueNotifications.delete(webhookUrl);
  }
}

function postToWebhookDirect(webhookUrl, payload, retryCount = 3, webhookName = 'Webhook') {
  fetch(webhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  }).then(response => {
    if (!response.ok && retryCount > 0) {
      console.log(`Webhook failed with status ${response.status}, retrying... (${retryCount} attempts left)`);
      setTimeout(() => postToWebhookDirect(webhookUrl, payload, retryCount - 1, webhookName), 1000);
    } else if (response.ok) {
      console.log('Webhook sent with response status:', response.status);
      showNotification(`✅ ${webhookName} - Success`, `Data sent successfully to ${webhookName}`, true);
    } else {
      console.log('Webhook failed after all retries');
      showNotification(`❌ ${webhookName} - Failed`, `Failed to send data after 3 attempts`, false);
    }
  }).catch(error => {
    console.error('Error sending webhook:', error);
    if (retryCount > 0) {
      console.log(`Retrying webhook in 2 seconds... (${retryCount} attempts left)`);
      setTimeout(() => postToWebhookDirect(webhookUrl, payload, retryCount - 1, webhookName), 2000);
    } else {
      showNotification(`❌ ${webhookName} - Error`, `Network error: ${error.message}`, false);
    }
  });
}

// Listen for changes in the webhooks data to update context menus and queues
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local' && changes.webhooks) {
    updateWebhookMenus();
    initializeQueues();
  }
});

// LinkedIn Mutual Connections Functionality
async function handleLinkedInMutualConnections(tab) {
  try {
    // First, detect mutual connections on current page
    const detectionResult = await chrome.tabs.sendMessage(tab.id, {
      action: 'detectMutualConnections'
    });
    
    if (!detectionResult.success || !detectionResult.data) {
      showNotification('❌ LinkedIn Parser', 'No mutual connections found on this page', false);
      return;
    }
    
    const mutualConnectionsData = detectionResult.data;
    showNotification('🔍 LinkedIn Parser', `Found ${mutualConnectionsData.totalCount || 'some'} mutual connections. Starting parsing...`, true);
    
    // Create new tab for parsing
    const searchTab = await chrome.tabs.create({
      url: mutualConnectionsData.searchUrl,
      active: false
    });
    
    // Wait for tab to load
    await waitForTabLoad(searchTab.id);
    
    // Start parsing process
    const sessionId = generateSessionId();
    linkedinSessions.set(sessionId, {
      tabId: searchTab.id,
      profileData: {
        profileUrl: tab.url,
        encodedId: mutualConnectionsData.encodedId,
        totalCount: mutualConnectionsData.totalCount
      },
      status: 'parsing'
    });
    
    // Check if bi-directional parsing is enabled
    chrome.storage.local.get({ linkedinBidirectional: false }, async function (settings) {
      try {
        let parseResult;
        
        if (settings.linkedinBidirectional) {
          // Parse with bi-directional payloads
          parseResult = await chrome.tabs.sendMessage(searchTab.id, {
            action: 'parseAllMutualConnectionsBidirectional',
            profileData: linkedinSessions.get(sessionId).profileData
          });
          
          if (parseResult.success) {
            // Send each payload separately
            await Promise.all(parseResult.data.map(payload => sendLinkedInDataToWebhooks(payload)));
            showNotification('✅ LinkedIn Parser', `Successfully parsed ${parseResult.data.length} bi-directional payloads`, true);
          }
        } else {
          // Parse with single payload
          parseResult = await chrome.tabs.sendMessage(searchTab.id, {
            action: 'parseAllMutualConnections',
            profileData: linkedinSessions.get(sessionId).profileData
          });
          
          if (parseResult.success) {
            await sendLinkedInDataToWebhooks(parseResult.data);
            showNotification('✅ LinkedIn Parser', `Successfully parsed ${parseResult.data.totalCount} mutual connections`, true);
          }
        }
        
        if (!parseResult.success) {
          throw new Error(parseResult.error || 'Failed to parse mutual connections');
        }
        
      } catch (error) {
        console.error('LinkedIn parsing error:', error);
        showNotification('❌ LinkedIn Parser', `Error: ${error.message}`, false);
      } finally {
        // Close parsing tab
        try {
          await chrome.tabs.remove(searchTab.id);
        } catch (e) {
          // Tab might already be closed
        }
        linkedinSessions.delete(sessionId);
      }
    });
    
  } catch (error) {
    console.error('LinkedIn parsing error:', error);
    showNotification('❌ LinkedIn Parser', `Error: ${error.message}`, false);
    
    // Cleanup any sessions
    for (const [sessionId, session] of linkedinSessions.entries()) {
      try {
        await chrome.tabs.remove(session.tabId);
      } catch (e) {
        // Tab might already be closed
      }
      linkedinSessions.delete(sessionId);
    }
  }
}

// Auto mutual connections parsing (called from profile extraction)
async function handleLinkedInMutualConnectionsAuto(tabId, profileData) {
  try {
    if (!profileData.mutualConnectionsUrl) {
      console.log('No mutual connections URL found for auto parsing');
      return;
    }
    
    showNotification('🔄 LinkedIn Auto Parser', 'Auto-parsing mutual connections...', true);
    
    // Create new tab for parsing
    const searchTab = await chrome.tabs.create({
      url: profileData.mutualConnectionsUrl,
      active: false
    });
    
    // Wait for tab to load
    await waitForTabLoad(searchTab.id);
    
    // Start parsing process
    const sessionId = generateSessionId();
    linkedinSessions.set(sessionId, {
      tabId: searchTab.id,
      profileData: {
        profileUrl: profileData.profileUrl,
        profileName: profileData.name,
        encodedId: profileData.linkedinId,
        totalCount: profileData.mutualConnectionsCount
      },
      status: 'auto-parsing'
    });
    
    // Check if bi-directional parsing is enabled
    chrome.storage.local.get({ linkedinBidirectional: false }, async function (settings) {
      try {
        let parseResult;
        
        if (settings.linkedinBidirectional) {
          // Parse with bi-directional payloads
          parseResult = await chrome.tabs.sendMessage(searchTab.id, {
            action: 'parseAllMutualConnectionsBidirectional',
            profileData: linkedinSessions.get(sessionId).profileData
          });
          
          if (parseResult.success) {
            // Send each payload separately
            for (const payload of parseResult.data) {
              await sendLinkedInDataToWebhooks(payload);
            }
            showNotification('✅ LinkedIn Auto Parser', `Auto-parsed ${parseResult.data.length} bi-directional connections`, true);
          }
        } else {
          // Parse with single payload
          parseResult = await chrome.tabs.sendMessage(searchTab.id, {
            action: 'parseAllMutualConnections',
            profileData: linkedinSessions.get(sessionId).profileData
          });
          
          if (parseResult.success) {
            await sendLinkedInDataToWebhooks(parseResult.data);
            showNotification('✅ LinkedIn Auto Parser', `Auto-parsed ${parseResult.data.totalCount} mutual connections`, true);
          }
        }
        
        if (!parseResult.success) {
          throw new Error(parseResult.error || 'Failed to auto-parse mutual connections');
        }
        
      } catch (error) {
        console.error('LinkedIn auto-parsing error:', error);
        showNotification('❌ LinkedIn Auto Parser', `Auto-parse error: ${error.message}`, false);
      } finally {
        // Close parsing tab
        try {
          await chrome.tabs.remove(searchTab.id);
        } catch (e) {
          // Tab might already be closed
        }
        linkedinSessions.delete(sessionId);
      }
    });
    
  } catch (error) {
    console.error('LinkedIn auto-parsing error:', error);
    showNotification('❌ LinkedIn Auto Parser', `Auto-parse error: ${error.message}`, false);
  }
}

async function waitForTabLoad(tabId) {
  return new Promise((resolve) => {
    const listener = (tabUpdateId, changeInfo) => {
      if (tabUpdateId === tabId && changeInfo.status === 'complete') {
        chrome.tabs.onUpdated.removeListener(listener);
        // Add extra delay for JavaScript execution
        setTimeout(resolve, 2000);
      }
    };
    chrome.tabs.onUpdated.addListener(listener);
  });
}

async function sendLinkedInDataToWebhooks(linkedinData) {
  try {
    const data = await chrome.storage.local.get('webhooks');
    if (!data.webhooks || data.webhooks.length === 0) {
      showNotification('⚠️ LinkedIn Parser', 'No webhooks configured. Please add webhooks to receive LinkedIn data.', false);
      return;
    }
    
    // Get LinkedIn settings
    const settings = await chrome.storage.local.get({ 
      linkedinWebhooks: 'all', // 'all', 'selected', or 'none'
      selectedLinkedinWebhooks: []
    });
    
    let targetWebhooks = [];
    
    if (settings.linkedinWebhooks === 'all') {
      targetWebhooks = data.webhooks;
    } else if (settings.linkedinWebhooks === 'selected') {
      targetWebhooks = data.webhooks.filter((_, index) => 
        settings.selectedLinkedinWebhooks.includes(index)
      );
    }
    
    if (targetWebhooks.length === 0) {
      showNotification('⚠️ LinkedIn Parser', 'No webhooks selected for LinkedIn data.', false);
      return;
    }
    
    // Enhanced payload with LinkedIn-specific metadata
    const enhancedPayload = {
      ...linkedinData,
      timestamp: new Date().toISOString(),
      type: 'linkedin_mutual_connections',
      source: 'chrome_extension_linkedin_parser'
    };
    
    // Send to each selected webhook
    for (const webhook of targetWebhooks) {
      try {
        addToQueue(webhook.url, enhancedPayload, webhook.name, webhook.rateLimit || 0);
      } catch (error) {
        console.error(`Failed to queue LinkedIn data for webhook ${webhook.name}:`, error);
      }
    }
    
    showNotification('📤 LinkedIn Parser', `LinkedIn data queued for ${targetWebhooks.length} webhook(s)`, true);
  } catch (error) {
    console.error('Error sending LinkedIn data to webhooks:', error);
    showNotification('❌ LinkedIn Parser', `Error sending to webhooks: ${error.message}`, false);
  }
}

function generateSessionId() {
  return `linkedin_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Message handler for LinkedIn content script communications
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'linkedinMutualConnectionsDetected') {
    // Auto-detected mutual connections - could show notification or popup
    showNotification('🔍 LinkedIn Parser', 'Mutual connections detected on this page', true);
    sendResponse({ status: 'received' });
    return true;
  }
  
  if (request.action === 'linkedinParsingProgress') {
    // Update parsing progress
    console.log('LinkedIn parsing progress:', request.data);
    sendResponse({ status: 'received' });
    return true;
  }
  
  if (request.action === 'linkedinParsingError') {
    // Handle parsing errors
    console.error('LinkedIn parsing error:', request.data);
    showNotification('❌ LinkedIn Parser', `Error: ${request.data.message}`, false);
    sendResponse({ status: 'received' });
    return true;
  }
});
