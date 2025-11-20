const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('expense_tracker.db');

const testEmployees = [
  { id: 'mh96jo4qry67z3hn41', name: 'Jackson Longan' },
  { id: 'mh96jpno84imsnxfupl', name: 'Kathleen Gibson' }
];

const gregSupervisorId = 'greg-weisz-001';

testEmployees.forEach(emp => {
  db.run(
    'UPDATE employees SET supervisorId = ? WHERE id = ?',
    [gregSupervisorId, emp.id],
    function(err) {
      if (err) {
        console.error(`Error updating ${emp.name}:`, err);
      } else {
        console.log(`✅ ${emp.name} supervisor set to Greg Weisz`);
      }
    }
  );
});

// Check for any reports by these employees
setTimeout(() => {
  db.all(
    "SELECT mr.id, mr.employeeId, e.name, mr.month, mr.year, mr.status FROM monthly_reports mr JOIN employees e ON mr.employeeId = e.id WHERE mr.employeeId IN (?, ?)",
    [testEmployees[0].id, testEmployees[1].id],
    (err, reports) => {
      if (err) {
        console.error('Error checking reports:', err);
      } else {
        console.log(`\n📊 Monthly reports by test employees: ${reports.length}`);
        reports.forEach(r => console.log(`  - ${r.name}: ${r.status} (${r.month}/${r.year})`));
      }
      db.close();
    }
  );
}, 500);

