/**
 * Test script for extracted utility modules
 * Run with: node test-utils.js
 */

const helpers = require('./utils/helpers');
const dateHelpers = require('./utils/dateHelpers');
const constants = require('./utils/constants');

console.log('🧪 Testing Extracted Utility Modules\n');
console.log('=' .repeat(50));

// Test helpers
console.log('\n📦 Testing helpers.js:');
console.log('-'.repeat(50));

// Test getNetworkIPs
const networkIPs = helpers.getNetworkIPs();
console.log(`✅ getNetworkIPs(): Found ${networkIPs.length} IP(s):`, networkIPs);

// Test generateEmployeeId
const empId1 = helpers.generateEmployeeId('John Doe');
const empId2 = helpers.generateEmployeeId('Jane Smith');
console.log(`✅ generateEmployeeId('John Doe'): ${empId1}`);
console.log(`✅ generateEmployeeId('Jane Smith'): ${empId2}`);
console.log(`   (IDs should be different: ${empId1 !== empId2})`);

// Test generateDefaultPassword
const pwd1 = helpers.generateDefaultPassword('John Doe');
const pwd2 = helpers.generateDefaultPassword(null);
console.log(`✅ generateDefaultPassword('John Doe'): ${pwd1}`);
console.log(`✅ generateDefaultPassword(null): ${pwd2}`);

// Test parseJsonSafe
const json1 = helpers.parseJsonSafe('{"test": "value"}', {});
const json2 = helpers.parseJsonSafe('invalid json', {});
const json3 = helpers.parseJsonSafe(null, { default: true });
console.log(`✅ parseJsonSafe('{"test": "value"}', {}):`, json1);
console.log(`✅ parseJsonSafe('invalid json', {}):`, json2);
console.log(`✅ parseJsonSafe(null, { default: true }):`, json3);

// Test isFinancePosition
console.log(`✅ isFinancePosition('Finance Manager'): ${helpers.isFinancePosition('Finance Manager')}`);
console.log(`✅ isFinancePosition('Developer'): ${helpers.isFinancePosition('Developer')}`);

// Test isSupervisorPosition
console.log(`✅ isSupervisorPosition('Supervisor'): ${helpers.isSupervisorPosition('Supervisor')}`);
console.log(`✅ isSupervisorPosition('Employee'): ${helpers.isSupervisorPosition('Employee')}`);

// Test computeEscalationDueAt
const dueAt = helpers.computeEscalationDueAt(48);
console.log(`✅ computeEscalationDueAt(48): ${dueAt}`);

// Test dateHelpers
console.log('\n📅 Testing dateHelpers.js:');
console.log('-'.repeat(50));

const testDates = [
  '2025-01-15',
  '01/15/25',
  '1/15/2025',
  new Date(2025, 0, 15),
  '2025-01-15T12:00:00.000Z',
  'invalid-date'
];

testDates.forEach(date => {
  const normalized = dateHelpers.normalizeDateString(date);
  console.log(`✅ normalizeDateString(${JSON.stringify(date)}): ${normalized}`);
});

// Test constants
console.log('\n📋 Testing constants.js:');
console.log('-'.repeat(50));
console.log(`✅ COST_CENTERS.length: ${constants.COST_CENTERS.length}`);
console.log(`✅ SUPERVISOR_ESCALATION_HOURS: ${constants.SUPERVISOR_ESCALATION_HOURS}`);
console.log(`✅ FINANCE_ESCALATION_HOURS: ${constants.FINANCE_ESCALATION_HOURS}`);
console.log(`✅ Sample cost centers:`, constants.COST_CENTERS.slice(0, 5));

// Test password hashing (async)
console.log('\n🔐 Testing password functions (async):');
console.log('-'.repeat(50));

async function testPasswordFunctions() {
  const password = 'TestPassword123!';
  const hash = await helpers.hashPassword(password);
  console.log(`✅ hashPassword('${password}'): ${hash.substring(0, 20)}...`);
  
  const match = await helpers.comparePassword(password, hash);
  const noMatch = await helpers.comparePassword('WrongPassword', hash);
  console.log(`✅ comparePassword('${password}', hash): ${match}`);
  console.log(`✅ comparePassword('WrongPassword', hash): ${noMatch}`);
  
  // Test legacy password (plain text)
  const legacyMatch = await helpers.comparePassword('plaintext', 'plaintext');
  console.log(`✅ comparePassword('plaintext', 'plaintext') [legacy]: ${legacyMatch}`);
}

testPasswordFunctions().then(() => {
  console.log('\n' + '='.repeat(50));
  console.log('✅ All tests completed successfully!');
  console.log('='.repeat(50));
}).catch(err => {
  console.error('❌ Test error:', err);
  process.exit(1);
});

