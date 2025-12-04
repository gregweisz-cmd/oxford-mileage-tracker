/**
 * Rate Limiting Middleware
 * Protects API endpoints from brute force attacks and DDoS
 */

const rateLimit = require('express-rate-limit');
const { debugLog, debugWarn } = require('../debug');

/**
 * General API rate limiter
 * Limits: 1000 requests per 15 minutes per IP (very lenient for development)
 * In development: Essentially disabled (1000 is very high)
 * In production: Still provides protection against abuse
 */
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 100 : 1000, // Much higher limit in development
  message: {
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  handler: (req, res) => {
    debugWarn(`⚠️  Rate limit exceeded for IP: ${req.ip}, Path: ${req.path}`);
    res.status(429).json({
      error: 'Too many requests from this IP, please try again later.',
      retryAfter: '15 minutes'
    });
  },
  skip: (req) => {
    // Skip rate limiting for health checks and in development
    if (process.env.NODE_ENV !== 'production') {
      return true; // Disable rate limiting entirely in development
    }
    return req.path === '/api/health' || req.path === '/health';
  }
});

/**
 * Strict rate limiter for authentication endpoints
 * Limits: 5 requests per 15 minutes per IP in production (prevents brute force)
 * In development: Much higher limit (100) to avoid blocking during testing
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 5 : 100, // Much higher in development
  message: {
    error: 'Too many login attempts from this IP, please try again in 15 minutes.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    debugWarn(`⚠️  Auth rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json({
      error: 'Too many login attempts from this IP. Please try again in 15 minutes.',
      retryAfter: '15 minutes'
    });
  },
  // Track failed attempts
  skipSuccessfulRequests: false, // Count all attempts, successful or not
  skip: (req) => {
    // Skip rate limiting entirely in development
    return process.env.NODE_ENV !== 'production';
  }
});

/**
 * Password reset rate limiter
 * Limits: 3 requests per hour per IP
 */
const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // Limit each IP to 3 password reset attempts per hour
  message: {
    error: 'Too many password reset attempts from this IP, please try again later.',
    retryAfter: '1 hour'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    debugWarn(`⚠️  Password reset rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json({
      error: 'Too many password reset attempts. Please try again in 1 hour.',
      retryAfter: '1 hour'
    });
  }
});

/**
 * Admin endpoint rate limiter
 * Limits: 20 requests per 5 minutes per IP
 */
const adminLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 20, // Limit each IP to 20 requests per 5 minutes
  message: {
    error: 'Too many admin requests from this IP, please try again later.',
    retryAfter: '5 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    debugWarn(`⚠️  Admin rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json({
      error: 'Too many admin requests. Please try again in 5 minutes.',
      retryAfter: '5 minutes'
    });
  }
});

/**
 * File upload rate limiter
 * Limits: 10 uploads per hour per IP
 */
const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // Limit each IP to 10 file uploads per hour
  message: {
    error: 'Too many file uploads from this IP, please try again later.',
    retryAfter: '1 hour'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    debugWarn(`⚠️  Upload rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json({
      error: 'Too many file uploads. Please try again in 1 hour.',
      retryAfter: '1 hour'
    });
  }
});

/**
 * Notification polling rate limiter (more lenient for frequent polling)
 * Limits: 120 requests per 15 minutes per IP in production (allows ~8 requests per minute)
 * In development: Much higher limit (1000) to avoid hitting limits during testing
 */
const notificationPollingLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 120 : 1000, // Much higher in development
  message: {
    error: 'Too many notification requests from this IP, please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    debugWarn(`⚠️  Notification polling rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json({
      error: 'Too many notification requests. Please try again in 15 minutes.',
      retryAfter: '15 minutes'
    });
  },
  skip: (req) => {
    // Skip rate limiting entirely in development
    return process.env.NODE_ENV !== 'production';
  }
});

/**
 * Create a custom rate limiter with configurable options
 * @param {Object} options - Rate limit options
 * @returns {Function} Rate limiter middleware
 */
function createLimiter(options = {}) {
  const {
    windowMs = 15 * 60 * 1000,
    max = 100,
    message = 'Too many requests, please try again later.',
    skip = null
  } = options;

  return rateLimit({
    windowMs,
    max,
    message,
    standardHeaders: true,
    legacyHeaders: false,
    skip: skip || undefined
  });
}

module.exports = {
  generalLimiter,
  authLimiter,
  passwordResetLimiter,
  adminLimiter,
  uploadLimiter,
  notificationPollingLimiter,
  createLimiter
};

