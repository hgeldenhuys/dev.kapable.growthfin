/**
 * Recurrence Utilities
 * Calculate next execution dates for daily/weekly/monthly patterns
 */

import { toUTC, validateTimezone } from './timezone';

export interface DailyRecurrenceConfig {
  hour: number; // 0-23
  minute: number; // 0-59
}

export interface WeeklyRecurrenceConfig {
  daysOfWeek: number[]; // 0-6 (Sunday-Saturday)
  hour: number;
  minute: number;
}

export interface MonthlyRecurrenceConfig {
  dayOfMonth: number; // 1-31
  hour: number;
  minute: number;
}

export type RecurrenceConfig =
  | DailyRecurrenceConfig
  | WeeklyRecurrenceConfig
  | MonthlyRecurrenceConfig;

export type RecurrencePattern = 'daily' | 'weekly' | 'monthly';

/**
 * Validate recurrence configuration
 */
export function validateRecurrenceConfig(
  pattern: RecurrencePattern,
  config: RecurrenceConfig
): void {
  // Validate hour and minute (common to all patterns)
  if ('hour' in config) {
    if (config.hour < 0 || config.hour > 23) {
      throw new Error('Hour must be between 0 and 23');
    }
  }

  if ('minute' in config) {
    if (config.minute < 0 || config.minute > 59) {
      throw new Error('Minute must be between 0 and 59');
    }
  }

  switch (pattern) {
    case 'daily':
      if (!('hour' in config) || !('minute' in config)) {
        throw new Error('Daily pattern requires hour and minute');
      }
      break;

    case 'weekly':
      if (!('daysOfWeek' in config)) {
        throw new Error('Weekly pattern requires daysOfWeek array');
      }
      const weeklyConfig = config as WeeklyRecurrenceConfig;
      if (!Array.isArray(weeklyConfig.daysOfWeek) || weeklyConfig.daysOfWeek.length === 0) {
        throw new Error('daysOfWeek must be a non-empty array');
      }
      for (const day of weeklyConfig.daysOfWeek) {
        if (day < 0 || day > 6) {
          throw new Error('daysOfWeek values must be between 0 (Sunday) and 6 (Saturday)');
        }
      }
      break;

    case 'monthly':
      if (!('dayOfMonth' in config)) {
        throw new Error('Monthly pattern requires dayOfMonth');
      }
      const monthlyConfig = config as MonthlyRecurrenceConfig;
      if (monthlyConfig.dayOfMonth < 1 || monthlyConfig.dayOfMonth > 31) {
        throw new Error('dayOfMonth must be between 1 and 31');
      }
      break;

    default:
      throw new Error(`Invalid recurrence pattern: ${pattern}`);
  }
}

/**
 * Calculate the next N execution times for a recurrence pattern
 */
export function calculateNextExecutions(
  pattern: RecurrencePattern,
  config: RecurrenceConfig,
  timezone: string,
  count: number,
  startFrom: Date = new Date()
): Date[] {
  if (!validateTimezone(timezone)) {
    throw new Error(`Invalid timezone: ${timezone}`);
  }

  validateRecurrenceConfig(pattern, config);

  if (count < 1) {
    throw new Error('Count must be at least 1');
  }

  const executions: Date[] = [];
  let currentDate = new Date(startFrom);

  switch (pattern) {
    case 'daily':
      const dailyConfig = config as DailyRecurrenceConfig;
      for (let i = 0; i < count; i++) {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth() + 1;
        const day = currentDate.getDate();

        // Create execution time in timezone
        let executionTime = toUTC(
          year,
          month,
          day,
          dailyConfig.hour,
          dailyConfig.minute,
          timezone
        );

        // If execution time is in the past, move to next day
        if (executionTime <= startFrom) {
          currentDate.setDate(currentDate.getDate() + 1);
          const nextYear = currentDate.getFullYear();
          const nextMonth = currentDate.getMonth() + 1;
          const nextDay = currentDate.getDate();

          executionTime = toUTC(
            nextYear,
            nextMonth,
            nextDay,
            dailyConfig.hour,
            dailyConfig.minute,
            timezone
          );
        }

        executions.push(executionTime);
        currentDate = new Date(executionTime);
        currentDate.setDate(currentDate.getDate() + 1);
      }
      break;

    case 'weekly':
      const weeklyConfig = config as WeeklyRecurrenceConfig;
      const sortedDays = [...weeklyConfig.daysOfWeek].sort((a, b) => a - b);

      while (executions.length < count) {
        const currentDay = currentDate.getDay();

        // Find next matching day
        const nextDays = sortedDays.filter((d) => d > currentDay);

        let daysToAdd: number;
        if (nextDays.length > 0) {
          // Next day this week
          daysToAdd = nextDays[0] - currentDay;
        } else {
          // First day next week
          daysToAdd = 7 - currentDay + sortedDays[0];
        }

        currentDate.setDate(currentDate.getDate() + daysToAdd);

        const year = currentDate.getFullYear();
        const month = currentDate.getMonth() + 1;
        const day = currentDate.getDate();

        const executionTime = toUTC(
          year,
          month,
          day,
          weeklyConfig.hour,
          weeklyConfig.minute,
          timezone
        );

        // Only add if in future
        if (executionTime > startFrom) {
          executions.push(executionTime);
        }

        // Move to next day for next iteration
        currentDate.setDate(currentDate.getDate() + 1);
      }
      break;

    case 'monthly':
      const monthlyConfig = config as MonthlyRecurrenceConfig;

      for (let i = 0; i < count; i++) {
        let year = currentDate.getFullYear();
        let month = currentDate.getMonth() + 1;

        // Handle months with fewer days (e.g., Feb 31 -> last day of Feb)
        const daysInMonth = new Date(year, month, 0).getDate();
        const day = Math.min(monthlyConfig.dayOfMonth, daysInMonth);

        let executionTime = toUTC(
          year,
          month,
          day,
          monthlyConfig.hour,
          monthlyConfig.minute,
          timezone
        );

        // If execution time is in the past, move to next month
        if (executionTime <= startFrom) {
          month += 1;
          if (month > 12) {
            month = 1;
            year += 1;
          }

          const nextDaysInMonth = new Date(year, month, 0).getDate();
          const nextDay = Math.min(monthlyConfig.dayOfMonth, nextDaysInMonth);

          executionTime = toUTC(
            year,
            month,
            nextDay,
            monthlyConfig.hour,
            monthlyConfig.minute,
            timezone
          );
        }

        executions.push(executionTime);

        // Move to next month for next iteration
        currentDate = new Date(year, month, 1);
        currentDate.setMonth(currentDate.getMonth() + 1);
      }
      break;
  }

  return executions;
}

/**
 * Calculate the single next execution time
 */
export function calculateNextExecution(
  pattern: RecurrencePattern,
  config: RecurrenceConfig,
  timezone: string,
  startFrom: Date = new Date()
): Date {
  const executions = calculateNextExecutions(pattern, config, timezone, 1, startFrom);
  return executions[0];
}

/**
 * Check if recurrence has ended based on end conditions
 */
export function hasRecurrenceEnded(
  executionCount: number,
  endCondition: 'never' | 'after_executions' | 'end_date',
  maxExecutions?: number,
  endDate?: Date
): boolean {
  switch (endCondition) {
    case 'never':
      return false;

    case 'after_executions':
      if (maxExecutions === undefined) {
        throw new Error('maxExecutions required for after_executions end condition');
      }
      return executionCount >= maxExecutions;

    case 'end_date':
      if (endDate === undefined) {
        throw new Error('endDate required for end_date end condition');
      }
      return new Date() >= endDate;

    default:
      throw new Error(`Invalid end condition: ${endCondition}`);
  }
}
