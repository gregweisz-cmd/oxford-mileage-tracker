# OAuth Cancel Issue - Diagnosis

## Current Situation

The logs show `"type": "cancel"` which means the OAuth window closed without completing. This typically happens when:

1. **Google shows an error page** → User sees error → Window closes → Result is "cancel"
2. **Redirect URI mismatch** → Google rejects → Shows error → Window closes
3. **OAuth Consent Screen issue** → Google blocks → Shows error → Window closes

## What to Check

### When You Click "Sign in with Google":

**Question**: What do you see after clicking the button?

**Option A**: Browser opens but immediately shows a Google error page
- ✅ This is a Google configuration issue
- Check: Redirect URI in Google Cloud Console
- Check: OAuth Consent Screen configuration

**Option B**: Browser opens, shows Google login page, but then closes with error
- ✅ Redirect URI might be wrong
- Check: Google Cloud Console redirect URIs

**Option C**: Browser opens, you can enter credentials, but then shows error
- ✅ OAuth Consent Screen or app permissions issue
- Check: Test users list (if app is in Testing mode)

**Option D**: Browser opens but immediately closes (no error visible)
- ✅ Possible redirect URI mismatch
- Check: Google Cloud Console

## Most Likely Issue

Based on "cancel" result, Google is likely **showing an error page** that causes the window to close.

### Check Google Cloud Console NOW:

1. **Go to**: https://console.cloud.google.com/apis/credentials
2. **Find OAuth Client**: `893722301667-bqc8ir7q35omj6s84l7ackvqoqrhtrv6`
3. **Click Edit**
4. **Check "Authorized redirect URIs"**:
   - Is `https://auth.expo.io/@goosew27/oh-staff-tracker` listed?
   - If not, **ADD IT NOW** and Save

### Check OAuth Consent Screen:

1. **Go to**: https://console.cloud.google.com/apis/credentials/consent
2. **Check**:
   - App is in "Testing" mode
   - Your email is in "Test users" list
   - If not, add yourself as a test user

## Next Test

After checking Google Cloud Console:

1. **Restart mobile app completely**
2. **Click "Sign in with Google"**
3. **Watch what happens**:
   - Does browser open?
   - What page do you see?
   - Any error message visible?
   - Does it close automatically or do you close it?

## If Still Getting Cancel

The "something went wrong" message might be coming from Expo when the redirect fails. We need to see what Google is actually showing.

**Try this**:
1. Click "Sign in with Google"
2. **Don't close the browser window immediately**
3. **Look at the URL** in the browser address bar
4. **Check if there's an error in the URL** (like `error=redirect_uri_mismatch`)

## Alternative: Test Redirect URI Directly

We can test if the redirect URI is accepted by Google by constructing a test URL, but first let's make sure it's in Google Cloud Console!

