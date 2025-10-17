# Supervisor Management Feature - Admin Portal

## Overview

The Supervisor Management feature allows administrators to:
1. View all supervisors and their team members
2. Promote employees to supervisor roles
3. Assign staff members to supervisors
4. Manage supervisor-staff relationships

## Implementation Status

### ✅ Completed Features

1. **Supervisor Management Tab** - Added to Admin Portal
   - New tab between "Employee Management" and "Cost Center Management"
   - Only accessible to users with admin privileges

2. **Supervisor List View** - Card-based UI showing:
   - Supervisor name and position
   - Team member count
   - List of assigned staff members (as chips)
   - Quick action button to assign more staff

3. **Promote to Supervisor** - Dialog to designate employees as supervisors
   - Select any employee to promote
   - Updates their position to include "Supervisor"
   - Removes them from reporting to another supervisor

4. **Assign Staff to Supervisor** - Dialog to manage team assignments
   - Shows unassigned staff members
   - Multi-select interface using Autocomplete
   - Bulk assign multiple staff at once
   - Shows count of staff to be assigned

5. **Remove Staff Assignment** - Quick action
   - Click the X on any staff chip to unassign them
   - Staff becomes "unassigned" and shows in the warning banner

6. **Unassigned Staff Warning** - Banner showing staff without supervisors
   - Prominently displays count and names
   - Orange warning color to draw attention

## Database Schema

The employee table includes a `supervisorId` field:
```sql
supervisorId TEXT DEFAULT NULL
```

This field:
- Contains the ID of the supervisor the employee reports to
- Is NULL if the employee has no supervisor
- Is NULL if the employee is a supervisor themselves

## How It Works

### Identifying Supervisors

The system identifies supervisors in two ways:
1. **By Position** - Employees with positions containing:
   - "Supervisor"
   - "Manager"
   - "Director"

2. **By Relationship** - Employees who have staff assigned to them (referenced by supervisorId)

### Supervisor Organization

```typescript
interface SupervisorWithStaff {
  supervisor: Employee;
  staffMembers: Employee[];
}
```

The component automatically:
- Groups employees by their supervisor
- Counts staff members per supervisor
- Identifies unassigned staff

## User Workflows

### 1. Viewing Supervisors

1. Admin logs into Admin Portal
2. Clicks "Supervisor Management" tab
3. Sees cards for each supervisor showing:
   - Supervisor name and position
   - Count of team members
   - List of assigned staff

### 2. Promoting an Employee to Supervisor

1. Click "Promote to Supervisor" button
2. Search/select employee from dropdown
3. System updates their position to include "Supervisor"
4. Click "Promote"
5. Employee now appears as a supervisor card

### 3. Assigning Staff to a Supervisor

1. Click "Assign Staff" on supervisor card
2. Multi-select staff members from dropdown
3. Only shows unassigned staff
4. Click "Assign (X)" button
5. Staff chips appear under supervisor
6. Unassigned count decreases

### 4. Removing Staff Assignment

1. Find staff member's chip under supervisor
2. Click X icon on the chip
3. Staff is unassigned
4. Appears in unassigned warning banner

## API Integration

Uses existing Employee API methods:
- `onUpdateEmployee(id, { supervisorId })` - Assign/remove supervisor
- `onBulkUpdateEmployees(ids, { supervisorId })` - Bulk assign
- Component refreshes automatically when employees data changes

## Files Created/Modified

### New Files:
- `admin-web/src/components/SupervisorManagement.tsx` - Main component

### Modified Files:
- `admin-web/src/components/AdminPortal.tsx` - Added Supervisor Management tab

## Styling

- Uses Material-UI components for consistency
- Card-based layout for supervisors (responsive: 1/2/3 columns)
- Chips for team members (removable)
- Color-coded alerts (warning for unassigned staff)
- Icons: `SupervisorAccount` for supervisors, `Person` for staff

## Permissions

- **Admin Only** - Feature is only accessible in the Admin Portal
- Regular employees and supervisors cannot access this feature
- Only admins can promote/assign/unassign supervisors

## Future Enhancements

### Still TODO:
1. **Add Supervisor Dropdown to Employee Edit Form**
   - Modify `EmployeeManagementComponent.tsx`
   - Add supervisor selection field when creating/editing employees
   - Allow direct assignment during employee onboarding

2. **Supervisor Dashboard Integration**
   - Show team members in Supervisor Portal
   - Filter reports by supervised employees
   - Team performance metrics

3. **Bulk Operations**
   - Reassign all staff from one supervisor to another
   - Bulk promote multiple employees
   - Import supervisor relationships from CSV

4. **Reporting**
   - Organizational chart view
   - Supervisor workload balance
   - Team size analytics

5. **Notifications**
   - Notify employee when supervisor is assigned
   - Notify supervisor when staff is assigned
   - Alert admins of unassigned staff

## Testing

To test the feature:

1. **Start the backend:**
   ```bash
   cd admin-web/backend
   npm start
   ```

2. **Start the frontend:**
   ```bash
   cd admin-web
   npm start
   ```

3. **Login as Admin** and navigate to Supervisor Management tab

4. **Test Workflows:**
   - Promote an employee to supervisor
   - Assign staff to supervisors
   - Remove staff assignments
   - View supervisor cards and team members

## Notes

- The `supervisorId` field was already in the database schema
- The feature integrates seamlessly with existing employee management
- No new API endpoints needed - uses existing employee update endpoints
- Supervisor relationships are stored in the main employees table
- Changes sync in real-time with other admin portal tabs

## Support

For issues or questions, contact the development team.

