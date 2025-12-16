# Backend Architecture Overview

This document provides an overview of the Oxford House Mileage Tracker backend architecture.

## Project Structure

```
backend/
├── server.js              # Main application entry point
├── debug.js               # Debug logging utilities
├── routes/                # API route handlers
│   ├── auth.js           # Authentication routes
│   ├── employees.js      # Employee management
│   ├── dataEntries.js    # Mileage, receipts, time tracking
│   ├── expenseReports.js # Expense report management
│   ├── dashboard.js      # Dashboard statistics & preferences
│   ├── costCenters.js    # Cost center configuration
│   ├── approval.js       # Approval workflow
│   ├── notifications.js  # Notifications & messages
│   └── ...
├── services/              # Business logic services
│   ├── dbService.js      # Database connection & initialization
│   ├── websocketService.js # WebSocket real-time communication
│   └── seedService.js    # Database seeding utilities
├── middleware/            # Express middleware
│   └── cors.js           # CORS configuration
├── utils/                 # Utility functions
│   ├── helpers.js        # General helper functions
│   ├── dateHelpers.js    # Date manipulation utilities
│   └── constants.js      # Application constants
└── scripts/               # Utility scripts
    └── ...
```

## Architecture Principles

### Separation of Concerns
- **Routes**: Handle HTTP requests/responses, input validation
- **Services**: Business logic, data processing
- **Middleware**: Cross-cutting concerns (CORS, auth, etc.)
- **Utils**: Reusable helper functions

### Route Organization
Routes are organized by domain:
- `/api/employees/*` - Employee management
- `/api/mileage-entries/*` - Mileage tracking
- `/api/receipts/*` - Receipt management
- `/api/expense-reports/*` - Expense reports
- `/api/admin/*` - Admin-only endpoints

### Database Access
All database access goes through `dbService`:
```javascript
const dbService = require('./services/dbService');
const db = dbService.getDb();
```

### Error Handling
Use consistent error responses:
```javascript
res.status(500).json({ error: error.message });
```

### Logging
Use the debug utility:
```javascript
const { debugLog, debugError } = require('../debug');
debugLog('Information message');
debugError('Error message:', error);
```

## Key Components

### Server Initialization Flow
1. Load environment variables
2. Initialize Express app
3. Configure middleware (CORS, JSON parsing)
4. Register route handlers
5. Initialize database
6. Seed test accounts
7. Start report schedule runner
8. Start HTTP/WebSocket server

### Database
- **Type**: SQLite
- **Location**: `expense_tracker.db`
- **Initialization**: Handled by `dbService.initDatabase()`
- **Tables**: Created automatically on first run

### WebSocket
Real-time updates via WebSocket:
- Connection management in `websocketService`
- Broadcast data changes to connected clients
- Used for live dashboard updates

### Authentication
- Currently basic (password-based)
- Routes in `routes/auth.js`
- Session management via headers (`x-user-id`, `x-user-role`)

## Adding New Features

### Adding a New Route
1. Create route file in `routes/` directory
2. Export Express router
3. Import and register in `server.js`:
   ```javascript
   const newRoutes = require('./routes/newFeature');
   app.use('/', newRoutes);
   ```

### Adding a New Service
1. Create service file in `services/` directory
2. Export functions/classes
3. Import where needed:
   ```javascript
   const newService = require('./services/newService');
   ```

### Adding Middleware
1. Create middleware file in `middleware/` directory
2. Export middleware function
3. Use in `server.js`:
   ```javascript
   const newMiddleware = require('./middleware/newMiddleware');
   app.use(newMiddleware);
   ```

## Environment Variables

Key environment variables:
- `PORT` - Server port (default: 3002)
- `NODE_ENV` - Environment (development/production)
- `GOOGLE_APPLICATION_CREDENTIALS` - Path to Google Cloud credentials
- Database path is configured in `dbService.js`

## Development Guidelines

### Code Style
- Use async/await for asynchronous operations
- Use descriptive variable names
- Add comments for complex logic
- Keep functions focused on single responsibility

### Testing
- Test scripts should be in `scripts/` directory
- Use consistent naming: `test-*.js` or `check-*.js`

### Debugging
- Use `debugLog()` for informational messages
- Use `debugError()` for errors
- Avoid `console.log()` in production code

## Future Improvements

Potential refactoring opportunities:
- Split large route files (dashboard.js is 3500+ lines)
- Extract shared database query helpers
- Add input validation middleware
- Implement comprehensive error handling middleware
- Add API documentation (Swagger/OpenAPI)

