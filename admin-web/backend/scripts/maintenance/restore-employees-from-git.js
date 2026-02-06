/**
 * Restore employees from the last committed database in git (or from a backup file).
 * Use this after accidentally deleting all employees (e.g. bulk delete).
 *
 * Usage (from admin-web/backend):
 *   node scripts/maintenance/restore-employees-from-git.js [commit]
 *   node scripts/maintenance/restore-employees-from-git.js --from-file <path-to-backup.db>
 *
 * Examples:
 *   node scripts/maintenance/restore-employees-from-git.js
 *   node scripts/maintenance/restore-employees-from-git.js b32a162
 *   node scripts/maintenance/restore-employees-from-git.js --from-file ./backup.db
 *
 * Backup sources:
 * - Git: git show b32a162:admin-web/backend/expense_tracker.db > backup.db (from repo root)
 * - Render: restore the persistent disk to a snapshot in Render Dashboard → Disks → Snapshots (full disk restore), or download a snapshot/DB copy and use --from-file.
 *
 * Then restore into current DB:
 *   set DATABASE_PATH=C:\path\to\expense_tracker.db  (optional; default is backend/expense_tracker.db)
 *   node scripts/maintenance/restore-employees-from-git.js --from-file backup.db
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const sqlite3 = require('sqlite3').verbose();

// Repo root from admin-web/backend/scripts/maintenance
const BACKEND_ROOT = path.join(__dirname, '../..');
const REPO_ROOT = path.join(BACKEND_ROOT, '../..');
const DEFAULT_COMMIT = 'b32a162';
const DB_REL_PATH = 'admin-web/backend/expense_tracker.db';

const currentDbPath = process.env.DATABASE_PATH || path.join(BACKEND_ROOT, 'expense_tracker.db');

function getBackupDbPathFromGit(commit) {
  const backupPath = path.join(__dirname, `employees-backup-${commit}.db`);
  if (fs.existsSync(backupPath)) {
    try {
      fs.unlinkSync(backupPath);
    } catch (_) {}
  }
  execSync(`git show ${commit}:${DB_REL_PATH} > "${backupPath}"`, {
    cwd: REPO_ROOT,
    stdio: 'inherit',
    shell: true,
  });
  return backupPath;
}

function run() {
  const args = process.argv.slice(2);
  const fromFileIdx = args.indexOf('--from-file');
  let backupPathToUse;

  if (fromFileIdx >= 0 && args[fromFileIdx + 1]) {
    backupPathToUse = path.resolve(args[fromFileIdx + 1]);
    if (!fs.existsSync(backupPathToUse)) {
      console.error('Backup file not found:', backupPathToUse);
      process.exit(1);
    }
    console.log('Restoring employees from backup file:', backupPathToUse);
  } else {
    const commit = args[0] || DEFAULT_COMMIT;
    console.log('Restoring employees from git commit', commit);
    try {
      backupPathToUse = getBackupDbPathFromGit(commit);
    } catch (e) {
      console.error('Failed to get backup DB from git:', e.message);
      console.error('Try: git show b32a162:admin-web/backend/expense_tracker.db > backup.db');
      console.error('Then: node scripts/maintenance/restore-employees-from-git.js --from-file backup.db');
      process.exit(1);
    }
  }

  console.log('Current DB path:', currentDbPath);
  if (!fs.existsSync(currentDbPath)) {
    console.error('Current database file not found:', currentDbPath);
    process.exit(1);
  }

  const backupDb = new sqlite3.Database(backupPathToUse, sqlite3.OPEN_READONLY, (err) => {
    if (err) {
      console.error('Failed to open backup DB:', err.message);
      process.exit(1);
    }
  });

  backupDb.all('PRAGMA table_info(employees)', [], (pragmaErr, columns) => {
    if (pragmaErr) {
      console.error('PRAGMA table_info failed:', pragmaErr.message);
      backupDb.close();
      process.exit(1);
    }
    const colNames = columns.map((c) => c.name);
    backupDb.all('SELECT * FROM employees', [], (selErr, rows) => {
      if (selErr) {
        console.error('SELECT employees failed:', selErr.message);
        backupDb.close();
        process.exit(1);
      }
      backupDb.close();
      // Remove temp backup only if we created it (from git), not when user passed --from-file
      if (fromFileIdx < 0) {
        try { fs.unlinkSync(backupPathToUse); } catch (_) {}
      }

      if (!rows || rows.length === 0) {
        console.log('No employees in backup. Nothing to restore.');
        process.exit(0);
      }

      console.log('Found', rows.length, 'employees in backup. Inserting into current DB...');

      const currentDb = new sqlite3.Database(currentDbPath, (err) => {
        if (err) {
          console.error('Failed to open current DB:', err.message);
          process.exit(1);
        }
      });

      const placeholders = colNames.map(() => '?').join(', ');
      const sql = `INSERT OR REPLACE INTO employees (${colNames.join(', ')}) VALUES (${placeholders})`;
      let done = 0;
      rows.forEach((row, i) => {
        const values = colNames.map((c) => row[c] ?? null);
        currentDb.run(sql, values, (runErr) => {
          if (runErr) {
            console.error('Insert failed for row', i, runErr.message);
          }
          done++;
          if (done === rows.length) {
            console.log('Restored', rows.length, 'employees.');
            currentDb.close();
            process.exit(0);
          }
        });
      });
    });
  });
}

run();
