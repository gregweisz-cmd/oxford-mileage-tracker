/**
 * API Test Script
 * Quick test script to verify backend API endpoints
 * Run with: node scripts/test/test-api.js
 */

const http = require('http');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3002';
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m'
};

let passed = 0;
let failed = 0;
const issues = [];

/**
 * Make HTTP request
 */
function makeRequest(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(url, options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const parsed = body ? JSON.parse(body) : {};
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, data: body });
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

/**
 * Test an endpoint
 */
async function test(name, method, path, expectedStatus = 200, data = null) {
  try {
    const result = await makeRequest(method, path, data);
    const success = result.status === expectedStatus;
    
    if (success) {
      console.log(`${colors.green}✓${colors.reset} ${name}`);
      passed++;
    } else {
      console.log(`${colors.red}✗${colors.reset} ${name} - Expected ${expectedStatus}, got ${result.status}`);
      failed++;
      issues.push({ name, expected: expectedStatus, got: result.status, path });
    }
  } catch (error) {
    console.log(`${colors.red}✗${colors.reset} ${name} - Error: ${error.message}`);
    failed++;
    issues.push({ name, error: error.message, path });
  }
}

/**
 * Run all tests
 */
async function runTests() {
  console.log(`${colors.blue}=== API Endpoint Tests ===${colors.reset}\n`);
  console.log(`Testing: ${BASE_URL}\n`);

  // Health Check
  console.log(`${colors.yellow}Health Checks:${colors.reset}`);
  await test('GET /api/health', 'GET', '/api/health', 200);
  await test('GET /api', 'GET', '/api', 200);
  console.log('');

  // Employees
  console.log(`${colors.yellow}Employee Endpoints:${colors.reset}`);
  await test('GET /api/employees', 'GET', '/api/employees', 200);
  await test('GET /api/employees/archived', 'GET', '/api/employees/archived', 200);
  await test('GET /api/supervisors', 'GET', '/api/supervisors', 200);
  console.log('');

  // Mileage Entries
  console.log(`${colors.yellow}Mileage Entry Endpoints:${colors.reset}`);
  await test('GET /api/mileage-entries', 'GET', '/api/mileage-entries', 200);
  console.log('');

  // Receipts
  console.log(`${colors.yellow}Receipt Endpoints:${colors.reset}`);
  await test('GET /api/receipts', 'GET', '/api/receipts', 200);
  await test('GET /api/receipts/categories', 'GET', '/api/receipts/categories', 200);
  console.log('');

  // Time Tracking
  console.log(`${colors.yellow}Time Tracking Endpoints:${colors.reset}`);
  await test('GET /api/time-tracking', 'GET', '/api/time-tracking', 200);
  console.log('');

  // Expense Reports
  console.log(`${colors.yellow}Expense Report Endpoints:${colors.reset}`);
  await test('GET /api/expense-reports', 'GET', '/api/expense-reports', 200);
  console.log('');

  // Dashboard
  console.log(`${colors.yellow}Dashboard Endpoints:${colors.reset}`);
  await test('GET /api/dashboard/overview', 'GET', '/api/dashboard/overview', 200);
  await test('GET /api/dashboard/trends', 'GET', '/api/dashboard/trends', 200);
  console.log('');

  // Cost Centers
  console.log(`${colors.yellow}Cost Center Endpoints:${colors.reset}`);
  await test('GET /api/cost-centers', 'GET', '/api/cost-centers', 200);
  console.log('');

  // Notifications
  console.log(`${colors.yellow}Notification Endpoints:${colors.reset}`);
  await test('GET /api/notifications', 'GET', '/api/notifications', 200);
  console.log('');

  // Summary
  console.log(`\n${colors.blue}=== Test Summary ===${colors.reset}`);
  console.log(`${colors.green}Passed: ${passed}${colors.reset}`);
  console.log(`${colors.red}Failed: ${failed}${colors.reset}`);
  console.log(`Total: ${passed + failed}`);

  if (issues.length > 0) {
    console.log(`\n${colors.yellow}Issues Found:${colors.reset}`);
    issues.forEach((issue, i) => {
      console.log(`${i + 1}. ${issue.name}`);
      if (issue.expected) {
        console.log(`   Expected: ${issue.expected}, Got: ${issue.got}`);
      }
      if (issue.error) {
        console.log(`   Error: ${issue.error}`);
      }
      console.log(`   Path: ${issue.path}\n`);
    });
  }

  process.exit(failed > 0 ? 1 : 0);
}

// Run tests
runTests().catch(error => {
  console.error(`${colors.red}Fatal Error:${colors.reset}`, error);
  process.exit(1);
});

