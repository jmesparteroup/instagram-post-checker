import { getInstagramPostData, isValidInstagramUrl } from '../src/lib/instagram-service';

// Mock fetch to simulate network failures and retries
global.fetch = jest.fn();

describe('Instagram Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Set up required environment variables
    process.env.APIFY_API_TOKEN = 'test-token';
    process.env.OPENAI_API_KEY = 'test-openai-key';
  });

  describe('URL Validation', () => {
    it('should accept valid Instagram post URLs', () => {
      const validPostUrls = [
        'https://www.instagram.com/p/ABC123/',
        'https://instagram.com/p/XYZ789',
        'http://www.instagram.com/p/DEF456/',
        'https://www.instagram.com/p/GHI012',
      ];

      validPostUrls.forEach(url => {
        expect(isValidInstagramUrl(url)).toBe(true);
      });
    });

    it('should accept valid Instagram reel URLs', () => {
      const validReelUrls = [
        'https://www.instagram.com/reel/ABC123/',
        'https://instagram.com/reel/XYZ789',
        'http://www.instagram.com/reel/DEF456/',
        'https://www.instagram.com/reel/GHI012',
      ];

      validReelUrls.forEach(url => {
        expect(isValidInstagramUrl(url)).toBe(true);
      });
    });

    it('should accept valid Instagram user reel URLs', () => {
      const validUserReelUrls = [
        'https://www.instagram.com/username/reel/ABC123/',
        'https://instagram.com/user.name/reel/XYZ789',
        'http://www.instagram.com/user_name/reel/DEF456/',
        'https://www.instagram.com/user123/reel/GHI012',
        'https://www.instagram.com/test.user_123/reel/JKL456',
      ];

      validUserReelUrls.forEach(url => {
        expect(isValidInstagramUrl(url)).toBe(true);
      });
    });

    it('should reject invalid Instagram URLs', () => {
      const invalidUrls = [
        'https://www.instagram.com/user/profile/',
        'https://www.instagram.com/stories/user/123/',
        'https://www.facebook.com/p/ABC123/',
        'https://www.instagram.com/p/',
        'https://www.instagram.com/reel/',
        'https://www.instagram.com/user/reel/',
        'not-a-url',
        '',
      ];

      invalidUrls.forEach(url => {
        expect(isValidInstagramUrl(url)).toBe(false);
      });
    });
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