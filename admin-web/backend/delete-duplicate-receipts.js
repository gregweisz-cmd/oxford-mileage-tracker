/**
 * Delete Duplicate Receipts
 * This script removes duplicate Per Diem and other receipts from the database
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'expense_tracker.db');
const db = new sqlite3.Database(dbPath);

console.log('🔍 Finding duplicate receipts...\n');

// Find and delete duplicates based on employeeId, date, amount, category, and vendor
db.all(`
  SELECT 
    employeeId, 
    date, 
    amount, 
    category, 
    vendor,
    COUNT(*) as count,
    GROUP_CONCAT(id) as ids
  FROM receipts
  GROUP BY employeeId, date, amount, category, vendor
  HAVING COUNT(*) > 1
  ORDER BY date DESC, count DESC
`, [], (err, duplicates) => {
  if (err) {
    console.error('❌ Error finding duplicates:', err);
    db.close();
    return;
  }

  if (duplicates.length === 0) {
    console.log('✅ No duplicate receipts found!');
    db.close();
    return;
  }

  console.log(`📊 Found ${duplicates.length} sets of duplicate receipts:\n`);
  
  let totalToDelete = 0;
  duplicates.forEach((dup, index) => {
    const ids = dup.ids.split(',');
    const toDelete = ids.length - 1; // Keep one, delete the rest
    totalToDelete += toDelete;
    
    console.log(`${index + 1}. ${dup.vendor} - $${dup.amount} (${dup.category}) on ${dup.date}`);
    console.log(`   Count: ${dup.count} duplicates`);
    console.log(`   IDs: ${ids.slice(0, 3).join(', ')}${ids.length > 3 ? '...' : ''}`);
    console.log('');
  });

  console.log(`\n⚠️  Total duplicates to delete: ${totalToDelete}`);
  console.log('⚠️  This will keep the FIRST occurrence of each duplicate.\n');

  // Delete duplicates (keep the first one, delete the rest)
  let deletedCount = 0;
  let processedSets = 0;

  duplicates.forEach((dup, index) => {
    const ids = dup.ids.split(',');
    const idsToDelete = ids.slice(1); // Keep first, delete rest

    // Delete each duplicate ID
    idsToDelete.forEach(id => {
      db.run('DELETE FROM receipts WHERE id = ?', [id], (err) => {
        if (err) {
          console.error(`❌ Error deleting receipt ${id}:`, err);
        } else {
          deletedCount++;
          
          // Check if we're done
          if (deletedCount === totalToDelete) {
            console.log(`\n✅ Successfully deleted ${deletedCount} duplicate receipts!`);
            console.log('✅ Database cleaned!\n');
            
            // Show final count
            db.get('SELECT COUNT(*) as total FROM receipts', [], (err, row) => {
              if (!err) {
                console.log(`📊 Total receipts remaining: ${row.total}`);
              }
              db.close();
            });
          }
        }
      });
    });

    processedSets++;
  });
});

