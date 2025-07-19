/**
 * Enhanced Instagram Service with Request Queue and Circuit Breaker
 * 
 * This service demonstrates the integration of the request queue and circuit breaker
 * pattern for improved reliability and performance when calling external APIs.
 */

import { ApifyClient } from 'apify-client';
import { join } from 'path';
import fs from 'fs/promises';
import os from 'os';
import { InstagramPostData, WhisperTranscription } from './instagram-service';
import { executeWithProtection, requestQueues } from './request-queue';
import { circuitBreakers } from './circuit-breaker';

export interface EnhancedInstagramServiceConfig {
  enableQueueing: boolean;
  enableCircuitBreaker: boolean;
  priorityLevel: number;
  maxRetries: number;
  timeoutMs: number;
}

/**
 * Enhanced Instagram service with reliability improvements
 */
export class EnhancedInstagramService {
  private config: EnhancedInstagramServiceConfig;

  constructor(config: Partial<EnhancedInstagramServiceConfig> = {}) {
    this.config = {
      enableQueueing: true,
      enableCircuitBreaker: true,
      priorityLevel: 2, // Medium priority
      maxRetries: 3,
      timeoutMs: 60000,
      ...config,
    };
  }

  /**
   * Fetch Instagram post data with enhanced reliability
   */
  async getInstagramPostData(url: string): Promise<InstagramPostData> {
    // Validate URL first (no need to queue this)
    if (!this.isValidInstagramUrl(url)) {
      throw new Error('Invalid Instagram URL provided. Please provide a valid Instagram URL (post: /p/id, reel: /reel/id, or user reel: /username/reel/id).');
    }

    // Check for API key
    const apiKey = process.env.APIFY_API_KEY;
    if (!apiKey) {
      console.warn('APIFY_API_KEY not found, falling back to mock data');
      return this.getMockData();
    }

    if (this.config.enableQueueing) {
      return this.getInstagramDataWithQueue(url, apiKey);
    } else {
      return this.getInstagramDataDirect(url, apiKey);
    }
  }

  /**
   * Fetch Instagram data using request queue and circuit breaker
   */
  private async getInstagramDataWithQueue(url: string, apiKey: string): Promise<InstagramPostData> {
    try {
      // Execute Apify scraping with protection
      const apifyData = await executeWithProtection(
        () => this.callApifyAPI(url, apiKey),
        'instagram',
        {
          priority: this.config.priorityLevel,
          timeout: this.config.timeoutMs,
          useCircuitBreaker: this.config.enableCircuitBreaker,
        }
      );

      // Transform data
      return await this.transformApifyData(apifyData);

    } catch (error) {
      console.error('Enhanced Instagram service failed:', error);
      
      // Provide better error messages based on circuit breaker state
      if (error instanceof Error && error.name === 'CircuitBreakerError') {
        throw new Error('Instagram service is temporarily unavailable due to repeated failures. Please try again later.');
      }

      // Fallback to mock data for development
      console.warn('Falling back to mock data due to API error');
      return this.getMockData();
    }
  }

  /**
   * Direct Instagram data fetching (fallback method)
   */
  private async getInstagramDataDirect(url: string, apiKey: string): Promise<InstagramPostData> {
    try {
      const apifyData = await this.callApifyAPI(url, apiKey);
      return await this.transformApifyData(apifyData);
    } catch (error) {
      console.error('Direct Instagram service failed:', error);
      console.warn('Falling back to mock data due to API error');
      return this.getMockData();
    }
  }

  /**
   * Call Apify Instagram scraper API
   */
  private async callApifyAPI(url: string, apiKey: string): Promise<any> {
    const client = new ApifyClient({ token: apiKey });

    const input = {
      directUrls: [url],
      resultsType: 'posts',
      resultsLimit: 1,
      addParentData: false,
    };

    console.log('Fetching Instagram data from Apify...');

    // Run the Instagram scraper
    const run = await client.actor('apify/instagram-scraper').call(input, {
      timeout: this.config.timeoutMs,
    });

    // Get the results from the dataset
    const { items } = await client.dataset(run.defaultDatasetId).listItems();

    if (!items || items.length === 0) {
      throw new Error('No data found for the provided Instagram URL. The post might be private or the URL might be invalid.');
    }

    return items[0];
  }

  /**
   * Transform Apify data with enhanced error handling and transcription queuing
   */
  private async transformApifyData(data: any): Promise<InstagramPostData> {
    // Determine media type
    const mediaType: 'video' | 'image' = data.type === 'Video' || data.videoUrl ? 'video' : 'image';
    
    // Get media URL
    let mediaUrl = '';
    if (mediaType === 'video') {
      mediaUrl = data.videoUrl || data.displayUrl || data.url || '';
    } else {
      mediaUrl = data.imageUrl || data.displayUrl || data.url || '';
    }

    // Extract basic data
    const caption = data.caption || '';
    const hashtags = data.hashtags || [];
    const altText = data.alt || '';

    // Handle video transcription with queuing
    let transcript = '';
    let timestampedTranscript: WhisperTranscription | undefined;
    
    if (mediaType === 'video' && mediaUrl) {
      try {
        if (this.config.enableQueueing) {
          // Use transcription queue for video processing
          const transcriptionResult = await executeWithProtection(
            () => this.getVideoTranscript(mediaUrl),
            'transcription',
            {
              priority: this.config.priorityLevel - 1, // Lower priority for transcription
              timeout: 120000, // Longer timeout for transcription
              useCircuitBreaker: this.config.enableCircuitBreaker,
            }
          );
          
          transcript = transcriptionResult.transcript;
          timestampedTranscript = transcriptionResult.timestampedTranscript;
        } else {
          const transcriptionResult = await this.getVideoTranscript(mediaUrl);
          transcript = transcriptionResult.transcript;
          timestampedTranscript = transcriptionResult.timestampedTranscript;
        }
      } catch (error) {
        console.error('Error transcribing video:', error);
        
        // Provide user-friendly error messages
        if (error instanceof Error && error.name === 'CircuitBreakerError') {
          transcript = 'Video transcription service is temporarily unavailable. Please try again later.';
        } else if (error instanceof Error && error.message.includes('download')) {
          transcript = 'Instagram video transcription is not available. Instagram restricts direct video downloads.';
        } else {
          transcript = 'Transcription failed. Please try again later.';
        }
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
   * Video transcription using OpenAI Whisper (placeholder implementation)
   */
  private async getVideoTranscript(videoUrl: string): Promise<{ transcript: string; timestampedTranscript: WhisperTranscription }> {
    // Check for OpenAI API key
    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      throw new Error('OPENAI_API_KEY not found. Please set this environment variable to enable transcription.');
    }

    // For POC, we'll return a mock transcription
    // In real implementation, this would download the video and call Whisper API
    const mockTranscription: WhisperTranscription = {
      text: "This is a mock transcription for demonstration purposes.",
      segments: [
        {
          text: "This is a mock transcription for demonstration purposes.",
          start: 0,
          end: 5,
        }
      ],
    };

    return {
      transcript: mockTranscription.text,
      timestampedTranscript: mockTranscription,
    };
  }

  /**
   * URL validation (unchanged from original service)
   */
  private isValidInstagramUrl(url: string): boolean {
    const instagramUrlPattern = /^https?:\/\/(www\.)?instagram\.com\/((p|reel)\/[A-Za-z0-9_-]+|[A-Za-z0-9_.]+\/reel\/[A-Za-z0-9_-]+)\/?$/;
    return instagramUrlPattern.test(url);
  }

  /**
   * Mock data for development/testing (unchanged from original service)
   */
  private getMockData(): InstagramPostData {
    const mockTimestampedTranscript: WhisperTranscription = {
      text: "Hey everyone! This video is sponsored by Sneak Eats. I've been using their protein bars for months now, and they're incredible. The chocolate chip flavor is my absolute favorite. Perfect for post-workout fuel. Don't forget to use my code SAVE20 for 20% off your first order.",
      segments: [
        {
          text: "Hey everyone! This video is sponsored by Sneak Eats.",
          start: 0.5,
          end: 4.2,
        },
        {
          text: "I've been using their protein bars for months now, and they're incredible.",
          start: 4.8,
          end: 9.6,
        },
        {
          text: "The chocolate chip flavor is my absolute favorite. Perfect for post-workout fuel.",
          start: 10.2,
          end: 15.8,
        },
        {
          text: "Don't forget to use my code SAVE20 for 20% off your first order.",
          start: 16.4,
          end: 21.2,
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
   * Get service metrics for monitoring
   */
  getMetrics() {
    return {
      queue: requestQueues.instagram.getMetrics(),
      circuitBreaker: circuitBreakers.instagram.getMetrics(),
      transcriptionQueue: requestQueues.transcription.getMetrics(),
      whisperCircuitBreaker: circuitBreakers.whisper.getMetrics(),
    };
  }

  /**
   * Reset all service state (useful for testing)
   */
  reset() {
    circuitBreakers.instagram.reset();
    circuitBreakers.whisper.reset();
    // Note: Queues don't need resetting as they process automatically
  }
}

// Export a default instance for easy use
export const enhancedInstagramService = new EnhancedInstagramService();

/**
 * Progress-aware version of the enhanced service
 */
export async function getInstagramPostDataWithProgressEnhanced(
  url: string,
  onProgress: (message: string, progress: number) => void,
  config?: Partial<EnhancedInstagramServiceConfig>
): Promise<InstagramPostData> {
  const service = new EnhancedInstagramService(config);
  
  onProgress('Validating Instagram URL...', 0);
  
  try {
    onProgress('Queuing Instagram data request...', 10);
    const result = await service.getInstagramPostData(url);
    onProgress('Instagram data fetched successfully', 100);
    return result;
  } catch (error) {
    onProgress('Instagram data fetch failed', 0);
    throw error;
  }
}