# Fix "Access blocked: Authorization Error" for Mobile Google OAuth

## 🔴 The Problem

You're getting:
```
Access blocked: Authorization Error
```

This happens because the **redirect URI** that your mobile app is using doesn't match what's configured in Google Cloud Console.

---

## 🔍 What Redirect URI Is Being Used?

When using `expo-auth-session` with `useProxy: true`, Expo generates a redirect URI like:
```
https://auth.expo.io/@goosew27/oh-staff-tracker
```

**This URI must be added to Google Cloud Console!**

---

## ✅ Solution: Add Expo Redirect URI to Google Cloud Console

### Your Expo Redirect URI:
Based on your `app.json`:
- Owner: `goosew27`
- Slug: `oh-staff-tracker`

**The redirect URI should be:**
```
https://auth.expo.io/@goosew27/oh-staff-tracker
```

### Steps to Fix:

1. **Go to Google Cloud Console:**
   - https://console.cloud.google.com

2. **Navigate to OAuth Credentials:**
   - APIs & Services → Credentials
   - Click on your OAuth Client ID: `893722301667-bqc8ir7q35omj6s84l7ackvqoqrhtrv6.apps.googleusercontent.com`

3. **Add Authorized Redirect URI:**
   - Scroll to "Authorized redirect URIs"
   - Click "+ ADD URI"
   - Add: `https://auth.expo.io/@goosew27/oh-staff-tracker`
   - Click "SAVE"

4. **Wait 1-2 minutes** for changes to propagate

5. **Try Google sign-in again**

---

## 🔍 Alternative: Use Custom Scheme (More Reliable)

Instead of using Expo's proxy, we can use a custom scheme redirect URI which is more reliable:

### Option 1: Check What Redirect URI Is Actually Being Used

Add temporary logging to see the exact redirect URI:

```typescript
const redirectUri = this.getGoogleRedirectUri();
console.log('🔍 Redirect URI being used:', redirectUri);
```

Then add that exact URI to Google Cloud Console.

### Option 2: Use Custom Scheme (Recommended for Production)

Update the redirect URI to use your app's custom scheme:

```typescript
private static getGoogleRedirectUri(): string {
  return AuthSession.makeRedirectUri({
    scheme: 'ohstafftracker',
    path: 'oauth',
    useProxy: false,  // Use custom scheme instead
  });
}
```

Then add this redirect URI to Google Cloud Console:
```
ohstafftracker://oauth
```

---

## 📋 Current Redirect URIs in Google Cloud Console

Your OAuth client should have:

**Authorized redirect URIs:**
```
https://oxford-mileage-backend.onrender.com/api/auth/google/callback  (for web)
http://localhost:3002/api/auth/google/callback  (for local web)
https://auth.expo.io/@goosew27/oh-staff-tracker  (for mobile - ADD THIS)
```

---

## 🧪 Debug Steps

1. **Add logging** to see the exact redirect URI:
   ```typescript
   const redirectUri = this.getGoogleRedirectUri();
   console.log('🔍 Mobile redirect URI:', redirectUri);
   ```

2. **Check the error details** - Google's error page usually shows what redirect URI was attempted

3. **Verify in Google Cloud Console** - Check what redirect URIs are currently configured

---

## ✅ Quick Fix Checklist

- [ ] Go to Google Cloud Console
- [ ] APIs & Services → Credentials
- [ ] Click your OAuth Client ID
- [ ] Add redirect URI: `https://auth.expo.io/@goosew27/oh-staff-tracker`
- [ ] Save changes
- [ ] Wait 1-2 minutes
- [ ] Try Google sign-in again on mobile

---

**After adding the redirect URI to Google Cloud Console, the error should be resolved!** ✅

