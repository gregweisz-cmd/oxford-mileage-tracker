# Fix OAuth 2.0 Policy Error

## Error Message

"Access blocked: Authorization Error - You can't sign in to this app because it doesn't comply with Google's OAuth 2.0 policy"

## Important Note

Since your email works on the web portal, the OAuth consent screen is configured. This error on mobile is likely a **redirect URI mismatch**.

## Most Likely Cause: Missing Expo Proxy Redirect URI

The mobile app uses Expo's proxy redirect URI, which might not be configured in Google Cloud Console.

### Check Console Logs

Look at your mobile app console - it should show:
```
🔍 Google OAuth Redirect URI (Expo proxy): https://auth.expo.io/@goosew27/oh-staff-tracker
```

### Verify in Google Cloud Console

1. Go to: https://console.cloud.google.com/apis/credentials

2. Find your **Web application** OAuth Client ID: `893722301667-bqc8ir7q35omj6s84l7ackvqoqrhtrv6`

3. Click to **Edit**

4. Check **"Authorized redirect URIs"** section

5. Make sure this URI is listed:
   ```
   https://auth.expo.io/@goosew27/oh-staff-tracker
   ```

6. If it's **missing**, add it:
   - Click "Add URI"
   - Enter: `https://auth.expo.io/@goosew27/oh-staff-tracker`
   - Click "Save"

7. Wait 1-2 minutes

## Other Possible Causes

### 1. OAuth Consent Screen - App Domain

Even if not in "Testing" mode, check:
- App domain is configured
- Privacy policy URL (might be required)
- Terms of service URL (might be required)

Go to: https://console.cloud.google.com/apis/credentials/consent

### 2. Scopes Issue

Make sure you're only requesting safe scopes:
- ✅ `openid` - OK
- ✅ `profile` - OK  
- ✅ `email` - OK
- ❌ Don't request sensitive scopes unless verified

### 3. User Type Mismatch

If your consent screen is set to "Internal" (Google Workspace only):
- Only users in your Google Workspace can sign in
- Make sure you're using a Google Workspace email

## Quick Fix Checklist

- [ ] Verify Expo proxy redirect URI is in Google Cloud Console
- [ ] Check OAuth Consent Screen configuration
- [ ] Verify scopes are minimal (openid, profile, email)
- [ ] Check if app domain/privacy policy URLs are required
- [ ] Verify you're using the correct Google account

## Next Steps

1. **First**: Add the Expo proxy redirect URI (most likely fix)
2. **Then**: Check OAuth Consent Screen for any missing required fields
3. **Finally**: Test OAuth again

The redirect URI is the most common cause when web works but mobile doesn't!

