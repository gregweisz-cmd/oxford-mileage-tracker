# Production Operations: Backups & Uptime Monitoring

This guide covers the two operational pieces that keep the backend safe and observable in production:

1. **Nightly database backups** (built in, runs automatically — no setup required, but optional config available).
2. **Uptime monitoring** (external service, ~5-minute setup).

Both are intended for the production deployment on Render.

---

## 1. Database backups

### What runs out of the box

On every server start, `services/backupJob.js` is launched alongside the other scheduled jobs in `server.js`. Once a day, during a quiet window (default `02:00–04:00` server-local time), it:

1. Issues a `VACUUM INTO` to produce a clean, defragmented copy of the live SQLite database. This is a hot backup — it is safe with WAL writes in flight and reflects a consistent point in time at the moment the statement starts.
2. Gzips the resulting `.db` file.
3. Writes the compressed snapshot to `${BACKUP_DIR}/expense_tracker-YYYY-MM-DD.db.gz`.
4. Applies retention:
   - Keeps the **7 most recent daily backups**.
   - Always keeps backups dated the **1st or 15th of any month** (so you keep a coarse historical trail without growing unbounded).
   - Deletes anything else that matches the backup naming convention.

If the service was down at the scheduled hour, the next start triggers a backup immediately so we don't miss a day.

### Backup location

By default backups land next to the live database:

| `DATABASE_PATH` | Default `BACKUP_DIR` |
|---|---|
| `/data/expense_tracker.db` (Render persistent disk) | `/data/backups/` |
| `./expense_tracker.db` (local dev) | `./backups/` |

You can override with `BACKUP_DIR=/some/other/path` if you want the backups on a different mount.

### Optional environment variables

| Variable | Default | Effect |
|---|---|---|
| `BACKUP_DIR` | `<dir of DATABASE_PATH>/backups` | Where to write `.db.gz` files. |
| `BACKUP_HOUR` | `2` | Hour (0–23, server-local) the quiet window opens. The job runs once between this hour and `BACKUP_HOUR + 2`. |
| `BACKUP_DISABLED` | unset | Set to `1` or `true` to disable the scheduled job entirely (manual triggering still works). |

### Verifying it works

After deploying:

```bash
# Confirm the scheduled job started (look in service logs)
# You should see: "🚀 Starting database backup scheduler ..."

# Manually trigger a backup right now to verify
curl -X POST https://oxford-mileage-backend.onrender.com/api/admin/backups/run \
  -H "X-Admin-Token: $ADMIN_TOKEN"

# List all on-disk backups
curl https://oxford-mileage-backend.onrender.com/api/admin/backups \
  -H "X-Admin-Token: $ADMIN_TOKEN"
```

The `runBackup` response contains the resulting file path and size in MB.

### Restoring from a backup

Backups are gzipped raw SQLite files — restoring is straightforward:

```bash
# On the Render Shell tab (or via SSH if available)
cd /data
# Stop the service first via the Render dashboard so nothing writes during restore
gunzip -c backups/expense_tracker-2026-05-07.db.gz > expense_tracker.db
# Start the service back up via Render dashboard
```

Then verify in the app that the data matches what you expected from that day.

### Adding off-site (S3) backups

The current implementation keeps backups on the **same persistent disk** as the live DB. That is great for fast restore but does not protect against disk loss. Render takes its own daily disk snapshots, which gives one off-site copy. If you want a second off-site copy under your own control:

1. `npm install --save @aws-sdk/client-s3` in `admin-web/backend/`.
2. Add an S3 upload step inside `runBackup` in `services/backupJob.js`, gated on `process.env.BACKUP_S3_BUCKET`.
3. Reuse the existing `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` / `AWS_REGION` env vars (already used by SES).

Lifecycle rules on the S3 bucket can then handle longer-term retention and cold storage.

---

## 2. Uptime monitoring

The backend exposes two health endpoints, both **exempt from rate limiting**:

| Endpoint | Use it for |
|---|---|
| `GET /health` | Lightweight liveness check. Always returns `200 {"status":"ok",...}` if the process is up. Best for external uptime pollers. |
| `GET /api/health` | Comprehensive: returns DB connectivity, disk writability, memory usage, uptime. Returns `503` if any check is unhealthy. Good for dashboards. |

### Recommended setup: UptimeRobot (free tier is enough)

[UptimeRobot](https://uptimerobot.com) free tier gives you 50 monitors at 5-minute intervals — plenty for our needs.

1. Sign up at [uptimerobot.com](https://uptimerobot.com) (free, no credit card).
2. Click **+ New Monitor**.
3. Configure:
   - **Monitor Type:** HTTP(s)
   - **Friendly Name:** `Oxford Mileage Backend`
   - **URL:** `https://oxford-mileage-backend.onrender.com/health`
   - **Monitoring Interval:** 5 minutes
   - **Monitor Timeout:** 30 seconds (Render Starter cold starts take time)
4. **Alert Contacts:** add an email and/or SMS — UptimeRobot will notify you if the backend is unreachable for two consecutive checks.
5. Optionally add a second monitor pointing at `/api/health` and set it to alert on `503` so you find out if the service is up but the database is unhealthy.

### Alternative: Better Stack / BetterUptime

If you prefer a richer interface (status pages, on-call rotation), [Better Stack](https://betterstack.com/uptime) free tier covers up to 10 monitors at 3-minute intervals. Same setup — point an HTTP monitor at `/health`.

### Render's built-in healthcheck

Render is already polling `/health` (set in `admin-web/backend/render.yaml`). That check restarts the service if it fails — which is good — but it does not notify you. UptimeRobot fills that gap.

---

## Quick checklist before onboarding more users

- [ ] Backup job log appears on service start (`🚀 Starting database backup scheduler ...`).
- [ ] `POST /api/admin/backups/run` produces a file in `/data/backups/` and returns `success: true`.
- [ ] `/data/backups/` shows at least one `expense_tracker-*.db.gz` file after the first run.
- [ ] UptimeRobot monitor is green and you have a confirmed alert email.
- [ ] (Optional) S3 upload wired in if you want a second off-site copy.
