/**
 * Script to fix Greg Weisz employee ID on Render backend
 * 
 * This script:
 * 1. Deletes greg-testadd employee and all their data
 * 2. Changes Greg Weisz's ID from greg-weisz-001 to random format
 * 3. Updates all data to use the new ID
 * 
 * Run this on Render using:
 * node scripts/maintenance/fix-greg-weisz-id-render.js
 */

const https = require('https');
const http = require('http');

// Get Render backend URL from environment or use default
const RENDER_BACKEND_URL = process.env.RENDER_BACKEND_URL || process.env.BACKEND_URL || 'https://oxford-mileage-tracker.onrender.com';

const OLD_GREG_ID = 'greg-weisz-001';
const TESTADD_ID = 'greg-testadd-1761926170922-wwi4c';

// Generate new random ID in the same format as other employees
function generateNewEmployeeId() {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 9);
  return `emp-${timestamp}-${random}`;
}

const NEW_GREG_ID = generateNewEmployeeId();

console.log('🔄 Fixing Greg Weisz employee ID on Render backend...\n');
console.log(`Backend URL: ${RENDER_BACKEND_URL}`);
console.log(`Old ID: ${OLD_GREG_ID}`);
console.log(`TestAdd ID (will be deleted): ${TESTADD_ID}`);
console.log(`New ID: ${NEW_GREG_ID}\n`);

// Helper to make API requests
function makeRequest(url, method = 'GET', data = null) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      }
    };

    const req = (urlObj.protocol === 'https:' ? https : http).request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        try {
          const parsed = body ? JSON.parse(body) : {};
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(parsed);
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${JSON.stringify(parsed)}`));
          }
        } catch (e) {
          reject(new Error(`Parse error: ${e.message}, Body: ${body}`));
        }
      });
    });

    req.on('error', reject);
    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

async function fixEmployeeId() {
  try {
    // Step 1: Get Greg Weisz employee data
    console.log('📋 Step 1: Getting Greg Weisz employee data...');
    const employee = await makeRequest(`${RENDER_BACKEND_URL}/api/employees/${OLD_GREG_ID}`);
    console.log(`   ✅ Found: ${employee.name} (${employee.email || 'no email'})\n`);

    // Step 2: Delete greg-testadd employee and all their data
    console.log('🗑️  Step 2: Deleting greg-testadd employee and all their data...');
    
    // Get all data for testadd employee
    const [mileageEntries, receipts, timeTracking, descriptions] = await Promise.all([
      makeRequest(`${RENDER_BACKEND_URL}/api/mileage-entries?employeeId=${TESTADD_ID}`).catch(() => []),
      makeRequest(`${RENDER_BACKEND_URL}/api/receipts?employeeId=${TESTADD_ID}`).catch(() => []),
      makeRequest(`${RENDER_BACKEND_URL}/api/time-tracking?employeeId=${TESTADD_ID}`).catch(() => []),
      makeRequest(`${RENDER_BACKEND_URL}/api/daily-descriptions?employeeId=${TESTADD_ID}`).catch(() => [])
    ]);

    // Delete all data
    const deletePromises = [
      ...mileageEntries.map(e => makeRequest(`${RENDER_BACKEND_URL}/api/mileage-entries/${e.id}`, 'DELETE').catch(() => {})),
      ...receipts.map(r => makeRequest(`${RENDER_BACKEND_URL}/api/receipts/${r.id}`, 'DELETE').catch(() => {})),
      ...timeTracking.map(t => makeRequest(`${RENDER_BACKEND_URL}/api/time-tracking/${t.id}`, 'DELETE').catch(() => {})),
      ...descriptions.map(d => makeRequest(`${RENDER_BACKEND_URL}/api/daily-descriptions/${d.id}`, 'DELETE').catch(() => {}))
    ];

    await Promise.all(deletePromises);
    console.log(`   ✅ Deleted ${mileageEntries.length} mileage, ${receipts.length} receipts, ${timeTracking.length} time entries, ${descriptions.length} descriptions`);

    // Delete the employee
    await makeRequest(`${RENDER_BACKEND_URL}/api/employees/${TESTADD_ID}`, 'DELETE').catch(() => {});
    console.log(`   ✅ Deleted greg-testadd employee\n`);

    // Step 3: Get all data for Greg Weisz
    console.log('📊 Step 3: Getting all data for Greg Weisz...');
    const [gregMileage, gregReceipts, gregTime, gregDescriptions] = await Promise.all([
      makeRequest(`${RENDER_BACKEND_URL}/api/mileage-entries?employeeId=${OLD_GREG_ID}`).catch(() => []),
      makeRequest(`${RENDER_BACKEND_URL}/api/receipts?employeeId=${OLD_GREG_ID}`).catch(() => []),
      makeRequest(`${RENDER_BACKEND_URL}/api/time-tracking?employeeId=${OLD_GREG_ID}`).catch(() => []),
      makeRequest(`${RENDER_BACKEND_URL}/api/daily-descriptions?employeeId=${OLD_GREG_ID}`).catch(() => [])
    ]);

    console.log(`   Found: ${gregMileage.length} mileage, ${gregReceipts.length} receipts, ${gregTime.length} time entries, ${gregDescriptions.length} descriptions\n`);

    // Step 4: Update all data to use new ID
    console.log('🔄 Step 4: Updating all data to use new ID...');
    
    const updatePromises = [
      ...gregMileage.map(e => makeRequest(`${RENDER_BACKEND_URL}/api/mileage-entries/${e.id}`, 'PUT', { ...e, employeeId: NEW_GREG_ID }).catch(err => console.error(`   ⚠️ Error updating mileage ${e.id}:`, err.message))),
      ...gregReceipts.map(r => makeRequest(`${RENDER_BACKEND_URL}/api/receipts/${r.id}`, 'PUT', { ...r, employeeId: NEW_GREG_ID }).catch(err => console.error(`   ⚠️ Error updating receipt ${r.id}:`, err.message))),
      ...gregTime.map(t => makeRequest(`${RENDER_BACKEND_URL}/api/time-tracking/${t.id}`, 'PUT', { ...t, employeeId: NEW_GREG_ID }).catch(err => console.error(`   ⚠️ Error updating time ${t.id}:`, err.message))),
      ...gregDescriptions.map(d => makeRequest(`${RENDER_BACKEND_URL}/api/daily-descriptions/${d.id}`, 'PUT', { ...d, employeeId: NEW_GREG_ID }).catch(err => console.error(`   ⚠️ Error updating description ${d.id}:`, err.message)))
    ];

    await Promise.all(updatePromises);
    console.log(`   ✅ Updated all data to use new ID\n`);

    // Step 5: Create new employee record with new ID
    console.log('🔄 Step 5: Creating new employee record with new ID...');
    const newEmployee = {
      ...employee,
      id: NEW_GREG_ID
    };
    delete newEmployee.createdAt; // Let backend set this
    delete newEmployee.updatedAt; // Let backend set this

    await makeRequest(`${RENDER_BACKEND_URL}/api/employees`, 'POST', newEmployee);
    console.log(`   ✅ Created new employee record\n`);

    // Step 6: Delete old employee record
    console.log('🗑️  Step 6: Deleting old employee record...');
    await makeRequest(`${RENDER_BACKEND_URL}/api/employees/${OLD_GREG_ID}`, 'DELETE');
    console.log(`   ✅ Deleted old employee record\n`);

    console.log('✅ All done!\n');
    console.log('📋 Summary:');
    console.log(`   - Deleted greg-testadd employee and all their data`);
    console.log(`   - Changed Greg Weisz ID from ${OLD_GREG_ID} to ${NEW_GREG_ID}`);
    console.log(`   - Updated all data to use new ID\n`);
    console.log('💡 Next steps:');
    console.log(`   1. Update mobile app to use employee ID: ${NEW_GREG_ID}`);
    console.log(`   2. Log out and log back in to web portal`);
    console.log(`   3. Test that data syncs correctly\n`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

fixEmployeeId();
