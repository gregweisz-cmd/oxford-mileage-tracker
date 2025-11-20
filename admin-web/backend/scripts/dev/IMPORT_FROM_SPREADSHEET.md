# Import Reports from Spreadsheet

If you have existing spreadsheet data you want to import, you can use this guide.

## Supported Formats

- Excel files (`.xlsx`, `.xls`)
- CSV files (`.csv`)

## Spreadsheet Format

Create a spreadsheet with the following columns:

### Mileage Entries Sheet
| employeeId | date | startLocation | endLocation | miles | purpose | isGpsTracked |
|------------|------|---------------|-------------|-------|---------|--------------|
| employee-123 | 2024-01-15 | Office | Client Site | 25.5 | Client meeting | true |

### Receipts Sheet
| employeeId | date | vendor | amount | category | description |
|------------|------|--------|--------|----------|-------------|
| employee-123 | 2024-01-15 | Shell | 45.50 | Gas | Gas station |

### Time Entries Sheet
| employeeId | date | category | hours | description |
|------------|------|----------|-------|-------------|
| employee-123 | 2024-01-15 | Regular Hours | 8.0 | Client work |

## Quick Import Script

A script to import from spreadsheets is coming soon. For now, use the auto-generation script:

```bash
node scripts/dev/load-year-of-reports.js
```

This will generate realistic data for the past year automatically.

## Manual Import (Future)

If you need to import from spreadsheets, you can:

1. Place your Excel/CSV files in `scripts/dev/import-data/`
2. Run import script (to be created)
3. Data will be loaded into the database

---

**For now, use the auto-generation script which creates realistic demo data automatically!**

