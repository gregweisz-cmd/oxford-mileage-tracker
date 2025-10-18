/**
 * API Configuration
 * 
 * Automatically uses:
 * - Local backend (192.168.86.101:3002) when running in development mode
 * - Production backend (Render.com) when running published builds
 */

// Production backend URL (Render.com deployment)
const PRODUCTION_API_URL = 'https://oxford-mileage-backend.onrender.com/api';

// Local development backend URL (for testing on same network)
const LOCAL_API_URL = 'http://192.168.86.101:3002/api';

// Determine which API URL to use based on development mode
export const API_BASE_URL = __DEV__
  ? LOCAL_API_URL
  : PRODUCTION_API_URL;

// API Configuration
export const API_CONFIG = {
  baseUrl: API_BASE_URL,
  timeout: 30000, // 30 seconds
  retryAttempts: 3,
};

// Log which API we're using
console.log(`🌐 API Configuration: ${__DEV__ ? '🏠 LOCAL' : '🌍 PRODUCTION'}`);
console.log(`📡 API Base URL: ${API_BASE_URL}`);

export default API_BASE_URL;
