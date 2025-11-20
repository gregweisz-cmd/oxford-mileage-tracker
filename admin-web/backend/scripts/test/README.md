# Test Scripts

Quick test scripts to verify backend functionality before meetings or deployments.

## Available Tests

### 1. API Endpoint Tests (`test-api.js`)

Tests all major API endpoints to ensure they're responding correctly.

```bash
node scripts/test/test-api.js
```

**Tests:**
- Health check endpoints
- Employee endpoints
- Mileage entry endpoints
- Receipt endpoints
- Time tracking endpoints
- Expense report endpoints
- Dashboard endpoints
- Cost center endpoints
- Notification endpoints

**Environment Variables:**
- `BASE_URL` - Backend URL (default: `http://localhost:3002`)

### 2. WebSocket Tests (`test-websocket.js`)

Tests WebSocket connection and real-time update functionality.

```bash
node scripts/test/test-websocket.js
```

**Tests:**
- WebSocket connection
- Initial connection message
- Multi-client connection
- Broadcast functionality

**Environment Variables:**
- `WS_URL` - WebSocket URL (default: `ws://localhost:3002/ws`)

### 3. Database Tests (`test-database.js`)

Tests database connection, table existence, and data integrity.

```bash
node scripts/test/test-database.js
```

**Tests:**
- Database connection
- Required tables exist
- Table row counts
- Foreign key relationships
- Data integrity

## Running All Tests

Run all tests in sequence:

```bash
# Windows PowerShell
cd backend
node scripts/test/test-api.js
node scripts/test/test-websocket.js
node scripts/test/test-database.js

# Or create a test script in package.json:
npm run test:api
npm run test:ws
npm run test:db
```

## Interpreting Results

### ✅ Passed
- Endpoint is responding correctly
- Expected status code received
- No errors encountered

### ❌ Failed
- Endpoint not responding
- Unexpected status code
- Error occurred

### ⚠️ Warning
- Test inconclusive
- Non-critical issue

## Before Running Tests

1. **Start the backend server:**
   ```bash
   cd backend
   npm start
   ```

2. **Verify server is running:**
   - Check `http://localhost:3002/api/health`
   - Should return: `{"status":"ok","database":"connected"}`

3. **Check database exists:**
   - File: `backend/expense_tracker.db`
   - Should exist and be accessible

## Common Issues

### Connection Refused
- **Cause**: Backend server not running
- **Fix**: Start the server with `npm start`

### Database Locked
- **Cause**: Database file is in use
- **Fix**: Close any database viewers or stop other processes using the database

### 404 Not Found
- **Cause**: Route doesn't exist or URL is incorrect
- **Fix**: Check `ROUTES.md` for correct endpoint paths

### 500 Internal Server Error
- **Cause**: Server error or database issue
- **Fix**: Check server logs for detailed error messages

## Adding New Tests

To add a new test:

1. Add test function to appropriate test file
2. Follow existing test pattern
3. Update this README with new test description
4. Test your new test!

## Notes

- Tests are designed to be non-destructive (read-only)
- Tests may create temporary connections but don't modify data
- Some tests require existing data in database
- Tests can be run multiple times safely

