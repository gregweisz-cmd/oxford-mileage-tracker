#!/usr/bin/env node
/**
 * Test the Render backend from your machine (health + login endpoint).
 * Does not use real credentials; only checks that the API responds.
 *
 * Usage (from repo root or admin-web/backend):
 *   node admin-web/backend/scripts/maintenance/test-render-backend.js
 *   node scripts/maintenance/test-render-backend.js
 *
 * Or set BASE_URL to test a different backend:
 *   BASE_URL=https://your-service.onrender.com node scripts/maintenance/test-render-backend.js
 */

const BASE_URL = process.env.BASE_URL || 'https://oxford-mileage-backend.onrender.com';

async function test(name, method, path, body, expectStatus) {
  const url = path.startsWith('http') ? path : `${BASE_URL}${path}`;
  const opts = { method, headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(90000) };
  if (body && (method === 'POST' || method === 'PUT')) opts.body = JSON.stringify(body);
  try {
    const res = await fetch(url, opts);
    const ok = Array.isArray(expectStatus) ? expectStatus.includes(res.status) : res.status === expectStatus;
    if (ok) {
      console.log(`✅ ${name}: ${res.status}`);
      return true;
    }
    const text = await res.text();
    console.log(`❌ ${name}: expected ${expectStatus}, got ${res.status}`);
    if (text) console.log('   ', text.slice(0, 200));
    return false;
  } catch (e) {
    console.log(`❌ ${name}:`, e.message);
    return false;
  }
}

async function main() {
  console.log(`Testing Render backend: ${BASE_URL}\n`);

  const healthOk = await test('GET /health', 'GET', '/health', null, 200);
  const apiHealthOk = await test('GET /api/health', 'GET', '/api/health', null, [200, 503]);
  const loginReject = await test(
    'POST /api/employee-login (invalid creds → 401)',
    'POST',
    '/api/employee-login',
    { email: 'test-no-such-user@example.com', password: 'wrong' },
    401
  );

  console.log('');
  if (healthOk && apiHealthOk && loginReject) {
    console.log('All checks passed. Backend is reachable and login endpoint behaves correctly.');
    process.exit(0);
  }
  console.log('Some checks failed. Check URL and that the service is deployed.');
  process.exit(1);
}

main();
