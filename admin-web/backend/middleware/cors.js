/**
 * CORS Middleware
 * Handles CORS configuration and preflight OPTIONS requests
 * Extracted from server.js for better organization
 */

const cors = require('cors');
const { debugLog } = require('../debug');

// Allowed origins configuration
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3001', 
  'https://oxford-mileage-tracker.vercel.app',
  'https://oxford-mileage-tracker-git-main-gregweisz-cmd.vercel.app',
  'https://oxford-mileage-tracker-git-main-goose-weiszs-projects.vercel.app'
];

/**
 * CORS origin validation function
 */
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    
    // Allow mobile app origins (React Native, Expo, etc.)
    if (origin.includes('localhost') || origin.includes('192.168.') || origin.includes('10.0.') || origin.includes('172.')) {
      return callback(null, true);
    }
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      // Allow all origins in development for mobile app testing
      if (process.env.NODE_ENV !== 'production') {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    }
  },
  allowedHeaders: ['Content-Type', 'Authorization', 'x-user-role', 'x-user-id', 'Cache-Control', 'Pragma', 'X-Requested-With'],
  exposedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
};

/**
 * CORS middleware
 */
const corsMiddleware = cors(corsOptions);

/**
 * Handle preflight OPTIONS requests
 */
function handlePreflight(req, res) {
  const origin = req.headers.origin;
  
  // Allow all origins in development, or specific ones in production
  if (!origin || process.env.NODE_ENV !== 'production') {
    res.header('Access-Control-Allow-Origin', origin || '*');
  } else {
    if (allowedOrigins.includes(origin) || origin.includes('192.168.') || origin.includes('10.0.') || origin.includes('172.')) {
      res.header('Access-Control-Allow-Origin', origin);
    } else {
      res.header('Access-Control-Allow-Origin', '*');
    }
  }
  
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Cache-Control, Pragma, X-Requested-With');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.sendStatus(200);
}

module.exports = {
  corsMiddleware,
  handlePreflight
};

