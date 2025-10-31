const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'expense_tracker.db');
const db = new sqlite3.Database(dbPath);

console.log('🧪 Testing approval workflow logic...\n');

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
        
        // Create Senior Staff supervised by RM
        db.run(
          `INSERT OR REPLACE INTO employees (id, name, email, password, oxfordHouseId, position, baseAddress, supervisorId, createdAt, updatedAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          ['sr-1', 'Senior Staff', 'sr@test.com', 'pass', 'OH2', 'Senior Staff', '456 Oak Ave', 'rm-1', now, now],
          (err) => {
            if (err) {
              console.error('Error creating Senior Staff:', err);
              reject(err);
              return;
            }
            console.log('✅ Created Senior Staff (SR-1) supervised by RM-1');
            
            // Create Field Staff supervised by Senior Staff
            db.run(
              `INSERT OR REPLACE INTO employees (id, name, email, password, oxfordHouseId, position, baseAddress, supervisorId, createdAt, updatedAt)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              ['fs-1', 'Field Staff', 'fs@test.com', 'pass', 'OH3', 'Field Staff', '789 Pine Rd', 'sr-1', now, now],
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
  });
}

function createTestReports() {
  return new Promise((resolve, reject) => {
    const now = new Date().toISOString();
    
    // Create monthly reports for each employee
    const reports = [
      { id: 'report-rm-1', employeeId: 'rm-1', month: 10, year: 2025, totalMiles: 100, status: 'draft' },
      { id: 'report-sr-1', employeeId: 'sr-1', month: 10, year: 2025, totalMiles: 80, status: 'draft' },
      { id: 'report-fs-1', employeeId: 'fs-1', month: 10, year: 2025, totalMiles: 60, status: 'draft' }
    ];
    
    let completed = 0;
    
    reports.forEach(report => {
      db.run(
        `INSERT OR REPLACE INTO monthly_reports (id, employeeId, month, year, totalMiles, totalExpenses, status, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [report.id, report.employeeId, report.month, report.year, report.totalMiles, 0, report.status, now, now],
        (err) => {
          if (err) {
            console.error(`Error creating report ${report.id}:`, err);
            reject(err);
            return;
          }
          completed++;
          if (completed === reports.length) {
            console.log('✅ Created test reports\n');
            resolve();
          }
        }
      );
    });
  });
}

function simulateRMSubmission(employeeId, reportId) {
  return new Promise((resolve, reject) => {
    const now = new Date().toISOString();
    const statusId = `status-${Date.now()}`;
    
    // Check if employee is a Regional Manager
    db.get(
      'SELECT position FROM employees WHERE id = ?',
      [employeeId],
      (err, employee) => {
        if (err) {
          reject(err);
          return;
        }

        // If employee is a Regional Manager, auto-approve
        if (employee && employee.position && employee.position.toLowerCase().includes('regional manager')) {
          db.run(
            'INSERT INTO report_status (id, reportId, employeeId, status, supervisorId, supervisorName, submittedAt, approvedAt, reviewedAt, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [statusId, reportId, employeeId, 'approved', 'RM_AUTO_APPROVE', 'System', now, now, now, now, now],
            function(insertErr) {
              if (insertErr) {
                reject(insertErr);
                return;
              }

              const approvalId = `approval-${Date.now()}`;
              db.run(
                'INSERT INTO report_approvals (id, reportId, employeeId, supervisorId, supervisorName, action, comments, timestamp, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [approvalId, reportId, employeeId, 'RM_AUTO_APPROVE', 'System', 'approve', 'Auto-approved for Regional Manager', now, now],
                function(approvalErr) {
                  if (approvalErr) {
                    reject(approvalErr);
                    return;
                  }
                  resolve({ status: 'approved', supervisorId: 'RM_AUTO_APPROVE' });
                }
              );
            }
          );
        } else {
          // Regular submission - needs supervisor approval
          db.run(
            'INSERT INTO report_status (id, reportId, employeeId, status, supervisorId, submittedAt, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [statusId, reportId, employeeId, 'pending', 'supervisor-placeholder', now, now, now],
            function(insertErr) {
              if (insertErr) {
                reject(insertErr);
                return;
              }
              resolve({ status: 'pending', supervisorId: 'supervisor-placeholder' });
            }
          );
        }
      }
    );
  });
}

async function runTests() {
  try {
    // Create test hierarchy and reports
    await createTestHierarchy();
    await createTestReports();
    
    console.log('Testing submission workflow:\n');
    
    // Test 1: RM submits report - should auto-approve
    console.log('Test 1: Regional Manager (RM-1) submits report...');
    const rmResult = await simulateRMSubmission('rm-1', 'report-rm-1');
    console.log(`   Status: ${rmResult.status}`);
    console.log(`   Supervisor: ${rmResult.supervisorId}`);
    if (rmResult.status === 'approved' && rmResult.supervisorId === 'RM_AUTO_APPROVE') {
      console.log('   ✅ PASS: RM report auto-approved for Finance\n');
    } else {
      console.log('   ❌ FAIL: Expected approved with RM_AUTO_APPROVE\n');
    }
    
    // Test 2: Senior Staff submits report - should require supervisor approval
    console.log('Test 2: Senior Staff (SR-1) submits report...');
    const srResult = await simulateRMSubmission('sr-1', 'report-sr-1');
    console.log(`   Status: ${srResult.status}`);
    console.log(`   Supervisor: ${srResult.supervisorId}`);
    if (srResult.status === 'pending' && srResult.supervisorId === 'supervisor-placeholder') {
      console.log('   ✅ PASS: Senior Staff report requires approval\n');
    } else {
      console.log('   ❌ FAIL: Expected pending status\n');
    }
    
    // Test 3: Field Staff submits report - should require supervisor approval
    console.log('Test 3: Field Staff (FS-1) submits report...');
    const fsResult = await simulateRMSubmission('fs-1', 'report-fs-1');
    console.log(`   Status: ${fsResult.status}`);
    console.log(`   Supervisor: ${fsResult.supervisorId}`);
    if (fsResult.status === 'pending' && fsResult.supervisorId === 'supervisor-placeholder') {
      console.log('   ✅ PASS: Field Staff report requires approval\n');
    } else {
      console.log('   ❌ FAIL: Expected pending status\n');
    }
    
    console.log('🧪 Tests completed!\n');
    
  } catch (error) {
    console.error('❌ Test error:', error);
  } finally {
    db.close();
  }
}

runTests();

