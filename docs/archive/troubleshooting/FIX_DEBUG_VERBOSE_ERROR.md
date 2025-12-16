# Fix Vercel Build Error - debugVerbose Not Exported

## ❌ Error
```
Attempted import error: 'debugVerbose' is not exported from './config/debug' (imported as 'debugVerbose').
```

## 🔍 Problem

The `debugVerbose` function exists locally in `debug.ts` but the version on Vercel doesn't have it exported. The file needs to be committed to git.

## ✅ Solution

Make sure `debug.ts` is committed with the `debugVerbose` export:

```powershell
cd C:\Users\GooseWeisz\oxford-mileage-tracker

# Add debug.ts (contains debugVerbose export)
git add admin-web/src/config/debug.ts

# Also add all other Google OAuth files
git add admin-web/src/components/ErrorBoundary.tsx
git add admin-web/src/components/AuthCallback.tsx
git add admin-web/src/components/Login.tsx
git add admin-web/src/App.tsx
git add admin-web/backend/routes/auth.js
git add admin-web/backend/package.json

# Commit everything
git commit -m "Add Google OAuth and fix debugVerbose export"

# Push to GitHub
git push origin main
```

## 📝 Files That Use debugVerbose

These files import `debugVerbose`, so debug.ts must have it:
- `admin-web/src/App.tsx`
- `admin-web/src/StaffPortal.tsx`
- `admin-web/src/components/AdminPortal.tsx`
- `admin-web/src/components/FinancePortal.tsx`
- `admin-web/src/services/perDiemRulesService.ts`
- And more...

## ✅ After Fixing

1. Commit debug.ts with debugVerbose export
2. Push to GitHub
3. Wait for Vercel to rebuild
4. Build should succeed!

