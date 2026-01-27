#!/usr/bin/env node
/**
 * Run from admin-web/backend: node scripts/check-hr-sync-env.js
 * Checks whether EMPLOYEE_API_TOKEN (or APPWARMER_EMPLOYEE_API_TOKEN) is set for HR sync.
 */
const path = require('path');
const fs = require('fs');

const envPath = path.join(__dirname, '..', '.env');
const exists = fs.existsSync(envPath);

require('dotenv').config({ path: envPath });

const token = process.env.EMPLOYEE_API_TOKEN || process.env.APPWARMER_EMPLOYEE_API_TOKEN;
const tokenSet = !!(token && String(token).trim());

console.log('HR Sync env check');
console.log('  .env path:', envPath);
console.log('  .env exists:', exists);
if (exists) {
  const raw = fs.readFileSync(envPath, 'utf8');
  const lines = raw.split(/\r?\n/).filter(l => l.trim());
  const uncommented = lines.filter(l => !l.trim().startsWith('#') && l.includes('='));
  console.log('  lines in .env:', lines.length, '(uncommented KEY=value:', uncommented.length + ')');
}
console.log('  EMPLOYEE_API_TOKEN set?', !!process.env.EMPLOYEE_API_TOKEN);
console.log('  APPWARMER_EMPLOYEE_API_TOKEN set?', !!process.env.APPWARMER_EMPLOYEE_API_TOKEN);
console.log('  Token ready for sync?', tokenSet);

if (!tokenSet) {
  console.log('\nTo fix: Edit', envPath);
  console.log('  Add one line (no # at the start):');
  console.log('    EMPLOYEE_API_TOKEN=your_token_here');
  console.log('  Or copy from .env.example and remove the # from EMPLOYEE_API_TOKEN, then paste your token after =.');
  console.log('  Save as UTF-8, restart the backend, then run this script again.');
}
