const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'expense_tracker.db');
const db = new sqlite3.Database(dbPath);

console.log('🧹 Cleaning up duplicate time tracking entries...');

// First, let's see what duplicates we have
db.all(`
  SELECT date, category, costCenter, COUNT(*) as count, GROUP_CONCAT(id) as ids
  FROM time_tracking 
  WHERE employeeId = 'greg-weisz-001'
  GROUP BY date, category, costCenter
  HAVING count > 1
  ORDER BY date DESC
`, (err, duplicates) => {
  if (err) {
    console.error('❌ Error finding duplicates:', err);
    db.close();
    return;
  }
  
  console.log(`📊 Found ${duplicates.length} sets of duplicate entries:`);
  duplicates.forEach((dup, index) => {
    console.log(`\n${index + 1}. Date: ${dup.date}, Category: ${dup.category}, Cost Center: ${dup.costCenter || 'NULL'}`);
    console.log(`   Count: ${dup.count}, IDs: ${dup.ids}`);
  });
  
  if (duplicates.length > 0) {
    console.log('\n🗑️ Deleting duplicate entries (keeping the most recent one)...');
    
    // Delete duplicates, keeping only the most recent entry for each date/category/costCenter combination
    db.run(`
      DELETE FROM time_tracking 
      WHERE employeeId = 'greg-weisz-001'
      AND id NOT IN (
        SELECT MAX(id) 
        FROM time_tracking 
        WHERE employeeId = 'greg-weisz-001'
        GROUP BY date, category, costCenter
      )
    `, function(err) {
      if (err) {
        console.error('❌ Error deleting duplicates:', err);
        db.close();
        return;
      }
      
      console.log(`✅ Deleted ${this.changes} duplicate entries`);
      
      // Show remaining entries
      db.all(`
        SELECT COUNT(*) as total FROM time_tracking WHERE employeeId = 'greg-weisz-001'
      `, (err, result) => {
        if (err) {
          console.error('❌ Error counting remaining entries:', err);
        } else {
          console.log(`📊 Remaining entries: ${result[0].total}`);
        }
        db.close();
      });
    });
  } else {
    console.log('✅ No duplicates found');
    db.close();
  }
});
