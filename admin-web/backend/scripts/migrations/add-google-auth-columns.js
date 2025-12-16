/**
 * Database Migration: Add Google OAuth Columns
 * 
 * Adds the following columns to the employees table:
 * - googleId (TEXT) - Stores Google user ID
 * - authProvider (TEXT) - Values: 'local', 'google', or 'both'
 * - emailVerified (INTEGER) - 1 if verified via Google, 0 otherwise
 * 
 * Also creates an index on googleId for faster lookups.
 * 
 * Usage:
 *   cd admin-web/backend
 *   node scripts/migrations/add-google-auth-columns.js
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Database path (same as dbService.js)
const DB_PATH = path.join(__dirname, '..', '..', 'expense_tracker.db');

console.log('🔧 Google OAuth Migration Script');
console.log('================================');
console.log(`Database path: ${DB_PATH}`);
console.log('');

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('❌ Error opening database:', err.message);
    process.exit(1);
  }
  console.log('✅ Connected to database');
});

db.serialize(() => {
  // Check current table structure
  db.all('PRAGMA table_info(employees)', [], (err, columns) => {
    if (err) {
      console.error('❌ Error reading table info:', err.message);
      db.close();
      process.exit(1);
      return;
    }

    const columnNames = columns.map(col => col.name);
    console.log(`📊 Current employees table has ${columns.length} columns`);
    console.log('');

    // Add googleId column
    if (!columnNames.includes('googleId')) {
      console.log('➕ Adding googleId column...');
      db.run(`ALTER TABLE employees ADD COLUMN googleId TEXT DEFAULT NULL`, (alterErr) => {
        if (alterErr && !alterErr.message.includes('duplicate column')) {
          console.error('❌ Error adding googleId column:', alterErr.message);
        } else {
          console.log('✅ Added googleId column');
        }
      });
    } else {
      console.log('⏭️  googleId column already exists');
    }

    // Add authProvider column
    if (!columnNames.includes('authProvider')) {
      console.log('➕ Adding authProvider column...');
      db.run(`ALTER TABLE employees ADD COLUMN authProvider TEXT DEFAULT 'local'`, (alterErr) => {
        if (alterErr && !alterErr.message.includes('duplicate column')) {
          console.error('❌ Error adding authProvider column:', alterErr.message);
        } else {
          console.log('✅ Added authProvider column');
        }
      });
    } else {
      console.log('⏭️  authProvider column already exists');
    }

    // Add emailVerified column
    if (!columnNames.includes('emailVerified')) {
      console.log('➕ Adding emailVerified column...');
      db.run(`ALTER TABLE employees ADD COLUMN emailVerified INTEGER DEFAULT 0`, (alterErr) => {
        if (alterErr && !alterErr.message.includes('duplicate column')) {
          console.error('❌ Error adding emailVerified column:', alterErr.message);
        } else {
          console.log('✅ Added emailVerified column');
        }
      });
    } else {
      console.log('⏭️  emailVerified column already exists');
    }

    // Wait a moment for ALTER TABLE operations to complete
    setTimeout(() => {
      // Create index on googleId for faster lookups
      console.log('');
      console.log('📇 Creating index on googleId...');
      db.run(`CREATE INDEX IF NOT EXISTS idx_employees_googleId ON employees(googleId)`, (indexErr) => {
        if (indexErr) {
          console.error('❌ Error creating index:', indexErr.message);
        } else {
          console.log('✅ Created index on googleId');
        }

        // Verify final structure
        console.log('');
        console.log('🔍 Verifying final table structure...');
        db.all('PRAGMA table_info(employees)', [], (verifyErr, finalColumns) => {
          if (verifyErr) {
            console.error('❌ Error verifying table structure:', verifyErr.message);
          } else {
            console.log(`✅ Final table structure: ${finalColumns.length} columns`);
            const newColumns = finalColumns.filter(col => 
              ['googleId', 'authProvider', 'emailVerified'].includes(col.name)
            );
            if (newColumns.length > 0) {
              console.log('');
              console.log('New columns:');
              newColumns.forEach(col => {
                console.log(`  - ${col.name}: ${col.type} (default: ${col.dflt_value || 'NULL'})`);
              });
            }
          }

          console.log('');
          console.log('✅ Migration complete!');
          console.log('');
          console.log('Next steps:');
          console.log('  1. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables');
          console.log('  2. Configure Google Cloud Console OAuth credentials');
          console.log('  3. Update backend routes/auth.js (already done if you ran the implementation)');
          console.log('  4. Test Google OAuth login');
          console.log('');

          db.close((closeErr) => {
            if (closeErr) {
              console.error('❌ Error closing database:', closeErr.message);
              process.exit(1);
            } else {
              console.log('✅ Database connection closed');
              process.exit(0);
            }
          });
        });
      });
    }, 500);
  });
});

