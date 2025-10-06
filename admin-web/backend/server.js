const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
const multer = require('multer');
const XLSX = require('xlsx');

const app = express();
const PORT = process.env.PORT || 3002;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' })); // Increase JSON payload limit
app.use(express.static('public'));

// Request logging middleware
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.path}`);
  next();
});

// Multer configuration for file uploads
const upload = multer({ dest: 'uploads/' });

// Database path - this should point to your mobile app's database
const DB_PATH = path.join(__dirname, '../../oxford_tracker.db');

// Database connection
let db;

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

      // Create cost center management tables
      db.run(`CREATE TABLE IF NOT EXISTS cost_centers (
        id TEXT PRIMARY KEY,
        code TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        isActive INTEGER DEFAULT 1,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      )`);

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

      // Insert sample employees if they don't exist
      const now = new Date().toISOString();
      
      db.run(`INSERT OR IGNORE INTO employees (id, name, email, password, oxfordHouseId, position, phoneNumber, baseAddress, baseAddress2, costCenters, createdAt, updatedAt) 
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, 
              ['emp1', 'Greg Weisz', 'greg.weisz@oxfordhouse.org', 'iitywim', 'house1', 'Manager', '555-0123', '230 Wagner St, Troutman, NC 28166', '', '["AL-SOR"]', now, now]);
      
      // Add mobile app employee
      db.run(`INSERT OR IGNORE INTO employees (id, name, email, password, oxfordHouseId, position, phoneNumber, baseAddress, baseAddress2, costCenters, createdAt, updatedAt) 
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, 
              ['mg71acdmrlh5uvfa50a', 'Greg Weisz', 'greg.weisz@oxfordhouse.org', 'iitywim', 'test-house-001', 'Regional Manager', '555-0123', '230 Wagner St, Troutman, NC 28166', '', '["AL-SOR", "G&A", "Fundraising"]', now, now]);

      db.run(`INSERT OR IGNORE INTO employees (id, name, email, password, oxfordHouseId, position, phoneNumber, baseAddress, baseAddress2, costCenters, createdAt, updatedAt) 
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, 
              ['emp2', 'Sarah Johnson', 'sarah.johnson@oxfordhouse.org', 'password123', 'house2', 'Case Manager', '555-0124', '123 Main St Charlotte, NC 28201', '', '["CC001", "CC002"]', now, now]);

      db.run(`INSERT OR IGNORE INTO employees (id, name, email, password, oxfordHouseId, position, phoneNumber, baseAddress, baseAddress2, costCenters, createdAt, updatedAt) 
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, 
              ['emp3', 'Mike Rodriguez', 'mike.rodriguez@oxfordhouse.org', 'secure456', 'house3', 'House Manager', '555-0125', '456 Oak Ave Raleigh, NC 27601', '', '["CC003"]', now, now]);

      db.run(`INSERT OR IGNORE INTO employees (id, name, email, password, oxfordHouseId, position, phoneNumber, baseAddress, baseAddress2, costCenters, createdAt, updatedAt) 
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, 
              ['emp4', 'Lisa Chen', 'lisa.chen@oxfordhouse.org', 'test789', 'house4', 'Administrative Assistant', '555-0126', '789 Pine St Asheville, NC 28801', '', '["CC001", "CC004"]', now, now]);

      // Insert sample cost centers if they don't exist
      db.run(`INSERT OR IGNORE INTO cost_centers (id, code, name, description, isActive, createdAt, updatedAt)
              VALUES (?, ?, ?, ?, ?, ?, ?)`,
              ['cc1', 'AL-SOR', 'Program Services - Alabama', 'Alabama program services', 1, now, now]);
      
      db.run(`INSERT OR IGNORE INTO cost_centers (id, code, name, description, isActive, createdAt, updatedAt)
              VALUES (?, ?, ?, ?, ?, ?, ?)`,
              ['cc2', 'CC001', 'Cost Center 001', 'General operations', 1, now, now]);
      
      db.run(`INSERT OR IGNORE INTO cost_centers (id, code, name, description, isActive, createdAt, updatedAt)
              VALUES (?, ?, ?, ?, ?, ?, ?)`,
              ['cc3', 'CC002', 'Cost Center 002', 'Client services', 1, now, now]);

      db.run(`INSERT OR IGNORE INTO cost_centers (id, code, name, description, isActive, createdAt, updatedAt)
              VALUES (?, ?, ?, ?, ?, ?, ?)`,
              ['cc4', 'CC003', 'Cost Center 003', 'House management', 1, now, now]);

      db.run(`INSERT OR IGNORE INTO cost_centers (id, code, name, description, isActive, createdAt, updatedAt)
              VALUES (?, ?, ?, ?, ?, ?, ?)`,
              ['cc5', 'CC004', 'Cost Center 004', 'Administrative services', 1, now, now]);

      // Insert sample mileage entries for testing
      const currentDate = new Date();
      const currentMonth = currentDate.getMonth() + 1;
      const currentYear = currentDate.getFullYear();
      
      // Add some sample mileage entries for the current month
      db.run(`INSERT OR IGNORE INTO mileage_entries (id, employeeId, oxfordHouseId, date, odometerReading, startLocation, endLocation, purpose, miles, notes, hoursWorked, isGpsTracked, createdAt, updatedAt)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              ['mile1', 'emp1', 'house1', `${currentYear}-${currentMonth.toString().padStart(2, '0')}-15`, 45000, '230 Wagner St, Troutman, NC 28166', '542 Main Ave SE Hickory, NC', 'Pick up U-haul for house move', 15.2, 'U-haul pickup', 2.5, 1, now, now]);

      db.run(`INSERT OR IGNORE INTO mileage_entries (id, employeeId, oxfordHouseId, date, odometerReading, startLocation, endLocation, purpose, miles, notes, hoursWorked, isGpsTracked, createdAt, updatedAt)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              ['mile2', 'emp1', 'house1', `${currentYear}-${currentMonth.toString().padStart(2, '0')}-15`, 45015, '542 Main Ave SE Hickory, NC', '23 Deer Run Dr Asheville, NC', 'House stabilization', 45.8, 'House stabilization work', 3.0, 1, now, now]);

      db.run(`INSERT OR IGNORE INTO mileage_entries (id, employeeId, oxfordHouseId, date, odometerReading, startLocation, endLocation, purpose, miles, notes, hoursWorked, isGpsTracked, createdAt, updatedAt)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              ['mile3', 'emp2', 'house2', `${currentYear}-${currentMonth.toString().padStart(2, '0')}-16`, 32000, '123 Main St Charlotte, NC 28201', '456 Oak Ave Raleigh, NC 27601', 'Client visit', 25.5, 'Client meeting', 4.0, 1, now, now]);

      // Add some sample receipts
      db.run(`INSERT OR IGNORE INTO receipts (id, employeeId, date, amount, vendor, description, category, imageUri, createdAt, updatedAt)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              ['receipt1', 'emp1', `${currentYear}-${currentMonth.toString().padStart(2, '0')}-15`, 89.99, 'U-Haul', 'Truck rental', 'Rental Car', '', now, now]);

      db.run(`INSERT OR IGNORE INTO receipts (id, employeeId, date, amount, vendor, description, category, imageUri, createdAt, updatedAt)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              ['receipt2', 'emp1', `${currentYear}-${currentMonth.toString().padStart(2, '0')}-15`, 45.50, 'Shell', 'Gas for rental truck', 'Rental Car Fuel', '', now, now]);

      db.run(`INSERT OR IGNORE INTO receipts (id, employeeId, date, amount, vendor, description, category, imageUri, createdAt, updatedAt)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              ['receipt3', 'emp2', `${currentYear}-${currentMonth.toString().padStart(2, '0')}-16`, 25.50, 'Starbucks', 'Coffee meeting', 'Per Diem', '', now, now]);

      // Add some sample time tracking
      db.run(`INSERT OR IGNORE INTO time_tracking (id, employeeId, date, category, hours, description, createdAt, updatedAt)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
              ['time1', 'emp1', `${currentYear}-${currentMonth.toString().padStart(2, '0')}-15`, 'G&A Hours', 8.0, 'Regular work hours', now, now]);

      db.run(`INSERT OR IGNORE INTO time_tracking (id, employeeId, date, category, hours, description, createdAt, updatedAt)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
              ['time2', 'emp2', `${currentYear}-${currentMonth.toString().padStart(2, '0')}-16`, 'G&A Hours', 8.0, 'Regular work hours', now, now]);

      console.log('✅ All tables ensured to exist with sample data');
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

        // Cost centers table
        db.run(`CREATE TABLE IF NOT EXISTS cost_centers (
          id TEXT PRIMARY KEY,
          code TEXT UNIQUE NOT NULL,
          name TEXT NOT NULL,
          description TEXT,
          isActive INTEGER DEFAULT 1,
          createdAt TEXT NOT NULL,
          updatedAt TEXT NOT NULL
        )`);

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
        
        // Only insert if no employees exist
        db.get('SELECT COUNT(*) as count FROM employees', (err, row) => {
          if (!err && row.count === 0) {
            db.run(`INSERT INTO employees (id, name, email, password, oxfordHouseId, position, phoneNumber, baseAddress, baseAddress2, costCenters, createdAt, updatedAt) 
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, 
                    ['emp1', 'Greg Weisz', 'greg@example.com', 'iitywim', 'house1', 'Manager', '555-0123', '230 Wagner St, Troutman, NC 28166', '', '["AL-SOR"]', now, now]);
          }
        });

        db.run(`INSERT OR IGNORE INTO oxford_houses (id, name, address, city, state, zipCode, phoneNumber, managerId, createdAt, updatedAt)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                ['house1', 'Sample Oxford House', '123 Main St', 'Troutman', 'NC', '28166', '555-0123', 'emp1', now, now]);

        // Insert sample cost centers
        db.run(`INSERT OR IGNORE INTO cost_centers (id, code, name, description, isActive, createdAt, updatedAt)
                VALUES (?, ?, ?, ?, ?, ?, ?)`,
                ['cc1', 'AL-SOR', 'Program Services - Alabama', 'Alabama program services', 1, now, now]);
        
        db.run(`INSERT OR IGNORE INTO cost_centers (id, code, name, description, isActive, createdAt, updatedAt)
                VALUES (?, ?, ?, ?, ?, ?, ?)`,
                ['cc2', 'CC001', 'Cost Center 001', 'General operations', 1, now, now]);
        
        db.run(`INSERT OR IGNORE INTO cost_centers (id, code, name, description, isActive, createdAt, updatedAt)
                VALUES (?, ?, ?, ?, ?, ?, ?)`,
                ['cc3', 'CC002', 'Cost Center 002', 'Client services', 1, now, now]);

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

        // Insert sample mileage entries for current month
        const currentDate = new Date();
        const currentMonth = currentDate.getMonth() + 1;
        const currentYear = currentDate.getFullYear();
        
        // Add sample mileage entries only if no entries exist
        db.get('SELECT COUNT(*) as count FROM mileage_entries', (err, row) => {
          if (!err && row.count === 0) {
            const may2024Data = [
              { day: 1, description: "NC State Convention **stayed the night**", hours: 8, miles: 0, odometerStart: 0, odometerEnd: 0, cost: 0 },
              { day: 2, description: "NC State Convention **stayed the night**", hours: 8, miles: 0, odometerStart: 0, odometerEnd: 0, cost: 0 },
              { day: 3, description: "NC State Convention **stayed the night**", hours: 8, miles: 0, odometerStart: 0, odometerEnd: 0, cost: 0 },
              { day: 4, description: "NC State Convention **stayed the night**", hours: 8, miles: 0, odometerStart: 0, odometerEnd: 0, cost: 0 },
              { day: 5, description: "Raleigh Marriott Crabtree Valley (4500 Marriott Dr Raleigh, NC) to BA to OH Sharon Amity (252 N Sharon Amity Rd Charlotte, NC) for house stabilization to BA", hours: 8, miles: 237, odometerStart: 145145, odometerEnd: 145382, cost: 105.47 },
              { day: 6, description: "(off)", hours: 0, miles: 0, odometerStart: 0, odometerEnd: 0, cost: 0 },
              { day: 7, description: "(off)", hours: 0, miles: 0, odometerStart: 0, odometerEnd: 0, cost: 0 },
              { day: 8, description: "Work from home office: Zoom calls, emails and phone calls", hours: 8, miles: 0, odometerStart: 0, odometerEnd: 0, cost: 0 },
              { day: 9, description: "BA to coworker's house (13927 Jonathan's Ridge Mint Hill, NC) to work on computer and scanner to BA to OH Gibson (101 Woodsway Ln Morganton, NC) for house stabilization to BA", hours: 8, miles: 211, odometerStart: 82122, odometerEnd: 82333, cost: 93.90 },
              { day: 10, description: "Work from home office: Zoom calls, emails and phone calls", hours: 8, miles: 0, odometerStart: 0, odometerEnd: 0, cost: 0 }
            ];

            may2024Data.forEach(entry => {
              const sampleDate = `${currentYear}-${currentMonth.toString().padStart(2, '0')}-${entry.day.toString().padStart(2, '0')}`;
              
              // Parse description to extract start/end locations for mileage entries
              let startLocation = '230 Wagner St, Troutman, NC 28166'; // Default BA
              let endLocation = '230 Wagner St, Troutman, NC 28166'; // Default BA
              let purpose = entry.description;
              
              if (entry.description.includes('to BA to OH')) {
                // Extract locations from complex descriptions
                const parts = entry.description.split(' to BA to OH ');
                if (parts.length >= 2) {
                  startLocation = parts[0].replace('BA to ', '');
                  endLocation = 'OH ' + parts[1].split(' for ')[0];
                  purpose = 'house stabilization';
                }
              } else if (entry.description.includes('to BA')) {
                const parts = entry.description.split(' to BA');
                if (parts.length >= 1) {
                  startLocation = parts[0].replace('BA to ', '');
                  endLocation = '230 Wagner St, Troutman, NC 28166';
                  purpose = 'house stabilization';
                }
              }
              
              db.run(`INSERT INTO mileage_entries (id, employeeId, date, startLocation, endLocation, purpose, miles, odometerReading, hoursWorked, createdAt, updatedAt)
                      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                      [`mileage_${entry.day}`, 'emp1', sampleDate, startLocation, endLocation, purpose, entry.miles, entry.odometerStart, entry.hours, now, now]);
            });
          }
        });

        // Insert sample receipts only if no receipts exist
        db.get('SELECT COUNT(*) as count FROM receipts', (err, row) => {
          if (!err && row.count === 0) {
            for (let day = 1; day <= 3; day++) {
              const sampleDate = `${currentYear}-${currentMonth.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
              
              db.run(`INSERT INTO receipts (id, employeeId, date, category, amount, description, createdAt, updatedAt)
                      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                      [`receipt_${day}`, 'emp1', sampleDate, 'EES', 50.00 + (day * 10), `Sample EES receipt for day ${day}`, now, now]);
            }
          }
        });

        // Insert sample time tracking only if no time tracking exists
        db.get('SELECT COUNT(*) as count FROM time_tracking', (err, row) => {
          if (!err && row.count === 0) {
            const may2024Data = [
              { day: 1, description: "NC State Convention **stayed the night**", hours: 8 },
              { day: 2, description: "NC State Convention **stayed the night**", hours: 8 },
              { day: 3, description: "NC State Convention **stayed the night**", hours: 8 },
              { day: 4, description: "NC State Convention **stayed the night**", hours: 8 },
              { day: 5, description: "Raleigh Marriott Crabtree Valley to BA to OH Sharon Amity for house stabilization to BA", hours: 8 },
              { day: 6, description: "(off)", hours: 0 },
              { day: 7, description: "(off)", hours: 0 },
              { day: 8, description: "Work from home office: Zoom calls, emails and phone calls", hours: 8 },
              { day: 9, description: "BA to coworker's house to work on computer and scanner to BA to OH Gibson for house stabilization to BA", hours: 8 },
              { day: 10, description: "Work from home office: Zoom calls, emails and phone calls", hours: 8 }
            ];

            may2024Data.forEach(entry => {
              const sampleDate = `${currentYear}-${currentMonth.toString().padStart(2, '0')}-${entry.day.toString().padStart(2, '0')}`;
              
              let category = 'Administrative';
              if (entry.description.includes('NC State Convention')) {
                category = 'Conference';
              } else if (entry.description.includes('Work from home office')) {
                category = 'Administrative';
              } else if (entry.description.includes('(off)')) {
                category = 'Time Off';
              } else if (entry.description.includes('house stabilization')) {
                category = 'Field Work';
              }
              
              db.run(`INSERT INTO time_tracking (id, employeeId, date, hoursWorked, category, description, createdAt, updatedAt)
                      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                      [`time_${entry.day}`, 'emp1', sampleDate, entry.hours, category, entry.description, now, now]);
            });
          }
        });

        console.log('✅ Sample database created');
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
        return {
          ...row,
          costCenters: row.costCenters ? JSON.parse(row.costCenters) : [],
          selectedCostCenters: row.selectedCostCenters ? JSON.parse(row.selectedCostCenters) : []
        };
      } catch (parseErr) {
        console.error('Error parsing employee data for', row.id, ':', parseErr);
        return {
          ...row,
          costCenters: [],
          selectedCostCenters: []
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
  const { name, email, oxfordHouseId, position, phoneNumber, baseAddress, baseAddress2, costCenters } = req.body;
  const now = new Date().toISOString();

  db.run(
    'UPDATE employees SET name = ?, email = ?, oxfordHouseId = ?, position = ?, phoneNumber = ?, baseAddress = ?, baseAddress2 = ?, costCenters = ?, updatedAt = ? WHERE id = ?',
    [name, email, oxfordHouseId, position, phoneNumber, baseAddress, baseAddress2 || '', costCenters || '[]', now, id],
    function(err) {
      if (err) {
        console.error('Database error:', err.message);
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ message: 'Employee updated successfully' });
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
  
  let processedCount = 0;
  
  employees.forEach((employee, index) => {
    const { name, email, password, oxfordHouseId, position, phoneNumber, baseAddress, costCenters, selectedCostCenters, defaultCostCenter } = employee;
    
    // Validate required fields
    if (!name || !email || !password || !oxfordHouseId) {
      results.failed++;
      results.errors.push(`Employee ${index + 1}: Missing required fields`);
      processedCount++;
      if (processedCount === employees.length) {
        res.json(results);
      }
      return;
    }
    
    const now = new Date().toISOString();
    const query = `INSERT INTO employees (id, name, email, password, oxfordHouseId, position, phoneNumber, baseAddress, costCenters, selectedCostCenters, defaultCostCenter, createdAt, updatedAt) 
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    
    const values = [
      oxfordHouseId, // Use oxfordHouseId as the primary key
      name,
      email,
      password,
      oxfordHouseId,
      position || '',
      phoneNumber || '',
      baseAddress || '',
      JSON.stringify(costCenters || []),
      JSON.stringify(selectedCostCenters || []),
      defaultCostCenter || 'Program Services',
      now,
      now
    ];
    
    db.run(query, values, function(err) {
      processedCount++;
      
      if (err) {
        results.failed++;
        results.errors.push(`Employee ${index + 1} (${name}): ${err.message}`);
      } else {
        results.successful++;
        results.createdEmployees.push({
          id: this.lastID,
          name,
          email,
          password,
          oxfordHouseId,
          position,
          phoneNumber,
          baseAddress,
          costCenters,
          selectedCostCenters,
          defaultCostCenter,
          createdAt: now,
          updatedAt: now
        });
      }
      
      if (processedCount === employees.length) {
        results.success = results.failed === 0;
        res.json(results);
      }
    });
  });
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
  const { id, employeeId, oxfordHouseId, date, odometerReading, startLocation, endLocation, purpose, miles, notes, hoursWorked, isGpsTracked } = req.body;
  const entryId = id || (Date.now().toString(36) + Math.random().toString(36).substr(2));
  const now = new Date().toISOString();

  db.run(
    'INSERT OR REPLACE INTO mileage_entries (id, employeeId, oxfordHouseId, date, odometerReading, startLocation, endLocation, purpose, miles, notes, hoursWorked, isGpsTracked, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE((SELECT createdAt FROM mileage_entries WHERE id = ?), ?), ?)',
    [entryId, employeeId, oxfordHouseId || '', date, odometerReading, startLocation, endLocation, purpose, miles, notes || '', hoursWorked || 0, isGpsTracked ? 1 : 0, entryId, now, now],
    function(err) {
      if (err) {
        console.error('Database error:', err.message);
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ id: entryId, message: 'Mileage entry created successfully' });
    }
  );
});

// Update mileage entry
app.put('/api/mileage-entries/:id', (req, res) => {
  const { id } = req.params;
  const { employeeId, oxfordHouseId, date, odometerReading, startLocation, endLocation, purpose, miles, notes, hoursWorked, isGpsTracked } = req.body;
  const now = new Date().toISOString();

  db.run(
    'UPDATE mileage_entries SET employeeId = ?, oxfordHouseId = ?, date = ?, odometerReading = ?, startLocation = ?, endLocation = ?, purpose = ?, miles = ?, notes = ?, hoursWorked = ?, isGpsTracked = ?, updatedAt = ? WHERE id = ?',
    [employeeId, oxfordHouseId || '', date, odometerReading, startLocation, endLocation, purpose, miles, notes || '', hoursWorked || 0, isGpsTracked ? 1 : 0, now, id],
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

// Cost Center Management API Routes

// Get all cost centers
app.get('/api/cost-centers', (req, res) => {
  db.all('SELECT * FROM cost_centers ORDER BY code', (err, rows) => {
    if (err) {
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
  const { code, name, description } = req.body;
  const id = Date.now().toString(36) + Math.random().toString(36).substr(2);
  const now = new Date().toISOString();

  db.run(
    'INSERT INTO cost_centers (id, code, name, description, isActive, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [id, code, name, description || '', 1, now, now],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ id, message: 'Cost center created successfully' });
    }
  );
});

// Update cost center
app.put('/api/cost-centers/:id', (req, res) => {
  const { id } = req.params;
  const { code, name, description, isActive } = req.body;
  const now = new Date().toISOString();

  db.run(
    'UPDATE cost_centers SET code = ?, name = ?, description = ?, isActive = ?, updatedAt = ? WHERE id = ?',
    [code, name, description || '', isActive ? 1 : 0, now, id],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ message: 'Cost center updated successfully' });
    }
  );
});

// Delete cost center
app.delete('/api/cost-centers/:id', (req, res) => {
  const { id } = req.params;
  db.run('DELETE FROM cost_centers WHERE id = ?', [id], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ message: 'Cost center deleted successfully' });
  });
});

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

// Initialize database and start server
initDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 Backend server running on http://localhost:${PORT}`);
    console.log(`📊 Database path: ${DB_PATH}`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  });
}).catch(err => {
  console.error('❌ Failed to initialize database:', err);
  process.exit(1);
});

module.exports = app;
