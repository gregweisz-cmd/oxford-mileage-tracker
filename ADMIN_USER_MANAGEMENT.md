# Admin User Management Implementation

## Overview
Implemented automatic employee ID generation and password management for admins creating and managing user accounts in the Oxford House Expense Tracker.

## Features Added

### 1. Automatic Employee ID Generation
- **Format**: `firstname-lastname-suffix-{timestamp}-{random}`
- **Example**: `john-doe-smith-1733012345-abc12`
- IDs are generated from employee names and include timestamps + random suffixes for uniqueness
- Ensures no ID collisions even when multiple employees have similar names

### 2. Automatic Password Generation
- **Format**: `{FirstName}welcome1`
- **Example**: For "John Smith" → `Johnwelcome1`
- Passwords are auto-generated if not provided by admin
- Can be customized per employee if needed

### 3. Employee Creation Enhancements
- ✅ **Required Fields Validation**: Name, email, and position are now required
- ✅ **Preferred Name Support**: Admins can set a preferred name for display
- ✅ **Password Support**: Admins can set custom passwords or auto-generate
- ✅ **Temporary Password Return**: Admin receives temporary password if auto-generated
- ✅ **Complete Field Support**: All employee fields (cost centers, supervisors, etc.)

### 4. Bulk Operations
- Bulk create employees uses same ID and password generation
- Supports CSV imports with EMPLOYEE_ID field mapping
- Sequential processing to prevent race conditions

## API Endpoints

### POST `/api/employees`
Creates a new employee with auto-generated ID and password.

**Request Body**:
```json
{
  "name": "John Smith",
  "email": "john.smith@oxfordhouse.org",
  "position": "Field Staff",
  "preferredName": "Johnny",
  "password": "CustomPass123!" // Optional
}
```

**Response**:
```json
{
  "id": "john-smith-1733012345-abc12",
  "message": "Employee created successfully",
  "temporaryPassword": "Johnwelcome1" // Only if password was auto-generated
}
```

### POST `/api/employees/bulk-create`
Bulk creates multiple employees with auto-generated IDs and passwords.

**Request Body**:
```json
{
  "employees": [
    {
      "name": "John Smith",
      "email": "john.smith@oxfordhouse.org",
      "position": "Field Staff"
    },
    {
      "name": "Jane Doe",
      "email": "jane.doe@oxfordhouse.org",
      "position": "Supervisor"
    }
  ]
}
```

**Response**:
```json
{
  "success": true,
  "totalProcessed": 2,
  "successful": 2,
  "failed": 0,
  "errors": [],
  "createdEmployees": [
    {
      "id": "john-smith-1733012345-abc12",
      "name": "John Smith",
      "email": "john.smith@oxfordhouse.org"
    },
    {
      "id": "jane-doe-1733012346-def34",
      "name": "Jane Doe",
      "email": "jane.doe@oxfordhouse.org"
    }
  ]
}
```

## Usage in Admin Portal

### Creating a Single Employee
1. Navigate to Admin Portal → Employee Management
2. Click "Add Employee"
3. Fill in required fields (name, email, position)
4. Optional: Set preferred name, custom password, cost centers, supervisor
5. Click "Create"
6. System generates ID and password automatically
7. Admin receives temporary password for new employee (if not set custom)

### Bulk Import
1. Navigate to Admin Portal → Employee Management
2. Click "Import Employees"
3. Upload CSV with columns:
   - `EMPLOYEE_ID` (Oxford House ID - optional)
   - `FULL_NAME`
   - `WORK_EMAIL`
   - `EMPLOYEE_TITLE`
   - `PHONE`
   - `COST_CENTER`
   - `ROLE_LEVEL` (optional)
   - `SUPERVISOR_EMAIL` (optional)
4. System generates IDs and passwords for all employees
5. Admin receives summary of created employees

## Helper Functions

### `generateEmployeeId(name)`
Generates a unique employee ID based on the employee's name.

**Parameters**:
- `name` (string): Employee's full name

**Returns**:
- Unique employee ID string

**Example**:
```javascript
generateEmployeeId("John Michael Smith")
// Returns: "john-michael-smith-1733012345-abc12"
```

### `generateDefaultPassword(name)`
Generates a default password based on the employee's first name.

**Parameters**:
- `name` (string): Employee's full name

**Returns**:
- Password string

**Example**:
```javascript
generateDefaultPassword("John Michael Smith")
// Returns: "Johnwelcome1"
```

## Testing

### Manual Testing
1. Start local backend: `cd admin-web/backend && node server.js`
2. Start frontend: `cd admin-web && npm start`
3. Log in as admin to Admin Portal
4. Create a test employee
5. Verify ID is generated and formatted correctly
6. Verify password is generated correctly
7. Test login with new employee credentials

### API Testing
```bash
# Test employee creation
curl -X POST http://localhost:3002/api/employees \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Employee",
    "email": "test@oxfordhouse.org",
    "position": "Staff"
  }'

# Should return:
# {
#   "id": "test-employee-1733012345-xyz78",
#   "message": "Employee created successfully",
#   "temporaryPassword": "Testwelcome1"
# }
```

## Database Schema

No database schema changes required. The existing `employees` table already supports all necessary fields:
- `id` (PRIMARY KEY)
- `name`
- `preferredName`
- `email`
- `password`
- `oxfordHouseId`
- `position`
- `phoneNumber`
- `baseAddress`
- `baseAddress2`
- `costCenters`
- `selectedCostCenters`
- `defaultCostCenter`
- `supervisorId`
- `createdAt`
- `updatedAt`

## Security Considerations

1. **Password Generation**: Default passwords are predictable and should be changed on first login (future enhancement)
2. **ID Uniqueness**: Timestamp + random suffix ensures uniqueness even for employees with identical names
3. **Password Storage**: Passwords are currently stored in plain text (hash in production - future enhancement)
4. **Admin Access**: Only admins can create employees via the Admin Portal

## Future Enhancements

1. **Password Policies**: Implement password strength requirements
2. **Password Hashing**: Hash passwords before storing (bcrypt, argon2, etc.)
3. **Force Password Change**: Require password change on first login
4. **Email Notifications**: Send welcome email with credentials to new employees
5. **Import Templates**: Provide downloadable CSV templates for bulk imports
6. **Duplicate Detection**: Check for existing employees before creating new ones
7. **Audit Logging**: Log all employee creation/modification actions
8. **Role-Based Permissions**: Restrict employee management to specific admin roles

## Files Modified

- `admin-web/backend/server.js`:
  - Added `generateEmployeeId()` helper function (line ~34)
  - Added `generateDefaultPassword()` helper function (line ~54)
  - Updated `POST /api/employees` endpoint (line ~1346)
  - Updated `POST /api/employees/bulk-create` endpoint (line ~1279)

## Related Documentation

- See `GRID-TIMESHEET-NOTES.md` for overall system architecture
- See `AdminPortal.tsx` for frontend admin interface
- See `employeeApiService.ts` for frontend API service

