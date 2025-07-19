/**
 * Proof of Concept Tests for Request Queue and Circuit Breaker
 * 
 * Demonstrates the functionality and benefits of the enhanced reliability system.
 */

import { RequestQueue } from '../request-queue';
import { CircuitBreaker } from '../circuit-breaker';
import { EnhancedInstagramService } from '../enhanced-instagram-service';

describe('Request Queue POC', () => {
  let queue: RequestQueue;

  beforeEach(() => {
    queue = new RequestQueue('test-queue', {
      maxConcurrent: 2,
      defaultTimeout: 5000,
      retryAttempts: 2,
      retryDelay: 100,
      priorityLevels: 3,
    });
  });

  test('should process requests in priority order', async () => {
    const results: number[] = [];
    const promises: Promise<void>[] = [];

    // Add requests with different priorities
    promises.push(
      queue.enqueue(async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
        results.push(1);
      }, { priority: 0 }) // Low priority
    );

    promises.push(
      queue.enqueue(async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        results.push(2);
      }, { priority: 2 }) // High priority
    );

    promises.push(
      queue.enqueue(async () => {
        await new Promise(resolve => setTimeout(resolve, 20));
        results.push(3);
      }, { priority: 1 }) // Medium priority
    );

    await Promise.all(promises);

    // High priority should execute first, despite being added later
    expect(results[0]).toBe(2);
  });

  test('should respect concurrency limits', async () => {
    let concurrent = 0;
    let maxConcurrent = 0;
    const promises: Promise<void>[] = [];

    for (let i = 0; i < 5; i++) {
      promises.push(
        queue.enqueue(async () => {
          concurrent++;
          maxConcurrent = Math.max(maxConcurrent, concurrent);
          await new Promise(resolve => setTimeout(resolve, 100));
          concurrent--;
        })
      );
    }

    await Promise.all(promises);

    // Should never exceed the configured max concurrent limit
    expect(maxConcurrent).toBeLessThanOrEqual(2);
  });

  test('should provide accurate metrics', async () => {
    const promises: Promise<void>[] = [];

    // Add some successful requests
    for (let i = 0; i < 3; i++) {
      promises.push(
        queue.enqueue(async () => {
          await new Promise(resolve => setTimeout(resolve, 10));
        })
      );
    }

    // Add a failing request
    promises.push(
      queue.enqueue(async () => {
        throw new Error('Test failure');
      }).catch(() => {}) // Ignore the error for this test
    );

    await Promise.all(promises);

    const metrics = queue.getMetrics();
    expect(metrics.completedRequests).toBe(3);
    expect(metrics.failedRequests).toBe(1);
    expect(metrics.queueLength).toBe(0);
    expect(metrics.activeRequests).toBe(0);
  });
});

describe('Circuit Breaker POC', () => {
  let breaker: CircuitBreaker;

  beforeEach(() => {
    breaker = new CircuitBreaker('test-breaker', {
      failureThreshold: 3,
      recoveryTimeout: 1000,
      monitoringPeriod: 5000,
      expectedFailureRate: 0.5,
    });
  });

  test('should open after exceeding failure threshold', async () => {
    // Cause enough failures to open the circuit
    for (let i = 0; i < 3; i++) {
      try {
        await breaker.execute(async () => {
          throw new Error('Test failure');
        });
      } catch (error) {
        // Expected
      }
    }

    const metrics = breaker.getMetrics();
    expect(metrics.state).toBe('OPEN');
    expect(metrics.failureCount).toBe(3);
  });

  test('should block requests when open', async () => {
    // Force the breaker to open
    breaker.forceOpen();

    await expect(
      breaker.execute(async () => 'success')
    ).rejects.toThrow('Circuit breaker is OPEN');
  });

  test('should transition to half-open after recovery timeout', async () => {
    // Open the circuit
    breaker.forceOpen();
    
    // Wait for recovery timeout (simulated)
    await new Promise(resolve => setTimeout(resolve, 1100));

    // Next request should transition to HALF_OPEN
    try {
      await breaker.execute(async () => 'success');
    } catch (error) {
      // Expected if still blocked
    }

    const metrics = breaker.getMetrics();
    expect(metrics.state).toMatch(/HALF_OPEN|CLOSED/);
  });

  test('should reset failure count on successful requests', async () => {
    // Add some failures
    for (let i = 0; i < 2; i++) {
      try {
        await breaker.execute(async () => {
          throw new Error('Test failure');
        });
      } catch (error) {
        // Expected
      }
    }

    // Add successful requests
    for (let i = 0; i < 5; i++) {
      await breaker.execute(async () => 'success');
    }

    const metrics = breaker.getMetrics();
    expect(metrics.state).toBe('CLOSED');
    expect(metrics.failureCount).toBeLessThan(2); // Should be reduced
  });
});

describe('Enhanced Instagram Service POC', () => {
  let service: EnhancedInstagramService;

  beforeEach(() => {
    service = new EnhancedInstagramService({
      enableQueueing: true,
      enableCircuitBreaker: true,
      priorityLevel: 1,
      maxRetries: 2,
      timeoutMs: 5000,
    });
  });

  test('should validate Instagram URLs', async () => {
    const invalidUrl = 'https://example.com/not-instagram';
    
    await expect(
      service.getInstagramPostData(invalidUrl)
    ).rejects.toThrow('Invalid Instagram URL');
  });

  test('should return mock data when no API key', async () => {
    // Remove API key for this test
    const originalApiKey = process.env.APIFY_API_KEY;
    delete process.env.APIFY_API_KEY;

    const validUrl = 'https://www.instagram.com/p/test123/';
    const result = await service.getInstagramPostData(validUrl);

    expect(result).toBeDefined();
    expect(result.caption).toContain('Sneak Eats');
    expect(result.mediaType).toBe('video');

    // Restore API key
    if (originalApiKey) {
      process.env.APIFY_API_KEY = originalApiKey;
    }
  });

  test('should provide service metrics', () => {
    const metrics = service.getMetrics();

    expect(metrics).toHaveProperty('queue');
    expect(metrics).toHaveProperty('circuitBreaker');
    expect(metrics).toHaveProperty('transcriptionQueue');
    expect(metrics).toHaveProperty('whisperCircuitBreaker');

    expect(metrics.queue).toHaveProperty('queueLength');
    expect(metrics.circuitBreaker).toHaveProperty('state');
  });

  test('should reset service state', () => {
    service.reset();
    
    const metrics = service.getMetrics();
    expect(metrics.circuitBreaker.state).toBe('CLOSED');
    expect(metrics.whisperCircuitBreaker.state).toBe('CLOSED');
  });
});

describe('Integration POC', () => {
  test('should demonstrate queue and circuit breaker working together', async () => {
    const queue = new RequestQueue('integration-test');
    const breaker = new CircuitBreaker('integration-test', {
      failureThreshold: 2,
      recoveryTimeout: 500,
      monitoringPeriod: 2000,
      expectedFailureRate: 0.3,
    });

    let callCount = 0;
    const unreliableService = async () => {
      callCount++;
      if (callCount <= 3) {
        throw new Error(`Failure ${callCount}`);
      }
      return `Success on call ${callCount}`;
    };

    // First few calls will fail and open the circuit
    const promises: Array<Promise<string | void>> = [];
    
    for (let i = 0; i < 5; i++) {
      promises.push(
        queue.enqueue(
          () => breaker.execute(unreliableService),
          { circuitBreaker: breaker }
        ).catch(error => {
          // Expected failures
          console.log(`Expected failure: ${error.message}`);
        })
      );
    }

    await Promise.all(promises);

    const queueMetrics = queue.getMetrics();
    const breakerMetrics = breaker.getMetrics();

    // Should have some failures and circuit should be open or have high failure count
    expect(queueMetrics.failedRequests).toBeGreaterThan(0);
    expect(breakerMetrics.failureCount).toBeGreaterThan(0);
    
    console.log('Integration test metrics:');
    console.log('Queue:', queueMetrics);
    console.log('Circuit Breaker:', breakerMetrics);
  });
});