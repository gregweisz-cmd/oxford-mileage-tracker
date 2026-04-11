/**
 * Contract / cost-center monthly caps and supervisor team utilization
 */

const express = require('express');
const router = express.Router();
const dbService = require('../services/dbService');
const helpers = require('../utils/helpers');
const { debugError, debugLog } = require('../debug');

function monthRange(year, month) {
  const y = parseInt(String(year), 10);
  const mo = parseInt(String(month), 10);
  const start = `${y}-${String(mo).padStart(2, '0')}-01`;
  const lastDay = new Date(y, mo, 0).getDate();
  const end = `${y}-${String(mo).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  return { start, end };
}

function collectCostCentersFromRow(row) {
  const s = new Set();
  helpers.parseJsonSafe(row.costCenters, []).forEach((c) => {
    const t = String(c || '').trim();
    if (t) s.add(t);
  });
  helpers.parseJsonSafe(row.selectedCostCenters, []).forEach((c) => {
    const t = String(c || '').trim();
    if (t) s.add(t);
  });
  if (row.defaultCostCenter) {
    const t = String(row.defaultCostCenter).trim();
    if (t) s.add(t);
  }
  return s;
}

function canEditContractBudgets(employee) {
  if (!employee) return false;
  const role = String(employee.role || '').toLowerCase();
  const pos = String(employee.position || '').toLowerCase();
  if (role.includes('admin') || role.includes('ceo')) return true;
  if (pos.includes('admin') || pos.includes('ceo')) return true;
  if (role.includes('contracts')) return true;
  if (pos.includes('contract')) return true;
  return false;
}

/** Cost centers assigned to any direct report of this supervisor */
router.get('/api/supervisors/:supervisorId/team-cost-centers', (req, res) => {
  const { supervisorId } = req.params;
  const db = dbService.getDb();
  db.all(
    `SELECT costCenters, selectedCostCenters, defaultCostCenter FROM employees
     WHERE supervisorId = ? AND (archived IS NULL OR archived = 0)`,
    [supervisorId],
    (err, rows) => {
      if (err) {
        debugError('team-cost-centers:', err);
        return res.status(500).json({ error: err.message });
      }
      const union = new Set();
      (rows || []).forEach((row) => {
        collectCostCentersFromRow(row).forEach((c) => union.add(c));
      });
      res.json({ costCenters: Array.from(union).sort((a, b) => a.localeCompare(b)) });
    }
  );
});

/**
 * Monthly utilization for one cost center across the supervisor's direct team only.
 * Query: costCenter, year, month (1-12)
 */
router.get('/api/supervisors/:supervisorId/cost-center-utilization', (req, res) => {
  const { supervisorId } = req.params;
  const { costCenter, year, month } = req.query;
  const y = parseInt(String(year), 10);
  const mo = parseInt(String(month), 10);
  const cc = String(costCenter || '').trim();

  if (!cc || !Number.isFinite(y) || !Number.isFinite(mo) || mo < 1 || mo > 12) {
    return res.status(400).json({ error: 'costCenter, year, and month (1-12) are required' });
  }

  const db = dbService.getDb();
  const { start, end } = monthRange(y, mo);

  db.all(
    `SELECT id, costCenters, selectedCostCenters, defaultCostCenter FROM employees
     WHERE supervisorId = ? AND (archived IS NULL OR archived = 0)`,
    [supervisorId],
    (err, teamRows) => {
      if (err) {
        debugError('cost-center-utilization team:', err);
        return res.status(500).json({ error: err.message });
      }

      const allowed = new Set();
      (teamRows || []).forEach((row) => {
        collectCostCentersFromRow(row).forEach((c) => allowed.add(c));
      });
      if (!allowed.has(cc)) {
        return res.status(403).json({ error: 'That cost center is not used by any of your direct reports' });
      }

      const ids = (teamRows || []).map((r) => r.id).filter(Boolean);
      if (ids.length === 0) {
        return res.json(emptyUtilization(cc, y, mo, 0));
      }

      const ph = ids.map(() => '?').join(',');
      const baseParams = [...ids, start, end, cc];

      db.get(
        `SELECT COALESCE(SUM(miles), 0) AS totalMiles, COUNT(*) AS mileageTripCount
         FROM mileage_entries
         WHERE employeeId IN (${ph}) AND date >= ? AND date <= ?
         AND TRIM(COALESCE(costCenter, '')) = ?`,
        baseParams,
        (mErr, mileRow) => {
          if (mErr) {
            debugError('mileage rollup:', mErr);
            return res.status(500).json({ error: mErr.message });
          }

          db.get(
            `SELECT COALESCE(SUM(amount), 0) AS total, COUNT(*) AS cnt
             FROM receipts
             WHERE employeeId IN (${ph}) AND date >= ? AND date <= ?
             AND TRIM(COALESCE(costCenter, '')) = ?
             AND category = 'Per Diem'`,
            baseParams,
            (pErr, perDiemRow) => {
              if (pErr) {
                debugError('per diem rollup:', pErr);
                return res.status(500).json({ error: pErr.message });
              }

              db.get(
                `SELECT COALESCE(SUM(amount), 0) AS total, COUNT(*) AS cnt
                 FROM receipts
                 WHERE employeeId IN (${ph}) AND date >= ? AND date <= ?
                 AND TRIM(COALESCE(costCenter, '')) = ?
                 AND (category IS NULL OR TRIM(category) != 'Per Diem')`,
                baseParams,
                (oErr, otherRow) => {
                  if (oErr) {
                    debugError('other receipts rollup:', oErr);
                    return res.status(500).json({ error: oErr.message });
                  }

                  db.get(
                    `SELECT COALESCE(SUM(amount), 0) AS total, COUNT(*) AS cnt
                     FROM receipts
                     WHERE employeeId IN (${ph}) AND date >= ? AND date <= ?
                     AND TRIM(COALESCE(costCenter, '')) = ?`,
                    baseParams,
                    (tErr, allRecRow) => {
                      if (tErr) {
                        debugError('all receipts rollup:', tErr);
                        return res.status(500).json({ error: tErr.message });
                      }

                      db.get(
                        `SELECT * FROM contract_cost_center_budgets WHERE costCenter = ? AND year = ? AND month = ?`,
                        [cc, y, mo],
                        (bErr, budget) => {
                          if (bErr) {
                            debugError('budget fetch:', bErr);
                            return res.status(500).json({ error: bErr.message });
                          }

                          res.json({
                            costCenter: cc,
                            year: y,
                            month: mo,
                            dateRange: { start, end },
                            teamMemberCount: ids.length,
                            totalMiles: Number(mileRow?.totalMiles || 0),
                            mileageTripCount: Number(mileRow?.mileageTripCount || 0),
                            perDiemReceiptTotal: Number(perDiemRow?.total || 0),
                            perDiemReceiptCount: Number(perDiemRow?.cnt || 0),
                            otherReceiptsTotal: Number(otherRow?.total || 0),
                            otherReceiptCount: Number(otherRow?.cnt || 0),
                            totalReceiptsTotal: Number(allRecRow?.total || 0),
                            totalReceiptCount: Number(allRecRow?.cnt || 0),
                            budget: budget || null,
                          });
                        }
                      );
                    }
                  );
                }
              );
            }
          );
        }
      );
    }
  );
});

function emptyUtilization(cc, y, mo, teamCount) {
  const { start, end } = monthRange(y, mo);
  return {
    costCenter: cc,
    year: y,
    month: mo,
    dateRange: { start, end },
    teamMemberCount: teamCount,
    totalMiles: 0,
    mileageTripCount: 0,
    perDiemReceiptTotal: 0,
    perDiemReceiptCount: 0,
    otherReceiptsTotal: 0,
    otherReceiptCount: 0,
    totalReceiptsTotal: 0,
    totalReceiptCount: 0,
    budget: null,
  };
}

/** List budgets for a calendar month (optional costCenter filter) */
router.get('/api/contract-budgets', (req, res) => {
  const y = parseInt(String(req.query.year), 10);
  const mo = parseInt(String(req.query.month), 10);
  const cc = req.query.costCenter != null ? String(req.query.costCenter).trim() : '';

  if (!Number.isFinite(y) || !Number.isFinite(mo) || mo < 1 || mo > 12) {
    return res.status(400).json({ error: 'year and month (1-12) are required' });
  }

  const db = dbService.getDb();
  if (cc) {
    db.get(
      `SELECT * FROM contract_cost_center_budgets WHERE costCenter = ? AND year = ? AND month = ?`,
      [cc, y, mo],
      (err, row) => {
        if (err) {
          debugError('contract-budgets get one:', err);
          return res.status(500).json({ error: err.message });
        }
        res.json({ budgets: row ? [row] : [] });
      }
    );
    return;
  }

  db.all(
    `SELECT * FROM contract_cost_center_budgets WHERE year = ? AND month = ? ORDER BY costCenter`,
    [y, mo],
    (err, rows) => {
      if (err) {
        debugError('contract-budgets list:', err);
        return res.status(500).json({ error: err.message });
      }
      res.json({ budgets: rows || [] });
    }
  );
});

/** Upsert monthly caps for a cost center (contracts / admin) */
router.put('/api/contract-budgets', (req, res) => {
  const {
    requestedByUserId,
    costCenter,
    year,
    month,
    capMiles,
    capPerDiemAmount,
    capReceiptsAmount,
    capReceiptCount,
    notes,
  } = req.body;

  const y = parseInt(String(year), 10);
  const mo = parseInt(String(month), 10);
  const cc = String(costCenter || '').trim();

  if (!requestedByUserId || !cc || !Number.isFinite(y) || !Number.isFinite(mo) || mo < 1 || mo > 12) {
    return res.status(400).json({
      error: 'requestedByUserId, costCenter, year, and month (1-12) are required',
    });
  }

  const db = dbService.getDb();
  db.get('SELECT id, role, position FROM employees WHERE id = ?', [requestedByUserId], (authErr, requester) => {
    if (authErr) {
      debugError('contract-budgets auth:', authErr);
      return res.status(500).json({ error: authErr.message });
    }
    if (!requester) {
      return res.status(404).json({ error: 'User not found' });
    }
    if (!canEditContractBudgets(requester)) {
      return res.status(403).json({ error: 'Only Contracts or Admin users can edit contract caps' });
    }

    const parseOptNum = (v) => {
      if (v === '' || v === undefined || v === null) return null;
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    };
    const parseOptInt = (v) => {
      if (v === '' || v === undefined || v === null) return null;
      const n = parseInt(String(v), 10);
      return Number.isFinite(n) ? n : null;
    };

    const capM = parseOptNum(capMiles);
    const capPD = parseOptNum(capPerDiemAmount);
    const capRA = parseOptNum(capReceiptsAmount);
    const capRC = parseOptInt(capReceiptCount);
    const noteStr = notes != null ? String(notes) : '';

    const now = new Date().toISOString();

    db.get(
      `SELECT id, createdAt FROM contract_cost_center_budgets WHERE costCenter = ? AND year = ? AND month = ?`,
      [cc, y, mo],
      (findErr, existing) => {
        if (findErr) {
          debugError('contract-budgets find:', findErr);
          return res.status(500).json({ error: findErr.message });
        }
        const id =
          existing?.id ||
          `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
        const createdAt = existing?.createdAt || now;

        db.run(
          `INSERT OR REPLACE INTO contract_cost_center_budgets
           (id, costCenter, year, month, capMiles, capPerDiemAmount, capReceiptsAmount, capReceiptCount, notes, createdAt, updatedAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [id, cc, y, mo, capM, capPD, capRA, capRC, noteStr, createdAt, now],
          function (runErr) {
            if (runErr) {
              debugError('contract-budgets upsert:', runErr);
              return res.status(500).json({ error: runErr.message });
            }
            debugLog(`✅ Contract budget saved for ${cc} ${y}-${mo}`);
            res.json({
              id,
              costCenter: cc,
              year: y,
              month: mo,
              capMiles: capM,
              capPerDiemAmount: capPD,
              capReceiptsAmount: capRA,
              capReceiptCount: capRC,
              notes: noteStr,
              updatedAt: now,
            });
          }
        );
      }
    );
  });
});

module.exports = router;
