# Authentication System Guide

## ✅ **What's Been Implemented**

### **Web Portal Authentication (COMPLETED)**
- ✅ Login screen with email/password
- ✅ Session token management
- ✅ Automatic session verification on page load
- ✅ Protected routes (redirects to login if not authenticated)
- ✅ Logout functionality
- ✅ Role-based portal routing (Admin/Supervisor/Staff)

### **Backend API (COMPLETED)**
- ✅ `/api/auth/login` - Login endpoint
- ✅ `/api/auth/verify` - Session verification
- ✅ `/api/auth/logout` - Logout endpoint
- ✅ Password validation
- ✅ Token generation and validation

---

## 🔐 **How to Login**

### **Web Portal:**
1. Go to: `http://localhost:3000`
2. You'll see the login screen automatically
3. Enter credentials:
   - **Email:** `greg@oxfordhouse.org`
   - **Password:** `ImtheBoss5!`
4. Click "Sign In"
5. You'll be logged in as Greg Weisz (CEO/Administrator)

### **Your Credentials:**
```
Email: greg@oxfordhouse.org
Password: ImtheBoss5!
Position: CEO/Administrator
Cost Center: PS - Unfunded
```

---

## 🎯 **How It Works**

### **Login Flow:**
1. User enters email & password
2. Backend validates credentials against database
3. Backend generates session token (`session_{employeeId}_{timestamp}`)
4. Token and employee data stored in localStorage
5. User redirected to appropriate portal based on position
6. All subsequent requests include token for verification

### **Session Management:**
- **Token Storage:** localStorage (`authToken`)
- **Token Format:** `session_{employeeId}_{timestamp}`
- **Token Validation:** Backend extracts employeeId and verifies employee exists
- **Auto-Login:** On page load, checks for existing valid token
- **Token Expiry:** Currently no expiry (add in production!)

### **Portal Routing:**
Based on employee position:
- **CEO/Administrator** → Admin Portal
- **Supervisor/Director** → Supervisor Portal  
- **Everyone else** → Staff Portal

---

## 🔧 **API Endpoints**

### **POST /api/auth/login**
Login with email and password.

**Request:**
```json
{
  "email": "greg@oxfordhouse.org",
  "password": "ImtheBoss5!"
}
```

**Response (Success):**
```json
{
  "success": true,
  "message": "Login successful",
  "employee": {
    "id": "greg-weisz-001",
    "name": "Greg Weisz",
    "email": "greg@oxfordhouse.org",
    "position": "CEO/Administrator",
    "costCenters": ["PS - Unfunded"],
    "...": "other fields"
  },
  "token": "session_greg-weisz-001_1728516789123"
}
```

**Response (Error):**
```json
{
  "error": "Invalid credentials"
}
```

### **GET /api/auth/verify**
Verify current session token.

**Headers:**
```
Authorization: Bearer session_greg-weisz-001_1728516789123
```

**Response (Success):**
```json
{
  "valid": true,
  "employee": {
    "id": "greg-weisz-001",
    "name": "Greg Weisz",
    "...": "employee data"
  }
}
```

**Response (Error):**
```json
{
  "error": "Invalid session"
}
```

### **POST /api/auth/logout**
Logout and invalidate session.

**Headers:**
```
Authorization: Bearer session_greg-weisz-001_1728516789123
```

**Response:**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

---

## 📱 **Mobile App Authentication (TODO)**

The mobile app authentication is not yet implemented. Here's what needs to be done:

### **To Implement:**
1. Create Login screen component
2. Connect to backend `/api/auth/login` endpoint
3. Store token in AsyncStorage
4. Add session verification on app launch
5. Protect navigation (redirect to login if not authenticated)
6. Add logout functionality

### **Recommended Approach:**
```typescript
// Store token
await AsyncStorage.setItem('authToken', token);
await AsyncStorage.setItem('employeeData', JSON.stringify(employee));

// Verify on app launch
const token = await AsyncStorage.getItem('authToken');
if (token) {
  // Verify with backend
  const response = await fetch('http://API_URL/api/auth/verify', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  // Handle response...
}
```

---

## 🔒 **Security Notes**

### **Current Implementation (Development):**
⚠️ **This is suitable for development only!**

- Passwords stored in plain text
- Simple token format (not JWT)
- No token expiry
- No token refresh
- No rate limiting
- No HTTPS enforcement

### **For Production, You MUST:**

1. **Hash Passwords:**
   ```javascript
   const bcrypt = require('bcrypt');
   const hashedPassword = await bcrypt.hash(password, 10);
   ```

2. **Use JWT Tokens:**
   ```javascript
   const jwt = require('jsonwebtoken');
   const token = jwt.sign({ employeeId }, process.env.JWT_SECRET, { expiresIn: '24h' });
   ```

3. **Add Token Expiry:**
   - Access tokens: 15-60 minutes
   - Refresh tokens: 7-30 days

4. **Implement Rate Limiting:**
   ```javascript
   const rateLimit = require('express-rate-limit');
   const loginLimiter = rateLimit({
     windowMs: 15 * 60 * 1000, // 15 minutes
     max: 5 // 5 attempts
   });
   app.post('/api/auth/login', loginLimiter, ...);
   ```

5. **Use HTTPS in Production**

6. **Add CSRF Protection**

7. **Implement 2FA (Optional but recommended)**

---

## 🧪 **Testing the Authentication**

### **Test Login:**
1. Start backend: `cd admin-web/backend && npm start`
2. Start web portal: `cd admin-web && npm start`
3. Go to `http://localhost:3000`
4. Should see login screen
5. Enter Greg's credentials
6. Should login successfully

### **Test Auto-Login:**
1. Login successfully
2. Refresh the page
3. Should stay logged in (not show login screen)

### **Test Logout:**
1. Login successfully
2. Click logout button (in portal)
3. Should return to login screen
4. localStorage should be cleared

### **Test Invalid Credentials:**
1. Enter wrong email or password
2. Should see error message
3. Should not login

### **Test Token Expiry (Manual):**
1. Login successfully
2. Open DevTools → Application → Local Storage
3. Delete or modify `authToken`
4. Refresh page
5. Should redirect to login screen

---

## 📝 **Files Modified/Created**

### **Created:**
- ✅ `admin-web/src/components/Login.tsx` - Login component
- ✅ `AUTHENTICATION_GUIDE.md` - This guide

### **Modified:**
- ✅ `admin-web/backend/server.js` - Added auth endpoints
- ✅ `admin-web/src/App.tsx` - Integrated authentication
- ✅ Database - Added passwords to employee records

---

## 🎉 **You're Ready!**

The web portal now has full authentication:
- ✅ Login required to access any features
- ✅ Sessions persist across page refreshes
- ✅ Secure logout clears all data
- ✅ Invalid sessions automatically redirect to login

**Login now with:**
- Email: `greg@oxfordhouse.org`
- Password: `ImtheBoss5!`

---

## 📅 **Last Updated**
Date: October 9, 2025
Status: Web Portal Authentication Complete, Mobile App Pending

