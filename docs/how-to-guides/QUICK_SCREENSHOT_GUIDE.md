# Quick Screenshot Capture Guide

**Master list:** [SCREENSHOT_CHECKLIST.md](SCREENSHOT_CHECKLIST.md) (checkboxes + full inventory)  
**May 2026 features:** [FEATURES_UPDATE.md](FEATURES_UPDATE.md)  
**Optional run order:** [SCREENSHOT_SESSION.md](SCREENSHOT_SESSION.md)

## Current status (May 2026)

Baseline captures from April 2026 are mostly done. **Priority now:** 9 new screenshots + 7 refreshes for Timesheet, GPS stationary, mileage date picker, and revision UX. See checklist for unchecked items.

---

## Priority pass — May 2026 new features

### Staff Portal (`images/screenshots/web-portal/`)

1. `staff-portal-timesheet-tab.png` — Timesheet tab, both grids visible  
2. `staff-portal-timesheet-pto-entry.png` — PTO entered; billable **0** same day  
3. `staff-portal-mileage-date-picker.png` — Add Mileage Entry, calendar on past month  
4. `staff-portal-open-revisions.png` — Approval Progress → **Open revisions**  
5. **Refresh** `staff-portal-add-mileage-entry-window.png`, `staff-portal-report-status.png`, `staff-portal-notifications.png`

### Mobile App (`images/screenshots/mobile-app/`)

1. `mobile-gps-stationary-prompt.png` — Wait ~5 min stationary or trigger notification  
2. `mobile-gps-global-controls.png` — Start GPS, navigate to Home, capture chip  
3. `mobile-gps-pause-mileage.png` — Trip options with Pause/Resume (optional)  
4. **Refresh** `gps-tracking-screen.png` — Android dark mode labels visible

### Supervisor / Admin

1. `supervisor-portal-weekly-hours-alert.png` — Threshold notification (optional)  
2. `admin-portal-weekly-hours-threshold.png` — Admin → Notifications → threshold field  
3. **Refresh** notification panel screenshots if needed

---

## Baseline: Mobile App Screenshots

### Step 1: Open the Mobile App
- If you have the app on a physical device, open it
- Or use an emulator/simulator
- The Expo error won't prevent screenshots if the app is already installed

### Step 2: Capture These 12 Screenshots (in order)

1. **Login Screen** (`login-screen.png`)
   - Navigate to: Login screen
   - Capture: Full screen showing logo and login fields

2. **Home Screen** (`home-screen.png`)
   - Navigate to: Main dashboard after login
   - Capture: Overview of home screen

3. **Full Dashboard** (`home-dashboard-full.png`)
   - Navigate to: Home screen
   - Capture: Scroll down to show all tiles (Monthly Mileage Summary, Per Diem, Distance from BA, etc.)

4. **Daily Hours Screen** (`daily-hours-screen.png`)
   - Navigate to: Daily Hours & Descriptions screen
   - Capture: Shows hours input, description field, and **Go to today** in the month nav

5. **Per Diem Screen** (`per-diem-screen.png`)
   - Navigate to: Per Diem screen
   - Capture: Shows monthly summary, checkboxes, floating \"Save Changes\" button, and **Go to today** in month nav

6. **GPS Tracking** (`gps-tracking-screen.png`)
   - Navigate to: GPS tracking interface (when starting a trip)
   - Capture: Shows GPS tracking in progress

7. **Manual Entry** (`manual-entry-screen.png`)
   - Navigate to: Manual Travel Entry screen
   - Capture: Form for entering mileage manually

8. **Receipt Capture** (`receipt-capture-screen.png`)
   - Navigate to: Add Receipt screen
   - Capture: Camera/upload interface

9. **Settings** (`settings-screen.png`)
    - Navigate to: Settings screen
    - Capture: Settings options

10. **Saved Addresses** (`saved-addresses-screen.png`)
    - Navigate to: Saved addresses list
    - Capture: List of saved addresses

11. **App Store** (`app-store-download.png`)
    - This can be a mockup or actual App Store/Play Store page
    - Or skip if not available

### Step 3: Save Screenshots
- Save all screenshots to: `docs/how-to-guides/images/screenshots/mobile-app/`
- Use exact filenames listed above
- Format: PNG preferred

## Quick Start: Staff Portal Screenshots

### Still Need (11 screenshots):

1. **Mileage Tab** (`staff-portal-mileage-tab.png`)
   - Navigate to: Daily Travel tab
   - Capture: Table showing Odometer Start and Odometer End columns

2. **Receipts Tab** (`staff-portal-receipts-tab.png`)
   - Navigate to: Receipts tab
   - Capture: Receipt list view

3. **Timesheet Tab** (`staff-portal-timesheet-tab.png`) — replaces `staff-portal-hours-tab.png`
   - Navigate to: Timesheet tab
   - Capture: Billable grid + category grid

4. **Descriptions Tab** (`staff-portal-descriptions-tab.png`)
   - Navigate to: Daily Descriptions tab
   - Capture: Description list

5. **Monthly Summary** (`staff-portal-monthly-summary.png`)
   - Navigate to: Monthly Summary tab
   - Capture: Summary view

6. **Submission Workflow** (`staff-portal-submission-workflow.png`)
   - Navigate to: Click "Submit Report"
   - Capture: Dialog showing "Monthly Submission" vs "Weekly Check-up" options

7. **Report Status** (`staff-portal-report-status.png`)
   - Navigate to: Any screen showing report status
   - Capture: Status indicators (Draft, Submitted, Approved, etc.)

8. **Notifications** (`staff-portal-notifications.png`)
   - Navigate to: Click notification bell
   - Capture: Notification panel/dropdown

9. **Settings** (`staff-portal-settings.png`)
   - Navigate to: Settings/preferences
   - Capture: Settings screen

10. **Description Dropdown** (`staff-portal-description-dropdown.png`)
    - Navigate to: Daily Descriptions tab
    - Click a description cell to open the preset list
    - Capture: Dropdown open with options (e.g. Telework from Base Address, Staff Meeting)

11. **Portal Switcher** (`staff-portal-portal-switcher.png`)
    - Navigate to: Click portal switcher dropdown
    - Capture: Dropdown showing available portals

## Quick Start: Admin Portal (new feature screenshots)

### Sync from HR API
- **Sync from HR API** (`admin-portal-sync-from-hr.png`)
  - Navigate to: Admin Portal → Employee Management → **Individual Management** tab
  - Capture: The **Sync from HR API** button (cloud-upload icon) next to "Add Employee"
  - Optional: Capture the success message after a sync (e.g. "Synced X employees; Y created; Z updated; W archived (not in HR)")

## Tips

- **Browser**: Use Chrome at 1920x1080 window size, 100% zoom
- **Mobile**: Use device screenshot (Volume + Power button)
- **File Size**: Keep under 500KB (compress if needed)
- **Naming**: Use exact filenames from this guide
- **Location**: Save to correct directories as specified

## After Capturing

Once you have screenshots:
1. Verify filenames match exactly
2. Check file sizes are reasonable
3. Update HTML templates to reference the images
4. Regenerate PDFs using the scripts

---

*Submit feedback or request support: [tinyurl.com/ExpenseTrackerFeedback](https://tinyurl.com/ExpenseTrackerFeedback)*
