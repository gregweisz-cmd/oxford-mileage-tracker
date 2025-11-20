const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('expense_tracker.db');

// Find employees with "Jackson", "Kathleen", or "Alex" in their names
db.all("SELECT id, name, email, supervisorId FROM employees WHERE name LIKE '%Jackson%' OR name LIKE '%Kathleen%' OR name LIKE '%Alex%' OR name LIKE '%Longan%' OR name LIKE '%Gibson%' OR name LIKE '%Szary%'", (err, employees) => {
  if (err) {
    console.error('Error:', err);
  } else {
    console.log('Test employees found:');
    employees.forEach(emp => {
      console.log(`${emp.name} (${emp.email}) - ID: ${emp.id}, Supervisor: ${emp.supervisorId || 'None'}`);
    });
  }
  db.close();
});

