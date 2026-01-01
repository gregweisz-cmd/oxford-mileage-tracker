# Quick Start Guide - December 31, 2025

## 🚀 Quick Server Startup

### 1. Start Backend (Terminal 1)
```powershell
cd admin-web/backend
node server.js
```

**Expected Output:**
- ✅ Database initialization completed
- ✅ Server running on port 3002
- ✅ Sunday reminder job started
- ✅ Preferences column added to employees table (if first run after update)

### 2. Start Frontend (Terminal 2)
```powershell
cd admin-web
npm start
```

**Expected Output:**
- ✅ Compiled successfully!
- ✅ Local: http://localhost:3000

### 3. Verify Services
```powershell
# Check backend
Invoke-WebRequest -Uri "http://localhost:3002" -UseBasicParsing

# Check frontend (should open in browser)
Start-Process "http://localhost:3000"
```

---

## ✅ Recently Completed (December 31, 2025)

### 1. Phone Number Formatting - ✅ TESTED
- Working correctly with (###) ###-#### format
- Validates 10 digits properly

### 2. Dark Theme - ✅ TESTED & FIXED
- Dark grey palette working correctly
- Theme persistence fixed (now defaults to light for new users)
- Immediate theme switching works

### 3. 2FA Removal - ✅ VERIFIED
- All 2FA functionality removed from User Settings
- Only "Change Password" button remains

### 4. Preferred Name Defaulting - ✅ IMPLEMENTED
- Now defaults to legal first name if left blank during setup
- Field is optional, with helpful placeholder text

### 5. Dashboard & Reporting API Testing - ✅ COMPLETE
- Dashboard Statistics API tested and working
- Admin Overview API tested and working
- Report Builder Query API tested and fixed
- All Phase 1 API tests complete!

---

## 📋 Testing Focus

### Priority 1: New Features - ✅ COMPLETE!
1. ✅ Phone number formatting and validation - TESTED
2. ✅ Dark theme functionality and persistence - TESTED & FIXED
3. ✅ 2FA removal - VERIFIED
4. ✅ Preferred name defaulting - IMPLEMENTED & TESTED

### Priority 2: Complete Phase 1 API Tests - ✅ COMPLETE!
- ✅ Receipt Management - COMPLETE
- ✅ WebSocket (Real-Time Updates) - COMPLETE
- ✅ Export Functionality - COMPLETE
- ✅ Dashboard & Reporting - COMPLETE (All Phase 1 tests done!)

### Priority 3: Phase 2 Frontend Testing (1-1.5 hours) - NEXT!
- Authentication & Login
- Dashboard Notifications
- Role-Based Access Control
- End-to-End Approval Workflow

---

## ⚠️ Important Notes

- **Database**: Was restored from backup on Dec 19 - verify all data intact
- **Backend Port**: 3002
- **Frontend Port**: 3000
- **Test Accounts**: Greg Weisz, Alex Szary, AJ Dunaway
- **Database Migration**: Preferences column will be auto-added on first backend startup after update

---

## 📚 Full Testing Plan

See `TESTING_PLAN_TOMORROW.md` for complete testing checklist.

---

**Ready to test!** 🎯

