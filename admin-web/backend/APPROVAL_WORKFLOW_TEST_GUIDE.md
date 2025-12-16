# Approval Workflow Test Guide

**Purpose**: Step-by-step guide to test the complete approval workflow  
**Estimated Time**: 30-45 minutes

---

## 🎯 Test Scenario Overview

We'll test the complete flow:
1. **Employee** creates and submits a report
2. **Supervisor** reviews and approves/rejects
3. **Finance** reviews and approves/rejects
4. **Revision flow** (if needed)

---

## 👤 Test Users Needed

You'll need to log in as different users:

1. **Employee** (e.g., a staff member with a supervisor)
2. **Supervisor** (e.g., AJ Dunaway - Regional Manager)
3. **Finance** (e.g., Greg Weisz or another finance user)

---

## 📋 Step-by-Step Test Plan

### Phase 1: Employee Submits Report (10 min)

#### 1.1 Login as Employee
- [ ] Log in as a staff member (not a supervisor)
- [ ] Navigate to Staff Portal
- [ ] Verify you can see your expense reports

#### 1.2 Create/Edit Report
- [ ] Create a new expense report OR edit an existing draft
- [ ] Add some mileage entries
- [ ] Add some receipts (optional)
- [ ] Save as draft first

#### 1.3 Submit Report
- [ ] Click "Submit Report" button
- [ ] Verify report status changes to "Submitted" or "Pending Supervisor"
- [ ] Check that you see a success message
- [ ] Verify you can no longer edit the report (should be read-only)

**Expected Result**: 
- Report status: `pending_supervisor` (if has supervisor) or `pending_finance` (if no supervisor)
- Notification sent to supervisor (if applicable)

---

### Phase 2: Supervisor Reviews Report (10 min)

#### 2.1 Login as Supervisor
- [ ] Log out from employee account
- [ ] Log in as AJ Dunaway (or another supervisor)
- [ ] Navigate to Supervisor Portal
- [ ] Check for notifications (should see new report notification)

#### 2.2 View Pending Approvals
- [ ] Go to "Pending Approvals" or "Team Reports" section
- [ ] Verify the submitted report appears in the list
- [ ] Check report status shows as "Pending Supervisor" or "Pending Approval"

#### 2.3 Review Report Details
- [ ] Click on the report to view details
- [ ] Verify you can see:
  - Employee name
  - Report month/year
  - Mileage entries
  - Receipts
  - Total amounts
- [ ] Verify report is read-only (can't edit)

#### 2.4 Test Approval Path A: Approve Report
- [ ] Click "Approve" button
- [ ] Add optional comments
- [ ] Submit approval
- [ ] Verify success message
- [ ] Check report status changes to "Pending Finance"
- [ ] Verify notification sent to finance team

**Expected Result**:
- Report status: `pending_finance`
- Notification sent to finance
- Report moves to finance queue

#### 2.5 Test Approval Path B: Request Revision (Alternative)
- [ ] **OR** click "Request Revision" button
- [ ] Enter revision reason/comments
- [ ] Select specific items that need revision (if applicable)
- [ ] Submit revision request
- [ ] Verify success message
- [ ] Check report status changes to "Needs Revision"
- [ ] Verify notification sent to employee

**Expected Result**:
- Report status: `needs_revision`
- Notification sent to employee
- Employee can now edit and resubmit

---

### Phase 3: Finance Reviews Report (10 min)

#### 3.1 Login as Finance User
- [ ] Log out from supervisor account
- [ ] Log in as finance user (Greg Weisz or finance role)
- [ ] Navigate to Finance Portal
- [ ] Check for notifications (should see approved report notification)

#### 3.2 View Pending Approvals
- [ ] Go to "Pending Approvals" or "Submitted Reports" section
- [ ] Verify the supervisor-approved report appears
- [ ] Check report status shows as "Pending Finance"

#### 3.3 Review Report Details
- [ ] Click on the report to view details
- [ ] Verify you can see:
  - Employee name
  - Supervisor approval status
  - All report data
  - Approval history
- [ ] Verify report is read-only

#### 3.4 Test Approval Path A: Final Approval
- [ ] Click "Approve" button
- [ ] Add optional comments
- [ ] Submit approval
- [ ] Verify success message
- [ ] Check report status changes to "Approved"
- [ ] Verify notification sent to employee

**Expected Result**:
- Report status: `approved`
- Notification sent to employee
- Report is fully approved and locked

#### 3.5 Test Approval Path B: Request Revision from Finance (Alternative)
- [ ] **OR** click "Request Revision" button
- [ ] Enter revision reason/comments
- [ ] Submit revision request
- [ ] Verify success message
- [ ] Check report status changes to "Needs Revision"
- [ ] Verify notification sent to supervisor (not employee)

**Expected Result**:
- Report status: `needs_revision`
- Stage: `pending_supervisor`
- Notification sent to supervisor
- Supervisor can review and either:
  - Resubmit to finance (if supervisor makes changes)
  - Send back to employee (if employee needs to make changes)

---

### Phase 4: Revision Flow Testing (10 min)

#### 4.1 Test Supervisor Resubmit to Finance
- [ ] Login as supervisor
- [ ] Find report that finance requested revision on
- [ ] Review the revision request
- [ ] Make any necessary changes (if supervisor can edit)
- [ ] Click "Resubmit to Finance"
- [ ] Verify report goes back to finance queue

#### 4.2 Test Employee Resubmit After Revision
- [ ] Login as employee
- [ ] Find report that needs revision
- [ ] Check notification about revision request
- [ ] Edit the report (should now be editable)
- [ ] Make requested changes
- [ ] Click "Resubmit"
- [ ] Verify report goes back to supervisor queue

---

## ✅ Success Criteria Checklist

### Employee Submission
- [ ] Employee can submit report
- [ ] Report status changes correctly
- [ ] Notification sent to supervisor
- [ ] Report becomes read-only after submission

### Supervisor Approval
- [ ] Supervisor sees pending reports
- [ ] Supervisor can view report details
- [ ] Supervisor can approve report
- [ ] Supervisor can request revision
- [ ] Notifications sent correctly
- [ ] Report status updates correctly

### Finance Approval
- [ ] Finance sees supervisor-approved reports
- [ ] Finance can view report details
- [ ] Finance can approve report
- [ ] Finance can request revision
- [ ] Notifications sent correctly
- [ ] Report status updates correctly

### Revision Flow
- [ ] Revision requests work correctly
- [ ] Reports become editable when revision requested
- [ ] Resubmission works correctly
- [ ] Notifications sent at each step

### Notifications
- [ ] Notifications appear in dashboard
- [ ] Notification bell shows unread count
- [ ] Clicking notification navigates to report
- [ ] Notifications are role-appropriate

---

## 🐛 Common Issues to Watch For

1. **Report not appearing in supervisor queue**
   - Check employee has a supervisor assigned
   - Check report status is `pending_supervisor`
   - Check supervisor is logged in correctly

2. **Cannot approve report**
   - Verify you're logged in as the correct approver
   - Check report status is correct
   - Check browser console for errors

3. **Notifications not appearing**
   - Check notification API is working
   - Verify employee/supervisor IDs are correct
   - Check browser console for errors

4. **Report not becoming editable after revision**
   - Check report status is `needs_revision`
   - Verify employee is logged in
   - Check backend logs for errors

---

## 🔍 Quick API Tests

You can also test the API endpoints directly:

### Submit Report
```bash
curl -X PUT http://localhost:3002/api/expense-reports/{reportId}/status \
  -H "Content-Type: application/json" \
  -d '{"status": "submitted"}'
```

### Approve Report (Supervisor)
```bash
curl -X PUT http://localhost:3002/api/expense-reports/{reportId}/approval \
  -H "Content-Type: application/json" \
  -d '{
    "action": "approve",
    "approverId": "{supervisorId}",
    "approverName": "Supervisor Name"
  }'
```

### Request Revision
```bash
curl -X PUT http://localhost:3002/api/expense-reports/{reportId}/approval \
  -H "Content-Type: application/json" \
  -d '{
    "action": "request_revision_to_employee",
    "approverId": "{supervisorId}",
    "approverName": "Supervisor Name",
    "comments": "Please fix these items"
  }'
```

### Get Pending Approvals
```bash
curl http://localhost:3002/api/approvals/pending?approverId={supervisorId}
```

---

## 📝 Test Results Template

**Date**: _______________  
**Tester**: _______________  

### Employee Submission
- Status: [ ] PASS [ ] FAIL
- Notes: 

### Supervisor Approval
- Status: [ ] PASS [ ] FAIL
- Notes: 

### Finance Approval
- Status: [ ] PASS [ ] FAIL
- Notes: 

### Revision Flow
- Status: [ ] PASS [ ] FAIL
- Notes: 

### Notifications
- Status: [ ] PASS [ ] FAIL
- Notes: 

### Issues Found:
1. 
2. 
3. 

---

**Ready to start testing!** Follow the steps above and check off each item as you complete it.

