/**
 * Timezone Utilities
 * Convert between timezones and validate IANA timezone strings
 */

// IANA timezone validation (common timezones)
const VALID_TIMEZONES = new Set([
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Phoenix',
  'America/Anchorage',
  'America/Honolulu',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Europe/Rome',
  'Europe/Madrid',
  'Europe/Amsterdam',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Asia/Hong_Kong',
  'Asia/Singapore',
  'Asia/Dubai',
  'Australia/Sydney',
  'Australia/Melbourne',
  'Pacific/Auckland',
  'Africa/Johannesburg',
  'Africa/Cairo',
  'Africa/Lagos',
]);

/**
 * Validate IANA timezone string
 */
export function validateTimezone(timezone: string): boolean {
  if (!timezone) {
    return false;
  }

  // Check against known timezones
  if (VALID_TIMEZONES.has(timezone)) {
    return true;
  }

  // For unknown timezones, try to use them with Intl.DateTimeFormat to verify they're valid
  try {
    // This will throw if the timezone is invalid
    new Intl.DateTimeFormat('en-US', { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

/**
 * Get timezone offset in minutes from UTC
 * Uses Intl.DateTimeFormat for accurate timezone offsets including DST
 */
export function getTimezoneOffset(timezone: string, date: Date = new Date()): number {
  if (!validateTimezone(timezone)) {
    throw new Error(`Invalid timezone: ${timezone}`);
  }

  // For UTC, offset is always 0
  if (timezone === 'UTC') {
    return 0;
  }

  try {
    // Get UTC time
    const utcDate = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }));

    // Get time in target timezone
    const tzDate = new Date(date.toLocaleString('en-US', { timeZone: timezone }));

    // Calculate offset in minutes
    const offset = (tzDate.getTime() - utcDate.getTime()) / (1000 * 60);

    return offset;
  } catch (error) {
    throw new Error(`Failed to calculate offset for timezone ${timezone}: ${error}`);
  }
}

/**
 * Convert a date/time from one timezone to another
 */
export function convertTimezone(
  date: Date,
  fromTimezone: string,
  toTimezone: string
): Date {
  if (!validateTimezone(fromTimezone)) {
    throw new Error(`Invalid source timezone: ${fromTimezone}`);
  }
  if (!validateTimezone(toTimezone)) {
    throw new Error(`Invalid target timezone: ${toTimezone}`);
  }

  // If same timezone, return copy
  if (fromTimezone === toTimezone) {
    return new Date(date);
  }

  try {
    // Get time string in source timezone
    const dateString = date.toLocaleString('en-US', { timeZone: fromTimezone });

    // Parse as if it's in target timezone
    const targetDate = new Date(dateString + ' ' + toTimezone);

    return targetDate;
  } catch (error) {
    throw new Error(`Failed to convert timezone: ${error}`);
  }
}

/**
 * Convert a local time specification to UTC
 *
 * @param year - Year
 * @param month - Month (1-12)
 * @param day - Day of month
 * @param hour - Hour (0-23)
 * @param minute - Minute (0-59)
 * @param timezone - IANA timezone string
 * @returns UTC Date object
 */
export function toUTC(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timezone: string
): Date {
  if (!validateTimezone(timezone)) {
    throw new Error(`Invalid timezone: ${timezone}`);
  }

  // Create date string in ISO format (but local to timezone)
  const localDateString = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`;

  if (timezone === 'UTC') {
    return new Date(localDateString + 'Z');
  }

  try {
    // Create formatter for the target timezone
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });

    // Parse the local date string as UTC first
    const tempDate = new Date(localDateString + 'Z');

    // Get offset
    const offset = getTimezoneOffset(timezone, tempDate);

    // Adjust for offset (subtract because we're going FROM local TO UTC)
    const utcTime = tempDate.getTime() - (offset * 60 * 1000);

    return new Date(utcTime);
  } catch (error) {
    throw new Error(`Failed to convert to UTC: ${error}`);
  }
}

/**
 * Get current time in a specific timezone
 */
export function nowInTimezone(timezone: string): Date {
  if (!validateTimezone(timezone)) {
    throw new Error(`Invalid timezone: ${timezone}`);
  }

  const now = new Date();

  if (timezone === 'UTC') {
    return now;
  }

  // Get local time string in target timezone
  const localString = now.toLocaleString('en-US', { timeZone: timezone });

  return new Date(localString);
}

/**
 * Format date in timezone for display
 */
export function formatInTimezone(
  date: Date,
  timezone: string,
  format: 'full' | 'date' | 'time' = 'full'
): string {
  if (!validateTimezone(timezone)) {
    throw new Error(`Invalid timezone: ${timezone}`);
  }

  const options: Intl.DateTimeFormatOptions = {};

  switch (format) {
    case 'full':
      options.year = 'numeric';
      options.month = 'long';
      options.day = 'numeric';
      options.hour = '2-digit';
      options.minute = '2-digit';
      options.timeZoneName = 'short';
      break;
    case 'date':
      options.year = 'numeric';
      options.month = 'long';
      options.day = 'numeric';
      break;
    case 'time':
      options.hour = '2-digit';
      options.minute = '2-digit';
      options.timeZoneName = 'short';
      break;
  }

  return date.toLocaleString('en-US', { ...options, timeZone: timezone });
}

export { VALID_TIMEZONES };
