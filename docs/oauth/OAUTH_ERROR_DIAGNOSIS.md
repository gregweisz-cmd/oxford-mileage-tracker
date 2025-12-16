# OAuth "Something Went Wrong" Error - Diagnosis & Fix

## Current Status
✅ Code is correct - redirect URI: `https://auth.expo.io/@goosew27/oh-staff-tracker`  
❌ Still getting "something went wrong" error

## Most Likely Cause
**Redirect URI is NOT in Google Cloud Console**

This error occurs when Google rejects the OAuth request because the redirect URI doesn't match any authorized URIs.

## Step-by-Step Fix

### 1. Check Google Cloud Console (CRITICAL)

1. **Go to**: https://console.cloud.google.com/apis/credentials

2. **Find your OAuth Client**:
   - Look for Client ID: `893722301667-bqc8ir7q35omj6s84l7ackvqoqrhtrv6`
   - Make sure it's a **"Web application"** type (NOT Android or iOS)

3. **Click Edit** on that client

4. **Under "Authorized redirect URIs"**, check if this EXACT URL is listed:
   ```
   https://auth.expo.io/@goosew27/oh-staff-tracker
   ```

5. **If it's missing**, add it:
   - Click **"+ ADD URI"**
   - Paste: `https://auth.expo.io/@goosew27/oh-staff-tracker`
   - Click **Save**

### 2. Check OAuth Consent Screen

1. **Go to**: https://console.cloud.google.com/apis/credentials/consent

2. **Check these settings**:
   - ✅ App name is set
   - ✅ User support email is set
   - ✅ App is in **"Testing"** mode (or published)
   - ✅ Your email is in **"Test users"** list (if in Testing mode)

3. **If app is in Testing mode**:
   - Go to "Test users" section
   - Click "Add Users"
   - Add your Google email address
   - Save

### 3. Test Again with Enhanced Logging

After fixing Google Cloud Console:

1. **Restart mobile app** (close completely and reopen)
2. **Try OAuth again**
3. **Check console logs** - you should now see:
   ```
   🔍 Complete result dump: { type: 'success', params: { code: '...' } }
   ```

## What the Enhanced Logging Will Show

After restarting the app, the logs will show:
- What `result.type` is (should be 'success', 'error', or 'cancel')
- What error params Google is returning (if any)
- Complete result object dump

## Common Error Types

### If `result.type === 'error'`:
- Check `result.params.error` in logs
- Common errors:
  - `redirect_uri_mismatch` → Redirect URI not in Google Cloud Console
  - `access_denied` → User denied permission
  - `invalid_request` → Configuration issue

### If `result.type === 'dismiss'`:
- User closed the OAuth window
- Not an error, just need to try again

## After Fixing

1. ✅ Add redirect URI to Google Cloud Console
2. ✅ Verify OAuth consent screen
3. ✅ Add yourself as test user (if needed)
4. ✅ Restart mobile app
5. ✅ Try OAuth again
6. ✅ Check new detailed logs for exact error (if still failing)

## Next Steps

After you add the redirect URI and test again, share:
- The new console logs (especially the "Complete result dump")
- Any error messages that appear

This will help pinpoint the exact issue!

