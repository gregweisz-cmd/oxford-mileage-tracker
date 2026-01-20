# Security Notes

## Dependency Audit

- **Date**: 2026-01-15
- **Status**: `npm audit fix --legacy-peer-deps` applied.
- **Remaining issue**: `xlsx` (SheetJS) has a high severity vulnerability with **no fix available**.
- **Usage**: Excel import/export features across backend, web, and mobile.
- **Follow-up**: Evaluate replacing `xlsx` (e.g., `exceljs`) or deprecate Excel import/export if not required.
