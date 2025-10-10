# Fix Cost Centers - Action Required NOW

**Status:** 🚨 **URGENT - Quick Fix Needed Before Test Drive**

---

## The Problem

1. All 252 employees have **empty `selectedCostCenters`** arrays
2. Goose Weisz shows random cost centers on mobile app
3. Mobile app loads from local database (stale data)

---

## Root Cause

The bulk employee import correctly parsed cost centers, but the **backend's bulk-create endpoint** wasn't saving `selectedCostCenters` and `defaultCostCenter` fields.

**I just fixed the backend**, but all existing employees still have empty arrays.

---

## Quick Fix (2 Steps - Takes 2 Minutes)

### Step 1: Set Goose's Cost Centers (Web Portal)

1. **Open web portal** (http://localhost:3000 or wherever it's running)
2. Login as admin (Greg Weisz)
3. Go to **Admin Portal** → **Employee Management**
4. **Search** for "Goose Weisz"
5. **Click on "Goose Weisz"** (the name - it's a link)
6. Profile dialog opens
7. **Click "Edit"** button (top right)
8. Scroll down to **Cost Centers** section
9. **Check the boxes** for cost centers you want:
   - ☑ Program Services
   - ☑ G&A
   - ☑ Fundraising
   - ☑ (Add more if needed)
10. **Click the star ⭐** next to one to make it default (e.g., Program Services)
11. **Click "Save"**

### Step 2: Refresh Mobile App Data

1. **Open mobile app**
2. Go to Settings or Profile
3. **Logout**
4. **Login again**: greg.weisz@oxfordhouse.org / Goosewelcome1
5. Done! Cost centers will now be correct

---

## Why This Works

When you login on mobile:
1. Mobile app authenticates with backend
2. Gets fresh employee data (including cost centers)
3. Deletes old local employee record
4. Creates new record with backend data
5. Now has correct `selectedCostCenters` and `defaultCostCenter`

---

## Alternative: I Can Do It For You

If you prefer, just **refresh the web portal** and the employee profile/edit feature I just added will let you easily set the cost centers through the UI with a nice visual interface.

---

## Long-Term Fix (After Test Drive)

You'll want to re-import all 252 employees with the corrected bulk-create endpoint so everyone has proper cost centers:

1. Delete all employees (Mass Operations → Select All → Bulk Delete)
2. Re-import the CSV (now the backend will properly save all fields)
3. All 252 employees will have correct cost centers

**OR:**

Update each employee's cost centers through the web portal as needed (using the search and edit features).

---

## What I Fixed

✅ Backend PUT endpoint - Now saves `selectedCostCenters` and `defaultCostCenter`  
✅ Backend bulk-create endpoint - Now saves `selectedCostCenters` and `defaultCostCenter`  
✅ Backend restarted - Changes are live

**Just need to update Goose's record in web portal and re-login on mobile!**

---

**Do this now (takes 2 minutes), then your test drive will work perfectly!** 🚗

