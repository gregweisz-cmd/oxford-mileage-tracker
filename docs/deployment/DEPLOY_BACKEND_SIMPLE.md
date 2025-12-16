# 🚀 Deploy Backend OAuth Fix

## Quick Deploy Commands

Copy and paste these commands one by one:

```bash
cd c:\Users\GooseWeisz\oxford-mileage-tracker
git add admin-web/backend/routes/auth.js
git commit -m "Fix mobile Google OAuth: handle redirect URI correctly for token exchange"
git push origin main
```

---

## Or Use PowerShell Script

I've created a PowerShell script that does everything:

```powershell
cd c:\Users\GooseWeisz\oxford-mileage-tracker
.\deploy-backend-oauth.ps1
```

---

## What This Does

1. ✅ Stages the backend file with OAuth fix
2. ✅ Commits the changes
3. ✅ Pushes to GitHub
4. ✅ Render.com will auto-deploy (if configured)

---

## After Deployment

1. **Wait 2-5 minutes** for Render.com to deploy
2. **Check deployment status**: https://dashboard.render.com
3. **Test OAuth** on mobile app - should work now! ✅

---

**Ready to deploy!** 🎉

