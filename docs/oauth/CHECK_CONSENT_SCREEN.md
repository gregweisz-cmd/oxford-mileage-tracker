# Check OAuth Consent Screen Configuration

## What to Look For

When you go to: https://console.cloud.google.com/apis/credentials/consent

### Required Fields for External Apps:

1. **App information:**
   - ✅ App name: Should be set
   - ✅ User support email: Should be set
   - ⚠️ **Privacy policy link**: **This is REQUIRED for External apps**
   - ⚠️ Application home page: May be required

2. **Scopes:**
   - Should show: `openid`, `profile`, `email`
   - Check if there are any warnings about "sensitive scopes"

3. **Verification status:**
   - Look for any messages about verification
   - May say "Unverified" if verification is needed

4. **Authorized domains:**
   - Should include: `onrender.com`
   - Should include: `oxfordhouse.org` (or your domain)

## Quick Fixes

### If Privacy Policy is Missing:

Create a simple privacy policy page and add it:

1. **Quick option**: Use a simple GitHub Pages or placeholder page
2. **URL format**: `https://yourdomain.com/privacy` or similar
3. **Add it in**: OAuth Consent Screen → Privacy policy link field

### If Verification is Required:

- May need to submit app for Google verification
- Can take a few days
- OR use "Testing" mode temporarily (but limits users)

## What's the Exact Error?

Please check:
1. **Full error message** from Google's "Access blocked" page
2. **Any warnings** on the Consent Screen page
3. **Privacy policy field** - is it filled or empty?

