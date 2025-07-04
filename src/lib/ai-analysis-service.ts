import OpenAI from 'openai';
import { z } from 'zod';
import { InstagramPostData } from './instagram-service';
import { AnalysisResult, AnalysisReport, analyzeContent } from './analysis-service';
import { analysisCache } from './cache-service';

// Enhanced interfaces with AI features
export interface AIAnalysisResult extends AnalysisResult {
  confidence: number;
  evidence: string[];
  reasoning: string;
}

export interface AIAnalysisReport extends Omit<AnalysisReport, 'results'> {
  results: AIAnalysisResult[];
  aiPowered: boolean;
  processingTime: number;
  model: string;
}

// Zod schema for structured output validation
const AnalysisResultSchema = z.object({
  requirement: z.string(),
  passed: z.boolean(),
  explanation: z.string(),
  confidence: z.number().min(0).max(1),
  evidence: z.array(z.string()),
  reasoning: z.string(),
});

const AnalysisResponseSchema = z.object({
  results: z.array(AnalysisResultSchema),
  overallAssessment: z.string(),
});

// Configuration constants with environment variable support
const AI_CONFIG = {
  model: (process.env.OPENAI_MODEL || 'gpt-4.1-mini') as 'gpt-4o-mini' | 'gpt-4o' | 'gpt-4-turbo' | 'gpt-3.5-turbo',
  maxTokens: 4000,
  temperature: 0.1, // Low temperature for consistent analysis
  maxRetries: 3,
  timeoutMs: 30000,
} as const;

const RATE_LIMIT_CONFIG = {
  maxRequestsPerMinute: parseInt(process.env.OPENAI_MAX_REQUESTS_PER_MINUTE || '50', 10),
  backoffMultiplier: 2,
  maxBackoffMs: 10000,
} as const;

// Rate limiting state
let requestCount = 0;
let lastResetTime = Date.now();

/**
 * AI-powered Instagram content compliance analyzer
 * Uses OpenAI GPT-4o-mini with structured output for reliable analysis
 */
export class AIAnalysisService {
  private openai: OpenAI;
  private fallbackToRulesBased: boolean;

  constructor(fallbackToRulesBased = true) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY environment variable is required');
    }

    this.openai = new OpenAI({ apiKey });
    this.fallbackToRulesBased = fallbackToRulesBased;
  }

  /**
   * Analyzes Instagram content against requirements using AI
   */
  async analyzeContent(
    postData: InstagramPostData,
    requirements: string[]
  ): Promise<AIAnalysisReport> {
    const startTime = Date.now();

    try {
      // Validate inputs
      this.validateInputs(postData, requirements);

      // Check cache first
      const cacheKey = analysisCache.generateKey(postData, requirements);
      const cachedResult = analysisCache.get<AIAnalysisReport>(cacheKey);
      
      if (cachedResult) {
        return {
          ...cachedResult,
          processingTime: Date.now() - startTime, // Update processing time
        };
      }

      // Check rate limits
      await this.checkRateLimit();

      // Perform AI analysis
      const aiResults = await this.performAIAnalysis(postData, requirements);

      // Calculate overall score
      const passedCount = aiResults.filter(r => r.passed).length;
      const overallScore = requirements.length > 0 
        ? Math.round((passedCount / requirements.length) * 100) 
        : 0;

      const processingTime = Date.now() - startTime;

      const report: AIAnalysisReport = {
        results: aiResults,
        overallScore,
        aiPowered: true,
        processingTime,
        model: AI_CONFIG.model,
      };

      // Cache the result
      analysisCache.set(cacheKey, report);

      return report;

    } catch (error) {
      console.error('AI analysis failed:', error);

      if (this.fallbackToRulesBased) {
        return this.fallbackAnalysis(postData, requirements, startTime);
      }

      throw new Error(`AI analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Performs the core AI analysis using OpenAI
   */
  private async performAIAnalysis(
    postData: InstagramPostData,
    requirements: string[]
  ): Promise<AIAnalysisResult[]> {
    const systemPrompt = this.buildSystemPrompt();
    const userPrompt = this.buildUserPrompt(postData, requirements);

    const response = await this.callOpenAIWithRetry({
      model: AI_CONFIG.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: AI_CONFIG.maxTokens,
      temperature: AI_CONFIG.temperature,
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'instagram_compliance_analysis',
          schema: {
            type: 'object',
            properties: {
              results: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    requirement: { type: 'string' },
                    passed: { type: 'boolean' },
                    explanation: { type: 'string' },
                    confidence: { type: 'number', minimum: 0, maximum: 1 },
                    evidence: { type: 'array', items: { type: 'string' } },
                    reasoning: { type: 'string' },
                  },
                  required: ['requirement', 'passed', 'explanation', 'confidence', 'evidence', 'reasoning'],
                  additionalProperties: false,
                },
              },
              overallAssessment: { type: 'string' },
            },
            required: ['results', 'overallAssessment'],
            additionalProperties: false,
          },
        },
      },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response content from OpenAI');
    }

    const parsedResponse = JSON.parse(content);
    const validatedResponse = AnalysisResponseSchema.parse(parsedResponse);

    return validatedResponse.results;
  }

  /**
   * Builds the system prompt for Instagram compliance analysis
   */
  private buildSystemPrompt(): string {
    return `You are an expert Instagram content compliance analyzer specializing in FTC guidelines, sponsored content disclosure, and social media marketing regulations.

Your task is to analyze Instagram posts (captions, transcripts, media) against specific compliance requirements and provide detailed, accurate assessments.

Analysis Guidelines:
- Be precise about disclosure placement and visibility
- Consider Instagram's UI limitations (character limits, "more" button)
- Evaluate both explicit and implicit compliance
- Provide specific evidence from the content
- Consider context and intent, not just keyword matching
- Account for common compliance mistakes and edge cases
- Pay special attention to timing requirements when timestamped transcripts are available

Timestamp Analysis:
- When timestamps are provided, use them to verify timing-based requirements
- "First 10 seconds" means content appearing between [00:00-00:10]
- "At the beginning" typically means within the first 15-20 seconds
- "Above the fold" in video context means visible/audible without user interaction (first 5-10 seconds)
- Be precise about when specific content appears in the video timeline
- Consider that Instagram videos may have brief intro music or logos before main content

For each requirement, provide:
- Clear pass/fail determination
- Brief explanation of the result
- Confidence score (0.0-1.0) based on evidence clarity
- Specific evidence quotes from the content (include timestamps when relevant)
- Detailed reasoning explaining your decision

Be thorough, accurate, and helpful in identifying compliance gaps.`;
  }

  /**
   * Builds the user prompt with post data and requirements
   */
  private buildUserPrompt(postData: InstagramPostData, requirements: string[]): string {
    let transcriptSection = '';
    if (postData.mediaType === 'video') {
      if (postData.timestampedTranscript && postData.timestampedTranscript.segments) {
        // Build timestamped transcript with timing information
        const timestampedText = postData.timestampedTranscript.segments
          .map(segment => `[${this.formatTime(segment.start)}-${this.formatTime(segment.end)}]: ${segment.text.trim()}`)
          .join('\n');
        
        transcriptSection = `**TRANSCRIPT (with timestamps):**
${timestampedText}

**Full transcript text:** ${postData.transcript || 'No transcript available'}`;
      } else {
        transcriptSection = `**TRANSCRIPT:**
${postData.transcript || 'No transcript available'}`;
      }
    } else {
      transcriptSection = `**TRANSCRIPT:** Not applicable for image content`;
    }

    return `Analyze this Instagram ${postData.mediaType} post for compliance:

**CAPTION:**
${postData.caption || 'No caption provided'}

**HASHTAGS:**
${postData.hashtags.length > 0 ? postData.hashtags.map(tag => `#${tag}`).join(' ') : 'No hashtags found'}

**ALT TEXT (Image Description):**
${postData.altText || 'No alt text available'}

${transcriptSection}

**MEDIA TYPE:** ${postData.mediaType}

**REQUIREMENTS TO CHECK:**
${requirements.map((req, index) => `${index + 1}. ${req}`).join('\n')}

IMPORTANT: When analyzing requirements that mention timing (e.g., "within the first X seconds", "at the beginning", "above the fold"), pay close attention to the timestamps provided in the transcript. Use the timestamp format [MM:SS-MM:SS] to determine when specific content appears in the video.

Please analyze each requirement thoroughly and provide your assessment with evidence and reasoning. Consider all available content including caption, hashtags, alt text, and transcript with timing information.`;
  }

  /**
   * Helper method to format seconds into MM:SS format
   */
  private formatTime(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  }

  /**
   * Calls OpenAI API with exponential backoff retry logic
   */
  private async callOpenAIWithRetry(
    params: OpenAI.Chat.ChatCompletionCreateParams,
    attempt = 1
  ): Promise<OpenAI.Chat.ChatCompletion> {
    try {
      return await Promise.race([
        this.openai.chat.completions.create({ ...params, stream: false }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Request timeout')), AI_CONFIG.timeoutMs)
        ),
      ]);
    } catch (error) {
      if (attempt >= AI_CONFIG.maxRetries) {
        throw error;
      }

      // Check if it's a rate limit error
      if (error instanceof Error && error.message.includes('rate_limit')) {
        const backoffMs = Math.min(
          1000 * Math.pow(RATE_LIMIT_CONFIG.backoffMultiplier, attempt - 1),
          RATE_LIMIT_CONFIG.maxBackoffMs
        );
        
        await new Promise(resolve => setTimeout(resolve, backoffMs));
        
        return this.callOpenAIWithRetry(params, attempt + 1);
      }

      // For other errors, retry with shorter backoff
      if (attempt < AI_CONFIG.maxRetries) {
        const backoffMs = 1000 * attempt;
        await new Promise(resolve => setTimeout(resolve, backoffMs));
        
        return this.callOpenAIWithRetry(params, attempt + 1);
      }

      throw error;
    }
  }

  /**
   * Simple rate limiting check
   */
  private async checkRateLimit(): Promise<void> {
    const now = Date.now();
    
    // Reset counter every minute
    if (now - lastResetTime > 60000) {
      requestCount = 0;
      lastResetTime = now;
    }

    if (requestCount >= RATE_LIMIT_CONFIG.maxRequestsPerMinute) {
      const waitTime = 60000 - (now - lastResetTime);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      
      // Reset after waiting
      requestCount = 0;
      lastResetTime = Date.now();
    }

    requestCount++;
  }

  /**
   * Validates input parameters
   */
  private validateInputs(postData: InstagramPostData, requirements: string[]): void {
    if (!postData) {
      throw new Error('Post data is required');
    }

    if (!requirements || requirements.length === 0) {
      throw new Error('At least one requirement must be provided');
    }

    if (requirements.some(req => !req.trim())) {
      throw new Error('All requirements must be non-empty strings');
    }
  }

  /**
   * Fallback to rule-based analysis when AI fails
   */
  private async fallbackAnalysis(
    postData: InstagramPostData,
    requirements: string[],
    startTime: number
  ): Promise<AIAnalysisReport> {
    // Import the original analysis function dynamically to avoid circular dependency
    const { analyzeContent } = await import('./analysis-service');
    const ruleBasedReport = analyzeContent(postData, requirements);

    // Convert rule-based results to AI format
    const aiResults: AIAnalysisResult[] = ruleBasedReport.results.map(result => ({
      ...result,
      confidence: 0.7, // Lower confidence for rule-based analysis
      evidence: [], // Rule-based doesn't provide evidence
      reasoning: 'Analyzed using rule-based fallback due to AI service unavailability',
    }));

    const processingTime = Date.now() - startTime;

    return {
      results: aiResults,
      overallScore: ruleBasedReport.overallScore,
      aiPowered: false,
      processingTime,
      model: 'rule-based-fallback',
    };
  }

  /**
   * Performs AI analysis with progress callback
   */
  public async performAIAnalysisWithProgress(
    postData: InstagramPostData,
    requirements: string[],
    onProgress: (message: string, progress: number) => void
  ): Promise<AIAnalysisResult[]> {
    onProgress('Building AI prompts...', 45);
    
    const systemPrompt = this.buildSystemPrompt();
    const userPrompt = this.buildUserPrompt(postData, requirements);
    
    onProgress('Sending request to OpenAI...', 60);
    
    const response = await this.callOpenAIWithRetry({
      model: AI_CONFIG.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: AI_CONFIG.maxTokens,
      temperature: AI_CONFIG.temperature,
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'instagram_compliance_analysis',
          schema: {
            type: 'object',
            properties: {
              results: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    requirement: { type: 'string' },
                    passed: { type: 'boolean' },
                    explanation: { type: 'string' },
                    confidence: { type: 'number', minimum: 0, maximum: 1 },
                    evidence: { type: 'array', items: { type: 'string' } },
                    reasoning: { type: 'string' },
                  },
                  required: ['requirement', 'passed', 'explanation', 'confidence', 'evidence', 'reasoning'],
                  additionalProperties: false,
                },
              },
              overallAssessment: { type: 'string' },
            },
            required: ['results', 'overallAssessment'],
            additionalProperties: false,
          },
        },
      },
    });

    onProgress('Processing AI response...', 80);

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response content from OpenAI');
    }

    onProgress('Parsing AI analysis results...', 85);

    // Parse and validate response
    const parsedResponse = JSON.parse(content);
    const validatedResponse = AnalysisResponseSchema.parse(parsedResponse);

    return validatedResponse.results;
  }
}

/**
 * Convenience function for backward compatibility
 */
export async function analyzeContentWithAI(
  postData: InstagramPostData,
  requirements: string[]
): Promise<AIAnalysisReport> {
  const service = new AIAnalysisService();
  return service.analyzeContent(postData, requirements);
}

/**
 * Convenience function for backward compatibility with progress callback
 */
export async function analyzeContentWithAIProgress(
  postData: InstagramPostData,
  requirements: string[],
  onProgress: (message: string, progress: number) => void
): Promise<AIAnalysisReport> {
  const startTime = Date.now();
  const service = new AIAnalysisService();
  
  onProgress('Initializing AI analysis...', 0);
  
  try {
    // Check cache first
    onProgress('Checking analysis cache...', 20);
    const cacheKey = analysisCache.generateKey(postData, requirements);
    const cachedResult = analysisCache.get<AIAnalysisReport>(cacheKey);
    
    if (cachedResult) {
      onProgress('Found cached analysis result', 100);
      return {
        ...cachedResult,
        processingTime: Date.now() - startTime,
      };
    }

    // Perform AI analysis with progress updates
    onProgress('Starting AI analysis...', 40);
    const aiResults = await service.performAIAnalysisWithProgress(postData, requirements, onProgress);

    // Calculate overall score
    onProgress('Calculating analysis scores...', 90);
    const passedCount = aiResults.filter(r => r.passed).length;
    const overallScore = requirements.length > 0 
      ? Math.round((passedCount / requirements.length) * 100) 
      : 0;

    const processingTime = Date.now() - startTime;

    const report: AIAnalysisReport = {
      results: aiResults,
      overallScore,
      aiPowered: true,
      processingTime,
      model: AI_CONFIG.model,
    };

    // Cache the result
    onProgress('Caching analysis results...', 95);
    analysisCache.set(cacheKey, report);

    onProgress('AI analysis completed', 100);
    return report;

  } catch (error) {
    console.error('AI analysis failed:', error);

    onProgress('AI failed, using rule-based fallback...', 50);
         // Fallback to rule-based analysis
     const ruleBasedReport = analyzeContent(postData, requirements);
     return {
       ...ruleBasedReport,
       aiPowered: false,
       processingTime: Date.now() - startTime,
       model: 'rule-based-fallback',
       results: ruleBasedReport.results.map((result: AnalysisResult) => ({
         ...result,
         confidence: 0.7,
         evidence: [],
         reasoning: 'Analyzed using rule-based fallback due to AI service error',
       })),
     };
  }
} 