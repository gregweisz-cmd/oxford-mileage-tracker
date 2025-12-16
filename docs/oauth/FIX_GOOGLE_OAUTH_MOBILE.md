# Fix Mobile Google OAuth Error

## 🔴 The Problem

After entering password, you see:
```
Something went wrong trying to finish signing in. 
please close this screen to go back to the app.
```

This happens because the backend is using the **wrong redirect URI** when exchanging the authorization code.

---

## ✅ The Fix

I've updated the code to:
1. **Pass redirect URI** from mobile app to backend
2. **Use correct redirect URI** when exchanging authorization code
3. **Match Expo proxy URI** that mobile app uses

---

## 🔧 Changes Made

### Mobile App (`googleAuthService.ts`)
- Now passes the redirect URI to the backend when verifying

### Backend (`auth.js`)
- Accepts `redirectUri` parameter from mobile app
- Creates a new OAuth client with the correct redirect URI
- Uses the mobile redirect URI when exchanging the code

---

## ✅ Result

The backend will now:
- ✅ Use the same redirect URI as the mobile app
- ✅ Successfully exchange the authorization code
- ✅ Complete the OAuth flow

---

## 🧪 Next Steps

1. **Reload the mobile app**
2. **Try Google sign-in again**
3. **It should work now!** ✅

---

**The OAuth flow should now complete successfully!** 🎉

