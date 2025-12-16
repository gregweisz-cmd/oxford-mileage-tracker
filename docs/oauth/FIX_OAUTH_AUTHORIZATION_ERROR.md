# Fix "Access blocked: Authorization Error" for Mobile Google OAuth

## 🔴 The Error

```
Access blocked: Authorization Error
```

This error means Google is blocking the OAuth request because the **redirect URI doesn't match** what's configured in Google Cloud Console.

---

## 🔍 The Problem

Your mobile app uses Expo's AuthSession which generates a redirect URI like:
```
https://auth.expo.io/@goosew27/oh-staff-tracker
```

**This redirect URI must be added to Google Cloud Console**, or Google will block the request.

---

## ✅ Solution: Add Expo Redirect URI to Google Cloud Console

### Step 1: Find Your Exact Redirect URI

I've added logging to show the exact redirect URI. Check your console/logs when you try to sign in - you should see:
```
🔍 Google OAuth Redirect URI: https://auth.expo.io/@goosew27/oh-staff-tracker
```

**Copy that exact URI** - it needs to match exactly in Google Cloud Console.

---

### Step 2: Add Redirect URI to Google Cloud Console

1. **Go to Google Cloud Console:**
   - https://console.cloud.google.com

2. **Navigate to OAuth Credentials:**
   - APIs & Services → Credentials
   - Click on your OAuth 2.0 Client ID: `893722301667-bqc8ir7q35omj6s84l7ackvqoqrhtrv6.apps.googleusercontent.com`

3. **Add Authorized Redirect URI:**
   - Scroll down to "Authorized redirect URIs"
   - Click "+ ADD URI"
   - Add the exact URI from your console log (likely: `https://auth.expo.io/@goosew27/oh-staff-tracker`)
   - Click "SAVE"

4. **Wait 1-2 minutes** for changes to propagate

5. **Try Google sign-in again**

---

## 📋 Your Current Redirect URIs

Your OAuth client should have these redirect URIs:

**Authorized redirect URIs:**
```
https://oxford-mileage-backend.onrender.com/api/auth/google/callback
http://localhost:3002/api/auth/google/callback
https://auth.expo.io/@goosew27/oh-staff-tracker  ← ADD THIS ONE
```

---

## 🔍 Additional Checks

### 1. Check OAuth Consent Screen

Make sure your OAuth consent screen is properly configured:
1. APIs & Services → OAuth consent screen
2. App name: "Oxford House Expense Tracker"
3. Support email: Your email
4. If testing: Add test users' emails

### 2. Check if App Needs Approval

If your app is in "Testing" mode:
- Add test users' email addresses to the consent screen
- Or publish the app (if ready for production)

### 3. Verify Client ID

Make sure you're using the correct Client ID:
- `893722301667-bqc8ir7q35omj6s84l7ackvqoqrhtrv6.apps.googleusercontent.com`
- This should be a **Web application** type (works for mobile too)

---

## 🧪 Debug Steps

1. **Check the console log** - You'll see the exact redirect URI being used
2. **Copy that exact URI** - Include the full path
3. **Add it to Google Cloud Console** - Must match exactly (case-sensitive, includes path)
4. **Save and wait** - Changes can take 1-2 minutes to propagate
5. **Try again** - The error should be resolved

---

## ✅ Quick Fix Checklist

- [ ] Check console/logs for the exact redirect URI
- [ ] Go to Google Cloud Console
- [ ] APIs & Services → Credentials
- [ ] Click your OAuth Client ID
- [ ] Add the exact redirect URI from logs
- [ ] Save changes
- [ ] Wait 1-2 minutes
- [ ] Try Google sign-in again

---

**The redirect URI must match EXACTLY** - including protocol (https), domain, and any path. Once you add it to Google Cloud Console, the error should be resolved! ✅

