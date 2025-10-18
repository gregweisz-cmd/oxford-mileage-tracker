/**
 * API Configuration
 * 
 * Currently set to use PRODUCTION backend for testing from anywhere.
 * Data will sync to Render.com and be visible at:
 * https://oxford-mileage-tracker.vercel.app
 */

// Production backend URL (Render.com deployment)
const PRODUCTION_API_URL = 'https://oxford-mileage-backend.onrender.com/api';

// Local development backend URL (for testing on same network)
const LOCAL_API_URL = 'http://192.168.86.101:3002/api';

// TEMPORARY: Force production for mobile testing from anywhere
// This allows testing while driving without localhost connectivity
const USE_PRODUCTION_FOR_TESTING = false;

// Determine which API URL to use
export const API_BASE_URL = USE_PRODUCTION_FOR_TESTING
  ? PRODUCTION_API_URL
  : (__DEV__ ? LOCAL_API_URL : PRODUCTION_API_URL);

// API Configuration
export const API_CONFIG = {
  baseUrl: API_BASE_URL,
  timeout: 30000, // 30 seconds
  retryAttempts: 3,
};

// Log which API we're using
console.log(`🌐 API Configuration: ${USE_PRODUCTION_FOR_TESTING ? '🌍 PRODUCTION (Testing)' : (__DEV__ ? '🏠 LOCAL' : '🌍 PRODUCTION')}`);
console.log(`📡 API Base URL: ${API_BASE_URL}`);

export default API_BASE_URL;
