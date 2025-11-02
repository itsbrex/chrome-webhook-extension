# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Chrome extension (Manifest V3) that allows users to manage webhooks and send webpage URLs to registered webhook endpoints via context menus. The extension is designed to integrate with automation workflows like N8N and includes specialized LinkedIn profile parsing capabilities.

**Version**: 2.0+ (with LinkedIn integration)

## Architecture

### Core Components

- **manifest.json**: Chrome extension manifest defining permissions, background scripts, and UI components
- **background.js**: Service worker handling context menu creation, webhook management, HTTP requests, and LinkedIn parsing coordination
- **popup.html/popup.js**: Extension popup UI for webhook registration and management
- **contentScripts/pageHelper.js**: LinkedIn-specific content script for profile data extraction
- **Chrome Storage**: Local storage for webhook persistence and settings

### Key Features

- Context menu integration for pages, links, images, and selections
- Dynamic webhook menu generation based on stored webhooks
- Enhanced data extraction (page metadata, timestamps, selected text)
- **LinkedIn Profile Parsing**: Specialized extraction of LinkedIn profile data including:
  - Basic profile information (name, headline, location)
  - Work experience with company details and date ranges
  - Education history
  - Skills and endorsements
  - Mutual connections parsing (with bi-directional support)
- Two-click deletion confirmation for webhook management

## Development

### Installation for Development

1. Load extension in Chrome: `chrome://extensions/` → "Load unpacked" → select project directory
2. Enable "Developer mode" in Chrome extensions page

### Code Quality Tools

- **Ultracite**: Lightning-fast formatter and linter using Biome
- **Pre-commit hooks**: Automatic code formatting via Husky
- **Bun**: Package manager and test runner
- **Vitest**: Modern test framework with 151 comprehensive tests

### Testing

The project includes a comprehensive test suite with 151 tests covering all functionality:

#### Quick Start
```bash
# Run all tests
bun test:run

# Run tests in watch mode
bun test

# Run tests with UI dashboard
bun test:ui

# Run only unit tests
bun test:unit

# Run only integration tests
bun test:integration
```

#### Test Coverage
- **Unit Tests**: 124 tests for background.js, popup.js, and pageHelper.js
- **Integration Tests**: 27 tests for Chrome API interactions and E2E workflows
- **Pass Rate**: 100% (151/151 tests passing)
- **Execution Time**: ~1 second

See [TEST_SUMMARY.md](./TEST_SUMMARY.md) and [__tests__/README.md](./__tests__/README.md) for detailed documentation.

#### Manual Testing Workflow
  1. Load extension in Chrome
  2. Add webhooks via popup
  3. Test context menu functionality on regular pages
  4. Test LinkedIn profile parsing on linkedin.com/in/* pages
  5. Verify webhook payloads are sent correctly

### Key Files to Modify

- **background.js:1-50**: Queue initialization and management
- **background.js:74-115**: Queue processing with rate limiting
- **background.js:230-450**: Data extraction and webhook sending (including LinkedIn)
- **background.js:495-560**: Queue notifications system
- **contentScripts/pageHelper.js**: LinkedIn profile parsing logic
  - Experience extraction (lines ~50-150)
  - Education extraction (lines ~150-250)
  - Skills extraction (lines ~250-350)
  - Mutual connections parsing (lines ~350-600)
- **popup.js:51-118**: Webhook card creation and rendering
- **popup.js:324-358**: Form toggle functionality
- **popup.js:405-413**: Form submission and settings handling
- **popup.html:31-420**: Modern CSS design system and layout
- **manifest.json:6-14**: Permissions and host permissions

### Storage Structure

Webhooks and settings are stored in Chrome local storage:
```json
{
  "webhooks": [
    {
      "name": "Friendly Name",
      "url": "https://webhook.url",
      "rateLimit": 30
    }
  ],
  "settings": {
    "notificationInterval": 5,
    "linkedinAutoMutualConnections": false,
    "linkedinBidirectional": false
  }
}
```

### Context Menu Integration

- Parent menu: "Send to Webhook"
- Dynamic child menus created for each registered webhook
- Supports page, link, image, and selection contexts
- Special context menu: "Parse LinkedIn Mutual Connections" (LinkedIn profiles only)
- Enhanced payloads with metadata, timestamps, and context-specific data

## Implemented Features (v2.0+ Status)

✅ **Core Functionality**
- Webhook registration, editing, deletion with validation
- Context menu integration for all content types
- Enhanced data collection (metadata, timestamps, selected text)
- Webhook testing with response time feedback
- Smart notifications with emoji feedback (✅/❌/⏳)
- Error handling with toast notifications
- Retry mechanism (3 attempts with progressive delays)
- Performance optimizations (debouncing, ID sanitization)
- Concurrent webhook support

✅ **LinkedIn Profile Parsing (NEW)**
- Automatic LinkedIn profile detection on linkedin.com/in/* pages
- Structured data extraction:
  - Profile basics (name, headline, location, profile URL)
  - Work experience with position details and date ranges
  - Education history with institution and degree information
  - Skills list extraction
  - Mutual connections URL detection
- Manual mutual connections parsing via context menu
- Auto mutual connections parsing (configurable)
- Bi-directional payload support for connection relationships
- Separate content script architecture for LinkedIn-specific logic

✅ **Rate Limiting & Queue System (v2.0)**
- Per-webhook configurable rate limits (in seconds)
- Intelligent queueing system with independent queues
- Queue notifications with ⏳ emoji and countdown timers
- Configurable notification update intervals (1-60 seconds)
- Smart queue detection (only shows notifications when actually queued)

✅ **Modern UI Design (v2.0)**
- Complete interface redesign with card-based layout
- Professional design system with CSS custom properties
- Tabbed navigation (Webhooks | Settings)
- Collapsible form design for space optimization
- Enhanced typography and consistent spacing
- Modern button states and hover effects
- Accessible keyboard navigation
- Responsive design optimized for 400x600px popup

✅ **Enhanced User Experience (v2.0)**
- Improved form validation and error messaging
- Success/error notifications with auto-dismissal
- Enhanced webhook cards with action buttons
- Two-click deletion confirmation
- Edit mode with form pre-filling
- Settings management interface
- Author attribution with external link

## Recent Updates (Updated: 2025-11-01)

### LinkedIn Integration (copilot/fix-6 branch)
- **NEW**: Added comprehensive LinkedIn profile parsing capabilities
- **NEW**: Created `contentScripts/pageHelper.js` for specialized LinkedIn data extraction
- **ENHANCED**: Background.js now detects LinkedIn profiles and uses specialized extraction
- **ENHANCED**: Support for bi-directional mutual connections parsing
- **ENHANCED**: Configurable auto-parsing settings for LinkedIn profiles
- **FIXED**: Invalid CSS selector issues in LinkedIn parser
- **FIXED**: Error handling improvements throughout the codebase
- **ADDED**: Concurrent webhook support for multiple simultaneous requests

### Code Quality & Tooling
- **NEW**: Added Cursor IDE rules (.cursor/rules/):
  - `chrome_extension.mdc`: Chrome extension development guidelines
  - `cursor_rules.mdc`: Cursor IDE configuration
  - `git_conventions.mdc`: Git workflow standards
  - `self_improve.mdc`: AI-assisted development rules
  - `ultracite.mdc`: Ultracite formatting/linting rules
- **NEW**: Pre-commit hooks with automatic code formatting via Husky
- **UPDATED**: Biome configuration for code quality
- **UPDATED**: Package dependencies and lock file

### Breaking Changes
- None - all changes are backward compatible

## Future Development Ideas

### 6. User Experience Enhancements
- **Webhook Categories/Tags**: Organize webhooks into categories for better management
- **Export/Import Configuration**: Allow users to backup and restore webhook configurations
- **Keyboard Shortcuts**: Add hotkeys for quick webhook sending (e.g., Ctrl+Shift+W)
- **Webhook History**: Show recent webhook calls with timestamps and status

### 7. Advanced Features
- **Custom Payload Templates**: Allow users to define custom JSON payload structures
- **Conditional Webhooks**: Only send webhooks if URL matches specific patterns/rules
- **Webhook Queue with Offline Support**: Queue webhooks when offline, retry when connection restored
- **Batch Operations**: Select multiple webhooks and send to all at once

### 8. Security & Configuration
- **HTTPS-Only Validation**: Enforce HTTPS-only webhook URLs for security
- **Authentication Headers**: Support for custom headers (API keys, tokens)
- ✅ **Rate Limiting**: Prevent spam by limiting webhook calls per minute
- **Webhook Encryption**: Optional payload encryption for sensitive data

### 9. Analytics & Monitoring
- **Usage Statistics**: Track webhook usage patterns and success rates
- **Response Logging**: Store webhook responses for debugging
- **Performance Metrics**: Track response times and identify slow webhooks
- **Error Analytics**: Categorize and track different types of failures

### 10. Integration Features
- **Popular Service Presets**: Pre-configured templates for services like Zapier, IFTTT, Discord
- **Webhook Health Monitoring**: Periodic health checks for registered webhooks
- **Content Filtering**: Options to exclude certain domains or content types
- **Collaboration**: Share webhook configurations between team members

### 11. LinkedIn Enhancements (In Progress)
- ✅ **Profile Parsing**: Extract comprehensive LinkedIn profile data
- ✅ **Mutual Connections**: Parse and send mutual connections data
- **Company Page Parsing**: Extract company information from LinkedIn company pages
- **Post Extraction**: Parse LinkedIn posts and articles
- **Search Results**: Extract data from LinkedIn search results
- **Job Postings**: Parse job listing information

## Development Notes

- Current codebase is clean and well-structured for extensions
- All major architectural pieces are in place for future features
- Storage system can be extended for additional webhook metadata
- Context menu system supports expansion to more content types
- LinkedIn parsing uses separate content script for maintainability
- Follows Chrome Extension Manifest V3 best practices
- Code quality enforced via Ultracite and pre-commit hooks
- Follows comprehensive coding standards (see .cursor/rules/ and .claude/)

## Important Notes for Developers

### LinkedIn Profile Parsing
- LinkedIn profiles are auto-detected by URL pattern: `https://www.linkedin.com/in/*`
- Content script is injected on LinkedIn pages only (see manifest.json)
- Profile data is extracted client-side for privacy
- Bi-directional parsing creates payloads for both profile→connection and connection→profile relationships

### Code Quality
- All code must pass Ultracite formatting checks
- Pre-commit hooks automatically format staged files
- Follow accessibility guidelines (ARIA, semantic HTML)
- Use modern JavaScript patterns (arrow functions, async/await, optional chaining)
- Avoid common anti-patterns (see .cursor/rules/ultracite.mdc)

### Git Workflow
- Follow conventional commit messages (see .cursor/rules/git_conventions.mdc)
- Keep commits focused and atomic
- Use feature branches for new development
- Current development branch: `copilot/fix-6`
