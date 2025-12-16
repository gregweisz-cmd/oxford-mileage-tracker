# Deploy OAuth Redirect Handler

## Problem

You're getting "cannot GET /oauth/mobile/redirect" because the route hasn't been deployed to Render yet.

## Solution

Deploy the backend changes to Render. The new route and HTML file need to be on the production backend.

## Files to Deploy

These files were just created/modified:
- ✅ `admin-web/backend/routes/oauthRedirect.js` - New route handler
- ✅ `admin-web/backend/public/oauth-redirect.html` - HTML redirect page
- ✅ `admin-web/backend/server.js` - Route registration

## Deployment Steps

### Option 1: Push to GitHub (Auto-Deploy)

If Render is set to auto-deploy from GitHub:

```bash
cd c:\Users\GooseWeisz\oxford-mileage-tracker
git add admin-web/backend/routes/oauthRedirect.js
git add admin-web/backend/public/oauth-redirect.html
git add admin-web/backend/server.js
git commit -m "Add OAuth redirect handler for mobile app"
git push origin main
```

Render will automatically deploy in 2-5 minutes.

### Option 2: Manual Deploy via Render Dashboard

1. Go to: https://dashboard.render.com
2. Find your backend service: "oxford-mileage-backend"
3. Click "Manual Deploy" → "Deploy latest commit"
4. Wait for deployment to complete (2-5 minutes)

## Verify Deployment

After deployment, test the endpoint:

```
https://oxford-mileage-backend.onrender.com/oauth/mobile/redirect?code=test
```

You should see the redirect page (not a 404 error).

## Current Status

✅ **Code complete** - All files created
⏳ **Need deployment** - Push to GitHub or manually deploy
⏳ **Then test** - Try OAuth again after deployment

## Quick Test (Local Backend)

If you want to test locally first, start your local backend:

```bash
cd admin-web/backend
npm start
```

Then update the mobile app's API config to use local backend temporarily (or test in dev mode).

