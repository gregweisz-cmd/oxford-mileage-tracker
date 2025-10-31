const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'expense_tracker.db');
const db = new sqlite3.Database(dbPath);

console.log('🧪 Testing supervisor reassignment logic...\n');

function createTestHierarchy() {
  return new Promise((resolve, reject) => {
    const now = new Date().toISOString();
    
    // Create RM (Regional Manager)
    db.run(
      `INSERT OR REPLACE INTO employees (id, name, email, password, oxfordHouseId, position, baseAddress, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ['rm-1', 'Regional Manager', 'rm@test.com', 'pass', 'OH1', 'Regional Manager', '123 Main St', now, now],
      (err) => {
        if (err) {
          console.error('Error creating RM:', err);
          reject(err);
          return;
        }
        console.log('✅ Created Regional Manager (RM-1)');
        
        // Create Admin
        db.run(
          `INSERT OR REPLACE INTO employees (id, name, email, password, oxfordHouseId, position, baseAddress, createdAt, updatedAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          ['admin-1', 'Admin', 'admin@test.com', 'pass', 'OH0', 'Admin', '1 Admin St', now, now],
          (err) => {
            if (err) {
              console.error('Error creating Admin:', err);
              reject(err);
              return;
            }
            console.log('✅ Created Admin (admin-1)');
            
            // Create Senior Staff supervised by RM
            db.run(
              `INSERT OR REPLACE INTO employees (id, name, email, password, oxfordHouseId, position, baseAddress, supervisorId, createdAt, updatedAt)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              ['sr-1', 'Senior Staff 1', 'sr1@test.com', 'pass', 'OH2', 'Senior Staff', '456 Oak Ave', 'rm-1', now, now],
              (err) => {
                if (err) {
                  console.error('Error creating Senior Staff:', err);
                  reject(err);
                  return;
                }
                console.log('✅ Created Senior Staff 1 (SR-1) supervised by RM-1');
                
                // Create Senior Staff 2 supervised by RM
                db.run(
                  `INSERT OR REPLACE INTO employees (id, name, email, password, oxfordHouseId, position, baseAddress, supervisorId, createdAt, updatedAt)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                  ['sr-2', 'Senior Staff 2', 'sr2@test.com', 'pass', 'OH3', 'Senior Staff', '789 Pine Rd', 'rm-1', now, now],
                  (err) => {
                    if (err) {
                      console.error('Error creating Senior Staff 2:', err);
                      reject(err);
                      return;
                    }
                    console.log('✅ Created Senior Staff 2 (SR-2) supervised by RM-1');
                    
                    // Create Field Staff supervised by Senior Staff
                    db.run(
                      `INSERT OR REPLACE INTO employees (id, name, email, password, oxfordHouseId, position, baseAddress, supervisorId, createdAt, updatedAt)
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                      ['fs-1', 'Field Staff', 'fs@test.com', 'pass', 'OH4', 'Field Staff', '999 Elm St', 'sr-1', now, now],
                      (err) => {
                        if (err) {
                          console.error('Error creating Field Staff:', err);
                          reject(err);
                          return;
                        }
                        console.log('✅ Created Field Staff (FS-1) supervised by SR-1\n');
                        resolve();
                      }
                    );
                  }
                );
              }
            );
          }
        );
      }
    );
  });
}

// Get all supervised employees (copied from server.js logic)
function getAllSupervisedEmployees(supervisorId) {
  return new Promise((resolve, reject) => {
    const supervisedEmployees = new Set();
    const visited = new Set();
    
    function findSupervisedRecursive(currentSupervisorId) {
      if (visited.has(currentSupervisorId)) {
        return Promise.resolve();
      }
      visited.add(currentSupervisorId);
      
      return new Promise((innerResolve, innerReject) => {
        db.all(
          'SELECT id FROM employees WHERE supervisorId = ?',
          [currentSupervisorId],
          (err, rows) => {
            if (err) {
              innerReject(err);
              return;
            }
            
            rows.forEach(row => {
              supervisedEmployees.add(row.id);
            });
            
            const promises = rows.map(row => findSupervisedRecursive(row.id));
            Promise.all(promises).then(() => {
              innerResolve();
            }).catch(innerReject);
          }
        );
      });
    }
    
    findSupervisedRecursive(supervisorId)
      .then(() => {
        resolve(Array.from(supervisedEmployees));
      })
      .catch(reject);
  });
}

// Check if user is RM or Admin
function checkUserRole(userId) {
  return new Promise((resolve, reject) => {
    db.get(
      'SELECT position FROM employees WHERE id = ?',
      [userId],
      (err, user) => {
        if (err) {
          reject(err);
          return;
        }
        
        if (!user) {
          resolve({ isRM: false, isAdmin: false });
          return;
        }
        
        const isRM = user.position && user.position.toLowerCase().includes('regional manager');
        const isAdmin = user.position && user.position.toLowerCase().includes('admin');
        
        resolve({ isRM, isAdmin });
      }
    );
  });
}

// Simulate reassignment
async function testReassignment(requestedByUserId, employeeId, newSupervisorId) {
  try {
    // Check permissions
    const { isRM, isAdmin } = await checkUserRole(requestedByUserId);
    
    if (!isRM && !isAdmin) {
      return { success: false, error: 'Only Regional Managers and Admins can reassign supervisors' };
    }

    // Verify supervision (RM only)
    if (isRM && !isAdmin) {
      const supervisedIds = await getAllSupervisedEmployees(requestedByUserId);
      if (!supervisedIds.includes(employeeId)) {
        return { success: false, error: 'You can only reassign supervisors for employees you supervise' };
      }
    }

    // Check new supervisor exists (if not null)
    if (newSupervisorId !== null) {
      const supervisor = await new Promise((resolve, reject) => {
        db.get('SELECT id FROM employees WHERE id = ?', [newSupervisorId], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });
      
      if (!supervisor) {
        return { success: false, error: 'New supervisor not found' };
      }
    }

    // Perform reassignment
    const now = new Date().toISOString();
    await new Promise((resolve, reject) => {
      db.run(
        'UPDATE employees SET supervisorId = ?, updatedAt = ? WHERE id = ?',
        [newSupervisorId, now, employeeId],
        function(err) {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    return { success: true, message: 'Supervisor reassigned successfully' };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function runTests() {
  try {
    // Create test hierarchy
    await createTestHierarchy();
    
    console.log('Testing reassignment permissions:\n');
    
    // Test 1: RM reassigns Field Staff from SR-1 to SR-2 (should succeed)
    console.log('Test 1: RM reassigns FS-1 from SR-1 to SR-2...');
    const result1 = await testReassignment('rm-1', 'fs-1', 'sr-2');
    console.log(`   Result: ${result1.success ? '✅ PASS' : '❌ FAIL'}`);
    if (result1.success) {
      console.log('   Message:', result1.message);
    } else {
      console.log('   Error:', result1.error);
    }
    
    // Verify reassignment
    const fs1After = await new Promise((resolve, reject) => {
      db.get('SELECT supervisorId FROM employees WHERE id = ?', ['fs-1'], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
    console.log(`   FS-1 supervisorId: ${fs1After.supervisorId} (expected: sr-2)\n`);
    
    // Test 2: RM reassigns SR-2 to themselves (should succeed)
    console.log('Test 2: RM reassigns SR-2 to RM-1...');
    const result2 = await testReassignment('rm-1', 'sr-2', 'rm-1');
    console.log(`   Result: ${result2.success ? '✅ PASS' : '❌ FAIL'}`);
    if (result2.success) {
      console.log('   Message:', result2.message);
    } else {
      console.log('   Error:', result2.error);
    }
    console.log('');
    
    // Test 3: Admin reassigns anyone (should succeed)
    console.log('Test 3: Admin reassigns SR-1 to null (remove supervisor)...');
    const result3 = await testReassignment('admin-1', 'sr-1', null);
    console.log(`   Result: ${result3.success ? '✅ PASS' : '❌ FAIL'}`);
    if (result3.success) {
      console.log('   Message:', result3.message);
    } else {
      console.log('   Error:', result3.error);
    }
    console.log('');
    
    // Test 4: Field Staff tries to reassign (should fail)
    console.log('Test 4: Field Staff tries to reassign (should fail)...');
    const result4 = await testReassignment('fs-1', 'sr-1', 'rm-1');
    console.log(`   Result: ${result4.success ? '❌ FAIL (should have been denied)' : '✅ PASS (correctly denied)'}`);
    if (!result4.success) {
      console.log('   Error:', result4.error);
    }
    console.log('');
    
    // Test 5: RM tries to reassign employee they don't supervise (should fail)
    console.log('Test 5: RM tries to reassign non-supervised employee (should fail)...');
    // First, create an employee not supervised by RM
    const now = new Date().toISOString();
    await new Promise((resolve, reject) => {
      db.run(
        `INSERT OR REPLACE INTO employees (id, name, email, password, oxfordHouseId, position, baseAddress, supervisorId, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ['other-1', 'Other Employee', 'other@test.com', 'pass', 'OH5', 'Staff', '111 Other St', null, now, now],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
    
    const result5 = await testReassignment('rm-1', 'other-1', 'sr-1');
    console.log(`   Result: ${result5.success ? '❌ FAIL (should have been denied)' : '✅ PASS (correctly denied)'}`);
    if (!result5.success) {
      console.log('   Error:', result5.error);
    }
    console.log('');
    
    console.log('🧪 Tests completed!\n');
    
  } catch (error) {
    console.error('❌ Test error:', error);
  } finally {
    db.close();
  }
}

runTests();

