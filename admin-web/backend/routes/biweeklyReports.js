/**
 * Bi-weekly Reports Routes
 * Extracted from server.js for better organization
 * Includes: CRUD operations, approval workflow
 */

const express = require('express');
const router = express.Router();
const dbService = require('../services/dbService');
const websocketService = require('../services/websocketService');
const { debugLog, debugError } = require('../debug');

// ===== BIWEEKLY REPORTS API ENDPOINTS (Month-based: 1-15, 16-end) =====

// Get all biweekly reports
router.get('/api/biweekly-reports', (req, res) => {
  const { employeeId, status } = req.query;
  const db = dbService.getDb();

  let query = 'SELECT * FROM biweekly_reports';
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

  query += ' ORDER BY year DESC, month DESC, periodNumber DESC';

  db.all(query, params, (err, rows) => {
    if (err) {
      debugError('❌ Error fetching biweekly reports:', err);
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

// Get biweekly report by ID
router.get('/api/biweekly-reports/:id', (req, res) => {
  const { id } = req.params;
  const db = dbService.getDb();

  db.get('SELECT * FROM biweekly_reports WHERE id = ?', [id], (err, row) => {
    if (err) {
      debugError('❌ Error fetching biweekly report:', err);
      res.status(500).json({ error: err.message });
      return;
    }
    if (!row) {
      res.status(404).json({ error: 'Biweekly report not found' });
      return;
    }
    res.json(row);
  });
});

// Get biweekly report for employee/month/year/period
router.get('/api/biweekly-reports/employee/:employeeId/:year/:month/:period', (req, res) => {
  const { employeeId, year, month, period } = req.params;
  const db = dbService.getDb();

  db.get(
    'SELECT * FROM biweekly_reports WHERE employeeId = ? AND year = ? AND month = ? AND periodNumber = ?',
    [employeeId, parseInt(year), parseInt(month), parseInt(period)],
    (err, row) => {
      if (err) {
        debugError('❌ Error fetching biweekly report:', err);
        res.status(500).json({ error: err.message });
        return;
      }
      res.json(row || null);
    }
  );
});

// Create or update biweekly report
router.post('/api/biweekly-reports', (req, res) => {
  const { id, employeeId, month, year, periodNumber, startDate, endDate, totalMiles, totalExpenses, status } = req.body;
  const db = dbService.getDb();
  const reportId = id || `biweek-${Date.now().toString(36)}-${Math.random().toString(36).substr(2)}`;
  const now = new Date().toISOString();

  debugLog('📝 Creating/updating biweekly report:', {
    reportId,
    employeeId,
    month,
    year,
    periodNumber,
    startDate,
    endDate,
    totalMiles,
    totalExpenses,
    status: status || 'draft'
  });

  db.run(
    `INSERT OR REPLACE INTO biweekly_reports (
      id, employeeId, month, year, periodNumber, startDate, endDate, totalMiles, totalExpenses, status,
      createdAt, updatedAt
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
      COALESCE((SELECT createdAt FROM biweekly_reports WHERE id = ?), ?),
      ?
    )`,
    [
      reportId, employeeId, month, year, periodNumber, startDate, endDate,
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
      debugLog(`✅ Biweekly report ${reportId} saved`);
      res.json({ id: reportId, message: 'Biweekly report saved successfully' });
    }
  );
});

// Submit biweekly report for approval
router.post('/api/biweekly-reports/:id/submit', (req, res) => {
  const { id } = req.params;
  const { submittedBy } = req.body;
  const db = dbService.getDb();
  const now = new Date().toISOString();

  debugLog(`📤 Submitting biweekly report ${id} for approval by ${submittedBy}`);

  db.run(
    `UPDATE biweekly_reports SET 
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
        res.status(404).json({ error: 'Biweekly report not found' });
        return;
      }
      debugLog(`✅ Biweekly report ${id} submitted for approval`);

      websocketService.handleDataChangeNotification('biweekly_reports', 'update', { id, status: 'submitted' });

      res.json({ message: 'Biweekly report submitted for approval successfully' });
    }
  );
});

// Approve biweekly report
router.post('/api/biweekly-reports/:id/approve', (req, res) => {
  const { id } = req.params;
  const { approvedBy, comments } = req.body;
  const db = dbService.getDb();
  const now = new Date().toISOString();

  debugLog(`✅ Approving biweekly report ${id} by ${approvedBy}`);

  db.run(
    `UPDATE biweekly_reports SET 
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
        res.status(404).json({ error: 'Biweekly report not found' });
        return;
      }
      debugLog(`✅ Biweekly report ${id} approved`);

      websocketService.handleDataChangeNotification('biweekly_reports', 'update', { id, status: 'approved' });

      res.json({ message: 'Biweekly report approved successfully' });
    }
  );
});

// Reject biweekly report
router.post('/api/biweekly-reports/:id/reject', (req, res) => {
  const { id } = req.params;
  const { rejectedBy, rejectionReason, comments } = req.body;
  const db = dbService.getDb();
  const now = new Date().toISOString();

  debugLog(`❌ Rejecting biweekly report ${id} by ${rejectedBy}`);

  db.run(
    `UPDATE biweekly_reports SET 
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
        res.status(404).json({ error: 'Biweekly report not found' });
        return;
      }
      debugLog(`❌ Biweekly report ${id} rejected`);

      websocketService.handleDataChangeNotification('biweekly_reports', 'update', { id, status: 'rejected' });

      res.json({ message: 'Biweekly report rejected successfully' });
    }
  );
});

// Request revision on biweekly report
router.post('/api/biweekly-reports/:id/request-revision', (req, res) => {
  const { id } = req.params;
  const { reviewedBy, comments } = req.body;
  const db = dbService.getDb();
  const now = new Date().toISOString();

  debugLog(`🔄 Requesting revision on biweekly report ${id} by ${reviewedBy}`);

  db.run(
    `UPDATE biweekly_reports SET 
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
        res.status(404).json({ error: 'Biweekly report not found' });
        return;
      }
      debugLog(`🔄 Biweekly report ${id} needs revision`);

      websocketService.handleDataChangeNotification('biweekly_reports', 'update', { id, status: 'needs_revision' });

      res.json({ message: 'Revision requested successfully' });
    }
  );
});

// Get pending biweekly reports for supervisor (including cascading supervision)
router.get('/api/biweekly-reports/supervisor/:supervisorId/pending', async (req, res) => {
  const { supervisorId } = req.params;

  try {
    // Get all supervised employees (direct + indirect)
    const supervisedEmployeeIds = await dbService.getAllSupervisedEmployees(supervisorId);
    
    if (supervisedEmployeeIds.length === 0) {
      res.json([]);
      return;
    }

    const placeholders = supervisedEmployeeIds.map(() => '?').join(',');
    const db = dbService.getDb();

    db.all(
      `SELECT br.*, e.name as employeeName, e.email as employeeEmail
       FROM biweekly_reports br
       JOIN employees e ON br.employeeId = e.id
       WHERE br.employeeId IN (${placeholders}) AND br.status = 'submitted'
       ORDER BY br.year DESC, br.month DESC, br.periodNumber DESC`,
      supervisedEmployeeIds,
      (err, reports) => {
        if (err) {
          debugError('❌ Error fetching pending biweekly reports:', err);
          res.status(500).json({ error: err.message });
          return;
        }
        res.json(reports);
      }
    );
  } catch (error) {
    debugError('❌ Error fetching supervised employees:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete biweekly report
router.delete('/api/biweekly-reports/:id', (req, res) => {
  const { id } = req.params;
  const db = dbService.getDb();

  db.run('DELETE FROM biweekly_reports WHERE id = ?', [id], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (this.changes === 0) {
      res.status(404).json({ error: 'Biweekly report not found' });
      return;
    }

    websocketService.handleDataChangeNotification('biweekly_reports', 'delete', { id });

    res.json({ message: 'Biweekly report deleted successfully' });
  });
});

module.exports = router;

