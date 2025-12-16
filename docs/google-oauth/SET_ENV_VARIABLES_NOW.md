# 🔧 Set Environment Variables to Fix Google OAuth Redirect

## The Problem
Your frontend is using `REACT_APP_API_URL` which defaults to `http://localhost:3002`, and your backend needs `FRONTEND_URL` to redirect back to Vercel after OAuth.

## ✅ Quick Fix: Set These Environment Variables

### **1. Vercel (Frontend) - Set REACT_APP_API_URL**

1. Go to: https://vercel.com/dashboard
2. Select your project
3. Go to **Settings** → **Environment Variables**
4. Click **Add New**
5. Add:
   - **Name**: `REACT_APP_API_URL`
   - **Value**: `https://oxford-mileage-backend.onrender.com`
   - **Environments**: Production, Preview, Development (select all)
6. Click **Save**

### **2. Render (Backend) - Set Multiple Variables**

1. Go to: https://dashboard.render.com
2. Select your backend service (`oxford-mileage-backend`)
3. Go to **Environment** tab
4. Add these variables one by one:

#### Required Variables:

**FRONTEND_URL**
- Name: `FRONTEND_URL`
- Value: `https://your-vercel-app.vercel.app` (replace with your actual Vercel URL)
- Click **Save Changes**

**GOOGLE_REDIRECT_URI**
- Name: `GOOGLE_REDIRECT_URI`
- Value: `https://oxford-mileage-backend.onrender.com/api/auth/google/callback`
- Click **Save Changes**

**API_BASE_URL**
- Name: `API_BASE_URL`
- Value: `https://oxford-mileage-backend.onrender.com`
- Click **Save Changes**

**GOOGLE_CLIENT_ID**
- Name: `GOOGLE_CLIENT_ID`
- Value: `893722301667-bqc8ir7q35omj6s84l7ackvqoqrhtrv6.apps.googleusercontent.com`
- Click **Save Changes**

**GOOGLE_CLIENT_SECRET**
- Name: `GOOGLE_CLIENT_SECRET`
- Value: `[Your secret from Google Cloud Console]`
- Click **Save Changes**

### **3. Google Cloud Console - Add Redirect URI**

1. Go to: https://console.cloud.google.com
2. Navigate to **APIs & Services** → **Credentials**
3. Click on your OAuth 2.0 Client ID (`893722301667-...`)
4. Under **Authorized redirect URIs**, click **+ ADD URI**
5. Add: `https://oxford-mileage-backend.onrender.com/api/auth/google/callback`
6. Click **SAVE**

## 🔄 After Setting Variables

1. **Render** will auto-restart when you save environment variables (wait 1-2 minutes)
2. **Vercel** will auto-redeploy when you save environment variables (wait 2-3 minutes)

## ✅ Test

After both services restart:
1. Go to your Vercel site
2. Click "Sign in with Google"
3. It should redirect to Google (not localhost!)
4. After signing in, it should redirect back to your Vercel site

## 📝 Your URLs

Find your actual URLs:
- **Vercel URL**: Check your Vercel dashboard for the deployment URL
- **Render URL**: `https://oxford-mileage-backend.onrender.com` (you already know this)

## 🚨 Common Mistakes

- ❌ Using `http://` instead of `https://`
- ❌ Missing trailing slashes or extra paths
- ❌ Using localhost URLs
- ❌ Not saving environment variables
- ❌ Not waiting for services to restart

---

**Set these environment variables now and the redirect issue will be fixed!** 🎯

