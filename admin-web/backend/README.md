# Oxford House Expense Tracker Backend Server

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Start Server
```bash
npm start
```

The server will start on port 3002 by default.

### 3. Test Connection
Visit `http://localhost:3002` to see the server status.

## API Endpoints

### Base URL
- Local: `http://localhost:3002/api`
- Network: `http://YOUR_IP:3002/api`

### Available Endpoints

#### Statistics
- `GET /api/stats` - Server statistics

#### Employees
- `GET /api/employees` - Get all employees
- `POST /api/employees` - Create employee
- `PUT /api/employees/:id` - Update employee
- `DELETE /api/employees/:id` - Delete employee

#### Mileage Entries
- `GET /api/mileage-entries` - Get all mileage entries
- `POST /api/mileage-entries` - Create mileage entry
- `PUT /api/mileage-entries/:id` - Update mileage entry
- `DELETE /api/mileage-entries/:id` - Delete mileage entry

#### Receipts
- `GET /api/receipts` - Get all receipts
- `POST /api/receipts` - Create receipt
- `PUT /api/receipts/:id` - Update receipt
- `DELETE /api/receipts/:id` - Delete receipt

#### Data Sync
- `POST /api/sync` - Sync data from mobile app
- `GET /api/sync/status` - Get sync status

#### Reports
- `POST /api/reports/generate` - Generate Excel report
- `GET /api/reports/templates` - Get available templates

## Configuration

### Environment Variables
- `PORT` - Server port (default: 3002)
- `NODE_ENV` - Environment (development/production)

### Database
The server uses SQLite database located at `../../oxford_tracker.db`

## Development

### Auto-restart during development
```bash
npm run dev
```

### Logs
The server logs all requests and errors to the console.

## Mobile App Integration

Update the mobile app's API configuration in `src/services/apiSyncService.ts`:

```javascript
const API_BASE_URL = Platform.OS === 'web' 
  ? 'http://localhost:3002/api' 
  : 'http://YOUR_MACBOOK_IP:3002/api';
```

## Troubleshooting

### Port Already in Use
```bash
PORT=3003 npm start
```

### Database Issues
The server will create a sample database if the main database file doesn't exist.

### Network Access
Ensure your MacBook and mobile device are on the same network.

## Security Notes
- CORS is enabled for all origins (restrict in production)
- No authentication implemented (add in production)
- Database file is accessible (secure in production)

## Production Deployment
```bash
NODE_ENV=production npm start
```
