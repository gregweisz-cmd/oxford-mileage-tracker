# Custom URL Scheme OAuth - Implementation Complete

## ✅ Changes Made

### 1. Mobile App (`src/services/googleAuthService.ts`)
- ✅ Updated `getGoogleRedirectUri()` to use custom URL scheme: `ohstafftracker://oauth/callback`
- ✅ Using `AuthSession.makeRedirectUri()` with custom scheme
- ✅ Automatically bypasses Expo proxy when using custom scheme
- ✅ Removed unnecessary logging

### 2. Backend (`admin-web/backend/routes/auth.js`)
- ✅ Updated fallback redirect URI to use custom scheme
- ✅ Already accepts `redirectUri` parameter from mobile app
- ✅ Will use whatever redirect URI is passed from mobile

### 3. App Configuration (`app.json`)
- ✅ Already has `"scheme": "ohstafftracker"` configured

## 🔧 Required: Google Cloud Console Setup

**You must add the custom redirect URI to Google Cloud Console:**

1. Go to: https://console.cloud.google.com/apis/credentials

2. Find your OAuth 2.0 Client ID: `893722301667-bqc8ir7q35omj6s84l7ackvqoqrhtrv6`

3. Click **"Edit"** on the client

4. In **"Authorized redirect URIs"**, add:
   ```
   ohstafftracker://oauth/callback
   ```

5. Click **"Save"**

6. **Wait 1-2 minutes** for changes to propagate

## Redirect URI Comparison

**Old (Expo Proxy - having issues):**
```
https://auth.expo.io/@goosew27/oh-staff-tracker
```

**New (Custom Scheme - more reliable):**
```
ohstafftracker://oauth/callback
```

**Note:** You can keep both URIs in Google Cloud Console if you want for backward compatibility.

## How It Works

1. Mobile app generates custom redirect URI: `ohstafftracker://oauth/callback`
2. User clicks "Sign in with Google"
3. Browser opens with Google login
4. After authentication, Google redirects to: `ohstafftracker://oauth/callback?code=...`
5. Mobile app receives the redirect (deep link)
6. App extracts authorization code
7. App sends code + redirect URI to backend
8. Backend exchanges code for tokens using the same redirect URI
9. Backend returns employee data
10. App completes login

## Benefits

✅ **More Reliable** - Bypasses Expo proxy completely
✅ **Production Ready** - Recommended approach by Expo team
✅ **Faster** - Direct redirect without proxy intermediary  
✅ **Better Error Handling** - More control over redirect flow
✅ **No Proxy Dependencies** - Doesn't rely on Expo proxy service

## Testing Steps

1. **Add redirect URI to Google Cloud Console** (see above)
2. **Wait 1-2 minutes** for changes to propagate
3. **Restart mobile app** (to reload changes)
4. **Try Google sign-in**
5. **Watch console logs** - should show:
   - `🔍 Google OAuth Redirect URI (Custom scheme): ohstafftracker://oauth/callback`
   - `🔍 Starting OAuth prompt with custom URL scheme...`

## Troubleshooting

### Redirect URI Mismatch Error
- Check Google Cloud Console - URI must be exactly: `ohstafftracker://oauth/callback`
- Make sure it's added to the **Web Client** (not iOS/Android)
- Wait 1-2 minutes after saving

### Deep Link Not Working
- Verify `app.json` has `"scheme": "ohstafftracker"`
- Restart the app after making changes
- On iOS, you may need to rebuild the app (not just OTA update)

### Still Getting Proxy Errors
- Check console logs to see what redirect URI is actually being used
- Verify the code changes are deployed (restart app)

## Next Steps

1. ✅ Code changes complete
2. ⏳ Add redirect URI to Google Cloud Console
3. ⏳ Test OAuth flow
4. ⏳ Deploy backend changes (if needed)

After you add the redirect URI to Google Cloud Console, try OAuth again!

