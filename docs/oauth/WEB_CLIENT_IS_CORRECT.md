# ✅ Add to the Web OAuth Client (That's Correct!)

## Answer: Yes, Add to the **Web** OAuth Client

For Expo mobile apps using the proxy flow, you use the **Web application** OAuth client ID and add redirect URIs to that same **Web** client.

---

## 🔍 Why Use the Web Client?

Your code is already using the Web Client ID:
```typescript
// From googleAuthService.ts
private static GOOGLE_CLIENT_ID = '893722301667-bqc8ir7q35omj6s84l7ackvqoqrhtrv6.apps.googleusercontent.com';
// Comment says: "This is the Web Client ID that works for mobile apps"
```

For Expo apps with `useProxy: true`:
- ✅ Use **Web application** client ID
- ✅ Add Expo proxy redirect URI to the **Web** client
- ❌ You do NOT need separate iOS/Android clients for Expo proxy flow

---

## 📋 What to Do

### Add the Redirect URI to Your **Web** OAuth Client:

1. **Go to:** https://console.cloud.google.com
2. **Navigate:** APIs & Services → Credentials
3. **Find:** Your **Web application** OAuth Client ID (`893722301667-bqc8ir7q35omj6s84l7ackvqoqrhtrv6...`)
   - It should say "Web application" as the type
4. **Click on it** to edit
5. **Scroll to:** "Authorized redirect URIs"
6. **Click:** "+ ADD URI"
7. **Add:** `https://auth.expo.io/@goosew27/oh-staff-tracker`
8. **Click:** "SAVE"
9. **Wait:** 1-2 minutes

---

## ✅ Your Web Client Should Have These Redirect URIs:

**Authorized redirect URIs:**
```
https://oxford-mileage-backend.onrender.com/api/auth/google/callback  (web portal)
http://localhost:3002/api/auth/google/callback  (local web)
https://auth.expo.io/@goosew27/oh-staff-tracker  (mobile app - ADD THIS)
```

---

## 🔍 When Would You Need Separate Mobile Clients?

You only need separate iOS/Android OAuth clients if:
- You're using native OAuth flows (NOT using Expo proxy)
- You want platform-specific bundle IDs for verification
- You're building standalone native apps without Expo

**For Expo proxy flow (what you're using), the Web client is perfect!** ✅

---

## 📝 Summary

- ✅ **Web** OAuth client = Correct for Expo proxy flow
- ✅ Add `https://auth.expo.io/@goosew27/oh-staff-tracker` to **Web** client
- ✅ Your code is already using the Web Client ID (which is correct)

**So yes, add it to the Web OAuth client - that's exactly right!** ✅

