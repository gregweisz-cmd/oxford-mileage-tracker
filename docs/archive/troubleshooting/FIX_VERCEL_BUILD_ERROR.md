# Fix Vercel Build Error - ErrorBoundary Not Found

## ❌ Error
```
Module not found: Error: Can't resolve './components/ErrorBoundary' in '/vercel/path0/admin-web/src'
```

## 🔍 Problem

The `ErrorBoundary.tsx` file exists locally but might not be committed to git, so Vercel can't find it during the build.

## ✅ Solution

Make sure **ErrorBoundary.tsx** is committed to git. Run these commands:

```powershell
cd C:\Users\GooseWeisz\oxford-mileage-tracker

# Add ErrorBoundary if it's not committed
git add admin-web/src/components/ErrorBoundary.tsx

# Also add the Google OAuth files
git add admin-web/src/components/AuthCallback.tsx
git add admin-web/src/components/Login.tsx
git add admin-web/src/App.tsx
git add admin-web/backend/routes/auth.js
git add admin-web/backend/package.json

# Commit everything
git commit -m "Add Google OAuth and ensure ErrorBoundary is committed"

# Push to GitHub
git push origin main
```

## 🔍 Verify Files Are Committed

Check if ErrorBoundary is in git:

```powershell
git ls-files admin-web/src/components/ErrorBoundary.tsx
```

If it returns the file path, it's committed. If not, you need to add it.

## 📋 Complete File List to Commit

Make sure all these files are committed:

- ✅ `admin-web/src/components/ErrorBoundary.tsx`
- ✅ `admin-web/src/components/AuthCallback.tsx`
- ✅ `admin-web/src/components/Login.tsx`
- ✅ `admin-web/src/App.tsx`
- ✅ `admin-web/backend/routes/auth.js`
- ✅ `admin-web/backend/package.json`

## 🚀 After Fixing

1. Commit all files (including ErrorBoundary)
2. Push to GitHub
3. Wait for Vercel to rebuild
4. Build should succeed!

