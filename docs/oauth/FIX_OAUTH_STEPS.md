# Fix Mobile OAuth - Step by Step

## Current Status
- ✅ Mobile app uses Expo proxy redirect URI: `https://auth.expo.io/@goosew27/oh-staff-tracker`
- ✅ Backend accepts redirect URI from mobile app
- ⚠️ Need to verify Google Cloud Console configuration

## Steps to Fix

### 1. Verify Google Cloud Console Configuration

Go to: https://console.cloud.google.com/apis/credentials

1. Find your **OAuth 2.0 Client ID** (Web application):
   - Client ID: `893722301667-bqc8ir7q35omj6s84l7ackvqoqrhtrv6`
   
2. Click **Edit**

3. Under **Authorized redirect URIs**, make sure these are listed:
   ```
   https://auth.expo.io/@goosew27/oh-staff-tracker
   https://oxford-mileage-backend.onrender.com/api/auth/google/callback
   ```

4. Click **Save**

### 2. Verify Backend Environment Variables

On Render.com:
1. Go to your backend service
2. Check Environment Variables:
   - `GOOGLE_CLIENT_ID` = `893722301667-bqc8ir7q35omj6s84l7ackvqoqrhtrv6.apps.googleusercontent.com`
   - `GOOGLE_CLIENT_SECRET` = (your secret from Google Cloud Console)

### 3. Test OAuth Flow

1. **Restart mobile app** (to load latest code)
2. Click "Sign in with Google"
3. Check console logs for:
   ```
   🔍 Google OAuth Redirect URI (Expo proxy): https://auth.expo.io/@goosew27/oh-staff-tracker
   ```
4. If error occurs, check:
   - Mobile app console logs (look for `❌` messages)
   - Backend logs on Render (check for OAuth errors)

## Common Issues

### Issue: "redirect_uri_mismatch"
**Fix**: Make sure `https://auth.expo.io/@goosew27/oh-staff-tracker` is in Google Cloud Console

### Issue: "Access blocked: Authorization Error"
**Fix**: 
- Check OAuth Consent Screen is configured
- Make sure app is in "Testing" mode or you're a test user
- Verify redirect URI matches exactly

### Issue: Backend returns error
**Fix**: 
- Check backend logs on Render
- Verify `GOOGLE_CLIENT_SECRET` is correct
- Make sure backend uses the same redirect URI as mobile app

## Code Changes Made

### Mobile App (`googleAuthService.ts`)
- ✅ Uses Expo proxy: `https://auth.expo.io/@goosew27/oh-staff-tracker`
- ✅ Passes redirect URI to backend
- ✅ Detailed error logging

### Backend (`routes/auth.js`)
- ✅ Accepts `redirectUri` from mobile app
- ✅ Uses provided redirect URI for token exchange
- ✅ Fallback to Expo proxy URI if not provided
- ✅ Detailed error logging

## Next Steps

1. ✅ Code is fixed
2. ⚠️ **YOU NEED TO**: Add redirect URI to Google Cloud Console
3. ⚠️ **THEN**: Test OAuth flow

