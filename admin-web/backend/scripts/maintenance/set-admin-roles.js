#!/usr/bin/env node
/**
 * Set Admin Roles
 * 
 * Sets specific employees to Admin role/position
 * 
 * Usage:
 *   node scripts/maintenance/set-admin-roles.js [--dry-run]
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Get database path
const dbPath = path.join(__dirname, '..', '..', 'expense_tracker.db');

// Employees to set as admin
const employeesToSetAdmin = [
  'Crystal Wood',
  'Kosal Dao',
  'Alexandra Mulvey',
  'Andrea Kissack',
  'Kelyne Moore',
  'Leann Tyler'
];

// Get command line arguments
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');

function log(message, type = 'info') {
  const prefix = {
    info: '📝',
    success: '✅',
    error: '❌',
    warning: '⚠️',
    step: '🚀'
  }[type] || '📝';
  console.log(`${prefix} ${message}`);
}

function setAdminRoles() {
  const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE, (err) => {
    if (err) {
      log(`Error opening database: ${err.message}`, 'error');
      log(`Database path: ${dbPath}`, 'info');
      process.exit(1);
    }

    log('Setting admin roles for employees...', 'step');
    if (dryRun) {
      log('DRY RUN MODE - No changes will be made', 'warning');
    }
    log('', 'info');

    let updatedCount = 0;
    let skippedCount = 0;
    const errors = [];

    // Update each employee
    employeesToSetAdmin.forEach((name, index) => {
      const query = 'SELECT id, name, email, position FROM employees WHERE name = ?';
      
      db.get(query, [name], (err, employee) => {
        if (err) {
          errors.push({ name, error: err.message });
          log(`Error querying for ${name}: ${err.message}`, 'error');
          skippedCount++;
          return;
        }

        if (!employee) {
          errors.push({ name, error: 'Employee not found' });
          log(`❌ ${name} - NOT FOUND in database`, 'error');
          skippedCount++;
          return;
        }

        if (dryRun) {
          log(`Would update: ${employee.name}`, 'info');
          log(`   Email: ${employee.email}`, 'info');
          log(`   Current Position: ${employee.position}`, 'info');
          log(`   New Position: Admin`, 'success');
          updatedCount++;
        } else {
          // Update position to Admin
          const now = new Date().toISOString();
          db.run(
            'UPDATE employees SET position = ?, updatedAt = ? WHERE id = ?',
            ['Admin', now, employee.id],
            function(updateErr) {
              if (updateErr) {
                errors.push({ name: employee.name, error: updateErr.message });
                log(`Error updating ${employee.name}: ${updateErr.message}`, 'error');
                skippedCount++;
              } else {
                log(`✅ Updated: ${employee.name}`, 'success');
                log(`   Email: ${employee.email}`, 'info');
                log(`   Position: ${employee.position} → Admin`, 'success');
                updatedCount++;
              }
            }
          );
        }

        log('', 'info');

        // When all checks are done
        if (index === employeesToSetAdmin.length - 1) {
          setTimeout(() => {
            log('', 'info');
            log('Summary:', 'step');
            log(`   Total employees: ${employeesToSetAdmin.length}`, 'info');
            log(`   Updated: ${updatedCount}`, 'success');
            log(`   Skipped/Errors: ${skippedCount}`, skippedCount > 0 ? 'warning' : 'info');

            if (errors.length > 0) {
              log('', 'info');
              log('Errors:', 'warning');
              errors.forEach(err => {
                log(`   ${err.name}: ${err.error}`, 'error');
              });
            }

            if (dryRun) {
              log('', 'info');
              log('Dry run complete. Run without --dry-run to apply changes.', 'info');
            } else {
              log('', 'info');
              log('✅ All employees updated to Admin role!', 'success');
            }

            db.close((closeErr) => {
              if (closeErr) {
                log(`Warning: Error closing database: ${closeErr.message}`, 'warning');
              }
              process.exit(0);
            });
          }, 1000);
        }
      });
    });
  });
}

// Run the update
setAdminRoles();

