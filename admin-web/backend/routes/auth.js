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
const { authLimiter } = require('../middleware/rateLimiter');

// Google OAuth support
let OAuth2Client = null;
let googleClient = null;
let ALLOWED_EMAIL_DOMAINS = [];

try {
  const { OAuth2Client: GoogleOAuth2Client } = require('google-auth-library');
  OAuth2Client = GoogleOAuth2Client;
  
  // Initialize Google OAuth client if credentials are available
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || 
      `${process.env.API_BASE_URL || 'http://localhost:3002'}/api/auth/google/callback`;
    
    googleClient = new OAuth2Client(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      redirectUri
    );
    
    // Parse allowed email domains
    if (process.env.ALLOWED_EMAIL_DOMAINS) {
      ALLOWED_EMAIL_DOMAINS = process.env.ALLOWED_EMAIL_DOMAINS.split(',')
        .map(d => d.trim())
        .filter(Boolean);
    }
    
    debugLog('✅ Google OAuth client initialized');
  } else {
    debugWarn('⚠️  Google OAuth not configured - missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET');
  }
} catch (err) {
  debugWarn('⚠️  google-auth-library not available:', err.message);
}

// ===== AUTHENTICATION ENDPOINTS =====

// Login endpoint (protected with strict rate limiting)
router.post('/api/auth/login', authLimiter, async (req, res) => {
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

// ===== GOOGLE OAUTH ENDPOINTS =====

// Google OAuth login - redirects to Google
router.get('/api/auth/google', (req, res) => {
  if (!googleClient) {
    debugError('❌ Google OAuth not configured - missing credentials');
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    return res.redirect(`${frontendUrl}/login?error=${encodeURIComponent('Google login not available')}`);
  }

  try {
    const returnUrl = req.query.returnUrl || '/';
    const authUrl = googleClient.generateAuthUrl({
      access_type: 'offline',
      scope: ['openid', 'profile', 'email'],
      prompt: 'consent',
      state: returnUrl // Store return URL for after callback
    });

    debugLog('🔐 Redirecting to Google OAuth:', authUrl);
    res.redirect(authUrl);
  } catch (error) {
    debugError('❌ Error generating Google OAuth URL:', error);
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    res.redirect(`${frontendUrl}/login?error=${encodeURIComponent('Failed to initiate Google login')}`);
  }
});

// Google OAuth callback - handles response from Google
router.get('/api/auth/google/callback', async (req, res) => {
  const { code, error, state } = req.query;
  const db = dbService.getDb();

  if (error) {
    debugError('❌ Google OAuth error:', error);
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    return res.redirect(`${frontendUrl}/login?error=${encodeURIComponent(error)}`);
  }

  if (!code) {
    debugError('❌ No authorization code received from Google');
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    return res.redirect(`${frontendUrl}/login?error=no_code`);
  }

  if (!googleClient) {
    debugError('❌ Google OAuth client not initialized');
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    return res.redirect(`${frontendUrl}/login?error=${encodeURIComponent('Google login not configured')}`);
  }

  try {
    debugLog('🔐 Exchanging Google authorization code for tokens...');

    // Exchange code for tokens
    const { tokens } = await googleClient.getToken(code);
    googleClient.setCredentials(tokens);

    debugLog('✅ Received tokens from Google, verifying ID token...');

    // Verify and get user info
    const ticket = await googleClient.verifyIdToken({
      idToken: tokens.id_token,
      audience: process.env.GOOGLE_CLIENT_ID
    });
    
    const googleUser = ticket.getPayload();
    const email = googleUser.email;
    const googleId = googleUser.sub;
    const name = googleUser.name || googleUser.given_name || 'User';
    const emailVerified = googleUser.email_verified === true;

    debugLog(`✅ Google user verified: ${email} (${googleId})`);

    // Check email domain restriction
    if (ALLOWED_EMAIL_DOMAINS.length > 0) {
      const emailDomain = email.split('@')[1];
      if (!ALLOWED_EMAIL_DOMAINS.includes(emailDomain)) {
        debugWarn(`⚠️  Access denied for ${email} - not in allowed domains`);
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
        return res.redirect(`${frontendUrl}/login?error=${encodeURIComponent('Access restricted to organization email addresses only')}`);
      }
      debugLog(`✅ Email domain ${emailDomain} is allowed`);
    }

    // Find or create user
    db.get(
      'SELECT * FROM employees WHERE email = ? OR googleId = ?',
      [email, googleId],
      async (err, employee) => {
        if (err) {
          debugError('❌ Database error during Google OAuth:', err);
          const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
          return res.redirect(`${frontendUrl}/login?error=database_error`);
        }

        let userToReturn = null;
        const now = new Date().toISOString();
        const AUTO_CREATE_ACCOUNTS = process.env.AUTO_CREATE_ACCOUNTS === 'true';

        if (employee) {
          // User exists - link Google account or update
          debugLog(`✅ Found existing user: ${employee.email}`);

          const updateFields = [];
          const updateValues = [];
          const updateSet = [];

          // Link Google account if not already linked
          if (!employee.googleId) {
            updateSet.push('googleId = ?');
            updateValues.push(googleId);
          } else if (employee.googleId !== googleId) {
            // Google ID mismatch - update it
            updateSet.push('googleId = ?');
            updateValues.push(googleId);
          }

          // Update auth provider
          const currentAuthProvider = employee.authProvider || 'local';
          if (currentAuthProvider === 'local') {
            updateSet.push('authProvider = ?');
            updateValues.push('both');
          } else if (currentAuthProvider === 'google') {
            // Already using Google, no change needed
          } else if (currentAuthProvider !== 'both') {
            updateSet.push('authProvider = ?');
            updateValues.push('both');
          }

          // Update email verification status
          if (emailVerified) {
            updateSet.push('emailVerified = ?');
            updateValues.push(1);
          }

          // Update last login
          updateSet.push('lastLoginAt = ?');
          updateValues.push(now);

          // Update timestamp
          updateSet.push('updatedAt = ?');
          updateValues.push(now);

          updateValues.push(employee.id);

          if (updateSet.length > 0) {
            const updateQuery = `UPDATE employees SET ${updateSet.join(', ')} WHERE id = ?`;
            
            await new Promise((resolve, reject) => {
              db.run(updateQuery, updateValues, (updateErr) => {
                if (updateErr) {
                  debugError('❌ Error updating user with Google info:', updateErr);
                  reject(updateErr);
                } else {
                  debugLog(`✅ Updated user ${employee.email} with Google OAuth info`);
                  resolve();
                }
              });
            });

            // Fetch updated employee
            db.get(
              'SELECT * FROM employees WHERE id = ?',
              [employee.id],
              (fetchErr, updatedEmployee) => {
                if (!fetchErr && updatedEmployee) {
                  userToReturn = updatedEmployee;
                } else {
                  userToReturn = { ...employee, googleId, emailVerified: emailVerified ? 1 : 0 };
                }
                completeLogin();
              }
            );
          } else {
            userToReturn = employee;
            completeLogin();
          }
        } else if (AUTO_CREATE_ACCOUNTS) {
          // New user - auto-create account
          debugLog(`🆕 Creating new user account for ${email}`);
          
          const newEmployeeId = `emp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
          
          await new Promise((resolve, reject) => {
            db.run(
              `INSERT INTO employees (
                id, name, email, password, googleId, authProvider, emailVerified,
                oxfordHouseId, position, role, baseAddress, createdAt, updatedAt, lastLoginAt
              ) VALUES (?, ?, ?, '', ?, 'google', ?, ?, ?, 'employee', ?, ?, ?, ?)`,
              [
                newEmployeeId,
                name,
                email,
                googleId,
                emailVerified ? 1 : 0,
                '', // oxfordHouseId - will need to be set by admin
                '', // position - will need to be set by admin
                '', // baseAddress - will need to be set by admin
                now,
                now,
                now
              ],
              (insertErr) => {
                if (insertErr) {
                  debugError('❌ Error creating new user:', insertErr);
                  reject(insertErr);
                } else {
                  debugLog(`✅ Created new user account for ${email}`);
                  resolve();
                }
              }
            );
          });

          // Fetch the new user
          db.get(
            'SELECT * FROM employees WHERE id = ?',
            [newEmployeeId],
            (fetchErr, newEmployee) => {
              if (!fetchErr && newEmployee) {
                userToReturn = newEmployee;
              }
              completeLogin();
            }
          );
        } else {
          // Don't auto-create - redirect to error page
          debugWarn(`⚠️  Google login attempted for non-existent user: ${email}`);
          const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
          return res.redirect(`${frontendUrl}/login?error=${encodeURIComponent('Account not found. Please contact your administrator.')}`);
        }

        function completeLogin() {
          if (!userToReturn) {
            debugError('❌ Failed to get user after Google OAuth');
            const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
            return res.redirect(`${frontendUrl}/login?error=user_not_found`);
          }

          // Parse JSON fields
          let costCenters = [];
          let selectedCostCenters = [];

          try {
            if (userToReturn.costCenters) {
              costCenters = JSON.parse(userToReturn.costCenters);
            }
            if (userToReturn.selectedCostCenters) {
              selectedCostCenters = JSON.parse(userToReturn.selectedCostCenters);
            }
          } catch (parseErr) {
            debugError('Error parsing cost centers:', parseErr);
          }

          // Create session token
          const sessionToken = `session_${userToReturn.id}_${Date.now()}`;

          // Don't send password back
          const { password: _, ...employeeData } = userToReturn;

          const userRole = userToReturn.role || 'employee';
          const allowedRoles = ['employee', 'supervisor', 'admin', 'finance'];
          const validRole = allowedRoles.includes(userRole) ? userRole : 'employee';

          debugLog(`✅ Google OAuth login successful for ${email}, redirecting to frontend...`);

          // Redirect to frontend with token in URL
          // Frontend will extract token and complete login
          const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
          const returnUrl = state || '/';
          const redirectUrl = `${frontendUrl}/auth/callback?token=${sessionToken}&email=${encodeURIComponent(email)}&returnUrl=${encodeURIComponent(returnUrl)}`;

          res.redirect(redirectUrl);
        }
      }
    );
  } catch (error) {
    debugError('❌ Google OAuth callback error:', error);
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    res.redirect(`${frontendUrl}/login?error=${encodeURIComponent('Authentication failed. Please try again.')}`);
  }
});

// Mobile Google OAuth callback (receives code, exchanges for tokens)
router.post('/api/auth/google/mobile', async (req, res) => {
  const { code, redirectUri } = req.body;
  const db = dbService.getDb();

  if (!code) {
    return res.status(400).json({ error: 'Authorization code required' });
  }

  if (!OAuth2Client) {
    debugError('❌ Google OAuth client library not available');
    return res.status(500).json({ error: 'Google login not available' });
  }

  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    debugError('❌ Google OAuth credentials not configured');
    return res.status(500).json({ error: 'Google login not configured' });
  }

  try {
    debugLog('🔐 Mobile: Exchanging Google authorization code for tokens...');
    debugLog('🔐 Mobile: Using redirect URI:', redirectUri || 'default');

    // Create a new OAuth client with the mobile redirect URI
    // The redirect URI must match what was used in the authorization request
    // Default to Expo proxy URI (fallback if not provided)
    const mobileRedirectUri = redirectUri || 'https://auth.expo.io/@goosew27/oh-staff-tracker';
    
    debugLog('🔐 Mobile: Creating OAuth2Client with redirect URI:', mobileRedirectUri);
    
    const mobileGoogleClient = new OAuth2Client(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      mobileRedirectUri
    );

    // Exchange code for tokens using the mobile redirect URI
    const { tokens } = await mobileGoogleClient.getToken(code);
    mobileGoogleClient.setCredentials(tokens);

    debugLog('✅ Mobile: Received tokens from Google, verifying ID token...');

    const ticket = await mobileGoogleClient.verifyIdToken({
      idToken: tokens.id_token,
      audience: process.env.GOOGLE_CLIENT_ID
    });
    
    const googleUser = ticket.getPayload();
    const email = googleUser.email;
    const googleId = googleUser.sub;
    const name = googleUser.name || googleUser.given_name || 'User';
    const emailVerified = googleUser.email_verified === true;

    debugLog(`✅ Mobile: Google user verified: ${email} (${googleId})`);

    // Check domain restriction (same as web)
    if (ALLOWED_EMAIL_DOMAINS.length > 0) {
      const emailDomain = email.split('@')[1];
      if (!ALLOWED_EMAIL_DOMAINS.includes(emailDomain)) {
        return res.status(403).json({ 
          error: 'Access restricted to organization email addresses only' 
        });
      }
      debugLog(`✅ Mobile: Email domain ${emailDomain} is allowed`);
    }

    // Find or create user (same logic as web callback)
    db.get(
      'SELECT * FROM employees WHERE email = ? OR googleId = ?',
      [email, googleId],
      async (err, employee) => {
        if (err) {
          debugError('❌ Database error during Mobile Google OAuth:', err);
          return res.status(500).json({ error: 'Database error' });
        }

        let userToReturn = null;
        const now = new Date().toISOString();
        const AUTO_CREATE_ACCOUNTS = process.env.AUTO_CREATE_ACCOUNTS === 'true';

        if (employee) {
          // User exists - link Google account or update
          debugLog(`✅ Mobile: Found existing user: ${employee.email}`);

          const updateFields = [];
          const updateValues = [];
          const updateSet = [];

          if (!employee.googleId) {
            updateSet.push('googleId = ?');
            updateValues.push(googleId);
          } else if (employee.googleId !== googleId) {
            updateSet.push('googleId = ?');
            updateValues.push(googleId);
          }

          const currentAuthProvider = employee.authProvider || 'local';
          if (currentAuthProvider === 'local') {
            updateSet.push('authProvider = ?');
            updateValues.push('both');
          } else if (currentAuthProvider === 'google') {
            // Already using Google, no change needed
          } else if (currentAuthProvider !== 'both') {
            updateSet.push('authProvider = ?');
            updateValues.push('both');
          }

          if (emailVerified) {
            updateSet.push('emailVerified = ?');
            updateValues.push(1);
          }

          updateSet.push('lastLoginAt = ?');
          updateValues.push(now);

          updateSet.push('updatedAt = ?');
          updateValues.push(now);

          updateValues.push(employee.id);

          if (updateSet.length > 0) {
            const updateQuery = `UPDATE employees SET ${updateSet.join(', ')} WHERE id = ?`;
            
            await new Promise((resolve, reject) => {
              db.run(updateQuery, updateValues, (updateErr) => {
                if (updateErr) {
                  debugError('❌ Error updating user with Mobile Google info:', updateErr);
                  reject(updateErr);
                } else {
                  debugLog(`✅ Mobile: Updated user ${employee.email} with Google OAuth info`);
                  resolve();
                }
              });
            });

            db.get(
              'SELECT * FROM employees WHERE id = ?',
              [employee.id],
              (fetchErr, updatedEmployee) => {
                if (!fetchErr && updatedEmployee) {
                  userToReturn = updatedEmployee;
                } else {
                  userToReturn = { ...employee, googleId, emailVerified: emailVerified ? 1 : 0 };
                }
                completeMobileLogin();
              }
            );
          } else {
            userToReturn = employee;
            completeMobileLogin();
          }
        } else if (AUTO_CREATE_ACCOUNTS) {
          // New user - auto-create account
          debugLog(`🆕 Mobile: Creating new user account for ${email}`);
          
          const newEmployeeId = `emp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
          
          await new Promise((resolve, reject) => {
            db.run(
              `INSERT INTO employees (
                id, name, email, password, googleId, authProvider, emailVerified,
                oxfordHouseId, position, role, baseAddress, createdAt, updatedAt, lastLoginAt
              ) VALUES (?, ?, ?, '', ?, 'google', ?, ?, ?, 'employee', ?, ?, ?, ?)`,
              [
                newEmployeeId,
                name,
                email,
                googleId,
                emailVerified ? 1 : 0,
                '', // oxfordHouseId - will need to be set by admin
                '', // position - will need to be set by admin
                '', // baseAddress - will need to be set by admin
                now,
                now,
                now
              ],
              (insertErr) => {
                if (insertErr) {
                  debugError('❌ Error creating new mobile user:', insertErr);
                  reject(insertErr);
                } else {
                  debugLog(`✅ Mobile: Created new user account for ${email}`);
                  resolve();
                }
              }
            );
          });

          db.get(
            'SELECT * FROM employees WHERE id = ?',
            [newEmployeeId],
            (fetchErr, newEmployee) => {
              if (!fetchErr && newEmployee) {
                userToReturn = newEmployee;
              }
              completeMobileLogin();
            }
          );
        } else {
          debugWarn(`⚠️  Mobile: Google login attempted for non-existent user: ${email}`);
          return res.status(404).json({ error: 'Account not found. Please contact your administrator.' });
        }

        function completeMobileLogin() {
          if (!userToReturn) {
            debugError('❌ Mobile: Failed to get user after Google OAuth');
            return res.status(500).json({ error: 'User not found after authentication' });
          }

          // Parse JSON fields
          let costCenters = [];
          let selectedCostCenters = [];

          try {
            if (userToReturn.costCenters) {
              costCenters = JSON.parse(userToReturn.costCenters);
            }
            if (userToReturn.selectedCostCenters) {
              selectedCostCenters = JSON.parse(userToReturn.selectedCostCenters);
            }
          } catch (parseErr) {
            debugError('Error parsing cost centers for mobile:', parseErr);
          }

          const sessionToken = `session_${userToReturn.id}_${Date.now()}`;
          const { password: _, ...employeeData } = userToReturn;
          const userRole = userToReturn.role || 'employee';
          const allowedRoles = ['employee', 'supervisor', 'admin', 'finance'];
          const validRole = allowedRoles.includes(userRole) ? userRole : 'employee';

          debugLog(`✅ Mobile: Google OAuth login successful for ${email}`);

          res.json({
            success: true,
            token: sessionToken,
            email: email,
            employee: {
              ...employeeData,
              lastLoginAt: now,
              role: validRole,
              costCenters,
              selectedCostCenters
            }
          });
        }
      }
    );
  } catch (error) {
    debugError('❌ Mobile: Google OAuth callback error:', error);
    debugError('❌ Mobile: Error details:', {
      message: error?.message,
      code: error?.code,
      stack: error?.stack
    });
    
    // Provide more specific error messages
    let errorMessage = 'Authentication failed';
    if (error?.message) {
      if (error.message.includes('redirect_uri_mismatch')) {
        errorMessage = 'Redirect URI mismatch. Please check Google Cloud Console configuration.';
      } else if (error.message.includes('invalid_grant')) {
        errorMessage = 'Invalid authorization code. Please try signing in again.';
      } else {
        errorMessage = error.message;
      }
    }
    
    res.status(500).json({ error: errorMessage });
  }
});

module.exports = router;

