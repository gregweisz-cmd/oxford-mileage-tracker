/**
 * Debug Configuration for Backend Server
 * Controls verbose logging throughout the server
 */

// Determine if debug logging should be enabled
// In production, set NODE_ENV to 'production' to disable verbose logging
const IS_DEBUG_MODE = process.env.NODE_ENV !== 'production';

/**
 * Conditionally logs messages only when IS_DEBUG_MODE is true.
 * @param {...any} messages - The messages to log.
 */
function debugLog(...messages) {
  if (IS_DEBUG_MODE) {
    console.log(...messages);
  }
}

/**
 * Conditionally logs warnings only when IS_DEBUG_MODE is true.
 * @param {...any} messages - The messages to log.
 */
function debugWarn(...messages) {
  if (IS_DEBUG_MODE) {
    console.warn(...messages);
  }
}

/**
 * Always logs errors, regardless of IS_DEBUG_MODE.
 * @param {...any} messages - The messages to log.
 */
function debugError(...messages) {
  console.error(...messages);
}

// Log the debug mode status on startup
debugLog(`Backend Debug mode is ${IS_DEBUG_MODE ? 'ENABLED' : 'DISABLED'}`);

module.exports = {
  debugLog,
  debugWarn,
  debugError,
  IS_DEBUG_MODE
};

