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

/** Allow any Vercel preview/deployment (*.vercel.app) */
function isAllowedOrigin(origin) {
  if (!origin) return true;
  if (origin.includes('localhost') || origin.includes('192.168.') || origin.includes('10.0.') || origin.includes('172.')) return true;
  if (allowedOrigins.includes(origin)) return true;
  try {
    const u = new URL(origin);
    if (u.hostname.endsWith('.vercel.app')) return true;
  } catch (_) { /* ignore */ }
  return false;
}

/**
 * CORS origin validation function
 */
const corsOptions = {
  origin: function (origin, callback) {
    if (isAllowedOrigin(origin)) {
      return callback(null, true);
    }
    if (process.env.NODE_ENV !== 'production') {
      return callback(null, true);
    }
    callback(new Error('Not allowed by CORS'));
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
  if (!origin || process.env.NODE_ENV !== 'production') {
    res.header('Access-Control-Allow-Origin', origin || '*');
  } else if (isAllowedOrigin(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
  } else {
    res.header('Access-Control-Allow-Origin', '*');
  }
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Cache-Control, Pragma, X-Requested-With');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.sendStatus(200);
}

/** Set CORS headers on a response (for error handler so errors still have CORS) */
function setCorsHeaders(req, res) {
  const origin = req.headers.origin;
  if (origin && isAllowedOrigin(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Credentials', 'true');
}

module.exports = {
  corsMiddleware,
  handlePreflight,
  setCorsHeaders
};

