# Fix OAuth for Internal Google Apps - Updated Solution

## The Problem

Your Google Cloud app is set to **"Internal"** user type. Internal apps have restrictions:
- ✅ Web OAuth works because it uses your own domain (`https://oxford-mileage-backend.onrender.com`)
- ❌ Mobile OAuth failed because:
  1. Expo proxy (`https://auth.expo.io/...`) is a third-party domain (not allowed for Internal apps)
  2. Custom URL schemes (`ohstafftracker://`) are not accepted in Google Cloud Console for Web application OAuth clients

## The Solution

Use **backend as proxy**:
1. Mobile app uses backend callback URL: `https://oxford-mileage-backend.onrender.com/api/auth/google/mobile/callback`
2. Google redirects to backend (valid HTTPS URL)
3. Backend processes OAuth and exchanges code for tokens
4. Backend redirects to mobile app using custom scheme: `ohstafftracker://oauth/callback?success=true&token=...`
5. Mobile app handles deep link and completes login

## Steps to Fix

### 1. Add Redirect URI to Google Cloud Console ✅

1. Go to: https://console.cloud.google.com/apis/credentials
2. Click on your OAuth Client ID (Web application: `893722301667-...`)
3. Under **"Authorized redirect URIs"**, add:
   ```
   https://oxford-mileage-backend.onrender.com/api/auth/google/mobile/callback
   ```
4. Click **"SAVE"**

**This is a valid HTTPS URL, so Google will accept it!**

### 2. Code Updates ✅

Both mobile app and backend have been updated to:
- Use backend callback URL in OAuth request
- Handle the proxy redirect flow
- Support deep link callbacks from backend

### 3. Test

After adding the redirect URI:
1. Wait 1-2 minutes for Google to update
2. Restart your mobile app completely
3. Try OAuth again

## How It Works

```
1. App → Google: OAuth request with backend callback URL
2. Google → Backend: Redirect with authorization code
3. Backend → Google: Exchange code for tokens
4. Backend → App: Redirect to ohstafftracker://oauth/callback?token=...
5. App: Handle deep link, extract token, complete login
```

This works because:
- Backend URL is your own domain (allowed for Internal apps)
- Backend can redirect to custom schemes (no restrictions)
- Mobile app receives token via deep link

## Why This Works for Internal Apps

- ✅ Uses your own domain (backend URL)
- ✅ No third-party domains
- ✅ Complies with Google Internal app restrictions
- ✅ Secure (client secret stays on backend)
