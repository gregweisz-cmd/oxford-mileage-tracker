# Google "Something Went Wrong" Screen - Fix

## The Problem

Google is showing an error page ("something went wrong") before you can sign in. This means Google is **rejecting the OAuth request** before authentication starts.

## Most Common Causes

Since the redirect URI is correct, this is likely an **OAuth Consent Screen** configuration issue.

## Step-by-Step Fix (New Google Auth Platform UI)

Google has updated their interface! The old `/apis/credentials/consent` URL now redirects to the new Google Auth Platform.

### 1. Navigate to Consent Screen Settings

You should be at: `https://console.cloud.google.com/auth/overview`

**In the left sidebar, click on:**
- **"Audience"** ← **START HERE!** This is where test users are managed
  OR
- **"Settings"** ← For publishing status

### 2. Fix User Type (In "Audience")

**Found it!** The issue is that **"User type"** is set to **"Internal"**.

1. **Click the blue "Make external" button**
2. **Follow Google's prompts** (may need to verify domain/privacy policy)
3. This allows external users (your personal Google account) to sign in

**Why this fixes it:**
- "Internal" = Only users in your Google Cloud organization can sign in
- "External" = Anyone with a Google account can sign in
- Since you're using a personal Google account, you need "External"

### 3. Check Publishing Status (In "Settings")

1. **Click "Settings" in left sidebar**
2. **Look for "Publishing status"**:
   - **"Testing"** = Only test users can sign in
   - **"In production"** = Anyone can sign in

### 2. If App is in "Testing" Mode

**This is likely the issue!**

1. On the OAuth Consent Screen page, scroll to **"Test users"**
2. **Check if your Google email is in the list**
3. **If your email is NOT listed**:
   - Click **"ADD USERS"**
   - Enter your Google email address
   - Click **"ADD"**
   - Click **"SAVE"**

**Important**: You must be added as a test user to sign in when the app is in Testing mode!

### 3. If App is "In Production"

Check these requirements:

1. **App name** - Must be set
2. **User support email** - Must be set
3. **App domain** - May need to be set
4. **Privacy policy URL** - May need to be set
5. **Scopes** - Should include: `openid`, `profile`, `email`

### 4. Check Publishing Status

If app is in Testing mode and you want to test:

1. Go to OAuth Consent Screen
2. Make sure you're in the **"Test users"** list
3. Try OAuth again

OR publish the app:

1. Click **"PUBLISH APP"** button
2. Confirm publishing
3. This allows anyone with a Google account to sign in (not just test users)

## Quick Check List

- [ ] OAuth Consent Screen has app name set
- [ ] User support email is set
- [ ] If in Testing mode: Your email is in "Test users" list
- [ ] Scopes include: `openid`, `profile`, `email`
- [ ] Redirect URI is correct (already confirmed ✅)

## After Fixing

1. **Wait 1-2 minutes** for changes to propagate
2. **Restart mobile app** completely
3. **Try OAuth again**
4. Should see Google login page instead of error screen

## Still Getting Error?

If you're still seeing the error after adding yourself as a test user:

1. **Check the exact error message** on Google's screen
2. **Share the error text** - it might give us more clues
3. **Check if there are any warnings** in Google Cloud Console

The most common fix is adding yourself as a test user when the app is in Testing mode!

