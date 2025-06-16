import { NextRequest, NextResponse } from 'next/server';
import { getInstagramPostData } from '@/lib/instagram-service';
import { analyzeContent } from '@/lib/analysis-service';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { postUrl, requirements } = body;

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

    // Analyze content against requirements
    const analysisReport = analyzeContent(postData, requirementsArray);

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
    console.error('Analysis error:', error);
    
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