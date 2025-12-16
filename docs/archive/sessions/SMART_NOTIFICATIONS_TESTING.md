# Smart Notifications Testing Guide

This guide explains how to test each type of smart notification in the Oxford House Expense Tracker app.

## Notification Types

### 1. Missing Mileage Notification
**Priority:** Medium (Orange)  
**Conditions:**
- No mileage entries logged for today
- Today is a weekday (Monday-Friday)
- Current time is between 9 AM - 5 PM

**How to Test:**
1. Make sure you don't have any mileage entries for today
2. Open the app during business hours (9 AM - 5 PM) on a weekday
3. Navigate to the Home screen
4. You should see: "Haven't logged today's mileage?"

**Quick Test (anytime):**
- You can temporarily modify the code to remove the business hours check, or
- Change your device time to a weekday between 9 AM - 5 PM

---

### 2. Missing Receipt Photos Notification
**Priority:** High (Red)  
**Conditions:**
- Has receipts from the last 7 days
- Any receipt with amount > $50
- Receipt is missing an image (no `imageUri`)

**How to Test:**
1. Add a receipt with amount > $50 (e.g., $75)
2. Do NOT add a photo/image to the receipt
3. Save the receipt
4. Navigate to Home screen
5. You should see: "Receipt photos needed - You have $X in expenses without receipt photos"

**Steps in App:**
- Go to "Add Receipt"
- Enter amount: $75
- Leave the photo field empty
- Save
- Return to Home screen

---

### 3. Month-End Report Reminder
**Priority:** High (Red)  
**Conditions:**
- Current date is within 3 days of month end (e.g., Nov 28-30)
- No monthly report exists for current month, OR
- Monthly report exists but status is "draft"

**How to Test:**
1. Change your device date to within 3 days of month end (or wait until then)
2. Make sure you don't have a submitted report for the current month
3. Navigate to Home screen
4. You should see: "Month ending soon - review your report"

**Quick Test:**
- Temporarily change device date to Nov 28-30 (or Dec 28-30)
- Or modify the code to use a test date closer to month end

---

### 4. Per Diem Eligibility Notification
**Priority:** Medium (Orange)  
**Conditions:**
- Today has 8+ hours logged in time tracking
- Today has 100+ miles logged in mileage
- No per diem receipt exists for today

**How to Test:**
1. Add a time tracking entry for today with 8+ hours:
   - Go to "Hours Worked"
   - Add entry: Start 9:00 AM, End 5:00 PM (8 hours)
2. Add mileage entries totaling 100+ miles for today:
   - Go to "Mileage" 
   - Add multiple entries that total 100+ miles
3. Make sure you don't have a "Per Diem" category receipt for today
4. Navigate to Home screen
5. You should see: "Per Diem eligible today"

**Example:**
- Time: 9 AM - 6 PM (9 hours)
- Mileage: 3 trips of 35 miles each = 105 miles
- Result: Notification appears

---

### 5. Report Pending Approval Notification
**Priority:** Low (Blue)  
**Conditions:**
- User has a monthly report with status = "pending_approval"

**How to Test:**
1. Submit a monthly report (it will be set to "pending_approval")
2. Navigate to Home screen
3. You should see: "Report pending supervisor approval"

**Steps:**
- Go to "Reports"
- Generate/submit a monthly report
- The report status will be "pending_approval"
- Return to Home screen to see notification

---

## Testing Tips

### Force Refresh Notifications
Notifications are checked when:
- App first loads
- Home screen comes into focus
- Data is refreshed

To force a refresh:
1. Navigate away from Home screen
2. Navigate back to Home screen
3. Or restart the app

### Viewing Notification Details
Each notification displays:
- **Icon:** Different icon based on type
- **Priority Color:** Red (high), Orange (medium), Blue (low)
- **Title:** Brief description
- **Message:** Detailed information
- **Action Button:** Navigates to relevant screen

### Dismissing Notifications
- Tap the X button to dismiss
- Dismissed notifications won't reappear until conditions change

### Testing Multiple Notifications
You can trigger multiple notifications simultaneously:
1. Set up conditions for 2-3 different notification types
2. All active notifications will appear on the Home screen
3. They'll be stacked vertically

---

## Quick Test Checklist

- [ ] Missing Mileage: No entries today, weekday, 9-5 PM
- [ ] Missing Receipts: Receipt >$50 without photo
- [ ] Month-End Reminder: Within 3 days of month end, no submitted report
- [ ] Per Diem Eligibility: 8+ hours AND 100+ miles today
- [ ] Report Status: Report with "pending_approval" status

---

## Debug Mode

To see notification generation in console logs, enable debug mode in `src/config/debug.ts`:

```typescript
export const DEBUG_MODE = true;
```

This will log:
- Number of notifications generated
- Which checks passed/failed
- Any errors during notification generation
