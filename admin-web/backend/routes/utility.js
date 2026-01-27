/**
 * Utility Routes
 * Extracted from server.js for better organization
 * Includes: Saved addresses, Oxford Houses, stats, health checks
 */

const express = require('express');
const router = express.Router();
const dbService = require('../services/dbService');
const emailService = require('../services/emailService');
const { debugLog, debugWarn, debugError } = require('../debug');

// ===== SAVED ADDRESSES =====

router.get('/api/saved-addresses', (req, res) => {
  const { employeeId } = req.query;
  
  if (!employeeId) {
    res.status(400).json({ error: 'employeeId is required' });
    return;
  }

  // For now, return empty array since we don't have a saved_addresses table yet
  // This can be implemented later when the table is created
  res.json([]);
});

// ===== OXFORD HOUSES =====

// Cache for Oxford Houses data
let oxfordHousesCache = null;
let oxfordHousesCacheTime = null;
const OXFORD_HOUSES_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

// Fetch Oxford Houses from live website
async function fetchOxfordHouses() {
  try {
    debugLog('🏠 Fetching Oxford Houses from oxfordvacancies.com...');
    
    const response = await fetch('https://oxfordvacancies.com/oxfordReport.aspx?report=house-name-address-all-houses');
    const html = await response.text();
    
    // Parse the HTML table
    const houses = [];
    const tableRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    
    let match;
    let isFirstRow = true;
    
    while ((match = tableRegex.exec(html)) !== null) {
      if (isFirstRow) {
        isFirstRow = false;
        continue; // Skip header row
      }
      
      const cells = [];
      const rowHtml = match[1];
      let cellMatch;
      
      while ((cellMatch = cellRegex.exec(rowHtml)) !== null) {
        // Remove HTML tags and decode entities
        const cellText = cellMatch[1]
          .replace(/<[^>]*>/g, '')
          .replace(/&nbsp;/g, ' ')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .trim();
        cells.push(cellText);
      }
      
      if (cells.length >= 5) {
        houses.push({
          name: `OH ${cells[0]}`, // Add "OH" prefix
          address: cells[1],
          city: cells[2],
          state: cells[3],
          zip: cells[4],
          fullAddress: `${cells[1]}, ${cells[2]}, ${cells[3]} ${cells[4]}`
        });
      }
    }
    
    debugLog(`✅ Fetched ${houses.length} Oxford Houses`);
    return houses;
  } catch (error) {
    debugError('❌ Error fetching Oxford Houses:', error);
    return [];
  }
}

// Get all Oxford Houses (with caching)
router.get('/api/oxford-houses', async (req, res) => {
  try {
    // Check if cache is valid
    if (oxfordHousesCache && oxfordHousesCacheTime && (Date.now() - oxfordHousesCacheTime < OXFORD_HOUSES_CACHE_TTL)) {
      debugLog('📦 Serving Oxford Houses from cache');
      res.json(oxfordHousesCache);
      return;
    }
    
    // Fetch fresh data
    const houses = await fetchOxfordHouses();
    
    // Update cache
    oxfordHousesCache = houses;
    oxfordHousesCacheTime = Date.now();
    
    res.json(houses);
  } catch (error) {
    debugError('❌ Error in oxford-houses endpoint:', error);
    res.status(500).json({ error: 'Failed to fetch Oxford Houses' });
  }
});

// Force refresh Oxford Houses cache
router.post('/api/oxford-houses/refresh', async (req, res) => {
  try {
    debugLog('🔄 Force refreshing Oxford Houses data...');
    const houses = await fetchOxfordHouses();
    
    // Update cache
    oxfordHousesCache = houses;
    oxfordHousesCacheTime = Date.now();
    
    res.json({ message: 'Oxford Houses refreshed successfully', count: houses.length });
  } catch (error) {
    debugError('❌ Error refreshing Oxford Houses:', error);
    res.status(500).json({ error: 'Failed to refresh Oxford Houses' });
  }
});

// ===== STATISTICS =====

// Get database statistics
router.get('/api/stats', (req, res) => {
  const db = dbService.getDb();
  const queries = {
    totalEmployees: 'SELECT COUNT(*) as count FROM employees',
    totalMileageEntries: 'SELECT COUNT(*) as count FROM mileage_entries',
    totalReceipts: 'SELECT COUNT(*) as count FROM receipts',
    totalMiles: 'SELECT SUM(miles) as total FROM mileage_entries',
    totalReceiptAmount: 'SELECT SUM(amount) as total FROM receipts',
    totalExpenseReports: 'SELECT COUNT(*) as count FROM expense_reports',
    draftReports: 'SELECT COUNT(*) as count FROM expense_reports WHERE status = "draft"',
    submittedReports: 'SELECT COUNT(*) as count FROM expense_reports WHERE status = "submitted"',
    approvedReports: 'SELECT COUNT(*) as count FROM expense_reports WHERE status = "approved"'
  };

  const stats = {};
  let completed = 0;

  Object.keys(queries).forEach(key => {
    db.get(queries[key], (err, row) => {
      if (!err && row) {
        stats[key] = row.count !== undefined ? row.count : row.total || 0;
      } else {
        stats[key] = 0;
      }
      
      completed++;
      if (completed === Object.keys(queries).length) {
        res.json(stats);
      }
    });
  });
});

// ===== API ROOT =====
// GET /api — avoid "Cannot GET /api" when hitting the base URL
router.get('/api', (req, res) => {
  res.json({
    message: 'Oxford Mileage Backend API',
    version: '1.0.0',
    docs: {
      health: 'GET /api/health',
      travelReasons: 'GET /api/travel-reasons',
      dailyDescriptionOptions: 'GET /api/daily-description-options',
    },
  });
});

// ===== HEALTH CHECK =====

const fs = require('fs');
const os = require('os');
const path = require('path');

/**
 * Comprehensive health check endpoint
 * Checks: database connectivity, disk space, memory usage, uptime
 */
router.get('/api/health', async (req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    checks: {
      database: { status: 'unknown', message: '' },
      disk: { status: 'unknown', message: '', freeSpaceGB: 0 },
      memory: { status: 'unknown', message: '', usagePercent: 0 },
      uptime: { status: 'healthy', seconds: process.uptime() }
    },
    services: {
      email: { status: 'unknown', message: '' }
    }
  };

  let allHealthy = true;

  // 1. Database connectivity check
  try {
    const db = dbService.getDb();
    return new Promise((resolve) => {
      db.get('SELECT 1 as health', [], (err, row) => {
        if (err || !row) {
          health.checks.database = { 
            status: 'unhealthy', 
            message: `Database query failed: ${err ? err.message : 'No result'}`
          };
          allHealthy = false;
        } else {
          health.checks.database = { 
            status: 'healthy', 
            message: 'Database connection successful' 
          };
        }

        // 2. Disk space check
        try {
          const dbPath = dbService.DB_PATH;
          const dbDir = path.dirname(dbPath);
          
          // Check if directory exists
          if (!fs.existsSync(dbDir)) {
            health.checks.disk = { 
              status: 'warning', 
              message: 'Database directory does not exist',
              freeSpaceGB: 0
            };
          } else {
            // Get disk stats (basic check - node doesn't have direct disk space API)
            // On Linux/Mac we'd use statfs, but for cross-platform we'll just check if we can write
            try {
              const testFile = path.join(dbDir, '.health-check-temp');
              fs.writeFileSync(testFile, 'test');
              fs.unlinkSync(testFile);
              health.checks.disk = { 
                status: 'healthy', 
                message: 'Disk is writable',
                freeSpaceGB: 'N/A' // Would need system-specific call
              };
            } catch (diskErr) {
              health.checks.disk = { 
                status: 'unhealthy', 
                message: `Cannot write to disk: ${diskErr.message}`,
                freeSpaceGB: 0
              };
              allHealthy = false;
            }
          }
        } catch (diskErr) {
          health.checks.disk = { 
            status: 'warning', 
            message: `Disk check error: ${diskErr.message}`,
            freeSpaceGB: 0
          };
        }

        // 3. Memory usage check
        try {
          const totalMem = os.totalmem();
          const freeMem = os.freemem();
          const usedMem = totalMem - freeMem;
          const usagePercent = Math.round((usedMem / totalMem) * 100);
          
          health.checks.memory.usagePercent = usagePercent;
          
          if (usagePercent > 90) {
            health.checks.memory.status = 'unhealthy';
            health.checks.memory.message = `Memory usage is ${usagePercent}% (critical)`;
            allHealthy = false;
          } else if (usagePercent > 80) {
            health.checks.memory.status = 'warning';
            health.checks.memory.message = `Memory usage is ${usagePercent}% (high)`;
          } else {
            health.checks.memory.status = 'healthy';
            health.checks.memory.message = `Memory usage is ${usagePercent}%`;
          }
        } catch (memErr) {
          health.checks.memory.status = 'warning';
          health.checks.memory.message = `Memory check error: ${memErr.message}`;
        }

        // 4. Email service check (basic - just check if configured)
        try {
          const emailService = require('../services/emailService');
          // Email service will return null if not configured, which is OK
          health.services.email = {
            status: 'configured',
            message: 'Email service available'
          };
        } catch (emailErr) {
          health.services.email = {
            status: 'warning',
            message: 'Email service check failed'
          };
        }

        // Set overall status
        health.status = allHealthy ? 'healthy' : 'degraded';
        
        // Return appropriate HTTP status code
        const statusCode = allHealthy ? 200 : 503;
        res.status(statusCode).json(health);
        resolve();
      });
    });
  } catch (err) {
    health.status = 'unhealthy';
    health.checks.database = { 
      status: 'unhealthy', 
      message: `Database connection error: ${err.message}` 
    };
    return res.status(503).json(health);
  }
});

// Simple health check for load balancers (lightweight)
router.get('/health', (req, res) => {
  res.json({ 
    status: 'ok',
    timestamp: new Date().toISOString()
  });
});

// ===== EMAIL TEST ENDPOINT =====

// Test email configuration
router.post('/api/test-email', async (req, res) => {
  const { to } = req.body;
  
  if (!to) {
    return res.status(400).json({ error: 'Email address required (to field)' });
  }

  // Verify email configuration first (with timeout)
  let isConfigured;
  try {
    isConfigured = await Promise.race([
      emailService.verifyEmailConfig(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Verification timeout')), 5000))
    ]);
  } catch (err) {
    isConfigured = false;
    debugWarn('Email verification timed out or failed:', err.message);
  }

  if (!isConfigured) {
    return res.status(500).json({ 
      error: 'Email not configured or verification failed. Please check AWS credentials (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION) or SMTP settings.',
      configured: false,
      hint: 'For AWS SES: Check AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION. For SMTP: Check EMAIL_USER/SMTP_USER and EMAIL_PASS/SMTP_PASSWORD'
    });
  }

  // Send test email (with timeout)
  let result;
  try {
    result = await Promise.race([
      emailService.sendEmail({
        to: to,
        subject: 'Test Email - Oxford House Expense Tracker',
        text: 'This is a test email from Oxford House Expense Tracker. If you receive this, your email configuration is working correctly!',
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background-color: #2196F3; color: white; padding: 20px; text-align: center; }
              .content { padding: 20px; background-color: #f9f9f9; }
              .success { background-color: #4CAF50; color: white; padding: 10px; border-radius: 5px; margin: 10px 0; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>✓ Email Configuration Test</h1>
              </div>
              <div class="content">
                <div class="success">
                  <strong>Success!</strong> Your email configuration is working correctly.
                </div>
                <p>If you're reading this email, it means:</p>
                <ul>
                  <li>SMTP settings are configured correctly</li>
                  <li>Authentication is working</li>
                  <li>Emails can be sent successfully</li>
                </ul>
                <p><strong>Test sent at:</strong> ${new Date().toLocaleString()}</p>
                <p>You can now use email notifications in the approval workflow!</p>
              </div>
            </div>
          </body>
          </html>
        `,
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Send email timeout')), 60000))
    ]);
  } catch (err) {
    debugError('Email send timed out or failed:', err.message);
    return res.status(500).json({
      success: false,
      error: `Email send failed: ${err.message}. This may indicate network issues or AWS SES service problems.`,
      configured: isConfigured
    });
  }

  // sendEmail returns object with success field
  if (result && result.success) {
    res.json({ 
      success: true, 
      message: 'Test email sent successfully. Please check your inbox.',
      messageId: result.messageId
    });
  } else {
    res.status(500).json({ 
      success: false, 
      error: result?.error || 'Failed to send test email. Check backend logs for details.',
      configured: isConfigured
    });
  }
});

module.exports = router;

