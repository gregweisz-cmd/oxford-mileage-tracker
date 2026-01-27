/**
 * Script to merge Greg Weisz employee records
 * Moves all data from greg-testadd-* to greg-weisz-001
 */

const dbService = require('../../services/dbService');
const path = require('path');

// Initialize database
const dbPath = process.env.DATABASE_PATH || path.join(__dirname, '../../../oxford_tracker.db');
dbService.initDatabase(dbPath);

const db = dbService.getDb();

const SOURCE_ID = 'greg-testadd-1761926170922-wwi4c'; // The one with all the data
const TARGET_ID = 'greg-weisz-001'; // The one we want to keep

console.log('🔄 Merging Greg Weisz employee records...\n');
console.log(`Source (has data): ${SOURCE_ID}`);
console.log(`Target (will receive data): ${TARGET_ID}\n`);

// First, verify both records exist
db.get('SELECT id, name FROM employees WHERE id = ?', [SOURCE_ID], (err, source) => {
  if (err || !source) {
    console.error('❌ Source employee not found:', SOURCE_ID);
    process.exit(1);
  }
  
  db.get('SELECT id, name FROM employees WHERE id = ?', [TARGET_ID], (err, target) => {
    if (err || !target) {
      console.error('❌ Target employee not found:', TARGET_ID);
      process.exit(1);
    }
    
    console.log(`✅ Found source: ${source.name} (${source.id})`);
    console.log(`✅ Found target: ${target.name} (${target.id})\n`);
    
    // Count data to move
    db.all(
      `SELECT 
        (SELECT COUNT(*) FROM mileage_entries WHERE employeeId = ?) as mileage_count,
        (SELECT COUNT(*) FROM receipts WHERE employeeId = ?) as receipts_count,
        (SELECT COUNT(*) FROM time_tracking WHERE employeeId = ?) as time_count,
        (SELECT COUNT(*) FROM daily_descriptions WHERE employeeId = ?) as descriptions_count
      `,
      [SOURCE_ID, SOURCE_ID, SOURCE_ID, SOURCE_ID],
      (err, counts) => {
        if (err) {
          console.error('❌ Error counting data:', err);
          process.exit(1);
        }
        
        const data = counts[0];
        console.log(`📊 Data to move:`);
        console.log(`   - ${data.mileage_count} mileage entries`);
        console.log(`   - ${data.receipts_count} receipts`);
        console.log(`   - ${data.time_count} time tracking entries`);
        console.log(`   - ${data.descriptions_count} daily descriptions\n`);
        
        // Update all tables
        console.log('🔄 Updating mileage_entries...');
        db.run('UPDATE mileage_entries SET employeeId = ? WHERE employeeId = ?', [TARGET_ID, SOURCE_ID], function(err) {
          if (err) {
            console.error('❌ Error updating mileage_entries:', err);
            process.exit(1);
          }
          console.log(`   ✅ Updated ${this.changes} mileage entries`);
          
          console.log('🔄 Updating receipts...');
          db.run('UPDATE receipts SET employeeId = ? WHERE employeeId = ?', [TARGET_ID, SOURCE_ID], function(err) {
            if (err) {
              console.error('❌ Error updating receipts:', err);
              process.exit(1);
            }
            console.log(`   ✅ Updated ${this.changes} receipts`);
            
            console.log('🔄 Updating time_tracking...');
            db.run('UPDATE time_tracking SET employeeId = ? WHERE employeeId = ?', [TARGET_ID, SOURCE_ID], function(err) {
              if (err) {
                console.error('❌ Error updating time_tracking:', err);
                process.exit(1);
              }
              console.log(`   ✅ Updated ${this.changes} time tracking entries`);
              
              console.log('🔄 Updating daily_descriptions...');
              db.run('UPDATE daily_descriptions SET employeeId = ? WHERE employeeId = ?', [TARGET_ID, SOURCE_ID], function(err) {
                if (err) {
                  console.error('❌ Error updating daily_descriptions:', err);
                  process.exit(1);
                }
                console.log(`   ✅ Updated ${this.changes} daily descriptions`);
                
                // Update expense reports
                console.log('🔄 Updating expense_reports...');
                db.run('UPDATE expense_reports SET employeeId = ? WHERE employeeId = ?', [TARGET_ID, SOURCE_ID], function(err) {
                  if (err) {
                    console.error('❌ Error updating expense_reports:', err);
                    process.exit(1);
                  }
                  console.log(`   ✅ Updated ${this.changes} expense reports`);
                  
                  // Delete the source employee record
                  console.log(`\n🗑️  Deleting source employee record (${SOURCE_ID})...`);
                  db.run('DELETE FROM employees WHERE id = ?', [SOURCE_ID], function(err) {
                    if (err) {
                      console.error('❌ Error deleting source employee:', err);
                      process.exit(1);
                    }
                    console.log(`   ✅ Deleted source employee record\n`);
                    
                    console.log('✅ Merge complete! All data has been moved to greg-weisz-001');
                    console.log('\n💡 Next steps:');
                    console.log('   1. Make sure the mobile app is using employee ID: greg-weisz-001');
                    console.log('   2. Make sure the web portal is using employee ID: greg-weisz-001');
                    console.log('   3. Clear the mobile app cache and reload');
                    console.log('   4. Test that data syncs correctly between app and portal');
                    
                    process.exit(0);
                  });
                });
              });
            });
          });
        });
      }
    );
  });
});
