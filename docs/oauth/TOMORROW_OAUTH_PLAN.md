# OAuth Fix Plan for Tomorrow

## Current Situation

### Problem
- Mobile Google OAuth failing with "access blocked: this app's request is invalid"
- App is set to **"Internal"** user type in Google Cloud Console
- Internal apps have strict restrictions that are causing issues

### Attempted Solutions Today
1. ✅ Backend proxy flow (using HTTPS redirect URI)
2. ✅ iOS client ID with reverse client ID URL scheme
3. ⚠️ Still getting "invalid request" errors

### Current Code State
- **Mobile app**: Using iOS client ID `893722301667-p3fvq01ati1tustt2hvjasmhhn8fbjsg`
- **Redirect URI**: `com.googleusercontent.apps.893722301667-p3fvq01ati1tustt2hvjasmhhn8fbjsg:/oauth/callback`
- **Backend**: Has email domain filtering code (`ALLOWED_EMAIL_DOMAINS`)
- **app.json**: iOS URL scheme configured

## Solution: Make App External + Backend Domain Filtering

### Why This Will Work
- **External apps** don't have Internal app restrictions
- **Backend filtering** controls who can actually sign in
- Simpler OAuth flow, fewer restrictions
- Standard OAuth patterns work

### Security
- Anyone can attempt OAuth (but backend will reject unauthorized domains)
- Only users with allowed email domains can complete login
- Backend code already checks `ALLOWED_EMAIL_DOMAINS`

---

## Step-by-Step Plan for Tomorrow

### Step 1: Make OAuth App External (5 minutes)

1. Go to: https://console.cloud.google.com/apis/credentials/consent
2. Click **"PUBLISH APP"** or **"Make external"** button
3. Confirm the change
4. Wait 2-3 minutes for changes to propagate

**Result**: App status changes from "Internal" to "In production"

---

### Step 2: Decide on Client ID Strategy (5 minutes)

You have two options:

#### Option A: Use Web Client ID (Simpler)
- **Client ID**: `893722301667-bqc8ir7q35omj6s84l7ackvqoqrhtrv6`
- **Redirect URI**: `https://oxford-mileage-backend.onrender.com/api/auth/google/mobile/callback`
- **Pros**: Works with backend proxy, same as web portal
- **Cons**: Requires backend endpoint

#### Option B: Use iOS Client ID (Current)
- **Client ID**: `893722301667-p3fvq01ati1tustt2hvjasmhhn8fbjsg`
- **Redirect URI**: `com.googleusercontent.apps.893722301667-p3fvq01ati1tustt2hvjasmhhn8fbjsg:/oauth/callback`
- **Pros**: Direct app-to-app redirect, no backend proxy needed
- **Cons**: Need to ensure backend uses same client ID

**Recommendation**: Start with **Option B (iOS client)** since code is already set up. Can switch to Option A if needed.

---

### Step 3: Verify Backend Email Domain Filtering (10 minutes)

1. **Check Render Environment Variables**:
   - Go to: https://dashboard.render.com
   - Select your backend service
   - Go to "Environment" tab
   - Check if `ALLOWED_EMAIL_DOMAINS` is set

2. **Set ALLOWED_EMAIL_DOMAINS** (if not set):
   - Add environment variable: `ALLOWED_EMAIL_DOMAINS`
   - Value: Your organization's email domain(s)
   - Example: `yourdomain.com,anotherdomain.com`
   - **OR** leave empty `ALLOWED_EMAIL_DOMAINS=` to allow all domains (less secure)

3. **Verify Backend Code**:
   - Code already has domain filtering at lines 404-412 and 680-688 in `admin-web/backend/routes/auth.js`
   - Should reject unauthorized domains automatically

---

### Step 4: Update Backend Client ID (If Needed) (5 minutes)

**If using iOS Client ID (Option B)**:

1. **Check Render Environment Variables**:
   - Variable: `GOOGLE_CLIENT_ID`
   - Current value: Probably the web client ID

2. **Update if needed**:
   - Change `GOOGLE_CLIENT_ID` to: `893722301667-p3fvq01ati1tustt2hvjasmhhn8fbjsg`
   - **OR** keep web client ID if you want to use Option A instead

3. **Restart backend** after changing environment variables

**Note**: Web OAuth might break if you change this. Consider:
- Using same client ID for both (works for External apps)
- OR handling both client IDs in backend code

---

### Step 5: Test OAuth Flow (15 minutes)

1. **Restart mobile app** completely
2. **Try Google Sign-In**:
   - Should see Google login page (not error screen)
   - Sign in with your organization email
   - Should redirect back to app

3. **If using iOS Client ID**:
   - Check logs for: `🔍 Deep link received: com.googleusercontent.apps.893722301667-...`
   - Should receive authorization code directly from Google

4. **If using Web Client ID**:
   - Google redirects to backend
   - Backend redirects to app
   - App receives token via deep link

5. **Verify domain filtering**:
   - Try signing in with a non-organization email
   - Backend should reject it
   - Error: "Access restricted to organization email addresses only"

---

### Step 6: Troubleshooting (If Needed)

**If still getting errors:**

1. **Check Google Console**:
   - Verify app is now "In production" (External)
   - Check redirect URIs match exactly
   - Verify client ID is correct

2. **Check Backend Logs**:
   - Look for OAuth callback errors
   - Verify domain filtering is working
   - Check if client ID matches

3. **Check Mobile App Logs**:
   - Look for redirect URI being sent
   - Verify deep link is received
   - Check for authorization code or token

4. **Common Issues**:
   - **Redirect URI mismatch**: Must match exactly (no trailing slash, exact case)
   - **Client ID mismatch**: Backend and mobile must use same client ID
   - **Domain not allowed**: Check `ALLOWED_EMAIL_DOMAINS` environment variable

---

## Quick Reference

### Google Cloud Console Links
- **OAuth Consent Screen**: https://console.cloud.google.com/apis/credentials/consent
- **Credentials**: https://console.cloud.google.com/apis/credentials

### Client IDs
- **Web**: `893722301667-bqc8ir7q35omj6s84l7ackvqoqrhtrv6.apps.googleusercontent.com`
- **iOS**: `893722301667-p3fvq01ati1tustt2hvjasmhhn8fbjsg.apps.googleusercontent.com`

### Redirect URIs
- **Web backend proxy**: `https://oxford-mileage-backend.onrender.com/api/auth/google/mobile/callback`
- **iOS reverse client ID**: `com.googleusercontent.apps.893722301667-p3fvq01ati1tustt2hvjasmhhn8fbjsg:/oauth/callback`

### Backend Files Modified
- `admin-web/backend/routes/auth.js` - OAuth callback handlers
- `src/services/googleAuthService.ts` - Mobile OAuth flow
- `app.json` - iOS URL scheme configuration

---

## Success Criteria

✅ App is "In production" (External) in Google Console  
✅ Mobile app can initiate OAuth (sees Google login page)  
✅ User can sign in with organization email  
✅ App receives authorization code/token  
✅ Non-organization emails are rejected by backend  
✅ User can complete login and access app  

---

## Notes

- External apps don't require test users - anyone can attempt OAuth
- Backend domain filtering is the security layer
- Web OAuth should continue working (uses same backend)
- May need to restart backend after changing environment variables
- Wait 2-3 minutes after making Google Console changes

Good luck tomorrow! 🚀

