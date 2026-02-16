# Testing Error Prompts & Go Back

This guide covers how to verify the 403/404 error prompts and "Go back" / "Go to dashboard" behavior on both the **web portal** and **mobile app**.

---

## Web portal (admin-web)

### 1. Error boundary – "Go to dashboard"

**Goal:** See the error boundary UI and use "Go to dashboard" to return to Staff portal.

1. Start the web app: `cd admin-web && npm start`
2. Log in and switch to any portal other than Staff (e.g. Supervisor or Finance).
3. In the **Staff** portal, find the **"Test error boundary"** button (bottom-right corner, dev only).
4. Click it to trigger the error boundary.
5. You should see:
   - "Something went wrong"
   - Buttons: **"Go to dashboard"**, **"Try Again"**, **"Reload Page"**
6. Click **"Go to dashboard"** → app should stay on Staff portal and the error view should clear (you’re already on Staff).  
   To test switching back from another portal: switch to **Supervisor** (or Finance), then in the browser console run  
   `document.querySelector('[data-testid="error-boundary-trigger"]')?.click()`  
   (the dev button only appears in Staff portal). Then click **"Go to dashboard"** to return to Staff.

### 2. Report not found (404) – Load report

**Goal:** Load a report that doesn’t exist and see the prompt with "Stay here".

1. Log in to the **Staff** portal.
2. Use the header to pick a **month/year** that you know has **no** saved report (e.g. a future month or a month you never submitted).
3. Click **"Load report"** (or equivalent).
4. You should see a dialog:
   - Title: **"Report not found"**
   - Message about no report for that month/year.
   - Buttons: **"OK"** and **"Stay here"**.
5. Click **"Stay here"** or **"OK"** → dialog closes, you remain on the report page.

### 3. Submit / delete (403) – Staff portal

**Goal:** See the error prompt when the server returns 403 (e.g. not allowed).

- **Submit:** Try submitting a report when the backend would return 403 (depends on your backend rules; e.g. wrong approver, expired, etc.). You should get a dialog with "Could not submit report" and **"Back to report"**.
- **Start fresh / delete:** Same idea: if the backend returns 403 on delete, you should see a prompt with **"Back to report"** instead of only an alert.

### 4. Supervisor – Approve / request revision (403)

**Goal:** See the error prompt when approval or request revision returns 403.

1. Log in as a **Supervisor** and open a team member’s report.
2. If your backend returns 403 for that action (e.g. wrong approver), you should see:
   - **"Could not approve report"** or **"Could not request revision"**
   - Button **"Back to report"** or **"Back to list"**.

---

## Mobile app

### 1. Sync error with "Go back"

**Goal:** Trigger a sync failure that looks like 403/404 and see "Go back" in the alert.

1. Open the app and go to **Data sync** (or equivalent).
2. Force a failure that returns 403/404:
   - Turn off Wi‑Fi and try **Sync from cloud** (may get a network error; 403/404 would need backend to return that).
   - Or temporarily change the API base URL to an endpoint that returns 404 so the error message contains "404".
3. When the error is treated as a client error (403/404), the alert should have:
   - **"Go back"** and **"OK"**.
4. Tap **"Go back"** → you should return to the previous screen.

### 2. Force sync error

**Goal:** Same as above for **Force sync** (sync pending to web). If the error message indicates 403/404, the alert should offer **"Go back"**.

### 3. Add receipt – save failure (403/404)

**Goal:** When saving a receipt fails with a 403/404-style error, see "Go back".

1. Go to **Add receipt** and fill the form.
2. If the save fails and the error message contains 403/404 (e.g. from a future sync layer), the alert should show **"Go back"**.
3. Tap **"Go back"** → you should leave Add receipt and go back to the previous screen.

---

## Quick checklist

| Scenario                    | Where        | Expected UI / action                          |
|----------------------------|-------------|-----------------------------------------------|
| Error boundary             | Any portal  | "Go to dashboard" → switch to Staff           |
| Load report 404            | Staff       | "Report not found" + "Stay here"              |
| Load report error (4xx)    | Staff       | "Could not load report" + "Back to report"    |
| Submit report 403          | Staff       | "Could not submit report" + "Back to report"  |
| Delete report 403          | Staff       | "Could not delete report" + "Back to report" |
| Approve 403                | Supervisor  | "Could not approve report" + "Back to report"|
| Request revision 403      | Supervisor  | "Could not request revision" + "Back to list" |
| Sync failed (4xx)          | Mobile      | Alert with "Go back"                          |
| Force sync failed (4xx)    | Mobile      | Alert with "Go back"                          |
| Save receipt failed (4xx)  | Mobile      | Alert with "Go back"                          |

---

## Dev-only: trigger error boundary

When running the web app in development (`npm start`), the **Staff** portal shows a **"Test error boundary"** button in the bottom-right corner. Click it to trigger the error boundary and verify **"Go to dashboard"**, **"Try Again"**, and **"Reload Page"**.
