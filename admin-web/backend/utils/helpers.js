/**
 * Utility Helper Functions
 * Extracted from server.js for better organization
 */

const os = require('os');
const bcrypt = require('bcryptjs');
const { debugLog } = require('../debug');

/**
 * Get network IP addresses for mobile device access
 */
function getNetworkIPs() {
  const interfaces = os.networkInterfaces();
  const ips = [];
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      // Skip internal (loopback) and non-IPv4 addresses
      if (iface.family === 'IPv4' && !iface.internal) {
        ips.push(iface.address);
      }
    }
  }
  return ips;
}

/**
 * Generate a unique employee ID
 */
function generateEmployeeId(employeeName) {
  if (!employeeName) {
    return `emp-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }
  
  // Clean the name for ID generation
  const cleanName = employeeName.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
  const nameParts = cleanName.split('-').filter(p => p.length > 0);
  
  // Take first 3 significant parts (or all if less than 3)
  const significantParts = nameParts.slice(0, 3);
  const nameBase = significantParts.join('-').substring(0, 20);
  
  // Add timestamp and random suffix for uniqueness
  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).substring(2, 7);
  
  return `${nameBase}-${timestamp}-${randomSuffix}`;
}

/**
 * Generate a default password based on employee name
 */
function generateDefaultPassword(fullName) {
  if (!fullName) {
    return 'Welcome123!';
  }
  const firstName = fullName.split(' ')[0];
  return `${firstName}welcome1`;
}

/**
 * Hash password using bcrypt
 */
async function hashPassword(password) {
  const saltRounds = 10; // Standard security level
  return await bcrypt.hash(password, saltRounds);
}

/**
 * Compare password with hash
 */
async function comparePassword(password, hash) {
  // Handle legacy plain text passwords (for migration)
  // If hash doesn't look like bcrypt hash (starts with $2a$ or $2b$), compare as plain text
  if (!hash || (!hash.startsWith('$2a$') && !hash.startsWith('$2b$') && !hash.startsWith('$2y$'))) {
    debugLog('⚠️ Legacy plain text password detected, comparing directly');
    return password === hash;
  }
  return await bcrypt.compare(password, hash);
}

/**
 * Parse JSON safely with fallback
 */
function parseJsonSafe(value, fallback) {
  if (!value) return fallback;
  try {
    if (typeof value === 'string') {
      return JSON.parse(value);
    }
    return value;
  } catch (err) {
    return fallback;
  }
}

/**
 * Check if employee has finance role (uses database role field, not position)
 * @param {Object} employee - Employee object with role field
 * @returns {boolean} True if employee has finance role
 */
function isFinanceRole(employee) {
  if (!employee) return false;
  return employee.role === 'finance';
}

/**
 * Check if position is finance-related (legacy function, prefer isFinanceRole)
 * @deprecated Use isFinanceRole with employee object instead
 */
function isFinancePosition(position = '') {
  return typeof position === 'string' && /finance/i.test(position);
}

/**
 * Check if position is supervisor-related
 */
function isSupervisorPosition(position = '') {
  return typeof position === 'string' && /supervisor/i.test(position);
}

/**
 * Add hours to a date
 */
function addHours(date, hours) {
  return new Date(date.getTime() + hours * 3600 * 1000);
}

/**
 * Compute escalation due date
 */
function computeEscalationDueAt(hours) {
  return addHours(new Date(), hours).toISOString();
}

module.exports = {
  getNetworkIPs,
  generateEmployeeId,
  generateDefaultPassword,
  hashPassword,
  comparePassword,
  parseJsonSafe,
  isFinanceRole,
  isFinancePosition, // Keep for backward compatibility
  isSupervisorPosition,
  addHours,
  computeEscalationDueAt,
};

