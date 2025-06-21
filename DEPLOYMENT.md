# Deployment Guide

This guide covers how to deploy the Instagram Content Compliance Checker to various platforms.

## Prerequisites

Before deploying, ensure you have:

1. **Required API Keys**:
   - OpenAI API Key (for AI analysis and video transcription)
   - Apify API Token (for Instagram data fetching)

2. **Built and tested locally**:
   ```bash
   npm install
   npm run build
   npm start
   ```

## Environment Variables

All deployments require these environment variables:

### Required
```bash
OPENAI_API_KEY=your_openai_api_key_here
APIFY_API_TOKEN=your_apify_api_token_here
```

### Optional
```bash
OPENAI_MODEL=gpt-4o-mini
OPENAI_MAX_REQUESTS_PER_MINUTE=50
VIDEO_PROXY_SERVICE_URL=https://your-proxy-service.com/download
USE_AI_ANALYSIS=true
```

## Platform-Specific Deployment

### Vercel (Recommended)

1. **Install Vercel CLI**:
   ```bash
   npm i -g vercel
   ```

2. **Deploy**:
   ```bash
   vercel --prod
   ```

3. **Set Environment Variables**:
   ```bash
   vercel env add OPENAI_API_KEY
   vercel env add APIFY_API_TOKEN
   ```

4. **Or use Vercel Dashboard**:
   - Go to your project settings
   - Add environment variables in the "Environment Variables" section
   - Redeploy the project

### Netlify

1. **Build Command**: `npm run build`
2. **Publish Directory**: `.next`
3. **Environment Variables**: Set in Netlify dashboard under "Site settings" > "Environment variables"

### Railway

1. **Connect your GitHub repository**
2. **Set environment variables** in the Railway dashboard
3. **Deploy automatically** on push to main branch

### Docker

1. **Create Dockerfile**:
   ```dockerfile
   FROM node:18-alpine

   WORKDIR /app
   COPY package*.json ./
   RUN npm ci --only=production

   COPY . .
   RUN npm run build

   EXPOSE 3000
   CMD ["npm", "start"]
   ```

2. **Build and run**:
   ```bash
   docker build -t instagram-checker .
   docker run -p 3000:3000 \
     -e OPENAI_API_KEY=your_key \
     -e APIFY_API_TOKEN=your_token \
     instagram-checker
   ```

### AWS (EC2/ECS)

1. **Build the application**:
   ```bash
   npm run build
   ```

2. **Set environment variables** in your AWS service configuration

3. **Use PM2 for process management** (EC2):
   ```bash
   npm install -g pm2
   pm2 start npm --name "instagram-checker" -- start
   ```

## Environment Variable Security

### Production Security Checklist

- [ ] Use different API keys for development and production
- [ ] Enable API key restrictions where possible (OpenAI, Apify)
- [ ] Set up monitoring for API usage and costs
- [ ] Use secrets management (AWS Secrets Manager, etc.) for sensitive values
- [ ] Enable HTTPS/SSL certificates
- [ ] Set up proper CORS policies if needed

### Vercel Security
```bash
# Set environment variables for production only
vercel env add OPENAI_API_KEY production
vercel env add APIFY_API_TOKEN production
```

## Performance Optimization

### Next.js Configuration

Update `next.config.ts` for production:

```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable compression
  compress: true,
  
  // Optimize images
  images: {
    domains: ['instagram.com', 'cdninstagram.com'],
    formats: ['image/webp', 'image/avif'],
  },
  
  // Enable experimental features for better performance
  experimental: {
    optimizeCss: true,
  },
  
  // Headers for security and caching
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
```

### Caching Strategy

The app includes built-in caching for:
- Analysis results (reduces API calls)
- Instagram post data
- AI analysis responses

Cache is automatically managed and doesn't require additional configuration.

## Monitoring and Logging

### Health Check Endpoint

The app includes API routes that can be used for health checks:
- `GET /api/cache-stats` - Returns cache statistics
- `POST /api/analyze` - Main analysis endpoint

### Recommended Monitoring

1. **API Usage Monitoring**:
   - OpenAI API usage and costs
   - Apify API usage and credits
   - Response times and error rates

2. **Application Monitoring**:
   - Server response times
   - Memory usage
   - Error tracking (Sentry, etc.)

3. **Log Management**:
   - Centralized logging (LogRocket, DataDog, etc.)
   - Error alerting
   - Performance monitoring

## Scaling Considerations

### Rate Limiting

The app includes built-in rate limiting for OpenAI API calls. For high-traffic deployments:

1. **Increase OpenAI rate limits** by upgrading your plan
2. **Implement request queuing** for burst traffic
3. **Use multiple API keys** with load balancing
4. **Cache results aggressively** to reduce API calls

### Database Integration

For production deployments with high traffic, consider adding a database for:
- Persistent caching
- User management
- Analytics and usage tracking
- Audit logs

### CDN and Static Assets

Use a CDN for better performance:
- Vercel includes CDN automatically
- For other platforms, use CloudFlare, AWS CloudFront, etc.

## Troubleshooting Deployment Issues

### Common Issues

1. **500 Internal Server Error**:
   - Check environment variables are set correctly
   - Verify API keys are valid and have sufficient credits
   - Check server logs for specific error details

2. **Build Failures**:
   - Ensure all dependencies are installed: `npm ci`
   - Check TypeScript errors: `npm run lint`
   - Verify Node.js version compatibility (18+)

3. **API Timeouts**:
   - Increase timeout values in your platform configuration
   - Consider implementing request queuing
   - Monitor API rate limits

4. **Memory Issues**:
   - Video transcription can use significant memory
   - Increase memory allocation in your deployment platform
   - Consider using streaming for large video files

### Debug Mode

For deployment debugging, set these environment variables:
```bash
NODE_ENV=production
DEBUG=instagram-checker:*
```

## Cost Optimization

### API Usage Optimization

1. **Enable caching** to reduce repeat API calls
2. **Set appropriate rate limits** to avoid overage charges
3. **Monitor usage** regularly through API dashboards
4. **Use cheaper models** when appropriate (gpt-4o-mini vs gpt-4o)

### Infrastructure Costs

1. **Use serverless platforms** (Vercel, Netlify) for automatic scaling
2. **Implement proper caching** to reduce compute time
3. **Monitor resource usage** and optimize accordingly

## Security Best Practices

1. **API Key Management**:
   - Never commit API keys to version control
   - Use environment variables or secrets management
   - Rotate keys regularly

2. **Input Validation**:
   - The app validates Instagram URLs
   - Implement rate limiting for user requests
   - Sanitize user inputs

3. **HTTPS/SSL**:
   - Always use HTTPS in production
   - Most platforms (Vercel, Netlify) provide SSL automatically

4. **Content Security Policy**:
   - Implement CSP headers for XSS protection
   - Whitelist trusted domains only

## Support and Maintenance

### Regular Maintenance Tasks

1. **Update dependencies** regularly: `npm audit fix`
2. **Monitor API usage** and costs
3. **Check error logs** for issues
4. **Test functionality** after updates
5. **Backup configuration** and environment variables

### Getting Help

If you encounter deployment issues:
1. Check the server logs first
2. Verify all environment variables are set
3. Test locally with the same configuration
4. Check API service status (OpenAI, Apify)
5. Review platform-specific documentation 