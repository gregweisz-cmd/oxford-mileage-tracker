# Approval Workflow Testing Guide

## 🎯 Testing Checklist for Approval Process

Now that the servers are running, test the complete approval workflow to ensure everything works correctly.

---

## **Test 1: Forward Flow (Normal Approval Path)**

### 1.1 Staff Submits Report
**Action:**
- Go to Staff Portal (`http://localhost:3000`)
- Login as a staff member
- Create/submit a monthly expense report

**Expected Result:**
- ✅ Report status changes to: `pending_supervisor` (or `pending_finance` if no supervisor)
- ✅ Report appears in Supervisor Portal
- ✅ Notification sent to supervisor

**Verify:**
- [ ] Report shows correct status
- [ ] Supervisor can see the report in their portal
- [ ] Notification appears for supervisor

---

### 1.2 Supervisor Approves Report
**Action:**
- Go to Supervisor Portal
- Find the submitted report
- Click **"Approve and Send to Finance"**
- Check the certification acknowledgment checkbox
- Submit approval

**Expected Result:**
- ✅ Report status changes to: `pending_finance`
- ✅ Report moves from Supervisor Portal to Finance Portal
- ✅ Notification sent to Finance team
- ✅ Supervisor step in workflow marked as `approved`

**Verify:**
- [ ] Report no longer shows in Supervisor's pending list
- [ ] Report appears in Finance Portal
- [ ] Report status is `pending_finance`
- [ ] Notification appears for finance users

---

### 1.3 Finance Approves Report (Final Approval)
**Action:**
- Go to Finance Portal
- Find the report from supervisor
- Click **"Approve Report"** (✓ icon)

**Expected Result:**
- ✅ Report status changes to: `approved`
- ✅ Report is fully approved and complete
- ✅ Both workflow steps marked as `approved`
- ✅ Report can be viewed in approved reports

**Verify:**
- [ ] Report status is `approved`
- [ ] Report appears in "Approved Reports" tab
- [ ] Workflow shows both steps as approved

---

## **Test 2: Revision Flow - Finance → Supervisor → Finance**

### 2.1 Finance Requests Revision from Supervisor
**Action:**
- Go to Finance Portal
- Find a report with status `pending_finance`
- Click **"Request Revision from Supervisor"** (Send icon)
- Enter comments explaining what needs to be revised (e.g., "Missing receipts for travel expenses")
- Submit revision request

**Expected Result:**
- ✅ Report status changes to: `needs_revision`
- ✅ Current approval stage: `pending_supervisor`
- ✅ Report moves back to Supervisor Portal
- ✅ Notification sent to supervisor
- ✅ Finance step marked as `revision_requested`
- ✅ Supervisor step reset to `pending`

**Verify:**
- [ ] Report disappears from Finance Portal pending list
- [ ] Report appears in Supervisor Portal with revision notice
- [ ] Report status shows `needs_revision`
- [ ] Supervisor can see finance comments
- [ ] Notification appears for supervisor

---

### 2.2 Supervisor Handles Finance Revision Request

**Option A: Supervisor Resubmits to Finance (After Making Changes)**
**Action:**
- Go to Supervisor Portal
- Find report with `needs_revision` status and `pending_supervisor` stage
- Click **"Resubmit to Finance"** (Send icon)
- Enter comments (e.g., "Changes made per finance feedback - added missing receipts")
- Submit

**Expected Result:**
- ✅ Report status changes to: `pending_finance`
- ✅ Report moves back to Finance Portal
- ✅ Supervisor step marked as `approved`
- ✅ Finance step reset to `pending`
- ✅ Notification sent to Finance

**Verify:**
- [ ] Report moves from Supervisor Portal to Finance Portal
- [ ] Status is `pending_finance`
- [ ] Finance can see supervisor's resubmission comments

---

**Option B: Supervisor Sends Back to Employee (If Employee Needs to Make Changes)**
**Action:**
- In Supervisor Portal
- Find report with revision request from Finance
- Click **"Request Revision from Employee"** (X icon)
- Enter comments for employee (e.g., "Please add missing receipts")
- Submit

**Expected Result:**
- ✅ Report status: `needs_revision`
- ✅ Current approval stage: `needs_revision`
- ✅ Report moves to Staff Portal
- ✅ Current approver: Employee
- ✅ Notification sent to employee

**Verify:**
- [ ] Report disappears from Supervisor Portal
- [ ] Employee can see the report needs revision
- [ ] Comments from finance and supervisor are visible
- [ ] Notification appears for employee

---

## **Test 3: Revision Flow - Supervisor → Employee**

### 3.1 Supervisor Requests Revision from Employee
**Action:**
- Go to Supervisor Portal
- Find a report with status `pending_supervisor`
- Click **"Request Revision from Employee"** (X icon)
- Enter comments (e.g., "Please correct mileage calculations")
- Submit

**Expected Result:**
- ✅ Report status: `needs_revision`
- ✅ Current approval stage: `needs_revision`
- ✅ Report moves to Staff Portal
- ✅ Current approver: Employee
- ✅ Notification sent to employee

**Verify:**
- [ ] Report disappears from Supervisor Portal
- [ ] Report appears in Staff Portal with revision notice
- [ ] Employee can see supervisor's comments

---

### 3.2 Employee Makes Changes and Resubmits
**Action:**
- Go to Staff Portal
- Find report with `needs_revision` status
- Make the requested changes
- Resubmit the report

**Expected Result:**
- ✅ Report status: `pending_supervisor`
- ✅ Workflow reinitialized (fresh start)
- ✅ Report moves back to Supervisor Portal
- ✅ Notification sent to supervisor

**Verify:**
- [ ] Report status changes to `pending_supervisor`
- [ ] Report appears in Supervisor Portal again
- [ ] Workflow starts fresh (supervisor → finance)

---

## **Test 4: Multiple Revision Cycles**

### 4.1 Complete Cycle: Finance → Supervisor → Employee → Supervisor → Finance → Approved
**Action:**
Test the complete backward-forward cycle:
1. Finance requests revision → goes to Supervisor
2. Supervisor sends back to Employee
3. Employee makes changes and resubmits → goes to Supervisor
4. Supervisor approves → goes to Finance
5. Finance approves → Final approval

**Expected Result:**
- ✅ Each transition works correctly
- ✅ Status changes appropriately at each step
- ✅ Notifications sent at each stage
- ✅ Comments preserved throughout workflow

**Verify:**
- [ ] All status transitions work correctly
- [ ] No reports get lost in the workflow
- [ ] Comments history is maintained

---

## **Test 5: Edge Cases**

### 5.1 Report Without Supervisor
**Action:**
- Submit a report from an employee who has no supervisor assigned

**Expected Result:**
- ✅ Report goes directly to Finance (`pending_finance`)
- ✅ Workflow only has finance step

---

### 5.2 Supervisor Delegation
**Action:**
- In Supervisor Portal
- Find a pending report
- Click "Delegate" button
- Select another supervisor
- Delegate the approval

**Expected Result:**
- ✅ Report assigned to delegate
- ✅ Delegate can approve the report
- ✅ Original supervisor can still see it

---

### 5.3 Comments Throughout Workflow
**Action:**
- Add comments at each stage (supervisor, finance)
- Verify comments are visible to all parties

**Expected Result:**
- ✅ Comments are preserved
- ✅ Comments visible to appropriate users
- ✅ Comment history maintained

---

## **Quick Test Scenarios Summary**

### ✅ Happy Path (Quick Test)
1. Staff submits → Supervisor approves → Finance approves
   - **Time: ~2 minutes**

### ✅ Revision Path (Quick Test)
1. Finance requests revision → Supervisor resubmits → Finance approves
   - **Time: ~2 minutes**

### ✅ Full Revision Cycle (Full Test)
1. Finance requests revision → Supervisor sends to Employee → Employee resubmits → Supervisor approves → Finance approves
   - **Time: ~5 minutes**

---

## **What to Look For**

### ✅ Success Indicators:
- Status changes correctly at each step
- Reports move between portals as expected
- Notifications appear for appropriate users
- Comments are preserved and visible
- Workflow steps are properly tracked
- No errors in browser console
- No errors in backend terminal

### ❌ Red Flags (Report These):
- Reports stuck in wrong status
- Reports not appearing in correct portal
- Status not updating after actions
- Actions failing silently
- Notifications not being sent
- Comments disappearing
- Errors in browser console
- Errors in backend terminal

---

## **Testing Tips**

1. **Start Simple**: Test the happy path first (Staff → Supervisor → Finance)
2. **One at a Time**: Test each revision scenario separately
3. **Check Console**: Open browser DevTools (F12) to see any errors
4. **Check Backend**: Watch backend terminal for errors
5. **Test with Real Data**: Use actual employee/supervisor accounts
6. **Verify Notifications**: Check notification bell in each portal

---

## **Report Issues**

If you find any issues, note:
1. **What action you took**
2. **What you expected to happen**
3. **What actually happened**
4. **Any error messages** (from browser console or backend)
5. **Which portal you were in**
6. **Report status before and after**

---

## **Next Steps After Testing**

Once testing is complete:
- ✅ Document any issues found
- ✅ Verify all scenarios work as expected
- ✅ Update UI if needed based on feedback
- ✅ Consider adding automated tests for workflow

Good luck testing! 🚀

