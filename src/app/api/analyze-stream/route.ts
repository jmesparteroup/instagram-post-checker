import { NextRequest } from 'next/server';
import { getInstagramPostDataWithProgress } from '@/lib/instagram-service';
import { analyzeContent } from '@/lib/analysis-service';
import { analyzeContentWithAIProgress } from '@/lib/ai-analysis-service';

export const maxDuration = 60;

export interface ProgressUpdate {
  step: 'validating' | 'fetching' | 'transcribing' | 'analyzing' | 'complete' | 'error';
  message: string;
  progress: number; // 0-100
  data?: unknown;
  error?: string;
}

export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();
  
  const stream = new ReadableStream({
    start(controller) {
      const sendUpdate = (update: ProgressUpdate) => {
        const data = `data: ${JSON.stringify(update)}\n\n`;
        controller.enqueue(encoder.encode(data));
      };

      const processRequest = async () => {
        try {
          const body = await request.json();
          const { postUrl, requirements, useAI = true } = body;

          // Step 1: Validation
          sendUpdate({
            step: 'validating',
            message: 'Validating input parameters...',
            progress: 5
          });

          // Validate input
          if (!postUrl || typeof postUrl !== 'string') {
            sendUpdate({
              step: 'error',
              message: 'Post URL is required and must be a string',
              progress: 0,
              error: 'Post URL is required and must be a string'
            });
            controller.close();
            return;
          }

          if (!requirements || typeof requirements !== 'string') {
            sendUpdate({
              step: 'error',
              message: 'Requirements are required and must be a string',
              progress: 0,
              error: 'Requirements are required and must be a string'
            });
            controller.close();
            return;
          }

          // Parse requirements into array
          const requirementsArray = requirements
            .split('\n')
            .map((req: string) => req.trim())
            .filter((req: string) => req.length > 0);

          if (requirementsArray.length === 0) {
            sendUpdate({
              step: 'error',
              message: 'At least one requirement must be provided',
              progress: 0,
              error: 'At least one requirement must be provided'
            });
            controller.close();
            return;
          }

          sendUpdate({
            step: 'validating',
            message: 'Input validation completed',
            progress: 10
          });

          // Step 2: Fetch Instagram post data with progress
          sendUpdate({
            step: 'fetching',
            message: 'Fetching Instagram post data...',
            progress: 15
          });

          const postData = await getInstagramPostDataWithProgress(postUrl, (progressMsg: string, progress: number) => {
            sendUpdate({
              step: 'fetching',
              message: progressMsg,
              progress: Math.min(15 + (progress * 0.4), 55) // 15-55% for fetching
            });
          });

          sendUpdate({
            step: 'fetching',
            message: 'Instagram data fetched successfully',
            progress: 55,
            data: {
              mediaType: postData.mediaType,
              hasTranscript: postData.transcript.length > 0
            }
          });

          // Step 3: Analysis
          sendUpdate({
            step: 'analyzing',
            message: 'Starting content analysis...',
            progress: 60
          });

          let analysisReport;
          if (useAI) {
            try {
              analysisReport = await analyzeContentWithAIProgress(postData, requirementsArray, (progressMsg: string, progress: number) => {
                sendUpdate({
                  step: 'analyzing',
                  message: progressMsg,
                  progress: Math.min(60 + (progress * 0.35), 95) // 60-95% for AI analysis
                });
              });
            } catch {
              sendUpdate({
                step: 'analyzing',
                message: 'AI analysis failed, falling back to rule-based analysis...',
                progress: 70
              });

              // Fallback to rule-based analysis
              const ruleBasedReport = analyzeContent(postData, requirementsArray);
              analysisReport = {
                ...ruleBasedReport,
                aiPowered: false,
                processingTime: 0,
                model: 'rule-based-fallback',
                results: ruleBasedReport.results.map(result => ({
                  ...result,
                  confidence: 0.7,
                  evidence: [],
                  reasoning: 'Analyzed using rule-based fallback due to AI service error',
                })),
              };
            }
          } else {
            // Use rule-based analysis
            const ruleBasedReport = analyzeContent(postData, requirementsArray);
            analysisReport = {
              ...ruleBasedReport,
              aiPowered: false,
              processingTime: 0,
              model: 'rule-based',
              results: ruleBasedReport.results.map(result => ({
                ...result,
                confidence: 0.8,
                evidence: [],
                reasoning: 'Analyzed using rule-based approach',
              })),
            };
          }

          // Step 4: Complete
          sendUpdate({
            step: 'complete',
            message: 'Analysis completed successfully',
            progress: 100,
            data: {
              success: true,
              postData: {
                caption: postData.caption,
                mediaType: postData.mediaType,
                mediaUrl: postData.mediaUrl,
              },
              analysis: analysisReport,
            }
          });

        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
          sendUpdate({
            step: 'error',
            message: errorMessage,
            progress: 0,
            error: errorMessage
          });
        } finally {
          controller.close();
        }
      };

      processRequest();
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

export async function GET() {
  return new Response(
    JSON.stringify({ error: 'Method not allowed. Use POST to analyze Instagram posts.' }),
    { status: 405, headers: { 'Content-Type': 'application/json' } }
  );
} 