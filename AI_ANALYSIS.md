# AI-Powered Instagram Content Analysis

This document explains the AI-powered analysis feature that replaces the rule-based analysis system with OpenAI's GPT-4o-mini for more accurate and context-aware Instagram content compliance checking.

## Overview

The AI analysis system provides:
- **Context-aware analysis** using OpenAI's language models
- **Structured output** with confidence scores and evidence
- **Automatic fallback** to rule-based analysis on failures
- **Request caching** to reduce API costs
- **Rate limiting** and error handling
- **Comprehensive logging** and monitoring

## Architecture

### Core Components

1. **AIAnalysisService** (`src/lib/ai-analysis-service.ts`)
   - Main service class for AI-powered analysis
   - Handles OpenAI API communication
   - Implements retry logic and error handling

2. **CacheService** (`src/lib/cache-service.ts`)
   - In-memory caching for analysis results
   - LRU eviction and TTL expiration
   - Cost optimization through request deduplication

3. **Enhanced API Route** (`src/app/api/analyze/route.ts`)
   - Updated to support both AI and rule-based analysis
   - Configurable analysis mode per request
   - Comprehensive error handling

## Features

### Enhanced Analysis Results

The AI system provides richer analysis results compared to rule-based analysis:

```typescript
interface AIAnalysisResult {
  requirement: string;      // The requirement being checked
  passed: boolean;         // Whether the requirement is met
  explanation: string;     // Human-readable explanation
  confidence: number;      // AI confidence score (0.0-1.0)
  evidence: string[];      // Specific quotes from content
  reasoning: string;       // Detailed reasoning process
}
```

### Intelligent Context Understanding

The AI system understands:
- **FTC compliance requirements** and disclosure rules
- **Instagram UI limitations** (above-the-fold content)
- **Social media context** and common patterns
- **Hashtag analysis** from extracted Instagram hashtags
- **Image context** from alt text descriptions
- **Implicit vs explicit compliance** indicators
- **Content timing** and placement requirements

### Structured Output Validation

Uses Zod schemas to ensure reliable JSON parsing:
- Type-safe response handling
- Automatic validation of AI responses
- Graceful handling of malformed outputs

## Configuration

### Environment Variables

```bash
# Required
OPENAI_API_KEY=your_openai_api_key

# Optional
OPENAI_MODEL=gpt-4o-mini                    # AI model to use
OPENAI_MAX_REQUESTS_PER_MINUTE=50          # Rate limiting
USE_AI_ANALYSIS=true                       # Default analysis mode
CACHE_MAX_SIZE=100                         # Cache size limit
CACHE_TTL_MINUTES=60                       # Cache expiration time
```

### Supported Models

- `gpt-4o-mini` (default) - Most cost-effective
- `gpt-4o` - Higher accuracy, more expensive
- `gpt-4-turbo` - Fast and accurate
- `gpt-3.5-turbo` - Budget option

## Usage

### API Request

```javascript
POST /api/analyze
{
  "postUrl": "https://instagram.com/p/example",
  "requirements": "Must include #ad hashtag\nMust mention discount above the fold",
  "useAI": true  // Optional, defaults to true
}
```

**Note**: The AI analysis now includes hashtags and alt text from the Instagram post data, providing richer context for compliance analysis.

### API Response

```javascript
{
  "success": true,
  "postData": {
    "caption": "...",
    "mediaType": "image",
    "mediaUrl": "..."
  },
  "analysis": {
    "results": [
      {
        "requirement": "Must include #ad hashtag",
        "passed": true,
        "explanation": "Found #ad hashtag in the caption",
        "confidence": 0.95,
        "evidence": ["#ad"],
        "reasoning": "The hashtag #ad is clearly present in the caption, meeting FTC disclosure requirements."
      }
    ],
    "overallScore": 85,
    "aiPowered": true,
    "processingTime": 1250,
    "model": "gpt-4o-mini"
  }
}
```

### Programmatic Usage

```typescript
import { analyzeContentWithAI } from '@/lib/ai-analysis-service';

const result = await analyzeContentWithAI(postData, requirements);
console.log(`Analysis complete: ${result.overallScore}% compliance`);
```

## Error Handling

### Automatic Fallbacks

1. **AI Service Unavailable**: Falls back to rule-based analysis
2. **Rate Limits**: Implements exponential backoff retry
3. **Invalid Responses**: Validates and retries malformed outputs
4. **Network Errors**: Automatic retry with timeout handling

### Error Types

- `OPENAI_API_KEY missing`: Configuration error
- `Rate limit exceeded`: Temporary throttling
- `Invalid model`: Configuration error
- `Timeout`: Network or processing timeout
- `Quota exceeded`: OpenAI account limits

## Performance & Cost Optimization

### Caching Strategy

- **Cache Key**: SHA-256 hash of content + requirements
- **TTL**: 60 minutes (configurable)
- **Eviction**: LRU when cache is full
- **Hit Rate**: Typically 30-50% for repeated analyses

### Cost Management

- **Model Selection**: gpt-4o-mini for cost efficiency
- **Token Optimization**: Structured prompts minimize token usage
- **Request Caching**: Eliminates duplicate API calls
- **Rate Limiting**: Prevents quota exhaustion

### Performance Metrics

- **Average Response Time**: 1-3 seconds
- **Cache Hit Response**: <100ms
- **Token Usage**: 500-1500 tokens per analysis
- **Cost**: ~$0.001-0.003 per analysis (gpt-4o-mini)

## Monitoring

### Cache Statistics

```bash
GET /api/cache-stats
```

Returns cache performance metrics:
```javascript
{
  "success": true,
  "cache": {
    "totalEntries": 45,
    "activeEntries": 42,
    "expiredEntries": 3,
    "maxSize": 100,
    "hitRate": 67,
    "utilizationRate": 45
  }
}
```

### Logging

The system logs:
- API request/response times
- Cache hit/miss events
- Error conditions and fallbacks
- Rate limiting events
- Cost-related metrics

## Testing

### Test Script

```bash
npm run test:ai
```

Runs comprehensive tests including:
- AI analysis functionality
- Cache performance
- Error handling
- Fallback mechanisms

### Manual Testing

1. Start development server: `npm run dev`
2. Navigate to the application
3. Test with various Instagram posts
4. Monitor console logs for debugging

## Troubleshooting

### Common Issues

1. **"OPENAI_API_KEY environment variable is required"**
   - Add API key to `.env.local`
   - Restart development server

2. **High response times**
   - Check OpenAI service status
   - Verify rate limiting configuration
   - Monitor cache hit rates

3. **Unexpected analysis results**
   - Review system prompts
   - Check model configuration
   - Verify input data quality

4. **Rate limit errors**
   - Reduce `OPENAI_MAX_REQUESTS_PER_MINUTE`
   - Upgrade OpenAI plan
   - Implement request queuing

### Debug Mode

Enable detailed logging:
```bash
DEBUG=instagram-checker:* npm run dev
```

## Best Practices

### Prompt Engineering

- Keep system prompts focused and specific
- Include relevant context about Instagram and FTC rules
- Use structured output formats
- Test prompts with edge cases

### Cost Optimization

- Use caching for repeated analyses
- Choose appropriate model for accuracy needs
- Monitor token usage and costs
- Implement request batching where possible

### Error Handling

- Always implement fallback mechanisms
- Log errors for debugging
- Provide meaningful error messages
- Handle rate limits gracefully

## Future Enhancements

### Planned Features

1. **Batch Analysis**: Analyze multiple posts simultaneously
2. **Custom Models**: Fine-tuned models for specific compliance types
3. **Real-time Monitoring**: Live dashboard for analysis metrics
4. **Advanced Caching**: Redis-based distributed caching
5. **A/B Testing**: Compare AI vs rule-based accuracy

### Integration Opportunities

- **Webhook Support**: Real-time analysis triggers
- **API Rate Limiting**: More sophisticated throttling
- **Multi-language Support**: Analysis in different languages
- **Custom Compliance Rules**: User-defined requirement templates

## Support

For issues or questions:
1. Check server logs for detailed error messages
2. Verify environment configuration
3. Test with known working examples
4. Monitor OpenAI API status and quotas

## Security Considerations

- **API Key Security**: Never expose keys in client-side code
- **Input Validation**: Sanitize all user inputs
- **Rate Limiting**: Prevent abuse and quota exhaustion
- **Error Handling**: Don't expose sensitive information in errors
- **Caching**: Ensure cached data doesn't contain sensitive information 