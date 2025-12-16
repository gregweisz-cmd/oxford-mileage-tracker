# Testing Quick Start Guide

Quick reference guide for testing the application when you return.

## Pre-Testing Checklist

- [ ] Backend server is running on port 3002
- [ ] Mobile app development server is running
- [ ] Twilio credentials are configured (if testing 2FA SMS)
- [ ] Database is accessible

---

## Starting Servers

### 1. Start Backend Server

```bash
cd admin-web/backend
npm start
```

**Expected Output:**
```
✅ Twilio client initialized for 2FA  (if configured)
⚠️ Twilio credentials not configured  (if not configured - development mode)
Server running on port 3002
```

**Verify**: Open http://localhost:3002 in browser (should see server response)

### 2. Start Mobile App

```bash
# From root directory
npm start
```

**Expected Output:**
- Expo DevTools opens in browser
- QR code appears in terminal

**Options:**
- Press `a` for Android
- Press `i` for iOS
- Press `w` for web
- Scan QR code with Expo Go app

---

## Testing Two-Factor Authentication (2FA)

### Prerequisites

1. **Check Twilio Configuration**:
   - Open `admin-web/backend/.env`
   - Verify `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, and `TWILIO_PHONE_NUMBER` are set
   - Restart backend if you just added them

2. **For Trial Twilio Accounts**:
   - Verify recipient phone numbers in Twilio Console → Verified Caller IDs

### Testing on Mobile App

1. **Open Mobile App** → Settings
2. **Find "Two-Factor Authentication (2FA)"** section
3. **Toggle Switch** to ON
4. **Enter 10-digit phone number** (e.g., `1234567890`)
5. **Click "Send Verification Code"**
6. **Check Backend Console**:
   - **If Twilio configured**: SMS sent (check phone)
   - **If NOT configured**: Look for log: `⚠️ Twilio not configured - Development mode: Verification code for +1XXXXXXXXXX is: XXXXXX`
7. **Enter the 6-digit code** (from SMS or backend console)
8. **Click "Verify & Enable"**
9. **Verify**: Switch should show as enabled with phone ending digits

### Testing on Web Portal

1. **Open Web Portal** → User Settings
2. **Find "Two-Factor Authentication (2FA)"** section
3. **Toggle Switch** to ON
4. **Enter phone number** and click "Send Verification Code"
5. **Enter verification code** and click "Verify & Enable"

### Testing Login with 2FA

1. **Enable 2FA** (see above)
2. **Log out** of the app
3. **Log back in** with email/password
4. **Enter 2FA verification code** when prompted
5. **Verify**: Login succeeds

---

## Common Issues & Solutions

### Issue: "Invalid phone number format"
**Solution**: Ensure exactly 10 digits, no dashes/spaces

### Issue: "Failed to send verification code"
**Solutions**:
- Check backend console for detailed error
- Verify Twilio credentials in `.env`
- For trial accounts: Verify phone number in Twilio Console
- Check Twilio account balance

### Issue: "Twilio credentials not configured"
**Solution**: 
- This is OK for development - codes are logged to console
- Check `admin-web/backend/.env` file
- See `TWILIO_SETUP_GUIDE.md` for setup instructions

### Issue: Phone input hidden behind keyboard (Mobile)
**Status**: ✅ Fixed - KeyboardAvoidingView implemented

### Issue: Can't enable 2FA
**Check**:
- Backend server is running
- Phone number is exactly 10 digits
- Check backend console logs for errors

---

## Backend Logs to Watch

When testing 2FA, watch for these log messages:

### Success Indicators:
```
✅ Twilio client initialized for 2FA
📱 2FA send-code request: employeeId=..., phoneNumber=...
✅ 2FA verification code sent to +1XXXXXXXXXX for employee ...
```

### Development Mode (Twilio not configured):
```
⚠️ Twilio not configured - Development mode: Verification code for +1XXXXXXXXXX is: 123456
```

### Error Indicators:
```
❌ Invalid phone number format: "..." (X digits)
❌ Error sending SMS: [error message]
```

---

## Quick Commands

```bash
# Check if servers are running
netstat -ano | findstr ":3002\|:3000"

# Stop backend server (if needed)
# Press Ctrl+C in the terminal running the backend

# Check backend logs
# Look at the terminal where backend is running

# Restart backend (after .env changes)
cd admin-web/backend
npm start
```

---

## Testing Checklist

- [ ] Backend server starts without errors
- [ ] Mobile app connects to backend
- [ ] 2FA can be enabled from Settings
- [ ] Verification code is sent/received (or logged to console)
- [ ] Verification code can be entered and verified
- [ ] 2FA status shows as enabled
- [ ] Login with 2FA works (requires code after password)
- [ ] 2FA can be disabled with password
- [ ] Keyboard doesn't hide input fields (mobile)
- [ ] Phone number validation works correctly

---

## Environment Variables Checklist

Verify `admin-web/backend/.env` contains:

```env
TWILIO_ACCOUNT_SID=AC...  (if using SMS)
TWILIO_AUTH_TOKEN=...     (if using SMS)
TWILIO_PHONE_NUMBER=+1... (if using SMS)
```

**Note**: 2FA works in development mode (logs codes) even without Twilio configured.

---

**Last Updated**: November 2025
