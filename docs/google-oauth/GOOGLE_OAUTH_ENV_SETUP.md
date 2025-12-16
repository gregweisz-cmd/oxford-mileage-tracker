# Google OAuth Environment Variables Setup

This document outlines the environment variables needed for Google OAuth functionality.

## Backend Environment Variables (Render.com)

Add these to your Render.com backend service environment variables:

```env
# Google OAuth Configuration (Required)
GOOGLE_CLIENT_ID=your-client-id-here.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret-here
GOOGLE_REDIRECT_URI=https://oxford-mileage-backend.onrender.com/api/auth/google/callback

# Frontend URL for redirect after login (Required)
FRONTEND_URL=https://your-app.vercel.app

# Optional: Restrict to specific email domains (comma-separated)
# Leave empty or unset to allow all Google accounts (users must still exist in database)
ALLOWED_EMAIL_DOMAINS=yourdomain.com,oxfordhouse.org

# Optional: Auto-create accounts for new Google users
# Set to 'true' to automatically create user accounts when they sign in with Google
# Default: 'false' (users must be created by admin first)
AUTO_CREATE_ACCOUNTS=false
```

## Frontend Environment Variables (Vercel)

No additional environment variables needed! The frontend uses:
- `REACT_APP_API_URL` (already configured)

## Getting Your Google OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create or select your project
3. Go to **APIs & Services** → **Credentials**
4. Click **"+ CREATE CREDENTIALS"** → **"OAuth client ID"**
5. Configure OAuth consent screen (if not already done)
6. Create a "Web application" OAuth client ID
7. Copy the **Client ID** and **Client Secret**

## Setting Up Redirect URIs

In Google Cloud Console, under your OAuth client ID settings, add these **Authorized redirect URIs**:

**Production:**
```
https://oxford-mileage-backend.onrender.com/api/auth/google/callback
```

**Development (Local):**
```
http://localhost:3002/api/auth/google/callback
```

## Testing

After setting up environment variables:

1. **Restart your backend server** (Render will auto-restart on env var changes)
2. Go to your login page
3. Click "Sign in with Google"
4. You should be redirected to Google's login page
5. After signing in, you'll be redirected back to your app

## Troubleshooting

### "Google login not available" Error
- Check that `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set correctly
- Verify there are no extra spaces or quotes around the values
- Check backend logs for initialization errors

### Redirect URI Mismatch Error
- Ensure the redirect URI in Google Cloud Console matches exactly
- Check for trailing slashes or protocol mismatches (http vs https)
- Verify `GOOGLE_REDIRECT_URI` environment variable matches the URI in Google Cloud Console

### "Access denied" for valid users
- Check `ALLOWED_EMAIL_DOMAINS` setting
- Verify email domain matches exactly (case-sensitive)
- If `ALLOWED_EMAIL_DOMAINS` is empty, any Google account can login (if user exists in DB)

### User not found errors
- User must exist in database before Google login (unless `AUTO_CREATE_ACCOUNTS=true`)
- Check that email address matches exactly (case-sensitive)

