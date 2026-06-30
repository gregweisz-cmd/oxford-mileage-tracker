/**
 * Read-only diagnostic: dump raw time_tracking + daily_descriptions rows for an
 * employee/month so we can see the EXACT `date` values stored in the DB.
 *
 * This is the ground truth for the "PTO/hours land on the wrong day" bug: if the
 * stored dates are already shifted, the bug is on the WRITE side; if they are
 * correct, the bug is on the READ/display side.
 *
 * Usage (run from admin-web/backend):
 *   node scripts/maintenance/inspect-time-tracking-dates.js --email=greg@example.com --month=6 --year=2026
 *   node scripts/maintenance/inspect-time-tracking-dates.js --name=weisz
 *   node scripts/maintenance/inspect-time-tracking-dates.js --employee-id=abc123 --month=6 --year=2026
 *
 * Month/year default to the current calendar month if omitted.
 */

const path = require('path');
const dbService = require('../../services/dbService');

function getArg(flag) {
  const prefix = `--${flag}=`;
  const match = process.argv.find((a) => a.startsWith(prefix));
  return match ? match.slice(prefix.length) : null;
}

const now = new Date();
const email = getArg('email');
const name = getArg('name');
const employeeId = getArg('employee-id');
const month = parseInt(getArg('month') || String(now.getMonth() + 1), 10);
const year = parseInt(getArg('year') || String(now.getFullYear()), 10);

const monthStr = String(month).padStart(2, '0');
const startDate = `${year}-${monthStr}-01`;
const endExclusive = `${month === 12 ? year + 1 : year}-${String(month === 12 ? 1 : month + 1).padStart(2, '0')}-01`;

const dbPath = process.env.DATABASE_PATH || path.join(__dirname, '../../../oxford_tracker.db');
dbService.initDatabase(dbPath);
const db = dbService.getDb();

console.log(`\n🔍 Inspecting stored dates for ${monthStr}/${year}`);
console.log(`   DB: ${dbPath}`);
console.log(`   Server timezone offset (min from UTC): ${now.getTimezoneOffset()} (0 = UTC)\n`);

function allAsync(sql, params) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows || [])));
  });
}

async function resolveEmployees() {
  if (employeeId) {
    return allAsync('SELECT id, name, email FROM employees WHERE id = ?', [employeeId]);
  }
  if (email) {
    return allAsync('SELECT id, name, email FROM employees WHERE LOWER(email) = LOWER(?)', [email]);
  }
  if (name) {
    return allAsync(
      'SELECT id, name, email FROM employees WHERE LOWER(name) LIKE ? ORDER BY name',
      [`%${name.toLowerCase()}%`]
    );
  }
  return allAsync(
    "SELECT id, name, email FROM employees WHERE LOWER(name) LIKE '%greg%' OR LOWER(name) LIKE '%weisz%' ORDER BY name",
    []
  );
}

(async () => {
  try {
    const employees = await resolveEmployees();
    if (employees.length === 0) {
      console.log('❌ No matching employee found. Pass --email=, --name=, or --employee-id=.');
      process.exit(0);
    }

    for (const emp of employees) {
      console.log('========================================================');
      console.log(`Employee: ${emp.name}  (id: ${emp.id})  ${emp.email || ''}`);
      console.log('========================================================');

      const timeRows = await allAsync(
        `SELECT id, date, category, hours, costCenter, createdAt, updatedAt
         FROM time_tracking
         WHERE employeeId = ? AND date >= ? AND date < ?
         ORDER BY date, category, costCenter`,
        [emp.id, startDate, endExclusive]
      );

      console.log(`\n  time_tracking rows (${timeRows.length}):`);
      if (timeRows.length === 0) {
        console.log('    (none)');
      } else {
        for (const r of timeRows) {
          const cat = r.category && r.category.trim() !== '' ? r.category : '(working)';
          const cc = r.costCenter && r.costCenter.trim() !== '' ? r.costCenter : '-';
          console.log(
            `    date=${String(r.date).padEnd(24)} ${String(cat).padEnd(16)} hours=${String(r.hours).padEnd(4)} cc=${String(cc).padEnd(14)} updatedAt=${r.updatedAt || ''}  id=${r.id}`
          );
        }
      }

      const descRows = await allAsync(
        `SELECT id, date, description, dayOff, dayOffType, costCenter, updatedAt
         FROM daily_descriptions
         WHERE employeeId = ? AND date >= ? AND date < ?
         ORDER BY date`,
        [emp.id, startDate, endExclusive]
      );

      console.log(`\n  daily_descriptions rows (${descRows.length}):`);
      if (descRows.length === 0) {
        console.log('    (none)');
      } else {
        for (const r of descRows) {
          const desc = (r.description || '').slice(0, 30);
          console.log(
            `    date=${String(r.date).padEnd(24)} dayOff=${String(!!r.dayOff).padEnd(5)} type=${String(r.dayOffType || '-').padEnd(10)} "${desc}"  id=${r.id}`
          );
        }
      }
      console.log('');
    }

    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err);
    process.exit(1);
  }
})();
