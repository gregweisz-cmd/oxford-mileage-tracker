# Add "Last Login" Column to Employee Management

## Overview
Add a "Last Login" column to the Employee Management table that shows when each employee last logged into the system.

## Tasks Required

### 1. Database Schema Update
- [ ] Add `lastLoginAt` field to `employees` table in SQLite
  - Type: `TEXT` (ISO 8601 date string, nullable)
  - Default: `NULL`
  - Update `dbService.js` to include in table creation

### 2. Backend: Track Login
- [ ] Update login endpoint (`routes/auth.js`) to record `lastLoginAt` on successful login
  - Update employees table: `UPDATE employees SET lastLoginAt = ? WHERE id = ?`
  - Set to current timestamp: `new Date().toISOString()`

### 3. Backend: Return Last Login Data
- [ ] Ensure employee queries include `lastLoginAt` field
  - Already included if we SELECT * from employees
  - Verify GET `/api/employees` returns this field

### 4. Frontend: Display Column
- [ ] Update `EmployeeManagementComponent.tsx` to add "Last Login" column
  - Add to table headers
  - Format date nicely (e.g., "MM/DD/YYYY HH:MM AM/PM" or "2 days ago")
  - Handle null/undefined (show "Never" or "-")

### 5. Frontend: Sort Functionality
- [ ] Add sorting capability for Last Login column
  - Most recent first / oldest first
  - Handle nulls appropriately (always sort to bottom?)

## Files to Modify

### Backend:
- `admin-web/backend/services/dbService.js` - Add field to table schema
- `admin-web/backend/routes/auth.js` - Update on login
- Possibly: `admin-web/backend/routes/employees.js` - Verify field is returned

### Frontend:
- `admin-web/src/components/EmployeeManagementComponent.tsx` - Add column to table
- `admin-web/src/components/EmployeeManagement.tsx` - If using different component

## Implementation Notes

1. **Database Migration**: Since this is SQLite, we can use `ALTER TABLE` or the existing table creation will handle new fields if we recreate the table structure.

2. **Date Formatting**: Use a helper function for consistent date formatting:
   - `new Date(employee.lastLoginAt).toLocaleString()` for readable format
   - Or use a library like `date-fns` if already installed

3. **Null Handling**: Show "Never" or "—" for employees who have never logged in

4. **Performance**: The `lastLoginAt` update on login is a simple UPDATE query - should be very fast

## Example Display Format

```
Last Login
───────────
12/15/2024 2:30 PM
12/10/2024 9:15 AM
Never
3 days ago
```

## Testing Checklist

- [ ] New employees (no login) show "Never" or "—"
- [ ] After logging in, timestamp is recorded
- [ ] Column displays correctly in table
- [ ] Sorting works (most recent first)
- [ ] Date formatting is readable and consistent
- [ ] Works in both local and production

