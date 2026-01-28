# Screenshot Capture Session

Use this doc as your run list while capturing screenshots. Paths are relative to the repo root.

## Where to save

| Type | Folder |
|------|--------|
| **Web (all portals)** | `docs/how-to-guides/images/screenshots/web-portal/` |
| **Mobile app** | `docs/how-to-guides/images/screenshots/mobile-app/` |

**Already have:** 4 Staff Portal screenshots in `web-portal/` (login, dashboard, overview, submit).

---

## Session 1 – New features (do these first)

### 1. Admin: Sync from HR API
- **File:** `admin-portal-sync-from-hr.png`
- **Where:** Admin Portal → Employee Management → **Individual Management** tab.
- **Capture:** The **Sync from HR API** button (cloud-upload icon) next to **Add Employee**. Optionally capture the success message after a sync.
- **Save to:** `docs/how-to-guides/images/screenshots/web-portal/admin-portal-sync-from-hr.png`

### 2. Mobile: Daily Hours
- **File:** `daily-hours-screen.png`
- **Where:** Mobile app → Daily Hours & Descriptions screen.
- **Capture:** Full screen with hours input and description area.
- **Save to:** `docs/how-to-guides/images/screenshots/mobile-app/daily-hours-screen.png`

### 3. Mobile: Per Diem
- **File:** `per-diem-screen.png`
- **Where:** Mobile app → Per Diem screen.
- **Capture:** Monthly view with checkboxes and the floating **Save Changes** button.
- **Save to:** `docs/how-to-guides/images/screenshots/mobile-app/per-diem-screen.png`

---

## Session 2 – Mobile app (high priority)

Do in order; save each as the filename below into `docs/how-to-guides/images/screenshots/mobile-app/`.

| # | Filename | What to capture |
|---|----------|------------------|
| 1 | `login-screen.png` | Login screen (logo + login fields) |
| 2 | `home-screen.png` | Home screen overview |
| 3 | `home-dashboard-full.png` | Full dashboard (scroll to show all tiles) |
| 4 | `gps-tracking-screen.png` | GPS tracking in progress |
| 5 | `manual-entry-screen.png` | Manual mileage entry form |
| 6 | `receipt-capture-screen.png` | Receipt capture/upload screen |
| 7 | `monthly-report-screen.png` | Monthly report view |
| 8 | `settings-screen.png` | Settings screen |
| 9 | `saved-addresses-screen.png` | Saved addresses list |
| 10 | `app-store-download.png` | App/Play Store page or mockup (optional) |

*(You already did `daily-hours-screen.png` and `per-diem-screen.png` in Session 1.)*

---

## Session 3 – Staff Portal (remaining)

Save to `docs/how-to-guides/images/screenshots/web-portal/`. You already have: login, dashboard, overview, submit.

| # | Filename | What to capture |
|---|----------|------------------|
| 1 | `staff-portal-mileage-tab.png` | Daily Travel tab with Odometer Start/End columns |
| 2 | `staff-portal-receipts-tab.png` | Receipts tab |
| 3 | `staff-portal-hours-tab.png` | Hours Worked tab |
| 4 | `staff-portal-descriptions-tab.png` | Daily Descriptions tab |
| 5 | `staff-portal-monthly-summary.png` | Monthly Summary tab |
| 6 | `staff-portal-submission-workflow.png` | Submit Report dialog (Monthly vs Weekly) |
| 7 | `staff-portal-report-status.png` | Report status indicators |
| 8 | `staff-portal-notifications.png` | Notification bell/panel |
| 9 | `staff-portal-settings.png` | Settings |
| 10 | `staff-portal-description-edit.png` | Description edit (tall edit box) |
| 11 | `staff-portal-portal-switcher.png` | Portal switcher dropdown |

---

## Session 4+ – Other portals

- **Admin:** employee-management, employee-form, bulk-import, cost-centers, system-settings (see `SCREENSHOT_CHECKLIST.md` for full list).
- **Supervisor / Finance / Contracts:** See `SCREENSHOT_CHECKLIST.md` for filenames and “Additional screenshots needed”.

---

## Quick tips

- **Web:** Chrome or Firefox, 1920×1080, 100% zoom. Use Win+Shift+S (Windows) or Cmd+Shift+4 (Mac).
- **Mobile:** Device or emulator screenshot; keep key UI in frame.
- **Naming:** Use the exact filenames above so the PDF templates find the images.
- **Size:** Keep under ~500 KB per image; compress if needed.

After capturing, run the PDF generation scripts to refresh the how-to PDFs (see `scripts/` in this folder).
