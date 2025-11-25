# Import Expense Reports from Spreadsheets

This script allows you to import old expense reports from Excel/CSV spreadsheets into the database for testing by the finance team.

## Quick Start

1. **Place your spreadsheets in the import directory:**
   ```bash
   # Default location (will be created automatically):
   admin-web/backend/scripts/dev/import-data/
   ```

2. **Run the import script:**
   ```bash
   cd admin-web/backend
   node scripts/dev/import-reports-from-spreadsheets.js
   ```

3. **Preview what will be imported (dry run):**
   ```bash
   node scripts/dev/import-reports-from-spreadsheets.js --dry-run
   ```

## Supported File Formats

- Excel files: `.xlsx`, `.xls`
- CSV files: `.csv`

## Spreadsheet Format

You can organize your data in one of two ways:

### Option 1: Multiple Sheets (Recommended)

Create an Excel file with separate sheets/tabs for different data types:

#### "Reports" or "Expense Reports" Sheet
| Employee Email/Name | Month | Year | Status | Total Miles | Total Expenses |
|---------------------|-------|------|--------|-------------|----------------|
| john.doe@example.com | 1 | 2024 | submitted | 150.5 | 250.00 |
| jane.smith@example.com | 2 | 2024 | approved | 200.0 | 350.00 |

**Columns:**
- **Employee Email/Name** (required): Email or name that matches an employee in the database
- **Month** (required): 1-12
- **Year** (required): YYYY (e.g., 2024)
- **Status** (optional): `draft`, `submitted`, `pending_supervisor`, `pending_finance`, `approved`, `needs_revision` (default: `submitted`)
- **Total Miles** (optional): Will be auto-calculated from mileage entries if not provided
- **Total Expenses** (optional): Will be auto-calculated from receipts if not provided

#### "Mileage" or "Mileage Entries" Sheet
| Employee Email/Name | Date | Start Location | End Location | Miles | Purpose | Cost Center | Odometer Reading |
|---------------------|------|----------------|--------------|-------|---------|-------------|------------------|
| john.doe@example.com | 2024-01-15 | Office | Client Site | 25.5 | Client meeting | Program Services | 50500 |
| john.doe@example.com | 2024-01-16 | Client Site | Home | 30.0 | Return trip | Program Services | 50525 |

**Columns:**
- **Employee Email/Name** (required): Matches employee in database
- **Date** (required): YYYY-MM-DD or MM/DD/YYYY
- **Miles** (required): Number of miles
- **Start Location** (optional): Starting location name
- **End Location** (optional): Destination location name
- **Purpose** (optional): Purpose of trip
- **Cost Center** (optional): Defaults to employee's first cost center
- **Odometer Reading** (optional): Odometer reading at end of trip

#### "Receipts" Sheet
| Employee Email/Name | Date | Vendor | Amount | Category | Description | Cost Center |
|---------------------|------|--------|--------|----------|-------------|-------------|
| john.doe@example.com | 2024-01-15 | Shell | 45.50 | Gas | Gas station fill-up | Program Services |
| john.doe@example.com | 2024-01-16 | Office Depot | 25.00 | Office Supplies | Printer paper | Program Services |

**Columns:**
- **Employee Email/Name** (required): Matches employee in database
- **Date** (required): YYYY-MM-DD or MM/DD/YYYY
- **Vendor** (required): Vendor/merchant name
- **Amount** (required): Expense amount (number)
- **Category** (optional): Receipt category (default: "Other")
- **Description** (optional): Description of expense
- **Cost Center** (optional): Defaults to employee's first cost center

#### "Time" or "Time Entries" Sheet
| Employee Email/Name | Date | Category | Hours | Description | Cost Center |
|---------------------|------|----------|-------|-------------|-------------|
| john.doe@example.com | 2024-01-15 | Regular Hours | 8.0 | Client work | Program Services |
| john.doe@example.com | 2024-01-16 | Overtime | 2.0 | Extra work | Program Services |

**Columns:**
- **Employee Email/Name** (required): Matches employee in database
- **Date** (required): YYYY-MM-DD or MM/DD/YYYY
- **Hours** (required): Number of hours worked
- **Category** (optional): Time category (default: "Regular Hours")
- **Description** (optional): Description of work
- **Cost Center** (optional): Defaults to employee's first cost center

### Option 2: Single Sheet

If all your data is in one sheet, the script will try to automatically detect the data type based on column names:

- If columns include "Month" and "Year" → Treated as reports
- If columns include "Miles" or "Mileage" → Treated as mileage entries
- If columns include "Vendor" and "Amount" → Treated as receipts
- If columns include "Hours" → Treated as time entries

## Usage Examples

### Basic Import
```bash
cd admin-web/backend
node scripts/dev/import-reports-from-spreadsheets.js
```

### Dry Run (Preview Without Importing)
```bash
node scripts/dev/import-reports-from-spreadsheets.js --dry-run
```

### Custom Import Directory
```bash
node scripts/dev/import-reports-from-spreadsheets.js --dir /path/to/your/spreadsheets
```

### Specify File Format
```bash
node scripts/dev/import-reports-from-spreadsheets.js --format xlsx
```

## Tips

1. **Employee Matching**: Make sure the employee emails/names in your spreadsheets match exactly with those in the database. You can check existing employees by querying the database or viewing the Employee Management page.

2. **Date Formats**: The script supports multiple date formats:
   - `YYYY-MM-DD` (e.g., `2024-01-15`)
   - `MM/DD/YYYY` (e.g., `01/15/2024`)
   - Excel serial dates (will be converted automatically)

3. **Cost Centers**: If you don't specify a cost center, the script will use the employee's first assigned cost center.

4. **Existing Reports**: The script will skip reports that already exist for the same employee/month/year combination.

5. **Dry Run First**: Always run with `--dry-run` first to preview what will be imported without making changes.

## Example Workflow

1. **Prepare your spreadsheets:**
   - Organize data into separate sheets or single sheet
   - Ensure employee emails/names match database
   - Verify dates are in correct format

2. **Place files in import directory:**
   ```bash
   mkdir -p admin-web/backend/scripts/dev/import-data
   cp your-reports.xlsx admin-web/backend/scripts/dev/import-data/
   ```

3. **Preview import:**
   ```bash
   cd admin-web/backend
   node scripts/dev/import-reports-from-spreadsheets.js --dry-run
   ```

4. **Review output** and verify:
   - Correct employees are matched
   - Dates are parsed correctly
   - Expected number of reports/entries will be created

5. **Run actual import:**
   ```bash
   node scripts/dev/import-reports-from-spreadsheets.js
   ```

6. **Verify in application:**
   - Check Employee Management → Reports
   - Verify data appears correctly
   - Test finance team workflows

## Troubleshooting

### "Could not find employee for row"
- The employee email/name in the spreadsheet doesn't match any employee in the database
- Check the exact spelling and format in the Employee Management page
- Try using email address instead of name, or vice versa

### "Invalid date in row"
- Date format might not be recognized
- Try using `YYYY-MM-DD` format (e.g., `2024-01-15`)
- Check for extra spaces or special characters

### "Report already exists"
- A report for that employee/month/year already exists
- The script will skip duplicate reports automatically
- Delete existing report from database if you want to re-import

### "Failed to read file"
- File might be corrupted or in an unsupported format
- Try saving as `.xlsx` or `.csv` format
- Make sure the file isn't open in another program

## Output

After running the script, you'll see:
- Number of files processed
- Number of reports created
- Number of mileage entries created
- Number of receipts created
- Number of time entries created
- Any errors encountered

Example output:
```
📊 IMPORT SUMMARY
==================================================
Files processed: 3
Reports created: 25
Mileage entries created: 150
Receipts created: 200
Time entries created: 300
```

---

**Note**: This script creates realistic test data for the finance team. Make sure to review and verify the imported data in the application after importing.

