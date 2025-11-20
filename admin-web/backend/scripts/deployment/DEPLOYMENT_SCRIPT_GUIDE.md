# Deployment Automation Scripts

## Overview

This script automates the deployment process by:
1. **Verifying** all backend URLs are correctly configured for production
2. **Ensuring** `vercel.json` has production backend URL
3. **Committing** all current changes with a deployment message
4. **Pushing** to GitHub (triggers Render/Vercel auto-deploy)

**Note:** This script does NOT need to switch URLs because:
- `vercel.json` always has production URL (used by Vercel)
- Components use `process.env.REACT_APP_API_URL` (localhost in dev, production in Vercel)
- Mobile app automatically uses production API in production builds via `__DEV__` flag

## Scripts

### `deploy-to-production.js`

Main deployment script that handles the full deployment workflow.

**Usage:**
```bash
cd admin-web/backend
node scripts/deployment/deploy-to-production.js
```

**Options:**
- `--no-push`: Skip git commit and push (just change URLs for testing)
- `--no-revert`: Keep production URLs after deployment (don't revert to local)

**Examples:**
```bash
# Full deployment (switches, commits, pushes, reverts)
node scripts/deployment/deploy-to-production.js

# Just switch URLs without pushing (for testing)
node scripts/deployment/deploy-to-production.js --no-push

# Deploy but keep production URLs (for production environment)
node scripts/deployment/deploy-to-production.js --no-revert
```

## What Gets Verified

### Web Portal (`admin-web/vercel.json`)
- **Already configured!** Has production URL: `https://oxford-mileage-backend.onrender.com`
- Script verifies it's correct (updates if needed)
- Vercel uses this environment variable during deployment

### Components (All React components)
- **Already configured!** Use `process.env.REACT_APP_API_URL` with localhost fallback
- Local dev: Uses `http://localhost:3002` (fallback)
- Vercel production: Uses `https://oxford-mileage-backend.onrender.com` (from `vercel.json`)

### Mobile App (`src/config/api.ts`)
- **Already configured!** 
- Development builds: Uses local network IP
- Production builds: Automatically uses `PRODUCTION_API_URL` via `__DEV__` flag
- **No manual switching needed!**

## Deployment Workflow

1. **Run deployment script:**
   ```bash
   node scripts/deployment/deploy-to-production.js
   ```

2. **Script does:**
   - ✅ Switches URLs to production
   - ✅ Commits changes with deployment message
   - ✅ Pushes to GitHub
   - ✅ Waits 5 seconds
   - ✅ Reverts URLs back to localhost
   - ✅ Commits revert

3. **Render & Vercel:**
   - Render auto-deploys backend from GitHub push
   - Vercel auto-deploys frontend from GitHub push

4. **Mobile App:**
   - Production builds automatically use production API
   - No changes needed!

## Verification

After deployment, verify:

1. **Backend (Render):**
   - Visit: https://oxford-mileage-backend.onrender.com
   - Should see API welcome message

2. **Frontend (Vercel):**
   - Visit your Vercel deployment URL
   - Check browser console for API calls to production URL

3. **Mobile App:**
   - Production builds automatically use production API
   - Check logs: Should see `🌍 PRODUCTION` in API config

## Notes

- **Local Development:** URLs are reverted to localhost after deployment
- **Production Environment:** URLs stay on production (configured in `vercel.json` env vars)
- **Mobile App:** Always uses production API in production builds (no manual switching needed)

## Troubleshooting

### Script fails to find files
- Make sure you're running from `admin-web/backend` directory
- Check file paths in `filesToUpdate` object

### Git push fails
- Make sure you're authenticated with GitHub
- Check that you have push permissions to the repository
- Verify you're on the correct branch (usually `main`)

### URLs not switching
- Check file paths are correct
- Verify the files exist in the repository
- Check console output for warnings about missing files

