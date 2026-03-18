/**
 * Rate Limit Service for AI Tools
 * Enforces tool call rate limits per workspace
 */

import { db } from '@agios/db/client';
import { aiRateLimits } from '@agios/db';
import { eq, and, sql } from 'drizzle-orm';

export class RateLimitError extends Error {
  constructor(
    message: string,
    public limit: number,
    public windowStart: Date,
    public nextWindow: Date
  ) {
    super(message);
    this.name = 'RateLimitError';
  }
}

export interface RateLimitConfig {
  maxToolCallsPerHour: number;
}

export class RateLimitService {
  /**
   * Default rate limit: 100 tool calls per hour per workspace
   */
  private static readonly DEFAULT_LIMIT = 100;

  /**
   * Get current hour window start (truncate to hour)
   */
  private static getCurrentWindowStart(): Date {
    const now = new Date();
    now.setMinutes(0, 0, 0);
    return now;
  }

  /**
   * Get next hour window start
   */
  private static getNextWindowStart(currentWindow: Date): Date {
    const next = new Date(currentWindow);
    next.setHours(next.getHours() + 1);
    return next;
  }

  /**
   * Check if workspace can make a tool call (rate limit check)
   *
   * @param workspaceId - Workspace ID
   * @param config - Optional rate limit config (defaults to 100/hour)
   * @returns true if allowed, throws RateLimitError if exceeded
   * @throws RateLimitError if rate limit exceeded
   */
  static async checkRateLimit(
    workspaceId: string,
    config?: RateLimitConfig
  ): Promise<void> {
    const limit = config?.maxToolCallsPerHour ?? this.DEFAULT_LIMIT;
    const windowStart = this.getCurrentWindowStart();

    // Get current usage for this window
    const [usage] = await db
      .select()
      .from(aiRateLimits)
      .where(
        and(
          eq(aiRateLimits.workspaceId, workspaceId),
          eq(aiRateLimits.windowStart, windowStart)
        )
      )
      .limit(1);

    const currentCalls = usage?.toolCalls ?? 0;

    if (currentCalls >= limit) {
      const nextWindow = this.getNextWindowStart(windowStart);
      throw new RateLimitError(
        `Rate limit exceeded: ${currentCalls}/${limit} tool calls in current hour`,
        limit,
        windowStart,
        nextWindow
      );
    }
  }

  /**
   * Increment tool call counter for workspace
   *
   * @param workspaceId - Workspace ID
   */
  static async incrementToolCalls(workspaceId: string): Promise<void> {
    const windowStart = this.getCurrentWindowStart();

    // Upsert: increment if exists, create if not
    await db
      .insert(aiRateLimits)
      .values({
        workspaceId,
        windowStart,
        toolCalls: 1,
      })
      .onConflictDoUpdate({
        target: [aiRateLimits.workspaceId, aiRateLimits.windowStart],
        set: {
          toolCalls: sql`${aiRateLimits.toolCalls} + 1`,
        },
      });
  }

  /**
   * Get current usage for workspace
   *
   * @param workspaceId - Workspace ID
   * @returns Current usage { calls: number, limit: number, windowStart: Date }
   */
  static async getCurrentUsage(
    workspaceId: string,
    config?: RateLimitConfig
  ): Promise<{
    calls: number;
    limit: number;
    windowStart: Date;
    nextWindow: Date;
    remaining: number;
  }> {
    const limit = config?.maxToolCallsPerHour ?? this.DEFAULT_LIMIT;
    const windowStart = this.getCurrentWindowStart();

    const [usage] = await db
      .select()
      .from(aiRateLimits)
      .where(
        and(
          eq(aiRateLimits.workspaceId, workspaceId),
          eq(aiRateLimits.windowStart, windowStart)
        )
      )
      .limit(1);

    const calls = usage?.toolCalls ?? 0;
    const remaining = Math.max(0, limit - calls);
    const nextWindow = this.getNextWindowStart(windowStart);

    return {
      calls,
      limit,
      windowStart,
      nextWindow,
      remaining,
    };
  }

  /**
   * Clean up old rate limit records (older than 24 hours)
   * Should be called periodically by a background job
   */
  static async cleanupOldRecords(): Promise<number> {
    const cutoff = new Date();
    cutoff.setHours(cutoff.getHours() - 24);

    const result = await db
      .delete(aiRateLimits)
      .where(sql`${aiRateLimits.windowStart} < ${cutoff}`);

    return result.rowCount ?? 0;
  }
}
