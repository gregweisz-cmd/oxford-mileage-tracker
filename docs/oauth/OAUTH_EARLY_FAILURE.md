# OAuth Early Failure - Before Credentials

## Issue Description

The OAuth flow is failing **before** the user can even enter their credentials. This means the error occurs very early in the flow, likely when:
- The OAuth browser window opens
- Google's login page is loading
- The redirect URI is being validated

## Possible Causes

### 1. Redirect URI Not Registered in Google Cloud Console
The redirect URI `https://auth.expo.io/@goosew27/oh-staff-tracker` might not be registered in Google Cloud Console, causing Google to reject the request immediately.

### 2. Client ID Issue
The client ID might be invalid or not configured correctly for the Expo proxy redirect URI.

### 3. Expo Proxy Service Issue
The Expo proxy service itself might be having issues or timing out.

## What to Check

### Step 1: Verify Google Cloud Console Configuration

1. Go to: https://console.cloud.google.com/apis/credentials
2. Find your OAuth 2.0 Client ID: `893722301667-bqc8ir7q35omj6s84l7ackvqoqrhtrv6`
3. Check **Authorized redirect URIs** section
4. Verify this URI is listed:
   ```
   https://auth.expo.io/@goosew27/oh-staff-tracker
   ```

**Important**: Make sure you're checking the **Web Client** (not iOS/Android), as Expo proxy uses the web client ID.

### Step 2: Check Error Message

When you see "Something went wrong", can you:
- Check the mobile app console for any error logs
- Look for error messages that might indicate what's wrong
- The enhanced logging should now show more details

### Step 3: Try Different Approaches

If the redirect URI is the issue, we have a few options:

**Option A: Add Redirect URI to Google Cloud Console**
- Ensure the Expo proxy URI is registered
- Might need to add it to both Web and Mobile clients

**Option B: Use Custom URL Scheme (Recommended)**
- Bypass Expo proxy entirely
- Use `ohstafftracker://oauth/callback` instead
- More reliable for production

## Enhanced Logging Added

The code now logs:
- Full redirect URI being used
- Full client ID (first 20 chars)
- Generated OAuth URL (first 200 chars)
- Complete error details if OAuth fails
- All result params for debugging

## Next Steps

1. **Check Google Cloud Console** - Verify redirect URI is registered
2. **Try OAuth again** - Watch console for new detailed logs
3. **Share error logs** - If it still fails, share the full console output
4. **Consider custom URL scheme** - If Expo proxy continues to fail

## Current Configuration

- **Redirect URI**: `https://auth.expo.io/@goosew27/oh-staff-tracker` (Expo proxy)
- **Client ID**: `893722301667-bqc8ir7q35omj6s84l7ackvqoqrhtrv6`
- **App Scheme**: `ohstafftracker://` (available for custom redirect)

