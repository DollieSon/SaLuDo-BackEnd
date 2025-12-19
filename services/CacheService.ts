/**
 * Redis caching service for time analytics
 */

import Redis from 'ioredis';

class CacheService {
  private redis: Redis | null = null;
  private isEnabled: boolean = false;

  constructor() {
    this.initialize();
  }

  /**
   * Initialize Redis connection
   */
  private initialize(): void {
    try {
      const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
      
      this.redis = new Redis(redisUrl, {
        maxRetriesPerRequest: 3,
        enableOfflineQueue: false,
        lazyConnect: true,
      });

      this.redis.on('connect', () => {
        console.log('✅ Redis cache connected');
        this.isEnabled = true;
      });

      this.redis.on('error', (err) => {
        console.error('❌ Redis connection error:', err.message);
        this.isEnabled = false;
      });

      // Attempt to connect
      this.redis.connect().catch((err) => {
        console.warn('⚠️ Redis not available, caching disabled:', err.message);
        this.isEnabled = false;
      });

    } catch (error) {
      console.warn('⚠️ Redis initialization failed, caching disabled:', error);
      this.isEnabled = false;
    }
  }

  /**
   * Get cached data
   * @param key - Cache key
   * @returns Cached data or null
   */
  async get<T>(key: string): Promise<T | null> {
    if (!this.isEnabled || !this.redis) {
      return null;
    }

    try {
      const data = await this.redis.get(key);
      if (!data) return null;

      return JSON.parse(data) as T;
    } catch (error) {
      console.error('Cache get error:', error);
      return null;
    }
  }

  /**
   * Set cached data with TTL
   * @param key - Cache key
   * @param value - Data to cache
   * @param ttlSeconds - Time to live in seconds
   */
  async set(key: string, value: any, ttlSeconds: number): Promise<void> {
    if (!this.isEnabled || !this.redis) {
      return;
    }

    try {
      const serialized = JSON.stringify(value);
      await this.redis.setex(key, ttlSeconds, serialized);
    } catch (error) {
      console.error('Cache set error:', error);
    }
  }

  /**
   * Delete cached data
   * @param key - Cache key or pattern
   */
  async delete(key: string): Promise<void> {
    if (!this.isEnabled || !this.redis) {
      return;
    }

    try {
      await this.redis.del(key);
    } catch (error) {
      console.error('Cache delete error:', error);
    }
  }

  /**
   * Delete all keys matching a pattern
   * @param pattern - Key pattern (e.g., "candidate:*")
   */
  async deletePattern(pattern: string): Promise<void> {
    if (!this.isEnabled || !this.redis) {
      return;
    }

    try {
      const keys = await this.redis.keys(pattern);
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
    } catch (error) {
      console.error('Cache delete pattern error:', error);
    }
  }

  /**
   * Clear all cache
   */
  async flush(): Promise<void> {
    if (!this.isEnabled || !this.redis) {
      return;
    }

    try {
      await this.redis.flushdb();
    } catch (error) {
      console.error('Cache flush error:', error);
    }
  }

  /**
   * Check if caching is enabled
   */
  isAvailable(): boolean {
    return this.isEnabled;
  }

  /**
   * Close Redis connection
   */
  async close(): Promise<void> {
    if (this.redis) {
      await this.redis.quit();
      this.isEnabled = false;
    }
  }
}

// Export singleton instance
export const cacheService = new CacheService();

// Cache key generators
export const CacheKeys = {
  // System-wide analytics: 15 minutes
  SYSTEM_ANALYTICS: () => 'analytics:system-wide',
  SYSTEM_ANALYTICS_TTL: 15 * 60, // 15 minutes

  // Per-candidate analytics: 5 minutes
  CANDIDATE_ANALYTICS: (candidateId: string) => `analytics:candidate:${candidateId}`,
  CANDIDATE_ANALYTICS_TTL: 5 * 60, // 5 minutes

  // Status history: 5 minutes
  STATUS_HISTORY: (candidateId: string) => `status-history:${candidateId}`,
  STATUS_HISTORY_TTL: 5 * 60, // 5 minutes

  // Invalidation patterns
  ALL_ANALYTICS: () => 'analytics:*',
  CANDIDATE_PREFIX: (candidateId: string) => `*:candidate:${candidateId}*`,
};
