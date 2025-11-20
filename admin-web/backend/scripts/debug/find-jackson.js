const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('expense_tracker.db');

db.all('SELECT id, name, email FROM employees WHERE name LIKE "%Longan%" OR name LIKE "%Jackson Longan%"', (err, rows) => {
  if (err) {
    console.error('Error:', err);
  } else {
    console.log('Jackson\'s credentials:');
    console.log(JSON.stringify(rows, null, 2));
  }
  db.close();
});

