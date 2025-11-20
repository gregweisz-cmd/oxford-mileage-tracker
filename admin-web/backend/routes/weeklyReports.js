/**
 * Weekly Reports Routes
 * Extracted from server.js for better organization
 * Includes: CRUD operations, approval workflow
 */

const express = require('express');
const router = express.Router();
const dbService = require('../services/dbService');
const websocketService = require('../services/websocketService');
const { debugLog, debugError } = require('../debug');

// ===== WEEKLY REPORTS API ENDPOINTS =====

// Get all weekly reports
router.get('/api/weekly-reports', (req, res) => {
  const { employeeId, status } = req.query;
  const db = dbService.getDb();
  
  let query = 'SELECT * FROM weekly_reports';
  const params = [];
  
  if (employeeId || status) {
    query += ' WHERE';
    const conditions = [];
    if (employeeId) {
      conditions.push(' employeeId = ?');
      params.push(employeeId);
    }
    if (status) {
      conditions.push(' status = ?');
      params.push(status);
    }
    query += conditions.join(' AND');
  }
  
  query += ' ORDER BY year DESC, weekNumber DESC';
  
  db.all(query, params, (err, rows) => {
    if (err) {
      debugError('❌ Error fetching weekly reports:', err);
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

// Get weekly report by ID
router.get('/api/weekly-reports/:id', (req, res) => {
  const { id } = req.params;
  const db = dbService.getDb();
  
  db.get('SELECT * FROM weekly_reports WHERE id = ?', [id], (err, row) => {
    if (err) {
      debugError('❌ Error fetching weekly report:', err);
      res.status(500).json({ error: err.message });
      return;
    }
    if (!row) {
      res.status(404).json({ error: 'Weekly report not found' });
      return;
    }
    res.json(row);
  });
});

// Get weekly report for employee/week/year
router.get('/api/weekly-reports/employee/:employeeId/:year/:week', (req, res) => {
  const { employeeId, year, week } = req.params;
  const db = dbService.getDb();
  
  db.get(
    'SELECT * FROM weekly_reports WHERE employeeId = ? AND year = ? AND weekNumber = ?',
    [employeeId, parseInt(year), parseInt(week)],
    (err, row) => {
      if (err) {
        debugError('❌ Error fetching weekly report:', err);
        res.status(500).json({ error: err.message });
        return;
      }
      res.json(row || null);
    }
  );
});

// Create or update weekly report
router.post('/api/weekly-reports', (req, res) => {
  const { id, employeeId, weekNumber, year, startDate, endDate, totalMiles, totalExpenses, status } = req.body;
  const db = dbService.getDb();
  const reportId = id || `weekreport-${Date.now().toString(36)}-${Math.random().toString(36).substr(2)}`;
  const now = new Date().toISOString();

  debugLog('📝 Creating/updating weekly report:', {
    reportId,
    employeeId,
    weekNumber,
    year,
    startDate,
    endDate,
    totalMiles,
    totalExpenses,
    status: status || 'draft'
  });

  db.run(
    `INSERT OR REPLACE INTO weekly_reports (
      id, employeeId, weekNumber, year, startDate, endDate, totalMiles, totalExpenses, status,
      createdAt, updatedAt
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?, ?,
      COALESCE((SELECT createdAt FROM weekly_reports WHERE id = ?), ?),
      ?
    )`,
    [
      reportId, employeeId, weekNumber, year, startDate, endDate,
      totalMiles || 0,
      totalExpenses || 0,
      status || 'draft',
      reportId, now, now
    ],
    function(err) {
      if (err) {
        debugError('❌ Database error:', err.message);
        res.status(500).json({ error: err.message });
        return;
      }
      debugLog(`✅ Weekly report ${reportId} saved`);
      res.json({ id: reportId, message: 'Weekly report saved successfully' });
    }
  );
});

// Submit weekly report for approval
router.post('/api/weekly-reports/:id/submit', (req, res) => {
  const { id } = req.params;
  const { submittedBy } = req.body;
  const db = dbService.getDb();
  const now = new Date().toISOString();

  debugLog(`📤 Submitting weekly report ${id} for approval by ${submittedBy}`);

  db.run(
    `UPDATE weekly_reports SET 
      status = 'submitted',
      submittedAt = ?,
      submittedBy = ?,
      updatedAt = ?
    WHERE id = ?`,
    [now, submittedBy, now, id],
    function(err) {
      if (err) {
        debugError('❌ Database error:', err.message);
        res.status(500).json({ error: err.message });
        return;
      }
      if (this.changes === 0) {
        res.status(404).json({ error: 'Weekly report not found' });
        return;
      }
      debugLog(`✅ Weekly report ${id} submitted for approval`);
      
      websocketService.handleDataChangeNotification('weekly_reports', 'update', { id, status: 'submitted' });
      
      res.json({ message: 'Weekly report submitted for approval successfully' });
    }
  );
});

// Approve weekly report
router.post('/api/weekly-reports/:id/approve', (req, res) => {
  const { id } = req.params;
  const { approvedBy, comments } = req.body;
  const db = dbService.getDb();
  const now = new Date().toISOString();

  debugLog(`✅ Approving weekly report ${id} by ${approvedBy}`);

  db.run(
    `UPDATE weekly_reports SET 
      status = 'approved',
      reviewedAt = ?,
      reviewedBy = ?,
      approvedAt = ?,
      approvedBy = ?,
      comments = ?,
      updatedAt = ?
    WHERE id = ?`,
    [now, approvedBy, now, approvedBy, comments || '', now, id],
    function(err) {
      if (err) {
        debugError('❌ Database error:', err.message);
        res.status(500).json({ error: err.message });
        return;
      }
      if (this.changes === 0) {
        res.status(404).json({ error: 'Weekly report not found' });
        return;
      }
      debugLog(`✅ Weekly report ${id} approved`);
      
      websocketService.handleDataChangeNotification('weekly_reports', 'update', { id, status: 'approved' });
      
      res.json({ message: 'Weekly report approved successfully' });
    }
  );
});

// Reject weekly report
router.post('/api/weekly-reports/:id/reject', (req, res) => {
  const { id } = req.params;
  const { rejectedBy, rejectionReason, comments } = req.body;
  const db = dbService.getDb();
  const now = new Date().toISOString();

  debugLog(`❌ Rejecting weekly report ${id} by ${rejectedBy}`);

  db.run(
    `UPDATE weekly_reports SET 
      status = 'rejected',
      reviewedAt = ?,
      reviewedBy = ?,
      rejectedAt = ?,
      rejectedBy = ?,
      rejectionReason = ?,
      comments = ?,
      updatedAt = ?
    WHERE id = ?`,
    [now, rejectedBy, now, rejectedBy, rejectionReason || '', comments || '', now, id],
    function(err) {
      if (err) {
        debugError('❌ Database error:', err.message);
        res.status(500).json({ error: err.message });
        return;
      }
      if (this.changes === 0) {
        res.status(404).json({ error: 'Weekly report not found' });
        return;
      }
      debugLog(`❌ Weekly report ${id} rejected`);
      
      websocketService.handleDataChangeNotification('weekly_reports', 'update', { id, status: 'rejected' });
      
      res.json({ message: 'Weekly report rejected successfully' });
    }
  );
});

// Request revision on weekly report
router.post('/api/weekly-reports/:id/request-revision', (req, res) => {
  const { id } = req.params;
  const { reviewedBy, comments } = req.body;
  const db = dbService.getDb();
  const now = new Date().toISOString();

  debugLog(`🔄 Requesting revision on weekly report ${id} by ${reviewedBy}`);

  db.run(
    `UPDATE weekly_reports SET 
      status = 'needs_revision',
      reviewedAt = ?,
      reviewedBy = ?,
      comments = ?,
      updatedAt = ?
    WHERE id = ?`,
    [now, reviewedBy, comments || '', now, id],
    function(err) {
      if (err) {
        debugError('❌ Database error:', err.message);
        res.status(500).json({ error: err.message });
        return;
      }
      if (this.changes === 0) {
        res.status(404).json({ error: 'Weekly report not found' });
        return;
      }
      debugLog(`🔄 Weekly report ${id} needs revision`);
      
      websocketService.handleDataChangeNotification('weekly_reports', 'update', { id, status: 'needs_revision' });
      
      res.json({ message: 'Revision requested successfully' });
    }
  );
});

// Get pending weekly reports for supervisor
router.get('/api/weekly-reports/supervisor/:supervisorId/pending', (req, res) => {
  const { supervisorId } = req.params;
  const db = dbService.getDb();
  
  db.all(
    'SELECT id FROM employees WHERE supervisorId = ?',
    [supervisorId],
    (err, employees) => {
      if (err) {
        debugError('❌ Error fetching supervised employees:', err);
        res.status(500).json({ error: err.message });
        return;
      }
      
      if (employees.length === 0) {
        res.json([]);
        return;
      }
      
      const employeeIds = employees.map(e => e.id);
      const placeholders = employeeIds.map(() => '?').join(',');
      
      db.all(
        `SELECT wr.*, e.name as employeeName, e.email as employeeEmail
         FROM weekly_reports wr
         JOIN employees e ON wr.employeeId = e.id
         WHERE wr.employeeId IN (${placeholders}) AND wr.status = 'submitted'
         ORDER BY wr.year DESC, wr.weekNumber DESC`,
        employeeIds,
        (err, reports) => {
          if (err) {
            debugError('❌ Error fetching pending weekly reports:', err);
            res.status(500).json({ error: err.message });
            return;
          }
          res.json(reports);
        }
      );
    }
  );
});

// Delete weekly report
router.delete('/api/weekly-reports/:id', (req, res) => {
  const { id } = req.params;
  const db = dbService.getDb();
  
  db.run('DELETE FROM weekly_reports WHERE id = ?', [id], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (this.changes === 0) {
      res.status(404).json({ error: 'Weekly report not found' });
      return;
    }
    
    websocketService.handleDataChangeNotification('weekly_reports', 'delete', { id });
    
    res.json({ message: 'Weekly report deleted successfully' });
  });
});

module.exports = router;

