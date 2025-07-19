/**
 * System Metrics API Endpoint
 * 
 * Provides monitoring and health check information for the enhanced
 * Instagram service with request queues and circuit breakers.
 */

import { NextRequest, NextResponse } from 'next/server';
import { RequestQueueRegistry } from '@/lib/request-queue';
import { CircuitBreakerRegistry } from '@/lib/circuit-breaker';
import { analysisCache } from '@/lib/cache-service';

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const format = url.searchParams.get('format') || 'json';
    const detailed = url.searchParams.get('detailed') === 'true';

    // Collect all metrics
    const queueRegistry = RequestQueueRegistry.getInstance();
    const circuitBreakerRegistry = CircuitBreakerRegistry.getInstance();

    const metrics = {
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      
      // Queue metrics
      queues: queueRegistry.getAllMetrics(),
      
      // Circuit breaker metrics
      circuitBreakers: circuitBreakerRegistry.getAllMetrics(),
      
      // Cache metrics
      cache: analysisCache.getStats(),
      
      // Health status
      health: {
        overall: 'healthy',
        services: calculateServiceHealth(
          queueRegistry.getAllMetrics(),
          circuitBreakerRegistry.getAllMetrics()
        ),
      },
    };

    // Add detailed information if requested
    if (detailed) {
      metrics.detailed = {
        queueStatus: queueRegistry.getStatusSummary(),
        environment: {
          nodeVersion: process.version,
          platform: process.platform,
          arch: process.arch,
        },
        apiKeys: {
          apify: !!process.env.APIFY_API_KEY,
          openai: !!process.env.OPENAI_API_KEY,
        },
      };
    }

    // Return in different formats
    if (format === 'prometheus') {
      return new Response(formatPrometheusMetrics(metrics), {
        headers: { 'Content-Type': 'text/plain' },
      });
    }

    if (format === 'text') {
      return new Response(formatTextMetrics(metrics), {
        headers: { 'Content-Type': 'text/plain' },
      });
    }

    // Default JSON format
    return NextResponse.json(metrics);

  } catch (error) {
    console.error('Error collecting system metrics:', error);
    return NextResponse.json(
      { error: 'Failed to collect system metrics' },
      { status: 500 }
    );
  }
}

/**
 * Calculate overall health status based on circuit breaker states
 */
function calculateServiceHealth(
  queueMetrics: Record<string, any>,
  circuitBreakerMetrics: Record<string, any>
): Record<string, string> {
  const services: Record<string, string> = {};

  // Check circuit breaker states
  for (const [name, metrics] of Object.entries(circuitBreakerMetrics)) {
    if (metrics.state === 'OPEN') {
      services[name] = 'unhealthy';
    } else if (metrics.state === 'HALF_OPEN') {
      services[name] = 'degraded';
    } else if (metrics.failureRate > 0.1) {
      services[name] = 'degraded';
    } else {
      services[name] = 'healthy';
    }
  }

  // Check queue health
  for (const [name, metrics] of Object.entries(queueMetrics)) {
    const queueHealth = services[name] || 'healthy';
    
    // Large queue backlogs indicate potential issues
    if (metrics.queueLength > 10) {
      if (queueHealth === 'healthy') {
        services[name] = 'degraded';
      }
    }
    
    // Very high failure rates
    if (metrics.failedRequests > metrics.completedRequests) {
      services[name] = 'unhealthy';
    }
  }

  return services;
}

/**
 * Format metrics for Prometheus scraping
 */
function formatPrometheusMetrics(metrics: any): string {
  const lines: string[] = [];

  // Queue metrics
  for (const [queueName, queueMetrics] of Object.entries(metrics.queues)) {
    const m = queueMetrics as any;
    lines.push(`queue_length{queue="${queueName}"} ${m.queueLength}`);
    lines.push(`queue_active_requests{queue="${queueName}"} ${m.activeRequests}`);
    lines.push(`queue_completed_requests{queue="${queueName}"} ${m.completedRequests}`);
    lines.push(`queue_failed_requests{queue="${queueName}"} ${m.failedRequests}`);
    lines.push(`queue_average_wait_time{queue="${queueName}"} ${m.averageWaitTime}`);
    lines.push(`queue_average_processing_time{queue="${queueName}"} ${m.averageProcessingTime}`);
  }

  // Circuit breaker metrics
  for (const [breakerName, breakerMetrics] of Object.entries(metrics.circuitBreakers)) {
    const m = breakerMetrics as any;
    const stateValue = m.state === 'CLOSED' ? 0 : m.state === 'HALF_OPEN' ? 1 : 2;
    lines.push(`circuit_breaker_state{breaker="${breakerName}"} ${stateValue}`);
    lines.push(`circuit_breaker_failure_count{breaker="${breakerName}"} ${m.failureCount}`);
    lines.push(`circuit_breaker_success_count{breaker="${breakerName}"} ${m.successCount}`);
    lines.push(`circuit_breaker_total_requests{breaker="${breakerName}"} ${m.totalRequests}`);
    lines.push(`circuit_breaker_failure_rate{breaker="${breakerName}"} ${m.failureRate}`);
  }

  // Cache metrics
  lines.push(`cache_total_entries ${metrics.cache.totalEntries}`);
  lines.push(`cache_active_entries ${metrics.cache.activeEntries}`);
  lines.push(`cache_expired_entries ${metrics.cache.expiredEntries}`);

  // Memory metrics
  lines.push(`memory_used ${metrics.memory.heapUsed}`);
  lines.push(`memory_total ${metrics.memory.heapTotal}`);
  lines.push(`memory_external ${metrics.memory.external}`);

  // Uptime
  lines.push(`uptime_seconds ${metrics.uptime}`);

  return lines.join('\n') + '\n';
}

/**
 * Format metrics as human-readable text
 */
function formatTextMetrics(metrics: any): string {
  const lines: string[] = [];
  
  lines.push('=== System Metrics ===');
  lines.push(`Timestamp: ${metrics.timestamp}`);
  lines.push(`Uptime: ${Math.floor(metrics.uptime)}s`);
  lines.push('');

  lines.push('=== Queue Status ===');
  for (const [name, queueMetrics] of Object.entries(metrics.queues)) {
    const m = queueMetrics as any;
    lines.push(`${name.toUpperCase()}:`);
    lines.push(`  Queue Length: ${m.queueLength}`);
    lines.push(`  Active Requests: ${m.activeRequests}`);
    lines.push(`  Completed: ${m.completedRequests}`);
    lines.push(`  Failed: ${m.failedRequests}`);
    lines.push(`  Avg Wait Time: ${m.averageWaitTime.toFixed(2)}ms`);
    lines.push(`  Avg Processing Time: ${m.averageProcessingTime.toFixed(2)}ms`);
    lines.push('');
  }

  lines.push('=== Circuit Breaker Status ===');
  for (const [name, breakerMetrics] of Object.entries(metrics.circuitBreakers)) {
    const m = breakerMetrics as any;
    lines.push(`${name.toUpperCase()}:`);
    lines.push(`  State: ${m.state}`);
    lines.push(`  Failure Count: ${m.failureCount}`);
    lines.push(`  Success Count: ${m.successCount}`);
    lines.push(`  Failure Rate: ${(m.failureRate * 100).toFixed(2)}%`);
    lines.push('');
  }

  lines.push('=== Cache Status ===');
  lines.push(`Total Entries: ${metrics.cache.totalEntries}`);
  lines.push(`Active Entries: ${metrics.cache.activeEntries}`);
  lines.push(`Expired Entries: ${metrics.cache.expiredEntries}`);
  lines.push('');

  lines.push('=== Health Status ===');
  lines.push(`Overall: ${metrics.health.overall}`);
  for (const [service, status] of Object.entries(metrics.health.services)) {
    lines.push(`${service}: ${status}`);
  }

  return lines.join('\n');
}

// Also support POST for triggering actions
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, service } = body;

    const queueRegistry = RequestQueueRegistry.getInstance();
    const circuitBreakerRegistry = CircuitBreakerRegistry.getInstance();

    switch (action) {
      case 'reset_circuit_breakers':
        if (service) {
          // Reset specific service
          circuitBreakerRegistry.getBreaker(service, {}).reset();
        } else {
          // Reset all
          circuitBreakerRegistry.resetAll();
        }
        return NextResponse.json({ success: true, message: 'Circuit breakers reset' });

      case 'clear_queues':
        if (service) {
          // Clear specific queue
          queueRegistry.getQueue(service, {}).clear();
        } else {
          // Clear all queues
          queueRegistry.clearAll();
        }
        return NextResponse.json({ success: true, message: 'Queues cleared' });

      case 'clear_cache':
        analysisCache.clear();
        return NextResponse.json({ success: true, message: 'Cache cleared' });

      default:
        return NextResponse.json(
          { error: 'Unknown action' },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('Error executing system action:', error);
    return NextResponse.json(
      { error: 'Failed to execute action' },
      { status: 500 }
    );
  }
}