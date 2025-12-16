# Deploy Backend OAuth Fix - Commands

## 🚀 Deployment Steps

Run these commands to deploy the backend OAuth fix to Render.com:

### 1. Navigate to Project
```bash
cd c:\Users\GooseWeisz\oxford-mileage-tracker
```

### 2. Stage Backend File
```bash
git add admin-web/backend/routes/auth.js
```

### 3. Commit Changes
```bash
git commit -m "Fix mobile Google OAuth: handle redirect URI correctly for token exchange"
```

### 4. Push to GitHub (triggers Render.com auto-deploy)
```bash
git push origin main
```

---

## ✅ Verify Deployment

After pushing:

1. **Check Render.com Dashboard**
   - Go to: https://dashboard.render.com
   - Select: `oxford-mileage-backend` service
   - Check "Events" tab for deployment status

2. **Check Backend is Running**
   - Visit: https://oxford-mileage-backend.onrender.com
   - Should see: "Oxford House Expense Tracker API"

3. **Test OAuth Again**
   - Try Google sign-in on mobile app
   - Should work now! ✅

---

## 📝 What Changed

The backend now:
- ✅ Accepts `redirectUri` from mobile app
- ✅ Creates OAuth client with correct redirect URI
- ✅ Uses Expo proxy redirect URI when exchanging tokens
- ✅ Better error handling

---

**Ready to deploy!** Copy and paste the commands above. 🚀

