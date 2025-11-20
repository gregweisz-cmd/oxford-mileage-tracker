/**
 * System Routes
 * Extracted from server.js for better organization
 * Includes: Database initialization, system settings, backups
 */

const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const dbService = require('../services/dbService');
const constants = require('../utils/constants');
const { debugLog, debugWarn, debugError } = require('../debug');

// System settings in-memory storage (in production, use database)
let systemSettings = {
  email: {
    enabled: false,
    smtpHost: '',
    smtpPort: 587,
    smtpUser: '',
    smtpPass: '',
    fromAddress: ''
  },
  reportSchedule: {
    defaultTime: constants.REPORT_SCHEDULE_DEFAULT_TIME || '08:00',
    defaultTimezone: constants.REPORT_SCHEDULE_DEFAULT_TIMEZONE || 'America/New_York',
    defaultRowLimit: constants.REPORT_SCHEDULE_DEFAULT_ROW_LIMIT || 250
  },
  approval: {
    requireSupervisorApproval: true,
    autoApproveExecutives: true
  }
};

// ===== DATABASE INITIALIZATION =====

// Manual database initialization endpoint for debugging
router.post('/api/init-database', (req, res) => {
  try {
    debugLog('🔧 Manual database initialization triggered');
    dbService.initDatabase().then(() => {
      res.json({ 
        success: true, 
        message: 'Database initialized successfully',
        timestamp: new Date().toISOString()
      });
    }).catch((error) => {
      debugError('❌ Error during manual database initialization:', error);
      res.status(500).json({ 
        success: false, 
        error: error.message,
        timestamp: new Date().toISOString()
      });
    });
  } catch (error) {
    debugError('❌ Error during manual database initialization:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// ===== SYSTEM SETTINGS =====

// Get system settings
router.get('/api/admin/system-settings', (req, res) => {
  try {
    const systemInfo = {
      databasePath: dbService.DB_PATH,
      serverVersion: '1.0.0',
      nodeVersion: process.version,
      uptime: process.uptime()
    };

    res.json({
      ...systemSettings,
      systemInfo
    });
  } catch (error) {
    debugError('❌ Error fetching system settings:', error);
    res.status(500).json({ error: 'Failed to fetch system settings' });
  }
});

// Update system settings
router.put('/api/admin/system-settings', (req, res) => {
  try {
    const updates = req.body;
    
    // Update email settings
    if (updates.email) {
      systemSettings.email = { ...systemSettings.email, ...updates.email };
    }
    
    // Update report schedule defaults
    if (updates.reportSchedule) {
      systemSettings.reportSchedule = { ...systemSettings.reportSchedule, ...updates.reportSchedule };
    }
    
    // Update approval settings
    if (updates.approval) {
      systemSettings.approval = { ...systemSettings.approval, ...updates.approval };
    }
    
    debugLog('✅ System settings updated');
    res.json({ message: 'Settings saved successfully', settings: systemSettings });
  } catch (error) {
    debugError('❌ Error updating system settings:', error);
    res.status(500).json({ error: 'Failed to update system settings' });
  }
});

// ===== DATABASE BACKUP =====

// Create database backup
router.post('/api/admin/system/backup', (req, res) => {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const backupFilename = `expense_tracker_backup_${timestamp}.db`;
    const backupPath = path.join(__dirname, '..', backupFilename);
    
    // Copy database file
    fs.copyFileSync(dbService.DB_PATH, backupPath);
    
    debugLog(`✅ Database backup created: ${backupFilename}`);
    res.json({
      message: 'Backup created successfully',
      filename: backupFilename,
      path: backupPath,
      size: fs.statSync(backupPath).size
    });
  } catch (error) {
    debugError('❌ Error creating backup:', error);
    res.status(500).json({ error: 'Failed to create backup' });
  }
});

module.exports = router;

