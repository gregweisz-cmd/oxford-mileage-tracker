# Fix Local Redirect URI Issue

## Problem

The redirect URI is showing as `exp://192.168.86.101:8081` (local development URL) instead of the Expo proxy URL.

This happens because in development mode, Expo's `makeRedirectUri()` defaults to the local dev server URL, which:
- ❌ Google won't accept (not HTTPS)
- ❌ Won't work from the internet
- ❌ Not registered in Google Cloud Console

## Solution

Force the Expo proxy URL explicitly instead of relying on auto-detection.

## Changes Made

Updated `getGoogleRedirectUri()` to explicitly construct the Expo proxy URL:
```typescript
const redirectUri = `https://auth.expo.io/@goosew27/oh-staff-tracker`;
```

Instead of using `AuthSession.makeRedirectUri()` which auto-detects and uses local URL in dev.

## Verify Google Cloud Console

Make sure this redirect URI is in Google Cloud Console:
```
https://auth.expo.io/@goosew27/oh-staff-tracker
```

1. Go to: https://console.cloud.google.com/apis/credentials
2. Find your Web OAuth Client ID
3. Edit it
4. Check "Authorized redirect URIs"
5. Add if missing: `https://auth.expo.io/@goosew27/oh-staff-tracker`
6. Save

## Test

After this change:
1. Restart mobile app
2. Check console logs - should now show: `https://auth.expo.io/@goosew27/oh-staff-tracker`
3. Try OAuth again

This should fix the issue!
