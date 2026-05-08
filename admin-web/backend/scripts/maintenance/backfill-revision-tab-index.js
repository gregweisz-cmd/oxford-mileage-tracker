#!/usr/bin/env node
/**
 * Backfill `staffPortalTabIndex` on existing employee-facing revision notifications.
 *
 * The notifications table started storing `staffPortalTabIndex` in `metadata` after the
 * supervisor-revision deep-link change (commits `2ed171c` / `a61daf5`). Notifications
 * created before that change have no tab index, so the staff portal can't auto-jump to
 * the right tab when the user clicks "Open revisions" on an old alert.
 *
 * This script walks every `notifications` row with type=`revision_requested` and
 * recipientRole=`employee`, and for any row whose metadata is missing
 * `staffPortalTabIndex` it computes the value using the same helper the live
 * notification flow uses (`computeStaffPortalTabIndexForRevisionReport`), then writes
 * the merged metadata back.
 *
 * Usage:
 *   node scripts/maintenance/backfill-revision-tab-index.js [--dry-run] [--verbose]
 *
 * Recommended:
 *   1. Run with `--dry-run` first to see how many rows would change.
 *   2. Take a backup (`POST /api/admin/backups/run`).
 *   3. Re-run without `--dry-run`.
 *
 * Safe to re-run: rows that already have a numeric `staffPortalTabIndex` are skipped.
 */

const dbService = require('../../services/dbService');
const {
  computeStaffPortalTabIndexForRevisionReport,
} = require('../../services/notificationService');

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const VERBOSE = args.includes('--verbose');

function parseMetadata(raw) {
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
    `Scanning revision notifications for missing staffPortalTabIndex (dry run: ${DRY_RUN})`
  );

  const rows = await all(
    `SELECT id, reportId, employeeId, metadata, createdAt
       FROM notifications
      WHERE type = 'revision_requested'
        AND recipientRole = 'employee'
        AND reportId IS NOT NULL
        AND employeeId IS NOT NULL
      ORDER BY createdAt ASC`
  );

  let alreadyHas = 0;
  let backfilled = 0;
  let updateErrors = 0;
  let computeErrors = 0;
  let zeroIndex = 0;

  for (const row of rows) {
    const meta = parseMetadata(row.metadata);

    if (typeof meta.staffPortalTabIndex === 'number') {
      alreadyHas++;
      continue;
    }

    let idx;
    try {
      idx = await computeStaffPortalTabIndexForRevisionReport(row.reportId, row.employeeId);
    } catch (err) {
      computeErrors++;
      console.warn(`Warning: ${row.id}: failed to compute tab index - ${err.message}`);
      continue;
    }

    if (typeof idx !== 'number' || Number.isNaN(idx)) {
      idx = 0;
    }
    if (idx === 0) zeroIndex++;

    const newMeta = { ...meta, staffPortalTabIndex: idx };
    if (VERBOSE) {
      console.log(
        `- ${row.id} (report ${row.reportId}, employee ${row.employeeId}, created ${row.createdAt}) -> tabIndex ${idx}`
      );
    }

    if (DRY_RUN) {
      backfilled++;
      continue;
    }

    try {
      await run('UPDATE notifications SET metadata = ? WHERE id = ?', [
        JSON.stringify(newMeta),
        row.id,
      ]);
      backfilled++;
    } catch (err) {
      updateErrors++;
      console.error(`Error: ${row.id}: update failed - ${err.message}`);
    }
  }

  console.log('\nBackfill summary');
  console.log(`  Scanned:                 ${rows.length}`);
  console.log(`  Already had tab index:   ${alreadyHas}`);
  console.log(`  ${DRY_RUN ? 'Would backfill' : 'Backfilled'}:          ${backfilled}`);
  console.log(`    of which tabIndex=0:   ${zeroIndex} (no unresolved revision notes left)`);
  if (computeErrors > 0) {
    console.log(`  Compute errors:          ${computeErrors}`);
  }
  if (updateErrors > 0) {
    console.log(`  Update errors:           ${updateErrors}`);
  }

  if (DRY_RUN) {
    console.log('\nDry run only - no rows changed. Re-run without --dry-run to apply.');
  }

  // initDatabase() kicks off idempotent CREATE TABLE / CREATE INDEX work that may still be
  // in flight in the background. Calling db.close() while those run trips SQLITE_MISUSE.
  // The work is harmless on re-run, so just exit and let Node tear the handle down.
  const exitCode = updateErrors > 0 ? 1 : 0;
  process.exit(exitCode);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
