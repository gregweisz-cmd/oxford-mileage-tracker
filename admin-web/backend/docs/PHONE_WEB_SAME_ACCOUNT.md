# Phone and web showing different “Greg Weisz” (or same person, data not syncing)

If the person on your phone seems different from the one on the web portal, or if data from the phone doesn’t show up on the web, use these steps.

## 1. Same account (email)

- **Web:** You’re logged in with an email (e.g. greg.weisz@oxfordhouse.org).
- **Phone:** Log in with the **exact same email** (and same password) so both use the same backend account.
- The backend matches login by email **case-insensitively**, so `Greg.Weisz@...` and `greg.weisz@...` are the same account.

## 2. Log out and back in on the phone

After a restore or if things look wrong:

1. On the phone app: **Log out** (e.g. Settings → Log out).
2. Log back in with the **same email and password** you use on the web.
3. This refreshes the app’s idea of “current user” from the backend and helps sync use the correct employee.

## 3. Check for duplicate employees (backend)

If you’re not sure whether there are two “Greg Weisz” (or two records for the same email):

From `admin-web/backend`:

```bash
node scripts/maintenance/list-employees-by-email.js greg.weisz@oxfordhouse.org
# or by name
node scripts/maintenance/list-employees-by-email.js greg
```

- **One row:** One account; phone and web should be the same person if you use that email everywhere.
- **Multiple rows (same email):** Duplicates; you may need to merge or archive the extra one(s) so only one record is used.

## 4. Sync from the phone

- Open the app and go to **Data Sync** (or the screen that runs sync).
- Run **Sync** / “Sync now” and watch for errors.
- The app syncs to the backend using the **backend employee id** that matches your email. If login on the phone is using the same email as the web, sync writes to that same employee so the web portal should show the data.

## 5. Same backend (production)

- The app must talk to the **same** backend as the web (e.g. production: `https://oxford-mileage-backend.onrender.com`).
- In the app, `src/config/api.ts` (or your env) should use that URL so login and sync both hit production. If the phone was pointed at a different server, it would be a different “Greg Weisz” there.

---

## 6. Test Render backend from your machine

From the repo (no Render login needed):

```bash
node admin-web/backend/scripts/maintenance/test-render-backend.js
```

This checks:

- `GET /health` and `GET /api/health` return 200 (service is up; first request may take 30–60s if the service was sleeping).
- `POST /api/employee-login` with invalid credentials returns 401 (login endpoint works).

To test a different URL:

```bash
BASE_URL=https://your-service.onrender.com node admin-web/backend/scripts/maintenance/test-render-backend.js
```

---

## 7. Check for duplicate employees on Render (production DB)

The list script must run where the production database file is (on Render’s disk). Use **Render Shell**:

1. **Render Dashboard** → your backend service (e.g. **oxford-mileage-backend**) → **Shell** tab (or **Console**).
2. In the shell, set the database path and run (replace with your disk path if different):

   ```bash
   cd admin-web/backend
   export DATABASE_PATH=/data/expense_tracker.db
   node scripts/maintenance/list-employees-by-email.js greg.weisz@oxfordhouse.org
   ```

   Or search by name:

   ```bash
   node scripts/maintenance/list-employees-by-email.js greg
   ```

3. If you see **more than one row** with the same email, you have duplicates and should archive or merge the extra record(s).

---

**Summary:** Use the same email on phone and web, log out and back in on the phone, run sync, and use the list script to confirm there’s only one employee for that email if things still don’t match.
