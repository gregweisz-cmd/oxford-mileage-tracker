# Google Cloud Console OAuth Setup - Correct Approach

## The Problem

Google Cloud Console **rejects custom URL schemes** (`ohstafftracker://oauth/callback`) because:
- **Web OAuth clients** only accept HTTPS URLs with public domains (like `.com`, `.org`)
- Custom URL schemes don't meet Google's validation requirements

## The Solution

Use a **web-based redirect handler** that Google accepts, which then redirects to your custom scheme.

## Redirect URI to Add in Google Cloud Console

Add this HTTPS URL (which Google will accept):

```
https://oxford-mileage-backend.onrender.com/oauth/mobile/redirect
```

## How It Works

1. **Mobile app** initiates OAuth with redirect URI: `https://oxford-mileage-backend.onrender.com/oauth/mobile/redirect`
2. **User authenticates** at Google
3. **Google redirects** to: `https://oxford-mileage-backend.onrender.com/oauth/mobile/redirect?code=...`
4. **Backend serves HTML page** that redirects to: `ohstafftracker://oauth/callback?code=...`
5. **Mobile app receives** the custom scheme redirect and processes it

## Steps to Configure

### 1. Add Redirect URI in Google Cloud Console

1. Go to: https://console.cloud.google.com/apis/credentials
2. Find your OAuth 2.0 Client ID: `893722301667-bqc8ir7q35omj6s84l7ackvqoqrhtrv6`
3. Click **"Edit"**
4. In **"Authorized redirect URIs"**, click **"Add URI"**
5. Enter:
   ```
   https://oxford-mileage-backend.onrender.com/oauth/mobile/redirect
   ```
6. Click **"Save"**
7. Wait 1-2 minutes for changes to propagate

### 2. Remove the Invalid Custom Scheme URI

- Remove: `ohstafftracker://oauth/callback` (if you added it - it won't work)

### 3. Keep the Expo Proxy URI (Optional)

You can keep the Expo proxy URI if you want:
```
https://auth.expo.io/@goosew27/oh-staff-tracker
```

But the new HTTPS redirect URI is more reliable.

## Implementation Status

✅ **Backend redirect handler** created (`/oauth/mobile/redirect`)
✅ **HTML redirect page** created (`oauth-redirect.html`)
✅ **Mobile app** updated to use HTTPS redirect URI
✅ **Route registered** in backend server

## Testing

After adding the redirect URI:

1. Restart the mobile app
2. Try Google sign-in
3. Should work end-to-end!

## Next Steps

1. ⏳ **Add redirect URI** to Google Cloud Console (see above)
2. ⏳ **Test OAuth flow**

The code changes are complete - just need to add the redirect URI in Google Cloud Console!

