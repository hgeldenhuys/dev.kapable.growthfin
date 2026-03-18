/**
 * Email Rate Limit Service (Phase P)
 * Enforces workspace-specific rate limits for bulk email campaigns
 * Follows the same pattern as SmsRateLimitService
 */

import { db } from '@agios/db/client';
import { crmEmailRateLimits, workspaces, type WorkspaceSettings, type WorkspaceEmailRateLimitSettings } from '@agios/db';
import { eq, and, sql } from 'drizzle-orm';

export class EmailRateLimitError extends Error {
  constructor(
    message: string,
    public limit: number,
    public windowType: 'minute' | 'hour' | 'day',
    public current: number,
    public resetAt: Date
  ) {
    super(message);
    this.name = 'EmailRateLimitError';
  }
}

export interface EmailRateLimitCheckResult {
  allowed: boolean;
  remaining: number;
  limit: number;
  windowType: 'minute' | 'hour' | 'day';
  current: number;
  resetAt: Date;
}

/**
 * Default rate limit settings
 */
const DEFAULT_SETTINGS: WorkspaceEmailRateLimitSettings = {
  enabled: true,
  emailsPerMinute: 100,
  emailsPerHour: 5000,
  emailsPerDay: 50000,
  batchSize: 100,
  batchDelayMs: 500,
};

export class EmailRateLimitService {
  /**
   * Get window start for a given time window type
   */
  private static getWindowStart(windowType: 'minute' | 'hour' | 'day'): Date {
    const now = new Date();
    switch (windowType) {
      case 'minute':
        now.setSeconds(0, 0);
        break;
      case 'hour':
        now.setMinutes(0, 0, 0);
        break;
      case 'day':
        now.setHours(0, 0, 0, 0);
        break;
    }
    return now;
  }

  /**
   * Get next window start for a given time window type
   */
  private static getNextWindowStart(currentWindow: Date, windowType: 'minute' | 'hour' | 'day'): Date {
    const next = new Date(currentWindow);
    switch (windowType) {
      case 'minute':
        next.setMinutes(next.getMinutes() + 1);
        break;
      case 'hour':
        next.setHours(next.getHours() + 1);
        break;
      case 'day':
        next.setDate(next.getDate() + 1);
        break;
    }
    return next;
  }

  /**
   * Get workspace email rate limit settings
   */
  static async getWorkspaceSettings(workspaceId: string): Promise<WorkspaceEmailRateLimitSettings> {
    const [workspace] = await db
      .select({ settings: workspaces.settings })
      .from(workspaces)
      .where(eq(workspaces.id, workspaceId))
      .limit(1);

    if (!workspace) {
      return DEFAULT_SETTINGS;
    }

    const settings = workspace.settings as WorkspaceSettings | null;
    const emailRateLimit = settings?.emailRateLimit;

    if (!emailRateLimit || !emailRateLimit.enabled) {
      return DEFAULT_SETTINGS;
    }

    return {
      enabled: emailRateLimit.enabled,
      emailsPerMinute: emailRateLimit.emailsPerMinute ?? DEFAULT_SETTINGS.emailsPerMinute,
      emailsPerHour: emailRateLimit.emailsPerHour ?? DEFAULT_SETTINGS.emailsPerHour,
      emailsPerDay: emailRateLimit.emailsPerDay ?? DEFAULT_SETTINGS.emailsPerDay,
      batchSize: emailRateLimit.batchSize ?? DEFAULT_SETTINGS.batchSize,
      batchDelayMs: emailRateLimit.batchDelayMs ?? DEFAULT_SETTINGS.batchDelayMs,
    };
  }

  /**
   * Get current usage for a specific window type
   */
  private static async getUsageForWindow(
    workspaceId: string,
    windowType: 'minute' | 'hour' | 'day'
  ): Promise<number> {
    const windowStart = this.getWindowStart(windowType);

    const [usage] = await db
      .select({ sentCount: crmEmailRateLimits.sentCount })
      .from(crmEmailRateLimits)
      .where(
        and(
          eq(crmEmailRateLimits.workspaceId, workspaceId),
          eq(crmEmailRateLimits.windowStart, windowStart),
          eq(crmEmailRateLimits.windowType, windowType)
        )
      )
      .limit(1);

    return usage?.sentCount ?? 0;
  }

  /**
   * Check if workspace can send a given number of emails
   */
  static async checkLimit(
    workspaceId: string,
    count: number = 1
  ): Promise<EmailRateLimitCheckResult> {
    const settings = await this.getWorkspaceSettings(workspaceId);

    if (!settings.enabled) {
      return {
        allowed: true,
        remaining: Number.MAX_SAFE_INTEGER,
        limit: Number.MAX_SAFE_INTEGER,
        windowType: 'minute',
        current: 0,
        resetAt: new Date(),
      };
    }

    const windowTypes: Array<{ type: 'minute' | 'hour' | 'day'; limit: number | undefined }> = [
      { type: 'minute', limit: settings.emailsPerMinute },
      { type: 'hour', limit: settings.emailsPerHour },
      { type: 'day', limit: settings.emailsPerDay },
    ];

    for (const { type, limit } of windowTypes) {
      if (limit === undefined || limit === 0) continue;

      const currentUsage = await this.getUsageForWindow(workspaceId, type);
      const wouldExceed = currentUsage + count > limit;
      const windowStart = this.getWindowStart(type);
      const resetAt = this.getNextWindowStart(windowStart, type);

      if (wouldExceed) {
        return {
          allowed: false,
          remaining: Math.max(0, limit - currentUsage),
          limit,
          windowType: type,
          current: currentUsage,
          resetAt,
        };
      }
    }

    const minuteUsage = await this.getUsageForWindow(workspaceId, 'minute');
    const minuteLimit = settings.emailsPerMinute ?? DEFAULT_SETTINGS.emailsPerMinute!;
    const windowStart = this.getWindowStart('minute');
    const resetAt = this.getNextWindowStart(windowStart, 'minute');

    return {
      allowed: true,
      remaining: Math.max(0, minuteLimit - minuteUsage - count),
      limit: minuteLimit,
      windowType: 'minute',
      current: minuteUsage,
      resetAt,
    };
  }

  /**
   * Increment the email counter for a workspace
   */
  static async incrementCounter(workspaceId: string, count: number = 1): Promise<void> {
    const windowTypes: Array<'minute' | 'hour' | 'day'> = ['minute', 'hour', 'day'];

    for (const windowType of windowTypes) {
      const windowStart = this.getWindowStart(windowType);

      await db
        .insert(crmEmailRateLimits)
        .values({
          workspaceId,
          windowStart,
          windowType,
          sentCount: count,
        })
        .onConflictDoUpdate({
          target: [crmEmailRateLimits.workspaceId, crmEmailRateLimits.windowStart, crmEmailRateLimits.windowType],
          set: {
            sentCount: sql`${crmEmailRateLimits.sentCount} + ${count}`,
            updatedAt: new Date(),
          },
        });
    }
  }

  /**
   * Get comprehensive usage stats for a workspace
   */
  static async getUsageStats(workspaceId: string): Promise<{
    settings: WorkspaceEmailRateLimitSettings;
    usage: {
      minute: { current: number; limit: number; remaining: number; resetAt: Date };
      hour: { current: number; limit: number; remaining: number; resetAt: Date };
      day: { current: number; limit: number; remaining: number; resetAt: Date };
    };
  }> {
    const settings = await this.getWorkspaceSettings(workspaceId);

    const windowTypes: Array<'minute' | 'hour' | 'day'> = ['minute', 'hour', 'day'];
    const usage: any = {};

    for (const windowType of windowTypes) {
      const current = await this.getUsageForWindow(workspaceId, windowType);
      const limit =
        windowType === 'minute'
          ? settings.emailsPerMinute ?? DEFAULT_SETTINGS.emailsPerMinute!
          : windowType === 'hour'
            ? settings.emailsPerHour ?? DEFAULT_SETTINGS.emailsPerHour!
            : settings.emailsPerDay ?? DEFAULT_SETTINGS.emailsPerDay!;
      const windowStart = this.getWindowStart(windowType);
      const resetAt = this.getNextWindowStart(windowStart, windowType);

      usage[windowType] = {
        current,
        limit,
        remaining: Math.max(0, limit - current),
        resetAt,
      };
    }

    return { settings, usage };
  }

  /**
   * Clean up old rate limit records (older than 24 hours)
   */
  static async cleanupOldRecords(): Promise<number> {
    const cutoff = new Date();
    cutoff.setHours(cutoff.getHours() - 24);

    const result = await db
      .delete(crmEmailRateLimits)
      .where(sql`${crmEmailRateLimits.windowStart} < ${cutoff}`);

    return result.rowCount ?? 0;
  }

  /**
   * Calculate wait time until rate limit resets
   */
  static calculateWaitTime(resetAt: Date): number {
    const now = Date.now();
    const resetTime = resetAt.getTime();
    return Math.max(0, resetTime - now);
  }
}
