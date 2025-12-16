# Debugging "Access Blocked: This app's request is invalid"

## Possible Causes

1. **Backend not deployed yet** - The redirect URI points to `/api/auth/google/mobile/callback` which needs to exist on Render
2. **Redirect URI mismatch** - Must match EXACTLY what's in Google Cloud Console
3. **Client ID mismatch** - Wrong client ID for mobile vs web

## Steps to Debug

### 1. Verify Backend is Deployed

Check if the endpoint exists:
```
https://oxford-mileage-backend.onrender.com/api/auth/google/mobile/callback
```

Visit this URL in a browser - if you get 404, the backend isn't deployed yet.

### 2. Verify Redirect URI in Google Console

Go to: https://console.cloud.google.com/apis/credentials

Check that this EXACT URI is listed:
```
https://oxford-mileage-backend.onrender.com/api/auth/google/mobile/callback
```

**Important**: 
- Must match EXACTLY (including https://, no trailing slash)
- Case-sensitive
- No extra spaces

### 3. Check Mobile App Logs

Look for these log messages:
- `🔍 Google OAuth Redirect URI (backend proxy): ...`
- `🔍 Generated OAuth URL ...`
- `🔍 Redirect URI being sent: ...`

Compare the redirect URI in logs with what's in Google Console.

### 4. Common Issues

**Issue**: Redirect URI has trailing slash
- ❌ `https://oxford-mileage-backend.onrender.com/api/auth/google/mobile/callback/`
- ✅ `https://oxford-mileage-backend.onrender.com/api/auth/google/mobile/callback`

**Issue**: Using HTTP instead of HTTPS
- ❌ `http://oxford-mileage-backend.onrender.com/...`
- ✅ `https://oxford-mileage-backend.onrender.com/...`

**Issue**: Backend endpoint doesn't exist
- Solution: Deploy backend changes first

## Quick Fix

1. **Deploy backend** (if not deployed):
   ```bash
   git add admin-web/backend/routes/auth.js
   git commit -m "Add mobile OAuth callback endpoint"
   git push origin main
   ```

2. **Verify redirect URI** in Google Console matches exactly:
   ```
   https://oxford-mileage-backend.onrender.com/api/auth/google/mobile/callback
   ```

3. **Wait 2-3 minutes** after deploy for changes to propagate

4. **Restart mobile app** and try again

