# Quick Testing Guide - New Features

## 🎯 **Priority 1: Approval Workflow (Mobile)**

### **Test Submit Button**
1. Open mobile app
2. Navigate to **Reports** screen
3. Look for green **"Submit for Approval"** button at top
4. Click button
5. **Expected**: Dialog shows:
   - Current month/year
   - Total miles
   - Total expenses
   - Warning about editing
6. Click **"Submit"**
7. **Expected**: 
   - Success message
   - Button changes to status card
   - Badge shows "SUBMITTED"

### **Test Status Display**
1. After submission, stay on Reports screen
2. **Expected**: See card at top showing:
   - Month/year
   - "SUBMITTED" badge (blue)
   - Submit button is gone
3. Try clicking submit again
4. **Expected**: Shows "Already Submitted" alert

### **Test Rejection Flow** *(Requires supervisor access)*
1. Have supervisor reject your report with comments
2. Return to Reports screen
3. **Expected**:
   - Status shows "REJECTED" (red)
   - Rejection reason displays
   - Submit button reappears

---

## 🎯 **Priority 2: Per Diem Widget**

### **Test Dashboard Widget**
1. Navigate to **Home** screen
2. Scroll to Per Diem section
3. **Expected**: See card with:
   - Current month Per Diem total
   - Progress bar showing % of $350
   - Green/orange/red color based on amount
   - Days claimed vs eligible
   - Status badge if eligible today

### **Test Widget Interactions**
1. Tap on Per Diem widget
2. **Expected**: Navigate to Receipts screen

### **Test Warning Colors**
1. Add Per Diem receipts:
   - $0-$299: Widget should be **green**
   - $300-$349: Widget should be **orange** with "$XX left" message
   - $350+: Widget should be **red** with "LIMIT REACHED"

---

## 🎯 **Priority 3: Backend API**

### **Test Monthly Reports Endpoints**

#### **Create Report**
```bash
curl -X POST http://localhost:3002/api/monthly-reports \
  -H "Content-Type: application/json" \
  -d '{
    "employeeId": "YOUR_EMPLOYEE_ID",
    "month": 10,
    "year": 2024,
    "totalMiles": 150.5,
    "totalExpenses": 85.00,
    "status": "draft"
  }'
```

#### **Submit Report**
```bash
curl -X POST http://localhost:3002/api/monthly-reports/REPORT_ID/submit \
  -H "Content-Type: application/json" \
  -d '{
    "submittedBy": "YOUR_EMPLOYEE_ID"
  }'
```

#### **Get Employee Report**
```bash
curl http://localhost:3002/api/monthly-reports/employee/EMPLOYEE_ID/2024/10
```

---

## 🚫 **Common Issues & Solutions**

### **Issue: Submit button not showing**
**Solution**: 
- Check if report already submitted (status card showing?)
- Ensure you have entries/receipts for current month
- Verify you're logged in

### **Issue: "stopTracking" error on app start**
**Solution**:
- Run: `cd c:\Users\GooseWeisz\oxford-mileage-tracker && npx expo start --clear`
- Wait for Metro to rebuild
- Reload app

### **Issue: Per Diem widget not showing**
**Solution**:
- Add some Per Diem receipts first
- Refresh Home screen
- Check if `perDiemStats` is loading

### **Issue: API 404 errors**
**Solution**:
- Verify backend is running on port 3002
- Check API_BASE_URL in mobile app
- Restart backend server

---

## ✅ **Success Criteria**

### **Mobile App Submit**
- [ ] Button visible on Reports screen
- [ ] Confirmation dialog shows correct data
- [ ] Success message appears
- [ ] Status updates immediately
- [ ] Can't submit twice

### **Per Diem Widget**
- [ ] Widget displays on Home screen
- [ ] Progress bar shows correct percentage
- [ ] Colors change at thresholds
- [ ] Days count is accurate
- [ ] Tapping navigates to Receipts

### **Backend API**
- [ ] Can create monthly report
- [ ] Can submit for approval
- [ ] Can fetch report by employee/month
- [ ] WebSocket broadcasts work
- [ ] Database records created correctly

---

## 📞 **Quick Command Reference**

### **Start Expo (Clear Cache)**
```bash
cd c:\Users\GooseWeisz\oxford-mileage-tracker
npx expo start --clear
```

### **Start Backend**
```bash
cd c:\Users\GooseWeisz\oxford-mileage-tracker\admin-web\backend
npm start
```

### **Check Database (Backend)**
```bash
cd c:\Users\GooseWeisz\oxford-mileage-tracker\admin-web\backend
sqlite3 oxford-mileage.db "SELECT * FROM monthly_reports;"
```

### **View Logs**
```bash
# Mobile app - Check Metro bundler terminal
# Backend - Check backend terminal output
```

---

## 🎉 **Quick Win Tests** (5 minutes)

1. **Submit Flow**: Open app → Reports → Click Submit → Confirm → See status
2. **Per Diem Widget**: Open app → Home → See widget with data
3. **API Test**: curl create report → curl submit → curl get report

---

*Use this guide for quick verification after code changes or app reloads.*

