/**
 * Admin Routes
 * Secure admin-only endpoints for maintenance tasks
 */

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const dbService = require('../services/dbService');
const { debugLog, debugError, debugWarn } = require('../debug');
const { asyncHandler, createError } = require('../middleware/errorHandler');
const { adminLimiter } = require('../middleware/rateLimiter');

/**
 * Middleware to verify admin token
 * This ensures only authorized requests can execute admin functions
 */
function verifyAdminToken(req, res, next) {
  // Get token from header or query parameter
  const token = req.headers['x-admin-token'] || req.query.token || req.body.token;
  
  // Check against environment variable or default (for local dev)
  const adminToken = process.env.ADMIN_TOKEN || 'CHANGE_THIS_IN_PRODUCTION';
  
  if (!token || token !== adminToken) {
    debugWarn('⚠️ Unauthorized admin access attempt');
    return res.status(401).json({ 
      error: 'Unauthorized. Admin token required.',
      message: 'This endpoint requires a valid admin token in the X-Admin-Token header.'
    });
  }
  
  next();
}

/**
 * Extract first name from full name
 * @param {string} fullName - Full name (e.g., "Jackson Longan" or "Greg Weisz")
 * @returns {string} - First name (e.g., "Jackson" or "Greg")
 */
function getFirstName(fullName) {
  if (!fullName || typeof fullName !== 'string') {
    return '';
  }
  return fullName.trim().split(' ')[0];
}

/**
 * Generate password from first name
 * @param {string} firstName - First name
 * @returns {string} - Password in format: (Firstname)welcome1
 */
function generatePassword(firstName) {
  if (!firstName) {
    return 'welcome1'; // Fallback
  }
  return `${firstName}welcome1`;
}

/**
 * POST /api/admin/update-passwords
 * Updates all employee passwords to (Firstname)welcome1 format
 * Excludes Greg Weisz from the update
 * 
 * Requires: X-Admin-Token header with valid admin token
 * 
 * @example
 * curl -X POST https://oxford-mileage-backend.onrender.com/api/admin/update-passwords \
 *   -H "X-Admin-Token: YOUR_ADMIN_TOKEN" \
 *   -H "Content-Type: application/json"
 */
router.post('/api/admin/update-passwords', adminLimiter, verifyAdminToken, asyncHandler(async (req, res) => {
  debugLog('🚀 Starting password update for all employees...');
  
  const db = dbService.getDb();
  
  // Get all employees except Greg Weisz
  const employees = await new Promise((resolve, reject) => {
    db.all(
      "SELECT id, name, email FROM employees WHERE id != 'greg-weisz-001' AND email != 'greg.weisz@oxfordhouse.org'",
      [],
      (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows || []);
        }
      }
    );
  });

  if (employees.length === 0) {
    debugWarn('⚠️ No employees found (excluding Greg Weisz)');
    return res.json({
      success: true,
      message: 'No employees found to update',
      updated: 0,
      skipped: 0
    });
  }

  debugLog(`📝 Found ${employees.length} employees to update`);

  let updatedCount = 0;
  let skippedCount = 0;
  const errors = [];
  const updated = [];

  // Update passwords for each employee
  for (const employee of employees) {
    try {
      const firstName = getFirstName(employee.name);
      const newPassword = generatePassword(firstName);
      
      // Hash the password
      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

      // Update password in database
      await new Promise((resolve, reject) => {
        db.run(
          'UPDATE employees SET password = ?, updatedAt = ? WHERE id = ?',
          [hashedPassword, new Date().toISOString(), employee.id],
          function(updateErr) {
            if (updateErr) {
              reject(updateErr);
            } else {
              resolve();
            }
          }
        );
      });

      updated.push({
        name: employee.name,
        email: employee.email,
        password: newPassword // Return plaintext for reference (already hashed in DB)
      });
      
      updatedCount++;
      debugLog(`✅ Updated: ${employee.name} (${employee.email}) -> Password: ${newPassword}`);
    } catch (error) {
      errors.push({
        employee: employee.name,
        email: employee.email,
        error: error.message
      });
      skippedCount++;
      debugError(`❌ Error updating ${employee.name}: ${error.message}`);
    }
  }

  debugLog(`✅ Password update complete! Updated: ${updatedCount}, Skipped: ${skippedCount}`);

  res.json({
    success: true,
    message: `Password update complete. Updated ${updatedCount} employees.`,
    updated: updatedCount,
    skipped: skippedCount,
    employees: updated, // List of updated employees with their new passwords
    errors: errors.length > 0 ? errors : undefined
  });
}));

/**
 * GET /api/admin/verify-passwords
 * Verifies password format for employees (does not change passwords)
 * Useful for checking current password format before updating
 * 
 * Requires: X-Admin-Token header with valid admin token
 */
router.get('/api/admin/verify-passwords', adminLimiter, verifyAdminToken, asyncHandler(async (req, res) => {
  const db = dbService.getDb();
  
  // Get all employees except Greg Weisz
  const employees = await new Promise((resolve, reject) => {
    db.all(
      "SELECT id, name, email, password FROM employees WHERE id != 'greg-weisz-001' AND email != 'greg.weisz@oxfordhouse.org'",
      [],
      (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows || []);
        }
      }
    );
  });

  const expectedPasswords = employees.map(emp => {
    const firstName = getFirstName(emp.name);
    return {
      name: emp.name,
      email: emp.email,
      expectedPassword: generatePassword(firstName),
      hasPassword: !!emp.password && emp.password.length > 0
    };
  });

  res.json({
    success: true,
    message: `Found ${employees.length} employees (excluding Greg Weisz)`,
    count: employees.length,
    expectedPasswords
  });
}));

module.exports = router;
