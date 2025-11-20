const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, 'expense_tracker.db');
const db = new sqlite3.Database(DB_PATH);

db.get(`
  SELECT 
    e.name,
    e.preferredName,
    COALESCE(NULLIF(e.preferredName, ''), e.name) as employeeName
  FROM employees e
  WHERE e.id = 'greg-weisz-001'
`, (err, row) => {
  if (err) {
    console.error('Error:', err);
  } else {
    console.log('Employee name data:');
    console.log(JSON.stringify(row, null, 2));
  }
  db.close();
});

