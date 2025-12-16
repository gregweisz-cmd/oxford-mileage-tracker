# Fix "Access blocked: Authorization Error" - Mobile Google OAuth

## 🔴 The Error

```
Access blocked: Authorization Error
```

This means the **redirect URI** your mobile app is using doesn't match what's configured in Google Cloud Console.

---

## 🔍 What's Happening

Your mobile app uses Expo's AuthSession which generates a redirect URI. This URI **must be added** to Google Cloud Console.

**Expected redirect URI format:**
- Expo Proxy: `https://auth.expo.io/@goosew27/oh-staff-tracker`
- Custom Scheme: `ohstafftracker://oauth` (if using custom scheme)

---

## ✅ The Fix

### Step 1: Check Console Logs

I've added logging to show the exact redirect URI. When you try to sign in, check your console/logs for:
```
🔍 Google OAuth Redirect URI: [URL HERE]
🔍 Google OAuth Config: { clientId: '...', redirectUri: '...' }
```

**Copy that exact redirect URI** - it needs to match exactly in Google Cloud Console.

---

### Step 2: Add Redirect URI to Google Cloud Console

1. **Go to:** https://console.cloud.google.com

2. **Navigate to:**
   - APIs & Services → Credentials

3. **Click on your OAuth Client ID:**
   - `893722301667-bqc8ir7q35omj6s84l7ackvqoqrhtrv6.apps.googleusercontent.com`

4. **Scroll to "Authorized redirect URIs"**

5. **Click "+ ADD URI"**

6. **Add the redirect URI from your console log:**
   - Must be the **exact** URI from the logs
   - Example: `https://auth.expo.io/@goosew27/oh-staff-tracker`
   - Or: `ohstafftracker://oauth`

7. **Click "SAVE"**

8. **Wait 1-2 minutes** for changes to take effect

---

## 📋 Complete Redirect URI Checklist

After adding, your OAuth client should have:

**Authorized redirect URIs:**
```
https://oxford-mileage-backend.onrender.com/api/auth/google/callback  (web)
http://localhost:3002/api/auth/google/callback  (local web)
[YOUR_MOBILE_REDIRECT_URI]  ← Add the one from console logs
```

---

## 🔍 Additional Checks

### OAuth Consent Screen

Make sure it's configured:
1. APIs & Services → OAuth consent screen
2. App name: "Oxford House Expense Tracker"
3. Support email: Your email
4. If in "Testing" mode, add test users' emails

### Verify Exact Match

The redirect URI must match **EXACTLY**:
- ✅ Case-sensitive
- ✅ Full URL/path
- ✅ No trailing slashes
- ✅ Correct protocol (`https://` or custom scheme)

---

## ✅ Quick Action Items

1. **Try to sign in** - Check console logs for redirect URI
2. **Copy the exact URI** from logs
3. **Go to Google Cloud Console**
4. **Add the URI** to Authorized redirect URIs
5. **Save and wait** 1-2 minutes
6. **Try again** - Should work! ✅

---

**The redirect URI from your console logs must be added to Google Cloud Console!**

