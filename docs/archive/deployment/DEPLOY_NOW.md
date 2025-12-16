# Deploy Google OAuth to Vercel - Quick Commands

## Run These Commands

Open PowerShell in the project directory and run:

```powershell
cd C:\Users\GooseWeisz\oxford-mileage-tracker

# Stage the Google OAuth files
git add admin-web/src/components/Login.tsx
git add admin-web/src/components/AuthCallback.tsx  
git add admin-web/src/App.tsx
git add admin-web/backend/routes/auth.js
git add admin-web/backend/package.json

# Commit
git commit -m "Add Google OAuth login functionality"

# Push to GitHub (Vercel will auto-deploy)
git push origin main
```

## Or Use the Deployment Script

I've created a deployment script for you:

```powershell
cd C:\Users\GooseWeisz\oxford-mileage-tracker
.\deploy-google-oauth.ps1
```

## After Deployment

1. Wait 2-3 minutes for Vercel to auto-deploy
2. Check Vercel dashboard: https://vercel.com/dashboard
3. Visit your site: https://oxford-mileage-tracker-git-main-goose-weiszs-projects.vercel.app
4. Go to login page - you should see "Sign in with Google" button!

## Alternative: Deploy via Vercel CLI

If Git push doesn't work:

```powershell
cd C:\Users\GooseWeisz\oxford-mileage-tracker\admin-web
vercel --prod
```

