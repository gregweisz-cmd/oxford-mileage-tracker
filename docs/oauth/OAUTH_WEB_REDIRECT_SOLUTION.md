# OAuth Web Redirect Handler Solution

## Problem

Google Cloud Console **rejects custom URL schemes** (`ohstafftracker://`) for Web OAuth clients. It only accepts HTTPS URLs with public domains.

## Solution: Web-Based Redirect Handler

Instead of using a custom URL scheme directly, we'll:

1. **Use HTTPS redirect URI** that Google accepts: `https://oxford-mileage-backend.onrender.com/oauth/mobile/redirect`
2. **Backend redirects** to custom scheme: `ohstafftracker://oauth/callback?code=...`
3. **Mobile app receives** the custom scheme redirect

## Implementation

### 1. Backend Redirect Handler (`/oauth/mobile/redirect`)
- Receives OAuth callback from Google
- Extracts authorization code
- Redirects to: `ohstafftracker://oauth/callback?code=...`

### 2. Mobile App Changes
- Uses HTTPS redirect URI: `https://oxford-mileage-backend.onrender.com/oauth/mobile/redirect`
- Handles custom scheme redirect when backend redirects back

### 3. Google Cloud Console
- Add HTTPS redirect URI: `https://oxford-mileage-backend.onrender.com/oauth/mobile/redirect`

## Flow

1. User clicks "Sign in with Google"
2. App opens browser with redirect URI: `https://oxford-mileage-backend.onrender.com/oauth/mobile/redirect`
3. User authenticates at Google
4. Google redirects to: `https://oxford-mileage-backend.onrender.com/oauth/mobile/redirect?code=...`
5. **Backend receives callback** and redirects to: `ohstafftracker://oauth/callback?code=...`
6. Mobile app receives custom scheme redirect
7. App extracts code and sends to backend `/api/auth/google/mobile`

## Files Modified

1. ✅ `admin-web/backend/routes/oauthRedirect.js` - New redirect handler
2. ✅ `admin-web/backend/server.js` - Register redirect route
3. ✅ `src/services/googleAuthService.ts` - Use HTTPS redirect URI

## Next Steps

1. **Add redirect URI to Google Cloud Console**:
   ```
   https://oxford-mileage-backend.onrender.com/oauth/mobile/redirect
   ```

2. **Deploy backend changes** (redirect handler)

3. **Test OAuth flow**

