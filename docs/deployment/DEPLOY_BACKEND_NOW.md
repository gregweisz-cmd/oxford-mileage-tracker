# Deploy Backend OAuth Fix to Render.com

## 🔧 What Changed

**Backend File**: `admin-web/backend/routes/auth.js`
- ✅ Now accepts `redirectUri` parameter from mobile app
- ✅ Creates OAuth client with correct redirect URI when exchanging code
- ✅ Better error handling and logging

---

## 🚀 Deployment Commands

Run these commands in order:

### 1. Navigate to Project Directory
```bash
cd c:\Users\GooseWeisz\oxford-mileage-tracker
```

### 2. Stage Backend Changes
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

## ✅ After Pushing

1. **Render.com will automatically deploy** (if auto-deploy is enabled)
   - Check: https://dashboard.render.com
   - Look for deployment status of `oxford-mileage-backend`

2. **Wait for deployment** (~2-5 minutes)

3. **Verify backend is running**
   - Visit: https://oxford-mileage-backend.onrender.com
   - Should see: "Oxford House Expense Tracker API"

4. **Test OAuth again on mobile app**
   - Should work now! ✅

---

## 📋 Quick Copy-Paste Commands

```bash
cd c:\Users\GooseWeisz\oxford-mileage-tracker
git add admin-web/backend/routes/auth.js
git commit -m "Fix mobile Google OAuth: handle redirect URI correctly for token exchange"
git push origin main
```

---

## 🔍 Check Deployment Status

After pushing, check Render.com:
1. Go to: https://dashboard.render.com
2. Select: `oxford-mileage-backend` service
3. Check: "Events" or "Logs" tab
4. Look for: Deployment in progress or completed

---

**Ready to deploy!** 🚀

