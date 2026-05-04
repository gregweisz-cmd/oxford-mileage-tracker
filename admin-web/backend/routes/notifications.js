/**
 * Notification Routes
 * Handles unified notification system for all roles
 */

const express = require('express');
const router = express.Router();
const dbService = require('../services/dbService');
const notificationService = require('../services/notificationService');
const notificationEventSettings = require('../services/notificationEventSettings');
const emailService = require('../services/emailService');
const { debugLog, debugWarn, debugError } = require('../debug');
const { notificationPollingLimiter } = require('../middleware/rateLimiter');

function parsePreferences(preferences) {
  if (!preferences) return {};
  if (typeof preferences === 'object') return preferences;
  if (typeof preferences === 'string') {
    try {
      return JSON.parse(preferences);
    } catch (error) {
      return {};
    }
  }
  return {};
}

async function ensureAdminAccess(req, res) {
  const requesterId =
    String(req.headers['x-employee-id'] || req.body?.employeeId || req.query?.employeeId || '').trim();
  if (!requesterId) {
    res.status(400).json({ error: 'employeeId is required for admin actions' });
    return null;
  }
  const requester = await dbService.getEmployeeById(requesterId);
  if (!requester || String(requester.role || '').toLowerCase() !== 'admin') {
    res.status(403).json({ error: 'Admin access required' });
    return null;
  }
  return requester;
}

/**
 * Get all notifications for a user (unified endpoint)
 * GET /api/notifications/:recipientId
 */
router.get('/api/notifications/:recipientId', (req, res) => {
  const db = dbService.getDb();
  const { recipientId } = req.params;
  const { unreadOnly, limit } = req.query;
  
  let query = 'SELECT * FROM notifications WHERE recipientId = ?';
  const params = [recipientId];
  
  if (unreadOnly === 'true') {
    query += ' AND isRead = 0';
  }
  
  query += ' ORDER BY createdAt DESC';
  
  if (limit) {
    const limitNum = parseInt(limit, 10);
    if (!isNaN(limitNum) && limitNum > 0) {
      query += ` LIMIT ${limitNum}`;
    }
  }
  
  db.all(query, params, (err, rows) => {
    if (err) {
      debugError('❌ Error fetching notifications:', err);
      res.status(500).json({ error: err.message });
      return;
    }
    
    // Parse metadata JSON if present
    const notifications = rows.map(row => ({
      ...row,
      metadata: row.metadata ? JSON.parse(row.metadata) : null,
      isRead: row.isRead === 1,
      isDismissible: row.isDismissible === 1,
    }));
    
    res.json(notifications);
  });
});

/**
 * Get unread notification count for a user
 * GET /api/notifications/:recipientId/count
 * Uses lenient rate limiter for frequent polling
 */
router.get('/api/notifications/:recipientId/count', notificationPollingLimiter, (req, res) => {
  const db = dbService.getDb();
  const { recipientId } = req.params;
  
  db.get(
    'SELECT COUNT(*) as count FROM notifications WHERE recipientId = ? AND isRead = 0',
    [recipientId],
    (err, row) => {
      if (err) {
        debugError('❌ Error counting unread notifications:', err);
        res.status(500).json({ error: err.message });
        return;
      }
      
      res.json({ count: row?.count || 0 });
    }
  );
});

/**
 * Mark notification as read
 * PUT /api/notifications/:id/read
 */
router.put('/api/notifications/:id/read', (req, res) => {
  const db = dbService.getDb();
  const { id } = req.params;
  const now = new Date().toISOString();
  
  db.run(
    'UPDATE notifications SET isRead = 1, readAt = ? WHERE id = ?',
    [now, id],
    function(err) {
      if (err) {
        debugError('❌ Error marking notification as read:', err);
        res.status(500).json({ error: err.message });
        return;
      }
      
      if (this.changes === 0) {
        res.status(404).json({ error: 'Notification not found' });
        return;
      }
      
      res.json({ message: 'Notification marked as read', id });
    }
  );
});

/**
 * Mark all notifications as read for a user
 * PUT /api/notifications/:recipientId/read-all
 */
router.put('/api/notifications/:recipientId/read-all', (req, res) => {
  const db = dbService.getDb();
  const { recipientId } = req.params;
  const now = new Date().toISOString();
  
  db.run(
    'UPDATE notifications SET isRead = 1, readAt = ? WHERE recipientId = ? AND isRead = 0',
    [now, recipientId],
    function(err) {
      if (err) {
        debugError('❌ Error marking all notifications as read:', err);
        res.status(500).json({ error: err.message });
        return;
      }
      
      res.json({ 
        message: 'All notifications marked as read',
        count: this.changes || 0 
      });
    }
  );
});

/**
 * Clear all read dismissible notifications for a user
 * DELETE /api/notifications/:recipientId/clear-all
 */
router.delete('/api/notifications/:recipientId/clear-all', (req, res) => {
  const db = dbService.getDb();
  const { recipientId } = req.params;

  db.run(
    'DELETE FROM notifications WHERE recipientId = ? AND isDismissible = 1 AND isRead = 1',
    [recipientId],
    function(err) {
      if (err) {
        debugError('❌ Error clearing notifications:', err);
        res.status(500).json({ error: err.message });
        return;
      }

      res.json({
        message: 'Notifications cleared',
        count: this.changes || 0
      });
    }
  );
});

/**
 * Delete/dismiss a notification
 * DELETE /api/notifications/:id
 */
router.delete('/api/notifications/:id', (req, res) => {
  const db = dbService.getDb();
  const { id } = req.params;
  
  db.run('DELETE FROM notifications WHERE id = ?', [id], function(err) {
    if (err) {
      debugError('❌ Error deleting notification:', err);
      res.status(500).json({ error: err.message });
      return;
    }
    
    if (this.changes === 0) {
      res.status(404).json({ error: 'Notification not found' });
      return;
    }
    
    res.json({ message: 'Notification deleted', id });
  });
});

/**
 * Update user's Sunday reminder preference
 * PUT /api/notifications/preferences/sunday-reminder
 */
router.put('/api/notifications/preferences/sunday-reminder', (req, res) => {
  const db = dbService.getDb();
  const { employeeId, enabled } = req.body;
  
  if (!employeeId || typeof enabled !== 'boolean') {
    res.status(400).json({ error: 'employeeId and enabled (boolean) are required' });
    return;
  }
  
  db.run(
    'UPDATE employees SET sundayReminderEnabled = ? WHERE id = ?',
    [enabled ? 1 : 0, employeeId],
    function(err) {
      if (err) {
        debugError('❌ Error updating Sunday reminder preference:', err);
        res.status(500).json({ error: err.message });
        return;
      }
      
      if (this.changes === 0) {
        res.status(404).json({ error: 'Employee not found' });
        return;
      }
      
      res.json({ message: 'Sunday reminder preference updated', enabled });
    }
  );
});

/**
 * Create a test notification (for testing purposes)
 * POST /api/notifications/test
 */
router.post('/api/notifications/test', async (req, res) => {
  const { recipientId, recipientRole, type, title, message } = req.body;
  
  if (!recipientId || !recipientRole || !type || !title || !message) {
    res.status(400).json({ error: 'recipientId, recipientRole, type, title, and message are required' });
    return;
  }
  
  try {
    const notificationId = await notificationService.createNotification({
      recipientId,
      recipientRole,
      type,
      title,
      message,
      sendEmail: true,
    });
    
    if (notificationId) {
      res.json({ message: 'Test notification created', id: notificationId });
    } else {
      res.status(500).json({ error: 'Failed to create notification' });
    }
  } catch (error) {
    debugError('❌ Error creating test notification:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Send a test email to the current user.
 * POST /api/notifications/test-email
 */
router.post('/api/notifications/test-email', async (req, res) => {
  const { employeeId } = req.body;
  if (!employeeId) {
    return res.status(400).json({ error: 'employeeId is required' });
  }

  try {
    const employee = await dbService.getEmployeeById(employeeId);
    if (!employee) {
      return res.status(404).json({ error: 'Employee not found' });
    }
    if (!employee.email) {
      return res.status(400).json({ error: 'No email address is set for this user' });
    }

    const prefs = parsePreferences(employee.preferences);
    const notificationsDisabled = prefs.notificationsEnabled === false || prefs.emailNotifications === false;

    const isEmailConfigured = await emailService.verifyEmailConfig();
    const emailConfigStatus = emailService.getEmailConfigStatus();
    if (!isEmailConfigured) {
      debugWarn('⚠️ Test email requested while email config check failed; attempting send anyway.', emailConfigStatus);
    }

    const result = await emailService.sendEmail({
      to: employee.email,
      subject: 'Oxford House Expense Tracker - Test Email',
      text: `Hello ${employee.preferredName || employee.name || 'there'},\n\nThis is a test email from Oxford House Expense Tracker.\n\nIf you received this, your email notification setup is working.`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 620px; margin: 0 auto;">
          <h2 style="color: #1976d2;">Test Email</h2>
          <p>Hello ${employee.preferredName || employee.name || 'there'},</p>
          <p>This is a test email from <strong>Oxford House Expense Tracker</strong>.</p>
          <p>If you received this, your email notification setup is working.</p>
        </div>
      `,
    });

    const deliveryHints = [];
    if (result.provider === 'ses') {
      deliveryHints.push('SES accepted does not guarantee inbox delivery. Check spam/quarantine and recipient filtering.');
      deliveryHints.push('If your SES account is in sandbox, recipient addresses must be verified in SES.');
      deliveryHints.push('Ensure EMAIL_FROM is a verified identity in AWS SES for this region.');
    }

    if (!result.success) {
      const message = String(result.error || '');
      if (message.includes('MessageRejected')) {
        deliveryHints.push('AWS SES rejected the message. Verify sender/recipient identities and sandbox/production status.');
      }
      if (message.includes('InvalidClientTokenId') || message.includes('SignatureDoesNotMatch')) {
        deliveryHints.push('AWS credentials are invalid for SES. Re-check AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY.');
      }
      return res.status(500).json({
        error: result.error || 'Failed to send test email',
        hint: 'Check Render logs for AWS SES/SMTP provider rejection details.',
        emailConfigStatus,
        deliveryHints,
      });
    }

    return res.json({
      success: true,
      to: employee.email,
      provider: result.provider || 'unknown',
      messageId: result.messageId || null,
      accepted: Array.isArray(result.accepted) ? result.accepted : undefined,
      rejected: Array.isArray(result.rejected) ? result.rejected : undefined,
      emailConfigStatus,
      deliveryHints,
      message: notificationsDisabled
        ? `Test email sent to ${employee.email}. Note: regular email notifications are currently disabled for this user.`
        : `Test email sent to ${employee.email}`,
    });
  } catch (error) {
    debugError('❌ Error sending test email:', error);
    return res.status(500).json({ error: 'Failed to send test email' });
  }
});

/**
 * Admin: list global notification email recipients
 * GET /api/notifications/email-recipients
 */
router.get('/api/notifications/email-recipients', async (req, res) => {
  const admin = await ensureAdminAccess(req, res);
  if (!admin) return;
  const db = dbService.getDb();
  db.all(
    'SELECT id, email, label, isActive, createdBy, createdAt, updatedAt FROM notification_email_recipients ORDER BY email COLLATE NOCASE',
    [],
    (err, rows) => {
      if (err) {
        debugError('❌ Error listing notification email recipients:', err);
        return res.status(500).json({ error: 'Failed to load notification email recipients' });
      }
      return res.json((rows || []).map((row) => ({ ...row, isActive: row.isActive === 1 })));
    }
  );
});

/**
 * Admin: create global notification email recipient
 * POST /api/notifications/email-recipients
 */
router.post('/api/notifications/email-recipients', async (req, res) => {
  const admin = await ensureAdminAccess(req, res);
  if (!admin) return;
  const email = String(req.body?.email || '').trim().toLowerCase();
  const label = String(req.body?.label || '').trim();
  const isActive = req.body?.isActive === false ? 0 : 1;
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Valid email is required' });
  }
  const db = dbService.getDb();
  const now = new Date().toISOString();
  db.run(
    `INSERT INTO notification_email_recipients (email, label, isActive, createdBy, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [email, label, isActive, admin.id, now, now],
    function(err) {
      if (err) {
        if (String(err.message || '').toLowerCase().includes('unique')) {
          return res.status(409).json({ error: 'Email is already in notification recipients' });
        }
        debugError('❌ Error creating notification email recipient:', err);
        return res.status(500).json({ error: 'Failed to add notification email recipient' });
      }
      return res.json({ id: this.lastID, email, label, isActive: isActive === 1, createdBy: admin.id, createdAt: now, updatedAt: now });
    }
  );
});

/**
 * Admin: update global notification email recipient
 * PUT /api/notifications/email-recipients/:id
 */
router.put('/api/notifications/email-recipients/:id', async (req, res) => {
  const admin = await ensureAdminAccess(req, res);
  if (!admin) return;
  const { id } = req.params;
  const email = String(req.body?.email || '').trim().toLowerCase();
  const label = String(req.body?.label || '').trim();
  const isActive = req.body?.isActive === false ? 0 : 1;
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Valid email is required' });
  }
  const db = dbService.getDb();
  const now = new Date().toISOString();
  db.run(
    `UPDATE notification_email_recipients
     SET email = ?, label = ?, isActive = ?, updatedAt = ?
     WHERE id = ?`,
    [email, label, isActive, now, id],
    function(err) {
      if (err) {
        if (String(err.message || '').toLowerCase().includes('unique')) {
          return res.status(409).json({ error: 'Email is already in notification recipients' });
        }
        debugError('❌ Error updating notification email recipient:', err);
        return res.status(500).json({ error: 'Failed to update notification email recipient' });
      }
      if (this.changes === 0) return res.status(404).json({ error: 'Notification email recipient not found' });
      return res.json({ id: Number(id), email, label, isActive: isActive === 1, updatedAt: now });
    }
  );
});

/**
 * Admin: delete global notification email recipient
 * DELETE /api/notifications/email-recipients/:id
 */
router.delete('/api/notifications/email-recipients/:id', async (req, res) => {
  const admin = await ensureAdminAccess(req, res);
  if (!admin) return;
  const { id } = req.params;
  const db = dbService.getDb();
  db.run('DELETE FROM notification_email_recipients WHERE id = ?', [id], function(err) {
    if (err) {
      debugError('❌ Error deleting notification email recipient:', err);
      return res.status(500).json({ error: 'Failed to delete notification email recipient' });
    }
    if (this.changes === 0) return res.status(404).json({ error: 'Notification email recipient not found' });
    return res.json({ message: 'Notification email recipient deleted', id: Number(id) });
  });
});

/**
 * Admin: list workflow notification events (toggles + templates)
 * GET /api/admin/notification-events
 */
router.get('/api/admin/notification-events', async (req, res) => {
  const admin = await ensureAdminAccess(req, res);
  if (!admin) return;
  try {
    const events = await notificationEventSettings.listAllForAdmin();
    return res.json(events);
  } catch (error) {
    debugError('❌ Error listing notification events:', error);
    return res.status(500).json({ error: 'Failed to load notification events' });
  }
});

/**
 * Admin: update one workflow notification event
 * PUT /api/admin/notification-events/:eventKey
 */
router.put('/api/admin/notification-events/:eventKey', async (req, res) => {
  const admin = await ensureAdminAccess(req, res);
  if (!admin) return;
  const { eventKey } = req.params;
  try {
    await notificationEventSettings.updateEventSetting(eventKey, req.body || {});
    const events = await notificationEventSettings.listAllForAdmin();
    const row = events.find((e) => e.eventKey === eventKey);
    return res.json(row || { eventKey });
  } catch (error) {
    const status = error.statusCode || 500;
    debugError('❌ Error updating notification event:', error);
    return res.status(status).json({ error: error.message || 'Failed to update notification event' });
  }
});

// ===== LEGACY ENDPOINTS (for backward compatibility) =====

/**
 * Get supervisor notifications (legacy endpoint)
 * GET /api/notifications/supervisor/:supervisorId
 */
router.get('/api/notifications/supervisor/:supervisorId', (req, res) => {
  const db = dbService.getDb();
  const { supervisorId } = req.params;
  
  // Fetch from unified notifications table
  db.all(
    'SELECT * FROM notifications WHERE recipientId = ? AND recipientRole IN (?, ?) ORDER BY createdAt DESC',
    [supervisorId, 'supervisor', 'admin'],
    (err, rows) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      
      // Also check legacy table for backward compatibility
      db.all(
        'SELECT * FROM supervisor_notifications WHERE supervisorId = ? ORDER BY createdAt DESC',
        [supervisorId],
        (legacyErr, legacyRows) => {
          if (!legacyErr && legacyRows && legacyRows.length > 0) {
            // Merge legacy notifications (convert to new format)
            const legacyNotifications = legacyRows.map(row => ({
              id: row.id,
              recipientId: row.supervisorId,
              recipientRole: 'supervisor',
              type: row.type || 'legacy',
              title: row.message || 'Notification',
              message: row.message || '',
              reportId: row.reportId || null,
              employeeId: row.employeeId || null,
              employeeName: row.employeeName || null,
              isRead: row.isRead === 1,
              isDismissible: true,
              createdAt: row.createdAt,
            }));
            
            const allNotifications = [...legacyNotifications, ...rows.map(row => ({
              ...row,
              metadata: row.metadata ? JSON.parse(row.metadata) : null,
              isRead: row.isRead === 1,
              isDismissible: row.isDismissible === 1,
            }))];
            
            // Sort by createdAt descending
            allNotifications.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            
            res.json(allNotifications);
          } else {
            // Parse metadata JSON if present
            const notifications = rows.map(row => ({
              ...row,
              metadata: row.metadata ? JSON.parse(row.metadata) : null,
              isRead: row.isRead === 1,
              isDismissible: row.isDismissible === 1,
            }));
            
            res.json(notifications);
          }
        }
      );
    }
  );
});

/**
 * Get staff notifications (legacy endpoint)
 * GET /api/notifications/staff/:employeeId
 */
router.get('/api/notifications/staff/:employeeId', (req, res) => {
  const db = dbService.getDb();
  const { employeeId } = req.params;
  
  // Fetch from unified notifications table
  db.all(
    'SELECT * FROM notifications WHERE recipientId = ? AND recipientRole = ? ORDER BY createdAt DESC',
    [employeeId, 'employee'],
    (err, rows) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      
      // Also check legacy table for backward compatibility
      db.all(
        'SELECT * FROM staff_notifications WHERE employeeId = ? ORDER BY createdAt DESC',
        [employeeId],
        (legacyErr, legacyRows) => {
          if (!legacyErr && legacyRows && legacyRows.length > 0) {
            // Merge legacy notifications (convert to new format)
            const legacyNotifications = legacyRows.map(row => ({
              id: row.id,
              recipientId: row.employeeId,
              recipientRole: 'employee',
              type: row.type || 'legacy',
              title: row.message || 'Notification',
              message: row.message || '',
              reportId: row.reportId || null,
              actorId: row.supervisorId || null,
              actorName: row.supervisorName || null,
              actorRole: 'supervisor',
              isRead: row.isRead === 1,
              isDismissible: true,
              createdAt: row.createdAt,
            }));
            
            const allNotifications = [...legacyNotifications, ...rows.map(row => ({
              ...row,
              metadata: row.metadata ? JSON.parse(row.metadata) : null,
              isRead: row.isRead === 1,
              isDismissible: row.isDismissible === 1,
            }))];
            
            // Sort by createdAt descending
            allNotifications.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            
            res.json(allNotifications);
          } else {
            // Parse metadata JSON if present
            const notifications = rows.map(row => ({
              ...row,
              metadata: row.metadata ? JSON.parse(row.metadata) : null,
              isRead: row.isRead === 1,
              isDismissible: row.isDismissible === 1,
            }));
            
            res.json(notifications);
          }
        }
      );
    }
  );
});

/**
 * Mark legacy notification as read
 * PUT /api/notifications/:id/read (legacy support)
 */
router.put('/api/notifications/:id/read', (req, res) => {
  const db = dbService.getDb();
  const { id } = req.params;
  const { type } = req.body; // 'supervisor' or 'staff' (legacy)
  const now = new Date().toISOString();
  
  // Try unified table first
  db.run(
    'UPDATE notifications SET isRead = 1, readAt = ? WHERE id = ?',
    [now, id],
    function(err) {
      if (err) {
        debugError('❌ Error marking notification as read:', err);
        res.status(500).json({ error: err.message });
        return;
      }
      
      if (this.changes > 0) {
        res.json({ message: 'Notification marked as read', id });
        return;
      }
      
      // If not found in unified table, try legacy tables
      if (type) {
        const tableName = type === 'supervisor' ? 'supervisor_notifications' : 'staff_notifications';
        db.run(
          `UPDATE ${tableName} SET isRead = 1 WHERE id = ?`,
          [id],
          function(legacyErr) {
            if (legacyErr) {
              res.status(500).json({ error: legacyErr.message });
              return;
            }
            
            if (this.changes === 0) {
              res.status(404).json({ error: 'Notification not found' });
              return;
            }
            
            res.json({ message: 'Notification marked as read', id });
          }
        );
      } else {
        res.status(404).json({ error: 'Notification not found' });
      }
    }
  );
});

module.exports = router;
