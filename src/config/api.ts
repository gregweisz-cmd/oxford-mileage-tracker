/**
 * API Configuration
 *
 * Set USE_PRODUCTION_FOR_TESTING to true to use Render.com backend; false for local backend.
 * On a physical device (Expo Go), localhost won't work — set LOCAL_IP to your computer's IP.
 */

// Production backend URL (Render.com deployment)
const PRODUCTION_API_URL = 'https://oxford-mileage-backend.onrender.com/api';

// Your computer's IP on the local network (for Expo Go on physical device).
// Leave empty to use localhost (simulator/emulator only). Find IP: Expo shows it as "exp://192.168.x.x:8081", or: ipconfig (Windows) / ifconfig (Mac)
const LOCAL_IP = '192.168.86.32';

const LOCAL_API_URL = LOCAL_IP
  ? `http://${LOCAL_IP}:3003/api`
  : 'http://localhost:3003/api';

// Production mode: true = Render backend; false = local backend (must be running on port 3003)
const USE_PRODUCTION_FOR_TESTING = true;

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
