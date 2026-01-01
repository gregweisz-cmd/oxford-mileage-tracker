# Testing Plan - Tomorrow Morning

**Date**: December 20, 2025  
**Estimated Time**: 2-3 hours  
**Focus**: Test New Features from December 19 + Complete Priority 2 API Tests + Manual Frontend Testing

---

## 🎯 Session Goals

1. **Test New Features Completed December 19:**
   - Sunday reminder frequency fix (once per Sunday)
   - Receipt auto-population to Summary Sheet
   - Receipt image viewing/editing improvements
   - Personalized portal naming
   - Preferred name clarifications

2. Complete remaining Priority 2 API tests
3. Begin manual frontend testing for critical features
4. Verify end-to-end workflows with real user accounts
5. Document any issues found

---

## 📋 Testing Checklist

### Phase 0: Test December 19 Features (30-45 min)

#### 1. Sunday Reminder Frequency Fix (10 min)
- [x] Wait until Sunday OR manually trigger reminder
- [x] Verify reminder is sent only once on Sunday
- [x] Check that reminder does NOT repeat every hour
- [x] Verify reminder resets for next Sunday
- [x] Check backend logs for "Already sent Sunday reminders for today, skipping"

#### 2. Receipt Auto-Population (15 min)
- [x] Add a new receipt in Receipt Management tab (e.g., Airfare $100)
- [x] Verify Summary Sheet automatically updates with $100 in Air/Rail/Bus
- [x] Add another receipt in same category (e.g., Bus ticket $25)
- [x] Verify Summary Sheet shows $125 total
- [x] Test with different categories (Parking, Lodging, etc.)
- [x] Verify auto-population works when editing existing receipts
- [x] Verify manual edits are preserved (auto-population only fills empty fields)

#### 3. Receipt Image Viewing/Editing (10 min)
- [x] Open a receipt with an image in Receipt Management
- [x] Verify image displays correctly (not broken icon)
- [x] Click to view full image
- [x] Test "Edit Image" button
- [x] Verify can take new photo or choose from library
- [x] Verify image updates after editing
- [x] Test with receipt that has no image (should show placeholder)

#### 4. Personalized Portal Naming (5 min)
- [x] Login as different users
- [x] Verify Portal Switcher shows personalized names (e.g., "Greg's Portal")
- [x] Verify uses preferred name if set, otherwise first name
- [x] Check Keyboard Shortcuts dialog uses personalized name

#### 5. Preferred Name Clarification (5 min)
- [x] Go to User Settings
- [x] Verify helper text explains preferred name usage
- [x] Check Setup Wizard has clarification alert
- [x] Verify tooltip on preferred name in Staff Portal
- [x] Check mobile app Settings screen has clarification

---

### Phase 1: Complete Priority 2 API Tests (1-1.5 hours)

#### ✅ Already Completed
- [x] Employee Management - All CRUD operations verified

#### 🔲 To Complete

**9. Receipt Management (20 min)**
- [x] POST `/api/receipts` - Creates new receipt
- [x] Handles image upload (base64 or file)
- [x] File size limits are enforced (50MB max, config verified)
- [x] Invalid file types are rejected (jpeg, png, gif, webp allowed)
- [x] GET `/api/receipts?category=gas` - Filters by category
- [x] DELETE `/api/receipts/:id` - Deletes receipt and image

**10. Real-Time Updates (WebSocket) (15 min)**
- [x] WebSocket connects successfully
- [x] Connection reconnects on drop (reconnection logic verified)
- [x] Creating mileage entry broadcasts update
- [x] Frontend receives WebSocket messages
- [x] Frontend updates UI on data changes (updates received)
- [x] Connection status indicator shows correctly (connection established)

**11. Export Functionality (15 min)**
- [x] GET `/api/export/expense-report-pdf/:id` - Generates PDF
- [x] PDF includes all report data ✅ Verified by user
- [x] PDF includes receipts/images ✅ Verified by user
- [x] PDF formatting is correct ✅ Verified by user
- [x] Export files are downloadable ✅ Verified by user

**12. Dashboard & Reporting (20 min)**
- [x] Dashboard loads without errors
- [x] Dashboard shows correct data for user role
- [x] Dashboard totals are accurate
- [x] GET `/api/dashboard-statistics` - Returns statistics (tested)
- [x] GET `/api/admin/reporting/overview` - Returns overview statistics (tested)
- [x] POST `/api/admin/reporting/report-builder/query` - Report Builder query works (tested, fixed missing function)

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
   - **Note**: Database was restored from backup on Dec 19 - verify all data intact

2. **Test December 19 Features** (30-45 min)
   - Sunday reminder frequency
   - Receipt auto-population
   - Receipt image improvements
   - Personalized portal naming
   - Preferred name clarifications

3. **Priority 2 API Tests** (1-1.5 hours)
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
- ✅ All December 19 feature tests (Sunday reminder, receipt auto-pop, images, naming)
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

1. **December 19 Features**: All 5 features tested and verified
2. **Priority 2 API Tests**: 4/5 complete (80%+)
3. **Frontend Testing**: Critical features verified
4. **Issues Found**: Documented and prioritized
5. **Test Coverage**: ~90% of critical functionality

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

- `SESSION_SUMMARY_DEC_19_2025.md` - **Today's completed work** ⭐
- `FEATURE_ROADMAP.md` - All features status (all marked completed)
- `TESTING_GUIDE_SUMMARY_SHEET_UPDATES.md` - Summary sheet testing guide
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

- **Test December 19 features first** - These are new and need immediate verification
- **Database was restored** - Verify all data is intact (employees, reports, receipts)
- **Sunday reminder test** - May need to wait until Sunday OR manually trigger for testing
- **Focus on API tests after new features** - Faster to execute, provides foundation
- **Frontend testing requires actual user accounts** - Have credentials ready
- **Document issues immediately** - Don't wait until end of session
- **Test one workflow completely** - Better than testing many partially

## 🔧 Important Notes from December 19

- **Database**: Was corrupted and restored from backup (`expense_tracker_2025-11-26_12-21-57-262Z.db`)
- **Backend**: Running on port 3002
- **Frontend**: Running on port 3000
- **Sunday Reminder Fix**: Now tracks last reminder date and only sends once per Sunday
- **Receipt Auto-Population**: Only populates empty fields, preserves manual edits
- **All servers shut down**: Will need to restart both backend and frontend tomorrow

---

**Ready for tomorrow!** 🎯

**Last Updated**: December 19, 2025

