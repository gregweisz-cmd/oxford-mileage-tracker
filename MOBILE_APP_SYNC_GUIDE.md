# Mobile App GPS Tracking - Sync Status & Troubleshooting

## ✅ Current Status

### Database Status
- **Employee ID**: `greg-weisz-001` 
- **Employee Name**: Greg Weisz
- **Email**: greg.weisz@oxfordhouse.org
- **Current Employee Set**: ✅ YES (as of Oct 15, 2025 7:38 PM)

### GPS Tracked Entries in Database

**October 2025** (3 entries):
1. **Oct 15** - 15.2 mi | 230 Wagner St, Troutman → 542 Main Ave SE Hickory, NC
2. **Oct 15** - 45.8 mi | 542 Main Ave SE Hickory, NC → 23 Deer Run Dr Asheville, NC
3. **Oct 3** - 47.7 mi | Home Base → Wagner St Troutman, NC 28166

**June 2024** (5 entries):
- Multiple GPS tracked entries assigned to Greg Weisz

### API Verification
✅ API endpoint returns GPS entries correctly:
```
GET http://localhost:3002/api/mileage-entries?employeeId=greg-weisz-001&month=10&year=2025
```
Returns 3 GPS tracked entries.

---

## 🔧 Fixes Applied

### 1. Employee ID Mapping (Completed)
Fixed invalid employee IDs in GPS tracked entries:
- `emp1` → `greg-weisz-001` ✅
- `emp2` → `mgi4f64mhb9xyk2ahes` (Jackson Longan) ✅
- `mgb89ph1f4ilwxwkan` → `greg-weisz-001` ✅

### 2. Current Employee Session (Completed)
Set Greg Weisz as current employee in mobile app database:
- Employee ID: `greg-weisz-001` ✅
- Last Login: Set ✅

---

## 📱 For Mobile App Users

### To Ensure GPS Entries Sync Correctly:

1. **Restart the Mobile App**
   - Completely close the app (swipe away from app switcher)
   - Reopen the app
   - The app should now use employee ID: `greg-weisz-001`

2. **Verify Your Login**
   - Check that you're logged in as "Greg Weisz"
   - Any new GPS tracked drives will use the correct employee ID

3. **Test a New Entry**
   - Create a new GPS tracked drive
   - It should automatically sync with employee ID `greg-weisz-001`

---

## 🌐 For Web Portal Users

### To View GPS Entries:

1. **Clear Browser Cache**
   - Press `Ctrl+Shift+Delete` (Windows) or `Cmd+Shift+Delete` (Mac)
   - Clear cached images and files
   - OR do a hard refresh: `Ctrl+F5` or `Cmd+Shift+R`

2. **Log In to Web Portal**
   - Go to http://localhost:3000
   - Log in as: `greg.weisz@oxfordhouse.org`

3. **Navigate to Staff Portal**
   - Select **October 2025** as the report month
   - GPS entries should appear in:
     - ✅ Daily Entries section
     - ✅ Mileage tab
     - ✅ Recent Activities

4. **Check Filter Settings**
   - Make sure no date filters are excluding Oct 3-15
   - Check that "GPS Tracked" filter isn't turned off
   - Verify you're viewing the correct month (October 2025)

---

## 🔍 Troubleshooting

### Issue: GPS Entries Not Showing in Web Portal

**Possible Causes:**

1. **Viewing Wrong Month**
   - Solution: Make sure you're viewing October 2025, not the current month if different

2. **Browser Cache**
   - Solution: Hard refresh the page (Ctrl+F5 or Cmd+Shift+R)
   - Or clear browser cache completely

3. **Date Filtering**
   - Solution: Check if date filters in the report are set
   - Remove any date range filters that might exclude the GPS entries

4. **Wrong Employee**
   - Solution: Make sure you're logged in as Greg Weisz or Jackson Longan
   - These are the only two employees with GPS tracked entries in October 2025

### Issue: New Mobile App Entries Have Wrong Employee ID

**Solution:**
1. Restart the mobile app completely
2. The `current_employee` table now has the correct ID set
3. New entries should use `greg-weisz-001`

### Issue: Database Shows Different Employee ID

**Check:**
```sql
SELECT * FROM current_employee;
```

Should show:
- employeeId: `greg-weisz-001`
- lastLogin: Recent timestamp

---

## 🛠️ Developer Notes

### Database Structure
- **Main DB**: `oxford_tracker.db` (shared between mobile and web)
- **Employee ID Format**: Random alphanumeric string OR predefined (e.g., `greg-weisz-001`)
- **GPS Flag**: `isGpsTracked` (INTEGER: 0=manual, 1=GPS)

### Key Tables
- `employees` - Employee master data
- `mileage_entries` - All mileage entries (manual + GPS)
- `current_employee` - Stores currently logged-in employee for mobile app

### API Endpoints
- `GET /api/mileage-entries?employeeId={id}&month={m}&year={y}` - Get mileage entries
- `POST /api/employee-login` - Employee login

### Sync Flow
1. Mobile app creates entry in local SQLite DB
2. Entry uses `current_employee.employeeId` as the `employeeId` field
3. Entry syncs to shared `oxford_tracker.db`
4. Web portal reads from same DB via backend API
5. WebSocket notifies web portal of changes

---

## 📊 Data Verification Commands

Run these from the backend directory:

```bash
# Check Greg Weisz's entries
node check-greg-weisz.js

# Verify current employee
SELECT * FROM current_employee;

# Check recent GPS entries
SELECT * FROM mileage_entries WHERE isGpsTracked = 1 ORDER BY date DESC LIMIT 10;
```

---

## 📝 Summary

✅ **All GPS entries are now correctly assigned to valid employee IDs**
✅ **Greg Weisz is set as current employee in mobile app database**
✅ **API endpoints return GPS entries correctly**
✅ **3 GPS tracked entries available for October 2025**

**Next Steps:**
1. Restart mobile app
2. Clear web browser cache
3. Verify GPS entries appear in web portal for October 2025
4. Test creating a new GPS tracked drive

---

*Last Updated: October 15, 2025*

