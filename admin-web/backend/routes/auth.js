/**
 * Authentication Routes
 * Extracted from server.js for better organization
 * Includes: Login, logout, verify, and employee login endpoints
 */

const express = require('express');
const router = express.Router();
const dbService = require('../services/dbService');
const helpers = require('../utils/helpers');
const { debugLog, debugWarn, debugError } = require('../debug');

// ===== AUTHENTICATION ENDPOINTS =====

// Login endpoint
router.post('/api/auth/login', async (req, res) => {
  debugLog('🔐 Login attempt received for:', req.body.email || 'unknown email');
  const db = dbService.getDb();
  const { email, password } = req.body;
  
  if (!email || !password) {
    debugLog('❌ Login failed: Missing email or password');
    return res.status(400).json({ 
      error: 'Email and password are required' 
    });
  }
  
  // Find employee by email
  db.get(
    'SELECT * FROM employees WHERE email = ?',
    [email],
    async (err, employee) => {
      if (err) {
        debugError('Login error:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      
      if (!employee) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      
      // Check password (using bcrypt comparison)
      const passwordMatch = await helpers.comparePassword(password, employee.password);
      if (!passwordMatch) {
        debugLog(`❌ Password mismatch for ${email}`);
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      
      debugLog(`✅ Password match for ${email}, updating lastLoginAt...`);
      
      // Update lastLoginAt timestamp on successful login
      const now = new Date().toISOString();
      let lastLoginUpdated = false;
      await new Promise((resolve) => {
        db.run(
          'UPDATE employees SET lastLoginAt = ? WHERE id = ?',
          [now, employee.id],
          function(updateErr) {
            if (updateErr) {
              debugError('❌ Failed to update lastLoginAt:', updateErr);
              debugError('❌ Update error details:', {
                error: updateErr.message,
                code: updateErr.code,
                employeeId: employee.id,
                email: employee.email
              });
              // Continue with login even if update fails
            } else {
              debugLog(`✅ Updated lastLoginAt for ${employee.email} (employeeId: ${employee.id}, affected rows: ${this.changes})`);
              debugLog(`✅ Timestamp set to: ${now}`);
              lastLoginUpdated = true;
            }
            resolve();
          }
        );
      });
      
      // Always update the employee object with the new lastLoginAt for the response
      // This ensures the response includes the updated timestamp even if the DB update happened
      employee.lastLoginAt = now;
      
      // Parse JSON fields
      let costCenters = [];
      let selectedCostCenters = [];
      
      try {
        if (employee.costCenters) {
          costCenters = JSON.parse(employee.costCenters);
        }
        if (employee.selectedCostCenters) {
          selectedCostCenters = JSON.parse(employee.selectedCostCenters);
        }
      } catch (parseErr) {
        debugError('Error parsing cost centers:', parseErr);
      }
      
      // Don't send password back to client
      const { password: _, ...employeeData } = employee;
      
      // Get role from database (defaults to 'employee' if not set)
      // Role is stored separately from position - it's the login role, not job title
      const userRole = employee.role || 'employee';
      
      // Validate role is one of the allowed values
      const allowedRoles = ['employee', 'supervisor', 'admin', 'finance'];
      const validRole = allowedRoles.includes(userRole) ? userRole : 'employee';
      
      // Create session token (simple for now - use JWT in production)
      const sessionToken = `session_${employee.id}_${Date.now()}`;
      
      res.json({
        success: true,
        message: 'Login successful',
        employee: {
          ...employeeData,
          lastLoginAt: now, // Explicitly include lastLoginAt in response
          role: validRole, // Include role in response
          costCenters,
          selectedCostCenters
        },
        token: sessionToken
      });
    }
  );
});

// Verify session endpoint
router.get('/api/auth/verify', (req, res) => {
  const db = dbService.getDb();
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  debugLog('🔍 Session verification request received');
  
  if (!token) {
    debugLog('❌ No token provided for verification');
    return res.status(401).json({ error: 'No token provided' });
  }
  
  // Extract employee ID from token (simple parsing for now)
  const employeeId = token.split('_')[1];
  
  if (!employeeId) {
    debugLog('❌ Invalid token format for verification');
    return res.status(401).json({ error: 'Invalid token' });
  }
  
  // Verify employee exists
  db.get(
    'SELECT * FROM employees WHERE id = ?',
    [employeeId],
    async (err, employee) => {
      if (err || !employee) {
        debugLog('❌ Employee not found for verification:', employeeId);
        return res.status(401).json({ error: 'Invalid session' });
      }
      
      debugLog(`✅ Session verified for ${employee.email} (employeeId: ${employeeId})`);
      
      // Update lastLoginAt if it's been more than 5 minutes since last update
      // This catches cases where users are already logged in but want their lastLoginAt tracked
      const now = new Date().toISOString();
      let shouldUpdateLastLogin = false;
      
      if (employee.lastLoginAt) {
        const lastLoginTime = new Date(employee.lastLoginAt).getTime();
        const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
        shouldUpdateLastLogin = lastLoginTime < fiveMinutesAgo;
      } else {
        // Never logged in before, update it
        shouldUpdateLastLogin = true;
      }
      
      if (shouldUpdateLastLogin) {
        debugLog(`🔄 Updating lastLoginAt for ${employee.email} (verify endpoint)`);
        await new Promise((resolve) => {
          db.run(
            'UPDATE employees SET lastLoginAt = ? WHERE id = ?',
            [now, employee.id],
            function(updateErr) {
              if (updateErr) {
                debugError('❌ Failed to update lastLoginAt in verify:', updateErr);
              } else {
                debugLog(`✅ Updated lastLoginAt for ${employee.email} via verify (affected rows: ${this.changes})`);
                employee.lastLoginAt = now;
              }
              resolve();
            }
          );
        });
      } else {
        debugLog(`⏭️ Skipping lastLoginAt update for ${employee.email} (updated less than 5 minutes ago)`);
      }
      
      // Parse JSON fields
      let costCenters = [];
      let selectedCostCenters = [];
      
      try {
        if (employee.costCenters) {
          costCenters = JSON.parse(employee.costCenters);
        }
        if (employee.selectedCostCenters) {
          selectedCostCenters = JSON.parse(employee.selectedCostCenters);
        }
      } catch (parseErr) {
        debugError('Error parsing cost centers:', parseErr);
      }
      
      const { password: _, ...employeeData } = employee;
      
      res.json({
        valid: true,
        employee: {
          ...employeeData,
          lastLoginAt: employee.lastLoginAt, // Ensure lastLoginAt is included
          costCenters,
          selectedCostCenters
        }
      });
    }
  );
});

// Logout endpoint
router.post('/api/auth/logout', (req, res) => {
  // For now, just return success (client will clear token)
  // In production, you'd invalidate the token in a blacklist/cache
  res.json({
    success: true,
    message: 'Logged out successfully'
  });
});

// Mobile app login endpoint (same as auth/login but with different response format)
router.post('/api/employee-login', async (req, res) => {
  const db = dbService.getDb();
  const { email, password } = req.body;
  
  if (!email || !password) {
    return res.status(400).json({ 
      error: 'Email and password are required' 
    });
  }
  
  // Find employee by email
  db.get(
    'SELECT * FROM employees WHERE email = ?',
    [email],
    async (err, employee) => {
      if (err) {
        debugError('Employee login error:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      
      if (!employee) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      
      // Check password (using bcrypt comparison)
      const passwordMatch = await helpers.comparePassword(password, employee.password);
      if (!passwordMatch) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      
      // Parse JSON fields
      let costCenters = [];
      let selectedCostCenters = [];
      
      try {
        if (employee.costCenters) {
          costCenters = JSON.parse(employee.costCenters);
        }
        if (employee.selectedCostCenters) {
          selectedCostCenters = JSON.parse(employee.selectedCostCenters);
        }
      } catch (parseErr) {
        debugError('Error parsing cost centers:', parseErr);
      }
      
      // Don't send password back to client
      const { password: _, ...employeeData } = employee;
      
      // Return employee data in format expected by mobile app
      res.json({
        ...employeeData,
        costCenters,
        selectedCostCenters
      });
    }
  );
});

module.exports = router;

