# Environment Setup Guide

This guide explains how to configure environment variables for the Instagram Checker with AI-powered analysis.

## Required Environment Variables

Create a `.env.local` file in the root directory of the project with the following variables:

### OpenAI Configuration (Required for AI Analysis)

```bash
# OpenAI API Key - Required for AI-powered content analysis
# Get your API key from: https://platform.openai.com/api-keys
OPENAI_API_KEY=your_openai_api_key_here
```

### Apify Configuration (Required for Instagram Data)

```bash
# Apify API Key - Required for Instagram post data fetching
# Get your API key from: https://console.apify.com/account/integrations
APIFY_API_KEY=your_apify_api_key_here
```

## Optional Configuration

### AI Analysis Settings

```bash
# Default AI analysis mode (default: true)
# Set to 'false' to use rule-based analysis by default
USE_AI_ANALYSIS=true

# OpenAI Model Selection (default: gpt-4o-mini)
# Available models: gpt-4o-mini, gpt-4o, gpt-4-turbo, gpt-3.5-turbo
OPENAI_MODEL=gpt-4o-mini

# Rate Limiting (default: 50)
# Maximum OpenAI API requests per minute
OPENAI_MAX_REQUESTS_PER_MINUTE=50
```

## Example .env.local File

```bash
# Instagram Checker Environment Variables

# OpenAI Configuration
OPENAI_API_KEY=sk-proj-abcd1234...your-actual-key-here

# Apify Configuration  
APIFY_API_KEY=apify_api_abcd1234...your-actual-key-here

# Optional: AI Configuration
USE_AI_ANALYSIS=true
OPENAI_MODEL=gpt-4o-mini
OPENAI_MAX_REQUESTS_PER_MINUTE=50
```

## Getting API Keys

### OpenAI API Key

1. Visit [OpenAI Platform](https://platform.openai.com/api-keys)
2. Sign in or create an account
3. Navigate to "API Keys" section
4. Click "Create new secret key"
5. Copy the key and add it to your `.env.local` file

**Note**: OpenAI API usage is paid. Check their [pricing page](https://openai.com/pricing) for current rates.

### Apify API Key

1. Visit [Apify Console](https://console.apify.com/account/integrations)
2. Sign in or create an account
3. Navigate to "Integrations" section
4. Find your API token or create a new one
5. Copy the token and add it to your `.env.local` file

**Note**: Apify provides free credits for new accounts. Check their [pricing page](https://apify.com/pricing) for current rates.

## Security Notes

- **Never commit `.env.local` to version control**
- The `.env.local` file is already included in `.gitignore`
- Keep your API keys secure and rotate them regularly
- Use different API keys for development and production environments

## Fallback Behavior

The application is designed to gracefully handle missing or invalid API keys:

1. **Missing OpenAI API Key**: Falls back to rule-based analysis
2. **Missing Apify API Key**: Falls back to mock Instagram data
3. **API Errors**: Automatic retry with exponential backoff
4. **Rate Limits**: Automatic throttling and queuing

## Testing Your Setup

After setting up your environment variables:

1. Start the development server: `npm run dev`
2. Navigate to `http://localhost:3000`
3. Try analyzing an Instagram post
4. Check the browser console and server logs for any API-related errors

## Troubleshooting

### Common Issues

1. **"OPENAI_API_KEY environment variable is required"**
   - Ensure your `.env.local` file exists in the project root
   - Verify the API key is correctly formatted
   - Restart your development server after adding the key

2. **"Invalid Apify API key"**
   - Check that your Apify API key is active
   - Verify you have sufficient credits in your Apify account

3. **Rate limit errors**
   - Reduce the `OPENAI_MAX_REQUESTS_PER_MINUTE` value
   - Consider upgrading your OpenAI plan for higher rate limits

4. **AI analysis not working**
   - Check your OpenAI account has sufficient credits
   - Verify the model name is correct (default: gpt-4o-mini)
   - Check server logs for detailed error messages

### Debug Mode

To enable detailed logging, add this to your `.env.local`:

```bash
# Enable debug logging
DEBUG=instagram-checker:*
NODE_ENV=development
```

## Cost Optimization

### OpenAI Usage

- **gpt-4o-mini** is the most cost-effective model for this use case
- Each analysis typically uses 500-1500 tokens
- Consider implementing request caching for repeated analyses
- Monitor usage in your OpenAI dashboard

### Apify Usage

- Each Instagram post fetch consumes Apify credits
- Consider caching post data for repeated analyses
- Monitor usage in your Apify console

## Production Deployment

For production environments:

1. Use environment variables instead of `.env.local`
2. Set up proper monitoring and alerting
3. Implement request caching to reduce API costs
4. Consider using API key rotation
5. Set up proper error tracking (e.g., Sentry)

## Support

If you encounter issues with the environment setup:

1. Check the server logs for detailed error messages
2. Verify your API keys are valid and have sufficient credits
3. Ensure your `.env.local` file is in the correct location
4. Try the fallback modes to isolate the issue 