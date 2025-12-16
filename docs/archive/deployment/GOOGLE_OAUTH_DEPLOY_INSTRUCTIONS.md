# Deploy Google OAuth to Vercel - Instructions

## ✅ Files Ready for Deployment

The following files have been modified/created:

1. ✅ `admin-web/src/components/Login.tsx` - Added Google sign-in button
2. ✅ `admin-web/src/components/AuthCallback.tsx` - New OAuth callback component
3. ✅ `admin-web/src/App.tsx` - Added callback handling
4. ✅ `admin-web/backend/routes/auth.js` - Added OAuth routes
5. ✅ `admin-web/backend/package.json` - Added google-auth-library

## 🚀 Deployment Steps

### Method 1: Git Push (Recommended - Auto-deploys to Vercel)

**Run these commands in PowerShell:**

```powershell
# Navigate to project
cd C:\Users\GooseWeisz\oxford-mileage-tracker

# Stage all Google OAuth changes
git add admin-web/src/components/Login.tsx
git add admin-web/src/components/AuthCallback.tsx
git add admin-web/src/App.tsx
git add admin-web/backend/routes/auth.js
git add admin-web/backend/package.json

# Commit
git commit -m "Add Google OAuth login functionality"

# Push to GitHub
git push origin main
```

**What happens:**
- Code is pushed to GitHub
- Vercel detects the push (if connected to GitHub)
- Vercel automatically builds and deploys
- Deployment takes 2-3 minutes

### Method 2: Use Deployment Script

I've created a script for you:

```powershell
cd C:\Users\GooseWeisz\oxford-mileage-tracker
.\deploy-google-oauth.ps1
```

This script will:
- Verify all files exist
- Stage and commit changes
- Push to GitHub
- Or use Vercel CLI if available

### Method 3: Vercel CLI (Direct Deployment)

If you have Vercel CLI installed:

```powershell
cd C:\Users\GooseWeisz\oxford-mileage-tracker\admin-web

# Build first (optional but recommended)
npm run build

# Deploy to production
vercel --prod
```

## ✅ After Deployment

1. **Wait 2-3 minutes** for Vercel to deploy

2. **Check deployment status:**
   - Go to: https://vercel.com/dashboard
   - Find your project
   - Check the latest deployment

3. **Visit your site:**
   - URL: https://oxford-mileage-tracker-git-main-goose-weiszs-projects.vercel.app
   - Go to login page
   - You should see the "Sign in with Google" button!

4. **Test Google OAuth:**
   - Click "Sign in with Google"
   - Should redirect to Google login
   - After login, should redirect back to app

## 🔍 Verify Deployment

After deployment, you should see:
- ✅ "Sign in with Google" button on login page
- ✅ Button is styled and functional
- ✅ OAuth flow works end-to-end

## 📝 Quick Checklist

- [ ] Stage files with `git add`
- [ ] Commit with `git commit`
- [ ] Push with `git push origin main`
- [ ] Wait for Vercel deployment (2-3 min)
- [ ] Check Vercel dashboard for deployment status
- [ ] Visit site and verify Google button appears
- [ ] Test Google OAuth login

## 🎉 Ready!

Once you run the deployment commands above, Google OAuth will be live on your Vercel site!

---

**Need help?** Check:
- `DEPLOY_GOOGLE_OAUTH_TO_VERCEL.md` - Detailed guide
- `GOOGLE_OAUTH_DEPLOYMENT_SUMMARY.md` - Quick summary

