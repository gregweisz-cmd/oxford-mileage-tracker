# Database Backup Script

Automated backup solution for the SQLite database.

## Quick Start

```bash
# Basic backup
node scripts/maintenance/backup-database.js

# Backup with verification and compression
node scripts/maintenance/backup-database.js --verify --compress

# Custom backup directory and retention
node scripts/maintenance/backup-database.js --output-dir ./my-backups --retention 60
```

## Features

- ✅ Automated database backup
- ✅ Backup verification (checks database integrity)
- ✅ Compression (gzip) to save space
- ✅ Automatic cleanup of old backups (configurable retention)
- ✅ Backup integrity verification
- ✅ S3 upload support (optional, requires AWS credentials)

## Options

- `--output-dir <path>` - Custom backup directory (default: `./backups`)
- `--retention <days>` - Number of days to keep backups (default: 30)
- `--verify` - Verify backup integrity after creation
- `--compress` - Compress backup file (gzip)
- `--upload-s3` - Upload to S3 (requires AWS credentials)

## Examples

### Daily Backup with Compression

```bash
node scripts/maintenance/backup-database.js --verify --compress --retention 90
```

### Backup to Specific Directory

```bash
node scripts/maintenance/backup-database.js --output-dir /path/to/backups
```

## Scheduled Backups

### On Linux/Mac (cron)

Add to crontab (`crontab -e`):
```bash
# Daily backup at 2 AM
0 2 * * * cd /path/to/project/admin-web/backend && node scripts/maintenance/backup-database.js --verify --compress --retention 30
```

### On Windows (Task Scheduler)

Create a scheduled task to run:
```powershell
cd C:\path\to\project\admin-web\backend
node scripts/maintenance/backup-database.js --verify --compress --retention 30
```

### On Render (using Cron Jobs)

1. Go to Render Dashboard → Cron Jobs
2. Create new cron job:
   - **Schedule**: `0 2 * * *` (daily at 2 AM)
   - **Command**: `cd admin-web/backend && node scripts/maintenance/backup-database.js --verify --compress`
   - **Service**: oxford-mileage-backend

## Backup Location

Default location: `admin-web/backend/backups/`

Backup files are named: `expense_tracker_YYYY-MM-DD_HH-MM-SS.db`

Compressed backups: `expense_tracker_YYYY-MM-DD_HH-MM-SS.db.gz`

## Restoring from Backup

### Restoring from Render disk snapshot (production)

If your backend uses a **Render persistent disk** (e.g. for `DATABASE_PATH`), Render automatically snapshots that disk about once every 24 hours. You can restore the **entire disk** to a snapshot to recover data (including employees) from before an accidental delete.

1. Go to [Render Dashboard](https://dashboard.render.com) → your **backend** service.
2. Open the **Disks** tab (or the disk attached to the service).
3. Find the list of **Snapshots** and pick one from **before** the data loss (snapshots are kept at least 7 days).
4. Use **Restore** for that snapshot.

**Important:**

- Restoring a snapshot is **irreversible** and overwrites all current disk data. Any changes after the snapshot (new employees, new reports, etc.) will be lost.
- You cannot restore only the database file; it’s a full-disk restore. Prefer this when the loss is severe (e.g. all employees deleted).

After restore, redeploy or restart the service so it uses the restored disk. Your `expense_tracker.db` (and employees) will be as they were at snapshot time.

To restore **only** the `employees` table from a backup file (e.g. a DB you copied from a snapshot) without replacing the whole disk, use:

```bash
node scripts/maintenance/restore-employees-from-git.js --from-file /path/to/backup.db
```

Set `DATABASE_PATH` to your current production DB path so employees are re-inserted into the live DB.

### Manual Restore (local or copied backup)

```bash
# Stop the server first
# Then copy backup to database location:
cp backups/expense_tracker_2024-11-15_02-00-00.db expense_tracker.db
```

### Verify Backup Before Restore

```bash
# Open backup with SQLite to verify:
sqlite3 backups/expense_tracker_2024-11-15_02-00-00.db "SELECT COUNT(*) FROM employees;"
```

## Backup Retention

Old backups are automatically deleted based on the retention period (default: 30 days).

To keep backups longer:
```bash
node scripts/maintenance/backup-database.js --retention 90
```

## Monitoring

The script outputs JSON to stdout:
```json
{
  "success": true,
  "backup": {
    "backupPath": "./backups/expense_tracker_2024-11-15_02-00-00.db",
    "size": 10485760,
    "timestamp": "2024-11-15T02:00:00.000Z"
  },
  "message": "Backup completed successfully"
}
```

Use this for logging/monitoring systems.

## Troubleshooting

### "Database file not found"
- Check that the database path is correct in `dbService.js`
- Ensure the server has been started at least once (creates database)

### "Cannot write to disk"
- Check disk space
- Check file permissions on backup directory
- Ensure backup directory exists and is writable

### Backup verification fails
- Backup may be corrupted
- Try creating a new backup
- Check disk errors

## S3 Upload (Future)

To enable S3 uploads, you'll need to:
1. Install AWS SDK: `npm install aws-sdk`
2. Configure AWS credentials (environment variables or IAM role)
3. Set S3 bucket name in script or environment variable

This feature is not yet implemented but the structure is ready.

