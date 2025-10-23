const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
const multer = require('multer');
const XLSX = require('xlsx');
const http = require('http');
const WebSocket = require('ws');
const { jsPDF } = require('jspdf');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });
const PORT = process.env.PORT || 3002;

// Middleware
app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://localhost:3001', 
    'https://oxford-mileage-tracker.vercel.app',
    'https://oxford-mileage-tracker-git-main-gregweisz-cmd.vercel.app',
    'https://oxford-mileage-tracker-git-main-goose-weiszs-projects.vercel.app'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cache-Control', 'Pragma']
}));
app.use(express.json({ limit: '10mb' })); // Increase JSON payload limit
app.use(express.static('public'));

// Handle preflight OPTIONS requests
app.options('*', (req, res) => {
  const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:3001', 
    'https://oxford-mileage-tracker.vercel.app',
    'https://oxford-mileage-tracker-git-main-gregweisz-cmd.vercel.app',
    'https://oxford-mileage-tracker-git-main-goose-weiszs-projects.vercel.app'
  ];
  
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
  } else {
    res.header('Access-Control-Allow-Origin', '*');
  }
  
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Cache-Control, Pragma');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.sendStatus(200);
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    database: db ? 'connected' : 'not connected',
    cors: 'updated for CEO demo'
  });
});

// Manual database initialization endpoint for debugging
app.post('/api/init-database', (req, res) => {
  try {
    console.log('🔧 Manual database initialization triggered');
    initDatabase();
    res.json({ 
      success: true, 
      message: 'Database initialized successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Error during manual database initialization:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Request logging middleware
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.path}`);
  next();
});

// Multer configuration for file uploads
const upload = multer({ dest: 'uploads/' });

// Database path - use in-memory for Render free tier, file for development
const DB_PATH = process.env.RENDER_SERVICE_ID 
  ? ':memory:'  // In-memory database for Render (resets on restart)
  : path.join(__dirname, 'expense_tracker.db'); // Backend's own database

// Database connection
let db;

// Cost centers are managed as a constant array, not in database
const COST_CENTERS = [
  'AL / HI / LA',
  'AL-SOR',
  'AL-SUBG',
  'AZ / CO',
  'AZ.CHCCP-SUBG (N)',
  'AZ.CHCCP-SUBG (S)',
  'AZ.MC-SUBG',
  'CA / CO / SD',
  'CA.CCC-OSG',
  'CA.CCC-SUBG',
  'CA.SLOC-HHSG',
  'CO.RMHP',
  'CO.RMHP-SOR',
  'CO.SBH-SOR',
  'CORPORATE',
  'CT / DE / NJ',
  'DC / MD / VA',
  'DC-SOR',
  'DE-STATE',
  'FL-',
  'FL-SOR',
  'Finance',
  'HI-STATE',
  'ID / WA',
  'IL / MN / WI',
  'IL-SUBG',
  'IL.BCBS',
  'IN.TC-OSG',
  'KY / IN / OH',
  'KY-OSG',
  'KY-SOR',
  'KY-STATE',
  'KY-SUBG',
  'LA-SOR',
  'LA-SUBG',
  'MO.GRACE',
  'NC',
  'NC.AHP',
  'NC.DOGWOOD',
  'NC.F-SOR',
  'NC.F-SUBG',
  'NC.MECKCO-OSG',
  'NC.TRILLIUM',
  'NE-SOR',
  'NJ-OSG',
  'NJ-SOR',
  'NJ-SOR (SUBG X)',
  'NJ-SUBG',
  'NM-STATE',
  'NY-',
  'NY.CC/GC-OSG',
  'NY.NC-OSG',
  'NY.OC-OSG',
  'NY.RC-OSG',
  'NY.SC-OSG',
  'NY.UC-OSG',
  'OH-OSG (HC)',
  'OH-SOR/SOS',
  'OH.BHM-STATE',
  'OH.FC-SOR/SOS',
  'OH.MC-STATE',
  'OK / MO / NE',
  'OK-DOJ (RE-ENTRY)',
  'OK-SUBG',
  'OR-',
  'OR-OSG',
  'OR-STATE',
  'Program Services',
  'SC / TN',
  'SC-STATE',
  'SC.PHCA',
  'SC.RUBICON',
  'SD-SOR',
  'TN-STATE',
  'TN-SUBG',
  'TX / NM',
  'TX-SUBG',
  'TX.HEB',
  'VA-SOR',
  'VA-SUBG',
  'WA-SUBG',
  'WA.KING',
  'WA.SNO',
  'WI.MIL'
];

// WebSocket clients management
const connectedClients = new Set();

// WebSocket connection handling
wss.on('connection', (ws, req) => {
  console.log('🔌 WebSocket client connected from:', req.headers.origin);
  connectedClients.add(ws);
  
  // Send welcome message
  ws.send(JSON.stringify({
    type: 'connection_established',
    timestamp: new Date().toISOString()
  }));
  
  // Send heartbeat every 30 seconds
  const heartbeat = setInterval(() => {
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify({
        type: 'heartbeat_response',
        timestamp: new Date().toISOString()
      }));
    } else {
      clearInterval(heartbeat);
    }
  }, 30000);
  
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      handleWebSocketMessage(ws, data);
    } catch (error) {
      console.error('❌ WebSocket message parsing error:', error);
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Invalid message format'
      }));
    }
  });
  
  ws.on('close', () => {
    console.log('🔌 WebSocket client disconnected');
    connectedClients.delete(ws);
    clearInterval(heartbeat);
  });
  
  ws.on('error', (error) => {
    console.error('❌ WebSocket error:', error);
    connectedClients.delete(ws);
    clearInterval(heartbeat);
  });
});

// Handle WebSocket messages
function handleWebSocketMessage(ws, data) {
  switch (data.type) {
    case 'heartbeat':
      ws.send(JSON.stringify({ type: 'heartbeat_response' }));
      break;
      
    case 'refresh_request':
      handleRefreshRequest(ws, data.data);
      break;
      
    case 'data_change':
      handleDataChangeNotification(data.data);
      break;
      
    default:
      console.log('🔄 Unknown WebSocket message type:', data.type);
  }
}

// Handle refresh requests
function handleRefreshRequest(ws, requestData) {
  console.log('🔄 Handling refresh request:', requestData);
  
  // Send refresh notification to all clients
  broadcastToClients({
    type: 'sync_request',
    data: requestData
  });
}

// Handle data change notifications
function handleDataChangeNotification(updateData) {
  console.log('🔄 Broadcasting data change:', updateData);
  
  // Broadcast update to all connected clients
  broadcastToClients({
    type: 'data_update',
    data: updateData
  });
}

// Broadcast message to all connected clients
function broadcastToClients(message) {
  const messageStr = JSON.stringify(message);
  connectedClients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(messageStr);
      } catch (error) {
        console.error('❌ Error sending WebSocket message:', error);
        connectedClients.delete(client);
      }
    }
  });
}

// Helper function to broadcast data changes
function broadcastDataChange(type, action, data, employeeId = null) {
  const update = {
    type,
    action,
    data,
    timestamp: new Date(),
    employeeId
  };
  
  broadcastToClients({
    type: 'data_update',
    data: update
  });
}

function initDatabase() {
  return new Promise((resolve, reject) => {
    db = new sqlite3.Database(DB_PATH, (err) => {
      if (err) {
        console.error('❌ Database connection error:', err.message);
        // Create a sample database if it doesn't exist
        createSampleDatabase().then(resolve).catch(reject);
      } else {
        console.log('✅ Connected to the SQLite database');
        // Always ensure tables exist, even if database already exists
        ensureTablesExist().then(resolve).catch(reject);
      }
    });
  });
}

async function cleanupDuplicates() {
  return new Promise(async (resolve, reject) => {
    try {
      console.log('🧹 Cleaning up duplicate entries...');
      
      // Clean up duplicate employees (keep the most recently updated one)
      await new Promise((resolveE, rejectE) => {
        db.run(`
          DELETE FROM employees 
          WHERE id NOT IN (
            SELECT id FROM (
              SELECT id, ROW_NUMBER() OVER (
                PARTITION BY email 
                ORDER BY updatedAt DESC
              ) as rn
              FROM employees
            ) WHERE rn = 1
          )
        `, (err) => {
          if (err) {
            console.error('❌ Error cleaning up duplicate employees:', err);
            rejectE(err);
          } else {
            db.get('SELECT COUNT(*) as count FROM employees', (countErr, row) => {
              if (!countErr) {
                console.log(`✅ Duplicate employees cleaned up - ${row.count} remaining`);
              }
              resolveE();
            });
          }
        });
      });
      
      // Clean up duplicate mileage entries
      await new Promise((resolveM, rejectM) => {
        db.run(`
          DELETE FROM mileage_entries 
          WHERE id NOT IN (
            SELECT id FROM (
              SELECT id, ROW_NUMBER() OVER (
                PARTITION BY employeeId, date, startLocation, endLocation, miles 
                ORDER BY createdAt DESC
              ) as rn
              FROM mileage_entries
            ) WHERE rn = 1
          )
        `, (err) => {
          if (err) {
            console.error('❌ Error cleaning up duplicate mileage entries:', err);
            rejectM(err);
          } else {
            db.get('SELECT COUNT(*) as count FROM mileage_entries', (countErr, row) => {
              if (!countErr) {
                console.log(`✅ Duplicate mileage entries cleaned up - ${row.count} remaining`);
              }
              resolveM();
            });
          }
        });
      });
      
      // Clean up duplicate time tracking entries
      await new Promise((resolveT, rejectT) => {
        db.run(`
          DELETE FROM time_tracking 
          WHERE id NOT IN (
            SELECT id FROM (
              SELECT id, ROW_NUMBER() OVER (
                PARTITION BY employeeId, date, category, hours 
                ORDER BY createdAt DESC
              ) as rn
              FROM time_tracking
            ) WHERE rn = 1
          )
        `, (err) => {
          if (err) {
            console.error('❌ Error cleaning up duplicate time tracking entries:', err);
            rejectT(err);
          } else {
            db.get('SELECT COUNT(*) as count FROM time_tracking', (countErr, row) => {
              if (!countErr) {
                console.log(`✅ Duplicate time tracking entries cleaned up - ${row.count} remaining`);
              }
              resolveT();
            });
          }
        });
      });
      
      console.log('✅ All duplicate entries cleaned up');
      resolve();
    } catch (error) {
      console.error('❌ Error during cleanup:', error);
      reject(error);
    }
  });
}

function ensureTablesExist() {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // Create all tables if they don't exist
      db.run(`CREATE TABLE IF NOT EXISTS employees (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        password TEXT DEFAULT '',
        oxfordHouseId TEXT NOT NULL,
        position TEXT NOT NULL,
        phoneNumber TEXT,
        baseAddress TEXT NOT NULL,
        baseAddress2 TEXT DEFAULT '',
        costCenters TEXT DEFAULT '[]',
        selectedCostCenters TEXT DEFAULT '[]',
        defaultCostCenter TEXT DEFAULT '',
        preferredName TEXT DEFAULT '',
        supervisorId TEXT DEFAULT NULL,
        signature TEXT DEFAULT NULL,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS mileage_entries (
        id TEXT PRIMARY KEY,
        employeeId TEXT NOT NULL,
        oxfordHouseId TEXT NOT NULL,
        date TEXT NOT NULL,
        odometerReading REAL NOT NULL,
        startLocation TEXT NOT NULL,
        endLocation TEXT NOT NULL,
        purpose TEXT NOT NULL,
        miles REAL NOT NULL,
        notes TEXT,
        hoursWorked REAL DEFAULT 0,
        isGpsTracked INTEGER NOT NULL DEFAULT 0,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS receipts (
        id TEXT PRIMARY KEY,
        employeeId TEXT NOT NULL,
        date TEXT NOT NULL,
        amount REAL NOT NULL,
        vendor TEXT NOT NULL,
        description TEXT,
        category TEXT NOT NULL,
        imageUri TEXT,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS time_tracking (
        id TEXT PRIMARY KEY,
        employeeId TEXT NOT NULL,
        date TEXT NOT NULL,
        category TEXT NOT NULL,
        hours REAL NOT NULL,
        description TEXT,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS current_employee (
        id INTEGER PRIMARY KEY,
        employeeId TEXT NOT NULL,
        lastLogin TEXT NOT NULL
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS daily_descriptions (
        id TEXT PRIMARY KEY,
        employeeId TEXT NOT NULL,
        date TEXT NOT NULL,
        description TEXT NOT NULL,
        costCenter TEXT,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      )`);

      // Create monthly reports table for approval workflow
      db.run(`CREATE TABLE IF NOT EXISTS monthly_reports (
        id TEXT PRIMARY KEY,
        employeeId TEXT NOT NULL,
        month INTEGER NOT NULL,
        year INTEGER NOT NULL,
        totalMiles REAL NOT NULL,
        totalExpenses REAL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'draft',
        submittedAt TEXT,
        submittedBy TEXT,
        reviewedAt TEXT,
        reviewedBy TEXT,
        approvedAt TEXT,
        approvedBy TEXT,
        rejectedAt TEXT,
        rejectedBy TEXT,
        rejectionReason TEXT,
        comments TEXT,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      )`);

      // Create weekly reports table for weekly approval workflow
      db.run(`CREATE TABLE IF NOT EXISTS weekly_reports (
        id TEXT PRIMARY KEY,
        employeeId TEXT NOT NULL,
        weekNumber INTEGER NOT NULL,
        year INTEGER NOT NULL,
        startDate TEXT NOT NULL,
        endDate TEXT NOT NULL,
        totalMiles REAL NOT NULL,
        totalExpenses REAL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'draft',
        submittedAt TEXT,
        submittedBy TEXT,
        reviewedAt TEXT,
        reviewedBy TEXT,
        approvedAt TEXT,
        approvedBy TEXT,
        rejectedAt TEXT,
        rejectedBy TEXT,
        rejectionReason TEXT,
        comments TEXT,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      )`);

      // Create biweekly reports table for month-based approval workflow (1-15, 16-end)
      db.run(`CREATE TABLE IF NOT EXISTS biweekly_reports (
        id TEXT PRIMARY KEY,
        employeeId TEXT NOT NULL,
        month INTEGER NOT NULL,
        year INTEGER NOT NULL,
        periodNumber INTEGER NOT NULL,
        startDate TEXT NOT NULL,
        endDate TEXT NOT NULL,
        totalMiles REAL NOT NULL,
        totalExpenses REAL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'draft',
        submittedAt TEXT,
        submittedBy TEXT,
        reviewedAt TEXT,
        reviewedBy TEXT,
        approvedAt TEXT,
        approvedBy TEXT,
        rejectedAt TEXT,
        rejectedBy TEXT,
        rejectionReason TEXT,
        comments TEXT,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      )`, (err) => {
        if (err) {
          console.error('❌ Error creating biweekly_reports table:', err);
        } else {
          console.log('✅ Biweekly reports table created/verified');
        }
      });

      // Create cost centers table
      db.run(`CREATE TABLE IF NOT EXISTS cost_centers (
        id TEXT PRIMARY KEY,
        code TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        isActive INTEGER DEFAULT 1,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      )`, (err) => {
        if (err) {
          console.error('❌ Error creating cost_centers table:', err);
        } else {
          console.log('✅ Cost centers table created/verified');
        }
      });

      db.run(`CREATE TABLE IF NOT EXISTS per_diem_rules (
        id TEXT PRIMARY KEY,
        costCenter TEXT NOT NULL,
        maxAmount REAL NOT NULL,
        minHours REAL NOT NULL,
        minMiles REAL NOT NULL,
        minDistanceFromBase REAL NOT NULL,
        description TEXT NOT NULL,
        useActualAmount INTEGER DEFAULT 0,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS ees_rules (
        id TEXT PRIMARY KEY,
        costCenter TEXT NOT NULL,
        maxAmount REAL NOT NULL,
        description TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS per_diem_monthly_rules (
        id TEXT PRIMARY KEY,
        costCenter TEXT NOT NULL,
        maxAmount REAL NOT NULL,
        description TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      )`);

      // Create expense reports table for complete report persistence
      db.run(`CREATE TABLE IF NOT EXISTS expense_reports (
        id TEXT PRIMARY KEY,
        employeeId TEXT NOT NULL,
        month INTEGER NOT NULL,
        year INTEGER NOT NULL,
        reportData TEXT NOT NULL,
        status TEXT DEFAULT 'draft',
        submittedAt TEXT,
        approvedAt TEXT,
        approvedBy TEXT,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        UNIQUE(employeeId, month, year)
      )`);

      // Create report approval system tables
      db.run(`CREATE TABLE IF NOT EXISTS report_status (
        id TEXT PRIMARY KEY,
        reportId TEXT NOT NULL,
        employeeId TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        supervisorId TEXT,
        supervisorName TEXT,
        comments TEXT,
        submittedAt TEXT NOT NULL,
        reviewedAt TEXT,
        approvedAt TEXT,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS report_approvals (
        id TEXT PRIMARY KEY,
        reportId TEXT NOT NULL,
        employeeId TEXT NOT NULL,
        supervisorId TEXT NOT NULL,
        supervisorName TEXT NOT NULL,
        action TEXT NOT NULL,
        comments TEXT,
        timestamp TEXT NOT NULL,
        createdAt TEXT NOT NULL
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS supervisor_notifications (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        employeeId TEXT NOT NULL,
        employeeName TEXT,
        supervisorId TEXT NOT NULL,
        reportId TEXT,
        message TEXT NOT NULL,
        isRead INTEGER DEFAULT 0,
        createdAt TEXT NOT NULL
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS staff_notifications (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        employeeId TEXT NOT NULL,
        supervisorId TEXT NOT NULL,
        supervisorName TEXT NOT NULL,
        reportId TEXT,
        message TEXT NOT NULL,
        isRead INTEGER DEFAULT 0,
        createdAt TEXT NOT NULL
      )`);

      // Add missing columns to existing employees table if they don't exist
      // Check if columns exist before adding them
      db.all(`PRAGMA table_info(employees)`, (err, columns) => {
        if (!err && columns) {
          const columnNames = columns.map(col => col.name);
          
          if (!columnNames.includes('selectedCostCenters')) {
            db.run(`ALTER TABLE employees ADD COLUMN selectedCostCenters TEXT DEFAULT '[]'`, (err) => {
              if (err) console.log('Note: selectedCostCenters column may already exist');
            });
          }
          
          if (!columnNames.includes('defaultCostCenter')) {
            db.run(`ALTER TABLE employees ADD COLUMN defaultCostCenter TEXT DEFAULT ''`, (err) => {
              if (err) console.log('Note: defaultCostCenter column may already exist');
            });
          }
          
          if (!columnNames.includes('signature')) {
            db.run(`ALTER TABLE employees ADD COLUMN signature TEXT DEFAULT NULL`, (err) => {
              if (err) console.log('Note: signature column may already exist');
              else console.log('✅ Added signature column to employees table');
            });
          }
          
          if (!columnNames.includes('preferredName')) {
            db.run(`ALTER TABLE employees ADD COLUMN preferredName TEXT DEFAULT ''`, (err) => {
              if (err) console.log('Note: preferredName column may already exist');
              else console.log('✅ Added preferredName column to employees table');
            });
          }
          
          if (!columnNames.includes('supervisorId')) {
            db.run(`ALTER TABLE employees ADD COLUMN supervisorId TEXT DEFAULT NULL`, (err) => {
              if (err) console.log('Note: supervisorId column may already exist');
              else console.log('✅ Added supervisorId column to employees table');
            });
          }
          
          if (!columnNames.includes('approvalFrequency')) {
            db.run(`ALTER TABLE employees ADD COLUMN approvalFrequency TEXT DEFAULT 'monthly'`, (err) => {
              if (err) console.log('Note: approvalFrequency column may already exist');
              else console.log('✅ Added approvalFrequency column to employees table');
            });
          }
        }
      });

      // Add missing columns to existing mileage_entries table if they don't exist
      db.all(`PRAGMA table_info(mileage_entries)`, (err, columns) => {
        if (!err && columns) {
          const columnNames = columns.map(col => col.name);
          
          if (!columnNames.includes('costCenter')) {
            db.run(`ALTER TABLE mileage_entries ADD COLUMN costCenter TEXT DEFAULT ''`, (err) => {
              if (err) console.log('Note: costCenter column may already exist');
            });
          }
          
          if (!columnNames.includes('startLocationName')) {
            db.run(`ALTER TABLE mileage_entries ADD COLUMN startLocationName TEXT DEFAULT ''`, (err) => {
              if (err) console.log('Note: startLocationName column may already exist');
            });
          }
          
          if (!columnNames.includes('startLocationAddress')) {
            db.run(`ALTER TABLE mileage_entries ADD COLUMN startLocationAddress TEXT DEFAULT ''`, (err) => {
              if (err) console.log('Note: startLocationAddress column may already exist');
            });
          }
          
          if (!columnNames.includes('startLocationLat')) {
            db.run(`ALTER TABLE mileage_entries ADD COLUMN startLocationLat REAL DEFAULT 0`, (err) => {
              if (err) console.log('Note: startLocationLat column may already exist');
            });
          }
          
          if (!columnNames.includes('startLocationLng')) {
            db.run(`ALTER TABLE mileage_entries ADD COLUMN startLocationLng REAL DEFAULT 0`, (err) => {
              if (err) console.log('Note: startLocationLng column may already exist');
            });
          }
          
          if (!columnNames.includes('endLocationName')) {
            db.run(`ALTER TABLE mileage_entries ADD COLUMN endLocationName TEXT DEFAULT ''`, (err) => {
              if (err) console.log('Note: endLocationName column may already exist');
            });
          }
          
          if (!columnNames.includes('endLocationAddress')) {
            db.run(`ALTER TABLE mileage_entries ADD COLUMN endLocationAddress TEXT DEFAULT ''`, (err) => {
              if (err) console.log('Note: endLocationAddress column may already exist');
            });
          }
          
          if (!columnNames.includes('endLocationLat')) {
            db.run(`ALTER TABLE mileage_entries ADD COLUMN endLocationLat REAL DEFAULT 0`, (err) => {
              if (err) console.log('Note: endLocationLat column may already exist');
            });
          }
          
          if (!columnNames.includes('endLocationLng')) {
            db.run(`ALTER TABLE mileage_entries ADD COLUMN endLocationLng REAL DEFAULT 0`, (err) => {
              if (err) console.log('Note: endLocationLng column may already exist');
            });
          }
        }
      });

      // Add missing columns to existing receipts table if they don't exist
      db.all(`PRAGMA table_info(receipts)`, (err, columns) => {
        if (!err && columns) {
          const columnNames = columns.map(col => col.name);
          
          if (!columnNames.includes('costCenter')) {
            db.run(`ALTER TABLE receipts ADD COLUMN costCenter TEXT DEFAULT ''`, (err) => {
              if (err) console.log('Note: costCenter column may already exist');
            });
          }
        }
      });

      // Add missing columns to existing time_tracking table if they don't exist
      db.all(`PRAGMA table_info(time_tracking)`, (err, columns) => {
        if (!err && columns) {
          const columnNames = columns.map(col => col.name);
          
          if (!columnNames.includes('costCenter')) {
            db.run(`ALTER TABLE time_tracking ADD COLUMN costCenter TEXT DEFAULT ''`, (err) => {
              if (err) console.log('Note: costCenter column may already exist');
            });
          }
        }
      });

      // Add missing columns to per_diem_rules table
      db.all(`PRAGMA table_info(per_diem_rules)`, (err, columns) => {
        if (!err && columns) {
          const columnNames = columns.map(col => col.name);
          
          if (!columnNames.includes('useActualAmount')) {
            db.run(`ALTER TABLE per_diem_rules ADD COLUMN useActualAmount INTEGER DEFAULT 0`, (err) => {
              if (err) console.log('Note: useActualAmount column may already exist');
              else console.log('✅ Added useActualAmount column to per_diem_rules table');
            });
          }
        }
      });

      // Insert sample employees if they don't exist
      const now = new Date().toISOString();
      
      // REMOVED: All test employees (emp1, emp2, emp3, emp4)
      // Using bulk-imported employee data only
      // Bulk import employees have IDs starting with mgfft...

      // Populate cost centers table with initial data
      console.log('🔧 Populating cost centers table with', COST_CENTERS.length, 'cost centers...');
      COST_CENTERS.forEach((name, index) => {
        const id = `cc-${index + 1}`;
        const code = name.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
        db.run(`INSERT OR IGNORE INTO cost_centers (id, code, name, description, isActive, createdAt, updatedAt) 
                VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [id, code, name, `${name} cost center`, 1, now, now], (err) => {
          if (err) {
            console.error(`❌ Error inserting cost center ${name}:`, err);
          }
        });
      });
      console.log('✅ Cost centers population completed');

      // REMOVED: All sample mileage, receipt, and time tracking entries
      // Real data will come from mobile app and web portal

      console.log('✅ All tables ensured to exist with sample data');
      
      // Clean up duplicate entries (mileage, time tracking, etc.)
      cleanupDuplicates().then(() => {
      resolve();
      }).catch((err) => {
        console.error('❌ Error during cleanup, but continuing:', err);
        resolve(); // Still resolve even if cleanup fails
      });
    });
  });
}

function createSampleDatabase() {
  return new Promise((resolve, reject) => {
    db = new sqlite3.Database(DB_PATH, (err) => {
      if (err) {
        reject(err);
        return;
      }

      // Create sample tables
      db.serialize(() => {
        // Employees table
        db.run(`CREATE TABLE IF NOT EXISTS employees (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          email TEXT NOT NULL,
          password TEXT DEFAULT '',
          oxfordHouseId TEXT NOT NULL,
          position TEXT NOT NULL,
          phoneNumber TEXT,
          baseAddress TEXT NOT NULL,
          costCenters TEXT DEFAULT '[]',
          supervisorId TEXT DEFAULT NULL,
          createdAt TEXT NOT NULL,
          updatedAt TEXT NOT NULL
        )`);

        // Mileage entries table
        db.run(`CREATE TABLE IF NOT EXISTS mileage_entries (
          id TEXT PRIMARY KEY,
          employeeId TEXT NOT NULL,
          oxfordHouseId TEXT NOT NULL,
          date TEXT NOT NULL,
          odometerReading REAL NOT NULL,
          startLocation TEXT NOT NULL,
          endLocation TEXT NOT NULL,
          purpose TEXT NOT NULL,
          miles REAL NOT NULL,
          notes TEXT,
          hoursWorked REAL DEFAULT 0,
          isGpsTracked INTEGER NOT NULL DEFAULT 0,
          createdAt TEXT NOT NULL,
          updatedAt TEXT NOT NULL
        )`);

        // Receipts table
        db.run(`CREATE TABLE IF NOT EXISTS receipts (
          id TEXT PRIMARY KEY,
          employeeId TEXT NOT NULL,
          date TEXT NOT NULL,
          amount REAL NOT NULL,
          vendor TEXT NOT NULL,
          description TEXT,
          category TEXT NOT NULL,
          imageUri TEXT,
          createdAt TEXT NOT NULL,
          updatedAt TEXT NOT NULL
        )`);

        // Time tracking table
        db.run(`CREATE TABLE IF NOT EXISTS time_tracking (
          id TEXT PRIMARY KEY,
          employeeId TEXT NOT NULL,
          date TEXT NOT NULL,
          category TEXT NOT NULL,
          hours REAL NOT NULL,
          description TEXT,
          createdAt TEXT NOT NULL,
          updatedAt TEXT NOT NULL
        )`);

        // Create cost centers table
        db.run(`CREATE TABLE IF NOT EXISTS cost_centers (
          id TEXT PRIMARY KEY,
          code TEXT UNIQUE NOT NULL,
          name TEXT NOT NULL,
          description TEXT,
          isActive INTEGER DEFAULT 1,
          createdAt TEXT NOT NULL,
          updatedAt TEXT NOT NULL
        )`, (err) => {
          if (err) {
            console.error('❌ Error creating cost_centers table:', err);
          } else {
            console.log('✅ Cost centers table created/verified');
          }
        });

        // Per diem rules table
        db.run(`CREATE TABLE IF NOT EXISTS per_diem_rules (
          id TEXT PRIMARY KEY,
          costCenter TEXT NOT NULL,
          maxAmount REAL NOT NULL,
          minHours REAL NOT NULL,
          minMiles REAL NOT NULL,
          minDistanceFromBase REAL NOT NULL,
          description TEXT NOT NULL,
          createdAt TEXT NOT NULL,
          updatedAt TEXT NOT NULL
        )`);

        // EES rules table
        db.run(`CREATE TABLE IF NOT EXISTS ees_rules (
          id TEXT PRIMARY KEY,
          costCenter TEXT NOT NULL,
          maxAmount REAL NOT NULL,
          description TEXT NOT NULL,
          createdAt TEXT NOT NULL,
          updatedAt TEXT NOT NULL
        )`);

        // Per diem monthly rules table
        db.run(`CREATE TABLE IF NOT EXISTS per_diem_monthly_rules (
          id TEXT PRIMARY KEY,
          costCenter TEXT NOT NULL,
          maxAmount REAL NOT NULL,
          description TEXT NOT NULL,
          createdAt TEXT NOT NULL,
          updatedAt TEXT NOT NULL
        )`);

        // Insert sample data
        const now = new Date().toISOString();
        
        // REMOVED: Test employee emp1 and sample Oxford House
        // Using bulk-imported employee data only

        // Populate cost centers table with initial data
        console.log('🔧 Populating cost centers table with', COST_CENTERS.length, 'cost centers...');
        COST_CENTERS.forEach((name, index) => {
          const id = `cc-${index + 1}`;
          const code = name.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
          db.run(`INSERT OR IGNORE INTO cost_centers (id, code, name, description, isActive, createdAt, updatedAt) 
                  VALUES (?, ?, ?, ?, ?, ?, ?)`,
                  [id, code, name, `${name} cost center`, 1, now, now], (err) => {
            if (err) {
              console.error(`❌ Error inserting cost center ${name}:`, err);
            }
          });
        });
        console.log('✅ Cost centers population completed');

        // Insert sample per diem monthly rules
        db.run(`INSERT OR IGNORE INTO per_diem_monthly_rules (id, costCenter, maxAmount, description, createdAt, updatedAt)
                VALUES (?, ?, ?, ?, ?, ?)`,
                ['pdmr1', 'AL-SOR', 350.00, 'Standard per diem monthly limit', now, now]);
        
        db.run(`INSERT OR IGNORE INTO per_diem_monthly_rules (id, costCenter, maxAmount, description, createdAt, updatedAt)
                VALUES (?, ?, ?, ?, ?, ?)`,
                ['pdmr2', 'CC001', 300.00, 'Reduced per diem limit for CC001', now, now]);
        
        db.run(`INSERT OR IGNORE INTO per_diem_monthly_rules (id, costCenter, maxAmount, description, createdAt, updatedAt)
                VALUES (?, ?, ?, ?, ?, ?)`,
                ['pdmr3', 'CC002', 400.00, 'Higher per diem limit for CC002', now, now]);

        // REMOVED: All sample mileage, receipt, and time tracking data
        // Real data will come from mobile app and web portal
        
        
        console.log('✅ Database tables created (no sample data)');
        resolve();
      });
    });
  });
}

// API Routes

// Get all employees
app.get('/api/employees', (req, res) => {
  db.all('SELECT * FROM employees ORDER BY name', (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    // Parse JSON fields for each employee
    const parsedRows = rows.map(row => {
      try {
        // Handle corrupted "[object Object]" entries
        let costCenters = [];
        let selectedCostCenters = [];
        
        if (row.costCenters) {
          if (row.costCenters === '[object Object]' || row.costCenters === '[object Object]') {
            console.log('🔧 Fixing corrupted costCenters for employee:', row.id);
            costCenters = ['Program Services']; // Default fallback
          } else {
            try {
              costCenters = JSON.parse(row.costCenters);
            } catch (parseErr) {
              console.log('⚠️ Failed to parse costCenters for', row.id, ':', row.costCenters);
              costCenters = ['Program Services']; // Default fallback
            }
          }
        }
        
        if (row.selectedCostCenters) {
          if (row.selectedCostCenters === '[object Object]' || row.selectedCostCenters === '[object Object]') {
            console.log('🔧 Fixing corrupted selectedCostCenters for employee:', row.id);
            selectedCostCenters = ['Program Services']; // Default fallback
          } else {
            try {
              selectedCostCenters = JSON.parse(row.selectedCostCenters);
            } catch (parseErr) {
              console.log('⚠️ Failed to parse selectedCostCenters for', row.id, ':', row.selectedCostCenters);
              selectedCostCenters = ['Program Services']; // Default fallback
            }
          }
        }
        
        return {
          ...row,
          costCenters,
          selectedCostCenters
        };
      } catch (parseErr) {
        console.error('❌ Error parsing employee data for', row.id, ':', parseErr);
        return {
          ...row,
          costCenters: ['Program Services'],
          selectedCostCenters: ['Program Services']
        };
      }
    });
    
    res.json(parsedRows);
  });
});

// Get employee by ID
app.get('/api/employees/:id', (req, res) => {
  const { id } = req.params;
  db.get('SELECT * FROM employees WHERE id = ?', [id], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (!row) {
      res.status(404).json({ error: 'Employee not found' });
      return;
    }
    
    // Fix corrupted costCenters data
    if (row.costCenters === '[object Object]') {
      console.log('🔧 Fixing corrupted costCenters for employee:', id);
      row.costCenters = '["AL-SOR", "G&A", "Fundraising"]';
      
      // Update the database with the correct value
      db.run('UPDATE employees SET costCenters = ? WHERE id = ?', [row.costCenters, id], (updateErr) => {
        if (updateErr) {
          console.error('Failed to update costCenters:', updateErr);
        } else {
          console.log('✅ Fixed costCenters in database for employee:', id);
        }
      });
    }
    
    res.json(row);
  });
});

// ===== BULK OPERATIONS (must come before parameterized routes) =====

// Bulk update employees
app.put('/api/employees/bulk-update', (req, res) => {
  const { employeeIds, updates } = req.body;
  
  if (!employeeIds || !Array.isArray(employeeIds) || employeeIds.length === 0) {
    return res.status(400).json({ error: 'Employee IDs array is required' });
  }
  
  if (!updates || Object.keys(updates).length === 0) {
    return res.status(400).json({ error: 'Updates object is required' });
  }
  
  // Build dynamic update query
  const updateFields = [];
  const values = [];
  
  Object.keys(updates).forEach(key => {
    if (updates[key] !== undefined && updates[key] !== null) {
      updateFields.push(`${key} = ?`);
      values.push(updates[key]);
    }
  });
  
  if (updateFields.length === 0) {
    return res.status(400).json({ error: 'No valid fields to update' });
  }
  
  values.push(new Date().toISOString()); // updatedAt
  values.push(...employeeIds); // for the IN clause
  
  const placeholders = employeeIds.map(() => '?').join(',');
  const query = `UPDATE employees SET ${updateFields.join(', ')}, updatedAt = ? WHERE id IN (${placeholders})`;
  
  db.run(query, values, function(err) {
    if (err) {
      console.error('Error bulk updating employees:', err);
      res.status(500).json({ error: 'Failed to update employees' });
    } else {
      res.json({ 
        success: true, 
        updatedCount: this.changes,
        message: `Successfully updated ${this.changes} employees`
      });
    }
  });
});

// Bulk delete employees
app.delete('/api/employees/bulk-delete', (req, res) => {
  const { employeeIds } = req.body;
  
  if (!employeeIds || !Array.isArray(employeeIds) || employeeIds.length === 0) {
    return res.status(400).json({ error: 'Employee IDs array is required' });
  }
  
  const placeholders = employeeIds.map(() => '?').join(',');
  const query = `DELETE FROM employees WHERE id IN (${placeholders})`;
  
  db.run(query, employeeIds, function(err) {
    if (err) {
      console.error('Error bulk deleting employees:', err);
      res.status(500).json({ error: 'Failed to delete employees' });
    } else {
      res.json({ 
        success: true, 
        deletedCount: this.changes,
        message: `Successfully deleted ${this.changes} employees`
      });
    }
  });
});

// Bulk create employees
app.post('/api/employees/bulk-create', (req, res) => {
  const { employees } = req.body;
  
  if (!employees || !Array.isArray(employees) || employees.length === 0) {
    return res.status(400).json({ error: 'Employees array is required' });
  }
  
  const results = {
    success: true,
    totalProcessed: employees.length,
    successful: 0,
    failed: 0,
    errors: [],
    createdEmployees: []
  };
  
  // Process employees sequentially to avoid race conditions
  const processEmployee = (index) => {
    if (index >= employees.length) {
      // All processed
      results.success = results.failed === 0;
      return res.json(results);
    }
    
    const employee = employees[index];
    const id = Date.now().toString(36) + Math.random().toString(36).substr(2);
    const now = new Date().toISOString();
    
    db.run(
      'INSERT INTO employees (id, name, email, password, oxfordHouseId, position, phoneNumber, baseAddress, baseAddress2, costCenters, selectedCostCenters, defaultCostCenter, supervisorId, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        id,
        employee.name,
        employee.email,
        employee.password || '',
        employee.oxfordHouseId,
        employee.position,
        employee.phoneNumber || '',
        employee.baseAddress || '',
        employee.baseAddress2 || '',
        typeof employee.costCenters === 'string' ? employee.costCenters : JSON.stringify(employee.costCenters || []),
        typeof employee.selectedCostCenters === 'string' ? employee.selectedCostCenters : JSON.stringify(employee.selectedCostCenters || employee.costCenters || []),
        employee.defaultCostCenter || (Array.isArray(employee.costCenters) ? employee.costCenters[0] : '') || '',
        employee.supervisorId || null,
        now,
        now
      ],
      function(err) {
        if (err) {
          results.failed++;
          results.errors.push(`Failed to create ${employee.name}: ${err.message}`);
        } else {
          results.successful++;
          results.createdEmployees.push({ id, ...employee });
        }
        // Process next employee
        processEmployee(index + 1);
      }
    );
  };
  
  processEmployee(0);
});

// ===== INDIVIDUAL OPERATIONS =====

// Create new employee
app.post('/api/employees', (req, res) => {
  const { name, email, oxfordHouseId, position, phoneNumber, baseAddress, baseAddress2, costCenters, supervisorId } = req.body;
  const id = Date.now().toString(36) + Math.random().toString(36).substr(2);
  const now = new Date().toISOString();

  db.run(
    'INSERT INTO employees (id, name, email, oxfordHouseId, position, phoneNumber, baseAddress, baseAddress2, costCenters, supervisorId, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [id, name, email, oxfordHouseId, position, phoneNumber, baseAddress, baseAddress2 || '', costCenters || '[]', supervisorId || null, now, now],
    function(err) {
      if (err) {
        console.error('Database error:', err.message);
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ id, message: 'Employee created successfully' });
    }
  );
});

// Update employee
app.put('/api/employees/:id', (req, res) => {
  const { id } = req.params;
  const { name, preferredName, email, oxfordHouseId, position, phoneNumber, baseAddress, baseAddress2, costCenters, selectedCostCenters, defaultCostCenter, signature, supervisorId } = req.body;
  const now = new Date().toISOString();

  console.log('📝 Updating employee:', id);
  console.log('📦 Update data received:', { name, preferredName, email, oxfordHouseId, position, phoneNumber, baseAddress, baseAddress2, costCenters, selectedCostCenters, defaultCostCenter });

  // Check if database connection exists
  if (!db) {
    console.error('❌ Database connection not initialized');
    res.status(500).json({ error: 'Database connection not initialized' });
    return;
  }

  db.run(
    'UPDATE employees SET name = ?, preferredName = ?, email = ?, oxfordHouseId = ?, position = ?, phoneNumber = ?, baseAddress = ?, baseAddress2 = ?, costCenters = ?, selectedCostCenters = ?, defaultCostCenter = ?, signature = ?, supervisorId = ?, updatedAt = ? WHERE id = ?',
    [name, preferredName || '', email, oxfordHouseId || '', position, phoneNumber, baseAddress, baseAddress2 || '', 
     typeof costCenters === 'string' ? costCenters : JSON.stringify(costCenters || []),
     typeof selectedCostCenters === 'string' ? selectedCostCenters : JSON.stringify(selectedCostCenters || []),
     defaultCostCenter || '', signature || null, supervisorId || null, now, id],
    function(err) {
      if (err) {
        console.error('❌ Database error updating employee:', err.message);
        console.error('❌ Full error:', err);
        res.status(500).json({ error: err.message, details: err.toString() });
        return;
      }
      console.log('✅ Employee updated successfully:', id, '- Rows affected:', this.changes);
      if (this.changes === 0) {
        console.warn('⚠️ No rows updated - employee might not exist');
      }
      res.json({ message: 'Employee updated successfully', changes: this.changes });
    }
  );
});

// Delete employee
app.delete('/api/employees/:id', (req, res) => {
  const { id } = req.params;
  db.run('DELETE FROM employees WHERE id = ?', [id], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ message: 'Employee deleted successfully' });
  });
});

// ===== COST CENTER MANAGEMENT API ENDPOINTS =====

// Get all cost centers
app.get('/api/cost-centers', (req, res) => {
  db.all('SELECT * FROM cost_centers ORDER BY name', (err, rows) => {
    if (err) {
      console.error('❌ Error fetching cost centers:', err);
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

// Get cost center by ID
app.get('/api/cost-centers/:id', (req, res) => {
  const { id } = req.params;
  db.get('SELECT * FROM cost_centers WHERE id = ?', [id], (err, row) => {
    if (err) {
      console.error('❌ Error fetching cost center:', err);
      res.status(500).json({ error: err.message });
      return;
    }
    if (!row) {
      res.status(404).json({ error: 'Cost center not found' });
      return;
    }
    res.json(row);
  });
});

// Create new cost center
app.post('/api/cost-centers', (req, res) => {
  const { name, description, isActive, code } = req.body;
  const id = Date.now().toString(36) + Math.random().toString(36).substr(2);
  const now = new Date().toISOString();
  
  // Generate code from name if not provided
  const costCenterCode = code || name.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  
  db.run(
    'INSERT INTO cost_centers (id, code, name, description, isActive, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [id, costCenterCode, name, description || '', isActive !== false ? 1 : 0, now, now],
    function(err) {
      if (err) {
        console.error('❌ Error creating cost center:', err);
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ id, code: costCenterCode, name, description, isActive: isActive !== false, createdAt: now, updatedAt: now });
    }
  );
});

// Update cost center
app.put('/api/cost-centers/:id', (req, res) => {
  const { id } = req.params;
  const { name, description, isActive, code } = req.body;
  const now = new Date().toISOString();
  
  // Generate code from name if not provided
  const costCenterCode = code || name.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  
  db.run(
    'UPDATE cost_centers SET code = ?, name = ?, description = ?, isActive = ?, updatedAt = ? WHERE id = ?',
    [costCenterCode, name, description || '', isActive !== false ? 1 : 0, now, id],
    function(err) {
      if (err) {
        console.error('❌ Error updating cost center:', err);
        res.status(500).json({ error: err.message });
        return;
      }
      if (this.changes === 0) {
        res.status(404).json({ error: 'Cost center not found' });
        return;
      }
      res.json({ id, code: costCenterCode, name, description, isActive: isActive !== false, updatedAt: now });
    }
  );
});

// Delete cost center
app.delete('/api/cost-centers/:id', (req, res) => {
  const { id } = req.params;
  
  db.run('DELETE FROM cost_centers WHERE id = ?', [id], function(err) {
    if (err) {
      console.error('❌ Error deleting cost center:', err);
      res.status(500).json({ error: err.message });
      return;
    }
    if (this.changes === 0) {
      res.status(404).json({ error: 'Cost center not found' });
      return;
    }
    res.json({ message: 'Cost center deleted successfully' });
  });
});

// ===== EMPLOYEE PASSWORD MANAGEMENT API ENDPOINTS =====

// Get current employees (for mobile app authentication)
app.get('/api/current-employees', (req, res) => {
  db.all('SELECT id, name, email, oxfordHouseId, position, phoneNumber, baseAddress, costCenters FROM employees ORDER BY name', (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    // Parse JSON fields for each employee
    const parsedRows = rows.map(row => {
      try {
        let costCenters = [];
        let selectedCostCenters = [];
        
        if (row.costCenters) {
          if (row.costCenters === '[object Object]') {
            costCenters = ['Program Services'];
          } else {
            try {
              costCenters = JSON.parse(row.costCenters);
            } catch (parseErr) {
              costCenters = ['Program Services'];
            }
          }
        }
        
        // Use costCenters as selectedCostCenters if selectedCostCenters doesn't exist
        selectedCostCenters = [...costCenters];
        
        return {
          ...row,
          costCenters,
          selectedCostCenters,
          defaultCostCenter: costCenters[0] || 'Program Services'
        };
      } catch (parseErr) {
        return {
          ...row,
          costCenters: ['Program Services'],
          selectedCostCenters: ['Program Services'],
          defaultCostCenter: 'Program Services'
        };
      }
    });
    
    res.json(parsedRows);
  });
});


// Update employee password
app.put('/api/employees/:id/password', (req, res) => {
  const { id } = req.params;
  const { password } = req.body;
  
  if (!password) {
    return res.status(400).json({ error: 'Password is required' });
  }
  
  const now = new Date().toISOString();
  
  db.run(
    'UPDATE employees SET password = ?, updatedAt = ? WHERE id = ?',
    [password, now, id],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      if (this.changes === 0) {
        res.status(404).json({ error: 'Employee not found' });
        return;
      }
      res.json({ message: 'Password updated successfully' });
    }
  );
});

// Get all mileage entries
app.get('/api/mileage-entries', (req, res) => {
  const { employeeId, month, year } = req.query;
  
  let query = `
    SELECT me.*, e.name as employeeName, e.costCenters 
    FROM mileage_entries me 
    LEFT JOIN employees e ON me.employeeId = e.id 
  `;
  const params = [];
  const conditions = [];

  if (employeeId) {
    conditions.push('me.employeeId = ?');
    params.push(employeeId);
  }

  if (month && year) {
    conditions.push('strftime("%m", me.date) = ? AND strftime("%Y", me.date) = ?');
    params.push(month.toString().padStart(2, '0'), year.toString());
  }

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }

  query += ' ORDER BY me.date DESC';

  db.all(query, params, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

// Create new mileage entry
app.post('/api/mileage-entries', (req, res) => {
  console.log('📝 POST /api/mileage-entries - Request body:', req.body);
  
  const { id, employeeId, oxfordHouseId, date, odometerReading, miles, startLocation, endLocation, purpose, notes, hoursWorked, isGpsTracked, costCenter } = req.body;
  const entryId = id || (Date.now().toString(36) + Math.random().toString(36).substr(2));
  const now = new Date().toISOString();

  // Use miles as odometerReading if odometerReading is not provided
  const finalOdometerReading = odometerReading || miles || 0;

  db.run(
    'INSERT OR REPLACE INTO mileage_entries (id, employeeId, oxfordHouseId, date, odometerReading, startLocation, endLocation, purpose, miles, notes, hoursWorked, isGpsTracked, costCenter, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE((SELECT createdAt FROM mileage_entries WHERE id = ?), ?), ?)',
    [entryId, employeeId, oxfordHouseId || '', date, finalOdometerReading, startLocation, endLocation, purpose, miles, notes || '', hoursWorked || 0, isGpsTracked ? 1 : 0, costCenter || '', entryId, now, now],
    function(err) {
      if (err) {
        console.error('Database error:', err.message);
        res.status(500).json({ error: err.message });
        return;
      }
      console.log('✅ Mileage entry created successfully:', entryId);
      res.json({ id: entryId, message: 'Mileage entry created successfully' });
    }
  );
});

// Update mileage entry
app.put('/api/mileage-entries/:id', (req, res) => {
  const { id } = req.params;
  const { employeeId, oxfordHouseId, date, odometerReading, miles, startLocation, endLocation, purpose, notes, hoursWorked, isGpsTracked, costCenter } = req.body;
  const now = new Date().toISOString();
  
  // Use miles as odometerReading if odometerReading is not provided
  const finalOdometerReading = odometerReading || miles || 0;

  db.run(
    'UPDATE mileage_entries SET employeeId = ?, oxfordHouseId = ?, date = ?, odometerReading = ?, startLocation = ?, endLocation = ?, purpose = ?, miles = ?, notes = ?, hoursWorked = ?, isGpsTracked = ?, costCenter = ?, updatedAt = ? WHERE id = ?',
    [employeeId, oxfordHouseId || '', date, finalOdometerReading, startLocation, endLocation, purpose, miles, notes || '', hoursWorked || 0, isGpsTracked ? 1 : 0, costCenter || '', now, id],
    function(err) {
      if (err) {
        console.error('Database error:', err.message);
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ message: 'Mileage entry updated successfully' });
    }
  );
});

// Delete mileage entry
app.delete('/api/mileage-entries/:id', (req, res) => {
  const { id } = req.params;
  db.run('DELETE FROM mileage_entries WHERE id = ?', [id], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ message: 'Mileage entry deleted successfully' });
  });
});

// Get all receipts
app.get('/api/receipts', (req, res) => {
  const { employeeId, month, year } = req.query;
  let query = `
    SELECT r.*, e.name as employeeName, e.costCenters 
    FROM receipts r 
    LEFT JOIN employees e ON r.employeeId = e.id 
  `;
  const params = [];
  const conditions = [];

  if (employeeId) {
    conditions.push('r.employeeId = ?');
    params.push(employeeId);
  }

  if (month && year) {
    conditions.push('strftime("%m", r.date) = ? AND strftime("%Y", r.date) = ?');
    params.push(month.toString().padStart(2, '0'), year.toString());
  }

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }

  query += ' ORDER BY r.date DESC';

  db.all(query, params, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

// Create new receipt
app.post('/api/receipts', (req, res) => {
  const { id, employeeId, date, amount, vendor, description, category, imageUri } = req.body;
  const receiptId = id || (Date.now().toString(36) + Math.random().toString(36).substr(2));
  const now = new Date().toISOString();

  console.log('📝 Creating/updating receipt:', {
    receiptId,
    employeeId,
    category,
    vendor,
    amount,
    amountType: typeof amount,
    date
  });

  db.run(
    'INSERT OR REPLACE INTO receipts (id, employeeId, date, amount, vendor, description, category, imageUri, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, COALESCE((SELECT createdAt FROM receipts WHERE id = ?), ?), ?)',
    [receiptId, employeeId, date, amount, vendor || '', description || '', category || '', imageUri || '', receiptId, now, now],
    function(err) {
      if (err) {
        console.error('Database error:', err.message);
        res.status(500).json({ error: err.message });
        return;
      }
      console.log(`✅ Receipt ${receiptId} saved with amount: ${amount}`);
      res.json({ id: receiptId, message: 'Receipt created successfully' });
    }
  );
});

// Update receipt
app.put('/api/receipts/:id', (req, res) => {
  const { id } = req.params;
  const { employeeId, date, amount, vendor, description, category, imageUri } = req.body;
  const now = new Date().toISOString();

  db.run(
    'UPDATE receipts SET employeeId = ?, date = ?, amount = ?, vendor = ?, description = ?, category = ?, imageUri = ?, updatedAt = ? WHERE id = ?',
    [employeeId, date, amount, vendor || '', description || '', category || '', imageUri || '', now, id],
    function(err) {
      if (err) {
        console.error('Database error:', err.message);
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ message: 'Receipt updated successfully' });
    }
  );
});

// Delete receipt
app.delete('/api/receipts/:id', (req, res) => {
  const { id } = req.params;
  db.run('DELETE FROM receipts WHERE id = ?', [id], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ message: 'Receipt deleted successfully' });
  });
});

// Get all time tracking entries
app.get('/api/time-tracking', (req, res) => {
  const { employeeId, month, year } = req.query;
  let query = `
    SELECT tt.*, e.name as employeeName, e.costCenters 
    FROM time_tracking tt 
    LEFT JOIN employees e ON tt.employeeId = e.id 
  `;
  const params = [];
  const conditions = [];

  if (employeeId) {
    conditions.push('tt.employeeId = ?');
    params.push(employeeId);
  }

  if (month && year) {
    conditions.push('strftime("%m", tt.date) = ? AND strftime("%Y", tt.date) = ?');
    params.push(month.toString().padStart(2, '0'), year.toString());
  }

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }

  query += ' ORDER BY tt.date DESC';

  db.all(query, params, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

// Create new time tracking entry
app.post('/api/time-tracking', (req, res) => {
  const { id, employeeId, date, category, hours, description, costCenter } = req.body;
  
  // ALWAYS create a deterministic ID based on the unique combination to ensure proper replacement
  // Ignore any ID sent from frontend to prevent duplicates
  const uniqueKey = `${employeeId}-${date}-${category || ''}-${costCenter || ''}`;
  const trackingId = Buffer.from(uniqueKey).toString('base64').replace(/[^a-zA-Z0-9]/g, '').substring(0, 20);
  const now = new Date().toISOString();

  db.run(
    'INSERT OR REPLACE INTO time_tracking (id, employeeId, date, category, hours, description, costCenter, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, COALESCE((SELECT createdAt FROM time_tracking WHERE id = ?), ?), ?)',
    [trackingId, employeeId, date, category || '', hours, description || '', costCenter || '', trackingId, now, now],
    function(err) {
      if (err) {
        console.error('Database error:', err.message);
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ id: trackingId, message: 'Time tracking entry created successfully' });
    }
  );
});

// Update time tracking entry
app.put('/api/time-tracking/:id', (req, res) => {
  const { id } = req.params;
  const { employeeId, date, category, hours, description, costCenter } = req.body;
  const now = new Date().toISOString();

  db.run(
    'UPDATE time_tracking SET employeeId = ?, date = ?, category = ?, hours = ?, description = ?, costCenter = ?, updatedAt = ? WHERE id = ?',
    [employeeId, date, category || '', hours, description || '', costCenter || '', now, id],
    function(err) {
      if (err) {
        console.error('Database error:', err.message);
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ message: 'Time tracking entry updated successfully' });
    }
  );
});

// Delete time tracking entry
app.delete('/api/time-tracking/:id', (req, res) => {
  const { id } = req.params;
  db.run('DELETE FROM time_tracking WHERE id = ?', [id], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ message: 'Time tracking entry deleted successfully' });
  });
});

// Daily Descriptions API Routes

// Get daily descriptions
app.get('/api/daily-descriptions', (req, res) => {
  const { employeeId, month, year } = req.query;
  let query = `
    SELECT dd.*, e.name as employeeName
    FROM daily_descriptions dd
    LEFT JOIN employees e ON dd.employeeId = e.id
  `;
  const params = [];
  const conditions = [];

  if (employeeId) {
    conditions.push('dd.employeeId = ?');
    params.push(employeeId);
  }

  if (month && year) {
    conditions.push('strftime("%m", dd.date) = ? AND strftime("%Y", dd.date) = ?');
    params.push(month.toString().padStart(2, '0'), year.toString());
  }

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }

  query += ' ORDER BY dd.date DESC';

  db.all(query, params, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

// Create or update daily description
app.post('/api/daily-descriptions', (req, res) => {
  const { id, employeeId, date, description, costCenter } = req.body;
  const descriptionId = id || (Date.now().toString(36) + Math.random().toString(36).substr(2));
  const now = new Date().toISOString();

  // Check if a description already exists for this date
  db.get(
    'SELECT id FROM daily_descriptions WHERE employeeId = ? AND date = ?',
    [employeeId, date],
    (err, row) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }

      if (row) {
        // Update existing description
        db.run(
          'UPDATE daily_descriptions SET description = ?, costCenter = ?, updatedAt = ? WHERE id = ?',
          [description, costCenter || '', now, row.id],
          function(updateErr) {
            if (updateErr) {
              res.status(500).json({ error: updateErr.message });
              return;
            }
            res.json({ id: row.id, message: 'Daily description updated successfully' });
          }
        );
      } else {
        // Create new description
        db.run(
          'INSERT INTO daily_descriptions (id, employeeId, date, description, costCenter, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [descriptionId, employeeId, date, description, costCenter || '', now, now],
          function(insertErr) {
            if (insertErr) {
              res.status(500).json({ error: insertErr.message });
              return;
            }
            res.json({ id: descriptionId, message: 'Daily description created successfully' });
          }
        );
      }
    }
  );
});

// Delete daily description
app.delete('/api/daily-descriptions/:id', (req, res) => {
  const { id } = req.params;
  db.run('DELETE FROM daily_descriptions WHERE id = ?', [id], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ message: 'Daily description deleted successfully' });
  });
});

// Per Diem Rules API Routes

// Get all per diem rules
app.get('/api/per-diem-rules', (req, res) => {
  db.all('SELECT * FROM per_diem_rules ORDER BY costCenter', (err, rows) => {
    if (err) {
      console.error('Error fetching per diem rules:', err);
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

// Get per diem rule by cost center
app.get('/api/per-diem-rules/:costCenter', (req, res) => {
  const { costCenter } = req.params;
  db.get('SELECT * FROM per_diem_rules WHERE costCenter = ?', [costCenter], (err, row) => {
    if (err) {
      console.error('Error fetching per diem rule:', err);
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(row || null);
  });
});

// Create or update per diem rule
app.post('/api/per-diem-rules', (req, res) => {
  const { id, costCenter, maxAmount, minHours, minMiles, minDistanceFromBase, description, useActualAmount } = req.body;
  const ruleId = id || (Date.now().toString(36) + Math.random().toString(36).substr(2));
  const now = new Date().toISOString();

  console.log('📝 Creating/updating per diem rule:', {
    ruleId,
    costCenter,
    maxAmount,
    minHours,
    minMiles,
    minDistanceFromBase,
    useActualAmount
  });

  db.run(
    'INSERT OR REPLACE INTO per_diem_rules (id, costCenter, maxAmount, minHours, minMiles, minDistanceFromBase, description, useActualAmount, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, COALESCE((SELECT createdAt FROM per_diem_rules WHERE id = ?), ?), ?)',
    [ruleId, costCenter, maxAmount, minHours || 0, minMiles || 0, minDistanceFromBase || 0, description || '', useActualAmount || 0, ruleId, now, now],
    function(err) {
      if (err) {
        console.error('Database error:', err.message);
        res.status(500).json({ error: err.message });
        return;
      }
      console.log(`✅ Per diem rule ${ruleId} saved for ${costCenter}`);
      res.json({ id: ruleId, message: 'Per diem rule saved successfully' });
    }
  );
});

// Update per diem rule
app.put('/api/per-diem-rules/:id', (req, res) => {
  const { id } = req.params;
  const { costCenter, maxAmount, minHours, minMiles, minDistanceFromBase, description, useActualAmount } = req.body;
  const now = new Date().toISOString();

  db.run(
    'UPDATE per_diem_rules SET costCenter = ?, maxAmount = ?, minHours = ?, minMiles = ?, minDistanceFromBase = ?, description = ?, useActualAmount = ?, updatedAt = ? WHERE id = ?',
    [costCenter, maxAmount, minHours || 0, minMiles || 0, minDistanceFromBase || 0, description || '', useActualAmount || 0, now, id],
    function(err) {
      if (err) {
        console.error('Database error:', err.message);
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ message: 'Per diem rule updated successfully' });
    }
  );
});

// Delete per diem rule
app.delete('/api/per-diem-rules/:id', (req, res) => {
  const { id } = req.params;
  db.run('DELETE FROM per_diem_rules WHERE id = ?', [id], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ message: 'Per diem rule deleted successfully' });
  });
});

// Saved Addresses API Routes

// Get saved addresses
app.get('/api/saved-addresses', (req, res) => {
  const { employeeId } = req.query;
  
  if (!employeeId) {
    res.status(400).json({ error: 'employeeId is required' });
    return;
  }

  // For now, return empty array since we don't have a saved_addresses table yet
  // This can be implemented later when the table is created
  res.json([]);
});

// Oxford Houses API Routes

// Cache for Oxford Houses data
let oxfordHousesCache = null;
let oxfordHousesCacheTime = null;
const OXFORD_HOUSES_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

// Fetch Oxford Houses from live website
async function fetchOxfordHouses() {
  try {
    console.log('🏠 Fetching Oxford Houses from oxfordvacancies.com...');
    
    const response = await fetch('https://oxfordvacancies.com/oxfordReport.aspx?report=house-name-address-all-houses');
    const html = await response.text();
    
    // Parse the HTML table
    const houses = [];
    const tableRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    
    let match;
    let isFirstRow = true;
    
    while ((match = tableRegex.exec(html)) !== null) {
      if (isFirstRow) {
        isFirstRow = false;
        continue; // Skip header row
      }
      
      const cells = [];
      const rowHtml = match[1];
      let cellMatch;
      
      while ((cellMatch = cellRegex.exec(rowHtml)) !== null) {
        // Remove HTML tags and decode entities
        const cellText = cellMatch[1]
          .replace(/<[^>]*>/g, '')
          .replace(/&nbsp;/g, ' ')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .trim();
        cells.push(cellText);
      }
      
      if (cells.length >= 5) {
        houses.push({
          name: `OH ${cells[0]}`, // Add "OH" prefix
          address: cells[1],
          city: cells[2],
          state: cells[3],
          zip: cells[4],
          fullAddress: `${cells[1]}, ${cells[2]}, ${cells[3]} ${cells[4]}`
        });
      }
    }
    
    console.log(`✅ Fetched ${houses.length} Oxford Houses`);
    return houses;
  } catch (error) {
    console.error('❌ Error fetching Oxford Houses:', error);
    return [];
  }
}

// Get all Oxford Houses (with caching)
app.get('/api/oxford-houses', async (req, res) => {
  try {
    // Check if cache is valid
    if (oxfordHousesCache && oxfordHousesCacheTime && (Date.now() - oxfordHousesCacheTime < OXFORD_HOUSES_CACHE_TTL)) {
      console.log('📦 Serving Oxford Houses from cache');
      res.json(oxfordHousesCache);
      return;
    }
    
    // Fetch fresh data
    const houses = await fetchOxfordHouses();
    
    // Update cache
    oxfordHousesCache = houses;
    oxfordHousesCacheTime = Date.now();
    
    res.json(houses);
  } catch (error) {
    console.error('❌ Error in oxford-houses endpoint:', error);
    res.status(500).json({ error: 'Failed to fetch Oxford Houses' });
  }
});

// Force refresh Oxford Houses cache
app.post('/api/oxford-houses/refresh', async (req, res) => {
  try {
    console.log('🔄 Force refreshing Oxford Houses data...');
    const houses = await fetchOxfordHouses();
    
    // Update cache
    oxfordHousesCache = houses;
    oxfordHousesCacheTime = Date.now();
    
    res.json({ message: 'Oxford Houses refreshed successfully', count: houses.length });
  } catch (error) {
    console.error('❌ Error refreshing Oxford Houses:', error);
    res.status(500).json({ error: 'Failed to refresh Oxford Houses' });
  }
});

// Cost Center Management API Routes - Removed duplicate endpoints (using constant-based endpoints above)

// Per Diem Rules API Routes

// EES Rules API Routes

// Get all EES rules
app.get('/api/ees-rules', (req, res) => {
  db.all('SELECT * FROM ees_rules ORDER BY costCenter', (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

// Create/Update EES rule
app.post('/api/ees-rules', (req, res) => {
  const { costCenter, maxAmount, description } = req.body;
  const id = Date.now().toString(36) + Math.random().toString(36).substr(2);
  const now = new Date().toISOString();

  // Check if rule already exists for this cost center
  db.get('SELECT id FROM ees_rules WHERE costCenter = ?', [costCenter], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }

    if (row) {
      // Update existing rule
      db.run(
        'UPDATE ees_rules SET maxAmount = ?, description = ?, updatedAt = ? WHERE costCenter = ?',
        [maxAmount, description, now, costCenter],
        function(err) {
          if (err) {
            res.status(500).json({ error: err.message });
            return;
          }
          res.json({ message: 'EES rule updated successfully' });
        }
      );
    } else {
      // Create new rule
      db.run(
        'INSERT INTO ees_rules (id, costCenter, maxAmount, description, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)',
        [id, costCenter, maxAmount, description, now, now],
        function(err) {
          if (err) {
            res.status(500).json({ error: err.message });
            return;
          }
          res.json({ id, message: 'EES rule created successfully' });
        }
      );
    }
  });
});

// Delete EES rule
app.delete('/api/ees-rules/:costCenter', (req, res) => {
  const { costCenter } = req.params;
  db.run('DELETE FROM ees_rules WHERE costCenter = ?', [costCenter], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ message: 'EES rule deleted successfully' });
  });
});

// Get all per diem monthly rules
app.get('/api/per-diem-monthly-rules', (req, res) => {
  db.all('SELECT * FROM per_diem_monthly_rules ORDER BY costCenter', (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

// Create/Update per diem monthly rule
app.post('/api/per-diem-monthly-rules', (req, res) => {
  const { costCenter, maxAmount, description } = req.body;
  const id = Date.now().toString(36) + Math.random().toString(36).substr(2);
  const now = new Date().toISOString();

  // Check if rule already exists for this cost center
  db.get('SELECT id FROM per_diem_monthly_rules WHERE costCenter = ?', [costCenter], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }

    if (row) {
      // Update existing rule
      db.run(
        'UPDATE per_diem_monthly_rules SET maxAmount = ?, description = ?, updatedAt = ? WHERE costCenter = ?',
        [maxAmount, description, now, costCenter],
        function(err) {
          if (err) {
            res.status(500).json({ error: err.message });
            return;
          }
          res.json({ message: 'Per diem monthly rule updated successfully' });
        }
      );
    } else {
      // Create new rule
      db.run(
        'INSERT INTO per_diem_monthly_rules (id, costCenter, maxAmount, description, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)',
        [id, costCenter, maxAmount, description, now, now],
        function(err) {
          if (err) {
            res.status(500).json({ error: err.message });
            return;
          }
          res.json({ id, message: 'Per diem monthly rule created successfully' });
        }
      );
    }
  });
});

// Delete per diem monthly rule
app.delete('/api/per-diem-monthly-rules/:costCenter', (req, res) => {
  const { costCenter } = req.params;
  db.run('DELETE FROM per_diem_monthly_rules WHERE costCenter = ?', [costCenter], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ message: 'Per diem monthly rule deleted successfully' });
  });
});

// Expense Reports API Routes

// Save expense report
app.post('/api/expense-reports', (req, res) => {
  const { employeeId, month, year, reportData, status } = req.body;
  const id = Date.now().toString(36) + Math.random().toString(36).substr(2);
  const now = new Date().toISOString();

  // Check if report already exists for this employee/month/year
  db.get('SELECT id FROM expense_reports WHERE employeeId = ? AND month = ? AND year = ?', 
    [employeeId, month, year], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }

    if (row) {
      // Update existing report
      const updateData = {
        reportData: JSON.stringify(reportData),
        status: status || 'draft',
        updatedAt: now
      };

      if (status === 'submitted') {
        updateData.submittedAt = now;
      } else if (status === 'approved') {
        updateData.approvedAt = now;
        updateData.approvedBy = req.body.approvedBy || 'system';
      }

      const updateFields = Object.keys(updateData).map(key => `${key} = ?`).join(', ');
      const updateValues = Object.values(updateData);

      db.run(
        `UPDATE expense_reports SET ${updateFields} WHERE employeeId = ? AND month = ? AND year = ?`,
        [...updateValues, employeeId, month, year],
        function(err) {
          if (err) {
            res.status(500).json({ error: err.message });
            return;
          }
          res.json({ id: row.id, message: 'Expense report updated successfully' });
        }
      );
    } else {
      // Create new report
      const insertData = {
        id,
        employeeId,
        month,
        year,
        reportData: JSON.stringify(reportData),
        status: status || 'draft',
        createdAt: now,
        updatedAt: now
      };

      if (status === 'submitted') {
        insertData.submittedAt = now;
      } else if (status === 'approved') {
        insertData.approvedAt = now;
        insertData.approvedBy = req.body.approvedBy || 'system';
      }

      const insertFields = Object.keys(insertData).join(', ');
      const insertValues = Object.values(insertData);
      const placeholders = insertValues.map(() => '?').join(', ');

      db.run(
        `INSERT INTO expense_reports (${insertFields}) VALUES (${placeholders})`,
        insertValues,
        function(err) {
          if (err) {
            res.status(500).json({ error: err.message });
            return;
          }
          res.json({ id, message: 'Expense report created successfully' });
        }
      );
    }
  });
});

// Get expense report by employee, month, and year
app.get('/api/expense-reports/:employeeId/:month/:year', (req, res) => {
  const { employeeId, month, year } = req.params;
  
  db.get(
    'SELECT * FROM expense_reports WHERE employeeId = ? AND month = ? AND year = ?',
    [employeeId, month, year],
    (err, row) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      if (!row) {
        res.status(404).json({ error: 'Expense report not found' });
        return;
      }
      
      // Parse the report data JSON
      try {
        row.reportData = JSON.parse(row.reportData);
        res.json(row);
      } catch (parseErr) {
        res.status(500).json({ error: 'Invalid report data format' });
      }
    }
  );
});

// Comprehensive save endpoint that syncs web portal changes back to source tables
app.post('/api/expense-reports/sync-to-source', async (req, res) => {
  const { employeeId, month, year, reportData } = req.body;
  
  console.log('🔄 Syncing report data back to source tables for employee:', employeeId);
  
  try {
    // 1. Update employee profile (signature, personal info)
    if (reportData.employeeSignature || reportData.supervisorSignature) {
      await new Promise((resolve, reject) => {
        const updates = [];
        const values = [];
        
        if (reportData.employeeSignature) {
          updates.push('signature = ?');
          values.push(reportData.employeeSignature);
        }
        
        values.push(employeeId);
        
        const sql = `UPDATE employees SET ${updates.join(', ')}, updatedAt = datetime('now') WHERE id = ?`;
        
        db.run(sql, values, (err) => {
          if (err) reject(err);
          else {
            console.log('✅ Employee signature updated');
            resolve();
          }
        });
      });
    }
    
    // 2a. Sync daily descriptions from the dedicated dailyDescriptions array (new tab-based approach)
    if (reportData.dailyDescriptions && reportData.dailyDescriptions.length > 0) {
      for (const desc of reportData.dailyDescriptions) {
        const descDate = new Date(desc.date);
        const dateStr = descDate.toISOString().split('T')[0];
        const hasDescription = desc.description && desc.description.trim();
        
        await new Promise((resolve, reject) => {
          // Check if description exists for this date
          db.get(
            'SELECT id FROM daily_descriptions WHERE employeeId = ? AND date = ?',
            [employeeId, dateStr],
            (err, row) => {
              if (err) {
                reject(err);
                return;
              }
              
              const now = new Date().toISOString();
              
              if (row) {
                if (hasDescription) {
                  // Update existing description
                  db.run(
                    'UPDATE daily_descriptions SET description = ?, costCenter = ?, updatedAt = ? WHERE id = ?',
                    [desc.description, desc.costCenter || '', now, row.id],
                    (updateErr) => {
                      if (updateErr) reject(updateErr);
                      else {
                        console.log(`✅ Updated daily description for date ${dateStr}`);
                        resolve();
                      }
                    }
                  );
                } else {
                  // Delete existing description if it's empty
                  db.run(
                    'DELETE FROM daily_descriptions WHERE id = ?',
                    [row.id],
                    (deleteErr) => {
                      if (deleteErr) reject(deleteErr);
                      else {
                        console.log(`✅ Deleted empty daily description for date ${dateStr}`);
                        resolve();
                      }
                    }
                  );
                }
              } else if (hasDescription) {
                // Create new description only if it has content
                const id = desc.id || (Date.now().toString(36) + Math.random().toString(36).substr(2));
                db.run(
                  'INSERT INTO daily_descriptions (id, employeeId, date, description, costCenter, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
                  [id, employeeId, dateStr, desc.description, desc.costCenter || '', now, now],
                  (insertErr) => {
                    if (insertErr) reject(insertErr);
                    else {
                      console.log(`✅ Created daily description for date ${dateStr}`);
                      resolve();
                    }
                  }
                );
              } else {
                // No description to save, resolve immediately
                resolve();
              }
            }
          );
        });
      }
    }
    
    // 2b. Sync time tracking and mileage entries from dailyEntries
    if (reportData.dailyEntries && reportData.dailyEntries.length > 0) {
      for (const entry of reportData.dailyEntries) {
        // Parse the date to match the format in the database
        const entryDate = new Date(entry.date);
        const dateStr = entryDate.toISOString().split('T')[0];
        
        // Simplified: No parsing needed, daily descriptions are handled above
        // Only sync mileage and time tracking data here
        
        // No complex parsing needed - mileage entries are handled by the mobile app
        
        // Skip time tracking sync entirely - individual timesheet entries are now handled directly by the frontend
        // This prevents the sync-to-source from interfering with individual category and cost center entries
        if (entry.hoursWorked > 0) {
          console.log(`⏭️ Skipping time tracking sync for date ${dateStr} - individual entries handled by frontend`);
        }
      }
    }
    
    // 3. Sync receipts
    if (reportData.receipts && reportData.receipts.length > 0) {
      for (const receipt of reportData.receipts) {
        if (receipt.id) {
          // Update existing receipt
          await new Promise((resolve, reject) => {
            db.run(
              `UPDATE receipts 
               SET amount = ?, vendor = ?, category = ?, description = ?, updatedAt = datetime('now')
               WHERE id = ?`,
              [receipt.amount, receipt.vendor, receipt.category, receipt.description || '', receipt.id],
              (err) => {
                if (err) reject(err);
                else {
                  console.log(`✅ Updated receipt ${receipt.id}`);
                  resolve();
                }
              }
            );
          });
        }
      }
    }
    
    // 4. Also save to expense_reports table for persistence
    await new Promise((resolve, reject) => {
      const now = new Date().toISOString();
      
      db.get('SELECT id FROM expense_reports WHERE employeeId = ? AND month = ? AND year = ?', 
        [employeeId, month, year], (err, row) => {
        if (err) {
          reject(err);
          return;
        }

        if (row) {
          // Update existing report
          db.run(
            `UPDATE expense_reports SET reportData = ?, updatedAt = ? WHERE employeeId = ? AND month = ? AND year = ?`,
            [JSON.stringify(reportData), now, employeeId, month, year],
            (updateErr) => {
              if (updateErr) reject(updateErr);
              else {
                console.log('✅ Updated expense report in expense_reports table');
                resolve();
              }
            }
          );
        } else {
          // Create new report
          const id = Date.now().toString(36) + Math.random().toString(36).substr(2);
          db.run(
            `INSERT INTO expense_reports (id, employeeId, month, year, reportData, status, createdAt, updatedAt) 
             VALUES (?, ?, ?, ?, ?, 'draft', ?, ?)`,
            [id, employeeId, month, year, JSON.stringify(reportData), now, now],
            (insertErr) => {
              if (insertErr) reject(insertErr);
              else {
                console.log('✅ Created new expense report in expense_reports table');
                resolve();
              }
            }
          );
        }
      });
    });
    
    // Broadcast data change notification via WebSocket
    broadcastToClients({
      type: 'data_updated',
      entity: 'expense_report',
      employeeId: employeeId,
      month: month,
      year: year,
      timestamp: new Date().toISOString()
    });
    
    res.json({ 
      success: true, 
      message: 'Report data synced successfully to source tables' 
    });
    
  } catch (error) {
    console.error('❌ Error syncing report data:', error);
    res.status(500).json({ 
      error: error.message,
      message: 'Failed to sync report data to source tables' 
    });
  }
});

// Get all expense reports for an employee
app.get('/api/expense-reports/:employeeId', (req, res) => {
  const { employeeId } = req.params;
  
  db.all(
    'SELECT * FROM expense_reports WHERE employeeId = ? ORDER BY year DESC, month DESC',
    [employeeId],
    (err, rows) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      
      // Parse the report data JSON for each row
      rows.forEach(row => {
        try {
          row.reportData = JSON.parse(row.reportData);
        } catch (parseErr) {
          console.error('Error parsing report data for row:', row.id);
          row.reportData = {};
        }
      });
      
      res.json(rows);
    }
  );
});

// Get all expense reports (for admin/supervisor view)
app.get('/api/expense-reports', (req, res) => {
  const { status, month, year } = req.query;
  
  let query = `
    SELECT er.*, e.name as employeeName, e.email as employeeEmail
    FROM expense_reports er
    LEFT JOIN employees e ON er.employeeId = e.id
  `;
  const params = [];
  const conditions = [];

  if (status) {
    conditions.push('er.status = ?');
    params.push(status);
  }

  if (month && year) {
    conditions.push('er.month = ? AND er.year = ?');
    params.push(parseInt(month), parseInt(year));
  }

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }

  query += ' ORDER BY er.year DESC, er.month DESC, e.name';

  db.all(query, params, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    // Parse the report data JSON for each row
    rows.forEach(row => {
      try {
        row.reportData = JSON.parse(row.reportData);
      } catch (parseErr) {
        console.error('Error parsing report data for row:', row.id);
        row.reportData = {};
      }
    });
    
    res.json(rows);
  });
});

// Update expense report status (for approval workflow)
app.put('/api/expense-reports/:id/status', (req, res) => {
  const { id } = req.params;
  const { status, approvedBy } = req.body;
  const now = new Date().toISOString();

  const updateData = {
    status,
    updatedAt: now
  };

  if (status === 'submitted') {
    updateData.submittedAt = now;
  } else if (status === 'approved') {
    updateData.approvedAt = now;
    updateData.approvedBy = approvedBy || 'system';
  }

  const updateFields = Object.keys(updateData).map(key => `${key} = ?`).join(', ');
  const updateValues = Object.values(updateData);

  db.run(
    `UPDATE expense_reports SET ${updateFields} WHERE id = ?`,
    [...updateValues, id],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ message: 'Expense report status updated successfully' });
    }
  );
});

// Delete expense report
app.delete('/api/expense-reports/:id', (req, res) => {
  const { id } = req.params;
  
  db.run('DELETE FROM expense_reports WHERE id = ?', [id], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ message: 'Expense report deleted successfully' });
  });
});

// Get database statistics
app.get('/api/stats', (req, res) => {
  const queries = {
    totalEmployees: 'SELECT COUNT(*) as count FROM employees',
    totalMileageEntries: 'SELECT COUNT(*) as count FROM mileage_entries',
    totalReceipts: 'SELECT COUNT(*) as count FROM receipts',
    totalMiles: 'SELECT SUM(miles) as total FROM mileage_entries',
    totalReceiptAmount: 'SELECT SUM(amount) as total FROM receipts',
    totalExpenseReports: 'SELECT COUNT(*) as count FROM expense_reports',
    draftReports: 'SELECT COUNT(*) as count FROM expense_reports WHERE status = "draft"',
    submittedReports: 'SELECT COUNT(*) as count FROM expense_reports WHERE status = "submitted"',
    approvedReports: 'SELECT COUNT(*) as count FROM expense_reports WHERE status = "approved"'
  };

  const stats = {};
  let completed = 0;

  Object.keys(queries).forEach(key => {
    db.get(queries[key], (err, row) => {
      if (!err && row) {
        stats[key] = row.count !== undefined ? row.count : row.total || 0;
      } else {
        stats[key] = 0;
      }
      
      completed++;
      if (completed === Object.keys(queries).length) {
        res.json(stats);
      }
    });
  });
});

// ===== MONTHLY REPORTS API ENDPOINTS =====

// Get all monthly reports
app.get('/api/monthly-reports', (req, res) => {
  const { employeeId, status } = req.query;
  
  let query = 'SELECT * FROM monthly_reports';
  const params = [];
  
  if (employeeId || status) {
    query += ' WHERE';
    const conditions = [];
    if (employeeId) {
      conditions.push(' employeeId = ?');
      params.push(employeeId);
    }
    if (status) {
      conditions.push(' status = ?');
      params.push(status);
    }
    query += conditions.join(' AND');
  }
  
  query += ' ORDER BY year DESC, month DESC';
  
  db.all(query, params, (err, rows) => {
    if (err) {
      console.error('❌ Error fetching monthly reports:', err);
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

// Get monthly report by ID
app.get('/api/monthly-reports/:id', (req, res) => {
  const { id } = req.params;
  
  db.get('SELECT * FROM monthly_reports WHERE id = ?', [id], (err, row) => {
    if (err) {
      console.error('❌ Error fetching monthly report:', err);
      res.status(500).json({ error: err.message });
      return;
    }
    if (!row) {
      res.status(404).json({ error: 'Monthly report not found' });
      return;
    }
    res.json(row);
  });
});

// Get monthly report for employee/month/year
app.get('/api/monthly-reports/employee/:employeeId/:year/:month', (req, res) => {
  const { employeeId, year, month } = req.params;
  
  db.get(
    'SELECT * FROM monthly_reports WHERE employeeId = ? AND year = ? AND month = ?',
    [employeeId, parseInt(year), parseInt(month)],
    (err, row) => {
      if (err) {
        console.error('❌ Error fetching monthly report:', err);
        res.status(500).json({ error: err.message });
        return;
      }
      res.json(row || null);
    }
  );
});

// Create or update monthly report
app.post('/api/monthly-reports', (req, res) => {
  const { id, employeeId, month, year, totalMiles, totalExpenses, status } = req.body;
  const reportId = id || `report-${Date.now().toString(36)}-${Math.random().toString(36).substr(2)}`;
  const now = new Date().toISOString();

  console.log('📝 Creating/updating monthly report:', {
    reportId,
    employeeId,
    month,
    year,
    totalMiles,
    totalExpenses,
    status: status || 'draft'
  });

  db.run(
    `INSERT OR REPLACE INTO monthly_reports (
      id, employeeId, month, year, totalMiles, totalExpenses, status,
      createdAt, updatedAt
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?,
      COALESCE((SELECT createdAt FROM monthly_reports WHERE id = ?), ?),
      ?
    )`,
    [
      reportId, employeeId, month, year,
      totalMiles || 0,
      totalExpenses || 0,
      status || 'draft',
      reportId, now, now
    ],
    function(err) {
      if (err) {
        console.error('❌ Database error:', err.message);
        res.status(500).json({ error: err.message });
        return;
      }
      console.log(`✅ Monthly report ${reportId} saved`);
      res.json({ id: reportId, message: 'Monthly report saved successfully' });
    }
  );
});

// Submit monthly report for approval
app.post('/api/monthly-reports/:id/submit', (req, res) => {
  const { id } = req.params;
  const { submittedBy } = req.body;
  const now = new Date().toISOString();

  console.log(`📤 Submitting monthly report ${id} for approval by ${submittedBy}`);

  db.run(
    `UPDATE monthly_reports SET 
      status = 'submitted',
      submittedAt = ?,
      submittedBy = ?,
      updatedAt = ?
    WHERE id = ?`,
    [now, submittedBy, now, id],
    function(err) {
      if (err) {
        console.error('❌ Database error:', err.message);
        res.status(500).json({ error: err.message });
        return;
      }
      if (this.changes === 0) {
        res.status(404).json({ error: 'Monthly report not found' });
        return;
      }
      console.log(`✅ Monthly report ${id} submitted for approval`);
      
      // Broadcast update to all connected clients
      broadcastDataChange('monthly_reports', 'update', { id, status: 'submitted' });
      
      res.json({ message: 'Monthly report submitted for approval successfully' });
    }
  );
});

// Approve monthly report
app.post('/api/monthly-reports/:id/approve', (req, res) => {
  const { id } = req.params;
  const { approvedBy, comments } = req.body;
  const now = new Date().toISOString();

  console.log(`✅ Approving monthly report ${id} by ${approvedBy}`);

  db.run(
    `UPDATE monthly_reports SET 
      status = 'approved',
      reviewedAt = ?,
      reviewedBy = ?,
      approvedAt = ?,
      approvedBy = ?,
      comments = ?,
      updatedAt = ?
    WHERE id = ?`,
    [now, approvedBy, now, approvedBy, comments || '', now, id],
    function(err) {
      if (err) {
        console.error('❌ Database error:', err.message);
        res.status(500).json({ error: err.message });
        return;
      }
      if (this.changes === 0) {
        res.status(404).json({ error: 'Monthly report not found' });
        return;
      }
      console.log(`✅ Monthly report ${id} approved`);
      
      // Broadcast update to all connected clients
      broadcastDataChange('monthly_reports', 'update', { id, status: 'approved' });
      
      res.json({ message: 'Monthly report approved successfully' });
    }
  );
});

// Reject monthly report
app.post('/api/monthly-reports/:id/reject', (req, res) => {
  const { id } = req.params;
  const { rejectedBy, rejectionReason, comments } = req.body;
  const now = new Date().toISOString();

  console.log(`❌ Rejecting monthly report ${id} by ${rejectedBy}`);

  db.run(
    `UPDATE monthly_reports SET 
      status = 'rejected',
      reviewedAt = ?,
      reviewedBy = ?,
      rejectedAt = ?,
      rejectedBy = ?,
      rejectionReason = ?,
      comments = ?,
      updatedAt = ?
    WHERE id = ?`,
    [now, rejectedBy, now, rejectedBy, rejectionReason || '', comments || '', now, id],
    function(err) {
      if (err) {
        console.error('❌ Database error:', err.message);
        res.status(500).json({ error: err.message });
        return;
      }
      if (this.changes === 0) {
        res.status(404).json({ error: 'Monthly report not found' });
        return;
      }
      console.log(`❌ Monthly report ${id} rejected`);
      
      // Broadcast update to all connected clients
      broadcastDataChange('monthly_reports', 'update', { id, status: 'rejected' });
      
      res.json({ message: 'Monthly report rejected successfully' });
    }
  );
});

// Request revision on monthly report
app.post('/api/monthly-reports/:id/request-revision', (req, res) => {
  const { id } = req.params;
  const { reviewedBy, comments } = req.body;
  const now = new Date().toISOString();

  console.log(`🔄 Requesting revision on monthly report ${id} by ${reviewedBy}`);

  db.run(
    `UPDATE monthly_reports SET 
      status = 'needs_revision',
      reviewedAt = ?,
      reviewedBy = ?,
      comments = ?,
      updatedAt = ?
    WHERE id = ?`,
    [now, reviewedBy, comments || '', now, id],
    function(err) {
      if (err) {
        console.error('❌ Database error:', err.message);
        res.status(500).json({ error: err.message });
        return;
      }
      if (this.changes === 0) {
        res.status(404).json({ error: 'Monthly report not found' });
        return;
      }
      console.log(`🔄 Monthly report ${id} needs revision`);
      
      // Broadcast update to all connected clients
      broadcastDataChange('monthly_reports', 'update', { id, status: 'needs_revision' });
      
      res.json({ message: 'Revision requested successfully' });
    }
  );
});

// Get pending reports for supervisor
app.get('/api/monthly-reports/supervisor/:supervisorId/pending', (req, res) => {
  const { supervisorId } = req.params;
  
  // Get all employees supervised by this supervisor
  db.all(
    'SELECT id FROM employees WHERE supervisorId = ?',
    [supervisorId],
    (err, employees) => {
      if (err) {
        console.error('❌ Error fetching supervised employees:', err);
        res.status(500).json({ error: err.message });
        return;
      }
      
      if (employees.length === 0) {
        res.json([]);
        return;
      }
      
      const employeeIds = employees.map(e => e.id);
      const placeholders = employeeIds.map(() => '?').join(',');
      
      db.all(
        `SELECT mr.*, e.name as employeeName, e.email as employeeEmail
         FROM monthly_reports mr
         JOIN employees e ON mr.employeeId = e.id
         WHERE mr.employeeId IN (${placeholders}) AND mr.status = 'submitted'
         ORDER BY mr.submittedAt ASC`,
        employeeIds,
        (err, reports) => {
          if (err) {
            console.error('❌ Error fetching pending reports:', err);
            res.status(500).json({ error: err.message });
            return;
          }
          res.json(reports);
        }
      );
    }
  );
});

// Delete monthly report
app.delete('/api/monthly-reports/:id', (req, res) => {
  const { id } = req.params;
  
  db.run('DELETE FROM monthly_reports WHERE id = ?', [id], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (this.changes === 0) {
      res.status(404).json({ error: 'Monthly report not found' });
      return;
    }
    
    // Broadcast update to all connected clients
    broadcastDataChange('monthly_reports', 'delete', { id });
    
    res.json({ message: 'Monthly report deleted successfully' });
  });
});

// ===== WEEKLY REPORTS API ENDPOINTS =====

// Get all weekly reports
app.get('/api/weekly-reports', (req, res) => {
  const { employeeId, status } = req.query;
  
  let query = 'SELECT * FROM weekly_reports';
  const params = [];
  
  if (employeeId || status) {
    query += ' WHERE';
    const conditions = [];
    if (employeeId) {
      conditions.push(' employeeId = ?');
      params.push(employeeId);
    }
    if (status) {
      conditions.push(' status = ?');
      params.push(status);
    }
    query += conditions.join(' AND');
  }
  
  query += ' ORDER BY year DESC, weekNumber DESC';
  
  db.all(query, params, (err, rows) => {
    if (err) {
      console.error('❌ Error fetching weekly reports:', err);
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

// Get weekly report by ID
app.get('/api/weekly-reports/:id', (req, res) => {
  const { id } = req.params;
  
  db.get('SELECT * FROM weekly_reports WHERE id = ?', [id], (err, row) => {
    if (err) {
      console.error('❌ Error fetching weekly report:', err);
      res.status(500).json({ error: err.message });
      return;
    }
    if (!row) {
      res.status(404).json({ error: 'Weekly report not found' });
      return;
    }
    res.json(row);
  });
});

// Get weekly report for employee/week/year
app.get('/api/weekly-reports/employee/:employeeId/:year/:week', (req, res) => {
  const { employeeId, year, week } = req.params;
  
  db.get(
    'SELECT * FROM weekly_reports WHERE employeeId = ? AND year = ? AND weekNumber = ?',
    [employeeId, parseInt(year), parseInt(week)],
    (err, row) => {
      if (err) {
        console.error('❌ Error fetching weekly report:', err);
        res.status(500).json({ error: err.message });
        return;
      }
      res.json(row || null);
    }
  );
});

// Create or update weekly report
app.post('/api/weekly-reports', (req, res) => {
  const { id, employeeId, weekNumber, year, startDate, endDate, totalMiles, totalExpenses, status } = req.body;
  const reportId = id || `weekreport-${Date.now().toString(36)}-${Math.random().toString(36).substr(2)}`;
  const now = new Date().toISOString();

  console.log('📝 Creating/updating weekly report:', {
    reportId,
    employeeId,
    weekNumber,
    year,
    startDate,
    endDate,
    totalMiles,
    totalExpenses,
    status: status || 'draft'
  });

  db.run(
    `INSERT OR REPLACE INTO weekly_reports (
      id, employeeId, weekNumber, year, startDate, endDate, totalMiles, totalExpenses, status,
      createdAt, updatedAt
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?, ?,
      COALESCE((SELECT createdAt FROM weekly_reports WHERE id = ?), ?),
      ?
    )`,
    [
      reportId, employeeId, weekNumber, year, startDate, endDate,
      totalMiles || 0,
      totalExpenses || 0,
      status || 'draft',
      reportId, now, now
    ],
    function(err) {
      if (err) {
        console.error('❌ Database error:', err.message);
        res.status(500).json({ error: err.message });
        return;
      }
      console.log(`✅ Weekly report ${reportId} saved`);
      res.json({ id: reportId, message: 'Weekly report saved successfully' });
    }
  );
});

// Submit weekly report for approval
app.post('/api/weekly-reports/:id/submit', (req, res) => {
  const { id } = req.params;
  const { submittedBy } = req.body;
  const now = new Date().toISOString();

  console.log(`📤 Submitting weekly report ${id} for approval by ${submittedBy}`);

  db.run(
    `UPDATE weekly_reports SET 
      status = 'submitted',
      submittedAt = ?,
      submittedBy = ?,
      updatedAt = ?
    WHERE id = ?`,
    [now, submittedBy, now, id],
    function(err) {
      if (err) {
        console.error('❌ Database error:', err.message);
        res.status(500).json({ error: err.message });
        return;
      }
      if (this.changes === 0) {
        res.status(404).json({ error: 'Weekly report not found' });
        return;
      }
      console.log(`✅ Weekly report ${id} submitted for approval`);
      
      broadcastDataChange('weekly_reports', 'update', { id, status: 'submitted' });
      
      res.json({ message: 'Weekly report submitted for approval successfully' });
    }
  );
});

// Approve weekly report
app.post('/api/weekly-reports/:id/approve', (req, res) => {
  const { id } = req.params;
  const { approvedBy, comments } = req.body;
  const now = new Date().toISOString();

  console.log(`✅ Approving weekly report ${id} by ${approvedBy}`);

  db.run(
    `UPDATE weekly_reports SET 
      status = 'approved',
      reviewedAt = ?,
      reviewedBy = ?,
      approvedAt = ?,
      approvedBy = ?,
      comments = ?,
      updatedAt = ?
    WHERE id = ?`,
    [now, approvedBy, now, approvedBy, comments || '', now, id],
    function(err) {
      if (err) {
        console.error('❌ Database error:', err.message);
        res.status(500).json({ error: err.message });
        return;
      }
      if (this.changes === 0) {
        res.status(404).json({ error: 'Weekly report not found' });
        return;
      }
      console.log(`✅ Weekly report ${id} approved`);
      
      broadcastDataChange('weekly_reports', 'update', { id, status: 'approved' });
      
      res.json({ message: 'Weekly report approved successfully' });
    }
  );
});

// Reject weekly report
app.post('/api/weekly-reports/:id/reject', (req, res) => {
  const { id } = req.params;
  const { rejectedBy, rejectionReason, comments } = req.body;
  const now = new Date().toISOString();

  console.log(`❌ Rejecting weekly report ${id} by ${rejectedBy}`);

  db.run(
    `UPDATE weekly_reports SET 
      status = 'rejected',
      reviewedAt = ?,
      reviewedBy = ?,
      rejectedAt = ?,
      rejectedBy = ?,
      rejectionReason = ?,
      comments = ?,
      updatedAt = ?
    WHERE id = ?`,
    [now, rejectedBy, now, rejectedBy, rejectionReason || '', comments || '', now, id],
    function(err) {
      if (err) {
        console.error('❌ Database error:', err.message);
        res.status(500).json({ error: err.message });
        return;
      }
      if (this.changes === 0) {
        res.status(404).json({ error: 'Weekly report not found' });
        return;
      }
      console.log(`❌ Weekly report ${id} rejected`);
      
      broadcastDataChange('weekly_reports', 'update', { id, status: 'rejected' });
      
      res.json({ message: 'Weekly report rejected successfully' });
    }
  );
});

// Request revision on weekly report
app.post('/api/weekly-reports/:id/request-revision', (req, res) => {
  const { id } = req.params;
  const { reviewedBy, comments } = req.body;
  const now = new Date().toISOString();

  console.log(`🔄 Requesting revision on weekly report ${id} by ${reviewedBy}`);

  db.run(
    `UPDATE weekly_reports SET 
      status = 'needs_revision',
      reviewedAt = ?,
      reviewedBy = ?,
      comments = ?,
      updatedAt = ?
    WHERE id = ?`,
    [now, reviewedBy, comments || '', now, id],
    function(err) {
      if (err) {
        console.error('❌ Database error:', err.message);
        res.status(500).json({ error: err.message });
        return;
      }
      if (this.changes === 0) {
        res.status(404).json({ error: 'Weekly report not found' });
        return;
      }
      console.log(`🔄 Weekly report ${id} needs revision`);
      
      broadcastDataChange('weekly_reports', 'update', { id, status: 'needs_revision' });
      
      res.json({ message: 'Revision requested successfully' });
    }
  );
});

// Get pending weekly reports for supervisor
app.get('/api/weekly-reports/supervisor/:supervisorId/pending', (req, res) => {
  const { supervisorId } = req.params;
  
  db.all(
    'SELECT id FROM employees WHERE supervisorId = ?',
    [supervisorId],
    (err, employees) => {
      if (err) {
        console.error('❌ Error fetching supervised employees:', err);
        res.status(500).json({ error: err.message });
        return;
      }
      
      if (employees.length === 0) {
        res.json([]);
        return;
      }
      
      const employeeIds = employees.map(e => e.id);
      const placeholders = employeeIds.map(() => '?').join(',');
      
      db.all(
        `SELECT wr.*, e.name as employeeName, e.email as employeeEmail
         FROM weekly_reports wr
         JOIN employees e ON wr.employeeId = e.id
         WHERE wr.employeeId IN (${placeholders}) AND wr.status = 'submitted'
         ORDER BY wr.year DESC, wr.weekNumber DESC`,
        employeeIds,
        (err, reports) => {
          if (err) {
            console.error('❌ Error fetching pending weekly reports:', err);
            res.status(500).json({ error: err.message });
            return;
          }
          res.json(reports);
        }
      );
    }
  );
});

// Delete weekly report
app.delete('/api/weekly-reports/:id', (req, res) => {
  const { id } = req.params;
  
  db.run('DELETE FROM weekly_reports WHERE id = ?', [id], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (this.changes === 0) {
      res.status(404).json({ error: 'Weekly report not found' });
      return;
    }
    
    broadcastDataChange('weekly_reports', 'delete', { id });
    
    res.json({ message: 'Weekly report deleted successfully' });
  });
});

// ===== BIWEEKLY REPORTS API ENDPOINTS (Month-based: 1-15, 16-end) =====

// Get all biweekly reports
app.get('/api/biweekly-reports', (req, res) => {
  const { employeeId, status } = req.query;

  let query = 'SELECT * FROM biweekly_reports';
  const params = [];

  if (employeeId || status) {
    query += ' WHERE';
    const conditions = [];
    if (employeeId) {
      conditions.push(' employeeId = ?');
      params.push(employeeId);
    }
    if (status) {
      conditions.push(' status = ?');
      params.push(status);
    }
    query += conditions.join(' AND');
  }

  query += ' ORDER BY year DESC, month DESC, periodNumber DESC';

  db.all(query, params, (err, rows) => {
    if (err) {
      console.error('❌ Error fetching biweekly reports:', err);
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

// Get biweekly report by ID
app.get('/api/biweekly-reports/:id', (req, res) => {
  const { id } = req.params;

  db.get('SELECT * FROM biweekly_reports WHERE id = ?', [id], (err, row) => {
    if (err) {
      console.error('❌ Error fetching biweekly report:', err);
      res.status(500).json({ error: err.message });
      return;
    }
    if (!row) {
      res.status(404).json({ error: 'Biweekly report not found' });
      return;
    }
    res.json(row);
  });
});

// Get biweekly report for employee/month/year/period
app.get('/api/biweekly-reports/employee/:employeeId/:year/:month/:period', (req, res) => {
  const { employeeId, year, month, period } = req.params;

  db.get(
    'SELECT * FROM biweekly_reports WHERE employeeId = ? AND year = ? AND month = ? AND periodNumber = ?',
    [employeeId, parseInt(year), parseInt(month), parseInt(period)],
    (err, row) => {
      if (err) {
        console.error('❌ Error fetching biweekly report:', err);
        res.status(500).json({ error: err.message });
        return;
      }
      res.json(row || null);
    }
  );
});

// Create or update biweekly report
app.post('/api/biweekly-reports', (req, res) => {
  const { id, employeeId, month, year, periodNumber, startDate, endDate, totalMiles, totalExpenses, status } = req.body;
  const reportId = id || `biweek-${Date.now().toString(36)}-${Math.random().toString(36).substr(2)}`;
  const now = new Date().toISOString();

  console.log('📝 Creating/updating biweekly report:', {
    reportId,
    employeeId,
    month,
    year,
    periodNumber,
    startDate,
    endDate,
    totalMiles,
    totalExpenses,
    status: status || 'draft'
  });

  db.run(
    `INSERT OR REPLACE INTO biweekly_reports (
      id, employeeId, month, year, periodNumber, startDate, endDate, totalMiles, totalExpenses, status,
      createdAt, updatedAt
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
      COALESCE((SELECT createdAt FROM biweekly_reports WHERE id = ?), ?),
      ?
    )`,
    [
      reportId, employeeId, month, year, periodNumber, startDate, endDate,
      totalMiles || 0,
      totalExpenses || 0,
      status || 'draft',
      reportId, now, now
    ],
    function(err) {
      if (err) {
        console.error('❌ Database error:', err.message);
        res.status(500).json({ error: err.message });
        return;
      }
      console.log(`✅ Biweekly report ${reportId} saved`);
      res.json({ id: reportId, message: 'Biweekly report saved successfully' });
    }
  );
});

// Submit biweekly report for approval
app.post('/api/biweekly-reports/:id/submit', (req, res) => {
  const { id } = req.params;
  const { submittedBy } = req.body;
  const now = new Date().toISOString();

  console.log(`📤 Submitting biweekly report ${id} for approval by ${submittedBy}`);

  db.run(
    `UPDATE biweekly_reports SET 
      status = 'submitted',
      submittedAt = ?,
      submittedBy = ?,
      updatedAt = ?
    WHERE id = ?`,
    [now, submittedBy, now, id],
    function(err) {
      if (err) {
        console.error('❌ Database error:', err.message);
        res.status(500).json({ error: err.message });
        return;
      }
      if (this.changes === 0) {
        res.status(404).json({ error: 'Biweekly report not found' });
        return;
      }
      console.log(`✅ Biweekly report ${id} submitted for approval`);

      broadcastDataChange('biweekly_reports', 'update', { id, status: 'submitted' });

      res.json({ message: 'Biweekly report submitted for approval successfully' });
    }
  );
});

// Approve biweekly report
app.post('/api/biweekly-reports/:id/approve', (req, res) => {
  const { id } = req.params;
  const { approvedBy, comments } = req.body;
  const now = new Date().toISOString();

  console.log(`✅ Approving biweekly report ${id} by ${approvedBy}`);

  db.run(
    `UPDATE biweekly_reports SET 
      status = 'approved',
      reviewedAt = ?,
      reviewedBy = ?,
      approvedAt = ?,
      approvedBy = ?,
      comments = ?,
      updatedAt = ?
    WHERE id = ?`,
    [now, approvedBy, now, approvedBy, comments || '', now, id],
    function(err) {
      if (err) {
        console.error('❌ Database error:', err.message);
        res.status(500).json({ error: err.message });
        return;
      }
      if (this.changes === 0) {
        res.status(404).json({ error: 'Biweekly report not found' });
        return;
      }
      console.log(`✅ Biweekly report ${id} approved`);

      broadcastDataChange('biweekly_reports', 'update', { id, status: 'approved' });

      res.json({ message: 'Biweekly report approved successfully' });
    }
  );
});

// Reject biweekly report
app.post('/api/biweekly-reports/:id/reject', (req, res) => {
  const { id } = req.params;
  const { rejectedBy, rejectionReason, comments } = req.body;
  const now = new Date().toISOString();

  console.log(`❌ Rejecting biweekly report ${id} by ${rejectedBy}`);

  db.run(
    `UPDATE biweekly_reports SET 
      status = 'rejected',
      reviewedAt = ?,
      reviewedBy = ?,
      rejectedAt = ?,
      rejectedBy = ?,
      rejectionReason = ?,
      comments = ?,
      updatedAt = ?
    WHERE id = ?`,
    [now, rejectedBy, now, rejectedBy, rejectionReason || '', comments || '', now, id],
    function(err) {
      if (err) {
        console.error('❌ Database error:', err.message);
        res.status(500).json({ error: err.message });
        return;
      }
      if (this.changes === 0) {
        res.status(404).json({ error: 'Biweekly report not found' });
        return;
      }
      console.log(`❌ Biweekly report ${id} rejected`);

      broadcastDataChange('biweekly_reports', 'update', { id, status: 'rejected' });

      res.json({ message: 'Biweekly report rejected successfully' });
    }
  );
});

// Request revision on biweekly report
app.post('/api/biweekly-reports/:id/request-revision', (req, res) => {
  const { id } = req.params;
  const { reviewedBy, comments } = req.body;
  const now = new Date().toISOString();

  console.log(`🔄 Requesting revision on biweekly report ${id} by ${reviewedBy}`);

  db.run(
    `UPDATE biweekly_reports SET 
      status = 'needs_revision',
      reviewedAt = ?,
      reviewedBy = ?,
      comments = ?,
      updatedAt = ?
    WHERE id = ?`,
    [now, reviewedBy, comments || '', now, id],
    function(err) {
      if (err) {
        console.error('❌ Database error:', err.message);
        res.status(500).json({ error: err.message });
        return;
      }
      if (this.changes === 0) {
        res.status(404).json({ error: 'Biweekly report not found' });
        return;
      }
      console.log(`🔄 Biweekly report ${id} needs revision`);

      broadcastDataChange('biweekly_reports', 'update', { id, status: 'needs_revision' });

      res.json({ message: 'Revision requested successfully' });
    }
  );
});

// Get pending biweekly reports for supervisor
app.get('/api/biweekly-reports/supervisor/:supervisorId/pending', (req, res) => {
  const { supervisorId } = req.params;

  db.all(
    'SELECT id FROM employees WHERE supervisorId = ?',
    [supervisorId],
    (err, employees) => {
      if (err) {
        console.error('❌ Error fetching supervised employees:', err);
        res.status(500).json({ error: err.message });
        return;
      }

      if (employees.length === 0) {
        res.json([]);
        return;
      }

      const employeeIds = employees.map(e => e.id);
      const placeholders = employeeIds.map(() => '?').join(',');

      db.all(
        `SELECT br.*, e.name as employeeName, e.email as employeeEmail
         FROM biweekly_reports br
         JOIN employees e ON br.employeeId = e.id
         WHERE br.employeeId IN (${placeholders}) AND br.status = 'submitted'
         ORDER BY br.year DESC, br.month DESC, br.periodNumber DESC`,
        employeeIds,
        (err, reports) => {
          if (err) {
            console.error('❌ Error fetching pending biweekly reports:', err);
            res.status(500).json({ error: err.message });
            return;
          }
          res.json(reports);
        }
      );
    }
  );
});

// Delete biweekly report
app.delete('/api/biweekly-reports/:id', (req, res) => {
  const { id } = req.params;

  db.run('DELETE FROM biweekly_reports WHERE id = ?', [id], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (this.changes === 0) {
      res.status(404).json({ error: 'Biweekly report not found' });
      return;
    }

    broadcastDataChange('biweekly_reports', 'delete', { id });

    res.json({ message: 'Biweekly report deleted successfully' });
  });
});

// ===== REPORT APPROVAL SYSTEM API ENDPOINTS =====

// Submit report for approval
app.post('/api/reports/submit', (req, res) => {
  const { reportId, employeeId, supervisorId } = req.body;
  const id = `status-${Date.now()}`;
  const now = new Date().toISOString();

  db.run(
    'INSERT INTO report_status (id, reportId, employeeId, status, supervisorId, submittedAt, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [id, reportId, employeeId, 'pending', supervisorId, now, now, now],
    function(err) {
      if (err) {
        console.error('Database error:', err.message);
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ id, message: 'Report submitted for approval successfully' });
    }
  );
});

// Get pending reports for supervisor
app.get('/api/reports/pending/:supervisorId', (req, res) => {
  const { supervisorId } = req.params;
  
  db.all(
    'SELECT * FROM report_status WHERE supervisorId = ? AND status = ? ORDER BY submittedAt ASC',
    [supervisorId, 'pending'],
    (err, rows) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json(rows);
    }
  );
});

// Get report history for supervisor
app.get('/api/reports/history/:supervisorId', (req, res) => {
  const { supervisorId } = req.params;
  const limit = req.query.limit || 50;
  
  db.all(
    'SELECT * FROM report_status WHERE supervisorId = ? ORDER BY COALESCE(reviewedAt, submittedAt) DESC LIMIT ?',
    [supervisorId, limit],
    (err, rows) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json(rows);
    }
  );
});

// Get reports for employee
app.get('/api/reports/employee/:employeeId', (req, res) => {
  const { employeeId } = req.params;
  
  db.all(
    'SELECT * FROM report_status WHERE employeeId = ? ORDER BY submittedAt DESC',
    [employeeId],
    (err, rows) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json(rows);
    }
  );
});

// Approve report
app.post('/api/reports/approve', (req, res) => {
  const { reportId, supervisorId, supervisorName, comments } = req.body;
  const now = new Date().toISOString();

  // Update report status
  db.run(
    'UPDATE report_status SET status = ?, supervisorId = ?, supervisorName = ?, comments = ?, reviewedAt = ?, approvedAt = ?, updatedAt = ? WHERE reportId = ?',
    ['approved', supervisorId, supervisorName, comments, now, now, now, reportId],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }

      // Create approval record
      const approvalId = `approval-${Date.now()}`;
      db.run(
        'INSERT INTO report_approvals (id, reportId, employeeId, supervisorId, supervisorName, action, comments, timestamp, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [approvalId, reportId, req.body.employeeId, supervisorId, supervisorName, 'approve', comments, now, now],
        function(approvalErr) {
          if (approvalErr) {
            console.error('Error creating approval record:', approvalErr.message);
          }
          res.json({ message: 'Report approved successfully' });
        }
      );
    }
  );
});

// Reject report
app.post('/api/reports/reject', (req, res) => {
  const { reportId, supervisorId, supervisorName, comments } = req.body;
  const now = new Date().toISOString();

  // Update report status
  db.run(
    'UPDATE report_status SET status = ?, supervisorId = ?, supervisorName = ?, comments = ?, reviewedAt = ?, updatedAt = ? WHERE reportId = ?',
    ['rejected', supervisorId, supervisorName, comments, now, now, reportId],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }

      // Create rejection record
      const approvalId = `approval-${Date.now()}`;
      db.run(
        'INSERT INTO report_approvals (id, reportId, employeeId, supervisorId, supervisorName, action, comments, timestamp, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [approvalId, reportId, req.body.employeeId, supervisorId, supervisorName, 'reject', comments, now, now],
        function(approvalErr) {
          if (approvalErr) {
            console.error('Error creating rejection record:', approvalErr.message);
          }
          res.json({ message: 'Report rejected successfully' });
        }
      );
    }
  );
});

// Request revision
app.post('/api/reports/request-revision', (req, res) => {
  const { reportId, supervisorId, supervisorName, comments } = req.body;
  const now = new Date().toISOString();

  // Update report status
  db.run(
    'UPDATE report_status SET status = ?, supervisorId = ?, supervisorName = ?, comments = ?, reviewedAt = ?, updatedAt = ? WHERE reportId = ?',
    ['needs_revision', supervisorId, supervisorName, comments, now, now, reportId],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }

      // Create revision request record
      const approvalId = `approval-${Date.now()}`;
      db.run(
        'INSERT INTO report_approvals (id, reportId, employeeId, supervisorId, supervisorName, action, comments, timestamp, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [approvalId, reportId, req.body.employeeId, supervisorId, supervisorName, 'request_revision', comments, now, now],
        function(approvalErr) {
          if (approvalErr) {
            console.error('Error creating revision request record:', approvalErr.message);
          }
          res.json({ message: 'Revision requested successfully' });
        }
      );
    }
  );
});

// Get supervisor notifications
app.get('/api/notifications/supervisor/:supervisorId', (req, res) => {
  const { supervisorId } = req.params;
  
  db.all(
    'SELECT * FROM supervisor_notifications WHERE supervisorId = ? ORDER BY createdAt DESC',
    [supervisorId],
    (err, rows) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json(rows);
    }
  );
});

// Get staff notifications
app.get('/api/notifications/staff/:employeeId', (req, res) => {
  const { employeeId } = req.params;
  
  db.all(
    'SELECT * FROM staff_notifications WHERE employeeId = ? ORDER BY createdAt DESC',
    [employeeId],
    (err, rows) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json(rows);
    }
  );
});

// Mark notification as read
app.put('/api/notifications/:id/read', (req, res) => {
  const { id } = req.params;
  const { type } = req.body; // 'supervisor' or 'staff'
  
  const tableName = type === 'supervisor' ? 'supervisor_notifications' : 'staff_notifications';
  
  db.run(
    `UPDATE ${tableName} SET isRead = 1 WHERE id = ?`,
    [id],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ message: 'Notification marked as read' });
    }
  );
});

// Send message to staff
app.post('/api/messages/send', (req, res) => {
  const { employeeId, supervisorId, supervisorName, message } = req.body;
  const id = `staff-notif-${Date.now()}`;
  const now = new Date().toISOString();

  db.run(
    'INSERT INTO staff_notifications (id, type, employeeId, supervisorId, supervisorName, message, isRead, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [id, 'supervisor_message', employeeId, supervisorId, supervisorName, message, 0, now],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ id, message: 'Message sent successfully' });
    }
  );
});

// Get report approval history
app.get('/api/reports/:reportId/approval-history', (req, res) => {
  const { reportId } = req.params;
  
  db.all(
    'SELECT * FROM report_approvals WHERE reportId = ? ORDER BY timestamp DESC',
    [reportId],
    (err, rows) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json(rows);
    }
  );
});

// Export data to Excel
app.get('/api/export/excel', (req, res) => {
  const { type } = req.query;
  
  let query, filename;
  
  switch (type) {
    case 'employees':
      query = 'SELECT * FROM employees ORDER BY name';
      filename = 'employees.xlsx';
      break;
    case 'mileage':
      query = `
        SELECT me.*, e.name as employeeName, e.costCenter 
        FROM mileage_entries me 
        LEFT JOIN employees e ON me.employeeId = e.id 
        ORDER BY me.date DESC
      `;
      filename = 'mileage_entries.xlsx';
      break;
    case 'receipts':
      query = `
        SELECT r.*, e.name as employeeName, e.costCenter 
        FROM receipts r 
        LEFT JOIN employees e ON r.employeeId = e.id 
        ORDER BY r.date DESC
      `;
      filename = 'receipts.xlsx';
      break;
    default:
      res.status(400).json({ error: 'Invalid export type' });
      return;
  }

  db.all(query, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(workbook, worksheet, type);
    
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(excelBuffer);
  });
});

// Export individual expense report to Excel (matching PDF format)
app.get('/api/export/expense-report/:id', (req, res) => {
  const { id } = req.params;
  
  console.log(`📊 Exporting expense report to Excel: ${id}`);
  
  db.get('SELECT * FROM expense_reports WHERE id = ?', [id], (err, report) => {
    if (err) {
      console.error('❌ Database error:', err);
      res.status(500).json({ error: err.message });
      return;
    }
    
    if (!report) {
      res.status(404).json({ error: 'Report not found' });
      return;
    }
    
    try {
      const reportData = JSON.parse(report.reportData);
      
      // Create workbook
      const workbook = XLSX.utils.book_new();
      
      // Sheet 1: Approval Cover Sheet
      const approvalData = [
        ['MONTHLY EXPENSE REPORT APPROVAL COVER SHEET'],
        [''],
        ['OXFORD HOUSE, INC.'],
        ['1010 Wayne Ave. Suite # 300'],
        ['Silver Spring, MD 20910'],
        [''],
        ['Personal Information'],
        ['Name:', reportData.name || 'N/A'],
        ['Month:', `${reportData.month}, ${reportData.year}`],
        ['Date Completed:', new Date().toLocaleDateString()],
        [''],
        ['Cost Centers:'],
        ['#', 'Cost Center'],
        ...(reportData.costCenters || []).map((center, index) => [`${index + 1}.`, center]),
        [''],
        ['SUMMARY TOTALS'],
        ['Total Miles:', `${(reportData.totalMiles || 0).toFixed(1)}`],
        ['Total Mileage Amount:', `$${(reportData.totalMileageAmount || 0).toFixed(2)}`],
        ['Total Hours:', `${(reportData.totalHours || 0).toFixed(1)}`],
        ['Total Expenses:', `$${((reportData.totalMileageAmount || 0) + (reportData.perDiem || 0) + (reportData.phoneInternetFax || 0)).toFixed(2)}`],
        [''],
        ['SIGNATURES:'],
        ['Employee Signature', 'Supervisor Signature'],
        ['', ''],
        ['', ''],
        ['', '']
      ];
      const approvalSheet = XLSX.utils.aoa_to_sheet(approvalData);
      XLSX.utils.book_append_sheet(workbook, approvalSheet, 'Approval Cover Sheet');
      
      // Sheet 2: Summary Sheet
      const summaryData = [
        ['', 'Cost Center #1', 'Cost Center #2', 'Cost Center #3', 'Cost Center #4', 'Cost Center #5', 'SUBTOTALS (by category)'],
        ['MILEAGE', `$${(reportData.totalMileageAmount || 0).toFixed(2)}`, '$0.00', '$0.00', '$0.00', '$0.00', `$${(reportData.totalMileageAmount || 0).toFixed(2)}`],
        ['AIR / RAIL / BUS', `$${(reportData.airRailBus || 0).toFixed(2)}`, '$0.00', '$0.00', '$0.00', '$0.00', `$${(reportData.airRailBus || 0).toFixed(2)}`],
        ['VEHICLE RENTAL / FUEL', `$${(reportData.vehicleRentalFuel || 0).toFixed(2)}`, '$0.00', '$0.00', '$0.00', '$0.00', `$${(reportData.vehicleRentalFuel || 0).toFixed(2)}`],
        ['PARKING / TOLLS', `$${(reportData.parkingTolls || 0).toFixed(2)}`, '$0.00', '$0.00', '$0.00', '$0.00', `$${(reportData.parkingTolls || 0).toFixed(2)}`],
        ['GROUND', `$${(reportData.groundTransportation || 0).toFixed(2)}`, '$0.00', '$0.00', '$0.00', '$0.00', `$${(reportData.groundTransportation || 0).toFixed(2)}`],
        ['LODGING', `$${(reportData.hotelsAirbnb || 0).toFixed(2)}`, '$0.00', '$0.00', '$0.00', '$0.00', `$${(reportData.hotelsAirbnb || 0).toFixed(2)}`],
        ['PER DIEM', `$${(reportData.perDiem || 0).toFixed(2)}`, '$0.00', '$0.00', '$0.00', '$0.00', `$${(reportData.perDiem || 0).toFixed(2)}`],
        ['OTHER EXPENSES', '$0.00', '$0.00', '$0.00', '$0.00', '$0.00', '$0.00'],
        ['OXFORD HOUSE E.E.S.', '$0.00', '$0.00', '$0.00', '$0.00', '$0.00', '$0.00'],
        ['', '$0.00', '$0.00', '$0.00', '$0.00', '$0.00', '$0.00'],
        ['COMMUNICATIONS', '$0.00', '$0.00', '$0.00', '$0.00', '$0.00', '$0.00'],
        ['Phone / Internet / Fax', `$${(reportData.phoneInternetFax || 0).toFixed(2)}`, '$0.00', '$0.00', '$0.00', '$0.00', `$${(reportData.phoneInternetFax || 0).toFixed(2)}`],
        ['Postage / Shipping', '$0.00', '$0.00', '$0.00', '$0.00', '$0.00', '$0.00'],
        ['Printing / Copying', '$0.00', '$0.00', '$0.00', '$0.00', '$0.00', '$0.00'],
        ['SUPPLIES', '$0.00', '$0.00', '$0.00', '$0.00', '$0.00', '$0.00'],
        ['Outreach Supplies', '$0.00', '$0.00', '$0.00', '$0.00', '$0.00', '$0.00'],
        ['', '$0.00', '$0.00', '$0.00', '$0.00', '$0.00', '$0.00'],
        ['SUBTOTALS (by cost center)', `$${(reportData.totalMileageAmount || 0).toFixed(2)}`, '$0.00', '$0.00', '$0.00', '$0.00', `$${((reportData.totalMileageAmount || 0) + (reportData.phoneInternetFax || 0) + (reportData.airRailBus || 0) + (reportData.vehicleRentalFuel || 0) + (reportData.parkingTolls || 0) + (reportData.groundTransportation || 0) + (reportData.hotelsAirbnb || 0) + (reportData.perDiem || 0) + (reportData.other || 0)).toFixed(2)}`],
        ['Less Cash Advance', '$0.00', '$0.00', '$0.00', '$0.00', '$0.00', '$0.00'],
        [''],
        ['GRAND TOTAL', `$${((reportData.totalMileageAmount || 0) + (reportData.phoneInternetFax || 0) + (reportData.airRailBus || 0) + (reportData.vehicleRentalFuel || 0) + (reportData.parkingTolls || 0) + (reportData.groundTransportation || 0) + (reportData.hotelsAirbnb || 0) + (reportData.perDiem || 0) + (reportData.other || 0)).toFixed(2)}`],
        [''],
        ['Payable to:', reportData.name || 'N/A']
      ];
      const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary Sheet');
      
      // Sheet 3: Cost Center Travel Sheets
      const costCenters = reportData.costCenters || ['Program Services'];
      costCenters.forEach((costCenter, index) => {
        const month = new Date().getMonth() + 1;
        const year = new Date().getFullYear();
        const daysInMonth = new Date(year, month, 0).getDate();
        
        const ccData = [
          [`Cost Center Travel Sheet - ${costCenter}`],
          [''],
          ['Date', 'Description/Activity', 'Hours', 'Odometer Start', 'Odometer End', 'Miles', 'Mileage ($)']
        ];
        
        // Generate rows for all days of the month
        for (let day = 1; day <= daysInMonth; day++) {
          const dateStr = `${month.toString().padStart(2, '0')}/${day.toString().padStart(2, '0')}/${year.toString().slice(-2)}`;
          const entry = reportData.dailyEntries?.find(e => e.date === dateStr) || {};
          
          ccData.push([
            dateStr,
            entry.description || '',
            (entry.hoursWorked || 0).toString(),
            (entry.odometerStart || 0).toString(),
            (entry.odometerEnd || 0).toString(),
            (entry.milesTraveled || 0).toFixed(1),
            `$${(entry.mileageAmount || 0).toFixed(2)}`
          ]);
        }
        
        const ccSheet = XLSX.utils.aoa_to_sheet(ccData);
        XLSX.utils.book_append_sheet(workbook, ccSheet, `Cost Center ${index + 1}`);
      });
      
      // Sheet 4: Timesheet
      const month = new Date().getMonth() + 1;
      const year = new Date().getFullYear();
      const daysInMonth = new Date(year, month, 0).getDate();
      
      const timesheetData = [
        ['MONTHLY TIMESHEET'],
        [''],
        [`${reportData.name || 'N/A'} - ${reportData.month} ${reportData.year}`],
        [''],
        ['Date', 'Cost Center', 'Hours Worked']
      ];
      
      // Generate rows for all days of the month
      for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${month.toString().padStart(2, '0')}/${day.toString().padStart(2, '0')}/${year.toString().slice(-2)}`;
        const entry = reportData.dailyEntries?.find(e => e.date === dateStr) || {};
        
        timesheetData.push([
          dateStr,
          (reportData.costCenters && reportData.costCenters[0]) || 'N/A',
          (entry.hoursWorked || 0).toString()
        ]);
      }
      
      timesheetData.push(['']);
      timesheetData.push(['TIME TRACKING SUMMARY:']);
      timesheetData.push(['Category', 'Hours']);
      timesheetData.push(['G&A Hours', reportData.gaHours || 0]);
      timesheetData.push(['Holiday Hours', reportData.holidayHours || 0]);
      timesheetData.push(['PTO Hours', reportData.ptoHours || 0]);
      timesheetData.push(['STD/LTD Hours', reportData.stdLtdHours || 0]);
      timesheetData.push(['PFL/PFML Hours', reportData.pflPfmlHours || 0]);
      timesheetData.push(['Total Hours:', reportData.totalHours || 0]);
      
      const timesheetSheet = XLSX.utils.aoa_to_sheet(timesheetData);
      XLSX.utils.book_append_sheet(workbook, timesheetSheet, 'Timesheet');
      
      // Generate Excel file
      const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });
      
      const filename = `${reportData.name?.toUpperCase().replace(/\s+/g, ',') || 'UNKNOWN'} EXPENSES ${reportData.month?.substring(0, 3).toUpperCase() || 'UNK'}-${reportData.year?.toString().slice(-2) || 'XX'}.xlsx`;
      
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(excelBuffer);
      
      console.log(`✅ Exported expense report to Excel: ${filename}`);
    } catch (parseError) {
      console.error('❌ Error parsing report data:', parseError);
      res.status(500).json({ error: 'Failed to parse report data' });
    }
  });
});

// Export individual expense report to PDF (matching Staff Portal format)
app.get('/api/export/expense-report-pdf/:id', (req, res) => {
  const { id } = req.params;
  
  console.log(`📊 Exporting expense report to PDF: ${id}`);
  
  db.get('SELECT * FROM expense_reports WHERE id = ?', [id], (err, report) => {
    if (err) {
      console.error('❌ Database error:', err);
      res.status(500).json({ error: err.message });
      return;
    }
    
    if (!report) {
      res.status(404).json({ error: 'Report not found' });
      return;
    }
    
    try {
      const reportData = JSON.parse(report.reportData);
      
      // Create PDF in portrait mode
      const doc = new jsPDF('portrait', 'pt', 'a4');
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 40;
      
      // Helper function for safe text
      const safeText = (text, x, y, options) => {
        const safeTextValue = text !== null && text !== undefined ? String(text) : '';
        doc.text(safeTextValue, x, y, options);
      };
      
      // Helper function to set colors
      const setColor = (color) => {
        switch(color) {
          case 'lightGreen': doc.setFillColor(200, 255, 200); break;
          case 'lightBlue': doc.setFillColor(200, 220, 255); break;
          case 'lightOrange': doc.setFillColor(255, 220, 180); break;
          case 'darkBlue': doc.setFillColor(50, 50, 150); break;
          default: doc.setFillColor(255, 255, 255);
        }
      };
      
      // Page 1: Approval Cover Sheet
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      safeText('MONTHLY EXPENSE REPORT APPROVAL COVER SHEET', pageWidth / 2, 60, { align: 'center' });
      
      doc.setFontSize(14);
      safeText('OXFORD HOUSE, INC.', pageWidth / 2, 85, { align: 'center' });
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      safeText('1010 Wayne Ave. Suite # 300', pageWidth / 2, 105, { align: 'center' });
      safeText('Silver Spring, MD 20910', pageWidth / 2, 120, { align: 'center' });
      
      let yPos = 160;
      
      // Personal Information Table
      const personalInfoTableWidth = 300;
      const personalInfoTableStartX = (pageWidth - personalInfoTableWidth) / 2; // Center the table
      const personalInfoRowHeight = 20;
      const personalInfoLabelColWidth = 120; // Width for label column
      const personalInfoValueColWidth = 180; // Width for value column
      
      doc.setFontSize(11);
      const personalInfoItems = [
        ['Name:', reportData.name || 'N/A'],
        ['Month:', `${reportData.month}, ${reportData.year}`],
        ['Date Completed:', new Date().toLocaleDateString()]
      ];
      
      personalInfoItems.forEach(([label, value]) => {
        doc.setFont('helvetica', 'bold');
        setColor('white');
        doc.rect(personalInfoTableStartX, yPos, personalInfoLabelColWidth, personalInfoRowHeight, 'FD');
        doc.setTextColor(0, 0, 0);
        safeText(label, personalInfoTableStartX + 10, yPos + personalInfoRowHeight/2 + 3);
        
        doc.setFont('helvetica', 'normal');
        setColor('white');
        doc.rect(personalInfoTableStartX + personalInfoLabelColWidth, yPos, personalInfoValueColWidth, personalInfoRowHeight, 'FD');
        doc.setTextColor(0, 0, 0);
        safeText(value, personalInfoTableStartX + personalInfoLabelColWidth + 10, yPos + personalInfoRowHeight/2 + 3);
        yPos += personalInfoRowHeight;
      });
      
      yPos += 30;
      
      // Cost Centers Table
      const costCentersTableWidth = 300;
      const costCentersTableStartX = (pageWidth - costCentersTableWidth) / 2; // Center the table
      const costCentersRowHeight = 20;
      const costCentersNumberColWidth = 40; // Width for number column
      const costCentersNameColWidth = 260; // Width for name column
      
      doc.setFont('helvetica', 'bold');
      setColor('darkBlue');
      doc.rect(costCentersTableStartX, yPos, costCentersNumberColWidth, costCentersRowHeight, 'FD');
      doc.rect(costCentersTableStartX + costCentersNumberColWidth, yPos, costCentersNameColWidth, costCentersRowHeight, 'FD');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(11);
      safeText('#', costCentersTableStartX + 10, yPos + costCentersRowHeight/2 + 3);
      safeText('Cost Center', costCentersTableStartX + costCentersNumberColWidth + 10, yPos + costCentersRowHeight/2 + 3);
      yPos += costCentersRowHeight;
      
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(0, 0, 0);
      const costCenters = reportData.costCenters || [];
      costCenters.forEach((center, index) => {
        setColor('white');
        doc.rect(costCentersTableStartX, yPos, costCentersNumberColWidth, costCentersRowHeight, 'FD');
        doc.rect(costCentersTableStartX + costCentersNumberColWidth, yPos, costCentersNameColWidth, costCentersRowHeight, 'FD');
        safeText(`${index + 1}.`, costCentersTableStartX + 10, yPos + costCentersRowHeight/2 + 3);
        safeText(center, costCentersTableStartX + costCentersNumberColWidth + 10, yPos + costCentersRowHeight/2 + 3);
        yPos += costCentersRowHeight;
      });
      
      yPos += 30;
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      safeText('SUMMARY TOTALS', pageWidth / 2, yPos, { align: 'center' });
      yPos += 25;
      
      // Calculate dimensions for Summary Totals table
      const summaryTableWidth = 200;
      const summaryTableStartX = (pageWidth - summaryTableWidth) / 2; // Center the summary table
      const summaryRowHeight = 20;
      const summaryLabelColWidth = 120; // Width for label column
      const summaryValueColWidth = 80; // Width for value column
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      const summaryItems = [
        ['Total Miles:', `${Math.round(reportData.totalMiles || 0)}`],
        ['Total Mileage Amount:', `$${(reportData.totalMileageAmount || 0).toFixed(2)}`],
        ['Total Hours:', `${(reportData.totalHours || 0).toFixed(1)}`],
        ['Total Expenses:', `$${((reportData.totalMileageAmount || 0) + (reportData.perDiem || 0) + (reportData.phoneInternetFax || 0)).toFixed(2)}`]
      ];
      
      summaryItems.forEach(([label, value]) => {
        doc.setFont('helvetica', 'bold');
        setColor('white');
        doc.rect(summaryTableStartX, yPos, summaryLabelColWidth, summaryRowHeight, 'FD');
        doc.setTextColor(0, 0, 0);
        safeText(label, summaryTableStartX + 10, yPos + summaryRowHeight/2 + 3);
        
        doc.setFont('helvetica', 'normal');
        setColor('white');
        doc.rect(summaryTableStartX + summaryLabelColWidth, yPos, summaryValueColWidth, summaryRowHeight, 'FD');
        doc.setTextColor(0, 0, 0);
        safeText(value, summaryTableStartX + summaryLabelColWidth + 10, yPos + summaryRowHeight/2 + 3);
        yPos += summaryRowHeight;
      });
      
      yPos += 40;
      doc.setFont('helvetica', 'bold');
      safeText('SIGNATURES:', pageWidth / 2, yPos, { align: 'center' });
      yPos += 25;
      
      // Calculate dimensions for Signatures table
      const signaturesTableWidth = 400;
      const signaturesTableStartX = (pageWidth - signaturesTableWidth) / 2; // Center the signatures table
      const signaturesRowHeight = 50;
      const signaturesColWidth = 200; // Width for each signature column
      
      // Draw header row
      doc.setFont('helvetica', 'bold');
      setColor('darkBlue');
      doc.rect(signaturesTableStartX, yPos, signaturesColWidth, 20, 'FD');
      doc.rect(signaturesTableStartX + signaturesColWidth, yPos, signaturesColWidth, 20, 'FD');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(10);
      safeText('Employee Signature', signaturesTableStartX + 10, yPos + 10);
      safeText('Supervisor Signature', signaturesTableStartX + signaturesColWidth + 10, yPos + 10);
      yPos += 20;
      
      // Draw signature boxes
      doc.setFont('helvetica', 'normal');
      setColor('white');
      doc.rect(signaturesTableStartX, yPos, signaturesColWidth, signaturesRowHeight, 'FD');
      doc.rect(signaturesTableStartX + signaturesColWidth, yPos, signaturesColWidth, signaturesRowHeight, 'FD');
      doc.setTextColor(0, 0, 0);
      
      // Page 2: Summary Sheet (with colors and grid like screenshot)
      doc.addPage();
      yPos = margin + 20;
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      safeText('MONTHLY EXPENSE REPORT SUMMARY SHEET', pageWidth / 2, yPos, { align: 'center' });
      
      yPos += 40;
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      safeText(`Name: ${reportData.name || 'N/A'}`, margin, yPos);
      yPos += 20;
      safeText(`Date Completed: ${new Date().toLocaleDateString()}`, margin, yPos);
      yPos += 20;
      safeText(`Month: ${reportData.month}, ${reportData.year}`, margin, yPos);
      
      yPos += 40;
      
      // Helper function to draw table cell with color and border and text wrapping
      const drawCell = (x, y, width, height, text, color = 'white', textColor = 'black', align = 'left', wrapText = false) => {
        // Set fill color
        setColor(color);
        
        let actualHeight = height; // Default to original height
        
        if (wrapText && text && text.length > 15) {
          // Calculate maximum characters that can fit in the cell width
          // Using font size 7, adjusted to be about 10px wider
          const maxCharsPerLine = Math.floor((width - 10) / 4.0); // 10px padding, ~4.0px per character at size 7
          
          // Split text into multiple lines for wrapping
          const words = text.split(' ');
          const lines = [];
          let currentLine = '';
          
          for (const word of words) {
            const testLine = currentLine ? `${currentLine} ${word}` : word;
            if (testLine.length <= maxCharsPerLine) {
              currentLine = testLine;
            } else {
              if (currentLine) lines.push(currentLine);
              currentLine = word;
            }
          }
          if (currentLine) lines.push(currentLine);
          
          // Calculate exact height needed: text content + one line height of padding
          const textHeight = 8 + (lines.length * 8) + 8; // 8px top padding + 8px per line + 8px bottom padding (one line height)
          actualHeight = textHeight; // Use exact calculated height, not Math.max
          
          // Draw filled rectangle with exact height
          doc.rect(x, y, width, actualHeight, 'FD'); // Fill and draw border
          
          // Draw multiple lines with original spacing
          lines.forEach((line, index) => {
            const lineY = y + 8 + (index * 8); // 8px top padding + 8px per line
            if (align === 'right') {
              safeText(line, x + width - 5, lineY);
            } else {
              safeText(line, x + 5, lineY);
            }
          });
        } else {
          // Single line text - draw rectangle with original height
          doc.rect(x, y, width, height, 'FD'); // Fill and draw border
          
          if (align === 'right') {
            safeText(text, x + width - 5, y + height/2 + 3);
          } else {
            safeText(text, x + 5, y + height/2 + 3);
          }
        }
        
        // Set text color and font
        doc.setTextColor(textColor === 'white' ? 255 : 0, textColor === 'white' ? 255 : 0, textColor === 'white' ? 255 : 0);
        doc.setFontSize(7); // Reduced from default 8 to 7 (~12.5% reduction)
        doc.setFont('helvetica', 'bold');
        
        doc.setTextColor(0, 0, 0); // Reset to black
        return actualHeight; // Return actual height used
      };
      
      // Table dimensions - adjusted for portrait page with proper widths (downsized by ~20% total)
      const cellHeight = 16; // ~20% reduction from original 20
      const colWidths = [96, 64, 64, 64, 64, 64, 80]; // ~20% reduction from original widths
      const tableWidth = colWidths.reduce((sum, width) => sum + width, 0);
      const tableStartX = margin;
      
      // Header row - start with blank cell in A1 position
      const headers = ['', 'Cost Center #1', 'Cost Center #2', 'Cost Center #3', 'Cost Center #4', 'Cost Center #5', 'SUBTOTALS (by category)'];
      let xPos = tableStartX;
      
      // Check if any header needs wrapping and calculate dynamic height
      let maxHeaderHeight = cellHeight;
      headers.forEach(header => {
        if (header.length > 15) {
          const words = header.split(' ');
          let lines = [];
          let currentLine = '';
          
          for (const word of words) {
            const testLine = currentLine ? `${currentLine} ${word}` : word;
            if (testLine.length <= 20) {
              currentLine = testLine;
            } else {
              if (currentLine) lines.push(currentLine);
              currentLine = word;
            }
          }
          if (currentLine) lines.push(currentLine);
          
          const headerHeight = cellHeight + (lines.length - 1) * 8 + 4; // 8px line spacing + 4px buffer
          maxHeaderHeight = Math.max(maxHeaderHeight, headerHeight);
        }
      });
      
      headers.forEach((header, i) => {
        const needsWrapping = header.length > 15;
        drawCell(xPos, yPos, colWidths[i], maxHeaderHeight, header, 'darkBlue', 'white', 'center', needsWrapping);
        xPos += colWidths[i];
      });
      yPos += maxHeaderHeight;
      
      // Travel expenses section (light green)
      const travelExpenses = [
        ['MILEAGE', reportData.totalMileageAmount || 0, 0, 0, 0, 0, reportData.totalMileageAmount || 0],
        ['AIR / RAIL / BUS', reportData.airRailBus || 0, 0, 0, 0, 0, reportData.airRailBus || 0],
        ['VEHICLE RENTAL / FUEL', reportData.vehicleRentalFuel || 0, 0, 0, 0, 0, reportData.vehicleRentalFuel || 0],
        ['PARKING / TOLLS', reportData.parkingTolls || 0, 0, 0, 0, 0, reportData.parkingTolls || 0],
        ['GROUND', reportData.groundTransportation || 0, 0, 0, 0, 0, reportData.groundTransportation || 0],
        ['LODGING', reportData.hotelsAirbnb || 0, 0, 0, 0, 0, reportData.hotelsAirbnb || 0],
        ['PER DIEM', reportData.perDiem || 0, 0, 0, 0, 0, reportData.perDiem || 0]
      ];
      
      travelExpenses.forEach(([category, ...amounts]) => {
        // Check if category needs wrapping and calculate required height
        const categoryNeedsWrapping = category.length > 15;
        let maxRowHeight = cellHeight;
        
        if (categoryNeedsWrapping) {
          // Use the same calculation as drawCell for consistency
          const maxCharsPerLine = Math.floor((colWidths[0] - 10) / 4.0); // 10px padding, ~4.0px per character at size 7
          
          const words = category.split(' ');
          let lines = [];
          let currentLine = '';
          
          for (const word of words) {
            const testLine = currentLine ? `${currentLine} ${word}` : word;
            if (testLine.length <= maxCharsPerLine) {
              currentLine = testLine;
            } else {
              if (currentLine) lines.push(currentLine);
              currentLine = word;
            }
          }
          if (currentLine) lines.push(currentLine);
          
          // Calculate height needed: text content + one line height of padding
          maxRowHeight = 8 + (lines.length * 8) + 8; // 8px top padding + 8px per line + 8px bottom padding
        }
        
        xPos = tableStartX;
        // All cells in the row should be the same height as the tallest cell
        drawCell(xPos, yPos, colWidths[0], maxRowHeight, category, 'lightGreen', 'black', 'left', categoryNeedsWrapping);
        xPos += colWidths[0];
        
        amounts.forEach((amount, i) => {
          // All cells in the row should be the same height as the tallest cell
          drawCell(xPos, yPos, colWidths[i + 1], maxRowHeight, `$${amount.toFixed(2)}`, 'lightGreen', 'black', 'left');
          xPos += colWidths[i + 1];
        });
        yPos += maxRowHeight;
      });
      
      // Other expenses section
      drawCell(tableStartX, yPos, colWidths[0], cellHeight, 'OTHER EXPENSES', 'lightBlue', 'black', 'left');
      xPos = tableStartX + colWidths[0];
      for (let i = 1; i < colWidths.length; i++) {
        drawCell(xPos, yPos, colWidths[i], cellHeight, '$0.00', 'lightBlue', 'black', 'left');
        xPos += colWidths[i];
      }
      yPos += cellHeight;
      
      // OXFORD HOUSE E.E.S. row
      drawCell(tableStartX, yPos, colWidths[0], cellHeight, 'OXFORD HOUSE E.E.S.', 'lightOrange', 'black', 'left');
      xPos = tableStartX + colWidths[0];
      for (let i = 1; i < colWidths.length; i++) {
        drawCell(xPos, yPos, colWidths[i], cellHeight, '$0.00', 'lightOrange', 'black', 'left');
        xPos += colWidths[i];
      }
      yPos += cellHeight;
      
      // Two blank rows under OTHER EXPENSES
      for (let blank = 0; blank < 2; blank++) {
        drawCell(tableStartX, yPos, colWidths[0], cellHeight, '', 'lightOrange', 'black', 'left');
        xPos = tableStartX + colWidths[0];
        for (let i = 1; i < colWidths.length; i++) {
          drawCell(xPos, yPos, colWidths[i], cellHeight, '$0.00', 'lightOrange', 'black', 'left');
          xPos += colWidths[i];
        }
        yPos += cellHeight;
      }
      
      // Communications section
      drawCell(tableStartX, yPos, colWidths[0], cellHeight, 'COMMUNICATIONS', 'lightBlue', 'black', 'left');
      xPos = tableStartX + colWidths[0];
      for (let i = 1; i < colWidths.length; i++) {
        drawCell(xPos, yPos, colWidths[i], cellHeight, '$0.00', 'lightBlue', 'black', 'left');
        xPos += colWidths[i];
      }
      yPos += cellHeight;
      
      // Phone / Internet / Fax
      drawCell(tableStartX, yPos, colWidths[0], cellHeight, 'Phone / Internet / Fax', 'lightOrange', 'black', 'left');
      xPos = tableStartX + colWidths[0];
      for (let i = 1; i < colWidths.length; i++) {
        drawCell(xPos, yPos, colWidths[i], cellHeight, '$0.00', 'lightOrange', 'black', 'left');
        xPos += colWidths[i];
      }
      yPos += cellHeight;
      
      // Postage / Shipping
      drawCell(tableStartX, yPos, colWidths[0], cellHeight, 'Postage / Shipping', 'lightOrange', 'black', 'left');
      xPos = tableStartX + colWidths[0];
      for (let i = 1; i < colWidths.length; i++) {
        drawCell(xPos, yPos, colWidths[i], cellHeight, '$0.00', 'lightOrange', 'black', 'left');
        xPos += colWidths[i];
      }
      yPos += cellHeight;
      
      // Printing / Copying
      drawCell(tableStartX, yPos, colWidths[0], cellHeight, 'Printing / Copying', 'lightOrange', 'black', 'left');
      xPos = tableStartX + colWidths[0];
      for (let i = 1; i < colWidths.length; i++) {
        drawCell(xPos, yPos, colWidths[i], cellHeight, '$0.00', 'lightOrange', 'black', 'left');
        xPos += colWidths[i];
      }
      yPos += cellHeight;
      
      // Supplies section
      drawCell(tableStartX, yPos, colWidths[0], cellHeight, 'SUPPLIES', 'lightBlue', 'black', 'left');
      xPos = tableStartX + colWidths[0];
      for (let i = 1; i < colWidths.length; i++) {
        drawCell(xPos, yPos, colWidths[i], cellHeight, '$0.00', 'lightBlue', 'black', 'left');
        xPos += colWidths[i];
      }
      yPos += cellHeight;
      
      // Outreach Supplies
      drawCell(tableStartX, yPos, colWidths[0], cellHeight, 'Outreach Supplies', 'lightOrange', 'black', 'left');
      xPos = tableStartX + colWidths[0];
      for (let i = 1; i < colWidths.length; i++) {
        drawCell(xPos, yPos, colWidths[i], cellHeight, '$0.00', 'lightOrange', 'black', 'left');
        xPos += colWidths[i];
      }
      yPos += cellHeight;
      
      // Blank row under SUPPLIES
      drawCell(tableStartX, yPos, colWidths[0], cellHeight, '', 'lightOrange', 'black', 'left');
      xPos = tableStartX + colWidths[0];
      for (let i = 1; i < colWidths.length; i++) {
        drawCell(xPos, yPos, colWidths[i], cellHeight, '$0.00', 'lightOrange', 'black', 'left');
        xPos += colWidths[i];
      }
      yPos += cellHeight;
      
      // Subtotals by cost center (light green)
      const totalExpenses = (reportData.totalMileageAmount || 0) + (reportData.phoneInternetFax || 0) + 
                           (reportData.airRailBus || 0) + (reportData.vehicleRentalFuel || 0) + 
                           (reportData.parkingTolls || 0) + (reportData.groundTransportation || 0) + 
                           (reportData.hotelsAirbnb || 0) + (reportData.perDiem || 0) + (reportData.other || 0);
      
      // Subtotals by cost center (light green) - with dynamic height for text wrapping
      const subtotalsText = 'SUBTOTALS (by cost center)';
      const subtotalsNeedsWrapping = subtotalsText.length > 15;
      let subtotalsRowHeight = cellHeight;
      
      if (subtotalsNeedsWrapping) {
        const words = subtotalsText.split(' ');
        let lines = [];
        let currentLine = '';
        
        for (const word of words) {
          const testLine = currentLine ? `${currentLine} ${word}` : word;
          if (testLine.length <= 20) {
            currentLine = testLine;
          } else {
            if (currentLine) lines.push(currentLine);
            currentLine = word;
          }
        }
        if (currentLine) lines.push(currentLine);
        
        subtotalsRowHeight = cellHeight + (lines.length - 1) * 8 + 4; // 8px line spacing + 4px buffer
      }
      
      drawCell(tableStartX, yPos, colWidths[0], subtotalsRowHeight, subtotalsText, 'lightGreen', 'black', 'left', subtotalsNeedsWrapping);
      xPos = tableStartX + colWidths[0];
      drawCell(xPos, yPos, colWidths[1], subtotalsRowHeight, `$${(reportData.totalMileageAmount || 0).toFixed(2)}`, 'lightGreen', 'black', 'left');
      xPos += colWidths[1];
      for (let i = 2; i < colWidths.length - 1; i++) {
        drawCell(xPos, yPos, colWidths[i], subtotalsRowHeight, '$0.00', 'lightGreen', 'black', 'left');
        xPos += colWidths[i];
      }
      drawCell(xPos, yPos, colWidths[colWidths.length - 1], subtotalsRowHeight, `$${totalExpenses.toFixed(2)}`, 'lightGreen', 'black', 'left');
      yPos += subtotalsRowHeight;
      
      // Less Cash Advance
      drawCell(tableStartX, yPos, colWidths[0], cellHeight, 'Less Cash Advance', 'lightGreen', 'black', 'left');
      xPos = tableStartX + colWidths[0];
      for (let i = 1; i < colWidths.length; i++) {
        drawCell(xPos, yPos, colWidths[i], cellHeight, '$0.00', 'lightGreen', 'black', 'left');
        xPos += colWidths[i];
      }
      yPos += cellHeight;
      
      // Grand Total (light blue) - moved one cell to the left, same size as other cells
      yPos += 20;
      const grandTotalX = tableStartX + colWidths.slice(0, -2).reduce((sum, width) => sum + width, 0); // Move one cell left
      drawCell(grandTotalX, yPos, colWidths[colWidths.length - 1], cellHeight, 'GRAND TOTAL', 'lightBlue', 'black', 'left');
      drawCell(grandTotalX + colWidths[colWidths.length - 1], yPos, colWidths[colWidths.length - 1], cellHeight, `$${totalExpenses.toFixed(2)}`, 'lightBlue', 'black', 'left'); // Changed to left align
      
      yPos += 40;
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      
      // Check if we need a new page before the cost center sheets
      if (yPos > pageHeight - 100) {
        doc.addPage();
        yPos = margin + 20;
      }
      
      safeText(`Payable to: ${reportData.name || 'N/A'}`, margin, yPos);
      
      
      // Page 3+: Cost Center Travel Sheets (with all days of month and grid)
      
      // Ensure we have at least one cost center sheet
      const costCentersToProcess = reportData.costCenters && reportData.costCenters.length > 0 
        ? reportData.costCenters 
        : ['Program Services']; // Default cost center if none provided
      
      
      costCentersToProcess.forEach((costCenter, index) => {
        doc.addPage();
        yPos = margin + 20;
        
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        safeText(`COST CENTER TRAVEL SHEET - ${costCenter}`, pageWidth / 2, yPos, { align: 'center' });
        
        yPos += 30;
        doc.setFontSize(11);
        safeText(`${reportData.name || 'N/A'} - ${reportData.month} ${reportData.year}`, pageWidth / 2, yPos, { align: 'center' });
        
        yPos += 40;
        
        // Table dimensions for Cost Center sheet - increased widths for better text fitting
        const ccCellHeight = 12; // Base height
        const ccColWidths = [50, 140, 50, 60, 50, 50, 60]; // Increased Description column width significantly
        const ccHeaders = ['Date', 'Description/Activity', 'Hours', 'Odometer Start', 'Odometer End', 'Miles', 'Mileage ($)'];
        
        // Calculate total table width and center it on the page
        const totalTableWidth = ccColWidths.reduce((sum, width) => sum + width, 0);
        const ccTableStartX = (pageWidth - totalTableWidth) / 2;
        
        // Helper function for Cost Center table cells with text wrapping
        const drawCCCell = (x, y, width, height, text, color = 'white', textColor = 'black', align = 'left', wrapText = false) => {
          // Set fill color
          setColor(color);
          
          // Calculate actual height needed based on text wrapping
          let actualHeight = height;
          let lines = [];
          
          if (wrapText && text && text.length > 20) {
            // Calculate maximum characters that can fit in the cell width
            // Using font size 6, adjusted to be about 10px wider
            const maxCharsPerLine = Math.floor((width - 6) / 3.5); // 6px padding, ~3.5px per character at size 6
            
            // First split on explicit newlines, then apply word wrapping to each segment
            const segments = text.split('\n');
            lines = [];
            
            segments.forEach(segment => {
              if (segment.trim()) { // Only process non-empty segments
                const words = segment.trim().split(' ');
                let currentLine = '';
                
                for (const word of words) {
                  const testLine = currentLine ? `${currentLine} ${word}` : word;
                  if (testLine.length <= maxCharsPerLine) {
                    currentLine = testLine;
                  } else {
                    if (currentLine) lines.push(currentLine);
                    currentLine = word;
                  }
                }
                if (currentLine) lines.push(currentLine);
              } else {
                // Empty segment (from \n\n) - add empty line
                lines.push('');
              }
            });
            
            // Calculate exact height needed: text content + one line height of padding
            const textHeight = 6 + (lines.length * 6) + 6; // 6px top padding + 6px per line + 6px bottom padding (one line height)
            actualHeight = textHeight; // Use exact calculated height, not Math.max
          }
          
          // Draw filled rectangle with border using exact height
          doc.rect(x, y, width, actualHeight, 'FD'); // Fill and draw border
          
          // Set text color and font
          doc.setTextColor(textColor === 'white' ? 255 : 0, textColor === 'white' ? 255 : 0, textColor === 'white' ? 255 : 0);
          doc.setFontSize(6); // Reduced from default 8 to 6 (~25% reduction)
          doc.setFont('helvetica', 'bold');
          
          if (wrapText && text && text.length > 20 && lines.length > 0) {
            // Draw multiple lines with original spacing
            lines.forEach((line, index) => {
              const lineY = y + 6 + (index * 6); // Original line spacing
              if (align === 'right') {
                safeText(line, x + width - 3, lineY);
              } else {
                safeText(line, x + 3, lineY);
              }
            });
          } else {
            // Single line text
            if (align === 'right') {
              safeText(text, x + width - 3, y + actualHeight/2 + 3);
            } else {
              safeText(text, x + 3, y + actualHeight/2 + 3);
            }
          }
          
          doc.setTextColor(0, 0, 0); // Reset to black
          return actualHeight; // Return actual height used
        };
        
        // Header row - calculate dynamic height based on longest header
        let maxHeaderHeight = ccCellHeight;
        ccHeaders.forEach((header, i) => {
          if (header.length > 20) {
            // Use the same calculation as drawCCCell for consistency
            const maxCharsPerLine = Math.floor((ccColWidths[i] - 6) / 3.5); // 6px padding, ~3.5px per character at size 6
            
            const words = header.split(' ');
            let lines = [];
            let currentLine = '';
            
            for (const word of words) {
              const testLine = currentLine ? `${currentLine} ${word}` : word;
              if (testLine.length <= maxCharsPerLine) {
                currentLine = testLine;
              } else {
                if (currentLine) lines.push(currentLine);
                currentLine = word;
              }
            }
            if (currentLine) lines.push(currentLine);
            
            const headerHeight = ccCellHeight + (lines.length - 1) * 6 + 4; // 6px line spacing + 4px buffer
            maxHeaderHeight = Math.max(maxHeaderHeight, headerHeight);
          }
        });
        
        let ccXPos = ccTableStartX;
        ccHeaders.forEach((header, i) => {
          const needsWrapping = header.length > 20;
          drawCCCell(ccXPos, yPos, ccColWidths[i], maxHeaderHeight, header, 'darkBlue', 'white', 'center', needsWrapping);
          ccXPos += ccColWidths[i];
        });
        yPos += maxHeaderHeight;
        
        // Generate all days of the month
        // Convert month name to number if necessary
        let month = reportData.month;
        if (typeof month === 'string' && isNaN(parseInt(month))) {
          const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                             'July', 'August', 'September', 'October', 'November', 'December'];
          month = monthNames.indexOf(month) + 1;
        } else {
          month = parseInt(month);
        }
        const year = parseInt(reportData.year);
        const daysInMonth = new Date(year, month, 0).getDate();
        
        // Create a map of existing entries for quick lookup
        const entriesMap = {};
        
        (reportData.dailyEntries || []).forEach(entry => {
          if (entry.date) {
            entriesMap[entry.date] = entry;
          }
        });
        
        // Generate rows for all days of the month
        for (let day = 1; day <= daysInMonth; day++) {
          if (yPos > pageHeight - 100) {
            doc.addPage();
            yPos = margin;
          }
          
          const dateStr = `${month.toString().padStart(2, '0')}/${day.toString().padStart(2, '0')}/${year.toString().slice(-2)}`;
          const entry = entriesMap[dateStr] || {};
          
          ccXPos = ccTableStartX;
          const rowData = [
            dateStr,
            entry.description || '',
            (entry.hoursWorked || 0).toString(),
            (entry.odometerStart || 0).toString(),
            (entry.odometerEnd || 0).toString(),
            Math.round(entry.milesTraveled || 0).toString(),
            `$${(entry.mileageAmount || 0).toFixed(2)}`
          ];
          
          // Check if description needs wrapping and calculate required height
          const descriptionNeedsWrapping = (entry.description || '').length > 20;
          let maxRowHeight = ccCellHeight; // Start with base height
          
          // Calculate the height needed for the description cell if it needs wrapping
          if (descriptionNeedsWrapping) {
            // Use the same calculation as drawCCCell for consistency
            const maxCharsPerLine = Math.floor((ccColWidths[1] - 6) / 3.5); // 6px padding, ~3.5px per character at size 6
            
            const descriptionText = entry.description || '';
            // First split on explicit newlines, then apply word wrapping to each segment
            const segments = descriptionText.split('\n');
            let lines = [];
            
            segments.forEach(segment => {
              if (segment.trim()) { // Only process non-empty segments
                const words = segment.trim().split(' ');
                let currentLine = '';
                
                for (const word of words) {
                  const testLine = currentLine ? `${currentLine} ${word}` : word;
                  if (testLine.length <= maxCharsPerLine) {
                    currentLine = testLine;
                  } else {
                    if (currentLine) lines.push(currentLine);
                    currentLine = word;
                  }
                }
                if (currentLine) lines.push(currentLine);
              } else {
                // Empty segment (from \n\n) - add empty line
                lines.push('');
              }
            });
            
            // Calculate height needed: text content + one line height of padding
            maxRowHeight = 6 + (lines.length * 6) + 6; // 6px top padding + 6px per line + 6px bottom padding
          }
          
          rowData.forEach((data, i) => {
            const cellColor = i === 0 ? 'lightBlue' : 'white'; // Date column in light blue
            const textAlign = 'left'; // All data left-aligned
            const shouldWrap = i === 1 && descriptionNeedsWrapping; // Wrap description column if needed
            
            // All cells in the row should be the same height as the tallest cell
            drawCCCell(ccXPos, yPos, ccColWidths[i], maxRowHeight, data, cellColor, 'black', textAlign, shouldWrap);
            ccXPos += ccColWidths[i];
          });
          
          yPos += maxRowHeight;
        }
        
        yPos += 25;
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        safeText(`Total Miles: ${Math.round(reportData.totalMiles || 0)}`, margin, yPos);
        yPos += 18;
        safeText(`Total Hours: ${(reportData.totalHours || 0).toFixed(1)}`, margin, yPos);
        yPos += 18;
        safeText(`Total Amount: $${(reportData.totalMileageAmount || 0).toFixed(2)}`, margin, yPos);
      });
      
      // Page Last: Timesheet (with all days of month and grid)
      doc.addPage();
      yPos = margin + 20;
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      safeText('MONTHLY TIMESHEET', pageWidth / 2, yPos, { align: 'center' });
      
      yPos += 30;
      doc.setFontSize(11);
      safeText(`${reportData.name || 'N/A'} - ${reportData.month} ${reportData.year}`, pageWidth / 2, yPos, { align: 'center' });
      
      yPos += 40;
      
      // Table dimensions for Timesheet - adjusted for portrait page with proper widths (downsized by ~20% total)
      const tsCellHeight = 12; // ~20% reduction from original 15
      const tsColWidths = [48, 96, 64]; // ~20% reduction from original widths
      const tsHeaders = ['Date', 'Cost Center', 'Hours Worked'];
      
      // Calculate total table width and center it on the page
      const totalTsTableWidth = tsColWidths.reduce((sum, width) => sum + width, 0);
      const tsTableStartX = (pageWidth - totalTsTableWidth) / 2;
      
      // Helper function for Timesheet table cells
      const drawTSCell = (x, y, width, height, text, color = 'white', textColor = 'black', align = 'left') => {
        // Set fill color
        setColor(color);
        
        // Draw filled rectangle with border
        doc.rect(x, y, width, height, 'FD'); // Fill and draw border
        
        // Set text color and font
        doc.setTextColor(textColor === 'white' ? 255 : 0, textColor === 'white' ? 255 : 0, textColor === 'white' ? 255 : 0);
        doc.setFontSize(6); // Reduced from default 8 to 6 (~25% reduction)
        doc.setFont('helvetica', 'bold');
        
        if (align === 'right') {
          safeText(text, x + width - 3, y + height/2 + 3);
        } else if (align === 'center') {
          safeText(text, x + width/2, y + height/2 + 3, { align: 'center' });
        } else {
          safeText(text, x + 3, y + height/2 + 3);
        }
        
        doc.setTextColor(0, 0, 0); // Reset to black
      };
      
      // Header row
      let tsXPos = tsTableStartX;
      tsHeaders.forEach((header, i) => {
        drawTSCell(tsXPos, yPos, tsColWidths[i], tsCellHeight, header, 'darkBlue', 'white', 'center');
        tsXPos += tsColWidths[i];
      });
      yPos += tsCellHeight;
      
      // Generate all days of the month for timesheet
      // Convert month name to number if necessary
      let month = reportData.month;
      if (typeof month === 'string' && isNaN(parseInt(month))) {
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                           'July', 'August', 'September', 'October', 'November', 'December'];
        month = monthNames.indexOf(month) + 1;
      } else {
        month = parseInt(month);
      }
      const year = parseInt(reportData.year);
      const daysInMonth = new Date(year, month, 0).getDate();
      
      // Create a map of existing entries for quick lookup
      const entriesMap = {};
      (reportData.dailyEntries || []).forEach(entry => {
        if (entry.date) {
          entriesMap[entry.date] = entry;
        }
      });
      
      // Generate rows for all days of the month
      for (let day = 1; day <= daysInMonth; day++) {
        if (yPos > pageHeight - 100) {
          doc.addPage();
          yPos = margin;
        }
        
        const dateStr = `${month.toString().padStart(2, '0')}/${day.toString().padStart(2, '0')}/${year.toString().slice(-2)}`;
        const entry = entriesMap[dateStr] || {};
        
        tsXPos = tsTableStartX;
        const rowData = [
          dateStr,
          (reportData.costCenters && reportData.costCenters[0]) || 'N/A',
          (entry.hoursWorked || 0).toString()
        ];
        
        rowData.forEach((data, i) => {
          const cellColor = i === 0 ? 'lightBlue' : 'white'; // Date column in light blue
          const textAlign = i === 2 ? 'center' : 'left'; // Hours centered, others left-aligned
          drawTSCell(tsXPos, yPos, tsColWidths[i], tsCellHeight, data, cellColor, 'black', textAlign);
          tsXPos += tsColWidths[i];
        });
        
        yPos += tsCellHeight;
      }
      
      yPos += 30;
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      safeText('TIME TRACKING SUMMARY:', margin, yPos);
      yPos += 25;
      
      // Calculate dimensions for Time Tracking Summary table
      const timeTrackingTableWidth = 200;
      const timeTrackingTableStartX = (pageWidth - timeTrackingTableWidth) / 2; // Center the summary table
      const timeTrackingRowHeight = 20;
      const timeTrackingCategoryColWidth = 120; // Width for Category column
      const timeTrackingHoursColWidth = 80; // Width for Hours column
      const timeTrackingStartY = yPos;
      
      doc.setFont('helvetica', 'normal');
      
      // Get time tracking data grouped by cost center
      const timeTrackingQuery = `
        SELECT costCenter, SUM(hours) as totalHours
        FROM time_tracking 
        WHERE employeeId = ? 
        AND strftime("%m", date) = ? 
        AND strftime("%Y", date) = ?
        AND costCenter IS NOT NULL 
        AND costCenter != ''
        GROUP BY costCenter
        ORDER BY costCenter
      `;
      
      const monthStr = reportData.month.toString().padStart(2, '0');
      const yearStr = reportData.year.toString();
      
      db.all(timeTrackingQuery, [reportData.employeeId, monthStr, yearStr], (err, timeTrackingRows) => {
        if (err) {
          console.error('❌ Error fetching time tracking data:', err);
          // Fallback to empty data
          timeTrackingRows = [];
        }
        
        // Create time categories from cost centers
        const timeCategories = timeTrackingRows.map(row => [
          `${row.costCenter} Hours`,
          row.totalHours || 0
        ]);
        
        // If no time tracking data, show a default message
        if (timeCategories.length === 0) {
          timeCategories.push(['No time tracking data', 0]);
        }
        
        // Draw header row with separate cells
        doc.setFont('helvetica', 'bold');
        setColor('darkBlue');
        doc.rect(timeTrackingTableStartX, yPos, timeTrackingCategoryColWidth, timeTrackingRowHeight, 'FD');
        doc.rect(timeTrackingTableStartX + timeTrackingCategoryColWidth, yPos, timeTrackingHoursColWidth, timeTrackingRowHeight, 'FD');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(8);
        safeText('Category', timeTrackingTableStartX + 10, yPos + timeTrackingRowHeight/2 + 3);
        safeText('Hours', timeTrackingTableStartX + timeTrackingCategoryColWidth + 10, yPos + timeTrackingRowHeight/2 + 3);
        yPos += timeTrackingRowHeight;
        
        // Draw data rows with separate cells
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(7);
        
        timeCategories.forEach(([category, hours]) => {
          setColor('white');
          doc.rect(timeTrackingTableStartX, yPos, timeTrackingCategoryColWidth, timeTrackingRowHeight, 'FD');
          doc.rect(timeTrackingTableStartX + timeTrackingCategoryColWidth, yPos, timeTrackingHoursColWidth, timeTrackingRowHeight, 'FD');
          safeText(`${category}:`, timeTrackingTableStartX + 10, yPos + timeTrackingRowHeight/2 + 3);
          safeText(`${hours} hours`, timeTrackingTableStartX + timeTrackingCategoryColWidth + 10, yPos + timeTrackingRowHeight/2 + 3);
          yPos += timeTrackingRowHeight;
        });
        
        // Draw total row with separate cells
        doc.setFont('helvetica', 'bold');
        setColor('lightBlue');
        doc.rect(timeTrackingTableStartX, yPos, timeTrackingCategoryColWidth, timeTrackingRowHeight, 'FD');
        doc.rect(timeTrackingTableStartX + timeTrackingCategoryColWidth, yPos, timeTrackingHoursColWidth, timeTrackingRowHeight, 'FD');
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(8);
        safeText('Total Hours:', timeTrackingTableStartX + 10, yPos + timeTrackingRowHeight/2 + 3);
        safeText(`${reportData.totalHours || 0} hours`, timeTrackingTableStartX + timeTrackingCategoryColWidth + 10, yPos + timeTrackingRowHeight/2 + 3);
        yPos += timeTrackingRowHeight;
        
        // Generate filename matching Staff Portal format
        const nameParts = (reportData.name || 'UNKNOWN').split(' ');
        const lastName = nameParts[nameParts.length - 1] || 'UNKNOWN';
        const firstName = nameParts[0] || 'UNKNOWN';
        const monthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
        const monthIndex = parseInt(report.month) - 1;
        const monthAbbr = monthNames[monthIndex] || 'UNK';
        const yearShort = report.year.toString().slice(-2);
        const filename = `${lastName.toUpperCase()},${firstName.toUpperCase()} EXPENSES ${monthAbbr}-${yearShort}.pdf`;
        
        // Get PDF as buffer
        const pdfBuffer = Buffer.from(doc.output('arraybuffer'));
        
        // Set response headers
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        
        // Send buffer
        res.send(pdfBuffer);
        
        console.log(`✅ Exported expense report to PDF: ${filename}`);
      }); // Close database callback
    } catch (error) {
      console.error('❌ Error exporting report to PDF:', error);
      res.status(500).json({ error: 'Failed to generate PDF' });
    }
  });
});

// Convert HTML to PDF endpoint (for Finance Portal Export)
app.post('/api/export/html-to-pdf', (req, res) => {
  try {
    const { html } = req.body;
    
    if (!html) {
      return res.status(400).json({ error: 'HTML content is required' });
    }
    
    console.log('📄 Converting HTML to PDF for Finance Portal Export');
    
    // For now, we'll use a simple approach - return the HTML as a downloadable file
    // In a production environment, you'd want to use a proper HTML-to-PDF library like Puppeteer
    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Content-Disposition', 'attachment; filename="expense-report.html"');
    res.send(html);
    
    console.log('✅ HTML export completed');
  } catch (error) {
    console.error('❌ Error converting HTML to PDF:', error);
    res.status(500).json({ error: 'Failed to convert HTML to PDF' });
  }
});

// Health check endpoint for mobile app
app.get('/api/health', (req, res) => {
  res.json({ 
    message: 'Oxford House Mileage Tracker Backend API', 
    status: 'running',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Serve the admin interface
app.get('/', (req, res) => {
  res.json({ message: 'Oxford House Mileage Tracker Backend API', status: 'running' });
});

// Error handling middleware
// ===== AUTHENTICATION ENDPOINTS =====

// Login endpoint
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  
  if (!email || !password) {
    return res.status(400).json({ 
      error: 'Email and password are required' 
    });
  }
  
  // Find employee by email
  db.get(
    'SELECT * FROM employees WHERE email = ?',
    [email],
    (err, employee) => {
      if (err) {
        console.error('Login error:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      
      if (!employee) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      
      // Check password (plain text for now - should hash in production!)
      if (employee.password !== password) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      
      // Parse JSON fields
      let costCenters = [];
      let selectedCostCenters = [];
      
      try {
        if (employee.costCenters) {
          costCenters = JSON.parse(employee.costCenters);
        }
        if (employee.selectedCostCenters) {
          selectedCostCenters = JSON.parse(employee.selectedCostCenters);
        }
      } catch (parseErr) {
        console.error('Error parsing cost centers:', parseErr);
      }
      
      // Don't send password back to client
      const { password: _, ...employeeData } = employee;
      
      // Create session token (simple for now - use JWT in production)
      const sessionToken = `session_${employee.id}_${Date.now()}`;
      
      res.json({
        success: true,
        message: 'Login successful',
        employee: {
          ...employeeData,
          costCenters,
          selectedCostCenters
        },
        token: sessionToken
      });
    }
  );
});

// Verify session endpoint
app.get('/api/auth/verify', (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }
  
  // Extract employee ID from token (simple parsing for now)
  const employeeId = token.split('_')[1];
  
  if (!employeeId) {
    return res.status(401).json({ error: 'Invalid token' });
  }
  
  // Verify employee exists
  db.get(
    'SELECT * FROM employees WHERE id = ?',
    [employeeId],
    (err, employee) => {
      if (err || !employee) {
        return res.status(401).json({ error: 'Invalid session' });
      }
      
      // Parse JSON fields
      let costCenters = [];
      let selectedCostCenters = [];
      
      try {
        if (employee.costCenters) {
          costCenters = JSON.parse(employee.costCenters);
        }
        if (employee.selectedCostCenters) {
          selectedCostCenters = JSON.parse(employee.selectedCostCenters);
        }
      } catch (parseErr) {
        console.error('Error parsing cost centers:', parseErr);
      }
      
      const { password: _, ...employeeData } = employee;
      
      res.json({
        valid: true,
        employee: {
          ...employeeData,
          costCenters,
          selectedCostCenters
        }
      });
    }
  );
});

// Logout endpoint
app.post('/api/auth/logout', (req, res) => {
  // For now, just return success (client will clear token)
  // In production, you'd invalidate the token in a blacklist/cache
  res.json({
    success: true,
    message: 'Logged out successfully'
  });
});

// Mobile app login endpoint (same as auth/login but with different response format)
app.post('/api/employee-login', (req, res) => {
  const { email, password } = req.body;
  
  if (!email || !password) {
    return res.status(400).json({ 
      error: 'Email and password are required' 
    });
  }
  
  // Find employee by email
  db.get(
    'SELECT * FROM employees WHERE email = ?',
    [email],
    (err, employee) => {
      if (err) {
        console.error('Employee login error:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      
      if (!employee) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      
      // Check password (plain text for now - should hash in production!)
      if (employee.password !== password) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      
      // Parse JSON fields
      let costCenters = [];
      let selectedCostCenters = [];
      
      try {
        if (employee.costCenters) {
          costCenters = JSON.parse(employee.costCenters);
        }
        if (employee.selectedCostCenters) {
          selectedCostCenters = JSON.parse(employee.selectedCostCenters);
        }
      } catch (parseErr) {
        console.error('Error parsing cost centers:', parseErr);
      }
      
      // Don't send password back to client
      const { password: _, ...employeeData } = employee;
      
      // Return employee data in format expected by mobile app
      res.json({
        ...employeeData,
        costCenters,
        selectedCostCenters
      });
    }
  );
});

app.use((err, req, res, next) => {
  const timestamp = new Date().toISOString();
  console.error(`[${timestamp}] Error:`, err.stack);
  
  // Don't leak error details in production
  const errorMessage = process.env.NODE_ENV === 'production' 
    ? 'Something went wrong!' 
    : err.message;
    
  res.status(500).json({ 
    error: errorMessage,
    timestamp,
    path: req.path,
    method: req.method
  });
});

// Function to seed test accounts
async function seedTestAccounts() {
  const testAccounts = [
    {
      id: 'greg-weisz-001',
      name: 'Greg Weisz',
      preferredName: 'Greg',
      email: 'greg.weisz@oxfordhouse.org',
      password: 'ImtheBoss5!',
      oxfordHouseId: 'oxford-house-001',
      position: 'Senior Data Analyst/Administrator',
      phoneNumber: '(555) 123-4567',
      baseAddress: '230 Wagner St, Troutman, NC 28166',
      costCenters: JSON.stringify(['PS-Unfunded', 'PS-Funded', 'Administrative', 'Training', 'Direct Care', 'Travel', 'Other']),
      selectedCostCenters: JSON.stringify(['PS-Unfunded', 'PS-Funded', 'Administrative', 'Training', 'Direct Care', 'Travel', 'Other']),
      defaultCostCenter: 'PS-Unfunded'
    },
    {
      id: 'jackson-longan-001',
      name: 'Jackson Longan',
      preferredName: 'Jackson',
      email: 'jackson.longan@oxfordhouse.org',
      password: 'Jacksonwelcome1',
      oxfordHouseId: 'oxford-house-002',
      position: 'Director of Communication and Information/Administrator',
      phoneNumber: '(555) 345-6789',
      baseAddress: '123 Main St, Oklahoma City, OK 73101',
      costCenters: JSON.stringify(['PS-Unfunded', 'PS-Funded', 'Administrative']),
      selectedCostCenters: JSON.stringify(['PS-Unfunded', 'PS-Funded', 'Administrative']),
      defaultCostCenter: 'Administrative'
    },
    {
      id: 'kathleen-gibson-001',
      name: 'Kathleen Gibson',
      preferredName: 'Kathleen',
      email: 'kathleen.gibson@oxfordhouse.org',
      password: 'Kathleenwelcome1',
      oxfordHouseId: 'oxford-house-003',
      position: 'CEO/Administrator',
      phoneNumber: '(555) 234-5678',
      baseAddress: '9016 Mustard Seed Ln, Garner, NC 27529',
      costCenters: JSON.stringify(['PS-Unfunded', 'PS-Funded', 'Administrative', 'Training', 'Direct Care', 'Travel', 'Other']),
      selectedCostCenters: JSON.stringify(['PS-Unfunded']),
      defaultCostCenter: 'PS-Unfunded'
    },
    {
      id: 'alex-szary-001',
      name: 'Alex Szary',
      preferredName: 'Alex',
      email: 'alex.szary@oxfordhouse.org',
      password: 'Alexwelcome1',
      oxfordHouseId: 'oxford-house-004',
      position: 'Senior Manager of Data and Analytics/Administrator',
      phoneNumber: '(555) 456-7890',
      baseAddress: '456 Oak St, Austin, TX 78701',
      costCenters: JSON.stringify(['PS-Unfunded', 'PS-Funded', 'Administrative']),
      selectedCostCenters: JSON.stringify(['PS-Unfunded', 'PS-Funded', 'Administrative']),
      defaultCostCenter: 'Administrative'
    }
  ];

  const promises = testAccounts.map(account => {
    return new Promise((resolve, reject) => {
      const sql = `INSERT OR REPLACE INTO employees (
        id, name, preferredName, email, password, oxfordHouseId, position,
        phoneNumber, baseAddress, costCenters, selectedCostCenters,
        defaultCostCenter, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`;
      
      db.run(sql, [
        account.id, account.name, account.preferredName, account.email,
        account.password, account.oxfordHouseId, account.position,
        account.phoneNumber, account.baseAddress, account.costCenters,
        account.selectedCostCenters, account.defaultCostCenter
      ], (err) => {
        if (err) {
          console.error(`❌ Failed to create ${account.name}:`, err);
          reject(err);
        } else {
          console.log(`✅ Created/Updated ${account.name}`);
          resolve();
        }
      });
    });
  });

  await Promise.all(promises);
}

// Function to clean up duplicate entries (Second occurrence - should match first)
async function cleanupDuplicates2() {
  return new Promise(async (resolve, reject) => {
    try {
      console.log('🧹 Cleaning up duplicate entries (secondary cleanup)...');
      
      // Clean up duplicate employees (keep the most recently updated one)
      await new Promise((resolveE, rejectE) => {
        db.run(`
          DELETE FROM employees 
          WHERE id NOT IN (
            SELECT id FROM (
              SELECT id, ROW_NUMBER() OVER (
                PARTITION BY email 
                ORDER BY updatedAt DESC
              ) as rn
              FROM employees
            ) WHERE rn = 1
          )
        `, (err) => {
          if (err) {
            console.error('❌ Error cleaning up duplicate employees:', err);
            rejectE(err);
          } else {
            db.get('SELECT COUNT(*) as count FROM employees', (countErr, row) => {
              if (!countErr) {
                console.log(`✅ Duplicate employees cleaned up - ${row.count} remaining`);
              }
              resolveE();
            });
          }
        });
      });
      
      // Clean up duplicate mileage entries
      await new Promise((resolveM, rejectM) => {
        db.run(`
          DELETE FROM mileage_entries 
          WHERE id NOT IN (
            SELECT id FROM (
              SELECT id, ROW_NUMBER() OVER (
                PARTITION BY employeeId, date, startLocation, endLocation, miles 
                ORDER BY createdAt DESC
              ) as rn
              FROM mileage_entries
            ) WHERE rn = 1
          )
        `, (err) => {
          if (err) {
            console.error('❌ Error cleaning up duplicate mileage entries:', err);
            rejectM(err);
          } else {
            db.get('SELECT COUNT(*) as count FROM mileage_entries', (countErr, row) => {
              if (!countErr) {
                console.log(`✅ Duplicate mileage entries cleaned up - ${row.count} remaining`);
              }
              resolveM();
            });
          }
        });
      });
      
      // Clean up duplicate time tracking entries
      await new Promise((resolveT, rejectT) => {
        db.run(`
          DELETE FROM time_tracking 
          WHERE id NOT IN (
            SELECT id FROM (
              SELECT id, ROW_NUMBER() OVER (
                PARTITION BY employeeId, date, category, hours 
                ORDER BY createdAt DESC
              ) as rn
              FROM time_tracking
            ) WHERE rn = 1
          )
        `, (err) => {
          if (err) {
            console.error('❌ Error cleaning up duplicate time tracking entries:', err);
            rejectT(err);
          } else {
            db.get('SELECT COUNT(*) as count FROM time_tracking', (countErr, row) => {
              if (!countErr) {
                console.log(`✅ Duplicate time tracking entries cleaned up - ${row.count} remaining`);
              }
              resolveT();
            });
          }
        });
      });
      
      console.log('✅ Duplicate cleanup completed');
      resolve();
    } catch (error) {
      console.error('❌ Error during cleanup:', error);
      reject(error);
    }
  });
}


// Function to seed test accounts
async function seedTestAccounts() {
  const testAccounts = [
    {
      id: 'greg-weisz-001',
      name: 'Greg Weisz',
      preferredName: 'Greg',
      email: 'greg.weisz@oxfordhouse.org',
      password: 'ImtheBoss5!',
      oxfordHouseId: 'oxford-house-001',
      position: 'Senior Data Analyst/Administrator',
      phoneNumber: '(555) 123-4567',
      baseAddress: '230 Wagner St, Troutman, NC 28166',
      costCenters: JSON.stringify(['Program Services', 'Finance', 'CORPORATE']),
      selectedCostCenters: JSON.stringify(['Program Services', 'Finance', 'CORPORATE']),
      defaultCostCenter: 'Program Services'
    },
    {
      id: 'jackson-longan-001',
      name: 'Jackson Longan',
      preferredName: 'Jackson',
      email: 'jackson.longan@oxfordhouse.org',
      password: 'Jacksonwelcome1',
      oxfordHouseId: 'oxford-house-002',
      position: 'Director of Communication and Information/Administrator',
      phoneNumber: '(555) 345-6789',
      baseAddress: '123 Main St, Oklahoma City, OK 73101',
      costCenters: JSON.stringify(['Program Services', 'OK-SUBG', 'CORPORATE']),
      selectedCostCenters: JSON.stringify(['Program Services', 'OK-SUBG', 'CORPORATE']),
      defaultCostCenter: 'Program Services'
    },
    {
      id: 'kathleen-gibson-001',
      name: 'Kathleen Gibson',
      preferredName: 'Kathleen',
      email: 'kathleen.gibson@oxfordhouse.org',
      password: 'Kathleenwelcome1',
      oxfordHouseId: 'oxford-house-003',
      position: 'CEO/Administrator',
      phoneNumber: '(555) 234-5678',
      baseAddress: '9016 Mustard Seed Ln, Garner, NC 27529',
      costCenters: JSON.stringify(['Program Services', 'Finance', 'CORPORATE']),
      selectedCostCenters: JSON.stringify(['Program Services', 'Finance', 'CORPORATE']),
      defaultCostCenter: 'Program Services'
    },
    {
      id: 'alex-szary-001',
      name: 'Alex Szary',
      preferredName: 'Alex',
      email: 'alex.szary@oxfordhouse.org',
      password: 'Alexwelcome1',
      oxfordHouseId: 'oxford-house-004',
      position: 'Senior Manager of Data and Analytics/Administrator',
      phoneNumber: '(555) 456-7890',
      baseAddress: '456 Oak St, Austin, TX 78701',
      costCenters: JSON.stringify(['Program Services', 'TX-SUBG', 'CORPORATE']),
      selectedCostCenters: JSON.stringify(['Program Services', 'TX-SUBG', 'CORPORATE']),
      defaultCostCenter: 'Program Services'
    }
  ];

  console.log('👥 Setting up test accounts...');

  for (const account of testAccounts) {
    try {
      // Check if account already exists
      const existingAccount = await new Promise((resolve, reject) => {
        db.get(
          'SELECT id FROM employees WHERE id = ? OR email = ?',
          [account.id, account.email],
          (err, row) => {
            if (err) reject(err);
            else resolve(row);
          }
        );
      });

      const now = new Date().toISOString();

      if (existingAccount) {
        console.log(`🔄 ${account.name} already exists, updating...`);
        
        // Update existing account
        await new Promise((resolve, reject) => {
          db.run(
            `UPDATE employees SET 
              name = ?,
              preferredName = ?,
              email = ?,
              password = ?,
              oxfordHouseId = ?,
              position = ?,
              phoneNumber = ?,
              baseAddress = ?,
              costCenters = ?,
              selectedCostCenters = ?,
              defaultCostCenter = ?,
              updatedAt = ?
            WHERE id = ?`,
            [
              account.name,
              account.preferredName,
              account.email,
              account.password,
              account.oxfordHouseId,
              account.position,
              account.phoneNumber,
              account.baseAddress,
              account.costCenters,
              account.selectedCostCenters,
              account.defaultCostCenter,
              now,
              account.id
            ],
            (err) => {
              if (err) reject(err);
              else resolve();
            }
          );
        });
      } else {
        console.log(`➕ Creating new account for ${account.name}...`);
        
        // Insert new account
        await new Promise((resolve, reject) => {
          db.run(
            `INSERT INTO employees (
              id, name, preferredName, email, password, oxfordHouseId, position, 
              phoneNumber, baseAddress, costCenters, selectedCostCenters, 
              defaultCostCenter, createdAt, updatedAt
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              account.id,
              account.name,
              account.preferredName,
              account.email,
              account.password,
              account.oxfordHouseId,
              account.position,
              account.phoneNumber,
              account.baseAddress,
              account.costCenters,
              account.selectedCostCenters,
              account.defaultCostCenter,
              now,
              now
            ],
            (err) => {
              if (err) reject(err);
              else resolve();
            }
          );
        });
      }
      
      console.log(`✅ ${account.name} processed successfully`);
    } catch (error) {
      console.error(`❌ Error processing ${account.name}:`, error);
    }
  }

  console.log('🎉 All test accounts processed!');
}

// Initialize database and start server
console.log('🚀 Starting server initialization...');
console.log(`📊 Database path: ${DB_PATH}`);
console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);

initDatabase().then(async () => {
  console.log('✅ Database initialization completed');
  
  // Always ensure test accounts exist (both local and production)
  console.log('🔧 Creating test accounts...');
  try {
    await seedTestAccounts();
    console.log('✅ Test accounts created successfully');
  } catch (error) {
    console.error('❌ Error creating test accounts:', error);
  }
  
  console.log('🌐 Starting HTTP server...');
  server.listen(PORT, () => {
    console.log(`🚀 Backend server running on http://localhost:${PORT}`);
    console.log(`🔌 WebSocket server running on ws://localhost:${PORT}/ws`);
    console.log(`📊 Database path: ${DB_PATH}`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log('✅ Server startup completed successfully!');
  });
}).catch(err => {
  console.error('❌ Failed to initialize database:', err);
  console.error('❌ Full error details:', err.stack);
  process.exit(1);
});

module.exports = app;
