# Contributing Guide

Welcome to the Oxford House Mileage Tracker backend! This guide will help you get started contributing to the project.

## 🚀 Getting Started

### Prerequisites

- **Node.js** >= 18.0.0
- **npm** (comes with Node.js)
- **Git** for version control

### Initial Setup

1. **Clone the repository** (if you have access)
   ```bash
   git clone <repository-url>
   cd oxford-mileage-tracker/admin-web/backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env  # If .env.example exists
   # Edit .env with your configuration
   ```
   - **HR sync (optional):** To use "Sync from HR API" in Admin Portal → Employee Management, set `EMPLOYEE_API_TOKEN` or `APPWARMER_EMPLOYEE_API_TOKEN` in your environment to the token provided for `https://api.appwarmer.com/api/employee`. If unset, the sync endpoint returns 503. See [docs/HR_SYNC_SETUP.md](docs/HR_SYNC_SETUP.md) for step-by-step local and Render setup.

4. **Start the development server**
   ```bash
   npm start
   ```

5. **Verify it's working**
   - Visit `http://localhost:3002`
   - Should see: `{"message":"Oxford House Mileage Tracker Backend API","status":"running"}`

## 📁 Project Structure

Understanding the project structure is crucial:

```
backend/
├── server.js              # Main entry point
├── routes/                # API route handlers (organized by domain)
├── services/              # Business logic services
├── middleware/            # Express middleware
├── utils/                 # Helper functions
├── config/                # Configuration management
└── scripts/               # Utility scripts
    ├── debug/            # Debugging scripts
    ├── dev/              # Development scripts
    └── maintenance/      # Maintenance scripts
```

**Key Files to Understand:**
- `server.js` - Entry point, sets up Express, registers routes
- `services/dbService.js` - Database connection and common queries
- `services/websocketService.js` - Real-time communication
- `config/index.js` - All configuration settings
- `middleware/errorHandler.js` - Error handling
- `middleware/validation.js` - Input validation

## 🏗️ Architecture Overview

### Request Flow

```
Client Request
    ↓
Express Server (server.js)
    ↓
Middleware (CORS, JSON parser, etc.)
    ↓
Route Handler (routes/*.js)
    ↓
Validation (middleware/validation.js)
    ↓
Business Logic (services/*.js)
    ↓
Database (dbService.js → SQLite)
    ↓
Response (via route handler)
```

### Key Patterns

1. **Routes** handle HTTP requests/responses and input validation
2. **Services** contain business logic and data processing
3. **Middleware** handles cross-cutting concerns (CORS, errors, etc.)
4. **Utils** provide reusable helper functions

## 📝 Adding New Features

### Adding a New Route

1. **Create route file** in `routes/` directory
   ```javascript
   // routes/newFeature.js
   const express = require('express');
   const router = express.Router();
   const dbService = require('../services/dbService');
   const { asyncHandler } = require('../middleware/errorHandler');
   const { validateRequired } = require('../middleware/validation');
   
   /**
    * GET /api/new-feature
    * Description of what this endpoint does
    */
   router.get('/api/new-feature', asyncHandler(async (req, res) => {
     const db = dbService.getDb();
     // Your code here
     res.json({ message: 'Success' });
   }));
   
   module.exports = router;
   ```

2. **Register route** in `server.js`
   ```javascript
   const newFeatureRoutes = require('./routes/newFeature');
   app.use('/', newFeatureRoutes);
   ```

3. **Document the route** in `ROUTES.md`

### Adding a New Service

1. **Create service file** in `services/` directory
   ```javascript
   // services/newService.js
   const dbService = require('./dbService');
   
   /**
    * Description of the function
    * @param {string} param - Parameter description
    * @returns {Promise<Object>} Return value description
    */
   async function doSomething(param) {
     const db = dbService.getDb();
     // Your business logic here
     return result;
   }
   
   module.exports = {
     doSomething
   };
   ```

2. **Use in routes**
   ```javascript
   const newService = require('../services/newService');
   const result = await newService.doSomething(param);
   ```

### Adding Middleware

1. **Create middleware file** in `middleware/` directory
   ```javascript
   // middleware/newMiddleware.js
   function newMiddleware(req, res, next) {
     // Middleware logic
     next();
   }
   
   module.exports = newMiddleware;
   ```

2. **Use in server.js**
   ```javascript
   const newMiddleware = require('./middleware/newMiddleware');
   app.use(newMiddleware);
   ```

## ✅ Code Standards

### JSDoc Comments

Add JSDoc comments to all functions:

```javascript
/**
 * Function description
 * @param {string} param1 - Parameter description
 * @param {number} param2 - Another parameter
 * @returns {Promise<Object>} Return value description
 * @throws {Error} When something goes wrong
 * 
 * @example
 * const result = await myFunction('value', 123);
 */
async function myFunction(param1, param2) {
  // Implementation
}
```

### Error Handling

Always use `asyncHandler` for async routes:

```javascript
const { asyncHandler, createError } = require('../middleware/errorHandler');

router.get('/api/endpoint', asyncHandler(async (req, res) => {
  // If error occurs, it's automatically caught and handled
  throw createError('Not found', 404);
}));
```

### Input Validation

Use validation middleware:

```javascript
const { validateRequired, validateEmail } = require('../middleware/validation');

router.post('/api/endpoint',
  validateRequired(['name', 'email']),
  validateEmail('email'),
  asyncHandler(async (req, res) => {
    // req.body.name and req.body.email are validated
  })
);
```

### Database Access

Always use `dbService` for database access:

```javascript
const dbService = require('../services/dbService');
const db = dbService.getDb();

// Use promises for async operations
const row = await new Promise((resolve, reject) => {
  db.get('SELECT * FROM table WHERE id = ?', [id], (err, row) => {
    if (err) reject(err);
    else resolve(row);
  });
});
```

### Logging

Use debug utilities for logging:

```javascript
const { debugLog, debugError } = require('../debug');

debugLog('✅ Operation successful');
debugError('❌ Error occurred:', error);
```

## 🧪 Testing

### Manual Testing

1. **Test locally** with Postman or curl
2. **Check server logs** for errors
3. **Verify database** changes
4. **Test error cases** (invalid input, missing data, etc.)

### Test Scripts

Use scripts in `scripts/debug/` for testing:
```bash
node scripts/debug/check-employees.js
```

## 🐛 Debugging

### Common Issues

1. **Database not initialized**
   - Check: `dbService.initDatabase()` was called
   - Check: Database file exists and is accessible

2. **Routes not working**
   - Check: Route is registered in `server.js`
   - Check: Route path matches request URL
   - Check: HTTP method matches (GET, POST, etc.)

3. **WebSocket not connecting**
   - Check: WebSocket server is initialized
   - Check: Port is correct
   - Check: CORS allows the origin

### Debug Logging

Enable debug mode:
```bash
DEBUG=true npm start
```

Check logs for:
- `✅` - Success messages
- `❌` - Error messages
- `⚠️` - Warnings
- `🔄` - Info messages

## 📚 Documentation

### When to Document

- **New routes**: Add to `ROUTES.md`
- **New services**: Add JSDoc comments
- **Configuration changes**: Update `config/index.js` and README
- **Architecture changes**: Update `ARCHITECTURE.md`

### Documentation Files

- **`README.md`** - Quick start and overview
- **`ARCHITECTURE.md`** - Architecture patterns and principles
- **`ROUTES.md`** - Complete API documentation
- **`ARCHITECTURE_VISUAL.html`** - Visual architecture diagram
- **`CONTRIBUTING.md`** - This file

## 🔄 Git Workflow

### Commit Messages

Use clear, descriptive commit messages:

```
feat: Add employee validation middleware
fix: Correct database query in expense reports
docs: Update API documentation
refactor: Extract report builder helpers
```

### Before Committing

1. **Test your changes** thoroughly
2. **Check for errors** - no console errors or warnings
3. **Update documentation** if needed
4. **Keep commits focused** - one feature/fix per commit

## ⚠️ Important Notes

### Database Safety

- **Never delete** database operations without confirmation
- **Always backup** before running maintenance scripts
- **Test queries** in debug scripts before using in production

### Production Considerations

- **CORS** is currently open for development - restrict in production
- **Error messages** don't leak details in production
- **Environment variables** should be secured
- **Database** should be backed up regularly

### Code Review Checklist

Before submitting code for review:

- [ ] Code follows project structure
- [ ] JSDoc comments added
- [ ] Error handling implemented
- [ ] Input validation added
- [ ] Logging appropriate
- [ ] Documentation updated
- [ ] Tested locally
- [ ] No console errors

## 🤝 Getting Help

### Resources

1. **Check documentation**:
   - `README.md` - Setup and basics
   - `ARCHITECTURE.md` - Architecture guide
   - `ROUTES.md` - API reference
   - `ARCHITECTURE_VISUAL.html` - Visual diagrams

2. **Review existing code**:
   - Look at similar routes for patterns
   - Check services for reusable functions
   - Review middleware for examples

3. **Check server logs**:
   - Most issues show up in logs
   - Look for error messages with `❌`
   - Check startup messages

## 💡 Tips

1. **Start small** - Make small, focused changes
2. **Follow patterns** - Look at existing code for patterns
3. **Test thoroughly** - Test both success and error cases
4. **Ask questions** - Don't hesitate to ask for clarification
5. **Document as you go** - It's easier than documenting later

## 🎯 Next Steps

Once you're familiar with the codebase:

1. Review `ARCHITECTURE.md` for detailed patterns
2. Check `ROUTES.md` to understand all endpoints
3. Open `ARCHITECTURE_VISUAL.html` for visual overview
4. Start with small bug fixes or improvements
5. Gradually work on larger features

---

**Welcome aboard! Happy coding!** 🚀

