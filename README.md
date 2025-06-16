# Instagram Content Compliance Checker

A full-stack Next.js application that analyzes Instagram posts and stories against custom compliance requirements, similar to cheerful.ai/youtube-checker but for Instagram content.

## Features

- **URL Analysis**: Input any Instagram post or story URL for analysis
- **Custom Requirements**: Define your own compliance requirements (one per line)
- **Intelligent Analysis**: Automatically detects and analyzes:
  - Hashtag placement and presence
  - "Above the fold" content (first 150 characters)
  - Audio/transcript content analysis
  - Caption and description text analysis
  - Time-based requirements (e.g., "first 10 seconds")
- **Visual Results**: Clean, color-coded results with pass/fail indicators
- **Overall Scoring**: Percentage-based compliance scoring
- **Responsive Design**: Works on desktop and mobile devices
- **Dark Mode Support**: Automatic dark/light mode switching

## Tech Stack

- **Framework**: Next.js 15 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **UI Components**: shadcn/ui
- **Icons**: Lucide React

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd instagram-checker
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
   - Create a `.env.local` file in the root directory
   - Add your Apify API key:
   ```
   APIFY_API_KEY=your_apify_api_key_here
   ```
   - Get your API key from [Apify Console](https://console.apify.com/account/integrations)

4. Run the development server:
```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Usage

1. **Enter Instagram URL**: Paste any Instagram post or story URL
2. **Define Requirements**: Enter your compliance requirements, one per line. Examples:
   - `#ad hashtag should appear above the fold`
   - `Mentions discount code in the first 10 seconds`
   - `Caption contains product name`
   - `Says "sponsored" in the audio`
3. **Analyze**: Click the "Analyze Content" button
4. **Review Results**: View detailed pass/fail results with explanations

## Example Requirements

The system understands various types of requirements:

### Hashtag Requirements
- `#ad hashtag should appear above the fold`
- `Contains #sponsored hashtag`
- `#fitness hashtag in caption`

### Position-Based Requirements
- `Discount code mentioned above the fold`
- `Product name appears in the beginning`

### Audio/Transcript Requirements
- `Mentions "sponsored" in the audio`
- `Says discount code in the first 10 seconds`
- `Audio mentions product benefits`

### General Content Requirements
- `Caption contains product name`
- `Description includes call to action`
- `Text mentions price`

## Architecture

### Frontend (`src/app/page.tsx`)
- React component with form handling
- State management for loading, results, and errors
- Responsive UI with shadcn/ui components

### Backend API (`src/app/api/analyze/route.ts`)
- RESTful API endpoint handling POST requests
- Input validation and error handling
- Integration with analysis services

### Services
- **Instagram Service** (`src/lib/instagram-service.ts`): Mock data provider (ready for real implementation)
- **Analysis Service** (`src/lib/analysis-service.ts`): Content analysis engine

## Real Instagram Scraping with Apify

The application now uses the **Apify Instagram Scraper** for real Instagram data fetching:

### Features:
- **Real Instagram Post Scraping**: Fetches actual post data from Instagram
- **Automatic Fallback**: Falls back to mock data if API key is missing or API fails
- **Smart URL Validation**: Validates Instagram post and reel URLs
- **Error Handling**: Provides specific error messages for different failure scenarios
- **Rate Limiting Aware**: Handles Apify API quotas and timeouts

### Apify Integration:
- Uses `apify/instagram-scraper` actor
- Supports both posts (`/p/`) and reels (`/reel/`) URLs
- Extracts captions, media URLs, hashtags, and metadata
- Generates intelligent mock transcripts based on caption content

### Limitations:
- **Video Transcription**: Still uses mock transcripts (real implementation would need speech-to-text)
- **Private Posts**: Cannot access private Instagram content
- **API Costs**: Requires Apify credits (approximately $1.50 per 1,000 results)
- **Rate Limits**: Subject to Instagram's anti-bot measures

## API Endpoints

### POST `/api/analyze`

Analyzes Instagram content against requirements.

**Request Body:**
```json
{
  "postUrl": "https://www.instagram.com/p/...",
  "requirements": "requirement 1\nrequirement 2\n..."
}
```

**Response:**
```json
{
  "success": true,
  "postData": {
    "caption": "...",
    "mediaType": "video",
    "mediaUrl": "..."
  },
  "analysis": {
    "results": [
      {
        "requirement": "...",
        "passed": true,
        "explanation": "..."
      }
    ],
    "overallScore": 85
  }
}
```

## Development

### Project Structure
```
src/
├── app/
│   ├── api/analyze/route.ts    # API endpoint
│   ├── layout.tsx              # Root layout
│   └── page.tsx                # Main page component
├── components/ui/              # shadcn/ui components
└── lib/
    ├── analysis-service.ts     # Content analysis logic
    ├── instagram-service.ts    # Instagram data fetching
    └── utils.ts               # Utility functions
```

### Adding New Analysis Types

1. Update the `checkRequirement` function in `analysis-service.ts`
2. Add new keyword detection logic
3. Implement specific analysis functions
4. Update the mock data if needed for testing

### Enhancing the Apify Integration

To further improve the Instagram scraping:

1. **Add Speech-to-Text**: Integrate services like OpenAI Whisper, Google Speech-to-Text, or AWS Transcribe
2. **Implement Caching**: Cache results to reduce API calls and costs
3. **Add Retry Logic**: Implement exponential backoff for failed requests
4. **Batch Processing**: Support multiple URLs in a single request
5. **Enhanced Error Handling**: More granular error messages and recovery strategies

## Building for Production

```bash
npm run build
npm start
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is for educational and demonstration purposes. Please ensure compliance with Instagram's Terms of Service when implementing real data fetching.

## Limitations

- Video transcription is still mocked (requires speech-to-text integration)
- Does not handle private Instagram posts
- Requires Apify API credits for real scraping
- Subject to Instagram's rate limiting and anti-bot measures
- No user authentication system
- No caching mechanism (each analysis makes fresh API calls)

## Future Enhancements

- [ ] Real video transcription with speech-to-text services
- [ ] User authentication and saved analyses
- [ ] Bulk analysis capabilities
- [ ] Advanced AI-powered content analysis
- [ ] Export results to PDF/CSV
- [ ] Team collaboration features
- [ ] Custom requirement templates
- [ ] Integration with compliance management systems
- [ ] Caching layer to reduce API costs
- [ ] Support for Instagram Stories analysis
- [ ] Real-time monitoring and alerts
