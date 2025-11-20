const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('expense_tracker.db');

const password = 'Password123!';

db.run(
  'UPDATE employees SET password = ? WHERE name LIKE "%Longan%"',
  [password],
  function(err) {
    if (err) {
      console.error('Error updating password:', err);
    } else {
      console.log('✅ Jackson\'s password has been set to:', password);
      console.log('Updated rows:', this.changes);
    }
    db.close();
  }
);

