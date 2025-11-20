# Real-Time Smart Notifications Testing Guide

Follow these steps to test notifications with real data in your app.

## Quick Test Steps

### Test 1: Missing Receipt Photos (Easiest - 2 minutes)

1. **Open the mobile app** on your device
2. **Tap "Add Receipt"** button
3. **Fill in the receipt:**
   - Category: Choose any (e.g., "Gas", "Office Supplies")
   - Vendor: "Test Vendor"
   - Amount: **$75** (must be > $50)
   - Date: Today's date
   - **DO NOT add a photo** - leave the image field empty
4. **Save the receipt**
5. **Navigate to Home screen** (tap back/home)
6. **✅ You should see:** Red notification saying "Receipt photos needed - You have $75.00 in expenses without receipt photos"

**To test again:** Add another receipt >$50 without a photo, or modify an existing receipt to remove its photo.

---

### Test 2: Per Diem Eligibility (5 minutes)

1. **Add Time Tracking Entry:**
   - Tap "Hours Worked"
   - Add new entry:
     - Start Time: **9:00 AM** (today)
     - End Time: **6:00 PM** (today) = **9 hours**
   - Save

2. **Add Mileage Entries:**
   - Tap "Manual Entry" or "GPS Tracking"
   - Add **3 mileage entries** for today:
     - Entry 1: 35 miles (any route)
     - Entry 2: 35 miles (any route)
     - Entry 3: 35 miles (any route)
     - **Total: 105 miles**
   - Save each entry

3. **Navigate to Home screen**
4. **✅ You should see:** Orange notification saying "Per Diem eligible today - You've worked 9.0 hours and driven 105.0 miles today"

**Note:** Make sure you don't already have a "Per Diem" category receipt for today, or it won't show.

---

### Test 3: Report Pending Approval (3 minutes)

1. **Go to "Reports"** in the app
2. **Generate/Submit a monthly report** for the current month
3. **The report will be set to "pending_approval" status**
4. **Navigate to Home screen**
5. **✅ You should see:** Blue notification saying "Report pending supervisor approval - Your [Month] [Year] expense report is awaiting supervisor approval"

---

### Test 4: Missing Mileage (Weekday + Business Hours Only)

**Note:** This only works on weekdays (Mon-Fri) between 9 AM - 5 PM.

1. **Make sure you have NO mileage entries for today**
2. **Open the app during business hours** (9 AM - 5 PM) on a weekday
3. **Navigate to Home screen**
4. **✅ You should see:** Orange notification saying "Haven't logged today's mileage?"

**Alternative:** If it's not a weekday or outside business hours, you can:
- Wait until it's a weekday during business hours, OR
- Temporarily change your device time (Settings → Date & Time)

---

### Test 5: Month-End Reminder (Wait for end of month)

**Note:** This only works when you're within 3 days of month end.

1. **Make sure you DON'T have a submitted report** for the current month
2. **Wait until the 28th-30th of the month** (or change device date)
3. **Navigate to Home screen**
4. **✅ You should see:** Red notification saying "Month ending soon - review your report - Only X days left in [Month]"

---

## Tips for Testing

### Refresh Notifications
- **Pull down** on the Home screen to refresh
- **Navigate away** from Home, then **come back**
- **Close and reopen** the app

### See Multiple Notifications
You can trigger multiple notifications at once:
1. Add a receipt >$50 without photo
2. Add 8+ hours of work + 100+ miles for today
3. Submit a report for pending approval
4. Go to Home screen → You'll see all active notifications stacked

### Dismiss Notifications
- Tap the **X button** on any notification to dismiss it
- Dismissed notifications won't reappear until conditions change again

### Debug Logging
Check the app console/logs for:
```
📬 Generated X smart notifications for employee [id]
```
This confirms the notification service is running.

---

## Current Date/Time Requirements

Some notifications depend on the current date/time:
- **Missing Mileage:** Weekday + 9 AM - 5 PM
- **Month-End Reminder:** Within 3 days of month end
- **Per Diem:** Based on today's entries
- **Missing Receipts:** Last 7 days
- **Report Status:** Always works if you have pending reports

---

## Testing Checklist

Try these in order (easiest first):

- [ ] **Missing Receipt Photos** - Add receipt >$50 without photo → Home
- [ ] **Per Diem Eligibility** - Add 8+ hours + 100+ miles today → Home
- [ ] **Report Pending** - Submit a monthly report → Home
- [ ] **Missing Mileage** - No entries today, weekday 9-5 PM → Home
- [ ] **Month-End** - Wait for 28th-30th, no submitted report → Home

---

## Troubleshooting

**No notifications showing?**
1. Make sure you're on the Home screen
2. Pull down to refresh
3. Check console logs for errors
4. Verify you meet all conditions for the notification type

**Notifications not updating?**
- Navigate away from Home, then come back
- Close and reopen the app
- Check that data was saved correctly (e.g., receipt saved, mileage logged)

**Want to test multiple times?**
- For receipts: Add/modify receipts >$50 without photos
- For per diem: Modify time/mileage entries for today
- For reports: Create new monthly reports
- Dismiss notifications first if you want to see them again
