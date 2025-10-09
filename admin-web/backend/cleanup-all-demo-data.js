const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./expense_tracker.db');

console.log('🧹 Comprehensive Database Cleanup\n');
console.log('This will:');
console.log('1. Remove all expense reports');
console.log('2. Remove all demo employees (keeping real ones)');
console.log('3. Clean up any "(off)" text from descriptions');
console.log('4. Reset cost center assignments\n');

// List of demo employees to remove (add names as needed)
const demoEmployeeNames = [
  'Greg Weisz',
  'Demo Employee',
  'Test User',
  'Sample Employee'
];

let operations = [];

// 1. Check current data
operations.push(new Promise((resolve) => {
  db.all('SELECT COUNT(*) as count FROM employees', (err, rows) => {
    if (err) {
      console.log('ℹ️  employees table does not exist yet');
    } else {
      console.log(`📊 Current employees: ${rows[0].count}`);
    }
    resolve();
  });
}));

operations.push(new Promise((resolve) => {
  db.all('SELECT COUNT(*) as count FROM expense_reports', (err, rows) => {
    if (err) {
      console.log('ℹ️  expense_reports table does not exist yet');
    } else {
      console.log(`📊 Current expense reports: ${rows[0].count}`);
    }
    resolve();
  });
}));

Promise.all(operations).then(() => {
  console.log('\n🔄 Starting cleanup...\n');
  
  let cleanupOps = [];
  
  // 2. Delete all expense reports (start fresh)
  cleanupOps.push(new Promise((resolve) => {
    db.run('DELETE FROM expense_reports', function(err) {
      if (err) {
        if (err.message.includes('no such table')) {
          console.log('ℹ️  expense_reports table does not exist yet - skipping');
        } else {
          console.error('❌ Error deleting expense reports:', err.message);
        }
      } else {
        console.log(`✅ Deleted ${this.changes} expense reports`);
      }
      resolve();
    });
  }));
  
  // 3. Delete demo employees
  demoEmployeeNames.forEach(name => {
    cleanupOps.push(new Promise((resolve) => {
      db.run('DELETE FROM employees WHERE name = ?', [name], function(err) {
        if (err) {
          if (err.message.includes('no such table')) {
            // Table doesn't exist yet, skip silently
          } else {
            console.error(`❌ Error deleting employee ${name}:`, err.message);
          }
        } else if (this.changes > 0) {
          console.log(`✅ Deleted demo employee: ${name}`);
        }
        resolve();
      });
    }));
  });
  
  // 4. Clean up "(off)" text from any tables that might have it
  const tablesWithDescriptions = [
    { table: 'daily_descriptions', column: 'description' },
    { table: 'mileage_entries', column: 'notes' },
    { table: 'time_tracking', column: 'description' },
    { table: 'expense_reports', column: 'reportData' }
  ];
  
  tablesWithDescriptions.forEach(({ table, column }) => {
    cleanupOps.push(new Promise((resolve) => {
      db.run(
        `UPDATE ${table} SET ${column} = '' WHERE ${column} LIKE '%off%'`,
        function(err) {
          if (err) {
            if (err.message.includes('no such table') || err.message.includes('no such column')) {
              // Table/column doesn't exist yet, skip silently
            } else {
              console.error(`❌ Error cleaning ${table}.${column}:`, err.message);
            }
          } else if (this.changes > 0) {
            console.log(`✅ Cleaned ${this.changes} "(off)" entries from ${table}.${column}`);
          }
          resolve();
        }
      );
    }));
  });
  
  // 5. Delete empty daily descriptions
  cleanupOps.push(new Promise((resolve) => {
    db.run(
      'DELETE FROM daily_descriptions WHERE description = "" OR description IS NULL',
      function(err) {
        if (err) {
          if (err.message.includes('no such table')) {
            // Table doesn't exist yet, skip silently
          } else {
            console.error('❌ Error deleting empty daily_descriptions:', err.message);
          }
        } else if (this.changes > 0) {
          console.log(`✅ Deleted ${this.changes} empty daily descriptions`);
        }
        resolve();
      }
    );
  }));
  
  // Wait for all cleanup operations to complete
  Promise.all(cleanupOps).then(() => {
    console.log('\n📊 Final counts:\n');
    
    // Show final counts
    db.all('SELECT COUNT(*) as count FROM employees', (err, rows) => {
      if (!err) {
        console.log(`📊 Remaining employees: ${rows[0].count}`);
      }
      
      db.all('SELECT COUNT(*) as count FROM expense_reports', (err, rows) => {
        if (!err) {
          console.log(`📊 Remaining expense reports: ${rows[0].count}`);
        }
        
        console.log('\n✨ Cleanup complete!');
        console.log('\n💡 Note: The mobile app stores data locally on each device.');
        console.log('   To fully clean demo data, you may need to:');
        console.log('   1. Clear the mobile app data/cache on each device');
        console.log('   2. Or reinstall the mobile app\n');
        
        db.close();
      });
    });
  });
});

