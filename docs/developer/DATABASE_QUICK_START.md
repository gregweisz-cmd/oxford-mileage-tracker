# Database Quick Start Guide

**Oxford House Expense Reporting System - SQLite Database**

A quick reference for getting started with database management.

---

## Quick Setup (5 Minutes)

### Step 1: Install DB Browser for SQLite (Recommended)

1. Download from: https://sqlitebrowser.org/
2. Install the application
3. Open DB Browser for SQLite

### Step 2: Open Your Database

1. Click **"Open Database"**
2. Navigate to: `C:\Users\GooseWeisz\oxford-mileage-tracker\admin-web\backend\`
3. Select `expense_tracker.db`
4. Click **"Open"**

### Step 3: Create a Backup (Important!)

1. In DB Browser, go to **File → Backup Database**
2. Save as: `expense_tracker_backup_YYYY-MM-DD.db`
3. Keep this backup safe before making any changes

---

## Quick Queries to Get Started

### View All Employees
```sql
SELECT id, name, email, position FROM employees 
WHERE archived IS NULL OR archived = 0 
ORDER BY name;
```

### View All Expense Reports
```sql
SELECT 
    e.name AS employee,
    er.month,
    er.year,
    er.status,
    er.submittedAt
FROM expense_reports er
JOIN employees e ON er.employeeId = e.id
ORDER BY er.year DESC, er.month DESC;
```

### Count Reports by Status
```sql
SELECT status, COUNT(*) as count 
FROM expense_reports 
GROUP BY status;
```

### View Database Size
```sql
-- Get all tables and their row counts
SELECT 
    name as table_name,
    (SELECT COUNT(*) FROM employees WHERE name != '') as row_count
FROM sqlite_master 
WHERE type='table' 
ORDER BY name;
```

---

## Essential Safety Rules

1. ✅ **ALWAYS backup before changes**
2. ✅ **Stop the server before editing**
3. ✅ **Use SELECT first, UPDATE second**
4. ✅ **Always use WHERE clauses**
5. ❌ **Never DELETE without WHERE**
6. ❌ **Never UPDATE without WHERE**

---

## Database File Location

```
C:\Users\GooseWeisz\oxford-mileage-tracker\admin-web\backend\expense_tracker.db
```

---

## Main Tables

- **`employees`** - All employee information
- **`expense_reports`** - Monthly expense reports
- **`mileage_entries`** - Individual mileage entries
- **`receipts`** - Expense receipts
- **`cost_centers`** - Cost center definitions
- **`report_builder_presets`** - Saved report configurations
- **`report_delivery_schedules`** - Scheduled report deliveries

---

## Need More Help?

See the complete **DATABASE_MANAGEMENT_GUIDE.md** for:
- Detailed table schemas
- More query examples
- Tool setup instructions
- Troubleshooting guide

---

**Quick Tip:** Use DB Browser's **"Browse Data"** tab to view tables visually, and **"Execute SQL"** tab to run queries.

