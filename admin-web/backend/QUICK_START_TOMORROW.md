# Quick Start Guide - December 22, 2025

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

## 🆕 New Features to Test (December 22, 2025)

### 1. Phone Number Formatting
- **Location**: User Settings → Profile Information → Phone Number
- **Test**: Enter phone number in any format (1234567890, 123-456-7890, etc.)
- **Expected**: On save, formats to (###) ###-####
- **Validation**: Must have exactly 10 digits (or be empty)

### 2. Dark Theme
- **Location**: User Settings → Application Preferences → Theme
- **Test**: 
  - Select "Dark" theme
  - Should immediately switch to dark grey palette
  - Navigate around portal to verify all components use dark theme
  - Save settings to persist preference
  - Log out and back in - theme should persist
- **Expected**: Dark grey backgrounds (#1e1e1e, #2d2d2d), light text, not pure black

### 3. 2FA Removal
- **Location**: User Settings → Security Settings
- **Test**: Verify 2FA section is completely removed
- **Expected**: Only "Change Password" button visible, no 2FA toggle or setup

---

## 📋 Testing Focus

### Priority 1: New Features (15-20 min)
1. ⏳ Phone number formatting and validation
2. ⏳ Dark theme functionality and persistence
3. ⏳ Verify 2FA removal

### Priority 2: Complete Phase 1 API Tests
- ✅ Receipt Management - COMPLETE
- ✅ WebSocket (Real-Time Updates) - COMPLETE
- ✅ Export Functionality - COMPLETE
- ⏳ Dashboard & Reporting - NEXT (Last Phase 1 test!)

### Priority 3: Frontend Testing (1-1.5 hours)
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

