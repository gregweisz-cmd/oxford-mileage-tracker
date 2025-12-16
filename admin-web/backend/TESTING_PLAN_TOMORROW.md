# Testing Plan - Tomorrow Morning

**Date**: December 16, 2025  
**Estimated Time**: 2-3 hours  
**Focus**: Complete Priority 2 API Tests + Manual Frontend Testing

---

## 🎯 Session Goals

1. Complete remaining Priority 2 API tests
2. Begin manual frontend testing for critical features
3. Verify end-to-end workflows with real user accounts
4. Document any issues found

---

## 📋 Testing Checklist

### Phase 1: Complete Priority 2 API Tests (1-1.5 hours)

#### ✅ Already Completed
- [x] Employee Management - All CRUD operations verified

#### 🔲 To Complete

**9. Receipt Management (20 min)**
- [ ] POST `/api/receipts` - Creates new receipt
- [ ] Handles image upload (base64 or file)
- [ ] File size limits are enforced
- [ ] Invalid file types are rejected
- [ ] GET `/api/receipts?category=gas` - Filters by category
- [ ] DELETE `/api/receipts/:id` - Deletes receipt and image

**10. Real-Time Updates (WebSocket) (15 min)**
- [ ] WebSocket connects successfully
- [ ] Connection reconnects on drop
- [ ] Creating mileage entry broadcasts update
- [ ] Frontend receives WebSocket messages
- [ ] Frontend updates UI on data changes
- [ ] Connection status indicator shows correctly

**11. Export Functionality (15 min)**
- [ ] GET `/api/export/pdf/:reportId` - Generates PDF
- [ ] PDF includes all report data
- [ ] PDF includes receipts/images
- [ ] PDF formatting is correct
- [ ] Export files are downloadable

**12. Dashboard & Reporting (20 min)**
- [ ] Dashboard loads without errors
- [ ] Dashboard shows correct data for user role
- [ ] Dashboard totals are accurate
- [ ] GET `/api/dashboard/overview` - Returns overview statistics
- [ ] Report Builder filters work (date range, employee, cost center)

---

### Phase 2: Manual Frontend Testing (1-1.5 hours)

#### 1. Authentication & Login (15 min)
- [ ] Log in with valid credentials (Greg Weisz, Alex Szary, AJ Dunaway)
- [ ] Login with invalid credentials shows error
- [ ] Login redirects to correct dashboard based on role
- [ ] Logout works and clears session
- [ ] Cannot access protected routes after logout

**Test Accounts:**
- Greg Weisz (Admin/Supervisor) - `greg.weisz@oxfordhouse.org`
- Alex Szary (Employee) - `alex.szary@oxfordhouse.org`
- AJ Dunaway (Supervisor) - `aj.dunaway@oxfordhouse.org`

#### 2. Dashboard Notifications Frontend (20 min)
- [ ] Dashboard shows notification card when user logs in
- [ ] Notification card displays unread count badge
- [ ] Shows up to 3 notifications by default
- [ ] Clicking notification marks it as read
- [ ] "Show All" button expands to show more notifications
- [ ] "View All" button opens full notifications dialog
- [ ] Clicking notification with report metadata navigates to report
- [ ] Notifications update in real-time (polling every 60 seconds)

**Test with different roles:**
- Employee: Should see notifications for their reports
- Supervisor: Should see notifications for team member reports
- Finance: Should see notifications for approved reports

#### 3. Role-Based Access Control (20 min)
- [ ] **Employee Role:**
  - Can access own reports only
  - Cannot access other employees' reports
  - Cannot access admin/supervisor endpoints
  - Can submit own reports

- [ ] **Supervisor Role:**
  - Can see team members' reports
  - Can approve/reject team reports
  - Cannot access admin-only endpoints
  - Cannot access other supervisors' teams

- [ ] **Finance Role:**
  - Can see all approved reports
  - Can approve/reject reports
  - Cannot access employee management

- [ ] **Admin Role:**
  - Can access all endpoints
  - Can manage employees
  - Can view all reports

#### 4. End-to-End Approval Workflow (30 min)
- [ ] **As Employee:**
  - Create a draft report
  - Add mileage entries
  - Add receipts
  - Submit report
  - Verify notification received

- [ ] **As Supervisor:**
  - See submitted report in pending approvals
  - View report details
  - Approve report (or request revision)
  - Verify notification sent to employee/finance

- [ ] **As Finance:**
  - See approved report in pending queue
  - View report details
  - Approve or request revision
  - Verify final status

- [ ] **Revision Flow:**
  - Supervisor requests revision
  - Employee sees revision notification
  - Employee can edit and resubmit
  - Report goes back through workflow

---

## 🔧 Setup Steps (5 min)

1. **Start Backend:**
   ```powershell
   cd admin-web/backend
   npm start
   ```

2. **Start Frontend:**
   ```powershell
   cd admin-web
   npm start
   ```

3. **Verify Services:**
   - Backend running on `http://localhost:3002`
   - Frontend running on `http://localhost:3000`
   - Health check: `curl http://localhost:3002/api/health`

---

## 📝 Test Execution Order

### Morning Session (2-3 hours)

1. **Quick Health Check** (5 min)
   - Verify backend is running
   - Check database connectivity
   - Verify all services healthy

2. **Priority 2 API Tests** (1-1.5 hours)
   - Receipt Management
   - WebSocket (if time permits)
   - Export Functionality
   - Dashboard & Reporting

3. **Manual Frontend Testing** (1-1.5 hours)
   - Authentication & Login
   - Dashboard Notifications UI
   - Role-Based Access Control
   - End-to-End Approval Workflow

4. **Documentation** (15 min)
   - Update test results
   - Document any issues found
   - Create issue tickets if needed

---

## 🎯 Success Criteria

### Must Complete:
- ✅ All Priority 2 API tests
- ✅ Authentication & Login frontend testing
- ✅ Dashboard Notifications UI verification
- ✅ At least one complete end-to-end approval workflow

### Nice to Have:
- WebSocket testing (if time permits)
- Export functionality testing
- Dashboard & Reporting API tests

---

## 📊 Expected Outcomes

1. **Priority 2 API Tests**: 4/5 complete (80%+)
2. **Frontend Testing**: Critical features verified
3. **Issues Found**: Documented and prioritized
4. **Test Coverage**: ~90% of critical functionality

---

## 🐛 Issue Tracking

Create issues for:
- Any API endpoints that fail
- Frontend bugs or UI issues
- Workflow problems
- Performance concerns
- Security concerns

---

## 📚 Reference Documents

- `TESTING_STATUS.md` - Current testing status
- `TEST_SESSION_SUMMARY.md` - Previous session summary
- `PRIORITIZED_TEST_PLAN.md` - Full test plan
- `APPROVAL_WORKFLOW_TEST_GUIDE.md` - Detailed workflow guide

---

## 🚀 Quick Start Commands

```powershell
# Start Backend
cd admin-web/backend
npm start

# Start Frontend (new terminal)
cd admin-web
npm start

# Health Check
curl http://localhost:3002/api/health

# Test Receipt Creation
Invoke-RestMethod -Method POST -Uri "http://localhost:3002/api/receipts" -Body (@{employeeId="test"; date="2025-12-16"; amount=10.50; vendor="Test"; category="Gas"} | ConvertTo-Json) -ContentType "application/json"
```

---

## 📋 Notes

- **Focus on API tests first** - Faster to execute, provides foundation
- **Frontend testing requires actual user accounts** - Have credentials ready
- **Document issues immediately** - Don't wait until end of session
- **Test one workflow completely** - Better than testing many partially

---

**Ready for tomorrow!** 🎯

