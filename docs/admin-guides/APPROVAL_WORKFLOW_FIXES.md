# Approval Workflow Fixes

## Summary
Fixed the approval workflow to properly handle the complete flow from staff → supervisor → finance, and the revision flow going back the other way.

## Fixed Issues

### 1. Finance → Supervisor Revision Flow
**Problem**: When finance requested a revision, the workflow step index wasn't being reset back to the supervisor step, making it difficult for supervisors to handle the revision.

**Fix**: Modified `request_revision_to_supervisor` action to:
- Find the supervisor step in the workflow
- Reset the supervisor step to `pending` status
- Update `currentApprovalStep` to point to the supervisor step index
- Set proper escalation due date for supervisor

**Location**: `admin-web/backend/routes/expenseReports.js` line ~1450

### 2. Supervisor Resubmit to Finance
**Problem**: The `resubmit_to_finance` action was too strict - it would fail if `currentApprovalStep` was pointing to the wrong step (e.g., still pointing to finance after a revision request).

**Fix**: Made the action more robust by:
- Checking if report is in `needs_revision` status with `pending_supervisor` stage
- Finding the supervisor step in the workflow even if `currentStep` is wrong
- Allowing resubmission when the workflow state indicates supervisor should handle it

**Location**: `admin-web/backend/routes/expenseReports.js` line ~1537

## Complete Approval Workflow

### Forward Flow (Normal Approval Path)
1. **Staff submits report** 
   - Status: `pending_supervisor` (or `pending_finance` if no supervisor)
   - Workflow: `[supervisor (pending), finance (waiting)]`
   - Current step: Supervisor

2. **Supervisor approves**
   - Status: `pending_finance`
   - Workflow: `[supervisor (approved), finance (pending)]`
   - Current step: Finance
   - Notification sent to Finance

3. **Finance approves**
   - Status: `approved`
   - Workflow: `[supervisor (approved), finance (approved)]`
   - Current step: Completed
   - Report is fully approved

### Revision Flow (Backward Path)

#### Path 1: Finance → Supervisor → Finance (or Employee)
1. **Finance requests revision**
   - Status: `needs_revision`
   - Stage: `pending_supervisor`
   - Workflow: `[supervisor (pending), finance (revision_requested)]`
   - Current step: Supervisor (reset)
   - Notification sent to Supervisor

2. **Supervisor can either:**
   - **Resubmit to Finance** (if changes were made by supervisor)
     - Status: `pending_finance`
     - Workflow: `[supervisor (approved), finance (pending)]`
     - Current step: Finance
     - Goes back to step 3 above
   
   - **Send back to Employee** (if employee needs to make changes)
     - Status: `needs_revision`
     - Stage: `needs_revision`
     - Current approver: Employee
     - Notification sent to Employee

#### Path 2: Supervisor → Employee
1. **Supervisor requests revision** (from initial submission or after finance revision)
   - Status: `needs_revision`
   - Stage: `needs_revision`
   - Current approver: Employee
   - Notification sent to Employee

2. **Employee makes changes and resubmits**
   - Status: `pending_supervisor` (workflow reinitialized)
   - Workflow: `[supervisor (pending), finance (waiting)]`
   - Current step: Supervisor
   - Goes back to Forward Flow step 2

## Key Backend Actions

### Available Actions:
- `approve` - Approves current step and moves to next
- `request_revision_to_supervisor` - Finance sends back to supervisor
- `request_revision_to_employee` - Supervisor sends back to employee
- `resubmit_to_finance` - Supervisor resubmits after making changes
- `reject` - Generic reject (determines target based on current step)
- `delegate` - Delegates approval to another supervisor
- `remind` - Sends reminder to approver
- `comment` - Adds comment without changing status

## Frontend Integration

### Supervisor Portal
- Shows reports with status `pending_supervisor` or `needs_revision` with stage `pending_supervisor`
- Can approve → sends to finance
- Can request revision → sends to employee
- Can resubmit to finance → after making changes

### Finance Portal
- Shows reports with status `pending_finance` or `submitted`
- Can approve → final approval
- Can request revision → sends back to supervisor

### Staff Portal
- Shows reports with status `needs_revision` when sent back
- Can make changes and resubmit

## Testing Checklist

- [ ] Staff submits report → appears in Supervisor Portal
- [ ] Supervisor approves → appears in Finance Portal
- [ ] Finance approves → report status becomes `approved`
- [ ] Finance requests revision → appears in Supervisor Portal with revision notice
- [ ] Supervisor resubmits to finance → appears in Finance Portal again
- [ ] Supervisor sends back to employee → appears in Staff Portal
- [ ] Employee resubmits → goes back through supervisor → finance flow
- [ ] Notifications are sent at each stage
- [ ] Workflow history tracks all actions correctly

## Next Steps

1. Test the complete workflow end-to-end
2. Verify notifications are working correctly
3. Check that the UI properly displays revision status
4. Ensure employees can see and handle revision requests

