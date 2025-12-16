# Google OAuth - Your Specific Settings

## 🎯 Your URLs and Credentials

Based on your setup, here are your exact values:

### Your Backend URL:
```
https://oxford-mileage-backend.onrender.com
```

### Your Frontend URL:
```
https://oxford-mileage-tracker-git-main-goose-weiszs-projects.vercel.app
```

### Your Client ID:
```
893722301667-bqc8ir7q35omj6s84l7ackvqoqrhtrv6.apps.googleusercontent.com
```

## 📋 Environment Variables to Set in Render.com

Go to **Render.com** → **oxford-mileage-backend** service → **Environment** tab

Add these values (replace CLIENT_SECRET with your actual secret from Google Cloud Console):

```
GOOGLE_CLIENT_ID=893722301667-bqc8ir7q35omj6s84l7ackvqoqrhtrv6.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=YOUR_CLIENT_SECRET_FROM_GOOGLE_CLOUD_CONSOLE
GOOGLE_REDIRECT_URI=https://oxford-mileage-backend.onrender.com/api/auth/google/callback
FRONTEND_URL=https://oxford-mileage-tracker-git-main-goose-weiszs-projects.vercel.app
```

**To get your Client Secret:**
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Navigate to **APIs & Services** → **Credentials**
3. Click on your OAuth 2.0 Client ID (Web application)
4. Copy the **Client secret** value
5. Paste it in Render.com as `GOOGLE_CLIENT_SECRET`

**Important:** 
- Make sure `GOOGLE_REDIRECT_URI` matches exactly
- No spaces around the `=` sign
- No quotes around values

### Optional (Recommended for Security):

```
ALLOWED_EMAIL_DOMAINS=yourdomain.com
AUTO_CREATE_ACCOUNTS=false
```

Replace `yourdomain.com` with your actual email domain if you want to restrict access.

## ✅ Verify Redirect URIs in Google Cloud Console

Make sure these are added in Google Cloud Console under your OAuth client:

**Authorized redirect URIs:**
```
https://oxford-mileage-backend.onrender.com/api/auth/google/callback
http://localhost:3002/api/auth/google/callback
```

**Authorized JavaScript origins:**
```
https://oxford-mileage-backend.onrender.com
https://oxford-mileage-tracker-git-main-goose-weiszs-projects.vercel.app
http://localhost:3002
```

## 🧪 Testing Steps

1. **Set environment variables in Render** (see above)
2. **Wait 1-2 minutes** for backend to restart
3. **Go to your login page:**
   ```
   https://oxford-mileage-tracker-git-main-goose-weiszs-projects.vercel.app
   ```
4. **Click "Sign in with Google"**
5. **You should be redirected to Google login**
6. **After login, you'll be redirected back and logged in!**

## 🔍 Troubleshooting

**If it doesn't work:**
1. Check Render.com logs for errors
2. Verify environment variables are set correctly (no typos)
3. Make sure redirect URIs match exactly in Google Cloud Console
4. Check that user exists in database (unless AUTO_CREATE_ACCOUNTS=true)

## 📝 Quick Checklist

- [ ] Environment variables set in Render.com
- [ ] Backend service restarted (happens automatically)
- [ ] Redirect URIs added in Google Cloud Console
- [ ] Test "Sign in with Google" button
- [ ] Verify login works!

## 🎉 You're Ready!

Once you set those environment variables in Render and the backend restarts, Google OAuth should work!

