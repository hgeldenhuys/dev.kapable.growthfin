/**
 * SMS Rate Limit Service (Phase H.3)
 * Enforces workspace-specific rate limits for bulk SMS campaigns
 */

import { db } from '@agios/db/client';
import { crmSmsRateLimits, workspaces, type WorkspaceSettings, type WorkspaceSmsRateLimitSettings } from '@agios/db';
import { eq, and, sql } from 'drizzle-orm';

export class SmsRateLimitError extends Error {
  constructor(
    message: string,
    public limit: number,
    public windowType: 'minute' | 'hour' | 'day',
    public current: number,
    public resetAt: Date
  ) {
    super(message);
    this.name = 'SmsRateLimitError';
  }
}

export interface SmsRateLimitCheckResult {
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
const DEFAULT_SETTINGS: WorkspaceSmsRateLimitSettings = {
  enabled: true,
  smsPerMinute: 60,
  smsPerHour: 1000,
  smsPerDay: 10000,
  batchSize: 100,
  batchDelayMs: 1000,
};

export class SmsRateLimitService {
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
   * Get workspace SMS rate limit settings
   */
  static async getWorkspaceSettings(workspaceId: string): Promise<WorkspaceSmsRateLimitSettings> {
    const [workspace] = await db
      .select({
        settings: workspaces.settings,
      })
      .from(workspaces)
      .where(eq(workspaces.id, workspaceId))
      .limit(1);

    if (!workspace) {
      return DEFAULT_SETTINGS;
    }

    const settings = workspace.settings as WorkspaceSettings | null;
    const smsRateLimit = settings?.smsRateLimit;

    if (!smsRateLimit || !smsRateLimit.enabled) {
      // Return defaults if not configured or disabled
      return DEFAULT_SETTINGS;
    }

    // Merge with defaults for any missing values
    return {
      enabled: smsRateLimit.enabled,
      smsPerMinute: smsRateLimit.smsPerMinute ?? DEFAULT_SETTINGS.smsPerMinute,
      smsPerHour: smsRateLimit.smsPerHour ?? DEFAULT_SETTINGS.smsPerHour,
      smsPerDay: smsRateLimit.smsPerDay ?? DEFAULT_SETTINGS.smsPerDay,
      batchSize: smsRateLimit.batchSize ?? DEFAULT_SETTINGS.batchSize,
      batchDelayMs: smsRateLimit.batchDelayMs ?? DEFAULT_SETTINGS.batchDelayMs,
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
      .select({ sentCount: crmSmsRateLimits.sentCount })
      .from(crmSmsRateLimits)
      .where(
        and(
          eq(crmSmsRateLimits.workspaceId, workspaceId),
          eq(crmSmsRateLimits.windowStart, windowStart),
          eq(crmSmsRateLimits.windowType, windowType)
        )
      )
      .limit(1);

    return usage?.sentCount ?? 0;
  }

  /**
   * Check if workspace can send a given number of SMS messages
   * Returns the most restrictive limit that would be exceeded
   */
  static async checkLimit(
    workspaceId: string,
    count: number = 1
  ): Promise<SmsRateLimitCheckResult> {
    const settings = await this.getWorkspaceSettings(workspaceId);

    if (!settings.enabled) {
      // Rate limiting disabled - always allow
      return {
        allowed: true,
        remaining: Number.MAX_SAFE_INTEGER,
        limit: Number.MAX_SAFE_INTEGER,
        windowType: 'minute',
        current: 0,
        resetAt: new Date(),
      };
    }

    // Check each window type in order of strictness
    const windowTypes: Array<{ type: 'minute' | 'hour' | 'day'; limit: number | undefined }> = [
      { type: 'minute', limit: settings.smsPerMinute },
      { type: 'hour', limit: settings.smsPerHour },
      { type: 'day', limit: settings.smsPerDay },
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

    // All limits passed - return info for the most relevant limit (minute)
    const minuteUsage = await this.getUsageForWindow(workspaceId, 'minute');
    const minuteLimit = settings.smsPerMinute ?? DEFAULT_SETTINGS.smsPerMinute!;
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
   * Increment the SMS counter for a workspace
   */
  static async incrementCounter(workspaceId: string, count: number = 1): Promise<void> {
    const windowTypes: Array<'minute' | 'hour' | 'day'> = ['minute', 'hour', 'day'];

    for (const windowType of windowTypes) {
      const windowStart = this.getWindowStart(windowType);

      // Upsert: increment if exists, create if not
      await db
        .insert(crmSmsRateLimits)
        .values({
          workspaceId,
          windowStart,
          windowType,
          sentCount: count,
        })
        .onConflictDoUpdate({
          target: [crmSmsRateLimits.workspaceId, crmSmsRateLimits.windowStart, crmSmsRateLimits.windowType],
          set: {
            sentCount: sql`${crmSmsRateLimits.sentCount} + ${count}`,
            updatedAt: new Date(),
          },
        });
    }
  }

  /**
   * Get comprehensive usage stats for a workspace
   */
  static async getUsageStats(workspaceId: string): Promise<{
    settings: WorkspaceSmsRateLimitSettings;
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
          ? settings.smsPerMinute ?? DEFAULT_SETTINGS.smsPerMinute!
          : windowType === 'hour'
            ? settings.smsPerHour ?? DEFAULT_SETTINGS.smsPerHour!
            : settings.smsPerDay ?? DEFAULT_SETTINGS.smsPerDay!;
      const windowStart = this.getWindowStart(windowType);
      const resetAt = this.getNextWindowStart(windowStart, windowType);

      usage[windowType] = {
        current,
        limit,
        remaining: Math.max(0, limit - current),
        resetAt,
      };
    }

    return {
      settings,
      usage,
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
      .delete(crmSmsRateLimits)
      .where(sql`${crmSmsRateLimits.windowStart} < ${cutoff}`);

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
