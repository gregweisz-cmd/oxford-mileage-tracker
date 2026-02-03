/**
 * Application Configuration
 * Centralizes all configuration settings for the backend application
 * Extracted from scattered environment variables and hardcoded values
 */

const path = require('path');
require('dotenv').config();

/**
 * Server Configuration
 */
const SERVER_CONFIG = {
  port: process.env.PORT || 3003,
  host: process.env.HOST || '0.0.0.0', // Listen on all interfaces for mobile access
  timeout: 60000, // 60 seconds for large file uploads
  keepAliveTimeout: 60000,
};

/**
 * Database Configuration
 */
const DATABASE_CONFIG = {
  path: process.env.DATABASE_PATH || path.join(__dirname, '..', 'expense_tracker.db'),
  connection: {
    // SQLite specific options can go here if needed
  }
};

/**
 * Google Cloud Configuration
 */
const GOOGLE_CLOUD_CONFIG = {
  credentialsPath: process.env.GOOGLE_APPLICATION_CREDENTIALS || null,
  getCredentialsPath: function() {
    if (!this.credentialsPath) return null;
    // If it's a relative path, make it absolute relative to backend directory
    if (!path.isAbsolute(this.credentialsPath)) {
      return path.join(__dirname, '..', this.credentialsPath);
    }
    return this.credentialsPath;
  }
};

/**
 * CORS Configuration
 */
const CORS_CONFIG = {
  allowedOrigins: [
    'http://localhost:3000',
    'http://localhost:3001',
    'https://oxford-mileage-tracker.vercel.app',
    'https://oxford-mileage-tracker-git-main-gregweisz-cmd.vercel.app',
    'https://oxford-mileage-tracker-git-main-goose-weiszs-projects.vercel.app'
  ],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'x-user-role',
    'x-user-id',
    'Cache-Control',
    'Pragma',
    'X-Requested-With'
  ],
  exposedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  // Allow all origins in development for mobile app testing
  allowAllInDevelopment: process.env.NODE_ENV !== 'production'
};

/**
 * File Upload Configuration
 * Set UPLOAD_DIR (e.g. /data/uploads) to persist uploads on a Render persistent disk.
 */
const UPLOAD_CONFIG = {
  directory: process.env.UPLOAD_DIR || path.join(__dirname, '..', 'uploads'),
  maxFileSize: '50mb', // For JSON payloads with base64 images
  allowedMimeTypes: [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp'
  ]
};

/**
 * Email/SMTP Configuration (for scheduled reports)
 */
const EMAIL_CONFIG = {
  smtp: {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER || '',
      pass: process.env.SMTP_PASSWORD || ''
    }
  },
  from: {
    email: process.env.FROM_EMAIL || process.env.SMTP_FROM || 'reports@oxford-house.org',
    name: process.env.FROM_NAME || 'Oxford House Expense System'
  }
};

/**
 * Report Schedule Configuration
 */
const REPORT_SCHEDULE_CONFIG = {
  checkIntervalMs: 60 * 1000, // Check every minute
  allowedFrequencies: ['daily', 'weekly', 'monthly'],
  maxRecipients: 20,
  defaultTime: '08:00',
  defaultTimezone: 'America/New_York',
  defaultRowLimit: 250,
  attachmentRowLimit: 500,
  outboxDirectory: path.join(__dirname, '..', 'routes', 'scheduled-report-outbox')
};

/**
 * WebSocket Configuration
 */
const WEBSOCKET_CONFIG = {
  heartbeatInterval: 30000, // 30 seconds
  reconnectAttempts: 5,
  reconnectDelay: 5000 // 5 seconds
};

/**
 * Application Environment
 */
const ENV = {
  isDevelopment: process.env.NODE_ENV !== 'production',
  isProduction: process.env.NODE_ENV === 'production',
  nodeEnv: process.env.NODE_ENV || 'development'
};

/**
 * Debug Configuration
 */
const DEBUG_CONFIG = {
  enabled: ENV.isDevelopment || process.env.DEBUG === 'true',
  logLevel: process.env.LOG_LEVEL || 'info' // 'debug', 'info', 'warn', 'error'
};

/**
 * Export all configuration
 */
module.exports = {
  server: SERVER_CONFIG,
  database: DATABASE_CONFIG,
  googleCloud: GOOGLE_CLOUD_CONFIG,
  cors: CORS_CONFIG,
  upload: UPLOAD_CONFIG,
  email: EMAIL_CONFIG,
  reportSchedule: REPORT_SCHEDULE_CONFIG,
  websocket: WEBSOCKET_CONFIG,
  env: ENV,
  debug: DEBUG_CONFIG
};

