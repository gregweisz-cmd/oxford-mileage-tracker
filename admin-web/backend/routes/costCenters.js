/**
 * Cost Centers and Per Diem Routes
 * Extracted from server.js for better organization
 */

const express = require('express');
const router = express.Router();
const dbService = require('../services/dbService');
const { debugLog, debugError } = require('../debug');
const { requireAuth } = require('../middleware/auth');
const { normalizeTierRow } = require('../utils/perDiemTierEvaluator');

router.use([
  '/api/cost-centers',
  '/api/per-diem-rules',
  '/api/per-diem-tiers',
  '/api/ees-rules',
  '/api/per-diem-monthly-rules',
  '/api/finance-cost-center-assignments',
], requireAuth);

const normalizeCostCenter = (value) =>
  String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');

function mapRuleRow(row) {
  if (!row) return null;
  return {
    ...row,
    useActualAmount: Boolean(row.useActualAmount),
    ruleType: row.ruleType || 'single',
  };
}

function fetchAllTiers(db) {
  return new Promise((resolve, reject) => {
    db.all(
      'SELECT * FROM per_diem_tiers ORDER BY costCenter, sortOrder DESC',
      (err, rows) => {
        if (err) reject(err);
        else resolve((rows || []).map(normalizeTierRow));
      }
    );
  });
}

function fetchTiersForCostCenter(db, costCenter) {
  return new Promise((resolve, reject) => {
    db.all(
      'SELECT * FROM per_diem_tiers WHERE costCenter = ? ORDER BY sortOrder DESC',
      [costCenter],
      (err, rows) => {
        if (err) reject(err);
        else resolve((rows || []).map(normalizeTierRow));
      }
    );
  });
}

function attachTiersToRules(rules, tiers) {
  const tiersByCostCenter = new Map();
  for (const tier of tiers) {
    const key = tier.costCenter;
    if (!tiersByCostCenter.has(key)) tiersByCostCenter.set(key, []);
    tiersByCostCenter.get(key).push(tier);
  }
  return rules.map((rule) => ({
    ...mapRuleRow(rule),
    tiers: tiersByCostCenter.get(rule.costCenter) || [],
  }));
}

function saveTiersForCostCenter(db, costCenter, tiers) {
  return new Promise((resolve, reject) => {
    const now = new Date().toISOString();
    db.run('DELETE FROM per_diem_tiers WHERE costCenter = ?', [costCenter], (deleteErr) => {
      if (deleteErr) {
        reject(deleteErr);
        return;
      }
      if (!Array.isArray(tiers) || tiers.length === 0) {
        resolve([]);
        return;
      }

      const saved = [];
      let pending = tiers.length;
      let failed = false;

      tiers.forEach((tier, index) => {
        const tierId =
          tier.id || `${Date.now().toString(36)}${Math.random().toString(36).substr(2)}${index}`;
        db.run(
          `INSERT INTO per_diem_tiers (
            id, costCenter, label, amount, minHours, minMiles, minDistanceFromBase,
            requiresOvernight, sortOrder, createdAt, updatedAt
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            tierId,
            costCenter,
            tier.label || `Tier ${index + 1}`,
            Number(tier.amount) || 0,
            Number(tier.minHours) || 0,
            Number(tier.minMiles) || 0,
            Number(tier.minDistanceFromBase) || 0,
            tier.requiresOvernight ? 1 : 0,
            Number(tier.sortOrder) || 0,
            tier.createdAt || now,
            now,
          ],
          (insertErr) => {
            if (failed) return;
            if (insertErr) {
              failed = true;
              reject(insertErr);
              return;
            }
            saved.push(
              normalizeTierRow({
                id: tierId,
                costCenter,
                label: tier.label || `Tier ${index + 1}`,
                amount: Number(tier.amount) || 0,
                minHours: Number(tier.minHours) || 0,
                minMiles: Number(tier.minMiles) || 0,
                minDistanceFromBase: Number(tier.minDistanceFromBase) || 0,
                requiresOvernight: tier.requiresOvernight ? 1 : 0,
                sortOrder: Number(tier.sortOrder) || 0,
                createdAt: tier.createdAt || now,
                updatedAt: now,
              })
            );
            pending -= 1;
            if (pending === 0) resolve(saved);
          }
        );
      });
    });
  });
}

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
    const filtered = (rows || []).filter((row) => !String(row?.name || '').includes('/'));
    res.json(filtered);
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
  const {
    name,
    description,
    isActive,
    code,
    enableGoogleMaps,
    perDiemReceiptImageRequired,
    noTaxesOnReceipts,
    noTaxesOnSupplies,
  } = req.body;
  const id = Date.now().toString(36) + Math.random().toString(36).substr(2);
  const now = new Date().toISOString();
  
  // Generate code from name if not provided
  const costCenterCode = code || name.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  
  const db = dbService.getDb();
  db.run(
    'INSERT INTO cost_centers (id, code, name, description, isActive, enableGoogleMaps, perDiemReceiptImageRequired, noTaxesOnReceipts, noTaxesOnSupplies, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [id, costCenterCode, name, description || '', isActive !== false ? 1 : 0, enableGoogleMaps ? 1 : 0, perDiemReceiptImageRequired ? 1 : 0, noTaxesOnReceipts ? 1 : 0, noTaxesOnSupplies ? 1 : 0, now, now],
    function(err) {
      if (err) {
        debugError('❌ Error creating cost center:', err);
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({
        id,
        code: costCenterCode,
        name,
        description,
        isActive: isActive !== false,
        enableGoogleMaps: enableGoogleMaps ? true : false,
        perDiemReceiptImageRequired: perDiemReceiptImageRequired ? true : false,
        noTaxesOnReceipts: noTaxesOnReceipts ? true : false,
        noTaxesOnSupplies: noTaxesOnSupplies ? true : false,
        createdAt: now,
        updatedAt: now
      });
    }
  );
});

/**
 * Update cost center
 */
router.put('/api/cost-centers/:id', (req, res) => {
  const { id } = req.params;
  const {
    name,
    description,
    isActive,
    code,
    enableGoogleMaps,
    perDiemReceiptImageRequired,
    noTaxesOnReceipts,
    noTaxesOnSupplies,
  } = req.body;
  const now = new Date().toISOString();
  const perDiemRequiredValue =
    typeof perDiemReceiptImageRequired === 'boolean'
      ? (perDiemReceiptImageRequired ? 1 : 0)
      : null;
  const noTaxesOnReceiptsValue =
    typeof noTaxesOnReceipts === 'boolean' ? (noTaxesOnReceipts ? 1 : 0) : null;
  const noTaxesOnSuppliesValue =
    typeof noTaxesOnSupplies === 'boolean' ? (noTaxesOnSupplies ? 1 : 0) : null;
  
  // Generate code from name if not provided
  const costCenterCode = code || name.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  
  const db = dbService.getDb();
  db.run(
    'UPDATE cost_centers SET code = ?, name = ?, description = ?, isActive = ?, enableGoogleMaps = ?, perDiemReceiptImageRequired = COALESCE(?, perDiemReceiptImageRequired), noTaxesOnReceipts = COALESCE(?, noTaxesOnReceipts), noTaxesOnSupplies = COALESCE(?, noTaxesOnSupplies), updatedAt = ? WHERE id = ?',
    [costCenterCode, name, description || '', isActive !== false ? 1 : 0, enableGoogleMaps ? 1 : 0, perDiemRequiredValue, noTaxesOnReceiptsValue, noTaxesOnSuppliesValue, now, id],
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
      res.json({
        id,
        code: costCenterCode,
        name,
        description,
        isActive: isActive !== false,
        enableGoogleMaps: enableGoogleMaps ? true : false,
        perDiemReceiptImageRequired: perDiemRequiredValue == null ? undefined : !!perDiemRequiredValue,
        noTaxesOnReceipts: noTaxesOnReceiptsValue == null ? undefined : !!noTaxesOnReceiptsValue,
        noTaxesOnSupplies: noTaxesOnSuppliesValue == null ? undefined : !!noTaxesOnSuppliesValue,
        updatedAt: now
      });
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
 * Get all per diem rules (with tiers when tiered)
 */
router.get('/api/per-diem-rules', async (req, res) => {
  const db = dbService.getDb();
  try {
    const [rules, tiers] = await Promise.all([
      new Promise((resolve, reject) => {
        db.all('SELECT * FROM per_diem_rules ORDER BY costCenter', (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        });
      }),
      fetchAllTiers(db),
    ]);
    res.json(attachTiersToRules(rules, tiers));
  } catch (err) {
    debugError('Error fetching per diem rules:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * Get all tiers (optional filter by costCenter query param)
 */
router.get('/api/per-diem-tiers', async (req, res) => {
  const db = dbService.getDb();
  const { costCenter } = req.query;
  try {
    if (costCenter) {
      const tiers = await fetchTiersForCostCenter(db, String(costCenter));
      res.json(tiers);
      return;
    }
    const tiers = await fetchAllTiers(db);
    res.json(tiers);
  } catch (err) {
    debugError('Error fetching per diem tiers:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * Get per diem rule by cost center
 */
router.get('/api/per-diem-rules/:costCenter', async (req, res) => {
  const { costCenter } = req.params;
  const db = dbService.getDb();
  try {
    const row = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM per_diem_rules WHERE costCenter = ?', [costCenter], (err, result) => {
        if (err) reject(err);
        else resolve(result || null);
      });
    });
    if (!row) {
      res.json(null);
      return;
    }
    const tiers = await fetchTiersForCostCenter(db, costCenter);
    res.json({ ...mapRuleRow(row), tiers });
  } catch (err) {
    debugError('Error fetching per diem rule:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * Create or update per diem rule (and tiers when provided)
 */
router.post('/api/per-diem-rules', async (req, res) => {
  const {
    id,
    costCenter,
    maxAmount,
    minHours,
    minMiles,
    minDistanceFromBase,
    description,
    useActualAmount,
    ruleType,
    tiers,
  } = req.body;
  const ruleId = id || Date.now().toString(36) + Math.random().toString(36).substr(2);
  const now = new Date().toISOString();
  const normalizedRuleType = ruleType === 'tiered' ? 'tiered' : 'single';

  debugLog('📝 Creating/updating per diem rule:', {
    ruleId,
    costCenter,
    maxAmount,
    minHours,
    minMiles,
    minDistanceFromBase,
    useActualAmount,
    ruleType: normalizedRuleType,
    tierCount: Array.isArray(tiers) ? tiers.length : 0,
  });

  const db = dbService.getDb();
  try {
    await new Promise((resolve, reject) => {
      db.run(
        `INSERT OR REPLACE INTO per_diem_rules (
          id, costCenter, maxAmount, minHours, minMiles, minDistanceFromBase,
          description, useActualAmount, ruleType, createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE((SELECT createdAt FROM per_diem_rules WHERE id = ?), ?), ?)`,
        [
          ruleId,
          costCenter,
          maxAmount,
          minHours || 0,
          minMiles || 0,
          minDistanceFromBase || 0,
          description || '',
          useActualAmount ? 1 : 0,
          normalizedRuleType,
          ruleId,
          now,
          now,
        ],
        function (err) {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    let savedTiers = [];
    if (normalizedRuleType === 'tiered' && Array.isArray(tiers)) {
      savedTiers = await saveTiersForCostCenter(db, costCenter, tiers);
    } else if (normalizedRuleType === 'single') {
      await saveTiersForCostCenter(db, costCenter, []);
    }

    debugLog(`✅ Per diem rule ${ruleId} saved for ${costCenter}`);
    res.json({
      id: ruleId,
      costCenter,
      maxAmount,
      minHours: minHours || 0,
      minMiles: minMiles || 0,
      minDistanceFromBase: minDistanceFromBase || 0,
      description: description || '',
      useActualAmount: Boolean(useActualAmount),
      ruleType: normalizedRuleType,
      tiers: savedTiers,
      message: 'Per diem rule saved successfully',
    });
  } catch (err) {
    debugError('Database error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * Update per diem rule
 */
router.put('/api/per-diem-rules/:id', async (req, res) => {
  const { id } = req.params;
  const {
    costCenter,
    maxAmount,
    minHours,
    minMiles,
    minDistanceFromBase,
    description,
    useActualAmount,
    ruleType,
    tiers,
  } = req.body;
  const now = new Date().toISOString();
  const normalizedRuleType = ruleType === 'tiered' ? 'tiered' : 'single';

  const db = dbService.getDb();
  try {
    await new Promise((resolve, reject) => {
      db.run(
        `UPDATE per_diem_rules SET costCenter = ?, maxAmount = ?, minHours = ?, minMiles = ?,
          minDistanceFromBase = ?, description = ?, useActualAmount = ?, ruleType = ?, updatedAt = ?
          WHERE id = ?`,
        [
          costCenter,
          maxAmount,
          minHours || 0,
          minMiles || 0,
          minDistanceFromBase || 0,
          description || '',
          useActualAmount ? 1 : 0,
          normalizedRuleType,
          now,
          id,
        ],
        function (err) {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    let savedTiers = [];
    if (normalizedRuleType === 'tiered' && Array.isArray(tiers)) {
      savedTiers = await saveTiersForCostCenter(db, costCenter, tiers);
    } else if (normalizedRuleType === 'single') {
      await saveTiersForCostCenter(db, costCenter, []);
    }

    res.json({
      id,
      costCenter,
      ruleType: normalizedRuleType,
      tiers: savedTiers,
      message: 'Per diem rule updated successfully',
    });
  } catch (err) {
    debugError('Database error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * Delete per diem rule
 */
router.delete('/api/per-diem-rules/:id', (req, res) => {
  const { id } = req.params;
  const db = dbService.getDb();
  db.get('SELECT costCenter FROM per_diem_rules WHERE id = ?', [id], (lookupErr, row) => {
    if (lookupErr) {
      res.status(500).json({ error: lookupErr.message });
      return;
    }
    db.run('DELETE FROM per_diem_rules WHERE id = ?', [id], function (err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      if (row?.costCenter) {
        db.run('DELETE FROM per_diem_tiers WHERE costCenter = ?', [row.costCenter]);
      }
      res.json({ message: 'Per diem rule deleted successfully' });
    });
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

/**
 * List all finance-to-cost-center assignments.
 */
router.get('/api/finance-cost-center-assignments', (req, res) => {
  const db = dbService.getDb();
  db.all(
    `
    SELECT f.financeEmployeeId, e.name, e.preferredName, e.role, f.costCenterName
    FROM finance_cost_center_assignments f
    LEFT JOIN employees e ON e.id = f.financeEmployeeId
    ORDER BY COALESCE(NULLIF(e.preferredName, ''), e.name), f.costCenterName
    `,
    [],
    (err, rows) => {
      if (err) {
        debugError('❌ Error fetching finance assignments:', err);
        return res.status(500).json({ error: err.message });
      }
      const grouped = {};
      (rows || []).forEach((row) => {
        if (!grouped[row.financeEmployeeId]) {
          grouped[row.financeEmployeeId] = {
            financeEmployeeId: row.financeEmployeeId,
            financeEmployeeName: row.preferredName || row.name || 'Finance user',
            costCenters: [],
          };
        }
        grouped[row.financeEmployeeId].costCenters.push(row.costCenterName);
      });
      return res.json(Object.values(grouped));
    }
  );
});

/**
 * Get assignments for one finance user.
 */
router.get('/api/finance-cost-center-assignments/:financeEmployeeId', (req, res) => {
  const { financeEmployeeId } = req.params;
  const db = dbService.getDb();
  db.all(
    'SELECT costCenterName FROM finance_cost_center_assignments WHERE financeEmployeeId = ? ORDER BY costCenterName',
    [financeEmployeeId],
    (err, rows) => {
      if (err) {
        debugError('❌ Error fetching finance assignments for user:', err);
        return res.status(500).json({ error: err.message });
      }
      db.get('SELECT COUNT(1) AS count FROM finance_cost_center_assignments', [], (countErr, countRow) => {
        if (countErr) {
          debugError('❌ Error counting finance assignments:', countErr);
          return res.status(500).json({ error: countErr.message });
        }
        return res.json({
          financeEmployeeId,
          costCenters: (rows || []).map((r) => r.costCenterName),
          hasAnyAssignments: Number(countRow?.count || 0) > 0,
        });
      });
    }
  );
});

/**
 * Replace assignments for one finance user.
 */
router.put('/api/finance-cost-center-assignments/:financeEmployeeId', (req, res) => {
  const { financeEmployeeId } = req.params;
  const inputCostCenters = Array.isArray(req.body?.costCenters) ? req.body.costCenters : [];
  const db = dbService.getDb();
  const now = new Date().toISOString();
  const idBase = Date.now().toString(36);

  db.all('SELECT name FROM cost_centers', [], (ccErr, costCenterRows) => {
    if (ccErr) {
      debugError('❌ Error loading cost centers for assignment validation:', ccErr);
      return res.status(500).json({ error: ccErr.message });
    }
    const canonicalMap = new Map();
    (costCenterRows || []).forEach((row) => {
      canonicalMap.set(normalizeCostCenter(row.name), row.name);
    });

    const dedupedCanonical = [];
    const seen = new Set();
    inputCostCenters.forEach((raw) => {
      const canonical = canonicalMap.get(normalizeCostCenter(raw));
      if (canonical && !seen.has(canonical)) {
        seen.add(canonical);
        dedupedCanonical.push(canonical);
      }
    });

    db.serialize(() => {
      db.run('BEGIN TRANSACTION');
      db.run(
        'DELETE FROM finance_cost_center_assignments WHERE financeEmployeeId = ?',
        [financeEmployeeId],
        (deleteErr) => {
          if (deleteErr) {
            db.run('ROLLBACK');
            debugError('❌ Error clearing existing finance assignments:', deleteErr);
            return res.status(500).json({ error: deleteErr.message });
          }

          if (dedupedCanonical.length === 0) {
            db.run('COMMIT');
            return res.json({ financeEmployeeId, costCenters: [] });
          }

          let pending = dedupedCanonical.length;
          let failed = false;
          dedupedCanonical.forEach((costCenterName, idx) => {
            db.run(
              'INSERT INTO finance_cost_center_assignments (id, financeEmployeeId, costCenterName, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?)',
              [`fcca-${idBase}-${idx}`, financeEmployeeId, costCenterName, now, now],
              (insertErr) => {
                if (failed) return;
                if (insertErr) {
                  failed = true;
                  db.run('ROLLBACK');
                  debugError('❌ Error saving finance assignment:', insertErr);
                  return res.status(500).json({ error: insertErr.message });
                }
                pending -= 1;
                if (pending === 0) {
                  db.run('COMMIT');
                  return res.json({ financeEmployeeId, costCenters: dedupedCanonical });
                }
              }
            );
          });
        }
      );
    });
  });
});

module.exports = router;

