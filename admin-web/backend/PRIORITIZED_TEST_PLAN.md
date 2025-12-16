# Prioritized Test Plan - Oxford House Mileage Tracker

**Purpose**: Focused testing plan prioritizing critical functionality and recent features  
**Estimated Time**: 2-3 hours for Priority 1, 4-6 hours total for all priorities

---

## 🚨 Priority 1: Critical & Recent Features (Test First - 2-3 hours)

### ⚡ **CRITICAL: Must Test Before Production**

#### 1. Authentication & Login (15 min)
- [ ] Can log in with valid credentials (Greg Weisz, Alex Szary, Jackson Longan)
- [ ] Login with invalid credentials shows error
- [ ] Login redirects to correct dashboard based on role
- [ ] Logout works and clears session
- [ ] Cannot access protected routes after logout

**Why Critical**: Users can't use the system without login. Test with actual user accounts.

---

#### 2. Dashboard Notifications (NEW FEATURE - 20 min)
- [ ] Dashboard shows notification card when user logs in
- [ ] Notification card displays unread count badge
- [ ] Shows up to 3 notifications by default
- [ ] Clicking notification marks it as read
- [ ] "View All" button opens full notifications dialog
- [ ] GET `/api/notifications/:recipientId` - Returns notifications
- [ ] GET `/api/notifications/:recipientId/count` - Returns unread count
- [ ] PUT `/api/notifications/:id/read` - Marks notification as read
- [ ] Clicking notification with report metadata navigates to report

**Why Critical**: This is a NEW feature just added. Must verify it works before users see it.

**Test Users**: Log in as different roles (employee, supervisor, finance) to see role-specific notifications.

---

#### 3. Email Service (NEW FEATURE - 15 min)
- [ ] POST `/api/test-email` - Sends test email successfully
- [ ] Test email includes correct "from" address (greg.weisz@oxfordhouse.org)
- [ ] Email sends via AWS SES SDK
- [ ] Email sending returns success response with messageId
- [ ] `node scripts/test/test-email.js <email>` - Works correctly
- [ ] Email service handles errors gracefully

**Why Critical**: Email service was recently refactored to use AWS SES. Need to verify it works in production.

**Quick Test**:
```bash
cd admin-web/backend
node scripts/test/test-email.js greg.weisz@oxfordhouse.org
```

---

#### 4. Core Data Operations (30 min)
- [ ] GET `/api/employees` - Returns list of employees
- [ ] GET `/api/expense-reports` - Returns list of reports
- [ ] GET `/api/expense-reports/:id` - Returns single report with all data
- [ ] Report includes mileage entries, receipts, time entries
- [ ] Report totals are calculated correctly
- [ ] GET `/api/mileage-entries?employeeId=xxx` - Filters by employee
- [ ] GET `/api/receipts?employeeId=xxx` - Filters by employee

**Why Critical**: Core functionality - if these don't work, the app is broken.

---

#### 5. Report Submission & Approval Workflow (30 min)
- [ ] POST `/api/expense-reports/:id/submit` - Submits report
- [ ] Submitted report status changes to 'submitted'
- [ ] Notification is created on submission
- [ ] GET `/api/approvals/pending` - Returns pending approvals
- [ ] POST `/api/approvals/:id/approve` - Approves report
- [ ] POST `/api/approvals/:id/reject` - Rejects report with reason
- [ ] Notification is created on approval/rejection

**Why Critical**: This is the main business workflow. Must work correctly.

**Test Flow**:
1. Create a draft report
2. Submit it
3. Check supervisor sees it in pending approvals
4. Approve/reject it
5. Verify notifications are sent

---

#### 6. Security & Authorization (20 min)
- [ ] Protected routes require authentication
- [ ] Users can only access their own data (where applicable)
- [ ] Supervisors can only see their team
- [ ] Finance can only access approved reports
- [ ] Admin has full access
- [ ] SQL injection attempts are blocked (test with `'; DROP TABLE--`)
- [ ] Invalid tokens are rejected

**Why Critical**: Security vulnerabilities could expose sensitive data.

---

#### 7. Health Check & System Status (10 min)
- [ ] GET `/api/health` - Returns server status
- [ ] GET `/api/health` - Returns database status
- [ ] GET `/api/health` - Returns email service status
- [ ] Server starts without errors
- [ ] Database is initialized

**Why Critical**: Need to verify system is healthy before other tests.

**Quick Test**:
```bash
curl http://localhost:3002/api/health
```

---

## 🔶 Priority 2: Important Features (Test After Priority 1 - 1-2 hours)

### 8. Employee Management (20 min)
- [ ] POST `/api/employees` - Creates new employee
- [ ] Auto-generates ID and password
- [ ] Password is hashed before storing
- [ ] PUT `/api/employees/:id` - Updates employee
- [ ] POST `/api/employees/:id/archive` - Archives employee
- [ ] Archived employees don't appear in default list

**Why Important**: Admin needs to manage employees. Not critical for daily use.

---

### 9. Receipt Management (20 min)
- [ ] POST `/api/receipts` - Creates new receipt
- [ ] Handles image upload (base64 or file)
- [ ] File size limits are enforced
- [ ] Invalid file types are rejected
- [ ] GET `/api/receipts?category=gas` - Filters by category
- [ ] DELETE `/api/receipts/:id` - Deletes receipt and image

**Why Important**: Receipts are part of expense reports. Important but not blocking.

---

### 10. Real-Time Updates (WebSocket) (15 min)
- [ ] WebSocket connects successfully
- [ ] Connection reconnects on drop
- [ ] Creating mileage entry broadcasts update
- [ ] Frontend receives WebSocket messages
- [ ] Frontend updates UI on data changes
- [ ] Connection status indicator shows correctly

**Why Important**: Real-time updates improve UX but system works without them.

---

### 11. Export Functionality (15 min)
- [ ] GET `/api/export/pdf/:reportId` - Generates PDF
- [ ] PDF includes all report data
- [ ] PDF includes receipts/images
- [ ] PDF formatting is correct
- [ ] Export files are downloadable

**Why Important**: Finance team needs PDF exports. Important but not critical for basic functionality.

---

### 12. Dashboard & Reporting (20 min)
- [ ] Dashboard loads without errors
- [ ] Dashboard shows correct data for user role
- [ ] Dashboard totals are accurate
- [ ] GET `/api/dashboard/overview` - Returns overview statistics
- [ ] Report Builder filters work (date range, employee, cost center)

**Why Important**: Dashboards provide insights but aren't required for core workflow.

---

## 🔷 Priority 3: Nice-to-Have Features (Test If Time Permits - 1 hour)

### 13. Advanced Features
- [ ] Map view with GPS-tracked entries
- [ ] Time tracking entries
- [ ] Scheduled reports
- [ ] Cost center management
- [ ] Supervisor team management
- [ ] Approval history
- [ ] Request revision workflow

**Why Lower Priority**: These are enhancements, not core functionality.

---

### 14. Edge Cases & Error Handling
- [ ] Invalid IDs return 404
- [ ] Missing required fields show validation error
- [ ] Database errors are caught
- [ ] Error messages are user-friendly
- [ ] Rate limiting works

**Why Lower Priority**: Important for production but can be tested as issues arise.

---

### 15. Browser & Device Compatibility
- [ ] Works in Chrome
- [ ] Works in Firefox
- [ ] Works on mobile browsers
- [ ] Responsive design works
- [ ] Mobile app (if applicable)

**Why Lower Priority**: Test on primary browser first, others can wait.

---

## 📋 Quick Test Script

### Run Priority 1 Tests in Order:

```bash
# 1. Health Check
curl http://localhost:3002/api/health

# 2. Test Email
cd admin-web/backend
node scripts/test/test-email.js greg.weisz@oxfordhouse.org

# 3. Test Notifications API
curl http://localhost:3002/api/notifications/greg-weisz-001
curl http://localhost:3002/api/notifications/greg-weisz-001/count

# 4. Test Core Data
curl http://localhost:3002/api/employees
curl http://localhost:3002/api/expense-reports?employeeId=greg-weisz-001

# 5. Test Authentication (via frontend)
# - Log in as Greg Weisz
# - Verify dashboard loads
# - Check notifications appear
# - Log out
```

---

## 🎯 Testing Strategy

### Phase 1: Smoke Tests (30 min)
- Health check
- Login/logout
- Basic data retrieval
- **Goal**: Verify system is functional

### Phase 2: New Features (45 min)
- Dashboard Notifications (all tests)
- Email Service (all tests)
- **Goal**: Verify new features work correctly

### Phase 3: Core Workflows (1 hour)
- Create report → Submit → Approve/Reject
- Verify notifications at each step
- **Goal**: Verify main business process works

### Phase 4: Security & Authorization (30 min)
- Test role-based access
- Test authentication
- **Goal**: Verify security is working

### Phase 5: Edge Cases (30 min)
- Error handling
- Invalid inputs
- **Goal**: Verify graceful error handling

---

## ✅ Success Criteria

### Must Pass Before Production:
- ✅ All Priority 1 tests pass
- ✅ Login works for all user types
- ✅ Dashboard Notifications display correctly
- ✅ Email service sends emails
- ✅ Report submission works
- ✅ Approval workflow works
- ✅ Security checks pass

### Should Pass Before Production:
- ✅ Priority 2 tests pass (80%+)
- ✅ No critical bugs found
- ✅ Performance is acceptable

### Can Fix After Production:
- Priority 3 items
- Minor UI issues
- Browser compatibility (beyond Chrome)

---

## 📝 Test Results Template

### Priority 1 Results:
- [ ] Authentication: PASS / FAIL
- [ ] Dashboard Notifications: PASS / FAIL
- [ ] Email Service: PASS / FAIL
- [ ] Core Data Operations: PASS / FAIL
- [ ] Report Workflow: PASS / FAIL
- [ ] Security: PASS / FAIL
- [ ] Health Check: PASS / FAIL

**Issues Found**:
1. 
2. 
3. 

**Blockers** (must fix before production):
1. 
2. 

**Non-Blockers** (can fix later):
1. 
2. 

---

## 🚀 Recommended Testing Order

1. **Start with Health Check** (5 min)
   - Verify system is running
   - Check database connection
   - Check email service status

2. **Test New Features** (45 min)
   - Dashboard Notifications
   - Email Service
   - These are highest risk since they're new

3. **Test Core Workflow** (1 hour)
   - Login → Create Report → Submit → Approve
   - Verify notifications at each step
   - This is the main user journey

4. **Test Security** (30 min)
   - Authentication
   - Authorization
   - Input validation

5. **Test Everything Else** (as time permits)
   - Employee management
   - Receipts
   - Exports
   - Real-time updates

---

**Total Estimated Time for Priority 1**: 2-3 hours  
**Total Estimated Time for All Priorities**: 4-6 hours

**Focus**: Complete Priority 1 first, then move to Priority 2 if time allows.

