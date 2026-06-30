#!/usr/bin/env node
/**
 * Look up an employee in the Appwarmer HR feed (Rippling → Appwarmer).
 *
 * Usage (from admin-web/backend):
 *   node scripts/lookup-hr-employee.js smith
 *   node scripts/lookup-hr-employee.js jane.doe@oxfordhouse.org
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { diagnoseHrSync } = require('../services/externalEmployeeSync');

async function main() {
  const query = process.argv.slice(2).join(' ').trim();
  if (!query) {
    console.error('Usage: node scripts/lookup-hr-employee.js <name or email fragment>');
    process.exit(1);
  }

  const report = await diagnoseHrSync(query);
  console.log(JSON.stringify(report, null, 2));
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
