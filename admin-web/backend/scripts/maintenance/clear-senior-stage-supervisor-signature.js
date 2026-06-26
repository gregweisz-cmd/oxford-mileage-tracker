#!/usr/bin/env node
/**
 * Clear erroneously-applied supervisor signatures from reports still at the senior-staff stage.
 *
 * Background: the Senior Staff portal was originally a copy of the Supervisor portal, so it
 * inherited the supervisor's "upload signature + certify before approving" step. That made
 * senior staff upload THEIR signature into `reportData.supervisorSignature` (the supervisor's
 * slot) just to approve. Senior staff are a review-only first pass and should not sign at all;
 * the signature belongs to the supervisor step. The code has been fixed so senior staff no
 * longer sign, but reports that were touched before the fix may still carry a stray signature.
 *
 * This script scopes the cleanup to reports that are STILL at the senior-staff stage
 * (status = 'pending_senior_staff' or currentApprovalStage = 'senior_staff'). At that point the
 * supervisor has not yet entered the flow, so any `supervisorSignature` /
 * `supervisorCertificationAcknowledged` present was placed by the senior and is safe to remove.
 *
 * It intentionally does NOT touch reports already advanced to the supervisor (or beyond): a
 * supervisor may have legitimately uploaded their own signature there before approving, and any
 * stray senior signature self-heals as soon as the supervisor uploads/approves.
 *
 * Usage:
 *   node scripts/maintenance/clear-senior-stage-supervisor-signature.js [--dry-run] [--verbose]
 *
 * Recommended:
 *   1. Run with `--dry-run` first to see how many reports would change.
 *   2. Take a backup (`POST /api/admin/backups/run`).
 *   3. Re-run without `--dry-run`.
 *
 * Safe to re-run: reports with no stray signature/acknowledgment are skipped.
 */

const dbService = require('../../services/dbService');

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const VERBOSE = args.includes('--verbose');

function parseReportData(raw) {
  if (!raw) return {};
  if (typeof raw === 'object') return raw;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

async function main() {
  await dbService.initDatabase();
  const db = dbService.getDb();

  const all = (sql, params = []) =>
    new Promise((resolve, reject) =>
      db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows || [])))
    );
  const run = (sql, params = []) =>
    new Promise((resolve, reject) =>
      db.run(sql, params, function (err) {
        if (err) reject(err);
        else resolve(this);
      })
    );

  console.log(
    `Scanning senior-stage reports for stray supervisor signatures (dry run: ${DRY_RUN})`
  );

  const rows = await all(
    `SELECT id, status, currentApprovalStage, reportData
       FROM expense_reports
      WHERE status = 'pending_senior_staff'
         OR LOWER(COALESCE(currentApprovalStage, '')) = 'senior_staff'
      ORDER BY id ASC`
  );

  let scanned = rows.length;
  let cleaned = 0;
  let noChange = 0;
  let updateErrors = 0;
  let parseSkipped = 0;

  for (const row of rows) {
    let reportData;
    try {
      reportData = parseReportData(row.reportData);
    } catch (err) {
      parseSkipped++;
      console.warn(`Warning: ${row.id}: could not parse reportData - ${err.message}`);
      continue;
    }

    const hadSignature =
      reportData.supervisorSignature !== undefined && reportData.supervisorSignature !== null && reportData.supervisorSignature !== '';
    const hadAck = reportData.supervisorCertificationAcknowledged !== undefined;

    if (!hadSignature && !hadAck) {
      noChange++;
      continue;
    }

    delete reportData.supervisorSignature;
    delete reportData.supervisorCertificationAcknowledged;

    if (VERBOSE) {
      console.log(
        `- ${row.id} (status ${row.status}, stage ${row.currentApprovalStage}) -> cleared` +
          `${hadSignature ? ' supervisorSignature' : ''}${hadAck ? ' supervisorCertificationAcknowledged' : ''}`
      );
    }

    if (DRY_RUN) {
      cleaned++;
      continue;
    }

    try {
      await run('UPDATE expense_reports SET reportData = ? WHERE id = ?', [
        JSON.stringify(reportData),
        row.id,
      ]);
      cleaned++;
    } catch (err) {
      updateErrors++;
      console.error(`Error: ${row.id}: update failed - ${err.message}`);
    }
  }

  console.log('\nCleanup summary');
  console.log(`  Scanned senior-stage reports: ${scanned}`);
  console.log(`  ${DRY_RUN ? 'Would clear' : 'Cleared'}:                   ${cleaned}`);
  console.log(`  Already clean:                ${noChange}`);
  if (parseSkipped > 0) {
    console.log(`  Skipped (bad reportData):     ${parseSkipped}`);
  }
  if (updateErrors > 0) {
    console.log(`  Update errors:                ${updateErrors}`);
  }

  if (DRY_RUN) {
    console.log('\nDry run only - no rows changed. Re-run without --dry-run to apply.');
  }

  // initDatabase() kicks off idempotent CREATE TABLE / CREATE INDEX work that may still be
  // in flight. Closing the handle while those run trips SQLITE_MISUSE, so just exit.
  const exitCode = updateErrors > 0 ? 1 : 0;
  process.exit(exitCode);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
