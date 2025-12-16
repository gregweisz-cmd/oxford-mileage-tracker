# Deploy Google OAuth to Vercel

## ✅ Current Status

- ✅ Code changes made locally
- ✅ Backend environment variables set in Render
- ⏳ Frontend code needs to be deployed to Vercel

## 📋 Files Changed (Need to Deploy)

These files were modified for Google OAuth:

1. **`admin-web/src/components/Login.tsx`** - Added Google sign-in button
2. **`admin-web/src/components/AuthCallback.tsx`** - New file for OAuth callback
3. **`admin-web/src/App.tsx`** - Added callback route handling

## 🚀 Deployment Steps

### Option 1: Auto-Deploy via GitHub (Easiest)

If your Vercel project is connected to GitHub:

1. **Commit the changes:**
   ```powershell
   cd C:\Users\GooseWeisz\oxford-mileage-tracker
   git add admin-web/src/components/Login.tsx
   git add admin-web/src/components/AuthCallback.tsx
   git add admin-web/src/App.tsx
   git commit -m "Add Google OAuth login functionality"
   git push origin main
   ```

2. **Vercel will auto-deploy** (usually takes 2-3 minutes)

3. **Check deployment status:**
   - Go to https://vercel.com/dashboard
   - Find your project
   - Check the latest deployment

### Option 2: Manual Deploy via Vercel CLI

If you prefer manual deployment:

1. **Install Vercel CLI** (if not already installed):
   ```powershell
   npm install -g vercel
   ```

2. **Navigate to frontend directory:**
   ```powershell
   cd C:\Users\GooseWeisz\oxford-mileage-tracker\admin-web
   ```

3. **Login to Vercel:**
   ```powershell
   vercel login
   ```

4. **Deploy to production:**
   ```powershell
   vercel --prod
   ```

5. **Follow the prompts:**
   - Link to existing project? Yes
   - Select your project
   - It will build and deploy

### Option 3: Deploy via Vercel Dashboard

1. **Go to Vercel Dashboard:**
   - Visit https://vercel.com/dashboard
   - Find your project (oxford-mileage-tracker)

2. **Trigger deployment:**
   - Click on your project
   - Go to "Deployments" tab
   - Click "Redeploy" or "Deploy" (if code is already pushed to GitHub)

## ✅ Verify Deployment

After deployment completes:

1. **Visit your Vercel URL:**
   ```
   https://oxford-mileage-tracker-git-main-goose-weiszs-projects.vercel.app
   ```

2. **Check for Google login button:**
   - Go to the login page
   - You should see:
     - Email/Password fields
     - "OR" divider
     - "Sign in with Google" button

3. **Test Google OAuth:**
   - Click "Sign in with Google"
   - Should redirect to Google login
   - After login, should redirect back to app

## 🔍 Troubleshooting

### Button Not Appearing
- Clear browser cache
- Hard refresh (Ctrl+Shift+R or Cmd+Shift+R)
- Check Vercel deployment logs for build errors

### Build Fails
- Check Vercel logs for error messages
- Verify all dependencies are in `package.json`
- Check that `AuthCallback.tsx` was committed

### OAuth Not Working After Deploy
- Verify backend environment variables are set in Render
- Check that `FRONTEND_URL` in Render matches your Vercel URL
- Check Render backend logs for errors

## 📝 Quick Checklist

- [ ] Commit Google OAuth code changes
- [ ] Push to GitHub (if using auto-deploy)
- [ ] Deploy to Vercel (manual or auto)
- [ ] Verify deployment succeeded
- [ ] Check login page for Google button
- [ ] Test Google OAuth login
- [ ] Verify redirect works correctly

## 🎉 Success!

Once deployed, users will be able to:
- See "Sign in with Google" button on login page
- Click to sign in with their Google account
- Get automatically logged in after OAuth flow

---

**Next Steps:**
1. Deploy the frontend code (choose one of the options above)
2. Test the Google login on your Vercel deployment
3. Done! 🎉

