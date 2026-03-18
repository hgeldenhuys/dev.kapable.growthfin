/**
 * Recurring Campaigns Service
 * Helper functions for managing recurring campaign schedules
 */

import { CronExpressionParser } from 'cron-parser';

/**
 * Validate a cron expression
 * @throws Error if invalid
 */
export function validateCronExpression(expression: string): boolean {
  try {
    CronExpressionParser.parse(expression);
    return true;
  } catch (error) {
    throw new Error(`Invalid cron expression: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get the next execution time for a cron expression
 * @param cronExpression - Valid cron expression
 * @param currentDate - Optional current date (defaults to now)
 * @returns Next execution Date
 */
export function getNextExecutionTime(cronExpression: string, currentDate?: Date): Date {
  try {
    const interval = CronExpressionParser.parse(cronExpression, {
      currentDate: currentDate || new Date(),
      tz: 'UTC',
    });
    return interval.next().toDate();
  } catch (error) {
    throw new Error(`Failed to calculate next execution time: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get a human-readable description of a cron schedule
 * @param cronExpression - Valid cron expression
 * @returns Human-readable description
 */
export function describeCronSchedule(cronExpression: string): string {
  try {
    const interval = CronExpressionParser.parse(cronExpression, { tz: 'UTC' });
    const next = interval.next().toDate();
    const nextAfter = interval.next().toDate();

    const diffMs = nextAfter.getTime() - next.getTime();
    const diffMinutes = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMinutes < 60) {
      return `Every ${diffMinutes} minute${diffMinutes !== 1 ? 's' : ''}`;
    } else if (diffHours < 24) {
      return `Every ${diffHours} hour${diffHours !== 1 ? 's' : ''}`;
    } else if (diffDays === 1) {
      return `Daily at ${next.getUTCHours()}:${String(next.getUTCMinutes()).padStart(2, '0')} UTC`;
    } else if (diffDays === 7) {
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      return `Weekly on ${dayNames[next.getUTCDay()]} at ${next.getUTCHours()}:${String(next.getUTCMinutes()).padStart(2, '0')} UTC`;
    } else {
      return `Every ${diffDays} days`;
    }
  } catch (error) {
    return 'Invalid schedule';
  }
}

/**
 * Common cron expression presets
 */
export const CRON_PRESETS = {
  EVERY_5_MINUTES: '*/5 * * * *',
  EVERY_15_MINUTES: '*/15 * * * *',
  EVERY_30_MINUTES: '*/30 * * * *',
  EVERY_HOUR: '0 * * * *',
  EVERY_4_HOURS: '0 */4 * * *',
  DAILY_9AM: '0 9 * * *',
  DAILY_MIDNIGHT: '0 0 * * *',
  WEEKDAYS_9AM: '0 9 * * 1-5',
  MONDAYS_9AM: '0 9 * * 1',
  FIRST_OF_MONTH: '0 0 1 * *',
} as const;
