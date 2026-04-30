---
name: Finance Meeting Changes
overview: Implement finance-requested policy and UX updates across cost center selection, per diem receipt requirements, purpose entry, and receipt splitting while preserving HR-synced naming consistency for reporting/export.
todos:
  - id: normalize-cost-centers
    content: Implement shared cost center canonicalization and apply in HR ingest + report/export filters
    status: completed
  - id: user-cost-center-multiselect
    content: Enable user checkbox selection for assigned cost centers and enforce default-in-selection validation
    status: completed
  - id: per-diem-toggle-by-cost-center
    content: Add per-cost-center per diem receipt-image toggle (default off) in backend + admin UI + mobile/server validation
    status: completed
  - id: custom-travel-purpose-option
    content: Add explicit custom-purpose option in mileage/GPS purpose dropdown flows
    status: completed
  - id: receipt-split-and-tax-option
    content: Implement split receipt child-allocation model with shared image and optional tax-to-Other helper
    status: completed
  - id: reporting-export-compat
    content: Update reporting/export queries and aggregations for canonical cost centers and split receipts
    status: completed
  - id: qa-and-migration
    content: Add migrations/backfills and integration tests, then run finance-focused end-to-end validation
    status: in_progress
isProject: false
---

# Finance Meeting Implementation Plan

## Current Handoff Status
This section is the working handoff state for cross-machine / cross-agent continuity.

### Completed in this cycle
- Canonical cost center matching across finance/contracts filters, per-diem lookups, and staff report data grouping.
- User/admin cost center selector standardization (multi-select add/remove + default validity checks) across key web flows.
- HR sync improvements:
  - imports/syncs cost centers from HR feed,
  - excludes grouped slash values (`/`) from assignment,
  - excludes slash values from selector/API surfaces.
- Finance report editing resilience fixes (initial load data gaps, certification state persistence, full finance edit view flow).
- Mobile end-trip stability fixes:
  - restored reliable manual end-location entry,
  - hardened stop-trip flow to avoid blocking/freeze behavior.
- HR sync preview now shows explicit field-level before/after diffs (name/position/phone/cost centers).

### In progress / remaining
- QA and migration hardening:
  - add/update integration coverage for finance-critical flows,
  - run and document end-to-end finance regression pass after latest changes.

### Newly completed in this cycle
- Receipt split enhancements now include:
  - category + cost center selection per split row,
  - optional per-row split notes/description override,
  - tax-to-Other helper that auto-creates or updates a tax allocation row,
  - backend split metadata validation (`splitAllocationIndex`/`splitAllocationCount`) for create/update API calls.

### QA / migration hardening pass (current state)
- **Schema / migration status**
  - No new DB columns were added in this cycle.
  - Existing split receipt columns (`splitGroupId`, `splitAllocationIndex`, `splitAllocationCount`) are already present in mobile and backend migrations.
  - Therefore, no additional migration/backfill script is required for the new split-by-cost-center behavior.
- **Verification performed**
  - `node -c admin-web/backend/routes/dataEntries.js` ✅
  - `npm run build` in `admin-web/` ✅ (compiled successfully)
  - `npx tsc --noEmit` (repo-wide) ⚠️ fails due to large set of pre-existing TypeScript issues across unrelated areas; not introduced by this split change.
- **Finance-focused functional checks to run in app before ship**
  - Create split receipt with 2+ categories and different cost centers per row.
  - Use tax-to-Other helper and confirm totals still match receipt total.
  - Save split receipt and verify each child row persists with expected category/cost center/amount and shared image.
  - Confirm finance report/export still groups split receipts correctly and cost center filtering includes split children.

### Useful recent commit anchors
- `1bda243` - cost center selector and canonical matching unification
- `266920b` - HR sync preview detailed diffs
- `5835db2` - GPS end-trip freeze/manual end location fixes
- `6650d3b` - omit slash (`/`) cost centers from sync/selectors
- `32d77e4` - sender fallback updated for `noreply@oxfordhouse.org`
- `ea77c00` - test email button UX/validation feedback

### Latest OTA references (production)
- `741fee58-cedb-4486-b6ab-3f70303d2b84` - end-trip freeze/manual end location update
- `fe88c58f-6d3c-4bf7-b994-5b771dcc0cc0` - slash cost center omission update

## Scope
Deliver five coordinated updates across mobile + admin + backend:
- User-selectable cost centers (multi-select checkboxes from HR-synced list)
- Per-cost-center per-diem receipt-image requirement toggles (default OFF)
- Canonical HR spelling for cost centers everywhere (no local variants)
- Travel purpose dropdown + typed custom purpose option
- Receipt splitting with optional tax removal-to-Other behavior

## 1) Cost Center Source of Truth + Spelling Canonicalization
Use HR-synced cost center records as canonical names/codes and normalize all matching/filtering through one shared normalizer.

- Backend canonicalization points:
  - [admin-web/backend/services/externalEmployeeSync.js](admin-web/backend/services/externalEmployeeSync.js)
  - [admin-web/backend/routes/employees.js](admin-web/backend/routes/employees.js)
  - [admin-web/backend/routes/dashboard.js](admin-web/backend/routes/dashboard.js)
  - [admin-web/backend/routes/export.js](admin-web/backend/routes/export.js)
- API / selector sources:
  - [admin-web/backend/routes/costCenters.js](admin-web/backend/routes/costCenters.js)
  - [admin-web/src/services/costCenterApiService.ts](admin-web/src/services/costCenterApiService.ts)
  - [src/services/costCenterApiService.ts](src/services/costCenterApiService.ts)
- Add a shared normalization helper (case/space/punctuation-insensitive key), but always store/display canonical HR label.
- Replace exact-string-only filters in reporting/export paths with canonical-ID/key matching to prevent misses like Program Services vs programservices.

## 2) User Cost Center Multi-Select (from HR assigned set)
Allow users to choose any/all assigned HR cost centers via checkbox UI, while HR sync still controls the assigned list.

- User settings + save path:
  - [admin-web/src/components/UserSettings.tsx](admin-web/src/components/UserSettings.tsx)
  - [admin-web/backend/routes/employees.js](admin-web/backend/routes/employees.js)
- Mobile selectors using selected/default values:
  - [src/components/CostCenterSelector.tsx](src/components/CostCenterSelector.tsx)
  - [src/screens/HomeScreen.tsx](src/screens/HomeScreen.tsx)
  - [src/screens/GpsTrackingScreen.tsx](src/screens/GpsTrackingScreen.tsx)
- Behavior:
  - HR sync sets available/assigned set.
  - User can check/uncheck within that set.
  - Persist `selectedCostCenters` + `defaultCostCenter` with validation (`default` must be in selected set).

## 3) Per-Cost-Center Toggle: Per Diem Receipt Image Required
Add admin-configurable toggle per cost center to require receipt image for per diem entries.

- Config data model/API:
  - [admin-web/backend/routes/costCenters.js](admin-web/backend/routes/costCenters.js)
  - (new) backend storage field per cost center: `perDiemReceiptImageRequired` boolean
- Admin UI for toggle management:
  - [admin-web/src/components/EmployeeManagementComponent.tsx](admin-web/src/components/EmployeeManagementComponent.tsx) (or a dedicated cost center settings surface)
- Mobile enforcement:
  - [src/screens/PerDiemScreen.tsx](src/screens/PerDiemScreen.tsx)
  - [src/screens/AddReceiptScreen.tsx](src/screens/AddReceiptScreen.tsx)
- Server-side guard (recommended to avoid client bypass):
  - [admin-web/backend/routes/dataEntries.js](admin-web/backend/routes/dataEntries.js)
- Default all toggles OFF at migration/seed.

## 4) Travel Purpose: Add Explicit Custom Text Option
Provide a dropdown option like “Other (type custom)” that reveals an input.

- Sources and screens:
  - [src/services/travelReasonsService.ts](src/services/travelReasonsService.ts)
  - [src/screens/MileageEntryScreen.tsx](src/screens/MileageEntryScreen.tsx)
  - [src/screens/GpsTrackingScreen.tsx](src/screens/GpsTrackingScreen.tsx)
  - [admin-web/src/components/TravelReasonsManagement.tsx](admin-web/src/components/TravelReasonsManagement.tsx)
- Keep admin-managed reason list, but always include custom-purpose path in UI.
- Persist custom text as final purpose string for reports/export.

## 5) Receipt Split + Tax Removal Option
Implement split on receipt capture using linked child entries sharing the same image, with optional tax-to-Other convenience.

- Receipt capture/edit:
  - [src/screens/AddReceiptScreen.tsx](src/screens/AddReceiptScreen.tsx)
- Data layer:
  - [src/services/database.ts](src/services/database.ts)
  - [admin-web/backend/routes/dataEntries.js](admin-web/backend/routes/dataEntries.js)
- Proposed model:
  - Parent receipt group ID + one-or-more child allocations (category, amount, optional notes).
  - Shared image URI/file metadata across children.
- UX:
  - “Split” action opens allocation rows.
  - Validation: sum(children) == total.
  - “Remove tax” action auto-creates/updates an `Other` allocation for tax amount (editable before save).

## 6) Reporting and Export Compatibility
Ensure split receipts and canonical cost center mapping flow through existing analytics/export.

- Reporting services/routes:
  - [admin-web/src/services/reportingAnalyticsService.ts](admin-web/src/services/reportingAnalyticsService.ts)
  - [admin-web/backend/routes/dashboard.js](admin-web/backend/routes/dashboard.js)
  - [admin-web/backend/routes/export.js](admin-web/backend/routes/export.js)
- Confirm grouped totals remain correct with split children and custom purposes.
- Ensure cost center filters operate on canonical values only.

## 7) Rollout and Verification
- Add migration/backfill for new cost-center toggle field and any receipt split schema additions.
- Add integration tests for:
  - cost center normalization/filtering
  - per-diem receipt required by cost center
  - custom purpose persistence
  - split receipt totals/tax handling
- Run end-to-end checks for key finance report pulls that previously failed from spelling mismatch.
