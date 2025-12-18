# Testing Guide - New Features

## Prerequisites

1. **Backend Server**: Running on http://localhost:3002
2. **Frontend Server**: Running on http://localhost:3000
3. **Test Account**: You'll need a staff account to test Summary Sheet editing

---

## Test 1: Summary Sheet Editing

### Steps:
1. **Login to Staff Portal**
   - Navigate to http://localhost:3000
   - Login with a staff account
   - Navigate to Staff Portal

2. **Navigate to Summary Sheet Tab**
   - Click on the "Summary Sheet" tab (should be tab index 1)
   - Verify the Summary Sheet table is displayed

3. **Test Edit Functionality**
   - Look for edit icons (pencil/edit buttons) next to each expense category:
     - Mileage
     - Air / Rail / Bus
     - Vehicle Rental / Fuel
     - Parking / Tolls
     - Ground Transportation
     - Lodging
     - Per Diem
     - Phone / Internet / Fax
     - Shipping / Postage
     - Printing / Copying
     - Office Supplies
     - Oxford House E.E.S.
     - Meals
     - Other Expenses

4. **Test Edit Modal**
   - Click any edit button
   - Verify modal dialog opens with:
     - Title: "Edit [Category Name]"
     - Text field for amount
     - Helper text about entering amount
     - Info alert explaining the change
     - Cancel and Save buttons

5. **Test Validation**
   - Try entering a negative number (e.g., -100)
   - Click Save
   - Verify alert appears: "Amount cannot be negative"
   - Verify value is not saved

6. **Test Saving**
   - Enter a valid positive number (e.g., 125.50)
   - Click Save
   - Verify loading indicator appears
   - Verify modal closes
   - Verify the amount updates in the Summary Sheet table
   - Verify the change persists after page refresh

7. **Test Backend API**
   - Open browser DevTools → Network tab
   - Edit a value and save
   - Look for PUT request to: `/api/expense-reports/:employeeId/:month/:year/summary`
   - Verify request payload contains the updated field
   - Verify response is successful (200 status)

### Expected Results:
- ✅ All expense categories have edit buttons
- ✅ Modal opens correctly with current value
- ✅ Negative numbers are rejected
- ✅ Valid values are saved and persist
- ✅ Backend API is called correctly

---

## Test 2: Contracts Portal

### Steps:
1. **Access Contracts Portal**
   - Login as admin or contracts user
   - Use Portal Switcher to select "Contracts Portal"
   - Verify Contracts Portal loads

2. **Verify Review-Only Functionality**
   - Navigate to a submitted expense report
   - Verify NO approval buttons are visible
   - Verify NO "Request Revision" buttons are visible
   - Verify report data is displayed (read-only)

3. **Test Per Diem Rules Tab**
   - Click on "Per Diem Rules" tab
   - Verify Per Diem Rules management interface loads
   - Test creating a new rule
   - Test editing an existing rule
   - Test deleting a rule

4. **Compare with Finance Portal**
   - Switch to Finance Portal
   - Navigate to same report
   - Verify Finance Portal HAS approval buttons
   - Switch back to Contracts Portal
   - Verify Contracts Portal does NOT have approval buttons

### Expected Results:
- ✅ Contracts Portal accessible via Portal Switcher
- ✅ No approval/revision buttons in Contracts Portal
- ✅ Per Diem Rules management works
- ✅ Data display matches Finance Portal (read-only)

---

## Test 3: 50+ Hours Alerts

### Steps:
1. **Create Test Time Entry**
   - Login as a staff member
   - Navigate to Time Tracking section
   - Create a time entry that totals 50+ hours in a week
   - Save the entry

2. **Verify Alert Creation**
   - Check backend logs for notification creation
   - Verify notification is created with type: '50_plus_hours_alert'
   - Verify notification is persistent (not dismissible)

3. **Check Supervisor Dashboard**
   - Login as supervisor
   - Navigate to Supervisor Dashboard
   - Look for "50+ Hours Alerts" section
   - Verify employee with 50+ hours is listed
   - Verify alert details are displayed correctly

4. **Test Notification Persistence**
   - Refresh supervisor dashboard
   - Verify alert still appears
   - Verify alert cannot be dismissed (if implemented)

### Expected Results:
- ✅ Alert created when employee logs 50+ hours
- ✅ Alert appears on Supervisor Dashboard
- ✅ Alert persists across page refreshes
- ✅ Alert shows correct employee information

---

## Test 4: Persistent Mileage Notification (Mobile App)

### Steps:
1. **Start GPS Tracking**
   - Open mobile app
   - Start GPS tracking for a trip
   - Stay stationary for 5+ minutes

2. **Verify Modal Appears**
   - After 5 minutes, verify persistent modal appears
   - Verify modal shows:
     - Stationary duration (updating in real-time)
     - "Keep Tracking" button
     - "Stop Tracking" button

3. **Test Modal Persistence**
   - Verify modal stays visible (doesn't auto-dismiss)
   - Verify minute count updates in real-time
   - Try moving (if possible) and verify modal dismisses

4. **Test Actions**
   - Click "Keep Tracking" - verify tracking continues
   - Click "Stop Tracking" - verify tracking stops and modal closes

### Expected Results:
- ✅ Modal appears after 5 minutes of being stationary
- ✅ Modal shows real-time duration updates
- ✅ Modal persists until user action
- ✅ Both action buttons work correctly

---

## API Testing (Optional - Using curl or Postman)

### Test Summary Sheet Update Endpoint

```bash
# Replace :employeeId, :month, :year with actual values
PUT http://localhost:3002/api/expense-reports/:employeeId/:month/:year/summary
Content-Type: application/json

{
  "totalMileageAmount": 150.00,
  "perDiem": 200.00
}
```

**Expected Response**: 200 OK with updated report data

---

## Issues to Report

When testing, note any:
- Errors in browser console
- Errors in backend logs
- UI/UX issues
- Validation problems
- Data persistence issues
- Performance issues

---

## Test Checklist

- [ ] Summary Sheet Editing - All categories editable
- [ ] Summary Sheet Editing - Validation works
- [ ] Summary Sheet Editing - Changes persist
- [ ] Contracts Portal - Accessible and functional
- [ ] Contracts Portal - No approval buttons
- [ ] Contracts Portal - Per Diem Rules works
- [ ] 50+ Hours Alerts - Alert creation
- [ ] 50+ Hours Alerts - Supervisor dashboard display
- [ ] Persistent Mileage Notification - Modal appears
- [ ] Persistent Mileage Notification - Real-time updates
- [ ] Persistent Mileage Notification - Actions work

---

**Status**: Ready for testing

