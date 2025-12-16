# Custom URL Scheme OAuth Setup

## What We're Changing

Switching from Expo proxy to custom URL scheme for OAuth redirects. This is more reliable and bypasses Expo proxy issues.

## Changes Made

### 1. Mobile App (`src/services/googleAuthService.ts`)
- ✅ Updated to use custom URL scheme: `ohstafftracker://oauth/callback`
- ✅ Bypassing Expo proxy (`useProxy: false`)
- ✅ Using `AuthSession.makeRedirectUri()` with custom scheme

### 2. App Configuration (`app.json`)
- ✅ Already configured with `"scheme": "ohstafftracker"`

## Required: Google Cloud Console Configuration

**You need to add the custom redirect URI to Google Cloud Console:**

1. Go to: https://console.cloud.google.com/apis/credentials

2. Find your OAuth 2.0 Client ID: `893722301667-bqc8ir7q35omj6s84l7ackvqoqrhtrv6`

3. Click "Edit" on the client

4. In **"Authorized redirect URIs"**, add:
   ```
   ohstafftracker://oauth/callback
   ```

5. Click "Save"

6. Wait 1-2 minutes for changes to propagate

## Redirect URI Details

**Old (Expo Proxy):**
```
https://auth.expo.io/@goosew27/oh-staff-tracker
```

**New (Custom Scheme):**
```
ohstafftracker://oauth/callback
```

**Note:** You can keep both URIs in Google Cloud Console if you want, but only the custom scheme will be used now.

## Backend Changes

The backend already accepts `redirectUri` in the mobile OAuth request, so it should work automatically. The backend will use whatever redirect URI is passed from the mobile app.

## Testing

After updating Google Cloud Console:

1. Wait 1-2 minutes for changes to propagate
2. Restart the mobile app
3. Try Google sign-in again
4. Watch console logs for the new redirect URI

## Benefits

✅ **More Reliable** - Bypasses Expo proxy issues
✅ **Production Ready** - Recommended approach for production apps
✅ **Faster** - Direct redirect without proxy intermediary
✅ **Better Error Handling** - More control over the redirect flow

## Troubleshooting

If you see redirect URI mismatch errors:
- Double-check the URI is exactly: `ohstafftracker://oauth/callback`
- Make sure it's added to the **Web Client** (not iOS/Android)
- Wait 1-2 minutes after saving for Google to propagate changes
- Check console logs to see what redirect URI is being used

