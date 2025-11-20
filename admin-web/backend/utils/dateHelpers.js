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
  
  // If already in YYYY-MM-DD format, return as-is
  if (typeof dateValue === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
    return dateValue;
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
  
  // Format as YYYY-MM-DD
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

module.exports = {
  normalizeDateString,
};

