# Verify Redirect URI Exact Match

## The Issue

Google is returning "access blocked: this app's request is invalid" which usually means:
1. **Redirect URI doesn't match EXACTLY** what's in Google Cloud Console
2. Missing or invalid parameters
3. Client ID type mismatch

## What to Check

### 1. Get the EXACT Redirect URI from Mobile App Logs

Look for this line in your mobile app logs:
```
🔍 Redirect URI (exact, no encoding): "..."
```

### 2. Compare with Google Cloud Console

Go to: https://console.cloud.google.com/apis/credentials

1. Click on your OAuth Client ID
2. Look at "Authorized redirect URIs"
3. Compare character-by-character with the log output

### 3. Common Mismatches

**Trailing slash:**
- ❌ `https://oxford-mileage-backend.onrender.com/api/auth/google/mobile/callback/`
- ✅ `https://oxford-mileage-backend.onrender.com/api/auth/google/mobile/callback`

**HTTP vs HTTPS:**
- ❌ `http://oxford-mileage-backend.onrender.com/...`
- ✅ `https://oxford-mileage-backend.onrender.com/...`

**Extra spaces:**
- ❌ `https://oxford-mileage-backend.onrender.com/api/auth/google/mobile/callback ` (space at end)
- ✅ `https://oxford-mileage-backend.onrender.com/api/auth/google/mobile/callback`

**Case sensitivity:**
- Must match exactly (though URLs are usually lowercase)

### 4. What the Logs Should Show

After the code changes, you should see:
- `🔍 Full OAuth URL:` - Complete URL with all parameters
- `🔍 Redirect URI (exact, no encoding):` - Exact string being sent
- `🔍 All URL parameters:` - All parameters in the request

Compare these with Google Cloud Console.

## Quick Fix Steps

1. **Check the logs** for the exact redirect URI
2. **Copy it exactly** (including https://, no trailing slash)
3. **Go to Google Cloud Console** → Credentials → Your OAuth Client
4. **Remove the current redirect URI** if it doesn't match exactly
5. **Add the exact redirect URI** from the logs
6. **Save** and wait 1-2 minutes
7. **Try OAuth again**

The redirect URI must match **EXACTLY** character-for-character!

