# Screenshot Checklist for How-To Guides

Checklist for capturing and saving screenshots used by the how-to PDFs. Use **exact filenames**; save paths are under each section.

**Current focus:** Start with Mobile App (11), then Staff Portal (14), then Supervisor (6) and Admin (15). All web portals use the same login — one shared screenshot: `web-portal-login.png`. All screenshots cleared — capture fresh after app/portal updates.

**Optional:** Use [TODAY_RUN_ORDER.md](TODAY_RUN_ORDER.md) as a run list if it exists (same screens in capture order).

**After saving screenshots:** Run `npm run generate` in `docs/how-to-guides/scripts/` to regenerate PDFs.

---

## 1. Mobile App (10) — save to `images/screenshots/mobile-app/`

- [x] `login-screen.png` — Login (logo + email/password)
- [x] `home-screen.png` — Home overview
- [x] `home-dashboard-full.png` — Full dashboard, all tiles (scroll to show all)
- [x] `gps-tracking-screen.png` — GPS in progress (map + Stop)
- [x] `manual-entry-screen.png` — Manual mileage entry form
- [x] `receipt-capture-screen.png` — Add Receipt screen (or "Reading receipt image…" popup)
- [x] `daily-hours-screen.png` — Daily Hours — **include "Go to today" in frame**
- [x] `per-diem-screen.png` — Per Diem — **include "Go to today" in frame**
- [x] `settings-screen.png` — Settings
- [x] `saved-addresses-screen.png` — Saved addresses list

**Mobile subtotal:** 0 / 10

---

## 2. Staff Portal (14) — save to `images/screenshots/web-portal/`

- [x] `web-portal-login.png` — Login (shared by all web portals — Staff, Supervisor, Admin, Senior Staff)
- [x] `staff-portal-portal-switcher.png` — Portal switcher with Staff selected (optional for staff-only guide; regular staff don’t see the switcher—capture by logging in as supervisor/admin, then open switcher and select Staff)
- [x] `staff-portal-dashboard.png` — Dashboard/overview
- [x] `staff-portal-submit.png` — Submit report button or dialog
- [x] `staff-portal-overview.png` — Overview with tabs
- [x] `staff-portal-mileage-tab.png` — Mileage Entries tab (date, start/end, miles, cost center, actions)
- [x] `staff-portal-receipts-tab.png` — Receipts tab (Crop option)
- [x] `staff-portal-hours-tab.png` — Hours Worked tab
- [x] `staff-portal-descriptions-tab.png` — Daily Descriptions tab
- [x] `staff-portal-monthly-summary.png` — Monthly Summary tab
- [x] `staff-portal-submission-workflow.png` — Submit dialog (Monthly vs Weekly)
- [x] `staff-portal-report-status.png` — Report status indicators
- [x] `staff-portal-notifications.png` — Notification bell/panel
- [x] `staff-portal-settings.png` — Settings / preferences

**Staff subtotal:** 14 / 14

---

## 3. Senior Staff Portal (3) — save to `images/screenshots/web-portal/`

Optional screenshots for the Senior Staff how-to guide. (There is no separate Senior Staff dashboard; the portal opens to approvals/reports/team.)

- [x] `senior-staff-portal-approvals.png` — Approvals tab
- [x] `senior-staff-portal-reports.png` — Reports tab
- [x] `senior-staff-portal-team.png` — Team tab

**Senior Staff subtotal:** 3 / 3 (optional)

---

## 4. Supervisor Portal (6) — save to `images/screenshots/web-portal/`

- [x] `supervisor-portal-dashboard.png` — **Analytics** tab (Team Performance Analytics: KPIs and expense trend)
- [x] `supervisor-portal-overview.png` — Portal with tabs visible (Approvals, Reports, Team, Analytics)
- [x] `supervisor-portal-approvals.png` — **Approvals** tab (reports pending your review)
- [ ] `supervisor-portal-reports.png` — **Reports** tab (all team reports, filters)
- [x] `supervisor-portal-team.png` — **Team** tab (team members list)
- [x] `supervisor-portal-notifications.png` — Notification bell panel

**Supervisor subtotal:** 5 / 6

---

## 5. Admin Portal (15) — save to `images/screenshots/web-portal/`

- [x] `admin-portal-employee-management.png` — **Employee Management** → Individual Management (current employees table, Add Employee, Sync from HR, View Archived, search)
- [ ] `admin-portal-add-employee-button.png` — Zoomed screenshot showing the **Add Employee** button
- [x] `admin-portal-employee-form.png` — Add/Edit Employee form
- [x] `admin-portal-sync-from-hr.png` — Sync from HR API (cloud icon; can be in same frame as employee management)
- [ ] `admin-portal-sync-review-changes.png` — Sync from HR API → “Review Changes” prompt/dialog
- [x] `admin-portal-supervisor-management.png` — **Supervisor Management** tab
- [x] `admin-portal-cost-centers.png` — **Cost Center Management** tab
- [ ] `admin-portal-per-diem-rules-dialog.png` — Cost Center Management → **Edit Rules** prompt/dialog
- [ ] `admin-portal-edit-cost-center-dialog.png` — Cost Center Management → Edit Cost Center prompt/dialog
- [x] `admin-portal-reports-analytics.png` — **Reports & Analytics** tab
- [x] `admin-portal-travel-reasons.png` — **Travel Reasons** tab
- [x] `admin-portal-daily-description.png` — **Daily Description** (options) tab
- [x] `admin-portal-system-settings.png` — **System Settings** tab
- [x] `admin-portal-notifications.png` — Notification bell panel
- [ ] `admin-portal-edit-pencil-icon.png` — Small screenshot showing the pencil/edit icon in the Actions column

**Admin subtotal:** 10 / 15

---

## Summary

| Section          | Required | Optional |
|------------------|----------|----------|
| Mobile App       | 10       | —        |
| Staff Portal     | 14       | —        |
| Senior Staff     | —        | 3        |
| Supervisor       | 5        | —        |
| Admin Portal     | 15       | —        |
| **Total**        | **44**   | **4**    |

To mark done: change `- [ ]` to `- [x]` for each screenshot you've saved.
