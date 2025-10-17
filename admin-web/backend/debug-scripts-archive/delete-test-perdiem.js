const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, '..', '..', 'oxford_tracker.db');
const db = new sqlite3.Database(DB_PATH);

console.log('🗑️ Deleting test Per Diem receipts...');

db.run(
  `DELETE FROM receipts WHERE category = 'Per Diem' AND vendor = 'Testing per diem rules again' AND employeeId = 'greg-weisz-001'`,
  function(err) {
    if (err) {
      console.error('❌ Error:', err.message);
    } else {
      console.log(`✅ Deleted ${this.changes} duplicate Per Diem receipts`);
    }
    db.close();
  }
);

