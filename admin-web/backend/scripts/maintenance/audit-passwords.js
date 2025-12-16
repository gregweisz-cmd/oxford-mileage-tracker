/**
 * Audit Passwords Script
 * 
 * Scans the database to identify:
 * - Employees with plain text passwords (security risk)
 * - Employees with hashed passwords (secure)
 * - Employees with no password
 * 
 * Usage:
 *   node scripts/maintenance/audit-passwords.js
 */

const dbService = require('../../services/dbService');
const { debugLog, debugError } = require('../../debug');

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
 * Audit passwords in database
 */
function auditPasswords() {
  return new Promise((resolve, reject) => {
    const db = dbService.getDb();
    
    debugLog('🔍 Auditing passwords in database...');
    
    db.all('SELECT id, email, name, password FROM employees ORDER BY name', [], (err, employees) => {
      if (err) {
        debugError('❌ Error fetching employees:', err);
        reject(err);
        return;
      }

      const results = {
        total: employees.length,
        hashed: [],
        plainText: [],
        empty: []
      };

      employees.forEach(employee => {
        if (!employee.password || employee.password.trim().length === 0) {
          results.empty.push({
            id: employee.id,
            name: employee.name,
            email: employee.email
          });
        } else if (isHashed(employee.password)) {
          results.hashed.push({
            id: employee.id,
            name: employee.name,
            email: employee.email
          });
        } else {
          results.plainText.push({
            id: employee.id,
            name: employee.name,
            email: employee.email,
            passwordLength: employee.password.length
          });
        }
      });

      // Print results
      console.log('\n' + '='.repeat(70));
      console.log('PASSWORD AUDIT RESULTS');
      console.log('='.repeat(70));
      console.log(`Total employees: ${results.total}`);
      console.log(`✅ Hashed passwords: ${results.hashed.length}`);
      console.log(`⚠️  Plain text passwords: ${results.plainText.length}`);
      console.log(`❌ Empty passwords: ${results.empty.length}`);
      console.log('='.repeat(70));

      if (results.plainText.length > 0) {
        console.log('\n⚠️  SECURITY WARNING: Plain text passwords found!\n');
        console.log('Employees with plain text passwords:');
        results.plainText.forEach((emp, index) => {
          console.log(`  ${index + 1}. ${emp.name} (${emp.email}) - Password length: ${emp.passwordLength}`);
        });
        console.log('\n💡 Run migration script to hash these passwords:');
        console.log('   node scripts/maintenance/migrate-plain-text-passwords.js --dry-run');
        console.log('   node scripts/maintenance/migrate-plain-text-passwords.js');
      } else {
        console.log('\n✅ All passwords are properly hashed!\n');
      }

      if (results.empty.length > 0) {
        console.log('\n⚠️  Employees with empty passwords:');
        results.empty.forEach((emp, index) => {
          console.log(`  ${index + 1}. ${emp.name} (${emp.email})`);
        });
      }

      console.log('\n' + '='.repeat(70) + '\n');

      resolve(results);
    });
  });
}

/**
 * Main function
 */
async function main() {
  try {
    // Ensure database is initialized
    await dbService.initDatabase();
    const results = await auditPasswords();
    
    // Exit with error code if plain text passwords found
    if (results.plainText.length > 0) {
      process.exit(1);
    }
    
    process.exit(0);
  } catch (error) {
    debugError('❌ Audit failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { auditPasswords, isHashed };

