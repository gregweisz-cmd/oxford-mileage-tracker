/**
 * API Configuration
 * 
 * MAIN BRANCH - LOCALHOST TESTING
 * Temporarily pointing to localhost for testing sync issues
 * Will revert to production URL once testing is complete
 */

// TEMPORARY: Force localhost for sync testing
const FORCE_LOCALHOST_TESTING = true;

// Production backend URL (Render.com deployment)
const PRODUCTION_API_URL = 'https://oxford-mileage-backend.onrender.com/api';

// Local development backend URL
const LOCAL_API_URL = 'http://192.168.86.101:3002/api';

// Determine which API URL to use
export const API_BASE_URL = FORCE_LOCALHOST_TESTING
  ? LOCAL_API_URL
  : PRODUCTION_API_URL;

// API Configuration
export const API_CONFIG = {
  baseUrl: API_BASE_URL,
  timeout: 30000, // 30 seconds
  retryAttempts: 3,
};

// Log which API we're using
console.log(`🌐 API Configuration: ${FORCE_LOCALHOST_TESTING ? '🏠 LOCALHOST TESTING' : '🌍 PRODUCTION'}`);
console.log(`📡 API Base URL: ${API_BASE_URL}`);

export default API_BASE_URL;

