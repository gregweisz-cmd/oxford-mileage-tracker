# Next Steps for OAuth Setup

## Current Status

✅ **Code Changes Complete**
- OAuth redirect handler route created
- HTML redirect page with button (Safari-friendly)
- Mobile app configured to use HTTPS redirect URI

⏳ **Still Need To:**
1. Deploy backend changes to Render
2. Add redirect URI to Google Cloud Console
3. Test OAuth flow

---

## Step 1: Deploy Backend to Render

The new route and HTML file need to be deployed to production.

### Option A: Push to GitHub (Auto-Deploy)

If Render is set to auto-deploy from GitHub:

```bash
cd c:\Users\GooseWeisz\oxford-mileage-tracker

# Add new/modified files
git add admin-web/backend/routes/oauthRedirect.js
git add admin-web/backend/public/oauth-redirect.html
git add admin-web/backend/server.js

# Commit
git commit -m "Add OAuth redirect handler for mobile app (Safari-compatible)"

# Push to trigger auto-deploy
git push origin main
```

**Wait 2-5 minutes** for Render to deploy.

### Option B: Manual Deploy via Render Dashboard

1. Go to: https://dashboard.render.com
2. Find "oxford-mileage-backend" service
3. Click "Manual Deploy" → "Deploy latest commit"
4. Wait 2-5 minutes

### Verify Deployment

After deployment, test the endpoint in a browser:
```
https://oxford-mileage-backend.onrender.com/oauth/mobile/redirect?code=test
```

You should see a page with a "Return to App" button (not a 404 error).

---

## Step 2: Add Redirect URI to Google Cloud Console

Google needs to know about the redirect URI.

1. Go to: https://console.cloud.google.com/apis/credentials

2. Find your OAuth 2.0 Client ID: `893722301667-bqc8ir7q35omj6s84l7ackvqoqrhtrv6`

3. Click **"Edit"**

4. In **"Authorized redirect URIs"**, click **"Add URI"**

5. Enter this URL:
   ```
   https://oxford-mileage-backend.onrender.com/oauth/mobile/redirect
   ```

6. Click **"Save"**

7. **Wait 1-2 minutes** for changes to propagate

**Note:** You can keep the Expo proxy URI (`https://auth.expo.io/@goosew27/oh-staff-tracker`) if you want, but you only need the new one now.

---

## Step 3: Test OAuth Flow

Once both steps above are complete:

1. **Restart the mobile app** (to reload any cached config)

2. **Try Google sign-in** from the mobile app

3. **Expected flow:**
   - Browser opens with Google login
   - You authenticate at Google
   - Google redirects to our backend page
   - You see a page with "Return to App" button
   - You tap the button
   - App opens and OAuth completes

---

## Troubleshooting

### Route still returns 404
- Wait a bit longer for deployment (up to 5 minutes)
- Check Render dashboard logs
- Verify files were pushed to GitHub

### Redirect URI rejected in Google Cloud Console
- Make sure it's exactly: `https://oxford-mileage-backend.onrender.com/oauth/mobile/redirect`
- Make sure you're editing the **Web Client** (not iOS/Android)
- Wait 1-2 minutes after saving

### Button doesn't open app
- Make sure app is installed on device
- Try closing and reopening the browser
- Check that custom URL scheme is configured in `app.json`

---

## Summary Checklist

- [ ] Deploy backend changes to Render (Step 1)
- [ ] Add redirect URI to Google Cloud Console (Step 2)
- [ ] Wait for both to complete
- [ ] Test OAuth flow (Step 3)

Once these are done, OAuth should work! 🎉

