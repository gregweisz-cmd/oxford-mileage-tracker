#!/usr/bin/env node
/**
 * Reset User Setup Wizard
 * 
 * Resets the setup wizard state for a user so they see the setup wizard
 * on their next login (acts like first login).
 * 
 * Usage:
 *   node scripts/maintenance/reset-user-setup-wizard.js <employeeId|email>
 * 
 * Examples:
 *   node scripts/maintenance/reset-user-setup-wizard.js greg-weisz-001
 *   node scripts/maintenance/reset-user-setup-wizard.js greg@example.com
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Get database path - script is in scripts/maintenance/, database is in backend root
const dbPath = path.join(__dirname, '..', '..', 'expense_tracker.db');

// Get employee ID or email from command line
const identifier = process.argv[2];

if (!identifier) {
  console.error('❌ Error: Employee ID or email required');
  console.log('\nUsage: node scripts/maintenance/reset-user-setup-wizard.js <employeeId|email>');
  console.log('\nExamples:');
  console.log('  node scripts/maintenance/reset-user-setup-wizard.js greg-weisz-001');
  console.log('  node scripts/maintenance/reset-user-setup-wizard.js greg@example.com');
  process.exit(1);
}

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

function resetSetupWizard(identifier) {
  // Open database connection
  const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE, (err) => {
    if (err) {
      log(`Error opening database: ${err.message}`, 'error');
      log(`Database path: ${dbPath}`, 'info');
      process.exit(1);
    }

    log('Looking up employee...', 'step');
    
    // Try to find employee by ID or email
    const query = identifier.includes('@') 
      ? 'SELECT * FROM employees WHERE email = ?'
      : 'SELECT * FROM employees WHERE id = ?';
    
    db.get(query, [identifier], (err, employee) => {
      if (err) {
        log(`Database error: ${err.message}`, 'error');
        db.close();
        process.exit(1);
      }

      if (!employee) {
        log(`Employee not found: ${identifier}`, 'error');
        log('Please check the employee ID or email and try again.', 'info');
        db.close();
        process.exit(1);
      }

      log(`Found employee: ${employee.name} (${employee.email})`, 'success');
      log(`Current state:`, 'info');
      log(`  hasCompletedSetupWizard: ${employee.hasCompletedSetupWizard || 0}`, 'info');
      log(`  hasCompletedOnboarding: ${employee.hasCompletedOnboarding || 0}`, 'info');

      // Reset both fields to 0 (not completed)
      log('\nResetting setup wizard state...', 'step');
      
      db.run(
        'UPDATE employees SET hasCompletedSetupWizard = 0, hasCompletedOnboarding = 0, updatedAt = ? WHERE id = ?',
        [new Date().toISOString(), employee.id],
        function(err) {
          if (err) {
            log(`Database error: ${err.message}`, 'error');
            db.close();
            process.exit(1);
          }

          log('✅ Setup wizard state reset successfully!', 'success');
          log(`\nEmployee "${employee.name}" will see the setup wizard on their next login.`, 'info');
          log(`\nTo verify:`, 'info');
          log(`  1. Log out and log back in as this user`, 'info');
          log(`  2. The setup wizard should appear`, 'info');
          log(`  3. Or check with: node scripts/debug/check-setup-wizard.js`, 'info');
          
          db.close((closeErr) => {
            if (closeErr) {
              log(`Warning: Error closing database: ${closeErr.message}`, 'warning');
            }
            process.exit(0);
          });
        }
      );
    });
  });
}

// Run the script
resetSetupWizard(identifier);

