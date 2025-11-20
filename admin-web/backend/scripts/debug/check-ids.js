const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('expense_tracker.db');

// Check for greg-weisz-001
db.get("SELECT id, name, email FROM employees WHERE id = 'greg-weisz-001'", (err, row) => {
  if (err) {
    console.error('Error:', err);
  } else {
    if (row) {
      console.log('Found greg-weisz-001:', row);
    } else {
      console.log('greg-weisz-001 not found. Creating...');
      
      // Create greg-weisz-001 if it doesn't exist
      db.run(
        `INSERT INTO employees (id, name, email, password, oxfordHouseId, position, phoneNumber, baseAddress, costCenters, selectedCostCenters, defaultCostCenter, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          'greg-weisz-001',
          'Greg Weisz',
          'greg.weisz@oxfordhouse.org',
          'ImtheBoss5!',
          'OH-001',
          'Supervisor',
          '555-0101',
          'Main Office',
          '["Program Services"]',
          '["Program Services"]',
          'Program Services',
          new Date().toISOString(),
          new Date().toISOString()
        ],
        function(err) {
          if (err) {
            console.error('Error creating greg-weisz-001:', err);
          } else {
            console.log('✅ Created greg-weisz-001 successfully');
          }
          db.close();
        }
      );
    }
  }
});

