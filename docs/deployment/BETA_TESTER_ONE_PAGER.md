# Oxford House Expense Tracker - Beta One-Pager

Use this quick guide to get set up and focus on the highest-value testing this week.

## 1) Beta mission

- Use the app in real day-to-day workflows.
- Report bugs, confusion, and friction quickly.
- Keep using your normal expense process during beta (do not switch fully to this app yet).

## 2) Get access fast

### iPhone (TestFlight)

- Install TestFlight: [https://apps.apple.com/us/app/testflight/id899247664](https://apps.apple.com/us/app/testflight/id899247664)
- Accept the Apple team invite first, then install/update the app from TestFlight.

### Android (Internal testing)

- Join internal test: [https://play.google.com/apps/internaltest/4701544356101901260](https://play.google.com/apps/internaltest/4701544356101901260)
- Update from Google Play when a new test build appears.

### Web Portal

- Web Portal Login: [https://oxford-mileage-tracker.vercel.app/login](https://oxford-mileage-tracker.vercel.app/login)

## 3) Highest-priority tests this cycle

### A. GPS address precision (mobile)

- Start and stop GPS trips using location capture.
- Verify addresses are complete (street number + street + city/state).
- Confirm the reminder to verify street number is shown.

### B. Manual mileage date behavior (mobile)

- Save a manual mileage entry on an older date.
- Switch to a different date and verify odometer does not carry over incorrectly.

### C. Hours and Descriptions controls (Android)

- Edit a day, dismiss keyboard with Done, and verify Save/Cancel controls stay stable and tappable.
- Scroll near the bottom and verify header actions hide as expected.

### D. Cost-center odometer continuity (web + export)

- For multi-cost-center users, verify CC2 starts where CC1 ends, CC3 starts where CC2 ends, etc.
- Confirm exported report values match tab behavior.

## 4) Submit feedback

- Feedback form: [https://forms.gle/vmUf6qzESDk5uTai8](https://forms.gle/vmUf6qzESDk5uTai8)
- Quick link: [https://tinyurl.com/ExpenseTracker-Feedback](https://tinyurl.com/ExpenseTracker-Feedback)

When submitting, include:

- Device + OS version
- App area tested (GPS, Mileage Entry, Hours, Staff Portal, Export)
- Exact date(s) used
- Screenshot or screen recording when possible

## 5) Reference docs

- Support page (all guides): [https://oxford-mileage-tracker.vercel.app/support.html](https://oxford-mileage-tracker.vercel.app/support.html)
- Full beta packet: `docs/deployment/BETA_TESTER_PACKET.md`
- PDF beta packet: `docs/deployment/BETA_TESTER_PACKET.pdf`
