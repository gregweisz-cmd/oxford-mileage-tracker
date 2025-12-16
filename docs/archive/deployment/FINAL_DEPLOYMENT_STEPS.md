# Final Deployment Steps - Google OAuth

## 🎯 What You Need to Do

Based on your git status, here's exactly what to run:

### Step 1: Stage All Google OAuth Files

```powershell
cd C:\Users\GooseWeisz\oxford-mileage-tracker

# Add new files (if they exist)
git add admin-web/src/components/AuthCallback.tsx
git add admin-web/src/components/ErrorBoundary.tsx

# Add modified files (these definitely exist)
git add admin-web/src/components/Login.tsx
git add admin-web/src/App.tsx
git add admin-web/src/config/debug.ts
git add admin-web/backend/routes/auth.js
git add admin-web/backend/package.json
```

### Step 2: Commit

```powershell
git commit -m "Add Google OAuth login functionality (frontend + backend)"
```

### Step 3: Push to GitHub

```powershell
git push origin main
```

## ⏳ After Pushing

1. **Vercel** will auto-deploy frontend (2-3 minutes)
2. **Render** will auto-deploy backend (3-5 minutes)
3. Check dashboards to verify deployments

## ✅ Files That MUST Be Committed

**Frontend:**
- ✅ `admin-web/src/components/AuthCallback.tsx` - OAuth callback handler
- ✅ `admin-web/src/components/ErrorBoundary.tsx` - Error boundary component
- ✅ `admin-web/src/components/Login.tsx` - Google sign-in button
- ✅ `admin-web/src/App.tsx` - OAuth route handling
- ✅ `admin-web/src/config/debug.ts` - Has debugVerbose export

**Backend:**
- ✅ `admin-web/backend/routes/auth.js` - Google OAuth routes
- ✅ `admin-web/backend/package.json` - google-auth-library dependency

## 🔍 Verify Files Exist

Check if these files exist before committing:

```powershell
Test-Path "admin-web/src/components/AuthCallback.tsx"
Test-Path "admin-web/src/components/ErrorBoundary.tsx"
```

If they return `True`, they exist. If `False`, we need to check what happened.

## 🚀 Quick One-Liner

```powershell
cd C:\Users\GooseWeisz\oxford-mileage-tracker && git add admin-web/src/components/AuthCallback.tsx admin-web/src/components/ErrorBoundary.tsx admin-web/src/components/Login.tsx admin-web/src/App.tsx admin-web/src/config/debug.ts admin-web/backend/routes/auth.js admin-web/backend/package.json && git commit -m "Add Google OAuth login functionality" && git push origin main
```

