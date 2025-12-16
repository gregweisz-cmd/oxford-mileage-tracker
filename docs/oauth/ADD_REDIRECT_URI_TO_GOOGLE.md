# Add Redirect URI to Google Cloud Console - Mobile OAuth

## 🔴 The Issue

Your mobile app is using a local IP redirect URI:
```
exp://192.168.86.101:8081
```

**Google OAuth rejects local IPs** - you need to add the public Expo proxy URL instead.

---

## ✅ The Fix

I've updated the code to use the Expo proxy redirect URI:
```
https://auth.expo.io/@goosew27/oh-staff-tracker
```

**Now you need to add this to Google Cloud Console.**

---

## 📋 Step-by-Step: Add Redirect URI

### Step 1: Go to Google Cloud Console
1. Visit: https://console.cloud.google.com
2. Make sure you're in the correct project

### Step 2: Navigate to OAuth Credentials
1. Click: **APIs & Services** (left sidebar)
2. Click: **Credentials**
3. Find your OAuth 2.0 Client ID: `893722301667-bqc8ir7q35omj6s84l7ackvqoqrhtrv6.apps.googleusercontent.com`
4. **Click on it** to edit

### Step 3: Add the Redirect URI
1. Scroll down to **"Authorized redirect URIs"**
2. Click **"+ ADD URI"** button
3. Enter this **exact** URI:
   ```
   https://auth.expo.io/@goosew27/oh-staff-tracker
   ```
4. Click **"SAVE"** (at the bottom)
5. Wait 1-2 minutes for changes to propagate

---

## ✅ Your Complete Redirect URI List

After adding, your OAuth client should have these redirect URIs:

**Authorized redirect URIs:**
```
https://oxford-mileage-backend.onrender.com/api/auth/google/callback
http://localhost:3002/api/auth/google/callback
https://auth.expo.io/@goosew27/oh-staff-tracker  ← ADD THIS ONE
```

---

## 🧪 Test After Adding

1. **Reload your mobile app** (if still running)
2. **Try Google sign-in again**
3. **Should work now!** ✅

---

## 🔍 Verify It's Added

After adding, you should see the redirect URI in your OAuth client settings:
- ✅ `https://auth.expo.io/@goosew27/oh-staff-tracker`

---

**Once you add this redirect URI to Google Cloud Console, the "Access blocked" error will be resolved!** ✅

