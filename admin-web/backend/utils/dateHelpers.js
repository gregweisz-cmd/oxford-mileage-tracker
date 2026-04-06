/**
 * Date Helper Functions
 * Handles date normalization and formatting
 */

const { debugWarn } = require('../debug');

/**
 * Normalize date string to YYYY-MM-DD format
 * Handles various input formats: MM/DD/YY, YYYY-MM-DD, Date objects, ISO strings
 */
function normalizeDateString(dateValue) {
  if (!dateValue) return '';

  // Prefer calendar YYYY-MM-DD from the start of the string (covers "2026-04-01" and ISO timestamps).
  // Using UTC components from ISO for calendar intent caused off-by-one (e.g. April 1 local → March 31 UTC).
  if (typeof dateValue === 'string') {
    const ymd = dateValue.trim().match(/^(\d{4}-\d{2}-\d{2})/);
    if (ymd) return ymd[1];
  }

  // Try to parse as Date object
  let date;
  if (dateValue instanceof Date) {
    date = dateValue;
  } else if (typeof dateValue === 'string') {
    // Handle MM/DD/YY format
    if (/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(dateValue)) {
      const parts = dateValue.split('/');
      const month = parseInt(parts[0], 10);
      const day = parseInt(parts[1], 10);
      let year = parseInt(parts[2], 10);
      // Convert 2-digit year to 4-digit (assuming 2000s)
      if (year < 100) {
        year += 2000;
      }
      date = new Date(year, month - 1, day);
    } else {
      // Try standard Date parsing
      date = new Date(dateValue);
    }
  } else {
    return '';
  }
  
  // Check if date is valid
  if (isNaN(date.getTime())) {
    debugWarn(`⚠️ Invalid date value: ${dateValue}`);
    return '';
  }

  // For ISO strings (e.g. "2025-01-15T00:00:00.000Z"), use UTC components so the
  // calendar day is preserved regardless of server timezone
  const isIsoString = typeof dateValue === 'string' && dateValue.indexOf('T') !== -1;
  const year = isIsoString ? date.getUTCFullYear() : date.getFullYear();
  const month = isIsoString ? date.getUTCMonth() + 1 : date.getMonth() + 1;
  const day = isIsoString ? date.getUTCDate() : date.getDate();
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

module.exports = {
  normalizeDateString,
};

