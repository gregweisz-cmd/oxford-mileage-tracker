# Fix Local Redirect URI Issue for Mobile Google OAuth

## 🔴 The Problem

Your mobile app is using a **local development redirect URI**:
```
exp://192.168.86.101:8081
```

**This is a local IP address** - Google OAuth won't accept it because it's not a public URL.

---

## ✅ The Solution

I've updated the code to use **Expo's proxy redirect URI** which is a public URL:

```
https://auth.expo.io/@goosew27/oh-staff-tracker
```

---

## 📋 Next Steps: Add Redirect URI to Google Cloud Console

### Step 1: Go to Google Cloud Console
1. Visit: https://console.cloud.google.com
2. Navigate to: **APIs & Services** → **Credentials**

### Step 2: Add the Redirect URI
1. Click on your OAuth Client ID: `893722301667-bqc8ir7q35omj6s84l7ackvqoqrhtrv6.apps.googleusercontent.com`
2. Scroll to **"Authorized redirect URIs"**
3. Click **"+ ADD URI"**
4. Add: `https://auth.expo.io/@goosew27/oh-staff-tracker`
5. Click **"SAVE"**
6. Wait 1-2 minutes for changes to propagate

---

## ✅ Complete Redirect URI List

Your OAuth client should have these redirect URIs:

**Authorized redirect URIs:**
```
https://oxford-mileage-backend.onrender.com/api/auth/google/callback
http://localhost:3002/api/auth/google/callback
https://auth.expo.io/@goosew27/oh-staff-tracker  ← ADD THIS ONE
```

---

## 🔍 What Changed

**Before:**
- Used local development URL: `exp://192.168.86.101:8081` ❌
- This doesn't work with Google OAuth

**After:**
- Uses Expo proxy URL: `https://auth.expo.io/@goosew27/oh-staff-tracker` ✅
- This is a public URL that Google OAuth accepts

---

## ✅ Quick Fix Checklist

- [ ] Code updated to use Expo proxy redirect URI ✅
- [ ] Add `https://auth.expo.io/@goosew27/oh-staff-tracker` to Google Cloud Console
- [ ] Wait 1-2 minutes
- [ ] Try Google sign-in again

---

**After adding the redirect URI to Google Cloud Console, the error should be resolved!** ✅

