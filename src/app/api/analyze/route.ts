import { NextRequest, NextResponse } from 'next/server';
import { getInstagramPostData } from '@/lib/instagram-service';
import { analyzeContent } from '@/lib/analysis-service';
import { analyzeContentWithAI } from '@/lib/ai-analysis-service';

// make this route have maximum time of 30 seconds
export const maxDuration = 30

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { postUrl, requirements, useAI = true } = body;

    // Validate input
    if (!postUrl || typeof postUrl !== 'string') {
      return NextResponse.json(
        { error: 'Post URL is required and must be a string' },
        { status: 400 }
      );
    }

    if (!requirements || typeof requirements !== 'string') {
      return NextResponse.json(
        { error: 'Requirements are required and must be a string' },
        { status: 400 }
      );
    }

    // Parse requirements into array
    const requirementsArray = requirements
      .split('\n')
      .map((req: string) => req.trim())
      .filter((req: string) => req.length > 0);

    if (requirementsArray.length === 0) {
      return NextResponse.json(
        { error: 'At least one requirement must be provided' },
        { status: 400 }
      );
    }

    // Fetch Instagram post data
    const postData = await getInstagramPostData(postUrl);

    // Analyze content against requirements using AI or rule-based approach
    let analysisReport;
    if (useAI) {
      try {
        analysisReport = await analyzeContentWithAI(postData, requirementsArray);
        console.log('AI analysis report:', analysisReport);
      } catch (aiError) {
        console.warn('AI analysis failed, falling back to rule-based:', aiError);
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

    // Return successful response
    return NextResponse.json({
      success: true,
      postData: {
        caption: postData.caption,
        mediaType: postData.mediaType,
        mediaUrl: postData.mediaUrl,
      },
      analysis: analysisReport,
    });

  } catch (error) {
    
    // Handle specific error types
    if (error instanceof Error) {
      if (error.message.includes('Invalid Instagram URL')) {
        return NextResponse.json(
          { error: 'Please provide a valid Instagram URL' },
          { status: 400 }
        );
      }
    }

    // Generic error response
    return NextResponse.json(
      { error: 'An error occurred while analyzing the post. Please try again.' },
      { status: 500 }
    );
  }
}

// Handle unsupported methods
export async function GET() {
  return NextResponse.json(
    { error: 'Method not allowed. Use POST to analyze Instagram posts.' },
    { status: 405 }
  );
} 