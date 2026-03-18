/**
 * Natural Language Date Parser Utility
 * Phase J: Parse natural language time expressions for AI call tools
 *
 * Examples:
 * - "tomorrow at 2pm" -> Date
 * - "next Monday" -> Date
 * - "in 3 days" -> Date
 * - "next week" -> Date
 */

/**
 * Parse natural language datetime expressions
 * Returns a Date object or null if parsing fails
 */
export function parseNaturalDateTime(input: string, timezone?: string): Date | null {
  if (!input) return null;

  const now = new Date();
  const text = input.toLowerCase().trim();

  try {
    // Try ISO format first
    if (/^\d{4}-\d{2}-\d{2}/.test(input)) {
      const date = new Date(input);
      if (!isNaN(date.getTime())) {
        return date;
      }
    }

    // Tomorrow
    if (text.includes('tomorrow')) {
      const date = new Date(now);
      date.setDate(date.getDate() + 1);
      return extractAndSetTime(date, text);
    }

    // Today
    if (text.includes('today')) {
      const date = new Date(now);
      return extractAndSetTime(date, text);
    }

    // In X days/hours/minutes
    const inMatch = text.match(/in\s+(\d+)\s+(day|hour|minute|week)s?/);
    if (inMatch) {
      const amount = parseInt(inMatch[1]);
      const unit = inMatch[2];
      const date = new Date(now);

      switch (unit) {
        case 'minute':
          date.setMinutes(date.getMinutes() + amount);
          break;
        case 'hour':
          date.setHours(date.getHours() + amount);
          break;
        case 'day':
          date.setDate(date.getDate() + amount);
          break;
        case 'week':
          date.setDate(date.getDate() + amount * 7);
          break;
      }
      return date;
    }

    // Next [day of week]
    const dayMatch = text.match(/next\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/);
    if (dayMatch) {
      const targetDay = getDayNumber(dayMatch[1]);
      const date = new Date(now);
      const currentDay = date.getDay();
      let daysToAdd = targetDay - currentDay;
      if (daysToAdd <= 0) daysToAdd += 7;
      date.setDate(date.getDate() + daysToAdd);
      return extractAndSetTime(date, text);
    }

    // Next week/month
    if (text.includes('next week')) {
      const date = new Date(now);
      date.setDate(date.getDate() + 7);
      return extractAndSetTime(date, text);
    }

    if (text.includes('next month')) {
      const date = new Date(now);
      date.setMonth(date.getMonth() + 1);
      return extractAndSetTime(date, text);
    }

    // This [day of week]
    const thisDayMatch = text.match(/this\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/);
    if (thisDayMatch) {
      const targetDay = getDayNumber(thisDayMatch[1]);
      const date = new Date(now);
      const currentDay = date.getDay();
      let daysToAdd = targetDay - currentDay;
      if (daysToAdd < 0) daysToAdd += 7;
      date.setDate(date.getDate() + daysToAdd);
      return extractAndSetTime(date, text);
    }

    // Morning/afternoon/evening references
    if (text.includes('morning')) {
      const date = new Date(now);
      if (!text.includes('tomorrow') && !text.includes('today')) {
        date.setDate(date.getDate() + 1);
      }
      date.setHours(9, 0, 0, 0);
      return date;
    }

    if (text.includes('afternoon')) {
      const date = new Date(now);
      if (!text.includes('tomorrow') && !text.includes('today')) {
        date.setDate(date.getDate() + 1);
      }
      date.setHours(14, 0, 0, 0);
      return date;
    }

    if (text.includes('evening')) {
      const date = new Date(now);
      if (!text.includes('tomorrow') && !text.includes('today')) {
        date.setDate(date.getDate() + 1);
      }
      date.setHours(18, 0, 0, 0);
      return date;
    }

    // End of day/week
    if (text.includes('end of day') || text.includes('eod')) {
      const date = new Date(now);
      date.setHours(17, 0, 0, 0);
      return date;
    }

    if (text.includes('end of week') || text.includes('eow')) {
      const date = new Date(now);
      const daysUntilFriday = 5 - date.getDay();
      if (daysUntilFriday <= 0) {
        date.setDate(date.getDate() + 7 + daysUntilFriday);
      } else {
        date.setDate(date.getDate() + daysUntilFriday);
      }
      date.setHours(17, 0, 0, 0);
      return date;
    }

    // Try to parse time only and apply to tomorrow
    const timeDate = extractTime(text);
    if (timeDate) {
      const date = new Date(now);
      // If time is in the past today, schedule for tomorrow
      if (
        date.getHours() > timeDate.hours ||
        (date.getHours() === timeDate.hours && date.getMinutes() >= timeDate.minutes)
      ) {
        date.setDate(date.getDate() + 1);
      }
      date.setHours(timeDate.hours, timeDate.minutes, 0, 0);
      return date;
    }

    return null;
  } catch (error) {
    console.warn('[Date Parser] Failed to parse:', input, error);
    return null;
  }
}

/**
 * Extract time from text and set it on the date
 */
function extractAndSetTime(date: Date, text: string): Date {
  const timeInfo = extractTime(text);
  if (timeInfo) {
    date.setHours(timeInfo.hours, timeInfo.minutes, 0, 0);
  } else {
    // Default to 10 AM if no time specified
    date.setHours(10, 0, 0, 0);
  }
  return date;
}

/**
 * Extract time from text
 */
function extractTime(text: string): { hours: number; minutes: number } | null {
  // Match patterns like "2pm", "2:30pm", "14:00", "2 pm"
  const timeMatch = text.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);

  if (!timeMatch) return null;

  let hours = parseInt(timeMatch[1]);
  const minutes = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
  const meridiem = timeMatch[3]?.toLowerCase();

  if (meridiem === 'pm' && hours < 12) {
    hours += 12;
  } else if (meridiem === 'am' && hours === 12) {
    hours = 0;
  }

  if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
    return { hours, minutes };
  }

  return null;
}

/**
 * Get day number from day name
 */
function getDayNumber(day: string): number {
  const days: Record<string, number> = {
    sunday: 0,
    monday: 1,
    tuesday: 2,
    wednesday: 3,
    thursday: 4,
    friday: 5,
    saturday: 6,
  };
  return days[day] ?? 0;
}

/**
 * Format a date for display
 */
export function formatDateTime(date: Date): string {
  return date.toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * Get relative time description
 */
export function getRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return 'today';
  } else if (diffDays === 1) {
    return 'tomorrow';
  } else if (diffDays < 7) {
    return `in ${diffDays} days`;
  } else if (diffDays < 14) {
    return 'next week';
  } else {
    return `on ${date.toLocaleDateString()}`;
  }
}
