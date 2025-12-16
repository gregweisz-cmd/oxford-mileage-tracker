# Fix Google OAuth Consent Screen Error

## Error Message

"Access blocked: Authorization Error - You can't sign in to this app because it doesn't comply with Google's OAuth 2.0 policy"

## Common Causes

1. **OAuth Consent Screen not configured properly**
2. **App is in "Testing" mode but user email not added as test user**
3. **App needs verification** (if using sensitive scopes)
4. **OAuth client not configured correctly**

## Fix Steps

### Step 1: Check OAuth Consent Screen

1. Go to: https://console.cloud.google.com/apis/credentials/consent
2. Make sure the consent screen is configured:
   - **User Type**: Internal (if using Google Workspace) OR External
   - **App name**: Enter your app name
   - **User support email**: Your email
   - **Developer contact information**: Your email
   - **Scopes**: Should include `openid`, `profile`, `email`

### Step 2: Add Test Users (If App is in Testing Mode)

If your app is in **Testing** mode, you need to add test users:

1. Go to: https://console.cloud.google.com/apis/credentials/consent
2. Scroll down to **"Test users"** section
3. Click **"Add Users"**
4. Add your email address (and any other emails that need to test)
5. Click **"Save"**

### Step 3: Check Publishing Status

1. Still on the Consent Screen page
2. Look at the top - if it says **"Testing"**, you have two options:
   - **Option A**: Keep it in Testing and add all test users
   - **Option B**: Click **"PUBLISH APP"** to make it available to all users (requires verification for sensitive scopes)

For internal/testing purposes, **Option A** is usually fine.

### Step 4: Verify OAuth Client Configuration

1. Go to: https://console.cloud.google.com/apis/credentials
2. Find your OAuth 2.0 Client ID
3. Make sure:
   - **Application type**: Web application
   - **Authorized redirect URIs**: Should include:
     - `https://auth.expo.io/@goosew27/oh-staff-tracker`
     - Any other redirect URIs you're using

## Quick Checklist

- [ ] OAuth Consent Screen is configured
- [ ] If in Testing mode, your email is added as a test user
- [ ] Redirect URIs are correct in OAuth Client
- [ ] Scopes are minimal (openid, profile, email are fine - no sensitive scopes)

## Most Likely Fix

**Add yourself as a test user** if the app is in Testing mode:
1. Go to: https://console.cloud.google.com/apis/credentials/consent
2. Click **"Add Users"** under Test users
3. Add your email
4. Save
5. Try OAuth again

## If Still Not Working

1. Check the exact error message - Google usually provides more details
2. Make sure you're using the correct Google account
3. Verify the OAuth Client ID matches what's in your code
4. Check Google Cloud Console logs for more details

