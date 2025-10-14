const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
const multer = require('multer');
const XLSX = require('xlsx');
const http = require('http');
const WebSocket = require('ws');

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
    'https://oxford-mileage-tracker-git-main-gregweisz-cmd.vercel.app'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cache-Control', 'Pragma']
}));
app.use(express.json({ limit: '10mb' })); // Increase JSON payload limit
app.use(express.static('public'));

// Handle preflight OPTIONS requests
app.options('*', (req, res) => {
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
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
    database: db ? 'connected' : 'not connected'
  });
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
  : path.join(__dirname, '../../oxford_tracker.db');

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
      'INSERT INTO employees (id, name, email, password, oxfordHouseId, position, phoneNumber, baseAddress, baseAddress2, costCenters, selectedCostCenters, defaultCostCenter, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
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
  const { name, email, oxfordHouseId, position, phoneNumber, baseAddress, baseAddress2, costCenters } = req.body;
  const id = Date.now().toString(36) + Math.random().toString(36).substr(2);
  const now = new Date().toISOString();

  db.run(
    'INSERT INTO employees (id, name, email, oxfordHouseId, position, phoneNumber, baseAddress, baseAddress2, costCenters, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [id, name, email, oxfordHouseId, position, phoneNumber, baseAddress, baseAddress2 || '', costCenters || '[]', now, now],
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
  const { name, preferredName, email, oxfordHouseId, position, phoneNumber, baseAddress, baseAddress2, costCenters, selectedCostCenters, defaultCostCenter, signature } = req.body;
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
    'UPDATE employees SET name = ?, preferredName = ?, email = ?, oxfordHouseId = ?, position = ?, phoneNumber = ?, baseAddress = ?, baseAddress2 = ?, costCenters = ?, selectedCostCenters = ?, defaultCostCenter = ?, signature = ?, updatedAt = ? WHERE id = ?',
    [name, preferredName || '', email, oxfordHouseId || '', position, phoneNumber, baseAddress, baseAddress2 || '', 
     typeof costCenters === 'string' ? costCenters : JSON.stringify(costCenters || []),
     typeof selectedCostCenters === 'string' ? selectedCostCenters : JSON.stringify(selectedCostCenters || []),
     defaultCostCenter || '', signature || null, now, id],
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

  db.run(
    'INSERT OR REPLACE INTO receipts (id, employeeId, date, amount, vendor, description, category, imageUri, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, COALESCE((SELECT createdAt FROM receipts WHERE id = ?), ?), ?)',
    [receiptId, employeeId, date, amount, vendor || '', description || '', category || '', imageUri || '', receiptId, now, now],
    function(err) {
      if (err) {
        console.error('Database error:', err.message);
        res.status(500).json({ error: err.message });
        return;
      }
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
  const { id, employeeId, date, category, hours, description } = req.body;
  const trackingId = id || (Date.now().toString(36) + Math.random().toString(36).substr(2));
  const now = new Date().toISOString();

  db.run(
    'INSERT OR REPLACE INTO time_tracking (id, employeeId, date, category, hours, description, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, COALESCE((SELECT createdAt FROM time_tracking WHERE id = ?), ?), ?)',
    [trackingId, employeeId, date, category || '', hours, description || '', trackingId, now, now],
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
  const { employeeId, date, category, hours, description } = req.body;
  const now = new Date().toISOString();

  db.run(
    'UPDATE time_tracking SET employeeId = ?, date = ?, category = ?, hours = ?, description = ?, updatedAt = ? WHERE id = ?',
    [employeeId, date, category || '', hours, description || '', now, id],
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

// Get all per diem rules
app.get('/api/per-diem-rules', (req, res) => {
  db.all('SELECT * FROM per_diem_rules ORDER BY costCenter', (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

// Create/Update per diem rule
app.post('/api/per-diem-rules', (req, res) => {
  const { costCenter, maxAmount, minHours, minMiles, minDistanceFromBase, description } = req.body;
  const id = Date.now().toString(36) + Math.random().toString(36).substr(2);
  const now = new Date().toISOString();

  // Check if rule already exists for this cost center
  db.get('SELECT id FROM per_diem_rules WHERE costCenter = ?', [costCenter], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }

    if (row) {
      // Update existing rule
      db.run(
        'UPDATE per_diem_rules SET maxAmount = ?, minHours = ?, minMiles = ?, minDistanceFromBase = ?, description = ?, updatedAt = ? WHERE costCenter = ?',
        [maxAmount, minHours, minMiles, minDistanceFromBase, description, now, costCenter],
        function(err) {
          if (err) {
            res.status(500).json({ error: err.message });
            return;
          }
          res.json({ message: 'Per diem rule updated successfully' });
        }
      );
    } else {
      // Create new rule
      db.run(
        'INSERT INTO per_diem_rules (id, costCenter, maxAmount, minHours, minMiles, minDistanceFromBase, description, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [id, costCenter, maxAmount, minHours, minMiles, minDistanceFromBase, description, now, now],
        function(err) {
          if (err) {
            res.status(500).json({ error: err.message });
            return;
          }
          res.json({ id, message: 'Per diem rule created successfully' });
        }
      );
    }
  });
});

// Delete per diem rule
app.delete('/api/per-diem-rules/:costCenter', (req, res) => {
  const { costCenter } = req.params;
  db.run('DELETE FROM per_diem_rules WHERE costCenter = ?', [costCenter], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ message: 'Per diem rule deleted successfully' });
  });
});

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
        
        // Sync time tracking data
        if (entry.hoursWorked > 0) {
          await new Promise((resolve, reject) => {
            db.all(
              'SELECT * FROM time_tracking WHERE employeeId = ? AND date(date) = date(?)',
              [employeeId, dateStr],
              async (err, rows) => {
                if (err) {
                  reject(err);
                  return;
                }
                
                // If we found existing entries, update the first one
                if (rows && rows.length > 0) {
                  const row = rows[0];
                  await new Promise((resolveUpdate, rejectUpdate) => {
                    db.run(
                      `UPDATE time_tracking 
                       SET hours = ?, description = ?, updatedAt = datetime('now')
                       WHERE id = ?`,
                      [entry.hoursWorked, entry.description || row.description, row.id],
                      (updateErr) => {
                        if (updateErr) rejectUpdate(updateErr);
                        else {
                          console.log(`✅ Updated time tracking entry ${row.id} for date ${dateStr}`);
                          resolveUpdate();
                        }
                      }
                    );
                  });
                } else if (entry.hoursWorked > 0) {
                  // Create new time tracking entry if one doesn't exist
                  const id = Date.now().toString(36) + Math.random().toString(36).substr(2);
                  const now = new Date().toISOString();
                  
                  await new Promise((resolveInsert, rejectInsert) => {
                    db.run(
                      `INSERT INTO time_tracking (id, employeeId, date, category, hours, description, createdAt, updatedAt)
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                      [id, employeeId, dateStr, 'Regular Hours', entry.hoursWorked, entry.description || '', now, now],
                      (insertErr) => {
                        if (insertErr) rejectInsert(insertErr);
                        else {
                          console.log(`✅ Created new time tracking entry for date ${dateStr}`);
                          resolveInsert();
                        }
                      }
                    );
                  });
                }
                resolve();
              }
            );
          });
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

// Function to clean up duplicate entries
async function cleanupDuplicates() {
  return new Promise(async (resolve, reject) => {
    try {
      console.log('🧹 Cleaning up duplicate entries...');
      
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

// Initialize database
async function initDatabase() {
  return new Promise((resolve, reject) => {
    db = new sqlite3.Database(DB_PATH, (err) => {
      if (err) {
        console.error('❌ Failed to connect to database:', err);
        reject(err);
        return;
      }
      console.log('✅ Connected to SQLite database');
      
      // Create tables
      const createTables = `
        CREATE TABLE IF NOT EXISTS employees (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          preferredName TEXT DEFAULT '',
          email TEXT UNIQUE NOT NULL,
          password TEXT NOT NULL,
          oxfordHouseId TEXT,
          position TEXT,
          phoneNumber TEXT,
          baseAddress TEXT,
          baseAddress2 TEXT DEFAULT '',
          costCenters TEXT DEFAULT '[]',
          selectedCostCenters TEXT DEFAULT '[]',
          defaultCostCenter TEXT DEFAULT '',
          signature TEXT,
          createdAt TEXT,
          updatedAt TEXT
        );
        
        CREATE TABLE IF NOT EXISTS mileage_entries (
          id TEXT PRIMARY KEY,
          employeeId TEXT NOT NULL,
          date TEXT NOT NULL,
          startLocation TEXT,
          endLocation TEXT,
          miles REAL,
          odometerReading REAL,
          costCenter TEXT,
          notes TEXT,
          isGpsTracked INTEGER DEFAULT 0,
          hoursWorked REAL DEFAULT 0,
          createdAt TEXT,
          updatedAt TEXT,
          FOREIGN KEY (employeeId) REFERENCES employees (id)
        );
        
        CREATE TABLE IF NOT EXISTS receipts (
          id TEXT PRIMARY KEY,
          employeeId TEXT NOT NULL,
          date TEXT NOT NULL,
          amount REAL,
          category TEXT,
          description TEXT,
          createdAt TEXT,
          updatedAt TEXT,
          FOREIGN KEY (employeeId) REFERENCES employees (id)
        );
        
        CREATE TABLE IF NOT EXISTS time_tracking (
          id TEXT PRIMARY KEY,
          employeeId TEXT NOT NULL,
          date TEXT NOT NULL,
          category TEXT,
          hours REAL,
          createdAt TEXT,
          updatedAt TEXT,
          FOREIGN KEY (employeeId) REFERENCES employees (id)
        );
        
        CREATE TABLE IF NOT EXISTS daily_descriptions (
          id TEXT PRIMARY KEY,
          employeeId TEXT NOT NULL,
          date TEXT NOT NULL,
          description TEXT,
          createdAt TEXT,
          updatedAt TEXT,
          FOREIGN KEY (employeeId) REFERENCES employees (id)
        );
        
        CREATE TABLE IF NOT EXISTS oxford_houses (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          address TEXT,
          city TEXT,
          state TEXT,
          zip TEXT,
          createdAt TEXT,
          updatedAt TEXT
        );
      `;
      
      db.exec(createTables, (err) => {
        if (err) {
          console.error('❌ Error creating tables:', err);
          reject(err);
          return;
        }
        console.log('✅ Database tables created/verified');
        
        // Clean up duplicates
        cleanupDuplicates().then(() => {
          resolve();
        }).catch(reject);
      });
    });
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
