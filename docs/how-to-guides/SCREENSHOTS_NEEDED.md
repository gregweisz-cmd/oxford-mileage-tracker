# Screenshots Needed for How-To Guides

**Master checklist:** Use **[SCREENSHOT_CHECKLIST.md](SCREENSHOT_CHECKLIST.md)** for the full list with checkboxes, capture status, and tester packets.

**May 2026 feature log:** See **[FEATURES_UPDATE.md](FEATURES_UPDATE.md)** for what changed and which existing screenshots need a refresh.

---

## Save locations

| Guide | Folder |
|-------|--------|
| Mobile app | `images/screenshots/mobile-app/` |
| Web portals (Staff, Supervisor, Admin, Finance, Contracts) | `images/screenshots/web-portal/` |

**Tips:** Use a real device or high-quality emulator for mobile. For web, use a recent browser; include **Go to today** in frame for mobile Daily Hours and Per Diem. After adding screenshots, run `node generate-pdfs.js` in `docs/how-to-guides/scripts/`.

---

## May 2026 — new screenshots (required)

| Guide | Filename | What to capture |
|-------|----------|-----------------|
| Staff Portal | `staff-portal-timesheet-tab.png` | Full Timesheet tab: billable table + category table |
| Staff Portal | `staff-portal-timesheet-pto-entry.png` | PTO (or G&A) hours entered; billable row **0** same day |
| Staff Portal | `staff-portal-mileage-date-picker.png` | Add Mileage Entry, calendar on **past report month** |
| Staff Portal | `staff-portal-open-revisions.png` | Approval Progress → **Open revisions** |
| Mobile App | `mobile-gps-stationary-prompt.png` | Stationary notification or in-app prompt |
| Mobile App | `mobile-gps-global-controls.png` | Global GPS chip while on Home or another screen |
| Mobile App | `mobile-gps-pause-mileage.png` | Pause / Resume mileage (optional) |
| Supervisor | `supervisor-portal-weekly-hours-alert.png` | Hours-threshold notification (optional) |
| Admin | `admin-portal-weekly-hours-threshold.png` | Notifications → Weekly hours threshold |

---

## May 2026 — refresh these captures

| Guide | Filename | Why |
|-------|----------|-----|
| Mobile App | `gps-tracking-screen.png` | Android dark-mode labels; pause/stop UI |
| Staff Portal | `staff-portal-add-mileage-entry-window.png` | Report-month date default |
| Staff Portal | `staff-portal-notifications.png` | Revision rows with **Open report** |
| Staff Portal | `staff-portal-report-status.png` | Approval Progress / Open revisions |
| Supervisor | `supervisor-portal-notifications.png` | May include weekly hours alert |
| Admin | `admin-portal-notifications.png` | Notifications tab overview |

**Replace:** `staff-portal-hours-tab.png` is superseded by `staff-portal-timesheet-tab.png` (tab renamed to Timesheet).

---

## Baseline captures (unchanged UI)

Most screenshots from the April 2026 pass are still valid. See **SCREENSHOT_CHECKLIST.md** sections 1–6 for the full baseline list (mobile login/home/receipts, staff mileage/receipts/descriptions, supervisor/admin dashboards, tester packets, etc.).

**Deferred:** Finance and Contracts portal full screenshot sets remain deferred until those guides are expanded beyond placeholder content.

---

## After capture

1. Mark items `- [x]` in `SCREENSHOT_CHECKLIST.md`.
2. Run `node generate-pdfs.js` in `docs/how-to-guides/scripts/`.
3. Spot-check PDFs before distributing.

---

*Submit feedback or request support: [tinyurl.com/ExpenseTrackerFeedback](https://tinyurl.com/ExpenseTrackerFeedback)*
