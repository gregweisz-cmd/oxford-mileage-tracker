# 🧹 Clean Per Diem Receipts from Mobile Device

## The Problem

Those 2 Per Diem test receipts ($35 + $25) are in your **phone's database**, not the backend!

Every time the app loads:
1. Mobile app has the 2 receipts locally
2. Auto-sync uploads them to backend
3. You delete them from the UI
4. App reloads → They're still in local database
5. Auto-sync uploads them again
6. **Infinite loop!**

---

## ✅ Solution

### **Option 1: Delete from Mobile App (Easiest)**

1. **Open the Receipts screen**
2. **Find the 2 Per Diem test receipts:**
   - "Testing per diem rules - $35"
   - "Testing per diem rules - $25"
3. **Long-press or select them**
4. **Delete them**
5. **IMPORTANT:** They're being deleted from UI but might not delete from database

Let me add a proper delete function...

---

### **Option 2: Clear App Data (Nuclear Option)**

**iOS:**
1. Go to Settings → General → iPhone Storage
2. Find "Expo Go" (or your app)
3. Delete App
4. Reinstall from App Store
5. Log back in

**Android:**
1. Settings → Apps → Expo Go
2. Storage → Clear Data
3. Reopen app
4. Log back in

**Warning:** This clears ALL local data! You'll need to sync everything fresh from backend.

---

### **Option 3: SQL Delete Script (What We Need)**

Since the receipts screen delete might not be working, let me create a proper delete handler.

---

## 🔍 Root Cause

The receipts were created with these IDs:
- `mgv0uu4iyptzgzx9h4l` (Oct 17, $35)
- (Another ID for Oct 16, $25)

They exist in the mobile SQLite database at:
```
/var/mobile/Containers/Data/Application/[UUID]/Library/Application Support/SQLite/oxford_tracker.db
```

Every app reload, they sync to backend because they're still in local DB.

---

## 🛠️ Proper Fix

I need to ensure the delete function in ReceiptsScreen actually deletes from the database AND stops them from syncing.

