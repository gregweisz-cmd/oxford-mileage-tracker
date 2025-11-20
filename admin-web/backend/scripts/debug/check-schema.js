const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('expense_tracker.db');

db.all('PRAGMA table_info(mileage_entries)', [], (err, rows) => {
  if (err) {
    console.error('Error:', err);
  } else {
    console.log('mileage_entries columns:');
    rows.forEach(row => {
      console.log(`  - ${row.name} (${row.type})`);
    });
  }
  
  db.all('PRAGMA table_info(time_tracking)', [], (err, rows) => {
    if (err) {
      console.error('Error:', err);
    } else {
      console.log('\ntime_tracking columns:');
      rows.forEach(row => {
        console.log(`  - ${row.name} (${row.type})`);
      });
    }
    db.close();
  });
});

