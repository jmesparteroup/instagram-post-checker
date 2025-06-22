import { ApifyClient } from 'apify-client';
import { join } from 'path';
import fs from 'fs/promises';
import os from 'os';

export interface WhisperWord {
  word: string;
  start: number;
  end: number;
}

export interface WhisperSegment {
  text: string;
  start: number;
  end: number;
  words?: WhisperWord[];
}

export interface WhisperTranscription {
  text: string;
  segments: WhisperSegment[];
  words?: WhisperWord[];
}

export interface InstagramPostData {
  caption: string;
  mediaType: 'video' | 'image';
  mediaUrl: string;
  transcript: string;
  timestampedTranscript?: WhisperTranscription;
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
 * Instagram data fetching service with progress callback support
 */
export async function getInstagramPostDataWithProgress(
  url: string,
  onProgress: (message: string, progress: number) => void
): Promise<InstagramPostData> {
  // Validate Instagram URL
  onProgress('Validating Instagram URL...', 0);
  if (!isValidInstagramUrl(url)) {
    throw new Error('Invalid Instagram URL provided. Please provide a valid Instagram post or reel URL.');
  }

  // Check for API key
  const apiKey = process.env.APIFY_API_KEY;
  if (!apiKey) {
    console.warn('APIFY_API_KEY not found, falling back to mock data');
    onProgress('Using mock data (no API key found)...', 50);
    await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate delay
    onProgress('Mock data loaded', 100);
    return getMockData();
  }

  try {
    // Initialize Apify client
    onProgress('Initializing Instagram scraper...', 10);
    const client = new ApifyClient({ token: apiKey });

    // Prepare input for Instagram scraper
    const input = {
      directUrls: [url],
      resultsType: 'posts',
      resultsLimit: 1,
      addParentData: false,
    };

    onProgress('Starting Instagram data extraction...', 20);
    console.log('Fetching Instagram data from Apify...');

    // Run the Instagram scraper
    const run = await client.actor('apify/instagram-scraper').call(input, {
      timeout: 60000, // 60 seconds timeout
    });

    onProgress('Retrieving scraped data...', 60);

    // Get the results from the dataset
    const { items } = await client.dataset(run.defaultDatasetId).listItems();

    if (!items || items.length === 0) {
      throw new Error('No data found for the provided Instagram URL. The post might be private or the URL might be invalid.');
    }

    const postData = items[0] as ApifyInstagramResult;
    
    onProgress('Processing Instagram data...', 80);
    
    // Transform Apify data to our format with progress callback
    return await transformApifyDataWithProgress(postData, onProgress);

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
    onProgress('API error, using mock data...', 50);
    await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate delay
    onProgress('Mock data loaded', 100);
    return getMockData();
  }
}

function isValidInstagramUrl(url: string): boolean {
  const instagramUrlPattern = /^https?:\/\/(www\.)?instagram\.com\/(p|reel)\/[A-Za-z0-9_-]+\/?/;
  return instagramUrlPattern.test(url);
}

async function transformApifyDataWithProgress(
  data: ApifyInstagramResult,
  onProgress: (message: string, progress: number) => void
): Promise<InstagramPostData> {
  // Determine media type
  const mediaType: 'video' | 'image' = data.type === 'Video' || data.videoUrl ? 'video' : 'image';
  
  onProgress(`Processing ${mediaType} content...`, 85);
  
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
  let timestampedTranscript: WhisperTranscription | undefined;
  if (mediaType === 'video' && mediaUrl) {
    try {
      onProgress('Transcribing video content...', 90);
      const transcriptionResult = await getVideoTranscriptWithProgress(mediaUrl, onProgress);
      transcript = transcriptionResult.transcript;
      timestampedTranscript = transcriptionResult.timestampedTranscript;
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

  onProgress('Finalizing Instagram data...', 95);

  return {
    caption,
    mediaType,
    mediaUrl,
    transcript,
    timestampedTranscript,
    hashtags,
    altText,
  };
}

/**
 * Downloads a video from a URL to a temporary file with progress callback
 */
async function downloadVideoWithProgress(
  url: string,
  onProgress: (message: string, progress: number) => void
): Promise<string> {
  try {
    // Create temp directory if it doesn't exist
    const tempDir = join(os.tmpdir(), 'instagram-checker');
    await fs.mkdir(tempDir, { recursive: true });
    
    // Create a temporary file path
    const tempFilePath = join(tempDir, `video-${Date.now()}.mp4`);
    
    console.log(`Downloading video from ${url} to ${tempFilePath}`);
    onProgress('Attempting video download...', 91);
    
    // Try direct download first
    try {
      await downloadVideoDirectWithProgress(url, tempFilePath, onProgress);
      return tempFilePath;
    } catch (directErr) {
      const directError = directErr instanceof Error ? directErr : new Error(String(directErr));
      console.warn('Direct download failed, trying proxy service:', directError.message);
      onProgress('Direct download failed, trying proxy...', 92);
      
      // Try proxy service if direct download fails
      try {
        await downloadVideoWithProxyProgress(url, tempFilePath, onProgress);
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
 * Direct video download with progress callback
 */
async function downloadVideoDirectWithProgress(
  url: string,
  tempFilePath: string,
  onProgress: (message: string, progress: number) => void
): Promise<void> {
  const maxRetries = 3; // Reduced retries for faster feedback
  let retryCount = 0;
  let lastError: Error | null = null;
  
  while (retryCount < maxRetries) {
    try {
      if (retryCount > 0) {
        onProgress(`Retrying download (${retryCount + 1}/${maxRetries})...`, 91);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000); // Reduced timeout
      
      const response = await fetch(url, { 
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'video/mp4,video/webm,video/*;q=0.9,*/*;q=0.8',
          'Referer': 'https://www.instagram.com/',
        }
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const buffer = await response.arrayBuffer();
      
      if (buffer.byteLength === 0) {
        throw new Error('Response body is empty');
      }
      
      await fs.writeFile(tempFilePath, Buffer.from(buffer));
      
      const stats = await fs.stat(tempFilePath);
      if (stats.size === 0) {
        throw new Error('Downloaded file is empty');
      }
      
      onProgress('Video downloaded successfully', 93);
      console.log(`Direct download successful: ${stats.size} bytes`);
      return;
      
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      lastError = error;
      retryCount++;
      
      if (retryCount < maxRetries) {
        console.warn(`Direct download attempt ${retryCount}/${maxRetries} failed: ${error.message}`);
      }
    }
  }
  
  throw lastError || new Error(`Direct download failed after ${maxRetries} retries`);
}

/**
 * Proxy video download with progress callback
 */
async function downloadVideoWithProxyProgress(
  url: string,
  tempFilePath: string,
  onProgress: (message: string, progress: number) => void
): Promise<void> {
  const proxyServiceUrl = process.env.VIDEO_PROXY_SERVICE_URL;
  
  if (!proxyServiceUrl) {
    throw new Error('No proxy service configured. Set VIDEO_PROXY_SERVICE_URL environment variable.');
  }
  
  onProgress('Downloading via proxy service...', 92);
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 20000);
  
  try {
    const proxyUrl = `${proxyServiceUrl}?url=${encodeURIComponent(url)}`;
    const response = await fetch(proxyUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Instagram-Checker/1.0',
      }
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`Proxy service returned ${response.status}: ${response.statusText}`);
    }
    
    const buffer = await response.arrayBuffer();
    
    if (buffer.byteLength === 0) {
      throw new Error('Proxy response body is empty');
    }
    
    await fs.writeFile(tempFilePath, Buffer.from(buffer));
    
    const stats = await fs.stat(tempFilePath);
    if (stats.size === 0) {
      throw new Error('Proxy downloaded file is empty');
    }
    
    onProgress('Video downloaded via proxy', 93);
    console.log(`Proxy download successful: ${stats.size} bytes`);
    
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}

/**
 * Transcribes a video using OpenAI's Whisper API with progress callback and timestamps
 */
async function getVideoTranscriptWithProgress(
  videoUrl: string,
  onProgress: (message: string, progress: number) => void
): Promise<{ transcript: string; timestampedTranscript: WhisperTranscription }> {
  // Check for OpenAI API key
  const openaiApiKey = process.env.OPENAI_API_KEY;
  if (!openaiApiKey) {
    throw new Error('OPENAI_API_KEY not found. Please set this environment variable to enable transcription.');
  }

  let tempFilePath = '';
  
  try {
    onProgress('Downloading video for transcription...', 90);
    
    // Download the video
    tempFilePath = await downloadVideoWithProgress(videoUrl, onProgress);
    
    onProgress('Sending video to OpenAI Whisper...', 95);
    
    // Check file size (Whisper API has a 25MB limit)
    const stats = await fs.stat(tempFilePath);
    const fileSizeInMB = stats.size / (1024 * 1024);
    
    if (fileSizeInMB > 25) {
      throw new Error(`Video file is too large (${fileSizeInMB.toFixed(1)}MB). OpenAI Whisper API has a 25MB limit.`);
    }
    
    console.log(`Transcribing video file: ${tempFilePath} (${fileSizeInMB.toFixed(1)}MB)`);
    
    // Create form data for the API request with verbose_json format to get timestamps
    const formData = new FormData();
    const fileBuffer = await fs.readFile(tempFilePath);
    const blob = new Blob([fileBuffer], { type: 'video/mp4' });
    formData.append('file', blob, 'video.mp4');
    formData.append('model', 'whisper-1');
    formData.append('response_format', 'verbose_json');
    formData.append('timestamp_granularities[]', 'word');
    formData.append('timestamp_granularities[]', 'segment');
    
    // Make the API request
    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
      },
      body: formData,
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText} - ${errorText}`);
    }
    
    const whisperResponse = await response.json() as WhisperTranscription;
    
    if (!whisperResponse.text || whisperResponse.text.trim().length === 0) {
      throw new Error('Transcription returned empty result');
    }

    console.log('Whisper response:', whisperResponse);
    
    console.log(`Transcription successful: ${whisperResponse.text.length} characters with ${whisperResponse.segments?.length || 0} segments`);
    return {
      transcript: whisperResponse.text.trim(),
      timestampedTranscript: whisperResponse
    };
    
  } catch (error) {
    console.error('Error in video transcription:', error);
    throw error;
  } finally {
    // Clean up temporary file
    if (tempFilePath) {
      try {
        await fs.unlink(tempFilePath);
        console.log(`Cleaned up temporary file: ${tempFilePath}`);
      } catch (cleanupError) {
        console.warn(`Failed to clean up temporary file: ${tempFilePath}`, cleanupError);
      }
    }
  }
}

function getMockData(): InstagramPostData {
  // Fallback mock data for development/testing
  const mockTimestampedTranscript: WhisperTranscription = {
    text: "Hey everyone! This video is sponsored by Sneak Eats. I've been using their protein bars for months now, and they're incredible. The chocolate chip flavor is my absolute favorite. Perfect for post-workout fuel. Don't forget to use my code SAVE20 for 20% off your first order.",
    segments: [
      {
        text: "Hey everyone! This video is sponsored by Sneak Eats.",
        start: 0.5,
        end: 4.2,
        words: [
          { word: "Hey", start: 0.5, end: 0.8 },
          { word: "everyone!", start: 0.9, end: 1.4 },
          { word: "This", start: 1.8, end: 2.1 },
          { word: "video", start: 2.1, end: 2.4 },
          { word: "is", start: 2.4, end: 2.6 },
          { word: "sponsored", start: 2.6, end: 3.2 },
          { word: "by", start: 3.2, end: 3.4 },
          { word: "Sneak", start: 3.4, end: 3.8 },
          { word: "Eats.", start: 3.8, end: 4.2 }
        ]
      },
      {
        text: "I've been using their protein bars for months now, and they're incredible.",
        start: 4.8,
        end: 9.6,
        words: [
          { word: "I've", start: 4.8, end: 5.1 },
          { word: "been", start: 5.1, end: 5.3 },
          { word: "using", start: 5.3, end: 5.6 },
          { word: "their", start: 5.6, end: 5.9 },
          { word: "protein", start: 5.9, end: 6.4 },
          { word: "bars", start: 6.4, end: 6.8 },
          { word: "for", start: 6.8, end: 7.0 },
          { word: "months", start: 7.0, end: 7.4 },
          { word: "now,", start: 7.4, end: 7.8 },
          { word: "and", start: 8.0, end: 8.2 },
          { word: "they're", start: 8.2, end: 8.6 },
          { word: "incredible.", start: 8.6, end: 9.6 }
        ]
      },
      {
        text: "The chocolate chip flavor is my absolute favorite. Perfect for post-workout fuel.",
        start: 10.2,
        end: 15.8,
        words: [
          { word: "The", start: 10.2, end: 10.4 },
          { word: "chocolate", start: 10.4, end: 10.9 },
          { word: "chip", start: 10.9, end: 11.2 },
          { word: "flavor", start: 11.2, end: 11.6 },
          { word: "is", start: 11.6, end: 11.8 },
          { word: "my", start: 11.8, end: 12.0 },
          { word: "absolute", start: 12.0, end: 12.5 },
          { word: "favorite.", start: 12.5, end: 13.2 },
          { word: "Perfect", start: 13.6, end: 14.0 },
          { word: "for", start: 14.0, end: 14.2 },
          { word: "post-workout", start: 14.2, end: 14.9 },
          { word: "fuel.", start: 14.9, end: 15.8 }
        ]
      },
      {
        text: "Don't forget to use my code SAVE20 for 20% off your first order.",
        start: 16.4,
        end: 21.2,
        words: [
          { word: "Don't", start: 16.4, end: 16.7 },
          { word: "forget", start: 16.7, end: 17.1 },
          { word: "to", start: 17.1, end: 17.3 },
          { word: "use", start: 17.3, end: 17.5 },
          { word: "my", start: 17.5, end: 17.7 },
          { word: "code", start: 17.7, end: 18.0 },
          { word: "SAVE20", start: 18.0, end: 18.6 },
          { word: "for", start: 18.6, end: 18.8 },
          { word: "20%", start: 18.8, end: 19.2 },
          { word: "off", start: 19.2, end: 19.4 },
          { word: "your", start: 19.4, end: 19.6 },
          { word: "first", start: 19.6, end: 19.9 },
          { word: "order.", start: 19.9, end: 21.2 }
        ]
      }
    ]
  };

  return {
    caption: `🔥 Just tried the new Sneak Eats protein bars and they're incredible! The chocolate chip flavor is my absolute favorite. Perfect for post-workout fuel! 💪 

Use my code SAVE20 for 20% off your first order. Link in bio! 

What's your go-to post-workout snack? Let me know in the comments! 👇

#ad #sneakeats #proteinbar #fitness #postworkout #healthyeating #sponsored #fitnessmotivation #nutrition #gains`,
    
    mediaType: 'video',
    mediaUrl: 'https://example.com/sample-video.mp4',
    
    transcript: mockTimestampedTranscript.text,
    timestampedTranscript: mockTimestampedTranscript,
    
    hashtags: ['ad', 'sneakeats', 'proteinbar', 'fitness', 'postworkout', 'healthyeating', 'sponsored', 'fitnessmotivation', 'nutrition', 'gains'],
    
    altText: 'Person holding a chocolate chip protein bar with gym equipment in the background'
  };
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
  let timestampedTranscript: WhisperTranscription | undefined;
  if (mediaType === 'video' && mediaUrl) {
    try {
      const transcriptionResult = await getVideoTranscript(mediaUrl);
      transcript = transcriptionResult.transcript;
      timestampedTranscript = transcriptionResult.timestampedTranscript;
      console.log('Transcription successful:', timestampedTranscript);
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
    timestampedTranscript,
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
 * Transcribes a video using OpenAI's Whisper API with timestamps
 */
async function getVideoTranscript(videoUrl: string): Promise<{ transcript: string; timestampedTranscript: WhisperTranscription }> {
  // Check for OpenAI API key
  const openaiApiKey = process.env.OPENAI_API_KEY;
  if (!openaiApiKey) {
    throw new Error('OPENAI_API_KEY not found. Please set this environment variable to enable transcription.');
  }

  let tempFilePath = '';
  
  try {
    // Download the video
    tempFilePath = await downloadVideo(videoUrl);
    
    // Check file size (Whisper API has a 25MB limit)
    const stats = await fs.stat(tempFilePath);
    const fileSizeInMB = stats.size / (1024 * 1024);
    
    if (fileSizeInMB > 25) {
      throw new Error(`Video file is too large (${fileSizeInMB.toFixed(1)}MB). OpenAI Whisper API has a 25MB limit.`);
    }
    
    console.log(`Transcribing video file: ${tempFilePath} (${fileSizeInMB.toFixed(1)}MB)`);
    
    // Create form data for the API request with verbose_json format to get timestamps
    const formData = new FormData();
    const fileBuffer = await fs.readFile(tempFilePath);
    const blob = new Blob([fileBuffer], { type: 'video/mp4' });
    formData.append('file', blob, 'video.mp4');
    formData.append('model', 'whisper-1');
    formData.append('response_format', 'verbose_json');
    formData.append('timestamp_granularities[]', 'word');
    formData.append('timestamp_granularities[]', 'segment');
    
    // Make the API request
    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
      },
      body: formData,
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText} - ${errorText}`);
    }
    
    const whisperResponse = await response.json() as WhisperTranscription;
    
    if (!whisperResponse.text || whisperResponse.text.trim().length === 0) {
      throw new Error('Transcription returned empty result');
    }
    
    console.log(`Transcription successful: ${whisperResponse.text.length} characters with ${whisperResponse.segments?.length || 0} segments`);
    return {
      transcript: whisperResponse.text.trim(),
      timestampedTranscript: whisperResponse
    };
    
  } catch (error) {
    console.error('Error in video transcription:', error);
    throw error;
  } finally {
    // Clean up temporary file
    if (tempFilePath) {
      try {
        await fs.unlink(tempFilePath);
        console.log(`Cleaned up temporary file: ${tempFilePath}`);
      } catch (cleanupError) {
        console.warn(`Failed to clean up temporary file: ${tempFilePath}`, cleanupError);
      }
    }
  }
} 