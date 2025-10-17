/**
 * Verify Data Sync Status
 * Checks backend database for recent entries and validates data integrity
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'expense_tracker.db');
const db = new sqlite3.Database(dbPath);

console.log('🔍 Verifying Data Sync Status...\n');
console.log('📂 Database:', dbPath, '\n');

// Check recent mileage entries
db.all(`
  SELECT 
    m.id,
    m.employeeId,
    e.name as employeeName,
    m.date,
    m.startLocation,
    m.endLocation,
    m.miles,
    m.isGpsTracked,
    m.createdAt
  FROM mileage_entries m
  LEFT JOIN employees e ON m.employeeId = e.id
  ORDER BY m.createdAt DESC
  LIMIT 10
`, [], (err, entries) => {
  if (err) {
    console.error('❌ Error fetching mileage entries:', err);
    return;
  }

  console.log('📍 Recent Mileage Entries (Last 10):\n');
  if (entries.length === 0) {
    console.log('   No mileage entries found\n');
  } else {
    entries.forEach((entry, index) => {
      console.log(`${index + 1}. ${entry.employeeName || 'Unknown Employee'}`);
      console.log(`   ${entry.startLocation} → ${entry.endLocation}`);
      console.log(`   ${entry.miles} miles ${entry.isGpsTracked ? '(GPS Tracked)' : '(Manual)'}`);
      console.log(`   Date: ${entry.date}`);
      console.log(`   Created: ${entry.createdAt}`);
      console.log('');
    });
  }

  // Check recent receipts
  db.all(`
    SELECT 
      r.id,
      r.employeeId,
      e.name as employeeName,
      r.date,
      r.vendor,
      r.amount,
      r.category,
      r.createdAt
    FROM receipts r
    LEFT JOIN employees e ON r.employeeId = e.id
    ORDER BY r.createdAt DESC
    LIMIT 10
  `, [], (err, receipts) => {
    if (err) {
      console.error('❌ Error fetching receipts:', err);
      return;
    }

    console.log('🧾 Recent Receipts (Last 10):\n');
    if (receipts.length === 0) {
      console.log('   No receipts found\n');
    } else {
      receipts.forEach((receipt, index) => {
        console.log(`${index + 1}. ${receipt.employeeName || 'Unknown Employee'}`);
        console.log(`   ${receipt.vendor} - $${receipt.amount} (${receipt.category})`);
        console.log(`   Date: ${receipt.date}`);
        console.log(`   Created: ${receipt.createdAt}`);
        console.log('');
      });
    }

    // Check for duplicates
    db.all(`
      SELECT 
        employeeId, 
        date, 
        startLocation, 
        endLocation, 
        miles, 
        COUNT(*) as count
      FROM mileage_entries
      GROUP BY employeeId, date, startLocation, endLocation, miles
      HAVING COUNT(*) > 1
    `, [], (err, dupMileage) => {
      if (err) {
        console.error('❌ Error checking mileage duplicates:', err);
        return;
      }

      console.log('🔍 Duplicate Check:\n');
      if (dupMileage.length > 0) {
        console.log(`⚠️  Found ${dupMileage.length} duplicate mileage entries`);
        dupMileage.forEach(dup => {
          console.log(`   ${dup.startLocation} → ${dup.endLocation} (${dup.count} copies)`);
        });
        console.log('');
      } else {
        console.log('✅ No duplicate mileage entries\n');
      }

      db.all(`
        SELECT 
          employeeId, 
          date, 
          amount, 
          vendor, 
          category, 
          COUNT(*) as count
        FROM receipts
        GROUP BY employeeId, date, amount, vendor, category
        HAVING COUNT(*) > 1
      `, [], (err, dupReceipts) => {
        if (err) {
          console.error('❌ Error checking receipt duplicates:', err);
          db.close();
          return;
        }

        if (dupReceipts.length > 0) {
          console.log(`⚠️  Found ${dupReceipts.length} duplicate receipts`);
          dupReceipts.forEach(dup => {
            console.log(`   ${dup.vendor} - $${dup.amount} (${dup.count} copies)`);
          });
          console.log('');
        } else {
          console.log('✅ No duplicate receipts\n');
        }

        // Summary statistics
        db.all(`
          SELECT 
            COUNT(DISTINCT m.employeeId) as activeEmployees,
            COUNT(m.id) as totalMileageEntries,
            SUM(m.miles) as totalMiles,
            (SELECT COUNT(*) FROM receipts) as totalReceipts,
            (SELECT SUM(amount) FROM receipts) as totalReceiptAmount,
            (SELECT COUNT(*) FROM receipts WHERE category = 'Per Diem') as perDiemCount,
            (SELECT SUM(amount) FROM receipts WHERE category = 'Per Diem') as perDiemAmount
          FROM mileage_entries m
          WHERE m.date >= date('now', 'start of month')
        `, [], (err, stats) => {
          if (err) {
            console.error('❌ Error getting statistics:', err);
            db.close();
            return;
          }

          const stat = stats[0];
          console.log('📊 Monthly Statistics (Current Month):\n');
          console.log(`   Active Employees: ${stat.activeEmployees}`);
          console.log(`   Mileage Entries: ${stat.totalMileageEntries}`);
          console.log(`   Total Miles: ${stat.totalMiles || 0}`);
          console.log(`   Total Receipts: ${stat.totalReceipts}`);
          console.log(`   Receipt Amount: $${(stat.totalReceiptAmount || 0).toFixed(2)}`);
          console.log(`   Per Diem Receipts: ${stat.perDiemCount}`);
          console.log(`   Per Diem Amount: $${(stat.perDiemAmount || 0).toFixed(2)}`);
          console.log('');

          // Check for orphaned entries
          db.all(`
            SELECT COUNT(*) as count
            FROM mileage_entries m
            LEFT JOIN employees e ON m.employeeId = e.id
            WHERE e.id IS NULL
          `, [], (err, orphaned) => {
            if (err) {
              console.error('❌ Error checking orphaned entries:', err);
              db.close();
              return;
            }

            const orphanedCount = orphaned[0].count;
            if (orphanedCount > 0) {
              console.log(`⚠️  Warning: ${orphanedCount} orphaned mileage entries (no matching employee)\n`);
            } else {
              console.log('✅ No orphaned mileage entries\n');
            }

            console.log('✅ Verification Complete!\n');
            db.close();
          });
        });
      });
    });
  });
});

