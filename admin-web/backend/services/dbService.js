/**
 * Database Service
 * Manages SQLite database connection and provides helper functions
 * Extracted from server.js for better organization
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { debugLog, debugError, debugWarn } = require('../debug');
const constants = require('../utils/constants');

// Database path
const DB_PATH = path.join(__dirname, '..', 'expense_tracker.db');

// Database connection (will be initialized)
let db = null;


/**
 * Get the database connection instance
 * @returns {sqlite3.Database} The SQLite database connection
 * @throws {Error} If database has not been initialized
 * 
 * @example
 * const db = dbService.getDb();
 * db.get('SELECT * FROM employees WHERE id = ?', [id], (err, row) => {
 *   if (err) console.error(err);
 *   else console.log(row);
 * });
 */
function getDb() {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return db;
}

/**
 * Initialize the database connection and ensure all tables exist
 * Creates the database file if it doesn't exist and sets up all required tables
 * @returns {Promise<void>} Resolves when database is initialized
 * @throws {Error} If database initialization fails
 * 
 * @example
 * await dbService.initDatabase();
 * console.log('Database ready');
 */
function initDatabase() {
  return new Promise((resolve, reject) => {
    db = new sqlite3.Database(DB_PATH, (err) => {
      if (err) {
        debugError('❌ Database connection error:', err.message);
        // Create a sample database if it doesn't exist
        createSampleDatabase().then(resolve).catch(reject);
      } else {
        debugLog('✅ Connected to the SQLite database');
        // Always ensure tables exist, even if database already exists
        ensureTablesExist().then(resolve).catch(reject);
      }
    });
  });
}

/**
 * Ensure all required database tables exist, creating them if necessary
 * Also creates database indexes for performance optimization
 * @returns {Promise<void>} Resolves when all tables are created/verified
 * @throws {Error} If table creation fails
 */
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
        role TEXT DEFAULT 'employee',
        permissions TEXT DEFAULT '[]',
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
        typicalWorkStartHour INTEGER DEFAULT NULL,
        typicalWorkEndHour INTEGER DEFAULT NULL,
        hasCompletedOnboarding INTEGER DEFAULT 0,
        hasCompletedSetupWizard INTEGER DEFAULT 0,
        lastLoginAt TEXT DEFAULT NULL,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      )`);
      
      // Add lastLoginAt and role columns if they don't exist (for existing databases)
      // SQLite doesn't support IF NOT EXISTS for ALTER TABLE, so we check if columns exist first
      db.all(`PRAGMA table_info(employees)`, [], (pragmaErr, columns) => {
        if (!pragmaErr && columns) {
          const columnNames = columns.map((col) => col.name);
          
          // Check if lastLoginAt column exists
          if (!columnNames.includes('lastLoginAt')) {
            db.run(`ALTER TABLE employees ADD COLUMN lastLoginAt TEXT DEFAULT NULL`, (alterErr) => {
              if (alterErr) {
                debugWarn('Note: Could not add lastLoginAt column:', alterErr.message);
              } else {
                debugLog('✅ Added lastLoginAt column to existing employees table');
              }
            });
          }
          
          // Check if role column exists
          if (!columnNames.includes('role')) {
            db.run(`ALTER TABLE employees ADD COLUMN role TEXT DEFAULT 'employee'`, (alterErr) => {
              if (alterErr) {
                debugWarn('Note: Could not add role column:', alterErr.message);
              } else {
                debugLog('✅ Added role column to existing employees table');
                // Backfill roles based on position for existing employees
                db.run(`UPDATE employees SET role = 'finance' WHERE LOWER(position) LIKE '%finance%' OR LOWER(position) LIKE '%accounting%' OR LOWER(position) LIKE '%accountant%' OR LOWER(position) LIKE '%controller%' OR LOWER(position) LIKE '%cfo%' OR LOWER(position) LIKE '%chief financial%'`, (backfillErr) => {
                  if (!backfillErr) {
                    debugLog('✅ Backfilled finance roles based on position');
                  }
                });
                db.run(`UPDATE employees SET role = 'admin' WHERE LOWER(name) LIKE '%greg%' OR LOWER(name) LIKE '%goose%' OR LOWER(name) LIKE '%admin%' OR LOWER(email) LIKE '%greg.weisz%' OR LOWER(position) LIKE '%executive director%'`, (backfillErr) => {
                  if (!backfillErr) {
                    debugLog('✅ Backfilled admin roles based on name/position');
                  }
                });
                db.run(`UPDATE employees SET role = 'supervisor' WHERE LOWER(position) LIKE '%director%' OR LOWER(position) LIKE '%program director%' OR LOWER(position) LIKE '%regional manager%' OR LOWER(position) LIKE '%house manager%' OR LOWER(position) LIKE '%supervisor%' OR LOWER(position) LIKE '%coordinator%' OR LOWER(position) LIKE '%administrative assistant%' AND LOWER(position) NOT LIKE '%case manager%' AND role = 'employee'`, (backfillErr) => {
                  if (!backfillErr) {
                    debugLog('✅ Backfilled supervisor roles based on position');
                  }
                });
                db.run(`UPDATE employees SET role = 'contracts' WHERE LOWER(position) LIKE '%contracts%' AND role = 'employee'`, (backfillErr) => {
                  if (!backfillErr) {
                    debugLog('✅ Backfilled contracts roles based on position');
                  }
                });
              }
            });
          }
          
          // Check if permissions column exists
          if (!columnNames.includes('permissions')) {
            db.run(`ALTER TABLE employees ADD COLUMN permissions TEXT DEFAULT '[]'`, (alterErr) => {
              if (alterErr) {
                debugWarn('Note: Could not add permissions column:', alterErr.message);
              } else {
                debugLog('✅ Added permissions column to employees table');
              }
            });
          }
        }
      });

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
        fileType TEXT DEFAULT 'image',
        costCenter TEXT DEFAULT '',
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      )`);

      // Add fileType column to receipts table if it doesn't exist (migration)
      db.all(`PRAGMA table_info(receipts)`, [], (pragmaErr, columns) => {
        if (!pragmaErr && columns) {
          const columnNames = columns.map((col) => col.name);
          
          // Check if fileType column exists
          if (!columnNames.includes('fileType')) {
            db.run(`ALTER TABLE receipts ADD COLUMN fileType TEXT DEFAULT 'image'`, (alterErr) => {
              if (alterErr) {
                debugWarn('Note: Could not add fileType column:', alterErr.message);
              } else {
                debugLog('✅ Added fileType column to existing receipts table');
              }
            });
          }
        }
      });

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
        stayedOvernight INTEGER DEFAULT 0,
        dayOff INTEGER DEFAULT 0,
        dayOffType TEXT,
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
          debugError('❌ Error creating biweekly_reports table:', err);
        } else {
          debugLog('✅ Biweekly reports table created/verified');
        }
      });

      // Create cost centers table
      db.run(`CREATE TABLE IF NOT EXISTS cost_centers (
        id TEXT PRIMARY KEY,
        code TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        isActive INTEGER DEFAULT 1,
        enableGoogleMaps INTEGER DEFAULT 0,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      )`, (err) => {
        if (err) {
          debugError('❌ Error creating cost_centers table:', err);
        } else {
          debugLog('✅ Cost centers table created/verified');
        }
      });

      // Add enableGoogleMaps column if it doesn't exist (for existing databases)
      db.all(`PRAGMA table_info(cost_centers)`, [], (pragmaErr, columns) => {
        if (!pragmaErr && columns) {
          const columnNames = columns.map((col) => col.name);
          
          // Check if enableGoogleMaps column exists
          if (!columnNames.includes('enableGoogleMaps')) {
            db.run(`ALTER TABLE cost_centers ADD COLUMN enableGoogleMaps INTEGER DEFAULT 0`, (alterErr) => {
              if (alterErr) {
                debugWarn('Note: Could not add enableGoogleMaps column:', alterErr.message);
              } else {
                debugLog('✅ Added enableGoogleMaps column to existing cost_centers table');
              }
            });
          }
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

      // Ensure new approval workflow columns exist on expense_reports
      db.all(`PRAGMA table_info(expense_reports)`, (err, columns) => {
        if (!err && columns) {
          const columnNames = columns.map(col => col.name);

          if (!columnNames.includes('approvalWorkflow')) {
            db.run(`ALTER TABLE expense_reports ADD COLUMN approvalWorkflow TEXT DEFAULT '[]'`, (alterErr) => {
              if (alterErr) debugLog('Note: approvalWorkflow column may already exist');
              else debugLog('✅ Added approvalWorkflow column to expense_reports table');
            });
          }

          if (!columnNames.includes('currentApprovalStep')) {
            db.run(`ALTER TABLE expense_reports ADD COLUMN currentApprovalStep INTEGER DEFAULT 0`, (alterErr) => {
              if (alterErr) debugLog('Note: currentApprovalStep column may already exist');
              else debugLog('✅ Added currentApprovalStep column to expense_reports table');
            });
          }

          if (!columnNames.includes('currentApprovalStage')) {
            db.run(`ALTER TABLE expense_reports ADD COLUMN currentApprovalStage TEXT DEFAULT ''`, (alterErr) => {
              if (alterErr) debugLog('Note: currentApprovalStage column may already exist');
              else debugLog('✅ Added currentApprovalStage column to expense_reports table');
            });
          }

          if (!columnNames.includes('currentApproverId')) {
            db.run(`ALTER TABLE expense_reports ADD COLUMN currentApproverId TEXT DEFAULT NULL`, (alterErr) => {
              if (alterErr) debugLog('Note: currentApproverId column may already exist');
              else debugLog('✅ Added currentApproverId column to expense_reports table');
            });
          }

          if (!columnNames.includes('currentApproverName')) {
            db.run(`ALTER TABLE expense_reports ADD COLUMN currentApproverName TEXT DEFAULT NULL`, (alterErr) => {
              if (alterErr) debugLog('Note: currentApproverName column may already exist');
              else debugLog('✅ Added currentApproverName column to expense_reports table');
            });
          }

          if (!columnNames.includes('escalationDueAt')) {
            db.run(`ALTER TABLE expense_reports ADD COLUMN escalationDueAt TEXT DEFAULT NULL`, (alterErr) => {
              if (alterErr) debugLog('Note: escalationDueAt column may already exist');
              else debugLog('✅ Added escalationDueAt column to expense_reports table');
            });
          }
        }
      });

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

      // Create table for revision notes (tracking specific items that need revision)
      db.run(`CREATE TABLE IF NOT EXISTS report_revision_notes (
        id TEXT PRIMARY KEY,
        reportId TEXT NOT NULL,
        employeeId TEXT NOT NULL,
        requestedBy TEXT NOT NULL,
        requestedByName TEXT NOT NULL,
        requestedByRole TEXT NOT NULL,
        targetRole TEXT NOT NULL,
        category TEXT NOT NULL,
        itemId TEXT,
        itemType TEXT NOT NULL,
        notes TEXT NOT NULL,
        resolved INTEGER DEFAULT 0,
        resolvedBy TEXT,
        resolvedAt TEXT,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      )`);

      // Create unified notifications table (replaces supervisor_notifications and staff_notifications)
      db.run(`CREATE TABLE IF NOT EXISTS notifications (
        id TEXT PRIMARY KEY,
        recipientId TEXT NOT NULL,
        recipientRole TEXT NOT NULL,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        reportId TEXT,
        employeeId TEXT,
        employeeName TEXT,
        actorId TEXT,
        actorName TEXT,
        actorRole TEXT,
        isRead INTEGER DEFAULT 0,
        isDismissible INTEGER DEFAULT 1,
        createdAt TEXT NOT NULL,
        readAt TEXT,
        metadata TEXT,
        FOREIGN KEY (reportId) REFERENCES expense_reports(id) ON DELETE CASCADE
      )`);

      // Legacy tables - kept for backward compatibility, will be migrated gradually
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

      // Add notification preferences to employees table (for Sunday reminder preferences)
      db.all(`PRAGMA table_info(employees)`, [], (pragmaErr, columns) => {
        if (!pragmaErr && columns) {
          const columnNames = columns.map((col) => col.name);
          
          if (!columnNames.includes('sundayReminderEnabled')) {
            db.run(`ALTER TABLE employees ADD COLUMN sundayReminderEnabled INTEGER DEFAULT 1`, (alterErr) => {
              if (!alterErr) {
                debugLog('✅ Added sundayReminderEnabled column to employees table');
              }
            });
          }
        }
      });

      // Add missing columns to existing employees table if they don't exist
      // Check if columns exist before adding them
      db.all(`PRAGMA table_info(employees)`, (err, columns) => {
        if (!err && columns) {
          const columnNames = columns.map(col => col.name);
          
          if (!columnNames.includes('selectedCostCenters')) {
            db.run(`ALTER TABLE employees ADD COLUMN selectedCostCenters TEXT DEFAULT '[]'`, (err) => {
              if (err) debugLog('Note: selectedCostCenters column may already exist');
            });
          }
          
          if (!columnNames.includes('defaultCostCenter')) {
            db.run(`ALTER TABLE employees ADD COLUMN defaultCostCenter TEXT DEFAULT ''`, (err) => {
              if (err) debugLog('Note: defaultCostCenter column may already exist');
            });
          }
          
          if (!columnNames.includes('signature')) {
            db.run(`ALTER TABLE employees ADD COLUMN signature TEXT DEFAULT NULL`, (err) => {
              if (err) debugLog('Note: signature column may already exist');
              else debugLog('✅ Added signature column to employees table');
            });
          }
          
          if (!columnNames.includes('preferredName')) {
            db.run(`ALTER TABLE employees ADD COLUMN preferredName TEXT DEFAULT ''`, (err) => {
              if (err) debugLog('Note: preferredName column may already exist');
              else debugLog('✅ Added preferredName column to employees table');
            });
          }
          
          if (!columnNames.includes('supervisorId')) {
            db.run(`ALTER TABLE employees ADD COLUMN supervisorId TEXT DEFAULT NULL`, (err) => {
              if (err) debugLog('Note: supervisorId column may already exist');
              else debugLog('✅ Added supervisorId column to employees table');
            });
          }
          
          if (!columnNames.includes('approvalFrequency')) {
            db.run(`ALTER TABLE employees ADD COLUMN approvalFrequency TEXT DEFAULT 'monthly'`, (err) => {
              if (err) debugLog('Note: approvalFrequency column may already exist');
              else debugLog('✅ Added approvalFrequency column to employees table');
            });
          }
          
          if (!columnNames.includes('archived')) {
            db.run(`ALTER TABLE employees ADD COLUMN archived INTEGER DEFAULT 0`, (err) => {
              if (err) debugLog('Note: archived column may already exist');
              else debugLog('✅ Added archived column to employees table');
            });
          }
          
          if (!columnNames.includes('typicalWorkStartHour')) {
            db.run(`ALTER TABLE employees ADD COLUMN typicalWorkStartHour INTEGER DEFAULT NULL`, (err) => {
              if (err) debugLog('Note: typicalWorkStartHour column may already exist');
              else debugLog('✅ Added typicalWorkStartHour column to employees table');
            });
          }
          
          if (!columnNames.includes('typicalWorkEndHour')) {
            db.run(`ALTER TABLE employees ADD COLUMN typicalWorkEndHour INTEGER DEFAULT NULL`, (err) => {
              if (err) debugLog('Note: typicalWorkEndHour column may already exist');
              else debugLog('✅ Added typicalWorkEndHour column to employees table');
            });
          }
          
          if (!columnNames.includes('hasCompletedOnboarding')) {
            db.run(`ALTER TABLE employees ADD COLUMN hasCompletedOnboarding INTEGER DEFAULT 0`, (err) => {
              if (err) debugLog('Note: hasCompletedOnboarding column may already exist');
              else debugLog('✅ Added hasCompletedOnboarding column to employees table');
            });
          }
          
          if (!columnNames.includes('hasCompletedSetupWizard')) {
            db.run(`ALTER TABLE employees ADD COLUMN hasCompletedSetupWizard INTEGER DEFAULT 0`, (err) => {
              if (err) debugLog('Note: hasCompletedSetupWizard column may already exist');
              else debugLog('✅ Added hasCompletedSetupWizard column to employees table');
            });
          }
          
          if (!columnNames.includes('preferences')) {
            db.run(`ALTER TABLE employees ADD COLUMN preferences TEXT DEFAULT '{}'`, (err) => {
              if (err) debugLog('Note: preferences column may already exist');
              else debugLog('✅ Added preferences column to employees table');
            });
          }

          if (!columnNames.includes('permissions')) {
            db.run(`ALTER TABLE employees ADD COLUMN permissions TEXT DEFAULT '[]'`, (err) => {
              if (err) debugLog('Note: permissions column may already exist');
              else debugLog('✅ Added permissions column to employees table');
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
              if (err) debugLog('Note: costCenter column may already exist');
            });
          }
          
          if (!columnNames.includes('startLocationName')) {
            db.run(`ALTER TABLE mileage_entries ADD COLUMN startLocationName TEXT DEFAULT ''`, (err) => {
              if (err) debugLog('Note: startLocationName column may already exist');
            });
          }
          
          if (!columnNames.includes('startLocationAddress')) {
            db.run(`ALTER TABLE mileage_entries ADD COLUMN startLocationAddress TEXT DEFAULT ''`, (err) => {
              if (err) debugLog('Note: startLocationAddress column may already exist');
            });
          }
          
          if (!columnNames.includes('startLocationLat')) {
            db.run(`ALTER TABLE mileage_entries ADD COLUMN startLocationLat REAL DEFAULT 0`, (err) => {
              if (err) debugLog('Note: startLocationLat column may already exist');
            });
          }
          
          if (!columnNames.includes('startLocationLng')) {
            db.run(`ALTER TABLE mileage_entries ADD COLUMN startLocationLng REAL DEFAULT 0`, (err) => {
              if (err) debugLog('Note: startLocationLng column may already exist');
            });
          }
          
          if (!columnNames.includes('endLocationName')) {
            db.run(`ALTER TABLE mileage_entries ADD COLUMN endLocationName TEXT DEFAULT ''`, (err) => {
              if (err) debugLog('Note: endLocationName column may already exist');
            });
          }
          
          if (!columnNames.includes('endLocationAddress')) {
            db.run(`ALTER TABLE mileage_entries ADD COLUMN endLocationAddress TEXT DEFAULT ''`, (err) => {
              if (err) debugLog('Note: endLocationAddress column may already exist');
            });
          }
          
          if (!columnNames.includes('endLocationLat')) {
            db.run(`ALTER TABLE mileage_entries ADD COLUMN endLocationLat REAL DEFAULT 0`, (err) => {
              if (err) debugLog('Note: endLocationLat column may already exist');
            });
          }
          
          if (!columnNames.includes('endLocationLng')) {
            db.run(`ALTER TABLE mileage_entries ADD COLUMN endLocationLng REAL DEFAULT 0`, (err) => {
              if (err) debugLog('Note: endLocationLng column may already exist');
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
              if (err) debugLog('Note: costCenter column may already exist');
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
              if (err) debugLog('Note: costCenter column may already exist');
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
              if (err) debugLog('Note: useActualAmount column may already exist');
              else debugLog('✅ Added useActualAmount column to per_diem_rules table');
            });
          }
        }
      });

      // Add stayedOvernight column to daily_descriptions table if it doesn't exist
      db.all(`PRAGMA table_info(daily_descriptions)`, (err, columns) => {
        if (!err && columns) {
          const columnNames = columns.map(col => col.name);
          
          if (!columnNames.includes('stayedOvernight')) {
            db.run(`ALTER TABLE daily_descriptions ADD COLUMN stayedOvernight INTEGER DEFAULT 0`, (err) => {
              if (err) debugLog('Note: stayedOvernight column may already exist');
              else debugLog('✅ Added stayedOvernight column to daily_descriptions table');
            });
          }
          
          if (!columnNames.includes('dayOff')) {
            db.run(`ALTER TABLE daily_descriptions ADD COLUMN dayOff INTEGER DEFAULT 0`, (err) => {
              if (err) debugLog('Note: dayOff column may already exist');
              else debugLog('✅ Added dayOff column to daily_descriptions table');
            });
          }
          
          if (!columnNames.includes('dayOffType')) {
            db.run(`ALTER TABLE daily_descriptions ADD COLUMN dayOffType TEXT`, (err) => {
              if (err) debugLog('Note: dayOffType column may already exist');
              else debugLog('✅ Added dayOffType column to daily_descriptions table');
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
      debugLog('🔧 Populating cost centers table with', constants.COST_CENTERS.length, 'cost centers...');
      constants.COST_CENTERS.forEach((name, index) => {
        const id = `cc-${index + 1}`;
        const code = name.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
        db.run(`INSERT OR IGNORE INTO cost_centers (id, code, name, description, isActive, createdAt, updatedAt) 
                VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [id, code, name, `${name} cost center`, 1, now, now], (err) => {
          if (err) {
            debugError(`❌ Error inserting cost center ${name}:`, err);
          }
        });
      });
      debugLog('✅ Cost centers population completed');

      // Create indexes for better query performance
      debugLog('🔧 Creating database indexes for performance...');
      
      // Employees indexes
      db.run(`CREATE INDEX IF NOT EXISTS idx_employees_email ON employees(email)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_employees_supervisorId ON employees(supervisorId)`);
      
      // Mileage entries indexes
      db.run(`CREATE INDEX IF NOT EXISTS idx_mileage_entries_employeeId ON mileage_entries(employeeId)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_mileage_entries_date ON mileage_entries(date)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_mileage_entries_employee_date ON mileage_entries(employeeId, date)`);
      
      // Receipts indexes
      db.run(`CREATE INDEX IF NOT EXISTS idx_receipts_employeeId ON receipts(employeeId)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_receipts_date ON receipts(date)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_receipts_employee_date ON receipts(employeeId, date)`);
      
      // Time tracking indexes
      db.run(`CREATE INDEX IF NOT EXISTS idx_time_tracking_employeeId ON time_tracking(employeeId)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_time_tracking_date ON time_tracking(date)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_time_tracking_employee_date ON time_tracking(employeeId, date)`);
      
      // Monthly reports indexes
      db.run(`CREATE INDEX IF NOT EXISTS idx_monthly_reports_employee ON monthly_reports(employeeId)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_monthly_reports_employee_month_year ON monthly_reports(employeeId, month, year)`);
      
      // Weekly reports indexes
      db.run(`CREATE INDEX IF NOT EXISTS idx_weekly_reports_employee ON weekly_reports(employeeId)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_weekly_reports_employee_week_year ON weekly_reports(employeeId, weekNumber, year)`);
      
      // Biweekly reports indexes
      db.run(`CREATE INDEX IF NOT EXISTS idx_biweekly_reports_employee ON biweekly_reports(employeeId)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_biweekly_reports_employee_month_year ON biweekly_reports(employeeId, month, year)`);
      
      // Expense reports indexes
      db.run(`CREATE INDEX IF NOT EXISTS idx_expense_reports_employee ON expense_reports(employeeId)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_expense_reports_employee_month_year ON expense_reports(employeeId, month, year)`);
      
      // Daily descriptions indexes
      db.run(`CREATE INDEX IF NOT EXISTS idx_daily_descriptions_employee ON daily_descriptions(employeeId)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_daily_descriptions_employee_date ON daily_descriptions(employeeId, date)`);
      
      // Notifications indexes
      db.run(`CREATE INDEX IF NOT EXISTS idx_notifications_recipientId ON notifications(recipientId)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_notifications_recipientRole ON notifications(recipientRole)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_notifications_isRead ON notifications(isRead)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_notifications_createdAt ON notifications(createdAt)`);
      
      // Legacy notification indexes
      db.run(`CREATE INDEX IF NOT EXISTS idx_supervisor_notifications_supervisorId ON supervisor_notifications(supervisorId)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_staff_notifications_employeeId ON staff_notifications(employeeId)`);
      
      // Dashboard preferences table
      db.run(`CREATE TABLE IF NOT EXISTS dashboard_preferences (
        userId TEXT PRIMARY KEY,
        preferences TEXT NOT NULL DEFAULT '{}',
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      )`, (err) => {
        if (err) {
          debugError('❌ Error creating dashboard_preferences table:', err);
        } else {
          debugLog('✅ Dashboard preferences table created/verified');
        }
      });

      db.run(`CREATE TABLE IF NOT EXISTS report_builder_presets (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT DEFAULT '',
        columns TEXT NOT NULL,
        filters TEXT NOT NULL,
        createdBy TEXT DEFAULT NULL,
        updatedBy TEXT DEFAULT NULL,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      )`, (err) => {
        if (err) {
          debugError('❌ Error creating report_builder_presets table:', err);
        } else {
          debugLog('✅ Report builder presets table created/verified');
        }
      });

      db.run(`CREATE TABLE IF NOT EXISTS report_delivery_schedules (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT DEFAULT '',
        recipients TEXT NOT NULL,
        frequency TEXT NOT NULL,
        dayOfWeek INTEGER,
        dayOfMonth INTEGER,
        timeOfDay TEXT NOT NULL DEFAULT '${constants.REPORT_SCHEDULE_DEFAULT_TIME}',
        timezone TEXT NOT NULL DEFAULT '${constants.REPORT_SCHEDULE_DEFAULT_TIMEZONE}',
        includeCsv INTEGER NOT NULL DEFAULT 1,
        includePdf INTEGER NOT NULL DEFAULT 0,
        columns TEXT NOT NULL,
        filters TEXT NOT NULL,
        rowLimit INTEGER NOT NULL DEFAULT ${constants.REPORT_SCHEDULE_DEFAULT_ROW_LIMIT},
        active INTEGER NOT NULL DEFAULT 1,
        lastRunAt TEXT,
        nextRunAt TEXT,
        lastStatus TEXT DEFAULT NULL,
        lastError TEXT DEFAULT NULL,
        createdBy TEXT DEFAULT NULL,
        updatedBy TEXT DEFAULT NULL,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      )`, (err) => {
        if (err) {
          debugError('❌ Error creating report_delivery_schedules table:', err);
        } else {
          debugLog('✅ Report delivery schedules table created/verified');
        }
      });

      db.run(
        `CREATE INDEX IF NOT EXISTS idx_report_schedules_nextRun ON report_delivery_schedules(nextRunAt)`
      );
      
      debugLog('✅ Database indexes created successfully');

      // REMOVED: All sample mileage, receipt, and time tracking entries
      // Real data will come from mobile app and web portal

      debugLog('✅ All tables ensured to exist with sample data');
      
      // REMOVED: cleanupDuplicates() - was deleting employees incorrectly
      
      resolve();
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
            debugError('❌ Error creating cost_centers table:', err);
          } else {
            debugLog('✅ Cost centers table created/verified');
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
        constants.COST_CENTERS.forEach((name, index) => {
          const id = `cc-${index + 1}`;
          const code = name.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
          db.run(`INSERT OR IGNORE INTO cost_centers (id, code, name, description, isActive, createdAt, updatedAt) 
                  VALUES (?, ?, ?, ?, ?, ?, ?)`,
                  [id, code, name, `${name} cost center`, 1, now, now], (err) => {
            if (err) {
              debugError(`❌ Error inserting cost center ${name}:`, err);
            }
          });
        });

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

        db.run(`CREATE TABLE IF NOT EXISTS report_builder_presets (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          description TEXT DEFAULT '',
          columns TEXT NOT NULL,
          filters TEXT NOT NULL,
          createdBy TEXT DEFAULT NULL,
          updatedBy TEXT DEFAULT NULL,
          createdAt TEXT NOT NULL,
          updatedAt TEXT NOT NULL
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS report_delivery_schedules (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          description TEXT DEFAULT '',
          recipients TEXT NOT NULL,
          frequency TEXT NOT NULL,
          dayOfWeek INTEGER,
          dayOfMonth INTEGER,
          timeOfDay TEXT NOT NULL DEFAULT '${REPORT_SCHEDULE_DEFAULT_TIME}',
          timezone TEXT NOT NULL DEFAULT '${REPORT_SCHEDULE_DEFAULT_TIMEZONE}',
          includeCsv INTEGER NOT NULL DEFAULT 1,
          includePdf INTEGER NOT NULL DEFAULT 0,
          columns TEXT NOT NULL,
          filters TEXT NOT NULL,
          rowLimit INTEGER NOT NULL DEFAULT ${REPORT_SCHEDULE_DEFAULT_ROW_LIMIT},
          active INTEGER NOT NULL DEFAULT 1,
          lastRunAt TEXT,
          nextRunAt TEXT,
          lastStatus TEXT DEFAULT NULL,
          lastError TEXT DEFAULT NULL,
          createdBy TEXT DEFAULT NULL,
          updatedBy TEXT DEFAULT NULL,
          createdAt TEXT NOT NULL,
          updatedAt TEXT NOT NULL
        )`);

        db.run(
          `CREATE INDEX IF NOT EXISTS idx_report_schedules_nextRun ON report_delivery_schedules(nextRunAt)`
        );

        // REMOVED: All sample mileage, receipt, and time tracking data
        // Real data will come from mobile app and web portal
        
        
        debugLog('✅ Database tables created (no sample data)');
        resolve();
      });
    });
  });
}

/**
 * Get an employee by their ID
 * @param {string} id - Employee ID
 * @returns {Promise<Object|null>} Employee object or null if not found
 * @throws {Error} If database query fails
 * 
 * @example
 * const employee = await dbService.getEmployeeById('employee-123');
 * if (employee) console.log(employee.name);
 */
function getEmployeeById(id) {
  return new Promise((resolve, reject) => {
    if (!id) {
      resolve(null);
      return;
    }
    db.get('SELECT * FROM employees WHERE id = ?', [id], (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

/**
 * Get all employees directly supervised by a supervisor
 * @param {string} supervisorId - Supervisor employee ID
 * @returns {Promise<Array>} Array of employee objects
 * @throws {Error} If database query fails
 * 
 * @example
 * const team = await dbService.getEmployeesBySupervisor('supervisor-123');
 * console.log(`${team.length} employees found`);
 */
function getEmployeesBySupervisor(supervisorId) {
  return new Promise((resolve, reject) => {
    db.all(
      'SELECT * FROM employees WHERE supervisorId = ? AND (archived IS NULL OR archived = 0)',
      [supervisorId],
      (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      }
    );
  });
}

/**
 * Get all employees with finance-related positions who can approve reports
 * @returns {Promise<Array>} Array of employee objects with finance positions
 * @throws {Error} If database query fails
 * 
 * @example
 * const approvers = await dbService.getFinanceApprovers();
 * console.log(`${approvers.length} finance approvers found`);
 */
function getFinanceApprovers() {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT id, name, preferredName, position FROM employees WHERE (archived IS NULL OR archived = 0) AND LOWER(position) LIKE '%finance%'`,
      (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      }
    );
  });
}

/**
 * Get all employees supervised by a supervisor (directly and indirectly through hierarchy)
 * Recursively finds all employees in the supervision chain
 * @param {string} supervisorId - Supervisor employee ID
 * @returns {Promise<Array>} Array of all supervised employee objects
 * @throws {Error} If database query fails
 * 
 * @example
 * const allTeamMembers = await dbService.getAllSupervisedEmployees('supervisor-123');
 * console.log(`Total team size: ${allTeamMembers.length}`);
 */
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
              debugError('Error finding supervised employees:', err);
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
module.exports = {
  initDatabase,
  getDb,
  getEmployeeById,
  getEmployeesBySupervisor,
  getFinanceApprovers,
  getAllSupervisedEmployees,
  DB_PATH,
};
