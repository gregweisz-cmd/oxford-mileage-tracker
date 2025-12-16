# Mobile OAuth Redirect URI Fix

## 🔴 Problem Found!

Your redirect URI is using a **local IP address**:
```
exp://192.168.86.101:8081
```

**Google OAuth won't accept this** - it needs a public URL!

---

## ✅ Fix Applied

I've updated the code to **force use of Expo's proxy redirect URI**:
```
https://auth.expo.io/@goosew27/oh-staff-tracker
```

This is a public URL that Google will accept.

---

## 📋 Now Add This to Google Cloud Console

### The Redirect URI You Need to Add:

```
https://auth.expo.io/@goosew27/oh-staff-tracker
```

### Steps:

1. **Go to:** https://console.cloud.google.com
2. **Navigate:** APIs & Services → Credentials
3. **Click:** Your OAuth Client ID (`893722301667-bqc8ir7q35omj6s84l7ackvqoqrhtrv6...`)
4. **Scroll to:** "Authorized redirect URIs"
5. **Click:** "+ ADD URI"
6. **Add:** `https://auth.expo.io/@goosew27/oh-staff-tracker`
7. **Save**
8. **Wait 1-2 minutes**

---

## ✅ Complete Redirect URI List

After adding, you should have:

**Authorized redirect URIs:**
```
https://oxford-mileage-backend.onrender.com/api/auth/google/callback
http://localhost:3002/api/auth/google/callback
https://auth.expo.io/@goosew27/oh-staff-tracker  ← ADD THIS
```

---

## 🎯 What Changed

**Before:**
- Local IP: `exp://192.168.86.101:8081` ❌ (Google rejects this)

**After:**
- Expo proxy: `https://auth.expo.io/@goosew27/oh-staff-tracker` ✅ (Google accepts this)

---

**Add the Expo proxy redirect URI to Google Cloud Console and mobile OAuth will work!** ✅

