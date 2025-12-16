/**
 * Migrate Plain Text Passwords to bcrypt Hashes
 * 
 * This script audits the database for plain text passwords and hashes them.
 * Plain text passwords are detected by checking if they don't start with bcrypt hash prefix.
 * 
 * Usage:
 *   node scripts/maintenance/migrate-plain-text-passwords.js [--dry-run]
 * 
 * Options:
 *   --dry-run    Show what would be migrated without actually changing passwords
 */

const dbService = require('../../services/dbService');
const helpers = require('../../utils/helpers');
const { debugLog, debugError, debugWarn } = require('../../debug');

const isDryRun = process.argv.includes('--dry-run');

/**
 * Check if a password is hashed (bcrypt)
 */
function isHashed(password) {
  if (!password || password.length === 0) {
    return false;
  }
  // Bcrypt hashes start with $2a$, $2b$, or $2y$
  return password.startsWith('$2a$') || password.startsWith('$2b$') || password.startsWith('$2y$');
}

/**
 * Migrate plain text passwords to bcrypt hashes
 */
async function migratePasswords() {
  try {
    const db = dbService.getDb();
    
    debugLog('🔍 Scanning database for plain text passwords...');
    
    // Get all employees
    return new Promise((resolve, reject) => {
      db.all('SELECT id, email, name, password FROM employees', [], async (err, employees) => {
        if (err) {
          debugError('❌ Error fetching employees:', err);
          reject(err);
          return;
        }

        const plainTextPasswords = [];
        let migratedCount = 0;
        let skippedCount = 0;
        let errorCount = 0;

        for (const employee of employees) {
          if (!employee.password || employee.password.trim().length === 0) {
            skippedCount++;
            continue;
          }

          // Check if password is already hashed
          if (isHashed(employee.password)) {
            skippedCount++;
            continue;
          }

          // This is a plain text password
          plainTextPasswords.push({
            id: employee.id,
            email: employee.email,
            name: employee.name,
            currentPassword: employee.password
          });

          if (!isDryRun) {
            try {
              // Hash the password
              const hashedPassword = await helpers.hashPassword(employee.password);
              
              // Update in database
              await new Promise((resolveUpdate, rejectUpdate) => {
                db.run(
                  'UPDATE employees SET password = ?, updatedAt = ? WHERE id = ?',
                  [hashedPassword, new Date().toISOString(), employee.id],
                  (updateErr) => {
                    if (updateErr) {
                      rejectUpdate(updateErr);
                    } else {
                      resolveUpdate();
                    }
                  }
                );
              });

              migratedCount++;
              debugLog(`✅ Migrated password for: ${employee.name} (${employee.email})`);
            } catch (error) {
              errorCount++;
              debugError(`❌ Failed to migrate password for ${employee.name}:`, error.message);
            }
          } else {
            migratedCount++;
            debugLog(`[DRY RUN] Would migrate password for: ${employee.name} (${employee.email})`);
          }
        }

        // Summary
        console.log('\n' + '='.repeat(60));
        console.log('PASSWORD MIGRATION SUMMARY');
        console.log('='.repeat(60));
        console.log(`Total employees scanned: ${employees.length}`);
        console.log(`Plain text passwords found: ${plainTextPasswords.length}`);
        console.log(`Already hashed: ${skippedCount}`);
        
        if (isDryRun) {
          console.log(`Would migrate: ${migratedCount}`);
          console.log('\n⚠️  DRY RUN MODE - No changes made');
        } else {
          console.log(`Successfully migrated: ${migratedCount}`);
          console.log(`Errors: ${errorCount}`);
        }
        
        if (plainTextPasswords.length > 0) {
          console.log('\nPlain text passwords found:');
          plainTextPasswords.forEach((emp, index) => {
            console.log(`  ${index + 1}. ${emp.name} (${emp.email})`);
          });
        }
        
        console.log('='.repeat(60) + '\n');

        if (isDryRun) {
          console.log('Run without --dry-run to actually migrate passwords.');
        } else if (migratedCount > 0) {
          console.log('✅ Password migration completed successfully!');
        } else {
          console.log('ℹ️  No plain text passwords found. All passwords are already hashed.');
        }

        resolve({
          total: employees.length,
          plainText: plainTextPasswords.length,
          migrated: migratedCount,
          skipped: skippedCount,
          errors: errorCount,
          employees: plainTextPasswords
        });
      });
    });
  } catch (error) {
    debugError('❌ Migration failed:', error);
    throw error;
  }
}

/**
 * Main function
 */
async function main() {
  try {
    // Ensure database is initialized
    await dbService.initDatabase();
    
    if (isDryRun) {
      console.log('🔍 DRY RUN MODE - No changes will be made\n');
    }
    
    await migratePasswords();
    process.exit(0);
  } catch (error) {
    debugError('❌ Script failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { migratePasswords, isHashed };

