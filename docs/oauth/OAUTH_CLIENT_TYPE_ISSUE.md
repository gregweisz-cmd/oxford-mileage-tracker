# OAuth Client Type Issue

## Problem

Google Cloud Console is rejecting the custom URL scheme `ohstafftracker://oauth/callback` because:
- **Web OAuth clients** only accept HTTP/HTTPS URLs (public domains)
- Custom URL schemes (like `ohstafftracker://`) are not accepted by Web clients

## Solution Options

### Option 1: Use iOS/Android OAuth Client (Recommended for Native Apps)

For mobile apps, Google Cloud Console allows custom URL schemes in **iOS** or **Android** OAuth clients:

1. **Create iOS OAuth Client** in Google Cloud Console
   - Go to: https://console.cloud.google.com/apis/credentials
   - Click "Create Credentials" → "OAuth client ID"
   - Select **"iOS"** as application type
   - Enter bundle ID: `com.oxfordhouse.ohstafftracker` (from app.json)
   - Save and note the iOS Client ID

2. **Add Custom URL Scheme** to iOS Client
   - In the iOS client, add to authorized redirect URIs:
     ```
     ohstafftracker://oauth/callback
     ```

3. **Update Mobile App** to use iOS Client ID
   - Replace the Web Client ID with iOS Client ID in the mobile app

**Limitation**: This only works for iOS builds. For Android, you'd need an Android client.

### Option 2: Use Web-Based Redirect (Recommended for Cross-Platform)

Create a web page that handles the OAuth redirect and then redirects to your app:

1. **Create a web redirect handler** (on your backend or a simple HTML page)
   - URL: `https://oxford-mileage-backend.onrender.com/oauth/redirect`
   - Receives OAuth callback from Google
   - Redirects to: `ohstafftracker://oauth/callback?code=...`

2. **Register web URL** in Google Cloud Console
   - Add: `https://oxford-mileage-backend.onrender.com/oauth/redirect`
   - This is a valid HTTPS URL, so Google accepts it

3. **Mobile app** redirects to this web URL
   - Google redirects to web URL
   - Web URL redirects to custom scheme
   - App receives custom scheme redirect

### Option 3: Keep Expo Proxy (Fix Underlying Issue)

Since the redirect URI is correctly configured, the Expo proxy issue might be solvable:
- Check if there's a network connectivity issue
- Try on different network
- Check Expo proxy service status

### Option 4: Use App Links / Universal Links

- **Android**: App Links (https://yourdomain.com/oauth/callback)
- **iOS**: Universal Links (https://yourdomain.com/oauth/callback)
- Requires domain verification and hosting a verification file
- More complex setup but most robust solution

## Recommended Approach

**For now, let's try Option 2** - create a web redirect handler on your backend. This:
- Works for both iOS and Android
- Uses existing Web Client ID
- Relatively simple to implement
- More reliable than Expo proxy

Would you like me to implement the web redirect handler approach?

