# Deploy Backend to Render - Google OAuth Routes Missing

## ❌ Current Problem

The backend on Render.com is returning:
```
Cannot GET /api/auth/google
404 (Not Found)
```

This means the Google OAuth routes haven't been deployed to Render yet.

## ✅ Solution: Deploy Backend Code

### Step 1: Commit and Push Backend Changes

Run these commands:

```powershell
cd C:\Users\GooseWeisz\oxford-mileage-tracker

# Add backend files
git add admin-web/backend/routes/auth.js
git add admin-web/backend/package.json

# Commit
git commit -m "Add Google OAuth routes to backend"

# Push to GitHub
git push origin main
```

### Step 2: Wait for Render to Deploy

- Render will auto-deploy from GitHub
- Check: https://dashboard.render.com
- Look for your backend service
- Deployment takes 3-5 minutes

### Step 3: Verify Environment Variables

In Render.com → Your backend service → Environment tab, make sure these are set:

```
GOOGLE_CLIENT_ID=893722301667-bqc8ir7q35omj6s84l7ackvqoqrhtrv6.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=YOUR_CLIENT_SECRET_FROM_GOOGLE_CLOUD
GOOGLE_REDIRECT_URI=https://oxford-mileage-backend.onrender.com/api/auth/google/callback
FRONTEND_URL=https://oxford-mileage-tracker-git-main-goose-weiszs-projects.vercel.app
```

### Step 4: Test After Deployment

After Render finishes deploying, test:
```
https://oxford-mileage-backend.onrender.com/api/auth/google
```

Should redirect to Google (not 404 error).

## 📝 Complete Deployment Checklist

### Frontend (Vercel)
- [ ] All frontend files committed (Login.tsx, AuthCallback.tsx, App.tsx, ErrorBoundary.tsx, debug.ts)
- [ ] Pushed to GitHub
- [ ] Vercel deployed successfully

### Backend (Render)
- [ ] Backend routes committed (auth.js with Google OAuth)
- [ ] package.json updated (google-auth-library)
- [ ] Pushed to GitHub
- [ ] Render deployed successfully
- [ ] Environment variables set in Render
- [ ] Backend service restarted

## 🎯 Quick Fix Commands

```powershell
cd C:\Users\GooseWeisz\oxford-mileage-tracker

# Deploy backend
git add admin-web/backend/routes/auth.js admin-web/backend/package.json
git commit -m "Add Google OAuth backend routes"
git push origin main

# Wait 3-5 minutes, then check Render dashboard
```

