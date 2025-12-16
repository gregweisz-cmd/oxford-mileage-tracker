# Fix Logout Errors

## Issues Fixed

### ✅ 1. "missing_token" Error After Logout
**Fixed!** The login page now ignores "missing_token" errors since they're not user-facing.

### ⚠️ 2. manifest.json 401 Error
**Not Critical** - This is just a PWA manifest file for "Add to Home Screen" functionality. The app works fine without it.

**The 401 error happens because:**
- Vercel might be routing requests through authentication
- Or the file path needs to be configured differently

**To Fix (Optional):**
1. Check if manifest.json is in `admin-web/public/` folder ✅ (it is)
2. Vercel should serve files from `public/` automatically
3. The 401 might be a Vercel configuration issue

**Since it's not critical, you can:**
- Ignore the error (app works fine)
- Or check Vercel settings for static file serving

## Changes Made

✅ **Login.tsx** - Now ignores "missing_token" errors  
✅ **App.tsx** - Logout clears URL properly

## Commit and Deploy

The fixes are ready! Commit and push:

```powershell
cd C:\Users\GooseWeisz\oxford-mileage-tracker
git add admin-web/src/App.tsx admin-web/src/components/Login.tsx
git commit -m "Fix logout to hide missing_token error"
git push origin main
```

After Vercel deploys (2-3 minutes), the "missing_token" error after logout will be gone!

