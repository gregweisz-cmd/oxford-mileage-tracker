const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('expense_tracker.db');

db.all('SELECT DISTINCT category FROM receipts WHERE category IS NOT NULL AND category != "" LIMIT 20', [], (err, rows) => {
  if (err) {
    console.error('Error:', err);
  } else {
    console.log('Receipt categories found:');
    rows.forEach(r => console.log('  -', r.category));
  }
  db.close();
});

