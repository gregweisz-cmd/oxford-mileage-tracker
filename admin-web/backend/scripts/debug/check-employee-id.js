const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('expense_tracker.db');

// Check what employeeId format is used
db.get('SELECT id FROM employees WHERE name LIKE "%Greg%" LIMIT 1', [], (err, emp) => {
  if (err || !emp) {
    console.log('Employee not found');
    db.close();
    return;
  }
  
  console.log('Employee ID:', emp.id);
  
  // Check expense report
  db.get('SELECT id, reportData FROM expense_reports LIMIT 1', [], (err, report) => {
    if (err || !report) {
      console.log('No report found');
      db.close();
      return;
    }
    
    try {
      const reportData = JSON.parse(report.reportData);
      console.log('\nReport employeeId:', reportData.employeeId);
      console.log('Report month:', reportData.month);
      console.log('Report year:', reportData.year);
    } catch (e) {
      console.error('Error parsing report:', e);
    }
    
    db.close();
  });
});

