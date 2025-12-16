# Firebase Phone Authentication Setup Guide

This guide walks you through setting up Firebase Phone Authentication for 2FA in the Oxford House Expense Tracker.

## Overview

Firebase Phone Authentication is **completely free** and uses Google's infrastructure. Unlike Twilio, Firebase sends SMS automatically when you use the Firebase SDK on the client side.

**Important**: Firebase Phone Auth is primarily client-side. For the current backend-driven 2FA flow, codes are logged to the console in development mode. To use Firebase SMS in production, you'll need to integrate Firebase SDK on the mobile/web clients.

## Prerequisites

1. A Google account
2. Access to the Firebase Console
3. Access to the backend `.env` file

---

## Step 1: Create a Firebase Project

1. Go to https://console.firebase.google.com/
2. Click **"Add project"** or **"Create a project"**
3. Enter project name: `Oxford House Expense Tracker` (or your preferred name)
4. Click **"Continue"**
5. (Optional) Enable Google Analytics (can be skipped)
6. Click **"Create project"**
7. Wait for project creation to complete
8. Click **"Continue"**

---

## Step 2: Enable Phone Authentication

1. In Firebase Console, go to **Authentication** (left sidebar)
2. Click **"Get started"** if this is your first time
3. Go to the **"Sign-in method"** tab
4. Find **"Phone"** in the list of sign-in providers
5. Click on **"Phone"**
6. **Enable** Phone authentication
7. Click **"Save"**

---

## Step 3: Get Service Account Credentials (Backend)

To use Firebase Admin SDK on the backend:

1. In Firebase Console, go to **Project Settings** (gear icon next to "Project Overview")
2. Go to the **"Service accounts"** tab
3. Click **"Generate new private key"**
4. Click **"Generate key"** in the confirmation dialog
5. A JSON file will be downloaded (e.g., `oxford-house-expense-tracker-firebase-adminsdk-xxxxx.json`)

**⚠️ Security Warning**: This file contains sensitive credentials. Never commit it to version control!

---

## Step 4: Configure Environment Variables

1. Open the downloaded JSON file and note these values:
   - `project_id`
   - `private_key`
   - `client_email`

2. Open `admin-web/backend/.env` file

3. Add the following (replace with your actual values):
   ```env
   FIREBASE_PROJECT_ID=your-project-id
   FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour private key here\n-----END PRIVATE KEY-----\n"
   FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
   ```

   **Important Notes**:
   - `FIREBASE_PRIVATE_KEY` must include the quotes and preserve the `\n` characters
   - The private key should be on a single line with `\n` where line breaks occur
   - You can copy the entire private key from the JSON file

   **Example**:
   ```env
   FIREBASE_PROJECT_ID=oxford-house-expense-tracker
   FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC...\n-----END PRIVATE KEY-----\n"
   FIREBASE_CLIENT_EMAIL=firebase-adminsdk-abc123@oxford-house-expense-tracker.iam.gserviceaccount.com
   ```

---

## Step 5: Get Firebase Web Config (For Client Integration)

For mobile/web apps to use Firebase Phone Auth:

1. In Firebase Console, go to **Project Settings**
2. Scroll down to **"Your apps"** section
3. Click **Web** icon (`</>`) or **"Add app"** → **Web**
4. Register your app:
   - App nickname: `Oxford House Expense Tracker Web`
   - (Optional) Set up Firebase Hosting (can skip)
5. Click **"Register app"**
6. Copy the Firebase configuration object:
   ```javascript
   const firebaseConfig = {
     apiKey: "AIza...",
     authDomain: "your-project.firebaseapp.com",
     projectId: "your-project-id",
     storageBucket: "your-project.appspot.com",
     messagingSenderId: "123456789",
     appId: "1:123456789:web:abcdef"
   };
   ```

7. Save this config for use in mobile/web apps

---

## Step 6: Restart Backend Server

After adding environment variables:

```bash
cd admin-web/backend
npm start
```

**Expected Output:**
```
✅ Firebase Admin SDK initialized for 2FA
```

If you see this, Firebase is configured correctly!

---

## Current Implementation

### Development Mode (Current)
- ✅ **Works now**: Codes are logged to backend console
- ✅ **No setup required**: Works immediately
- ✅ **Perfect for testing**: Check backend logs for verification codes

### Production Mode (With Firebase Client SDK)
To enable real SMS via Firebase:

1. **Install Firebase SDK** on mobile/web clients:
   ```bash
   # Mobile (React Native)
   npm install @react-native-firebase/app @react-native-firebase/auth
   
   # Web
   npm install firebase
   ```

2. **Initialize Firebase** on client with config from Step 5

3. **Use Firebase Phone Auth** to send SMS:
   ```javascript
   import auth from '@react-native-firebase/auth';
   
   // Send verification code (Firebase handles SMS automatically)
   const confirmation = await auth().signInWithPhoneNumber(phoneNumber);
   
   // Verify code
   const result = await confirmation.confirm(verificationCode);
   ```

4. **Send Firebase ID token to backend** for verification

---

## How It Works

### Current Flow (Development Mode):
1. User enters phone number in app
2. Backend generates 6-digit code
3. Code is **logged to backend console** (for testing)
4. User enters code from console
5. Backend verifies code

### Future Flow (With Firebase):
1. User enters phone number in app
2. Client calls Firebase `signInWithPhoneNumber()` → **Firebase sends SMS automatically (FREE)**
3. User receives SMS with code
4. User enters code
5. Client verifies with Firebase
6. Client sends Firebase ID token to backend
7. Backend verifies token with Firebase Admin SDK

---

## Testing

### Test Development Mode (No Firebase Required):
1. Start backend server
2. Open mobile app → Settings → 2FA
3. Enter phone number and click "Send Verification Code"
4. Check backend console for the code
5. Enter code to verify

### Test With Firebase (After Client Integration):
1. Follow client setup steps above
2. Enter phone number in app
3. Firebase will send SMS automatically
4. Enter code received via SMS
5. Verification completes

---

## Troubleshooting

### "Firebase credentials not configured"
- Check `.env` file has all three variables
- Verify `FIREBASE_PRIVATE_KEY` is properly formatted (with quotes and `\n`)
- Restart backend after adding credentials

### "Error initializing Firebase Admin SDK"
- Verify private key format is correct
- Check that project ID, email, and key match
- Ensure no extra spaces or characters

### Firebase Phone Auth Not Sending SMS
- Verify Phone authentication is enabled in Firebase Console
- Check that Firebase SDK is properly initialized on client
- Verify phone number is in E.164 format (+1XXXXXXXXXX)

---

## Cost Information

- **Firebase Phone Auth**: **Completely FREE** (unlimited SMS)
- **No credit card required** for basic usage
- **No monthly limits** for phone verification
- Uses Google's infrastructure

---

## Security Notes

1. **Never commit service account JSON or `.env` file** to version control
2. **Service account credentials** should be kept secure
3. **Firebase config** (apiKey, etc.) can be public (it's meant for client-side)
4. **Private keys** must remain secret

---

## Next Steps

1. ✅ Backend is ready (development mode working)
2. 📱 Integrate Firebase SDK on mobile app (optional, for production SMS)
3. 🌐 Integrate Firebase SDK on web portal (optional, for production SMS)
4. 🧪 Test with real SMS after client integration

---

## Additional Resources

- Firebase Documentation: https://firebase.google.com/docs/auth
- Firebase Phone Auth Guide: https://firebase.google.com/docs/auth/web/phone-auth
- Firebase Admin SDK: https://firebase.google.com/docs/admin/setup
- React Native Firebase: https://rnfirebase.io/

---

**Last Updated**: November 2025
