# 🔧 Fix Google OAuth Redirect to Localhost

## Problem
Clicking "Sign In with Google" redirects to `localhost:3002` instead of your production backend.

## Root Cause
Missing environment variables on Vercel and Render.

## ✅ Solution: Set Environment Variables

### **Step 1: Set on Vercel (Frontend)**

1. Go to: https://vercel.com/dashboard
2. Select your project
3. **Settings** → **Environment Variables**
4. Click **Add New**
5. Add:
   - **Name**: `REACT_APP_API_URL`
   - **Value**: `https://oxford-mileage-backend.onrender.com`
   - **Environments**: ✅ Production ✅ Preview ✅ Development
6. Click **Save**
7. Wait 2-3 minutes for Vercel to redeploy

### **Step 2: Set on Render (Backend)**

1. Go to: https://dashboard.render.com
2. Select **oxford-mileage-backend**
3. Go to **Environment** tab
4. Add these variables (click **Add Environment Variable** for each):

#### Variable 1: FRONTEND_URL
- **Key**: `FRONTEND_URL`
- **Value**: `https://oxford-mileage-tracker-git-main-goose-weiszs-projects.vercel.app`
- Click **Save Changes**

#### Variable 2: GOOGLE_REDIRECT_URI
- **Key**: `GOOGLE_REDIRECT_URI`
- **Value**: `https://oxford-mileage-backend.onrender.com/api/auth/google/callback`
- Click **Save Changes**

#### Variable 3: API_BASE_URL
- **Key**: `API_BASE_URL`
- **Value**: `https://oxford-mileage-backend.onrender.com`
- Click **Save Changes**

#### Variable 4: GOOGLE_CLIENT_ID
- **Key**: `GOOGLE_CLIENT_ID`
- **Value**: `893722301667-bqc8ir7q35omj6s84l7ackvqoqrhtrv6.apps.googleusercontent.com`
- Click **Save Changes**

#### Variable 5: GOOGLE_CLIENT_SECRET
- **Key**: `GOOGLE_CLIENT_SECRET`
- **Value**: `[Get this from Google Cloud Console - see below]`
- Click **Save Changes**

**To get GOOGLE_CLIENT_SECRET:**
1. Go to: https://console.cloud.google.com
2. **APIs & Services** → **Credentials**
3. Click your OAuth 2.0 Client ID
4. Copy the **Client secret**
5. Paste it in Render

### **Step 3: Update Google Cloud Console**

1. Go to: https://console.cloud.google.com
2. **APIs & Services** → **Credentials**
3. Click your OAuth 2.0 Client ID
4. Under **Authorized redirect URIs**, make sure you have:
   ```
   https://oxford-mileage-backend.onrender.com/api/auth/google/callback
   ```
5. Click **SAVE**

## ⏳ Wait for Services to Restart

- **Render**: Auto-restarts when you save env vars (1-2 minutes)
- **Vercel**: Auto-redeploys when you save env vars (2-3 minutes)

## ✅ Test

1. Go to: https://oxford-mileage-tracker-git-main-goose-weiszs-projects.vercel.app
2. Click **"Sign in with Google"**
3. Should redirect to Google (not localhost!)
4. After signing in, redirects back to your Vercel site

## 🎯 Quick Checklist

- [ ] `REACT_APP_API_URL` set on Vercel → `https://oxford-mileage-backend.onrender.com`
- [ ] `FRONTEND_URL` set on Render → Your Vercel URL
- [ ] `GOOGLE_REDIRECT_URI` set on Render → Render callback URL
- [ ] `GOOGLE_CLIENT_ID` set on Render
- [ ] `GOOGLE_CLIENT_SECRET` set on Render
- [ ] Redirect URI added in Google Cloud Console
- [ ] Services restarted (wait 3-5 minutes total)

**Once you set these, the localhost redirect issue will be fixed!** 🎉

