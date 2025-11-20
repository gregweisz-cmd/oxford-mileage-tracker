/**
 * Approval Workflow Routes
 * Extracted from server.js for better organization
 * Includes: Report submission, approval, rejection, revision requests
 */

const express = require('express');
const router = express.Router();
const dbService = require('../services/dbService');
const websocketService = require('../services/websocketService');
const { debugLog, debugWarn, debugError } = require('../debug');

// ===== REPORT APPROVAL SYSTEM API ENDPOINTS =====

// Submit report for approval
router.post('/api/reports/submit', (req, res) => {
  const db = dbService.getDb();
  const { reportId, employeeId, supervisorId } = req.body;
  const id = `status-${Date.now()}`;
  const now = new Date().toISOString();

  // Check if employee is a Regional Manager (RM)
  db.get(
    'SELECT position FROM employees WHERE id = ?',
    [employeeId],
    (err, employee) => {
      if (err) {
        debugError('Database error:', err.message);
        res.status(500).json({ error: err.message });
        return;
      }

      // Check if employee is exempt from approval (RM, Director, CEO, CFO)
      if (employee && employee.position) {
        const positionLower = employee.position.toLowerCase();
        const isExempt = positionLower.includes('regional manager') ||
                        positionLower.includes('director') ||
                        positionLower.includes('chief') ||
                        positionLower.includes('ceo') ||
                        positionLower.includes('cfo');
        
        if (isExempt) {
          const statusId = `status-${Date.now()}`;
          db.run(
            'INSERT INTO report_status (id, reportId, employeeId, status, supervisorId, supervisorName, submittedAt, approvedAt, reviewedAt, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [statusId, reportId, employeeId, 'approved', 'EXECUTIVE_AUTO_APPROVE', 'System', now, now, now, now, now],
            function(insertErr) {
              if (insertErr) {
                debugError('Database error:', insertErr.message);
                res.status(500).json({ error: insertErr.message });
                return;
              }

              // Create approval record
              const approvalId = `approval-${Date.now()}`;
              db.run(
                'INSERT INTO report_approvals (id, reportId, employeeId, supervisorId, supervisorName, action, comments, timestamp, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [approvalId, reportId, employeeId, 'EXECUTIVE_AUTO_APPROVE', 'System', 'approve', `Auto-approved for ${employee.position}`, now, now],
                function(approvalErr) {
                  if (approvalErr) {
                    debugError('Error creating approval record:', approvalErr.message);
                  }
                  res.json({ id: statusId, message: 'Report auto-approved and submitted to Finance' });
                }
              );
            }
          );
          return;
        }
      }

      // Regular submission - needs supervisor approval
      db.run(
        'INSERT INTO report_status (id, reportId, employeeId, status, supervisorId, submittedAt, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [id, reportId, employeeId, 'pending', supervisorId, now, now, now],
        function(insertErr) {
          if (insertErr) {
            debugError('Database error:', insertErr.message);
            res.status(500).json({ error: insertErr.message });
            return;
          }
          res.json({ id, message: 'Report submitted for approval successfully' });
        }
      );
    }
  );
});

// Get pending reports for supervisor (including cascading supervision)
router.get('/api/reports/pending/:supervisorId', async (req, res) => {
  const db = dbService.getDb();
  const { supervisorId } = req.params;
  
  try {
    // Get all supervised employees (direct + indirect)
    const supervisedEmployeeIds = await dbService.getAllSupervisedEmployees(supervisorId);
    
    if (supervisedEmployeeIds.length === 0) {
      res.json([]);
      return;
    }

    const placeholders = supervisedEmployeeIds.map(() => '?').join(',');
  
    db.all(
      `SELECT * FROM report_status WHERE employeeId IN (${placeholders}) AND status = ? ORDER BY submittedAt ASC`,
      [...supervisedEmployeeIds, 'pending'],
      (err, rows) => {
        if (err) {
          res.status(500).json({ error: err.message });
          return;
        }
        res.json(rows);
      }
    );
  } catch (error) {
    debugError('❌ Error fetching supervised employees:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get report history for supervisor (including cascading supervision)
router.get('/api/reports/history/:supervisorId', async (req, res) => {
  const db = dbService.getDb();
  const { supervisorId } = req.params;
  const limit = req.query.limit || 50;
  
  try {
    // Get all supervised employees (direct + indirect)
    const supervisedEmployeeIds = await dbService.getAllSupervisedEmployees(supervisorId);
    
    if (supervisedEmployeeIds.length === 0) {
      res.json([]);
      return;
    }

    const placeholders = supervisedEmployeeIds.map(() => '?').join(',');
  
    db.all(
      `SELECT * FROM report_status WHERE employeeId IN (${placeholders}) ORDER BY COALESCE(reviewedAt, submittedAt) DESC LIMIT ?`,
      [...supervisedEmployeeIds, limit],
      (err, rows) => {
        if (err) {
          res.status(500).json({ error: err.message });
          return;
        }
        res.json(rows);
      }
    );
  } catch (error) {
    debugError('❌ Error fetching supervised employees:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get reports for employee
router.get('/api/reports/employee/:employeeId', (req, res) => {
  const db = dbService.getDb();
  const { employeeId } = req.params;
  
  db.all(
    'SELECT * FROM report_status WHERE employeeId = ? ORDER BY submittedAt DESC',
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

// Approve report
router.post('/api/reports/approve', (req, res) => {
  const db = dbService.getDb();
  const { reportId, supervisorId, supervisorName, comments } = req.body;
  const now = new Date().toISOString();

  // Update report status
  db.run(
    'UPDATE report_status SET status = ?, supervisorId = ?, supervisorName = ?, comments = ?, reviewedAt = ?, approvedAt = ?, updatedAt = ? WHERE reportId = ?',
    ['approved', supervisorId, supervisorName, comments, now, now, now, reportId],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }

      // Create approval record
      const approvalId = `approval-${Date.now()}`;
      db.run(
        'INSERT INTO report_approvals (id, reportId, employeeId, supervisorId, supervisorName, action, comments, timestamp, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [approvalId, reportId, req.body.employeeId, supervisorId, supervisorName, 'approve', comments, now, now],
        function(approvalErr) {
          if (approvalErr) {
            debugError('Error creating approval record:', approvalErr.message);
          }
          res.json({ message: 'Report approved successfully' });
        }
      );
    }
  );
});

// Reject report
router.post('/api/reports/reject', (req, res) => {
  const db = dbService.getDb();
  const { reportId, supervisorId, supervisorName, comments } = req.body;
  const now = new Date().toISOString();

  // Update report status
  db.run(
    'UPDATE report_status SET status = ?, supervisorId = ?, supervisorName = ?, comments = ?, reviewedAt = ?, updatedAt = ? WHERE reportId = ?',
    ['rejected', supervisorId, supervisorName, comments, now, now, reportId],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }

      // Create rejection record
      const approvalId = `approval-${Date.now()}`;
      db.run(
        'INSERT INTO report_approvals (id, reportId, employeeId, supervisorId, supervisorName, action, comments, timestamp, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [approvalId, reportId, req.body.employeeId, supervisorId, supervisorName, 'reject', comments, now, now],
        function(approvalErr) {
          if (approvalErr) {
            debugError('Error creating rejection record:', approvalErr.message);
          }
          res.json({ message: 'Report rejected successfully' });
        }
      );
    }
  );
});

// Request revision
router.post('/api/reports/request-revision', (req, res) => {
  const db = dbService.getDb();
  const { reportId, supervisorId, supervisorName, comments } = req.body;
  const now = new Date().toISOString();

  // Update report status
  db.run(
    'UPDATE report_status SET status = ?, supervisorId = ?, supervisorName = ?, comments = ?, reviewedAt = ?, updatedAt = ? WHERE reportId = ?',
    ['needs_revision', supervisorId, supervisorName, comments, now, now, reportId],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }

      // Create revision request record
      const approvalId = `approval-${Date.now()}`;
      db.run(
        'INSERT INTO report_approvals (id, reportId, employeeId, supervisorId, supervisorName, action, comments, timestamp, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [approvalId, reportId, req.body.employeeId, supervisorId, supervisorName, 'request_revision', comments, now, now],
        function(approvalErr) {
          if (approvalErr) {
            debugError('Error creating revision request record:', approvalErr.message);
          }
          res.json({ message: 'Revision requested successfully' });
        }
      );
    }
  );
});

// Get report approval history
router.get('/api/reports/:reportId/approval-history', (req, res) => {
  const db = dbService.getDb();
  const { reportId } = req.params;
  
  db.all(
    'SELECT * FROM report_approvals WHERE reportId = ? ORDER BY timestamp DESC',
    [reportId],
    (err, rows) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json(rows);
    }
  );
});

module.exports = router;

