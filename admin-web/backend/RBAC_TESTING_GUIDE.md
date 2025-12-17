# Role-Based Access Control (RBAC) Testing Guide

**Date**: December 16, 2025  
**Focus**: Comprehensive RBAC testing for all user roles  
**Status**: ⏳ Ready to Test

---

## 🎯 Testing Objectives

Verify that each user role can only access the features and data they're authorized for, and cannot access restricted areas.

---

## 👥 Test Accounts

### Employee Role
- **Name**: Alex Szary
- **Email**: `alex.szary@oxfordhouse.org`
- **Role**: `employee`
- **Expected Access**: Own reports only, Staff Portal

### Supervisor Role
- **Name**: AJ Dunaway
- **Email**: `aj.dunaway@oxfordhouse.org`
- **Role**: `supervisor`
- **Expected Access**: Team reports, Supervisor Portal, Staff Portal

### Finance Role
- **Name**: Crystal Wood
- **Email**: `crystal.wood@oxfordhouse.org` (or check database)
- **Role**: `finance`
- **Expected Access**: All approved reports, Finance Portal, Staff Portal

### Admin Role
- **Name**: Greg Weisz
- **Email**: `greg.weisz@oxfordhouse.org`
- **Role**: `admin` (or position-based)
- **Expected Access**: All portals, all features, employee management

---

## 📋 Test Checklist

### 1. Employee Role (Alex Szary) - 15 min

#### Portal Access
- [ ] **Can access**: Staff Portal
- [ ] **Cannot access**: Admin Portal, Supervisor Portal (unless has supervisor position), Finance Portal

#### Report Access
- [ ] **Can view**: Own reports only
- [ ] **Can create**: Own reports
- [ ] **Can edit**: Own draft reports
- [ ] **Can submit**: Own reports
- [ ] **Cannot view**: Other employees' reports
- [ ] **Cannot approve**: Any reports
- [ ] **Cannot reject**: Any reports

#### Employee Management
- [ ] **Cannot access**: Employee Management page
- [ ] **Cannot see**: Employee list
- [ ] **Cannot create**: New employees
- [ ] **Cannot edit**: Employee records
- [ ] **Cannot archive**: Employees

#### API Endpoints (Test via browser console or Postman)
- [ ] `GET /api/expense-reports?employeeId=<own-id>` - ✅ Should work
- [ ] `GET /api/expense-reports?employeeId=<other-id>` - ❌ Should fail or return empty
- [ ] `GET /api/employees` - ❌ Should fail or return only own record
- [ ] `POST /api/employees` - ❌ Should fail (403 Forbidden)
- [ ] `PUT /api/expense-reports/:id/approval` - ❌ Should fail (403 Forbidden)

#### Navigation
- [ ] **Can see**: Staff Portal navigation items
- [ ] **Cannot see**: Admin navigation items
- [ ] **Cannot see**: Supervisor-specific navigation (unless has supervisor position)

**Expected Result**: ✅ Employee can only access own data and cannot perform administrative actions

---

### 2. Supervisor Role (AJ Dunaway) - 15 min

#### Portal Access
- [ ] **Can access**: Supervisor Portal, Staff Portal
- [ ] **Cannot access**: Admin Portal (unless also admin), Finance Portal (unless also finance)

#### Report Access
- [ ] **Can view**: Own reports + team members' reports
- [ ] **Can approve**: Team members' reports
- [ ] **Can reject**: Team members' reports
- [ ] **Can request revision**: Team members' reports
- [ ] **Cannot view**: Reports from other supervisors' teams
- [ ] **Cannot approve**: Reports from other teams
- [ ] **Can view**: Detailed reports for team members

#### Employee Management
- [ ] **Cannot access**: Employee Management page (unless also admin)
- [ ] **Cannot create**: New employees (unless also admin)
- [ ] **Can view**: Team members in Supervisor Portal

#### API Endpoints
- [ ] `GET /api/expense-reports?employeeId=<team-member-id>` - ✅ Should work
- [ ] `GET /api/expense-reports?employeeId=<other-team-id>` - ❌ Should fail or return empty
- [ ] `PUT /api/expense-reports/:id/approval` (team member report) - ✅ Should work
- [ ] `PUT /api/expense-reports/:id/approval` (other team report) - ❌ Should fail
- [ ] `GET /api/employees` - ❌ Should fail or return limited data (unless admin)

#### Navigation
- [ ] **Can see**: Supervisor Portal navigation
- [ ] **Can see**: Pending Approvals section
- [ ] **Can see**: Team Dashboard
- [ ] **Cannot see**: Employee Management (unless admin)

**Expected Result**: ✅ Supervisor can manage team reports but cannot access admin features or other teams' data

---

### 3. Finance Role (Crystal Wood) - 15 min

#### Portal Access
- [ ] **Can access**: Finance Portal, Staff Portal
- [ ] **Cannot access**: Admin Portal (unless also admin), Supervisor Portal (unless also supervisor)

#### Report Access
- [ ] **Can view**: All approved reports (from supervisor approval)
- [ ] **Can approve**: Reports that reached finance stage
- [ ] **Can reject**: Reports that reached finance stage
- [ ] **Can request revision**: Reports that reached finance stage
- [ ] **Can view**: Detailed reports for all approved reports
- [ ] **Can export**: Reports (PDF, Excel)
- [ ] **Cannot view**: Draft or submitted reports (before supervisor approval)

#### Employee Management
- [ ] **Cannot access**: Employee Management page
- [ ] **Cannot create**: New employees
- [ ] **Cannot edit**: Employee records

#### API Endpoints
- [ ] `GET /api/expense-reports?status=approved_by_supervisor` - ✅ Should work
- [ ] `GET /api/expense-reports?status=draft` - ❌ Should fail or return empty
- [ ] `PUT /api/expense-reports/:id/approval` (approved report) - ✅ Should work
- [ ] `GET /api/export/expense-report-pdf/:id` - ✅ Should work
- [ ] `GET /api/employees` - ❌ Should fail (403 Forbidden)
- [ ] `POST /api/employees` - ❌ Should fail (403 Forbidden)

#### Navigation
- [ ] **Can see**: Finance Portal navigation
- [ ] **Can see**: Pending Approvals section
- [ ] **Can see**: Export options
- [ ] **Cannot see**: Employee Management

**Expected Result**: ✅ Finance can approve reports and export data but cannot manage employees

---

### 4. Admin Role (Greg Weisz) - 15 min

#### Portal Access
- [ ] **Can access**: All portals (Admin, Supervisor, Finance, Staff)
- [ ] **Can switch**: Between all available portals
- [ ] **Default portal**: Should respect preference or default to Admin

#### Report Access
- [ ] **Can view**: All reports (all employees, all statuses)
- [ ] **Can approve**: Any report
- [ ] **Can reject**: Any report
- [ ] **Can request revision**: Any report
- [ ] **Can view**: Detailed reports for all employees
- [ ] **Can export**: Any report

#### Employee Management
- [ ] **Can access**: Employee Management page
- [ ] **Can view**: All employees (including archived)
- [ ] **Can create**: New employees
- [ ] **Can edit**: Employee records
- [ ] **Can archive**: Employees
- [ ] **Can restore**: Archived employees
- [ ] **Can change**: Employee roles and positions

#### API Endpoints
- [ ] `GET /api/expense-reports` (all reports) - ✅ Should work
- [ ] `GET /api/expense-reports?employeeId=<any-id>` - ✅ Should work
- [ ] `PUT /api/expense-reports/:id/approval` - ✅ Should work
- [ ] `GET /api/employees` - ✅ Should work
- [ ] `POST /api/employees` - ✅ Should work
- [ ] `PUT /api/employees/:id` - ✅ Should work
- [ ] `POST /api/employees/:id/archive` - ✅ Should work
- [ ] `GET /api/export/expense-report-pdf/:id` - ✅ Should work

#### Navigation
- [ ] **Can see**: All navigation items
- [ ] **Can see**: Employee Management
- [ ] **Can see**: Admin Dashboard
- [ ] **Can see**: All reporting features

**Expected Result**: ✅ Admin has full access to all features and data

---

## 🔍 Testing Methods

### Method 1: Manual UI Testing (Recommended)
1. Log in as each test user
2. Navigate through the application
3. Try to access restricted features
4. Verify expected behavior

### Method 2: Browser Console Testing
1. Log in as test user
2. Open browser DevTools (F12)
3. Test API calls in console:
   ```javascript
   // Test API access
   fetch('http://localhost:3002/api/employees', {
     headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` }
   }).then(r => r.json()).then(console.log);
   ```

### Method 3: Direct API Testing (Postman/curl)
1. Get auth token from login
2. Test endpoints with different user tokens
3. Verify 403 Forbidden for unauthorized access

---

## 🐛 Common Issues to Watch For

1. **Portal Access**: User can access portals they shouldn't
2. **Data Leakage**: User can see data from other employees/teams
3. **Unauthorized Actions**: User can perform actions they shouldn't (approve, create employees, etc.)
4. **Missing Restrictions**: Admin-only features visible to non-admin users
5. **Token Validation**: Backend not properly validating user permissions

---

## 📝 Test Results Template

For each role, document:

```markdown
### [Role] - [User Name]

**Portal Access**: ✅/❌
**Report Access**: ✅/❌
**Employee Management**: ✅/❌
**API Endpoints**: ✅/❌
**Navigation**: ✅/❌

**Issues Found**:
- [List any issues]

**Notes**:
- [Any observations]
```

---

## ✅ Success Criteria

- [ ] All roles can only access authorized portals
- [ ] All roles can only view authorized data
- [ ] All roles can only perform authorized actions
- [ ] Unauthorized access attempts are blocked (403 Forbidden)
- [ ] UI hides restricted features from unauthorized users
- [ ] Backend validates permissions on all protected endpoints

---

## 🚀 Quick Start

1. **Start Servers**:
   ```powershell
   # Terminal 1 - Backend
   cd admin-web/backend
   npm start
   
   # Terminal 2 - Frontend
   cd admin-web
   npm start
   ```

2. **Open Application**: http://localhost:3000

3. **Begin Testing**: Start with Employee role (Alex Szary), then move through each role

4. **Document Results**: Update `MANUAL_FRONTEND_TEST_RESULTS.md` as you test

---

**Ready to test!** 🎯

