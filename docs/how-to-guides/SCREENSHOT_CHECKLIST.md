# Screenshot Checklist for How-To Guides

Checklist for capturing and saving screenshots used by the how-to PDFs. Use **exact filenames**; save paths are under each section.

**Current focus (May 2026):** Capture **new** screenshots below and **refresh** any marked 🔄 so PDFs match Timesheet, GPS stationary, and revision UX. All web portals share login: `web-portal-login.png`.

See `FEATURES_UPDATE.md` for the full change log.

**Optional:** Use [TODAY_RUN_ORDER.md](TODAY_RUN_ORDER.md) as a run list if it exists (same screens in capture order).

**After saving screenshots:** Run `npm run generate` in `docs/how-to-guides/scripts/` to regenerate PDFs.

---

## 1. Mobile App (10) — save to `images/screenshots/mobile-app/`

- [x] `login-screen.png` — Login (logo + email/password)
- [x] `home-screen.png` — Home overview
- [x] `home-dashboard-full.png` — Full dashboard, all tiles (scroll to show all)
- [ ] `gps-tracking-screen.png` — 🔄 **Refresh:** GPS in progress (legible labels on Android dark mode; pause/stop UI)
- [x] `manual-entry-screen.png` — Manual mileage entry form
- [x] `receipt-capture-screen.png` — Add Receipt screen (or "Reading receipt image…" popup)
- [x] `daily-hours-screen.png` — Daily Hours — **include "Go to today" in frame**
- [x] `per-diem-screen.png` — Per Diem — **include "Go to today" in frame**
- [x] `settings-screen.png` — Settings
- [x] `saved-addresses-screen.png` — Saved addresses list

- [ ] `mobile-gps-stationary-prompt.png` — Stationary notification or in-app “Still tracking your trip?” modal
- [ ] `mobile-gps-global-controls.png` — Global GPS chip (distance + stop) on Home or another screen while tracking
- [ ] `mobile-gps-pause-mileage.png` — Trip options with Pause / Resume mileage (optional)

**Mobile subtotal:** 3 new + 1 refresh pending (see also section 1 legacy 10)

---

## 2. Staff Portal (22) — save to `images/screenshots/web-portal/`

- [x] `web-portal-login.png` — Login (shared by all web portals — Staff, Supervisor, Admin, Senior Staff)
- [x] `staff-portal-portal-switcher.png` — Portal switcher with Staff selected (optional for staff-only guide; regular staff don’t see the switcher—capture by logging in as supervisor/admin, then open switcher and select Staff)
- [x] `staff-portal-dashboard.png` — Dashboard/overview
- [x] `staff-portal-month-year-selector.png` — Zoomed-in month/year selector controls (top of portal)
- [x] `staff-portal-navigation-tabs.png` — Zoomed-in top tab navigation bar (Approval Cover Sheet, Summary Sheet, Mileage, etc.)
- [x] `staff-portal-submit.png` — Submit report button or dialog
- [x] `staff-portal-overview.png` — Overview with tabs
- [x] `staff-portal-overview-tab-navigation.png` — Zoomed tab-navigation strip from portal overview (Approval Cover Sheet through Per Diem)
- [x] `staff-portal-mileage-tab.png` — Mileage Entries tab (date, start/end, miles, cost center, actions)
- [x] `staff-portal-mileage-editing-window.png` — Mileage entry editing view after clicking a table cell
- [ ] `staff-portal-add-mileage-entry-window.png` — 🔄 **Refresh:** Add Mileage Entry dialog (report-month date default)
- [ ] `staff-portal-mileage-date-picker.png` — Calendar open on a **past report month** (month arrows visible)
- [x] `staff-portal-receipts-tab.png` — Receipts tab (Crop option)
- [x] `staff-portal-receipt-details-view.png` — Receipt details view with full image and editable fields
- [x] `staff-portal-receipt-crop-dialog.png` — Crop dialog for a receipt image (selection box + Apply)
- [x] `staff-portal-upload-receipt-dialog.png` — Add/Upload Receipt dialog from the web portal
- [ ] `staff-portal-timesheet-tab.png` — **Replaces** `staff-portal-hours-tab.png` — full Timesheet (billable + category tables)
- [ ] `staff-portal-timesheet-pto-entry.png` — PTO (or G&A) hours entered; billable row **0** same day
- [ ] `staff-portal-open-revisions.png` — Approval Progress → **Open revisions** (needs-revision report)
- [x] `staff-portal-descriptions-tab.png` — Daily Descriptions tab
- [x] `staff-portal-monthly-summary.png` — Monthly Summary tab
- [x] `staff-portal-submission-workflow.png` — Submit dialog (Monthly vs Weekly)
- [ ] `staff-portal-report-status.png` — 🔄 **Refresh:** Approval Progress / status chips
- [ ] `staff-portal-notifications.png` — 🔄 **Refresh:** Revision notification with **Open report**
- [x] `staff-portal-settings.png` — Settings / preferences

**Staff subtotal:** 4 new + 4 refresh pending (+ prior captures still valid for unchanged screens)

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
- [x] `supervisor-portal-reports.png` — **Reports** tab (all team reports, filters)
- [x] `supervisor-portal-team.png` — **Team** tab (team members list)
- [ ] `supervisor-portal-notifications.png` — 🔄 **Refresh:** may include weekly hours threshold alert
- [ ] `supervisor-portal-weekly-hours-alert.png` — Zoom: hours-threshold notification (optional)

**Supervisor subtotal:** 1 new + 1 refresh pending (+ 5 prior captures)

---

## 5. Admin Portal (15) — save to `images/screenshots/web-portal/`

- [x] `admin-portal-employee-management.png` — **Employee Management** → Individual Management (current employees table, Add Employee, Sync from HR, View Archived, search)
- [x] `admin-portal-add-employee-button.png` — Zoomed screenshot showing the **Add Employee** button
- [x] `admin-portal-employee-form.png` — Add/Edit Employee form
- [x] `admin-portal-sync-from-hr.png` — Sync from HR API (cloud icon; can be in same frame as employee management)
- [x] `admin-portal-sync-review-changes.png` — Sync from HR API → “Review Changes” prompt/dialog
- [x] `admin-portal-supervisor-management.png` — **Supervisor Management** tab
- [x] `admin-portal-cost-centers.png` — **Cost Center Management** tab
- [x] `admin-portal-per-diem-rules-dialog.png` — Cost Center Management → **Edit Rules** prompt/dialog
- [x] `admin-portal-edit-cost-center-dialog.png` — Cost Center Management → Edit Cost Center prompt/dialog
- [x] `admin-portal-reports-analytics.png` — **Reports & Analytics** tab
- [x] `admin-portal-travel-reasons.png` — **Travel Reasons** tab
- [x] `admin-portal-daily-description.png` — **Daily Description** (options) tab
- [x] `admin-portal-system-settings.png` — **System Settings** tab
- [ ] `admin-portal-notifications.png` — 🔄 **Refresh:** Notifications tab overview
- [ ] `admin-portal-weekly-hours-threshold.png` — Weekly hours threshold setting on Notifications tab
- [x] `admin-portal-edit-pencil-icon.png` — Small screenshot showing the pencil/edit icon in the Actions column

**Admin subtotal:** 1 new + 1 refresh pending (+ 14 prior captures)

---

## 6. Tester packets (Alpha / Beta PDFs) — save to `docs/deployment/images/tester-packet/`

Used by **`docs/deployment/ALPHA_TESTER_PACKET.md`** / **`BETA_TESTER_PACKET.md`**. After capturing, run **`npm run docs:pdf:tester-packets`** from the repo root to refresh **`ALPHA_TESTER_PACKET.pdf`** / **`BETA_TESTER_PACKET.pdf`**.

- [x] `ios-app-store-testflight.png` — App Store: **TestFlight** app listing
- [x] `ios-testflight-oxford-app.png` — **TestFlight** app: Oxford House app with **Install** / **Update**
- [x] `android-internal-test-landing.png` — Screen after opening **Android internal test** link
- [x] `android-play-internal-test-update.png` — Play Store: internal test app with blue **Update** (new build available)

See **`docs/deployment/images/tester-packet/README.md`** for full capture notes.

---

## Summary (May 2026 capture pass)

| Section | New screenshots | Refresh | Prior OK |
|---------|-----------------|---------|----------|
| Mobile App | 3 (+ optional pause) | 1 (`gps-tracking-screen`) | 9 unchanged |
| Staff Portal | 4 | 4 | ~18 unchanged |
| Senior Staff | — | — | 3 |
| Supervisor | 1 (optional) | 1 | 5 |
| Admin Portal | 1 | 1 | 14 |
| Tester packets | — | — | 4 |

**May 2026 minimum new captures:** 9 required + 2 optional. **Refreshes:** 7 recommended.

To mark done: change `- [ ]` to `- [x]` for each screenshot you've saved.

---

*Submit feedback or request support: [tinyurl.com/ExpenseTrackerFeedback](https://tinyurl.com/ExpenseTrackerFeedback)*
