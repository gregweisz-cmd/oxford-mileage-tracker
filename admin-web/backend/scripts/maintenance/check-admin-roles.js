#!/usr/bin/env node
/**
 * Check Admin Roles
 * 
 * Checks if specific employees have admin role/position
 * 
 * Usage:
 *   node scripts/maintenance/check-admin-roles.js
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Get database path
const dbPath = path.join(__dirname, '..', '..', 'expense_tracker.db');

// Employees to check
const employeesToCheck = [
  'Crystal Wood',
  'Kosal Dao',
  'Alexandra Mulvey',
  'Andrea Kissack',
  'Kelyne Moore',
  'Leann Tyler'
];

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

function checkAdminRoles() {
  const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
    if (err) {
      log(`Error opening database: ${err.message}`, 'error');
      log(`Database path: ${dbPath}`, 'info');
      process.exit(1);
    }

    log('Checking admin roles for employees...', 'step');
    log('', 'info');

    let foundCount = 0;
    let adminCount = 0;
    let nonAdminCount = 0;

    // Check each employee
    employeesToCheck.forEach((name, index) => {
      const query = 'SELECT id, name, email, position FROM employees WHERE name = ?';
      
      db.get(query, [name], (err, employee) => {
        if (err) {
          log(`Error querying for ${name}: ${err.message}`, 'error');
          return;
        }

        if (employee) {
          foundCount++;
          const isAdmin = employee.position && (
            employee.position.toLowerCase().includes('admin') ||
            employee.position === 'Admin' ||
            employee.position === 'Administrator'
          );

          if (isAdmin) {
            adminCount++;
            log(`✅ ${employee.name}`, 'success');
            log(`   Email: ${employee.email}`, 'info');
            log(`   Position: ${employee.position}`, 'success');
            log(`   Status: ADMIN ✓`, 'success');
          } else {
            nonAdminCount++;
            log(`⚠️  ${employee.name}`, 'warning');
            log(`   Email: ${employee.email}`, 'info');
            log(`   Position: ${employee.position || '(not set)'}`, 'warning');
            log(`   Status: NOT ADMIN ✗`, 'warning');
          }
        } else {
          log(`❌ ${name} - NOT FOUND in database`, 'error');
        }

        log('', 'info');

        // When all checks are done
        if (index === employeesToCheck.length - 1) {
          setTimeout(() => {
            log('', 'info');
            log('Summary:', 'step');
            log(`   Total checked: ${employeesToCheck.length}`, 'info');
            log(`   Found in database: ${foundCount}`, 'info');
            log(`   Admin role: ${adminCount}`, 'success');
            log(`   Non-admin role: ${nonAdminCount}`, nonAdminCount > 0 ? 'warning' : 'info');
            log(`   Not found: ${employeesToCheck.length - foundCount}`, 'info');

            if (nonAdminCount > 0) {
              log('', 'info');
              log('⚠️  Some employees do NOT have admin role!', 'warning');
              log('   Please update their position to "Admin" in the Employee Management interface.', 'info');
            } else if (adminCount === foundCount && foundCount === employeesToCheck.length) {
              log('', 'info');
              log('✅ All employees have admin role!', 'success');
            }

            db.close((closeErr) => {
              if (closeErr) {
                log(`Warning: Error closing database: ${closeErr.message}`, 'warning');
              }
              process.exit(0);
            });
          }, 500);
        }
      });
    });
  });
}

// Run the check
checkAdminRoles();

