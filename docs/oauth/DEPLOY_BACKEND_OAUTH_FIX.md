# Deploy Backend OAuth Fix

## 🔧 Changes to Deploy

### Backend Files
- `admin-web/backend/routes/auth.js` - Fixed mobile OAuth redirect URI handling

### Mobile App Files (optional - can deploy separately)
- `src/services/googleAuthService.ts` - Now uses same backend URL as rest of app
- `src/config/api.ts` - Current production configuration
- `src/screens/LoginScreen.tsx` - Updated to use consistent backend URL

---

## 🚀 Deployment Steps

### Step 1: Stage Backend Files
```bash
cd c:\Users\GooseWeisz\oxford-mileage-tracker
git add admin-web/backend/routes/auth.js
```

### Step 2: Commit Changes
```bash
git commit -m "Fix mobile Google OAuth redirect URI handling in backend"
```

### Step 3: Push to GitHub
```bash
git push origin main
```

### Step 4: Render.com Auto-Deploy
- Render.com should automatically deploy when you push
- Check deployment status at: https://dashboard.render.com
- Look for the backend service: `oxford-mileage-backend`

---

## ✅ Verify Deployment

After deployment:

1. **Check Render.com Logs**
   - Go to https://dashboard.render.com
   - Select your backend service
   - Check "Logs" tab for deployment status

2. **Test Backend Endpoint**
   - Visit: https://oxford-mileage-backend.onrender.com
   - Should see API welcome message

3. **Test OAuth Again**
   - Try Google sign-in on mobile app
   - Should work now! ✅

---

## 📝 Optional: Deploy Mobile App Changes Too

If you want to deploy the mobile app changes as well:

```bash
git add src/services/googleAuthService.ts src/config/api.ts src/screens/LoginScreen.tsx
git commit -m "Update mobile OAuth to use consistent backend URL configuration"
git push origin main
```

Then push OTA update to Expo (if needed).

---

**Ready to deploy!** 🚀

