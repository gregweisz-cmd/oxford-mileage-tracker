# Verify Expo Proxy Redirect URI

## Problem

Getting "Access blocked: Authorization Error" on mobile, but web portal works fine. This suggests the Expo proxy redirect URI might not be in Google Cloud Console.

## Check What Redirect URI is Being Used

The mobile app is now using Expo's proxy. Check the console logs to see what redirect URI is being generated - it should be:
```
https://auth.expo.io/@goosew27/oh-staff-tracker
```

## Fix: Verify Redirect URI in Google Cloud Console

1. Go to: https://console.cloud.google.com/apis/credentials

2. Find your **Web application** OAuth Client ID: `893722301667-bqc8ir7q35omj6s84l7ackvqoqrhtrv6`

3. Click to **Edit** it

4. Check **"Authorized redirect URIs"** - make sure this is in there:
   ```
   https://auth.expo.io/@goosew27/oh-staff-tracker
   ```

5. If it's **NOT** in there, add it:
   - Click "Add URI"
   - Enter: `https://auth.expo.io/@goosew27/oh-staff-tracker`
   - Click "Save"

6. Wait 1-2 minutes for changes to propagate

## Also Check These

- Make sure you're editing the **Web application** client (not iOS/Android)
- Make sure the redirect URI is **exactly** as shown above (no trailing slash, correct username/slug)

## Test Again

After adding the redirect URI, restart the mobile app and try OAuth again.

