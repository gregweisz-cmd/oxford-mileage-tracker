# Google OAuth - Next Steps After Creating Credentials

## ✅ Completed
- ✅ Database migration run
- ✅ Code implemented
- ✅ Packages installed
- ✅ Google Cloud Console credentials created (Web + Mobile)

## 📋 Next Steps

### 1. Get Your OAuth Credentials

From Google Cloud Console, copy:
- **Client ID** (Web Application) - looks like: `xxxxx.apps.googleusercontent.com`
- **Client Secret** (Web Application) - a long string
- **Client ID** (Mobile/iOS/Android) - optional for now, save for later

### 2. Set Backend Environment Variables

Go to **Render.com** → Your Backend Service → **Environment** tab:

Add these variables:

```
GOOGLE_CLIENT_ID=your-web-client-id-here.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-web-client-secret-here
GOOGLE_REDIRECT_URI=https://oxford-mileage-backend.onrender.com/api/auth/google/callback
FRONTEND_URL=https://your-frontend-url.vercel.app
```

**Optional variables:**

```
# Restrict to specific email domains (comma-separated)
ALLOWED_EMAIL_DOMAINS=yourdomain.com,oxfordhouse.org

# Auto-create accounts for new Google users (default: false)
AUTO_CREATE_ACCOUNTS=false
```

### 3. Verify Redirect URIs in Google Cloud Console

Make sure these **Authorized redirect URIs** are added:

**Production:**
```
https://oxford-mileage-backend.onrender.com/api/auth/google/callback
```

**Development (if testing locally):**
```
http://localhost:3002/api/auth/google/callback
```

### 4. Restart Backend Server

After adding environment variables:
- Render will automatically restart your backend service
- Wait 1-2 minutes for the restart to complete

### 5. Test Google OAuth Login

1. **Go to your login page** (frontend)
2. **Click "Sign in with Google"** button
3. **You should be redirected to Google's login page**
4. **Sign in with a Google account**
5. **You should be redirected back to your app and logged in**

### 6. Troubleshooting

If you see errors:

**"Google login not available"**
- Check that environment variables are set correctly in Render
- Verify no extra spaces or quotes around values
- Check backend logs in Render dashboard

**"Redirect URI mismatch"**
- Verify the redirect URI in Google Cloud Console matches exactly
- Check `GOOGLE_REDIRECT_URI` environment variable
- No trailing slashes!

**"Access denied"**
- If `ALLOWED_EMAIL_DOMAINS` is set, verify email domain matches
- Check that user exists in database (unless `AUTO_CREATE_ACCOUNTS=true`)

**"User not found"**
- User must exist in database before Google login
- Or set `AUTO_CREATE_ACCOUNTS=true` to auto-create

## 🔐 Security Recommendations

1. **Domain Restriction**: Set `ALLOWED_EMAIL_DOMAINS` to restrict to your organization
2. **Don't Auto-Create**: Keep `AUTO_CREATE_ACCOUNTS=false` for security (admin creates users)
3. **Monitor Logs**: Check Render logs for any authentication errors

## 📝 Quick Reference

**Environment Variables Needed:**
- `GOOGLE_CLIENT_ID` - Required
- `GOOGLE_CLIENT_SECRET` - Required  
- `GOOGLE_REDIRECT_URI` - Required
- `FRONTEND_URL` - Required
- `ALLOWED_EMAIL_DOMAINS` - Optional (recommended)
- `AUTO_CREATE_ACCOUNTS` - Optional (default: false)

## ✅ Testing Checklist

- [ ] Environment variables set in Render
- [ ] Backend server restarted
- [ ] "Sign in with Google" button appears on login page
- [ ] Clicking button redirects to Google
- [ ] After Google login, redirects back to app
- [ ] User is logged in successfully
- [ ] User data loads correctly

## 🎉 You're Almost Done!

Once environment variables are set and backend restarts, Google OAuth should work!

Need help? Check:
- `GOOGLE_OAUTH_IMPLEMENTATION.md` for detailed steps
- `GOOGLE_OAUTH_ENV_SETUP.md` for environment variable details
- Render.com logs for error messages

