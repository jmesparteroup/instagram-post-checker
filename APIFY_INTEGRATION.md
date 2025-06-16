# Apify Integration Documentation

## Overview

The Instagram Content Compliance Checker now uses the **Apify Instagram Scraper** for real Instagram data fetching, replacing the previous mock-only implementation.

## Features Implemented

### ✅ Real Instagram Scraping
- Uses `apify/instagram-scraper` actor via Apify API
- Supports both Instagram posts (`/p/`) and reels (`/reel/`)
- Fetches real captions, hashtags, media URLs, and metadata
- Validates Instagram URLs before processing

### ✅ Smart Fallback System
- Automatically falls back to mock data if:
  - No `APIFY_API_KEY` environment variable is set
  - API request fails or times out
  - API quota is exceeded
  - Invalid API key is provided

### ✅ Intelligent Error Handling
- Specific error messages for different failure scenarios
- Timeout handling (60-second limit)
- API quota and credit limit detection
- Invalid URL validation with helpful feedback

### ✅ Enhanced Mock Transcripts
- Generates contextual mock transcripts based on real caption content
- Analyzes hashtags and keywords to create realistic audio simulation
- Maintains compatibility with existing analysis engine

## Technical Implementation

### Dependencies Added
```json
{
  "apify-client": "^2.12.5"
}
```

### Environment Variables
```bash
# Required for real Instagram scraping
APIFY_API_KEY=your_apify_api_key_here
```

### API Configuration
- **Actor**: `apify/instagram-scraper`
- **Timeout**: 60 seconds
- **Results Limit**: 1 post per request
- **Cost**: ~$1.50 per 1,000 results

## Usage Examples

### With API Key (Real Scraping)
```typescript
// Set environment variable
process.env.APIFY_API_KEY = 'your_api_key';

// Use any real Instagram URL
const result = await getInstagramPostData('https://www.instagram.com/p/C7xBALsvCAi/');
// Returns real Instagram data
```

### Without API Key (Mock Data)
```typescript
// No API key set
const result = await getInstagramPostData('https://www.instagram.com/p/any-url/');
// Returns mock data with console warning
```

## Data Transformation

### Input (Apify Response)
```typescript
interface ApifyInstagramResult {
  caption?: string;
  type?: string;
  url?: string;
  videoUrl?: string;
  imageUrl?: string;
  displayUrl?: string;
  hashtags?: string[];
  mentions?: string[];
  // ... other fields
}
```

### Output (Application Format)
```typescript
interface InstagramPostData {
  caption: string;
  mediaType: 'video' | 'image';
  mediaUrl: string;
  transcript: string;
}
```

## Error Scenarios Handled

### 1. Invalid URL
```
Error: Invalid Instagram URL provided. Please provide a valid Instagram post or reel URL.
```

### 2. API Timeout
```
Error: Request timed out. The Instagram post might be taking too long to scrape. Please try again.
```

### 3. Quota Exceeded
```
Error: Apify API quota exceeded. Please check your Apify account credits.
```

### 4. Invalid API Key
```
Error: Invalid Apify API key. Please check your APIFY_API_KEY environment variable.
```

### 5. No Data Found
```
Error: No data found for the provided Instagram URL. The post might be private or the URL might be invalid.
```

## Testing

### Manual Testing
1. Set `APIFY_API_KEY` in `.env.local`
2. Run the application: `npm run dev`
3. Test with real Instagram URLs

### Automated Testing
```bash
# Run the test script
npm run test:apify
```

### Test URLs
- Post: `https://www.instagram.com/p/C7xBALsvCAi/`
- Reel: `https://www.instagram.com/reel/DDIJAfeyemG/`

## Performance Considerations

### API Costs
- **Free Tier**: Apify provides free credits for testing
- **Production**: ~$1.50 per 1,000 Instagram posts scraped
- **Optimization**: Consider implementing caching to reduce API calls

### Response Times
- **First Request**: 10-30 seconds (Apify actor initialization)
- **Subsequent Requests**: 5-15 seconds
- **Timeout**: 60 seconds maximum

### Rate Limiting
- Apify handles Instagram's rate limiting internally
- No additional rate limiting implemented in application
- Consider adding request queuing for high-volume usage

## Future Enhancements

### 1. Caching Layer
```typescript
// Implement Redis or in-memory caching
const cachedResult = await cache.get(url);
if (cachedResult) return cachedResult;
```

### 2. Batch Processing
```typescript
// Support multiple URLs in single request
const results = await getMultipleInstagramPosts([url1, url2, url3]);
```

### 3. Real Video Transcription
```typescript
// Integrate speech-to-text services
const transcript = await transcribeVideo(videoUrl);
```

### 4. Retry Logic
```typescript
// Implement exponential backoff
const result = await retryWithBackoff(() => getInstagramPostData(url));
```

## Troubleshooting

### Common Issues

1. **"Falling back to mock data"**
   - Check if `APIFY_API_KEY` is set in `.env.local`
   - Verify API key is valid in Apify Console

2. **"Request timed out"**
   - Instagram post might be complex or large
   - Try again or use a different post

3. **"API quota exceeded"**
   - Check Apify account credits
   - Consider upgrading plan or implementing caching

4. **"No data found"**
   - Post might be private
   - URL might be invalid or deleted
   - Try with a different public post

### Debug Mode
Enable detailed logging by checking browser console or server logs for:
- API request details
- Response data structure
- Error stack traces

## Security Considerations

### Environment Variables
- Never commit `.env.local` to version control
- Use secure environment variable management in production
- Rotate API keys regularly

### Data Privacy
- Only scrapes publicly available Instagram content
- Does not store or cache scraped data permanently
- Complies with Instagram's public data access patterns

### Rate Limiting
- Apify handles Instagram's anti-bot measures
- No additional authentication required
- Respects Instagram's terms of service through Apify's compliance

## Monitoring and Maintenance

### Key Metrics to Monitor
- API success rate
- Response times
- Error frequency by type
- API credit usage

### Regular Maintenance
- Monitor Apify account credits
- Update `apify-client` dependency
- Test with various Instagram post types
- Review error logs for new failure patterns

## Support and Resources

- **Apify Documentation**: https://docs.apify.com/api/v2/
- **Instagram Scraper Actor**: https://apify.com/apify/instagram-scraper
- **API Console**: https://console.apify.com/
- **Support**: https://help.apify.com/ 