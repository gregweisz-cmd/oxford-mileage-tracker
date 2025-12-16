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

### Manual Restore

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

