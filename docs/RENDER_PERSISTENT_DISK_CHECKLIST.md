# Render Persistent Disk Setup — Checklist

Use this checklist so the Oxford Mileage Tracker backend keeps data across restarts and redeploys.

**Backend service:** [Render Dashboard](https://dashboard.render.com) → **oxford-mileage-backend**

**Note:** The backend code uses `DATABASE_PATH` and `UPLOAD_DIR` from the environment (see `admin-web/backend/services/dbService.js`, `config/index.js`, and the data/export routes). Without these env vars set on Render, the app used default paths on the ephemeral disk, so data was lost on redeploy. After setting the env vars and redeploying, the app will use the persistent disk.

---

## Prerequisites

- [ ] Backend is on a **paid plan** (Starter or Standard) so you can add a disk.  
  *(Free tier = ephemeral disk only.)*

---

## 1. Create the persistent disk

- [ ] Open your **oxford-mileage-backend** service in the Render Dashboard.
- [ ] Go to **Disks** (or **Storage** in the left sidebar).
- [ ] Click **Add Disk**.
- [ ] Set **Name:** e.g. `data`.
- [ ] Set **Mount Path:** `/data`.
- [ ] Set **Size:** e.g. 1 GB (adjust as needed).
- [ ] Save. Render will attach the disk on the next deploy.

---

## 2. Set environment variables

- [ ] In the service, go to the **Environment** tab.
- [ ] Add **DATABASE_PATH** = `/data/expense_tracker.db`.
- [ ] Add **UPLOAD_DIR** = `/data/uploads`.
- [ ] Save changes.

---

## 3. Deploy

- [ ] Trigger a new deploy (**Manual Deploy** → **Deploy latest commit**, or push a commit).
- [ ] Wait for the deploy to finish.
- [ ] On first run with the disk, the app will create the DB and `uploads` folder on `/data` if they don’t exist.

---

## 4. (Optional) Restore existing data

*Only if you had data on the old ephemeral disk and have a backup.*

- [ ] Restore `expense_tracker.db` to `/data/expense_tracker.db` (e.g. via Render Shell).
- [ ] Restore any uploaded files into `/data/uploads`.

---

## Done

- [ ] Confirmed: after a restart or redeploy, report and Supervisor Management data (and uploads) are still there.

---

## Data not persisting after redeploy?

1. **Check Render logs** (Dashboard → your backend service → Logs) right after deploy. You should see:
   - `💾 Persistent disk: database will persist across redeploys (DATABASE_PATH is set)` — if you see this, the app is using the env var.
   - `⚠️ DATABASE_PATH is not set...` — data will not persist. Go to Environment and add `DATABASE_PATH` = `/data/expense_tracker.db`, then redeploy.
   - `📊 Database file size: X bytes` — if X is very small (e.g. under 50KB), the DB is likely new/empty (disk may be new or path wrong). If X is large, the existing DB is in use.

2. **Confirm env vars on Render:** Environment tab must have `DATABASE_PATH` = `/data/expense_tracker.db` and `UPLOAD_DIR` = `/data/uploads`. They are **per service**; redeploying does not clear them, but if the service was recreated or the tab was never set, they can be missing.

3. **Confirm the disk is attached:** Disks → the disk must show **Mount Path** `/data`. After adding a disk, a **new deploy** is required for the mount to appear.

4. **Same region:** The disk is attached to the service; redeploy uses the same service, so the same disk should mount. If you duplicated the service or created a new one, the new service has no disk until you add one.

---

*Full context and other options (e.g. PostgreSQL) are in [DATABASE_PERSISTENCE_OPTIONS.md](./DATABASE_PERSISTENCE_OPTIONS.md).*
