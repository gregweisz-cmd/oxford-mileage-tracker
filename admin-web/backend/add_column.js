const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('../../oxford_tracker.db');

db.run('ALTER TABLE employees ADD COLUMN baseAddress2 TEXT DEFAULT ""', (err) => {
  if (err) {
    console.error('Error adding column:', err);
  } else {
    console.log('Successfully added baseAddress2 column');
  }
  db.close();
});
