const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('expense_tracker.db');

// Check if Jackson exists and who their supervisor is
db.get("SELECT id, name, email, supervisorId FROM employees WHERE name LIKE '%Jackson%'", (err, jackson) => {
  if (err) {
    console.error('Error:', err);
  } else {
    console.log('Jackson employee:', jackson);
    
    // Check monthly reports
    db.all("SELECT id, employeeId, month, year, status FROM monthly_reports WHERE employeeId = ?", [jackson.id], (err, reports) => {
      if (err) {
        console.error('Error:', err);
      } else {
        console.log('\nJackson reports:', reports);
      }
      db.close();
    });
  }
});

