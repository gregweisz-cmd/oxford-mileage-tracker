# Fix Vercel Build - Commit All Required Files

## The Problem

Vercel build is failing because `ErrorBoundary.tsx` is not found. This file needs to be committed to git.

## Solution - Run These Commands

```powershell
cd C:\Users\GooseWeisz\oxford-mileage-tracker

# Stage ALL required files (including ErrorBoundary)
git add admin-web/src/components/ErrorBoundary.tsx
git add admin-web/src/components/AuthCallback.tsx
git add admin-web/src/components/Login.tsx
git add admin-web/src/App.tsx
git add admin-web/backend/routes/auth.js
git add admin-web/backend/package.json

# Check what will be committed
git status

# Commit everything
git commit -m "Add Google OAuth login and ensure all components are committed"

# Push to GitHub (Vercel will auto-redeploy)
git push origin main
```

## Alternative: Add All Changes

If you want to add everything at once:

```powershell
cd C:\Users\GooseWeisz\oxford-mileage-tracker

# Add all changes in admin-web/src
git add admin-web/src/

# Add backend changes
git add admin-web/backend/routes/auth.js
git add admin-web/backend/package.json

# Commit
git commit -m "Add Google OAuth login functionality"

# Push
git push origin main
```

## After Pushing

1. Wait 2-3 minutes for Vercel to rebuild
2. Check Vercel dashboard for build status
3. Build should now succeed!

