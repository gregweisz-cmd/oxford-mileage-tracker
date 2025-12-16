# Complete Test Checklist - Oxford House Mileage Tracker

**Purpose**: Comprehensive testing guide covering all features and functionality  
**Date**: _______________  
**Tester**: _______________  
**Environment**: [ ] Development [ ] Production

---

## 🚀 Pre-Testing Setup

### Backend Server
- [ ] Backend server is running (`npm start` in `backend/` directory)
- [ ] Server starts without errors
- [ ] Database is initialized
- [ ] Server logs show: `✅ Server is running on port 3002`
- [ ] WebSocket server initialized
- [ ] No console errors on startup

### Frontend Web Portal
- [ ] Admin web portal is running (`npm start` in `admin-web/` directory)
- [ ] Portal loads at `http://localhost:3000`
- [ ] No console errors on page load
- [ ] All routes are accessible

### Environment Variables
- [ ] All required environment variables are set
- [ ] AWS SES credentials configured (if using email)
- [ ] Database path is correct
- [ ] API URLs are correct

---

## 🔐 Authentication & Authorization

### Login
- [ ] Can log in with valid credentials (Greg Weisz)
- [ ] Can log in with valid credentials (Alex Szary)
- [ ] Can log in with valid credentials (Jackson Longan)
- [ ] Login with invalid credentials shows error
- [ ] Login with missing fields shows validation error
- [ ] Login redirects to appropriate dashboard based on role
- [ ] User session is created
- [ ] User role is correctly assigned
- [ ] Session persists on page refresh

### Logout
- [ ] Logout button works
- [ ] Session is cleared on logout
- [ ] Redirected to login page
- [ ] Cannot access protected routes after logout
- [ ] WebSocket connection closes on logout

### User Roles & Permissions
- [ ] Employee role has correct permissions
- [ ] Employee can only see their own reports
- [ ] Supervisor role has correct permissions
- [ ] Supervisor can see their team's reports
- [ ] Finance role has correct permissions
- [ ] Finance can see all submitted/approved reports
- [ ] Admin role has all permissions
- [ ] Admin can access all features
- [ ] Role-based route protection works
- [ ] Unauthorized access attempts are blocked

---

## 🔔 Dashboard Notifications (NEW FEATURE)

### Notification Display
- [ ] Dashboard shows notification card when user logs in
- [ ] Notification card displays unread count badge
- [ ] Shows up to 3 notifications by default
- [ ] "Expand" button shows when more than 3 notifications exist
- [ ] Notifications are sorted by most recent first
- [ ] Notification icons display correctly (info, warning, error, success)
- [ ] Time ago formatting works correctly ("just now", "5 minutes ago", etc.)
- [ ] Empty state: Card doesn't show when no notifications exist

### Notification Interaction
- [ ] Clicking notification marks it as read
- [ ] Mark as read button works
- [ ] Read notifications have different styling (grayed out)
- [ ] "View All" button opens full notifications dialog
- [ ] Clicking notification with report metadata navigates to report
- [ ] Auto-refresh works (updates every 60 seconds)
- [ ] Notification count updates in real-time

### Notification API Endpoints
- [ ] GET `/api/notifications/:recipientId` - Returns all notifications
- [ ] GET `/api/notifications/:recipientId?unreadOnly=true` - Returns only unread
- [ ] GET `/api/notifications/:recipientId?limit=10` - Limits results
- [ ] GET `/api/notifications/:recipientId/count` - Returns unread count
- [ ] PUT `/api/notifications/:id/read` - Marks notification as read
- [ ] PUT `/api/notifications/:recipientId/read-all` - Marks all as read
- [ ] DELETE `/api/notifications/:id` - Deletes notification
- [ ] Invalid notification ID returns 404

### Notification Types
- [ ] Info notifications display correctly
- [ ] Warning notifications display correctly
- [ ] Error notifications display correctly
- [ ] Success notifications display correctly
- [ ] Notifications with metadata (reportId, employeeId) work correctly

---

## 📧 Email Service (AWS SES)

### Email Configuration
- [ ] Email service verifies AWS SES configuration
- [ ] `verifyEmailConfig()` returns true when configured
- [ ] `verifyEmailConfig()` returns false when not configured
- [ ] AWS SES client initializes correctly
- [ ] Environment variables are read correctly (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION)

### Email Sending
- [ ] POST `/api/test-email` - Sends test email successfully
- [ ] Test email includes correct "from" address (greg.weisz@oxfordhouse.org)
- [ ] Test email includes correct "from" name (Oxford House Expense Tracker)
- [ ] Email sends via AWS SES SDK (not SMTP)
- [ ] Email sending returns success response with messageId
- [ ] Email sending handles timeouts correctly (15 second timeout)
- [ ] Email sending falls back to SMTP if AWS SES not configured
- [ ] Email service handles errors gracefully
- [ ] Error messages are user-friendly

### Email Test Scripts
- [ ] `node scripts/test/test-email.js <email>` - Works correctly
- [ ] `node scripts/test/test-email-config.js` - Verifies configuration
- [ ] Test scripts show helpful error messages
- [ ] Test scripts handle connection timeouts

### Email Integration
- [ ] Notifications trigger email sending (if configured)
- [ ] Report submission triggers email (if configured)
- [ ] Approval/rejection triggers email (if configured)
- [ ] Email service is disabled when EMAIL_ENABLED=false

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
- [ ] Employee list pagination works (if implemented)

### Create Employee
- [ ] POST `/api/employees` - Creates new employee with required fields
- [ ] POST `/api/employees` - Validates required fields (name, email, position)
- [ ] POST `/api/employees` - Validates email format
- [ ] POST `/api/employees` - Auto-generates ID (format: firstname-lastname-###)
- [ ] POST `/api/employees` - Auto-generates password if not provided
- [ ] POST `/api/employees` - Returns temporary password
- [ ] POST `/api/employees` - Can set supervisor ID
- [ ] POST `/api/employees` - Can set cost centers
- [ ] POST `/api/employees` - Password is hashed before storing

### Update Employee
- [ ] PUT `/api/employees/:id` - Updates employee successfully
- [ ] PUT `/api/employees/:id` - Updates name
- [ ] PUT `/api/employees/:id` - Updates email
- [ ] PUT `/api/employees/:id` - Updates position
- [ ] PUT `/api/employees/:id` - Updates cost centers
- [ ] PUT `/api/employees/:id` - Updates supervisor ID
- [ ] PUT `/api/employees/:id` with invalid ID returns 404
- [ ] Update validates email format

### Archive/Restore Employee
- [ ] POST `/api/employees/:id/archive` - Archives employee
- [ ] POST `/api/employees/:id/restore` - Restores archived employee
- [ ] Archived employees don't appear in default list
- [ ] Archived employees appear in archived list
- [ ] Archived employees cannot log in

### Delete Employee
- [ ] DELETE `/api/employees/:id` - Deletes employee
- [ ] DELETE `/api/employees/:id` with invalid ID returns 404
- [ ] Cannot delete employee with related data (if enforced)

### Password Management
- [ ] PUT `/api/employees/:id/password` - Updates password
- [ ] New password is hashed before storing
- [ ] Old password validation (if implemented)
- [ ] Password reset functionality works (if implemented)

---

## 🚗 Mileage Entries

### View Mileage Entries
- [ ] GET `/api/mileage-entries` - Returns list of entries
- [ ] GET `/api/mileage-entries?employeeId=xxx` - Filters by employee
- [ ] GET `/api/mileage-entries?startDate=xxx&endDate=xxx` - Date range filter
- [ ] GET `/api/mileage-entries/:id` - Returns single entry
- [ ] GPS-tracked entries show location data
- [ ] Manual entries show entered locations
- [ ] Entries include cost center information

### Create Mileage Entry
- [ ] POST `/api/mileage-entries` - Creates new entry
- [ ] POST `/api/mileage-entries` - Validates required fields
- [ ] POST `/api/mileage-entries` - Saves GPS coordinates (if GPS tracked)
- [ ] POST `/api/mileage-entries` - Calculates miles correctly
- [ ] POST `/api/mileage-entries` - Associates with correct employee
- [ ] POST `/api/mileage-entries` - Broadcasts WebSocket update
- [ ] Entry includes purpose/description
- [ ] Entry includes cost center

### Update Mileage Entry
- [ ] PUT `/api/mileage-entries/:id` - Updates entry successfully
- [ ] PUT `/api/mileage-entries/:id` - Can update purpose
- [ ] PUT `/api/mileage-entries/:id` - Can update miles
- [ ] PUT `/api/mileage-entries/:id` - Can update notes
- [ ] PUT `/api/mileage-entries/:id` - Can update cost center
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
- [ ] GET `/api/receipts?category=gas` - Filters by category
- [ ] GET `/api/receipts/:id` - Returns single receipt
- [ ] Receipt images are accessible
- [ ] Receipt categories are correct
- [ ] Receipt thumbnails display correctly

### Create Receipt
- [ ] POST `/api/receipts` - Creates new receipt
- [ ] POST `/api/receipts` - Validates required fields (date, amount, vendor, category)
- [ ] POST `/api/receipts` - Handles image upload (base64 or file)
- [ ] POST `/api/receipts` - Saves receipt image correctly
- [ ] POST `/api/receipts` - Associates with correct employee
- [ ] POST `/api/receipts` - OCR extraction works (if implemented)
- [ ] POST `/api/receipts` - Broadcasts WebSocket update
- [ ] File size limits are enforced
- [ ] Invalid file types are rejected

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
- [ ] GET `/api/expense-reports?month=12&year=2024` - Filters by month/year
- [ ] GET `/api/expense-reports/:id` - Returns single report
- [ ] Report includes mileage entries
- [ ] Report includes receipts
- [ ] Report includes time entries
- [ ] Report totals are calculated correctly
- [ ] Report shows correct status

### Create Report
- [ ] POST `/api/expense-reports` - Creates new report
- [ ] POST `/api/expense-reports` - Validates required fields
- [ ] POST `/api/expense-reports` - Creates for correct month/year
- [ ] POST `/api/expense-reports` - Associates with correct employee
- [ ] POST `/api/expense-reports` - Status starts as 'draft'
- [ ] Cannot create duplicate report for same month/year/employee

### Update Report
- [ ] PUT `/api/expense-reports/:id` - Updates report successfully
- [ ] PUT `/api/expense-reports/:id` - Can update report data
- [ ] PUT `/api/expense-reports/:id` - Can update status
- [ ] PUT `/api/expense-reports/:id` with invalid ID returns 404
- [ ] Cannot update submitted/approved reports (if enforced)

### Submit Report
- [ ] POST `/api/expense-reports/:id/submit` - Submits report
- [ ] Submitted report status changes to 'submitted'
- [ ] Submitted report has submittedAt timestamp
- [ ] Submitted report has submittedBy user ID
- [ ] Cannot edit submitted report (if enforced)
- [ ] Notification is created on submission
- [ ] Supervisor is notified (if applicable)

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
- [ ] Pending approvals show correct status

### Approve Report
- [ ] POST `/api/approvals/:id/approve` - Approves report
- [ ] Approved report status changes to 'approved'
- [ ] Approved report has approvedAt timestamp
- [ ] Approved report has approvedBy user ID
- [ ] Cannot approve own reports (if enforced)
- [ ] Broadcasts WebSocket update on approval
- [ ] Notification is created on approval
- [ ] Employee is notified of approval

### Reject Report
- [ ] POST `/api/approvals/:id/reject` - Rejects report
- [ ] POST `/api/approvals/:id/reject` - Requires rejection reason
- [ ] Rejected report status changes to 'rejected'
- [ ] Rejected report has rejectedAt timestamp
- [ ] Rejected report has rejectedBy user ID
- [ ] Rejected report includes rejectionReason
- [ ] Broadcasts WebSocket update on rejection
- [ ] Notification is created on rejection
- [ ] Employee is notified of rejection

### Request Revision
- [ ] POST `/api/approvals/:id/request-revision` - Requests revision
- [ ] Revision request requires comment/reason
- [ ] Report status changes to 'needs_revision'
- [ ] Notification is created for employee
- [ ] Employee can see revision request

### Approval History
- [ ] GET `/api/approvals/:id/history` - Returns approval history
- [ ] History shows all approval actions
- [ ] History includes timestamps and user IDs
- [ ] History includes comments/reasons

---

## 💰 Dashboard & Reporting

### Dashboard Overview
- [ ] Dashboard loads without errors
- [ ] Dashboard shows correct data for user role
- [ ] Dashboard totals are accurate
- [ ] Dashboard filters work (date range, employee, etc.)
- [ ] Dashboard refreshes with real-time updates
- [ ] Dashboard shows notifications (NEW)

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
- [ ] PDF includes receipts/images
- [ ] Excel includes all report data
- [ ] Export files are downloadable
- [ ] Export files have correct format
- [ ] PDF formatting is correct

---

## 🗺️ Map & Location Data

### Map View
- [ ] Map loads without errors
- [ ] GPS-tracked entries show on map
- [ ] Location markers are accurate
- [ ] Map filters work (date, employee)
- [ ] Map clustering works (if implemented)
- [ ] Map zoom/pan works correctly

### Location Data
- [ ] GPS coordinates are saved correctly
- [ ] Location names are saved correctly
- [ ] Location addresses are saved correctly
- [ ] Location data displays correctly
- [ ] Base address is saved correctly
- [ ] Favorite locations work (if implemented)

---

## 🔄 Real-Time Updates (WebSocket)

### Connection
- [ ] WebSocket connects successfully
- [ ] Connection status is tracked
- [ ] Connection reconnects on drop
- [ ] Connection heartbeat works
- [ ] Connection status indicator shows correctly

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
- [ ] Real-time sync indicator works

---

## 🗄️ Database Testing

### Database Connection
- [ ] Database connects on server start
- [ ] Database initializes tables correctly
- [ ] Database handles concurrent connections
- [ ] Database backup script works

### Data Integrity
- [ ] Foreign key relationships work (if enforced)
- [ ] Data types are correct
- [ ] Required fields are enforced
- [ ] Unique constraints work (if enforced)
- [ ] Database migrations work (if implemented)

### Performance
- [ ] Large queries perform acceptably
- [ ] Database indexes are used
- [ ] No N+1 query problems
- [ ] Database backup completes in reasonable time

---

## 🔧 System & Utility Endpoints

### Health Check
- [ ] GET `/api/health` - Returns server status
- [ ] GET `/api/health` - Returns database status
- [ ] GET `/api/health` - Returns uptime
- [ ] GET `/api/health` - Returns email service status
- [ ] GET `/health` - Lightweight health check works

### Cost Centers
- [ ] GET `/api/cost-centers` - Returns cost centers
- [ ] All 84 cost centers are returned
- [ ] Cost center data is correct
- [ ] POST `/api/cost-centers` - Creates cost center (if implemented)
- [ ] PUT `/api/cost-centers/:id` - Updates cost center (if implemented)
- [ ] DELETE `/api/cost-centers/:id` - Deletes cost center (if implemented)

### Supervisors
- [ ] GET `/api/supervisors` - Returns supervisors
- [ ] GET `/api/supervisors/:id/team` - Returns supervisor's team
- [ ] POST `/api/supervisors/:id/assign` - Assigns employee to supervisor

### Rate Limiting
- [ ] Auth endpoints are rate limited
- [ ] Password reset is rate limited
- [ ] Admin endpoints are rate limited
- [ ] Upload endpoints are rate limited
- [ ] Rate limit errors are user-friendly
- [ ] Rate limits reset correctly

---

## 🐛 Error Handling

### Validation Errors
- [ ] Missing required fields show validation error
- [ ] Invalid email format shows error
- [ ] Invalid date format shows error
- [ ] Invalid data types show error
- [ ] Error messages are user-friendly
- [ ] Validation errors return 400 status

### Server Errors
- [ ] Database errors are caught
- [ ] Server errors return 500 status
- [ ] Error responses don't leak sensitive info
- [ ] Errors are logged correctly
- [ ] Error stack traces hidden in production

### Not Found Errors
- [ ] Invalid IDs return 404
- [ ] Invalid routes return 404
- [ ] 404 responses are consistent
- [ ] 404 page displays correctly (frontend)

---

## 🔐 Security

### Input Validation
- [ ] SQL injection attempts are blocked
- [ ] XSS attempts are blocked
- [ ] File uploads are validated
- [ ] File size limits are enforced
- [ ] File type validation works

### Authentication
- [ ] Protected routes require authentication
- [ ] Invalid tokens are rejected
- [ ] Expired sessions are handled
- [ ] Password hashing works correctly
- [ ] Password comparison works correctly

### Authorization
- [ ] Users can only access their own data (where applicable)
- [ ] Supervisors can only see their team
- [ ] Finance can only access approved reports
- [ ] Admin has full access
- [ ] Unauthorized actions return 403

---

## 📱 Mobile App Testing (if applicable)

### Connection
- [ ] App connects to backend server
- [ ] App handles connection errors gracefully
- [ ] App reconnects on connection loss
- [ ] App shows connection status

### Offline Mode (if implemented)
- [ ] App saves data locally when offline
- [ ] App syncs data when online
- [ ] App shows sync status
- [ ] Conflict resolution works

### Mobile-Specific Features
- [ ] GPS tracking works
- [ ] Camera/receipt capture works
- [ ] Location permissions work
- [ ] Push notifications work (if implemented)

---

## ✅ Final Checks

### Performance
- [ ] Page load times are acceptable (< 3 seconds)
- [ ] API response times are acceptable (< 1 second)
- [ ] Database queries are optimized
- [ ] No memory leaks
- [ ] Large datasets load efficiently

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
- [ ] UI elements scale correctly

### Documentation
- [ ] API documentation is up to date
- [ ] README is accurate
- [ ] Architecture docs are current
- [ ] Code comments are helpful

---

## 📝 Test Results Summary

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

---

## 🎯 Quick Test Commands

### Backend Health Check
```bash
curl http://localhost:3002/api/health
```

### Test Email Service
```bash
cd admin-web/backend
node scripts/test/test-email.js your-email@example.com
```

### Test Email Configuration
```bash
cd admin-web/backend
node scripts/test/test-email-config.js
```

### Test Notifications API
```bash
# Get notifications for user
curl http://localhost:3002/api/notifications/greg-weisz-001

# Get unread count
curl http://localhost:3002/api/notifications/greg-weisz-001/count

# Mark as read
curl -X PUT http://localhost:3002/api/notifications/{notification-id}/read
```

### Test Employee API
```bash
# Get all employees
curl http://localhost:3002/api/employees

# Get single employee
curl http://localhost:3002/api/employees/greg-weisz-001
```

---

**Total Test Items**: ~300+  
**Estimated Testing Time**: 4-6 hours  
**Last Updated**: December 2024

