# Starting the Backend Server

The backend server needs to be running for the frontend to work. Here's how to start it:

## Quick Start

### Option 1: PowerShell Script (Recommended)
1. Open PowerShell
2. Navigate to: `admin-web\backend`
3. Run: `.\start-server.ps1`

### Option 2: Manual Start
1. Open a terminal/PowerShell window
2. Navigate to: `admin-web\backend`
3. Run: `node server.js`

### Option 3: Batch File
Double-click `START_BACKEND.bat` in the project root

## What to Look For

When the server starts successfully, you should see:
- ✅ "Connected to the SQLite database"
- ✅ "Server is running on port 3002"
- ✅ Network IP addresses listed

## Common Issues

### Port Already in Use
If you see "EADDRINUSE" error:
- Another process is using port 3002
- Close other Node.js processes or change the port in `.env`

### Database Errors
If you see database errors:
- The database file will be created automatically
- Check file permissions in the `admin-web\backend` directory

### Missing Dependencies
If you see "Cannot find module" errors:
- Run: `npm install` in `admin-web\backend`

## Verify It's Running

Once started, you can verify by:
1. Opening http://localhost:3002/api/health in a browser
2. You should see a JSON response with server status

## Stopping the Server

Press `Ctrl+C` in the terminal where the server is running.

---

## Using the Local Backend for New Features (Keep Changes Local)

When developing new features (e.g. Travel Reasons, Daily Description Options), keep things local and point everything at your local backend:

### 1. Start the local backend

Run the backend from `admin-web\backend` (see above). It will serve `http://localhost:3002`.

### 2. Point the **mobile app** at the local backend

Edit **`src/config/api.ts`**:

- Set **`USE_PRODUCTION_FOR_TESTING = false`** so the app uses `http://localhost:3002/api`.
- Leave it `true` when you want to talk to the Render backend again.

```ts
const USE_PRODUCTION_FOR_TESTING = false; // Local backend for new-feature dev
```

### 3. Point the **admin-web** (React) at the local backend

The admin portal (including Admin tabs like Travel Reasons / Daily Description Options) uses `process.env.REACT_APP_API_URL`. To use the local backend:

- Create **`admin-web/.env.local`** (or set the variable before starting the app):
  ```bash
  REACT_APP_API_URL=http://localhost:3002
  ```
- Restart the admin-web dev server after changing env.
- Omit `/api` in `REACT_APP_API_URL`; the code adds it when needed.

If you don’t set `REACT_APP_API_URL`, it falls back to the production URL (`https://oxford-mileage-backend.onrender.com`).

### 4. Don’t commit until you’re ready

Keep new feature work uncommitted until you’ve tested locally and are ready to push. When you’re done testing locally, switch the mobile app back to production if needed, then commit and push.

