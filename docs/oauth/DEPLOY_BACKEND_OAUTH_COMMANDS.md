# Deploy Backend OAuth Changes

## Directory
Run these commands from the **repository root**:
```
c:\Users\GooseWeisz\oxford-mileage-tracker
```

## Commands to Run

```bash
# Make sure you're in the repo root
cd c:\Users\GooseWeisz\oxford-mileage-tracker

# Add the backend auth file
git add admin-web/backend/routes/auth.js

# Commit the changes
git commit -m "Fix mobile OAuth: use Expo proxy redirect URI"

# Push to GitHub (Render will auto-deploy)
git push origin main
```

## What This Does

1. Stages the backend auth route file with OAuth fixes
2. Commits it with a descriptive message
3. Pushes to GitHub
4. Render.com will automatically deploy the changes (if auto-deploy is enabled)

## Verify Deployment

After pushing:
1. Go to: https://dashboard.render.com
2. Open your backend service
3. Check the "Events" or "Logs" tab to see deployment progress
4. Wait for deployment to complete

## Alternative: Manual Deploy on Render

If auto-deploy is not enabled:
1. Go to Render dashboard
2. Open your backend service
3. Click "Manual Deploy" → "Deploy latest commit"

