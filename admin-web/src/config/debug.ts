/**
 * Debug Configuration for Web Portal
 * Controls verbose logging throughout the application
 * 
 * Logging Strategy (minimal by default):
 * - ERROR: Always logged (critical errors only - production safe)
 * - WARN: Development only (non-critical warnings)
 * - INFO: Development only (important user actions - login, major operations)
 * - VERBOSE: Disabled by default (frequent operational logs - syncs, refreshes, etc.)
 */

// Enable/disable debug logging (only in development)
const DEBUG = process.env.NODE_ENV === 'development';

// Verbose logging disabled by default - too noisy and impacts performance
// Set to true ONLY when deep debugging is needed
const VERBOSE = false;

/**
 * Log errors - ALWAYS logged (even in production)
 * Use ONLY for critical errors that need production tracking
 */
export const debugError = (...args: any[]) => {
  console.error(...args);
};

/**
 * Log warnings - Only in development
 * Use for non-critical issues or deprecation warnings
 */
export const debugWarn = (...args: any[]) => {
  if (DEBUG) {
    console.warn(...args);
  }
};

/**
 * Log info - Only in development, minimal usage
 * Use ONLY for important user actions:
 * - Login/logout
 * - Major operations (submit report, approve, etc.)
 * - NOT for frequent operations like syncs, refreshes, etc.
 */
export const debugLog = (...args: any[]) => {
  if (DEBUG) {
    console.log(...args);
  }
};

/**
 * Verbose debug logging - DISABLED by default
 * Use for frequent operational logs that happen constantly:
 * - WebSocket connections
 * - Sync operations
 * - Cache clearing
 * - Data refreshes
 * 
 * These should NOT be enabled in normal operation
 */
export const debugVerbose = (...args: any[]) => {
  if (VERBOSE && DEBUG) {
    console.log('[VERBOSE]', ...args);
  }
};

export const isDebugEnabled = () => DEBUG;
export const isVerboseEnabled = () => VERBOSE;

export default DEBUG;
