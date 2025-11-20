// Migration script to hash existing plain text passwords
// Run this once to convert all existing passwords to hashed passwords

require('dotenv').config();
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'expense_tracker.db');

// Hash password using bcrypt
async function hashPassword(password) {
  const saltRounds = 10;
  return await bcrypt.hash(password, saltRounds);
}

// Check if password is already hashed
function isHashed(password) {
  if (!password || typeof password !== 'string') {
    return false;
  }
  return password.startsWith('$2a$') || password.startsWith('$2b$') || password.startsWith('$2y$');
}

async function migratePasswords() {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(DB_PATH, (err) => {
      if (err) {
        console.error('❌ Error connecting to database:', err.message);
        return reject(err);
      }
      console.log('✅ Connected to database');
    });

    // Get all employees with passwords
    db.all('SELECT id, name, email, password FROM employees WHERE password IS NOT NULL AND password != ""', async (err, employees) => {
      if (err) {
        console.error('❌ Error fetching employees:', err.message);
        db.close();
        return reject(err);
      }

      console.log(`\n📊 Found ${employees.length} employees with passwords`);
      console.log('🔄 Starting password migration...\n');

      let migrated = 0;
      let alreadyHashed = 0;
      let failed = 0;

      // Process each employee
      for (const employee of employees) {
        try {
          // Check if password is already hashed
          if (isHashed(employee.password)) {
            console.log(`✓ Employee ${employee.name} (${employee.email}) - Password already hashed`);
            alreadyHashed++;
            continue;
          }

          // Hash the plain text password
          const hashedPassword = await hashPassword(employee.password);

          // Update the database
          await new Promise((resolveUpdate, rejectUpdate) => {
            db.run(
              'UPDATE employees SET password = ? WHERE id = ?',
              [hashedPassword, employee.id],
              function(updateErr) {
                if (updateErr) {
                  console.error(`❌ Error updating password for ${employee.name}:`, updateErr.message);
                  failed++;
                  rejectUpdate(updateErr);
                } else {
                  console.log(`✅ Migrated password for ${employee.name} (${employee.email})`);
                  migrated++;
                  resolveUpdate();
                }
              }
            );
          });
        } catch (error) {
          console.error(`❌ Error processing employee ${employee.name}:`, error.message);
          failed++;
        }
      }

      db.close((closeErr) => {
        if (closeErr) {
          console.error('❌ Error closing database:', closeErr.message);
        }

        console.log('\n' + '='.repeat(60));
        console.log('📊 Migration Summary:');
        console.log('='.repeat(60));
        console.log(`✅ Migrated: ${migrated}`);
        console.log(`✓ Already hashed: ${alreadyHashed}`);
        console.log(`❌ Failed: ${failed}`);
        console.log(`📊 Total processed: ${employees.length}`);
        console.log('='.repeat(60) + '\n');

        if (failed > 0) {
          console.log('⚠️  Some passwords failed to migrate. Please review the errors above.');
          resolve({ migrated, alreadyHashed, failed, total: employees.length });
        } else {
          console.log('✅ Password migration completed successfully!');
          resolve({ migrated, alreadyHashed, failed, total: employees.length });
        }
      });
    });
  });
}

// Run migration
if (require.main === module) {
  migratePasswords()
    .then((result) => {
      process.exit(result.failed > 0 ? 1 : 0);
    })
    .catch((error) => {
      console.error('❌ Migration failed:', error);
      process.exit(1);
    });
}

module.exports = { migratePasswords };

