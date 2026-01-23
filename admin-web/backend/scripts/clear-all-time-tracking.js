/**
 * Clear All Time Tracking Entries
 * This script deletes all time tracking entries from the database
 * 
 * Usage:
 *   node scripts/clear-all-time-tracking.js [employeeId] [month] [year]
 * 
 * Examples:
 *   node scripts/clear-all-time-tracking.js                    # Delete ALL entries
 *   node scripts/clear-all-time-tracking.js greg-weisz-001     # Delete all for employee
 *   node scripts/clear-all-time-tracking.js greg-weisz-001 3 2025  # Delete for employee, month, year
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'expense_tracker.db');
const db = new sqlite3.Database(dbPath);

const args = process.argv.slice(2);
const employeeId = args[0];
const month = args[1];
const year = args[2];

console.log('🗑️  Clearing time tracking entries...\n');

let query = 'DELETE FROM time_tracking';
const params = [];
const conditions = [];

if (employeeId) {
  conditions.push('employeeId = ?');
  params.push(employeeId);
  console.log(`  Filtering by employeeId: ${employeeId}`);
}

if (month && year) {
  conditions.push('strftime("%m", date) = ? AND strftime("%Y", date) = ?');
  params.push(month.toString().padStart(2, '0'), year.toString());
  console.log(`  Filtering by month: ${month}/${year}`);
}

if (conditions.length > 0) {
  query += ' WHERE ' + conditions.join(' AND ');
}

const runDelete = () => {
  db.run(query, params, function(err) {
    if (err) {
      console.error('❌ Error deleting time tracking entries:', err.message);
      db.close();
      process.exit(1);
      return;
    }
    
    console.log(`✅ Successfully deleted ${this.changes} time tracking entries`);
    
    // Show summary of remaining entries
    db.all('SELECT category, COUNT(*) as count FROM time_tracking GROUP BY category ORDER BY category', (err, rows) => {
      if (err) {
        console.error('❌ Error getting summary:', err.message);
      } else if (rows.length > 0) {
        console.log('\n📊 Remaining time tracking entries by category:');
        rows.forEach(row => {
          console.log(`  ${row.category || '(empty)'}: ${row.count} entries`);
        });
      } else {
        console.log('\n✅ All time tracking entries have been cleared!');
      }
      
      db.close();
    });
  });
};

if (conditions.length === 0) {
  console.log('⚠️  WARNING: This will delete ALL time tracking entries from the database!');
  console.log('   Press Ctrl+C to cancel, or wait 3 seconds to continue...\n');
  setTimeout(runDelete, 3000);
} else {
  runDelete();
}
