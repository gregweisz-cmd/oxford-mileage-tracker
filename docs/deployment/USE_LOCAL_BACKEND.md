# Using Local Backend for Mobile App

## ✅ Configuration Updated

I've updated the mobile app to use **local backend** (`USE_PRODUCTION_FOR_TESTING = false`).

This means:
- Mobile app will connect to: `http://192.168.86.101:3002`
- Make sure your backend is running locally!

---

## 🚀 Next Steps

### 1. Start the Backend Server

Make sure your backend is running:

```bash
cd admin-web/backend
npm start
```

The backend should be running on `http://localhost:3002` or `http://192.168.86.101:3002`

### 2. Verify Backend is Accessible

From your phone/device, you should be able to access:
```
http://192.168.86.101:3002
```

If you can't access it, check:
- Backend is running
- Your phone is on the same WiFi network
- Firewall isn't blocking port 3002
- IP address `192.168.86.101` is correct for your computer

### 3. Try Google Sign-In Again

Now that everything is configured for local backend:
1. Reload the mobile app
2. Try Google sign-in
3. It should connect to your local backend now

---

## 🔄 Switch Back to Production?

If you want to use production backend instead, just change in `src/config/api.ts`:

```typescript
const USE_PRODUCTION_FOR_TESTING = true;
```

---

**The Google OAuth error should now work with your local backend!** 🎉

