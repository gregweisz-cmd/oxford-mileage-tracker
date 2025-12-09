// Load environment variables
require('dotenv').config();

const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const http = require('http');
const WebSocket = require('ws');
const os = require('os');
const https = require('https');
const { debugLog, debugWarn, debugError } = require('./debug');

// Import modular utilities
const helpers = require('./utils/helpers');
const dateHelpers = require('./utils/dateHelpers');
const constants = require('./utils/constants');
const dbService = require('./services/dbService');
const websocketService = require('./services/websocketService');
const seedService = require('./services/seedService');
const { corsMiddleware, handlePreflight } = require('./middleware/cors');
const { errorHandler } = require('./middleware/errorHandler');
const { generalLimiter } = require('./middleware/rateLimiter');
const config = require('./config');
const costCentersRoutes = require('./routes/costCenters');
const employeesRoutes = require('./routes/employees');
const dataEntriesRoutes = require('./routes/dataEntries');
const expenseReportsRoutes = require('./routes/expenseReports');
const weeklyReportsRoutes = require('./routes/weeklyReports');
const biweeklyReportsRoutes = require('./routes/biweeklyReports');
const exportRoutes = require('./routes/export');
const dashboardRoutes = require('./routes/dashboard');
const { startReportScheduleRunner, stopReportScheduleRunner } = require('./routes/dashboard');
const authRoutes = require('./routes/auth');
const oauthRedirectRoutes = require('./routes/oauthRedirect');
const utilityRoutes = require('./routes/utility');
const systemRoutes = require('./routes/system');
const approvalRoutes = require('./routes/approval');
const notificationRoutes = require('./routes/notifications');
const supervisorRoutes = require('./routes/supervisor');
const adminRoutes = require('./routes/admin');
const { startSundayReminderJob, stopSundayReminderJob } = require('./services/sundayReminderJob');

const app = express();
const server = http.createServer(app);

// Trust proxy - Required when running behind a reverse proxy (e.g., Render.com load balancer)
// This allows Express to correctly identify client IPs from X-Forwarded-For headers
// Use '1' to only trust the first proxy (Render's load balancer) to maintain rate limiting security
app.set('trust proxy', 1);

// Set server timeout to 60 seconds for large file uploads
server.timeout = 60000;
server.keepAliveTimeout = 60000;
const wss = new WebSocket.Server({ server });
const PORT = config.server.port;

// Set up Google Cloud credentials path
const googleCredentialsPath = config.googleCloud.getCredentialsPath();
if (googleCredentialsPath) {
  process.env.GOOGLE_APPLICATION_CREDENTIALS = googleCredentialsPath;
  debugLog('✅ Google Cloud credentials loaded from:', googleCredentialsPath);
}

// Utility functions are now imported from ./utils/helpers

// Middleware - CORS configuration (extracted to middleware/cors.js)
app.use(corsMiddleware);
app.use(express.json({ limit: config.upload.maxFileSize })); // Increase JSON payload limit for large base64 images
app.use(express.static('public'));

// Rate limiting - Apply general rate limiting to all API routes
// Specific routes (auth, admin, uploads) have stricter limits applied in their route files
app.use('/api', generalLimiter);

// Handle favicon requests to prevent 404 errors
app.get('/favicon.ico', (req, res) => {
  res.status(204).end();
});

// Serve Apple App Site Association (AASA) file for Universal Links
// This must be served at /.well-known/apple-app-site-association with no file extension
// Note: appID format is TEAM_ID.BUNDLE_ID - you'll need to replace TEAM_ID with your Apple Developer Team ID
app.get('/.well-known/apple-app-site-association', (req, res) => {
  // For now, using wildcard team ID - replace with actual Team ID after app is built
  // You can find your Team ID in Apple Developer account or Xcode
  const aasa = {
    applinks: {
      apps: [],
      details: [
        {
          // Format: TEAM_ID.BUNDLE_ID
          // Replace '*' with your actual Apple Developer Team ID
          // Example: 'ABC123XYZ.com.oxfordhouse.ohstafftracker'
          appID: '*.com.oxfordhouse.ohstafftracker',
          paths: [
            '/api/auth/google/mobile/callback*',
            '/oauth/callback*'
          ]
        }
      ]
    },
    webcredentials: {
      apps: ['*.com.oxfordhouse.ohstafftracker']
    }
  };
  
  // Must be served with application/json content type (not text/plain)
  // Content-Type header is critical for iOS to recognize the file
  res.setHeader('Content-Type', 'application/json');
  res.json(aasa);
  debugLog('✅ Served Apple App Site Association file');
});

// Handle preflight OPTIONS requests (extracted to middleware/cors.js)
app.options('*', handlePreflight);

// Health check endpoint moved to routes/utility.js (available at /api/health)

// Database initialization route is in routes/system.js

// Request logging middleware - disabled to reduce log noise
// Only log errors and important events, not every request
// app.use((req, res, next) => {
//   const timestamp = new Date().toISOString();
//   debugLog(`[${timestamp}] ${req.method} ${req.path}`);
//   next();
// });

// Ensure uploads directory exists
const uploadsDir = config.upload.directory;
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  debugLog('📁 Created uploads directory');
}

// Serve uploaded files statically
app.use('/uploads', express.static(uploadsDir));

// Multer configuration for file uploads
const upload = multer({ dest: uploadsDir });

// Database path and connection are now managed by dbService
const DB_PATH = dbService.DB_PATH;
let db; // Will be set to dbService.getDb() after initialization

// Cost centers are now imported from ./utils/constants

// Initialize WebSocket service
websocketService.initializeWebSocket(wss);

// Register routes
app.use('/', costCentersRoutes);
app.use('/', employeesRoutes);
app.use('/', dataEntriesRoutes);
app.use('/', expenseReportsRoutes);
app.use('/', weeklyReportsRoutes);
app.use('/', biweeklyReportsRoutes);
app.use('/', exportRoutes);
app.use('/', dashboardRoutes);
app.use('/', authRoutes);
app.use('/', oauthRedirectRoutes);
app.use('/', utilityRoutes);
app.use('/', systemRoutes);
app.use('/', approvalRoutes);
app.use('/', notificationRoutes);
app.use('/', supervisorRoutes);
app.use('/', adminRoutes);

// Get all employees supervised by a supervisor (directly and indirectly) - Promise based
// getAllSupervisedEmployees is now in dbService
// Removed function definition - using dbService.getAllSupervisedEmployees instead
// broadcastDataChange is now in websocketService - use websocketService.broadcastDataChange()

// Helper functions and constants are now imported from ./utils/helpers and ./utils/constants

// getEmployeeById is now in dbService
// Removed function definition - using dbService.getEmployeeById instead
// REMOVED: cleanupDuplicates() function - too dangerous, deleted 250 employees
// This function was automatically deleting employees with same emails
// We'll handle duplicates manually if needed

// ensureTablesExist is now in dbService
// Removed function definition
// API Routes

// ===== EMPLOYEE ROUTES =====
// All employee routes have been moved to routes/employees.js
// This includes:
// - GET /api/employees (with query params)
// - GET /api/employees/archived
// - GET /api/employees/:id
// - PUT /api/employees/bulk-update
// - DELETE /api/employees/bulk-delete
// - POST /api/employees/bulk-create
// - POST /api/employees
// - PUT /api/employees/:id
// - POST /api/employees/:id/archive
// - POST /api/employees/:id/restore
// - DELETE /api/employees/:id
// - GET /api/current-employees
// - PUT /api/employees/:id/password
// - GET /api/supervisors/:supervisorId/team
// - GET /api/supervisors

// Removed route definitions - using routes/employees.js instead
// This includes: bulk operations, individual CRUD, archive/restore, supervisors, current-employees, password update

// ===== DATA ENTRIES ROUTES =====
// All data entry routes have been moved to routes/dataEntries.js
// This includes:
// - Mileage entries (GET, POST, PUT, DELETE)
// - Receipts (GET, POST, PUT, DELETE, upload-image, ocr)
// - Time tracking (GET, POST, PUT, DELETE)
// - Daily descriptions (GET, POST, DELETE)

// Removed route definitions - using routes/dataEntries.js instead
// This includes all mileage entries, receipts, time tracking, and daily descriptions routes

// Removed route definitions
// This includes all mileage entries, receipts (including upload-image and ocr), time tracking, and daily descriptions routes

// Removed route definitions
// This includes: mileage entries, receipts (including upload-image and ocr), time tracking, daily descriptions

// Removed route definitions
// This includes: mileage entries, receipts (including upload-image and ocr), time tracking, daily descriptions

// Removed route definitions
// This includes: mileage entries, receipts (including upload-image and ocr), time tracking, daily descriptions

// Removed route definitions
// This includes: mileage entries, receipts (including upload-image and ocr), time tracking, daily descriptions

// Removed route definitions
// This includes: mileage entries, receipts (including upload-image and ocr), time tracking, daily descriptions

// Removed route definitions
// Upload receipt image handler
// Removed - now in routes/dataEntries.js
// This includes: mileage entries, receipts (including upload-image and ocr), time tracking, daily descriptions

// OCR endpoint - Extract text from receipt image using Google Cloud Vision
// Removed - now in routes/dataEntries.js
// This includes: mileage entries, receipts (including upload-image and ocr), time tracking, daily descriptions

// Removed route definitions
// Per Diem Rules API Routes

// Get all per diem rules
// Per diem rules routes are now in routes/costCenters.js

// Saved Addresses API Routes

// Get saved addresses
// Utility routes (saved-addresses, oxford-houses, stats, health) are in routes/utility.js

// EES Rules and Per Diem Monthly Rules are now in routes/costCenters.js

// Expense Reports API Routes are now in routes/expenseReports.js

// Stats route is in routes/utility.js
// System routes (init-database, system-settings, backup) are in routes/system.js

// Approval routes are now in routes/approval.js

// Notification routes are now in routes/notifications.js
// Supervisor routes are now in routes/supervisor.js
// Messages route is now in routes/notifications.js
// Approval history route is now in routes/approval.js

// Export routes are now in routes/export.js
// Health check route is in routes/utility.js

// Serve the admin interface
app.get('/', (req, res) => {
  res.json({ message: 'Oxford House Mileage Tracker Backend API', status: 'running' });
});

// Error handling middleware (extracted to middleware/errorHandler.js)
app.use(errorHandler);

// Function to clean up duplicate entries - DISABLED (was deleting employees incorrectly)
// Seed functions moved to services/seedService.js

// Initialize database and start server
debugLog('🚀 Starting server initialization...');
debugLog(`📊 Database path: ${DB_PATH}`);
debugLog(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);

dbService.initDatabase().then(async () => {
  debugLog('✅ Database initialization completed');
  
  // Set local db reference for backward compatibility
  db = dbService.getDb();
  
  // Always ensure test accounts exist (both local and production)
  debugLog('🔧 Creating test accounts...');
  try {
    await seedService.seedTestAccounts();
    debugLog('✅ Test accounts created successfully');
  } catch (error) {
    debugError('❌ Error creating test accounts:', error);
  }
  
  // Seed supervisor assignments if module exists
  debugLog('🔧 Seeding supervisor assignments...');
  try {
    await seedService.seedSupervisorAssignments();
  } catch (error) {
    debugError('❌ Error seeding supervisor assignments:', error);
  }
  
  debugLog('⏰ Starting report schedule runner...');
  startReportScheduleRunner();
  
  debugLog('🔔 Starting Sunday reminder job...');
  startSundayReminderJob();
  
  debugLog('🌐 Starting HTTP server...');
  
  // Listen on configured host/port
  server.listen(PORT, config.server.host, () => {
    const networkIPs = helpers.getNetworkIPs();
    debugLog(`🚀 Backend server running on http://localhost:${PORT}`);
    debugLog(`🔌 WebSocket server running on ws://localhost:${PORT}/ws`);
    
    if (networkIPs.length > 0) {
      debugLog(`📱 Mobile app connection URLs:`);
      networkIPs.forEach(ip => {
        debugLog(`   http://${ip}:${PORT}`);
        debugLog(`   ws://${ip}:${PORT}/ws`);
      });
      debugLog(`\n💡 Use one of the above IPs instead of localhost from your mobile device`);
    }
    
    debugLog(`📊 Database path: ${DB_PATH}`);
    debugLog(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    debugLog('✅ Server startup completed successfully!');
  });
}).catch(err => {
  debugError('❌ Failed to initialize database:', err);
  debugError('❌ Full error details:', err.stack);
  process.exit(1);
});

let isShuttingDown = false;
function shutdownServer() {
  if (isShuttingDown) return;
  isShuttingDown = true;
  debugLog('👋 Shutting down server...');
  stopReportScheduleRunner();
  stopSundayReminderJob();
  server.close(() => {
    process.exit(0);
  });
  setTimeout(() => process.exit(0), 3000).unref();
}

process.on('SIGINT', shutdownServer);
process.on('SIGTERM', shutdownServer);

module.exports = app;
