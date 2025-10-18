# Mobile App to Web Portal Sync Troubleshooting

## ✅ SYNC BUG FIXED - October 18, 2025

**The sync is now working!** The critical bug was fixed - entity type case mismatch causing data to be sent as "mileageentrys" instead of "mileageEntries". See `SYNC_BUG_FIXED.md` for full details.

---

## Historical Troubleshooting Guide (For Reference)

## Issues Fixed Today

### 1. ✅ Duplicate GPS Tracked Badge
**Problem**: GPS Tracked badge was showing twice in Quick Actions
**Solution**: Removed the larger duplicate badge, kept the smaller one inside the entry container
**Files Changed**: `src/screens/HomeScreen.tsx`

### 2. ✅ Sync Status Indicator Added
**Solution**: Added a visual sync status bar (dev mode only) showing:
- Backend URL (192.168.86.101:3002 in dev)
- Last sync timestamp
- Sync in progress indicator
**Files Changed**: `src/screens/HomeScreen.tsx`

---

## Current Data Flow

```
Mobile App (Local DB: oxford_tracker.db)
    ↓ (SyncIntegrationService - every 5 seconds)
Backend API (192.168.86.101:3002)
    ↓ (Database: expense_tracker.db)
Web Portal (localhost:3000)
```

---

## Troubleshooting Data Not Showing in Web Portal

### Step 1: Check Network Connectivity
**Mobile device must be on the same WiFi network as your computer**

1. On your mobile device, open a browser
2. Navigate to: `http://192.168.86.101:3002/health`
3. Expected response: `{"status":"ok","timestamp":"...","database":"connected"}`
4. If you can't reach it, the mobile app can't sync

### Step 2: Verify Backend is Running
1. Check terminal logs - should see:
   ```
   🚀 Backend server running on http://localhost:3002
   📊 Database path: C:\Users\GooseWeisz\oxford-mileage-tracker\admin-web\backend\expense_tracker.db
   ```

### Step 3: Check Sync Status in Mobile App
1. Open the mobile app
2. Look at the top of the HomeScreen for the sync status bar (gray bar with clock icon)
3. It should show:
   - "Syncing..." when actively syncing
   - "Last sync: [time]" when last successful
   - "Not synced yet" if never synced

**Note**: The "Last sync" timestamp shown is from **manual syncs** only. Auto-sync runs every 5 seconds in the background but doesn't update this timestamp. Your data is still syncing automatically!

### Step 4: Verify Data in Backend Database
Run this script to check if Greg Weisz has data in the backend:

```bash
cd c:\Users\GooseWeisz\oxford-mileage-tracker\admin-web\backend
node check-greg-data.js
```

**Current Status** (as of last check):
- ✅ Greg Weisz exists in backend: `greg-weisz-001`
- ❌ Mileage Entries: 0
- ❌ Receipts: 0
- ❌ Time Tracking: 0
- ❌ Daily Descriptions: 0

**This confirms data is NOT syncing from mobile app to LOCAL backend!**

**UPDATE**: Mobile app logs show successful sync, but data not in local backend. This suggests:
- Mobile app is syncing to **production** (Render.com) instead of localhost
- Check if `__DEV__` flag is properly set
- Verify backend terminal logs for `POST /api/mileage-entries` requests

### Step 5: Check Console Logs
**Mobile App Logs** (when adding entry):
- `✅ Mileage entry saved locally, auto-sync will handle backend`
- `🔄 SyncIntegration: Processing X mileageEntry operations`
- `✅ SyncIntegration: Successfully synced X mileageEntry operations`

**Backend Logs** (when receiving data):
- `[timestamp] POST /api/mileage-entries`

### Step 6: Force Manual Sync
1. On mobile app, go to HomeScreen
2. Pull down to refresh (triggers sync)
3. Or add a manual sync button temporarily

---

## Common Issues and Solutions

### Issue: "Network request failed"
**Cause**: Mobile device can't reach backend
**Solution**: 
- Ensure both devices on same WiFi
- Check firewall settings
- Verify IP address hasn't changed (run `ipconfig` on Windows to check)

### Issue: "Last sync" never updates
**Cause**: Sync service not running
**Solution**: 
- Kill and restart the Expo app
- Check App.tsx to ensure SyncIntegrationService.initialize() is called

### Issue: Data shows on app but not web portal
**Cause**: Sync might be failing silently
**Solution**: 
- Check backend logs for POST requests
- Check mobile app console for sync errors
- Verify `SyncIntegrationService.autoSyncEnabled` is true

### Issue: Different data in app vs web portal
**Cause**: They might be using different databases
**Solution**: 
- Backend should use `expense_tracker.db` (confirmed in server.js line 82)
- Web portal connects to same backend
- Mobile app syncs to backend via API

---

## Quick Verification Commands

### Check if backend is accessible from mobile device:
```bash
# On mobile device browser:
http://192.168.86.101:3002/health
http://192.168.86.101:3002/api/employees
```

### Check backend database directly:
```bash
cd c:\Users\GooseWeisz\oxford-mileage-tracker\admin-web\backend
sqlite3 expense_tracker.db "SELECT COUNT(*) as count FROM mileage_entries;"
sqlite3 expense_tracker.db "SELECT id, employeeId, date, miles FROM mileage_entries ORDER BY date DESC LIMIT 5;"
```

### Check mobile local database:
```bash
cd c:\Users\GooseWeisz\oxford-mileage-tracker
# Note: Mobile DB is on the device, not accessible from command line
# Use console.logs in the app instead
```

---

## Next Steps

1. **Test the sync status indicator**: 
   - Reload the mobile app
   - Check if the gray sync status bar appears at the top of HomeScreen
   - Note what it says ("Not synced yet" vs "Last sync: XX:XX:XX")

2. **Add a test entry on mobile**:
   - Create a new mileage entry
   - Watch the sync status bar for updates
   - Check mobile app console logs for sync messages

3. **Verify on web portal**:
   - Refresh the web portal (localhost:3000)
   - Navigate to the Staff Portal for your employee
   - Check if the new entry appears

4. **If still not working**:
   - Share the mobile app console logs (look for SyncIntegration messages)
   - Share the backend terminal logs (look for POST /api/mileage-entries)
   - Try accessing http://192.168.86.101:3002/health from mobile browser

