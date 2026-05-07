/**
 * Rate Limiting Middleware
 * Protects API endpoints from brute force attacks and DDoS
 */

const rateLimit = require('express-rate-limit');
const { debugLog, debugWarn } = require('../debug');

/**
 * Key generator for general API rate limiting.
 *
 * Prefer the authenticated user identifier so that a full office of staff
 * sharing one egress IP (recovery houses, VPNs, shared WiFi) doesn't trip a
 * single IP-based bucket. We accept either `x-employee-id` (the canonical
 * header used by most clients in this app) or `x-user-id` (legacy/alternate
 * name some clients still send). Falls back to the request IP for
 * anonymous/preflight requests.
 *
 * IP-based limiting is still used for the auth/login limiter intentionally,
 * since pre-login traffic has no user id and we explicitly want to cap brute
 * force attempts per source IP.
 */
function userOrIpKey(req) {
  const headers = req.headers || {};
  const candidate = headers['x-employee-id'] || headers['x-user-id'];
  if (typeof candidate === 'string' && candidate.trim().length > 0) {
    return `user:${candidate.trim()}`;
  }
  // Fall back to express-rate-limit's default IP resolution.
  return req.ip;
}

/**
 * General API rate limiter
 * Limits: 200 requests per 15 minutes per IP in production (increased from 100)
 * In development: Essentially disabled (1000 is very high)
 * In production: Provides protection against abuse while allowing normal usage
 */
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 1000 : 1000, // Increased to 1000 for production (allows ~66 requests per minute) to handle sync operations
  message: {
    error: 'Too many requests, please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  // Key on authenticated user id when available so 300+ staff sharing an
  // office egress IP don't all share a single rate-limit bucket.
  keyGenerator: userOrIpKey,
  handler: (req, res) => {
    const key = userOrIpKey(req);
    debugWarn(`⚠️  Rate limit exceeded for ${key}, Path: ${req.path}`);
    res.status(429).json({
      error: 'Too many requests, please try again later.',
      retryAfter: '15 minutes'
    });
  },
  skip: (req) => {
    // Skip rate limiting for health checks and in development
    if (process.env.NODE_ENV !== 'production') {
      return true; // Disable rate limiting entirely in development
    }
    // Skip OPTIONS (preflight) so CORS preflight always gets through
    if (req.method === 'OPTIONS') return true;
    // Skip rate limiting for health checks and auth verify (frequently called)
    return req.path === '/api/health' || req.path === '/health' || req.path === '/api/auth/verify';
  }
});

/**
 * Strict rate limiter for authentication endpoints (login only)
 * Limits: 20 requests per 15 minutes per IP in production (prevents brute force)
 * In development: Much higher limit (100) to avoid blocking during testing
 * Note: Successful logins don't count toward the limit (skipSuccessfulRequests: true)
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 50 : 100, // Increased from 20 to 50 for production
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
  // Only count failed login attempts (successful logins don't count)
  skipSuccessfulRequests: true, // Changed from false - only count failed attempts
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
 * Limits: 30 uploads per hour per user (was 10/hr per IP — too tight when many
 * staff share a single office egress IP). Falls back to IP for unauthenticated
 * uploads.
 */
const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 30,
  message: {
    error: 'Too many file uploads, please try again later.',
    retryAfter: '1 hour'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: userOrIpKey,
  handler: (req, res) => {
    const key = userOrIpKey(req);
    debugWarn(`⚠️  Upload rate limit exceeded for ${key}`);
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
    error: 'Too many notification requests, please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Per-user keying so staff sharing an office IP don't all share the same
  // 120/15min bucket and trigger false-positive 429s on each other.
  keyGenerator: userOrIpKey,
  handler: (req, res) => {
    const key = userOrIpKey(req);
    debugWarn(`⚠️  Notification polling rate limit exceeded for ${key}`);
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

