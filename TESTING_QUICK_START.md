# Quick Start Testing Guide

**Status**: ✅ Ready for Testing

---

## 🚀 Quick Test (5 minutes)

### 1. Start Development Server
```bash
cd admin-web
npm start
```

### 2. Check Console
- Open browser console (F12)
- Should see debug logs with emojis: `📊`, `✅`, `❌`
- Example: `📊 Loaded reports: 15 reports`

### 3. Test Production Build
```bash
cd admin-web
npm run build
npx serve -s build
```
- Console should be **clean** (no debug logs)
- Only errors should appear

---

## ✅ What to Verify

- [ ] All portals load correctly
- [ ] Debug logs appear in development
- [ ] Console is clean in production
- [ ] Errors still log in both modes
- [ ] No broken features

---

## 📚 Full Testing Guide

See: `docs/developer/TESTING_GUIDE_DEBUG_LOGGING.md`

---

**Everything is ready!** 🎉

