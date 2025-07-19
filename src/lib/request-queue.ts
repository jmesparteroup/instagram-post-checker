/**
 * Request Queue Implementation
 * 
 * Manages concurrent requests to external APIs with priority queuing,
 * rate limiting, and resource management.
 */

import { CircuitBreaker, circuitBreakers } from './circuit-breaker';

export interface QueueConfig {
  maxConcurrent: number;
  defaultTimeout: number;
  retryAttempts: number;
  retryDelay: number;
  priorityLevels: number;
}

export interface QueueMetrics {
  queueLength: number;
  activeRequests: number;
  completedRequests: number;
  failedRequests: number;
  averageWaitTime: number;
  averageProcessingTime: number;
}

export interface QueueItem<T> {
  id: string;
  fn: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (error: Error) => void;
  priority: number;
  queuedAt: number;
  attempts: number;
  circuitBreaker?: CircuitBreaker;
  timeout?: number;
}

/**
 * Priority-based request queue with circuit breaker integration
 */
export class RequestQueue {
  private queue: QueueItem<any>[] = [];
  private activeRequests = new Set<string>();
  private processing = false;
  private completedRequests = 0;
  private failedRequests = 0;
  private totalWaitTime = 0;
  private totalProcessingTime = 0;

  constructor(
    private readonly name: string,
    private readonly config: QueueConfig = {
      maxConcurrent: 3,
      defaultTimeout: 30000,
      retryAttempts: 3,
      retryDelay: 1000,
      priorityLevels: 5,
    }
  ) {}

  /**
   * Add a request to the queue
   */
  async enqueue<T>(
    fn: () => Promise<T>,
    options: {
      priority?: number;
      timeout?: number;
      circuitBreaker?: CircuitBreaker;
      retryAttempts?: number;
    } = {}
  ): Promise<T> {
    const id = this.generateId();
    const priority = Math.max(0, Math.min(options.priority || 0, this.config.priorityLevels - 1));

    return new Promise<T>((resolve, reject) => {
      const queueItem: QueueItem<T> = {
        id,
        fn,
        resolve,
        reject,
        priority,
        queuedAt: Date.now(),
        attempts: 0,
        circuitBreaker: options.circuitBreaker,
        timeout: options.timeout || this.config.defaultTimeout,
      };

      // Insert based on priority (higher priority first)
      const insertIndex = this.queue.findIndex(item => item.priority < priority);
      if (insertIndex === -1) {
        this.queue.push(queueItem);
      } else {
        this.queue.splice(insertIndex, 0, queueItem);
      }

      this.processQueue();
    });
  }

  /**
   * Process queued requests
   */
  private async processQueue(): Promise<void> {
    if (this.processing || this.activeRequests.size >= this.config.maxConcurrent) {
      return;
    }

    this.processing = true;

    while (this.queue.length > 0 && this.activeRequests.size < this.config.maxConcurrent) {
      const item = this.queue.shift()!;
      this.activeRequests.add(item.id);

      // Process item asynchronously
      this.processItem(item).finally(() => {
        this.activeRequests.delete(item.id);
      });
    }

    this.processing = false;

    // Continue processing if there are more items and capacity
    if (this.queue.length > 0 && this.activeRequests.size < this.config.maxConcurrent) {
      setImmediate(() => this.processQueue());
    }
  }

  /**
   * Process individual queue item
   */
  private async processItem<T>(item: QueueItem<T>): Promise<void> {
    const startTime = Date.now();
    const waitTime = startTime - item.queuedAt;
    this.totalWaitTime += waitTime;

    try {
      // Execute with timeout
      const result = await this.executeWithTimeout(item);
      
      const processingTime = Date.now() - startTime;
      this.totalProcessingTime += processingTime;
      this.completedRequests++;

      item.resolve(result);
    } catch (error) {
      // Check if we should retry
      if (this.shouldRetry(item, error as Error)) {
        await this.scheduleRetry(item);
      } else {
        this.failedRequests++;
        item.reject(error as Error);
      }
    }
  }

  /**
   * Execute function with timeout and circuit breaker
   */
  private async executeWithTimeout<T>(item: QueueItem<T>): Promise<T> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Request timeout')), item.timeout);
    });

    const executePromise = item.circuitBreaker
      ? item.circuitBreaker.execute(item.fn)
      : item.fn();

    return Promise.race([executePromise, timeoutPromise]);
  }

  /**
   * Determine if request should be retried
   */
  private shouldRetry(item: QueueItem<any>, error: Error): boolean {
    if (item.attempts >= this.config.retryAttempts) {
      return false;
    }

    // Don't retry circuit breaker errors
    if (error.name === 'CircuitBreakerError') {
      return false;
    }

    // Don't retry validation errors (4xx status codes)
    if (error.message.includes('400') || error.message.includes('401') || error.message.includes('403')) {
      return false;
    }

    return true;
  }

  /**
   * Schedule retry with exponential backoff
   */
  private async scheduleRetry<T>(item: QueueItem<T>): Promise<void> {
    item.attempts++;
    const delay = this.config.retryDelay * Math.pow(2, item.attempts - 1);

    setTimeout(() => {
      // Re-add to queue with same priority
      const insertIndex = this.queue.findIndex(queueItem => queueItem.priority < item.priority);
      if (insertIndex === -1) {
        this.queue.push(item);
      } else {
        this.queue.splice(insertIndex, 0, item);
      }

      this.processQueue();
    }, delay);
  }

  /**
   * Get current queue metrics
   */
  getMetrics(): QueueMetrics {
    const totalRequests = this.completedRequests + this.failedRequests;
    
    return {
      queueLength: this.queue.length,
      activeRequests: this.activeRequests.size,
      completedRequests: this.completedRequests,
      failedRequests: this.failedRequests,
      averageWaitTime: totalRequests > 0 ? this.totalWaitTime / totalRequests : 0,
      averageProcessingTime: this.completedRequests > 0 ? this.totalProcessingTime / this.completedRequests : 0,
    };
  }

  /**
   * Clear all pending requests
   */
  clear(): void {
    while (this.queue.length > 0) {
      const item = this.queue.shift()!;
      item.reject(new Error('Queue cleared'));
    }
  }

  /**
   * Get queue status summary
   */
  getStatus(): string {
    const metrics = this.getMetrics();
    return `Queue[${this.name}]: ${metrics.queueLength} pending, ${metrics.activeRequests} active, ${metrics.completedRequests} completed, ${metrics.failedRequests} failed`;
  }

  /**
   * Generate unique ID for queue items
   */
  private generateId(): string {
    return `${this.name}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * Request Queue Registry for managing multiple queues
 */
export class RequestQueueRegistry {
  private static instance: RequestQueueRegistry;
  private queues = new Map<string, RequestQueue>();

  static getInstance(): RequestQueueRegistry {
    if (!RequestQueueRegistry.instance) {
      RequestQueueRegistry.instance = new RequestQueueRegistry();
    }
    return RequestQueueRegistry.instance;
  }

  /**
   * Get or create a queue for a service
   */
  getQueue(name: string, config?: Partial<QueueConfig>): RequestQueue {
    if (!this.queues.has(name)) {
      const defaultConfig: QueueConfig = {
        maxConcurrent: 3,
        defaultTimeout: 30000,
        retryAttempts: 3,
        retryDelay: 1000,
        priorityLevels: 5,
      };
      
      this.queues.set(name, new RequestQueue(name, { ...defaultConfig, ...config }));
    }
    
    return this.queues.get(name)!;
  }

  /**
   * Get metrics for all queues
   */
  getAllMetrics(): Record<string, QueueMetrics> {
    const metrics: Record<string, QueueMetrics> = {};
    
    for (const [name, queue] of this.queues.entries()) {
      metrics[name] = queue.getMetrics();
    }
    
    return metrics;
  }

  /**
   * Get status summary for all queues
   */
  getStatusSummary(): string[] {
    return Array.from(this.queues.values()).map(queue => queue.getStatus());
  }

  /**
   * Clear all queues
   */
  clearAll(): void {
    for (const queue of this.queues.values()) {
      queue.clear();
    }
  }
}

// Pre-configured queues for different service types
export const requestQueues = {
  // Instagram scraping - lower concurrency due to rate limits
  instagram: RequestQueueRegistry.getInstance().getQueue('instagram', {
    maxConcurrent: 2,
    defaultTimeout: 45000,
    retryAttempts: 2,
  }),
  
  // OpenAI API - moderate concurrency
  openai: RequestQueueRegistry.getInstance().getQueue('openai', {
    maxConcurrent: 3,
    defaultTimeout: 60000,
    retryAttempts: 3,
  }),
  
  // Video transcription - higher timeout, lower concurrency
  transcription: RequestQueueRegistry.getInstance().getQueue('transcription', {
    maxConcurrent: 1,
    defaultTimeout: 120000,
    retryAttempts: 2,
  }),
  
  // General API calls
  general: RequestQueueRegistry.getInstance().getQueue('general', {
    maxConcurrent: 5,
    defaultTimeout: 30000,
    retryAttempts: 3,
  }),
};

/**
 * Convenience function to execute with queue and circuit breaker
 */
export async function executeWithProtection<T>(
  fn: () => Promise<T>,
  serviceName: keyof typeof requestQueues,
  options: {
    priority?: number;
    timeout?: number;
    useCircuitBreaker?: boolean;
  } = {}
): Promise<T> {
  const queue = requestQueues[serviceName];
  const circuitBreaker = options.useCircuitBreaker ? circuitBreakers[serviceName] : undefined;
  
  return queue.enqueue(fn, {
    priority: options.priority,
    timeout: options.timeout,
    circuitBreaker,
  });
}