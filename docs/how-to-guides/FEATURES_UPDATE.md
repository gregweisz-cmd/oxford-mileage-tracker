# How-To Guides: Feature Updates (May 2026)

This document tracks **added**, **changed**, and **removed** features so the how-to guides and screenshot lists stay aligned with the app.

**Screenshot work:** See `SCREENSHOT_CHECKLIST.md` for capture status. Several existing screenshots need a **refresh** for UI that changed since April 2026; new filenames are listed in the **New screenshots (May 2026)** section at the bottom.

---

## Added (May 2026)

### Staff Portal (web)
- **Timesheet — category hours (PTO, G&A, Holiday, STD/LTD, PFL/PFML)**  
  Bottom grid for non-billable hours. Billable hours stay in the **top** cost-center table; category hours do **not** copy into Program Services / BILLABLE HOURS.
- **Mileage Add Entry — report-month date picker**  
  Calendar opens on the open report month; month arrows work when adding entries for prior months.
- **Revision deep links**  
  Revision notifications and **Open revisions** on the Approval Progress card jump to the tab with the most revision notes (Mileage, Timesheet, or Receipts).
- **Signature dates on Approval Cover Sheet**  
  Employee and supervisor signature dates display when signed.

### Mobile app
- **GPS stationary reminder**  
  After ~5 minutes stationary at driving speed, notification and in-app prompt: continue tracking or end trip.
- **End trip from notification**  
  “End tracking” from the stationary notification opens the same end-destination flow as the in-app stop button.
- **Global GPS controls while tracking**  
  Floating return/stop chip on any screen; **Pause mileage** / **Resume mileage** for errands without ending the session.
- **Scroll/touch reliability**  
  Keyboard dismiss on chip/picker taps; stale modal cleanup after lock/unlock (receipt, hours, mileage, GPS, per diem).

### Supervisor / Admin
- **Weekly hours threshold alerts**  
  Supervisors notified when a team member exceeds the configured weekly hours (default 60h, Sunday–Saturday). Admin sets threshold under **Notifications → Weekly hours threshold**.

### Finance Portal
- **All Reports — Total Expenses**  
  List total now matches Staff Portal grand total (cost-center breakdown), not stale summary fields.

### Platform / reliability
- **Central API cache invalidation** (`rateLimitedApi`) across Staff, Finance, Contracts, and Supervisor portals — edits reflect immediately after save.

---

## Changed (May 2026)

### Staff Portal
- **Timesheet tab** (replaces older “Hours Worked” wording in guides): two tables — billable cost centers on top, categories below; **DAILY TOTALS** = billable + category.
- **Daily Descriptions hours** — clearing the hours field saves **0** (no longer snaps back to a default).
- **Receipt date picker** — same month-navigation fix as mileage (report-month default).

### Mobile app
- **GPS Tracking form labels** — legible on Android dark mode.
- **GPS end-trip flow** — modals tear down before navigation home (fixes touch freeze after stationary end-trip).

### Admin Portal
- Staff, Finance, Contracts API calls use shared `rateLimitedApi` (consistent caching and invalidation).

---

## Unchanged from Jan 2026 (still document)

- **Sync from HR API** (Admin → Individual Management)
- **Receipt crop** (Staff Portal Receipts tab)
- **Go to today** (mobile Daily Hours & Per Diem)
- **Reading receipt image…** OCR popup (mobile Add Receipt)
- **Monthly Report screen removed** from mobile — use Staff Portal for monthly view/export

---

## Removed

- (No new removals in May 2026.)

---

## New screenshots (May 2026)

Capture these in addition to refreshing any screenshot where the UI changed.

| Guide | Filename | What to capture |
|-------|----------|-----------------|
| Staff Portal | `staff-portal-timesheet-tab.png` | Full Timesheet tab: billable table + category table + signatures |
| Staff Portal | `staff-portal-timesheet-pto-entry.png` | Zoom: PTO (or G&A) cell with hours entered; billable row **0** same day |
| Staff Portal | `staff-portal-mileage-date-picker.png` | Add Mileage Entry dialog, calendar open on **past report month** |
| Staff Portal | `staff-portal-open-revisions.png` | Approval Progress with **Open revisions** (needs-revision report) |
| Mobile App | `mobile-gps-stationary-prompt.png` | Stationary notification **or** in-app “Still tracking your trip?” modal |
| Mobile App | `mobile-gps-global-controls.png` | Global GPS chip (distance + stop) while on Home or another screen |
| Mobile App | `mobile-gps-pause-mileage.png` | Trip options showing **Pause mileage** / **Resume mileage** (optional) |
| Supervisor | `supervisor-portal-weekly-hours-alert.png` | Notification panel with hours-threshold alert (optional) |
| Admin | `admin-portal-weekly-hours-threshold.png` | Notifications tab → Weekly hours threshold setting |

## Screenshots to refresh (May 2026)

Re-capture if the frame no longer matches the current UI:

| Guide | Filename | Why refresh |
|-------|----------|-------------|
| Mobile App | `gps-tracking-screen.png` | Dark-mode label contrast on Android; pause/stop UI |
| Staff Portal | `staff-portal-hours-tab.png` | **Rename/replace** with `staff-portal-timesheet-tab.png` (tab is Timesheet) |
| Staff Portal | `staff-portal-add-mileage-entry-window.png` | Report-month date default + calendar |
| Staff Portal | `staff-portal-notifications.png` | Revision rows with **Open report** action |
| Staff Portal | `staff-portal-report-status.png` | Approval Progress / Open revisions |

---

## Related docs

- `CONTENT_GUIDE.md` — Section-by-section content for each template
- `SCREENSHOT_CHECKLIST.md` — Master checklist with checkboxes
- `admin-web/backend/docs/HR_SYNC_SETUP.md` — HR sync
- `docs/scroll-touch-audit.md` — Mobile scroll/touch patterns (developers)

---

*Submit feedback or request support: [tinyurl.com/ExpenseTrackerFeedback](https://tinyurl.com/ExpenseTrackerFeedback)*
