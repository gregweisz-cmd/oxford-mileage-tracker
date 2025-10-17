# Oxford House Expense Tracker - Testing Checklist

## 🧪 **Comprehensive Testing Guide**

Use this checklist to systematically test all new features and improvements.

---

## 1️⃣ **Per Diem Rules System**

### **Setup (Web Portal)**
- [ ] Navigate to Admin Portal → Cost Center Management → Per Diem Rules tab
- [ ] Create a test rule:
  - Cost Center: "Program Services"
  - Max Amount: $25
  - Min Hours: 8
  - Min Miles: 100
  - Min Distance from Base: 50
  - **Use Actual Amount: CHECKED** ✓
- [ ] Save rule and verify it appears in the list
- [ ] Edit rule and change max amount to $30
- [ ] Verify changes saved

### **Testing Fixed Amount Rule**
- [ ] Create another rule:
  - Cost Center: "Finance"
  - Max Amount: $35
  - Min Hours: 0
  - Min Miles: 0
  - Min Distance from Base: 0
  - **Use Actual Amount: UNCHECKED** ✗
- [ ] Save and verify

### **Mobile App Testing**
- [ ] Login to mobile app
- [ ] Navigate to Add Receipt
- [ ] Select category: "Per Diem"
- [ ] **Expected**: Amount should auto-fill based on your cost center
  - If "Program Services": Amount field should be EMPTY (actual amount mode)
  - If "Finance": Amount should auto-fill "$35" (fixed amount mode)

### **Actual Amount Rule Test**
- [ ] Select cost center with actual amount rule
- [ ] Enter amount: $20 (under max)
- [ ] Save receipt
- [ ] **Expected**: Success with confirmation dialog
- [ ] Try entering $40 (over max of $25)
- [ ] **Expected**: Error - "Amount exceeds maximum"

### **Fixed Amount Rule Test**
- [ ] Select cost center with fixed amount rule  
- [ ] **Expected**: Amount auto-fills with max amount
- [ ] Toggle can turn off auto-fill
- [ ] Manually change amount
- [ ] **Expected**: Warning if over max, but can proceed

---

## 2️⃣ **Cost Center Auto-Selection**

### **Setup**
- [ ] Add 3-5 receipts with "Per Diem" category using "Program Services" cost center
- [ ] Add 3-5 receipts with "Office Supplies" category using "Finance" cost center

### **Testing Category-Based Selection**
- [ ] Navigate to Add Receipt
- [ ] Select category: "Per Diem"
- [ ] **Expected**: Cost center auto-selects to "Program Services" (most used for Per Diem)
- [ ] Change category to "Office Supplies"
- [ ] **Expected**: Cost center auto-selects to "Finance" (most used for Office Supplies)

### **Testing Screen Memory**
- [ ] Add a receipt with cost center "CORPORATE"
- [ ] Go back to home screen
- [ ] Navigate to Add Receipt again
- [ ] **Expected**: Cost center defaults to "CORPORATE" (last used on this screen)

### **Testing Mileage Auto-Selection**
- [ ] Add a mileage entry to "Oxford House Charlotte" with "AL / HI / LA" cost center
- [ ] Add another entry to "Oxford House Charlotte"
- [ ] **Expected**: Cost center suggests "AL / HI / LA" (same destination)

---

## 3️⃣ **GPS Tracking**

### **Test Global Stop Button**
- [ ] Navigate to GPS Tracking screen
- [ ] Enter purpose: "House Visit"
- [ ] Enter starting odometer
- [ ] Select start location
- [ ] Start GPS tracking
- [ ] Navigate away from GPS screen (go to Home)
- [ ] **Expected**: Red "Stop Tracking" button visible in top-right
- [ ] Tap the global stop button
- [ ] **Expected**: Alert asks "Are you sure? You'll be asked for destination"
- [ ] Confirm
- [ ] **Expected**: End Location Modal appears
- [ ] Enter destination name and address
- [ ] Confirm
- [ ] **Expected**: Trip saved with complete location details

### **Test In-Screen Stop Button**
- [ ] Start another GPS tracking session
- [ ] Stay on GPS Tracking screen
- [ ] Tap "Stop Tracking" button on screen
- [ ] **Expected**: Same flow as global button - End Location Modal appears
- [ ] Complete the flow
- [ ] **Expected**: Trip saved successfully

### **Test Stationary Alert**
- [ ] Start GPS tracking
- [ ] Don't move for 5 minutes
- [ ] **Expected**: Alert appears "You've been stationary for 5 minutes"
- [ ] Tap "Stop Tracking" in alert
- [ ] **Expected**: End Location Modal appears
- [ ] Complete the flow

### **Verify No Ending Odometer**
- [ ] During any GPS stop flow
- [ ] **Expected**: End Location Modal does NOT ask for ending odometer
- [ ] **Expected**: Only asks for destination name and address
- [ ] After saving, check the entry
- [ ] **Expected**: Miles = GPS tracked miles

---

## 4️⃣ **Enhanced Dashboard**

### **Test Per Diem Widget**
- [ ] Navigate to Home screen
- [ ] Scroll to Per Diem Widget (below mileage stats)
- [ ] **Expected**: Widget shows:
  - Current month Per Diem total
  - Progress bar (visual %)
  - X claimed / Y eligible days
  - Status badge (if eligible today or approaching limit)

### **Test Warning Colors**
- [ ] With $0-$299 Per Diem:
  - **Expected**: Green color, "Eligible today" or normal status
- [ ] With $300-$349 Per Diem:
  - **Expected**: Orange/yellow color, "$XX remaining" badge
- [ ] With $350+ Per Diem:
  - **Expected**: Red color, "LIMIT REACHED" badge

### **Test Widget Interaction**
- [ ] Tap on Per Diem widget
- [ ] **Expected**: Navigates to Receipts screen

---

## 5️⃣ **Login & Data Persistence**

### **Test Cost Center Persistence**
- [ ] Login to mobile app
- [ ] Navigate to Profile/Settings
- [ ] Update cost centers (add or change default)
- [ ] Logout
- [ ] Login again
- [ ] **Expected**: Cost centers still correct (not reset)

### **Test Sync After Cost Center Change**
- [ ] Change cost center on mobile app
- [ ] Wait 5-10 seconds for auto-sync
- [ ] Open web portal
- [ ] View employee record
- [ ] **Expected**: Cost center change reflected on web portal

---

## 6️⃣ **Web Portal**

### **Test Per Diem Rules Management**
- [ ] Navigate to Cost Center Management → Per Diem Rules tab
- [ ] **Expected**: See all created rules
- [ ] Create a new rule for a different cost center
- [ ] Delete a test rule
- [ ] **Expected**: Rules update in list

### **Test Staff Portal Report**
- [ ] Navigate to Staff Portal
- [ ] Select employee with Per Diem receipts
- [ ] Select current month
- [ ] **Expected**: Per Diem column shows amounts
- [ ] **Expected**: Per Diem receipts visible in Receipt Management tab

### **Test Supervisor Management**
- [ ] Navigate to Admin Portal → Supervisor Management
- [ ] Promote someone to supervisor
- [ ] Assign staff to supervisor
- [ ] **Expected**: Changes save and persist

---

## 7️⃣ **Data Quality**

### **Test Duplicate Prevention**
- [ ] Add a receipt: $25, "Test Vendor", today's date
- [ ] Try adding the exact same receipt again
- [ ] **Expected**: Warning about duplicate
- [ ] Option to "Add Anyway" or "Cancel"

### **Test Validation**
- [ ] Try adding receipt with no amount
  - **Expected**: Validation error
- [ ] Try adding receipt with no category
  - **Expected**: Validation error
- [ ] Try adding Per Diem over max
  - **Expected**: Rejection with clear message

---

## 8️⃣ **Sync Functionality**

### **Test Auto-Sync**
- [ ] Add receipt on mobile app
- [ ] Wait 5 seconds (auto-sync interval)
- [ ] Check backend terminal logs
- [ ] **Expected**: See "Successfully synced 1 receipt operations"
- [ ] Open web portal
- [ ] **Expected**: Receipt visible

### **Test Manual Sync**
- [ ] On mobile home screen, tap "Sync to Backend"
- [ ] **Expected**: Spinner shows while syncing
- [ ] **Expected**: "Last synced: [time]" updates
- [ ] **Expected**: Success message

---

## 🔧 **Edge Cases**

### **Test Offline Mode**
- [ ] Turn off WiFi and cellular data
- [ ] Add several entries/receipts
- [ ] **Expected**: Entries save locally
- [ ] Turn on connectivity
- [ ] Tap "Sync to Backend"
- [ ] **Expected**: All entries sync successfully

### **Test No Per Diem Rule**
- [ ] Select a cost center with NO Per Diem rule
- [ ] Add Per Diem receipt
- [ ] **Expected**: Defaults to $35 (system default)

### **Test Empty Cost Centers**
- [ ] Create test employee with no cost centers
- [ ] Login as that employee
- [ ] Add any entry
- [ ] **Expected**: Defaults to "Program Services"

---

## ✅ **Success Criteria**

### **All Tests Pass If:**
- ✅ Per Diem rules enforce correctly
- ✅ Cost centers auto-select intelligently
- ✅ GPS tracking captures destinations consistently
- ✅ Dashboard shows accurate Per Diem status
- ✅ Data persists across login/logout
- ✅ Sync works reliably
- ✅ No duplicate receipts generated automatically
- ✅ Validation prevents bad data
- ✅ Error messages are clear and helpful

---

## 🐛 **If Issues Found**

### **Report Format:**
```
Feature: [Feature name]
Test: [What you were testing]
Expected: [What should happen]
Actual: [What actually happened]
Steps to Reproduce:
1. [Step 1]
2. [Step 2]
3. [Step 3]

Screenshots/Logs: [If available]
```

### **Common Troubleshooting**

**Icons showing as "?":**
- Clear app cache
- Restart Expo with `expo start --clear`
- Reinstall Expo Go app on device

**Cost centers not syncing:**
- Check backend logs for sync operations
- Verify employee update queued
- Manual sync from mobile app

**Per Diem rules not applying:**
- Verify rule exists for employee's cost center
- Check mobile app synced Per Diem rules
- Clear cache and re-sync

---

## 📊 **Testing Log Template**

```
Date: _______________
Tester: _______________
Version: 1.0.0

| Feature | Test Case | Pass/Fail | Notes |
|---------|-----------|-----------|-------|
| Per Diem Rules | Fixed amount auto-fill | | |
| Per Diem Rules | Actual amount validation | | |
| Per Diem Rules | Max amount enforcement | | |
| Cost Center | Auto-selection by category | | |
| Cost Center | Persistence after login | | |
| GPS Tracking | Global stop button | | |
| GPS Tracking | Destination capture | | |
| Dashboard | Per Diem widget display | | |
| Dashboard | Warning indicators | | |
| Sync | Mobile to backend | | |
| Sync | Cost center updates | | |

Overall Status: ________
Issues Found: ________
Recommendations: ________
```

---

**Happy Testing! 🎉**

All new features are ready for comprehensive testing. Take your time going through each test case and document any issues found.

