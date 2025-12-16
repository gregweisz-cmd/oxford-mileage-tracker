# Quick Start - Tomorrow Morning

## TL;DR - 3 Steps

1. **Make app External** (2 min)
   - Go to: https://console.cloud.google.com/apis/credentials/consent
   - Click "PUBLISH APP" / "Make external"
   - Wait 2 minutes

2. **Set backend domain filtering** (5 min)
   - Render dashboard → Environment variables
   - Add: `ALLOWED_EMAIL_DOMAINS=yourdomain.com`
   - Restart backend

3. **Test OAuth** (5 min)
   - Restart mobile app
   - Try Google Sign-In
   - Should work! ✅

---

## Current Status
- ✅ Code is ready (iOS client ID configured)
- ⏳ Need to make app External
- ⏳ Need to verify backend domain filtering

## What We Changed Today
- Switched to iOS client ID
- Added reverse client ID URL scheme
- Backend has domain filtering code

## See Full Plan
📄 `TOMORROW_OAUTH_PLAN.md` - Complete detailed instructions

---

**Time estimate**: 15-20 minutes total

