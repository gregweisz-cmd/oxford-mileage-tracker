# Fix "missing_token" Error

## Problem
After Google OAuth redirect, you're seeing "missing_token" error. This means the token isn't being passed from backend to frontend correctly.

## Root Cause Analysis

The backend creates a session token and redirects to:
```
${FRONTEND_URL}/auth/callback?token=${sessionToken}&email=${email}&returnUrl=${returnUrl}
```

But the frontend isn't receiving the token in the URL parameters.

## Possible Issues

1. **Backend redirect URL might be wrong** - Check that `FRONTEND_URL` is set correctly on Render
2. **Frontend routing issue** - The `/auth/callback` route might not be handled properly
3. **URL parameters getting stripped** - Something might be removing query params

## Quick Debug Steps

1. **Check browser console** when you click "Sign in with Google":
   - Look at the network tab
   - See what URL you're redirected to after Google login
   - Check if the token is in the URL

2. **Check backend logs on Render**:
   - Look for the redirect URL being logged
   - Verify `FRONTEND_URL` is set correctly

3. **Check the redirect URL format**:
   - Should be: `https://your-vercel-app.vercel.app/auth/callback?token=session_xxx&email=xxx&returnUrl=/`

## Solution

The token should be in the URL after Google redirects back. If it's not, the issue is with the backend redirect or the `FRONTEND_URL` environment variable.

**Check on Render:**
- Environment variable `FRONTEND_URL` should be your Vercel URL
- It should NOT have a trailing slash
- It should be the full URL: `https://oxford-mileage-tracker-git-main-goose-weiszs-projects.vercel.app`

## Temporary Workaround

If the token isn't working, we can modify the backend to include employee data directly in the redirect URL (base64 encoded), but the proper fix is to ensure the token is passed correctly.

---

**Next Steps:**
1. Check the browser's Network tab to see the actual redirect URL
2. Verify `FRONTEND_URL` is set correctly on Render
3. Check backend logs to see what redirect URL is being generated

