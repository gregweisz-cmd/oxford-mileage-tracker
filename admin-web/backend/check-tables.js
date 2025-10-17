const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('expense_tracker.db');

db.all('SELECT name FROM sqlite_master WHERE type="table"', [], (err, tables) => {
  if (err) {
    console.error('Error:', err);
  } else {
    console.log('📊 Tables in database:');
    tables.forEach(t => console.log('  -', t.name));
    
    // Check if receipts table exists
    const hasReceipts = tables.some(t => t.name === 'receipts');
    if (hasReceipts) {
      db.all('SELECT * FROM receipts WHERE category = "Per Diem"', [], (err, receipts) => {
        if (err) {
          console.error('Error querying receipts:', err);
        } else {
          console.log(`\n💵 Per Diem receipts: ${receipts.length}`);
          receipts.forEach(r => {
            console.log(`  - ${r.vendor}: $${r.amount} (ID: ${r.id})`);
          });
        }
        db.close();
      });
    } else {
      console.log('\n⚠️ Receipts table does not exist!');
      db.close();
    }
  }
});

