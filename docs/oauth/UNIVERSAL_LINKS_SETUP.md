# Universal Links Setup for iOS OAuth

## ⚠️ Important: Apple Developer Account Required

**Universal Links require an Apple Developer account to work.** Until you have an Apple Developer account:
- The app uses custom URL schemes (`ohstafftracker://`) as the primary method
- Universal Links code is ready but won't function until the account is set up
- Once you have an Apple Developer account, just update the Team ID in the AASA file

## What Was Implemented

Universal Links have been configured and are ready to use once you have an Apple Developer account. The implementation currently uses custom URL schemes as the primary method, with Universal Links ready to activate.

## Changes Made

### 1. Backend (Render.com)
- ✅ Added route to serve Apple App Site Association (AASA) file at `/.well-known/apple-app-site-association`
- ✅ Updated OAuth callback to redirect to HTTPS Universal Link instead of custom scheme
- ✅ AASA file is served with correct `application/json` content type

### 2. App Configuration (app.json)
- ✅ Added `associatedDomains` to iOS configuration:
  ```json
  "associatedDomains": [
    "applinks:oxford-mileage-backend.onrender.com"
  ]
  ```

### 3. Mobile App
- ✅ Updated deep link handler to recognize both Universal Links and custom schemes
- ✅ Universal Links format: `https://oxford-mileage-backend.onrender.com/api/auth/google/mobile/callback?success=true&token=...&email=...`
- ✅ Falls back to custom scheme for backward compatibility

## ⚠️ Important: Update Apple Team ID

The AASA file currently uses a wildcard (`*`) for the Team ID. You **must** update this with your actual Apple Developer Team ID before building the production app.

### How to Find Your Team ID:
1. Go to [Apple Developer Portal](https://developer.apple.com/account)
2. Navigate to **Membership** section
3. Your **Team ID** is displayed there (format: `ABC123XYZ`)

### Update the AASA File:

In `admin-web/backend/server.js`, find the AASA route and update:

```javascript
appID: 'YOUR_TEAM_ID.com.oxfordhouse.ohstafftracker',
```

Replace `YOUR_TEAM_ID` with your actual Team ID (e.g., `ABC123XYZ.com.oxfordhouse.ohstafftracker`)

## Testing

### Before Building:
1. Verify AASA file is accessible:
   - Visit: `https://oxford-mileage-backend.onrender.com/.well-known/apple-app-site-association`
   - Should return JSON with `applinks` configuration
   - Content-Type should be `application/json`

2. Test the redirect URL format:
   - Backend redirects to: `https://oxford-mileage-backend.onrender.com/api/auth/google/mobile/callback?success=true&token=...&email=...`

### After Building:
1. Install the app on a physical iOS device (Universal Links don't work in simulator)
2. Test OAuth flow - the Universal Link should open the app directly
3. If Universal Links aren't working, the app falls back to custom scheme

## How Universal Links Work

1. User completes Google OAuth in Safari
2. Backend redirects to HTTPS URL: `https://oxford-mileage-backend.onrender.com/api/auth/google/mobile/callback?...`
3. iOS checks if the domain is associated with the app (via AASA file)
4. If associated, iOS opens the app directly (bypassing Safari)
5. App receives the URL via `Linking.addEventListener('url')`
6. App extracts token and completes authentication

## Benefits Over Custom Schemes

- ✅ Works in Safari (no blocking issues)
- ✅ More secure (requires domain ownership)
- ✅ Better user experience (opens app directly)
- ✅ Fallback to browser if app not installed

## Troubleshooting

### Universal Links Not Working:
1. **Check AASA file**: Must be accessible at `/.well-known/apple-app-site-association`
2. **Content-Type**: Must be `application/json` (not `text/plain`)
3. **Team ID**: Must match your Apple Developer Team ID
4. **Device**: Universal Links only work on physical devices, not simulator
5. **App Installation**: App must be installed from App Store or TestFlight (not Xcode debug builds initially)

### Testing AASA File:
```bash
curl -I https://oxford-mileage-backend.onrender.com/.well-known/apple-app-site-association
```

Should return:
```
Content-Type: application/json
```

### Validating AASA:
- Use [Apple's AASA Validator](https://search.developer.apple.com/appsearch-validation-tool/)
- Enter your domain: `oxford-mileage-backend.onrender.com`

## Current Status

**For now (without Apple Developer account):**
- ✅ App uses custom URL scheme (`ohstafftracker://`) 
- ✅ Universal Links code is ready but inactive
- ✅ All code changes are deployed and ready

**After getting Apple Developer account:**
1. ✅ Get your Team ID from Apple Developer Portal
2. ⚠️ **Update Team ID in AASA file** (in `admin-web/backend/server.js`)
3. ✅ Change `redirectUrl` from `customSchemeUrl` to `universalLinkUrl` in `auth.js`
4. ✅ Build new app version with `associatedDomains` configuration
5. ✅ Test on physical iOS device

## Getting Started with Apple Developer

If you don't have an Apple Developer account yet:
1. Go to [developer.apple.com](https://developer.apple.com)
2. Sign up for Apple Developer Program ($99/year)
3. Once approved, get your Team ID from the Membership section
4. Follow the "After getting Apple Developer account" steps above

## Fallback Mechanisms

If Universal Links fail:
1. App tries custom scheme (`ohstafftracker://oauth/callback`)
2. If that fails, polling code is displayed on success page
3. User can manually enter code in app (future feature)

