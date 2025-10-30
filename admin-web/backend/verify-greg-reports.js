const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('expense_tracker.db');

db.all(
  'SELECT mr.*, e.name as employeeName FROM monthly_reports mr JOIN employees e ON mr.employeeId = e.id WHERE e.supervisorId = "greg-weisz-001" AND mr.status = "submitted"',
  (err, rows) => {
    if (err) {
      console.error('Error:', err);
    } else {
      console.log('✅ Reports visible to Greg:', rows.length);
      rows.forEach(r => {
        console.log(`  - ${r.employeeName}: ${r.miles || 0} miles, $${r.totalExpenses || 0} expenses (Status: ${r.status})`);
      });
    }
    db.close();
  }
);

