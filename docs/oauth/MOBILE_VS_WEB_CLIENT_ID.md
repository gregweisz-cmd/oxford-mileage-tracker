# Mobile vs Web Client ID for OAuth

## Current Situation

You have:
- **Web application client ID**: `893722301667-bqc8ir7q35omj6s84l7ackvqoqrhtrv6.apps.googleusercontent.com`
- **Mobile client ID**: (separate one)

## Which One to Use?

### For Backend Proxy Flow (Current Approach)

**Use: Web application client ID** ✅

Why?
- Redirect URI is an HTTPS URL: `https://oxford-mileage-backend.onrender.com/...`
- Web application clients support HTTPS redirect URIs
- iOS/Android clients are for custom URL schemes (like `ohstafftracker://`)
- Internal apps don't allow custom URL schemes directly

### If We Use Mobile Client ID

Mobile client IDs (iOS/Android) are designed for:
- Direct app-to-app redirects
- Custom URL schemes: `ohstafftracker://oauth/callback`
- NOT for backend HTTPS redirects

## The Real Issue

The "invalid request" error might be because:

1. **Web client ID configuration issue**
   - Redirect URI not matching exactly
   - Domain restrictions for Internal apps

2. **Internal app restrictions**
   - Google might have special rules for Internal apps
   - May require specific configuration

## Recommendation

**Keep using Web application client ID** but verify:

1. In Google Cloud Console → Credentials
2. Click on your **Web application** client ID
3. Verify:
   - Redirect URI is exactly: `https://oxford-mileage-backend.onrender.com/api/auth/google/mobile/callback`
   - Client is enabled
   - No restrictions that might block mobile requests

## Alternative: Try Mobile Client ID

If you want to test with the mobile client ID:
- We'd need to change the redirect URI to use custom scheme
- But Internal apps might still block this
- Probably won't work for Internal apps

**Bottom line**: Stick with Web client ID, but double-check its configuration in Google Console.

