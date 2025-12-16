# Check Google Cloud Console Configuration

## Critical: Verify Redirect URI is Registered

The error "something went wrong before I can even enter my credentials" suggests Google is rejecting the OAuth request immediately. This is almost always because the redirect URI isn't registered correctly.

## Steps to Check

### 1. Go to Google Cloud Console

Visit: https://console.cloud.google.com/apis/credentials

### 2. Find Your OAuth 2.0 Client

Look for client ID: `893722301667-bqc8ir7q35omj6s84l7ackvqoqrhtrv6`

### 3. Check Redirect URIs

Open the client and check the **"Authorized redirect URIs"** section.

**You need this EXACT URI:**
```
https://auth.expo.io/@goosew27/oh-staff-tracker
```

**Important Notes:**
- Must be **exact match** (no trailing slashes, no typos)
- Check if it's in the **Web Client** section (Expo proxy uses web client)
- Make sure there are no extra spaces

### 4. If URI is Missing - Add It

1. Click **"Edit"** on the OAuth client
2. Under **"Authorized redirect URIs"**, click **"+ ADD URI"**
3. Enter: `https://auth.expo.io/@goosew27/oh-staff-tracker`
4. Click **"Save"**
5. Wait 1-2 minutes for changes to propagate

### 5. Verify Client Type

Make sure you're editing the **Web Client** (not iOS/Android):
- Web Client can have multiple redirect URIs
- Expo proxy requires Web Client redirect URI

## What to Look For

✅ **Correct Configuration:**
- Redirect URI exists in Web Client
- Exact match: `https://auth.expo.io/@goosew27/oh-staff-tracker`
- No typos or extra characters

❌ **Common Issues:**
- URI not in the list
- URI in wrong client (iOS/Android instead of Web)
- Typo in URI (missing `/`, wrong username, etc.)
- Extra spaces or characters

## After Adding/Checking

1. Wait 1-2 minutes for Google to propagate changes
2. Try OAuth again in the mobile app
3. Check console logs for detailed error messages

## Alternative: Use Custom URL Scheme

If Expo proxy continues to fail, we can bypass it entirely by using a custom URL scheme:
- More reliable
- Bypasses Expo proxy issues
- Requires different redirect URI: `ohstafftracker://oauth/callback`

Let me know if you'd like to switch to this approach instead.

