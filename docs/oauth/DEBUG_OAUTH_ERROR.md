# Debugging Google OAuth Error

## The Error

"Something went wrong trying to finish signing in. please close this screen to go back to the app."

This error appears **after** you enter your password, which means:
- ✅ Google authentication succeeded
- ✅ Authorization code was received
- ❌ Something failed when calling the backend

---

## What to Check

### 1. Check Backend Logs

The backend should show detailed error messages. Please check:

**On Render.com:**
1. Go to https://dashboard.render.com
2. Select your backend service (`oxford-mileage-backend`)
3. Click "Logs" tab
4. Look for errors around the time you tried to sign in
5. Look for messages starting with:
   - `🔐 Mobile: Exchanging Google authorization code...`
   - `❌ Mobile: Google OAuth callback error:`
   - `❌ Mobile: Error details:`

**On Local Backend (if running locally):**
- Check the terminal where the backend is running
- Look for error messages

---

### 2. Common Issues

#### Issue 1: Redirect URI Mismatch

The backend might be getting a redirect URI mismatch error from Google.

**Check:**
- Is the redirect URI `https://auth.expo.io/@goosew27/oh-staff-tracker`?
- Is this redirect URI added to Google Cloud Console?

#### Issue 2: Backend Not Receiving Request

The mobile app might not be able to reach the backend.

**Check:**
- Is the backend URL correct? (`https://oxford-mileage-backend.onrender.com`)
- Is the backend running?
- Can you access `https://oxford-mileage-backend.onrender.com` in a browser?

#### Issue 3: Authorization Code Expired

The authorization code might have expired before reaching the backend.

**Check:**
- Try signing in again (codes expire quickly)
- Check if there's a network delay

---

## Next Steps

1. **Check backend logs** (most important!)
2. **Share the error message** from backend logs
3. **Check if backend is accessible** from your device

Once we see the backend error, we can fix it!

---

## Quick Test

Try this in your browser:
```
https://oxford-mileage-backend.onrender.com
```

Should show: "Oxford House Expense Tracker API"

If it doesn't work, the backend might be down.

