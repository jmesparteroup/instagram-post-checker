import crypto from 'crypto';

/**
 * Simple in-memory cache for analysis results
 * Helps reduce API costs by caching identical requests
 */
export class CacheService {
  private cache = new Map<string, CacheEntry>();
  private readonly maxSize: number;
  private readonly ttlMs: number;

  constructor(maxSize = 100, ttlMinutes = 60) {
    this.maxSize = maxSize;
    this.ttlMs = ttlMinutes * 60 * 1000;
    
    // Clean up expired entries every 10 minutes
    setInterval(() => this.cleanup(), 10 * 60 * 1000);
  }

  /**
   * Generate cache key from post data and requirements
   */
  generateKey(postData: { caption: string; transcript: string; mediaType: string; hashtags: string[]; altText: string }, requirements: string[]): string {
    const content = {
      caption: postData.caption,
      transcript: postData.transcript,
      mediaType: postData.mediaType,
      hashtags: postData.hashtags.sort(), // Sort hashtags for consistent key
      altText: postData.altText,
      requirements: requirements.sort(), // Sort to ensure consistent key
    };
    
    return crypto
      .createHash('sha256')
      .update(JSON.stringify(content))
      .digest('hex');
  }

  /**
   * Get cached result if available and not expired
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    // Update access time for LRU
    entry.lastAccessed = Date.now();
    return entry.data as T;
  }

  /**
   * Store result in cache
   */
  set<T>(key: string, data: T): void {
    // Remove oldest entries if cache is full
    if (this.cache.size >= this.maxSize) {
      this.evictOldest();
    }

    const entry: CacheEntry = {
      data,
      createdAt: Date.now(),
      lastAccessed: Date.now(),
      expiresAt: Date.now() + this.ttlMs,
    };

    this.cache.set(key, entry);
  }

  /**
   * Check if key exists and is not expired
   */
  has(key: string): boolean {
    return this.get(key) !== null;
  }

  /**
   * Clear all cached entries
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const now = Date.now();
    let expired = 0;
    let active = 0;

    for (const entry of this.cache.values()) {
      if (now > entry.expiresAt) {
        expired++;
      } else {
        active++;
      }
    }

    return {
      totalEntries: this.cache.size,
      activeEntries: active,
      expiredEntries: expired,
      maxSize: this.maxSize,
      ttlMs: this.ttlMs,
    };
  }

  /**
   * Remove expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => this.cache.delete(key));
    
    if (keysToDelete.length > 0) {
      console.log(`Cache cleanup: removed ${keysToDelete.length} expired entries`);
    }
  }

  /**
   * Remove oldest entries when cache is full (LRU eviction)
   */
  private evictOldest(): void {
    let oldestKey: string | null = null;
    let oldestTime = Date.now();

    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }
}

interface CacheEntry {
  data: unknown;
  createdAt: number;
  lastAccessed: number;
  expiresAt: number;
}

interface CacheStats {
  totalEntries: number;
  activeEntries: number;
  expiredEntries: number;
  maxSize: number;
  ttlMs: number;
}

// Global cache instance
export const analysisCache = new CacheService(
  parseInt(process.env.CACHE_MAX_SIZE || '100', 10),
  parseInt(process.env.CACHE_TTL_MINUTES || '60', 10)
); 