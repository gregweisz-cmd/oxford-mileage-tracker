# Fix "Google login not available" Error

## Problem
You're seeing "Google login not available" on the login page. This means the backend on Render doesn't have the Google OAuth environment variables set.

## Root Cause
The backend code checks if `googleClient` is initialized. If `GOOGLE_CLIENT_ID` or `GOOGLE_CLIENT_SECRET` aren't set, it shows this error.

## ✅ Solution: Set Environment Variables on Render

### Step 1: Go to Render Dashboard
1. Go to: https://dashboard.render.com
2. Select your backend service: **oxford-mileage-backend**
3. Click on **Environment** tab

### Step 2: Add Required Environment Variables

Add these **5 environment variables** one by one:

#### 1. GOOGLE_CLIENT_ID
- **Key**: `GOOGLE_CLIENT_ID`
- **Value**: `893722301667-bqc8ir7q35omj6s84l7ackvqoqrhtrv6.apps.googleusercontent.com`
- Click **Save Changes**

#### 2. GOOGLE_CLIENT_SECRET
- **Key**: `GOOGLE_CLIENT_SECRET`
- **Value**: `[Get from Google Cloud Console - see instructions below]`
- Click **Save Changes**

**To get GOOGLE_CLIENT_SECRET:**
1. Go to: https://console.cloud.google.com
2. Navigate to **APIs & Services** → **Credentials**
3. Click on your OAuth 2.0 Client ID
4. Copy the **Client secret** value
5. Paste it in Render (no spaces, no quotes)

#### 3. GOOGLE_REDIRECT_URI
- **Key**: `GOOGLE_REDIRECT_URI`
- **Value**: `https://oxford-mileage-backend.onrender.com/api/auth/google/callback`
- Click **Save Changes**

#### 4. FRONTEND_URL
- **Key**: `FRONTEND_URL`
- **Value**: `https://oxford-mileage-tracker-git-main-goose-weiszs-projects.vercel.app`
- Click **Save Changes**

#### 5. API_BASE_URL
- **Key**: `API_BASE_URL`
- **Value**: `https://oxford-mileage-backend.onrender.com`
- Click **Save Changes**

### Step 3: Wait for Backend to Restart
- Render will automatically restart when you save environment variables
- Wait 1-2 minutes for the restart to complete
- Check the **Logs** tab to see when it's ready

### Step 4: Test
1. Go to your login page
2. The "Google login not available" error should be gone
3. Click "Sign in with Google" - it should work!

## 🔍 Verify It's Working

After setting the variables, check Render logs:
1. Go to **Logs** tab in Render
2. Look for: `✅ Google OAuth client initialized`
3. If you see this, it's working!

## 🐛 If Still Not Working

1. **Check Render logs** for errors
2. **Verify environment variables** are set correctly (no typos, no extra spaces)
3. **Make sure GOOGLE_CLIENT_SECRET** is the actual secret from Google Cloud Console
4. **Wait 2-3 minutes** after setting variables for backend to restart

---

**Once you set these 5 environment variables, the "Google login not available" error will disappear!** ✅

