# 🚨 URGENT: Fix "Google login not available" Error

## The Problem
You're seeing "Google login not available" because the backend on Render doesn't have the Google OAuth credentials configured.

## ✅ Quick Fix: Set 5 Environment Variables on Render

### Step 1: Go to Render
1. Go to: https://dashboard.render.com
2. Select: **oxford-mileage-backend**
3. Click: **Environment** tab

### Step 2: Add These 5 Variables

Click **Add Environment Variable** for each:

#### 1️⃣ GOOGLE_CLIENT_ID
```
Key: GOOGLE_CLIENT_ID
Value: 893722301667-bqc8ir7q35omj6s84l7ackvqoqrhtrv6.apps.googleusercontent.com
```

#### 2️⃣ GOOGLE_CLIENT_SECRET
```
Key: GOOGLE_CLIENT_SECRET
Value: [Get from Google Cloud Console - see below]
```

**To get the secret:**
1. Go to: https://console.cloud.google.com
2. **APIs & Services** → **Credentials**
3. Click your OAuth Client ID
4. Copy the **Client secret**
5. Paste it in Render

#### 3️⃣ GOOGLE_REDIRECT_URI
```
Key: GOOGLE_REDIRECT_URI
Value: https://oxford-mileage-backend.onrender.com/api/auth/google/callback
```

#### 4️⃣ FRONTEND_URL
```
Key: FRONTEND_URL
Value: https://oxford-mileage-tracker-git-main-goose-weiszs-projects.vercel.app
```

#### 5️⃣ API_BASE_URL
```
Key: API_BASE_URL
Value: https://oxford-mileage-backend.onrender.com
```

### Step 3: Save and Wait
- Click **Save Changes** after each variable
- Render will auto-restart (wait 1-2 minutes)
- Check **Logs** tab to see when it's ready

### Step 4: Test
1. Refresh your login page
2. "Google login not available" error should be gone
3. Click "Sign in with Google" - should work!

## ✅ Also Fixed: manifest.json 401 Error

I've created and committed `manifest.json` - this will be deployed automatically by Vercel in 2-3 minutes.

## 🎯 Summary

**What you need to do:**
1. Set 5 environment variables on Render (see above)
2. Wait 2-3 minutes for backend to restart
3. Test Google login

**What I fixed:**
- ✅ Created manifest.json (will auto-deploy to Vercel)

---

**Set those environment variables now and the Google login will work!** 🚀

