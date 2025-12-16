# Startup Guide - Fresh Start

## ✅ All Services Shut Down
Everything has been cleanly shut down and is ready for a fresh start in the morning.

---

## 🚀 Morning Startup Sequence

### Step 1: Start Backend Server
```powershell
cd c:\Users\GooseWeisz\oxford-mileage-tracker\admin-web\backend
npm start
```
**Expected Output:**
- ✅ Connected to the SQLite database
- ✅ All tables ensured to exist
- 🧹 Cleaning up duplicate entries
- 🌐 Server running on http://localhost:3002

**Wait for:** "Server running" message before proceeding

---

### Step 2: Start Web Portal Frontend
Open a **new terminal** window:
```powershell
cd c:\Users\GooseWeisz\oxford-mileage-tracker\admin-web
npm start
```
**Expected Output:**
- Compiled successfully
- Running on http://localhost:3000

**Wait for:** "Compiled successfully" before opening browser

---

### Step 3: Start Mobile App
Open a **new terminal** window:
```powershell
cd c:\Users\GooseWeisz\oxford-mileage-tracker
npx expo start
```
**Expected Output:**
- Metro bundler starts
- QR code displays
- Options for running on iOS/Android/web

**Action:** Scan QR code with Expo Go app on your phone

---

## 📋 Post-Startup Checklist

### Backend Health Check:
- [ ] Visit http://localhost:3002/api/employees
- [ ] Should return employee list (may be empty if fresh)
- [ ] No error messages in terminal

### Web Portal Health Check:
- [ ] Visit http://localhost:3000
- [ ] Should load without errors
- [ ] Check browser console for any errors
- [ ] Try logging in with an employee

### Mobile App Health Check:
- [ ] App loads on phone
- [ ] Can navigate between screens
- [ ] No red error screens

---

## 🧹 Remaining Cleanup Task

**Before testing with real data:**
1. Open mobile app
2. Go to Daily Description screen
3. Manually delete any remaining "(off)" text
4. Save each entry
5. Then test web portal save/refresh - "(off)" should stay gone!

---

## 🎯 What's Clean Now

✅ **All demo data removed** from codebase
✅ **All "(off)" hardcoded text removed** from code
✅ **Backend database** is fresh/clean
✅ **Web portal** loads only real data
✅ **Mobile app cleanup** is working (manual deletion)

---

## 🔧 Troubleshooting

### Port 3002 Already in Use:
```powershell
# Kill all Node processes
taskkill /F /IM node.exe

# Wait 5 seconds, then restart backend
npm start
```

### Port 3000 Already in Use:
```powershell
# Kill all Node processes
taskkill /F /IM node.exe

# Wait 5 seconds, then restart web portal
npm start
```

### Mobile App Won't Connect:
1. Make sure backend is running (http://localhost:3002)
2. Check that phone and computer are on same WiFi
3. Update IP address in mobile app if needed
4. Restart Expo: Press `r` in terminal

---

## 📝 Notes for Tomorrow

- Backend cleaned up duplicates (15 mileage entries, 25 time tracking entries remaining)
- These are likely real entries, not demo data
- Continue manual "(off)" cleanup in mobile app
- Once clean, test full workflow: mobile app → backend → web portal → save → refresh

---

## 🎉 Ready to Go!

Everything is shut down cleanly and ready for a fresh start. Just follow the startup sequence above and you'll be up and running in a few minutes!

