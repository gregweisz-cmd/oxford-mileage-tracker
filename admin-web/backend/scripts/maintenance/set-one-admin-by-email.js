#!/usr/bin/env node
/**
 * Set one employee's login role to admin by email.
 * Use after a restore when an admin account lost its role.
 *
 * Usage (from admin-web/backend):
 *   node scripts/maintenance/set-one-admin-by-email.js [email]
 *
 * Examples:
 *   node scripts/maintenance/set-one-admin-by-email.js
 *   node scripts/maintenance/set-one-admin-by-email.js greg.weisz@oxfordhouse.org
 *
 * Uses DATABASE_PATH env var if set (e.g. on Render); otherwise expense_tracker.db in backend.
 */

const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const BACKEND_ROOT = path.join(__dirname, '../..');
const dbPath = process.env.DATABASE_PATH || path.join(BACKEND_ROOT, 'expense_tracker.db');
const defaultEmail = 'greg.weisz@oxfordhouse.org';
const email = (process.argv[2] || defaultEmail).trim().toLowerCase();

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
    console.error('Path:', dbPath);
    process.exit(1);
  }
});

db.get('SELECT id, name, email, role FROM employees WHERE LOWER(TRIM(email)) = ?', [email], (err, row) => {
  if (err) {
    console.error('Error looking up employee:', err.message);
    db.close();
    process.exit(1);
  }
  if (!row) {
    console.error('No employee found with email:', email);
    db.close();
    process.exit(1);
  }
  const now = new Date().toISOString();
  db.run(
    'UPDATE employees SET role = ?, updatedAt = ? WHERE id = ?',
    ['admin', now, row.id],
    function (updateErr) {
      if (updateErr) {
        console.error('Error updating role:', updateErr.message);
        db.close();
        process.exit(1);
      }
      console.log('Updated:', row.name, `(${row.email})`);
      console.log('  role:', row.role || '(empty)', '→ admin');
      console.log('  Rows updated:', this.changes);
      db.close();
    }
  );
});
