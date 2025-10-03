# 🧪 SUPERVISOR WORKFLOW TESTING PLAN
*Testing Guide for Report Approval System & Supervisor Team Management*

## 📋 **Test Overview**
This guide covers testing all the supervisor workflow functionality implemented over the past two days:
- ✅ Report Approval System (Backend API + Service)
- ✅ Supervisor Team Landing Page
- ✅ Staff Portal Supervisor Mode Integration
- ✅ Submit for Review Functionality

---

## 🚀 **PRE-TEST SETUP**

### **1. Start Backend Server**
```bash
cd c:\Users\GooseWeisz\oxford-mileage-tracker\admin-web\backend
npm start
```
**Expected**: Server starts on port 3002 with new report approval tables created

### **2. Start Frontend Server**
```bash
cd c:\Users\GooseWeisz\oxford-mileage-tracker\admin-web
npm start
```
**Expected**: React app starts on port 3000

### **3. Verify Database Tables**
Check that these new tables were created:
- `report_status`
- `report_approvals` 
- `supervisor_notifications`
- `staff_notifications`

---

## 🎯 **TEST SCENARIOS**

### **TEST 1: Supervisor Team Landing Page**

#### **1.1 Access Supervisor Dashboard**
- **URL**: `http://localhost:3000/supervisor-team-landing?supervisorId=emp1&supervisorName=Greg%20Weisz`
- **Expected**: 
  - Team members displayed in cards
  - Month/Year selector at top
  - Summary stats at bottom
  - Refresh button works

#### **1.2 Month/Year Selection**
- **Action**: Change month to previous month (e.g., September 2025)
- **Expected**: 
  - Page refreshes with new month data
  - Team member cards update
  - Summary stats recalculate

#### **1.3 Team Member Cards**
- **Expected for each card**:
  - Employee name and position
  - Report status chip (Draft, Submitted, Approved, etc.)
  - Data status (Has Data / No Data)
  - "View Report" button
  - "Submit for Review" button (if applicable)

#### **1.4 View Report Button**
- **Action**: Click "View Report" on any team member
- **Expected**: 
  - Opens StaffPortal in new tab
  - URL includes supervisor mode parameters
  - Shows employee's report for selected month/year

---

### **TEST 2: Staff Portal Supervisor Mode**

#### **2.1 Supervisor Mode Access**
- **URL**: `http://localhost:3000/staff-portal?employeeId=mg71acdmrlh5uvfa50a&month=10&year=2025&supervisorMode=true&supervisorId=emp1&supervisorName=Greg%20Weisz`
- **Expected**:
  - StaffPortal loads normally
  - Shows employee's data
  - Submit button available (if report is draft)

#### **2.2 Submit for Review**
- **Prerequisites**: Ensure employee has some data (mileage, receipts, time tracking)
- **Action**: Click "Submit" button
- **Expected**:
  - Completeness check runs automatically
  - If issues found, submission blocked with detailed error
  - If clean, confirmation dialog appears
  - After confirmation, report submitted for approval
  - Success message: "Report submitted successfully! It has been sent to your supervisor for review."

#### **2.3 Report Status Update**
- **After submission**: Return to Supervisor Team Landing Page
- **Expected**: 
  - Team member card shows "Submitted for Review" status
  - "Submit for Review" button disappears
  - Summary stats update

---

### **TEST 3: Report Approval Workflow**

#### **3.1 Pending Reports Queue**
- **URL**: `http://localhost:3000/supervisor-dashboard?supervisorId=emp1&supervisorName=Greg%20Weisz`
- **Expected**:
  - "Pending Reports" tab shows submitted reports
  - Each report shows employee info and submission date
  - Action buttons: Approve, Reject, Request Revision, Message

#### **3.2 Approve Report**
- **Action**: Click "Approve" on a submitted report
- **Expected**:
  - Dialog opens asking for comments
  - Comments optional for approval
  - After approval, report status changes to "Approved"
  - Staff notification created

#### **3.3 Reject Report**
- **Action**: Click "Reject" on a submitted report
- **Expected**:
  - Dialog opens requiring comments
  - Comments mandatory for rejection
  - After rejection, report status changes to "Rejected"
  - Staff notification created with rejection reason

#### **3.4 Request Revision**
- **Action**: Click "Request Revision" on a submitted report
- **Expected**:
  - Dialog opens requiring feedback
  - Comments mandatory for revision request
  - After submission, report status changes to "Needs Revision"
  - Staff notification created with revision feedback

---

### **TEST 4: Notifications System**

#### **4.1 Supervisor Notifications**
- **Location**: Supervisor Dashboard → Notifications tab
- **Expected**:
  - Shows notifications for report submissions
  - Unread notifications highlighted
  - Mark as read functionality works

#### **4.2 Staff Notifications**
- **Location**: Staff Portal (after report action)
- **Expected**:
  - Staff receives notification of approval/rejection/revision
  - Notification includes supervisor comments
  - Notification shows timestamp and supervisor name

#### **4.3 Send Message to Staff**
- **Action**: Click "Message" button on any report
- **Expected**:
  - Dialog opens for composing message
  - Message sent to staff member
  - Staff receives notification

---

### **TEST 5: Report History & Analytics**

#### **5.1 Report History**
- **Location**: Supervisor Dashboard → Report History tab
- **Expected**:
  - Shows all reports reviewed by supervisor
  - Sorted by review date (newest first)
  - Shows status, comments, and dates

#### **5.2 Summary Statistics**
- **Location**: Supervisor Team Landing Page → Bottom summary
- **Expected**:
  - Correct counts for each status
  - Updates when reports are approved/rejected
  - Reflects current month/year selection

---

## 🔍 **EDGE CASES TO TEST**

### **Edge Case 1: No Data Employee**
- **Setup**: Employee with no mileage/receipts/time tracking
- **Expected**: 
  - Shows "Not Started" status
  - "Submit for Review" button hidden
  - Data status shows "No Data"

### **Edge Case 2: Completeness Check Failures**
- **Setup**: Employee with incomplete data (missing odometer readings, etc.)
- **Expected**:
  - Submit blocked with detailed error message
  - Specific issues listed
  - Recommendations provided

### **Edge Case 3: Multiple Submissions**
- **Action**: Try to submit same report multiple times
- **Expected**: 
  - Prevents duplicate submissions
  - Shows appropriate error message

### **Edge Case 4: Invalid Supervisor**
- **Setup**: Access with invalid supervisor ID
- **Expected**:
  - Graceful error handling
  - Appropriate error message

---

## 🐛 **KNOWN ISSUES TO MONITOR**

### **Issue 1: Web Portal Error**
- **Symptom**: `Uncaught (in promise) Error: A listener indicated an asynchronous response`
- **Status**: Testing in incognito mode
- **Action**: Monitor if error reappears

### **Issue 2: Database Connection**
- **Symptom**: API calls fail with connection errors
- **Action**: Restart backend server if needed

### **Issue 3: Port Conflicts**
- **Symptom**: Server won't start on port 3000 or 3002
- **Action**: Check for running processes and kill if needed

---

## 📊 **SUCCESS CRITERIA**

### **✅ Test Passes If:**
1. **Supervisor Team Landing Page** loads and shows team members
2. **Month/Year selection** updates data correctly
3. **Submit for Review** works and updates status
4. **Approval workflow** (Approve/Reject/Revision) functions properly
5. **Notifications** are created and displayed correctly
6. **Report History** shows all actions
7. **Summary statistics** are accurate
8. **Edge cases** are handled gracefully

### **❌ Test Fails If:**
1. Any page fails to load
2. API calls return errors
3. Database operations fail
4. Notifications don't appear
5. Status updates don't persist
6. Error handling is missing

---

## 🔧 **TROUBLESHOOTING GUIDE**

### **Problem: Backend Server Won't Start**
```bash
# Check if port 3002 is in use
netstat -ano | findstr :3002

# Kill process if needed
taskkill /PID <PID_NUMBER> /F

# Restart server
cd c:\Users\GooseWeisz\oxford-mileage-tracker\admin-web\backend
npm start
```

### **Problem: Frontend Server Won't Start**
```bash
# Check if port 3000 is in use
netstat -ano | findstr :3000

# Kill process if needed
taskkill /PID <PID_NUMBER> /F

# Restart server
cd c:\Users\GooseWeisz\oxford-mileage-tracker\admin-web
npm start
```

### **Problem: Database Tables Missing**
- Check backend console for table creation messages
- Restart backend server to trigger table creation
- Verify database file exists at correct path

### **Problem: API Calls Failing**
- Check browser Network tab for error details
- Verify backend server is running
- Check CORS settings if needed

---

## 📝 **TEST RESULTS TEMPLATE**

```
TEST DATE: ___________
TESTER: ___________

TEST 1: Supervisor Team Landing Page
[ ] Page loads correctly
[ ] Month/Year selection works
[ ] Team member cards display properly
[ ] View Report button works
[ ] Summary stats are accurate

TEST 2: Staff Portal Supervisor Mode
[ ] Supervisor mode loads correctly
[ ] Submit for Review works
[ ] Completeness check functions
[ ] Status updates correctly

TEST 3: Report Approval Workflow
[ ] Pending reports queue shows submissions
[ ] Approve functionality works
[ ] Reject functionality works
[ ] Request Revision works
[ ] Comments are saved

TEST 4: Notifications System
[ ] Supervisor notifications appear
[ ] Staff notifications are created
[ ] Send message functionality works
[ ] Mark as read works

TEST 5: Report History & Analytics
[ ] Report history displays correctly
[ ] Summary statistics are accurate
[ ] Data updates in real-time

EDGE CASES:
[ ] No data employee handled correctly
[ ] Completeness check failures handled
[ ] Multiple submissions prevented
[ ] Invalid supervisor handled gracefully

OVERALL RESULT: [ ] PASS [ ] FAIL
NOTES: ________________________________
```

---

## 🎯 **NEXT STEPS AFTER TESTING**

1. **Fix any bugs** found during testing
2. **Document issues** in the TODO list
3. **Plan next features** based on test results
4. **Gather user feedback** on the supervisor workflow
5. **Optimize performance** if needed

---

*Happy Testing! 🚀*
*Created: October 2, 2025*
