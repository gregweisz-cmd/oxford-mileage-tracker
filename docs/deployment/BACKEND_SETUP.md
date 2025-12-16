# Backend Configuration

## Current Setup

The mobile app is currently configured to use:
- **Production backend**: `https://oxford-mileage-backend.onrender.com`

This means your mobile app will try to connect to the backend on Render.com.

---

## To Use Local Backend Instead

If you want to use your local backend (running on your computer):

### 1. Update Config

In `src/config/api.ts`, change:
```typescript
const USE_PRODUCTION_FOR_TESTING = false; // Use local backend
```

### 2. Start Local Backend

Make sure your backend is running:
```bash
cd admin-web/backend
npm start
```

Backend should be on: `http://192.168.86.101:3002`

### 3. Verify Network

- Phone must be on same WiFi network as your computer
- Backend IP address must be accessible from your phone

---

## Which Should You Use?

**Use LOCAL backend if:**
- ✅ Backend is running on your computer
- ✅ You're on the same WiFi network
- ✅ You want to test/debug locally

**Use PRODUCTION backend if:**
- ✅ Backend is deployed to Render.com
- ✅ You want to test from anywhere
- ✅ You're testing with real production data

---

**The Google OAuth service now uses the same backend URL as the rest of your app, so it will work with whichever backend you choose!**

