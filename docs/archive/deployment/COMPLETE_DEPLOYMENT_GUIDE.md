# Complete Deployment Guide - Google OAuth

## ❌ Current Errors

1. **Frontend Build Error:** `debugVerbose` not exported
2. **Backend 404 Error:** `Cannot GET /api/auth/google`

## ✅ Solution: Deploy Both Frontend AND Backend

### Part 1: Deploy Frontend (Vercel)

```powershell
cd C:\Users\GooseWeisz\oxford-mileage-tracker

# Add all frontend files
git add admin-web/src/config/debug.ts                    # Has debugVerbose
git add admin-web/src/components/ErrorBoundary.tsx       # Error boundary
git add admin-web/src/components/AuthCallback.tsx        # OAuth callback
git add admin-web/src/components/Login.tsx               # Google button
git add admin-web/src/App.tsx                            # OAuth routes

# Commit
git commit -m "Add Google OAuth frontend - fix debugVerbose export"

# Push
git push origin main
```

### Part 2: Deploy Backend (Render)

```powershell
# Still in oxford-mileage-tracker directory

# Add backend files
git add admin-web/backend/routes/auth.js                 # Google OAuth routes
git add admin-web/backend/package.json                   # google-auth-library

# Commit
git commit -m "Add Google OAuth backend routes"

# Push
git push origin main
```

### Part 3: Verify Environment Variables (Render)

Go to Render.com → Your backend service → Environment tab:

```
GOOGLE_CLIENT_ID=893722301667-bqc8ir7q35omj6s84l7ackvqoqrhtrv6.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=YOUR_CLIENT_SECRET_HERE
GOOGLE_REDIRECT_URI=https://oxford-mileage-backend.onrender.com/api/auth/google/callback
FRONTEND_URL=https://oxford-mileage-tracker-git-main-goose-weiszs-projects.vercel.app
```

## 🚀 Quick Deploy (All at Once)

```powershell
cd C:\Users\GooseWeisz\oxford-mileage-tracker

# Add everything
git add admin-web/src/config/debug.ts
git add admin-web/src/components/ErrorBoundary.tsx
git add admin-web/src/components/AuthCallback.tsx
git add admin-web/src/components/Login.tsx
git add admin-web/src/App.tsx
git add admin-web/backend/routes/auth.js
git add admin-web/backend/package.json

# Commit
git commit -m "Add Google OAuth login functionality (frontend + backend)"

# Push
git push origin main
```

## ⏳ After Pushing

1. **Wait 3-5 minutes** for deployments
2. **Check Vercel:** https://vercel.com/dashboard (frontend)
3. **Check Render:** https://dashboard.render.com (backend)
4. **Test:** Visit login page - should see Google button
5. **Test:** Click button - should redirect to Google (not 404)

## ✅ Success Checklist

- [ ] Frontend deployed to Vercel (no build errors)
- [ ] Backend deployed to Render (no errors)
- [ ] Environment variables set in Render
- [ ] `/api/auth/google` route works (not 404)
- [ ] Google login button appears on login page
- [ ] OAuth flow works end-to-end

