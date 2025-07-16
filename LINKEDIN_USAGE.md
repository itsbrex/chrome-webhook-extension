# LinkedIn Mutual Connections Parser - Usage Guide

## Overview

The LinkedIn Mutual Connections Parser is a new feature that safely extracts all mutual connections from LinkedIn profiles without triggering anti-bot detection. The parsed data is then sent to your configured webhooks.

## Setup Instructions

### 1. Configure LinkedIn Settings

1. Open the extension popup
2. Navigate to the **Settings** tab
3. Configure the LinkedIn settings:
   - **Auto-detect mutual connections**: Enable to automatically detect mutual connections on LinkedIn profiles
   - **Send LinkedIn data to**: Choose how to handle LinkedIn data:
     - `Don't send LinkedIn data`: Parsing only, no webhook calls
     - `All configured webhooks`: Send to every webhook you have configured
     - `Selected webhooks only`: Choose specific webhooks for LinkedIn data
   - **Parsing delay**: Set delay between page parsing (1-10 seconds) to avoid detection

### 2. Add Webhooks (if not already done)

1. Go to the **Webhooks** tab
2. Click **Add New Webhook**
3. Configure:
   - **Webhook URL**: Your endpoint URL
   - **Display Name**: Friendly name for the webhook
   - **Rate Limit**: Optional rate limiting (recommended: 30-60 seconds for LinkedIn data)

## How to Use

### Method 1: Right-Click Context Menu

1. Navigate to any LinkedIn profile that shows mutual connections
2. Right-click anywhere on the page
3. Select **"Parse LinkedIn Mutual Connections"**
4. The extension will:
   - Detect mutual connections on the current profile
   - Open the search results page in a background tab
   - Parse all pages of mutual connections
   - Send the data to your configured webhooks
   - Close the background tab automatically

### Method 2: Auto-Detection (Optional)

1. Enable **"Auto-detect mutual connections"** in settings
2. When you visit LinkedIn profiles with mutual connections, you'll receive notifications
3. Use the context menu to manually trigger parsing when desired

## Data Structure

The extension sends comprehensive data to your webhooks:

```json
{
  "profileViewed": {
    "name": "Profile Name",
    "profileUrl": "https://linkedin.com/in/profile",
    "encodedId": "encoded_profile_id"
  },
  "mutualConnections": [
    {
      "name": "Connection Name",
      "profileUrl": "https://linkedin.com/in/connection",
      "headline": "Job Title at Company",
      "location": "City, Country",
      "profileImageUrl": "https://image.url",
      "connectionDegree": "1st",
      "isPremium": false,
      "extractedAt": "2024-07-16T02:30:45.123Z"
    }
  ],
  "totalCount": 25,
  "pagesScraped": 3,
  "extractionDuration": 45000,
  "metadata": {
    "timestamp": "2024-07-16T02:30:45.123Z",
    "sessionId": "linkedin_1234567890_abc123",
    "version": "2.0",
    "source": "linkedin-mutual-connections"
  },
  "type": "linkedin_mutual_connections"
}
```

## Anti-Detection Features

The parser includes several safety mechanisms:

- **Human-like delays**: Random delays between 2-7 seconds between pages
- **Scroll simulation**: Natural scrolling behavior
- **Rate limiting**: Respects configurable delays to avoid triggering protection
- **Bot detection**: Automatically detects and aborts if anti-bot measures are triggered
- **Background processing**: Uses hidden tabs to avoid disrupting your workflow

## Troubleshooting

### No Mutual Connections Detected

- Ensure you're on a LinkedIn profile page that shows mutual connections
- Look for text like "John Doe, Jane Smith, and X other mutual connections"
- The profile must have 3+ mutual connections for the parser to work

### Parsing Fails

- Check if LinkedIn is showing any security challenges or captchas
- Increase the parsing delay in settings
- Ensure you're logged into LinkedIn
- Check the browser console for detailed error messages

### No Data Sent to Webhooks

- Verify webhooks are configured correctly in the Webhooks tab
- Test webhooks using the built-in test feature
- Check LinkedIn settings to ensure webhooks are selected for LinkedIn data
- Review rate limiting settings if data seems delayed

### Development/Testing

Use the **"Test LinkedIn Selectors"** button in settings to validate that the extension can find LinkedIn elements on the current page. Check the browser console for detailed results.

## Rate Limiting Recommendations

For LinkedIn parsing, we recommend:

- **Webhook rate limit**: 30-60 seconds to avoid overwhelming your endpoints
- **Parsing delay**: 3-5 seconds for regular use, 5-10 seconds if you encounter any blocks
- **Session limits**: The parser automatically limits to 50 pages per session and has a 5-minute timeout

## Privacy & Ethics

- This tool respects LinkedIn's public mutual connections data
- Only extracts data that's already visible to you on LinkedIn
- Uses anti-detection measures to avoid disrupting LinkedIn's service
- Does not store any LinkedIn data locally - all data is immediately sent to your webhooks

## Support

If you encounter issues:

1. Check the browser console for error messages
2. Test selectors using the development tools
3. Verify your webhook configuration
4. Ensure you're on a compatible LinkedIn page
5. Check if LinkedIn is showing any security prompts