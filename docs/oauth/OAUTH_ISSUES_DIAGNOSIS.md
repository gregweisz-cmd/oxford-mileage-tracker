# OAuth & Network Issues Diagnosis

## Current Issues

### 1. OAuth Error: "Something went wrong trying to finish signing in"

**Symptoms:**
- Error appears after entering Google password
- No backend logs appear (backend never receives request)
- Error occurs before backend is called

**Root Cause:**
The error is happening in **Expo's OAuth proxy service**, not in our backend. This is why:
- Backend shows no logs (request never reaches backend)
- Error appears during redirect back from Google to Expo proxy
- This is a known Expo AuthSession proxy issue

**What's Happening:**
1. User clicks "Sign in with Google"
2. Expo redirects to Google (via Expo proxy)
3. User enters password successfully
4. Google redirects back to Expo proxy
5. **ERROR HERE**: Expo proxy fails to redirect back to app
6. Backend is never called

**Solution:**
This is an Expo proxy limitation. The enhanced logging we just added will show us exactly where it fails:
- Check mobile app console for logs starting with `🔍`
- Look for OAuth result type and error messages
- The logs will tell us if it's a redirect URI mismatch or proxy timeout

---

### 2. Network Timeout: Oxford Houses Fetch

**Symptoms:**
```
ERROR ❌ Error fetching Oxford Houses from backend: [TypeError: Network request timed out]
⚠️ Using 1 Oxford Houses from local database
```

**Root Cause:**
1. **Hardcoded URL Logic**: `oxfordHouseService.ts` was using its own API URL logic instead of centralized config
2. **Backend Cold Start**: Render free tier can take 30+ seconds to wake up from sleep
3. **Network Connectivity**: Production backend might be slow or unreachable

**Fixes Applied:**
- ✅ Updated `oxfordHouseService.ts` to use centralized `API_BASE_URL` from `src/config/api.ts`
- ✅ Now respects `USE_PRODUCTION_FOR_TESTING` setting
- ✅ Added better error logging

---

## Current Configuration

**Mobile App API Config** (`src/config/api.ts`):
- `USE_PRODUCTION_FOR_TESTING = true`
- Using: `https://oxford-mileage-backend.onrender.com/api`

**Backend Status:**
- ✅ Deployed successfully to Render.com
- ✅ Available at: `https://oxford-mileage-backend.onrender.com`
- ⚠️ Free tier can be slow on cold start (30+ seconds)

---

## Next Steps

### For OAuth Issue:
1. **Check mobile app console logs** after trying to sign in:
   - Look for logs starting with `🔍`
   - Note the OAuth result type
   - Check for any error messages

2. **Common Expo Proxy Issues:**
   - Redirect URI mismatch (already fixed)
   - Proxy timeout (network issue)
   - Browser cookie policies blocking redirect

3. **If Expo proxy continues to fail**, we may need to:
   - Switch to custom URL scheme (bypass proxy)
   - Implement alternative OAuth flow
   - Use web-based OAuth fallback

### For Network Timeout:
1. **Backend is deployed** - wait for cold start (first request can be slow)
2. **Check backend logs** on Render.com to see if request arrives
3. **Test backend directly**:
   ```bash
   curl https://oxford-mileage-backend.onrender.com/api/oxford-houses
   ```

4. **If timeout persists**:
   - Increase timeout in `API_CONFIG` (currently 30 seconds)
   - Check if backend is actually responding
   - Consider using local backend for testing: Set `USE_PRODUCTION_FOR_TESTING = false`

---

## Testing Checklist

- [ ] Check mobile app console for OAuth logs (`🔍` markers)
- [ ] Test backend API directly: `curl https://oxford-mileage-backend.onrender.com/api/oxford-houses`
- [ ] Check Render.com backend logs for any requests
- [ ] Verify backend is awake (not in sleep mode)
- [ ] Try OAuth sign-in again and capture all console logs
- [ ] Check if Oxford Houses timeout is resolved after fix

---

## Logs to Look For

### Mobile App Console:
```
🔍 Starting OAuth prompt with Expo proxy...
🔍 OAuth result received: { type: ..., hasCode: ..., error: ... }
🔍 Sending authorization code to backend: { backendUrl: ..., ... }
🔍 Backend response status: ...
```

### Backend Logs (Render.com):
- Should see: `🔐 Mobile: Exchanging Google authorization code for tokens...`
- If no logs appear, request isn't reaching backend (Expo proxy issue)

---

## Files Modified

1. **`src/services/googleAuthService.ts`**:
   - Added detailed logging throughout OAuth flow
   - Logs OAuth result type and error messages
   - Logs backend request/response details

2. **`src/services/oxfordHouseService.ts`**:
   - Now uses centralized `API_BASE_URL` config
   - Respects `USE_PRODUCTION_FOR_TESTING` setting
   - Consistent with rest of app

---

## Known Expo AuthSession Proxy Issues

According to Expo documentation and community reports:
- Proxy can be unreliable in some network conditions
- Browser cookie policies can block redirects
- Timeouts can occur during redirect handoff
- Recommended: Use custom URL scheme for production (bypasses proxy)

**Reference:** https://github.com/expo/expo/issues/8957

