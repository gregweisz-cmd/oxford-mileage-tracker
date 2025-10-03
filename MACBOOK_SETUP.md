# MacBook Server Setup Guide

## Overview
This guide will help you set up the Oxford Mileage Tracker backend server on your MacBook.

## Prerequisites
- Node.js (version 16 or higher)
- npm (comes with Node.js)

## Setup Steps

### 1. Copy Project to MacBook
Copy the entire `oxford-mileage-tracker` folder to your MacBook.

### 2. Install Backend Dependencies
```bash
cd oxford-mileage-tracker/admin-web/backend
npm install
```

### 3. Copy Database File
Copy the `oxford_tracker.db` file from the main project directory to the MacBook:
```bash
# From the main project directory
cp oxford_tracker.db /path/to/macbook/oxford-mileage-tracker/
```

### 4. Start the Backend Server
```bash
cd oxford-mileage-tracker/admin-web/backend
npm start
```

The server will start on port 3002 by default.

### 5. Update Mobile App Configuration
Update the mobile app's API configuration to point to your MacBook's IP address:

In `src/services/apiSyncService.ts`, change:
```javascript
const API_BASE_URL = Platform.OS === 'web' ? 'http://localhost:3002/api' : 'http://YOUR_MACBOOK_IP:3002/api';
```

Replace `YOUR_MACBOOK_IP` with your MacBook's actual IP address.

### 6. Test the Connection
The backend server provides these endpoints:
- `GET /api/stats` - Server statistics
- `GET /api/employees` - Employee data
- `GET /api/mileage-entries` - Mileage entries
- `GET /api/receipts` - Receipt data
- `POST /api/sync` - Data synchronization

## Server Features
- SQLite database integration
- File upload handling
- Excel report generation
- CORS enabled for cross-origin requests
- Request logging
- Error handling

## Troubleshooting

### Port Already in Use
If port 3002 is already in use:
```bash
PORT=3003 npm start
```

### Database Issues
If the database file doesn't exist, the server will create a sample database automatically.

### Network Access
Make sure your MacBook and mobile device are on the same network for the mobile app to connect.

## Development Mode
For development with auto-restart:
```bash
npm run dev
```

## Production Deployment
For production deployment, set the environment variable:
```bash
NODE_ENV=production npm start
```

## API Endpoints

### Statistics
- `GET /api/stats` - Returns server statistics

### Employees
- `GET /api/employees` - Get all employees
- `POST /api/employees` - Create new employee
- `PUT /api/employees/:id` - Update employee
- `DELETE /api/employees/:id` - Delete employee

### Mileage Entries
- `GET /api/mileage-entries` - Get all mileage entries
- `POST /api/mileage-entries` - Create new mileage entry
- `PUT /api/mileage-entries/:id` - Update mileage entry
- `DELETE /api/mileage-entries/:id` - Delete mileage entry

### Receipts
- `GET /api/receipts` - Get all receipts
- `POST /api/receipts` - Create new receipt
- `PUT /api/receipts/:id` - Update receipt
- `DELETE /api/receipts/:id` - Delete receipt

### Data Sync
- `POST /api/sync` - Sync data from mobile app
- `GET /api/sync/status` - Get sync status

### Reports
- `POST /api/reports/generate` - Generate Excel report
- `GET /api/reports/templates` - Get available templates

## Security Notes
- The server runs in development mode by default
- CORS is enabled for all origins (restrict in production)
- No authentication is implemented (add in production)
- Database file is accessible (secure in production)

## Next Steps
1. Set up the server on your MacBook
2. Update mobile app configuration
3. Test the connection
4. Implement authentication (optional)
5. Set up SSL/HTTPS (optional)
6. Configure firewall rules (optional)
