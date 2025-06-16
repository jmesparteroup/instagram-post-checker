import { NextResponse } from 'next/server';
import { analysisCache } from '@/lib/cache-service';

/**
 * GET /api/cache-stats
 * Returns cache statistics for monitoring and debugging
 */
export async function GET() {
  try {
    const stats = analysisCache.getStats();
    
    return NextResponse.json({
      success: true,
      cache: {
        ...stats,
        hitRate: stats.totalEntries > 0 
          ? Math.round((stats.activeEntries / stats.totalEntries) * 100) 
          : 0,
        utilizationRate: Math.round((stats.totalEntries / stats.maxSize) * 100),
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error fetching cache stats:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch cache statistics' 
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/cache-stats
 * Clears the analysis cache
 */
export async function DELETE() {
  try {
    analysisCache.clear();
    
    return NextResponse.json({
      success: true,
      message: 'Cache cleared successfully',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error clearing cache:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to clear cache' 
      },
      { status: 500 }
    );
  }
} 