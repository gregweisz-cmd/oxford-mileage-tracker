const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('expense_tracker.db');

db.run(
  "UPDATE employees SET password = 'ImtheBoss5!' WHERE email = 'greg.weisz@oxfordhouse.org'",
  function(err) {
    if (err) {
      console.error('Error updating password:', err);
    } else {
      console.log(`✅ Password updated for Greg Weisz. ${this.changes} row affected.`);
      
      // Verify the update
      db.get(
        "SELECT id, name, email FROM employees WHERE email = 'greg.weisz@oxfordhouse.org'",
        (err, row) => {
          if (err) {
            console.error('Error fetching employee:', err);
          } else {
            console.log('✅ Employee found:', row);
          }
          db.close();
        }
      );
    }
  }
);

