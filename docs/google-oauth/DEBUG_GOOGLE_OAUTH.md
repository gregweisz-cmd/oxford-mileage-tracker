# Debug "missing_token" Error

## What to Check

### 1. Check Browser Console
When you click "Sign in with Google", check the browser console for:
- What URL you're redirected to after Google login
- Any error messages
- The debug logs I added to AuthCallback

### 2. Check the Redirect URL
After Google redirects you back, look at the browser address bar:
- It should show: `/auth/callback?token=session_xxx&email=xxx&returnUrl=/`
- If it shows just `/login?error=missing_token`, the token wasn't in the URL

### 3. Check Render Backend Logs
1. Go to: https://dashboard.render.com
2. Select your backend service
3. Go to **Logs** tab
4. Look for: `✅ Google OAuth login successful for...`
5. Check the redirect URL being logged

### 4. Verify Environment Variables on Render
Make sure these are set correctly:
- `FRONTEND_URL` = `https://oxford-mileage-tracker-git-main-goose-weiszs-projects.vercel.app`
  - NO trailing slash
  - Must be HTTPS
  - Must match your actual Vercel URL

### 5. Check Google Cloud Console
Make sure the redirect URI is set:
- `https://oxford-mileage-backend.onrender.com/api/auth/google/callback`

## Common Issues

**Issue 1: FRONTEND_URL not set**
- Backend uses `http://localhost:3000` as fallback
- Fix: Set `FRONTEND_URL` on Render

**Issue 2: FRONTEND_URL has trailing slash**
- `https://...vercel.app/` (wrong)
- Should be: `https://...vercel.app` (no slash)

**Issue 3: Redirect URI mismatch**
- Google redirects to backend callback
- Backend redirects to frontend
- If FRONTEND_URL is wrong, redirect fails

## Quick Test

1. Click "Sign in with Google"
2. Check browser address bar after redirect
3. Should see `/auth/callback?token=...` (success)
4. If you see `/login?error=missing_token` (failure)

If you see the error, check Render logs to see what redirect URL the backend is generating.

