/**
 * Database Backup Job
 *
 * Produces nightly hot backups of the SQLite database using VACUUM INTO,
 * which is atomic and safe with WAL writes in flight. Backups are gzipped
 * and rotated on the same persistent disk as the live DB. Retention:
 *
 *   - Last 7 daily backups
 *   - Plus any backup with a date that is the 1st or 15th of the month
 *     (kept indefinitely so we always have a coarse historical trail)
 *
 * Off-site (S3) backup is intentionally NOT bundled into this file. Once
 * AWS S3 credentials are wired up, add a small uploader inside
 * `runBackup` after `compressTo` succeeds. Keeping this file dep-free
 * means the local safety net works the moment the service restarts; no
 * env config or new packages required.
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { pipeline } = require('stream/promises');

const dbService = require('./dbService');
const { debugLog, debugWarn, debugError } = require('../debug');

let backupTimer = null;
let isRunning = false;
let lastBackupDate = null;

/**
 * Resolve the directory backups should live in. Default is a `backups/`
 * folder next to the live DB file, so on Render with
 * DATABASE_PATH=/data/expense_tracker.db the backups live at
 * /data/backups/. Override with `BACKUP_DIR` env var if you want them
 * elsewhere (e.g. a separate mounted volume).
 */
function getBackupDir() {
  if (process.env.BACKUP_DIR) {
    return process.env.BACKUP_DIR;
  }
  const dbPath = dbService.DB_PATH || path.join(__dirname, '..', 'expense_tracker.db');
  return path.join(path.dirname(dbPath), 'backups');
}

function ensureBackupDir() {
  const dir = getBackupDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

function getTodayDateString() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Ask SQLite to write a clean, defragmented copy of the live database to
 * `targetPath`. VACUUM INTO is atomic and works while other connections
 * are reading and writing — the snapshot reflects a consistent point in
 * time at the moment the statement begins.
 */
function vacuumIntoFile(targetPath) {
  return new Promise((resolve, reject) => {
    let db;
    try {
      db = dbService.getDb();
    } catch (err) {
      return reject(err);
    }
    // VACUUM INTO requires a string literal target; param substitution
    // is not allowed for the destination path. We escape single quotes
    // defensively even though our generated paths never contain them.
    const safePath = String(targetPath).replace(/'/g, "''");
    db.run(`VACUUM INTO '${safePath}'`, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

/**
 * Gzip the raw .db backup, then unlink the uncompressed file.
 */
async function gzipFile(srcPath, destPath) {
  const gzip = zlib.createGzip({ level: 6 });
  const source = fs.createReadStream(srcPath);
  const dest = fs.createWriteStream(destPath);
  await pipeline(source, gzip, dest);
}

/**
 * Apply the retention policy to backup files in `dir`.
 * - Keeps the 7 most recent daily backups
 * - Always keeps backups taken on the 1st or 15th of any month
 *   (cheap "long tail" history without growing unbounded)
 * - Removes everything else that matches our backup naming convention.
 */
function applyRetention(dir) {
  if (!fs.existsSync(dir)) return { kept: 0, removed: 0 };

  const entries = fs
    .readdirSync(dir)
    .filter((name) => /^expense_tracker-\d{4}-\d{2}-\d{2}\.db\.gz$/.test(name))
    .map((name) => {
      const match = name.match(/^expense_tracker-(\d{4})-(\d{2})-(\d{2})\.db\.gz$/);
      const dateStr = match ? `${match[1]}-${match[2]}-${match[3]}` : '';
      const day = match ? parseInt(match[3], 10) : 0;
      return { name, dateStr, day, fullPath: path.join(dir, name) };
    })
    .sort((a, b) => b.dateStr.localeCompare(a.dateStr)); // newest first

  let kept = 0;
  let removed = 0;
  const recentLimit = 7;

  entries.forEach((entry, index) => {
    const isInRecentWindow = index < recentLimit;
    const isMonthlyAnchor = entry.day === 1 || entry.day === 15;
    if (isInRecentWindow || isMonthlyAnchor) {
      kept++;
      return;
    }
    try {
      fs.unlinkSync(entry.fullPath);
      removed++;
    } catch (err) {
      debugWarn(`⚠️ Could not delete old backup ${entry.name}: ${err.message}`);
    }
  });

  return { kept, removed };
}

/**
 * Run a single backup pass: VACUUM INTO -> gzip -> rotate.
 * Returns metadata about the produced backup.
 */
async function runBackup() {
  const dir = ensureBackupDir();
  const dateStr = getTodayDateString();
  const tmpRaw = path.join(dir, `expense_tracker-${dateStr}.db.tmp`);
  const finalGz = path.join(dir, `expense_tracker-${dateStr}.db.gz`);

  // If a tmp from a previous failed run is hanging around, clear it.
  if (fs.existsSync(tmpRaw)) {
    try { fs.unlinkSync(tmpRaw); } catch (_) { /* ignore */ }
  }

  try {
    debugLog(`🗄️ Backup: starting VACUUM INTO -> ${tmpRaw}`);
    await vacuumIntoFile(tmpRaw);

    debugLog(`🗄️ Backup: gzipping -> ${finalGz}`);
    await gzipFile(tmpRaw, finalGz);

    try { fs.unlinkSync(tmpRaw); } catch (_) { /* ignore */ }

    const stats = fs.statSync(finalGz);
    const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);

    const retention = applyRetention(dir);

    debugLog(
      `✅ Backup complete: ${finalGz} (${sizeMB} MB), retention kept=${retention.kept} removed=${retention.removed}`
    );

    lastBackupDate = dateStr;
    return {
      success: true,
      dateStr,
      file: finalGz,
      sizeBytes: stats.size,
      sizeMB: Number(sizeMB),
      kept: retention.kept,
      removed: retention.removed,
    };
  } catch (err) {
    // Clean up tmp on failure so the next run starts fresh.
    try { if (fs.existsSync(tmpRaw)) fs.unlinkSync(tmpRaw); } catch (_) { /* ignore */ }
    debugError('❌ Backup failed:', err);
    return { success: false, dateStr, error: err.message };
  }
}

/**
 * Decide whether the scheduler should fire a backup right now. We
 * intentionally only run during a quiet window (default 02:00–04:00
 * local) and at most once per calendar date. Override the trigger hour
 * with BACKUP_HOUR (0–23) if your low-traffic window is different.
 */
function shouldRunNow() {
  const triggerHour = Number.parseInt(process.env.BACKUP_HOUR ?? '2', 10);
  const safeHour = Number.isFinite(triggerHour) && triggerHour >= 0 && triggerHour < 24
    ? triggerHour
    : 2;

  const now = new Date();
  const hour = now.getHours();
  if (hour < safeHour || hour >= safeHour + 2) {
    return false;
  }
  if (lastBackupDate === getTodayDateString()) {
    return false;
  }
  return true;
}

/**
 * Start the daily backup scheduler. Internally it polls every 30 minutes
 * and only fires a backup during the quiet window — much simpler than
 * setting up cron and works fine for a once-a-day job.
 */
function startBackupJob() {
  if (isRunning) {
    debugWarn('⚠️ Backup job is already running');
    return;
  }
  if (process.env.BACKUP_DISABLED === '1' || process.env.BACKUP_DISABLED === 'true') {
    debugLog('🗄️ Backup job is disabled via BACKUP_DISABLED');
    return;
  }

  isRunning = true;
  debugLog('🚀 Starting database backup scheduler (runs once nightly during quiet window)');

  // Probe immediately on startup so we close yesterday's gap if the
  // service was down at 02:00 local.
  if (shouldRunNow()) {
    runBackup().catch((err) => debugError('❌ Initial backup attempt failed:', err));
  }

  backupTimer = setInterval(() => {
    if (shouldRunNow()) {
      runBackup().catch((err) => debugError('❌ Scheduled backup attempt failed:', err));
    }
  }, 30 * 60 * 1000); // every 30 minutes

  debugLog('✅ Backup scheduler started');
}

function stopBackupJob() {
  if (!isRunning) return;
  isRunning = false;
  if (backupTimer) {
    clearInterval(backupTimer);
    backupTimer = null;
  }
  debugLog('🛑 Backup scheduler stopped');
}

/**
 * List existing backups (newest first). Useful for the admin endpoint.
 */
function listBackups() {
  const dir = getBackupDir();
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((name) => /^expense_tracker-\d{4}-\d{2}-\d{2}\.db\.gz$/.test(name))
    .map((name) => {
      const fullPath = path.join(dir, name);
      const stats = fs.statSync(fullPath);
      return {
        name,
        sizeBytes: stats.size,
        sizeMB: Number((stats.size / (1024 * 1024)).toFixed(2)),
        createdAt: stats.mtime.toISOString(),
      };
    })
    .sort((a, b) => b.name.localeCompare(a.name));
}

module.exports = {
  startBackupJob,
  stopBackupJob,
  runBackup,
  listBackups,
  getBackupDir,
};
