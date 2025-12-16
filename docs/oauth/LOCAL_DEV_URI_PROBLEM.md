# Local Dev URI Problem - Fixed!

## Problem Found

The redirect URI was showing as:
```
exp://192.168.86.101:8081
```

This is the **local Expo development server URL**, not the Expo proxy URL. Google won't accept this because:
- ❌ It's not HTTPS
- ❌ It's a local network address
- ❌ It's not registered in Google Cloud Console

## Solution Applied

Updated the code to **explicitly use the Expo proxy URL**:
```
https://auth.expo.io/@goosew27/oh-staff-tracker
```

## What You Need To Do

### 1. Restart Mobile App

The code change needs to take effect. Restart your Expo development server or reload the app.

### 2. Verify Redirect URI in Console Logs

After restarting, check the console logs. You should now see:
```
🔍 Google OAuth Redirect URI (Expo proxy): https://auth.expo.io/@goosew27/oh-staff-tracker
```

**NOT** `exp://192.168.86.101:8081` anymore.

### 3. Verify Google Cloud Console

Make sure this redirect URI is in Google Cloud Console:

1. Go to: https://console.cloud.google.com/apis/credentials
2. Find your **Web application** OAuth Client ID: `893722301667-bqc8ir7q35omj6s84l7ackvqoqrhtrv6`
3. Click **Edit**
4. Check **"Authorized redirect URIs"**
5. Make sure this is listed:
   ```
   https://auth.expo.io/@goosew27/oh-staff-tracker
   ```
6. If missing, add it and save

### 4. Test OAuth

After both steps above, try Google sign-in again - it should work!

## Why This Happened

In development mode, Expo's `makeRedirectUri()` defaults to the local dev server URL. We need to explicitly force the Expo proxy URL to ensure Google accepts it.

