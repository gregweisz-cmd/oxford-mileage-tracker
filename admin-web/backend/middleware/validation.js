/**
 * Validation Middleware
 * Provides request validation helpers and middleware
 * Ensures data integrity before processing requests
 */

const { createValidationError } = require('./errorHandler');

/**
 * Validate required fields in request body
 * @param {string[]} requiredFields - Array of required field names
 * @returns {Function} Express middleware function
 * 
 * @example
 * router.post('/api/endpoint', validateRequired(['name', 'email']), (req, res) => {
 *   // req.body.name and req.body.email are guaranteed to exist
 * });
 */
function validateRequired(requiredFields) {
  return (req, res, next) => {
    const missing = [];
    const fieldErrors = {};

    requiredFields.forEach(field => {
      if (!req.body || req.body[field] === undefined || req.body[field] === null || req.body[field] === '') {
        missing.push(field);
        fieldErrors[field] = `${field} is required`;
      }
    });

    if (missing.length > 0) {
      return next(createValidationError(
        `Missing required fields: ${missing.join(', ')}`,
        fieldErrors
      ));
    }

    next();
  };
}

/**
 * Validate email format
 * @param {string} email - Email to validate
 * @returns {boolean} True if valid email format
 */
function isValidEmail(email) {
  if (!email || typeof email !== 'string') return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
}

/**
 * Validate phone number format (10 digits)
 * @param {string} phone - Phone number to validate
 * @returns {boolean} True if valid phone format
 */
function isValidPhone(phone) {
  if (!phone || typeof phone !== 'string') return false;
  const phoneRegex = /^\d{10}$/;
  return phoneRegex.test(phone.replace(/\D/g, ''));
}

/**
 * Validate date string format (YYYY-MM-DD)
 * @param {string} dateString - Date string to validate
 * @returns {boolean} True if valid date format
 */
function isValidDate(dateString) {
  if (!dateString || typeof dateString !== 'string') return false;
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(dateString)) return false;
  const date = new Date(dateString);
  return date instanceof Date && !isNaN(date.getTime());
}

/**
 * Validate email field in request body
 * @param {string} fieldName - Name of email field (default: 'email')
 * @returns {Function} Express middleware function
 */
function validateEmail(fieldName = 'email') {
  return (req, res, next) => {
    const email = req.body?.[fieldName];
    
    if (email !== undefined && email !== null && email !== '' && !isValidEmail(email)) {
      return next(createValidationError(
        `Invalid email format for field: ${fieldName}`,
        { [fieldName]: 'Must be a valid email address' }
      ));
    }

    next();
  };
}

/**
 * Validate phone number field in request body
 * @param {string} fieldName - Name of phone field (default: 'phoneNumber')
 * @returns {Function} Express middleware function
 */
function validatePhone(fieldName = 'phoneNumber') {
  return (req, res, next) => {
    const phone = req.body?.[fieldName];
    
    if (phone !== undefined && phone !== null && phone !== '' && !isValidPhone(phone)) {
      return next(createValidationError(
        `Invalid phone number format for field: ${fieldName}`,
        { [fieldName]: 'Must be 10 digits' }
      ));
    }

    next();
  };
}

/**
 * Validate date field in request body
 * @param {string} fieldName - Name of date field (default: 'date')
 * @returns {Function} Express middleware function
 */
function validateDate(fieldName = 'date') {
  return (req, res, next) => {
    const date = req.body?.[fieldName];
    
    if (date !== undefined && date !== null && date !== '' && !isValidDate(date)) {
      return next(createValidationError(
        `Invalid date format for field: ${fieldName}`,
        { [fieldName]: 'Must be in YYYY-MM-DD format' }
      ));
    }

    next();
  };
}

/**
 * Validate numeric field is within range
 * @param {string} fieldName - Name of numeric field
 * @param {number} min - Minimum value (optional)
 * @param {number} max - Maximum value (optional)
 * @returns {Function} Express middleware function
 */
function validateNumericRange(fieldName, min = null, max = null) {
  return (req, res, next) => {
    const value = req.body?.[fieldName];
    
    if (value === undefined || value === null || value === '') {
      return next();
    }

    const numValue = Number(value);
    if (isNaN(numValue)) {
      return next(createValidationError(
        `Field ${fieldName} must be a number`,
        { [fieldName]: 'Must be a valid number' }
      ));
    }

    if (min !== null && numValue < min) {
      return next(createValidationError(
        `Field ${fieldName} must be at least ${min}`,
        { [fieldName]: `Minimum value is ${min}` }
      ));
    }

    if (max !== null && numValue > max) {
      return next(createValidationError(
        `Field ${fieldName} must be at most ${max}`,
        { [fieldName]: `Maximum value is ${max}` }
      ));
    }

    next();
  };
}

/**
 * Validate string length
 * @param {string} fieldName - Name of string field
 * @param {number} minLength - Minimum length (optional)
 * @param {number} maxLength - Maximum length (optional)
 * @returns {Function} Express middleware function
 */
function validateStringLength(fieldName, minLength = null, maxLength = null) {
  return (req, res, next) => {
    const value = req.body?.[fieldName];
    
    if (value === undefined || value === null || value === '') {
      return next();
    }

    if (typeof value !== 'string') {
      return next(createValidationError(
        `Field ${fieldName} must be a string`,
        { [fieldName]: 'Must be a string' }
      ));
    }

    const length = value.trim().length;

    if (minLength !== null && length < minLength) {
      return next(createValidationError(
        `Field ${fieldName} must be at least ${minLength} characters`,
        { [fieldName]: `Minimum length is ${minLength} characters` }
      ));
    }

    if (maxLength !== null && length > maxLength) {
      return next(createValidationError(
        `Field ${fieldName} must be at most ${maxLength} characters`,
        { [fieldName]: `Maximum length is ${maxLength} characters` }
      ));
    }

    next();
  };
}

/**
 * Validate that at least one of the fields is provided
 * @param {string[]} fields - Array of field names (at least one must be provided)
 * @returns {Function} Express middleware function
 */
function validateAtLeastOne(fields) {
  return (req, res, next) => {
    const hasAtLeastOne = fields.some(field => {
      const value = req.body?.[field];
      return value !== undefined && value !== null && value !== '';
    });

    if (!hasAtLeastOne) {
      return next(createValidationError(
        `At least one of the following fields is required: ${fields.join(', ')}`,
        { _fields: fields }
      ));
    }

    next();
  };
}

module.exports = {
  validateRequired,
  validateEmail,
  validatePhone,
  validateDate,
  validateNumericRange,
  validateStringLength,
  validateAtLeastOne,
  // Export validation functions for direct use
  isValidEmail,
  isValidPhone,
  isValidDate
};

