# Backend Deployment Checklist for Google OAuth

## ❌ Current Error

```
GET https://oxford-mileage-backend.onrender.com/api/auth/google 404 (Not Found)
Cannot GET /api/auth/google
```

## 🔍 Problem

The backend code with Google OAuth routes is **not deployed to Render.com**. The routes exist locally but Render is running old code.

## ✅ Solution: Deploy Backend to Render

### Step 1: Commit Backend Changes

```powershell
cd C:\Users\GooseWeisz\oxford-mileage-tracker

# Add backend OAuth routes
git add admin-web/backend/routes/auth.js
git add admin-web/backend/package.json

# Commit
git commit -m "Add Google OAuth routes to backend"

# Push to GitHub
git push origin main
```

### Step 2: Verify Render Auto-Deploy

- Render should auto-deploy when you push to GitHub
- Go to Render dashboard: https://dashboard.render.com
- Check if deployment is in progress
- Wait 3-5 minutes for deployment to complete

### Step 3: Verify Environment Variables in Render

Make sure these are set in Render.com → Your backend service → Environment:

```
GOOGLE_CLIENT_ID=893722301667-bqc8ir7q35omj6s84l7ackvqoqrhtrv6.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=YOUR_CLIENT_SECRET_HERE
GOOGLE_REDIRECT_URI=https://oxford-mileage-backend.onrender.com/api/auth/google/callback
FRONTEND_URL=https://oxford-mileage-tracker-git-main-goose-weiszs-projects.vercel.app
```

### Step 4: Restart Backend (if needed)

If environment variables were just added:
- Render will auto-restart when env vars change
- OR manually restart: Render dashboard → Your service → Manual Deploy → Clear build cache & deploy

### Step 5: Test the Route

After deployment, test:
```
https://oxford-mileage-backend.onrender.com/api/auth/google
```

Should redirect to Google OAuth (not 404).

## 📋 Complete Checklist

- [ ] Backend code committed (`auth.js` with Google routes)
- [ ] Backend code pushed to GitHub
- [ ] Render deployment completed
- [ ] Environment variables set in Render
- [ ] Backend service restarted (if env vars changed)
- [ ] Route `/api/auth/google` returns redirect (not 404)
- [ ] Frontend deployed to Vercel
- [ ] Google login button appears on login page

## 🔍 Troubleshooting

**Still getting 404 after deployment?**
- Check Render logs for errors
- Verify `auth.js` was deployed (check file in Render)
- Verify routes are registered in `server.js`
- Check backend service is running (not sleeping)

**"Google login not available" error?**
- Check environment variables are set correctly
- Verify GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are not empty
- Check Render logs for initialization errors

