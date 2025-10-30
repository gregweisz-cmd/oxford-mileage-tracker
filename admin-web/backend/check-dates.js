const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('expense_tracker.db');

// Find Greg's ID
db.get('SELECT id, name FROM employees WHERE name LIKE "%Greg%" OR email LIKE "%greg%" LIMIT 1', [], (err, emp) => {
  if (err || !emp) {
    console.log('Employee not found');
    db.close();
    return;
  }
  
  console.log(`Found employee: ${emp.name} (${emp.id})`);
  
  // Check mileage entries
  db.all('SELECT date, costCenter, miles FROM mileage_entries WHERE employeeId = ? AND costCenter = "Program Services" LIMIT 5', [emp.id], (err, rows) => {
    if (err) {
      console.error('Error:', err);
    } else {
      console.log('\nMileage entries:');
      rows.forEach(row => {
        console.log(`  Date: ${row.date} (parsed day: ${row.date.split('/')[1]})`);
        console.log(`  Cost Center: ${row.costCenter}, Miles: ${row.miles}`);
      });
    }
    
    // Check time tracking
    db.all('SELECT date, costCenter, hours, description FROM time_tracking WHERE employeeId = ? AND costCenter = "Program Services" LIMIT 5', [emp.id], (err, rows) => {
      if (err) {
        console.error('Error:', err);
      } else {
        console.log('\nTime tracking entries:');
        rows.forEach(row => {
          console.log(`  Date: ${row.date} (parsed day: ${row.date.split('/')[1]})`);
          console.log(`  Cost Center: ${row.costCenter}, Hours: ${row.hours}`);
        });
      }
      db.close();
    });
  });
});

