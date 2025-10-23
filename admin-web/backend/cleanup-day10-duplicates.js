const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'expense_tracker.db');
const db = new sqlite3.Database(dbPath);

console.log('🧹 Cleaning up duplicate Day 10 Holiday entries...');

// Delete the old entry with 62 hours, keep the new one with 8 hours
db.run(`
  DELETE FROM time_tracking 
  WHERE employeeId = 'greg-weisz-001' 
    AND date = '2025-10-10' 
    AND category = 'Holiday' 
    AND hours = 62
`, function(err) {
  if (err) {
    console.error('❌ Error:', err.message);
    return;
  }
  
  console.log(`✅ Deleted ${this.changes} duplicate Day 10 Holiday entry with 62 hours`);
  
  // Verify the cleanup
  db.all(`
    SELECT id, employeeId, date, category, hours, costCenter, createdAt, updatedAt
    FROM time_tracking 
    WHERE employeeId = 'greg-weisz-001' 
      AND date = '2025-10-10' 
      AND category = 'Holiday'
    ORDER BY createdAt DESC
  `, (err, rows) => {
    if (err) {
      console.error('❌ Error:', err.message);
      return;
    }
    
    console.log(`📊 Remaining Day 10 Holiday entries: ${rows.length}`);
    rows.forEach((row, index) => {
      console.log(`${index + 1}. ID: ${row.id}, Hours: ${row.hours}`);
    });
    
    db.close();
  });
});
