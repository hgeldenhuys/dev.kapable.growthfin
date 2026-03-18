/**
 * Code Search Service
 * Handles ripgrep-based code search requests
 */

import { randomUUID } from 'crypto';
import { pgBoss } from '../lib/pg-boss';
import { Pool } from 'pg';

export interface CodeSearchParams {
  query: string;
  caseSensitive?: boolean;
  filePattern?: string;
  contextLines?: number;
  maxResults?: number;
}

export interface CodeSearchJob {
  searchId: string;
  workspaceId: string;
  query: string;
  caseSensitive: boolean;
  filePattern: string;
  contextLines: number;
  maxResults: number;
  requestedBy: string; // userId
}

export interface CodeSearchResult {
  filePath: string;
  lineNumber: number;
  lineContent: string;
  contextBefore?: string[];
  contextAfter?: string[];
}

// Default configuration (matches PRD requirements)
const DEFAULT_FILE_PATTERN = '*.{ts,tsx,js,jsx,md,json,yaml,yml}';
const DEFAULT_CASE_SENSITIVE = false;
const DEFAULT_CONTEXT_LINES = 0;
const DEFAULT_MAX_RESULTS = 500;
const MAX_CONTEXT_LINES = 5;
const MAX_MAX_RESULTS = 1000;
const MIN_QUERY_LENGTH = 1;
const MAX_QUERY_LENGTH = 500;

// Rate limiting configuration
const RATE_LIMIT_REQUESTS_PER_MINUTE = 30;
const RATE_LIMIT_CONCURRENT_PER_WORKSPACE = 10;

// In-memory rate limiting (TODO: move to Redis for multi-instance support)
const rateLimitMap = new Map<string, { count: number; windowStart: number }>();
const concurrentSearches = new Map<string, number>();

// PostgreSQL connection pool for NOTIFY
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export class CodeSearchService {
  /**
   * Validate search parameters
   */
  static validateParams(params: CodeSearchParams): { valid: boolean; error?: string } {
    if (!params.query || params.query.length < MIN_QUERY_LENGTH) {
      return { valid: false, error: 'Query must be at least 1 character' };
    }

    if (params.query.length > MAX_QUERY_LENGTH) {
      return { valid: false, error: `Query must be at most ${MAX_QUERY_LENGTH} characters` };
    }

    if (params.contextLines !== undefined) {
      if (params.contextLines < 0 || params.contextLines > MAX_CONTEXT_LINES) {
        return { valid: false, error: `Context lines must be between 0 and ${MAX_CONTEXT_LINES}` };
      }
    }

    if (params.maxResults !== undefined) {
      if (params.maxResults < 1 || params.maxResults > MAX_MAX_RESULTS) {
        return { valid: false, error: `Max results must be between 1 and ${MAX_MAX_RESULTS}` };
      }
    }

    // Validate file pattern (basic glob validation)
    if (params.filePattern && params.filePattern.includes(';')) {
      return { valid: false, error: 'File pattern cannot contain semicolons' };
    }

    return { valid: true };
  }

  /**
   * Check rate limit for user
   */
  static checkRateLimit(userId: string): { allowed: boolean; error?: string } {
    const now = Date.now();
    const windowMs = 60 * 1000; // 1 minute

    const userLimit = rateLimitMap.get(userId);

    if (!userLimit || now - userLimit.windowStart > windowMs) {
      // New window
      rateLimitMap.set(userId, { count: 1, windowStart: now });
      return { allowed: true };
    }

    if (userLimit.count >= RATE_LIMIT_REQUESTS_PER_MINUTE) {
      return {
        allowed: false,
        error: `Rate limit exceeded. Max ${RATE_LIMIT_REQUESTS_PER_MINUTE} requests per minute`,
      };
    }

    // Increment count
    userLimit.count++;
    return { allowed: true };
  }

  /**
   * Try to acquire a concurrent search slot (atomic operation)
   * Returns true if slot acquired, false if limit exceeded
   */
  static tryAcquireConcurrentSlot(workspaceId: string): { allowed: boolean; error?: string } {
    const current = concurrentSearches.get(workspaceId) || 0;

    if (current >= RATE_LIMIT_CONCURRENT_PER_WORKSPACE) {
      return {
        allowed: false,
        error: `Concurrent search limit exceeded. Max ${RATE_LIMIT_CONCURRENT_PER_WORKSPACE} concurrent searches per workspace`,
      };
    }

    // Atomically increment (prevent race condition)
    concurrentSearches.set(workspaceId, current + 1);

    return { allowed: true };
  }

  /**
   * Release a concurrent search slot
   */
  static releaseConcurrentSlot(workspaceId: string): void {
    const current = concurrentSearches.get(workspaceId) || 0;
    if (current > 0) {
      concurrentSearches.set(workspaceId, current - 1);
    }
  }

  /**
   * Get current concurrent search count (for debugging)
   */
  static getConcurrentCount(workspaceId: string): number {
    return concurrentSearches.get(workspaceId) || 0;
  }

  /**
   * Create a code search request
   * Validates params, checks limits, and enqueues job
   */
  static async createSearch(
    workspaceId: string,
    userId: string,
    params: CodeSearchParams,
    isCliConnected: boolean
  ): Promise<{ searchId: string; error?: string }> {
    // Validate CLI connection
    if (!isCliConnected) {
      return {
        searchId: '',
        error: 'NO_CLI_CONNECTED',
      };
    }

    // Validate parameters
    const validation = this.validateParams(params);
    if (!validation.valid) {
      return {
        searchId: '',
        error: validation.error,
      };
    }

    // Check rate limit (per user)
    const rateLimitCheck = this.checkRateLimit(userId);
    if (!rateLimitCheck.allowed) {
      return {
        searchId: '',
        error: rateLimitCheck.error,
      };
    }

    // Try to acquire concurrent slot (per workspace, atomic)
    const concurrentSlot = this.tryAcquireConcurrentSlot(workspaceId);
    if (!concurrentSlot.allowed) {
      return {
        searchId: '',
        error: concurrentSlot.error,
      };
    }

    // Generate search ID
    const searchId = randomUUID();

    // Build job data with defaults
    const jobData: CodeSearchJob = {
      searchId,
      workspaceId,
      query: params.query,
      caseSensitive: params.caseSensitive ?? DEFAULT_CASE_SENSITIVE,
      filePattern: params.filePattern ?? DEFAULT_FILE_PATTERN,
      contextLines: params.contextLines ?? DEFAULT_CONTEXT_LINES,
      maxResults: params.maxResults ?? DEFAULT_MAX_RESULTS,
      requestedBy: userId,
    };

    try {
      // Enqueue job to pg-boss
      await pgBoss.send('code-search-requested', jobData);

      // Emit PostgreSQL NOTIFY for CLI to pick up immediately (near real-time)
      // NOTIFY doesn't support parameterized queries, must use string concatenation
      const payload = JSON.stringify(jobData);
      const escapedPayload = payload.replace(/'/g, "''");
      await pool.query(`NOTIFY code_search_requested, '${escapedPayload}'`);

      console.log('[CodeSearchService] Enqueued search job:', {
        searchId,
        workspaceId,
        query: params.query,
      });

      return { searchId };
    } catch (error) {
      // Release slot on error
      this.releaseConcurrentSlot(workspaceId);
      console.error('[CodeSearchService] Failed to enqueue search:', error);
      return {
        searchId: '',
        error: 'Failed to enqueue search request',
      };
    }
  }

  /**
   * Mark search as complete (called when results are done)
   */
  static markSearchComplete(workspaceId: string): void {
    this.releaseConcurrentSlot(workspaceId);
  }

  /**
   * Reset rate limit counters (for testing purposes)
   */
  static resetRateLimits(): void {
    rateLimitMap.clear();
    concurrentSearches.clear();
  }
}
