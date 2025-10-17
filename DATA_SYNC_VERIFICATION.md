# 📊 Data Sync Verification - Mobile to Web Portal

## Purpose
Verify that all data entered in the mobile app correctly syncs to and displays in the web portal.

---

## 🔄 Data Flow Architecture

```
┌─────────────────┐
│  Mobile App     │
│  (React Native) │
└────────┬────────┘
         │
         │ 1. Save to Local DB
         ▼
┌─────────────────┐
│  SQLite Local   │
│  (Mobile)       │
└────────┬────────┘
         │
         │ 2. Auto-Sync Service
         │    (Every 5 seconds)
         ▼
┌─────────────────┐
│  Backend API    │
│  (Express.js)   │
└────────┬────────┘
         │
         │ 3. Save to Server DB
         ▼
┌─────────────────┐
│  SQLite Backend │
│  (expense_tracker.db)
└────────┬────────┘
         │
         │ 4. WebSocket Broadcast
         ▼
┌─────────────────┐
│  Web Portal     │
│  (React)        │
└─────────────────┘
```

---

## ✅ Verification Checklist

### **1. Mileage Entries**

#### **GPS Tracked Entries:**
- [ ] Start GPS tracking on mobile
- [ ] Drive and capture location data
- [ ] Stop tracking and save destination
- [ ] **Verify in Web Portal:**
  - [ ] Entry appears in Recent Activities
  - [ ] Shows as "GPS Tracked" badge
  - [ ] Displays start/end locations
  - [ ] Shows distance (from GPS)
  - [ ] Shows purpose
  - [ ] Shows cost center
  - [ ] Correct date/time

#### **Manual Entries:**
- [ ] Add manual mileage entry on mobile
- [ ] Fill in all fields (start, end, purpose, miles)
- [ ] **Verify in Web Portal:**
  - [ ] Entry appears immediately
  - [ ] All fields match mobile input
  - [ ] No duplicate entries
  - [ ] Correct employee assigned

---

### **2. Receipts**

#### **Regular Receipts:**
- [ ] Add receipt on mobile (take photo)
- [ ] Fill in vendor, amount, category
- [ ] **Verify in Web Portal:**
  - [ ] Receipt appears in Receipt Management
  - [ ] Image is viewable
  - [ ] Amount displays correctly
  - [ ] Category shows correctly
  - [ ] Cost center is assigned

#### **Per Diem Receipts:**
- [ ] Add Per Diem receipt on mobile
- [ ] Select "Per Diem" category
- [ ] Amount auto-fills to $35 (or actual amount)
- [ ] **Verify in Web Portal:**
  - [ ] Shows in Receipt Management
  - [ ] Category = "Per Diem"
  - [ ] Amount is correct
  - [ ] **Does NOT duplicate**
  - [ ] Counts toward Per Diem total

---

### **3. Time Tracking**

- [ ] Log hours worked on mobile
- [ ] Select category (Office, Field, Training, etc.)
- [ ] **Verify in Web Portal:**
  - [ ] Hours appear in time tracking section
  - [ ] Category matches
  - [ ] Date is correct
  - [ ] Totals are accurate

---

### **4. Daily Descriptions**

- [ ] Add daily description on mobile
- [ ] Select cost center
- [ ] **Verify in Web Portal:**
  - [ ] Description shows for the day
  - [ ] Cost center is correct
  - [ ] Can be edited from web portal

---

### **5. Cost Centers**

- [ ] Update cost centers on mobile (Settings)
- [ ] Select multiple cost centers
- [ ] Set default cost center
- [ ] **Verify in Web Portal:**
  - [ ] Employee profile shows updated cost centers
  - [ ] Default cost center is marked
  - [ ] Entries use correct cost center

---

## 🔍 Known Issues (Recently Fixed)

### ✅ **Fixed Issues:**
1. **GPS entries not syncing** - Fixed employee ID mapping
2. **Dates off by one day** - Fixed timezone handling
3. **Duplicate receipts** - Fixed ID preservation
4. **Manual entries duplicating** - Removed double-sync
5. **Sync on every screen focus** - Now only on app startup

---

## 🧪 Test Scenarios

### **Scenario 1: Full Day Workflow**

**Morning:**
1. Open mobile app
2. Start GPS tracking
3. Drive to first location (10 mi)
4. Stop GPS, save destination

**Mid-Day:**
5. Add manual entry (5 mi)
6. Log 4 hours worked
7. Add $25 receipt (gas)

**Afternoon:**
8. Add Per Diem receipt ($35)
9. Start GPS tracking again
10. Drive to final location (15 mi)
11. Stop GPS, save destination

**Evening - Check Web Portal:**
12. Verify all 3 mileage entries (2 GPS + 1 manual)
13. Verify 2 receipts ($25 gas + $35 per diem)
14. Verify 4 hours logged
15. Check totals: 30 miles, $60 receipts, 4 hours

---

### **Scenario 2: Per Diem Verification**

**Mobile App:**
1. Work 8+ hours
2. Drive 100+ miles
3. Add Per Diem receipt

**Web Portal:**
4. Check Receipt Management - Per Diem shows
5. Check Monthly Report - Per Diem included
6. Verify Per Diem totals (max $350/month)
7. Ensure no duplicates

---

### **Scenario 3: GPS Tracking Edge Cases**

**Test:**
1. Start GPS tracking
2. Navigate away from app
3. Continue tracking in background
4. Return to app
5. Stop tracking

**Verify:**
6. Distance is accurate
7. Time is correct
8. Location details saved
9. No duplicates
10. Appears in web portal

---

## 📋 Web Portal Verification Points

### **Staff Portal - Monthly View**

**Check:**
- [ ] All mileage entries for current month
- [ ] GPS tracked entries marked
- [ ] Receipts listed separately
- [ ] Time tracking totals
- [ ] Cost center breakdown
- [ ] Per Diem calculation

### **Admin Portal - Employee View**

**Check:**
- [ ] All employee data syncs
- [ ] Recent activities show all entries
- [ ] Can view individual entries
- [ ] Can approve/reject reports
- [ ] Export to PDF works

### **Supervisor Dashboard**

**Check:**
- [ ] Pending reports show
- [ ] Can approve/reject
- [ ] Comments save
- [ ] Notifications work

---

## 🛠️ Sync Debugging

### **Mobile App Logs to Check:**
```
✅ ApiSync: Mileage entry saved locally, auto-sync will handle backend
🔄 SyncIntegration: Queued create operation for mileage_entries
📤 ApiSync: Syncing mileage entry to backend...
✅ ApiSync: Mileage entry synced successfully
```

### **Backend Logs to Check:**
```
📝 Creating mileage entry: {employeeId, date, miles...}
✅ Mileage entry [id] saved
🔄 RealtimeSync: Broadcasting change to X clients
```

### **Web Portal Logs to Check:**
```
🔄 RealtimeSync: Received mileage_entries update
✅ Data refreshed
```

---

## ⚠️ Common Sync Issues & Solutions

### **Issue: Data Not Appearing in Web Portal**

**Check:**
1. Mobile app is connected to internet
2. Backend server is running
3. WebSocket connection is active
4. Employee ID matches on both sides

**Solution:**
- Force manual sync from mobile app
- Refresh web portal
- Check browser console for errors

---

### **Issue: Duplicate Entries**

**Check:**
1. Entry has unique ID
2. Duplicate detection is working
3. Not syncing on every screen focus

**Solution:**
- Run duplicate cleanup script
- Verify ID preservation in sync
- Check sync frequency settings

---

### **Issue: Per Diem Not Showing**

**Check:**
1. Category is exactly "Per Diem"
2. Amount is filled in
3. Cost center has Per Diem rules
4. Not exceeding $350/month limit

**Solution:**
- Check Per Diem rules in web portal
- Verify cost center assignment
- Check monthly totals

---

## 📊 Data Integrity Checks

### **Run These Queries:**

**Check for duplicate mileage entries:**
```sql
SELECT employeeId, date, startLocation, endLocation, miles, COUNT(*) as count
FROM mileage_entries
GROUP BY employeeId, date, startLocation, endLocation, miles
HAVING COUNT(*) > 1;
```

**Check for duplicate receipts:**
```sql
SELECT employeeId, date, amount, vendor, category, COUNT(*) as count
FROM receipts
GROUP BY employeeId, date, amount, vendor, category
HAVING COUNT(*) > 1;
```

**Check for orphaned entries:**
```sql
-- Mileage entries without valid employee
SELECT m.* FROM mileage_entries m
LEFT JOIN employees e ON m.employeeId = e.id
WHERE e.id IS NULL;

-- Receipts without valid employee
SELECT r.* FROM receipts r
LEFT JOIN employees e ON r.employeeId = e.id
WHERE e.id IS NULL;
```

---

## 🎯 Success Criteria

### **All Data Types Sync Correctly:**
- ✅ Mileage entries (manual & GPS)
- ✅ Receipts (regular & Per Diem)
- ✅ Time tracking
- ✅ Daily descriptions
- ✅ Cost center assignments

### **No Duplicates:**
- ✅ Each entry has unique ID
- ✅ Duplicate detection works
- ✅ Sync doesn't create copies

### **Real-Time Updates:**
- ✅ Web portal updates within 5 seconds
- ✅ WebSocket broadcasts work
- ✅ Multiple users see updates

### **Data Integrity:**
- ✅ No orphaned entries
- ✅ Employee IDs valid
- ✅ Dates are correct (no timezone issues)
- ✅ Totals calculate correctly

---

## 📝 Verification Log

Use this checklist during testing:

**Date:** _____________  
**Tester:** _____________

| Data Type | Mobile Entry | Web Portal Display | Sync Time | Issues | Status |
|-----------|-------------|-------------------|-----------|--------|--------|
| GPS Mileage | ✓ | ✓ | 3 sec | None | ✅ |
| Manual Mileage | ✓ | ✓ | 2 sec | None | ✅ |
| Regular Receipt | ✓ | ✓ | 4 sec | None | ✅ |
| Per Diem Receipt | ✓ | ✓ | 4 sec | None | ✅ |
| Time Tracking | ✓ | ✓ | 3 sec | None | ✅ |
| Daily Description | ✓ | ✓ | 3 sec | None | ✅ |
| Cost Center Update | ✓ | ✓ | 5 sec | None | ✅ |

---

## 🔧 Maintenance Commands

### **Clean Up Duplicates:**
```bash
cd admin-web/backend
node debug-scripts-archive/delete-mobile-duplicate-receipts.js
```

### **Check Sync Status:**
```bash
# Check backend logs
cd admin-web/backend
npm start
# Watch for sync messages
```

### **Force Sync from Mobile:**
- Open Settings → Data Sync → Manual Sync

---

## 📈 Performance Metrics

### **Current Sync Performance:**
- **Mileage Entry:** ~2-3 seconds
- **Receipt:** ~3-4 seconds (image upload)
- **Time Tracking:** ~2 seconds
- **Batch Operations:** ~5-10 seconds

### **Optimization Goals:**
- Reduce sync time to < 2 seconds
- Implement retry logic for failed syncs
- Add offline queue for network issues
- Compress images before upload

---

## ✅ Final Verification (Before Production)

**Before marking as production-ready, verify:**

1. [ ] **All data types sync correctly**
2. [ ] **No duplicates created**
3. [ ] **Sync happens automatically (no manual trigger needed)**
4. [ ] **Web portal updates in real-time**
5. [ ] **GPS entries show correctly**
6. [ ] **Per Diem receipts don't duplicate**
7. [ ] **Cost centers sync both ways**
8. [ ] **Multiple employees can sync simultaneously**
9. [ ] **Offline mode queues changes**
10. [ ] **All entries have valid employee IDs**

---

**Last Updated:** October 17, 2024  
**Status:** 🔄 In Progress  
**Next Review:** After test drive

