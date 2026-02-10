# Getting Back to Screenshots for How-To Guides

Use **`SCREENSHOT_CHECKLIST.md`** to tick off each screenshot as you go. Full descriptions are in **`SCREENSHOTS_NEEDED.md`**.

## Where to save

| Guide | Save folder | Count |
|-------|-------------|-------|
| Mobile app | `images/screenshots/mobile-app/` | 11 |
| Staff Portal | `images/screenshots/web-portal/` | 13 |
| Supervisor Portal | `images/screenshots/web-portal/` | 13 |
| Admin Portal | `images/screenshots/web-portal/` | 13 |

**Total:** 50 screenshots. Finance & Contracts are deferred.

## Suggested order

1. **Mobile (11)** — Device or emulator. Include **“Go to today”** in frame for Daily Hours and Per Diem.
2. **Staff Portal (13)** — Login as staff; capture login, dashboard, each tab, submit workflow, status, notifications, settings.
3. **Supervisor Portal (13)** — Login as supervisor; same pattern (dashboard, tabs, approvals, etc.).
4. **Admin Portal (13)** — Login as admin; same pattern plus **Sync from HR API** (Individual Management tab, cloud icon next to Add Employee). Optional extras: `admin-portal-employee-management.png`, `admin-portal-sync-from-hr.png`, `admin-portal-employee-form.png`, etc.

## Tips

- **Exact filenames** from `SCREENSHOTS_NEEDED.md` — no renames.
- **Mobile:** “Go to today” visible on Daily Hours and Per Diem screens.
- **Admin:** Capture Sync from HR API button (and success message if you like).
- **Web:** Recent browser; crop to content if you want consistent width.

## After you add screenshots

```bash
cd docs/how-to-guides/scripts
npm run build
```

Then spot-check the generated PDFs in `docs/how-to-guides/`.
