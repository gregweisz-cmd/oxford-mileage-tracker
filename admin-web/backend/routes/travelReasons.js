/**
 * Travel Reasons API
 * Dropdown options for trip purpose on GPS Tracking and Manual Entry.
 * GET is public (mobile + web). Create/Update/Delete are admin-only.
 */

const express = require('express');
const router = express.Router();
const dbService = require('../services/dbService');
const { debugLog, debugError } = require('../debug');

const DEFAULT_TRAVEL_REASONS = [
  { label: 'House Stabilization', category: 'House/Resident Related', sortOrder: 0 },
  { label: 'Donation Pickup', category: 'Donations & Supplies', sortOrder: 10 },
  { label: 'Donation Delivery', category: 'Donations & Supplies', sortOrder: 11 },
  { label: 'Team Meeting', category: 'Meetings & Training', sortOrder: 20 },
  { label: 'Staff Meeting', category: 'Meetings & Training', sortOrder: 21 },
  { label: 'Staff Training', category: 'Meetings & Training', sortOrder: 22 },
  { label: 'Community Outreach', category: 'Meetings & Training', sortOrder: 23 },
  { label: 'Emergency response', category: 'Emergency & Special', sortOrder: 30 },
  { label: 'Crisis intervention', category: 'Emergency & Special', sortOrder: 31 },
  { label: 'Urgent visit', category: 'Emergency & Special', sortOrder: 32 },
  { label: 'Return to base', category: 'Travel & Logistics', sortOrder: 40 },
  { label: 'Travel between locations', category: 'Travel & Logistics', sortOrder: 41 },
  { label: 'Route optimization', category: 'Travel & Logistics', sortOrder: 42 },
  { label: 'Other', category: 'Other', sortOrder: 999 },
];

/**
 * GET /api/travel-reasons
 * List all travel reasons (ordered by sortOrder, then label). Public - used by mobile and web.
 * Seeds default reasons if table is empty.
 */
router.get('/api/travel-reasons', (req, res) => {
  const db = dbService.getDb();
  db.all('SELECT * FROM travel_reasons ORDER BY sortOrder ASC, label ASC', [], (err, rows) => {
    if (err) {
      debugError('Error fetching travel reasons:', err);
      return res.status(500).json({ error: err.message });
    }
    if (rows.length > 0) {
      return res.json(rows);
    }
    // Seed defaults on first use
    const now = new Date().toISOString();
    let inserted = 0;
    const total = DEFAULT_TRAVEL_REASONS.length;
    DEFAULT_TRAVEL_REASONS.forEach((d, i) => {
      const id = `tr-default-${i + 1}`;
      db.run(
        'INSERT INTO travel_reasons (id, label, category, sortOrder, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)',
        [id, d.label, d.category || '', d.sortOrder, now, now],
        function (insertErr) {
          if (insertErr) {
            debugError('Error seeding travel reason:', insertErr);
          }
          inserted++;
          if (inserted >= total) {
            db.all('SELECT * FROM travel_reasons ORDER BY sortOrder ASC, label ASC', [], (e2, rows2) => {
              if (e2) return res.status(500).json({ error: e2.message });
              debugLog('Seeded default travel reasons');
              res.json(rows2);
            });
          }
        }
      );
    });
  });
});

/**
 * POST /api/admin/travel-reasons
 * Create a new travel reason. Admin only (UI is in Admin Portal).
 */
router.post('/api/admin/travel-reasons', (req, res) => {
  const { label, category, sortOrder } = req.body;
  if (!label || typeof label !== 'string' || !label.trim()) {
    return res.status(400).json({ error: 'label is required' });
  }
  const id = `tr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const now = new Date().toISOString();
  const db = dbService.getDb();
  db.run(
    'INSERT INTO travel_reasons (id, label, category, sortOrder, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)',
    [id, label.trim(), (category && String(category)) || '', Number(sortOrder) || 0, now, now],
    function (err) {
      if (err) {
        debugError('Error creating travel reason:', err);
        return res.status(500).json({ error: err.message });
      }
      res.status(201).json({
        id,
        label: label.trim(),
        category: (category && String(category)) || '',
        sortOrder: Number(sortOrder) || 0,
        createdAt: now,
        updatedAt: now,
      });
    }
  );
});

/**
 * PUT /api/admin/travel-reasons/:id
 * Update an existing travel reason.
 */
router.put('/api/admin/travel-reasons/:id', (req, res) => {
  const { id } = req.params;
  const { label, category, sortOrder } = req.body;
  const db = dbService.getDb();
  const updates = [];
  const values = [];
  if (typeof label === 'string') {
    updates.push('label = ?');
    values.push(label.trim());
  }
  if (category !== undefined) {
    updates.push('category = ?');
    values.push(String(category));
  }
  if (typeof sortOrder === 'number' || (typeof sortOrder === 'string' && sortOrder !== '')) {
    updates.push('sortOrder = ?');
    values.push(Number(sortOrder));
  }
  if (updates.length === 0) {
    return res.status(400).json({ error: 'At least one of label, category, sortOrder is required' });
  }
  const now = new Date().toISOString();
  updates.push('updatedAt = ?');
  values.push(now, id);
  db.run(
    `UPDATE travel_reasons SET ${updates.join(', ')} WHERE id = ?`,
    values,
    function (err) {
      if (err) {
        debugError('Error updating travel reason:', err);
        return res.status(500).json({ error: err.message });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Travel reason not found' });
      }
      db.get('SELECT * FROM travel_reasons WHERE id = ?', [id], (getErr, row) => {
        if (getErr || !row) return res.status(500).json({ error: getErr ? getErr.message : 'Not found' });
        res.json(row);
      });
    }
  );
});

/**
 * DELETE /api/admin/travel-reasons/:id
 * Remove a travel reason.
 */
router.delete('/api/admin/travel-reasons/:id', (req, res) => {
  const { id } = req.params;
  const db = dbService.getDb();
  db.run('DELETE FROM travel_reasons WHERE id = ?', [id], function (err) {
    if (err) {
      debugError('Error deleting travel reason:', err);
      return res.status(500).json({ error: err.message });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Travel reason not found' });
    }
    res.json({ message: 'Travel reason deleted' });
  });
});

module.exports = router;
