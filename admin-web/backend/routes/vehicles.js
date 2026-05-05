const express = require('express');
const router = express.Router();
const dbService = require('../services/dbService');
const { debugError, debugLog } = require('../debug');

function makeVehicleId() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 10);
}

function ensureDefaultVehicle(db, employeeId, callback) {
  const now = new Date().toISOString();
  db.get(
    'SELECT id FROM vehicles WHERE employeeId = ? AND isActive = 1 LIMIT 1',
    [employeeId],
    (checkErr, row) => {
      if (checkErr) return callback(checkErr);
      if (row) return callback(null);

      const id = `veh-${makeVehicleId()}`;
      db.run(
        `INSERT INTO vehicles (id, employeeId, name, plateNumber, startingOdometer, isDefault, isActive, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, 1, 1, ?, ?)`,
        [id, employeeId, 'Vehicle A', '', 0, now, now],
        (insertErr) => callback(insertErr || null)
      );
    }
  );
}

router.get('/api/vehicles', (req, res) => {
  const { employeeId } = req.query;
  if (!employeeId) {
    return res.status(400).json({ error: 'employeeId is required' });
  }
  const db = dbService.getDb();

  ensureDefaultVehicle(db, String(employeeId), (seedErr) => {
    if (seedErr) {
      debugError('Failed to seed default vehicle:', seedErr);
      return res.status(500).json({ error: seedErr.message });
    }

    db.all(
      `SELECT * FROM vehicles
       WHERE employeeId = ? AND isActive = 1
       ORDER BY isDefault DESC, createdAt ASC`,
      [employeeId],
      (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows || []);
      }
    );
  });
});

router.post('/api/vehicles', (req, res) => {
  const { employeeId, name, plateNumber, startingOdometer, isDefault } = req.body || {};
  if (!employeeId || !String(name || '').trim()) {
    return res.status(400).json({ error: 'employeeId and name are required' });
  }
  const parsedStart = Number(startingOdometer);
  if (!Number.isFinite(parsedStart) || parsedStart < 0) {
    return res.status(400).json({ error: 'startingOdometer must be a valid non-negative number' });
  }
  const db = dbService.getDb();
  const now = new Date().toISOString();
  const id = `veh-${makeVehicleId()}`;
  const normalizedName = String(name).trim();
  const normalizedPlate = String(plateNumber || '').trim();
  const shouldDefault = isDefault ? 1 : 0;

  db.serialize(() => {
    db.run('BEGIN TRANSACTION');
    if (shouldDefault) {
      db.run(
        'UPDATE vehicles SET isDefault = 0, updatedAt = ? WHERE employeeId = ?',
        [now, employeeId]
      );
    }
    db.run(
      `INSERT INTO vehicles (id, employeeId, name, plateNumber, startingOdometer, isDefault, isActive, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      [id, employeeId, normalizedName, normalizedPlate, parsedStart, shouldDefault, now, now],
      (err) => {
        if (err) {
          db.run('ROLLBACK');
          return res.status(500).json({ error: err.message });
        }
        db.run('COMMIT');
        res.json({ id, message: 'Vehicle created' });
      }
    );
  });
});

router.put('/api/vehicles/:id', (req, res) => {
  const { id } = req.params;
  const { employeeId, name, plateNumber, startingOdometer, isDefault } = req.body || {};
  if (!employeeId) return res.status(400).json({ error: 'employeeId is required' });
  if (name != null && !String(name).trim()) return res.status(400).json({ error: 'name cannot be empty' });
  if (startingOdometer != null) {
    const parsedStart = Number(startingOdometer);
    if (!Number.isFinite(parsedStart) || parsedStart < 0) {
      return res.status(400).json({ error: 'startingOdometer must be a valid non-negative number' });
    }
  }

  const db = dbService.getDb();
  const now = new Date().toISOString();
  const shouldDefault = isDefault === true;

  db.serialize(() => {
    db.run('BEGIN TRANSACTION');
    if (shouldDefault) {
      db.run(
        'UPDATE vehicles SET isDefault = 0, updatedAt = ? WHERE employeeId = ?',
        [now, employeeId]
      );
    }

    const updates = ['updatedAt = ?'];
    const params = [now];
    if (name != null) {
      updates.push('name = ?');
      params.push(String(name).trim());
    }
    if (plateNumber != null) {
      updates.push('plateNumber = ?');
      params.push(String(plateNumber).trim());
    }
    if (startingOdometer != null) {
      updates.push('startingOdometer = ?');
      params.push(Number(startingOdometer));
    }
    if (isDefault != null) {
      updates.push('isDefault = ?');
      params.push(isDefault ? 1 : 0);
    }
    params.push(id, employeeId);

    db.run(
      `UPDATE vehicles SET ${updates.join(', ')} WHERE id = ? AND employeeId = ? AND isActive = 1`,
      params,
      function(err) {
        if (err) {
          db.run('ROLLBACK');
          return res.status(500).json({ error: err.message });
        }
        if (this.changes === 0) {
          db.run('ROLLBACK');
          return res.status(404).json({ error: 'Vehicle not found' });
        }
        db.run('COMMIT');
        res.json({ message: 'Vehicle updated' });
      }
    );
  });
});

router.put('/api/vehicles/:id/default', (req, res) => {
  const { id } = req.params;
  const { employeeId } = req.body || {};
  if (!employeeId) return res.status(400).json({ error: 'employeeId is required' });
  const db = dbService.getDb();
  const now = new Date().toISOString();

  db.serialize(() => {
    db.run('BEGIN TRANSACTION');
    db.run('UPDATE vehicles SET isDefault = 0, updatedAt = ? WHERE employeeId = ?', [now, employeeId]);
    db.run(
      'UPDATE vehicles SET isDefault = 1, updatedAt = ? WHERE id = ? AND employeeId = ? AND isActive = 1',
      [now, id, employeeId],
      function(err) {
        if (err) {
          db.run('ROLLBACK');
          return res.status(500).json({ error: err.message });
        }
        if (this.changes === 0) {
          db.run('ROLLBACK');
          return res.status(404).json({ error: 'Vehicle not found' });
        }
        db.run('COMMIT');
        res.json({ message: 'Default vehicle updated' });
      }
    );
  });
});

router.delete('/api/vehicles/:id', (req, res) => {
  const { id } = req.params;
  const { employeeId } = req.query;
  if (!employeeId) return res.status(400).json({ error: 'employeeId is required' });
  const db = dbService.getDb();
  const now = new Date().toISOString();

  db.get(
    'SELECT COUNT(*) as count FROM vehicles WHERE employeeId = ? AND isActive = 1',
    [employeeId],
    (countErr, countRow) => {
      if (countErr) return res.status(500).json({ error: countErr.message });
      const activeCount = Number(countRow?.count || 0);
      if (activeCount <= 1) {
        return res.status(400).json({ error: 'At least one active vehicle is required' });
      }

      db.get(
        'SELECT isDefault FROM vehicles WHERE id = ? AND employeeId = ? AND isActive = 1',
        [id, employeeId],
        (getErr, vehicle) => {
          if (getErr) return res.status(500).json({ error: getErr.message });
          if (!vehicle) return res.status(404).json({ error: 'Vehicle not found' });

          db.run(
            'UPDATE vehicles SET isActive = 0, isDefault = 0, updatedAt = ? WHERE id = ? AND employeeId = ?',
            [now, id, employeeId],
            function(updateErr) {
              if (updateErr) return res.status(500).json({ error: updateErr.message });

              if (vehicle.isDefault) {
                db.run(
                  `UPDATE vehicles
                   SET isDefault = 1, updatedAt = ?
                   WHERE id = (
                     SELECT id FROM vehicles
                     WHERE employeeId = ? AND isActive = 1
                     ORDER BY createdAt ASC
                     LIMIT 1
                   )`,
                  [now, employeeId],
                  (defaultErr) => {
                    if (defaultErr) return res.status(500).json({ error: defaultErr.message });
                    debugLog(`Vehicle archived and default reassigned for employee ${employeeId}`);
                    res.json({ message: 'Vehicle archived' });
                  }
                );
                return;
              }

              res.json({ message: 'Vehicle archived' });
            }
          );
        }
      );
    }
  );
});

module.exports = router;
