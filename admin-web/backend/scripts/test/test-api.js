/**
 * API Test Script
 * Quick test script to verify backend API endpoints
 * Run with: node scripts/test/test-api.js
 *
 * Protected routes expect 401 without a token. To test authenticated access:
 *   AUTH_TOKEN=your-jwt node scripts/test/test-api.js
 */

const http = require('http');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3002';
const AUTH_TOKEN = process.env.AUTH_TOKEN || '';
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

function authHeaders() {
  const headers = { 'Content-Type': 'application/json' };
  if (AUTH_TOKEN.trim()) {
    headers.Authorization = `Bearer ${AUTH_TOKEN.trim()}`;
  }
  return headers;
}

/**
 * Make HTTP request
 */
function makeRequest(method, path, data = null, extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      method,
      headers: {
        ...authHeaders(),
        ...extraHeaders,
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
async function test(name, method, path, expectedStatus = 200, data = null, extraHeaders = {}) {
  try {
    const result = await makeRequest(method, path, data, extraHeaders);
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
  console.log(`Testing: ${BASE_URL}`);
  console.log(`Auth: ${AUTH_TOKEN.trim() ? 'Bearer token provided' : 'none (protected routes expect 401)'}\n`);

  // Health Check
  console.log(`${colors.yellow}Health Checks:${colors.reset}`);
  await test('GET /api/health', 'GET', '/api/health', 200);
  await test('GET /api', 'GET', '/api', 200);
  console.log('');

  // Auth expectations for protected data routes
  console.log(`${colors.yellow}Auth Guards (unauthenticated):${colors.reset}`);
  const protectedExpected = AUTH_TOKEN.trim() ? 200 : 401;
  await test('GET /api/mileage-entries (auth)', 'GET', '/api/mileage-entries', protectedExpected);
  await test('GET /api/receipts (auth)', 'GET', '/api/receipts', protectedExpected);
  await test('GET /api/time-tracking (auth)', 'GET', '/api/time-tracking', protectedExpected);
  await test('GET /api/expense-reports (auth)', 'GET', '/api/expense-reports', protectedExpected);
  await test('GET /api/dashboard-statistics (auth)', 'GET', '/api/dashboard-statistics', protectedExpected);
  await test('POST /api/init-database (admin auth)', 'POST', '/api/init-database', AUTH_TOKEN.trim() ? 403 : 401);
  console.log('');

  // Public-ish reference data (may still require auth depending on deployment)
  console.log(`${colors.yellow}Reference Endpoints:${colors.reset}`);
  await test('GET /api/receipts/categories', 'GET', '/api/receipts/categories', 200);
  await test('GET /api/cost-centers', 'GET', '/api/cost-centers', 200);
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

runTests().catch((error) => {
  console.error('Test runner failed:', error);
  process.exit(1);
});
