# How-To Guides: Feature Updates (Jan 2026)

This document tracks **added**, **changed**, and **removed** features so the how-to guides stay aligned with the app.

## Added

### Admin Portal (Staff Portal)
- **Sync from HR API** (Employee Management → Individual Management tab)
  - One-click sync of current employees from the external HR API (Appwarmer).
  - Creates/updates employees by email; assigns cost centers from HR.
  - HR is the source of truth: employees not in the HR list are archived.
  - Requires `EMPLOYEE_API_TOKEN` (or `APPWARMER_EMPLOYEE_API_TOKEN`) in the backend environment.
  - See `admin-web/backend/docs/HR_SYNC_SETUP.md` and `admin-web/backend/DEPLOY_RENDER.md`.
- **Receipt image crop (Staff Portal)** — In the Receipts tab, you can open a receipt image and use **Crop** to adjust the visible area. The cropped image is saved back to the receipt.

### Mobile App
- **Go to today** on **Daily Hours & Descriptions** and **Per Diem** screens.
  - Scrolls the view to today’s date; when viewing another month, switches to current month then scrolls.
- **“Reading receipt image” popup (Add Receipt)** — After you take or select a receipt photo, a popup appears: “Reading receipt image to fill in the data…” while the app runs a quality check and OCR to pre-fill vendor, amount, date, and category. When done, the popup closes and you can confirm or edit the fields.

## Changed

### Admin Portal
- **Employee Management**: HR sync is the recommended way to keep the employee list current. Manual add/edit remains; **Sync from HR API** is the primary way to keep the list in sync. Bulk CSV import has been removed in favor of Sync from HR. (Bulk import removed.) “Sync from HR API” plus “archive not in HR” keeps the list in sync with HR.
- **Archived employees**: Can be viewed and restored from the archived view; sync archives anyone not in the HR API response.

### Backend / deploy
- Backend loads `.env` from `admin-web/backend/.env` (explicit path) so it works regardless of process cwd.
- On Render, `EMPLOYEE_API_TOKEN` must be set on the **backend** service (Environment), not the frontend.

## Removed

- **Mobile app: Monthly Report screen** — The in-app monthly report view has been removed. Staff submit and view reports via the **Staff Portal** (web). Use the portal for monthly summaries and export.
- **Admin Portal: Bulk CSV import** — Replaced by **Sync from HR API**. Use Sync from HR to keep the employee list current; manual Add/Edit for one-off changes.

## Screenshots

All screenshots have been cleared. Use **`SCREENSHOTS_NEEDED.md`** in this folder for the full list. When capturing: include “Go to today” in frame for Daily Hours and Per Diem; optionally capture the “Reading receipt image…” popup on Add Receipt; Admin guide should show Sync from HR API in Individual Management where applicable.

## Screenshots to add/refresh

| Guide        | Screenshot                         | Notes                                                                 |
|-------------|-------------------------------------|-----------------------------------------------------------------------|
| Admin Portal| `admin-portal-sync-from-hr.png`     | Sync from HR API button in Individual Management tab                 |
| Mobile App  | `daily-hours-screen.png`            | Include “Go to today” in frame                                        |
| Mobile App  | `per-diem-screen.png`              | Include “Go to today” in month nav                                    |

## Related docs

- `admin-web/backend/docs/HR_SYNC_SETUP.md` – HR sync setup (local + Render)
- `admin-web/backend/DEPLOY_RENDER.md` – Deploy + env checklist
- `docs/how-to-guides/CONTENT_GUIDE.md` – Content and screenshot requirements for each guide
