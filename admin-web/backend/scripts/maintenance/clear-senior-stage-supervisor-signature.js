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
 * By default this script scopes the cleanup to reports that are STILL at the senior-staff stage
 * (status = 'pending_senior_staff' or currentApprovalStage = 'senior_staff'). At that point the
 * supervisor has not yet entered the flow, so any `supervisorSignature` /
 * `supervisorCertificationAcknowledged` present was placed by the senior and is safe to remove.
 *
 * It intentionally does NOT touch reports already advanced to the supervisor (or beyond): a
 * supervisor may have legitimately uploaded their own signature there before approving, and any
 * stray senior signature self-heals as soon as the supervisor uploads/approves.
 *
 * --include-supervisor-pending: ALSO clean reports sitting at `pending_supervisor` whose
 * supervisor step has NOT yet been approved. This catches reports a senior already advanced
 * (carrying a stray senior signature into the supervisor's slot). It is safe to run as a one-time
 * migration right after deploying the senior-staff fix, BEFORE any supervisor signs under the new
 * flow. Caveat: if a supervisor pre-uploaded their own signature without approving yet, it would
 * also be cleared and they'd re-upload it — acceptable for a one-time cleanup.
 *
 * --list: read-only inventory. Print every report (ANY status) that currently carries a
 * supervisor signature, with employee name, month/year, status, and ID. Use this to find the
 * exact ID of a draft/needs-revision report (which the stage-scoped scans never touch) and then
 * clear it with --report-id=<id>.
 *
 * Usage:
 *   node scripts/maintenance/clear-senior-stage-supervisor-signature.js [--dry-run] [--verbose] [--include-supervisor-pending] [--report-id=<id>] [--list]
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
const INCLUDE_SUPERVISOR_PENDING = args.includes('--include-supervisor-pending');
const LIST_ONLY = args.includes('--list');
const REPORT_ID_ARG = args.find((a) => a.startsWith('--report-id='));
const REPORT_ID = REPORT_ID_ARG ? REPORT_ID_ARG.slice('--report-id='.length) : null;

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

function parseWorkflow(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// A report at the supervisor stage is only safe to clean if the supervisor has NOT approved yet
// (otherwise the signature is a legitimate, recorded supervisor approval and must be preserved).
function supervisorAlreadyApproved(workflow) {
  return workflow.some((step) => step && step.role === 'supervisor' && step.status === 'approved');
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

  // Read-only inventory: list every report (any status) that currently carries a supervisor
  // signature, so you can identify the exact report ID to target with --report-id.
  if (LIST_ONLY) {
    const employees = await all(`SELECT id, name, preferredName FROM employees`);
    const nameById = new Map(
      employees.map((e) => [e.id, e.preferredName || e.name || e.id])
    );
    const allReports = await all(
      `SELECT id, employeeId, month, year, status, currentApprovalStage, approvalWorkflow, reportData
         FROM expense_reports
        ORDER BY year DESC, month DESC`
    );
    let listed = 0;
    console.log('\nReports currently carrying a supervisor signature:');
    for (const row of allReports) {
      const data = parseReportData(row.reportData);
      const hasSig =
        data.supervisorSignature !== undefined &&
        data.supervisorSignature !== null &&
        data.supervisorSignature !== '';
      if (!hasSig) continue;
      listed++;
      const approved = supervisorAlreadyApproved(parseWorkflow(row.approvalWorkflow));
      console.log(
        `- ${row.id} | ${nameById.get(row.employeeId) || row.employeeId} | ` +
          `${row.month}/${row.year} | status ${row.status}` +
          `${approved ? ' | PROTECTED (supervisor approved)' : ''}`
      );
    }
    console.log(`\n${listed} report(s) with a supervisor signature.`);
    process.exit(0);
  }

  console.log(
    `Scanning for stray supervisor signatures (dry run: ${DRY_RUN}` +
      `${INCLUDE_SUPERVISOR_PENDING ? ', incl. pending_supervisor' : ''}` +
      `${REPORT_ID ? `, report ${REPORT_ID}` : ''})`
  );

  let rows;
  if (REPORT_ID) {
    rows = await all(
      `SELECT id, status, currentApprovalStage, approvalWorkflow, reportData
         FROM expense_reports
        WHERE id = ?`,
      [REPORT_ID]
    );
    if (rows.length === 0) {
      console.warn(`No report found with id ${REPORT_ID}.`);
    }
  } else {
    const seniorStageClause = `status = 'pending_senior_staff' OR LOWER(COALESCE(currentApprovalStage, '')) = 'senior_staff'`;
    const whereClause = INCLUDE_SUPERVISOR_PENDING
      ? `(${seniorStageClause}) OR status = 'pending_supervisor'`
      : seniorStageClause;
    rows = await all(
      `SELECT id, status, currentApprovalStage, approvalWorkflow, reportData
         FROM expense_reports
        WHERE ${whereClause}
        ORDER BY id ASC`
    );
  }

  let scanned = rows.length;
  let cleaned = 0;
  let noChange = 0;
  let updateErrors = 0;
  let parseSkipped = 0;
  let protectedApproved = 0;

  for (const row of rows) {
    let reportData;
    try {
      reportData = parseReportData(row.reportData);
    } catch (err) {
      parseSkipped++;
      console.warn(`Warning: ${row.id}: could not parse reportData - ${err.message}`);
      continue;
    }

    // Never strip a signature that backs a real supervisor approval. This protects
    // supervisor-stage reports (reached via --include-supervisor-pending or --report-id)
    // where the supervisor has already signed off; senior-stage reports never match this.
    if (supervisorAlreadyApproved(parseWorkflow(row.approvalWorkflow))) {
      protectedApproved++;
      if (VERBOSE) {
        console.log(`- ${row.id} (status ${row.status}) -> skipped: supervisor already approved`);
      }
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
  console.log(`  Scanned reports:                 ${scanned}`);
  console.log(`  ${DRY_RUN ? 'Would clear' : 'Cleared'}:                      ${cleaned}`);
  console.log(`  Already clean:                   ${noChange}`);
  if (protectedApproved > 0) {
    console.log(`  Protected (supervisor approved): ${protectedApproved}`);
  }
  if (parseSkipped > 0) {
    console.log(`  Skipped (bad reportData):        ${parseSkipped}`);
  }
  if (updateErrors > 0) {
    console.log(`  Update errors:                   ${updateErrors}`);
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
