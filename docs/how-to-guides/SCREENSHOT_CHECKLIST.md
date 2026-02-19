# Screenshot Checklist for How-To Guides

Checklist for capturing and saving screenshots used by the how-to PDFs. Use **exact filenames**; save paths are under each section.

**Current focus:** Start with Mobile App (11), then Staff Portal (14), then Supervisor (13) and Admin (13). All screenshots cleared — capture fresh after app/portal updates.

**Optional:** Use [TODAY_RUN_ORDER.md](TODAY_RUN_ORDER.md) as a run list if it exists (same screens in capture order).

**After saving screenshots:** Run `npm run generate` in `docs/how-to-guides/scripts/` to regenerate PDFs.

---

## 1. Mobile App (11) — save to `images/screenshots/mobile-app/`

- [ ] `app-store-download.png` — App/Play Store page (optional)
- [ ] `login-screen.png` — Login (logo + email/password)
- [ ] `home-screen.png` — Home overview
- [ ] `home-dashboard-full.png` — Full dashboard, all tiles (scroll to show all)
- [ ] `gps-tracking-screen.png` — GPS in progress (map + Stop)
- [ ] `manual-entry-screen.png` — Manual mileage entry form
- [ ] `receipt-capture-screen.png` — Add Receipt screen (or "Reading receipt image…" popup)
- [ ] `daily-hours-screen.png` — Daily Hours — **include "Go to today" in frame**
- [ ] `per-diem-screen.png` — Per Diem — **include "Go to today" in frame**
- [ ] `settings-screen.png` — Settings
- [ ] `saved-addresses-screen.png` — Saved addresses list

**Mobile subtotal:** 0 / 11

---

## 2. Staff Portal (14) — save to `images/screenshots/web-portal/`

- [ ] `staff-portal-login.png` — Staff login
- [ ] `staff-portal-portal-switcher.png` — Portal switcher dropdown in header (Finding/Selecting Portal section)
- [ ] `staff-portal-dashboard.png` — Dashboard/overview
- [ ] `staff-portal-submit.png` — Submit report button or dialog
- [ ] `staff-portal-overview.png` — Overview with tabs
- [ ] `staff-portal-mileage-tab.png` — Mileage Entries tab (date, start/end, miles, cost center, actions)
- [ ] `staff-portal-receipts-tab.png` — Receipts tab (Crop option)
- [ ] `staff-portal-hours-tab.png` — Hours Worked tab
- [ ] `staff-portal-descriptions-tab.png` — Daily Descriptions tab
- [ ] `staff-portal-monthly-summary.png` — Monthly Summary tab
- [ ] `staff-portal-submission-workflow.png` — Submit dialog (Monthly vs Weekly)
- [ ] `staff-portal-report-status.png` — Report status indicators
- [ ] `staff-portal-notifications.png` — Notification bell/panel
- [ ] `staff-portal-settings.png` — Settings / preferences

**Staff subtotal:** 0 / 14

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
| Staff Portal     | 14       | —        |
| Senior Staff     | —        | 4        |
| Supervisor       | 13       | —        |
| Admin Portal     | 13       | 6        |
| **Total**        | **51**   | 11       |

To mark done: change `- [ ]` to `- [x]` for each screenshot you've saved.
