const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.join(__dirname, '..', '..', 'expense_tracker.db');
const db = new sqlite3.Database(dbPath);

db.get(
  'SELECT id, name, email, role, position FROM employees WHERE LOWER(name) LIKE "%crystal%wood%" OR LOWER(email) LIKE "%crystal%"',
  [],
  (err, row) => {
    if (err) {
      console.error('❌ Error:', err);
    } else if (row) {
      console.log('✅ Crystal Wood found:');
      console.log('  ID:', row.id);
      console.log('  Name:', row.name);
      console.log('  Email:', row.email);
      console.log('  Role:', row.role || '(null or empty)');
      console.log('  Position:', row.position || '(null or empty)');
      console.log('');
      console.log('🔍 Analysis:');
      if (row.role) {
        console.log(`  - Role field is set to: "${row.role}"`);
      } else {
        console.log('  - Role field is NULL or empty');
      }
      if (row.position) {
        const posLower = row.position.toLowerCase();
        if (posLower.includes('admin')) {
          console.log(`  - Position contains "admin": "${row.position}"`);
          console.log('  ⚠️  This will trigger admin portal assignment!');
        }
        if (posLower.includes('finance') || posLower.includes('accounting')) {
          console.log(`  - Position contains finance/accounting: "${row.position}"`);
        }
      }
    } else {
      console.log('❌ Crystal Wood not found in database');
    }
    db.close();
  }
);


