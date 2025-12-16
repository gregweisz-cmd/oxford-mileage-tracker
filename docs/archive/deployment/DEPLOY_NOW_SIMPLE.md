# 🚀 Deploy Google OAuth - Simple Instructions

## ✅ Script Fixed!

The PowerShell script had syntax errors (emoji encoding issues) - I've fixed it!

## 🎯 Choose Your Deployment Method

### **Option 1: Simple Script (Easiest)**

Run this single command:

```powershell
cd C:\Users\GooseWeisz\oxford-mileage-tracker
powershell -ExecutionPolicy Bypass -File simple-deploy.ps1
```

This will:
- Stage all Google OAuth files
- Commit them
- Push to GitHub

### **Option 2: Fixed Script (More Details)**

Run this command:

```powershell
cd C:\Users\GooseWeisz\oxford-mileage-tracker
powershell -ExecutionPolicy Bypass -File deploy-now.ps1
```

This shows detailed progress for each step.

### **Option 3: Manual Commands (Full Control)**

Copy and paste these commands one by one:

```powershell
cd C:\Users\GooseWeisz\oxford-mileage-tracker

git add admin-web/backend/routes/auth.js
git add admin-web/backend/package.json
git add admin-web/src/components/Login.tsx
git add admin-web/src/App.tsx
git add admin-web/src/config/debug.ts
git add admin-web/src/components/AuthCallback.tsx
git add admin-web/src/components/ErrorBoundary.tsx

git commit -m "Add Google OAuth login functionality (frontend + backend)"

git push origin main
```

## ⏳ After Deployment

1. **Wait 2-3 minutes** → Vercel will auto-deploy frontend
2. **Wait 3-5 minutes** → Render will auto-deploy backend
3. **Check dashboards:**
   - Vercel: https://vercel.com/dashboard
   - Render: https://dashboard.render.com
4. **Test Google Login** on your site!

## 🐛 Fixes These Errors

- ✅ **404 error** for `/api/auth/google` → Backend routes will deploy
- ✅ **debugVerbose error** → Frontend debug.ts will deploy

---

**Choose any option above and run it!** 🎉

