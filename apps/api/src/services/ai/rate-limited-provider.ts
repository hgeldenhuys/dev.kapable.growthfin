/**
 * Rate Limited Enrichment Provider (CRM-004)
 * Wraps any EnrichmentProvider with rate limiting, exponential backoff, and request queuing
 */

import { type CrmLead } from '@agios/db';
import type { EnrichmentProvider, EnrichmentResult } from './enrichment-service';

// ============================================================================
// TYPES
// ============================================================================

export interface RateLimitConfig {
  maxRequestsPerHour: number;
  linkedinMaxPerHour: number;
  zerobounceMaxPerHour: number;
  websearchMaxPerHour: number;
}

export interface RateLimitStatus {
  remaining: number;
  resetAt: Date;
  perProvider: {
    linkedin: { remaining: number; resetAt: Date };
    zerobounce: { remaining: number; resetAt: Date };
    websearch: { remaining: number; resetAt: Date };
  };
}

interface QueuedRequest {
  lead: CrmLead;
  resolve: (result: EnrichmentResult) => void;
  reject: (error: Error) => void;
  retryCount: number;
  addedAt: Date;
}

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_CONFIG: RateLimitConfig = {
  maxRequestsPerHour: 100,
  linkedinMaxPerHour: 5,
  zerobounceMaxPerHour: 20,
  websearchMaxPerHour: 60,
};

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000; // 1 second
const MAX_DELAY_MS = 30000; // 30 seconds
const JITTER_FACTOR = 0.3; // +/- 30% randomization

// ============================================================================
// RATE LIMITED ENRICHMENT PROVIDER
// ============================================================================

export class RateLimitedEnrichmentProvider implements EnrichmentProvider {
  private provider: EnrichmentProvider;
  private config: RateLimitConfig;
  private records: Map<string, RateLimitRecord> = new Map();
  private queue: QueuedRequest[] = [];
  private isProcessingQueue = false;

  constructor(provider: EnrichmentProvider, config?: Partial<RateLimitConfig>) {
    this.provider = provider;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Enrich a lead with rate limiting protection
   */
  async enrich(lead: CrmLead): Promise<EnrichmentResult> {
    // Check overall rate limit
    const canProceed = this.checkRateLimit('overall');

    if (!canProceed) {
      // Queue the request for later processing
      console.log(`[RateLimitedProvider] Rate limit exceeded, queuing request for lead ${lead.id}`);
      return this.queueRequest(lead);
    }

    // Increment rate limit counter
    this.incrementRateLimit('overall');

    // Execute with retry logic
    return this.executeWithRetry(lead);
  }

  /**
   * Get current rate limit status
   */
  getRateLimit(): { remaining: number; resetAt: Date } {
    const status = this.getRateLimitStatus('overall');
    return {
      remaining: Math.max(0, this.config.maxRequestsPerHour - status.count),
      resetAt: new Date(status.resetAt),
    };
  }

  /**
   * Get detailed rate limit status for all providers
   */
  getDetailedRateLimit(): RateLimitStatus {
    const overall = this.getRateLimitStatus('overall');
    const linkedin = this.getRateLimitStatus('linkedin');
    const zerobounce = this.getRateLimitStatus('zerobounce');
    const websearch = this.getRateLimitStatus('websearch');

    return {
      remaining: Math.max(0, this.config.maxRequestsPerHour - overall.count),
      resetAt: new Date(overall.resetAt),
      perProvider: {
        linkedin: {
          remaining: Math.max(0, this.config.linkedinMaxPerHour - linkedin.count),
          resetAt: new Date(linkedin.resetAt),
        },
        zerobounce: {
          remaining: Math.max(0, this.config.zerobounceMaxPerHour - zerobounce.count),
          resetAt: new Date(zerobounce.resetAt),
        },
        websearch: {
          remaining: Math.max(0, this.config.websearchMaxPerHour - websearch.count),
          resetAt: new Date(websearch.resetAt),
        },
      },
    };
  }

  /**
   * Update rate limit configuration
   */
  updateConfig(config: Partial<RateLimitConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get queue size
   */
  getQueueSize(): number {
    return this.queue.length;
  }

  /**
   * Clear all rate limit records (for testing)
   */
  clearRateLimits(): void {
    this.records.clear();
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  /**
   * Check if rate limit allows a request
   */
  private checkRateLimit(key: string): boolean {
    const record = this.records.get(key);
    const now = Date.now();

    // No record or window expired - allow
    if (!record || now >= record.resetAt) {
      return true;
    }

    // Get max requests based on key
    const maxRequests = this.getMaxRequests(key);

    // Check if under limit
    return record.count < maxRequests;
  }

  /**
   * Increment rate limit counter
   */
  private incrementRateLimit(key: string): void {
    const now = Date.now();
    const record = this.records.get(key);
    const windowMs = 60 * 60 * 1000; // 1 hour

    if (!record || now >= record.resetAt) {
      // Start new window
      this.records.set(key, {
        count: 1,
        resetAt: now + windowMs,
      });
    } else {
      // Increment existing
      record.count++;
    }
  }

  /**
   * Get rate limit status for a key
   */
  private getRateLimitStatus(key: string): { count: number; resetAt: number } {
    const record = this.records.get(key);
    const now = Date.now();
    const windowMs = 60 * 60 * 1000;

    if (!record || now >= record.resetAt) {
      return { count: 0, resetAt: now + windowMs };
    }

    return { count: record.count, resetAt: record.resetAt };
  }

  /**
   * Get max requests for a key
   */
  private getMaxRequests(key: string): number {
    switch (key) {
      case 'linkedin':
        return this.config.linkedinMaxPerHour;
      case 'zerobounce':
        return this.config.zerobounceMaxPerHour;
      case 'websearch':
        return this.config.websearchMaxPerHour;
      default:
        return this.config.maxRequestsPerHour;
    }
  }

  /**
   * Queue a request for later processing
   */
  private queueRequest(lead: CrmLead): Promise<EnrichmentResult> {
    return new Promise((resolve, reject) => {
      this.queue.push({
        lead,
        resolve,
        reject,
        retryCount: 0,
        addedAt: new Date(),
      });

      // Start processing queue if not already
      this.processQueue();
    });
  }

  /**
   * Process queued requests
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue || this.queue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;

    while (this.queue.length > 0) {
      const request = this.queue[0];

      // Check if rate limit allows processing
      if (!this.checkRateLimit('overall')) {
        // Wait until rate limit resets
        const status = this.getRateLimitStatus('overall');
        const waitTime = Math.max(0, status.resetAt - Date.now());

        if (waitTime > 0) {
          console.log(`[RateLimitedProvider] Waiting ${Math.ceil(waitTime / 1000)}s for rate limit reset`);
          await this.delay(waitTime);
        }
        continue;
      }

      // Remove from queue
      this.queue.shift();

      // Process request
      this.incrementRateLimit('overall');

      try {
        const result = await this.executeWithRetry(request.lead);
        request.resolve(result);
      } catch (error) {
        request.reject(error instanceof Error ? error : new Error(String(error)));
      }
    }

    this.isProcessingQueue = false;
  }

  /**
   * Execute enrichment with exponential backoff retry
   */
  private async executeWithRetry(lead: CrmLead, retryCount = 0): Promise<EnrichmentResult> {
    try {
      return await this.provider.enrich(lead);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Check if error is retryable
      if (!this.isRetryableError(errorMessage) || retryCount >= MAX_RETRIES) {
        console.error(`[RateLimitedProvider] Non-retryable error or max retries reached: ${errorMessage}`);
        throw error;
      }

      // Calculate delay with exponential backoff and jitter
      const delay = this.calculateDelay(retryCount);
      console.log(`[RateLimitedProvider] Retry ${retryCount + 1}/${MAX_RETRIES} after ${delay}ms: ${errorMessage}`);

      await this.delay(delay);

      return this.executeWithRetry(lead, retryCount + 1);
    }
  }

  /**
   * Calculate delay with exponential backoff and jitter
   */
  private calculateDelay(retryCount: number): number {
    // Exponential backoff: 1s, 2s, 4s, 8s...
    const baseDelay = BASE_DELAY_MS * Math.pow(2, retryCount);

    // Add jitter to prevent thundering herd
    const jitter = baseDelay * JITTER_FACTOR * (Math.random() * 2 - 1);

    // Cap at max delay
    return Math.min(baseDelay + jitter, MAX_DELAY_MS);
  }

  /**
   * Check if error is retryable
   */
  private isRetryableError(message: string): boolean {
    const retryablePatterns = [
      'rate limit',
      'too many requests',
      '429',
      'timeout',
      'ETIMEDOUT',
      'ECONNRESET',
      'ECONNREFUSED',
      'network',
      'temporary',
      'service unavailable',
      '503',
      '502',
    ];

    const lowerMessage = message.toLowerCase();
    return retryablePatterns.some(pattern => lowerMessage.includes(pattern.toLowerCase()));
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ============================================================================
// FACTORY
// ============================================================================

/**
 * Create a rate-limited wrapper around any enrichment provider
 */
export function createRateLimitedProvider(
  provider: EnrichmentProvider,
  config?: Partial<RateLimitConfig>
): RateLimitedEnrichmentProvider {
  return new RateLimitedEnrichmentProvider(provider, config);
}
