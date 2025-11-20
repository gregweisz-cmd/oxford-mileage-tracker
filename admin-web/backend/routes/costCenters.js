/**
 * Cost Centers and Per Diem Routes
 * Extracted from server.js for better organization
 */

const express = require('express');
const router = express.Router();
const dbService = require('../services/dbService');
const { debugLog, debugError } = require('../debug');

/**
 * Get all cost centers
 */
router.get('/api/cost-centers', (req, res) => {
  const db = dbService.getDb();
  db.all('SELECT * FROM cost_centers ORDER BY name', (err, rows) => {
    if (err) {
      debugError('❌ Error fetching cost centers:', err);
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

/**
 * Get cost center by ID
 */
router.get('/api/cost-centers/:id', (req, res) => {
  const { id } = req.params;
  const db = dbService.getDb();
  db.get('SELECT * FROM cost_centers WHERE id = ?', [id], (err, row) => {
    if (err) {
      debugError('❌ Error fetching cost center:', err);
      res.status(500).json({ error: err.message });
      return;
    }
    if (!row) {
      res.status(404).json({ error: 'Cost center not found' });
      return;
    }
    res.json(row);
  });
});

/**
 * Create new cost center
 */
router.post('/api/cost-centers', (req, res) => {
  const { name, description, isActive, code } = req.body;
  const id = Date.now().toString(36) + Math.random().toString(36).substr(2);
  const now = new Date().toISOString();
  
  // Generate code from name if not provided
  const costCenterCode = code || name.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  
  const db = dbService.getDb();
  db.run(
    'INSERT INTO cost_centers (id, code, name, description, isActive, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [id, costCenterCode, name, description || '', isActive !== false ? 1 : 0, now, now],
    function(err) {
      if (err) {
        debugError('❌ Error creating cost center:', err);
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ id, code: costCenterCode, name, description, isActive: isActive !== false, createdAt: now, updatedAt: now });
    }
  );
});

/**
 * Update cost center
 */
router.put('/api/cost-centers/:id', (req, res) => {
  const { id } = req.params;
  const { name, description, isActive, code } = req.body;
  const now = new Date().toISOString();
  
  // Generate code from name if not provided
  const costCenterCode = code || name.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  
  const db = dbService.getDb();
  db.run(
    'UPDATE cost_centers SET code = ?, name = ?, description = ?, isActive = ?, updatedAt = ? WHERE id = ?',
    [costCenterCode, name, description || '', isActive !== false ? 1 : 0, now, id],
    function(err) {
      if (err) {
        debugError('❌ Error updating cost center:', err);
        res.status(500).json({ error: err.message });
        return;
      }
      if (this.changes === 0) {
        res.status(404).json({ error: 'Cost center not found' });
        return;
      }
      res.json({ id, code: costCenterCode, name, description, isActive: isActive !== false, updatedAt: now });
    }
  );
});

/**
 * Delete cost center
 */
router.delete('/api/cost-centers/:id', (req, res) => {
  const { id } = req.params;
  const db = dbService.getDb();
  db.run('DELETE FROM cost_centers WHERE id = ?', [id], function(err) {
    if (err) {
      debugError('❌ Error deleting cost center:', err);
      res.status(500).json({ error: err.message });
      return;
    }
    if (this.changes === 0) {
      res.status(404).json({ error: 'Cost center not found' });
      return;
    }
    res.json({ message: 'Cost center deleted successfully' });
  });
});

/**
 * Get all per diem rules
 */
router.get('/api/per-diem-rules', (req, res) => {
  const db = dbService.getDb();
  db.all('SELECT * FROM per_diem_rules ORDER BY costCenter', (err, rows) => {
    if (err) {
      debugError('Error fetching per diem rules:', err);
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

/**
 * Get per diem rule by cost center
 */
router.get('/api/per-diem-rules/:costCenter', (req, res) => {
  const { costCenter } = req.params;
  const db = dbService.getDb();
  db.get('SELECT * FROM per_diem_rules WHERE costCenter = ?', [costCenter], (err, row) => {
    if (err) {
      debugError('Error fetching per diem rule:', err);
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(row || null);
  });
});

/**
 * Create or update per diem rule
 */
router.post('/api/per-diem-rules', (req, res) => {
  const { id, costCenter, maxAmount, minHours, minMiles, minDistanceFromBase, description, useActualAmount } = req.body;
  const ruleId = id || (Date.now().toString(36) + Math.random().toString(36).substr(2));
  const now = new Date().toISOString();

  debugLog('📝 Creating/updating per diem rule:', {
    ruleId,
    costCenter,
    maxAmount,
    minHours,
    minMiles,
    minDistanceFromBase,
    useActualAmount
  });

  const db = dbService.getDb();
  db.run(
    'INSERT OR REPLACE INTO per_diem_rules (id, costCenter, maxAmount, minHours, minMiles, minDistanceFromBase, description, useActualAmount, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, COALESCE((SELECT createdAt FROM per_diem_rules WHERE id = ?), ?), ?)',
    [ruleId, costCenter, maxAmount, minHours || 0, minMiles || 0, minDistanceFromBase || 0, description || '', useActualAmount || 0, ruleId, now, now],
    function(err) {
      if (err) {
        debugError('Database error:', err.message);
        res.status(500).json({ error: err.message });
        return;
      }
      debugLog(`✅ Per diem rule ${ruleId} saved for ${costCenter}`);
      res.json({ id: ruleId, message: 'Per diem rule saved successfully' });
    }
  );
});

/**
 * Update per diem rule
 */
router.put('/api/per-diem-rules/:id', (req, res) => {
  const { id } = req.params;
  const { costCenter, maxAmount, minHours, minMiles, minDistanceFromBase, description, useActualAmount } = req.body;
  const now = new Date().toISOString();

  const db = dbService.getDb();
  db.run(
    'UPDATE per_diem_rules SET costCenter = ?, maxAmount = ?, minHours = ?, minMiles = ?, minDistanceFromBase = ?, description = ?, useActualAmount = ?, updatedAt = ? WHERE id = ?',
    [costCenter, maxAmount, minHours || 0, minMiles || 0, minDistanceFromBase || 0, description || '', useActualAmount || 0, now, id],
    function(err) {
      if (err) {
        debugError('Database error:', err.message);
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ message: 'Per diem rule updated successfully' });
    }
  );
});

/**
 * Delete per diem rule
 */
router.delete('/api/per-diem-rules/:id', (req, res) => {
  const { id } = req.params;
  const db = dbService.getDb();
  db.run('DELETE FROM per_diem_rules WHERE id = ?', [id], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ message: 'Per diem rule deleted successfully' });
  });
});

// ===== EES RULES =====

/**
 * Get all EES rules
 */
router.get('/api/ees-rules', (req, res) => {
  const db = dbService.getDb();
  db.all('SELECT * FROM ees_rules ORDER BY costCenter', (err, rows) => {
    if (err) {
      debugError('❌ Error fetching EES rules:', err);
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

/**
 * Create/Update EES rule
 */
router.post('/api/ees-rules', (req, res) => {
  const db = dbService.getDb();
  const { costCenter, maxAmount, description } = req.body;
  const id = Date.now().toString(36) + Math.random().toString(36).substr(2);
  const now = new Date().toISOString();

  // Check if rule already exists for this cost center
  db.get('SELECT id FROM ees_rules WHERE costCenter = ?', [costCenter], (err, row) => {
    if (err) {
      debugError('❌ Error checking EES rule:', err);
      res.status(500).json({ error: err.message });
      return;
    }

    if (row) {
      // Update existing rule
      db.run(
        'UPDATE ees_rules SET maxAmount = ?, description = ?, updatedAt = ? WHERE costCenter = ?',
        [maxAmount, description, now, costCenter],
        function(err) {
          if (err) {
            debugError('❌ Error updating EES rule:', err);
            res.status(500).json({ error: err.message });
            return;
          }
          res.json({ message: 'EES rule updated successfully' });
        }
      );
    } else {
      // Create new rule
      db.run(
        'INSERT INTO ees_rules (id, costCenter, maxAmount, description, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)',
        [id, costCenter, maxAmount, description, now, now],
        function(err) {
          if (err) {
            debugError('❌ Error creating EES rule:', err);
            res.status(500).json({ error: err.message });
            return;
          }
          res.json({ id, message: 'EES rule created successfully' });
        }
      );
    }
  });
});

/**
 * Delete EES rule
 */
router.delete('/api/ees-rules/:costCenter', (req, res) => {
  const db = dbService.getDb();
  const { costCenter } = req.params;
  db.run('DELETE FROM ees_rules WHERE costCenter = ?', [costCenter], function(err) {
    if (err) {
      debugError('❌ Error deleting EES rule:', err);
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ message: 'EES rule deleted successfully' });
  });
});

// ===== PER DIEM MONTHLY RULES =====

/**
 * Get all per diem monthly rules
 */
router.get('/api/per-diem-monthly-rules', (req, res) => {
  const db = dbService.getDb();
  db.all('SELECT * FROM per_diem_monthly_rules ORDER BY costCenter', (err, rows) => {
    if (err) {
      debugError('❌ Error fetching per diem monthly rules:', err);
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

/**
 * Create/Update per diem monthly rule
 */
router.post('/api/per-diem-monthly-rules', (req, res) => {
  const db = dbService.getDb();
  const { costCenter, maxAmount, description } = req.body;
  const id = Date.now().toString(36) + Math.random().toString(36).substr(2);
  const now = new Date().toISOString();

  // Check if rule already exists for this cost center
  db.get('SELECT id FROM per_diem_monthly_rules WHERE costCenter = ?', [costCenter], (err, row) => {
    if (err) {
      debugError('❌ Error checking per diem monthly rule:', err);
      res.status(500).json({ error: err.message });
      return;
    }

    if (row) {
      // Update existing rule
      db.run(
        'UPDATE per_diem_monthly_rules SET maxAmount = ?, description = ?, updatedAt = ? WHERE costCenter = ?',
        [maxAmount, description, now, costCenter],
        function(err) {
          if (err) {
            debugError('❌ Error updating per diem monthly rule:', err);
            res.status(500).json({ error: err.message });
            return;
          }
          res.json({ message: 'Per diem monthly rule updated successfully' });
        }
      );
    } else {
      // Create new rule
      db.run(
        'INSERT INTO per_diem_monthly_rules (id, costCenter, maxAmount, description, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)',
        [id, costCenter, maxAmount, description, now, now],
        function(err) {
          if (err) {
            debugError('❌ Error creating per diem monthly rule:', err);
            res.status(500).json({ error: err.message });
            return;
          }
          res.json({ id, message: 'Per diem monthly rule created successfully' });
        }
      );
    }
  });
});

/**
 * Delete per diem monthly rule
 */
router.delete('/api/per-diem-monthly-rules/:costCenter', (req, res) => {
  const db = dbService.getDb();
  const { costCenter } = req.params;
  db.run('DELETE FROM per_diem_monthly_rules WHERE costCenter = ?', [costCenter], function(err) {
    if (err) {
      debugError('❌ Error deleting per diem monthly rule:', err);
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ message: 'Per diem monthly rule deleted successfully' });
  });
});

module.exports = router;

