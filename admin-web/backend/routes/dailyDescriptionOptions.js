/**
 * Daily Description Options API
 * Dropdown options for daily work descriptions (Hours & Description screen, report grid).
 * GET is public (mobile + web). Create/Update/Delete are admin-only.
 */

const express = require('express');
const router = express.Router();
const dbService = require('../services/dbService');
const { debugLog, debugError } = require('../debug');

const DEFAULT_OPTIONS = [
  { label: 'Telework from Base Address', category: 'Work location', sortOrder: 0 },
  { label: 'Staff Meeting', category: 'Meetings & Events', sortOrder: 10 },
  { label: 'Staff Training', category: 'Meetings & Events', sortOrder: 11 },
  { label: 'World Convention', category: 'Meetings & Events', sortOrder: 12 },
  { label: 'State Convention', category: 'Meetings & Events', sortOrder: 13 },
  { label: 'Workshop', category: 'Meetings & Events', sortOrder: 14 },
  { label: 'Site visit', category: 'Field work', sortOrder: 20 },
  { label: 'Community outreach', category: 'Field work', sortOrder: 21 },
  { label: 'Other', category: 'Other', sortOrder: 999 },
];

/**
 * GET /api/daily-description-options
 * List all options (ordered by sortOrder, then label). Public - used by mobile and web.
 * Seeds defaults if table is empty.
 */
router.get('/api/daily-description-options', (req, res) => {
  const db = dbService.getDb();
  db.all('SELECT * FROM daily_description_options ORDER BY sortOrder ASC, label ASC', [], (err, rows) => {
    if (err) {
      debugError('Error fetching daily description options:', err);
      return res.status(500).json({ error: err.message });
    }
    if (rows.length > 0) {
      return res.json(rows);
    }
    const now = new Date().toISOString();
    let inserted = 0;
    const total = DEFAULT_OPTIONS.length;
    DEFAULT_OPTIONS.forEach((d, i) => {
      const id = `ddo-default-${i + 1}`;
      db.run(
        'INSERT INTO daily_description_options (id, label, category, sortOrder, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)',
        [id, d.label, d.category || '', d.sortOrder, now, now],
        function (insertErr) {
          if (insertErr) debugError('Error seeding daily description option:', insertErr);
          inserted++;
          if (inserted >= total) {
            db.all('SELECT * FROM daily_description_options ORDER BY sortOrder ASC, label ASC', [], (e2, rows2) => {
              if (e2) return res.status(500).json({ error: e2.message });
              debugLog('Seeded default daily description options');
              res.json(rows2);
            });
          }
        }
      );
    });
  });
});

/**
 * POST /api/admin/daily-description-options
 */
router.post('/api/admin/daily-description-options', (req, res) => {
  const { label, category, sortOrder } = req.body;
  if (!label || typeof label !== 'string' || !label.trim()) {
    return res.status(400).json({ error: 'label is required' });
  }
  const id = `ddo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const now = new Date().toISOString();
  const db = dbService.getDb();
  db.run(
    'INSERT INTO daily_description_options (id, label, category, sortOrder, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)',
    [id, label.trim(), (category && String(category)) || '', Number(sortOrder) || 0, now, now],
    function (err) {
      if (err) {
        debugError('Error creating daily description option:', err);
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
 * PUT /api/admin/daily-description-options/:id
 */
router.put('/api/admin/daily-description-options/:id', (req, res) => {
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
    `UPDATE daily_description_options SET ${updates.join(', ')} WHERE id = ?`,
    values,
    function (err) {
      if (err) {
        debugError('Error updating daily description option:', err);
        return res.status(500).json({ error: err.message });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Daily description option not found' });
      }
      db.get('SELECT * FROM daily_description_options WHERE id = ?', [id], (getErr, row) => {
        if (getErr || !row) return res.status(500).json({ error: getErr ? getErr.message : 'Not found' });
        res.json(row);
      });
    }
  );
});

/**
 * DELETE /api/admin/daily-description-options/:id
 */
router.delete('/api/admin/daily-description-options/:id', (req, res) => {
  const { id } = req.params;
  const db = dbService.getDb();
  db.run('DELETE FROM daily_description_options WHERE id = ?', [id], function (err) {
    if (err) {
      debugError('Error deleting daily description option:', err);
      return res.status(500).json({ error: err.message });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Daily description option not found' });
    }
    res.json({ message: 'Daily description option deleted' });
  });
});

module.exports = router;
