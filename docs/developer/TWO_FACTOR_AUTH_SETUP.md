# Two-Factor Authentication (2FA) Setup Guide

This document explains how to set up and use Two-Factor Authentication (2FA) via SMS for the Oxford House Expense Tracker.

## Overview

Two-Factor Authentication adds an extra layer of security by requiring users to enter a verification code sent to their phone number via SMS after entering their password.

## Backend Implementation

### Features Implemented

1. **2FA Service** (`admin-web/backend/twoFactorService.js`)
   - SMS sending via Twilio
   - 6-digit verification code generation
   - Phone number formatting (E.164 format)
   - Phone number validation

2. **Database Fields Added**
   - `twoFactorEnabled` (INTEGER) - Whether 2FA is enabled for the employee
   - `phoneNumberVerified` (INTEGER) - Whether phone number has been verified
   - `twoFactorCode` (TEXT) - Temporary verification code
   - `twoFactorCodeExpires` (TEXT) - Code expiration timestamp

3. **Updated Login Endpoints**
   - `/api/auth/login` (Web portal)
   - `/api/employee-login` (Mobile app)
   - Both endpoints now check for 2FA and require verification code if enabled

4. **2FA Management Endpoints**
   - `POST /api/auth/two-factor/send-code` - Send verification code to phone
   - `POST /api/auth/two-factor/verify-phone` - Verify phone number and enable 2FA
   - `POST /api/auth/two-factor/disable` - Disable 2FA (requires password)
   - `GET /api/auth/two-factor/status/:employeeId` - Get 2FA status

## Twilio Setup

### Step 1: Create Twilio Account

1. Go to [https://www.twilio.com/try-twilio](https://www.twilio.com/try-twilio)
2. Sign up for a free account
3. Verify your email and phone number
4. Complete the setup wizard

### Step 2: Get Twilio Credentials

1. Log in to your Twilio Console
2. Go to **Account** → **Account Info**
3. Copy the following:
   - **Account SID** (starts with `AC`)
   - **Auth Token** (click to reveal)

### Step 3: Get Phone Number

1. Go to **Phone Numbers** → **Manage** → **Buy a number**
2. Select a phone number (can be a trial number for testing)
3. Copy the phone number (e.g., `+1234567890`)

### Step 4: Configure Environment Variables

Add the following to your `admin-web/backend/.env` file:

```env
TWILIO_ACCOUNT_SID=your_account_sid_here
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_PHONE_NUMBER=+1234567890
```

### Step 5: Restart Backend Server

After adding the environment variables, restart your backend server:

```bash
cd admin-web/backend
node server.js
```

## Usage Flow

### Enabling 2FA (User Flow)

1. User navigates to Settings/Security section
2. User enters their phone number
3. System sends verification code via SMS
4. User enters verification code
5. 2FA is enabled

### Login with 2FA Enabled

1. User enters email and password
2. If 2FA is enabled:
   - System sends verification code to registered phone number
   - User enters verification code
   - Login completes if code is valid

### Disabling 2FA

1. User navigates to Settings/Security section
2. User enters their password to confirm
3. 2FA is disabled

## API Endpoints Reference

### Send Verification Code

**POST** `/api/auth/two-factor/send-code`

Request body:
```json
{
  "employeeId": "employee-id",
  "phoneNumber": "1234567890"
}
```

Response:
```json
{
  "success": true,
  "message": "Verification code sent to your phone",
  "phoneNumberLast4": "7890"
}
```

### Verify Phone and Enable 2FA

**POST** `/api/auth/two-factor/verify-phone`

Request body:
```json
{
  "employeeId": "employee-id",
  "phoneNumber": "1234567890",
  "verificationCode": "123456"
}
```

Response:
```json
{
  "success": true,
  "message": "Two-factor authentication enabled successfully"
}
```

### Disable 2FA

**POST** `/api/auth/two-factor/disable`

Request body:
```json
{
  "employeeId": "employee-id",
  "password": "user-password"
}
```

Response:
```json
{
  "success": true,
  "message": "Two-factor authentication disabled successfully"
}
```

### Get 2FA Status

**GET** `/api/auth/two-factor/status/:employeeId`

Response:
```json
{
  "twoFactorEnabled": true,
  "phoneNumberVerified": true,
  "phoneNumber": "7890"
}
```

## Security Considerations

1. **Verification Code Expiration**: Codes expire after 10 minutes
2. **Code Cleanup**: Codes are cleared from the database after successful verification
3. **Phone Number Privacy**: Only last 4 digits are returned to clients
4. **Password Required**: Disabling 2FA requires password verification

## Testing

### Test Phone Numbers (Twilio Trial Account)

Twilio provides test phone numbers for development:
- **Test Phone**: Use your verified phone number when testing
- **Trial Limitations**: Trial accounts can only send SMS to verified phone numbers

### Testing Flow

1. Set up Twilio credentials in `.env`
2. Restart backend server
3. Use the API endpoints to:
   - Send a verification code
   - Verify the code
   - Enable 2FA
   - Test login with 2FA

## Troubleshooting

### "SMS service not configured" Error

- Check that Twilio credentials are in `.env` file
- Verify environment variables are loaded (check server logs)
- Restart the backend server after adding credentials

### "Failed to send SMS" Error

- Verify Twilio Account SID and Auth Token are correct
- Check that the phone number is in E.164 format
- For trial accounts, ensure you're sending to a verified phone number
- Check Twilio Console for error details

### "Verification code expired" Error

- Codes expire after 10 minutes
- Request a new code if expired
- Check server time is synchronized

## Next Steps

### Frontend Implementation

The following frontend components need to be created/updated:

1. **Web Portal**:
   - Add 2FA settings section to User Settings
   - Update login form to handle 2FA code input
   - Add phone number verification UI

2. **Mobile App**:
   - Add 2FA settings to Settings screen
   - Update login screen to handle 2FA code input
   - Add phone number verification UI

### Future Enhancements

- Backup codes generation
- Recovery options (email backup)
- 2FA via authenticator app (TOTP)
- Remember device option (trusted devices)

