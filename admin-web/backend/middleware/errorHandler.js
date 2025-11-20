/**
 * Error Handling Middleware
 * Provides consistent error response format across all endpoints
 * Extracted for centralized error handling
 */

const { debugError } = require('../debug');

/**
 * Standard error handler middleware
 * Formats errors consistently and logs them appropriately
 * 
 * @param {Error} err - Error object
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 * @param {Function} next - Express next middleware function
 */
function errorHandler(err, req, res, next) {
  const timestamp = new Date().toISOString();
  
  // Log error details
  debugError(`[${timestamp}] Error:`, err.stack || err.message);
  
  // Determine error status code
  const statusCode = err.statusCode || err.status || 500;
  
  // Don't leak error details in production
  const errorMessage = process.env.NODE_ENV === 'production' 
    ? 'Something went wrong!' 
    : err.message || 'Internal server error';
  
  // Standard error response format
  const errorResponse = {
    error: errorMessage,
    timestamp,
    path: req.path,
    method: req.method
  };
  
  // Include stack trace in development
  if (process.env.NODE_ENV !== 'production' && err.stack) {
    errorResponse.stack = err.stack;
  }
  
  // Include error code if provided
  if (err.code) {
    errorResponse.code = err.code;
  }
  
  res.status(statusCode).json(errorResponse);
}

/**
 * Async error wrapper
 * Wraps async route handlers to automatically catch and pass errors to error handler
 * 
 * @param {Function} fn - Async route handler function
 * @returns {Function} Wrapped function that catches errors
 * 
 * @example
 * router.get('/api/endpoint', asyncHandler(async (req, res) => {
 *   const data = await someAsyncOperation();
 *   res.json(data);
 * }));
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Create a standardized error object
 * 
 * @param {string} message - Error message
 * @param {number} statusCode - HTTP status code (default: 500)
 * @param {string} code - Error code for client handling (optional)
 * @returns {Error} Error object with statusCode and code properties
 * 
 * @example
 * throw createError('User not found', 404, 'USER_NOT_FOUND');
 */
function createError(message, statusCode = 500, code = null) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.status = statusCode;
  if (code) {
    error.code = code;
  }
  return error;
}

/**
 * Validation error helper
 * Creates a standardized validation error
 * 
 * @param {string} message - Validation error message
 * @param {Object} fields - Object with field names and their errors
 * @returns {Error} Validation error object
 * 
 * @example
 * throw createValidationError('Invalid input', {
 *   email: 'Email is required',
 *   password: 'Password must be at least 8 characters'
 * });
 */
function createValidationError(message, fields = {}) {
  const error = createError(message, 400, 'VALIDATION_ERROR');
  error.fields = fields;
  return error;
}

module.exports = {
  errorHandler,
  asyncHandler,
  createError,
  createValidationError
};

