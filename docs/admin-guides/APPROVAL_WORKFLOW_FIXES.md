# Approval Workflow Fixes

## Summary
The approval workflow runs **Staff → [Senior Staff] → Supervisor → Finance**. Senior Staff approve first for their team; then the Supervisor approves; then Finance. Revision flows go back along the same chain (e.g. Supervisor → Senior Staff → Staff). See also [SENIOR_STAFF_APPROVAL_DESIGN.md](./SENIOR_STAFF_APPROVAL_DESIGN.md) for design decisions.

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

**When employee has a Senior Staff** (workflow: Senior Staff → Supervisor → Finance):

1. **Staff submits report**
   - Status: `pending_senior_staff`
   - Workflow: `[senior_staff (pending), supervisor (waiting), finance (waiting)]`
   - Current step: Senior Staff
   - Notification sent to Senior Staff

2. **Senior Staff approves**
   - Status: `pending_supervisor`
   - Workflow: `[senior_staff (approved), supervisor (pending), finance (waiting)]`
   - Current step: Supervisor
   - Notification sent to Supervisor

3. **Supervisor approves**
   - Status: `pending_finance`
   - Workflow: `[senior_staff (approved), supervisor (approved), finance (pending)]`
   - Current step: Finance
   - Notification sent to Finance

4. **Finance approves**
   - Status: `approved`
   - Report is fully approved

**When employee has no Senior Staff** (workflow: Supervisor → Finance):

1. **Staff submits report**
   - Status: `pending_supervisor`
   - Workflow: `[supervisor (pending), finance (waiting)]`
   - Current step: Supervisor

2. **Supervisor approves** → Status: `pending_finance`, current step: Finance

3. **Finance approves** → Status: `approved`

### Supervisor visibility

- Supervisors see **all** team reports (everyone under them, including Staff under Senior Staff).
- Reports still at Senior Staff appear in the **same list** with a **notation** (e.g. “Waiting on Senior Staff”) so the Supervisor can see status but does not act until the report reaches the Supervisor step.

### Revision Flow (Backward Path)

#### Finance → Supervisor → (Senior Staff →) Finance or Employee
1. **Finance requests revision**
   - Status: `needs_revision`, stage: `pending_supervisor`
   - Current step: Supervisor (reset)
   - Notification sent to Supervisor

2. **Supervisor can either:**
   - **Resubmit to Finance** (if changes were made at supervisor level)
   - **Send back to Senior Staff** (if report had a Senior Staff step) → then Senior Staff can send back to Employee
   - **Send back to Employee** (if no Senior Staff or if supervisor chooses to send directly to employee)

#### Supervisor → Senior Staff → Employee
1. **Supervisor requests revision** (report had already passed Senior Staff)
   - Status: `needs_revision`, stage: `pending_senior_staff`
   - Current step: Senior Staff (reset)
   - Notification sent to Senior Staff

2. **Senior Staff can send back to Employee**
   - Status: `needs_revision`, current approver: Employee
   - Employee makes changes and resubmits → flow goes Senior Staff → Supervisor → Finance again

#### Senior Staff → Employee
1. **Senior Staff requests revision**
   - Status: `needs_revision`, current approver: Employee
   - Notification sent to Employee

2. **Employee resubmits** → flow goes Senior Staff → Supervisor → Finance

## Key Backend Actions

### Available Actions:
- `approve` - Approves current step and moves to next (Senior Staff → Supervisor → Finance)
- `request_revision_to_supervisor` - Finance sends back to supervisor
- `request_revision_to_senior_staff` - Supervisor sends back to senior staff (then senior staff can send to employee)
- `request_revision_to_employee` - Supervisor or Senior Staff sends back to employee
- `resubmit_to_finance` - Supervisor resubmits after making changes
- `reject` - Generic reject (determines target based on current step)
- `delegate` - Delegates approval to another supervisor
- `remind` - Sends reminder to approver
- `comment` - Adds comment without changing status

## Frontend Integration

### Senior Staff Portal
- Shows reports where employee’s `seniorStaffId` = current user (or report assigned to them)
- Status: `pending_senior_staff` or `needs_revision` at senior staff stage
- Can approve → sends to Supervisor
- Can request revision → sends to Employee

### Supervisor Portal
- Shows **all** team reports (everyone under supervisor, recursive). Reports still at Senior Staff appear **with notation** (e.g. “Waiting on Senior Staff”).
- For reports at Supervisor step: status `pending_supervisor` or `needs_revision` with stage `pending_supervisor`
- Can approve → sends to Finance
- Can request revision → sends to Senior Staff (or to Employee if no senior staff step)
- Can resubmit to finance → after making changes
- Can assign **Senior Staff** for employees they supervise (who reviews/approves first)

### Finance Portal
- Shows reports with status `pending_finance` or `submitted`
- Can approve → final approval
- Can request revision → sends back to supervisor

### Staff Portal
- Shows reports with status `needs_revision` when sent back
- Can make changes and resubmit

## Testing Checklist

- [ ] Staff (with Senior Staff) submits report → appears in Senior Staff Portal
- [ ] Senior Staff approves → appears in Supervisor Portal
- [ ] Supervisor sees report in list (with “Waiting on Senior Staff” until it reaches them)
- [ ] Supervisor approves → appears in Finance Portal
- [ ] Finance approves → report status becomes `approved`
- [ ] Finance requests revision → appears in Supervisor Portal
- [ ] Supervisor requests revision → goes to Senior Staff (or Employee); Senior Staff can send to Employee
- [ ] Supervisor resubmits to finance → appears in Finance Portal again
- [ ] Employee resubmits → goes back through Senior Staff → Supervisor → Finance (or Supervisor → Finance if no senior staff)
- [ ] Staff with no Senior Staff: submit → Supervisor → Finance
- [ ] Notifications at each stage; workflow history correct

## Next Steps

1. Test the complete workflow end-to-end
2. Verify notifications are working correctly
3. Check that the UI properly displays revision status
4. Ensure employees can see and handle revision requests

