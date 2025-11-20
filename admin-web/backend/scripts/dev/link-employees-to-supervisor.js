const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('expense_tracker.db');

db.run(
  `UPDATE employees 
   SET supervisorId = 'greg-weisz-001' 
   WHERE id IN ('jackson-longan-001', 'kathleen-gibson-001', 'alex-szary-001')`,
  function(err) {
    if (err) {
      console.error('Error:', err);
    } else {
      console.log('✅ Linked employees to Greg Weisz as supervisor');
      console.log(`Updated ${this.changes} employee records`);
    }
    db.close();
  }
);

