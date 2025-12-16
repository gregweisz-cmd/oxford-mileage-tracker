# Fix Google OAuth Redirect to Localhost Issue

## Problem
When clicking "Sign In with Google", it redirects to localhost instead of the production URL.

## Root Cause
The backend on Render doesn't have the correct environment variables set, so it's using localhost as the fallback.

## Solution: Set Environment Variables on Render

### 1. Go to Render Dashboard
1. Go to https://dashboard.render.com
2. Select your backend service (`oxford-mileage-backend`)
3. Go to **Environment** tab
4. Add these environment variables:

### Required Environment Variables:

```env
FRONTEND_URL=https://your-vercel-app-url.vercel.app
GOOGLE_REDIRECT_URI=https://oxford-mileage-backend.onrender.com/api/auth/google/callback
API_BASE_URL=https://oxford-mileage-backend.onrender.com
GOOGLE_CLIENT_ID=893722301667-bqc8ir7q35omj6s84l7ackvqoqrhtrv6.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-secret-here
```

### 2. Set Environment Variables on Vercel

1. Go to https://vercel.com/dashboard
2. Select your project
3. Go to **Settings** → **Environment Variables**
4. Make sure this is set:

```env
REACT_APP_API_URL=https://oxford-mileage-backend.onrender.com
```

### 3. Update Google Cloud Console Redirect URIs

1. Go to https://console.cloud.google.com
2. Navigate to **APIs & Services** → **Credentials**
3. Click on your OAuth 2.0 Client ID
4. Under **Authorized redirect URIs**, make sure you have:

```
https://oxford-mileage-backend.onrender.com/api/auth/google/callback
```

### 4. Restart Services

After setting environment variables:
- **Render** will auto-restart when you save environment variables
- **Vercel** will auto-redeploy when you save environment variables

## Quick Checklist

- [ ] `FRONTEND_URL` set on Render to your Vercel URL
- [ ] `GOOGLE_REDIRECT_URI` set on Render to Render backend URL
- [ ] `API_BASE_URL` set on Render to Render backend URL
- [ ] `GOOGLE_CLIENT_ID` set on Render
- [ ] `GOOGLE_CLIENT_SECRET` set on Render
- [ ] `REACT_APP_API_URL` set on Vercel to Render backend URL
- [ ] Redirect URI added in Google Cloud Console
- [ ] Services restarted/redeployed

## After Fixing

1. Wait 2-3 minutes for services to restart
2. Test Google login again
3. It should redirect to Google, then back to your Vercel site (not localhost)

