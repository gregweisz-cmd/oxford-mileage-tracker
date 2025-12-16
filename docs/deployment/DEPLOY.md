# Quick Deployment Guide

## 🚀 One-Command Deployment

From the `admin-web/backend` directory:

```bash
npm run deploy
```

This will:
1. ✅ Verify all backend URLs are correctly configured
2. ✅ Ensure `vercel.json` has production URL
3. ✅ Commit all current changes
4. ✅ Push to GitHub (triggers Render/Vercel auto-deploy)

**Note:** URLs don't need to be switched because:
- `vercel.json` always has production URL (for Vercel)
- Components use environment variables (localhost in dev, production in Vercel)
- Mobile app automatically uses production API in production builds

## 📋 Manual Deployment Steps

If you prefer manual control:

### 1. Deploy Backend & Frontend

```bash
cd admin-web/backend
npm run deploy
```

### 2. Verify Deployment

**Backend (Render):**
- Check: https://oxford-mileage-backend.onrender.com
- View logs in Render dashboard

**Frontend (Vercel):**
- Check your Vercel deployment URL
- Verify it's using production backend in network tab

### 3. Deploy Mobile App

```bash
cd oxford-mileage-tracker
eas login
eas build --platform ios --profile production
eas build --platform android --profile production
```

**Note:** Mobile app automatically uses production API in production builds - no URL switching needed!

## 🔄 Deployment Script Options

```bash
# Full deployment (recommended)
npm run deploy

# Just switch URLs (don't push)
npm run deploy:no-push

# Deploy and keep production URLs
npm run deploy:production
```

## 📝 What Gets Deployed

- **Backend:** Auto-deploys to Render when pushed to GitHub
- **Frontend:** Auto-deploys to Vercel when pushed to GitHub  
- **Mobile:** Manual build with EAS (uses production API automatically)

## ⚠️ Important Notes

1. **URLs Revert Automatically:** After deployment, URLs switch back to localhost for development
2. **Production Environment:** Vercel uses production URLs via environment variables (in `vercel.json`)
3. **Mobile App:** No manual URL switching needed - production builds automatically use production API

## 🆘 Troubleshooting

**Deployment fails:**
- Check you're in `admin-web/backend` directory
- Verify GitHub authentication
- Check Render/Vercel dashboard for deployment status

**URLs not working:**
- Verify `vercel.json` has correct production URL
- Check Vercel environment variables
- Mobile app: Check build logs for API configuration

