import { getInstagramPostData } from '../src/lib/instagram-service';

// Mock fetch to simulate network failures and retries
global.fetch = jest.fn();

describe('Instagram Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Set up required environment variables
    process.env.APIFY_API_TOKEN = 'test-token';
    process.env.OPENAI_API_KEY = 'test-openai-key';
  });

  describe('Video Download Retry Logic', () => {
    it('should retry video download up to 5 times with delays', async () => {
      const mockFetch = fetch as jest.MockedFunction<typeof fetch>;
      
      // Mock Apify response first (successful)
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            data: [{
              caption: 'Test video caption',
              type: 'Video',
              videoUrl: 'https://test.com/video.mp4',
              hashtags: ['test'],
              alt: 'Test alt text'
            }]
          })
        } as Response)
        // Then mock video download failures (first 4 attempts fail)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Timeout'))
        .mockRejectedValueOnce(new Error('Server error'))
        .mockRejectedValueOnce(new Error('Rate limited'))
        // Final attempt succeeds
        .mockResolvedValueOnce({
          ok: true,
          arrayBuffer: () => Promise.resolve(new ArrayBuffer(1024))
        } as Response);

      // Mock file system operations
      const fs = require('fs').promises;
      jest.spyOn(fs, 'mkdir').mockResolvedValue(undefined);
      jest.spyOn(fs, 'writeFile').mockResolvedValue(undefined);
      jest.spyOn(fs, 'stat').mockResolvedValue({ size: 1024 });
      jest.spyOn(fs, 'unlink').mockResolvedValue(undefined);

      // Mock OpenAI transcription
      const mockOpenAI = {
        audio: {
          transcriptions: {
            create: jest.fn().mockResolvedValue('Test transcript')
          }
        }
      };
      
      jest.doMock('openai', () => ({
        default: jest.fn(() => mockOpenAI)
      }));

      // This test would take too long with real delays, so we'll mock setTimeout
      const originalSetTimeout = global.setTimeout;
      global.setTimeout = jest.fn().mockImplementation((callback) => {
        callback();
        return 1 as any;
      }) as any;

      try {
        const result = await getInstagramPostData('https://www.instagram.com/reel/test123/');
        
        // Should succeed after retries
        expect(result.transcript).toBe('Test transcript');
        expect(mockFetch).toHaveBeenCalledTimes(6); // 1 Apify + 5 video download attempts
        
      } finally {
        global.setTimeout = originalSetTimeout;
      }
    }, 10000); // 10 second timeout for this test

    it('should fail after 5 retry attempts', async () => {
      const mockFetch = fetch as jest.MockedFunction<typeof fetch>;
      
      // Mock Apify response first (successful)
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            data: [{
              caption: 'Test video caption',
              type: 'Video',
              videoUrl: 'https://test.com/video.mp4',
              hashtags: ['test'],
              alt: 'Test alt text'
            }]
          })
        } as Response)
        // All video download attempts fail
        .mockRejectedValue(new Error('Persistent network error'));

      // Mock file system operations
      const fs = require('fs').promises;
      jest.spyOn(fs, 'mkdir').mockResolvedValue(undefined);
      jest.spyOn(fs, 'unlink').mockResolvedValue(undefined);

      // Mock setTimeout to avoid real delays
      const originalSetTimeout = global.setTimeout;
      global.setTimeout = jest.fn().mockImplementation((callback) => {
        callback();
        return 1 as any;
      }) as any;

      try {
        await expect(getInstagramPostData('https://www.instagram.com/reel/test123/'))
          .rejects
          .toThrow(/Failed to download video for transcription/);
        
        // Should attempt 1 Apify call + 5 video download attempts
        expect(mockFetch).toHaveBeenCalledTimes(6);
        
      } finally {
        global.setTimeout = originalSetTimeout;
      }
    }, 10000);
  });
}); 