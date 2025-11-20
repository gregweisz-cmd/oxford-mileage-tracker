#!/usr/bin/env node
/**
 * Update All Employee Passwords (Except Greg Weisz)
 * 
 * Sets all employee passwords to the pattern: (Firstname)welcome1
 * Example: "Jackson" -> "Jacksonwelcome1"
 * 
 * Greg Weisz is excluded from this update.
 * 
 * Usage:
 *   node scripts/maintenance/update-all-passwords.js [--dry-run]
 * 
 * Options:
 *   --dry-run: Show what would be changed without actually updating
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');

// Get database path
const dbPath = path.join(__dirname, '..', '..', 'expense_tracker.db');

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

/**
 * Extract first name from full name
 * @param {string} fullName - Full name (e.g., "Jackson Longan" or "Greg Weisz")
 * @returns {string} - First name (e.g., "Jackson" or "Greg")
 */
function getFirstName(fullName) {
  if (!fullName || typeof fullName !== 'string') {
    return '';
  }
  return fullName.trim().split(' ')[0];
}

/**
 * Generate password from first name
 * @param {string} firstName - First name
 * @returns {string} - Password in format: (Firstname)welcome1
 */
function generatePassword(firstName) {
  if (!firstName) {
    return 'welcome1'; // Fallback
  }
  return `${firstName}welcome1`;
}

function updatePasswords() {
  const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE, (err) => {
    if (err) {
      log(`Error opening database: ${err.message}`, 'error');
      log(`Database path: ${dbPath}`, 'info');
      process.exit(1);
    }

    log('Fetching all employees...', 'step');
    
    // Get all employees except Greg Weisz
    db.all(
      "SELECT id, name, email FROM employees WHERE id != 'greg-weisz-001' AND email != 'greg.weisz@oxfordhouse.org'",
      [],
      async (err, employees) => {
        if (err) {
          log(`Database error: ${err.message}`, 'error');
          db.close();
          process.exit(1);
        }

        if (!employees || employees.length === 0) {
          log('No employees found (excluding Greg Weisz)', 'warning');
          db.close();
          process.exit(0);
        }

        log(`Found ${employees.length} employees to update`, 'info');
        log('', 'info');

        let updatedCount = 0;
        let skippedCount = 0;
        const errors = [];

        // Process each employee
        for (const employee of employees) {
          const firstName = getFirstName(employee.name);
          const newPassword = generatePassword(firstName);
          
          if (dryRun) {
            log(`Would update: ${employee.name} (${employee.email})`, 'info');
            log(`  Password: ${newPassword}`, 'info');
            updatedCount++;
            continue;
          }

          // Hash the password
          try {
            const saltRounds = 10;
            const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

            // Update password in database
            db.run(
              'UPDATE employees SET password = ? WHERE id = ?',
              [hashedPassword, employee.id],
              function(updateErr) {
                if (updateErr) {
                  errors.push({
                    employee: employee.name,
                    error: updateErr.message
                  });
                  log(`Error updating ${employee.name}: ${updateErr.message}`, 'error');
                  skippedCount++;
                } else {
                  log(`✅ Updated: ${employee.name} (${employee.email}) -> Password: ${newPassword}`, 'success');
                  updatedCount++;
                }
              }
            );
          } catch (hashErr) {
            errors.push({
              employee: employee.name,
              error: `Password hashing error: ${hashErr.message}`
            });
            log(`Error hashing password for ${employee.name}: ${hashErr.message}`, 'error');
            skippedCount++;
          }
        }

        if (dryRun) {
          log('', 'info');
          log(`Dry run complete: Would update ${updatedCount} employees`, 'success');
          log('Run without --dry-run to apply changes', 'info');
          db.close();
          process.exit(0);
        }

        // Wait a moment for all async operations to complete
        setTimeout(() => {
          log('', 'info');
          log(`✅ Update complete!`, 'success');
          log(`   Updated: ${updatedCount} employees`, 'info');
          if (skippedCount > 0) {
            log(`   Skipped: ${skippedCount} employees (errors)`, 'warning');
          }
          
          if (errors.length > 0) {
            log('', 'info');
            log('Errors encountered:', 'warning');
            errors.forEach(err => {
              log(`   ${err.employee}: ${err.error}`, 'error');
            });
          }

          log('', 'info');
          log('Password format: (Firstname)welcome1', 'info');
          log('Example: "Jackson" -> "Jacksonwelcome1"', 'info');
          
          db.close((closeErr) => {
            if (closeErr) {
              log(`Warning: Error closing database: ${closeErr.message}`, 'warning');
            }
            process.exit(0);
          });
        }, 1000);
      }
    );
  });
}

// Run the script
log('🚀 Update All Employee Passwords', 'step');
log('Greg Weisz will be excluded from this update', 'info');
if (dryRun) {
  log('DRY RUN MODE - No changes will be made', 'warning');
}
log('', 'info');

updatePasswords();

