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

