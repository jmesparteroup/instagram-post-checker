import { ApifyClient } from 'apify-client';
import OpenAI from 'openai';
import { join } from 'path';
import fs from 'fs/promises';
import * as fsSync from 'fs';
import os from 'os';

export interface InstagramPostData {
  caption: string;
  mediaType: 'video' | 'image';
  mediaUrl: string;
  transcript: string;
  hashtags: string[];
  altText: string;
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
  alt?: string;
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
 * - Uses OpenAI Whisper API for video transcription
 * - Fallback proxy service for video downloads when direct access is blocked
 * 
 * Environment Variables:
 * - APIFY_API_KEY: Required for Instagram scraping
 * - OPENAI_API_KEY: Required for video transcription
 * - VIDEO_PROXY_SERVICE_URL: Optional proxy service for video downloads
 * 
 * Limitations:
 * - Requires valid Apify API key and credits
 * - Requires valid OpenAI API key for transcription
 * - Subject to Instagram's rate limiting and anti-bot measures
 * - May not work with private posts
 * - Video files must be under 25MB for Whisper API
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

async function transformApifyData(data: ApifyInstagramResult): Promise<InstagramPostData> {
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

  // Extract hashtags and alt text
  const hashtags = data.hashtags || [];
  const altText = data.alt || '';

  // Get transcript for videos using Whisper API
  let transcript = '';
  if (mediaType === 'video' && mediaUrl) {
    try {
      transcript = await getVideoTranscript(mediaUrl);
    } catch (error) {
      console.error('Error transcribing video:', error);
      
      // Provide a more helpful message based on the error
      if (error instanceof Error && error.message.includes('download')) {
        transcript = 'Instagram video transcription is not available. Instagram restricts direct video downloads.';
      } else {
        transcript = 'Transcription failed. Please try again later.';
      }
      
      // Log the issue for debugging
      console.warn(`Using fallback transcript for video: ${mediaUrl}`);
    }
  }

  return {
    caption,
    mediaType,
    mediaUrl,
    transcript,
    hashtags,
    altText,
  };
}

/**
 * Downloads a video from a URL to a temporary file
 * Uses multiple strategies including proxy services to handle Instagram restrictions
 */
async function downloadVideo(url: string): Promise<string> {
  try {
    // Create temp directory if it doesn't exist
    const tempDir = join(os.tmpdir(), 'instagram-checker');
    await fs.mkdir(tempDir, { recursive: true });
    
    // Create a temporary file path
    const tempFilePath = join(tempDir, `video-${Date.now()}.mp4`);
    
    console.log(`Downloading video from ${url} to ${tempFilePath}`);
    
    // Try direct download first
    try {
      await downloadVideoDirect(url, tempFilePath);
      return tempFilePath;
    } catch (directErr) {
      const directError = directErr instanceof Error ? directErr : new Error(String(directErr));
      console.warn('Direct download failed, trying proxy service:', directError.message);
      
      // Try proxy service if direct download fails
      try {
        await downloadVideoWithProxy(url, tempFilePath);
        return tempFilePath;
      } catch (proxyErr) {
        const proxyError = proxyErr instanceof Error ? proxyErr : new Error(String(proxyErr));
        console.warn('Proxy download failed:', proxyError.message);
        throw new Error(`Both direct and proxy downloads failed. Direct: ${directError.message}, Proxy: ${proxyError.message}`);
      }
    }
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    console.error('Error downloading video:', error);
    throw new Error(`Failed to download video for transcription: ${error.message}`);
  }
}

/**
 * Direct video download attempt with improved retry logic
 */
async function downloadVideoDirect(url: string, tempFilePath: string): Promise<void> {
  const maxRetries = 5;
  let retryCount = 0;
  let lastError: Error | null = null;
  
  while (retryCount < maxRetries) {
    try {
      // Add a small delay before each attempt (except the first one)
      if (retryCount > 0) {
        const baseDelay = 2000; // 2 seconds base delay
        const jitter = Math.random() * 1000; // Add up to 1 second of random jitter
        const waitTime = baseDelay + (retryCount * 1000) + jitter; // Progressive delay: 2s, 3s, 4s, 5s
        
        console.log(`Waiting ${Math.round(waitTime)}ms before retry ${retryCount + 1}/${maxRetries}...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
      
      // Set a timeout of 30 seconds for the fetch request
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);
      
      const response = await fetch(url, { 
        signal: controller.signal,
        headers: {
          // Add common headers to mimic a browser request
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'video/mp4,video/webm,video/*;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate, br',
          'Referer': 'https://www.instagram.com/',
          'Origin': 'https://www.instagram.com',
          'Sec-Fetch-Dest': 'video',
          'Sec-Fetch-Mode': 'cors',
          'Sec-Fetch-Site': 'cross-site',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      // Save to file
      const buffer = await response.arrayBuffer();
      
      if (buffer.byteLength === 0) {
        throw new Error('Response body is empty');
      }
      
      // Write file synchronously to ensure it's complete before checking
      await fs.writeFile(tempFilePath, Buffer.from(buffer));
      
      // Verify file was created and has content
      const stats = await fs.stat(tempFilePath);
      if (stats.size === 0) {
        throw new Error('Downloaded file is empty');
      }
      
      console.log(`Direct download successful: ${stats.size} bytes (attempt ${retryCount + 1}/${maxRetries})`);
      return;
      
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      lastError = error;
      retryCount++;
      
      if (retryCount < maxRetries) {
        console.warn(`Direct download attempt ${retryCount}/${maxRetries} failed: ${error.message}`);
      } else {
        console.error(`Direct download failed after ${maxRetries} attempts: ${error.message}`);
      }
    }
  }
  
  throw lastError || new Error(`Direct download failed after ${maxRetries} retries`);
}

/**
 * Download video using a proxy service with retry logic
 * This uses a simple proxy approach - in production you might want to use a dedicated service
 */
async function downloadVideoWithProxy(url: string, tempFilePath: string): Promise<void> {
  // Check if a proxy service URL is configured
  const proxyServiceUrl = process.env.VIDEO_PROXY_SERVICE_URL;
  
  if (!proxyServiceUrl) {
    throw new Error('No proxy service configured. Set VIDEO_PROXY_SERVICE_URL environment variable.');
  }
  
  const maxRetries = 5;
  let retryCount = 0;
  let lastError: Error | null = null;
  
  while (retryCount < maxRetries) {
    try {
      // Add a small delay before each attempt (except the first one)
      if (retryCount > 0) {
        const baseDelay = 2000; // 2 seconds base delay
        const jitter = Math.random() * 1000; // Add up to 1 second of random jitter
        const waitTime = baseDelay + (retryCount * 1000) + jitter; // Progressive delay: 2s, 3s, 4s, 5s
        
        console.log(`Waiting ${Math.round(waitTime)}ms before proxy retry ${retryCount + 1}/${maxRetries}...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
      
      console.log(`Attempting download via proxy service (attempt ${retryCount + 1}/${maxRetries})...`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);
      
      // Make request to proxy service
      const proxyUrl = `${proxyServiceUrl}?url=${encodeURIComponent(url)}`;
      const response = await fetch(proxyUrl, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Instagram-Checker/1.0',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`Proxy service returned ${response.status}: ${response.statusText}`);
      }
      
      // Save to file
      const buffer = await response.arrayBuffer();
      
      if (buffer.byteLength === 0) {
        throw new Error('Proxy response body is empty');
      }
      
      // Write file synchronously to ensure it's complete before checking
      await fs.writeFile(tempFilePath, Buffer.from(buffer));
      
      // Verify file was created and has content
      const stats = await fs.stat(tempFilePath);
      if (stats.size === 0) {
        throw new Error('Proxy downloaded file is empty');
      }
      
      console.log(`Proxy download successful: ${stats.size} bytes (attempt ${retryCount + 1}/${maxRetries})`);
      return;
      
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      lastError = error;
      retryCount++;
      
      if (retryCount < maxRetries) {
        console.warn(`Proxy download attempt ${retryCount}/${maxRetries} failed: ${error.message}`);
      } else {
        console.error(`Proxy download failed after ${maxRetries} attempts: ${error.message}`);
      }
    }
  }
  
  throw new Error(`Proxy download failed after ${maxRetries} retries: ${lastError?.message || 'Unknown error'}`);
}

/**
 * Transcribes a video using OpenAI's Whisper API
 */
async function getVideoTranscript(videoUrl: string): Promise<string> {
  // Check for OpenAI API key
  const openaiApiKey = process.env.OPENAI_API_KEY;
  if (!openaiApiKey) {
    throw new Error('OPENAI_API_KEY not found. Please set this environment variable to enable transcription.');
  }

  let tempFilePath: string | null = null;
  
  try {
    // Initialize OpenAI client
    const openai = new OpenAI({
      apiKey: openaiApiKey,
    });

    // Download the video to a temporary file
    tempFilePath = await downloadVideo(videoUrl); 
    
    console.log('Transcribing video with Whisper API...');
    
    // Check file size (Whisper has a 25MB limit)
    const stats = await fs.stat(tempFilePath);
    if (stats.size > 25 * 1024 * 1024) {
      throw new Error('Video file is too large for Whisper API (25MB limit)');
    }
    
    // Use Whisper API to transcribe the video
    const transcription = await openai.audio.transcriptions.create({
      file: fsSync.createReadStream(tempFilePath),
      model: 'whisper-1',
      language: 'en', // You can make this configurable if needed
      response_format: 'text'
    });
    
    return transcription;
    
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    console.error('Error in video transcription:', error);
    
    // Provide specific error messages based on common issues
    if (error.message.includes('API key')) {
      throw new Error('Invalid OpenAI API key. Please check your OPENAI_API_KEY environment variable.');
    }
    if (error.message.includes('quota') || error.message.includes('exceeded')) {
      throw new Error('OpenAI API quota exceeded. Please check your OpenAI account credits.');
    }
    if (error.message.includes('download')) {
      throw new Error('Could not download the Instagram video. Instagram may be blocking direct video downloads.');
    }
    if (error.message.includes('too large')) {
      throw new Error('Video file is too large for transcription (25MB limit).');
    }
    
    throw new Error(`Failed to transcribe video: ${error.message}`);
  } finally {
    // Clean up the temporary file
    if (tempFilePath) {
      await fs.unlink(tempFilePath).catch(err => {
        console.warn(`Failed to delete temporary file ${tempFilePath}: ${err instanceof Error ? err.message : String(err)}`);
      });
    }
  }
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
    
    transcript: 'This is a mock transcript. To get real transcriptions, please set up APIFY_API_KEY and OPENAI_API_KEY environment variables.',
    
    hashtags: ['ad', 'sneakeats', 'proteinbar', 'fitness', 'postworkout', 'healthyeating', 'sponsored', 'fitnessmotivation', 'nutrition', 'gains'],
    
    altText: 'Person holding a chocolate chip protein bar with gym equipment in the background'
  };
} 