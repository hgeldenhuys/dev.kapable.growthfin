/**
 * Rate Limiter
 * Simple in-memory rate limiting for API calls
 */

export interface RateLimitConfig {
  maxRequests: number; // Maximum requests allowed
  windowMs: number; // Time window in milliseconds
}

interface RequestRecord {
  count: number;
  resetAt: number;
}

export class RateLimiter {
  private records = new Map<string, RequestRecord>();
  private config: RateLimitConfig;

  constructor(config: RateLimitConfig) {
    this.config = config;
  }

  /**
   * Check if request is allowed and increment counter
   * @param key - Unique identifier for the rate limit (e.g., API endpoint, IP address)
   * @returns true if allowed, false if rate limit exceeded
   */
  async check(key: string): Promise<boolean> {
    const now = Date.now();
    const record = this.records.get(key);

    // No record or window expired - allow and create new record
    if (!record || now >= record.resetAt) {
      this.records.set(key, {
        count: 1,
        resetAt: now + this.config.windowMs,
      });
      return true;
    }

    // Within window - check limit
    if (record.count >= this.config.maxRequests) {
      return false; // Rate limit exceeded
    }

    // Increment and allow
    record.count++;
    return true;
  }

  /**
   * Get time until rate limit resets (in milliseconds)
   */
  getResetTime(key: string): number | null {
    const record = this.records.get(key);
    if (!record) {
      return null;
    }

    const now = Date.now();
    if (now >= record.resetAt) {
      return 0;
    }

    return record.resetAt - now;
  }

  /**
   * Get current usage for a key
   */
  getUsage(key: string): { count: number; limit: number } | null {
    const record = this.records.get(key);
    if (!record) {
      return null;
    }

    const now = Date.now();
    if (now >= record.resetAt) {
      return { count: 0, limit: this.config.maxRequests };
    }

    return { count: record.count, limit: this.config.maxRequests };
  }

  /**
   * Clear rate limit for a key
   */
  clear(key: string): void {
    this.records.delete(key);
  }

  /**
   * Clean up expired records (call periodically to prevent memory leaks)
   */
  cleanup(): void {
    const now = Date.now();
    for (const [key, record] of this.records.entries()) {
      if (now >= record.resetAt) {
        this.records.delete(key);
      }
    }
  }
}

// Default rate limiter instances for common use cases
export const webSearchRateLimiter = new RateLimiter({
  maxRequests: 10, // 10 requests
  windowMs: 60 * 1000, // per minute
});

export const emailVerificationRateLimiter = new RateLimiter({
  maxRequests: 20, // 20 verifications
  windowMs: 60 * 1000, // per minute
});

export const googleMapsRateLimiter = new RateLimiter({
  maxRequests: 10, // 10 lookups
  windowMs: 60 * 1000, // per minute
});

export const linkedInRateLimiter = new RateLimiter({
  maxRequests: 5, // 5 profile lookups (expensive API)
  windowMs: 60 * 1000, // per minute
});

export const cipcRateLimiter = new RateLimiter({
  maxRequests: 10, // 10 company lookups
  windowMs: 60 * 1000, // per minute
});

export const perplexitySearchRateLimiter = new RateLimiter({
  maxRequests: 5, // 5 searches (conservative - Perplexity is more expensive)
  windowMs: 60 * 1000, // per minute
});

// Clean up expired records every minute
setInterval(() => {
  webSearchRateLimiter.cleanup();
  emailVerificationRateLimiter.cleanup();
  googleMapsRateLimiter.cleanup();
  linkedInRateLimiter.cleanup();
  cipcRateLimiter.cleanup();
  perplexitySearchRateLimiter.cleanup();
}, 60 * 1000);
