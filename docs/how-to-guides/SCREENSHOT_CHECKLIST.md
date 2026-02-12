# Screenshot Checklist for How-To Guides

**→ Use [TODAY_RUN_ORDER.md](TODAY_RUN_ORDER.md) as your run list** — same screens in capture order with exact filenames and save paths.

Check off each item below as you save it. Use **exact filenames**; save paths are under each section.

**After you're done:** Run `npm run generate` in `docs/how-to-guides/scripts/` to regenerate PDFs.

---

## 1. Mobile App (11) — save to `images/screenshots/mobile-app/`

- [ ] `app-store-download.png` — App/Play Store page (optional)
- [x] `login-screen.png` — Login (logo + email/password)
- [x] `home-screen.png` — Home overview
- [x] `home-dashboard-full.png` — Full dashboard, all tiles (scroll to show all)
- [x] `gps-tracking-screen.png` — GPS in progress (map + Stop)
- [x] `manual-entry-screen.png` — Manual mileage entry form
- [x] `receipt-capture-screen.png` — Add Receipt screen (or “Reading receipt image…” popup)
- [x] `daily-hours-screen.png` — Daily Hours — **include “Go to today” in frame**
- [x] `per-diem-screen.png` — Per Diem — **include “Go to today” in frame**
- [x] `settings-screen.png` — Settings
- [x] `saved-addresses-screen.png` — Saved addresses list

**Mobile subtotal:** 10 / 11

---

## 2. Staff Portal (14) — save to `images/screenshots/web-portal/`

- [x] `staff-portal-login.png` — Staff login
- [ ] `staff-portal-portal-switcher.png` — Portal switcher dropdown in header (Finding/Selecting Portal section)
- [x] `staff-portal-dashboard.png` — Dashboard/overview
- [x] `staff-portal-submit.png` — Submit report button or dialog
- [x] `staff-portal-overview.png` — Overview with tabs
- [x] `staff-portal-mileage-tab.png` — Daily Travel (Odometer Start/End if visible)
- [x] `staff-portal-receipts-tab.png` — Receipts tab (Crop option)
- [x] `staff-portal-hours-tab.png` — Hours Worked tab
- [x] `staff-portal-descriptions-tab.png` — Daily Descriptions tab
- [x] `staff-portal-monthly-summary.png` — Monthly Summary tab
- [x] `staff-portal-submission-workflow.png` — Submit dialog (Monthly vs Weekly)
- [x] `staff-portal-report-status.png` — Report status indicators
- [x] `staff-portal-notifications.png` — Notification bell/panel
- [x] `staff-portal-settings.png` — Settings / preferences

**Staff subtotal:** 13 / 14

---

## 3. Senior Staff Portal (optional) — save to `images/screenshots/web-portal/`

Optional screenshots for the Senior Staff how-to guide (e.g. `senior-staff-portal-dashboard.png`, `senior-staff-portal-approvals.png`, `senior-staff-portal-team.png`). The PDF is generated without placeholders if none are added.

- [ ] `senior-staff-portal-dashboard.png` — Senior Staff dashboard/overview
- [ ] `senior-staff-portal-approvals.png` — Approvals tab
- [ ] `senior-staff-portal-reports.png` — Reports tab
- [ ] `senior-staff-portal-team.png` — Team tab

**Senior Staff subtotal:** 0 / 4 (optional)

---

## 4. Supervisor Portal (13) — save to `images/screenshots/web-portal/`

- [ ] `supervisor-portal-login.png` — Supervisor login
- [ ] `supervisor-portal-dashboard.png` — Dashboard with KPIs
- [ ] `supervisor-portal-submit.png` — Submit (if applicable)
- [ ] `supervisor-portal-overview.png` — Overview with tabs
- [ ] `supervisor-portal-mileage-tab.png` — Mileage view
- [ ] `supervisor-portal-receipts-tab.png` — Receipts view
- [ ] `supervisor-portal-hours-tab.png` — Hours view
- [ ] `supervisor-portal-descriptions-tab.png` — Descriptions view
- [ ] `supervisor-portal-monthly-summary.png` — Monthly summary
- [ ] `supervisor-portal-submission-workflow.png` — Submission workflow
- [ ] `supervisor-portal-report-status.png` — Report status view
- [ ] `supervisor-portal-notifications.png` — Notifications
- [ ] `supervisor-portal-settings.png` — Settings

**Supervisor subtotal:** 0 / 13

---

## 5. Admin Portal (13) — save to `images/screenshots/web-portal/`

- [ ] `admin-portal-login.png` — Admin login
- [ ] `admin-portal-dashboard.png` — Admin dashboard
- [ ] `admin-portal-submit.png` — Submit (if applicable)
- [ ] `admin-portal-overview.png` — Overview with tabs
- [ ] `admin-portal-mileage-tab.png` — Mileage view
- [ ] `admin-portal-receipts-tab.png` — Receipts view
- [ ] `admin-portal-hours-tab.png` — Hours view
- [ ] `admin-portal-descriptions-tab.png` — Descriptions view
- [ ] `admin-portal-monthly-summary.png` — Monthly summary
- [ ] `admin-portal-submission-workflow.png` — Submission workflow
- [ ] `admin-portal-report-status.png` — Report status
- [ ] `admin-portal-notifications.png` — Notifications
- [ ] `admin-portal-settings.png` — Settings

**Admin subtotal:** 0 / 13

---

## 6. Admin Portal — optional extras (same folder: `images/screenshots/web-portal/`)

- [ ] `admin-portal-employee-management.png` — Individual Management tab
- [ ] `admin-portal-sync-from-hr.png` — **Sync from HR API** button (cloud icon next to Add Employee)
- [ ] `admin-portal-employee-form.png` — Add/Edit Employee form
- [ ] `admin-portal-supervisor-management.png` — Supervisor Management tab
- [ ] `admin-portal-cost-centers.png` — Cost Center Management
- [ ] `admin-portal-system-settings.png` — System Settings tab

---

## Summary

| Section          | Required | Optional |
|------------------|----------|----------|
| Mobile App       | 11       | 1        |
| Staff Portal     | 13       | —        |
| Senior Staff     | —        | 4        |
| Supervisor       | 13       | —        |
| Admin Portal     | 13       | 6        |
| **Total**        | **50**   | 11       |

To mark done: change `- [ ]` to `- [x]` for each screenshot you’ve saved.
