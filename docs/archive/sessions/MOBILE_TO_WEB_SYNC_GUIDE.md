# Mobile App ↔ Web Portal Sync - Complete Guide

## 🎯 How Data Sync Works Now

### Mobile App → Backend (Automatic)

When you create any data on the mobile app, it automatically syncs to the backend:

1. **Create GPS Tracked Drive** → Queued for sync
2. **Add Receipt** → Queued for sync
3. **Add Time Tracking** → Queued for sync
4. **Auto-Sync Timer** → Syncs every 5 seconds
5. **Backend Updated** → Data available to web portal

### Backend → Mobile App (On Demand)

When you open the mobile app:

1. **App Startup** → Auto-syncs from backend
2. **Manual Sync Button** → Force immediate sync
3. **Pull Down to Refresh** → Re-syncs data

---

## 📱 Mobile App Features

### New "Sync to Backend" Button
Located at the top of the Home screen, this button:
- ✅ Immediately syncs all pending changes to backend
- ✅ Shows "Syncing..." status
- ✅ Displays last sync time after completion
- ✅ Pulls latest data from backend after sync

### Auto-Sync (Background)
- ✅ **Enabled by default**
- ✅ Syncs every **5 seconds** automatically
- ✅ Queue-based (won't lose data if offline)
- ✅ Retries failed syncs (up to 3 attempts)

### Sync Status Indicator
- 🟢 **Green "Last synced"** badge shows when sync completed
- 🔵 **"Syncing..."** message during active sync
- ⚠️ Errors are logged to console

---

## 🧪 Testing Workflow

### Test 1: GPS Tracked Drive Appears in Web Portal

1. **On Mobile App**:
   - Tap "Start GPS Tracking"
   - Drive around (or simulate)
   - Stop tracking
   - Entry appears in "Recent Activities" ✅
   - Wait 5 seconds OR tap "Sync to Backend"

2. **On Web Portal** (http://localhost:3000):
   - Login as Greg Weisz
   - Navigate to Staff Portal → October 2025
   - Refresh page (Ctrl+F5)
   - GPS tracked drive should appear! ✅

### Test 2: Manual Entry Syncs

1. **On Mobile App**:
   - Tap "Manual Entry"
   - Fill in trip details
   - Save
   - Tap "Sync to Backend"
   - See "Sync Complete" message

2. **On Web Portal**:
   - Refresh Staff Portal
   - Manual entry should appear ✅

### Test 3: Receipts Sync

1. **On Mobile App**:
   - Tap "Add Receipt"
   - Take photo / fill details
   - Save
   - Auto-syncs in 5 seconds

2. **On Web Portal**:
   - Refresh Staff Portal
   - Receipt should appear in receipts section ✅

---

## 🔍 Verifying Sync Status

### In Mobile App

**Check Console Logs**:
```
✅ SyncIntegration: Auto-sync enabled and started (syncs every 5 seconds)
🔄 SyncIntegration: Queued create operation for mileageentry: mile123
🔄 SyncIntegration: Processing sync queue (1 items)
✅ SyncIntegration: Successfully synced mileageentry: mile123
```

**Check Home Screen**:
- Look for green "Last synced: XX:XX:XX" badge
- Tap "Sync to Backend" button
- Should see "Sync Complete" alert

### In Web Portal

**Check Backend Logs** (terminal where backend is running):
```
[2025-10-15T...] POST /api/mileage-entries
✅ Mileage entry created successfully: mile123
```

**Check Data**:
- Navigate to Staff Portal
- Select current month
- GPS tracked drives appear in:
  - ✅ Daily Entries table
  - ✅ Mileage tab
  - ✅ Monthly totals

---

## 🛠️ Technical Details

### Sync Architecture

```
Mobile App (SQLite)
    ↓ (on create/update/delete)
  Queue Operation
    ↓ (every 5 seconds)
  SyncIntegrationService
    ↓ (HTTP POST/PUT/DELETE)
  Backend API (localhost:3002)
    ↓ (writes to)
  Backend Database (oxford_tracker.db)
    ↓ (reads from)
  Web Portal (localhost:3000)
```

### Data Flow

**Creating a GPS Tracked Drive**:
1. GPS tracking captures location points
2. User stops tracking
3. `DatabaseService.createMileageEntry()` called
4. Entry saved to local SQLite with `isGpsTracked = 1`
5. `syncToApi('addMileageEntry', entry)` called
6. Operation queued in `SyncIntegrationService`
7. Auto-sync timer triggers (every 5 seconds)
8. `ApiSyncService.syncMileageEntries()` POSTs to backend
9. Backend saves to `oxford_tracker.db`
10. Web portal reads from same database ✅

### Date Handling (Timezone-Safe)

**Storage**:
- Mobile: Stores as `"2025-10-15"` (YYYY-MM-DD, no time)
- Backend: Stores as `"2025-10-15"` (TEXT column)

**Parsing**:
- `"2025-10-15"` → `new Date(2025, 9, 15, 12, 0, 0)` (Oct 15 at noon local)
- **Never** parses as UTC midnight (which would shift to previous day)

**Display**:
- Mobile: `date.toLocaleDateString()` → "Oct 15, 2025"
- Web: Same format
- **Result**: Dates match across all screens and devices ✅

---

## 🚨 Troubleshooting

### Issue: GPS Drive Not Appearing in Web Portal

**Check**:
1. Mobile app shows "Last synced" badge?
2. Tap "Sync to Backend" - does it succeed?
3. Check mobile console for sync errors
4. Check backend terminal for POST requests
5. Refresh web portal (Ctrl+F5)

**Solution**:
- If no "Last synced" badge → Check internet connection
- If sync fails → Check backend is running (http://localhost:3002/health)
- If backend not receiving → Check API URL in `apiSyncService.ts`

### Issue: Dates Don't Match

**Check**:
- Mobile console: Look for date storage logs
- Should see: `"2025-10-15"` (not with time)
- If you see ISO timestamps → Code needs updating

**Solution**:
- All date storage should use YYYY-MM-DD format
- All date parsing should use `parseDateSafe()` function

### Issue: Duplicate Entries

**Check**:
- Mobile console: Look for "already exists, skipping"
- Database should check for existing IDs before creating

**Solution**:
- Restart app (cleanup runs on startup)
- Or tap "Sync to Backend" (forces dedupe)

---

## 📊 Current Configuration

### Mobile App
- **Auto-Sync**: ✅ Enabled
- **Sync Interval**: 5 seconds
- **Backend URL**: http://192.168.86.101:3002/api
- **Max Retries**: 3 attempts

### Backend
- **Port**: 3002
- **Database**: c:\Users\GooseWeisz\oxford-mileage-tracker\oxford_tracker.db
- **CORS**: Allows mobile app IP
- **WebSocket**: Real-time updates enabled

### Web Portal
- **Port**: 3000
- **Backend**: http://localhost:3002/api
- **Real-time**: WebSocket connection to backend

---

## ✅ Testing Checklist

Before your drive test today:

- [ ] Mobile app loads and shows "Last synced" badge
- [ ] Tap "Sync to Backend" - succeeds
- [ ] Backend terminal shows sync requests
- [ ] Web portal shows existing GPS entries
- [ ] Create test entry on mobile
- [ ] Entry appears in web portal after refresh
- [ ] Dates match on all screens

---

## 🎯 What to Test Today

### During Your Drive:

1. **Start GPS Tracking** on mobile app
2. **Drive to destination**
3. **Stop GPS Tracking**
4. **Verify** entry appears in Recent Activities
5. **Check date** - should be today's date
6. **Tap "Sync to Backend"** (or wait 5 seconds)
7. **Check console** for sync success message

### After Your Drive:

1. **Open Web Portal** at http://localhost:3000
2. **Login as Greg Weisz**
3. **Navigate to** Staff Portal → Current Month
4. **Look for** your GPS tracked drive
5. **Verify**:
   - ✅ Correct date (today)
   - ✅ Correct miles
   - ✅ GPS tracked badge
   - ✅ Correct start/end locations

---

## 📝 Reporting Issues

If you encounter any issues during testing, please capture:

1. **Mobile App Console Output**
2. **Backend Terminal Output**
3. **Screenshot of mobile app**
4. **Screenshot of web portal**
5. **Description of what you expected vs what happened**

---

*Last Updated: October 16, 2025*  
*Status: Ready for Field Testing* 🚗

