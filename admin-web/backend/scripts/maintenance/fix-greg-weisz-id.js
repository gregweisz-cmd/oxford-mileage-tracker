/**
 * Script to:
 * 1. Delete greg-testadd employee and all their data
 * 2. Change Greg Weisz's ID from greg-weisz-001 to random format
 * 3. Update all data to use the new ID
 */

const dbService = require('../../services/dbService');
const path = require('path');

// Initialize database
const dbPath = process.env.DATABASE_PATH || path.join(__dirname, '../../../oxford_tracker.db');
dbService.initDatabase(dbPath);

const db = dbService.getDb();

const OLD_GREG_ID = 'greg-weisz-001';
const TESTADD_ID = 'greg-testadd-1761926170922-wwi4c';

// Generate new random ID in the same format as other employees
function generateNewEmployeeId() {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 9);
  return `emp-${timestamp}-${random}`;
}

const NEW_GREG_ID = generateNewEmployeeId();

console.log('🔄 Fixing Greg Weisz employee ID...\n');
console.log(`Old ID: ${OLD_GREG_ID}`);
console.log(`TestAdd ID (will be deleted): ${TESTADD_ID}`);
console.log(`New ID: ${NEW_GREG_ID}\n`);

// Step 1: Delete greg-testadd employee and all their data
console.log('🗑️  Step 1: Deleting greg-testadd employee and all their data...');

db.run('DELETE FROM mileage_entries WHERE employeeId = ?', [TESTADD_ID], function(err) {
  if (err) {
    console.error('❌ Error deleting mileage entries:', err);
    process.exit(1);
  }
  console.log(`   ✅ Deleted ${this.changes} mileage entries`);
  
  db.run('DELETE FROM receipts WHERE employeeId = ?', [TESTADD_ID], function(err) {
    if (err) {
      console.error('❌ Error deleting receipts:', err);
      process.exit(1);
    }
    console.log(`   ✅ Deleted ${this.changes} receipts`);
    
    db.run('DELETE FROM time_tracking WHERE employeeId = ?', [TESTADD_ID], function(err) {
      if (err) {
        console.error('❌ Error deleting time tracking:', err);
        process.exit(1);
      }
      console.log(`   ✅ Deleted ${this.changes} time tracking entries`);
      
      db.run('DELETE FROM daily_descriptions WHERE employeeId = ?', [TESTADD_ID], function(err) {
        if (err) {
          console.error('❌ Error deleting daily descriptions:', err);
          process.exit(1);
        }
        console.log(`   ✅ Deleted ${this.changes} daily descriptions`);
        
        db.run('DELETE FROM expense_reports WHERE employeeId = ?', [TESTADD_ID], function(err) {
          if (err) {
            console.error('❌ Error deleting expense reports:', err);
            process.exit(1);
          }
          console.log(`   ✅ Deleted ${this.changes} expense reports`);
          
          db.run('DELETE FROM employees WHERE id = ?', [TESTADD_ID], function(err) {
            if (err) {
              console.error('❌ Error deleting employee:', err);
              process.exit(1);
            }
            console.log(`   ✅ Deleted greg-testadd employee record\n`);
            
            // Step 2: Get Greg Weisz employee data
            console.log('📋 Step 2: Getting Greg Weisz employee data...');
            db.get('SELECT * FROM employees WHERE id = ?', [OLD_GREG_ID], (err, employee) => {
              if (err) {
                console.error('❌ Error fetching employee:', err);
                process.exit(1);
              }
              
              if (!employee) {
                console.error('❌ Greg Weisz employee not found!');
                process.exit(1);
              }
              
              console.log(`   ✅ Found Greg Weisz: ${employee.name} (${employee.email || 'no email'})\n`);
              
              // Step 3: Update all data from old ID to new ID
              console.log('🔄 Step 3: Updating all data to use new ID...');
              
              db.run('UPDATE mileage_entries SET employeeId = ? WHERE employeeId = ?', [NEW_GREG_ID, OLD_GREG_ID], function(err) {
                if (err) {
                  console.error('❌ Error updating mileage entries:', err);
                  process.exit(1);
                }
                console.log(`   ✅ Updated ${this.changes} mileage entries`);
                
                db.run('UPDATE receipts SET employeeId = ? WHERE employeeId = ?', [NEW_GREG_ID, OLD_GREG_ID], function(err) {
                  if (err) {
                    console.error('❌ Error updating receipts:', err);
                    process.exit(1);
                  }
                  console.log(`   ✅ Updated ${this.changes} receipts`);
                  
                  db.run('UPDATE time_tracking SET employeeId = ? WHERE employeeId = ?', [NEW_GREG_ID, OLD_GREG_ID], function(err) {
                    if (err) {
                      console.error('❌ Error updating time tracking:', err);
                      process.exit(1);
                    }
                    console.log(`   ✅ Updated ${this.changes} time tracking entries`);
                    
                    db.run('UPDATE daily_descriptions SET employeeId = ? WHERE employeeId = ?', [NEW_GREG_ID, OLD_GREG_ID], function(err) {
                      if (err) {
                        console.error('❌ Error updating daily descriptions:', err);
                        process.exit(1);
                      }
                      console.log(`   ✅ Updated ${this.changes} daily descriptions`);
                      
                      db.run('UPDATE expense_reports SET employeeId = ? WHERE employeeId = ?', [NEW_GREG_ID, OLD_GREG_ID], function(err) {
                        if (err) {
                          console.error('❌ Error updating expense reports:', err);
                          process.exit(1);
                        }
                        console.log(`   ✅ Updated ${this.changes} expense reports`);
                        
                        // Step 4: Update employee record ID using a simpler approach
                        console.log('\n🔄 Step 4: Updating employee record ID...');
                        
                        // Use INSERT INTO ... SELECT to copy the row with new ID
                        db.run(
                          `INSERT INTO employees 
                           SELECT 
                             '${NEW_GREG_ID}' as id,
                             name, email, password, oxfordHouseId, position, phoneNumber, 
                             baseAddress, baseAddress2, costCenters, selectedCostCenters, 
                             defaultCostCenter, preferredName, supervisorId, signature, 
                             createdAt, updatedAt, approvalFrequency, archived, 
                             typicalWorkStartHour, typicalWorkEndHour, twoFactorCodeExpires, 
                             twoFactorEnabled, phoneNumberVerified, twoFactorCode, 
                             hasCompletedOnboarding, hasCompletedSetupWizard, lastLoginAt, 
                             role, sundayReminderEnabled, preferences, permissions
                           FROM employees WHERE id = ?`,
                          [OLD_GREG_ID],
                          function(err) {
                            if (err) {
                              console.error('❌ Error creating new employee record:', err);
                              process.exit(1);
                            }
                            console.log(`   ✅ Created new employee record with ID: ${NEW_GREG_ID}`);
                            
                            // Step 5: Delete old employee record
                            console.log('\n🗑️  Step 5: Deleting old employee record...');
                            db.run('DELETE FROM employees WHERE id = ?', [OLD_GREG_ID], function(err) {
                              if (err) {
                                console.error('❌ Error deleting old employee:', err);
                                process.exit(1);
                              }
                              console.log(`   ✅ Deleted old employee record\n`);
                              
                              console.log('✅ All done!\n');
                              console.log('📋 Summary:');
                              console.log(`   - Deleted greg-testadd employee and all their data`);
                              console.log(`   - Changed Greg Weisz ID from ${OLD_GREG_ID} to ${NEW_GREG_ID}`);
                              console.log(`   - Updated all data to use new ID\n`);
                              console.log('💡 Next steps:');
                              console.log(`   1. Update mobile app to use employee ID: ${NEW_GREG_ID}`);
                              console.log(`   2. Update web portal to use employee ID: ${NEW_GREG_ID}`);
                              console.log(`   3. Clear mobile app cache and reload`);
                              console.log(`   4. Test that data syncs correctly\n`);
                              
                              process.exit(0);
                            });
                          }
                        );
                      });
                    });
                  });
                });
              });
            });
          });
        });
      });
    });
  });
});
