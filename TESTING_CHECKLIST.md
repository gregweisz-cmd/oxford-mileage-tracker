# Testing Checklist - Debug Logging

**Date**: December 2025

---

## ✅ Development Mode Testing

### Console Output Check
- [ ] Open browser console (F12)
- [ ] Navigate to Staff Portal
- [ ] Look for debug logs with emojis:
  - `📊 Loaded reports:`
  - `✅ PDF export completed`
  - `❌ Error loading reports:`
- [ ] Verify logs are helpful and informative

### Functionality Check
- [ ] **Staff Portal**
  - [ ] Login works
  - [ ] Load expense report
  - [ ] Save changes (check console for save logs)
  - [ ] Submit report (check console for submission logs)
  
- [ ] **Supervisor Portal**
  - [ ] View team reports
  - [ ] Approve/reject reports
  - [ ] Check console for action logs
  
- [ ] **Finance Portal**
  - [ ] View all reports
  - [ ] Export PDF (check console for export logs)
  - [ ] Approve reports

### Error Testing
- [ ] Trigger an error (disconnect network, invalid data)
- [ ] Verify error appears in console
- [ ] Verify error message is helpful

---

## ✅ Production Build Testing

### Build Production
```bash
cd admin-web
npm run build
npx serve -s build
```

### Console Check
- [ ] Open browser console (F12)
- [ ] Navigate through portals
- [ ] **Verify**: Console is CLEAN (no debug logs)
- [ ] **Verify**: Only errors appear when errors occur
- [ ] **Verify**: No emoji prefixes in production

### Functionality Check
- [ ] All portals work normally
- [ ] No broken features
- [ ] Errors still handled correctly

---

## 📝 Notes

Write any issues or observations here:

_________________________________________________
_________________________________________________
_________________________________________________

---

## ✅ Final Verification

- [ ] Development: Debug logs appear ✅
- [ ] Development: All features work ✅
- [ ] Production: Console is clean ✅
- [ ] Production: Errors still log ✅
- [ ] Production: All features work ✅

---

**Status**: _________________________

