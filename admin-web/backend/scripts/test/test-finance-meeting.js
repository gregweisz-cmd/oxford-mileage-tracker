/**
 * Finance Meeting Regression Tests
 * Verifies finance-critical backend validations and workflows.
 * Run with: node scripts/test/test-finance-meeting.js
 */

const http = require('http');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3002';
const TEST_DATE = '2026-05-01';

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

const cleanup = {
  costCenterId: null,
  receiptIds: []
};

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
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try {
          const parsed = body ? JSON.parse(body) : {};
          resolve({ status: res.statusCode, data: parsed });
        } catch (err) {
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

async function runTest(name, fn) {
  try {
    await fn();
    console.log(`${colors.green}✓${colors.reset} ${name}`);
    passed += 1;
  } catch (error) {
    console.log(`${colors.red}✗${colors.reset} ${name} - ${error.message}`);
    failed += 1;
    issues.push({ name, error: error.message });
  }
}

function ensureStatus(result, expected, context) {
  if (result.status !== expected) {
    throw new Error(`${context}: expected ${expected}, got ${result.status} (${JSON.stringify(result.data)})`);
  }
}

async function safeDelete(path) {
  try {
    await makeRequest('DELETE', path);
  } catch (_err) {
    // cleanup best-effort only
  }
}

async function run() {
  console.log(`${colors.blue}=== Finance Meeting Regression Tests ===${colors.reset}`);
  console.log(`Testing: ${BASE_URL}\n`);

  let employeeId = null;
  let costCenterName = null;

  await runTest('Fetch employees for test setup', async () => {
    const result = await makeRequest('GET', '/api/employees');
    ensureStatus(result, 200, 'GET /api/employees');
    if (!Array.isArray(result.data) || result.data.length === 0) {
      throw new Error('No employees returned; cannot run finance regression tests.');
    }
    employeeId = result.data[0].id;
    if (!employeeId) {
      throw new Error('First employee did not include an id.');
    }
  });

  await runTest('Create cost center with Per Diem image requirement', async () => {
    costCenterName = `FIN QA ${Date.now()}`;
    const result = await makeRequest('POST', '/api/cost-centers', {
      name: costCenterName,
      description: 'Temporary finance regression test cost center',
      perDiemReceiptImageRequired: true,
      isActive: true
    });
    ensureStatus(result, 200, 'POST /api/cost-centers');
    cleanup.costCenterId = result.data.id;
    if (!cleanup.costCenterId) {
      throw new Error('Cost center create did not return id.');
    }
  });

  await runTest('Reject Per Diem receipt without image when required', async () => {
    const receiptId = `fm-no-image-${Date.now()}`;
    const result = await makeRequest('POST', '/api/receipts', {
      id: receiptId,
      employeeId,
      date: TEST_DATE,
      amount: 12.34,
      vendor: 'Per Diem',
      description: 'Per diem test without image',
      category: 'Per Diem',
      costCenter: costCenterName,
      imageUri: ''
    });
    ensureStatus(result, 400, 'POST /api/receipts (required image check)');
  });

  await runTest('Allow Per Diem receipt with image when required', async () => {
    const receiptId = `fm-with-image-${Date.now()}`;
    const result = await makeRequest('POST', '/api/receipts', {
      id: receiptId,
      employeeId,
      date: TEST_DATE,
      amount: 15.0,
      vendor: 'Per Diem',
      description: 'Per diem test with image',
      category: 'Per Diem',
      costCenter: costCenterName,
      imageUri: 'test-receipt-image.jpg'
    });
    ensureStatus(result, 200, 'POST /api/receipts (per diem success)');
    cleanup.receiptIds.push(receiptId);
  });

  await runTest('Reject split receipt when index exceeds count', async () => {
    const receiptId = `fm-split-invalid-${Date.now()}`;
    const result = await makeRequest('POST', '/api/receipts', {
      id: receiptId,
      employeeId,
      date: TEST_DATE,
      amount: 8.0,
      vendor: 'Split Test',
      description: 'Invalid split index check',
      category: 'Meals',
      costCenter: costCenterName,
      imageUri: 'split-image.jpg',
      splitGroupId: `group-${Date.now()}`,
      splitAllocationIndex: 3,
      splitAllocationCount: 2
    });
    ensureStatus(result, 400, 'POST /api/receipts (split index validation)');
  });

  await runTest('Allow valid split receipt metadata', async () => {
    const receiptId = `fm-split-valid-${Date.now()}`;
    const result = await makeRequest('POST', '/api/receipts', {
      id: receiptId,
      employeeId,
      date: TEST_DATE,
      amount: 8.0,
      vendor: 'Split Test',
      description: 'Valid split row',
      category: 'Meals',
      costCenter: costCenterName,
      imageUri: 'split-image.jpg',
      splitGroupId: `group-${Date.now()}`,
      splitAllocationIndex: 1,
      splitAllocationCount: 2
    });
    ensureStatus(result, 200, 'POST /api/receipts (split valid)');
    cleanup.receiptIds.push(receiptId);
  });

  for (const receiptId of cleanup.receiptIds) {
    await safeDelete(`/api/receipts/${receiptId}`);
  }
  if (cleanup.costCenterId) {
    await safeDelete(`/api/cost-centers/${cleanup.costCenterId}`);
  }

  console.log(`\n${colors.blue}=== Finance Test Summary ===${colors.reset}`);
  console.log(`${colors.green}Passed: ${passed}${colors.reset}`);
  console.log(`${colors.red}Failed: ${failed}${colors.reset}`);
  console.log(`Total: ${passed + failed}`);

  if (issues.length > 0) {
    console.log(`\n${colors.yellow}Issues:${colors.reset}`);
    issues.forEach((issue, i) => {
      console.log(`${i + 1}. ${issue.name} - ${issue.error}`);
    });
  }

  process.exit(failed > 0 ? 1 : 0);
}

run().catch(async (error) => {
  console.error(`${colors.red}Fatal Error:${colors.reset}`, error);
  for (const receiptId of cleanup.receiptIds) {
    await safeDelete(`/api/receipts/${receiptId}`);
  }
  if (cleanup.costCenterId) {
    await safeDelete(`/api/cost-centers/${cleanup.costCenterId}`);
  }
  process.exit(1);
});
