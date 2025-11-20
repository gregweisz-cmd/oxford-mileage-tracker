/**
 * Clear All Test Data
 * Removes all test reports, mileage entries, receipts, and time entries
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', '..', 'expense_tracker.db');
const db = new sqlite3.Database(dbPath);

console.log('🗑️  Clearing all test data...\n');

db.serialize(() => {
  db.run('DELETE FROM mileage_entries WHERE id LIKE "mileage-%"', function(err) {
    if (err) console.error('Error deleting mileage entries:', err);
    else console.log(`✅ Deleted ${this.changes} mileage entries`);
  });
  
  db.run('DELETE FROM receipts WHERE id LIKE "receipt-%"', function(err) {
    if (err) console.error('Error deleting receipts:', err);
    else console.log(`✅ Deleted ${this.changes} receipts`);
  });
  
  db.run('DELETE FROM time_tracking WHERE id LIKE "time-%"', function(err) {
    if (err) console.error('Error deleting time entries:', err);
    else console.log(`✅ Deleted ${this.changes} time entries`);
  });
  
  db.run('DELETE FROM monthly_reports WHERE id LIKE "report-%"', function(err) {
    if (err) console.error('Error deleting monthly reports:', err);
    else console.log(`✅ Deleted ${this.changes} monthly reports`);
  });
  
  db.run('DELETE FROM expense_reports WHERE id LIKE "report-%"', function(err) {
    if (err) console.error('Error deleting expense reports:', err);
    else {
      console.log(`✅ Deleted ${this.changes} expense reports`);
      console.log('\n🎉 All test data cleared!');
      console.log('Now run: node scripts/dev/load-year-of-reports.js');
      db.close();
    }
  });
});

