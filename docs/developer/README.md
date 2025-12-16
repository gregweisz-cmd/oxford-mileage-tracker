# Oxford House Mileage Tracker - Backend API

Backend server for the Oxford House Mileage Tracker application, providing REST API and WebSocket services.

## Quick Start

### Prerequisites
- Node.js >= 18.0.0
- npm

### Installation

```bash
npm install
```

### Start Server

```bash
npm start
```

Server starts on port **3002** by default.

### Verify Installation

Visit `http://localhost:3002` to see server status.

## Project Structure

```
backend/
├── server.js              # Main entry point
├── routes/                # API route handlers
├── services/              # Business logic services
├── middleware/            # Express middleware
├── utils/                 # Utility functions
└── scripts/               # Utility scripts
```

See [ARCHITECTURE.md](./ARCHITECTURE.md) for detailed architecture documentation.

## API Documentation

Complete API documentation is available in [ROUTES.md](./ROUTES.md).

### Quick Reference

- **Base URL**: `http://localhost:3002/api`
- **WebSocket**: `ws://localhost:3002/ws`
- **Health Check**: `GET /health` or `GET /api/health`

### Main Endpoints

- **Employees**: `/api/employees/*`
- **Mileage**: `/api/mileage-entries/*`
- **Receipts**: `/api/receipts/*`
- **Reports**: `/api/expense-reports/*`
- **Dashboard**: `/api/dashboard-*`
- **Admin**: `/api/admin/*`

## Configuration

### Environment Variables

Create a `.env` file in the backend directory:

```env
PORT=3002
NODE_ENV=development
GOOGLE_APPLICATION_CREDENTIALS=path/to/credentials.json
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@example.com
SMTP_PASSWORD=your-password
```

### Database

- **Type**: SQLite
- **Location**: `expense_tracker.db` (in backend directory)
- **Initialization**: Automatic on first run via `dbService.initDatabase()`

## Development

### Running in Development Mode

```bash
npm start
# or
NODE_ENV=development npm start
```

### Debug Logging

Debug logging is enabled in development mode. Logs include:
- Server startup messages
- Database initialization
- API requests (errors only)
- WebSocket connections

### Testing

Test scripts are located in `scripts/` directory. Run with:

```bash
node scripts/test-script.js
```

## Architecture

The backend follows a modular architecture:

1. **Routes** - Handle HTTP requests and responses
2. **Services** - Contain business logic
3. **Middleware** - Handle cross-cutting concerns (CORS, auth)
4. **Utils** - Reusable helper functions

See [ARCHITECTURE.md](./ARCHITECTURE.md) for detailed information.

## Adding New Features

### Adding a Route

1. Create route file in `routes/` directory
2. Export Express router
3. Register in `server.js`:

```javascript
const newRoutes = require('./routes/newFeature');
app.use('/', newRoutes);
```

See [ARCHITECTURE.md](./ARCHITECTURE.md) for more details.

## Troubleshooting

### Port Already in Use

```bash
PORT=3003 npm start
```

### Database Issues

The database is automatically created on first run. If issues occur:
- Check file permissions
- Verify database path in `services/dbService.js`
- Check logs for initialization errors

### Network Access (Mobile Testing)

The server listens on `0.0.0.0` by default, allowing mobile device connections.

1. Find your local IP: `ipconfig` (Windows) or `ifconfig` (Mac/Linux)
2. Use that IP instead of `localhost` in mobile app config
3. Ensure devices are on the same network

### Common Issues

- **CORS errors**: CORS is configured in `middleware/cors.js`
- **WebSocket not connecting**: Verify port is open and server is running
- **Google Cloud Vision not working**: Check `GOOGLE_APPLICATION_CREDENTIALS` path

## Production Deployment

### Environment Setup

```bash
NODE_ENV=production npm start
```

### Production Considerations

- Set up proper CORS origins
- Configure environment variables securely
- Use process manager (PM2, forever)
- Set up SSL/TLS
- Configure proper logging
- Database backup strategy
- Rate limiting

### Deployment Platforms

The backend can be deployed to:
- **Render.com** (configured via `render.yaml`)
- **Railway** (configured via `railway.json`)
- Any Node.js hosting service

## Security

⚠️ **Important Security Notes**:

- CORS is currently open for development - restrict in production
- Authentication is implemented but should be reviewed for production
- Database file should be secured (not publicly accessible)
- Environment variables should not be committed to version control
- Use HTTPS in production

## Contributing

When contributing code:

1. Follow existing code structure and patterns
2. Add JSDoc comments for new functions
3. Update ROUTES.md if adding new endpoints
4. Test your changes thoroughly
5. Ensure consistent error handling

## Additional Documentation

- [ARCHITECTURE.md](./ARCHITECTURE.md) - Detailed architecture overview
- [ROUTES.md](./ROUTES.md) - Complete API routes documentation
- [REFACTORING_STATUS.md](./REFACTORING_STATUS.md) - Recent refactoring status

## Support

For issues or questions, check:
1. Troubleshooting section above
2. Architecture documentation
3. API routes documentation
4. Server logs for error messages
