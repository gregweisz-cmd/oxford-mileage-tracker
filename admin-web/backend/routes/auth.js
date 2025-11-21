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
        debugError('Login error:', err);
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
      
      // Update lastLoginAt timestamp on successful login
      const now = new Date().toISOString();
      await new Promise((resolve) => {
        db.run(
          'UPDATE employees SET lastLoginAt = ? WHERE id = ?',
          [now, employee.id],
          (updateErr) => {
            if (updateErr) {
              debugWarn('Warning: Failed to update lastLoginAt:', updateErr);
              // Continue with login even if update fails
            } else {
              debugLog(`✅ Updated lastLoginAt for ${employee.email}`);
              // Update the employee object to include new lastLoginAt in response
              employee.lastLoginAt = now;
            }
            resolve();
          }
        );
      });
      
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
      
      // Create session token (simple for now - use JWT in production)
      const sessionToken = `session_${employee.id}_${Date.now()}`;
      
      res.json({
        success: true,
        message: 'Login successful',
        employee: {
          ...employeeData,
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
  
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }
  
  // Extract employee ID from token (simple parsing for now)
  const employeeId = token.split('_')[1];
  
  if (!employeeId) {
    return res.status(401).json({ error: 'Invalid token' });
  }
  
  // Verify employee exists
  db.get(
    'SELECT * FROM employees WHERE id = ?',
    [employeeId],
    (err, employee) => {
      if (err || !employee) {
        return res.status(401).json({ error: 'Invalid session' });
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

