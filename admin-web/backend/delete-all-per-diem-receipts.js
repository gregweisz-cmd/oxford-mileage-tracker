const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Database path
const dbPath = path.join(__dirname, '..', '..', 'oxford_tracker.db');

// Create database connection
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
    return;
  }
  console.log('✅ Connected to database');
});

// First, show count
db.get('SELECT COUNT(*) as count FROM receipts WHERE category = "Per Diem"', (err, row) => {
  if (err) {
    console.error('❌ Error counting:', err.message);
    return;
  }
  
  console.log(`📊 Found ${row.count} Per Diem receipts`);
  
  // Delete all Per Diem receipts
  db.run('DELETE FROM receipts WHERE category = "Per Diem"', function(err) {
    if (err) {
      console.error('❌ Error deleting:', err.message);
    } else {
      console.log(`✅ Deleted ${this.changes} Per Diem receipts`);
    }
    
    // Close database connection
    db.close((err) => {
      if (err) {
        console.error('Error closing database:', err.message);
      } else {
        console.log('🔒 Database connection closed');
      }
    });
  });
});

