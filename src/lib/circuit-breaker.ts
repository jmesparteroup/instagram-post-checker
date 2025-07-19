/**
 * Circuit Breaker Implementation
 * 
 * Prevents cascading failures by monitoring failed requests and temporarily
 * blocking requests when failure thresholds are exceeded.
 */

export interface CircuitBreakerConfig {
  failureThreshold: number;
  recoveryTimeout: number;
  monitoringPeriod: number;
  expectedFailureRate: number;
}

export interface CircuitBreakerMetrics {
  state: CircuitBreakerState;
  failureCount: number;
  successCount: number;
  lastFailureTime: number | null;
  totalRequests: number;
  failureRate: number;
}

export type CircuitBreakerState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export class CircuitBreakerError extends Error {
  constructor(public readonly state: CircuitBreakerState) {
    super(`Circuit breaker is ${state}. Request blocked to prevent cascading failures.`);
    this.name = 'CircuitBreakerError';
  }
}

/**
 * Circuit Breaker implementation for protecting external service calls
 */
export class CircuitBreaker {
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime: number | null = null;
  private state: CircuitBreakerState = 'CLOSED';
  private nextAttempt = 0;
  private totalRequests = 0;

  constructor(
    private readonly name: string,
    private readonly config: CircuitBreakerConfig = {
      failureThreshold: 5,
      recoveryTimeout: 60000, // 1 minute
      monitoringPeriod: 300000, // 5 minutes
      expectedFailureRate: 0.1, // 10%
    }
  ) {}

  /**
   * Executes a function with circuit breaker protection
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() < this.nextAttempt) {
        throw new CircuitBreakerError(this.state);
      }
      // Transition to HALF_OPEN for testing
      this.state = 'HALF_OPEN';
    }

    this.totalRequests++;

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  /**
   * Get current circuit breaker metrics
   */
  getMetrics(): CircuitBreakerMetrics {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime,
      totalRequests: this.totalRequests,
      failureRate: this.totalRequests > 0 ? this.failureCount / this.totalRequests : 0,
    };
  }

  /**
   * Reset circuit breaker to CLOSED state
   */
  reset(): void {
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = null;
    this.nextAttempt = 0;
    this.totalRequests = 0;
  }

  /**
   * Force circuit breaker to OPEN state
   */
  forceOpen(): void {
    this.state = 'OPEN';
    this.nextAttempt = Date.now() + this.config.recoveryTimeout;
  }

  /**
   * Handle successful request
   */
  private onSuccess(): void {
    this.successCount++;
    
    if (this.state === 'HALF_OPEN') {
      // Successful request in HALF_OPEN state - transition to CLOSED
      this.state = 'CLOSED';
      this.failureCount = 0;
      console.log(`[CircuitBreaker:${this.name}] State transition: HALF_OPEN -> CLOSED`);
    }

    // Reset failure count if we've been successful for a while
    if (this.successCount >= this.config.failureThreshold) {
      this.failureCount = Math.max(0, this.failureCount - 1);
    }
  }

  /**
   * Handle failed request
   */
  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.state === 'HALF_OPEN') {
      // Failed request in HALF_OPEN state - go back to OPEN
      this.state = 'OPEN';
      this.nextAttempt = Date.now() + this.config.recoveryTimeout;
      console.log(`[CircuitBreaker:${this.name}] State transition: HALF_OPEN -> OPEN`);
      return;
    }

    // Check if we should open the circuit
    if (this.state === 'CLOSED' && this.shouldOpen()) {
      this.state = 'OPEN';
      this.nextAttempt = Date.now() + this.config.recoveryTimeout;
      console.log(`[CircuitBreaker:${this.name}] State transition: CLOSED -> OPEN (failures: ${this.failureCount})`);
    }
  }

  /**
   * Determine if circuit should be opened based on failure criteria
   */
  private shouldOpen(): boolean {
    // Simple threshold-based check
    if (this.failureCount >= this.config.failureThreshold) {
      return true;
    }

    // Rate-based check for more sophisticated scenarios
    if (this.totalRequests >= this.config.failureThreshold * 2) {
      const failureRate = this.failureCount / this.totalRequests;
      if (failureRate > this.config.expectedFailureRate) {
        return true;
      }
    }

    return false;
  }
}

/**
 * Circuit Breaker Registry for managing multiple circuit breakers
 */
export class CircuitBreakerRegistry {
  private static instance: CircuitBreakerRegistry;
  private breakers = new Map<string, CircuitBreaker>();

  static getInstance(): CircuitBreakerRegistry {
    if (!CircuitBreakerRegistry.instance) {
      CircuitBreakerRegistry.instance = new CircuitBreakerRegistry();
    }
    return CircuitBreakerRegistry.instance;
  }

  /**
   * Get or create a circuit breaker for a service
   */
  getBreaker(name: string, config?: Partial<CircuitBreakerConfig>): CircuitBreaker {
    if (!this.breakers.has(name)) {
      const defaultConfig: CircuitBreakerConfig = {
        failureThreshold: 5,
        recoveryTimeout: 60000,
        monitoringPeriod: 300000,
        expectedFailureRate: 0.1,
      };
      
      this.breakers.set(name, new CircuitBreaker(name, { ...defaultConfig, ...config }));
    }
    
    return this.breakers.get(name)!;
  }

  /**
   * Get metrics for all circuit breakers
   */
  getAllMetrics(): Record<string, CircuitBreakerMetrics> {
    const metrics: Record<string, CircuitBreakerMetrics> = {};
    
    for (const [name, breaker] of this.breakers.entries()) {
      metrics[name] = breaker.getMetrics();
    }
    
    return metrics;
  }

  /**
   * Reset all circuit breakers
   */
  resetAll(): void {
    for (const breaker of this.breakers.values()) {
      breaker.reset();
    }
  }
}

// Pre-configured circuit breakers for common services
export const circuitBreakers = {
  instagram: CircuitBreakerRegistry.getInstance().getBreaker('instagram', {
    failureThreshold: 3,
    recoveryTimeout: 30000, // 30 seconds
    expectedFailureRate: 0.15, // Instagram scraping can be flaky
  }),
  
  openai: CircuitBreakerRegistry.getInstance().getBreaker('openai', {
    failureThreshold: 5,
    recoveryTimeout: 60000, // 1 minute
    expectedFailureRate: 0.05, // OpenAI is generally reliable
  }),
  
  whisper: CircuitBreakerRegistry.getInstance().getBreaker('whisper', {
    failureThreshold: 3,
    recoveryTimeout: 45000, // 45 seconds
    expectedFailureRate: 0.1, // Video transcription can fail
  }),
};