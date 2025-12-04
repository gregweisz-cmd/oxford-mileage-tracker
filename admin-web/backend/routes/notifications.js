/**
 * Notification Routes
 * Handles unified notification system for all roles
 */

const express = require('express');
const router = express.Router();
const dbService = require('../services/dbService');
const notificationService = require('../services/notificationService');
const { debugLog, debugWarn, debugError } = require('../debug');
const { notificationPollingLimiter } = require('../middleware/rateLimiter');

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
