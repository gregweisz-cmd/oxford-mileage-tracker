## Database Management and Redundancy

This document explains how the Oxford Mileage Tracker stores data today, how to make it safer and more redundant (especially on Render), and what alternative hosting options exist at roughly the same cost.

---

## 1. Current Database Setup

- **Primary database**: SQLite
  - File: `admin-web/backend/expense_tracker.db` (or path from `DATABASE_PATH` in `admin-web/backend/.env`).
- **File uploads**: Stored on the backend filesystem under `admin-web/backend/uploads/` (exact path may be configured in backend config).
- **Backup tooling**:
  - Script: `admin-web/backend/scripts/maintenance/backup-database.js`
  - Documentation: `admin-web/backend/scripts/maintenance/BACKUP_README.md`

### 1.1 Behavior on Render Free Tier

On the Render free tier:

- The **filesystem is ephemeral**:
  - The SQLite DB file and uploads live on the instance’s local disk.
  - On redeploy, restart, or if Render moves the app to a new host, that disk can be **wiped**.
- Result:
  - **Risk of data loss** for both the SQLite DB and uploaded files.
  - Backups stored on the same local disk do **not** protect against instance loss.

This means the free tier is effectively **non-durable** storage. It is fine for dev/test, but not acceptable for production data by itself.

---

## 2. Render Paid Tier and Persistent Disk

Moving to the paid tier alone does **not** automatically fix durability. The key improvement is to use a **Persistent Disk**.

### 2.1 Using a Persistent Disk

On a Render paid service:

- Attach a **Persistent Disk** (for example, mounted at `/data`).
- Configure the backend so that:
  - `DATABASE_PATH` points to something like `/data/expense_tracker.db`
  - Uploads directory is under `/data/uploads` (or similar).

Render Persistent Disks:

- Survive **restarts and redeploys** of the service.
- Are backed by **daily snapshots** (with short retention, e.g., ~7 days).

This addresses:

- Routine restarts / redeploys → data is kept.
- Short-term accidental data loss → can restore from a snapshot.

It does **not** fully protect against:

- Very long-term retention needs (months/years).
- Catastrophic loss of the disk + snapshots.

---

## 3. Backup Strategy

The centralized place to manage backups is the existing backup script and README:

- `admin-web/backend/scripts/maintenance/backup-database.js`
- `admin-web/backend/scripts/maintenance/BACKUP_README.md`

### 3.1 Local Backups (On the Same Host)

The backup script already supports:

- Creating **SQLite backups** of the main DB.
- Optional **verification** and **compression**.
- **Retention** of old backups (automatic cleanup).

See `BACKUP_README.md` for command examples such as:

- Basic backup:
  - `node scripts/maintenance/backup-database.js`
- Backup with verification, compression, and custom retention:
  - `node scripts/maintenance/backup-database.js --verify --compress --retention 90`

These backups are stored (by default) under:

- `admin-web/backend/backups/`

If that path is on a Render Persistent Disk (e.g., `/data/backups`), these backups survive redeploys. However, they are still on the **same disk** as the live DB and therefore not fully protected against disk-level failures.

### 3.2 Scheduled Backups

The backup README documents how to schedule backups:

- **Cron (Linux/Mac)**:
  - Add a cron job that `cd`s into `admin-web/backend` and runs the script nightly.
- **Windows Task Scheduler**:
  - Create a scheduled task that runs `node scripts/maintenance/backup-database.js`.
- **Render Cron Jobs**:
  - Configure a Render Cron Job to run:
    - `cd admin-web/backend && node scripts/maintenance/backup-database.js --verify --compress`
  - Target the backend service (e.g., `oxford-mileage-backend`).

This gives you **automated** backups without manual intervention.

### 3.3 Offsite / Cloud Backups (S3 or Similar)

For better redundancy, backups should be copied **off the Render disk** to an external storage provider. The backup script is structured to support S3 uploads (`--upload-s3` flag), with S3 upload marked as a “future” feature.

Recommended direction:

- Implement S3 (or equivalent) upload in `backup-database.js`:
  - Install AWS SDK.
  - Configure AWS credentials via environment variables.
  - Add env vars for S3 bucket name, folder/prefix, and region.
- Update the backup job to include `--upload-s3` so that each backup is:
  - Created locally, verified, compressed.
  - Then uploaded to S3 (or other object storage) for **offsite redundancy**.

This provides:

- Protection against:
  - Full disk failure.
  - Render-level incidents affecting storage.
- Longer-term retention (S3 lifecycle rules can handle months/years).

---

## 4. Recommended “Safe” Configuration on Render

For practical production safety on Render:

- **Step 1 – Persistent Disk**
  - Attach a disk and store:
    - SQLite DB (`DATABASE_PATH` under the disk mount).
    - Uploads folder under the disk mount.
    - Local backups under the disk mount.

- **Step 2 – Automated Local Backups**
  - Use `backup-database.js` with:
    - `--verify --compress`
    - Reasonable retention (e.g., 30–90 days).
  - Schedule via:
    - Render Cron Job, or
    - OS-level cron/task scheduler (for non-Render environments).

- **Step 3 – Offsite Backups**
  - Implement S3 (or similar) upload in the backup script.
  - Ensure each scheduled backup is also uploaded to cloud storage.

This combination (Persistent Disk + local backups + offsite backups) provides:

- Protection against deploy/restart.
- Protection against accidental DB corruption (recent backups).
- Protection against host/disk loss (offsite copies).

---

## 5. Alternatives to Render for Better Redundancy

In the long run, the biggest improvement in redundancy comes from using a **managed database service** instead of a single SQLite file on a disk.

Below are options at roughly similar cost to Render’s paid tier that provide better data redundancy.

### 5.1 Railway

- **Model**: App hosting + managed Postgres (or volumes).
- **Cost**: Pay-as-you-go (monthly credit, then usage; small apps often in the `$5–15/mo` range).
- **Redundancy**:
  - Suggested pattern is to use **managed Postgres** (with backups) instead of SQLite on a single volume.
  - Better than “one local SQLite file” because you get Postgres-level durability and backup tooling.
- **Fit**:
  - Good if you want a Render-like experience but are willing to move to Postgres and let Railway manage the DB.

### 5.2 Fly.io

- **Model**: Runs containers near users, plus **Fly Postgres**.
- **Cost**:
  - Small apps can run within a low monthly budget (~$5–20/mo depending on regions and DB size).
- **Redundancy**:
  - Fly Postgres supports:
    - Multiple replicas.
    - Automated backups.
    - Optional multi-region setups.
  - This is stronger redundancy than a single persistent disk with snapshots.
- **Fit**:
  - Ideal if you value multi-region or higher DB availability and are comfortable with a bit more DevOps configuration.

### 5.3 DigitalOcean App Platform + Managed DB

- **Model**: 
  - App Platform runs the Node backend.
  - Managed PostgreSQL hosts the data.
- **Cost**:
  - App Platform: small instances from around `$5–12/mo`.
  - Managed PostgreSQL: from around `$15/mo` (single node) and up (standby/HA).
- **Redundancy**:
  - Managed DB offers:
    - Daily backups.
    - Optional standby/HA configuration.
  - Clearly separates “compute” (stateless) from “database” (durable).
- **Fit**:
  - Good if you prefer predictable pricing and a conventional “app + managed DB” architecture.

### 5.4 Supabase

- **Model**: Postgres-based backend platform (DB + APIs + auth).
- **Cost**:
  - Free tier for dev.
  - Pro tier around `$25/mo` with more resources and better SLAs.
- **Redundancy**:
  - Managed Postgres with:
    - Automated backups.
    - Point-in-time recovery (on Pro).
    - Optional read replicas.
- **Fit**:
  - Strong choice if you are willing to adopt Postgres deeply:
    - Migrate schema from SQLite.
    - Potentially leverage Supabase’s auth/storage APIs.

### 5.5 General Pattern Across Alternatives

Common best practice:

- **App containers/services should be stateless**.
- **All durable data** (expense records, employees, uploads metadata, etc.) should live in:
  - A **managed database** (Postgres / MySQL / etc.), and
  - Optionally, **object storage** (S3-like) for large files and uploads.
- Local disks (or ephemeral filesystems) should be treated as **cache**, not the primary data store.

Any provider that:

- Gives you a managed DB with:
  - Automated backups,
  - Reasonable retention,
  - Optional replicas or HA,

will be safer than relying solely on a single SQLite file on a Render disk.

---

## 6. Practical Recommendations

- **Short term (on Render)**:
  - Use a **Persistent Disk**.
  - Ensure `DATABASE_PATH`, uploads, and backups are under that disk.
  - Schedule regular backups via `backup-database.js`.
  - Implement offsite backup (S3 or equivalent) as soon as practical.

- **Medium term**:
  - Plan a migration from SQLite to a managed Postgres instance (Render Postgres, Railway Postgres, Fly Postgres, DigitalOcean Managed DB, Supabase, etc.).
  - Treat the backend as stateless; only the managed DB and object storage hold durable data.

- **Long term**:
  - Use DB features like:
    - Point-in-time recovery.
    - Replication / HA where needed.
  - Keep simple operational runbooks:
    - “How to restore from backup.”
    - “How to rotate S3 credentials.”
    - “How to test that backups are restorable.”

This document should be the central reference for how database durability and redundancy are handled across environments (local dev, Render, and any future hosting platforms).

