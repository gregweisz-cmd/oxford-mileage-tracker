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
const os = require('os');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });
const PORT = process.env.PORT || 3002;

// Get network IP addresses for mobile device access
function getNetworkIPs() {
  const interfaces = os.networkInterfaces();
  const ips = [];
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      // Skip internal (loopback) and non-IPv4 addresses
      if (iface.family === 'IPv4' && !iface.internal) {
        ips.push(iface.address);
      }
    }
  }
  return ips;
}

// Middleware - CORS configuration (allow all origins for mobile apps)
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:3001', 
    'https://oxford-mileage-tracker.vercel.app',
    'https://oxford-mileage-tracker-git-main-gregweisz-cmd.vercel.app',
    'https://oxford-mileage-tracker-git-main-goose-weiszs-projects.vercel.app'
    ];
    
    // Allow mobile app origins (React Native, Expo, etc.)
    if (origin.includes('localhost') || origin.includes('192.168.') || origin.includes('10.0.') || origin.includes('172.')) {
      return callback(null, true);
    }
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      // Allow all origins in development for mobile app testing
      if (process.env.NODE_ENV !== 'production') {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cache-Control', 'Pragma', 'X-Requested-With']
}));
app.use(express.json({ limit: '10mb' })); // Increase JSON payload limit
app.use(express.static('public'));

// Handle preflight OPTIONS requests
app.options('*', (req, res) => {
  const origin = req.headers.origin;
  
  // Allow all origins in development, or specific ones in production
  if (!origin || process.env.NODE_ENV !== 'production') {
    res.header('Access-Control-Allow-Origin', origin || '*');
  } else {
  const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:3001', 
    'https://oxford-mileage-tracker.vercel.app',
    'https://oxford-mileage-tracker-git-main-gregweisz-cmd.vercel.app',
    'https://oxford-mileage-tracker-git-main-goose-weiszs-projects.vercel.app'
  ];
  
    if (allowedOrigins.includes(origin) || origin.includes('192.168.') || origin.includes('10.0.') || origin.includes('172.')) {
    res.header('Access-Control-Allow-Origin', origin);
  } else {
    res.header('Access-Control-Allow-Origin', '*');
    }
  }
  
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Cache-Control, Pragma, X-Requested-With');
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

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log('📁 Created uploads directory');
}

// Serve uploaded files statically
app.use('/uploads', express.static(uploadsDir));

// Multer configuration for file uploads
const upload = multer({ dest: uploadsDir });

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

// Get all employees supervised by a supervisor (directly and indirectly) - Promise based
function getAllSupervisedEmployees(supervisorId) {
  return new Promise((resolve, reject) => {
    const supervisedEmployees = new Set();
    const visited = new Set();
    
    function findSupervisedRecursive(currentSupervisorId) {
      // Prevent infinite loops
      if (visited.has(currentSupervisorId)) {
        return Promise.resolve();
      }
      visited.add(currentSupervisorId);
      
      return new Promise((innerResolve, innerReject) => {
        // Find direct reports
        db.all(
          'SELECT id FROM employees WHERE supervisorId = ?',
          [currentSupervisorId],
          (err, rows) => {
            if (err) {
              console.error('Error finding supervised employees:', err);
              innerReject(err);
              return;
            }
            
            // Add direct reports
            rows.forEach(row => {
              supervisedEmployees.add(row.id);
            });
            
            // Recursively find reports of reports
            const promises = rows.map(row => findSupervisedRecursive(row.id));
            
            // Wait for all recursive calls to complete
            Promise.all(promises).then(() => {
              innerResolve();
            }).catch(innerReject);
          }
        );
      });
    }
    
    // Start recursive search
    findSupervisedRecursive(supervisorId)
      .then(() => {
        resolve(Array.from(supervisedEmployees));
      })
      .catch(reject);
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

// REMOVED: cleanupDuplicates() function - too dangerous, deleted 250 employees
// This function was automatically deleting employees with same emails
// We'll handle duplicates manually if needed

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
        approvalFrequency TEXT DEFAULT 'monthly',
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
        costCenter TEXT DEFAULT '',
        startLocationName TEXT DEFAULT '',
        startLocationAddress TEXT DEFAULT '',
        startLocationLat REAL DEFAULT 0,
        startLocationLng REAL DEFAULT 0,
        endLocationName TEXT DEFAULT '',
        endLocationAddress TEXT DEFAULT '',
        endLocationLat REAL DEFAULT 0,
        endLocationLng REAL DEFAULT 0,
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
        costCenter TEXT DEFAULT '',
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
        costCenter TEXT DEFAULT '',
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

// Upload receipt image - accepts both multipart/form-data and JSON with base64
app.post('/api/receipts/upload-image', (req, res, next) => {
  console.log(`📤 Receipt image upload request received at ${new Date().toISOString()}`);
  console.log(`   Method: ${req.method}`);
  console.log(`   URL: ${req.url}`);
  console.log(`   Content-Type: ${req.headers['content-type'] || 'not set'}`);
  console.log(`   Body keys: ${Object.keys(req.body || {})}`);
  console.log(`   Query: ${JSON.stringify(req.query)}`);
  
  // Check if this is JSON (base64) or multipart
  if (req.headers['content-type'] && req.headers['content-type'].includes('application/json')) {
    // Handle base64 image in JSON body
    next();
  } else {
    // Handle multipart/form-data file upload
    upload.single('image')(req, res, (err) => {
      if (err) {
        console.error(`❌ Multer error:`, err);
        return res.status(400).json({ error: 'File upload error: ' + err.message });
      }
      next();
    });
  }
}, (req, res) => {
  console.log(`📤 Receipt image upload processing started`);
  console.log(`   Content-Type: ${req.headers['content-type'] || 'not set'}`);
  console.log(`   Body keys after parsing: ${Object.keys(req.body || {})}`);
  console.log(`   File: ${req.file ? 'present' : 'missing'}`);
  console.log(`   Files: ${req.files ? JSON.stringify(Object.keys(req.files)) : 'none'}`);
  
  // Handle base64 image in JSON body
  if (req.body && (req.body.image || req.body.imageData || req.body.base64)) {
    try {
      const base64Data = req.body.image || req.body.imageData || req.body.base64;
      const receiptId = req.body.receiptId || 'unknown';
      
      // Remove data URL prefix if present (data:image/jpeg;base64,...)
      const base64String = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;
      
      // Save base64 image to file
      const imageBuffer = Buffer.from(base64String, 'base64');
      const fileExtension = req.body.extension || '.jpg';
      const uniqueFilename = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}${fileExtension}`;
      const imagePath = path.join(uploadsDir, uniqueFilename);
      
      fs.writeFileSync(imagePath, imageBuffer);
      
      console.log(`📷 Receipt image uploaded from base64: ${uniqueFilename} (${imageBuffer.length} bytes) for receipt ${receiptId}`);
      
      res.json({ 
        imageUri: uniqueFilename,
        imagePath: uniqueFilename,
        filename: uniqueFilename,
        size: imageBuffer.length,
        message: 'Image uploaded successfully' 
      });
      return;
    } catch (error) {
      console.error('❌ Error saving base64 image:', error);
      res.status(500).json({ error: 'Failed to save image: ' + error.message });
      return;
    }
  }
  
  // Handle multipart file upload
  if (!req.file && !req.files) {
    console.error('❌ No file provided in request');
    console.error(`   Request body:`, req.body);
    res.status(400).json({ error: 'No image file provided. Send either multipart/form-data with "image" field or JSON with "image", "imageData", or "base64" field.' });
    return;
  }

  try {
    // Get the uploaded file info (handle both single and multiple files)
    const uploadedFile = req.file || (req.files && req.files.image) || (req.files && Object.values(req.files)[0]);
    
    if (!uploadedFile) {
      console.error('❌ Could not extract file from request');
      res.status(400).json({ error: 'Could not extract file from request' });
      return;
    }
    
    const originalName = uploadedFile.originalname || uploadedFile.name || 'receipt.jpg';
    const fileExtension = path.extname(originalName) || '.jpg';
    
    // Create a unique filename if not already set
    const uniqueFilename = uploadedFile.filename || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}${fileExtension}`;
    
    // The file is already saved by multer in the uploads/ directory
    const imagePath = uniqueFilename; // Relative path to uploads directory
    
    console.log(`📷 Receipt image uploaded: ${imagePath} (${uploadedFile.size} bytes)`);
    
    res.json({ 
      imageUri: imagePath,
      imagePath: imagePath,
      filename: uniqueFilename,
      size: uploadedFile.size,
      message: 'Image uploaded successfully' 
    });
  } catch (error) {
    console.error('❌ Error uploading receipt image:', error);
    res.status(500).json({ error: 'Failed to upload image: ' + error.message });
  }
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
  console.log('📥 POST /api/time-tracking - Request body:', req.body);
  
  const { id, employeeId, date, category, hours, description, costCenter } = req.body;
  
  // ALWAYS create a deterministic ID based on the unique combination to ensure proper replacement
  // Ignore any ID sent from frontend to prevent duplicates
  const uniqueKey = `${employeeId}-${date}-${category || ''}-${costCenter || ''}`;
  const trackingId = Buffer.from(uniqueKey).toString('base64').replace(/[^a-zA-Z0-9]/g, '').substring(0, 20);
  const now = new Date().toISOString();
  
  console.log(`📝 Creating time tracking entry:`, {
    trackingId,
    employeeId,
    date,
    category,
    hours,
    costCenter,
    uniqueKey
  });

  db.run(
    'INSERT OR REPLACE INTO time_tracking (id, employeeId, date, category, hours, description, costCenter, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, COALESCE((SELECT createdAt FROM time_tracking WHERE id = ?), ?), ?)',
    [trackingId, employeeId, date, category || '', hours, description || '', costCenter || '', trackingId, now, now],
    function(err) {
      if (err) {
        console.error('❌ Database error:', err.message);
        res.status(500).json({ error: err.message });
        return;
      }
      console.log(`✅ Time tracking entry saved: ${trackingId} with ${hours} hours`);
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

// Get detailed monthly report (includes all entries)
app.get('/api/monthly-reports/:id/detailed', (req, res) => {
  const { id } = req.params;
  
  // Get the report first
  db.get('SELECT * FROM monthly_reports WHERE id = ?', [id], (err, report) => {
    if (err) {
      console.error('❌ Error fetching monthly report:', err);
      res.status(500).json({ error: err.message });
      return;
    }
    
    if (!report) {
      res.status(404).json({ error: 'Monthly report not found' });
      return;
    }
    
    // Fetch all related data for this month/year/employee
    const promises = [
      // Employee info
      new Promise((resolve, reject) => {
        db.get('SELECT * FROM employees WHERE id = ?', [report.employeeId], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      }),
      // Mileage entries
      new Promise((resolve, reject) => {
        const query = `
          SELECT *, 
            COALESCE(miles, 0) as miles,
            COALESCE(miles * 0.655, 0) as mileageAmount
          FROM mileage_entries 
          WHERE employeeId = ? 
          AND strftime('%m', date) = ?
          AND strftime('%Y', date) = ?
          ORDER BY date`;
        db.all(query, [report.employeeId, String(report.month).padStart(2, '0'), report.year.toString()], (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        });
      }),
      // Time tracking entries
      new Promise((resolve, reject) => {
        const query = `
          SELECT * FROM time_tracking 
          WHERE employeeId = ? 
          AND strftime('%m', date) = ?
          AND strftime('%Y', date) = ?
          ORDER BY date`;
        db.all(query, [report.employeeId, String(report.month).padStart(2, '0'), report.year.toString()], (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        });
      }),
      // Receipts
      new Promise((resolve, reject) => {
        const query = `
          SELECT * FROM receipts 
          WHERE employeeId = ? 
          AND strftime('%m', date) = ?
          AND strftime('%Y', date) = ?
          ORDER BY date`;
        db.all(query, [report.employeeId, String(report.month).padStart(2, '0'), report.year.toString()], (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        });
      }),
      // Daily descriptions
      new Promise((resolve, reject) => {
        const query = `
          SELECT * FROM daily_descriptions 
          WHERE employeeId = ? 
          AND strftime('%m', date) = ?
          AND strftime('%Y', date) = ?
          ORDER BY date`;
        db.all(query, [report.employeeId, String(report.month).padStart(2, '0'), report.year.toString()], (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        });
      })
    ];
    
    Promise.all(promises).then(([employee, mileageEntries, timeTracking, receipts, dailyDescriptions]) => {
      // Add employee info to report object for frontend compatibility
      if (employee) {
        report.employeeName = employee.name || '';
        report.employeeEmail = employee.email || '';
      }
      
      // Build summary
      const summary = {
        mileageCount: mileageEntries.length,
        timeCount: timeTracking.length,
        receiptCount: receipts.length
      };
      
      // Return comprehensive report data
      res.json({
        report,
        employee,
        summary,
        mileageEntries: mileageEntries || [],
        timeTracking: timeTracking || [],
        receipts: receipts || [],
        dailyDescriptions: dailyDescriptions || []
      });
    }).catch(err => {
      console.error('❌ Error fetching detailed report data:', err);
      res.status(500).json({ error: err.message });
    });
  });
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

// Get pending biweekly reports for supervisor (including cascading supervision)
app.get('/api/biweekly-reports/supervisor/:supervisorId/pending', async (req, res) => {
  const { supervisorId } = req.params;

  try {
    // Get all supervised employees (direct + indirect)
    const supervisedEmployeeIds = await getAllSupervisedEmployees(supervisorId);
    
    if (supervisedEmployeeIds.length === 0) {
      res.json([]);
      return;
    }

    const placeholders = supervisedEmployeeIds.map(() => '?').join(',');

    db.all(
      `SELECT br.*, e.name as employeeName, e.email as employeeEmail
       FROM biweekly_reports br
       JOIN employees e ON br.employeeId = e.id
       WHERE br.employeeId IN (${placeholders}) AND br.status = 'submitted'
       ORDER BY br.year DESC, br.month DESC, br.periodNumber DESC`,
      supervisedEmployeeIds,
      (err, reports) => {
        if (err) {
          console.error('❌ Error fetching pending biweekly reports:', err);
          res.status(500).json({ error: err.message });
          return;
        }
        res.json(reports);
      }
    );
  } catch (error) {
    console.error('❌ Error fetching supervised employees:', error);
    res.status(500).json({ error: error.message });
  }
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

  // Check if employee is a Regional Manager (RM)
  db.get(
    'SELECT position FROM employees WHERE id = ?',
    [employeeId],
    (err, employee) => {
      if (err) {
        console.error('Database error:', err.message);
        res.status(500).json({ error: err.message });
        return;
      }

      // Check if employee is exempt from approval (RM, Director, CEO, CFO)
      if (employee && employee.position) {
        const positionLower = employee.position.toLowerCase();
        const isExempt = positionLower.includes('regional manager') ||
                        positionLower.includes('director') ||
                        positionLower.includes('chief') ||
                        positionLower.includes('ceo') ||
                        positionLower.includes('cfo');
        
        if (isExempt) {
          const statusId = `status-${Date.now()}`;
          db.run(
            'INSERT INTO report_status (id, reportId, employeeId, status, supervisorId, supervisorName, submittedAt, approvedAt, reviewedAt, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [statusId, reportId, employeeId, 'approved', 'EXECUTIVE_AUTO_APPROVE', 'System', now, now, now, now, now],
            function(insertErr) {
              if (insertErr) {
                console.error('Database error:', insertErr.message);
                res.status(500).json({ error: insertErr.message });
                return;
              }

              // Create approval record
              const approvalId = `approval-${Date.now()}`;
              db.run(
                'INSERT INTO report_approvals (id, reportId, employeeId, supervisorId, supervisorName, action, comments, timestamp, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [approvalId, reportId, employeeId, 'EXECUTIVE_AUTO_APPROVE', 'System', 'approve', `Auto-approved for ${employee.position}`, now, now],
                function(approvalErr) {
                  if (approvalErr) {
                    console.error('Error creating approval record:', approvalErr.message);
                  }
                  res.json({ id: statusId, message: 'Report auto-approved and submitted to Finance' });
                }
              );
            }
          );
          return;
        }
      }

      // Regular submission - needs supervisor approval
      db.run(
        'INSERT INTO report_status (id, reportId, employeeId, status, supervisorId, submittedAt, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [id, reportId, employeeId, 'pending', supervisorId, now, now, now],
        function(insertErr) {
          if (insertErr) {
            console.error('Database error:', insertErr.message);
            res.status(500).json({ error: insertErr.message });
            return;
          }
          res.json({ id, message: 'Report submitted for approval successfully' });
        }
      );
    }
  );
});

// Get pending reports for supervisor (including cascading supervision)
app.get('/api/reports/pending/:supervisorId', async (req, res) => {
  const { supervisorId } = req.params;
  
  try {
    // Get all supervised employees (direct + indirect)
    const supervisedEmployeeIds = await getAllSupervisedEmployees(supervisorId);
    
    if (supervisedEmployeeIds.length === 0) {
      res.json([]);
      return;
    }

    const placeholders = supervisedEmployeeIds.map(() => '?').join(',');
    
    db.all(
      `SELECT * FROM report_status WHERE employeeId IN (${placeholders}) AND status = ? ORDER BY submittedAt ASC`,
      [...supervisedEmployeeIds, 'pending'],
      (err, rows) => {
        if (err) {
          res.status(500).json({ error: err.message });
          return;
        }
        res.json(rows);
      }
    );
  } catch (error) {
    console.error('❌ Error fetching supervised employees:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get report history for supervisor (including cascading supervision)
app.get('/api/reports/history/:supervisorId', async (req, res) => {
  const { supervisorId } = req.params;
  const limit = req.query.limit || 50;
  
  try {
    // Get all supervised employees (direct + indirect)
    const supervisedEmployeeIds = await getAllSupervisedEmployees(supervisorId);
    
    if (supervisedEmployeeIds.length === 0) {
      res.json([]);
      return;
    }

    const placeholders = supervisedEmployeeIds.map(() => '?').join(',');
    
    db.all(
      `SELECT * FROM report_status WHERE employeeId IN (${placeholders}) ORDER BY COALESCE(reviewedAt, submittedAt) DESC LIMIT ?`,
      [...supervisedEmployeeIds, limit],
      (err, rows) => {
        if (err) {
          res.status(500).json({ error: err.message });
          return;
        }
        res.json(rows);
      }
    );
  } catch (error) {
    console.error('❌ Error fetching supervised employees:', error);
    res.status(500).json({ error: error.message });
  }
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

// ===== SUPERVISOR REASSIGNMENT API ENDPOINTS =====

// Get all supervised employees for an RM or Admin to manage
app.get('/api/supervisor/:supervisorId/managed-employees', async (req, res) => {
  const { supervisorId } = req.params;
  
  try {
    // Get all supervised employees (direct + indirect)
    const supervisedEmployeeIds = await getAllSupervisedEmployees(supervisorId);
    
    if (supervisedEmployeeIds.length === 0) {
      res.json([]);
      return;
    }

    const placeholders = supervisedEmployeeIds.map(() => '?').join(',');
    
    db.all(
      `SELECT id, name, email, position, supervisorId FROM employees WHERE id IN (${placeholders}) ORDER BY position, name`,
      supervisedEmployeeIds,
      (err, employees) => {
        if (err) {
          console.error('❌ Error fetching managed employees:', err);
          res.status(500).json({ error: err.message });
          return;
        }
        res.json(employees);
      }
    );
  } catch (error) {
    console.error('❌ Error fetching managed employees:', error);
    res.status(500).json({ error: error.message });
  }
});

// Reassign supervisor for an employee (RM/Admin only)
app.put('/api/supervisor/reassign', async (req, res) => {
  const { requestedByUserId, employeeId, newSupervisorId } = req.body;
  
  if (!requestedByUserId || !employeeId || newSupervisorId === undefined) {
    return res.status(400).json({ error: 'requestedByUserId, employeeId, and newSupervisorId are required' });
  }

  const now = new Date().toISOString();

  // Check if requesting user is an RM or Admin
  db.get(
    'SELECT position FROM employees WHERE id = ?',
    [requestedByUserId],
    (err, requester) => {
      if (err) {
        console.error('❌ Error checking requester role:', err);
        res.status(500).json({ error: 'Failed to verify permissions' });
        return;
      }

      if (!requester) {
        return res.status(404).json({ error: 'Requester not found' });
      }

      const isRM = requester.position && requester.position.toLowerCase().includes('regional manager');
      const isAdmin = requester.position && requester.position.toLowerCase().includes('admin');
      
      if (!isRM && !isAdmin) {
        return res.status(403).json({ error: 'Only Regional Managers and Admins can reassign supervisors' });
      }

      // Verify that the employee is supervised by the requester (RM only)
      if (isRM && !isAdmin) {
        getAllSupervisedEmployees(requestedByUserId)
          .then(supervisedIds => {
            if (!supervisedIds.includes(employeeId)) {
              return res.status(403).json({ error: 'You can only reassign supervisors for employees you supervise' });
            }
            
            // Proceed with reassignment
            performReassignment(employeeId, newSupervisorId, now, res);
          })
          .catch(error => {
            console.error('❌ Error checking supervision:', error);
            res.status(500).json({ error: 'Failed to verify supervision' });
          });
      } else {
        // Admin can reassign anyone
        performReassignment(employeeId, newSupervisorId, now, res);
      }
    }
  );

  function performReassignment(empId, newSupId, timestamp, response) {
    // Check if newSupervisorId is valid (allow null to remove supervisor)
    if (newSupId !== null) {
      db.get(
        'SELECT id FROM employees WHERE id = ?',
        [newSupId],
        (checkErr, supervisor) => {
          if (checkErr) {
            console.error('❌ Error checking new supervisor:', checkErr);
            response.status(500).json({ error: 'Failed to verify new supervisor' });
            return;
          }

          if (!supervisor) {
            return response.status(404).json({ error: 'New supervisor not found' });
          }

          updateSupervisor(empId, newSupId, timestamp, response);
        }
      );
    } else {
      // Removing supervisor
      updateSupervisor(empId, null, timestamp, response);
    }
  }

  function updateSupervisor(empId, newSupId, timestamp, response) {
    db.run(
      'UPDATE employees SET supervisorId = ?, updatedAt = ? WHERE id = ?',
      [newSupId, timestamp, empId],
      function(updateErr) {
        if (updateErr) {
          console.error('❌ Error updating supervisor:', updateErr);
          response.status(500).json({ error: 'Failed to update supervisor' });
          return;
        }

        if (this.changes === 0) {
          return response.status(404).json({ error: 'Employee not found' });
        }

        console.log(`✅ Supervisor reassigned: ${empId} → ${newSupId || 'none'}`);
        
        // Broadcast the change
        broadcastDataChange('employee', 'update', { id: empId, supervisorId: newSupId });
        
        response.json({ 
          success: true, 
          message: 'Supervisor reassigned successfully',
          employeeId: empId,
          newSupervisorId: newSupId
        });
      }
    );
  }
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
      console.log(`📄 Before summary page: yPos=${yPos}, pageHeight=${pageHeight}`);
      // Calculate estimated space needed for summary section (title, 3 lines of info, table)
      const estimatedSummaryHeight = 40 + 60 + 300; // title + info + table estimate
      const remainingSpace = pageHeight - yPos - margin;
      
      // Only add page if we don't have enough space
      if (remainingSpace < estimatedSummaryHeight) {
        console.log(`📄 Adding page for summary (remaining space ${remainingSpace.toFixed(0)} < ${estimatedSummaryHeight})`);
      doc.addPage();
      yPos = margin + 20;
      } else {
        // Continue on same page, just add some spacing
        yPos += 20;
        console.log(`📄 Summary continuing on same page (remaining space ${remainingSpace.toFixed(0)}px, added spacing, yPos=${yPos})`);
      }
      console.log(`📄 After summary page setup: yPos=${yPos}`);
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
        // Defensive guards to prevent jsPDF.rect invalid args
        if (!Number.isFinite(width) || width <= 0) {
          console.warn('⚠️ drawCell: invalid width, substituting 10', { width, text });
          width = 10;
        }
        if (!Number.isFinite(height) || height <= 0) {
          console.warn('⚠️ drawCell: invalid height, substituting 10', { height, text });
          height = 10;
        }
        if (!Number.isFinite(x)) x = tableStartX || 40;
        if (!Number.isFinite(y)) y = 40;
        // Set fill color
        setColor(color);
        
        // Set text color and font BEFORE drawing text
        if (textColor === 'white') {
          doc.setTextColor(255, 255, 255); // White text
        } else {
          doc.setTextColor(0, 0, 0); // Black text
        }
        doc.setFontSize(7); // Reduced from default 8 to 7 (~12.5% reduction)
        doc.setFont('helvetica', 'bold');
        
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
            } else if (align === 'center') {
              safeText(line, x + width/2, lineY, { align: 'center' });
            } else {
              safeText(line, x + 5, lineY);
            }
          });
        } else {
          // Single line text - draw rectangle with original height
          doc.rect(x, y, width, height, 'FD'); // Fill and draw border
          
          if (align === 'right') {
            safeText(text, x + width - 5, y + height/2 + 3);
          } else if (align === 'center') {
            safeText(text, x + width/2, y + height/2 + 3, { align: 'center' });
          } else {
            safeText(text, x + 5, y + height/2 + 3);
          }
        }
        
        // Reset to black text color after drawing
        doc.setTextColor(0, 0, 0);
        return actualHeight; // Return actual height used
      };
      
      // Table dimensions - adjusted for portrait page with proper widths (downsized by ~20% total)
      const cellHeight = 16; // ~20% reduction from original 20
      // Base widths: [label, centers x N, subtotal]
      let colWidths = [96, 64, 64, 64, 64, 64, 80];
      const employeeCenters = (reportData.costCenters || []).slice(0, 5);
      const numCenters = employeeCenters.length;
      // Build dynamic widths to match number of assigned centers
      colWidths = [colWidths[0], ...Array(numCenters).fill(64), colWidths[colWidths.length - 1]];
      const tableWidth = colWidths.reduce((sum, width) => sum + width, 0);
      const tableStartX = (pageWidth - tableWidth) / 2; // Center the summary table
      
      // Header row - dynamic: show only this employee's assigned cost centers
      const headers = [''].concat(employeeCenters).concat(['SUBTOTALS (by category)']);
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
        const colWidth = colWidths[i] ?? 10;
        const needsWrapping = header.length > 15;
        drawCell(xPos, yPos, colWidth, maxHeaderHeight, header, 'darkBlue', 'white', 'center', needsWrapping);
        xPos += colWidth;
      });
      yPos += maxHeaderHeight;
      
      // Helper function to calculate amounts for a category from receipts
      const calculateCategoryAmounts = (categoryLabel, receiptCategoryMatches) => {
        const normalizeCategory = (c) => (c || '').toString().trim().toLowerCase().replace(/\s+/g, ' ').replace(/\s*\/\s*/g, ' / ');
        const matchingReceipts = (reportData.receipts || []).filter(r => {
          const cat = normalizeCategory(r.category);
          return receiptCategoryMatches.some(match => cat === normalizeCategory(match));
        });
        const total = matchingReceipts.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);
        
        // Distribute across visible cost center columns
        const centerTotals = Array(numCenters).fill(0);
        const normalizeName = (s) => (s || '').toString().trim().toLowerCase()
          .replace(/&/g, 'and').replace(/\./g, '').replace(/\s+/g, ' ');
        const centersList = (reportData.costCenters || []).slice(0, numCenters);
        const centersNorm = centersList.map(c => normalizeName(c));
        matchingReceipts.forEach(r => {
          const rc = r.costCenter || r.costCenterName || r.center || r.cc || '';
          let idx = centersNorm.indexOf(normalizeName(rc));
          // Fallbacks: if no match, default to first assigned center
          if (idx < 0) idx = 0;
          if (idx >= 0 && idx < centerTotals.length) {
            centerTotals[idx] += (parseFloat(r.amount) || 0);
          }
        });
        
        return [centerTotals, total];
      };
      
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
        // Check for page break before drawing row
        if (yPos > pageHeight - 50) {
          doc.addPage();
          yPos = margin;
        }
        
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
        
        // Draw only assigned cost centers, then the subtotal column
        for (let i = 0; i < numCenters; i++) {
          const amount = amounts[i] || 0;
          drawCell(xPos, yPos, colWidths[i + 1], maxRowHeight, `$${amount.toFixed(2)}`, 'lightGreen', 'black', 'left');
          xPos += colWidths[i + 1];
        }
        // Subtotal is the last value in amounts
        const subtotal = amounts[amounts.length - 1] || 0;
        drawCell(xPos, yPos, colWidths[colWidths.length - 1], maxRowHeight, `$${subtotal.toFixed(2)}`, 'lightGreen', 'black', 'left');
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
          const [phoneInternetFaxCenters, phoneInternetFaxTotal] = calculateCategoryAmounts(
            'Phone / Internet / Fax',
            ['Phone/Internet/Fax', 'Phone / Internet / Fax']
          );
          console.log(`📦 Phone/Internet/Fax distribution`, { centers: phoneInternetFaxCenters, total: phoneInternetFaxTotal });

          drawCell(tableStartX, yPos, colWidths[0], cellHeight, 'Phone / Internet / Fax', 'lightOrange', 'black', 'left');
          xPos = tableStartX + colWidths[0];
          // Cost center columns (#1..numCenters)
          for (let i = 1; i <= numCenters; i++) {
            const val = phoneInternetFaxCenters[i - 1] || 0;
            drawCell(xPos, yPos, colWidths[i], cellHeight, `$${val.toFixed(2)}`, 'lightOrange', 'black', 'left');
            xPos += colWidths[i];
          }
          // Subtotals (by category) column
          drawCell(xPos, yPos, colWidths[colWidths.length - 1], cellHeight, `$${phoneInternetFaxTotal.toFixed(2)}`, 'lightOrange', 'black', 'left');
      yPos += cellHeight;
      
      // Postage / Shipping
      const [postageShippingCenters, postageShippingTotal] = calculateCategoryAmounts(
        'Postage / Shipping',
        ['Postage/Shipping', 'Postage / Shipping', 'Postage', 'Shipping']
      );
      drawCell(tableStartX, yPos, colWidths[0], cellHeight, 'Postage / Shipping', 'lightOrange', 'black', 'left');
      xPos = tableStartX + colWidths[0];
      for (let i = 1; i <= numCenters; i++) {
        const val = postageShippingCenters[i - 1] || 0;
        drawCell(xPos, yPos, colWidths[i], cellHeight, `$${val.toFixed(2)}`, 'lightOrange', 'black', 'left');
        xPos += colWidths[i];
      }
      drawCell(xPos, yPos, colWidths[colWidths.length - 1], cellHeight, `$${postageShippingTotal.toFixed(2)}`, 'lightOrange', 'black', 'left');
      yPos += cellHeight;
      
      // Printing / Copying
      const [printingCopyingCenters, printingCopyingTotal] = calculateCategoryAmounts(
        'Printing / Copying',
        ['Printing/Copying', 'Printing / Copying', 'Printing', 'Copying']
      );
      drawCell(tableStartX, yPos, colWidths[0], cellHeight, 'Printing / Copying', 'lightOrange', 'black', 'left');
      xPos = tableStartX + colWidths[0];
      for (let i = 1; i <= numCenters; i++) {
        const val = printingCopyingCenters[i - 1] || 0;
        drawCell(xPos, yPos, colWidths[i], cellHeight, `$${val.toFixed(2)}`, 'lightOrange', 'black', 'left');
        xPos += colWidths[i];
      }
      drawCell(xPos, yPos, colWidths[colWidths.length - 1], cellHeight, `$${printingCopyingTotal.toFixed(2)}`, 'lightOrange', 'black', 'left');
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
      const [outreachSuppliesCenters, outreachSuppliesTotal] = calculateCategoryAmounts(
        'Outreach Supplies',
        ['Outreach Supplies', 'Office Supplies', 'Supplies']
      );
      drawCell(tableStartX, yPos, colWidths[0], cellHeight, 'Outreach Supplies', 'lightOrange', 'black', 'left');
      xPos = tableStartX + colWidths[0];
      for (let i = 1; i <= numCenters; i++) {
        const val = outreachSuppliesCenters[i - 1] || 0;
        drawCell(xPos, yPos, colWidths[i], cellHeight, `$${val.toFixed(2)}`, 'lightOrange', 'black', 'left');
        xPos += colWidths[i];
      }
      drawCell(xPos, yPos, colWidths[colWidths.length - 1], cellHeight, `$${outreachSuppliesTotal.toFixed(2)}`, 'lightOrange', 'black', 'left');
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
      const totalExpenses = (reportData.totalMileageAmount || 0) + 
                           (reportData.airRailBus || 0) + (reportData.vehicleRentalFuel || 0) + 
                           (reportData.parkingTolls || 0) + (reportData.groundTransportation || 0) + 
                           (reportData.hotelsAirbnb || 0) + (reportData.perDiem || 0) + (reportData.other || 0) +
                           phoneInternetFaxTotal + postageShippingTotal + printingCopyingTotal + outreachSuppliesTotal;
      
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
      
      // Calculate subtotals for each cost center column by summing all category amounts
      const costCenterSubtotals = [];
      for (let i = 0; i < numCenters; i++) {
        let columnTotal = 0;
        // Add mileage for this column (all mileage currently goes to first column)
        if (i === 0) {
          columnTotal += (reportData.totalMileageAmount || 0);
        }
        // Add receipt-based category amounts
        columnTotal += phoneInternetFaxCenters[i] || 0;
        columnTotal += postageShippingCenters[i] || 0;
        columnTotal += printingCopyingCenters[i] || 0;
        columnTotal += outreachSuppliesCenters[i] || 0;
        costCenterSubtotals.push(columnTotal);
      }
      
      drawCell(tableStartX, yPos, colWidths[0], subtotalsRowHeight, subtotalsText, 'lightGreen', 'black', 'left', subtotalsNeedsWrapping);
      xPos = tableStartX + colWidths[0];
      // Draw subtotals for each cost center column
      for (let i = 0; i < numCenters; i++) {
        drawCell(xPos, yPos, colWidths[i + 1], subtotalsRowHeight, `$${costCenterSubtotals[i].toFixed(2)}`, 'lightGreen', 'black', 'left');
        xPos += colWidths[i + 1];
      }
      // Draw grand total in subtotals column
      drawCell(xPos, yPos, colWidths[colWidths.length - 1], subtotalsRowHeight, `$${totalExpenses.toFixed(2)}`, 'lightGreen', 'black', 'left');
      yPos += subtotalsRowHeight;
      
      // Less Cash Advance (label in second-to-last column, value in subtotals column)
      // Leave first column blank
      drawCell(tableStartX, yPos, colWidths[0], cellHeight, '', 'lightGreen', 'black', 'left');
      xPos = tableStartX + colWidths[0];
      // Leave cost center columns blank until second-to-last
      for (let i = 0; i < numCenters - 1; i++) {
        drawCell(xPos, yPos, colWidths[i + 1], cellHeight, '', 'lightGreen', 'black', 'left');
        xPos += colWidths[i + 1];
      }
      // Put "Less Cash Advance" label in the second-to-last column (last cost center)
      drawCell(xPos, yPos, colWidths[numCenters], cellHeight, 'Less Cash Advance', 'lightGreen', 'black', 'left');
      xPos += colWidths[numCenters];
      // Show Less Cash Advance value in subtotals column (currently 0)
      drawCell(xPos, yPos, colWidths[colWidths.length - 1], cellHeight, '$0.00', 'lightGreen', 'black', 'left');
      yPos += cellHeight;
      
      // Grand Total (dark blue for label with white text, light blue for value) - aligned with columns
      yPos += 20;
      // GRAND TOTAL label spans all employee cost center columns; value is in the SUBTOTALS column
      const numCentersForGT = numCenters; // reuse computed count
      const sumWidths = (arr, start, end) => arr.slice(start, end).reduce((s, w) => s + w, 0);
      // Columns layout: [0]=Label, [1..numCenters]=Centers, [last]=Subtotal
      const centersStartX = tableStartX + colWidths[0];
      const centersTotalWidth = sumWidths(colWidths, 1, 1 + numCentersForGT);
      const grandTotalValueX = centersStartX + centersTotalWidth; // start of subtotal column
      const subtotalColWidth = colWidths[colWidths.length - 1];

      drawCell(centersStartX, yPos, centersTotalWidth, cellHeight, 'GRAND TOTAL', 'darkBlue', 'white', 'center');
      drawCell(grandTotalValueX, yPos, subtotalColWidth, cellHeight, `$${totalExpenses.toFixed(2)}`, 'lightBlue', 'black', 'left');
      
      yPos += 40;
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      
      // Start "Payable to" and cost center sheets on a fresh page
      // Calculate estimated space needed for first cost center (title + table header + at least a few rows)
      const estimatedCostCenterHeight = 100 + 30 + 200; // title + header + rows estimate
      const remainingSpaceForCC = pageHeight - yPos - margin;
      
      console.log(`📄 Before cost center section: yPos=${yPos}, pageHeight=${pageHeight}, remaining=${remainingSpaceForCC.toFixed(0)}`);
      // Only add page if we don't have enough space for the cost center content
      if (remainingSpaceForCC < estimatedCostCenterHeight) {
        console.log(`📄 Adding page for cost center section (remaining space ${remainingSpaceForCC.toFixed(0)} < ${estimatedCostCenterHeight})`);
        doc.addPage();
        yPos = margin + 20;
      } else {
        // Continue on same page, just add some spacing
        yPos += 20;
        console.log(`📄 Cost center section continuing on same page (remaining space ${remainingSpaceForCC.toFixed(0)}px, added spacing, yPos=${yPos})`);
      }
      console.log(`📄 After cost center page check: yPos=${yPos}`);
      
      safeText(`Payable to: ${reportData.name || 'N/A'}`, margin, yPos);
      yPos += 30;
      console.log(`📄 After "Payable to": yPos=${yPos}`);
      
      
      // Page 3+: Cost Center Travel Sheets (with all days of month and grid)
      
      // Ensure we have at least one cost center sheet
      const costCentersToProcess = reportData.costCenters && reportData.costCenters.length > 0 
        ? reportData.costCenters 
        : ['Program Services']; // Default cost center if none provided
      
      // Track completion of all cost center sheets
      let costCenterSheetsCompleted = 0;
      const totalCostCenterSheets = costCentersToProcess.length;
      
      // Function to generate timesheet and finalize PDF (called after all cost center sheets are done)
      const generateTimesheetAndFinalizePDF = () => {
        // Page Last: Timesheet (with grid layout showing cost centers and categories)
        console.log(`📄 Starting timesheet section: yPos=${yPos}, pageHeight=${pageHeight}`);
        // Calculate estimated space needed for timesheet (title + table with multiple rows)
        const estimatedTimesheetHeight = 100 + 400; // title + table estimate
        const remainingSpaceForTS = pageHeight - yPos - margin;
        
        // Only add page if we don't have enough space
        if (remainingSpaceForTS < estimatedTimesheetHeight) {
          console.log(`📄 Adding page for timesheet (remaining space ${remainingSpaceForTS.toFixed(0)} < ${estimatedTimesheetHeight})`);
          doc.addPage();
          yPos = margin + 20;
        } else {
          // Continue on same page, just add some spacing
          yPos += 20;
          console.log(`📄 Timesheet continuing on same page (remaining space ${remainingSpaceForTS.toFixed(0)}px, added spacing, yPos=${yPos})`);
        }
        console.log(`📄 After timesheet page check: yPos=${yPos}`);
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        safeText('MONTHLY TIMESHEET', pageWidth / 2, yPos, { align: 'center' });
        
        yPos += 30;
        doc.setFontSize(11);
        safeText(`${reportData.name || 'N/A'} - ${reportData.month} ${reportData.year}`, pageWidth / 2, yPos, { align: 'center' });
        
        yPos += 40;
        
        // Grid Timesheet dimensions - matching Oxford House FY 25/26 format
        // Grid: 80px (name) + 14px × 30 (days) + 70px (total) = 570px total width
        const gridCellHeight = 12;
        const gridNameColWidth = 80;
        const gridDayColWidth = 14;
        const gridTotalColWidth = 70;
        const gridDaysToShow = 30; // Show days 1-30 (we'll cap longer months at 30)
        
        const gridTotalWidth = gridNameColWidth + (gridDayColWidth * gridDaysToShow) + gridTotalColWidth;
        const gridStartX = (pageWidth - gridTotalWidth) / 2; // Center the grid
        
        // Generate month and year info
        let month = reportData.month;
        if (typeof month === 'string' && isNaN(parseInt(month))) {
          const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                             'July', 'August', 'September', 'October', 'November', 'December'];
          month = monthNames.indexOf(month) + 1;
        } else {
          month = parseInt(month);
        }
        const year = parseInt(reportData.year);
        const monthStr = month.toString().padStart(2, '0');
        const yearStr = year.toString();
        
        // Helper function for grid cells
        const drawGridCell = (x, y, width, height, text, color = 'white', textColor = 'black', align = 'center', fontSize = 6) => {
          setColor(color);
          doc.setDrawColor(0, 0, 0);
          doc.rect(x, y, width, height, 'FD');
          
          if (textColor === 'white') {
            doc.setTextColor(255, 255, 255);
          } else if (textColor === 'red') {
            doc.setTextColor(255, 0, 0);
          } else {
            doc.setTextColor(0, 0, 0);
          }
          
          doc.setFontSize(fontSize);
          doc.setFont('helvetica', 'bold');
          
          if (align === 'right') {
            safeText(text || '', x + width - 2, y + height/2 + 3);
          } else if (align === 'center') {
            safeText(text || '', x + width/2, y + height/2 + 3, { align: 'center' });
          } else {
            safeText(text || '', x + 2, y + height/2 + 3);
          }
          
          doc.setTextColor(0, 0, 0);
        };
        
        // Fetch detailed time tracking data by day and cost center
        const detailedTimeQuery = `
          SELECT date, costCenter, hours, category
          FROM time_tracking 
          WHERE employeeId = ? 
          AND strftime("%m", date) = ? 
          AND strftime("%Y", date) = ?
          ORDER BY date, costCenter
        `;
        
        db.all(detailedTimeQuery, [reportData.employeeId, monthStr, yearStr], (err, timeEntries) => {
          if (err) {
            console.error('❌ Error fetching detailed time tracking data:', err);
            timeEntries = [];
          }
          
          // Build data structure: costCenterDailyMap[costCenter][day] = hours
          // And categoryDailyMap[category][day] = hours
          const costCenterDailyMap = {};
          const categoryDailyMap = {
            'G&A': {},
            'HOLIDAY': {},
            'PTO': {},
            'STD/LTD': {},
            'PFL/PFML': {}
          };
          
          timeEntries.forEach(entry => {
            // Parse date to get day number
            let day;
            if (entry.date.includes('-')) {
              day = parseInt(entry.date.split('-')[2]);
            } else if (entry.date.includes('/')) {
              day = parseInt(entry.date.split('/')[1]);
            }
            
            if (day && day <= gridDaysToShow) {
              const hours = parseFloat(entry.hours) || 0;
              
              // Map by cost center
              if (entry.costCenter) {
                if (!costCenterDailyMap[entry.costCenter]) {
                  costCenterDailyMap[entry.costCenter] = {};
                }
                costCenterDailyMap[entry.costCenter][day] = (costCenterDailyMap[entry.costCenter][day] || 0) + hours;
              }
              
              // Map by category (if provided)
              if (entry.category && categoryDailyMap[entry.category]) {
                categoryDailyMap[entry.category][day] = (categoryDailyMap[entry.category][day] || 0) + hours;
              }
            }
          });
          
          // Use all assigned cost centers from the report, even if they have no hours
          const assignedCenters = (reportData.costCenters || []);
          const discoveredCenters = Object.keys(costCenterDailyMap);
          const costCenters = Array.from(new Set([ ...assignedCenters, ...discoveredCenters ])).filter(Boolean);
          
          // Draw header row: Name column + Days 1-30 + Total column
          let gridX = gridStartX;
          
          // Name column header (blank or label)
          drawGridCell(gridX, yPos, gridNameColWidth, gridCellHeight, '', 'darkBlue', 'white', 'center');
          gridX += gridNameColWidth;
          
          // Day number columns (1-30)
          for (let day = 1; day <= gridDaysToShow; day++) {
            drawGridCell(gridX, yPos, gridDayColWidth, gridCellHeight, day.toString(), 'darkBlue', 'white', 'center', 5);
            gridX += gridDayColWidth;
          }
          
          // Total column header
          drawGridCell(gridX, yPos, gridTotalColWidth, gridCellHeight, 'COST CENTER TOTAL', 'darkBlue', 'white', 'center');
          yPos += gridCellHeight;
          
          // Draw cost center rows
          costCenters.forEach(costCenter => {
            if (yPos > pageHeight - gridCellHeight * 10) {
              doc.addPage();
              yPos = margin + 20;
              // Redraw header row on new page
              let gridX = gridStartX;
              drawGridCell(gridX, yPos, gridNameColWidth, gridCellHeight, '', 'darkBlue', 'white', 'center');
              gridX += gridNameColWidth;
              for (let day = 1; day <= gridDaysToShow; day++) {
                drawGridCell(gridX, yPos, gridDayColWidth, gridCellHeight, day.toString(), 'darkBlue', 'white', 'center', 5);
                gridX += gridDayColWidth;
              }
              drawGridCell(gridX, yPos, gridTotalColWidth, gridCellHeight, 'COST CENTER TOTAL', 'darkBlue', 'white', 'center');
              yPos += gridCellHeight;
            }
            
            gridX = gridStartX;
            let rowTotal = 0;
            
            // Cost center name
            drawGridCell(gridX, yPos, gridNameColWidth, gridCellHeight, costCenter, 'white', 'black', 'left');
            gridX += gridNameColWidth;
            
            // Daily hours for this cost center
            for (let day = 1; day <= gridDaysToShow; day++) {
              const hours = (costCenterDailyMap[costCenter]?.[day]) || 0;
              rowTotal += hours;
              drawGridCell(gridX, yPos, gridDayColWidth, gridCellHeight, hours > 0 ? hours.toString() : '', 'white', 'black', 'center');
              gridX += gridDayColWidth;
            }
            
            // Cost center total
            drawGridCell(gridX, yPos, gridTotalColWidth, gridCellHeight, rowTotal > 0 ? rowTotal.toString() : '', 'white', 'black', 'center');
            yPos += gridCellHeight;
          });
          
          // BILLABLE HOURS totals row (sum of all cost center rows)
          if (yPos > pageHeight - gridCellHeight * 10) {
            doc.addPage();
            yPos = margin + 20;
          }
          
          gridX = gridStartX;
          let billableTotals = new Array(gridDaysToShow).fill(0);
          let billableGrandTotal = 0;
          
          costCenters.forEach(costCenter => {
            for (let day = 1; day <= gridDaysToShow; day++) {
              const hours = (costCenterDailyMap[costCenter]?.[day]) || 0;
              billableTotals[day - 1] += hours;
            }
          });
          billableGrandTotal = billableTotals.reduce((sum, val) => sum + val, 0);
          
          drawGridCell(gridX, yPos, gridNameColWidth, gridCellHeight, 'BILLABLE HOURS', 'lightGray', 'black', 'left');
          gridX += gridNameColWidth;
          
          for (let day = 1; day <= gridDaysToShow; day++) {
            const total = billableTotals[day - 1];
            drawGridCell(gridX, yPos, gridDayColWidth, gridCellHeight, total > 0 ? total.toString() : '', 'lightGray', 'black', 'center');
            gridX += gridDayColWidth;
          }
          
          drawGridCell(gridX, yPos, gridTotalColWidth, gridCellHeight, billableGrandTotal > 0 ? billableGrandTotal.toString() : '', 'lightGray', 'black', 'center');
          yPos += gridCellHeight;
          
          // Add spacing before categories
          yPos += 5;
          
          // Draw category rows (G&A, HOLIDAY, PTO, STD/LTD, PFL/PFML)
          const categories = ['G&A', 'HOLIDAY', 'PTO', 'STD/LTD', 'PFL/PFML'];
          
          categories.forEach(category => {
            if (yPos > pageHeight - gridCellHeight * 10) {
              doc.addPage();
              yPos = margin + 20;
            }
            
            gridX = gridStartX;
            let categoryTotals = new Array(gridDaysToShow).fill(0);
            let categoryGrandTotal = 0;
            
            // Calculate totals for this category
            for (let day = 1; day <= gridDaysToShow; day++) {
              categoryTotals[day - 1] = categoryDailyMap[category][day] || 0;
              categoryGrandTotal += categoryTotals[day - 1];
            }
            
            drawGridCell(gridX, yPos, gridNameColWidth, gridCellHeight, category, 'white', 'black', 'left');
            gridX += gridNameColWidth;
            
            for (let day = 1; day <= gridDaysToShow; day++) {
              const hours = categoryTotals[day - 1];
              drawGridCell(gridX, yPos, gridDayColWidth, gridCellHeight, hours > 0 ? hours.toString() : '', 'white', 'black', 'center');
              gridX += gridDayColWidth;
            }
            
            drawGridCell(gridX, yPos, gridTotalColWidth, gridCellHeight, categoryGrandTotal > 0 ? categoryGrandTotal.toString() : '', 'white', 'black', 'center');
            yPos += gridCellHeight;
          });
          
          // DAILY TOTALS row (sum of all rows above)
          if (yPos > pageHeight - gridCellHeight * 5) {
            doc.addPage();
            yPos = margin + 20;
          }
          
          gridX = gridStartX;
          let dailyTotals = new Array(gridDaysToShow).fill(0);
          let dailyGrandTotal = 0;
          
          // Sum all cost centers
          costCenters.forEach(costCenter => {
            for (let day = 1; day <= gridDaysToShow; day++) {
              dailyTotals[day - 1] += ((costCenterDailyMap[costCenter]?.[day]) || 0);
            }
          });
          
          // Sum all categories
          categories.forEach(category => {
            for (let day = 1; day <= gridDaysToShow; day++) {
              dailyTotals[day - 1] += (categoryDailyMap[category][day] || 0);
            }
          });
          
          dailyGrandTotal = dailyTotals.reduce((sum, val) => sum + val, 0);
          
          drawGridCell(gridX, yPos, gridNameColWidth, gridCellHeight, 'DAILY TOTALS', 'lightGray', 'black', 'left');
          gridX += gridNameColWidth;
          
          for (let day = 1; day <= gridDaysToShow; day++) {
            const total = dailyTotals[day - 1];
            drawGridCell(gridX, yPos, gridDayColWidth, gridCellHeight, total > 0 ? total.toString() : '', 'lightGray', 'black', 'center');
            gridX += gridDayColWidth;
          }
          
          drawGridCell(gridX, yPos, gridTotalColWidth, gridCellHeight, dailyGrandTotal > 0 ? dailyGrandTotal.toString() : '', 'lightGray', 'black', 'center');
          yPos += gridCellHeight;
          
          // GRAND TOTAL row
          if (yPos > pageHeight - gridCellHeight * 5) {
            doc.addPage();
            yPos = margin + 20;
          }
          
          drawGridCell(gridStartX, yPos, gridNameColWidth + (gridDayColWidth * gridDaysToShow), gridCellHeight, 'GRAND TOTAL', 'lightBlue', 'black', 'left');
          drawGridCell(gridStartX + gridNameColWidth + (gridDayColWidth * gridDaysToShow), yPos, gridTotalColWidth, gridCellHeight, dailyGrandTotal > 0 ? dailyGrandTotal.toString() : '', 'lightBlue', 'black', 'center');
          yPos += gridCellHeight;
          
          console.log(`📄 Time tracking summary completed: yPos=${yPos}`);
        
          // Add Receipts section if there are any
          if (reportData.receipts && reportData.receipts.length > 0) {
            console.log(`📄 Before receipts section: yPos=${yPos}, pageHeight=${pageHeight}`);
            // Always start receipts on a new page
            console.log(`📄 Adding new page for receipts section`);
        doc.addPage();
        yPos = margin + 20;
        
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
          safeText('RECEIPTS', pageWidth / 2, yPos, { align: 'center' });
        
        yPos += 30;
        doc.setFontSize(11);
        safeText(`${reportData.name || 'N/A'} - ${reportData.month} ${reportData.year}`, pageWidth / 2, yPos, { align: 'center' });
        
        yPos += 40;
          
          // Receipts table
          const receiptColWidths = [70, 100, 80, 100, 150];
          const receiptHeaders = ['Date', 'Vendor', 'Amount', 'Category', 'Description'];
          const receiptTableWidth = receiptColWidths.reduce((sum, w) => sum + w, 0);
          const receiptTableStartX = (pageWidth - receiptTableWidth) / 2;
          
          // Header
          let xPos = receiptTableStartX;
          receiptHeaders.forEach((header, i) => {
            setColor('darkBlue');
            doc.rect(xPos, yPos, receiptColWidths[i], 15, 'FD');
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(7);
            safeText(header, xPos + receiptColWidths[i]/2, yPos + 10, { align: 'center' });
            xPos += receiptColWidths[i];
          });
          yPos += 15;
          
          // Helper function for receipt cells with text wrapping
          const drawReceiptCell = (x, y, width, height, text) => {
            setColor('white');
            doc.rect(x, y, width, height, 'FD');
            doc.setTextColor(0, 0, 0);
            doc.setFontSize(7);
            doc.setFont('helvetica', 'normal');
            
            const maxCharsPerLine = Math.floor((width - 6) / 3.5);
            const words = text.split(' ');
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
            
            lines.forEach((line, index) => {
              safeText(line, x + 3, y + 6 + (index * 6));
            });
            
            return 6 + (lines.length * 6) + 6;
          };
          
          // Data rows
          console.log(`📄 Starting receipts section: yPos=${yPos}, receipts count=${reportData.receipts?.length || 0}`);
          const imagesToAdd = [];
          reportData.receipts.forEach((receipt, idx) => {
            // Check if we need a new page for the receipt row
            if (yPos > pageHeight - 150) {
              console.log(`📄 Adding page in receipts loop (receipt ${idx + 1}, yPos ${yPos} > ${pageHeight - 150})`);
              doc.addPage();
              yPos = margin;
            }
            
            const rowData = [
              receipt.date || '',
              receipt.vendor || '',
              receipt.amount ? `$${parseFloat(receipt.amount).toFixed(2)}` : '',
              receipt.category || '',
              receipt.description || ''
            ];
            
            let maxRowHeight = 15;
            rowData.forEach((data, i) => {
              const cellHeight = drawReceiptCell(receiptTableStartX + receiptColWidths.slice(0, i).reduce((sum, w) => sum + w, 0), yPos, receiptColWidths[i], 15, data);
              maxRowHeight = Math.max(maxRowHeight, cellHeight);
            });
            
            // Redraw all cells with uniform height
            xPos = receiptTableStartX;
            rowData.forEach((data, i) => {
              const actualHeight = drawReceiptCell(xPos, yPos, receiptColWidths[i], maxRowHeight, data);
              xPos += receiptColWidths[i];
            });
            
            yPos += maxRowHeight;

            // Collect receipt images to render after the table
            if (receipt.imagePath || receipt.imageUrl || receipt.image || receipt.imageUri) {
              try {
                const imagePath = receipt.imagePath || receipt.imageUrl || receipt.image || receipt.imageUri;
                const fs = require('fs');
                const path = require('path');
                
                if (typeof imagePath === 'string' && imagePath.startsWith('data:image/')) {
                  const base64Data = imagePath.split(',')[1];
                  imagesToAdd.push({ type: 'base64', data: base64Data });
                } else {
                  let cleanPath = imagePath;
                  if (typeof imagePath === 'string' && imagePath.startsWith('file://')) {
                    cleanPath = imagePath.replace(/^file:\/\//, '');
                  }
                  let fullImagePath = null;
                  if (typeof cleanPath === 'string' && cleanPath.startsWith('/uploads/')) {
                    fullImagePath = path.join(__dirname, 'uploads', path.basename(cleanPath));
                  } else if (path.isAbsolute(cleanPath)) {
                    fullImagePath = cleanPath;
                  } else {
                    const uploadsPath = path.join(__dirname, 'uploads', cleanPath);
                    const uploadsSubPath = path.join(__dirname, 'uploads', 'test-receipts', cleanPath);
                    const hashPath = path.join(__dirname, 'uploads', path.basename(cleanPath));
                    const receiptsPath = path.join(__dirname, 'receipts', cleanPath);
                    if (fs.existsSync(uploadsPath)) fullImagePath = uploadsPath;
                    else if (fs.existsSync(uploadsSubPath)) fullImagePath = uploadsSubPath;
                    else if (fs.existsSync(hashPath)) fullImagePath = hashPath;
                    else if (fs.existsSync(receiptsPath)) fullImagePath = receiptsPath;
                    else {
                      const filename = path.basename(cleanPath);
                      const filenamePath = path.join(__dirname, 'uploads', filename);
                      if (fs.existsSync(filenamePath)) fullImagePath = filenamePath;
                    }
                  }
                  if (fullImagePath && fs.existsSync(fullImagePath)) {
                    imagesToAdd.push({ type: 'file', path: fullImagePath });
                  } else {
                    const triedPaths = [
                      path.isAbsolute(cleanPath) ? cleanPath : path.join(__dirname, 'uploads', cleanPath),
                      path.join(__dirname, 'uploads', 'test-receipts', cleanPath),
                      path.join(__dirname, 'uploads', path.basename(cleanPath)),
                      path.join(__dirname, 'receipts', cleanPath)
                    ];
                    console.log(`⚠️ Receipt image not found for receipt ${idx + 1} (deferring):`);
                    console.log(`   Original path: ${imagePath}`);
                    console.log(`   Cleaned path: ${cleanPath}`);
                    console.log(`   Tried paths: ${triedPaths.join(', ')}`);
                  }
                }
              } catch (imageError) {
                console.error(`❌ Error preparing receipt image for receipt ${idx + 1}:`, imageError);
              }
            }
          });
          // After table, render all images
          if (imagesToAdd.length > 0) {
            doc.addPage();
            yPos = margin + 20;
            doc.setFontSize(14);
            doc.setFont('helvetica', 'bold');
            safeText('RECEIPT IMAGES', pageWidth / 2, yPos, { align: 'center' });
            yPos += 30;
            const maxImageWidth = 200;
            const maxImageHeight = 150;
            const startX = margin;
            let xCursor = startX;
            let imagesPerRow = Math.floor((pageWidth - margin * 2) / (maxImageWidth + 20)) || 1;
            let col = 0;
            imagesToAdd.forEach((img, i) => {
              if (yPos > pageHeight - maxImageHeight - 40) {
                doc.addPage();
                yPos = margin + 20;
                col = 0;
                xCursor = startX;
              }
              try {
                if (img.type === 'base64') {
                  doc.addImage(img.data, 'JPEG', xCursor, yPos, maxImageWidth, maxImageHeight, undefined, 'FAST');
                } else {
                  doc.addImage(img.path, 'JPEG', xCursor, yPos, maxImageWidth, maxImageHeight, undefined, 'FAST');
                }
              } catch (e) {
                console.error('❌ Error drawing receipt image:', e);
              }
              col++;
              if (col >= imagesPerRow) {
                col = 0;
                xCursor = startX;
                yPos += maxImageHeight + 20;
              } else {
                xCursor += maxImageWidth + 20;
              }
            });
          }
          console.log(`📄 Receipts section completed: yPos=${yPos}`);
        }
        
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
      }); // Close costCenterQuery callback for time tracking summary
      }; // Close generateTimesheetAndFinalizePDF function
      
      const processCostCenterSheet = (costCenter, index, onComplete) => {
        // Always start each cost center sheet on a new page
        // But only if we're not already at the top of a page
        // For first cost center, check if we need a page (if yPos is already low, we don't)
        console.log(`📄 Processing cost center ${index} (${costCenter}): yPos=${yPos}`);
        if (index === 0) {
          // First cost center - we're already on a fresh page (added above before "Payable to")
          console.log(`📄 First cost center on existing fresh page (yPos ${yPos})`);
          if (yPos < margin + 60) {
            yPos = margin + 60; // Leave space for title
          }
        } else {
          // Subsequent cost centers - always start on new page
          console.log(`📄 Adding new page for cost center ${index}`);
          doc.addPage();
          yPos = margin + 20;
        }
        
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
          
          // Set draw color for borders BEFORE drawing rectangle
          doc.setDrawColor(0, 0, 0); // Black border
          
          // Draw filled rectangle with border using exact height
          // 'FD' means Fill and Draw border - ensures cell is visible even if empty
          doc.rect(x, y, width, actualHeight, 'FD'); // Fill and draw border
          
          // Set text color and font (ensure black text for visibility)
          if (textColor !== 'white') {
            doc.setTextColor(0, 0, 0); // Black text
          } else {
            doc.setTextColor(255, 255, 255); // White text
          }
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
            // Single line text - always draw text, even if empty (for cell borders)
            if (align === 'right') {
              safeText(text || '', x + width - 3, y + actualHeight/2 + 3);
            } else {
              safeText(text || '', x + 3, y + actualHeight/2 + 3);
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
        const monthStr = month.toString().padStart(2, '0');
        const yearStr = year.toString();
        
        // Query database for cost center filtered data
        const mileageQuery = `
          SELECT date, startLocation, endLocation, miles, odometerReading
          FROM mileage_entries 
          WHERE employeeId = ? 
          AND costCenter = ?
          AND strftime("%m", date) = ? 
          AND strftime("%Y", date) = ?
          ORDER BY date
        `;
        
        const timeTrackingQuery = `
          SELECT date, description, hours
          FROM time_tracking 
          WHERE employeeId = ? 
          AND costCenter = ?
          AND strftime("%m", date) = ? 
          AND strftime("%Y", date) = ?
          ORDER BY date
        `;
        
        // Fetch filtered data for this cost center
        db.all(mileageQuery, [reportData.employeeId, costCenter, monthStr, yearStr], (err, mileageEntries) => {
          if (err) {
            console.error('❌ Error fetching mileage entries:', err);
            mileageEntries = [];
          } else {
            console.log(`📊 Found ${mileageEntries.length} mileage entries for ${costCenter}`);
          }
          
          db.all(timeTrackingQuery, [reportData.employeeId, costCenter, monthStr, yearStr], (err, timeEntries) => {
            if (err) {
              console.error('❌ Error fetching time tracking entries:', err);
              timeEntries = [];
            } else {
              console.log(`📊 Found ${timeEntries.length} time tracking entries for ${costCenter}`);
            }
            
            // NOW draw the title, subtitle, and header AFTER data is fetched
            doc.setFontSize(14);
            doc.setFont('helvetica', 'bold');
            safeText(`COST CENTER TRAVEL SHEET - ${costCenter}`, pageWidth / 2, yPos, { align: 'center' });
            
            yPos += 30;
            doc.setFontSize(11);
            safeText(`${reportData.name || 'N/A'} - ${reportData.month} ${reportData.year}`, pageWidth / 2, yPos, { align: 'center' });
            
            yPos += 40;
            
            // Draw header row AFTER titles
            let ccXPos = ccTableStartX;
            ccHeaders.forEach((header, i) => {
              const needsWrapping = header.length > 20;
              drawCCCell(ccXPos, yPos, ccColWidths[i], maxHeaderHeight, header, 'darkBlue', 'white', 'center', needsWrapping);
              ccXPos += ccColWidths[i];
            });
            yPos += maxHeaderHeight;
            
            // Build maps for daily data aggregation
            const dailyDataMap = {};
            
            // Process mileage entries
            mileageEntries.forEach(entry => {
              // Handle both YYYY-MM-DD and MM/DD/YY formats
              let day;
              if (entry.date.includes('-')) {
                // YYYY-MM-DD format
                day = parseInt(entry.date.split('-')[2]);
              } else {
                // MM/DD/YY format
                day = parseInt(entry.date.split('/')[1]);
              }
              if (!dailyDataMap[day]) {
                dailyDataMap[day] = {
                  date: entry.date,
                  description: '',
                  hours: 0,
                  odometerStart: entry.odometerReading || 0,
                  odometerEnd: entry.odometerReading || 0,
                  miles: entry.miles || 0,
                  mileageAmount: (entry.miles || 0) * 0.655 // Standard IRS mileage rate (can be adjusted)
                };
              } else {
                // Sum mileage data if multiple entries per day
                dailyDataMap[day].miles += (entry.miles || 0);
                dailyDataMap[day].mileageAmount += ((entry.miles || 0) * 0.655);
                if (entry.odometerReading && entry.odometerReading > dailyDataMap[day].odometerEnd) {
                  dailyDataMap[day].odometerEnd = entry.odometerReading;
                }
              }
            });
            
            // Process time tracking entries (for descriptions and hours)
            timeEntries.forEach(entry => {
              // Handle both YYYY-MM-DD and MM/DD/YY formats
              let day;
              if (entry.date.includes('-')) {
                // YYYY-MM-DD format
                day = parseInt(entry.date.split('-')[2]);
              } else {
                // MM/DD/YY format
                day = parseInt(entry.date.split('/')[1]);
              }
              if (!dailyDataMap[day]) {
                dailyDataMap[day] = {
                  date: entry.date,
                  description: entry.description || '',
                  hours: parseFloat(entry.hours) || 0,
                  odometerStart: 0,
                  odometerEnd: 0,
                  miles: 0,
                  mileageAmount: 0
                };
              } else {
                // Append description if multiple entries per day
                if (entry.description) {
                  dailyDataMap[day].description = dailyDataMap[day].description 
                    ? `${dailyDataMap[day].description}\n${entry.description}` 
                    : entry.description;
                }
                dailyDataMap[day].hours += (parseFloat(entry.hours) || 0);
              }
            });
            
            // Calculate totals for this cost center
            let totalMiles = 0;
            let totalHours = 0;
            let totalAmount = 0;
            Object.values(dailyDataMap).forEach(dayData => {
              totalMiles += dayData.miles;
              totalHours += dayData.hours;
              totalAmount += dayData.mileageAmount;
            });
            
            console.log(`📊 ${costCenter}: ${Object.keys(dailyDataMap).length} days with data, Total: ${totalMiles} miles, ${totalHours} hours`);
            console.log(`📊 About to draw rows for ${costCenter}`);
            console.log(`📊 Variables: yPos=${yPos}, daysInMonth=${daysInMonth}, month=${month}, year=${year}`);
            console.log(`📊 Drawing rows for ${costCenter}, yPos before loop: ${yPos}, daysIn readable: ${daysInMonth}`);
            
            // Draw header row first
            let headerXPos = ccTableStartX;
            ccHeaders.forEach((header, i) => {
              const headerColor = 'lightBlue'; // Header row background
              drawCCCell(headerXPos, yPos, ccColWidths[i], ccCellHeight, header, headerColor, 'black', 'left', false);
              headerXPos += ccColWidths[i];
            });
            yPos += ccCellHeight;
            console.log(`📊 Drew header row, yPos now: ${yPos}`);
        
        // Generate rows for all days of the month
            let rowsDrawn = 0;
        for (let day = 1; day <= daysInMonth; day++) {
          if (yPos > pageHeight - 100) {
            doc.addPage();
            yPos = margin;
          }
          
          const dateStr = `${month.toString().padStart(2, '0')}/${day.toString().padStart(2, '0')}/${year.toString().slice(-2)}`;
              const dayData = dailyDataMap[day] || {
                date: dateStr,
                description: '',
                hours: 0,
                odometerStart: 0,
                odometerEnd: 0,
                miles: 0,
                mileageAmount: 0
              };
              
              // Debug: Log first few rows with data
              if (day <= 5 || dayData.hours > 0 || dayData.description) {
                console.log(`  Day ${day}: hours=${dayData.hours}, desc="${dayData.description?.substring(0, 30)}", yPos=${yPos}`);
              }
          
          ccXPos = ccTableStartX;
          const rowData = [
            dateStr,
                dayData.description || '',
                dayData.hours > 0 ? dayData.hours.toString() : '',
                dayData.odometerStart > 0 ? dayData.odometerStart.toString() : '',
                dayData.odometerEnd > 0 ? dayData.odometerEnd.toString() : '',
                dayData.miles > 0 ? Math.round(dayData.miles).toString() : '',
                dayData.mileageAmount > 0 ? `$${dayData.mileageAmount.toFixed(2)}` : ''
          ];
          
          // Check if description needs wrapping and calculate required height
              const descriptionNeedsWrapping = (dayData.description || '').length > 20;
          let maxRowHeight = ccCellHeight; // Start with base height
          
          // Calculate the height needed for the description cell if it needs wrapping
          if (descriptionNeedsWrapping) {
            // Use the same calculation as drawCCCell for consistency
            const maxCharsPerLine = Math.floor((ccColWidths[1] - 6) / 3.5); // 6px padding, ~3.5px per character at size 6
            
                const descriptionText = dayData.description || '';
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
                
                // Debug: Log first few cells with data
                if (day <= 3 && i === 0) {
                  console.log(`    Drawing cell ${i} for day ${day}: text="${data}", x=${ccXPos}, y=${yPos}, color=${cellColor}`);
                }
            
            // All cells in the row should be the same height as the tallest cell
            drawCCCell(ccXPos, yPos, ccColWidths[i], maxRowHeight, data, cellColor, 'black', textAlign, shouldWrap);
            ccXPos += ccColWidths[i];
          });
          
          yPos += maxRowHeight;
              rowsDrawn++;
        }
            
            console.log(`📊 ${costCenter}: Drew ${rowsDrawn} rows, yPos after loop: ${yPos}`);
        
        yPos += 25;
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
            safeText(`Total Miles: ${Math.round(totalMiles)}`, margin, yPos);
        yPos += 18;
            safeText(`Total Hours: ${totalHours.toFixed(1)}`, margin, yPos);
        yPos += 18;
            safeText(`Total Amount: $${totalAmount.toFixed(2)}`, margin, yPos);
            
            // This cost center sheet is complete, call the callback to process the next one
            onComplete();
          });
        });
      };
      
      // Process cost centers sequentially, one at a time
      const processCostCenterSheetsSequentially = (index = 0) => {
        if (index >= costCentersToProcess.length) {
          // All cost center sheets done, now generate timesheet and finalize PDF
          generateTimesheetAndFinalizePDF();
          return;
        }
        
        const costCenter = costCentersToProcess[index];
        processCostCenterSheet(costCenter, index, () => {
          // Callback: this cost center is done, process the next one
          processCostCenterSheetsSequentially(index + 1);
            });
          };
          
      // Start processing cost centers sequentially
      processCostCenterSheetsSequentially(0);
            
      // NOTE: The above function is called after all cost center sheets complete
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
  
  // Listen on all network interfaces (0.0.0.0) to allow mobile device connections
  server.listen(PORT, '0.0.0.0', () => {
    const networkIPs = getNetworkIPs();
    console.log(`🚀 Backend server running on http://localhost:${PORT}`);
    console.log(`🔌 WebSocket server running on ws://localhost:${PORT}/ws`);
    
    if (networkIPs.length > 0) {
      console.log(`📱 Mobile app connection URLs:`);
      networkIPs.forEach(ip => {
        console.log(`   http://${ip}:${PORT}`);
        console.log(`   ws://${ip}:${PORT}/ws`);
      });
      console.log(`\n💡 Use one of the above IPs instead of localhost from your mobile device`);
    }
    
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
