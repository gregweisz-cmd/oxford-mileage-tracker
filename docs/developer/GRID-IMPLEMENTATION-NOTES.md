# Grid-Style Time Tracking Implementation Notes

## Goal
Implement grid-style time tracking tables in PDF export showing daily breakdown by cost centers and categories with all 31 days of the month.

## Current Status
- ✅ Receipts section with text wrapping is working
- ⏳ Grid-style time tracking tables are pending
- ✅ Backend is clean and running (server.js)
- ⚠️ Attempted automated implementation but encountered syntax issues

## What Needs to be Done

### Location in server.js
Replace the simple timesheet table (lines ~5048-5104) with the grid implementation.

### Grid Structure Needed
1. **Cost Center Grid Table** (left to right):
   - Column 1: Cost Center names (80-100px wide)
   - Columns 2-32: Days 1-31 (18-22px wide each)
   - Column 33: TOTALS column (35-50px wide)
   - Rows: One for each unique cost center
   - Final row: "BILLABLE HOURS" totals row

2. **Category Grid Table** (similar structure):
   - Column 1: Category names
   - Columns 2-32: Days 1-31
   - Column 33: TOTAL column
   - Rows: One for each unique category
   - Final row: "DAILY TOTALS" totals row

### Key Implementation Points
1. Need to fetch detailed time tracking data with `db.all()` to get individual entries
2. Build maps for daily data aggregation by cost center and category
3. Use `drawGridCell` helper function for consistent cell rendering
4. Calculate max row height for each row
5. Handle text wrapping in cells if needed
6. Center the grid tables on the page

### Previous Attempts
- File had typos introduced due to language detection issues
- Need to write code carefully and test for syntax errors
- Automated code insertion is introducing unwanted characters

## Implementation Summary
The grid implementation was analyzed and designed but requires manual insertion due to syntax constraints. The key components needed are:

1. **Data Query**: Use `db.all()` to fetch detailed time tracking entries:
```javascript
const detailedTimeTrackingQuery = `
  SELECT date, costCenter, category, hours, description
  FROM time_tracking 
  WHERE employeeId = ? 
  AND strftime("%m", date) = ? 
  AND strftime("%Y", date) = ?
`;
```

2. **Aggregation Logic**: Build maps for daily hours by cost center and category
3. **Grid Cell Function**: Create a helper function using `doc.rect()` and `safeText()`
4. **Two Grid Tables**: One for cost centers, one for categories, each with 32 columns

## Next Steps for Manual Implementation
1. Open server.js and locate line ~5048
2. Replace the timesheet section (lines 5048-5104) with the new grid implementation
3. Follow the existing code pattern from the receipts section for text handling
4. Test with a PDF export that has time tracking data
5. Verify all 31 days display properly

## Helpful Code Patterns
- Look at how receipts table uses text wrapping and dynamic row heights
- Use `doc.splitTextToSize()` for text wrapping
- Use `doc.rect()` with 'FD' flag for filled rectangles with borders
- Remember to set text colors before drawing text

Good luck with the implementation!

