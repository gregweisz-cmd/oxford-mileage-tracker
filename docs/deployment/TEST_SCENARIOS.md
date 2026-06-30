# Oxford House Expense Tracker — Test Scenarios

**For beta testers** — use this checklist to exercise the mobile app and web portals from every angle. Record **Pass**, **Fail**, or **Blocked** for each scenario. For failures, note device, account role, steps, and screenshots.

**Setup:** See `BETA_TESTER_PACKET.pdf` for TestFlight access, login, and reporting bugs. Continue your **normal** expense process in parallel during beta.

**Last updated:** June 2026

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
| 1.1 | Email login | Log in with valid staff credentials | Home screen; correct name shown |
| 1.2 | Bad password | Enter wrong password | Clear error; app does not crash |
| 1.3 | Google login | Sign in with Google (if enabled) | Session restores; correct profile |
| 1.4 | Stay logged in | Log in, force-quit app, reopen | Still logged in when stay-logged-in was used |
| 1.5 | Biometrics | Enable Face ID/Touch ID; log out and back in | Biometric login works |
| 1.6 | Onboarding | Fresh account or reset onboarding | Slides show once; then setup wizard |
| 1.7 | Setup wizard | Complete wizard | Base address, cost center, hours saved |
| 1.8 | Logout | Log out from Settings | Returns to login screen |

---

## 2. Mobile — Home and navigation

| # | Scenario | Steps | Expected result |
|---|----------|--------|-----------------|
| 2.1 | Month selector | Change month on Home | Stats reflect selected month |
| 2.2 | Tile reorder | Edit mode → reorder → save | Order persists after restart |
| 2.3 | Sync / refresh | Pull to refresh or sync | Data updates; last sync time shown |
| 2.4 | Over The Air update | If prompted: Later vs Restart | Later dismisses; Restart reloads cleanly |
| 2.5 | Per Diem navigation | Open Per Diem, scroll and edit | Does **not** randomly return to Home |
| 2.6 | GPS overlay | Start GPS → go to Home → Return/Stop | Can return to GPS; trip completes |

---

## 3. Mobile — GPS mileage

| # | Scenario | Steps | Expected result |
|---|----------|--------|-----------------|
| 3.1 | Start trip | Vehicle, cost center, purpose, start location | Tracking starts; distance accumulates |
| 3.2 | Full address | Start and end trip | Full street + city/state; confirm street number |
| 3.3 | End at base | End trip using base address | Trip saves without broken modal |
| 3.4 | My Flock location | Start/end using My Flock house | House selects; address returns correctly |
| 3.5 | Saved addresses | Pick saved address | Address fills correctly |
| 3.6 | Session restore | Start trip → force-quit → reopen | Returns to GPS; trip still active |
| 3.7 | Complete trip | End with end location | Mileage entry saved with correct miles |

---

## 4. Mobile — Manual mileage

| # | Scenario | Steps | Expected result |
|---|----------|--------|-----------------|
| 4.1 | Add entry | Date, locations, miles, purpose, cost center | Saves and appears in list |
| 4.2 | Date-scoped odometer | Set odometer on Day A; open Day B | Day B does **not** use Day A odometer |
| 4.3 | Odometer hint | After travel day, open next travel day | Previous ending odometer shown as hint |
| 4.4 | Edit / delete | Edit then delete an entry | Syncs; removed from web |
| 4.5 | My Flock picker | Choose flock house | Location populates correctly |

---

## 5. Mobile — Receipts

| # | Scenario | Steps | Expected result |
|---|----------|--------|-----------------|
| 5.1 | Camera capture | Add receipt via camera | Crop → save works |
| 5.2 | Gallery | Add from photo library | Same flow works |
| 5.3 | OCR / AI | Capture clear receipt | Vendor/amount/date suggested; editable |
| 5.4 | Low quality | Blurry or tiny image | Quality warning if score is low |
| 5.5 | View list | Open Receipts for month | All receipts listed correctly |
| 5.6 | No monthly PDF | Open Receipts page | **No** “Generate Monthly PDF” button |

---

## 6. Mobile — Daily hours and descriptions

| # | Scenario | Steps | Expected result |
|---|----------|--------|-----------------|
| 6.1 | Working hours | Enter hours by cost center | Syncs to web Timesheet |
| 6.2 | Description | Add daily description | Appears on web Daily Descriptions |
| 6.3 | Day off — PTO | Mark PTO day off → save | 8 PTO hours on web; not Working Hours |
| 6.4 | Day off — Holiday | Mark Holiday day off | 8 holiday hours on web |
| 6.5 | Day off — Sick | Mark Sick Day | Saves correctly |
| 6.6 | Clear day off | Uncheck day off | Hours/description clear appropriately |
| 6.7 | Stay after save | Save a day | **Stays** on day list (not kicked to Home) |
| 6.8 | PTO reminder | First PTO day in month | One-time partial-PTO reminder |
| 6.9 | Rapid saves | Edit several days quickly | No “Too many requests” errors |
| 6.10 | Stayed overnight | Check overnight flag | Affects per diem eligibility per rules |

---

## 7. Mobile — Per diem

| # | Scenario | Steps | Expected result |
|---|----------|--------|-----------------|
| 7.1 | Eligibility | Day with 8+ hrs and 100+ mi | Day shows eligible |
| 7.2 | Claim amount | Enter per diem for eligible day | Respects daily cap and monthly limit |
| 7.3 | Tiered rules | Employee on tiered cost center | Amount follows distance tier |
| 7.4 | Receipt image | Center requires receipt image | Cannot save without image when required |
| 7.5 | Save all | Save month’s per diem | Syncs to web; monthly total correct |
| 7.6 | Accidental back | Scroll on Per Diem screen | Does not accidentally navigate away |

---

## 8. Mobile — My Flock

| # | Scenario | Steps | Expected result |
|---|----------|--------|-----------------|
| 8.1 | View flock | Open My Flock | Houses listed alphabetically |
| 8.2 | Add house | Search and add Oxford House | Appears in list; syncs to web |
| 8.3 | State default | Add with base address set | Search defaults to employee state |
| 8.4 | Remove house | Delete pinned house | Removed on mobile and web |
| 8.5 | GPS / mileage use | Pick flock house as location | Correct address in trip/entry |

---

## 9. Mobile — Settings and sync

| # | Scenario | Steps | Expected result |
|---|----------|--------|-----------------|
| 9.1 | Theme | Toggle light/dark | Persists after restart |
| 9.2 | Vehicles | Add/edit vehicle | Available in mileage/GPS |
| 9.3 | Data sync | Manual sync from Data Sync screen | Success; queue clears |
| 9.4 | Notifications | Dismiss smart notification | Stays dismissed after refresh |
| 9.5 | Offline | Enter data offline; reconnect | Syncs when online |

---

## 10. Web — Staff Portal (employee)

### Report building

| # | Scenario | Steps | Expected result |
|---|----------|--------|-----------------|
| 10.1 | Month navigation | Switch month/year | Correct report loads |
| 10.2 | Mobile sync | Sync mobile → refresh web | Mileage, receipts, hours, per diem match |
| 10.3 | Mileage tab | View/edit; reorder trips in a day | Order saves; totals correct |
| 10.4 | Daily Descriptions | Edit description | Saves; shows on Cost Center tab |
| 10.5 | Day off dropdown | Change Day off → PTO → Save | **Stays PTO** (does not revert) |
| 10.6 | Day off + mileage | Toggle Day off on day with mileage | Can check and uncheck |
| 10.7 | Timesheet categories | Enter PTO/G&A in bottom section | Stays in category rows, not Working Hours |
| 10.8 | Partial PTO | Partial PTO on web; refresh mobile | Same calendar day (no timezone shift) |
| 10.9 | Receipts | Upload, crop, view receipt | Image displays; saves correctly |
| 10.10 | Per Diem tab | Review eligible days | Matches mobile; tiered rules apply |
| 10.11 | Cover sheet | Signature + certification | Tab warning clears when complete |
| 10.12 | Save report | Save without submitting | Draft persists after refresh |

### Submit and weekly check-up

| # | Scenario | Steps | Expected result |
|---|----------|--------|-----------------|
| 10.13 | Submit report | Submit completed month | Status → pending (per routing) |
| 10.14 | Weekly check-up | Share weekly check-up | Reviewers notified; weekly cooldown works |
| 10.15 | Withdraw | Withdraw at first approval step | Returns to editable state per rules |
| 10.16 | Export PDF | Generate monthly PDF | Downloads; totals match screen |

### Revision flow (staff)

| # | Scenario | Steps | Expected result |
|---|----------|--------|-----------------|
| 10.17 | Receive revision | Supervisor requests revision | Flagged items highlighted |
| 10.18 | Fix and resubmit | Fix flagged items → resubmit | Re-enters approval workflow |
| 10.19 | Approved lock | After full approval | Report not editable |

---

## 11. Web — Senior Staff Portal

| # | Scenario | Steps | Expected result |
|---|----------|--------|-----------------|
| 11.1 | Pending queue | Open Approvals | Shows `pending_senior_staff` reports |
| 11.2 | Approve | Approve a report | **No signature**; advances to supervisor |
| 11.3 | Request revision | Flag specific items | Employee gets revision flags |
| 11.4 | Weekly check-up | Employee shared weekly check-up on draft | **Only** Accept check-up — no Approve/Revision |
| 11.5 | View report | Open employee report | Review mode works |
| 11.6 | Comment / remind | Add comment or reminder | Notifications sent |

---

## 12. Web — Supervisor Portal

| # | Scenario | Steps | Expected result |
|---|----------|--------|-----------------|
| 12.1 | Pending queue | Open Approvals | Team reports pending supervisor |
| 12.2 | Approve | Certify + sign → approve | Moves to `pending_finance` |
| 12.3 | Request revision | Select items + notes | Employee sees revision flags |
| 12.4 | Weekly check-up | Open draft after weekly check-up | Accept check-up only; no monthly Approve |
| 12.5 | Team setup | Assign senior staff to report | Routing preview correct |
| 12.6 | Assign staff | Assign employees to supervisor | Shows **state + cost center**; search works |
| 12.7 | Contract utilization | View utilization tab | Data loads |
| 12.8 | Delegate / remind | Delegate or send reminder | Actions complete |

---

## 13. Web — Finance Portal

| # | Scenario | Steps | Expected result |
|---|----------|--------|-----------------|
| 13.1 | Pending queue | Open pending reports | Shows `pending_finance` for managed centers |
| 13.2 | Final approve | Sign and approve | Status → `approved`; employee locked |
| 13.3 | Revision to employee | Request revision | Employee notified appropriately |
| 13.4 | PDF export | Export report PDF | Downloads; totals correct |
| 13.5 | Map PDF | Export with maps enabled | Map PDF generates |
| 13.6 | Managed centers | Filter by assigned centers | Only relevant reports shown |

---

## 14. Web — Contracts Portal (read-only)

| # | Scenario | Steps | Expected result |
|---|----------|--------|-----------------|
| 14.1 | View reports | Browse all/pending/approved | Lists load |
| 14.2 | No approve | Inspect report actions | **No** Approve or Request Revision |
| 14.3 | Contract caps | View contract cap data | Displays without errors |
| 14.4 | Analytics | Open analytics | Read-only data loads |

---

## 15. Web — Admin Portal

### Employee and HR sync

| # | Scenario | Steps | Expected result |
|---|----------|--------|-----------------|
| 15.1 | Create employee | Add new employee | Can log in on mobile/web |
| 15.2 | Edit employee | Change cost centers, supervisor | Saves; reflects in portals |
| 15.3 | Archive employee | Archive inactive employee | Removed from active lists |
| 15.4 | HR sync — normal | Sync from HR API → apply | Creates/updates as expected |
| 15.5 | HR sync — email typo | Corrected local email (e.g. steven vs stevin) | No duplicate create; no archive |
| 15.6 | HR sync — name change | New HR email (e.g. feliciano vs sledge) | No duplicate create |
| 15.7 | HR sync — ignore | “Don’t ask again” on update/archive | Persists on next sync |
| 15.8 | Dedupe by email | Run dedupe if duplicates exist | Extra rows merged |

### Supervisor and configuration

| # | Scenario | Steps | Expected result |
|---|----------|--------|-----------------|
| 15.9 | Promote supervisor | Promote to supervisor | Supervisor portal access works |
| 15.10 | Promote senior staff | Promote to senior staff | Senior staff portal works |
| 15.11 | Orphaned staff | Staff on archived supervisor | Alert shows; release works |
| 15.12 | Per diem rules | Set single and tiered per diem | Mobile/web follow rules |
| 15.13 | Notifications | Toggle workflow events | Emails respect toggles |
| 15.14 | Audit log | Perform admin action | Appears in audit log |

---

## 16. End-to-end approval workflows

Run these with **different accounts** (or testers playing each role).

### 16A — Full chain (with senior staff)

1. Staff completes and **submits** report  
2. **Senior staff** approves (no sign) → `pending_supervisor`  
3. **Supervisor** approves with signature → `pending_finance`  
4. **Finance** approves with signature → `approved`  
5. Staff confirms report is **locked**

### 16B — Full chain (no senior staff)

1. Staff submits → `pending_supervisor`  
2. Supervisor → Finance → Approved  

### 16C — Revision from supervisor

1. Staff submits  
2. Supervisor requests revision on **one mileage + one receipt**  
3. Staff fixes and **resubmits**  
4. Approval chain restarts correctly  

### 16D — Revision from finance

1. Report reaches finance  
2. Finance requests revision to **employee**  
3. Staff fixes and resubmits  

### 16E — Weekly check-up (not monthly approval)

1. Staff shares **weekly check-up** on draft report  
2. Supervisor opens report → **Accept check-up only**  
3. Supervisor accepts → employee notified  
4. Monthly report still **draft** until formal submit  

---

## 17. Cross-platform sync matrix

| Data type | Enter mobile → verify web | Enter web → verify mobile |
|-----------|---------------------------|---------------------------|
| GPS mileage | ✓ | — |
| Manual mileage | ✓ | ✓ |
| Receipt | ✓ | ✓ |
| Daily hours | ✓ | — |
| Day off / PTO | ✓ | ✓ |
| Per diem | ✓ | ✓ |
| My Flock | ✓ | ✓ (Settings) |
| Description | ✓ | ✓ |

---

## 18. Notifications

| # | Scenario | Expected result |
|---|----------|-----------------|
| 18.1 | Report submitted | First approver notified |
| 18.2 | Approval step | Next approver notified |
| 18.3 | Revision requested | Employee notified |
| 18.4 | Weekly check-up | Senior staff + supervisor notified |
| 18.5 | Click notification | Navigates to correct report/month |
| 18.6 | Mark read | Count decreases correctly |

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

| # | Scenario | Expected result |
|---|----------|-----------------|
| 20.1 | Month boundary | Entries on last/first day appear in correct month |
| 20.2 | Multi cost center | Hours/mileage split correctly; export odometer continuous |
| 20.3 | Large report | Full month saves/submits/PDF without timeout |
| 20.4 | Archived supervisor | Routing skips archived; admin repair available |
| 20.5 | Session expiry | Friendly re-login on web |
| 20.6 | Portal switcher | Only allowed portals shown |

---

## Suggested test schedule

| Week | Focus |
|------|--------|
| **Week 1** | Mobile (sections 1–9) + sync matrix (17) |
| **Week 2** | Staff Portal (10) + regression (19) |
| **Week 3** | Approval workflows (16) + Senior Staff / Supervisor / Finance (11–13) |
| **Week 4** | Admin + HR sync (15) + Contracts (14) + edge cases (20) |

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

*Oxford House, Inc. — internal beta testing document. Questions: contact your test coordinator.*
