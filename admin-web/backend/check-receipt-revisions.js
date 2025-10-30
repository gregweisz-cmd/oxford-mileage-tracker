const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('expense_tracker.db');

db.all(
  'SELECT id, vendor, description, needsRevision, revisionReason FROM receipts WHERE employeeId="mh96jo4qry67z3hn41"',
  (err, rows) => {
    if (err) {
      console.error('Error:', err);
    } else {
      console.log('Receipts for Jackson:');
      console.log(JSON.stringify(rows, null, 2));
    }
    db.close();
  }
);

