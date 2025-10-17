/**
 * Debug Configuration
 * Control verbose logging throughout the application
 */

export const DEBUG_CONFIG = {
  // Enable verbose logging for development
  ENABLED: __DEV__,
  
  // Specific debug flags for different modules
  DATABASE: false,
  API_SYNC: false,
  PER_DIEM_RULES: false,
  GPS_TRACKING: false,
  RECEIPTS: false,
  AUTHENTICATION: false,
  
  // Helper function to log only when debug is enabled
  log: (module: keyof Omit<typeof DEBUG_CONFIG, 'ENABLED' | 'log' | 'error'>, ...args: any[]) => {
    if (DEBUG_CONFIG.ENABLED && DEBUG_CONFIG[module]) {
      console.log(...args);
    }
  },
  
  // Always log errors regardless of debug settings
  error: (...args: any[]) => {
    console.error(...args);
  }
};

