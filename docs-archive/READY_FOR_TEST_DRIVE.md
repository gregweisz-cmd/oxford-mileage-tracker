# Ready for Test Drive! 🚗

**Date:** October 7, 2025  
**Status:** ✅ Ready to Test

---

## Good News!

Both GPS Tracking and Manual Mileage Entry screens are **already configured correctly**! No changes needed.

---

## How It Works

### GPS Tracking Screen
- ✅ Only shows employee's **selected cost centers**
- ✅ Defaults to **default cost center** first
- ✅ Falls back to first selected cost center if no default

**Code Location:** `src/screens/GpsTrackingScreen.tsx` line 229-230, 842

### Manual Mileage Entry Screen
- ✅ Only shows employee's **selected cost centers**
- ✅ Defaults to **default cost center** first
- ✅ Falls back to first selected cost center if no default

**Code Location:** `src/screens/MileageEntryScreen.tsx` line 163-164, 985

---

## How to Set Up Before Test Drive

### 1. Ensure Your Employee Has Cost Centers Assigned

**Web Portal:**
1. Go to Admin Portal → Employee Management
2. Search for "Goose Weisz"
3. Click on the name to view profile
4. Click "Edit"
5. Scroll to Cost Centers section
6. Select the cost centers you want (e.g., AL-SOR, G&A, etc.)
7. Mark one as default (click the star)
8. Save

### 2. Login on Mobile App

1. Open the mobile app
2. Login as: `greg.weisz@oxfordhouse.org`
3. Password: `Goosewelcome1`
4. Check "Stay logged in" (optional)
5. Verify: "Welcome, Goose Weisz" appears

---

## Test Drive Checklist

### GPS Tracking Test
- [ ] Open mobile app
- [ ] Tap "Start GPS Tracking"
- [ ] Verify cost center selector shows only YOUR selected cost centers
- [ ] Verify your default cost center is pre-selected
- [ ] Enter starting odometer
- [ ] Enter purpose
- [ ] Start tracking
- [ ] Drive around
- [ ] Stop tracking
- [ ] Select end location
- [ ] Verify miles calculated
- [ ] Save entry

### Manual Entry Test
- [ ] Tap "Manual Entry"
- [ ] Verify cost center selector shows only YOUR selected cost centers
- [ ] Verify your default cost center is pre-selected
- [ ] Enter all fields
- [ ] Save entry

### Verify Data Synced
- [ ] Open web portal
- [ ] Go to Staff Portal
- [ ] Check if your mileage entries appear
- [ ] Verify cost centers are correct

---

## Expected Behavior

### Cost Center Selector
**If you have 1 cost center:**
- Selector won't show (automatically uses that one)

**If you have 2+ cost centers:**
- Selector shows as button chips
- Your default cost center is pre-selected (highlighted blue)
- Tap any chip to change selection
- Only shows YOUR assigned cost centers (not all 50+)

### Example
If Goose Weisz has:
- Selected Cost Centers: `["AL-SOR", "G&A", "Fundraising"]`
- Default Cost Center: `"AL-SOR"`

Then the selector will show:
```
[AL-SOR (selected)] [G&A] [Fundraising]
```

---

## What to Look For During Test

### GPS Tracking
1. Does the odometer pre-fill correctly?
2. Does GPS track accurately?
3. Does the distance calculate correctly?
4. Does the cost center default to yours?
5. Can you select different cost centers?
6. Does the entry save successfully?

### Manual Entry
1. Can you enter all fields easily?
2. Does the cost center default to yours?
3. Can you change cost centers?
4. Does save work correctly?

### Data Sync
1. Do entries appear in web portal?
2. Is the cost center correct?
3. Is the data accurate?

---

## Troubleshooting

### If cost centers don't appear:
1. Check that Goose Weisz has cost centers assigned in web portal
2. Logout and login again on mobile
3. Check that `selectedCostCenters` is not empty

### If wrong cost center is selected:
1. Check the `defaultCostCenter` in web portal
2. Make sure it's one of the `selectedCostCenters`
3. Update in web portal and re-login on mobile

### If entries don't sync:
1. Check backend is running (`http://192.168.86.101:3002/api/health`)
2. Check network connection
3. Look for sync errors in console

---

## Quick Reference

### Goose Weisz Credentials
- **Email:** greg.weisz@oxfordhouse.org
- **Password:** Goosewelcome1

### Backend Health Check
```bash
curl http://192.168.86.101:3002/api/health
```

### Current Setup
- **Backend:** Running on port 3002
- **Web Portal:** Running locally
- **Mobile App:** Expo dev mode
- **Database:** 252 employees imported

---

## Recent Changes Summary

Today we fixed:
1. ✅ Mobile authentication ("Welcome, Goose Weisz")
2. ✅ Mobile app simplified (staff portal only)
3. ✅ Password reset in admin portal
4. ✅ Search functionality (mobile + web)
5. ✅ Bulk delete (employees + cost centers)
6. ✅ Employee profile view
7. ✅ Cost center management working

**All systems operational and ready for real-world testing!** 🎉

---

**Have a great test drive!** 🚗💨

When you return, let me know how it went and if you noticed any issues!

