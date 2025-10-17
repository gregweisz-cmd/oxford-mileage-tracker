const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', '..', 'oxford_tracker.db');
const db = new sqlite3.Database(dbPath);

console.log('🔧 Fixing Greg Weisz cost center data...\n');

// Update Greg Weisz to set selectedCostCenters and defaultCostCenter
db.run(
  `UPDATE employees 
   SET selectedCostCenters = ?, 
       defaultCostCenter = ? 
   WHERE email = ?`,
  [
    JSON.stringify(['Program Services', 'Finance', 'CORPORATE']),
    'Program Services',
    'greg.weisz@oxfordhouse.org'
  ],
  function(err) {
    if (err) {
      console.error('❌ Error updating:', err);
    } else {
      console.log(`✅ Updated ${this.changes} employee record(s)`);
      
      // Verify the update
      db.get(
        'SELECT id, name, costCenters, selectedCostCenters, defaultCostCenter FROM employees WHERE email = ?',
        ['greg.weisz@oxfordhouse.org'],
        (err, row) => {
          if (err) {
            console.error('Error verifying:', err);
          } else {
            console.log('\n📊 Verified data:');
            console.log('Employee:', row.name);
            console.log('Cost Centers:', row.costCenters);
            console.log('Selected Cost Centers:', row.selectedCostCenters);
            console.log('Default Cost Center:', row.defaultCostCenter);
          }
          
          db.close();
        }
      );
    }
  }
);

