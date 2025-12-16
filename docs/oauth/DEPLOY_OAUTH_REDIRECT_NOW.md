# Deploy OAuth Redirect Handler - URGENT

## Problem

Getting "cannot GET /oauth/mobile/redirect" because the route isn't deployed to Render yet.

## Quick Fix

The backend changes need to be deployed. Here's how:

## Files Created (Need to Deploy)

1. ✅ `admin-web/backend/routes/oauthRedirect.js` - Route handler
2. ✅ `admin-web/backend/public/oauth-redirect.html` - HTML redirect page  
3. ✅ `admin-web/backend/server.js` - Route registration (already updated)

## Deploy Now

### Step 1: Commit and Push to GitHub

```bash
cd c:\Users\GooseWeisz\oxford-mileage-tracker

# Add new files
git add admin-web/backend/routes/oauthRedirect.js
git add admin-web/backend/public/oauth-redirect.html
git add admin-web/backend/server.js

# Commit
git commit -m "Add OAuth redirect handler for mobile app"

# Push to trigger auto-deploy
git push origin main
```

### Step 2: Wait for Render Auto-Deploy

- Render should auto-deploy in 2-5 minutes
- Check status: https://dashboard.render.com
- Look for "oxford-mileage-backend" service

### Step 3: Verify Route Works

After deployment, test:
```
https://oxford-mileage-backend.onrender.com/oauth/mobile/redirect?code=test
```

Should show redirect page (not 404).

## Alternative: Manual Deploy

If auto-deploy isn't working:

1. Go to: https://dashboard.render.com
2. Find "oxford-mileage-backend" service
3. Click "Manual Deploy" → "Deploy latest commit"
4. Wait 2-5 minutes

## After Deployment

Once deployed, try OAuth again - it should work!

