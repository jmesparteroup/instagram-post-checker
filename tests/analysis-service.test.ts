import { analyzeContent } from '../src/lib/analysis-service';
import { InstagramPostData } from '../src/lib/instagram-service';

describe('Analysis Service', () => {
  const mockPostData: InstagramPostData = {
    caption: '#ad This is a sponsored post about fitness. Check out this amazing product!',
    hashtags: ['ad', 'sponsored', 'fitness'],
    altText: 'Image showing fitness product',
    transcript: 'In this video, I mention my partnership with the brand and discuss the sponsored content.',
    mediaType: 'video',
    mediaUrl: 'https://example.com/test-video.mp4',
  };

  describe('analyzeContent', () => {
    it('should return correct analysis for hashtag requirements', () => {
      const requirements = ['Must include #ad hashtag'];
      const result = analyzeContent(mockPostData, requirements);

      expect(result.results).toHaveLength(1);
      expect(result.results[0]).toEqual({
        requirement: 'Must include #ad hashtag',
        passed: true,
        explanation: expect.stringContaining('#ad'),
      });
      expect(result.overallScore).toBe(100);
    });

    it('should detect missing hashtags', () => {
      const postWithoutAd: InstagramPostData = {
        ...mockPostData,
        caption: 'This is a regular post without disclosure',
        hashtags: ['fitness'],
      };

      const requirements = ['Must include #ad hashtag'];
      const result = analyzeContent(postWithoutAd, requirements);

      expect(result.results[0].passed).toBe(false);
      expect(result.overallScore).toBe(0);
    });

    it('should check above the fold requirements', () => {
      const requirements = ['#ad must be above the fold'];
      const result = analyzeContent(mockPostData, requirements);

      expect(result.results[0].passed).toBe(true);
      expect(result.results[0].explanation).toContain('first 150 characters');
    });

    it('should check transcript requirements', () => {
      const requirements = ['Must mention partnership in audio'];
      const result = analyzeContent(mockPostData, requirements);

      expect(result.results[0].passed).toBe(true);
      expect(result.results[0].explanation).toContain('audio');
    });

    it('should handle multiple requirements', () => {
      const requirements = [
        'Must include #ad hashtag',
        'Must mention partnership',
        'Must include nonexistent term',
      ];
      const result = analyzeContent(mockPostData, requirements);

      expect(result.results).toHaveLength(3);
      expect(result.results[0].passed).toBe(true);
      expect(result.results[1].passed).toBe(true);
      expect(result.results[2].passed).toBe(false);
      expect(result.overallScore).toBe(67); // 2 out of 3 passed
    });

    it('should handle empty requirements', () => {
      const result = analyzeContent(mockPostData, []);
      expect(result.results).toHaveLength(0);
      expect(result.overallScore).toBe(0);
    });

    it('should filter out empty requirement strings', () => {
      const requirements = ['Valid requirement', '', '   ', 'Another valid requirement'];
      const result = analyzeContent(mockPostData, requirements);

      expect(result.results).toHaveLength(2);
    });
  });
}); 