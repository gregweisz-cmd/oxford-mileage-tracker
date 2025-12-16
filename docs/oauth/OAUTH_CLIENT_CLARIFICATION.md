# OAuth Client Clarification - Web vs Mobile

## ✅ Answer: Add to the **Web** OAuth Client

For Expo mobile apps using the proxy flow, you use the **Web application** OAuth client ID and add the Expo proxy redirect URI to that same **Web** client.

---

## 🔍 Why Use the Web Client?

Your mobile app is already using the **Web application** Client ID:
```
893722301667-bqc8ir7q35omj6s84l7ackvqoqrhtrv6.apps.googleusercontent.com
```

This is correct! For Expo apps:
- ✅ Use **Web application** client ID
- ✅ Add Expo proxy redirect URI to the **Web** client's authorized redirect URIs
- ❌ You do NOT need a separate iOS/Android client for Expo proxy flow

---

## 📋 What to Do

### Add the Redirect URI to the **Web** OAuth Client:

1. **Go to:** https://console.cloud.google.com
2. **Navigate:** APIs & Services → Credentials
3. **Find:** Your **Web application** OAuth Client ID (`893722301667-bqc8ir7q35omj6s84l7ackvqoqrhtrv6...`)
4. **Click on it** (the Web one)
5. **Add redirect URI:** `https://auth.expo.io/@goosew27/oh-staff-tracker`
6. **Save**

---

## 🔍 Why Not Separate Mobile Clients?

You only need separate iOS/Android OAuth clients if:
- You're using native OAuth flows (not Expo proxy)
- You want to use bundle IDs/package names for verification
- You're building standalone native apps

For Expo with proxy flow (what you're using), the **Web** client is the right choice! ✅

---

## ✅ Your Web Client Should Have:

**Authorized redirect URIs:**
```
https://oxford-mileage-backend.onrender.com/api/auth/google/callback  (web portal)
http://localhost:3002/api/auth/google/callback  (local web)
https://auth.expo.io/@goosew27/oh-staff-tracker  (mobile app - ADD THIS)
```

---

**So yes, add it to the Web OAuth client - that's the correct one!** ✅

