import { AIAnalysisService } from '../src/lib/ai-analysis-service';
import { InstagramPostData } from '../src/lib/instagram-service';

// Mock OpenAI to avoid actual API calls in tests
jest.mock('openai');

describe('AIAnalysisService', () => {
  beforeEach(() => {
    process.env.OPENAI_API_KEY = 'test-api-key';
  });

  it('should create instance successfully', () => {
    const service = new AIAnalysisService();
    expect(service).toBeInstanceOf(AIAnalysisService);
  });

  it('should throw error when API key is missing', () => {
    delete process.env.OPENAI_API_KEY;
    expect(() => new AIAnalysisService()).toThrow('OPENAI_API_KEY environment variable is required');
  });
}); 