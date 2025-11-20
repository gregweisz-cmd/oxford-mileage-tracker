/**
 * Notification Routes
 * Extracted from server.js for better organization
 * Includes: Supervisor notifications, staff notifications, marking as read, sending messages
 */

const express = require('express');
const router = express.Router();
const dbService = require('../services/dbService');
const { debugLog, debugWarn, debugError } = require('../debug');

// ===== NOTIFICATIONS =====

// Get supervisor notifications
router.get('/api/notifications/supervisor/:supervisorId', (req, res) => {
  const db = dbService.getDb();
  const { supervisorId } = req.params;
  
  db.all(
    'SELECT * FROM supervisor_notifications WHERE supervisorId = ? ORDER BY createdAt DESC',
    [supervisorId],
    (err, rows) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json(rows);
    }
  );
});

// Get staff notifications
router.get('/api/notifications/staff/:employeeId', (req, res) => {
  const db = dbService.getDb();
  const { employeeId } = req.params;
  
  db.all(
    'SELECT * FROM staff_notifications WHERE employeeId = ? ORDER BY createdAt DESC',
    [employeeId],
    (err, rows) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json(rows);
    }
  );
});

// Mark notification as read
router.put('/api/notifications/:id/read', (req, res) => {
  const db = dbService.getDb();
  const { id } = req.params;
  const { type } = req.body; // 'supervisor' or 'staff'
  
  const tableName = type === 'supervisor' ? 'supervisor_notifications' : 'staff_notifications';
  
  db.run(
    `UPDATE ${tableName} SET isRead = 1 WHERE id = ?`,
    [id],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ message: 'Notification marked as read' });
    }
  );
});

// ===== MESSAGES =====

// Send message to staff
router.post('/api/messages/send', (req, res) => {
  const db = dbService.getDb();
  const { employeeId, supervisorId, supervisorName, message } = req.body;
  const id = `staff-notif-${Date.now()}`;
  const now = new Date().toISOString();

  db.run(
    'INSERT INTO staff_notifications (id, type, employeeId, supervisorId, supervisorName, message, isRead, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [id, 'supervisor_message', employeeId, supervisorId, supervisorName, message, 0, now],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ id, message: 'Message sent successfully' });
    }
  );
});

module.exports = router;

