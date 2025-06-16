import { ApifyClient } from 'apify-client';

export interface InstagramPostData {
  caption: string;
  mediaType: 'video' | 'image';
  mediaUrl: string;
  transcript: string;
}

interface ApifyInstagramResult {
  caption?: string;
  type?: string;
  url?: string;
  videoUrl?: string;
  imageUrl?: string;
  displayUrl?: string;
  shortCode?: string;
  timestamp?: string;
  likesCount?: number;
  commentsCount?: number;
  videoViewCount?: number;
  videoPlayCount?: number;
  ownerUsername?: string;
  ownerFullName?: string;
  locationName?: string;
  hashtags?: string[];
  mentions?: string[];
}

/**
 * Instagram data fetching service using Apify API
 * 
 * This service uses the Apify Instagram Scraper to fetch real Instagram post data.
 * It requires an APIFY_API_KEY environment variable to be set.
 * 
 * Features:
 * - Real Instagram post scraping
 * - Handles both posts and reels
 * - Extracts captions, media URLs, and metadata
 * - Generates mock transcripts for videos (real transcription would require additional services)
 * 
 * Limitations:
 * - Requires valid Apify API key and credits
 * - Subject to Instagram's rate limiting and anti-bot measures
 * - Video transcription is still mocked (would need speech-to-text integration)
 * - May not work with private posts
 */
export async function getInstagramPostData(url: string): Promise<InstagramPostData> {
  // Validate Instagram URL
  if (!isValidInstagramUrl(url)) {
    throw new Error('Invalid Instagram URL provided. Please provide a valid Instagram post or reel URL.');
  }

  // Check for API key
  const apiKey = process.env.APIFY_API_KEY;
  if (!apiKey) {
    console.warn('APIFY_API_KEY not found, falling back to mock data');
    return getMockData();
  }

  try {
    // Initialize Apify client
    const client = new ApifyClient({ token: apiKey });

    // Prepare input for Instagram scraper
    const input = {
      directUrls: [url],
      resultsType: 'posts',
      resultsLimit: 1,
      addParentData: false,
    };

    console.log('Fetching Instagram data from Apify...');

    // Run the Instagram scraper
    const run = await client.actor('apify/instagram-scraper').call(input, {
      timeout: 60000, // 60 seconds timeout
    });

    // Get the results from the dataset
    const { items } = await client.dataset(run.defaultDatasetId).listItems();

    if (!items || items.length === 0) {
      throw new Error('No data found for the provided Instagram URL. The post might be private or the URL might be invalid.');
    }

    const postData = items[0] as ApifyInstagramResult;
    
    // Transform Apify data to our format
    return transformApifyData(postData);

  } catch (error) {
    console.error('Error fetching Instagram data:', error);
    
    // If it's an API-related error, provide specific feedback
    if (error instanceof Error) {
      if (error.message.includes('timeout')) {
        throw new Error('Request timed out. The Instagram post might be taking too long to scrape. Please try again.');
      }
      if (error.message.includes('credits') || error.message.includes('quota')) {
        throw new Error('Apify API quota exceeded. Please check your Apify account credits.');
      }
      if (error.message.includes('unauthorized') || error.message.includes('token')) {
        throw new Error('Invalid Apify API key. Please check your APIFY_API_KEY environment variable.');
      }
    }
    
    // For development/testing, fall back to mock data if API fails
    console.warn('Falling back to mock data due to API error');
    return getMockData();
  }
}

function isValidInstagramUrl(url: string): boolean {
  const instagramUrlPattern = /^https?:\/\/(www\.)?instagram\.com\/(p|reel)\/[A-Za-z0-9_-]+\/?/;
  return instagramUrlPattern.test(url);
}

function transformApifyData(data: ApifyInstagramResult): InstagramPostData {
  // Determine media type
  const mediaType: 'video' | 'image' = data.type === 'Video' || data.videoUrl ? 'video' : 'image';
  
  // Get media URL
  let mediaUrl = '';
  if (mediaType === 'video') {
    mediaUrl = data.videoUrl || data.displayUrl || data.url || '';
  } else {
    mediaUrl = data.imageUrl || data.displayUrl || data.url || '';
  }

  // Extract caption
  const caption = data.caption || '';

  // Generate mock transcript for videos
  // In a real implementation, you would use a speech-to-text service like:
  // - Google Cloud Speech-to-Text
  // - AWS Transcribe
  // - Azure Speech Services
  // - OpenAI Whisper API
  const transcript = mediaType === 'video' ? generateMockTranscript(caption, data) : '';

  return {
    caption,
    mediaType,
    mediaUrl,
    transcript,
  };
}

function generateMockTranscript(caption: string, data: ApifyInstagramResult): string {
  // This is a mock transcript generator
  // In production, you would extract audio from the video and use speech-to-text
  
  const baseTranscript = `Hey everyone! Welcome back to my page. `;
  
  // Extract key information from caption to create a realistic transcript
  const hashtags = data.hashtags || [];
  
  let transcript = baseTranscript;
  
  // Add content based on caption
  if (caption) {
    const words = caption.toLowerCase();
    
    if (words.includes('new') || words.includes('just')) {
      transcript += `I'm so excited to share something new with you today. `;
    }
    
    if (words.includes('product') || words.includes('brand')) {
      transcript += `I've been working with an amazing brand and I can't wait to tell you about it. `;
    }
    
    if (words.includes('discount') || words.includes('code') || words.includes('save')) {
      transcript += `And I have a special discount code for you guys! `;
    }
    
    if (words.includes('link in bio') || words.includes('link')) {
      transcript += `Make sure to check the link in my bio for more information. `;
    }
    
    // Add hashtag-based content
    if (hashtags.includes('ad') || hashtags.includes('sponsored')) {
      transcript += `This is a sponsored post, but as always, all opinions are my own. `;
    }
    
    if (hashtags.includes('fitness') || hashtags.includes('workout')) {
      transcript += `This is perfect for my fitness routine and I think you'll love it too. `;
    }
  }
  
  transcript += `Let me know what you think in the comments below!`;
  
  return transcript;
}

function getMockData(): InstagramPostData {
  // Fallback mock data for development/testing
  return {
    caption: `🔥 Just tried the new Sneak Eats protein bars and they're incredible! The chocolate chip flavor is my absolute favorite. Perfect for post-workout fuel! 💪 

Use my code SAVE20 for 20% off your first order. Link in bio! 

What's your go-to post-workout snack? Let me know in the comments! 👇

#ad #sneakeats #proteinbar #fitness #postworkout #healthyeating #sponsored #fitnessmotivation #nutrition #gains`,
    
    mediaType: 'video',
    mediaUrl: 'https://example.com/sample-video.mp4',
    
    transcript: `Hey everyone, welcome back to my channel! Today I'm super excited to share with you guys these amazing new protein bars from Sneak Eats. I've been testing them out for the past two weeks and honestly, they are incredible. The chocolate chip flavor is absolutely my favorite - it tastes like a dessert but it's actually packed with 20 grams of protein. Perfect for after my workouts. I've been having one right after I hit the gym and it keeps me satisfied for hours. The texture is so good too, not chalky at all like some other protein bars I've tried. If you guys want to try them out, I have a special discount code for you - it's SAVE20 and it'll get you 20% off your first order. The link is in my bio. Seriously, these are game changers for anyone who's into fitness or just wants a healthy snack option. Let me know in the comments what your favorite post-workout snack is!`
  };
} 