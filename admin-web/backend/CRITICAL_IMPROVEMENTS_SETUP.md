# Critical Improvements - Setup Guide

This guide covers setting up the critical improvements that were implemented.

---

## 1. ✅ Enhanced Health Check Endpoint

### Status: ✅ COMPLETE

The enhanced health check endpoint is now available at:
- `/api/health` - Comprehensive health check
- `/health` - Lightweight health check (for load balancers)

### What It Checks:
- Database connectivity
- Disk space/writability
- Memory usage (warns if >80%, critical if >90%)
- System uptime
- Email service status

### Usage:

```bash
# Check health
curl https://oxford-mileage-backend.onrender.com/api/health

# Response example:
{
  "status": "healthy",
  "timestamp": "2024-11-15T10:00:00.000Z",
  "version": "1.0.0",
  "checks": {
    "database": { "status": "healthy", "message": "Database connection successful" },
    "disk": { "status": "healthy", "message": "Disk is writable", "freeSpaceGB": "N/A" },
    "memory": { "status": "healthy", "message": "Memory usage is 45%", "usagePercent": 45 },
    "uptime": { "status": "healthy", "seconds": 86400 }
  },
  "services": {
    "email": { "status": "configured", "message": "Email service available" }
  }
}
```

---

## 2. ✅ Database Backup Automation

### Status: ✅ SCRIPT CREATED (Needs scheduling setup)

### Location:
- Script: `scripts/maintenance/backup-database.js`
- Documentation: `scripts/maintenance/BACKUP_README.md`

### Features:
- Automated database backup
- Backup verification
- Compression (gzip)
- Automatic cleanup of old backups
- Configurable retention period

### Quick Start:

```bash
# Basic backup
cd admin-web/backend
node scripts/maintenance/backup-database.js

# Backup with verification and compression
node scripts/maintenance/backup-database.js --verify --compress

# Custom retention (keep backups for 90 days)
node scripts/maintenance/backup-database.js --retention 90
```

### Setting Up Scheduled Backups:

#### Option 1: Render Cron Job (Recommended for Render deployments)

1. Go to Render Dashboard → Cron Jobs
2. Create new cron job:
   - **Schedule**: `0 2 * * *` (daily at 2 AM UTC)
   - **Command**: `cd admin-web/backend && node scripts/maintenance/backup-database.js --verify --compress --retention 30`
   - **Service**: oxford-mileage-backend

#### Option 2: Local Cron (Linux/Mac)

Add to crontab (`crontab -e`):
```bash
# Daily backup at 2 AM
0 2 * * * cd /path/to/oxford-mileage-tracker/admin-web/backend && node scripts/maintenance/backup-database.js --verify --compress --retention 30 >> /var/log/db-backup.log 2>&1
```

#### Option 3: Windows Task Scheduler

1. Open Task Scheduler
2. Create Basic Task
3. Set trigger: Daily at 2:00 AM
4. Action: Start a program
   - Program: `node`
   - Arguments: `scripts/maintenance/backup-database.js --verify --compress --retention 30`
   - Start in: `C:\path\to\oxford-mileage-tracker\admin-web\backend`

### Backup Location:
- Default: `admin-web/backend/backups/`
- Filename format: `expense_tracker_YYYY-MM-DD_HH-MM-SS.db`

---

## 3. ✅ Rate Limiting

### Status: ✅ COMPLETE

Rate limiting is now active on all API endpoints with different limits for different route types.

### Rate Limits Applied:

| Route Type | Limit | Window | Endpoint Examples |
|------------|-------|--------|-------------------|
| **General API** | 100 requests | 15 minutes | All `/api/*` routes |
| **Authentication** | 5 requests | 15 minutes | `/api/auth/login` |
| **Password Reset** | 3 requests | 1 hour | `/api/employees/:id/password` |
| **Admin** | 20 requests | 5 minutes | `/api/admin/*` |
| **File Upload** | 10 requests | 1 hour | `/api/receipts/upload-image` |

### What Happens When Limit Exceeded:

- HTTP 429 status code
- Error message: "Too many requests from this IP, please try again later"
- Retry-After header included
- Logged to console

### Customization:

Edit `middleware/rateLimiter.js` to adjust limits.

---

## 4. ⏳ Error Tracking Setup (Sentry)

### Status: ⏳ SETUP REQUIRED

### Step 1: Create Sentry Account

1. Go to https://sentry.io/signup/
2. Create a free account
3. Create a new project:
   - Platform: Node.js
   - Project name: "Oxford Mileage Tracker Backend"

### Step 2: Install Sentry SDK

```bash
cd admin-web/backend
npm install @sentry/node @sentry/profiling-node
```

### Step 3: Configure Sentry

Add to `server.js` (before other middleware):

```javascript
const Sentry = require("@sentry/node");
const { nodeProfilingIntegration } = require("@sentry/profiling-node");

Sentry.init({
  dsn: process.env.SENTRY_DSN, // Get from Sentry project settings
  integrations: [
    nodeProfilingIntegration(),
  ],
  tracesSampleRate: 1.0, // Capture 100% of transactions for performance monitoring
  profilesSampleRate: 1.0, // Capture 100% of profiles for performance monitoring
  environment: process.env.NODE_ENV || 'development',
});
```

### Step 4: Add Environment Variable

Add to Render environment variables:
- **Key**: `SENTRY_DSN`
- **Value**: Get from Sentry project settings → Client Keys (DSN)

### Step 5: Add Error Handler Middleware

Add to `middleware/errorHandler.js`:

```javascript
const Sentry = require("@sentry/node");

// Capture exceptions with Sentry
function sentryErrorHandler(err, req, res, next) {
  Sentry.captureException(err);
  next(err);
}
```

### Step 6: Test Error Tracking

Create a test endpoint to verify:

```javascript
router.get('/api/test-error', (req, res) => {
  throw new Error('Test error for Sentry');
});
```

Visit the endpoint and check Sentry dashboard.

### Alternative: Simple Error Logging

If you don't want to use Sentry yet, you can use the existing error handler which logs to console. This is acceptable for now but Sentry is recommended for production.

---

## 5. ⏳ Security Improvements (Remove Legacy Password Support)

### Status: ⏳ PENDING

### Issue:
The code still supports legacy plain text passwords (for migration purposes). This is a security risk.

### Action Required:

1. **Audit all passwords** - Check for any plain text passwords in database
2. **Create migration script** - Hash any remaining plain text passwords
3. **Remove legacy support** - Remove plain text comparison from `utils/helpers.js`

### Steps:

#### Step 1: Audit Passwords

```bash
cd admin-web/backend
node scripts/maintenance/audit-passwords.js
```

Create this script to check for plain text passwords.

#### Step 2: Migrate Plain Text Passwords

```bash
node scripts/maintenance/migrate-plain-text-passwords.js
```

This will hash any remaining plain text passwords.

#### Step 3: Remove Legacy Support

Edit `utils/helpers.js`:
- Remove plain text comparison fallback (lines 73-77)
- Require all passwords to be bcrypt hashed

---

## Summary Checklist

### ✅ Completed
- [x] Enhanced health check endpoint
- [x] Database backup script
- [x] Rate limiting middleware

### ⏳ Setup Required
- [ ] Schedule automated backups (cron/Task Scheduler)
- [ ] Set up Sentry error tracking (or alternative)
- [ ] Remove legacy password support
- [ ] Audit and migrate plain text passwords

---

## Next Steps

1. **Set up scheduled backups** (critical for production)
2. **Set up Sentry** (highly recommended for production debugging)
3. **Remove legacy password support** (security improvement)
4. **Test all improvements** in production environment

---

## Testing Checklist

Before going live, test:

- [ ] Health check endpoint returns correct status
- [ ] Backups are created successfully
- [ ] Backup restoration works
- [ ] Rate limiting prevents brute force attacks
- [ ] Error tracking captures errors (if Sentry set up)
- [ ] All rate limits are appropriate for your use case

---

For questions or issues, refer to:
- Backup: `scripts/maintenance/BACKUP_README.md`
- Status: `CRITICAL_IMPROVEMENTS_STATUS.md`

