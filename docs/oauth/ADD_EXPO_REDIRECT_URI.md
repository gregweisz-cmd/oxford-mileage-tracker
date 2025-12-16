# Add Expo Redirect URI to Google Cloud Console

## 🔴 The Problem

Your mobile app was using a **local IP redirect URI**:
```
exp://192.168.86.101:8081
```

Google OAuth **won't accept local IPs** - it needs a public URL.

---

## ✅ The Fix

I've updated the code to use **Expo's proxy redirect URI**:
```
https://auth.expo.io/@goosew27/oh-staff-tracker
```

This is a public URL that Google OAuth accepts.

---

## 📋 Now Add This to Google Cloud Console

### Step 1: Go to Google Cloud Console
1. Visit: https://console.cloud.google.com
2. Navigate: **APIs & Services** → **Credentials**

### Step 2: Add the Redirect URI
1. Click your OAuth Client ID: `893722301667-bqc8ir7q35omj6s84l7ackvqoqrhtrv6.apps.googleusercontent.com`
2. Scroll to **"Authorized redirect URIs"**
3. Click **"+ ADD URI"**
4. Add this **exact** URI:
   ```
   https://auth.expo.io/@goosew27/oh-staff-tracker
   ```
5. Click **"SAVE"**
6. Wait 1-2 minutes

---

## ✅ Your Complete Redirect URI List

After adding, you should have:

**Authorized redirect URIs:**
```
https://oxford-mileage-backend.onrender.com/api/auth/google/callback
http://localhost:3002/api/auth/google/callback
https://auth.expo.io/@goosew27/oh-staff-tracker  ← ADD THIS
```

---

## 🎯 That's It!

Once you add `https://auth.expo.io/@goosew27/oh-staff-tracker` to Google Cloud Console, mobile Google OAuth will work! ✅

---

**Quick action:** Go to Google Cloud Console and add the Expo proxy redirect URI now!

