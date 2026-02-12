# Pre-commit mobile app checklist

**Use this before committing and testing in dev.**

---

## Changes in this batch

- **Home (dashboard)** – Bottom padding so “Saved Addresses” isn’t covered by Android nav; removed unused code (handleEditEntry, handleDeleteEntry, formatDate, formatLocationRoute).
- **Android date picker** – Mileage Entry and Add Receipt: date picker no longer gets stuck; OK/Cancel close properly (native picker only on Android, no Modal).
- **Cleanup** – Removed date-picker debug logs from MileageEntryScreen.

---

## Quick test (local)

1. **Start the app**
   ```bash
   npx expo start
   ```
   Phone and PC on same Wi‑Fi; scan QR in Expo Go.

2. **Home screen**
   - [ ] Scroll to bottom. “Saved Addresses” (and other tiles) are fully visible above the Android nav bar (no overlap).
   - [ ] Same on iOS: small bottom spacing looks fine.

3. **Date picker (Android)**
   - [ ] **Mileage Entry** – Tap Date → pick a date → tap OK. Picker closes once (doesn’t pop back).
   - [ ] Same flow → tap Cancel. Picker closes once.
   - [ ] **Add Receipt** – Tap Date → OK or Cancel. Picker closes once.

4. **Date picker (iOS)**
   - [ ] Mileage Entry and Add Receipt – Modal with Done/Cancel still works as before.

5. **Receipts screen date filters**
   - [ ] Start/End date pickers still work on both platforms.

---

## Before commit

- [ ] Local tests above passed.
- [ ] `npm run lint` (or project lint command) passes if you use it.
- [ ] No unintended changes (review `git status` / diff).

---

## After push to dev

- [ ] Install/update app from dev build or Expo dev channel.
- [ ] Smoke test: open app, home, add mileage (date picker), add receipt (date picker), scroll home to bottom.
- [ ] Confirm no regressions in sync, per diem, or other flows you care about.

---

*Update or delete this file after you’re done with this release.*
