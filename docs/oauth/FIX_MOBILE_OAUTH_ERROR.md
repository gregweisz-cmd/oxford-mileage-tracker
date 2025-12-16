# Fix "Access blocked: Authorization Error" for Mobile Google OAuth

## 🔴 The Error

```
Access blocked: Authorization Error
```

This error means Google is blocking the OAuth request because the **redirect URI doesn't match** what's configured in Google Cloud Console.

---

## 🔍 The Problem

When using Expo's `AuthSession` with `useProxy: true`, it generates a redirect URI like:
```
https://auth.expo.io/@goosew27/oh-staff-tracker
```

This URI **must be added** to Google Cloud Console, or Google will block it.

---

## ✅ Solution: Add Expo Redirect URI to Google Cloud Console

### Step 1: Find Your Expo Redirect URI

The redirect URI format is:
```
https://auth.expo.io/@[EXPO_USERNAME]/[EXPO_SLUG]
```

Based on your `app.json`:
- **Expo Username**: `goosew27` (from `"owner": "goosew27"`)
- **Expo Slug**: `oh-staff-tracker` (from `"slug": "oh-staff-tracker"`)

**Your redirect URI should be:**
```
https://auth.expo.io/@goosew27/oh-staff-tracker
```

---

### Step 2: Add Redirect URI to Google Cloud Console

1. **Go to Google Cloud Console:**
   - https://console.cloud.google.com

2. **Navigate to OAuth Credentials:**
   - APIs & Services → Credentials
   - Click on your OAuth 2.0 Client ID: `893722301667-bqc8ir7q35omj6s84l7ackvqoqrhtrv6.apps.googleusercontent.com`

3. **Add Authorized Redirect URIs:**
   - Scroll down to "Authorized redirect URIs"
   - Click "+ ADD URI"
   - Add: `https://auth.expo.io/@goosew27/oh-staff-tracker`
   - Click "SAVE"

---

### Step 3: Verify Your Current Redirect URIs

Your OAuth client should have these redirect URIs:

**Authorized redirect URIs:**
```
https://oxford-mileage-backend.onrender.com/api/auth/google/callback
http://localhost:3002/api/auth/google/callback
https://auth.expo.io/@goosew27/oh-staff-tracker  ← ADD THIS ONE
```

**Authorized JavaScript origins:**
```
https://oxford-mileage-backend.onrender.com
https://oxford-mileage-tracker-git-main-goose-weiszs-projects.vercel.app
http://localhost:3002
```

---

## 🧪 Alternative: Use Custom Redirect URI (If Expo Proxy Doesn't Work)

If the Expo proxy doesn't work, you can configure a custom redirect URI:

1. **In `app.json`, add:**
   ```json
   {
     "expo": {
       "scheme": "ohstafftracker",
       ...
     }
   }
   ```
   (Already added ✅)

2. **Update `googleAuthService.ts` to use custom redirect:**
   ```typescript
   private static getGoogleRedirectUri(): string {
     return AuthSession.makeRedirectUri({
       native: 'ohstafftracker://oauth',  // Use custom scheme
       useProxy: false,  // Disable Expo proxy
     });
   }
   ```

3. **Add to Google Cloud Console:**
   - `ohstafftracker://oauth`

---

## 🔍 Debug: Check What Redirect URI Is Being Used

To see what redirect URI your app is actually using, temporarily add logging:

```typescript
const redirectUri = this.getGoogleRedirectUri();
console.log('🔍 Redirect URI:', redirectUri);
```

Then check the console when you try to sign in.

---

## ✅ Quick Checklist

- [ ] Open Google Cloud Console
- [ ] Go to Credentials → Your OAuth Client ID
- [ ] Add redirect URI: `https://auth.expo.io/@goosew27/oh-staff-tracker`
- [ ] Save changes
- [ ] Wait 1-2 minutes for changes to propagate
- [ ] Try Google sign-in again on mobile

---

## 🆘 Still Not Working?

### Check OAuth Consent Screen

Make sure your OAuth consent screen is configured:
1. APIs & Services → OAuth consent screen
2. Should be set to "Internal" (if you have Google Workspace) or "External"
3. App name: "Oxford House Expense Tracker"
4. Support email: Your email

### Check Client ID

Verify you're using the correct Client ID:
- Current: `893722301667-bqc8ir7q35omj6s84l7ackvqoqrhtrv6.apps.googleusercontent.com`
- This should be a **Web application** type client (works for mobile too)

### Test the Redirect URI

You can verify the redirect URI format by checking Expo's documentation or logging it in your app.

---

**Once you add the redirect URI to Google Cloud Console, the error should be resolved!** ✅

