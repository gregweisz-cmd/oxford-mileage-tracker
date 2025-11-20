/**
 * Debug Configuration for Web Portal
 * Controls verbose logging throughout the application
 */

// Enable/disable debug logging
// Set to true for development, false for production
const DEBUG = process.env.NODE_ENV === 'development';

/**
 * Debug logging utility
 * Only logs when DEBUG is enabled
 */
export const debugLog = (...args: any[]) => {
  if (DEBUG) {
    console.log(...args);
  }
};

/**
 * Debug error logging
 * Always logs errors, regardless of DEBUG flag
 */
export const debugError = (...args: any[]) => {
  console.error(...args);
};

/**
 * Debug warning logging
 * Logs warnings when DEBUG is enabled
 */
export const debugWarn = (...args: any[]) => {
  if (DEBUG) {
    console.warn(...args);
  }
};

/**
 * Check if debug mode is enabled
 */
export const isDebugEnabled = () => DEBUG;

export default DEBUG;

