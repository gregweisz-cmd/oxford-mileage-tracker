const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('expense_tracker.db');

db.get(
  `SELECT mr.*, e.name, e.email 
   FROM monthly_reports mr 
   JOIN employees e ON mr.employeeId = e.id 
   WHERE mr.id = "test-report-1761575123840-0"`,
  (err, row) => {
    if (err) {
      console.error('Error:', err);
    } else {
      console.log('Report owner:');
      console.log(JSON.stringify(row, null, 2));
    }
    db.close();
  }
);

