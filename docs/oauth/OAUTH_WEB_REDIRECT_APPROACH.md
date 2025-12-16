# OAuth Web Redirect Handler Approach

## Problem

Google Cloud Console rejects custom URL schemes (`ohstafftracker://oauth/callback`) because:
- **Web OAuth clients** only accept HTTPS URLs with public domains
- Custom URL schemes are not valid for Web clients

## Solution: Web-Based Redirect Handler

Use a **two-step redirect**:

1. **Google redirects to HTTPS URL** (which Google accepts):
   ```
   https://oxford-mileage-backend.onrender.com/oauth/mobile/redirect?code=...
   ```

2. **Backend serves HTML page** that redirects to custom scheme:
   ```
   ohstafftracker://oauth/callback?code=...
   ```

3. **Mobile app receives** custom scheme redirect and processes it

## Implementation

### Backend Changes

1. ✅ Created `/oauth/mobile/redirect` endpoint
2. ✅ Serves HTML page that redirects to custom scheme
3. ✅ Registered route in `server.js`

### Mobile App Changes

The mobile app needs to:
1. Use HTTPS redirect URI: `https://oxford-mileage-backend.onrender.com/oauth/mobile/redirect`
2. Handle the custom scheme redirect: `ohstafftracker://oauth/callback?code=...`

**However**, Expo's `AuthSession` might not automatically handle the custom scheme redirect from the HTML page. We need to make sure the app is configured to receive deep links.

## Current Status

The redirect handler is created, but we need to:
1. **Update mobile app** to use HTTPS redirect URI
2. **Ensure deep linking** is properly configured
3. **Add redirect URI** to Google Cloud Console

## Next Steps

Since Google won't accept custom schemes, let's go back to using the **Expo proxy** approach, which uses an HTTPS URL that Google accepts. The Expo proxy should work - we just need to fix whatever is causing it to fail.

**OR** we implement a proper deep link handler in the mobile app to receive the custom scheme redirect from the HTML page.

Which approach would you prefer?

