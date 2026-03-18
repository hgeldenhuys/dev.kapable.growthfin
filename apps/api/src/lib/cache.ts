/**
 * Simple In-Memory Cache
 * For caching API responses with TTL
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export class Cache<T = any> {
  private store = new Map<string, CacheEntry<T>>();
  private defaultTTL: number;

  /**
   * @param defaultTTL - Default TTL in milliseconds
   */
  constructor(defaultTTL: number = 60 * 60 * 1000) {
    // 1 hour default
    this.defaultTTL = defaultTTL;
  }

  /**
   * Set a value in cache
   * @param key - Cache key
   * @param value - Value to cache
   * @param ttl - TTL in milliseconds (optional, uses default if not provided)
   */
  set(key: string, value: T, ttl?: number): void {
    const expiresAt = Date.now() + (ttl ?? this.defaultTTL);
    this.store.set(key, { value, expiresAt });
  }

  /**
   * Get a value from cache
   * @param key - Cache key
   * @returns Cached value or undefined if not found or expired
   */
  get(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) {
      return undefined;
    }

    // Check if expired
    if (Date.now() >= entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }

    return entry.value;
  }

  /**
   * Check if key exists and is not expired
   */
  has(key: string): boolean {
    return this.get(key) !== undefined;
  }

  /**
   * Delete a key from cache
   */
  delete(key: string): boolean {
    return this.store.delete(key);
  }

  /**
   * Clear all entries
   */
  clear(): void {
    this.store.clear();
  }

  /**
   * Get or set pattern - fetch and cache if not present
   * @param key - Cache key
   * @param fetcher - Function to fetch value if not in cache
   * @param ttl - TTL in milliseconds (optional)
   */
  async getOrSet(
    key: string,
    fetcher: () => Promise<T>,
    ttl?: number
  ): Promise<T> {
    const cached = this.get(key);
    if (cached !== undefined) {
      return cached;
    }

    const value = await fetcher();
    this.set(key, value, ttl);
    return value;
  }

  /**
   * Clean up expired entries (call periodically to prevent memory leaks)
   */
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (now >= entry.expiresAt) {
        this.store.delete(key);
      }
    }
  }

  /**
   * Get cache statistics
   */
  stats(): { size: number; expired: number } {
    const now = Date.now();
    let expired = 0;

    for (const entry of this.store.values()) {
      if (now >= entry.expiresAt) {
        expired++;
      }
    }

    return {
      size: this.store.size,
      expired,
    };
  }
}

// Create a hash key for complex objects
export function createCacheKey(prefix: string, params: Record<string, any>): string {
  const sortedParams = Object.keys(params)
    .sort()
    .map((key) => `${key}=${JSON.stringify(params[key])}`)
    .join('&');
  return `${prefix}:${sortedParams}`;
}

// Default cache instance for web search results
export const webSearchCache = new Cache(60 * 60 * 1000); // 1 hour TTL

// Default cache instance for email verification results
export const emailVerificationCache = new Cache(24 * 60 * 60 * 1000); // 24 hour TTL

// Default cache instance for Google Maps business lookups
export const googleMapsCache = new Cache(24 * 60 * 60 * 1000); // 24 hour TTL

// Default cache instance for LinkedIn profile lookups
export const linkedInCache = new Cache(7 * 24 * 60 * 60 * 1000); // 7 day TTL

// Default cache instance for CIPC company lookups
export const cipcCache = new Cache(30 * 24 * 60 * 60 * 1000); // 30 day TTL

// Clean up expired entries every 5 minutes
setInterval(() => {
  webSearchCache.cleanup();
  emailVerificationCache.cleanup();
  googleMapsCache.cleanup();
  linkedInCache.cleanup();
  cipcCache.cleanup();
}, 5 * 60 * 1000);
