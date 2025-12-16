# Internal App Domain Verification

## Current Situation

Your redirect URI is:
```
https://oxford-mileage-backend.onrender.com/api/auth/google/mobile/callback
```

This URI is correctly formatted and being sent in the OAuth request.

## For Internal Apps - Additional Checks

Internal apps have stricter requirements. Check these in Google Cloud Console:

### 1. Authorized Domains

1. Go to: https://console.cloud.google.com/apis/credentials/consent
2. Click on **"OAuth Consent Screen"** (or go to Settings)
3. Scroll to **"Authorized domains"**
4. Check if `onrender.com` is listed
   - If NOT, add it
   - Click **"+ ADD DOMAIN"**
   - Enter: `onrender.com`

### 2. Redirect URI in OAuth Client

1. Go to: https://console.cloud.google.com/apis/credentials
2. Click on your OAuth Client ID
3. Under **"Authorized redirect URIs"**, verify:
   - ✅ `https://oxford-mileage-backend.onrender.com/api/auth/google/mobile/callback`
   - Must be EXACTLY this (no trailing slash, exact case)

### 3. OAuth Client Type

Make sure you're using the **"Web application"** client ID (not iOS/Android).

The client ID should be: `893722301667-bqc8ir7q35omj6s84l7ackvqoqrhtrv6.apps.googleusercontent.com`

### 4. Try This Alternative

If domain restrictions are the issue, you might need to:

1. **Go to OAuth Consent Screen**
2. **Check "Authorized domains"**
3. **Add `onrender.com`** if not present
4. **Save**
5. **Wait 2-3 minutes**
6. **Try OAuth again**

## Quick Checklist

- [ ] Redirect URI matches exactly in Google Console
- [ ] Client ID is "Web application" type
- [ ] `onrender.com` is in "Authorized domains"
- [ ] App is set to "Internal" (which is correct)
- [ ] No trailing slashes or extra spaces

