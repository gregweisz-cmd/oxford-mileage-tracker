const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('expense_tracker.db');

db.get("SELECT id, name, email, password FROM employees WHERE id = 'greg-weisz-001'", (err, row) => {
  if (err) {
    console.error('Error:', err);
  } else {
    console.log('Greg Weisz credentials:');
    console.log('ID:', row.id);
    console.log('Name:', row.name);
    console.log('Email:', row.email);
    console.log('Password:', row.password);
  }
  db.close();
});

