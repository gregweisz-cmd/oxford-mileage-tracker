# Fix All Vercel Build Errors

## ❌ Errors Found

1. **ErrorBoundary not found**
   - `Module not found: Error: Can't resolve './components/ErrorBoundary'`

2. **debugVerbose not exported**
   - `Attempted import error: 'debugVerbose' is not exported from './config/debug'`

## 🔍 Root Cause

Both files exist locally but aren't committed to git, so Vercel can't find them during build.

## ✅ Complete Fix - Run These Commands

```powershell
cd C:\Users\GooseWeisz\oxford-mileage-tracker

# Add ALL required files
git add admin-web/src/config/debug.ts                    # Has debugVerbose export
git add admin-web/src/components/ErrorBoundary.tsx       # Error boundary component
git add admin-web/src/components/AuthCallback.tsx        # Google OAuth callback
git add admin-web/src/components/Login.tsx               # Login with Google button
git add admin-web/src/App.tsx                            # OAuth route handling
git add admin-web/backend/routes/auth.js                 # OAuth backend routes
git add admin-web/backend/package.json                   # google-auth-library

# Check what will be committed
git status

# Commit everything
git commit -m "Add Google OAuth login and fix missing exports (ErrorBoundary, debugVerbose)"

# Push to GitHub (Vercel will auto-redeploy)
git push origin main
```

## 📋 Files Being Added

1. ✅ `admin-web/src/config/debug.ts` - **CRITICAL** - Has `debugVerbose` export
2. ✅ `admin-web/src/components/ErrorBoundary.tsx` - **CRITICAL** - Error boundary component
3. ✅ `admin-web/src/components/AuthCallback.tsx` - Google OAuth callback handler
4. ✅ `admin-web/src/components/Login.tsx` - Google sign-in button
5. ✅ `admin-web/src/App.tsx` - OAuth route handling
6. ✅ `admin-web/backend/routes/auth.js` - OAuth backend routes
7. ✅ `admin-web/backend/package.json` - google-auth-library dependency

## ✅ After Committing & Pushing

1. Wait 2-3 minutes for Vercel to rebuild
2. Check Vercel dashboard for build status
3. Build should succeed!
4. Visit your site - Google login button should appear!

## 🎯 Quick Command (Copy/Paste)

```powershell
cd C:\Users\GooseWeisz\oxford-mileage-tracker && git add admin-web/src/config/debug.ts admin-web/src/components/ErrorBoundary.tsx admin-web/src/components/AuthCallback.tsx admin-web/src/components/Login.tsx admin-web/src/App.tsx admin-web/backend/routes/auth.js admin-web/backend/package.json && git commit -m "Add Google OAuth and fix missing exports" && git push origin main
```

