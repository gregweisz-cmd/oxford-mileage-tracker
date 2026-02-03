# Database Persistence Options (Render Backend)

**Purpose:** Brief for discussing with Director of Technology how to make the Oxford Mileage Tracker backend data persist across Render restarts/redeploys.

**Context:** The backend runs on Render (free tier). The database is SQLite and uploads live on the server filesystem. On Render's free tier the disk is ephemeral—**all data is lost on redeploy, restart, or after the instance spins down**. We need a path to persistent data.

---

## Option A: Pay for Render (Standard + Persistent Disk)

**What it is:** Upgrade the backend to a paid instance (e.g. Standard: 2 GB RAM, 1 CPU) and attach a Render Persistent Disk. Store the SQLite DB (and optionally uploads) on that disk.

**Pros**
- No application code changes; same stack (Node + SQLite).
- Single platform (Render); one dashboard, one deploy pipeline.
- Database and uploads persist across restarts and redeploys.
- Standard tier is sufficient for ~300 employees.

**Cons**
- Monthly cost (e.g. Standard ~$25/mo + disk; exact pricing on Render).
- Database remains SQLite (fine for this scale; no built-in replication/high availability).

**Rough effort:** Low. Upgrade plan, add disk, set `DATABASE_PATH` (and optionally upload path) to the disk mount. No code change if we only add env vars and the app already respects `DATABASE_PATH`.

---

## Option B: External PostgreSQL (Free or Low-Cost Hosted DB)

**What it is:** Use a hosted PostgreSQL database (e.g. Neon, Supabase, or Render PostgreSQL free tier). Migrate the backend from SQLite to PostgreSQL.

**Pros**
- Database persists regardless of where the app runs; survives restarts/redeploys.
- Free or low-cost tiers available (Neon, Supabase, Render Postgres).
- Proper relational DB; better long-term if we need backups, scaling, or multiple app instances.

**Cons**
- Requires backend migration: schema, all DB access code (SQLite → PostgreSQL), connection handling, env config.
- Non-trivial engineering effort (days to a couple of weeks depending on test coverage and rollout).
- Uploads still need a plan (same disk, or move to S3/R2 etc.) if we want them persistent.

**Rough effort:** Medium. Schema translation, replace `sqlite3` with `pg` (or similar), update queries for PostgreSQL syntax, add `DATABASE_URL` (or similar), test thoroughly.

---

## Comparison

| | Option A: Render Paid + Disk | Option B: PostgreSQL |
|---|-----------------------------|------------------------|
| **Cost** | ~$25+/mo (Render + disk) | $0–low (hosted Postgres free tier) |
| **Code changes** | None (or minimal env only) | Significant (migration) |
| **Effort** | Low | Medium |
| **Persistence** | Yes (disk survives restarts) | Yes (DB is external) |
| **Scalability** | Single instance, SQLite | Better for multi-instance / growth |

---

## Recommendation (for discussion)

- **Short term / least friction:** Option A. Fastest way to get persistent data with no code risk.
- **Long term / cost-sensitive:** Option B. More work upfront, but persistent DB and often lower or zero DB cost; makes sense if we're committed to this stack and may grow.

---

## Starter + Persistent Disk Setup (step-by-step)

Use this after upgrading to Starter (or any paid Render plan) so the SQLite DB and uploads survive restarts and redeploys.

### 1. Create a persistent disk in Render

1. In [Render Dashboard](https://dashboard.render.com), open your **oxford-mileage-backend** service.
2. Go to **Disks** (or **Storage** in the left sidebar).
3. Click **Add Disk**.
4. **Name:** e.g. `data`.
5. **Mount Path:** `/data` (Render will mount the disk at this path).
6. **Size:** e.g. 1 GB (adjust as needed; disk pricing is per GB).
7. Save. Render will attach the disk on the next deploy.

### 2. Set environment variables

In your service → **Environment** tab, add:

| Key | Value |
|-----|--------|
| `DATABASE_PATH` | `/data/expense_tracker.db` |
| `UPLOAD_DIR` | `/data/uploads` |

- **DATABASE_PATH** – SQLite file will be created here and persist across restarts.
- **UPLOAD_DIR** – Receipt/signature uploads will be stored here and persist. The app creates this directory on startup if it doesn’t exist.

### 3. Deploy

Trigger a new deploy (e.g. **Manual Deploy** → **Deploy latest commit**, or push a commit). On first run with the disk:

- The app will create `/data/expense_tracker.db` if it doesn’t exist (fresh DB) or use an existing one if you’ve restored a backup there.
- The app will create `/data/uploads` if it doesn’t exist.

### 4. (Optional) Restore existing data

If you had data on the old ephemeral disk and have a backup:

- Restore `expense_tracker.db` to `/data/expense_tracker.db` (e.g. via Render Shell or a one-off script that writes the file).
- Restore any uploaded files into `/data/uploads`.

After that, restarts and redeploys will keep using the data on the persistent disk.

---

## Current architecture (reference)

- **Mobile app:** Expo (will move to App Store / Play Store); talks to Render backend API.
- **Web portal:** Vercel; talks to Render backend API.
- **Backend:** Render (`admin-web/backend`); Node + SQLite + uploads on same server.
- **Database:** SQLite file on backend server filesystem (ephemeral on free tier; use persistent disk on Starter+ for persistence).
