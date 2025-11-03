// Console styling system with global toggle
// Uses native Chrome DevTools console styling
// This file is loaded as a regular script (not ES6 module)

// Wrap everything in an IIFE to avoid global namespace pollution
(function() {
  'use strict';

  const globalScope = typeof globalThis !== 'undefined'
    ? globalThis
    : typeof self !== 'undefined'
      ? self
      : typeof window !== 'undefined'
        ? window
        : {};

// Debug state - checked before all logging
let DEBUG_ENABLED = false;

// Check if running in browser environment
const isBrowser = typeof globalScope !== 'undefined' && typeof globalScope.chrome !== 'undefined';

// Badge styles for different log types
const badgeStyles = {
  info: 'background: #2196F3; color: white; font-weight: bold; padding: 2px 5px; border-radius: 3px;',
  success: 'background: #4CAF50; color: white; font-weight: bold; padding: 2px 5px; border-radius: 3px;',
  error: 'background: #f44336; color: white; font-weight: bold; padding: 2px 5px; border-radius: 3px;',
  warning: 'background: #FF9800; color: white; font-weight: bold; padding: 2px 5px; border-radius: 3px;',
  debug: 'background: #9C27B0; color: white; font-weight: bold; padding: 2px 5px; border-radius: 3px;',
  webhook: 'background: #009688; color: white; font-weight: bold; padding: 2px 5px; border-radius: 3px;',
  linkedin: 'background: #3F51B5; color: white; font-weight: bold; padding: 2px 5px; border-radius: 3px;',
  queue: 'background: #795548; color: white; font-weight: bold; padding: 2px 5px; border-radius: 3px;',
  ui: 'background: #7B1FA2; color: white; font-weight: bold; padding: 2px 5px; border-radius: 3px;',
  api: 'background: #388E3C; color: white; font-weight: bold; padding: 2px 5px; border-radius: 3px;',
};

const textStyles = {
  info: 'color: #1976d2; font-style: italic;',
  success: 'color: #2e7d32; font-style: italic;',
  error: 'color: #c62828; font-style: italic;',
  warning: 'color: #e65100; font-style: italic;',
  debug: 'color: #6a1b9a; font-style: italic;',
  webhook: 'color: #00796b; font-style: italic;',
  linkedin: 'color: #283593; font-style: italic;',
  queue: 'color: #5d4037; font-style: italic;',
  ui: 'color: #7b1fa2; font-style: italic;',
  api: 'color: #388e3c; font-style: italic;',
};

/**
 * Update debug state from chrome.storage
 * Should be called on extension startup and when settings change
 */
async function updateDebugState() {
  if (!isBrowser) {
    DEBUG_ENABLED = false;
    return;
  }

  return new Promise((resolve) => {
    chrome.storage.local.get(['debugLoggingEnabled'], (result) => {
      // Check both storage setting and build-time flag
      const storageEnabled = result.debugLoggingEnabled === true;
      const buildEnabled = typeof __DEBUG_LOGGING_ENABLED__ !== 'undefined' 
        ? __DEBUG_LOGGING_ENABLED__ 
        : false;
      
      DEBUG_ENABLED = storageEnabled || buildEnabled;
      resolve(DEBUG_ENABLED);
    });
  });
}

/**
 * Create a logger function with specified styling
 * @param {string} type - Console method: 'log', 'warn', or 'error'
 * @param {string} label - Badge label text
 * @param {string} styleKey - Key to look up badge/text styles
 * @returns {Function} Logger function
 */
function createLogger(type = 'log', label, styleKey) {
  return (...args) => {
    if (!DEBUG_ENABLED) return;
    
  if (!isBrowser) {
      // Test environment fallback
      console[type](`[${label}]`, ...args);
      return;
    }
    
    try {
      const badgeStyle = badgeStyles[styleKey] || badgeStyles.info;
      const textStyle = textStyles[styleKey] || textStyles.info;
      
      // Use native console styling with %c
      console[type](
        `%c${label}%c`,
        badgeStyle,
        textStyle,
        ...args
      );
    } catch (err) {
      // Fallback to regular console if styling fails
      console[type](`[${label}]`, ...args);
    }
  };
}

// Badge-based log level functions
const info = createLogger('log', 'INFO', 'info');
const success = createLogger('log', 'SUCCESS', 'success');
const error = createLogger('error', 'ERROR', 'error');
const warning = createLogger('warn', 'WARNING', 'warning');
const debug = createLogger('log', 'DEBUG', 'debug');

// Feature-specific loggers
const webhookLogger = createLogger('log', 'WEBHOOK', 'webhook');
const linkedinLogger = createLogger('log', 'LINKEDIN', 'linkedin');
const queueLogger = createLogger('log', 'QUEUE', 'queue');
const uiLogger = createLogger('log', 'UI', 'ui');
const apiLogger = createLogger('log', 'API', 'api');

/**
 * Get current debug state
 * @returns {boolean} Current debug enabled state
 */
function isDebugEnabled() {
  return DEBUG_ENABLED;
}

/**
 * Manually set debug state (useful for testing)
 * @param {boolean} enabled - New debug state
 */
function setDebugEnabled(enabled) {
  DEBUG_ENABLED = enabled;
}

// Export to global window object for use across extension contexts
  if (typeof globalScope !== 'undefined') {
    globalScope.ChromeLogger = {
    // State management
    updateDebugState,
    isDebugEnabled,
    setDebugEnabled,
    
    // Core logger factory
    createLogger,
    
    // Badge-based log levels
    info,
    success,
    error,
    warning,
    debug,
    
    // Feature-specific loggers
    webhookLogger,
    linkedinLogger,
    queueLogger,
    uiLogger,
      apiLogger,
    };
  }

})(); // End IIFE

