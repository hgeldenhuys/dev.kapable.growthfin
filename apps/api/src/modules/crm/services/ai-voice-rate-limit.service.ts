/**
 * AI Voice Rate Limit Service (Phase N)
 * Enforces workspace-specific rate limits for AI voice campaigns
 *
 * Key differences from SMS rate limiting:
 * - AI calls are sequential (1-2 concurrent max per agent)
 * - Hourly and daily limits only (not per-minute)
 * - Integration with call queue for scheduling
 */

import { db } from '@agios/db/client';
import { crmAiVoiceRateLimits, AI_VOICE_DEFAULTS } from '@agios/db';
import { eq, and, sql } from 'drizzle-orm';

export class AiVoiceRateLimitError extends Error {
  constructor(
    message: string,
    public limit: number,
    public windowType: 'hour' | 'day',
    public current: number,
    public resetAt: Date
  ) {
    super(message);
    this.name = 'AiVoiceRateLimitError';
  }
}

export interface AiVoiceRateLimitCheckResult {
  allowed: boolean;
  remaining: number;
  limit: number;
  windowType: 'hour' | 'day';
  current: number;
  resetAt: Date;
}

export interface AiVoiceRateLimitSettings {
  enabled: boolean;
  callsPerHour: number;
  callsPerDay: number;
  concurrentCalls: number;
}

/**
 * Default rate limit settings for AI voice calls
 */
const DEFAULT_SETTINGS: AiVoiceRateLimitSettings = {
  enabled: true,
  callsPerHour: 20,
  callsPerDay: 100,
  concurrentCalls: AI_VOICE_DEFAULTS.concurrentCalls,
};

export class AiVoiceRateLimitService {
  /**
   * Get window start for a given time window type
   */
  private static getWindowStart(windowType: 'hour' | 'day'): Date {
    const now = new Date();
    switch (windowType) {
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
  private static getNextWindowStart(currentWindow: Date, windowType: 'hour' | 'day'): Date {
    const next = new Date(currentWindow);
    switch (windowType) {
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
   * Get workspace AI voice rate limit settings
   * TODO: Store these in workspace settings like SMS rate limits
   */
  static async getWorkspaceSettings(_workspaceId: string): Promise<AiVoiceRateLimitSettings> {
    // For now, return defaults
    // In future, this could be stored in workspace.settings.aiVoiceRateLimit
    return DEFAULT_SETTINGS;
  }

  /**
   * Get current usage for a specific window type
   */
  private static async getUsageForWindow(
    workspaceId: string,
    windowType: 'hour' | 'day'
  ): Promise<number> {
    const windowStart = this.getWindowStart(windowType);

    const [usage] = await db
      .select({ callCount: crmAiVoiceRateLimits.callCount })
      .from(crmAiVoiceRateLimits)
      .where(
        and(
          eq(crmAiVoiceRateLimits.workspaceId, workspaceId),
          eq(crmAiVoiceRateLimits.windowStart, windowStart),
          eq(crmAiVoiceRateLimits.windowType, windowType)
        )
      )
      .limit(1);

    return usage?.callCount ?? 0;
  }

  /**
   * Check if workspace can make a given number of AI voice calls
   * Returns the most restrictive limit that would be exceeded
   */
  static async checkLimit(
    workspaceId: string,
    count: number = 1
  ): Promise<AiVoiceRateLimitCheckResult> {
    const settings = await this.getWorkspaceSettings(workspaceId);

    if (!settings.enabled) {
      return {
        allowed: true,
        remaining: Number.MAX_SAFE_INTEGER,
        limit: Number.MAX_SAFE_INTEGER,
        windowType: 'hour',
        current: 0,
        resetAt: new Date(),
      };
    }

    // Check each window type in order of strictness
    const windowTypes: Array<{ type: 'hour' | 'day'; limit: number }> = [
      { type: 'hour', limit: settings.callsPerHour },
      { type: 'day', limit: settings.callsPerDay },
    ];

    for (const { type, limit } of windowTypes) {
      if (limit === 0) continue;

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

    // All limits passed - return info for the most relevant limit (hour)
    const hourUsage = await this.getUsageForWindow(workspaceId, 'hour');
    const hourLimit = settings.callsPerHour;
    const windowStart = this.getWindowStart('hour');
    const resetAt = this.getNextWindowStart(windowStart, 'hour');

    return {
      allowed: true,
      remaining: Math.max(0, hourLimit - hourUsage - count),
      limit: hourLimit,
      windowType: 'hour',
      current: hourUsage,
      resetAt,
    };
  }

  /**
   * Increment the call counter for a workspace
   */
  static async incrementCounter(workspaceId: string, count: number = 1): Promise<void> {
    const windowTypes: Array<'hour' | 'day'> = ['hour', 'day'];

    for (const windowType of windowTypes) {
      const windowStart = this.getWindowStart(windowType);

      // Upsert: increment if exists, create if not
      await db
        .insert(crmAiVoiceRateLimits)
        .values({
          workspaceId,
          windowStart,
          windowType,
          callCount: count,
        })
        .onConflictDoUpdate({
          target: [crmAiVoiceRateLimits.workspaceId, crmAiVoiceRateLimits.windowStart, crmAiVoiceRateLimits.windowType],
          set: {
            callCount: sql`${crmAiVoiceRateLimits.callCount} + ${count}`,
            updatedAt: new Date(),
          },
        });
    }
  }

  /**
   * Get comprehensive usage stats for a workspace
   */
  static async getUsageStats(workspaceId: string): Promise<{
    settings: AiVoiceRateLimitSettings;
    usage: {
      hour: { current: number; limit: number; remaining: number; resetAt: Date };
      day: { current: number; limit: number; remaining: number; resetAt: Date };
    };
  }> {
    const settings = await this.getWorkspaceSettings(workspaceId);

    const windowTypes: Array<'hour' | 'day'> = ['hour', 'day'];
    const usage: any = {};

    for (const windowType of windowTypes) {
      const current = await this.getUsageForWindow(workspaceId, windowType);
      const limit = windowType === 'hour' ? settings.callsPerHour : settings.callsPerDay;
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
   * Clean up old rate limit records (older than 48 hours)
   * Should be called periodically by a background job
   */
  static async cleanupOldRecords(): Promise<number> {
    const cutoff = new Date();
    cutoff.setHours(cutoff.getHours() - 48);

    const result = await db
      .delete(crmAiVoiceRateLimits)
      .where(sql`${crmAiVoiceRateLimits.windowStart} < ${cutoff}`);

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

  /**
   * Check if within preferred calling hours
   */
  static isWithinCallingHours(
    preferredHours: string = AI_VOICE_DEFAULTS.preferredHours,
    timezone: string = AI_VOICE_DEFAULTS.timezone
  ): boolean {
    // Parse preferred hours (format: "HH:MM-HH:MM")
    const [start, end] = preferredHours.split('-');
    if (!start || !end) return true; // Invalid format, allow call

    const [startHour, startMinute] = start.split(':').map(Number);
    const [endHour, endMinute] = end.split(':').map(Number);

    // Get current time in the specified timezone
    const now = new Date();
    const options: Intl.DateTimeFormatOptions = {
      hour: 'numeric',
      minute: 'numeric',
      hour12: false,
      timeZone: timezone,
    };
    const timeStr = now.toLocaleString('en-US', options);
    const [currentHour, currentMinute] = timeStr.split(':').map(Number);

    const currentMinutes = currentHour * 60 + currentMinute;
    const startMinutes = startHour * 60 + startMinute;
    const endMinutes = endHour * 60 + endMinute;

    return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
  }

  /**
   * Get next available calling time slot
   */
  static getNextCallingSlot(
    preferredHours: string = AI_VOICE_DEFAULTS.preferredHours,
    timezone: string = AI_VOICE_DEFAULTS.timezone
  ): Date {
    const [start] = preferredHours.split('-');
    if (!start) return new Date(); // Invalid format, return now

    const [startHour, startMinute] = start.split(':').map(Number);

    // Get current time in the specified timezone
    const now = new Date();

    // Create a date for today's start time
    const nextSlot = new Date();
    nextSlot.setHours(startHour, startMinute, 0, 0);

    // If we're past the start time today, move to tomorrow
    if (now > nextSlot) {
      nextSlot.setDate(nextSlot.getDate() + 1);
    }

    return nextSlot;
  }
}
