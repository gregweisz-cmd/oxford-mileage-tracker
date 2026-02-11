# Screenshot Run Order — Use This While Capturing

**Save locations (from repo root):**
- **Mobile:** `docs/how-to-guides/images/screenshots/mobile-app/`
- **Web (all portals):** `docs/how-to-guides/images/screenshots/web-portal/`

**Tips:** Browser 1920×1080, 100% zoom. Mobile: device screenshot. Use **exact filenames** below. Tick in SCREENSHOT_CHECKLIST.md when saved.

---

## 1. Mobile App (fastest first — ~15 min)

Open the app (device or emulator). Do in this order; save each with the exact filename into `mobile-app/`.

| # | Filename | Navigate to | Capture |
|---|----------|-------------|---------|
| 1 | `login-screen.png` | Log out if needed → Login | Logo + email/password fields |
| 2 | `home-screen.png` | Log in → Home | Home overview (top stats) |
| 3 | `home-dashboard-full.png` | Home | Scroll to show all tiles (mileage summary, per diem, distance from BA, recent activity) |
| 4 | `daily-hours-screen.png` | Hours & Description tile | Full screen; **include "Go to today"** in month nav |
| 5 | `per-diem-screen.png` | Per Diem tile | Monthly view; **include "Go to today"** in month nav |
| 6 | `gps-tracking-screen.png` | Start GPS Tracking tile → start trip | Map + Stop button |
| 7 | `manual-entry-screen.png` | Manual Travel Entry tile | Manual mileage form (start/end, miles) |
| 8 | `receipt-capture-screen.png` | Add Receipt tile | Camera/upload or “Reading receipt…” if that shows |
| 9 | `settings-screen.png` | Settings (gear or menu) | Settings list |
| 10 | `saved-addresses-screen.png` | Saved Addresses | List of saved addresses |
| 11 | `app-store-download.png` | (optional) | App/Play Store page or skip |

---

## 2. Staff Portal (~20 min)

Open admin-web, log in as **Staff**. Save all to `web-portal/`.

| # | Filename | Navigate to | Capture |
|---|----------|-------------|---------|
| 1 | `staff-portal-login.png` | Staff login page | Login form |
| 2 | `staff-portal-dashboard.png` | After login | Dashboard/overview |
| 3 | `staff-portal-overview.png` | Report overview | Overview with tabs visible |
| 4 | `staff-portal-mileage-tab.png` | Daily Travel tab | Table (Odometer Start/End if visible) |
| 5 | `staff-portal-receipts-tab.png` | Receipts tab | Receipts list (Crop option if visible) |
| 6 | `staff-portal-hours-tab.png` | Hours Worked tab | Timesheet |
| 7 | `staff-portal-descriptions-tab.png` | Daily Descriptions tab | Descriptions list |
| 8 | `staff-portal-monthly-summary.png` | Monthly Summary tab | Summary view |
| 9 | `staff-portal-submit.png` | Submit report button | Button or dialog |
| 10 | `staff-portal-submission-workflow.png` | Click Submit Report | Dialog: Monthly vs Weekly |
| 11 | `staff-portal-report-status.png` | Any view with status | Draft / Submitted / Approved etc. |
| 12 | `staff-portal-notifications.png` | Notification bell | Notification panel |
| 13 | `staff-portal-settings.png` | Settings | Settings / preferences |

---

## 3. Supervisor Portal (~20 min)

Log in as **Supervisor** (or switch portal). Save to `web-portal/`.

| # | Filename | Navigate to | Capture |
|---|----------|-------------|---------|
| 1 | `supervisor-portal-login.png` | Supervisor login | Login form |
| 2 | `supervisor-portal-dashboard.png` | After login | Dashboard with KPIs |
| 3 | `supervisor-portal-overview.png` | Report overview | Overview with tabs |
| 4 | `supervisor-portal-mileage-tab.png` | Mileage/Daily Travel | Mileage view |
| 5 | `supervisor-portal-receipts-tab.png` | Receipts tab | Receipts view |
| 6 | `supervisor-portal-hours-tab.png` | Hours tab | Hours view |
| 7 | `supervisor-portal-descriptions-tab.png` | Descriptions tab | Descriptions view |
| 8 | `supervisor-portal-monthly-summary.png` | Monthly Summary | Summary |
| 9 | `supervisor-portal-submit.png` | Submit (if applicable) | Submit button/dialog |
| 10 | `supervisor-portal-submission-workflow.png` | Submission flow | Workflow dialog |
| 11 | `supervisor-portal-report-status.png` | Report view | Status indicators |
| 12 | `supervisor-portal-notifications.png` | Bell icon | Notifications |
| 13 | `supervisor-portal-settings.png` | Settings | Settings |

---

## 4. Admin Portal (~20 min)

Log in as **Admin**. Save to `web-portal/`.

| # | Filename | Navigate to | Capture |
|---|----------|-------------|---------|
| 1 | `admin-portal-login.png` | Admin login | Login form |
| 2 | `admin-portal-dashboard.png` | After login | Admin dashboard |
| 3 | `admin-portal-overview.png` | Report overview | Overview with tabs |
| 4 | `admin-portal-mileage-tab.png` | Mileage tab | Mileage view |
| 5 | `admin-portal-receipts-tab.png` | Receipts tab | Receipts view |
| 6 | `admin-portal-hours-tab.png` | Hours tab | Hours view |
| 7 | `admin-portal-descriptions-tab.png` | Descriptions tab | Descriptions view |
| 8 | `admin-portal-monthly-summary.png` | Monthly Summary | Summary |
| 9 | `admin-portal-submit.png` | Submit (if applicable) | Submit |
| 10 | `admin-portal-submission-workflow.png` | Submission | Workflow dialog |
| 11 | `admin-portal-report-status.png` | Report view | Status |
| 12 | `admin-portal-notifications.png` | Bell | Notifications |
| 13 | `admin-portal-settings.png` | Settings | Settings |

---

## 5. Admin Portal — Optional (if time)

Same folder: `web-portal/`.

| # | Filename | Navigate to | Capture |
|---|----------|-------------|---------|
| 1 | `admin-portal-employee-management.png` | Employee Management | Individual Management tab |
| 2 | `admin-portal-sync-from-hr.png` | Individual Management | **Sync from HR API** button (cloud icon by Add Employee) |
| 3 | `admin-portal-employee-form.png` | Add/Edit Employee | Employee form |
| 4 | `admin-portal-supervisor-management.png` | Supervisor Management | Tab |
| 5 | `admin-portal-cost-centers.png` | Cost Center Management | Cost centers |
| 6 | `admin-portal-system-settings.png` | System Settings | System Settings tab |

---

## After You’re Done

1. In **SCREENSHOT_CHECKLIST.md**, change `- [ ]` to `- [x]` for each screenshot you saved.
2. Regenerate PDFs:  
   `cd docs/how-to-guides/scripts && npm run generate`
