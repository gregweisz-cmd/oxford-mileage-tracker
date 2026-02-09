#!/usr/bin/env node
/**
 * List all employees matching an email or name search (to check for duplicates).
 * Useful when phone and web seem to be "different" people with the same name.
 *
 * Usage (from admin-web/backend):
 *   node scripts/maintenance/list-employees-by-email.js [email-or-name]
 *
 * Examples:
 *   node scripts/maintenance/list-employees-by-email.js greg.weisz@oxfordhouse.org
 *   node scripts/maintenance/list-employees-by-email.js greg
 *
 * Uses DATABASE_PATH env var if set.
 */

const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const BACKEND_ROOT = path.join(__dirname, '../..');
const dbPath = process.env.DATABASE_PATH || path.join(BACKEND_ROOT, 'expense_tracker.db');
const search = (process.argv[2] || '').trim();

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
    process.exit(1);
  }
});

const run = () => {
  if (!search) {
    console.error('Usage: node list-employees-by-email.js <email-or-name>');
    db.close();
    process.exit(1);
  }
  const term = `%${search.toLowerCase()}%`;
  db.all(
    `SELECT id, name, email, position, role, archived, createdAt FROM employees
     WHERE LOWER(TRIM(email)) LIKE ? OR LOWER(name) LIKE ? OR LOWER(preferredName) LIKE ?
     ORDER BY archived, name`,
    [term, term, term],
    (err, rows) => {
      if (err) {
        console.error('Error:', err.message);
        db.close();
        process.exit(1);
      }
      if (rows.length === 0) {
        console.log('No employees found matching:', search);
        db.close();
        return;
      }
      console.log('Employees matching', JSON.stringify(search), `(${rows.length}):\n`);
      rows.forEach((r) => {
        console.log('  id:', r.id);
        console.log('  name:', r.name);
        console.log('  email:', r.email);
        console.log('  position:', r.position);
        console.log('  role:', r.role || '(empty)');
        console.log('  archived:', r.archived ? 'yes' : 'no');
        console.log('  createdAt:', r.createdAt);
        console.log('');
      });
      const emails = rows.map((r) => (r.email || '').toLowerCase().trim()).filter(Boolean);
      if (emails.length !== new Set(emails).size) {
        console.log('⚠️  Multiple rows share the same email – consider merging or archiving duplicates.');
      }
      db.close();
    }
  );
};

run();
