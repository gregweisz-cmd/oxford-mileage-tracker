# How-To Guides: Feature Updates (Jan 2026)

This document tracks **added**, **changed**, and **removed** features so the how-to guides stay aligned with the app.

## Added

### Admin Portal
- **Sync from HR API** (Employee Management → Individual Management tab)
  - One-click sync of current employees from the external HR API (Appwarmer).
  - Creates/updates employees by email; assigns cost centers from HR.
  - HR is the source of truth: employees not in the HR list are archived.
  - Requires `EMPLOYEE_API_TOKEN` (or `APPWARMER_EMPLOYEE_API_TOKEN`) in the backend environment.
  - See `admin-web/backend/docs/HR_SYNC_SETUP.md` and `admin-web/backend/DEPLOY_RENDER.md`.

## Changed

### Admin Portal
- **Employee Management**: HR sync is the recommended way to keep the employee list current. Manual add/edit and bulk import remain; “Sync from HR API” plus “archive not in HR” keeps the list in sync with HR.
- **Archived employees**: Can be viewed and restored from the archived view; sync archives anyone not in the HR API response.

### Backend / deploy
- Backend loads `.env` from `admin-web/backend/.env` (explicit path) so it works regardless of process cwd.
- On Render, `EMPLOYEE_API_TOKEN` must be set on the **backend** service (Environment), not the frontend.

## Removed

- (None in this update.)

## Screenshots to add/refresh

| Guide        | Screenshot                         | Notes                                                                 |
|-------------|-------------------------------------|-----------------------------------------------------------------------|
| Admin Portal| `admin-portal-sync-from-hr.png`     | Sync from HR API button in Individual Management tab                 |

## Related docs

- `admin-web/backend/docs/HR_SYNC_SETUP.md` – HR sync setup (local + Render)
- `admin-web/backend/DEPLOY_RENDER.md` – Deploy + env checklist
- `docs/how-to-guides/CONTENT_GUIDE.md` – Content and screenshot requirements for each guide
