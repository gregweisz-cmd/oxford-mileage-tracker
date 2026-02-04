/**
 * API configuration. Production = Render.com; local = your machine on port 3003.
 * USE_PRODUCTION_FOR_TESTING: true = Render, false = local. LOCAL_IP: set for Expo Go on device (from exp://192.168.x.x:8081); empty for simulator.
 */
const PRODUCTION_API_URL = 'https://oxford-mileage-backend.onrender.com/api';
const LOCAL_IP = '192.168.86.32';

const LOCAL_API_URL = LOCAL_IP
  ? `http://${LOCAL_IP}:3003/api`
  : 'http://localhost:3003/api';

const USE_PRODUCTION_FOR_TESTING = true;

export const API_BASE_URL = USE_PRODUCTION_FOR_TESTING
  ? PRODUCTION_API_URL
  : (__DEV__ ? LOCAL_API_URL : PRODUCTION_API_URL);

export const API_CONFIG = {
  baseUrl: API_BASE_URL,
  timeout: 30000,
  retryAttempts: 3,
};

console.log(`🌐 API Configuration: ${USE_PRODUCTION_FOR_TESTING ? '🌍 PRODUCTION (Testing)' : (__DEV__ ? '🏠 LOCAL' : '🌍 PRODUCTION')}`);
console.log(`📡 API Base URL: ${API_BASE_URL}`);

export default API_BASE_URL;
