/**
 * Delete Specific Per Diem Test Receipts from Backend
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'expense_tracker.db');
const db = new sqlite3.Database(dbPath);

console.log('🗑️ Deleting Per Diem test receipts from backend...\n');

const receiptsToDelete = [
  'mgv0uu4iyptzgzx9h4l', // $35 receipt
  'mgtv715jh0t1buije5n'  // $25 receipt
];

let deletedCount = 0;

receiptsToDelete.forEach(id => {
  db.run('DELETE FROM receipts WHERE id = ?', [id], function(err) {
    if (err) {
      console.error(`❌ Error deleting receipt ${id}:`, err);
    } else {
      if (this.changes > 0) {
        console.log(`✅ Deleted receipt: ${id}`);
        deletedCount++;
      } else {
        console.log(`ℹ️  Receipt ${id} not found (already deleted)`);
      }
      
      // Check if we're done
      if (deletedCount + (this.changes === 0 ? 1 : 0) >= receiptsToDelete.length) {
        console.log(`\n✅ Deleted ${deletedCount} receipt(s) from backend database`);
        
        // Show remaining receipts
        db.all('SELECT * FROM receipts WHERE category = "Per Diem"', [], (err, rows) => {
          if (!err) {
            console.log(`\n📊 Remaining Per Diem receipts: ${rows.length}`);
            if (rows.length > 0) {
              rows.forEach(r => {
                console.log(`   - ${r.vendor}: $${r.amount} (${r.date})`);
              });
            }
          }
          db.close();
        });
      }
    }
  });
});

