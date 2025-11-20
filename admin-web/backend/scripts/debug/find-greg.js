const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('expense_tracker.db');

db.all(
  "SELECT id, name, email, supervisorId FROM employees WHERE name LIKE '%Greg%' OR name LIKE '%Goose%' OR email LIKE '%greg%'",
  (err, rows) => {
    if (err) {
      console.error('Error:', err);
    } else {
      console.log('Found employees:');
      console.log(JSON.stringify(rows, null, 2));
    }
    db.close();
  }
);

