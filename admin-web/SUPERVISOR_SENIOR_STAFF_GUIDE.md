# Supervisor & Senior Staff Management - Complete Guide

## Overview

The Admin Portal now includes comprehensive management for two types of leadership roles:
1. **Supervisors** - Manage staff members and approve their reports
2. **Senior Staff** - Approve reports but do not manage staff

## Features Implemented

### ✅ Dual Tab Interface
- **Supervisors Tab**: Displays all supervisors and their team members
- **Senior Staff Tab**: Displays all senior staff members
- Quick count badges showing how many in each category
- Tab-specific "Add" buttons

### ✅ Add Supervisors/Senior Staff
- Click "Add Supervisor" or "Add Senior Staff" button (context-aware based on active tab)
- Select any regular employee from dropdown
- System automatically updates their position title
- Senior Staff designation added without staff management capability
- Supervisors can have staff assigned

### ✅ Delete/Remove Designation
- Red delete button on each card
- Removes "Supervisor" or "Senior Staff" from position title
- Confirmation dialog before removal
- Automatically unassigns all staff members if supervisor is deleted
- Cleans up position titles (removes keywords like Manager, Director, etc.)

### ✅ Assign Staff to Supervisors
- "Assign Staff" button on each supervisor card
- Multi-select dropdown for choosing staff
- Only supervisors can have staff assigned (not senior staff)
- Shows unassigned staff only
- Bulk assignment capability

### ✅ Unassign Staff
- Click X on staff chip to unassign
- Staff becomes unassigned and shows in warning banner

### ✅ Unassigned Staff Warning
- Orange alert banner when staff have no supervisor
- Shows count and names
- Prominently displayed to encourage assignment

## User Roles

### Supervisors
- **Purpose**: Manage and oversee team members
- **Capabilities**:
  - Have staff assigned to them
  - Approve reports from their team
  - Position includes "Supervisor", "Manager", or "Director"
- **Database**: `supervisorId` field links staff to supervisor

### Senior Staff
- **Purpose**: Senior-level employees who can approve reports
- **Capabilities**:
  - Approve reports (coming soon)
  - Do NOT manage staff members
  - Position includes "Senior Staff"
- **Use Cases**:
  - Experienced staff who can review work
  - Leadership without direct reports
  - Project leads or subject matter experts

## How It Works

### Identification Logic

The system identifies supervisors and senior staff by analyzing the `position` field:

```typescript
// Senior Staff (checked first)
if (position includes 'senior staff') → type = 'senior-staff'

// Supervisors  
else if (position includes 'supervisor' OR 'manager' OR 'director') → type = 'supervisor'
```

### Data Structure

```typescript
interface SupervisorWithStaff {
  supervisor: Employee;        // The supervisor/senior staff member
  staffMembers: Employee[];    // Array of staff (empty for senior staff)
  type: 'supervisor' | 'senior-staff';  // The role type
}
```

## Workflows

### 1. Adding a Supervisor

1. Click "Supervisors" tab
2. Click "Add Supervisor" button
3. Select employee from dropdown
4. Click "Add as Supervisor"
5. Employee's position updated to include "- Supervisor"
6. Card appears in Supervisors tab
7. Can now assign staff to them

### 2. Adding Senior Staff

1. Click "Senior Staff" tab
2. Click "Add Senior Staff" button
3. Select employee from dropdown
4. Click "Add as Senior Staff"
5. Employee's position updated to include "- Senior Staff"
6. Card appears in Senior Staff tab
7. No staff assignment capability (by design)

### 3. Removing Designation

1. Find the supervisor/senior staff card
2. Click red delete button (top right of card)
3. Confirm the removal
4. Position title cleaned up (removes designation keywords)
5. If supervisor: all staff become unassigned
6. Card removed from list

### 4. Assigning Staff to Supervisor

1. Find supervisor card in Supervisors tab
2. Click "Assign Staff" button
3. Multi-select staff from dropdown
4. Click "Assign (X)" where X is the count
5. Staff chips appear under supervisor
6. Staff's `supervisorId` updated in database

### 5. Unassigning Staff

1. Find staff chip under supervisor
2. Click X icon on chip
3. Staff's `supervisorId` set to NULL
4. Staff appears in unassigned warning

## UI Components

### Tabs
- Material-UI Tabs component
- Icons: `SupervisorAccount` for Supervisors, `Groups` for Senior Staff
- Count badges showing totals
- Context-aware buttons

### Cards
- Card-based layout (responsive grid)
- Different icons for supervisor vs senior staff
- Staff count chip
- Delete button (red, top-right)
- Team member chips (removable for supervisors)
- "Assign Staff" button (supervisors only)

### Dialogs
- **Add Dialog**: Autocomplete employee search, info alert, confirmation button
- **Assign Staff Dialog**: Multi-select autocomplete, shows unassigned count
- **Delete Confirmation**: Browser confirm dialog with warning message

## Database Schema

### Employees Table
```sql
CREATE TABLE employees (
  id TEXT PRIMARY KEY,
  name TEXT,
  position TEXT,              -- Contains "Supervisor" or "Senior Staff"
  supervisorId TEXT,         -- References another employee's ID (NULL for supervisors/senior staff)
  -- ... other fields
)
```

### Key Fields
- `position`: Title that determines if employee is supervisor/senior staff
- `supervisorId`: Links staff to their supervisor (NULL if no supervisor)

## Position Title Management

### Adding Designation
```typescript
// For Supervisor
newPosition = "Field Coordinator - Supervisor"

// For Senior Staff  
newPosition = "Field Coordinator - Senior Staff"
```

### Removing Designation
```typescript
// Cleans up position by removing:
- " - Supervisor"
- " - Senior Staff"  
- "Supervisor "
- "Senior Staff "
- "Manager "
- "Director "

// If empty after cleanup: "Staff Member"
```

## Special Cases

### Employee is Both?
- System checks "Senior Staff" first
- If position has both keywords, treated as Senior Staff
- Can manually edit position to change designation

### Supervisor with No Staff
- Still appears in Supervisors tab
- "Assign Staff" button available
- Not flagged as unassigned (they ARE assigned as a supervisor)

### Senior Staff Cannot Have Staff
- No "Assign Staff" button shown
- `staffMembers` array always empty
- Attempting to assign staff will fail gracefully

### Unassigned Staff
- Orange warning banner
- Shows count and names
- Encourages assignment
- Can be assigned from any supervisor card

## API Integration

Uses existing Employee API:
- `GET /api/employees` - Load all employees
- `PUT /api/employees/:id` - Update position or supervisorId
- `PUT /api/employees/bulk-update` - Bulk update supervisorIds

## Files Modified

### New/Updated Files:
- `admin-web/src/components/SupervisorManagement.tsx` - Main component (updated with tabs and delete)
- `admin-web/src/components/AdminPortal.tsx` - Added Supervisor Management tab
- `admin-web/SUPERVISOR_SENIOR_STAFF_GUIDE.md` - This documentation

## Future Enhancements

1. **Employee Edit Form Integration**
   - Add supervisor dropdown to employee create/edit dialog
   - Allow direct assignment during onboarding

2. **Report Approval**
   - Senior Staff can approve reports
   - Supervisors can approve their team's reports
   - Approval workflow UI

3. **Organizational Chart**
   - Visual hierarchy display
   - Drag-and-drop reassignment
   - Export org chart as image

4. **Bulk Operations**
   - Reassign all staff from one supervisor to another
   - Bulk promote multiple employees
   - Import from CSV

5. **Analytics**
   - Team size distribution
   - Supervisor workload balance
   - Senior staff utilization

6. **Notifications**
   - Email when supervisor assigned
   - Alert when staff unassigned
   - Admin alerts for unassigned staff

## Testing Checklist

- [ ] Add a supervisor
- [ ] Add senior staff
- [ ] Assign staff to supervisor
- [ ] Verify senior staff cannot have staff assigned
- [ ] Remove staff assignment (click X on chip)
- [ ] Delete supervisor (confirm staff become unassigned)
- [ ] Delete senior staff
- [ ] Switch between tabs (counts update correctly)
- [ ] View unassigned staff warning
- [ ] Assign multiple staff at once (bulk)
- [ ] Remove supervisor with multiple staff
- [ ] Add employee who already has keywords in position

## Support

For questions or issues, contact the development team.

## Version History

- **v1.0** - Initial supervisor management
- **v2.0** - Added Senior Staff designation, tabs, delete functionality

