# Comprehensive Testing Checklist

**Purpose**: Complete testing guide for Oxford House Mileage Tracker before finance team meeting.

**Date**: Testing session
**Tester**: [Your Name]
**Environment**: [ ] Development [ ] Production

---

## 🚀 Pre-Testing Setup

### Backend Server
- [ ] Backend server is running (`npm start` in `backend/` directory)
- [ ] Server starts without errors
- [ ] Database is initialized
- [ ] Server logs show: `✅ Server is running on port 3002`
- [ ] WebSocket server initialized

### Frontend Web Portal
- [ ] Admin web portal is running (`npm start` in `admin-web/` directory)
- [ ] Portal loads at `http://localhost:3000`
- [ ] No console errors on page load

### Mobile App (if testing)
- [ ] Mobile app is running (Expo/React Native)
- [ ] App connects to backend server
- [ ] No connection errors

---

## 🔐 Authentication & Authorization

### Login
- [ ] Can log in with valid credentials
- [ ] Login with invalid credentials shows error
- [ ] Login with missing fields shows validation error
- [ ] Login redirects to appropriate dashboard
- [ ] User session is created
- [ ] User role is correctly assigned

### Logout
- [ ] Logout button works
- [ ] Session is cleared on logout
- [ ] Redirected to login page
- [ ] Cannot access protected routes after logout

### User Roles
- [ ] Employee role has correct permissions
- [ ] Supervisor role has correct permissions
- [ ] Finance role has correct permissions
- [ ] Admin role has all permissions
- [ ] Role-based route protection works

---

## 👥 Employee Management

### View Employees
- [ ] GET `/api/employees` - Returns list of employees
- [ ] GET `/api/employees?supervisorId=xxx` - Filters by supervisor
- [ ] GET `/api/employees?search=john` - Search works
- [ ] GET `/api/employees?position=manager` - Filters by position
- [ ] GET `/api/employees/archived` - Shows archived employees
- [ ] GET `/api/employees/:id` - Returns single employee
- [ ] GET `/api/employees/:id` with invalid ID returns 404

### Create Employee
- [ ] POST `/api/employees` - Creates new employee with required fields
- [ ] POST `/api/employees` - Validates required fields (name, email, position)
- [ ] POST `/api/employees` - Validates email format
- [ ] POST `/api/employees` - Auto-generates ID
- [ ] POST `/api/employees` - Auto-generates password if not provided
- [ ] POST `/api/employees` - Returns temporary password
- [ ] POST `/api/employees` - Can set supervisor ID
- [ ] POST `/api/employees` - Can set cost centers

### Update Employee
- [ ] PUT `/api/employees/:id` - Updates employee successfully
- [ ] PUT `/api/employees/:id` - Updates name
- [ ] PUT `/api/employees/:id` - Updates email
- [ ] PUT `/api/employees/:id` - Updates position
- [ ] PUT `/api/employees/:id` - Updates cost centers
- [ ] PUT `/api/employees/:id` - Updates supervisor ID
- [ ] PUT `/api/employees/:id` with invalid ID returns 404

### Archive/Restore Employee
- [ ] POST `/api/employees/:id/archive` - Archives employee
- [ ] POST `/api/employees/:id/restore` - Restores archived employee
- [ ] Archived employees don't appear in default list
- [ ] Archived employees appear in archived list

### Delete Employee
- [ ] DELETE `/api/employees/:id` - Deletes employee
- [ ] DELETE `/api/employees/:id` with invalid ID returns 404
- [ ] Cannot delete employee with related data (if enforced)

### Password Management
- [ ] PUT `/api/employees/:id/password` - Updates password
- [ ] New password is hashed before storing
- [ ] Old password validation (if implemented)

---

## 🚗 Mileage Entries

### View Mileage Entries
- [ ] GET `/api/mileage-entries` - Returns list of entries
- [ ] GET `/api/mileage-entries?employeeId=xxx` - Filters by employee
- [ ] GET `/api/mileage-entries?startDate=xxx&endDate=xxx` - Date range filter
- [ ] GET `/api/mileage-entries/:id` - Returns single entry
- [ ] GPS-tracked entries show location data
- [ ] Manual entries show entered locations

### Create Mileage Entry
- [ ] POST `/api/mileage-entries` - Creates new entry
- [ ] POST `/api/mileage-entries` - Validates required fields
- [ ] POST `/api/mileage-entries` - Saves GPS coordinates (if GPS tracked)
- [ ] POST `/api/mileage-entries` - Calculates miles correctly
- [ ] POST `/api/mileage-entries` - Associates with correct employee
- [ ] POST `/api/mileage-entries` - Broadcasts WebSocket update

### Update Mileage Entry
- [ ] PUT `/api/mileage-entries/:id` - Updates entry successfully
- [ ] PUT `/api/mileage-entries/:id` - Can update purpose
- [ ] PUT `/api/mileage-entries/:id` - Can update miles
- [ ] PUT `/api/mileage-entries/:id` - Can update notes
- [ ] PUT `/api/mileage-entries/:id` with invalid ID returns 404

### Delete Mileage Entry
- [ ] DELETE `/api/mileage-entries/:id` - Deletes entry
- [ ] DELETE `/api/mileage-entries/:id` with invalid ID returns 404
- [ ] Broadcasts WebSocket update on delete

---

## 🧾 Receipts

### View Receipts
- [ ] GET `/api/receipts` - Returns list of receipts
- [ ] GET `/api/receipts?employeeId=xxx` - Filters by employee
- [ ] GET `/api/receipts?startDate=xxx&endDate=xxx` - Date range filter
- [ ] GET `/api/receipts/:id` - Returns single receipt
- [ ] Receipt images are accessible
- [ ] Receipt categories are correct

### Create Receipt
- [ ] POST `/api/receipts` - Creates new receipt
- [ ] POST `/api/receipts` - Validates required fields (date, amount, vendor, category)
- [ ] POST `/api/receipts` - Handles image upload (base64 or file)
- [ ] POST `/api/receipts` - Saves receipt image correctly
- [ ] POST `/api/receipts` - Associates with correct employee
- [ ] POST `/api/receipts` - OCR extraction works (if implemented)
- [ ] POST `/api/receipts` - Broadcasts WebSocket update

### Update Receipt
- [ ] PUT `/api/receipts/:id` - Updates receipt successfully
- [ ] PUT `/api/receipts/:id` - Can update amount
- [ ] PUT `/api/receipts/:id` - Can update vendor
- [ ] PUT `/api/receipts/:id` - Can update category
- [ ] PUT `/api/receipts/:id` - Can update description
- [ ] PUT `/api/receipts/:id` with invalid ID returns 404

### Delete Receipt
- [ ] DELETE `/api/receipts/:id` - Deletes receipt
- [ ] DELETE `/api/receipts/:id` - Deletes associated image file
- [ ] DELETE `/api/receipts/:id` with invalid ID returns 404
- [ ] Broadcasts WebSocket update on delete

---

## ⏰ Time Tracking

### View Time Entries
- [ ] GET `/api/time-tracking` - Returns list of entries
- [ ] GET `/api/time-tracking?employeeId=xxx` - Filters by employee
- [ ] GET `/api/time-tracking?startDate=xxx&endDate=xxx` - Date range filter
- [ ] GET `/api/time-tracking/:id` - Returns single entry

### Create Time Entry
- [ ] POST `/api/time-tracking` - Creates new entry
- [ ] POST `/api/time-tracking` - Validates required fields
- [ ] POST `/api/time-tracking` - Validates hours are positive
- [ ] POST `/api/time-tracking` - Associates with correct employee
- [ ] POST `/api/time-tracking` - Broadcasts WebSocket update

### Update Time Entry
- [ ] PUT `/api/time-tracking/:id` - Updates entry successfully
- [ ] PUT `/api/time-tracking/:id` - Can update hours
- [ ] PUT `/api/time-tracking/:id` - Can update category
- [ ] PUT `/api/time-tracking/:id` with invalid ID returns 404

### Delete Time Entry
- [ ] DELETE `/api/time-tracking/:id` - Deletes entry
- [ ] DELETE `/api/time-tracking/:id` with invalid ID returns 404

---

## 📊 Expense Reports

### View Reports
- [ ] GET `/api/expense-reports` - Returns list of reports
- [ ] GET `/api/expense-reports?employeeId=xxx` - Filters by employee
- [ ] GET `/api/expense-reports?status=draft` - Filters by status
- [ ] GET `/api/expense-reports/:id` - Returns single report
- [ ] Report includes mileage entries
- [ ] Report includes receipts
- [ ] Report includes time entries
- [ ] Report totals are calculated correctly

### Create Report
- [ ] POST `/api/expense-reports` - Creates new report
- [ ] POST `/api/expense-reports` - Validates required fields
- [ ] POST `/api/expense-reports` - Creates for correct month/year
- [ ] POST `/api/expense-reports` - Associates with correct employee
- [ ] POST `/api/expense-reports` - Status starts as 'draft'

### Update Report
- [ ] PUT `/api/expense-reports/:id` - Updates report successfully
- [ ] PUT `/api/expense-reports/:id` - Can update report data
- [ ] PUT `/api/expense-reports/:id` - Can update status
- [ ] PUT `/api/expense-reports/:id` with invalid ID returns 404

### Submit Report
- [ ] POST `/api/expense-reports/:id/submit` - Submits report
- [ ] Submitted report status changes to 'submitted'
- [ ] Submitted report has submittedAt timestamp
- [ ] Submitted report has submittedBy user ID
- [ ] Cannot edit submitted report (if enforced)

### Delete Report
- [ ] DELETE `/api/expense-reports/:id` - Deletes draft report
- [ ] Cannot delete submitted report (if enforced)
- [ ] DELETE `/api/expense-reports/:id` with invalid ID returns 404

---

## ✅ Approval Workflow

### View Pending Approvals
- [ ] GET `/api/approvals/pending` - Returns pending approvals
- [ ] GET `/api/approvals/pending` - Shows only reports for supervisor's employees
- [ ] GET `/api/approvals/pending` - Filters by employee (if implemented)
- [ ] GET `/api/approvals/:id` - Returns single approval request

### Approve Report
- [ ] POST `/api/approvals/:id/approve` - Approves report
- [ ] Approved report status changes to 'approved'
- [ ] Approved report has approvedAt timestamp
- [ ] Approved report has approvedBy user ID
- [ ] Cannot approve own reports (if enforced)
- [ ] Broadcasts WebSocket update on approval

### Reject Report
- [ ] POST `/api/approvals/:id/reject` - Rejects report
- [ ] POST `/api/approvals/:id/reject` - Requires rejection reason
- [ ] Rejected report status changes to 'rejected'
- [ ] Rejected report has rejectedAt timestamp
- [ ] Rejected report has rejectedBy user ID
- [ ] Rejected report includes rejectionReason
- [ ] Broadcasts WebSocket update on rejection

### Approval History
- [ ] GET `/api/approvals/:id/history` - Returns approval history
- [ ] History shows all approval actions
- [ ] History includes timestamps and user IDs

---

## 💰 Dashboard & Reporting (Finance Team Focus)

### Dashboard Overview
- [ ] Dashboard loads without errors
- [ ] Dashboard shows correct data for user role
- [ ] Dashboard totals are accurate
- [ ] Dashboard filters work (date range, employee, etc.)
- [ ] Dashboard refreshes with real-time updates

### Admin Reporting
- [ ] GET `/api/dashboard/overview` - Returns overview statistics
- [ ] GET `/api/dashboard/trends` - Returns trend data
- [ ] GET `/api/dashboard/map-data` - Returns map data
- [ ] GET `/api/dashboard/report-builder` - Returns report builder data
- [ ] GET `/api/dashboard/schedules` - Returns scheduled reports

### Report Builder
- [ ] Can select date range
- [ ] Can filter by employee
- [ ] Can filter by cost center
- [ ] Can filter by status
- [ ] Can generate custom reports
- [ ] Report data is accurate
- [ ] Report totals are correct

### Scheduled Reports
- [ ] GET `/api/dashboard/schedules` - Returns scheduled reports
- [ ] POST `/api/dashboard/schedules` - Creates new schedule
- [ ] PUT `/api/dashboard/schedules/:id` - Updates schedule
- [ ] DELETE `/api/dashboard/schedules/:id` - Deletes schedule
- [ ] Scheduled reports run automatically (if tested)
- [ ] Scheduled reports are emailed (if configured)

### Export Functionality
- [ ] GET `/api/export/pdf/:reportId` - Generates PDF
- [ ] GET `/api/export/excel/:reportId` - Generates Excel file
- [ ] PDF includes all report data
- [ ] Excel includes all report data
- [ ] Export files are downloadable
- [ ] Export files have correct format

---

## 🗺️ Map & Location Data

### Map View
- [ ] Map loads without errors
- [ ] GPS-tracked entries show on map
- [ ] Location markers are accurate
- [ ] Map filters work (date, employee)
- [ ] Map clustering works (if implemented)

### Location Data
- [ ] GPS coordinates are saved correctly
- [ ] Location names are saved correctly
- [ ] Location addresses are saved correctly
- [ ] Location data displays correctly

---

## 🔔 Notifications

### View Notifications
- [ ] GET `/api/notifications` - Returns notifications
- [ ] GET `/api/notifications?unread=true` - Filters unread only
- [ ] Notifications show correct message
- [ ] Notifications have correct timestamps

### Create Notification
- [ ] Notifications are created on report submission
- [ ] Notifications are created on approval/rejection
- [ ] Notifications are sent to correct users

### Mark as Read
- [ ] PUT `/api/notifications/:id/read` - Marks as read
- [ ] Read notifications don't appear in unread list

---

## 🔄 Real-Time Updates (WebSocket)

### Connection
- [ ] WebSocket connects successfully
- [ ] Connection status is tracked
- [ ] Connection reconnects on drop
- [ ] Connection heartbeat works

### Data Changes
- [ ] Creating mileage entry broadcasts update
- [ ] Updating mileage entry broadcasts update
- [ ] Deleting mileage entry broadcasts update
- [ ] Creating receipt broadcasts update
- [ ] Updating receipt broadcasts update
- [ ] Deleting receipt broadcasts update
- [ ] Submitting report broadcasts update
- [ ] Approving report broadcasts update
- [ ] Rejecting report broadcasts update

### Frontend Updates
- [ ] Frontend receives WebSocket messages
- [ ] Frontend updates UI on data changes
- [ ] Frontend shows notification on updates
- [ ] Multiple clients receive same updates

---

## 📱 Mobile App Testing (if applicable)

### Connection
- [ ] App connects to backend server
- [ ] App handles connection errors gracefully
- [ ] App reconnects on connection loss

### Offline Mode (if implemented)
- [ ] App saves data locally when offline
- [ ] App syncs data when online
- [ ] App shows sync status

### Mobile-Specific Features
- [ ] GPS tracking works
- [ ] Camera/receipt capture works
- [ ] Location permissions work
- [ ] Push notifications work (if implemented)

---

## 🗄️ Database Testing

### Database Connection
- [ ] Database connects on server start
- [ ] Database initializes tables correctly
- [ ] Database handles concurrent connections

### Data Integrity
- [ ] Foreign key relationships work (if enforced)
- [ ] Data types are correct
- [ ] Required fields are enforced
- [ ] Unique constraints work (if enforced)

### Performance
- [ ] Large queries perform acceptably
- [ ] Database indexes are used
- [ ] No N+1 query problems

---

## 🔧 System & Utility Endpoints

### Health Check
- [ ] GET `/api/health` - Returns server status
- [ ] GET `/api/health` - Returns database status
- [ ] GET `/api/health` - Returns uptime

### Cost Centers
- [ ] GET `/api/cost-centers` - Returns cost centers
- [ ] POST `/api/cost-centers` - Creates cost center
- [ ] PUT `/api/cost-centers/:id` - Updates cost center
- [ ] DELETE `/api/cost-centers/:id` - Deletes cost center

### Supervisors
- [ ] GET `/api/supervisors` - Returns supervisors
- [ ] GET `/api/supervisors/:id/team` - Returns supervisor's team
- [ ] POST `/api/supervisors/:id/assign` - Assigns employee to supervisor

---

## 🐛 Error Handling

### Validation Errors
- [ ] Missing required fields show validation error
- [ ] Invalid email format shows error
- [ ] Invalid date format shows error
- [ ] Invalid data types show error
- [ ] Error messages are user-friendly

### Server Errors
- [ ] Database errors are caught
- [ ] Server errors return 500 status
- [ ] Error responses don't leak sensitive info
- [ ] Errors are logged correctly

### Not Found Errors
- [ ] Invalid IDs return 404
- [ ] Invalid routes return 404
- [ ] 404 responses are consistent

---

## 🔐 Security

### Input Validation
- [ ] SQL injection attempts are blocked
- [ ] XSS attempts are blocked
- [ ] File uploads are validated
- [ ] File size limits are enforced

### Authentication
- [ ] Protected routes require authentication
- [ ] Invalid tokens are rejected
- [ ] Expired sessions are handled

### Authorization
- [ ] Users can only access their own data (where applicable)
- [ ] Supervisors can only see their team
- [ ] Finance can only access approved reports
- [ ] Admin has full access

---

## 📋 Finance Team Portal Specific Tests

### Dashboard Access
- [ ] Finance team can access dashboard
- [ ] Dashboard shows only relevant data
- [ ] Dashboard loads quickly

### Report Viewing
- [ ] Can view all submitted reports
- [ ] Can view approved reports
- [ ] Can filter reports by employee
- [ ] Can filter reports by date range
- [ ] Can filter reports by status

### Report Approval
- [ ] Can approve reports
- [ ] Can reject reports with reason
- [ ] Approval workflow is clear
- [ ] Approval history is tracked

### Export & Reporting
- [ ] Can export reports to PDF
- [ ] Can export reports to Excel
- [ ] Can generate custom reports
- [ ] Scheduled reports are delivered
- [ ] Report totals are accurate

### Search & Filter
- [ ] Can search by employee name
- [ ] Can filter by cost center
- [ ] Can filter by date range
- [ ] Filters work in combination

---

## ✅ Final Checks

### Performance
- [ ] Page load times are acceptable (< 3 seconds)
- [ ] API response times are acceptable (< 1 second)
- [ ] Database queries are optimized
- [ ] No memory leaks

### Browser Compatibility
- [ ] Works in Chrome
- [ ] Works in Firefox
- [ ] Works in Safari
- [ ] Works in Edge
- [ ] Mobile browsers work

### Responsive Design
- [ ] Works on desktop
- [ ] Works on tablet
- [ ] Works on mobile
- [ ] Layout is responsive

### Documentation
- [ ] API documentation is up to date
- [ ] README is accurate
- [ ] Architecture docs are current

---

## 📝 Notes & Issues

**Date**: _______________

### Issues Found:
1. 
2. 
3. 

### Notes:
- 
- 
- 

### Priority Fixes:
1. 
2. 
3. 

---

## ✅ Sign-Off

**Tester**: _______________
**Date**: _______________
**Status**: [ ] PASSED [ ] NEEDS WORK [ ] FAILED

**Comments**:
_________________________________________________________________
_________________________________________________________________
_________________________________________________________________

