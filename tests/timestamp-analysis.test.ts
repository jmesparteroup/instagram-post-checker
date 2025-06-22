import { AIAnalysisService } from '../src/lib/ai-analysis-service';
import { InstagramPostData, WhisperTranscription } from '../src/lib/instagram-service';

describe('Timestamp Analysis', () => {
  const mockTimestampedPost: InstagramPostData = {
    caption: 'Check out this amazing protein bar! #ad',
    mediaType: 'video',
    mediaUrl: 'https://example.com/test.mp4',
    transcript: 'Hey everyone! This video is sponsored. I love these protein bars, they taste amazing.',
    timestampedTranscript: {
      text: 'Hey everyone! This video is sponsored. I love these protein bars, they taste amazing.',
      segments: [
        {
          text: 'Hey everyone! This video is sponsored.',
          start: 1.0,
          end: 4.5,
          words: [
            { word: 'Hey', start: 1.0, end: 1.3 },
            { word: 'everyone!', start: 1.3, end: 1.8 },
            { word: 'This', start: 2.0, end: 2.2 },
            { word: 'video', start: 2.2, end: 2.5 },
            { word: 'is', start: 2.5, end: 2.7 },
            { word: 'sponsored.', start: 2.7, end: 4.5 }
          ]
        },
        {
          text: 'I love these protein bars, they taste amazing.',
          start: 5.0,
          end: 9.0,
          words: [
            { word: 'I', start: 5.0, end: 5.1 },
            { word: 'love', start: 5.1, end: 5.4 },
            { word: 'these', start: 5.4, end: 5.7 },
            { word: 'protein', start: 5.7, end: 6.2 },
            { word: 'bars,', start: 6.2, end: 6.6 },
            { word: 'they', start: 6.8, end: 7.0 },
            { word: 'taste', start: 7.0, end: 7.3 },
            { word: 'amazing.', start: 7.3, end: 9.0 }
          ]
        }
      ]
    },
    hashtags: ['ad'],
    altText: 'Person holding a protein bar'
  };

  beforeEach(() => {
    process.env.OPENAI_API_KEY = 'test-api-key';
  });

  afterEach(() => {
    delete process.env.OPENAI_API_KEY;
  });

  describe('formatTime method', () => {
    it('should format seconds correctly', () => {
      const service = new AIAnalysisService();
      
      // Access private method via type assertion for testing and bind context
      const formatTime = (service as any).formatTime.bind(service);
      
      expect(formatTime(0)).toBe('00:00');
      expect(formatTime(30)).toBe('00:30');
      expect(formatTime(75)).toBe('01:15');
      expect(formatTime(3661)).toBe('61:01');
    });
  });

  describe('buildUserPrompt with timestamps', () => {
    it('should include timestamped transcript when available', () => {
      const service = new AIAnalysisService();
      const requirements = ['Must mention sponsor within first 10 seconds'];
      
      // Access private method via type assertion for testing and bind context
      const buildUserPrompt = (service as any).buildUserPrompt.bind(service);
      const prompt = buildUserPrompt(mockTimestampedPost, requirements);
      
      expect(prompt).toContain('TRANSCRIPT (with timestamps)');
      expect(prompt).toContain('[00:01-00:04]: Hey everyone! This video is sponsored.');
      expect(prompt).toContain('[00:05-00:09]: I love these protein bars, they taste amazing.');
      expect(prompt).toContain('when specific content appears in the video timeline');
    });

    it('should handle image posts without timestamps', () => {
      const service = new AIAnalysisService();
      const imagePost: InstagramPostData = {
        ...mockTimestampedPost,
        mediaType: 'image',
        transcript: '',
        timestampedTranscript: undefined
      };
      
      // Access private method via type assertion for testing and bind context
      const buildUserPrompt = (service as any).buildUserPrompt.bind(service);
      const prompt = buildUserPrompt(imagePost, ['Must include #ad']);
      
      expect(prompt).toContain('TRANSCRIPT: Not applicable for image content');
      expect(prompt).not.toContain('TRANSCRIPT (with timestamps)');
    });

    it('should handle video posts without timestamped transcript', () => {
      const service = new AIAnalysisService();
      const videoPost: InstagramPostData = {
        ...mockTimestampedPost,
        timestampedTranscript: undefined
      };
      
      // Access private method via type assertion for testing and bind context
      const buildUserPrompt = (service as any).buildUserPrompt.bind(service);
      const prompt = buildUserPrompt(videoPost, ['Must include sponsor disclosure']);
      
      expect(prompt).toContain('TRANSCRIPT:');
      expect(prompt).not.toContain('TRANSCRIPT (with timestamps)');
      expect(prompt).toContain(mockTimestampedPost.transcript);
    });
  });

  describe('system prompt', () => {
    it('should include timestamp analysis guidelines', () => {
      const service = new AIAnalysisService();
      
      // Access private method via type assertion for testing and bind context
      const buildSystemPrompt = (service as any).buildSystemPrompt.bind(service);
      const prompt = buildSystemPrompt();
      
      expect(prompt).toContain('Timestamp Analysis:');
      expect(prompt).toContain('First 10 seconds');
      expect(prompt).toContain('[00:00-00:10]');
      expect(prompt).toContain('Above the fold');
      expect(prompt).toContain('include timestamps when relevant');
    });
  });
}); 