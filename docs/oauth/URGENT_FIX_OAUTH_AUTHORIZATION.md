# 🚨 URGENT: Fix "Access blocked: Authorization Error"

## The Problem

When clicking "Sign in with Google" on mobile:
```
Access blocked: Authorization Error
```

**This means the redirect URI isn't in Google Cloud Console.**

---

## ✅ Quick Fix (5 Minutes)

### Step 1: Find Your Redirect URI

I've added logging. When you try to sign in, check your console/logs for:
```
🔍 Google OAuth Redirect URI: [URL HERE]
```

**Copy that exact URL!**

---

### Step 2: Add to Google Cloud Console

1. **Go to:** https://console.cloud.google.com

2. **Click:** APIs & Services → Credentials

3. **Click your OAuth Client ID:**
   - `893722301667-bqc8ir7q35omj6s84l7ackvqoqrhtrv6.apps.googleusercontent.com`

4. **Scroll to:** "Authorized redirect URIs"

5. **Click:** "+ ADD URI"

6. **Paste:** The exact redirect URI from your console log

7. **Click:** "SAVE"

8. **Wait:** 1-2 minutes

9. **Try Google sign-in again**

---

## 🔍 Expected Redirect URIs

Based on your setup, it's likely one of these:

**Option 1: Expo Proxy (most common)**
```
https://auth.expo.io/@goosew27/oh-staff-tracker
```

**Option 2: Custom Scheme**
```
ohstafftracker://oauth
```

**Check your console logs to see which one is actually being used!**

---

## ✅ After Adding

Your OAuth client should have these redirect URIs:

```
https://oxford-mileage-backend.onrender.com/api/auth/google/callback
http://localhost:3002/api/auth/google/callback
[YOUR_MOBILE_URI_FROM_LOGS]  ← Add this one
```

---

## 🎯 That's It!

Once you add the redirect URI from your console logs to Google Cloud Console, the error will be fixed! ✅

---

**Check your console logs for the exact redirect URI, then add it to Google Cloud Console!**
