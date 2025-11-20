# Twilio Setup Guide for 2FA SMS

This guide will walk you through setting up Twilio to enable SMS verification codes for Two-Factor Authentication (2FA).

## Prerequisites

1. A Twilio account (free trial available at https://www.twilio.com/try-twilio)
2. Access to the backend `.env` file

## Step 1: Create a Twilio Account

1. Go to https://www.twilio.com/try-twilio
2. Sign up for a free account (includes $15.50 trial credit)
3. Verify your email address and phone number

## Step 2: Get Your Twilio Credentials

1. Log in to your Twilio Console: https://console.twilio.com/
2. Your **Account SID** and **Auth Token** are displayed on the dashboard
   - **Account SID**: Starts with `AC` (e.g., `ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`)
   - **Auth Token**: Click "Show" to reveal it (e.g., `your_auth_token_here`)

## Step 3: Get a Twilio Phone Number

### For Trial Accounts (Development/Testing):
1. In the Twilio Console, go to **Phone Numbers** → **Manage** → **Buy a number**
2. Select your country (United States)
3. Check "SMS" capability
4. Click "Search" and select an available number
5. Complete the purchase (free with trial account)
6. Your phone number will be in E.164 format (e.g., `+15551234567`)

**Important for Trial Accounts:**
- Trial accounts can only send SMS to **verified phone numbers**
- Go to **Phone Numbers** → **Manage** → **Verified Caller IDs** to add your test phone numbers
- Verify each phone number you want to test with

### For Production:
1. Upgrade your Twilio account (go to Billing → Upgrade)
2. Purchase a phone number (same process as above)
3. No phone number verification required for production accounts

## Step 4: Configure Environment Variables

1. Navigate to your backend directory:
   ```bash
   cd admin-web/backend
   ```

2. Open the `.env` file in a text editor

3. Add the following lines (replace with your actual values):
   ```env
   TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   TWILIO_AUTH_TOKEN=your_auth_token_here
   TWILIO_PHONE_NUMBER=+15551234567
   ```

   **Example:**
   ```env
   TWILIO_ACCOUNT_SID=ACa1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6
   TWILIO_AUTH_TOKEN=abc123xyz789def456ghi012jkl345mno678
   TWILIO_PHONE_NUMBER=+15551234567
   ```

   **Important Notes:**
   - `TWILIO_PHONE_NUMBER` must include the `+` sign and country code (e.g., `+1` for US)
   - Do NOT include quotes around the values
   - Do NOT commit the `.env` file to version control (it should already be in `.gitignore`)

## Step 5: Restart the Backend Server

After adding the environment variables, restart your backend server:

1. Stop the current backend server (Ctrl+C)
2. Start it again:
   ```bash
   cd admin-web/backend
   npm start
   ```

3. Look for this message in the console:
   ```
   ✅ Twilio client initialized for 2FA
   ```

   If you see this message, Twilio is configured correctly!

## Step 6: Test 2FA

1. Open your mobile app
2. Go to Settings → Two-Factor Authentication
3. Toggle 2FA ON
4. Enter your 10-digit phone number (must be verified if using trial account)
5. Click "Send Verification Code"
6. You should receive an SMS with a 6-digit code
7. Enter the code to complete setup

## Troubleshooting

### "Twilio credentials not configured" Message
- Check that all three environment variables are set in `.env`
- Make sure there are no typos in variable names
- Restart the backend server after making changes

### "Invalid phone number format" Error
- Ensure you're entering exactly 10 digits (no dashes, spaces, or parentheses)
- For trial accounts, the phone number must be verified in Twilio Console

### "Failed to send SMS" Error
- **Trial accounts**: Make sure the recipient phone number is verified in Twilio Console
- Check that `TWILIO_PHONE_NUMBER` includes the `+` and country code
- Verify your Account SID and Auth Token are correct
- Check your Twilio account balance (trial accounts have limits)

### SMS Not Received
- Check your phone number is correct
- Verify phone number is added to Twilio's verified caller IDs (for trial accounts)
- Check your phone's spam/blocked messages
- Look at Twilio Console → Logs → Messaging for delivery status

### Verify Twilio Configuration

You can check if Twilio is configured by looking at the backend server logs:
- ✅ `Twilio client initialized for 2FA` = Configured correctly
- ⚠️ `Twilio credentials not configured` = Missing or invalid credentials

## Security Best Practices

1. **Never commit `.env` to version control**
   - The `.env` file should be in `.gitignore`
   - Use environment variables or secrets management in production

2. **Rotate Auth Tokens Regularly**
   - Go to Twilio Console → Account → API Keys & Tokens
   - Create new tokens and update `.env` as needed

3. **Use Different Credentials for Development/Production**
   - Use trial account for development
   - Use production account for live app

4. **Monitor Usage**
   - Set up billing alerts in Twilio Console
   - Monitor SMS usage and costs

## Additional Resources

- Twilio Documentation: https://www.twilio.com/docs
- Twilio SMS Quickstart: https://www.twilio.com/docs/sms/quickstart/node
- Twilio Console: https://console.twilio.com/

## Cost Information

- **Trial Account**: $15.50 free credit
- **SMS in US**: ~$0.0075 per message (less than 1 cent)
- **Trial accounts**: Limited to verified phone numbers only
- **Production**: Can send to any valid phone number
