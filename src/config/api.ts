/**
 * API Configuration
 * 
 * Currently set to use LOCAL backend for development.
 * Set USE_PRODUCTION_FOR_TESTING to true to use Render.com backend.
 */

// Production backend URL (Render.com deployment)
const PRODUCTION_API_URL = 'https://oxford-mileage-backend.onrender.com/api';

// Local development backend URL (for testing on same network)
// Use localhost for simulator/emulator/web, or your computer's local IP for physical device
// To find your IP: Windows: ipconfig | findstr IPv4, Mac/Linux: ifconfig | grep inet
// For physical device testing, update the IP address below to your computer's local IP
const LOCAL_API_URL = 'http://localhost:3003/api';  // For simulator/emulator/web
// const LOCAL_API_URL = 'http://192.168.86.101:3003/api';  // Uncomment and update IP for physical device

// Production mode: Set to true to use Render.com backend; false for local backend (localhost:3003)
const USE_PRODUCTION_FOR_TESTING = true; // Production: use Render backend

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
