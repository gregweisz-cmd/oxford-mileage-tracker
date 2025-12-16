# Database Management UI Setup Guide

**Oxford House Expense Reporting System - SQLite Database**

This guide helps you set up and use a UI to view and manage the SQLite database.

---

## Table of Contents

1. [Database Overview](#database-overview)
2. [Database Location](#database-location)
3. [Recommended Tools](#recommended-tools)
4. [Database Schema](#database-schema)
5. [Common Queries](#common-queries)
6. [Safety & Best Practices](#safety--best-practices)
7. [Troubleshooting](#troubleshooting)

---

## Database Overview

**Database Type:** SQLite 3  
**Database Name:** `expense_tracker.db`  
**File Location:** `admin-web/backend/expense_tracker.db`

SQLite is a file-based database, meaning the entire database is stored in a single file. This makes it easy to backup, copy, and manage.

---

## Database Location

### Default Location
```
C:\Users\GooseWeisz\oxford-mileage-tracker\admin-web\backend\expense_tracker.db
```

### Finding Your Database
1. Navigate to the `admin-web/backend` folder in your project
2. Look for the file `expense_tracker.db`
3. If the database hasn't been created yet, it will be automatically created when the server starts for the first time

### Backup Recommendations
- **Before making any changes:** Always create a backup copy of `expense_tracker.db`
- **Backup location:** Create a `backups` folder and copy the database there with a timestamp
- **Example:** `expense_tracker_backup_2024-12-01.db`

---

## Recommended Tools

### Option 1: DB Browser for SQLite (Recommended for Desktop)

**Best for:** Quick database browsing, querying, and visual editing

#### Download & Install
1. Visit: https://sqlitebrowser.org/
2. Download "DB Browser for SQLite" for Windows
3. Install the application

#### Setup Instructions
1. Open DB Browser for SQLite
2. Click **"Open Database"**
3. Navigate to: `admin-web/backend/expense_tracker.db`
4. Click **"Open"**

#### Features
- ✅ Visual table browser
- ✅ SQL query editor
- ✅ Data editing with forms
- ✅ Export data to CSV/JSON
- ✅ View database structure
- ✅ Execute custom queries
- ✅ Free and open-source

#### Usage Tips
- Use the **"Browse Data"** tab to view table contents
- Use the **"Execute SQL"** tab to run custom queries
- Use **File → Export → Table to CSV** to export data
- Always backup before editing data

---

### Option 2: SQLiteStudio (Alternative Desktop Tool)

**Best for:** Advanced SQL editing and database administration

#### Download & Install
1. Visit: https://sqlitestudio.pl/
2. Download SQLiteStudio for Windows
3. Install (portable version available)

#### Setup Instructions
1. Open SQLiteStudio
2. Click **Database → Add a database** (or press `Ctrl+O`)
3. Navigate to `expense_tracker.db`
4. Click **"OK"**

#### Features
- ✅ Multiple database connections
- ✅ Advanced SQL editor with syntax highlighting
- ✅ Database structure visualization
- ✅ Query history
- ✅ Plugin system
- ✅ Free and open-source

---

### Option 3: VS Code Extension (For Developers)

**Best for:** Quick database access while coding

#### Install Extension
1. Open VS Code
2. Go to Extensions (Ctrl+Shift+X)
3. Search for "SQLite Viewer" or "SQLite"
4. Install one of these extensions:
   - **SQLite Viewer** by Florian Klampfer
   - **SQLite** by alexcvzz

#### Setup Instructions
1. Install the extension
2. Right-click on `expense_tracker.db` in VS Code
3. Select "Open Database" or "View Database"
4. Use the extension's UI to browse tables

---

### Option 4: Web-Based Adminer (For Remote Access)

**Best for:** Accessing database from any browser, sharing with team

#### Installation
1. Download Adminer from: https://www.adminer.org/
2. Save `adminer.php` to your project folder (e.g., `admin-web/public/`)
3. Configure your server to serve PHP files (if not already configured)

#### Setup Instructions
1. Navigate to: `http://localhost:3002/adminer.php`
2. Select **"SQLite"** from the system dropdown
3. Enter database path: `admin-web/backend/expense_tracker.db`
4. Leave username/password blank (not used for SQLite)
5. Click **"Login"**

#### Features
- ✅ Web-based interface
- ✅ Works on any device with a browser
- ✅ Query builder
- ✅ Data export
- ✅ User management (if configured)

---

### Option 5: Command Line (SQLite3 CLI)

**Best for:** Quick queries, scripting, automation

#### Access
1. SQLite3 is included with most systems
2. Open PowerShell or Command Prompt
3. Navigate to the backend folder:
   ```powershell
   cd C:\Users\GooseWeisz\oxford-mileage-tracker\admin-web\backend
   ```

#### Basic Commands
```powershell
# Open database
sqlite3 expense_tracker.db

# Show all tables
.tables

# Show table structure
.schema employees

# Run a query
SELECT * FROM employees LIMIT 10;

# Export to CSV
.mode csv
.output employees.csv
SELECT * FROM employees;
.output stdout

# Exit
.quit
```

---

## Database Schema

### Table: `employees`
**Purpose:** Stores all employee information

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT | Primary key, unique employee ID |
| name | TEXT | Employee full name |
| email | TEXT | Employee email address |
| password | TEXT | Hashed password (bcrypt) |
| oxfordHouseId | TEXT | Oxford House employee ID |
| position | TEXT | Job position/title |
| phoneNumber | TEXT | Phone number |
| baseAddress | TEXT | Primary address |
| baseAddress2 | TEXT | Secondary address line |
| costCenters | TEXT | JSON array of assigned cost centers |
| selectedCostCenters | TEXT | JSON array of selected cost centers |
| defaultCostCenter | TEXT | Default cost center |
| preferredName | TEXT | Preferred display name |
| supervisorId | TEXT | ID of supervisor (foreign key to employees.id) |
| approvalFrequency | TEXT | Report frequency (monthly/weekly/biweekly) |
| signature | TEXT | Employee signature data |
| typicalWorkStartHour | INTEGER | Typical work start hour (0-23) |
| typicalWorkEndHour | INTEGER | Typical work end hour (0-23) |
| hasCompletedOnboarding | INTEGER | 1 if onboarding completed, 0 otherwise |
| hasCompletedSetupWizard | INTEGER | 1 if setup wizard completed, 0 otherwise |
| archived | INTEGER | 1 if archived, 0 or NULL if active |
| createdAt | TEXT | ISO timestamp of creation |
| updatedAt | TEXT | ISO timestamp of last update |

**Indexes:**
- `idx_employees_email` on `email`
- `idx_employees_supervisorId` on `supervisorId`

---

### Table: `expense_reports`
**Purpose:** Stores complete monthly expense reports with approval workflow

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT | Primary key, unique report ID |
| employeeId | TEXT | Foreign key to employees.id |
| month | INTEGER | Month (1-12) |
| year | INTEGER | Year (e.g., 2024) |
| reportData | TEXT | JSON string containing complete report data |
| status | TEXT | Status: draft, submitted, approved, needs_revision, rejected |
| submittedAt | TEXT | ISO timestamp of submission |
| approvedAt | TEXT | ISO timestamp of approval |
| approvedBy | TEXT | ID of approver |
| approvalWorkflow | TEXT | JSON array of approval workflow steps |
| currentApprovalStep | INTEGER | Current step in approval workflow |
| currentApprovalStage | TEXT | Current stage: supervisor, finance |
| currentApproverId | TEXT | ID of current approver |
| currentApproverName | TEXT | Name of current approver |
| escalationDueAt | TEXT | ISO timestamp when escalation is due |
| createdAt | TEXT | ISO timestamp of creation |
| updatedAt | TEXT | ISO timestamp of last update |

**Unique Constraint:** `(employeeId, month, year)`

**Indexes:**
- `idx_expense_reports_employee` on `employeeId`
- `idx_expense_reports_employee_month_year` on `(employeeId, month, year)`

---

### Table: `mileage_entries`
**Purpose:** Stores individual mileage/travel entries

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT | Primary key |
| employeeId | TEXT | Foreign key to employees.id |
| oxfordHouseId | TEXT | Oxford House employee ID |
| date | TEXT | Date in YYYY-MM-DD format |
| odometerReading | REAL | Odometer reading |
| startLocation | TEXT | Starting location description |
| endLocation | TEXT | Ending location description |
| purpose | TEXT | Purpose of trip |
| miles | REAL | Miles traveled |
| notes | TEXT | Additional notes |
| hoursWorked | REAL | Hours worked |
| isGpsTracked | INTEGER | 1 if GPS tracked, 0 otherwise |
| costCenter | TEXT | Cost center for this entry |
| startLocationName | TEXT | Start location name |
| startLocationAddress | TEXT | Start location address |
| startLocationLat | REAL | Start latitude |
| startLocationLng | REAL | Start longitude |
| endLocationName | TEXT | End location name |
| endLocationAddress | TEXT | End location address |
| endLocationLat | REAL | End latitude |
| endLocationLng | REAL | End longitude |
| createdAt | TEXT | ISO timestamp |
| updatedAt | TEXT | ISO timestamp |

**Indexes:**
- `idx_mileage_entries_employeeId` on `employeeId`
- `idx_mileage_entries_date` on `date`
- `idx_mileage_entries_employee_date` on `(employeeId, date)`

---

### Table: `receipts`
**Purpose:** Stores expense receipts

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT | Primary key |
| employeeId | TEXT | Foreign key to employees.id |
| date | TEXT | Date in YYYY-MM-DD format |
| amount | REAL | Receipt amount |
| vendor | TEXT | Vendor name |
| description | TEXT | Receipt description |
| category | TEXT | Expense category |
| imageUri | TEXT | Path to receipt image |
| costCenter | TEXT | Cost center |
| createdAt | TEXT | ISO timestamp |
| updatedAt | TEXT | ISO timestamp |

**Indexes:**
- `idx_receipts_employeeId` on `employeeId`
- `idx_receipts_date` on `date`
- `idx_receipts_employee_date` on `(employeeId, date)`

---

### Table: `time_tracking`
**Purpose:** Stores time tracking entries

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT | Primary key |
| employeeId | TEXT | Foreign key to employees.id |
| date | TEXT | Date in YYYY-MM-DD format |
| category | TEXT | Time category |
| hours | REAL | Hours worked |
| description | TEXT | Description |
| costCenter | TEXT | Cost center |
| createdAt | TEXT | ISO timestamp |
| updatedAt | TEXT | ISO timestamp |

**Indexes:**
- `idx_time_tracking_employeeId` on `employeeId`
- `idx_time_tracking_date` on `date`
- `idx_time_tracking_employee_date` on `(employeeId, date)`

---

### Table: `cost_centers`
**Purpose:** Stores cost center definitions

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT | Primary key |
| code | TEXT | Unique cost center code |
| name | TEXT | Cost center name |
| description | TEXT | Description |
| isActive | INTEGER | 1 if active, 0 if inactive |
| createdAt | TEXT | ISO timestamp |
| updatedAt | TEXT | ISO timestamp |

**Unique Constraint:** `code`

---

### Table: `daily_descriptions`
**Purpose:** Stores daily activity descriptions

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT | Primary key |
| employeeId | TEXT | Foreign key to employees.id |
| date | TEXT | Date in YYYY-MM-DD format |
| description | TEXT | Daily description |
| costCenter | TEXT | Cost center |
| createdAt | TEXT | ISO timestamp |
| updatedAt | TEXT | ISO timestamp |

**Indexes:**
- `idx_daily_descriptions_employee` on `employeeId`
- `idx_daily_descriptions_employee_date` on `(employeeId, date)`

---

### Table: `report_builder_presets`
**Purpose:** Stores saved report builder configurations

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT | Primary key |
| name | TEXT | Preset name |
| description | TEXT | Preset description |
| columns | TEXT | JSON array of selected columns |
| filters | TEXT | JSON object of filter settings |
| createdBy | TEXT | User who created preset |
| updatedBy | TEXT | User who last updated preset |
| createdAt | TEXT | ISO timestamp |
| updatedAt | TEXT | ISO timestamp |

---

### Table: `report_delivery_schedules` (or `report_schedules`)
**Purpose:** Stores scheduled report delivery configurations

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT | Primary key |
| name | TEXT | Schedule name |
| description | TEXT | Description |
| recipients | TEXT | Comma-separated email addresses |
| frequency | TEXT | daily, weekly, or monthly |
| dayOfWeek | INTEGER | Day of week (0-6, Sunday=0) for weekly |
| dayOfMonth | INTEGER | Day of month (1-31) for monthly |
| timeOfDay | TEXT | Time in HH:MM format (default: '09:00') |
| timezone | TEXT | Timezone identifier (default: 'America/New_York') |
| includeCsv | INTEGER | 1 to include CSV, 0 otherwise |
| includePdf | INTEGER | 1 to include PDF, 0 otherwise |
| columns | TEXT | JSON array of columns |
| filters | TEXT | JSON object of filters |
| rowLimit | INTEGER | Maximum rows to include (default: 1000) |
| active | INTEGER | 1 if active, 0 if paused |
| lastRunAt | TEXT | ISO timestamp of last run |
| nextRunAt | TEXT | ISO timestamp of next run |
| lastStatus | TEXT | Status of last run (success/failed) |
| lastError | TEXT | Error message if last run failed |
| createdBy | TEXT | User who created schedule |
| updatedBy | TEXT | User who last updated schedule |
| createdAt | TEXT | ISO timestamp |
| updatedAt | TEXT | ISO timestamp |

---

### Additional Tables

- **`monthly_reports`** - Monthly report summaries (legacy)
- **`weekly_reports`** - Weekly report summaries (legacy)
- **`biweekly_reports`** - Biweekly report summaries (legacy)
- **`per_diem_rules`** - Per diem rules by cost center
- **`ees_rules`** - EES (employee expense) rules
- **`per_diem_monthly_rules`** - Monthly per diem rules
- **`report_status`** - Report status tracking (legacy)
- **`report_approvals`** - Approval history (legacy)
- **`supervisor_notifications`** - Notifications for supervisors
- **`staff_notifications`** - Notifications for staff
- **`dashboard_preferences`** - User dashboard preferences
- **`current_employee`** - Current logged-in employee tracking

---

## Common Queries

### View All Employees
```sql
SELECT id, name, email, position, supervisorId, archived
FROM employees
ORDER BY name;
```

### View Active Employees Only
```sql
SELECT id, name, email, position
FROM employees
WHERE archived IS NULL OR archived = 0
ORDER BY name;
```

### View Employees by Supervisor
```sql
SELECT 
    e.id,
    e.name,
    e.email,
    e.position,
    s.name AS supervisor_name
FROM employees e
LEFT JOIN employees s ON e.supervisorId = s.id
WHERE e.archived IS NULL OR e.archived = 0
ORDER BY supervisor_name, e.name;
```

### View All Expense Reports
```sql
SELECT 
    er.id,
    e.name AS employee_name,
    er.month,
    er.year,
    er.status,
    er.submittedAt,
    er.approvedAt
FROM expense_reports er
JOIN employees e ON er.employeeId = e.id
ORDER BY er.year DESC, er.month DESC, e.name;
```

### View Pending Reports
```sql
SELECT 
    er.id,
    e.name AS employee_name,
    er.month,
    er.year,
    er.status,
    er.submittedAt
FROM expense_reports er
JOIN employees e ON er.employeeId = e.id
WHERE er.status IN ('submitted', 'pending_supervisor', 'pending_finance')
ORDER BY er.submittedAt ASC;
```

### View Reports by Cost Center
```sql
-- First, get reports and parse JSON to extract cost centers
SELECT 
    e.name AS employee_name,
    er.month,
    er.year,
    er.status,
    json_extract(er.reportData, '$.costCenters') AS cost_centers
FROM expense_reports er
JOIN employees e ON er.employeeId = e.id
WHERE er.reportData LIKE '%"costCenters"%'
ORDER BY er.year DESC, er.month DESC;
```

### View Total Expenses by Month
```sql
SELECT 
    year,
    month,
    COUNT(*) AS report_count,
    SUM(CAST(json_extract(reportData, '$.totalExpenses') AS REAL)) AS total_expenses
FROM expense_reports
WHERE status = 'approved'
GROUP BY year, month
ORDER BY year DESC, month DESC;
```

### View Employee Mileage Summary
```sql
SELECT 
    e.name AS employee_name,
    COUNT(me.id) AS entry_count,
    SUM(me.miles) AS total_miles,
    AVG(me.miles) AS avg_miles_per_entry
FROM mileage_entries me
JOIN employees e ON me.employeeId = e.id
GROUP BY e.id, e.name
ORDER BY total_miles DESC;
```

### View Reports Needing Attention
```sql
SELECT 
    er.id,
    e.name AS employee_name,
    er.month,
    er.year,
    er.status,
    er.submittedAt,
    er.escalationDueAt,
    CASE 
        WHEN datetime(er.escalationDueAt) < datetime('now') THEN 'Overdue'
        ELSE 'Due Soon'
    END AS priority
FROM expense_reports er
JOIN employees e ON er.employeeId = e.id
WHERE er.status IN ('submitted', 'pending_supervisor', 'pending_finance')
    AND datetime(er.escalationDueAt) < datetime('now', '+24 hours')
ORDER BY er.escalationDueAt ASC;
```

### View All Cost Centers
```sql
SELECT 
    code,
    name,
    description,
    CASE 
        WHEN isActive = 1 THEN 'Active'
        ELSE 'Inactive'
    END AS status
FROM cost_centers
ORDER BY name;
```

### View Approval Workflow for a Report
```sql
-- Get report with approval workflow parsed
SELECT 
    er.id,
    e.name AS employee_name,
    er.status,
    er.approvalWorkflow,
    er.currentApprovalStep,
    er.currentApprovalStage,
    er.currentApproverName
FROM expense_reports er
JOIN employees e ON er.employeeId = e.id
WHERE er.id = 'YOUR_REPORT_ID_HERE';
```

### Count Reports by Status
```sql
SELECT 
    status,
    COUNT(*) AS count
FROM expense_reports
GROUP BY status
ORDER BY count DESC;
```

### View Recent Activity
```sql
SELECT 
    'Expense Report' AS type,
    e.name AS employee_name,
    er.status AS action,
    er.updatedAt AS timestamp
FROM expense_reports er
JOIN employees e ON er.employeeId = e.id
UNION ALL
SELECT 
    'Mileage Entry' AS type,
    e.name AS employee_name,
    'Created' AS action,
    me.createdAt AS timestamp
FROM mileage_entries me
JOIN employees e ON me.employeeId = e.id
ORDER BY timestamp DESC
LIMIT 50;
```

---

## Safety & Best Practices

### ⚠️ Important Warnings

1. **Always Backup First**
   - Copy `expense_tracker.db` before making any changes
   - Use versioned backups: `expense_tracker_backup_2024-12-01.db`

2. **Stop the Server Before Editing**
   - Close the Node.js server before making database changes
   - SQLite can handle concurrent reads, but writes may conflict

3. **Test Queries First**
   - Always use `SELECT` queries first to verify data
   - Use transactions for complex updates
   - Test on a backup copy first

4. **Be Careful with UPDATE/DELETE**
   - Always use `WHERE` clauses (avoid updating all rows)
   - Use `SELECT` first to verify which rows will be affected
   - Consider using soft deletes (archived flag) instead of hard deletes

### ✅ Safe Operations

**Safe to do:**
- ✅ Browse data
- ✅ View table structures
- ✅ Export data to CSV
- ✅ Run SELECT queries
- ✅ View indexes

**Use Caution:**
- ⚠️ UPDATE statements (always use WHERE clause)
- ⚠️ DELETE statements (prefer archiving)
- ⚠️ ALTER TABLE (may require migration)
- ⚠️ DROP TABLE (only if you know what you're doing)

**Never do:**
- ❌ DELETE without WHERE clause
- ❌ UPDATE without WHERE clause
- ❌ DROP TABLE without backup
- ❌ Modify primary keys or foreign keys without understanding relationships

### Transaction Example

For multiple related updates, use a transaction:

```sql
BEGIN TRANSACTION;

UPDATE expense_reports 
SET status = 'approved', approvedAt = datetime('now')
WHERE id = 'report-id-here';

UPDATE employees 
SET updatedAt = datetime('now')
WHERE id = 'employee-id-here';

COMMIT;
-- Use ROLLBACK if something goes wrong
```

---

## Troubleshooting

### Database is Locked

**Problem:** Cannot open database, getting "database is locked" error

**Solutions:**
1. Stop the Node.js server
2. Close all database viewer applications
3. Wait a few seconds
4. Try opening again
5. If still locked, check for `.db-journal` file (delete it if server is stopped)

### Database Not Found

**Problem:** Database file doesn't exist

**Solutions:**
1. Check the file path in `server.js` (line ~217)
2. Ensure the server has run at least once (it creates the database)
3. Check file permissions
4. Verify you're looking in the correct directory

### Cannot View JSON Data

**Problem:** JSON columns show as text strings

**Solutions:**
1. Use `json_extract()` function:
   ```sql
   SELECT json_extract(reportData, '$.totalExpenses') FROM expense_reports;
   ```
2. Some tools have JSON viewers built-in
3. Copy JSON to a JSON formatter/validator online

### Performance Issues

**Problem:** Queries are slow

**Solutions:**
1. Ensure indexes exist (check schema section above)
2. Use `EXPLAIN QUERY PLAN` to analyze queries:
   ```sql
   EXPLAIN QUERY PLAN SELECT * FROM employees WHERE email = 'test@example.com';
   ```
3. Limit results with `LIMIT` clause
4. Add indexes for frequently queried columns

### Corrupted Database

**Problem:** Database file appears corrupted

**Solutions:**
1. **Restore from backup** (if available)
2. Try SQLite's integrity check:
   ```sql
   PRAGMA integrity_check;
   ```
3. Export data using `.dump` command:
   ```powershell
   sqlite3 expense_tracker.db .dump > backup.sql
   ```
4. Recreate database and import:
   ```powershell
   sqlite3 new_database.db < backup.sql
   ```

---

## Quick Reference Commands

### SQLite Command Line Quick Reference

```powershell
# Open database
sqlite3 expense_tracker.db

# Show all tables
.tables

# Show table structure
.schema table_name

# Show indexes
.indexes table_name

# Set output mode
.mode column
.mode csv
.mode json

# Export table to CSV
.headers on
.mode csv
.output employees.csv
SELECT * FROM employees;
.output stdout

# Import CSV
.mode csv
.import file.csv table_name

# Show database file info
.dbinfo

# Vacuum database (reclaim space)
VACUUM;

# Check integrity
PRAGMA integrity_check;

# Exit
.quit
```

---

## Next Steps

1. **Choose Your Tool:** Select one of the recommended tools above
2. **Create Backup:** Make a backup copy of your database
3. **Open Database:** Connect to the database using your chosen tool
4. **Explore Tables:** Browse the tables to understand the data structure
5. **Run Test Queries:** Try the common queries above
6. **Set Up Regular Backups:** Schedule regular database backups

---

## Additional Resources

- **SQLite Documentation:** https://www.sqlite.org/docs.html
- **DB Browser for SQLite:** https://sqlitebrowser.org/
- **SQLiteStudio:** https://sqlitestudio.pl/
- **SQLite Tutorial:** https://www.sqlitetutorial.net/

---

---

## Quick Start Alternative

For a faster setup guide, see **DATABASE_QUICK_START.md** which provides a condensed version of this guide.

---

**Last Updated:** [Current Date]  
**Version:** 1.0

---

*For technical support or questions about the database schema, refer to `admin-web/backend/server.js` where tables are defined in the `ensureTablesExist()` function (starting around line 655).*

