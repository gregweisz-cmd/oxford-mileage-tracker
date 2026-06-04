/**
 * Date Formatting Utilities
 * Handles timezone-safe date display and local calendar-day keys.
 */

/** YYYY-MM-DD in the device local calendar (avoids UTC day shift from `toISOString`). */
export function toLocalDateKey(date: Date): string {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Midnight at the start of the local calendar day for `date`. */
export function startOfLocalDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function isSameLocalCalendarDay(a: Date, b: Date): boolean {
  return toLocalDateKey(a) === toLocalDateKey(b);
}

/**
 * Format a date for display, handling date-only values correctly
 * Prevents timezone conversion issues where "2025-10-15" shows as "Oct 14"
 */
export const formatDateSafe = (date: Date | string, format: 'short' | 'long' = 'short'): string => {
  const dateObj = date instanceof Date ? date : new Date(date);
  
  // Check if this is a date-only value (midnight UTC)
  // These should be displayed as-is without timezone conversion
  if (dateObj.getUTCHours() === 0 && 
      dateObj.getUTCMinutes() === 0 && 
      dateObj.getUTCSeconds() === 0 &&
      dateObj.getUTCMilliseconds() === 0) {
    
    // Extract the date components from the ISO string
    const isoString = dateObj.toISOString();
    const dateStr = isoString.split('T')[0];
    const [year, month, day] = dateStr.split('-').map(Number);
    
    // Create a new date in local timezone (noon to avoid DST issues)
    const localDate = new Date(year, month - 1, day, 12, 0, 0);
    
    if (format === 'long') {
      return localDate.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    }
    
    return localDate.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }
  
  // For datetime values, use normal formatting
  if (format === 'long') {
    return dateObj.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }
  
  return dateObj.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
};

/**
 * Get device timezone
 */
export const getDeviceTimezone = (): string => {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
};

/**
 * Get timezone offset in hours
 */
export const getTimezoneOffset = (): number => {
  return -new Date().getTimezoneOffset() / 60;
};

/**
 * Log timezone information for debugging
 */
export const logTimezoneInfo = (): void => {
  console.log('⏰ Timezone Info:');
  console.log(`   Timezone: ${getDeviceTimezone()}`);
  console.log(`   Offset: GMT${getTimezoneOffset() >= 0 ? '+' : ''}${getTimezoneOffset()}`);
  console.log(`   Current time: ${new Date().toLocaleString()}`);
};

