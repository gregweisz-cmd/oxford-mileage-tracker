# External App Requirements Check

## The Issue
Still getting "Access blocked" even though app is External.

## Possible Causes

### 1. App Verification Required
External apps with sensitive scopes may require Google verification.

### 2. Missing Required Fields
External apps need:
- ✅ App name
- ✅ User support email
- ⚠️ Privacy policy URL (might be required)
- ⚠️ App domain (might be required)
- ⚠️ Authorized domains (might need to be set)

### 3. Verification Status
Check if app needs to go through Google's verification process.

## Steps to Check

### Step 1: Check OAuth Consent Screen Settings

Go to: https://console.cloud.google.com/apis/credentials/consent

**Verify these are filled out:**

1. **App information:**
   - App name: ✅ Set
   - User support email: ✅ Set (your email)
   - App logo: Optional

2. **App domain:**
   - Application home page: May need to be set
   - Application privacy policy link: **REQUIRED for External apps**
   - Application terms of service link: Optional

3. **Authorized domains:**
   - Should include: `onrender.com` (for backend)
   - Should include: `oxfordhouse.org` (your domain)

4. **Developer contact information:**
   - Email addresses: Should have your email

### Step 2: Check Verification Status

Look for:
- **Verification status**: Should show if verification is needed
- **Unverified apps warning**: May show if sensitive scopes need verification

### Step 3: Check Scopes

Go to: https://console.cloud.google.com/apis/credentials/consent

Look at **Scopes** section:
- `openid` - Should be fine
- `profile` - Should be fine
- `email` - Should be fine

If there's a warning about "Sensitive scopes", you may need to:
- Complete verification process
- OR use "Testing" mode temporarily (but we just made it External...)

## Quick Fix Options

### Option A: Add Privacy Policy (Recommended)
1. Create a simple privacy policy page (can be on your website or GitHub Pages)
2. Add the URL in OAuth Consent Screen
3. Save and wait a few minutes

### Option B: Check Verification Status
- See if Google requires verification
- May need to submit for review if using sensitive scopes

### Option C: Check Exact Error Message
- What exactly does "Access blocked" say?
- There might be more details in the error message

