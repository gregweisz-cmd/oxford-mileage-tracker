/**
 * SQLite schema migration runner.
 *
 * Versioned, ordered, transactional schema migrations tracked via `PRAGMA user_version`.
 *
 * How this fits with the existing code:
 *   - `dbService.ensureTablesExist()` remains the FROZEN BASELINE that creates the current schema
 *     (CREATE TABLE IF NOT EXISTS ...). Do not keep adding ad-hoc `ALTER TABLE` blocks there.
 *   - ALL NEW schema changes from here on should be added as a migration entry in MIGRATIONS below.
 *   - On every boot, dbService runs ensureTablesExist() first, then runMigrations(), which applies
 *     any migration whose `version` is greater than the database's current `user_version`.
 *
 * Safety properties:
 *   - Each migration runs inside its own transaction; `user_version` is bumped in the SAME
 *     transaction, so a failed migration rolls back cleanly and is retried on the next boot.
 *   - Migrations are idempotent-friendly (prefer `IF NOT EXISTS` / guarded changes) and only ever
 *     run once per database because of the version gate.
 *   - An existing database with `user_version = 0` and an empty/older MIGRATIONS list is left
 *     untouched — adopting this runner is a no-op until a migration is actually added.
 *
 * Adding a migration (example):
 *   {
 *     version: 1,
 *     name: 'add report_locked_at to expense_reports',
 *     up: async (sql) => {
 *       await sql.run('ALTER TABLE expense_reports ADD COLUMN report_locked_at TEXT');
 *     },
 *   }
 *   - `version` must be a positive integer, unique, and strictly greater than the previous entry.
 *   - `up(sql)` receives a small async helper: sql.run(text, params?), sql.get(...), sql.all(...).
 */

const { debugLog, debugError, debugWarn } = require('../debug');

/**
 * Ordered list of schema migrations. Keep strictly increasing, contiguous-ish version numbers.
 * Empty by design at introduction — existing databases are unaffected until a migration is added.
 *
 * @type {Array<{ version: number, name: string, up: (sql: SqlHelper) => Promise<void> }>}
 */
const MIGRATIONS = [
  {
    version: 1,
    name: 'add portal column to notifications + backfill legacy rows',
    up: async (sql) => {
      const columns = await sql.all('PRAGMA table_info(notifications)');
      const hasPortal = columns.some((c) => c.name === 'portal');
      if (!hasPortal) {
        await sql.run('ALTER TABLE notifications ADD COLUMN portal TEXT');
      }

      // Best-effort backfill so per-portal filtering works for existing notifications.
      // New rows are written with an explicit, precise portal at the call site.
      await sql.run(
        `UPDATE notifications SET portal = 'staff'
          WHERE portal IS NULL
            AND type IN ('sunday_reminder', 'report_approved', 'report_rejected', 'weekly_checkup_accepted')`
      );
      await sql.run(
        `UPDATE notifications SET portal = 'supervisor'
          WHERE portal IS NULL
            AND type IN ('50_plus_hours_alert', 'report_submitted', 'weekly_checkup_shared')`
      );
      await sql.run(
        `UPDATE notifications SET portal = 'finance'
          WHERE portal IS NULL AND type = 'approval_needed' AND recipientRole = 'finance'`
      );
      await sql.run(
        `UPDATE notifications SET portal = 'supervisor'
          WHERE portal IS NULL AND type = 'approval_needed'`
      );
      await sql.run(
        `UPDATE notifications SET portal = 'staff'
          WHERE portal IS NULL AND type = 'revision_requested' AND recipientRole = 'employee'`
      );
      await sql.run(
        `UPDATE notifications SET portal = 'finance'
          WHERE portal IS NULL AND type = 'revision_requested' AND recipientRole = 'finance'`
      );
      await sql.run(
        `UPDATE notifications SET portal = 'supervisor'
          WHERE portal IS NULL AND type = 'revision_requested'`
      );
      // Catch-all for anything left (unknown/legacy types).
      await sql.run(`UPDATE notifications SET portal = 'staff' WHERE portal IS NULL`);
    },
  },
];

/**
 * @typedef {Object} SqlHelper
 * @property {(text: string, params?: any[]) => Promise<void>} run
 * @property {(text: string, params?: any[]) => Promise<any>} get
 * @property {(text: string, params?: any[]) => Promise<any[]>} all
 */

/** Build a small promise-based wrapper around the callback-style sqlite3 connection. */
function makeSqlHelper(db) {
  return {
    run: (text, params = []) =>
      new Promise((resolve, reject) => {
        db.run(text, params, (err) => (err ? reject(err) : resolve()));
      }),
    get: (text, params = []) =>
      new Promise((resolve, reject) => {
        db.get(text, params, (err, row) => (err ? reject(err) : resolve(row)));
      }),
    all: (text, params = []) =>
      new Promise((resolve, reject) => {
        db.all(text, params, (err, rows) => (err ? reject(err) : resolve(rows || [])));
      }),
  };
}

function getUserVersion(sql) {
  return sql.get('PRAGMA user_version').then((row) => {
    // sqlite returns { user_version: N }
    const value = row && typeof row.user_version === 'number' ? row.user_version : 0;
    return value;
  });
}

function setUserVersion(sql, version) {
  if (!Number.isInteger(version) || version < 0) {
    return Promise.reject(new Error(`Invalid schema version: ${version}`));
  }
  // PRAGMA does not support bound parameters; version is a validated server-side integer.
  return sql.run(`PRAGMA user_version = ${version}`);
}

/** Validate the MIGRATIONS table is well-formed (fail fast on a developer mistake). */
function validateMigrations() {
  let previous = 0;
  for (const migration of MIGRATIONS) {
    if (!Number.isInteger(migration.version) || migration.version <= 0) {
      throw new Error(`Migration "${migration.name}" has an invalid version: ${migration.version}`);
    }
    if (migration.version <= previous) {
      throw new Error(
        `Migrations must be strictly increasing; version ${migration.version} ("${migration.name}") is not greater than ${previous}`
      );
    }
    if (typeof migration.up !== 'function') {
      throw new Error(`Migration "${migration.name}" (v${migration.version}) is missing an up() function`);
    }
    previous = migration.version;
  }
}

/**
 * Apply any pending migrations to the connected database.
 * Throws if a migration fails (the caller should treat this as fatal and not start serving).
 *
 * @param {import('sqlite3').Database} db - an initialized sqlite3 connection
 * @returns {Promise<void>}
 */
async function runMigrations(db) {
  validateMigrations();

  const sql = makeSqlHelper(db);
  const currentVersion = await getUserVersion(sql);
  const pending = MIGRATIONS.filter((m) => m.version > currentVersion).sort((a, b) => a.version - b.version);

  if (pending.length === 0) {
    debugLog(`🗃️ Schema migrations: up to date (user_version=${currentVersion}).`);
    return;
  }

  debugLog(`🗃️ Schema migrations: ${pending.length} pending (from user_version=${currentVersion}).`);

  for (const migration of pending) {
    debugLog(`   ▶ Applying migration v${migration.version}: ${migration.name}`);
    await sql.run('BEGIN');
    try {
      await migration.up(sql);
      await setUserVersion(sql, migration.version);
      await sql.run('COMMIT');
      debugLog(`   ✅ Migration v${migration.version} applied.`);
    } catch (error) {
      try {
        await sql.run('ROLLBACK');
      } catch (rollbackError) {
        debugWarn('⚠️ Rollback after failed migration also failed:', rollbackError.message);
      }
      debugError(`❌ Migration v${migration.version} ("${migration.name}") failed:`, error.message);
      throw error;
    }
  }

  debugLog('🗃️ Schema migrations: complete.');
}

module.exports = {
  runMigrations,
  // Exported for testing/inspection.
  MIGRATIONS,
  validateMigrations,
};
