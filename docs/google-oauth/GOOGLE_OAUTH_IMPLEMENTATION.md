# Google OAuth Login Implementation Guide
## Oxford House Expense Tracker

---

## 📋 Overview

This guide documents the Google OAuth login implementation for your expense tracking system. Users can sign in with their Google accounts (optionally restricted to your organization's email domain).

**Difficulty**: Medium (4-6 hours)  
**Benefit**: Users can login with Google - no passwords to remember!

---

## ✅ Prerequisites Checklist

- [ ] Google Cloud Console account access
- [ ] Backend server running (Render.com)
- [ ] Frontend server running (Vercel or localhost)
- [ ] Admin access to update database schema
- [ ] Environment variables configured

---

## Step 1: Google Cloud Console Setup

### 1.1 Create/Select Google Cloud Project

1. Go to: https://console.cloud.google.com
2. If you don't have a project, click "Create Project"
   - Name: "Oxford House Expense Tracker"
   - Organization: Select your organization
3. Select the project (or your existing project if you already have one)

### 1.2 Enable Google Identity API

1. Go to: **APIs & Services** → **Library**
2. Search for: **"Google Identity"** or **"Google+ API"**
3. Click on it and click **"Enable"**

### 1.3 Create OAuth 2.0 Credentials

1. Go to: **APIs & Services** → **Credentials**
2. Click: **"+ CREATE CREDENTIALS"** → **"OAuth client ID"**
3. If prompted, configure OAuth consent screen first:
   - **User Type**: Internal (if you have Google Workspace) or External
   - **App name**: "Oxford House Expense Tracker"
   - **Support email**: Your email
   - **Developer contact**: Your email
   - Click **"Save and Continue"**
   - **Scopes**: Click "Add or Remove Scopes"
     - Select: `.../auth/userinfo.email`
     - Select: `.../auth/userinfo.profile`
   - Click **"Save and Continue"**
   - **Test users**: Add test emails (or skip if using Internal)
   - Click **"Save and Continue"** → **"Back to Dashboard"**

4. Create OAuth Client ID:
   - **Application type**: "Web application"
   - **Name**: "Oxford Expense Tracker Web"
   - **Authorized JavaScript origins**:
     ```
     https://oxford-mileage-backend.onrender.com
     https://your-app.vercel.app
     http://localhost:3002 (for development)
     ```
   - **Authorized redirect URIs**:
     ```
     https://oxford-mileage-backend.onrender.com/api/auth/google/callback
     https://your-app.vercel.app/auth/callback
     http://localhost:3002/api/auth/google/callback (for development)
     ```
   - Click **"Create"**
   - **Save your Client ID and Client Secret!** (You'll need these)

5. Create another OAuth Client ID for Mobile (if needed):
   - **Application type**: "iOS" or "Android"
   - **Name**: "Oxford Expense Tracker Mobile"
   - **iOS**: Bundle ID: `com.oxfordhouse.expensetracker`
   - **Android**: Package name: `com.oxfordhouse.expensetracker`
   - Click **"Create"**
   - Save this Client ID too

---

## Step 2: Database Migration

### 2.1 Run Migration Script

A migration script has been created at:
`admin-web/backend/scripts/migrations/add-google-auth-columns.js`

**To run the migration**:
```bash
cd admin-web/backend
node scripts/migrations/add-google-auth-columns.js
```

This will add:
- `googleId` (TEXT) - Stores Google user ID
- `authProvider` (TEXT) - Values: 'local', 'google', or 'both'
- `emailVerified` (INTEGER) - 1 if verified via Google, 0 otherwise
- Index on `googleId` for faster lookups

---

## Step 3: Backend Configuration

### 3.1 Environment Variables

Add to your `.env` file or Render.com environment variables:

```env
# Google OAuth Configuration
GOOGLE_CLIENT_ID=your-client-id-here.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret-here
GOOGLE_REDIRECT_URI=https://oxford-mileage-backend.onrender.com/api/auth/google/callback

# Optional: Restrict to specific email domains (comma-separated)
ALLOWED_EMAIL_DOMAINS=yourdomain.com,oxfordhouse.org

# Optional: Auto-create accounts for new Google users
AUTO_CREATE_ACCOUNTS=false

# Frontend URL for redirect after login
FRONTEND_URL=https://your-app.vercel.app
```

### 3.2 Backend Routes

Google OAuth routes have been added to `admin-web/backend/routes/auth.js`:

- `GET /api/auth/google` - Initiates Google OAuth flow
- `GET /api/auth/google/callback` - Handles Google OAuth callback
- `POST /api/auth/google/mobile` - Mobile app OAuth (receives code)

---

## Step 4: Frontend Configuration

### 4.1 Google Sign-In Button

The Google sign-in button has been added to `admin-web/src/components/Login.tsx`.

### 4.2 OAuth Callback Handler

An `AuthCallback` component has been created at:
`admin-web/src/components/AuthCallback.tsx`

The component handles:
- Token extraction from URL
- Session verification
- Redirect to appropriate portal

### 4.3 App Routing

`App.tsx` has been updated to handle OAuth callbacks via URL parameters.

---

## Step 5: Testing

### 5.1 Test Web Login

1. Start your backend and frontend servers
2. Go to login page
3. Click "Sign in with Google"
4. Sign in with a test Google account
5. Verify redirect back to app
6. Verify user is logged in

### 5.2 Test Domain Restrictions

1. Try signing in with a non-allowed email domain
2. Verify access is denied (if `ALLOWED_EMAIL_DOMAINS` is set)
3. Try signing in with allowed domain
4. Verify access is granted

---

## Step 6: Production Deployment

### 6.1 Update Environment Variables

**Render.com (Backend)**:
- Add `GOOGLE_CLIENT_ID`
- Add `GOOGLE_CLIENT_SECRET`
- Add `GOOGLE_REDIRECT_URI`
- Add `ALLOWED_EMAIL_DOMAINS` (optional)
- Add `FRONTEND_URL`

**Vercel (Frontend)**:
- No additional environment variables needed
- Uses `REACT_APP_API_URL` (already configured)

### 6.2 Update OAuth Redirect URIs

In Google Cloud Console, ensure production URIs are added:
- `https://oxford-mileage-backend.onrender.com/api/auth/google/callback`
- `https://your-app.vercel.app` (for frontend redirect)

---

## 🎯 Configuration Options

### Option 1: Allow All Google Accounts
- Leave `ALLOWED_EMAIL_DOMAINS` empty or unset
- Any Google account can login
- User must already exist in database

### Option 2: Restrict to Organization Domain
- Set `ALLOWED_EMAIL_DOMAINS=yourdomain.com,oxfordhouse.org`
- Only emails from your domain can login
- More secure

### Option 3: Auto-Create Accounts
- Set `AUTO_CREATE_ACCOUNTS=true`
- New Google users auto-create accounts
- Useful for large organizations
- **Note**: Users will still need admin to set up profile details

---

## ✅ Implementation Checklist

- [x] Database migration script created
- [x] Backend OAuth routes implemented
- [x] Frontend Google button added
- [x] AuthCallback component created
- [x] App.tsx updated for OAuth flow
- [ ] Google Cloud Console configured (manual)
- [ ] Environment variables set (manual)
- [ ] Database migration run (manual)
- [ ] Tested on web
- [ ] Tested domain restrictions
- [ ] Production environment variables set

---

## 🔧 Troubleshooting

### "Google login not available" Error
- Check that `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set
- Verify environment variables are loaded correctly

### Redirect URI Mismatch
- Ensure redirect URI in Google Cloud Console matches exactly
- Check for trailing slashes or protocol mismatches

### "Access denied" for valid users
- Check `ALLOWED_EMAIL_DOMAINS` setting
- Verify email domain matches exactly (case-sensitive)

### User not found errors
- User must exist in database before Google login
- Or set `AUTO_CREATE_ACCOUNTS=true` to auto-create

---

**Estimated Time**: 4-6 hours (including Google Cloud setup)  
**Difficulty**: Medium  
**Result**: Users can login with Google! 🎉

