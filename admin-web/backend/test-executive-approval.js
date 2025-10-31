const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'expense_tracker.db');
const db = new sqlite3.Database(dbPath);

console.log('🧪 Testing executive auto-approval logic...\n');

function createTestExecutives() {
  return new Promise((resolve, reject) => {
    const now = new Date().toISOString();
    
    // Create test executives
    const executives = [
      { id: 'rm-1', name: 'Regional Manager', position: 'Regional Manager' },
      { id: 'dir-1', name: 'Program Director', position: 'Program Director' },
      { id: 'ceo-1', name: 'CEO', position: 'Chief Executive Officer' },
      { id: 'cfo-1', name: 'CFO', position: 'Chief Financial Officer' },
      { id: 'coo-1', name: 'COO', position: 'Chief Operating Officer' },
      { id: 'staff-1', name: 'Regular Staff', position: 'Senior Staff' }
    ];
    
    let completed = 0;
    
    executives.forEach(exec => {
      db.run(
        `INSERT OR REPLACE INTO employees (id, name, email, password, oxfordHouseId, position, baseAddress, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [exec.id, exec.name, `${exec.id}@test.com`, 'pass', 'OH1', exec.position, '123 Main St', now, now],
        (err) => {
          if (err) {
            console.error(`Error creating ${exec.name}:`, err);
            reject(err);
            return;
          }
          console.log(`✅ Created ${exec.name} - ${exec.position}`);
          completed++;
          if (completed === executives.length) {
            console.log('');
            resolve();
          }
        }
      );
    });
  });
}

function testPositionForApproval(position) {
  const positionLower = position.toLowerCase();
  const isExempt = positionLower.includes('regional manager') ||
                  positionLower.includes('director') ||
                  positionLower.includes('chief') ||
                  positionLower.includes('ceo') ||
                  positionLower.includes('cfo');
  return isExempt;
}

async function runTests() {
  try {
    // Create test executives
    await createTestExecutives();
    
    console.log('Testing position-based auto-approval:\n');
    
    // Test cases
    const testCases = [
      { position: 'Regional Manager', shouldApprove: true },
      { position: 'Program Director', shouldApprove: true },
      { position: 'Executive Director', shouldApprove: true },
      { position: 'Chief Executive Officer', shouldApprove: true },
      { position: 'CEO', shouldApprove: true },
      { position: 'Chief Financial Officer', shouldApprove: true },
      { position: 'CFO', shouldApprove: true },
      { position: 'Chief Operating Officer', shouldApprove: true },
      { position: 'Chief Technology Officer', shouldApprove: true },
      { position: 'Senior Staff', shouldApprove: false },
      { position: 'Field Staff', shouldApprove: false },
      { position: 'Coordinator', shouldApprove: false },
      { position: 'Manager', shouldApprove: false }
    ];
    
    let passCount = 0;
    let failCount = 0;
    
    testCases.forEach(testCase => {
      const result = testPositionForApproval(testCase.position);
      const passed = result === testCase.shouldApprove;
      
      if (passed) {
        passCount++;
        console.log(`✅ "${testCase.position}" - ${result ? 'Auto-approved' : 'Requires approval'} (expected)`);
      } else {
        failCount++;
        console.log(`❌ "${testCase.position}" - ${result ? 'Auto-approved' : 'Requires approval'} (expected ${testCase.shouldApprove ? 'auto-approve' : 'requires approval'})`);
      }
    });
    
    console.log('');
    console.log(`Passed: ${passCount}/${testCases.length}`);
    console.log(`Failed: ${failCount}/${testCases.length}`);
    
    if (failCount === 0) {
      console.log('🎉 All tests passed!');
    } else {
      console.log('⚠️ Some tests failed');
    }
    
    console.log('');
    
  } catch (error) {
    console.error('❌ Test error:', error);
  } finally {
    db.close();
  }
}

runTests();

