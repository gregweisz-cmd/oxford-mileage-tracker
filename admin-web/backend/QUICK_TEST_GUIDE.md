# Quick Test Guide for Finance Team Meeting

**Purpose**: Quick reference guide for testing before your finance team meeting.

**Estimated Time**: 30-45 minutes for full test suite

---

## 🚀 Quick Start

### 1. Start Backend Server
```bash
cd backend
npm start
```

**Expected Output:**
```
✅ Server is running on port 3002
✅ WebSocket server initialized
```

### 2. Start Frontend (if testing web portal)
```bash
cd admin-web
npm start
```

**Expected Output:**
```
Compiled successfully!
Local: http://localhost:3000
```

---

## ⚡ Automated Tests (5 minutes)

Run automated test scripts to quickly verify backend:

### Run All Tests
```bash
cd backend
npm test
```

### Run Individual Tests
```bash
# Test API endpoints
npm run test:api

# Test WebSocket connection
npm run test:ws

# Test database
npm run test:db
```

**Expected Result:**
- ✅ All tests pass
- ❌ Any failures indicate issues to fix

---

## 📋 Manual Testing Checklist

### Priority 1: Critical Paths (15 minutes)

#### ✅ Login & Authentication
- [ ] Can log in with valid credentials
- [ ] Cannot log in with invalid credentials
- [ ] Logout works
- [ ] Protected routes require authentication

#### ✅ Finance Dashboard
- [ ] Dashboard loads without errors
- [ ] Overview statistics display correctly
- [ ] Can filter by date range
- [ ] Can filter by employee
- [ ] Can filter by cost center
- [ ] Totals are accurate

#### ✅ Expense Reports
- [ ] Can view all submitted reports
- [ ] Can view report details
- [ ] Report totals are correct
- [ ] Report includes mileage, receipts, and time entries
- [ ] Can export to PDF
- [ ] Can export to Excel

#### ✅ Approval Workflow
- [ ] Can view pending approvals
- [ ] Can approve reports
- [ ] Can reject reports (with reason)
- [ ] Approval status updates correctly
- [ ] Approval notifications work

### Priority 2: Core Features (15 minutes)

#### ✅ Employee Management
- [ ] Can view employees list
- [ ] Can search employees
- [ ] Can filter by supervisor
- [ ] Employee data displays correctly

#### ✅ Data Entry
- [ ] Can view mileage entries
- [ ] Can view receipts
- [ ] Can view time entries
- [ ] Data filters work

#### ✅ Real-Time Updates
- [ ] WebSocket connects
- [ ] Updates appear in real-time
- [ ] Multiple clients receive updates

### Priority 3: Advanced Features (10 minutes)

#### ✅ Report Builder
- [ ] Can create custom reports
- [ ] Date range selector works
- [ ] Employee selector works
- [ ] Cost center selector works
- [ ] Generated reports are accurate

#### ✅ Scheduled Reports
- [ ] Can view scheduled reports
- [ ] Can create new schedule
- [ ] Can edit schedule
- [ ] Can delete schedule

#### ✅ Export Functionality
- [ ] PDF export works
- [ ] Excel export works
- [ ] Export files are downloadable
- [ ] Export data is accurate

---

## 🔍 Testing Specific Finance Portal Features

### Dashboard View
1. **Open Finance Dashboard**
   - Navigate to `http://localhost:3000`
   - Log in as finance user
   - Should see dashboard with overview statistics

2. **Verify Statistics**
   - Total reports submitted
   - Total reports approved
   - Total reports pending
   - Total expenses this month
   - Total mileage this month

3. **Test Filters**
   - Select date range (e.g., this month)
   - Filter by employee
   - Filter by cost center
   - Verify filtered data is correct

### Report Review
1. **View Submitted Reports**
   - Click "Pending Approvals"
   - Should see list of submitted reports
   - Each report shows employee name and date range

2. **Review Report Details**
   - Click on a report
   - Verify it shows:
     - Mileage entries with dates and amounts
     - Receipts with amounts and categories
     - Time entries with hours
     - Total calculations

3. **Approve Report**
   - Click "Approve" button
   - Report status should change to "Approved"
   - Report should move from pending list

4. **Reject Report**
   - Click "Reject" button
   - Enter rejection reason
   - Report status should change to "Rejected"
   - Report should move from pending list

### Export & Reporting
1. **Export to PDF**
   - Open a report
   - Click "Export PDF"
   - PDF should download
   - PDF should contain all report data

2. **Export to Excel**
   - Open a report
   - Click "Export Excel"
   - Excel file should download
   - Excel should contain all report data

3. **Custom Report Builder**
   - Navigate to "Report Builder"
   - Select date range
   - Select employees
   - Select cost centers
   - Generate report
   - Verify report data is accurate

---

## 🐛 Common Issues & Quick Fixes

### Backend Not Starting
**Issue**: `Error: listen EADDRINUSE: address already in use :::3002`
**Fix**: 
```bash
# Windows
netstat -ano | findstr :3002
taskkill /PID <PID> /F

# Mac/Linux
lsof -ti:3002 | xargs kill
```

### Database Locked
**Issue**: `SQLITE_BUSY: database is locked`
**Fix**: Close any database viewers or other processes using the database

### WebSocket Not Connecting
**Issue**: WebSocket connection fails
**Fix**: 
1. Check backend server is running
2. Check firewall isn't blocking port 3002
3. Check CORS configuration

### Frontend Not Loading
**Issue**: Frontend won't load or shows errors
**Fix**:
1. Check backend is running
2. Check browser console for errors
3. Clear browser cache
4. Check API endpoint URLs in frontend code

---

## 📝 Testing Notes Template

**Date**: _______________
**Tester**: _______________

### Issues Found:
1. 
2. 
3. 

### Working Well:
1. 
2. 
3. 

### Priority Fixes Before Meeting:
1. 
2. 
3. 

---

## ✅ Pre-Meeting Checklist

Before meeting with finance team:

- [ ] All automated tests pass
- [ ] Critical paths tested and working
- [ ] Finance dashboard loads correctly
- [ ] Report viewing works
- [ ] Approval workflow works
- [ ] Export functionality works
- [ ] No console errors in browser
- [ ] No errors in server logs
- [ ] Database connection stable
- [ ] WebSocket connection working

---

## 🎯 Focus Areas for Finance Team

Based on your meeting, prioritize testing:

1. **Report Review Interface** - Make sure it's intuitive and clear
2. **Approval Workflow** - Should be simple and fast
3. **Export Options** - PDF and Excel exports should work perfectly
4. **Search & Filter** - Easy to find specific reports
5. **Totals & Calculations** - All numbers must be accurate

---

## 📞 Quick Test Commands

```bash
# Test everything quickly
cd backend
npm test

# Check server status
curl http://localhost:3002/api/health

# Test WebSocket (in browser console)
const ws = new WebSocket('ws://localhost:3002/ws');
ws.onopen = () => console.log('Connected!');
ws.onmessage = (e) => console.log('Message:', e.data);

# Test API endpoint (example)
curl http://localhost:3002/api/employees
```

---

**Good luck with your meeting! 🚀**

