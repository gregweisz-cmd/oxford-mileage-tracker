const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, 'expense_tracker.db');
const db = new sqlite3.Database(DB_PATH);

db.all(`SELECT id, employeeId, date, miles, startLocation, endLocation, isGpsTracked, createdAt 
        FROM mileage_entries 
        WHERE employeeId = 'greg-weisz-001' 
        ORDER BY createdAt DESC 
        LIMIT 10`, 
  (err, rows) => {
    if (err) {
      console.error('❌ Error:', err);
    } else {
      console.log(`\n📊 Recent entries for Greg Weisz: ${rows.length} found\n`);
      console.table(rows);
    }
    db.close();
  }
);

