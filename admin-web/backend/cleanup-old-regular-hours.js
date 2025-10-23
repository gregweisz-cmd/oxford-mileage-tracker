const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'expense_tracker.db');
const db = new sqlite3.Database(dbPath);

console.log('🧹 Cleaning up old "Regular Hours" entries with empty cost centers...');

// First, let's see what we're dealing with
db.all(`
  SELECT id, employeeId, date, category, hours, costCenter, createdAt, updatedAt 
  FROM time_tracking 
  WHERE category = 'Regular Hours' AND (costCenter = '' OR costCenter IS NULL)
  ORDER BY date, createdAt
`, (err, rows) => {
  if (err) {
    console.error('❌ Error querying old Regular Hours entries:', err.message);
    return;
  }

  console.log(`📊 Found ${rows.length} old "Regular Hours" entries with empty cost centers:`);
  rows.forEach((row, index) => {
    console.log(`  ${index + 1}. ID: ${row.id}, Date: ${row.date}, Hours: ${row.hours}, CostCenter: "${row.costCenter}", Created: ${row.createdAt}`);
  });

  if (rows.length === 0) {
    console.log('✅ No old "Regular Hours" entries found. Database is clean!');
    db.close();
    return;
  }

  // Delete all old "Regular Hours" entries with empty cost centers
  db.run(`
    DELETE FROM time_tracking 
    WHERE category = 'Regular Hours' AND (costCenter = '' OR costCenter IS NULL)
 `, function(err) {
    if (err) {
      console.error('❌ Error deleting old Regular Hours entries:', err.message);
      return;
    }

    console.log(`✅ Successfully deleted ${this.changes} old "Regular Hours" entries`);
    
    // Verify the cleanup
    db.all(`
      SELECT COUNT(*) as count 
      FROM time_tracking 
      WHERE category = 'Regular Hours' AND (costCenter = '' OR costCenter IS NULL)
    `, (err, result) => {
      if (err) {
        console.error('❌ Error verifying cleanup:', err.message);
        return;
      }

      const remainingCount = result[0].count;
      if (remainingCount === 0) {
        console.log('✅ Cleanup completed successfully! No old "Regular Hours" entries remain.');
      } else {
        console.log(`⚠️ Warning: ${remainingCount} old "Regular Hours" entries still remain.`);
      }

      // Show remaining entries by category
      db.all(`
        SELECT category, COUNT(*) as count 
        FROM time_tracking 
        GROUP BY category 
        ORDER BY category
      `, (err, categories) => {
        if (err) {
          console.error('❌ Error getting category summary:', err.message);
          return;
        }

        console.log('\n📊 Current time tracking entries by category:');
        categories.forEach(cat => {
          console.log(`  ${cat.category}: ${cat.count} entries`);
        });

        db.close();
      });
    });
  });
});
