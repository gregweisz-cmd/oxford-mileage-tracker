# Cost Center Page – Why It Keeps Breaking & How to Stop It

The Cost Center page (Program Services / Daily Descriptions in the Staff Portal) has had several different issues that can feel like “we fix it, then the next morning something’s broken again.” Here’s what’s going on and how to make it stay fixed.

---

## Why It Feels Like the Same Issue Every Morning

Several **different** problems can show up as “Cost Center page isn’t working”:

| What you see | Likely cause | What we fixed / what to check |
|--------------|---------------|-------------------------------|
| Data disappears after I click Save | Pending cell edit not included in save (you clicked Save without blurring the cell) | Flush in-progress edit before building payload in `handleSaveReport` |
| Data is gone the next morning (after backend restart) | Backend using ephemeral disk; DB wiped on restart | Use persistent disk + `DATABASE_PATH` / `UPLOAD_DIR`; see `RENDER_PERSISTENT_DISK_CHECKLIST.md` |
| Dates in the table don’t change when I change month/year | Table used `reportMonth`/`reportYear` instead of dropdown’s `currentMonth`/`currentYear` | All report body now uses `currentMonth`/`currentYear`; loading set on month change |
| “No such table: employees” on deploy | Seeding ran before tables existed | `seedService` waits for `employees` table before seeding |
| Page loads empty in the morning | Cold start: first request fails or returns empty; or wrong month/year on load | Optimistic update after save so refetch can’t overwrite with empty; ensure you’re testing the same env you deployed |

So it’s often **not** the same bug repeating; it’s different causes that look similar. Fixing one (e.g. persistence) can reveal the next (e.g. unflushed edit, then date mismatch).

---

## One-Time Checklist (Do This Once)

Use this to make sure the environment and deploy are correct so the Cost Center page stays working.

1. **Persistence**
   - Backend (e.g. Render) uses a **persistent disk** and it’s mounted (e.g. at `/data`).
   - Env vars are set: `DATABASE_PATH=/data/expense_tracker.db`, `UPLOAD_DIR=/data/uploads` (or your paths).
   - After a **backend restart**, open the Cost Center page and confirm data is still there. If it’s empty after restart, the DB is still ephemeral.

2. **Deploy after every fix**
   - Fixes only apply where the code runs. If you test locally but use production in the morning, production still has the old code.
   - After any Cost Center fix: commit, push, and **redeploy** the backend/frontend you actually use in the morning.

3. **Same environment morning vs evening**
   - If you test on `localhost` at night and on Render in the morning (or vice versa), you’re not testing the same app. Pick one (e.g. Render) and test there after each fix.

4. **Save flow**
   - After clicking Save, you should see “Report saved and synced successfully!” and the table should still show what you entered (including after a short “Processing changes…”).
   - If the table goes empty right after Save, the latest fix (flush + optimistic update) should prevent that; if it still happens, check browser network tab for `sync-to-source` and backend logs.

---

## What the Code Does Now (So You Know What to Rely On)

- **Before save:** Any in-progress cell edit (`editingCell` + `editingValue`) is flushed into the payload so the last typed value is never dropped.
- **After successful save:** The UI is updated optimistically with the data we just sent. Then we clear API cache, wait, and refetch. So even if a refetch were slow or wrong, the table wouldn’t be overwritten with empty.
- **On load:** Data comes from `/api/daily-descriptions` and `/api/time-tracking` for the **current** month/year (the dropdown). Cache for those endpoints is cleared on save and when the period changes.

If something still breaks “again” tomorrow, use the table above and this checklist to see which of these causes (persistence, deploy, env, save flow, or load) applies, and we can target that next.
