# Google OAuth Environment Variables Checklist

## ✅ What You Have Now

- Google Cloud Console credentials created (Web + Mobile)
- Client ID and Client Secret from Google

## 📋 What You Need to Set

### Step 1: Go to Render.com

1. Log into [Render.com](https://render.com)
2. Navigate to your **backend service** (the one running your Node.js API)
3. Go to the **Environment** tab

### Step 2: Add These Environment Variables

Copy and paste these, replacing the placeholder values with your actual credentials:

```
GOOGLE_CLIENT_ID=your-web-client-id-here.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-web-client-secret-here
GOOGLE_REDIRECT_URI=https://oxford-mileage-backend.onrender.com/api/auth/google/callback
FRONTEND_URL=https://your-frontend-url.vercel.app
```

**Important Notes:**
- Replace `your-web-client-id-here.apps.googleusercontent.com` with your actual Web Client ID
- Replace `your-web-client-secret-here` with your actual Web Client Secret
- Replace `your-frontend-url.vercel.app` with your actual frontend URL (or localhost:3000 for local testing)
- **NO spaces** around the `=` sign
- **NO quotes** around the values (unless they're part of the value)

### Step 3: Optional Settings (Recommended)

Add these if you want additional security:

```
ALLOWED_EMAIL_DOMAINS=yourdomain.com,oxfordhouse.org
AUTO_CREATE_ACCOUNTS=false
```

**What these do:**
- `ALLOWED_EMAIL_DOMAINS` - Only allow emails from these domains (leave empty to allow all)
- `AUTO_CREATE_ACCOUNTS` - Set to `true` if you want to auto-create accounts for new Google users

### Step 4: Save Changes

1. Click **Save Changes**
2. Render will automatically restart your backend
3. Wait 1-2 minutes for the restart to complete

### Step 5: Verify in Google Cloud Console

Make sure your **Authorized redirect URIs** in Google Cloud Console includes:

```
https://oxford-mileage-backend.onrender.com/api/auth/google/callback
```

(Replace `oxford-mileage-backend.onrender.com` with your actual Render backend URL if different)

## 🧪 Test It!

After the backend restarts:

1. Go to your login page
2. Click "Sign in with Google"
3. You should be redirected to Google's login page
4. Sign in with a Google account
5. You should be redirected back and logged in!

## ❓ Need Your Actual URLs?

If you're not sure what your URLs are:

**Backend URL:**
- Check Render.com dashboard → Your backend service → URL shown at top
- Or check your backend service settings

**Frontend URL:**
- Check Vercel dashboard → Your frontend service → URL
- Or check your frontend deployment settings

## 🔍 Troubleshooting

**If "Sign in with Google" button doesn't appear:**
- Make sure you've saved and deployed the frontend code changes
- Check browser console for errors

**If redirect doesn't work:**
- Verify redirect URI matches exactly in Google Cloud Console
- Check backend logs in Render.com for errors
- Make sure environment variables are set correctly

**If login fails:**
- Check that user exists in database
- Verify email domain matches (if `ALLOWED_EMAIL_DOMAINS` is set)
- Check backend logs for error messages

