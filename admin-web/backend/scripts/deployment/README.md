# Deployment Scripts

## Quick Start

```bash
# From admin-web/backend directory
npm run deploy
```

This will:
1. ✅ Verify all backend URLs are correctly configured
2. ✅ Commit all current changes
3. ✅ Push to GitHub (triggers Render/Vercel auto-deploy)

## Scripts Available

### `deploy-to-production.js`

Main deployment script with options:

```bash
# Full deployment (verify, commit, push)
node scripts/deployment/deploy-to-production.js

# Just verify configuration (don't commit/push)
node scripts/deployment/deploy-to-production.js --verify-only

# Verify and commit, but don't push (for testing)
node scripts/deployment/deploy-to-production.js --no-push
```

## NPM Scripts

Added to `package.json`:

- `npm run deploy` - Full deployment (verify, commit, push)
- `npm run deploy:no-push` - Verify and prepare, but don't push
- `npm run deploy:production` - Deploy and keep production URLs (rarely needed)

## How It Works

### URL Configuration

**Web Portal:**
- `vercel.json` → Always has production URL (used by Vercel)
- Components → Use `process.env.REACT_APP_API_URL` with localhost fallback
  - Local dev: `http://localhost:3002` (fallback)
  - Vercel prod: `https://oxford-mileage-backend.onrender.com` (from env)

**Mobile App:**
- `src/config/api.ts` → Uses `__DEV__` flag automatically
  - Development builds: Local network IP
  - Production builds: Production URL automatically

**Result:** No manual URL switching needed! Configuration is already correct.

## What Gets Deployed

1. **Backend (Render)** - Auto-deploys from GitHub push
2. **Frontend (Vercel)** - Auto-deploys from GitHub push
3. **Mobile App (Expo)** - Manual build with EAS (uses production API automatically)

## Verification

The script verifies:
- ✅ `vercel.json` has correct production URL
- ✅ Mobile app config uses production for production builds
- ✅ All components use environment variables correctly

## Troubleshooting

**"No changes to commit"**
- This is normal if you've already committed everything
- Script will still verify configuration

**"File not found"**
- Make sure you're running from `admin-web/backend` directory
- Check that repository structure is correct

**Git push fails**
- Verify GitHub authentication
- Check you have push permissions
- Ensure you're on the correct branch (usually `main`)

## Notes

- The script creates a `.deployment-note.md` file with deployment info (can be deleted)
- URLs don't need to be reverted because configuration uses environment variables
- All components automatically use the correct backend URL based on environment

