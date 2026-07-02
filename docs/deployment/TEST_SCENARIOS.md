# Oxford House Expense Tracker — Test Scenarios

**For beta testers** — use this checklist to exercise the mobile app and web portals from every angle. Record **Pass**, **Fail**, or **Blocked** for each scenario. For failures, note device, account role, steps, and screenshots.

**Setup:** See `BETA_TESTER_PACKET.pdf` for TestFlight access, login, and reporting bugs. Continue your **normal** expense process in parallel during beta.

**Last updated:** July 2026

---

## Before you start

### Test accounts needed

Ask your admin if you do not have access:

| Role | What to test |
|------|----------------|
| **Staff / employee** | Mobile app + Staff Portal |
| **Supervisor** | Supervisor Portal + team approvals |
| **Senior staff** | Senior Staff Portal (review-only first pass) |
| **Finance** | Finance Portal (final approval) |
| **Contracts** | Contracts Portal (read-only) |
| **Admin** | Admin Portal (employees, HR sync, config) |

### Devices

- **iPhone** — primary mobile testing (TestFlight build)
- **Desktop browser** — web portals (Chrome or Safari recommended)

### Bug report template

1. Scenario # from this document  
2. Account role and name (if safe to share)  
3. Device and browser version  
4. Steps to reproduce  
5. Expected vs actual result  
6. Screenshot or screen recording  
7. Report month/year (if applicable)

---

## 1. Authentication and first-run (mobile)

| # | Scenario | Steps | Expected result |
|---|----------|--------|-----------------|
| 1.1 | Email login | 1. Open the app.<br>2. Type your work email and password.<br>3. Tap **Log in**. | Home screen; correct name shown |
| 1.2 | Bad password | 1. Open the app.<br>2. Type your real email.<br>3. Type a **wrong** password.<br>4. Tap **Log in**. | Clear error; app does not crash |
| 1.3 | Google login | 1. On the login screen, tap **Sign in with Google** (if you see it).<br>2. Pick your Google account and finish signing in. | Session restores; correct profile |
| 1.4 | Stay logged in | 1. Log in normally.<br>2. Swipe the app away so it fully closes.<br>3. Open the app again. | Still logged in when stay-logged-in was used |
| 1.5 | Biometrics | 1. Turn on Face ID or Touch ID in Settings.<br>2. Log out.<br>3. Log back in using your face or fingerprint. | Biometric login works |
| 1.6 | Onboarding | 1. Use a brand-new account, or ask admin to reset onboarding.<br>2. Open the app and watch the intro slides. | Slides show once; then setup wizard |
| 1.7 | Setup wizard | 1. Go through each setup screen.<br>2. Fill in base address, cost center, and work hours.<br>3. Tap through until you finish. | Base address, cost center, hours saved |
| 1.8 | Logout | 1. Open **Settings**.<br>2. Tap **Log out**. | Returns to login screen |

---

## 2. Mobile — Home and navigation

| # | Scenario | Steps | Expected result |
|---|----------|--------|-----------------|
| 2.1 | Month selector | 1. On the Home screen, tap the month picker.<br>2. Choose a different month. | Stats reflect selected month |
| 2.2 | Tile reorder | 1. On Home, turn on **Edit** mode for the tiles.<br>2. Drag tiles into a new order.<br>3. Save.<br>4. Close and reopen the app. | Order persists after restart |
| 2.3 | Sync / refresh | 1. Pull down on Home to refresh, **or** tap the sync bar.<br>2. Wait until it finishes. | Data updates; last sync time shown |
| 2.4 | Over The Air update | 1. If the app asks you to update, try **Later** first.<br>2. When it asks again, try **Restart**. | Later dismisses; Restart reloads cleanly |
| 2.5 | Per Diem navigation | 1. Open **Per Diem**.<br>2. Scroll up and down.<br>3. Tap into a day and make a small edit. | Does **not** randomly return to Home |
| 2.6 | GPS overlay | 1. Start a GPS trip.<br>2. Go back to **Home**.<br>3. Use **Return** to go back to GPS.<br>4. End the trip normally. | Can return to GPS; trip completes |

---

## 3. Mobile — GPS mileage

| # | Scenario | Steps | Expected result |
|---|----------|--------|-----------------|
| 3.1 | Start trip | 1. Tap **Start GPS trip** (or similar).<br>2. Pick your vehicle, cost center, and trip purpose.<br>3. Pick a start location.<br>4. Start tracking. | Tracking starts; distance accumulates |
| 3.2 | Full address | 1. Start a trip with a real start address.<br>2. Drive or simulate movement.<br>3. End the trip with a real end address.<br>4. Look at the saved trip. | Full street + city/state; confirm street number |
| 3.3 | End at base | 1. Start a GPS trip.<br>2. When you end it, choose your **base address** as the end location.<br>3. Save the trip. | Trip saves without broken modal |
| 3.4 | My Flock location | 1. Start or end a trip.<br>2. Pick a house from **My Flock** as the location. | House selects; address returns correctly |
| 3.5 | Saved addresses | 1. Start or end a trip.<br>2. Pick one of your **saved addresses**. | Address fills correctly |
| 3.6 | Session restore | 1. Start a GPS trip.<br>2. Force-quit the app (swipe it away).<br>3. Open the app again. | Returns to GPS; trip still active |
| 3.7 | Complete trip | 1. Finish a full trip.<br>2. Pick an end location and save.<br>3. Open your mileage list for that day. | Mileage entry saved with correct miles |

---

## 4. Mobile — Manual mileage

| # | Scenario | Steps | Expected result |
|---|----------|--------|-----------------|
| 4.1 | Add entry | 1. Tap **Add mileage** (or open manual entry).<br>2. Fill in date, start, end, miles, purpose, and cost center.<br>3. Save. | Saves and appears in list |
| 4.2 | Date-scoped odometer | 1. On **Day A**, enter an odometer reading.<br>2. Open **Day B** (a different day).<br>3. Look at the odometer field. | Day B does **not** use Day A odometer |
| 4.3 | Odometer hint | 1. Complete a travel day with an ending odometer.<br>2. Open the **next** travel day.<br>3. Look for a hint about yesterday’s ending odometer. | Previous ending odometer shown as hint |
| 4.4 | Edit / delete | 1. Open a mileage entry.<br>2. Change something and save.<br>3. Then delete that entry.<br>4. Check the web portal. | Syncs; removed from web |
| 4.5 | My Flock picker | 1. Add or edit manual mileage.<br>2. Use **My Flock** to pick a house as a location. | Location populates correctly |

---

## 5. Mobile — Receipts

| # | Scenario | Steps | Expected result |
|---|----------|--------|-----------------|
| 5.1 | Camera capture | 1. Tap **Add receipt**.<br>2. Choose **Camera**.<br>3. Take a photo.<br>4. Save the receipt. | Receipt saves with the photo |
| 5.2 | Gallery | 1. Tap **Add receipt**.<br>2. Choose **Photo library**.<br>3. Pick a picture.<br>4. Save the receipt. | Same flow works |
| 5.3 | Receipt image read | 1. Take a clear photo of a real receipt.<br>2. Wait for the app to read it.<br>3. Check vendor, amount, and date before saving. | App fills in vendor, amount, and date from the photo; you can change them before saving |
| 5.4 | Low quality | 1. Add a receipt using a blurry or very tiny photo. | Quality warning if score is low |
| 5.5 | View list | 1. Open **Receipts** for the month you saved to.<br>2. Scroll through the list. | All receipts listed correctly |

---

## 6. Mobile — Daily hours and descriptions

| # | Scenario | Steps | Expected result |
|---|----------|--------|-----------------|
| 6.1 | Working hours | 1. Open **Daily hours** (or Timesheet).<br>2. Enter hours for each cost center you worked.<br>3. Save.<br>4. Check the web Timesheet. | Syncs to web Timesheet |
| 6.2 | Description | 1. Open a day’s **daily description**.<br>2. Type what you did that day.<br>3. Save.<br>4. Check **Daily Descriptions** on the web. | Appears on web Daily Descriptions |
| 6.3 | Day off — PTO | 1. Mark a day as **Day off** → **PTO**.<br>2. Save.<br>3. Check the web Timesheet. | 8 PTO hours on web; not Working Hours |
| 6.4 | Day off — Holiday | 1. Mark a day as **Day off** → **Holiday**.<br>2. Save.<br>3. Check the web. | 8 holiday hours on web |
| 6.5 | Day off — Sick | 1. Mark a day as **Day off** → **Sick**.<br>2. Save. | Saves correctly |
| 6.6 | Clear day off | 1. Pick a day that is marked Day off.<br>2. Uncheck **Day off**.<br>3. Save. | Hours/description clear appropriately |
| 6.7 | Stay after save | 1. Open a day in Daily hours.<br>2. Change something and tap **Save**. | **Stays** on day list (not kicked to Home) |
| 6.8 | PTO reminder | 1. Mark your **first PTO day** of the month.<br>2. Read any popup the app shows. | One-time partial-PTO reminder |
| 6.9 | Rapid saves | 1. Open several different days in a row.<br>2. Make quick edits and save each one fast (don’t wait long between saves). | No “Too many requests” errors |
| 6.10 | Stayed overnight | 1. On a travel day, turn on **Stayed overnight** (if you see it).<br>2. Save and check per diem for that day. | Affects per diem eligibility per rules |

---

## 7. Mobile — Per diem

| # | Scenario | Steps | Expected result |
|---|----------|--------|-----------------|
| 7.1 | Eligibility | 1. Pick a day where you worked **8+ hours** and drove **100+ miles**.<br>2. Open **Per Diem** for that day. | Day shows eligible |
| 7.2 | Claim amount | 1. On an eligible day, enter your per diem amount.<br>2. Save.<br>3. Check that it respects the daily cap and monthly limit. | Respects daily cap and monthly limit |
| 7.3 | Tiered rules | 1. If you are on a tiered cost center, enter per diem for days at different mile amounts.<br>2. Compare amounts to the rules you were given. | Amount follows distance tier |
| 7.4 | Receipt image required | **Only if your admin turned this on for your cost center:**<br>1. Try to save per diem **without** a receipt photo.<br>2. Then add a receipt photo and try again.<br><br>**If your center does not require a photo, skip this test.** | App blocks save until you add a receipt image; if your center does not require it, skip this test |
| 7.5 | Save all | 1. Fill in per diem for the whole month.<br>2. Tap **Save** (or save each day).<br>3. Check the web Per Diem tab and monthly total. | Syncs to web; monthly total correct |
| 7.6 | Accidental back | 1. Open **Per Diem**.<br>2. Scroll up and down on the screen.<br>3. Be careful not to tap the back button on purpose. | Does not accidentally navigate away |

---

## 8. Mobile — My Flock

| # | Scenario | Steps | Expected result |
|---|----------|--------|-----------------|
| 8.1 | View flock | 1. Open **My Flock** from the menu or Home. | Houses listed alphabetically |
| 8.2 | Add house | 1. Tap **Add house**.<br>2. Search for an Oxford House.<br>3. Add it to your list.<br>4. Check the web portal. | Appears in list; syncs to web |
| 8.3 | State default | 1. Make sure your base address is set in your profile.<br>2. Start adding a new house.<br>3. Look at which state the search starts in. | Search defaults to employee state |
| 8.4 | Remove house | 1. Open **My Flock**.<br>2. Delete a pinned house.<br>3. Check mobile and web. | Removed on mobile and web |
| 8.5 | GPS / mileage use | 1. Start a trip or manual mileage.<br>2. Pick a **My Flock** house as start or end. | Correct address in trip/entry |

---

## 9. Mobile — Settings and sync

| # | Scenario | Steps | Expected result |
|---|----------|--------|-----------------|
| 9.1 | Theme | 1. Open **Settings**.<br>2. Switch between light and dark theme.<br>3. Close and reopen the app. | Persists after restart |
| 9.2 | Vehicles | 1. Open **Settings** → **Vehicles**.<br>2. Add a new vehicle or edit an existing one.<br>3. Start mileage or GPS and look for that vehicle in the list. | Available in mileage/GPS |
| 9.3 | Data sync | 1. Open **Data Sync**.<br>2. Tap **Sync** (or Force Sync).<br>3. Wait until it finishes. | Success; queue clears |
| 9.4 | Notifications | 1. When you see a smart notification on Home, dismiss it.<br>2. Pull to refresh or leave and come back. | Stays dismissed after refresh |
| 9.5 | Offline sync test | 1. Make a small change (like edit a daily description). **Do not sync yet.**<br>2. Turn on **Airplane mode** for about 10 seconds.<br>3. Swipe the app away so it fully closes.<br>4. Open the app again (still in airplane mode is OK).<br>5. Turn **Airplane mode off**.<br>6. Go to **Data Sync** and tap **Sync**. | Your edit is still there after you sync — nothing was lost |

---

## 10. Web — Staff Portal (employee)

### Report building

| # | Scenario | Steps | Expected result |
|---|----------|--------|-----------------|
| 10.1 | Month navigation | 1. Log into the Staff Portal.<br>2. Use the month/year picker to switch to another month. | Correct report loads |
| 10.2 | Mobile sync | 1. Enter something on your phone (mileage, receipt, hours, etc.).<br>2. Sync on the phone.<br>3. On the web, refresh the same month’s report. | Mileage, receipts, hours, per diem match |
| 10.3 | Mileage tab | 1. Open the **Mileage** tab.<br>2. Edit a trip if needed.<br>3. Drag trips into a new order for one day.<br>4. Save. | Order saves; totals correct |
| 10.4 | Daily Descriptions | 1. Open **Daily Descriptions**.<br>2. Type or change text for a day.<br>3. Save.<br>4. Check the Cost Center tab. | Saves; shows on Cost Center tab |
| 10.5 | Day off dropdown | 1. Open a day on the Timesheet.<br>2. Set **Day off** to **PTO**.<br>3. Click **Save**.<br>4. Refresh the page. | **Stays PTO** (does not revert) |
| 10.6 | Day off + mileage | 1. Pick a day that already has mileage.<br>2. Turn **Day off** on, then off again.<br>3. Save each time. | Can check and uncheck |
| 10.7 | Timesheet categories | 1. In the bottom section of the Timesheet, enter hours in **PTO** or **G&A** (not Working Hours).<br>2. Save and refresh. | Stays in category rows, not Working Hours |
| 10.8 | Partial PTO | 1. On the web, enter partial PTO for a day.<br>2. Save.<br>3. On your phone, sync and open that same day. | Same calendar day (no timezone shift) |
| 10.9 | Receipts | 1. Open the **Receipts** tab.<br>2. Upload a receipt image.<br>3. Open it to view the full image. | Image displays; saves correctly |
| 10.10 | Per Diem tab | 1. Open **Per Diem** on the web.<br>2. Compare eligible days and amounts to your phone. | Matches mobile; tiered rules apply |
| 10.11 | Cover sheet | 1. Open the **Cover sheet** tab.<br>2. Add your signature and check the certification box.<br>3. Save. | Tab warning clears when complete |
| 10.12 | Save report | 1. Make a change anywhere on the report.<br>2. Click **Save** (do **not** submit yet).<br>3. Refresh the browser. | Draft persists after refresh |

### Submit and weekly check-up

| # | Scenario | Steps | Expected result |
|---|----------|--------|-----------------|
| 10.13 | Submit report | 1. Finish all tabs for the month.<br>2. Click **Submit** on the cover sheet.<br>3. Confirm if asked. | Status → pending (per routing) |
| 10.14 | Weekly check-up | 1. While the report is still a **draft**, click **Share weekly check-up**.<br>2. Ask your reviewer to look at it.<br>3. Try sharing again right away. | Reviewers notified; weekly cooldown works |
| 10.15 | Withdraw | 1. Submit a report.<br>2. Before the next person approves it, click **Withdraw** (if you see it). | Returns to editable state per rules |
| 10.16 | Export PDF | 1. Open a completed report month.<br>2. Click **Export PDF** (or similar).<br>3. Open the downloaded file. | Downloads; totals match screen |

### Revision flow (staff)

| # | Scenario | Steps | Expected result |
|---|----------|--------|-----------------|
| 10.17 | Receive revision | 1. Have your supervisor request a revision on your report.<br>2. Log in and open that month. | Flagged items highlighted |
| 10.18 | Fix and resubmit | 1. Fix each flagged item.<br>2. Save.<br>3. Submit again. | Re-enters approval workflow |
| 10.19 | Approved lock | 1. Wait until finance fully approves your report.<br>2. Try to edit a mileage line or receipt. | Report not editable |

---

## 11. Web — Senior Staff Portal

| # | Scenario | Steps | Expected result |
|---|----------|--------|-----------------|
| 11.1 | Pending queue | 1. Log in as senior staff.<br>2. Open **Approvals**. | Shows `pending_senior_staff` reports |
| 11.2 | Approve | 1. Open a pending report.<br>2. Read through it.<br>3. Click **Approve** (you should **not** need to sign). | **No signature**; advances to supervisor |
| 11.3 | Request revision | 1. Open a pending report.<br>2. Flag one or more items and add a note.<br>3. Send revision request.<br>4. Ask the employee to check their report. | Employee gets revision flags |
| 11.4 | Weekly check-up | 1. Have an employee share a **weekly check-up** on a draft.<br>2. Open that report as senior staff. | **Only** Accept check-up — no Approve/Revision |
| 11.5 | View report | 1. Click an employee’s name to open their full report.<br>2. Click through each tab. | Review mode works |
| 11.6 | Comment / remind | 1. Open a report.<br>2. Add a comment or send a reminder.<br>3. Ask the employee if they got a notification. | Notifications sent |

---

## 12. Web — Supervisor Portal

| # | Scenario | Steps | Expected result |
|---|----------|--------|-----------------|
| 12.1 | Pending queue | 1. Log in as supervisor.<br>2. Open **Approvals**. | Team reports pending supervisor |
| 12.2 | Approve | 1. Open a pending report.<br>2. Check the certification box.<br>3. Sign and click **Approve**. | Moves to `pending_finance` |
| 12.3 | Request revision | 1. Open a pending report.<br>2. Select specific items to flag.<br>3. Add notes and send revision. | Employee sees revision flags |
| 12.4 | Weekly check-up | 1. Have an employee share a weekly check-up on a draft.<br>2. Open that report as supervisor. | Accept check-up only; no monthly Approve |
| 12.5 | Team setup | 1. Open team or routing settings for a report.<br>2. Assign senior staff if needed.<br>3. Look at the routing preview. | Routing preview correct |
| 12.6 | Assign staff | 1. Open **Assign staff** (or team management).<br>2. Search for an employee.<br>3. Assign them to a supervisor. | Shows **state + cost center**; search works |
| 12.7 | Contract utilization | 1. Open the **Contract utilization** tab. | Data loads |
| 12.8 | Delegate / remind | 1. Pick a report or employee.<br>2. Delegate to someone else **or** send a reminder. | Actions complete |

---

## 13. Web — Finance Portal

| # | Scenario | Steps | Expected result |
|---|----------|--------|-----------------|
| 13.1 | Pending queue | 1. Log in as finance.<br>2. Open pending reports. | Shows `pending_finance` for managed centers |
| 13.2 | Final approve | 1. Open a report ready for finance.<br>2. Sign and click **Approve**. | Status → `approved`; employee locked |
| 13.3 | Revision to employee | 1. Open a report at the finance step.<br>2. Request revision back to the **employee**.<br>3. Ask the employee to check. | Employee notified appropriately |
| 13.4 | PDF export | 1. Open an approved or pending report.<br>2. Export PDF.<br>3. Open the file and spot-check totals. | Downloads; totals correct |
| 13.5 | Map PDF | 1. Open a report with mileage.<br>2. Turn on **Include maps** (if offered).<br>3. Export PDF. | Map PDF generates |
| 13.6 | Managed centers | 1. Use the cost center filter.<br>2. Pick only centers you manage. | Only relevant reports shown |

---

## 14. Web — Contracts Portal (read-only)

| # | Scenario | Steps | Expected result |
|---|----------|--------|-----------------|
| 14.1 | View reports | 1. Log into Contracts Portal.<br>2. Click through **All**, **Pending**, and **Approved** lists. | Lists load |
| 14.2 | No approve | 1. Open any report.<br>2. Look at every button at the top and bottom. | **No** Approve or Request Revision |
| 14.3 | Contract caps | 1. Open the contract cap section or tab. | Displays without errors |
| 14.4 | Analytics | 1. Open **Analytics**. | Read-only data loads |

---

## 15. Web — Admin Portal

### Employee and HR sync

| # | Scenario | Steps | Expected result |
|---|----------|--------|-----------------|
| 15.1 | Create employee | 1. In Admin Portal, click **Add employee**.<br>2. Fill in name, email, and required fields.<br>3. Save.<br>4. Try logging in as that person on phone or web. | Can log in on mobile/web |
| 15.2 | Edit employee | 1. Open an existing employee.<br>2. Change cost centers or supervisor.<br>3. Save.<br>4. Check Staff or Supervisor portal. | Saves; reflects in portals |
| 15.3 | Archive employee | 1. Pick an inactive employee.<br>2. Click **Archive**.<br>3. Search active employee lists. | Removed from active lists |
| 15.4 | HR sync — normal | 1. Click **Sync from HR**.<br>2. Review the list of changes.<br>3. Click **Apply**. | Creates/updates as expected |
| 15.5 | HR sync — email typo | 1. Fix a typo in someone’s email locally (example: steven vs stevin).<br>2. Run HR sync again.<br>3. Watch what HR suggests. | No duplicate create; no archive |
| 15.6 | HR sync — name change | 1. Use a test case where HR has a new email for the same person (example: feliciano vs sledge).<br>2. Run HR sync. | No duplicate create |
| 15.7 | HR sync — ignore | 1. When HR sync asks about an update or archive, click **Don’t ask again**.<br>2. Run HR sync a second time. | Persists on next sync |
| 15.8 | Dedupe by email | 1. If you know duplicate employees exist, run **Dedupe by email**. | Extra rows merged |

### Supervisor and configuration

| # | Scenario | Steps | Expected result |
|---|----------|--------|-----------------|
| 15.9 | Promote supervisor | 1. Open an employee in Admin.<br>2. Promote them to **Supervisor**.<br>3. Have them log into Supervisor Portal. | Supervisor portal access works |
| 15.10 | Promote senior staff | 1. Promote an employee to **Senior staff**.<br>2. Have them log into Senior Staff Portal. | Senior staff portal works |
| 15.11 | Orphaned staff | 1. Find staff still tied to an archived supervisor.<br>2. Read the alert.<br>3. Click **Release** or reassign. | Alert shows; release works |
| 15.12 | Per diem rules | 1. Open per diem settings.<br>2. Set a flat rate and a tiered rate for test cost centers.<br>3. Check mobile and web per diem for those centers. | Mobile/web follow rules |
| 15.13 | Notifications | 1. Open notification settings.<br>2. Turn a workflow email off, then on.<br>3. Trigger that event (like a report submit). | Emails respect toggles |
| 15.14 | Audit log | 1. Do any admin action (edit employee, run HR sync, etc.).<br>2. Open **Audit log**.<br>3. Find your action. | Appears in audit log |

---

## 16. End-to-end approval workflows

Run these with **different accounts** (or testers playing each role).

### 16A — Full chain (with senior staff)

1. **Staff:** Finish the month’s report and click **Submit**.  
2. **Senior staff:** Log in, open Approvals, and click **Approve** (no signature needed). Report should move to supervisor.  
3. **Supervisor:** Open the report, sign, and **Approve**. Report should move to finance.  
4. **Finance:** Open the report, sign, and **Approve**. Report should be fully approved.  
5. **Staff:** Log back in and try to edit the report — it should be **locked**.

### 16B — Full chain (no senior staff)

1. **Staff:** Submit the report. It should go straight to **supervisor** (skip senior staff).  
2. **Supervisor:** Approve with signature.  
3. **Finance:** Approve with signature.  
4. **Staff:** Confirm the report is **approved** and locked.

### 16C — Revision from supervisor

1. **Staff:** Submit the report.  
2. **Supervisor:** Request revision on **one mileage entry** and **one receipt**. Add a short note.  
3. **Staff:** Fix those two items and **submit again**.  
4. **Everyone:** Check that approval starts over from the right step (senior staff or supervisor, depending on routing).

### 16D — Revision from finance

1. Get a report all the way to **finance** (staff → supervisor → finance queue).  
2. **Finance:** Request revision **back to the employee**.  
3. **Staff:** Fix the flagged items and submit again.

### 16E — Weekly check-up (not monthly approval)

1. **Staff:** While the report is still a **draft**, click **Share weekly check-up**.  
2. **Supervisor:** Open that report — you should only see **Accept check-up**, not monthly Approve.  
3. **Supervisor:** Accept the check-up.  
4. **Staff:** Confirm you got a notification.  
5. **Staff:** Confirm the monthly report is still a **draft** until you formally submit it.

---

## 17. Cross-platform sync matrix

For each row: enter data on one device, sync, then check the other side.

| Data type | Enter mobile → verify web | Enter web → verify mobile |
|-----------|---------------------------|---------------------------|
| GPS mileage | 1. Complete a GPS trip on phone.<br>2. Sync.<br>3. Open Mileage tab on web. | — |
| Manual mileage | 1. Add mileage on phone.<br>2. Sync.<br>3. Check web. | 1. Add mileage on web.<br>2. Save.<br>3. Sync phone and check. |
| Receipt | 1. Add receipt on phone.<br>2. Sync.<br>3. Check Receipts on web. | 1. Add receipt on web.<br>2. Save.<br>3. Sync phone and check. |
| Daily hours | 1. Enter hours on phone.<br>2. Sync.<br>3. Check Timesheet on web. | — |
| Day off / PTO | 1. Mark PTO on phone.<br>2. Sync.<br>3. Check web Timesheet. | 1. Mark PTO on web.<br>2. Save.<br>3. Sync phone and check. |
| Per diem | 1. Enter per diem on phone.<br>2. Sync.<br>3. Check web Per Diem tab. | 1. Enter per diem on web.<br>2. Save.<br>3. Sync phone and check. |
| My Flock | 1. Add a house on phone.<br>2. Sync.<br>3. Check web Settings / My Flock. | 1. Add on web if available.<br>2. Sync phone and check Settings. |
| Description | 1. Add description on phone.<br>2. Sync.<br>3. Check web. | 1. Add on web.<br>2. Save.<br>3. Sync phone and check. |

---

## 18. Notifications

| # | Scenario | Steps | Expected result |
|---|----------|--------|-----------------|
| 18.1 | Report submitted | 1. Staff submits a report.<br>2. First approver checks email and the bell icon. | First approver notified |
| 18.2 | Approval step | 1. Senior staff or supervisor approves.<br>2. Next person in line checks notifications. | Next approver notified |
| 18.3 | Revision requested | 1. Approver sends revision.<br>2. Employee checks email and bell. | Employee notified |
| 18.4 | Weekly check-up | 1. Staff shares weekly check-up.<br>2. Senior staff and supervisor check notifications. | Senior staff + supervisor notified |
| 18.5 | Click notification | 1. Click a notification email or in-app alert.<br>2. See where it takes you. | Navigates to correct report/month |
| 18.6 | Mark read | 1. Open the notifications bell.<br>2. Mark one as read.<br>3. Look at the unread count. | Count decreases correctly |

---

## 19. Regression checklist (recent fixes)

Check each before wider release:

- [ ] Per Diem does not randomly return to Home  
- [ ] PTO day off on mobile → 8 hrs on web (not Working Hours)  
- [ ] PTO in Timesheet bottom section stays in category rows  
- [ ] Day off dropdown (PTO/Sick/Holiday) sticks after Save on web  
- [ ] HR sync: corrected email not archived; typo email not created  
- [ ] HR sync: name-change email not created as duplicate  
- [ ] Supervisor assign staff shows state + cost center  
- [ ] Weekly check-up: supervisor sees Accept only, not Approve  
- [ ] Receipts page: no Generate Monthly PDF button  
- [ ] Notifications bell loads and clears correctly  
- [ ] Finance map PDF export works  

---

## 20. Edge cases

| # | Scenario | Steps | Expected result |
|---|----------|--------|-----------------|
| 20.1 | Month boundary | 1. Add mileage on the **last day** of a month.<br>2. Add mileage on the **first day** of the next month.<br>3. Open each month’s report. | Entries on last/first day appear in correct month |
| 20.2 | Multi cost center | 1. Split hours and mileage across two cost centers in one month.<br>2. Export PDF or odometer report. | Hours/mileage split correctly; export odometer continuous |
| 20.3 | Large report | 1. Fill a **full month** with lots of mileage, receipts, and hours.<br>2. Save, submit, and export PDF. | Full month saves/submits/PDF without timeout |
| 20.4 | Archived supervisor | 1. Submit a report for staff whose supervisor was archived.<br>2. Watch where routing sends it.<br>3. Admin uses repair tools if needed. | Routing skips archived; admin repair available |
| 20.5 | Session expiry | 1. Leave the web portal open a long time without clicking.<br>2. Try to save something. | Friendly re-login on web |
| 20.6 | Portal switcher | 1. Log in as someone with more than one role.<br>2. Open the portal switcher.<br>3. Look at which portals you can open. | Only allowed portals shown |

---

## Suggested test schedule

**Read this first:** You do not have to finish everything in one day. Work through one week at a time. Each “section” is a numbered part of this document (for example, section 5 is Receipts). Mark each test **Pass**, **Fail**, or **Blocked**. If something breaks, write down what you did and tell Goose.

| Week | What to do (plain English) |
|------|----------------------------|
| **Week 1** | **Use the phone app for everyday tasks.** Work through sections **1–9** (login, home screen, GPS trips, manual mileage, receipts, daily hours, per diem, My Flock, and settings). Then check section **17** (the sync table) to make sure phone data shows up on the website. |
| **Week 2** | **Use the Staff Portal on your computer.** Do section **10** (build and save your expense report on the web). Also run section **19** (the regression checklist — quick checks that recent fixes still work). |
| **Week 3** | **Test the approval chain.** Do section **16** (full approval workflows with different people playing staff, supervisor, finance, etc.). Also test sections **11–13** (Senior Staff, Supervisor, and Finance portals). |
| **Week 4** | **Admin and special cases.** If you have admin access, do section **15** (employees and HR sync). Test section **14** (Contracts portal, read-only). Finish with section **20** (edge cases — weird situations like month boundaries). |

**Tip:** If a step confuses you, skip it, note **Blocked**, and **Contact Goose**. Do not guess and do not spend an hour stuck on one line.

---

## Approval status reference

| Status | Meaning |
|--------|---------|
| `draft` | Not submitted; employee can edit |
| `pending_senior_staff` | Awaiting senior staff review |
| `pending_supervisor` | Awaiting supervisor approval |
| `pending_finance` | Awaiting finance approval |
| `needs_revision` | Returned to employee for fixes |
| `approved` | Final; locked for editing |

**Routing order:** Senior Staff (if assigned) → Supervisor → Finance

---

*Oxford House, Inc. — internal beta testing document. Questions or problems: **Contact Goose**.*
