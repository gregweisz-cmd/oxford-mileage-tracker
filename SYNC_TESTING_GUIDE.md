# 🔄 Sync Testing Guide

## 📋 Pre-Test Checklist

### Backend Server Status
- [ ] Backend server running on `http://localhost:3001`
- [ ] Database initialized with test data
- [ ] All API endpoints responding correctly
- [ ] CORS configured for mobile app

### Mobile App Status
- [ ] Mobile app running (`expo start`)
- [ ] Employee logged in and authenticated
- [ ] Local SQLite database accessible
- [ ] Network connectivity available

### Web Portal Status
- [ ] Web portal running on `http://localhost:3000`
- [ ] Admin can access staff portal
- [ ] Employee data loads correctly

## 🧪 Test Suite 1: Basic Data Sync

### Test 1.1: Mileage Entry Sync
**Objective:** Verify mileage entries sync from mobile to backend

**Steps:**
1. Open mobile app
2. Navigate to "Add Mileage Entry"
3. Create a test entry:
   - Date: Today
   - Start Location: "Test Start"
   - End Location: "Test End"
   - Miles: 5.5
   - Purpose: "Test Sync"
4. Save the entry
5. Check backend logs for API call
6. Verify entry appears in web portal

**Expected Results:**
- ✅ Entry saved locally in mobile app
- ✅ API call made to `POST /api/mileage-entries`
- ✅ Entry visible in web portal
- ✅ No duplicate entries created

### Test 1.2: Receipt Sync
**Objective:** Verify receipt data syncs correctly

**Steps:**
1. Open mobile app
2. Navigate to "Add Receipt"
3. Create a test receipt:
   - Date: Today
   - Amount: 25.50
   - Vendor: "Test Vendor"
   - Category: "Meals"
4. Save the receipt
5. Check backend logs
6. Verify receipt appears in web portal

**Expected Results:**
- ✅ Receipt saved locally
- ✅ API call made to `POST /api/receipts`
- ✅ Receipt visible in web portal

### Test 1.3: Time Tracking Sync
**Objective:** Verify time tracking entries sync

**Steps:**
1. Open mobile app
2. Navigate to "Time Tracking"
3. Add time entry:
   - Date: Today
   - Category: "G&A Hours"
   - Hours: 8.0
   - Description: "Test sync"
4. Save the entry
5. Check backend logs
6. Verify entry appears in web portal

**Expected Results:**
- ✅ Time entry saved locally
- ✅ API call made to `POST /api/time-tracking`
- ✅ Entry visible in web portal

## 🧪 Test Suite 2: Auto-Sync Functionality

### Test 2.1: Background Sync
**Objective:** Test automatic sync when app comes to foreground

**Steps:**
1. Create entries in mobile app while offline
2. Put app in background
3. Connect to network
4. Bring app to foreground
5. Wait for sync to complete
6. Check web portal for entries

**Expected Results:**
- ✅ Sync queue processes automatically
- ✅ All offline entries sync to backend
- ✅ No data loss during sync

### Test 2.2: Conflict Resolution
**Objective:** Test handling of sync conflicts

**Steps:**
1. Create entry in mobile app
2. Edit same entry in web portal
3. Sync mobile app
4. Check for conflict resolution

**Expected Results:**
- ✅ Conflict detected and resolved
- ✅ No duplicate entries
- ✅ Most recent data preserved

## 🔧 Test Tools & Commands

### Backend Testing
```bash
# Check server status
curl http://localhost:3001/api/health

# Test API endpoints
curl -X POST http://localhost:3001/api/mileage-entries \
  -H "Content-Type: application/json" \
  -d '{"employeeId":"test","date":"2024-01-01","startLocation":"A","endLocation":"B","miles":5,"purpose":"test"}'
```

### Mobile App Testing
```bash
# Check app logs
npx expo logs

# Test sync manually
# (Use app's sync button)
```

## 📊 Success Criteria

### Sync Reliability
- ✅ 99%+ sync success rate
- ✅ <5 second average sync time
- ✅ Zero data loss during sync
- ✅ Graceful error handling

### User Experience
- ✅ Intuitive sync indicators
- ✅ Clear error messages
- ✅ Offline functionality preserved
- ✅ Seamless background sync

## 🚨 Troubleshooting Guide

### Common Issues

**Sync Not Working:**
1. Check network connectivity
2. Verify backend server is running
3. Check API endpoint URLs
4. Review error logs

**Data Not Appearing:**
1. Check database connection
2. Verify API responses
3. Check data validation
4. Review sync queue

This comprehensive test suite ensures your sync functionality is robust and ready for production use! 🚀