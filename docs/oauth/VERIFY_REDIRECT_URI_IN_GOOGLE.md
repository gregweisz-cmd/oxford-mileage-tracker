# Verify Redirect URI in Google Cloud Console

## Current Status

✅ **Redirect URI is now correct**: `https://auth.expo.io/@goosew27/oh-staff-tracker`

But still getting "something went wrong" error. This means the redirect URI might not be registered in Google Cloud Console.

## Critical: Add Redirect URI to Google Cloud Console

The redirect URI **MUST** be in Google Cloud Console for OAuth to work:

1. Go to: https://console.cloud.google.com/apis/credentials

2. Find your **Web application** OAuth Client ID: `893722301667-bqc8ir7q35omj6s84l7ackvqoqrhtrv6`

3. Click to **Edit**

4. Scroll to **"Authorized redirect URIs"** section

5. **Check if this URI is listed**:
   ```
   https://auth.expo.io/@goosew27/oh-staff-tracker
   ```

6. **If it's NOT there**, add it:
   - Click "Add URI" or the "+" button
   - Paste exactly: `https://auth.expo.io/@goosew27/oh-staff-tracker`
   - Click "Save" or "Add"

7. **Wait 1-2 minutes** for Google to process the change

## Important Notes

- Make sure you're editing the **Web application** client (not iOS/Android)
- The URI must be **exactly** as shown (no trailing slash, correct capitalization)
- Changes can take 1-2 minutes to propagate

## After Adding Redirect URI

1. Wait 1-2 minutes
2. Restart mobile app
3. Try OAuth again

If it's still not working after adding the redirect URI, we'll need to check backend logs for more details.

