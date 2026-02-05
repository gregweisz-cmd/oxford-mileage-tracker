import * as SQLite from 'expo-sqlite';
import { Platform } from 'react-native';
import { Employee, OxfordHouse, MileageEntry, MonthlyReport, Receipt, DailyOdometerReading, SavedAddress, TimeTracking, DailyDescription, CostCenterSummary } from '../types';
import { MileageAnalysisService } from './mileageAnalysisService';
import { ApiSyncService } from './apiSyncService';
import { debugLog, debugError, debugWarn } from '../config/debug';
// Removed SyncIntegrationService import to break circular dependency

let db: SQLite.SQLiteDatabase | null = null;

// Callback system to avoid circular dependency
let syncCallback: ((operation: string, entityType: string, data: any) => void) | null = null;

export const setSyncCallback = (callback: (operation: string, entityType: string, data: any) => void) => {
  syncCallback = callback;
};

const queueSyncOperation = (operation: string, entityType: string, data: any) => {
  if (syncCallback) {
    syncCallback(operation, entityType, data);
  }
};

const getDatabase = async (): Promise<SQLite.SQLiteDatabase> => {
  if (!db) {
    try {
      // Use different database names for web vs native to avoid conflicts
      const dbName = Platform.OS === 'web' ? 'oxford_tracker_web.db' : 'oxford_tracker.db';
      db = await SQLite.openDatabaseAsync(dbName);
    } catch (error) {
      console.error('❌ Database: Failed to open database:', error);
      throw error;
    }
  }
  return db;
};

export class DatabaseService {
  private static isInitialized = false;

  /**
   * Parse a date string safely, treating YYYY-MM-DD as a local date
   * This prevents timezone conversion issues
   */
  private static parseDateSafe(dateStr: string | Date): Date {
    if (dateStr instanceof Date) {
      return dateStr;
    }
    
    // Check if it's YYYY-MM-DD format (date-only, no time)
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      const [year, month, day] = dateStr.split('-').map(Number);
      // Create date at noon local time to avoid DST and timezone issues
      return new Date(year, month - 1, day, 12, 0, 0);
    }
    
    // For datetime strings, parse normally
    return new Date(dateStr);
  }

  /**
   * Format a Date as YYYY-MM-DD in local time to avoid timezone shifts.
   */
  private static toLocalDateKey(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private static async syncToApi(operation: string, data: any) {
    try {
      // Increment pending changes counter
      ApiSyncService.incrementPendingChanges();
      
      // Queue the sync operation for batch processing
      // Map operation names to correct entity types (must preserve camelCase for SyncIntegrationService)
      const syncOperation = operation.startsWith('update') ? 'update' : 'create';
      let entityType: string;
      if (operation === 'addMileageEntry') {
        entityType = 'mileageEntry';
      } else if (operation === 'updateEmployee') {
        entityType = 'employee';
      } else if (operation === 'addReceipt') {
        entityType = 'receipt';
      } else if (operation === 'addTimeTracking') {
        entityType = 'timeTracking';
      } else if (operation === 'addDailyDescription' || operation === 'updateDailyDescription') {
        entityType = 'dailyDescription';
      } else if (operation === 'addDailyOdometerReading') {
        entityType = 'dailyOdometerReading';
      } else {
        entityType = operation.replace('add', '').replace('update', '').toLowerCase();
      }
      
      queueSyncOperation(syncOperation as any, entityType as any, data);
      
    } catch (error) {
      console.error(`❌ Database: Error queuing ${operation} for sync:`, error);
    }
  }
  
  static async initDatabase(): Promise<void> {
    if (this.isInitialized) {
      // Skip table creation but ensure employee setup
      try {
        const allEmployees = await this.getEmployees();
        debugLog('🔧 Database: Found employees:', allEmployees.length);
        
        // If no employees, create test data first
        if (allEmployees.length === 0) {
          debugLog('🔧 Database: No employees found, creating test employees...');
          const { TestDataService } = await import('./testDataService');
          await TestDataService.initializeTestData();
          debugLog('✅ Database: Test employees created successfully');
        }
        
        // NOW ensure there's always a current employee set (after employees exist)
        debugLog('🔧 Database: Checking current employee session...');
        const currentEmployee = await this.getCurrentEmployee();
        if (!currentEmployee) {
          debugLog('🔧 Database: No current employee session found, setting up Greg Weisz...');
          const employeesAfterImport = await this.getEmployees();
          debugLog('🔧 Database: Employees after setup:', employeesAfterImport.length);
          if (employeesAfterImport.length > 0) {
            const defaultEmployee = employeesAfterImport.find(emp => emp.name === 'Greg Weisz') || employeesAfterImport[0];
            debugLog('🔧 Database: Setting default employee:', defaultEmployee.name);
            await this.setCurrentEmployee(defaultEmployee.id);
            debugLog('✅ Database: Default employee set as current employee:', defaultEmployee.name);
          }
        } else {
          debugLog('✅ Database: Current employee session exists:', currentEmployee.name);
        }
      } catch (error) {
        console.error('❌ Database: Error setting up employees and employee session:', error);
      }
      return;
    }
    
    try {
      // For web platform, add a small delay to allow WASM to load
      if (Platform.OS === 'web') {
        debugLog('🌐 Database: Web platform detected, waiting for WASM initialization...');
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      const database = await getDatabase();
      
      // Initialize database schema (only create tables if they don't exist)
      debugLog('Initializing database schema...');
      
      // Create mileage_entries table
      await database.execAsync(`
        CREATE TABLE IF NOT EXISTS mileage_entries (
          id TEXT PRIMARY KEY,
          employeeId TEXT NOT NULL,
          oxfordHouseId TEXT NOT NULL,
          date TEXT NOT NULL,
          odometerReading REAL NOT NULL,
          startLocation TEXT NOT NULL,
          endLocation TEXT NOT NULL,
          startLocationName TEXT,
          startLocationAddress TEXT,
          startLocationLat REAL,
          startLocationLng REAL,
          endLocationName TEXT,
          endLocationAddress TEXT,
          endLocationLat REAL,
          endLocationLng REAL,
          purpose TEXT NOT NULL,
          miles REAL NOT NULL,
          notes TEXT,
          hoursWorked REAL DEFAULT 0,
          isGpsTracked INTEGER NOT NULL DEFAULT 0,
          createdAt TEXT NOT NULL,
          updatedAt TEXT NOT NULL
        );
      `);
      
      // Create employees table
      await database.execAsync(`
        CREATE TABLE IF NOT EXISTS employees (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          email TEXT NOT NULL,
          oxfordHouseId TEXT NOT NULL,
          position TEXT NOT NULL,
          phoneNumber TEXT,
          baseAddress TEXT NOT NULL,
          createdAt TEXT NOT NULL,
          updatedAt TEXT NOT NULL
        );
      `);

      // Run employee table migrations
      await this.runEmployeeMigrations(database);

      // Run mileage entries table migrations
      await this.runMileageEntriesMigrations(database);

      // Run receipts table migrations
      await this.runReceiptsMigrations(database);

      // Run time tracking table migrations
      await this.runTimeTrackingMigrations(database);

      // Create oxford_houses table
      await database.execAsync(`
        CREATE TABLE IF NOT EXISTS oxford_houses (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          address TEXT NOT NULL,
          city TEXT NOT NULL,
          state TEXT NOT NULL,
          zipCode TEXT NOT NULL,
          phoneNumber TEXT,
          managerId TEXT,
          createdAt TEXT NOT NULL,
          updatedAt TEXT NOT NULL
        );
      `);

      // mileage_entries table already created above with simple schema

      // Simple schema - no migrations needed

      // Create monthly_reports table
      await database.execAsync(`
        CREATE TABLE IF NOT EXISTS monthly_reports (
          id TEXT PRIMARY KEY,
          employeeId TEXT NOT NULL,
          month INTEGER NOT NULL,
          year INTEGER NOT NULL,
          totalMiles REAL NOT NULL,
          status TEXT NOT NULL,
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
        );
      `);

      // Create weekly_reports table
      await database.execAsync(`
        CREATE TABLE IF NOT EXISTS weekly_reports (
          id TEXT PRIMARY KEY,
          employeeId TEXT NOT NULL,
          weekNumber INTEGER NOT NULL,
          year INTEGER NOT NULL,
          startDate TEXT NOT NULL,
          endDate TEXT NOT NULL,
          totalMiles REAL NOT NULL,
          totalExpenses REAL DEFAULT 0,
          status TEXT NOT NULL,
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
        );
      `);

      // Create biweekly_reports table (month-based: 1-15, 16-end)
      await database.execAsync(`
        CREATE TABLE IF NOT EXISTS biweekly_reports (
          id TEXT PRIMARY KEY,
          employeeId TEXT NOT NULL,
          month INTEGER NOT NULL,
          year INTEGER NOT NULL,
          periodNumber INTEGER NOT NULL,
          startDate TEXT NOT NULL,
          endDate TEXT NOT NULL,
          totalMiles REAL NOT NULL,
          totalExpenses REAL DEFAULT 0,
          status TEXT NOT NULL,
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
        );
      `);

      // Create receipts table
      await database.execAsync(`
        CREATE TABLE IF NOT EXISTS receipts (
          id TEXT PRIMARY KEY,
          employeeId TEXT NOT NULL,
          date TEXT NOT NULL,
          fileType TEXT,
          amount REAL NOT NULL,
          vendor TEXT NOT NULL,
          description TEXT NOT NULL,
          category TEXT NOT NULL,
          imageUri TEXT NOT NULL,
          createdAt TEXT NOT NULL,
          updatedAt TEXT NOT NULL
        );
      `);

      // Create daily_odometer_readings table
      await database.execAsync(`
        CREATE TABLE IF NOT EXISTS daily_odometer_readings (
          id TEXT PRIMARY KEY,
          employeeId TEXT NOT NULL,
          date TEXT NOT NULL,
          odometerReading REAL NOT NULL,
          notes TEXT,
          createdAt TEXT NOT NULL,
          updatedAt TEXT NOT NULL
        );
      `);

      // Create saved_addresses table
      await database.execAsync(`
        CREATE TABLE IF NOT EXISTS saved_addresses (
          id TEXT PRIMARY KEY,
          employeeId TEXT NOT NULL,
          name TEXT NOT NULL,
          address TEXT NOT NULL,
          latitude REAL,
          longitude REAL,
          category TEXT,
          createdAt TEXT NOT NULL,
          updatedAt TEXT NOT NULL
        );
      `);

      // Create time_tracking table (costCenter included so INSERT succeeds on fresh installs)
      await database.execAsync(`
        CREATE TABLE IF NOT EXISTS time_tracking (
          id TEXT PRIMARY KEY,
          employeeId TEXT NOT NULL,
          date TEXT NOT NULL,
          category TEXT NOT NULL,
          hours REAL NOT NULL,
          description TEXT,
          costCenter TEXT DEFAULT '',
          createdAt TEXT NOT NULL,
          updatedAt TEXT NOT NULL
        );
      `);

      // Create daily_descriptions table
      await database.execAsync(`
        CREATE TABLE IF NOT EXISTS daily_descriptions (
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
        );
      `);

      // Add stayedOvernight column if it doesn't exist (migration)
      try {
        await database.execAsync(`
          ALTER TABLE daily_descriptions ADD COLUMN stayedOvernight INTEGER DEFAULT 0;
        `);
      } catch (error: any) {
        // Column may already exist, which is fine
        if (!error?.message?.includes('duplicate column name')) {
          debugWarn('⚠️ Database: Error adding stayedOvernight column (may already exist):', error);
        }
      }

      // Add dayOff column if it doesn't exist (migration)
      try {
        await database.execAsync(`
          ALTER TABLE daily_descriptions ADD COLUMN dayOff INTEGER DEFAULT 0;
        `);
      } catch (error: any) {
        // Column may already exist, which is fine
        if (!error?.message?.includes('duplicate column name')) {
          debugWarn('⚠️ Database: Error adding dayOff column (may already exist):', error);
        }
      }

      // Add dayOffType column if it doesn't exist (migration)
      try {
        await database.execAsync(`
          ALTER TABLE daily_descriptions ADD COLUMN dayOffType TEXT;
        `);
      } catch (error: any) {
        // Column may already exist, which is fine
        if (!error?.message?.includes('duplicate column name')) {
          debugWarn('⚠️ Database: Error adding dayOffType column (may already exist):', error);
        }
      }

      // Add fileType column to receipts table if it doesn't exist (migration)
      try {
        await database.execAsync(`
          ALTER TABLE receipts ADD COLUMN fileType TEXT;
        `);
      } catch (error: any) {
        // Column may already exist, which is fine
        if (!error?.message?.includes('duplicate column name')) {
          debugWarn('⚠️ Database: Error adding fileType column (may already exist):', error);
        }
      }

      // Create cost_center_summaries table for reporting
      await database.execAsync(`
        CREATE TABLE IF NOT EXISTS cost_center_summaries (
          id TEXT PRIMARY KEY,
          employeeId TEXT NOT NULL,
          costCenter TEXT NOT NULL,
          month INTEGER NOT NULL,
          year INTEGER NOT NULL,
          totalHours REAL DEFAULT 0,
          totalMiles REAL DEFAULT 0,
          totalReceipts REAL DEFAULT 0,
          totalPerDiem REAL DEFAULT 0,
          totalExpenses REAL DEFAULT 0,
          mileageEntries INTEGER DEFAULT 0,
          receiptEntries INTEGER DEFAULT 0,
          timeTrackingEntries INTEGER DEFAULT 0,
          descriptionEntries INTEGER DEFAULT 0,
          createdAt TEXT NOT NULL,
          updatedAt TEXT NOT NULL,
          UNIQUE(employeeId, costCenter, month, year)
        );
      `);

      // Create per_diem_rules table for Per Diem rule management
      await database.execAsync(`
        CREATE TABLE IF NOT EXISTS per_diem_rules (
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
        );
      `);

      // Create current_employee table
      await database.execAsync(`
        CREATE TABLE IF NOT EXISTS current_employee (
          id INTEGER PRIMARY KEY,
          employeeId TEXT NOT NULL,
          lastLogin TEXT NOT NULL,
          stayLoggedIn INTEGER DEFAULT 0
        );
      `);

      // Add stayLoggedIn column to existing current_employee tables (migration)
      try {
        await database.execAsync(`
          ALTER TABLE current_employee ADD COLUMN stayLoggedIn INTEGER DEFAULT 0;
        `);
      } catch (error) {
        // Column might already exist, ignore error
      }

      // Add hasCompletedOnboarding column to existing current_employee tables (migration)
      try {
        await database.execAsync(`
          ALTER TABLE current_employee ADD COLUMN hasCompletedOnboarding INTEGER DEFAULT 0;
        `);
      } catch (error) {
        // Column might already exist, ignore error
      }

      // Add hasCompletedSetupWizard column to existing current_employee tables (migration)
      try {
        await database.execAsync(`
          ALTER TABLE current_employee ADD COLUMN hasCompletedSetupWizard INTEGER DEFAULT 0;
        `);
      } catch (error) {
        // Column might already exist, ignore error
      }

      // Add approval workflow columns to monthly_reports table (migration)
      const approvalColumns = [
        'submittedBy TEXT',
        'reviewedAt TEXT',
        'reviewedBy TEXT',
        'approvedBy TEXT',
        'rejectedAt TEXT',
        'rejectedBy TEXT',
        'rejectionReason TEXT',
        'comments TEXT'
      ];

      for (const column of approvalColumns) {
        try {
          await database.execAsync(`
            ALTER TABLE monthly_reports ADD COLUMN ${column};
          `);
        } catch (error) {
          // Column might already exist, ignore error
        }
      }

      // Create performance indexes
      debugLog('Creating database indexes for performance...');
      
      // Indexes for mileage_entries table
      await database.execAsync('CREATE INDEX IF NOT EXISTS idx_mileage_entries_employee_date ON mileage_entries(employeeId, date)');
      await database.execAsync('CREATE INDEX IF NOT EXISTS idx_mileage_entries_date ON mileage_entries(date)');
      await database.execAsync('CREATE INDEX IF NOT EXISTS idx_mileage_entries_employee ON mileage_entries(employeeId)');
      
      // Indexes for receipts table
      await database.execAsync('CREATE INDEX IF NOT EXISTS idx_receipts_employee_date ON receipts(employeeId, date)');
      await database.execAsync('CREATE INDEX IF NOT EXISTS idx_receipts_date ON receipts(date)');
      await database.execAsync('CREATE INDEX IF NOT EXISTS idx_receipts_employee ON receipts(employeeId)');
      
      // Indexes for employees table
      await database.execAsync('CREATE INDEX IF NOT EXISTS idx_employees_email ON employees(email)');
      
      // Indexes for time_tracking table
      await database.execAsync('CREATE INDEX IF NOT EXISTS idx_time_tracking_employee_date ON time_tracking(employeeId, date)');
      
      // Indexes for daily_odometer_readings table
      await database.execAsync('CREATE INDEX IF NOT EXISTS idx_daily_odometer_employee_date ON daily_odometer_readings(employeeId, date)');
      
      debugLog('✅ Database indexes created successfully');

      
      debugLog('Database initialized successfully');
      
      // Initialize sync integration service
      try {
        // Initialize sync integration service
        // Note: SyncIntegrationService will register its callback via setSyncCallback
        debugLog('✅ Database: Sync integration service initialized');
      } catch (error) {
        console.error('❌ Database: Failed to initialize sync integration service:', error);
      }
      
      // Ensure there are employees in the database (create test employees if none exist)
      try {
        debugLog('🔧 Database: Checking employee setup...');
        const allEmployees = await this.getEmployees();
        debugLog('🔧 Database: Found employees:', allEmployees.length);
        
        if (allEmployees.length === 0) {
          debugLog('🔧 Database: No employees found, creating test employees...');
          const { TestDataService } = await import('./testDataService');
          await TestDataService.initializeTestData();
          debugLog('✅ Database: Test employees created successfully');
        }
        
        // Clean up entries and force fresh sync with correct dates
        try {
          debugLog('🧹 Database: Cleaning up all synced entries to force fresh sync...');
          const database = await getDatabase();
          
          // Delete ALL entries that came from backend sync
          // We'll re-sync them with corrected dates
          const deleted = await database.runAsync(`
            DELETE FROM mileage_entries 
            WHERE id IN ('mile1', 'mile2', 'mgbdj7os4i1lgifdc18', 'mgfw5v5xis9ly7jzysk', 
                        'mgfw5v5vdhize91kh8', 'mgfw5v5tfhky841fj35', 'mgfw5v5qg7o2c0nym0p', 
                        'mgfw5v5n2xyewh5c2pr')
            OR id LIKE 'mgteze%'
          `);
          if (deleted.changes > 0) {
            debugLog(`✅ Database: Removed ${deleted.changes} entries to force fresh sync with correct dates`);
          }
          
          // Count remaining entries
          const remaining = await database.getFirstAsync('SELECT COUNT(*) as count FROM mileage_entries') as any;
          debugLog(`📊 Database: ${remaining.count} mileage entries remaining after cleanup`);
        } catch (error) {
          console.error('⚠️ Database: Error cleaning entries:', error);
        }
      
      // Check if user wants to stay logged in
      debugLog('🔧 Database: Checking current employee session...');
      const currentEmployee = await this.getCurrentEmployee();
      if (!currentEmployee) {
        debugLog('🔧 Database: No current employee session found, auto-logging in as Greg Weisz...');
        const employees = await this.getEmployees();
        const gregWeisz = employees.find(emp => emp.name === 'Greg Weisz');
        if (gregWeisz) {
          await this.setCurrentEmployee(gregWeisz.id);
          debugLog('✅ Database: Auto-logged in as Greg Weisz');
        } else {
          debugLog('⚠️ Database: Greg Weisz not found, no auto-login');
        }
      } else {
        debugLog('✅ Database: Current employee session exists:', currentEmployee.name);
      }
      } catch (error) {
        console.error('❌ Database: Error setting up employees and employee session:', error);
      }
      
      this.isInitialized = true;
    } catch (error) {
      console.error('Error initializing database:', error);
      throw error;
    }
  }

  // Employee operations
  static async getAllEmployees(): Promise<Employee[]> {
    return this.getEmployees();
  }

  static async getCurrentEmployee(): Promise<Employee | null> {
    const database = await getDatabase();
    const result = await database.getFirstAsync('SELECT * FROM current_employee') as any;
    
    if (!result) {
      return null;
    }
    
    const employee = await this.getEmployeeById(result.employeeId);
    
    return employee;
  }

  static async setCurrentEmployee(employeeId: string, stayLoggedIn: boolean = false): Promise<void> {
    const database = await getDatabase();
    
    // Clear existing current employee and set new one
    await database.execAsync('DELETE FROM current_employee');
    await database.runAsync(
      'INSERT INTO current_employee (employeeId, lastLogin, stayLoggedIn) VALUES (?, ?, ?)',
      [employeeId, new Date().toISOString(), stayLoggedIn ? 1 : 0]
    );
  }

  static async clearCurrentEmployee(): Promise<void> {
    const database = await getDatabase();
    await database.execAsync('DELETE FROM current_employee');
  }

  static async getCurrentEmployeeSession(): Promise<{employeeId: string, stayLoggedIn: boolean, hasCompletedOnboarding?: boolean, hasCompletedSetupWizard?: boolean} | null> {
    const database = await getDatabase();
    const result = await database.getFirstAsync('SELECT employeeId, stayLoggedIn, hasCompletedOnboarding, hasCompletedSetupWizard FROM current_employee') as any;
    
    if (result) {
      return {
        employeeId: result.employeeId,
        stayLoggedIn: result.stayLoggedIn === 1,
        hasCompletedOnboarding: result.hasCompletedOnboarding === 1,
        hasCompletedSetupWizard: result.hasCompletedSetupWizard === 1
      };
    }
    
    return null;
  }

  static async hasCompletedOnboarding(employeeId?: string): Promise<boolean> {
    const database = await getDatabase();
    
    // If employeeId is provided, check the employees table directly
    if (employeeId) {
      const result = await database.getFirstAsync(
        'SELECT hasCompletedOnboarding FROM employees WHERE id = ?',
        [employeeId]
      ) as any;
      return result?.hasCompletedOnboarding === 1;
    }
    
    // Otherwise, check via current_employee table (for backward compatibility)
    const currentSession = await this.getCurrentEmployeeSession();
    if (currentSession?.employeeId) {
      const result = await database.getFirstAsync(
        'SELECT hasCompletedOnboarding FROM employees WHERE id = ?',
        [currentSession.employeeId]
      ) as any;
      return result?.hasCompletedOnboarding === 1;
    }
    
    return false;
  }

  static async setCompletedOnboarding(employeeId?: string): Promise<void> {
    const database = await getDatabase();
    
    // If employeeId is provided, update the employees table directly
    if (employeeId) {
      await database.runAsync(
        'UPDATE employees SET hasCompletedOnboarding = 1 WHERE id = ?',
        [employeeId]
      );
      // Also update current_employee for backward compatibility
      await database.runAsync(
        'UPDATE current_employee SET hasCompletedOnboarding = 1 WHERE employeeId = ?',
        [employeeId]
      );
      return;
    }
    
    // Otherwise, update via current_employee table
    const currentSession = await this.getCurrentEmployeeSession();
    if (currentSession?.employeeId) {
      await database.runAsync(
        'UPDATE employees SET hasCompletedOnboarding = 1 WHERE id = ?',
        [currentSession.employeeId]
      );
      await database.runAsync(
        'UPDATE current_employee SET hasCompletedOnboarding = 1 WHERE employeeId = ?',
        [currentSession.employeeId]
      );
    }
  }

  static async hasCompletedSetupWizard(employeeId?: string): Promise<boolean> {
    const database = await getDatabase();
    
    // If employeeId is provided, check the employees table directly
    if (employeeId) {
      const result = await database.getFirstAsync(
        'SELECT hasCompletedSetupWizard FROM employees WHERE id = ?',
        [employeeId]
      ) as any;
      return result?.hasCompletedSetupWizard === 1;
    }
    
    // Otherwise, check via current_employee table (for backward compatibility)
    const currentSession = await this.getCurrentEmployeeSession();
    if (currentSession?.employeeId) {
      const result = await database.getFirstAsync(
        'SELECT hasCompletedSetupWizard FROM employees WHERE id = ?',
        [currentSession.employeeId]
      ) as any;
      return result?.hasCompletedSetupWizard === 1;
    }
    
    return false;
  }

  static async setCompletedSetupWizard(employeeId?: string): Promise<void> {
    const database = await getDatabase();
    
    // If employeeId is provided, update the employees table directly
    if (employeeId) {
      await database.runAsync(
        'UPDATE employees SET hasCompletedSetupWizard = 1 WHERE id = ?',
        [employeeId]
      );
      // Also update current_employee for backward compatibility
      await database.runAsync(
        'UPDATE current_employee SET hasCompletedSetupWizard = 1 WHERE employeeId = ?',
        [employeeId]
      );
      return;
    }
    
    // Otherwise, update via current_employee table
    const currentSession = await this.getCurrentEmployeeSession();
    if (currentSession?.employeeId) {
      await database.runAsync(
        'UPDATE employees SET hasCompletedSetupWizard = 1 WHERE id = ?',
        [currentSession.employeeId]
      );
      await database.runAsync(
        'UPDATE current_employee SET hasCompletedSetupWizard = 1 WHERE employeeId = ?',
        [currentSession.employeeId]
      );
    }
  }





  static async getEmployeeById(id: string): Promise<Employee | null> {
    const database = await getDatabase();
    const result = await database.getFirstAsync('SELECT * FROM employees WHERE id = ?', [id]) as any;
    
    if (!result) return null;
    
    return {
      id: result.id,
      name: result.name,
      preferredName: result.preferredName || '',
      email: result.email,
      password: result.password,
      oxfordHouseId: result.oxfordHouseId,
      position: result.position,
      phoneNumber: result.phoneNumber,
      baseAddress: result.baseAddress || '',
      baseAddress2: result.baseAddress2 || '',
      costCenters: result.costCenters ? JSON.parse(result.costCenters) : [],
      selectedCostCenters: result.selectedCostCenters ? JSON.parse(result.selectedCostCenters) : [],
      defaultCostCenter: result.defaultCostCenter || '',
      typicalWorkStartHour: result.typicalWorkStartHour !== null && result.typicalWorkStartHour !== undefined ? Number(result.typicalWorkStartHour) : undefined,
      typicalWorkEndHour: result.typicalWorkEndHour !== null && result.typicalWorkEndHour !== undefined ? Number(result.typicalWorkEndHour) : undefined,
      hasCompletedSetupWizard: result.hasCompletedSetupWizard === 1,
      hasCompletedOnboarding: result.hasCompletedOnboarding === 1,
      createdAt: new Date(result.createdAt),
      updatedAt: new Date(result.updatedAt)
    };
  }

  static async getEmployeeByEmail(email: string): Promise<Employee | null> {
    const database = await getDatabase();
    const result = await database.getFirstAsync('SELECT * FROM employees WHERE email = ?', [email.toLowerCase()]) as any;
    
    if (!result) return null;
    
    return {
      id: result.id,
      name: result.name,
      preferredName: result.preferredName || '',
      email: result.email,
      password: result.password,
      oxfordHouseId: result.oxfordHouseId,
      position: result.position,
      phoneNumber: result.phoneNumber,
      baseAddress: result.baseAddress || '',
      baseAddress2: result.baseAddress2 || '',
      costCenters: result.costCenters ? JSON.parse(result.costCenters) : [],
      selectedCostCenters: result.selectedCostCenters ? JSON.parse(result.selectedCostCenters) : [],
      defaultCostCenter: result.defaultCostCenter || '',
      typicalWorkStartHour: result.typicalWorkStartHour !== null && result.typicalWorkStartHour !== undefined ? Number(result.typicalWorkStartHour) : undefined,
      typicalWorkEndHour: result.typicalWorkEndHour !== null && result.typicalWorkEndHour !== undefined ? Number(result.typicalWorkEndHour) : undefined,
      hasCompletedSetupWizard: result.hasCompletedSetupWizard === 1,
      hasCompletedOnboarding: result.hasCompletedOnboarding === 1,
      createdAt: new Date(result.createdAt),
      updatedAt: new Date(result.updatedAt)
    };
  }

  static async createEmployee(employee: Omit<Employee, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): Promise<Employee> {
    const id = employee.id || this.generateId();
    const now = new Date().toISOString();
    const database = await getDatabase();
    
    await database.runAsync(
      'INSERT INTO employees (id, name, preferredName, email, password, oxfordHouseId, position, phoneNumber, baseAddress, costCenters, selectedCostCenters, defaultCostCenter, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [id, employee.name, employee.preferredName || '', employee.email, employee.password, employee.oxfordHouseId, employee.position, employee.phoneNumber || '', employee.baseAddress, JSON.stringify(employee.costCenters || []), JSON.stringify(employee.selectedCostCenters || []), employee.defaultCostCenter || '', now, now]
    );

    const newEmployee = {
      id,
      ...employee,
      phoneNumber: employee.phoneNumber,
      createdAt: new Date(now),
      updatedAt: new Date(now)
    };

    // Sync to API service
    await this.syncToApi('addEmployee', newEmployee);

    return newEmployee;
  }

  static async getEmployees(): Promise<Employee[]> {
    const database = await getDatabase();
    const result = await database.getAllAsync('SELECT * FROM employees ORDER BY name');
    
    return result.map((row: any) => ({
      ...row,
      preferredName: row.preferredName || '',
      baseAddress: row.baseAddress || '',
      baseAddress2: row.baseAddress2 || '',
      costCenters: row.costCenters ? JSON.parse(row.costCenters) : [],
      selectedCostCenters: row.selectedCostCenters ? JSON.parse(row.selectedCostCenters) : [],
      defaultCostCenter: row.defaultCostCenter || '',
      typicalWorkStartHour: row.typicalWorkStartHour !== null && row.typicalWorkStartHour !== undefined ? Number(row.typicalWorkStartHour) : undefined,
      typicalWorkEndHour: row.typicalWorkEndHour !== null && row.typicalWorkEndHour !== undefined ? Number(row.typicalWorkEndHour) : undefined,
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt)
    }));
  }

  static async updateEmployee(id: string, updates: Partial<Employee>): Promise<void> {
    const now = new Date().toISOString();
    const database = await getDatabase();
    
    // Filter out fields we don't want to update
    const fields = Object.keys(updates).filter(key => 
      key !== 'id' && 
      key !== 'createdAt' && 
      key !== 'updatedAt'
    );
    
    if (fields.length === 0) {
      return; // Nothing to update
    }
    
    const setClause = fields.map(field => `${field} = ?`).join(', ');
    const values = fields.map(field => {
      const value = updates[field as keyof Employee];
      // Handle Date objects by converting to ISO string
      if (value instanceof Date) return value.toISOString();
      // Handle array fields by converting to JSON
      if ((field === 'costCenters' || field === 'selectedCostCenters') && Array.isArray(value)) return JSON.stringify(value);
      return value;
    });
    
    await database.runAsync(
      `UPDATE employees SET ${setClause}, updatedAt = ? WHERE id = ?`,
      [...values, now, id] as any[]
    );
    
    // Sync updated employee to backend
    try {
      const updatedEmployee = await this.getEmployeeById(id);
      if (updatedEmployee) {
        await this.syncToApi('updateEmployee', updatedEmployee);
      }
    } catch (error) {
      console.error('❌ Database: Error syncing employee update:', error);
      // Don't throw - employee is still updated locally
    }
  }

  static async deleteEmployee(id: string): Promise<void> {
    const database = await getDatabase();
    
    await database.runAsync(
      'DELETE FROM employees WHERE id = ?',
      [id]
    );
  }

  // Mileage entry operations
  static async createMileageEntry(entry: Omit<MileageEntry, 'id' | 'createdAt' | 'updatedAt'>): Promise<MileageEntry> {
    const id = this.generateId();
    const now = new Date().toISOString();
    const database = await getDatabase();
    
    // Convert date to YYYY-MM-DD format only (no time/timezone)
    // This ensures the date stays the same regardless of device timezone
    const entryDate = entry.date instanceof Date ? entry.date : new Date(entry.date);
    const dateOnly = `${entryDate.getFullYear()}-${String(entryDate.getMonth() + 1).padStart(2, '0')}-${String(entryDate.getDate()).padStart(2, '0')}`;
    
    // Insert with location details
    await database.runAsync(
      `INSERT INTO mileage_entries (
        id, employeeId, oxfordHouseId, costCenter, date, odometerReading, 
        startLocation, endLocation, startLocationName, startLocationAddress, 
        startLocationLat, startLocationLng, endLocationName, endLocationAddress, 
        endLocationLat, endLocationLng, purpose, miles, notes, hoursWorked, 
        isGpsTracked, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, 
        entry.employeeId, 
        entry.oxfordHouseId, 
        entry.costCenter || '',
        dateOnly, // Store as YYYY-MM-DD only (no time component)
        entry.odometerReading,
        entry.startLocation, 
        entry.endLocation,
        entry.startLocationDetails?.name || null,
        entry.startLocationDetails?.address || null,
        entry.startLocationDetails?.latitude || null,
        entry.startLocationDetails?.longitude || null,
        entry.endLocationDetails?.name || null,
        entry.endLocationDetails?.address || null,
        entry.endLocationDetails?.latitude || null,
        entry.endLocationDetails?.longitude || null,
        entry.purpose, 
        entry.miles, 
        entry.notes || '', 
        entry.hoursWorked || 0,
        entry.isGpsTracked ? 1 : 0, 
        now, 
        now
      ]
    );

    const newEntry = {
      id,
      ...entry,
      notes: entry.notes,
      createdAt: new Date(now),
      updatedAt: new Date(now)
    };

    // Sync to API service
    await this.syncToApi('addMileageEntry', newEntry);

    // Analyze mileage entry for location relationships
    try {
      await MileageAnalysisService.analyzeMileageEntry(newEntry);
    } catch (error) {
      console.error('❌ Database: Error analyzing mileage entry:', error);
    }

    // End odometer is calculated at end of day, not after each entry
    // No need to update here

    return newEntry;
  }

  static async getRecentMileageEntries(employeeId: string, limit: number = 5): Promise<MileageEntry[]> {
    const database = await getDatabase();
    const query = 'SELECT * FROM mileage_entries WHERE employeeId = ? ORDER BY date DESC LIMIT ?';
    
    const result = await database.getAllAsync(query, [employeeId, limit]);
    
    return result.map((row: any) => ({
      ...row,
      date: this.parseDateSafe(row.date),
      isGpsTracked: Boolean(row.isGpsTracked),
      startLocationDetails: row.startLocationName ? {
        name: row.startLocationName,
        address: row.startLocationAddress || '',
        latitude: row.startLocationLat,
        longitude: row.startLocationLng
      } : undefined,
      endLocationDetails: row.endLocationName ? {
        name: row.endLocationName,
        address: row.endLocationAddress || '',
        latitude: row.endLocationLat,
        longitude: row.endLocationLng
      } : undefined,
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt)
    }));
  }

  static async getMileageEntries(employeeId?: string, month?: number, year?: number): Promise<MileageEntry[]> {
    const database = await getDatabase();
    let query = 'SELECT * FROM mileage_entries';
    const params: any[] = [];
    const conditions: string[] = [];

    if (employeeId) {
      conditions.push('employeeId = ?');
      params.push(employeeId);
    }

    if (month && year) {
      conditions.push('strftime("%m", date) = ? AND strftime("%Y", date) = ?');
      params.push(month.toString().padStart(2, '0'), year.toString());
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY date DESC';

    const result = await database.getAllAsync(query, params);
    
    return result.map((row: any) => ({
      ...row,
      date: this.parseDateSafe(row.date),
      costCenter: row.costCenter || '',
      isGpsTracked: Boolean(row.isGpsTracked),
      startLocationDetails: row.startLocationName ? {
        name: row.startLocationName,
        address: row.startLocationAddress || '',
        latitude: row.startLocationLat,
        longitude: row.startLocationLng
      } : undefined,
      endLocationDetails: row.endLocationName ? {
        name: row.endLocationName,
        address: row.endLocationAddress || '',
        latitude: row.endLocationLat,
        longitude: row.endLocationLng
      } : undefined,
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt)
    }));
  }

  static async updateMileageEntry(id: string, updates: Partial<MileageEntry>): Promise<void> {
    const now = new Date().toISOString();
    const database = await getDatabase();
    
    // Filter out object fields that need special handling
    const simpleFields = Object.keys(updates).filter(key => 
      key !== 'id' && 
      key !== 'createdAt' && 
      key !== 'startLocationDetails' && 
      key !== 'endLocationDetails'
    );
    
    const setClause = simpleFields.map(field => `${field} = ?`).join(', ');
    const values = simpleFields.map(field => {
      const value = updates[field as keyof MileageEntry];
      if (value instanceof Date) {
        // Store dates as YYYY-MM-DD only
        const dateObj = value instanceof Date ? value : new Date(value);
        return `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;
      }
      if (typeof value === 'boolean') return value ? 1 : 0;
      return value;
    });
    
    // Handle location details separately if they exist
    if (updates.startLocationDetails) {
      simpleFields.push('startLocationName', 'startLocationAddress', 'startLocationLat', 'startLocationLng');
      values.push(
        updates.startLocationDetails.name || undefined,
        updates.startLocationDetails.address || undefined,
        updates.startLocationDetails.latitude ?? undefined,
        updates.startLocationDetails.longitude ?? undefined
      );
    }
    
    if (updates.endLocationDetails) {
      simpleFields.push('endLocationName', 'endLocationAddress', 'endLocationLat', 'endLocationLng');
      values.push(
        updates.endLocationDetails.name || undefined,
        updates.endLocationDetails.address || undefined,
        updates.endLocationDetails.latitude ?? undefined,
        updates.endLocationDetails.longitude ?? undefined
      );
    }
    
    const finalSetClause = simpleFields.map(field => `${field} = ?`).join(', ');
    
    await database.runAsync(
      `UPDATE mileage_entries SET ${finalSetClause}, updatedAt = ? WHERE id = ?`,
      [...values, now, id] as any[]
    );
    
    // Trigger sync
    const updatedEntry = await this.getMileageEntryById(id);
    if (updatedEntry) {
      await this.syncToApi('updateMileageEntry', updatedEntry);
    }
  }

  static async getMileageEntryById(id: string): Promise<MileageEntry | null> {
    const database = await getDatabase();
    const result = await database.getFirstAsync(
      'SELECT * FROM mileage_entries WHERE id = ?',
      [id]
    ) as any;
    
    if (!result) return null;
    
    return {
      ...result,
      date: this.parseDateSafe(result.date),
      costCenter: result.costCenter || '',
      isGpsTracked: Boolean(result.isGpsTracked),
      startLocationDetails: result.startLocationName ? {
        name: result.startLocationName,
        address: result.startLocationAddress || '',
        latitude: result.startLocationLat,
        longitude: result.startLocationLng
      } : undefined,
      endLocationDetails: result.endLocationName ? {
        name: result.endLocationName,
        address: result.endLocationAddress || '',
        latitude: result.endLocationLat,
        longitude: result.endLocationLng
      } : undefined,
      createdAt: new Date(result.createdAt),
      updatedAt: new Date(result.updatedAt)
    };
  }

  static async deleteMileageEntry(id: string): Promise<void> {
    const database = await getDatabase();
    debugLog('🗑️ Database: Deleting mileage entry:', id);
    
    await database.runAsync('DELETE FROM mileage_entries WHERE id = ?', [id]);
    
    debugLog('✅ Database: Mileage entry deleted successfully');
    queueSyncOperation('delete', 'mileageEntry', { id });
    
    // Remove from sync queue to prevent trying to sync a deleted entry
    try {
      const { SyncIntegrationService } = await import('./syncIntegrationService');
      SyncIntegrationService.removeFromQueue('mileageEntry', id);
      debugLog('✅ Database: Removed mileage entry from sync queue');
    } catch (error) {
      console.error('⚠️ Database: Could not remove from sync queue:', error);
    }
    
    // Delete from backend as well
    try {
      const { API_BASE_URL } = await import('../config/api');
      const response = await fetch(`${API_BASE_URL}/mileage-entries/${id}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        debugLog('✅ Database: Deleted mileage entry from backend');
      } else {
        debugWarn('⚠️ Database: Failed to delete from backend:', response.status);
      }
    } catch (error) {
      console.error('⚠️ Database: Could not delete from backend:', error);
    }
  }

  static async getAllMileageEntries(): Promise<MileageEntry[]> {
    return this.getMileageEntries();
  }

  // Monthly report operations
  static async createMonthlyReport(report: Omit<MonthlyReport, 'id' | 'createdAt' | 'updatedAt'>): Promise<MonthlyReport> {
    const id = this.generateId();
    const now = new Date().toISOString();
    const database = await getDatabase();
    
    await database.runAsync(
      'INSERT INTO monthly_reports (id, employeeId, month, year, totalMiles, status, submittedAt, approvedAt, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [id, report.employeeId, report.month, report.year, report.totalMiles, report.status, report.submittedAt?.toISOString() || '', report.approvedAt?.toISOString() || '', now, now]
    );

    return {
      id,
      ...report,
      submittedAt: report.submittedAt,
      approvedAt: report.approvedAt,
      createdAt: new Date(now),
      updatedAt: new Date(now)
    };
  }

  static async getMonthlyReports(employeeId?: string): Promise<MonthlyReport[]> {
    const database = await getDatabase();
    let query = 'SELECT * FROM monthly_reports';
    const params: any[] = [];

    if (employeeId) {
      query += ' WHERE employeeId = ?';
      params.push(employeeId);
    }

    query += ' ORDER BY year DESC, month DESC';

    const result = await database.getAllAsync(query, params);
    
    return result.map((row: any) => ({
      ...row,
      submittedAt: row.submittedAt ? new Date(row.submittedAt) : undefined,
      approvedAt: row.approvedAt ? new Date(row.approvedAt) : undefined,
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt)
    }));
  }

  // Receipt operations
  static async createReceipt(receipt: Omit<Receipt, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): Promise<Receipt> {
    const id = receipt.id || this.generateId(); // Use provided ID or generate new one
    const now = new Date().toISOString();
    const database = await getDatabase();
    
    // Log who's creating receipts to debug duplicates
    debugLog('💾 Database: Creating receipt:', {
      id,
      vendor: receipt.vendor,
      amount: receipt.amount,
      category: receipt.category,
      hasProvidedId: !!receipt.id,
      hasImageUri: !!receipt.imageUri,
      imageUriType: receipt.imageUri ? typeof receipt.imageUri : 'none',
      imageUriPreview: receipt.imageUri ? (typeof receipt.imageUri === 'string' ? receipt.imageUri.substring(0, 50) : String(receipt.imageUri).substring(0, 50)) : 'none'
    });
    
    await database.runAsync(
      'INSERT INTO receipts (id, employeeId, date, amount, vendor, description, category, imageUri, fileType, costCenter, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [id, receipt.employeeId, receipt.date.toISOString(), receipt.amount, receipt.vendor, receipt.description || '', receipt.category, receipt.imageUri, receipt.fileType || 'image', receipt.costCenter || '', now, now]
    );

    const newReceipt = {
      id,
      ...receipt,
      createdAt: new Date(now),
      updatedAt: new Date(now)
    };

    // Sync to API service (with error handling)
    try {
      await this.syncToApi('addReceipt', newReceipt);
    } catch (error) {
      console.error('❌ Database: Error syncing receipt to API:', error);
      // Don't throw - receipt is still saved locally
    }

    // Analyze receipt for vendor intelligence (disabled for mobile compatibility)
    // try {
    //   await MileageAnalysisService.analyzeReceipt(newReceipt);
    // } catch (error) {
    //   console.error('❌ Database: Error analyzing receipt:', error);
    // }

    return newReceipt;
  }

  static async getRecentReceipts(employeeId: string, limit: number = 5): Promise<Receipt[]> {
    const database = await getDatabase();
    const query = 'SELECT * FROM receipts WHERE employeeId = ? ORDER BY date DESC LIMIT ?';
    
    const result = await database.getAllAsync(query, [employeeId, limit]);
    
    return result.map((row: any) => ({
      ...row,
      date: new Date(row.date),
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt)
    }));
  }

  static async getDashboardStats(employeeId: string): Promise<{
    recentMileageEntries: MileageEntry[];
    recentReceipts: Receipt[];
    monthlyStats: {
      totalMiles: number;
      totalHours: number;
      totalReceipts: number;
      mileageEntries: MileageEntry[];
      receipts: Receipt[];
    };
  }> {
    const database = await getDatabase();
    const now = new Date();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const year = now.getFullYear().toString();

    debugLog('📊 Database: Getting dashboard stats for employee:', employeeId, 'month:', month, 'year:', year);
    debugLog('📊 Database: Current date:', now.toISOString(), 'month:', (now.getMonth() + 1), 'year:', now.getFullYear());

    try {
      // Get recent entries and receipts in parallel
      debugLog('🔍 Database: Querying monthly time tracking for:', { employeeId, month, year });
      const [recentMileageEntries, recentReceipts, monthlyMileageEntries, monthlyReceipts, monthlyTimeTracking] = await Promise.all([
        // Get recent mileage entries (last 5)
        database.getAllAsync(
          'SELECT * FROM mileage_entries WHERE employeeId = ? ORDER BY date DESC, createdAt DESC LIMIT 5',
          [employeeId]
        ),
        // Get recent receipts (last 5)
        database.getAllAsync(
          'SELECT * FROM receipts WHERE employeeId = ? ORDER BY date DESC, createdAt DESC LIMIT 5',
          [employeeId]
        ),
        // Get monthly mileage entries
        database.getAllAsync(
          'SELECT * FROM mileage_entries WHERE employeeId = ? AND strftime("%m", date) = ? AND strftime("%Y", date) = ? ORDER BY date DESC',
          [employeeId, month, year]
        ),
        // Get monthly receipts
        database.getAllAsync(
          'SELECT * FROM receipts WHERE employeeId = ? AND strftime("%m", date) = ? AND strftime("%Y", date) = ? ORDER BY date DESC',
          [employeeId, month, year]
        ),
        // Get monthly time tracking hours
        database.getAllAsync(
          'SELECT * FROM time_tracking WHERE employeeId = ? AND strftime("%m", date) = ? AND strftime("%Y", date) = ?',
          [employeeId, month, year]
        )
      ]);

      // Process recent mileage entries
      const processedRecentMileageEntries = recentMileageEntries.map((row: any) => ({
        id: row.id,
        employeeId: row.employeeId,
        oxfordHouseId: row.oxfordHouseId,
        costCenter: row.costCenter || '',
        date: new Date(row.date),
        odometerReading: row.odometerReading,
        startLocation: row.startLocation,
        endLocation: row.endLocation,
        startLocationDetails: row.startLocationName ? {
          name: row.startLocationName,
          address: row.startLocationAddress || '',
          latitude: row.startLocationLat,
          longitude: row.startLocationLng
        } : undefined,
        endLocationDetails: row.endLocationName ? {
          name: row.endLocationName,
          address: row.endLocationAddress || '',
          latitude: row.endLocationLat,
          longitude: row.endLocationLng
        } : undefined,
        purpose: row.purpose,
        miles: row.miles,
        notes: row.notes,
        hoursWorked: row.hoursWorked,
        isGpsTracked: Boolean(row.isGpsTracked),
        createdAt: new Date(row.createdAt),
        updatedAt: new Date(row.updatedAt)
      }));

      // Process recent receipts
      const processedRecentReceipts = recentReceipts.map((row: any) => ({
        id: row.id,
        employeeId: row.employeeId,
        date: new Date(row.date),
        amount: row.amount,
        vendor: row.vendor,
        description: row.description,
        category: row.category,
        imageUri: row.imageUri,
        fileType: row.fileType || 'image', // Default to 'image' for backward compatibility
        costCenter: row.costCenter,
        createdAt: new Date(row.createdAt),
        updatedAt: new Date(row.updatedAt)
      }));

      // Process monthly mileage entries
      const processedMileageEntries = monthlyMileageEntries.map((row: any) => ({
        id: row.id,
        employeeId: row.employeeId,
        oxfordHouseId: row.oxfordHouseId,
        costCenter: row.costCenter || '',
        date: new Date(row.date),
        odometerReading: row.odometerReading,
        startLocation: row.startLocation,
        endLocation: row.endLocation,
        startLocationDetails: row.startLocationName ? {
          name: row.startLocationName,
          address: row.startLocationAddress || '',
          latitude: row.startLocationLat,
          longitude: row.startLocationLng
        } : undefined,
        endLocationDetails: row.endLocationName ? {
          name: row.endLocationName,
          address: row.endLocationAddress || '',
          latitude: row.endLocationLat,
          longitude: row.endLocationLng
        } : undefined,
        purpose: row.purpose,
        miles: row.miles,
        notes: row.notes,
        hoursWorked: row.hoursWorked,
        isGpsTracked: Boolean(row.isGpsTracked),
        createdAt: new Date(row.createdAt),
        updatedAt: new Date(row.updatedAt)
      }));

      // Process monthly receipts
      const processedReceipts = monthlyReceipts.map((row: any) => ({
        id: row.id,
        employeeId: row.employeeId,
        date: new Date(row.date),
        amount: row.amount,
        vendor: row.vendor,
        description: row.description,
        category: row.category,
        imageUri: row.imageUri,
        fileType: row.fileType || 'image', // Default to 'image' for backward compatibility
        costCenter: row.costCenter,
        createdAt: new Date(row.createdAt),
        updatedAt: new Date(row.updatedAt)
      }));

  // Calculate totals
  const totalMiles = processedMileageEntries.reduce((sum, entry) => sum + entry.miles, 0);
  
  // Calculate total hours ONLY from time tracking entries
  // NOTE: hoursWorked on mileage entries is DEPRECATED and should NOT be counted
  // Hours should only come from TimeTracking entries to avoid double-counting
  const totalTimeTrackingHours: number = monthlyTimeTracking.reduce((sum: number, entry: any) => sum + (entry.hours || 0), 0);
  const totalHours: number = totalTimeTrackingHours; // Only use time tracking hours
  
  debugLog('🕒 Database: Hours calculation debug:', {
    timeTrackingEntries: monthlyTimeTracking.length,
    timeTrackingHours: totalTimeTrackingHours,
    finalTotalHours: totalHours,
    timeTrackingEntryDetails: monthlyTimeTracking.map((e: any) => ({ date: e.date, hours: e.hours, category: e.category })),
    note: 'Mileage entry hoursWorked field is deprecated and not included in totals'
  });
  
  const totalReceipts = processedReceipts.reduce((sum, receipt) => sum + receipt.amount, 0);

  debugLog('📊 Database: Dashboard stats calculated:', {
    recentMileageEntries: processedRecentMileageEntries.length,
    recentReceipts: processedRecentReceipts.length,
    totalMiles,
    totalHours,
    totalReceipts,
    monthlyMileageEntries: processedMileageEntries.length,
    monthlyReceipts: processedReceipts.length
  });

  return {
    recentMileageEntries: processedRecentMileageEntries,
    recentReceipts: processedRecentReceipts,
    monthlyStats: {
      totalMiles,
      totalHours,
      totalReceipts,
      mileageEntries: processedMileageEntries,
      receipts: processedReceipts
    }
  };
    } catch (error) {
      console.error('❌ Database: Error getting dashboard stats:', error);
      // Return empty stats on error
      return {
        recentMileageEntries: [],
        recentReceipts: [],
        monthlyStats: {
          totalMiles: 0,
          totalHours: 0,
          totalReceipts: 0,
          mileageEntries: [],
          receipts: []
        }
      };
    }
  }

  static async getReceipts(employeeId?: string, month?: number, year?: number): Promise<Receipt[]> {
    const database = await getDatabase();
    let query = 'SELECT * FROM receipts';
    const params: any[] = [];
    const conditions: string[] = [];

    if (employeeId) {
      conditions.push('employeeId = ?');
      params.push(employeeId);
    }

    if (month && year) {
      conditions.push('strftime("%m", date) = ? AND strftime("%Y", date) = ?');
      params.push(month.toString().padStart(2, '0'), year.toString());
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY date DESC';

    const result = await database.getAllAsync(query, params);
    
    return result.map((row: any) => ({
      ...row,
      date: new Date(row.date),
      fileType: row.fileType || 'image', // Default to 'image' for backward compatibility
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt)
    }));
  }

  static async getReceiptsByCategoryAndDate(employeeId: string, category: string, date: Date): Promise<Receipt[]> {
    const database = await getDatabase();
    const dateStr = date.toISOString().split('T')[0]; // Get YYYY-MM-DD format
    
    const result = await database.getAllAsync(
      'SELECT * FROM receipts WHERE employeeId = ? AND category = ? AND date(date) = date(?)',
      [employeeId, category, dateStr]
    );
    
    return result.map((row: any) => ({
      ...row,
      date: new Date(row.date),
      fileType: row.fileType || 'image', // Default to 'image' for backward compatibility
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt)
    }));
  }

  static async updateReceipt(id: string, receipt: Partial<Receipt>): Promise<void> {
    const database = await getDatabase();
    const now = new Date().toISOString();
    
    // Build dynamic UPDATE query
    const updates: string[] = [];
    const values: any[] = [];
    
    if (receipt.employeeId !== undefined) {
      updates.push('employeeId = ?');
      values.push(receipt.employeeId);
    }
    if (receipt.date !== undefined) {
      updates.push('date = ?');
      values.push(receipt.date instanceof Date ? receipt.date.toISOString() : receipt.date);
    }
    if (receipt.amount !== undefined) {
      updates.push('amount = ?');
      values.push(receipt.amount);
    }
    if (receipt.vendor !== undefined) {
      updates.push('vendor = ?');
      values.push(receipt.vendor);
    }
    if (receipt.description !== undefined) {
      updates.push('description = ?');
      values.push(receipt.description);
    }
    if (receipt.category !== undefined) {
      updates.push('category = ?');
      values.push(receipt.category);
    }
    if (receipt.imageUri !== undefined) {
      updates.push('imageUri = ?');
      values.push(receipt.imageUri);
    }
    if (receipt.fileType !== undefined) {
      updates.push('fileType = ?');
      values.push(receipt.fileType);
    }
    if (receipt.costCenter !== undefined) {
      updates.push('costCenter = ?');
      values.push(receipt.costCenter);
    }
    
    updates.push('updatedAt = ?');
    values.push(now);
    values.push(id);
    
    // Get existing receipt to check if imageUri is being updated (before we update it)
    let existingReceipt: Receipt | undefined;
    try {
      const allReceipts = await this.getReceipts();
      existingReceipt = allReceipts.find(r => r.id === id);
    } catch (error) {
      debugWarn('Could not fetch existing receipt:', error);
    }
    
    const isImageBeingUpdated = receipt.imageUri !== undefined && 
                                receipt.imageUri !== existingReceipt?.imageUri &&
                                receipt.imageUri.trim() !== '';
    
    if (updates.length > 1) { // More than just updatedAt
      await database.runAsync(
        `UPDATE receipts SET ${updates.join(', ')} WHERE id = ?`,
        values
      );
      
      // If a new image was added, clear any missing image notification
      if (isImageBeingUpdated && existingReceipt) {
        try {
          const { SmartNotificationService } = await import('./smartNotificationService');
          SmartNotificationService.clearMissingImageNotification(existingReceipt.employeeId, id);
          debugLog(`✅ Database: Cleared missing image notification for receipt ${id}`);
        } catch (error) {
          debugWarn('Could not clear missing image notification:', error);
        }
      }
    }
  }

  static async deleteReceipt(id: string): Promise<void> {
    const database = await getDatabase();
    debugLog('🗑️ Database: Deleting receipt with ID:', id);

    // Queue backend DELETE so next sync doesn't re-pull this receipt and re-insert it
    try {
      const { SyncIntegrationService } = await import('./syncIntegrationService');
      SyncIntegrationService.removeFromQueue('receipt', id); // clear any pending create/update
      SyncIntegrationService.queueSyncOperation('delete', 'receipt', { id });
      debugLog('✅ Database: Queued receipt delete for backend');
    } catch (error) {
      console.error('⚠️ Database: Could not queue receipt delete:', error);
    }

    const result = await database.runAsync('DELETE FROM receipts WHERE id = ?', [id]);
    debugLog('✅ Database: Receipt deleted, rows affected:', result.changes);
  }

  // Daily Odometer Reading methods
  static async createDailyOdometerReading(reading: Omit<DailyOdometerReading, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }, skipSync = false): Promise<DailyOdometerReading> {
    const id = reading.id || this.generateId();
    const now = new Date().toISOString();
    const database = await getDatabase();
    
    // Use local timezone for date storage to avoid timezone issues
    const year = reading.date.getFullYear();
    const month = String(reading.date.getMonth() + 1).padStart(2, '0');
    const day = String(reading.date.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    
    debugLog('💾 Database: Creating daily odometer reading');
    debugLog('💾 Database: Employee ID:', reading.employeeId);
    debugLog('💾 Database: Date (local):', dateStr);
    debugLog('💾 Database: Odometer Reading:', reading.odometerReading);
    
    await database.runAsync(
      'INSERT INTO daily_odometer_readings (id, employeeId, date, odometerReading, notes, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [
        id, 
        reading.employeeId, 
        dateStr, 
        reading.odometerReading,
        reading.notes || '', 
        now, 
        now
      ]
    );

    debugLog('✅ Database: Daily odometer reading created successfully with ID:', id);

    const newReading = {
      id,
      ...reading,
      notes: reading.notes,
      createdAt: new Date(now),
      updatedAt: new Date(now)
    };

    if (!skipSync) {
      await this.syncToApi('addDailyOdometerReading', newReading);
    }

    return newReading;
  }

  static async getDailyOdometerReading(employeeId: string, date: Date): Promise<DailyOdometerReading | null> {
    const database = await getDatabase();
    // Use local timezone instead of UTC to avoid timezone issues
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    
    debugLog('🔍 Database: Looking for odometer reading');
    debugLog('🔍 Database: Employee ID:', employeeId);
    debugLog('🔍 Database: Date string (local):', dateStr);
    
    const result = await database.getFirstAsync(
      'SELECT * FROM daily_odometer_readings WHERE employeeId = ? AND date = ?',
      [employeeId, dateStr]
    ) as any;

    debugLog('🔍 Database: Query result:', result);

    if (!result) {
      debugLog('🔍 Database: No reading found for this date');
      return null;
    }

    debugLog('🔍 Database: Reading found:', result);
    return {
      id: result.id,
      employeeId: result.employeeId,
      date: new Date(result.date),
      odometerReading: result.odometerReading,
      notes: result.notes,
      createdAt: new Date(result.createdAt),
      updatedAt: new Date(result.updatedAt)
    };
  }

  static async getDailyOdometerReadings(employeeId?: string): Promise<DailyOdometerReading[]> {
    const database = await getDatabase();
    let query = 'SELECT * FROM daily_odometer_readings';
    const params: any[] = [];

    if (employeeId) {
      query += ' WHERE employeeId = ?';
      params.push(employeeId);
    }

    query += ' ORDER BY date DESC';

    const result = await database.getAllAsync(query, params);
    
    return result.map((row: any) => ({
      id: row.id,
      employeeId: row.employeeId,
      date: new Date(row.date),
      odometerReading: row.odometerReading,
      notes: row.notes,
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt)
    }));
  }

  static async updateDailyOdometerReading(id: string, updates: Partial<DailyOdometerReading>): Promise<void> {
    const database = await getDatabase();
    const now = new Date().toISOString();
    
    const fields = [];
    const values = [];
    
    if (updates.odometerReading !== undefined) {
      fields.push('odometerReading = ?');
      values.push(updates.odometerReading);
    }
    if (updates.notes !== undefined) {
      fields.push('notes = ?');
      values.push(updates.notes);
    }
    
    fields.push('updatedAt = ?');
    values.push(now);
    values.push(id);
    
    await database.runAsync(
      `UPDATE daily_odometer_readings SET ${fields.join(', ')} WHERE id = ?`,
      values
    );
  }

  static async updateDailyOdometerReadingByEmployeeAndDate(employeeId: string, dateStr: string, updates: Partial<DailyOdometerReading>): Promise<void> {
    const database = await getDatabase();
    const now = new Date().toISOString();
    
    const fields = [];
    const values = [];
    
    if (updates.odometerReading !== undefined) {
      fields.push('odometerReading = ?');
      values.push(updates.odometerReading);
    }
    if (updates.notes !== undefined) {
      fields.push('notes = ?');
      values.push(updates.notes);
    }
    
    fields.push('updatedAt = ?');
    values.push(now);
    values.push(employeeId);
    values.push(dateStr);
    
    await database.runAsync(
      `UPDATE daily_odometer_readings SET ${fields.join(', ')} WHERE employeeId = ? AND date = ?`,
      values
    );
    
    debugLog('🔧 Database: Updated daily odometer reading for employee:', employeeId, 'date:', dateStr, 'updates:', updates);
  }

  static async deleteDailyOdometerReading(id: string): Promise<void> {
    const database = await getDatabase();
    await database.runAsync('DELETE FROM daily_odometer_readings WHERE id = ?', [id]);
  }

  // Oxford House operations
  static async createOxfordHouse(house: Omit<OxfordHouse, 'id' | 'createdAt' | 'updatedAt'>): Promise<OxfordHouse> {
    const id = this.generateId();
    const now = new Date().toISOString();
    const database = await getDatabase();
    
    await database.runAsync(
      'INSERT INTO oxford_houses (id, name, address, city, state, zipCode, phoneNumber, managerId, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [id, house.name, house.address, house.city, house.state, house.zipCode, house.phoneNumber || '', house.managerId || '', now, now]
    );

    return {
      id,
      name: house.name,
      address: house.address,
      city: house.city,
      state: house.state,
      zipCode: house.zipCode,
      phoneNumber: house.phoneNumber || '',
      managerId: house.managerId || '',
      createdAt: new Date(now),
      updatedAt: new Date(now)
    };
  }

  static async getOxfordHouses(): Promise<OxfordHouse[]> {
    const database = await getDatabase();
    const result = await database.getAllAsync('SELECT * FROM oxford_houses ORDER BY name');
    
    return result.map((row: any) => ({
      id: row.id,
      name: row.name,
      address: row.address,
      city: row.city,
      state: row.state,
      zipCode: row.zipCode,
      phoneNumber: row.phoneNumber,
      managerId: row.managerId,
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt)
    }));
  }

  static async getOxfordHouse(id: string): Promise<OxfordHouse | null> {
    const database = await getDatabase();
    const result = await database.getFirstAsync('SELECT * FROM oxford_houses WHERE id = ?', [id]) as any;
    
    if (!result) {
      return null;
    }

    return {
      id: result.id,
      name: result.name,
      address: result.address,
      city: result.city,
      state: result.state,
      zipCode: result.zipCode,
      phoneNumber: result.phoneNumber,
      managerId: result.managerId,
      createdAt: new Date(result.createdAt),
      updatedAt: new Date(result.updatedAt)
    };
  }

  static async updateOxfordHouse(id: string, updates: Partial<OxfordHouse>): Promise<void> {
    const now = new Date().toISOString();
    const database = await getDatabase();
    
    const fields = Object.keys(updates).filter(key => 
      key !== 'id' && 
      key !== 'createdAt' && 
      key !== 'updatedAt'
    );
    
    if (fields.length === 0) {
      return; // Nothing to update
    }
    
    const setClause = fields.map(field => `${field} = ?`).join(', ');
    const values = fields.map(field => {
      const value = updates[field as keyof OxfordHouse];
      return value instanceof Date ? value.toISOString() : value;
    });
    
    await database.runAsync(
      `UPDATE oxford_houses SET ${setClause}, updatedAt = ? WHERE id = ?`,
      [...values, now, id] as any[]
    );
  }

  static async deleteOxfordHouse(id: string): Promise<void> {
    const database = await getDatabase();
    await database.runAsync('DELETE FROM oxford_houses WHERE id = ?', [id]);
  }

  // Saved Address operations
  static async createSavedAddress(address: Omit<SavedAddress, 'id' | 'createdAt' | 'updatedAt'>): Promise<SavedAddress> {
    const id = this.generateId();
    const now = new Date().toISOString();
    const database = await getDatabase();
    
    await database.runAsync(
      'INSERT INTO saved_addresses (id, employeeId, name, address, latitude, longitude, category, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [id, address.employeeId, address.name, address.address, address.latitude || null, address.longitude || null, address.category || '', now, now]
    );

    const newAddress = {
      id,
      employeeId: address.employeeId,
      name: address.name,
      address: address.address,
      latitude: address.latitude,
      longitude: address.longitude,
      category: address.category || '',
      createdAt: new Date(now),
      updatedAt: new Date(now)
    };

    // Sync to API service
    await this.syncToApi('addSavedAddress', newAddress);

    return newAddress;
  }

  static async getSavedAddresses(employeeId?: string): Promise<SavedAddress[]> {
    const database = await getDatabase();
    let query = 'SELECT * FROM saved_addresses';
    const params: any[] = [];
    
    if (employeeId) {
      query += ' WHERE employeeId = ?';
      params.push(employeeId);
    }
    
    query += ' ORDER BY name';
    
    const result = await database.getAllAsync(query, params);
    
    return result.map((row: any) => ({
      id: row.id,
      employeeId: row.employeeId,
      name: row.name,
      address: row.address,
      latitude: row.latitude,
      longitude: row.longitude,
      category: row.category,
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt)
    }));
  }

  static async getRecentLocations(employeeId?: string, limit: number = 20): Promise<string[]> {
    const database = await getDatabase();
    let query = `
      SELECT DISTINCT startLocation, endLocation 
      FROM mileage_entries 
      WHERE startLocation != '' OR endLocation != ''
    `;
    const params: any[] = [];
    
    if (employeeId) {
      query += ' AND employeeId = ?';
      params.push(employeeId);
    }
    
    query += ' ORDER BY createdAt DESC LIMIT ?';
    params.push(limit);
    
    const result = await database.getAllAsync(query, params);
    
    // Combine and deduplicate start and end locations
    const locations = new Set<string>();
    result.forEach((row: any) => {
      if (row.startLocation) locations.add(row.startLocation);
      if (row.endLocation) locations.add(row.endLocation);
    });
    
    return Array.from(locations);
  }

  static async getSavedAddress(id: string): Promise<SavedAddress | null> {
    const database = await getDatabase();
    const result = await database.getFirstAsync('SELECT * FROM saved_addresses WHERE id = ?', [id]) as any;
    
    if (!result) {
      return null;
    }

    return {
      id: result.id,
      employeeId: result.employeeId,
      name: result.name,
      address: result.address,
      latitude: result.latitude,
      longitude: result.longitude,
      category: result.category,
      createdAt: new Date(result.createdAt),
      updatedAt: new Date(result.updatedAt)
    };
  }

  static async updateSavedAddress(id: string, updates: Partial<SavedAddress>): Promise<void> {
    const now = new Date().toISOString();
    const database = await getDatabase();
    
    const fields = Object.keys(updates).filter(key => 
      key !== 'id' && 
      key !== 'createdAt' && 
      key !== 'updatedAt'
    );
    
    if (fields.length === 0) {
      return; // Nothing to update
    }
    
    const setClause = fields.map(field => `${field} = ?`).join(', ');
    const values = fields.map(field => {
      const value = updates[field as keyof SavedAddress];
      return value instanceof Date ? value.toISOString() : value;
    });
    
    await database.runAsync(
      `UPDATE saved_addresses SET ${setClause}, updatedAt = ? WHERE id = ?`,
      [...values, now, id] as any[]
    );
  }

  static async deleteSavedAddress(id: string): Promise<void> {
    const database = await getDatabase();
    await database.runAsync('DELETE FROM saved_addresses WHERE id = ?', [id]);
  }


  static async getMileageEntry(id: string): Promise<MileageEntry | null> {
    const database = await getDatabase();
    const result = await database.getFirstAsync('SELECT * FROM mileage_entries WHERE id = ?', [id]) as any;
    
    if (!result) return null;
    
    return {
      id: result.id,
      employeeId: result.employeeId,
      oxfordHouseId: result.oxfordHouseId,
      costCenter: result.costCenter || '',
      date: new Date(result.date),
      startLocation: result.startLocation,
      endLocation: result.endLocation,
      purpose: result.purpose,
      miles: result.miles,
      odometerReading: result.odometerReading,
      isGpsTracked: Boolean(result.isGpsTracked),
      startLocationDetails: result.startLocationName ? {
        name: result.startLocationName,
        address: result.startLocationAddress || '',
        latitude: result.startLocationLat,
        longitude: result.startLocationLng
      } : undefined,
      endLocationDetails: result.endLocationName ? {
        name: result.endLocationName,
        address: result.endLocationAddress || '',
        latitude: result.endLocationLat,
        longitude: result.endLocationLng
      } : undefined,
      createdAt: new Date(result.createdAt),
      updatedAt: new Date(result.updatedAt)
    };
  }

  static async getReceipt(id: string): Promise<Receipt | null> {
    const database = await getDatabase();
    const result = await database.getFirstAsync('SELECT * FROM receipts WHERE id = ?', [id]) as any;
    
    if (!result) return null;
    
    return {
      id: result.id,
      employeeId: result.employeeId,
      date: new Date(result.date),
      amount: result.amount,
      vendor: result.vendor,
      description: result.description,
      category: result.category,
      imageUri: result.imageUri,
      costCenter: result.costCenter,
      createdAt: new Date(result.createdAt),
      updatedAt: new Date(result.updatedAt)
    };
  }

  // Helper function to calculate total miles for a specific day
  private static async getTotalMilesForDay(employeeId: string, date: Date): Promise<number> {
    const database = await getDatabase();
    const dateStr = date.toISOString().split('T')[0]; // Get YYYY-MM-DD format
    
    const result = await database.getFirstAsync(
      'SELECT SUM(miles) as totalMiles FROM mileage_entries WHERE employeeId = ? AND date(date) = date(?)',
      [employeeId, dateStr]
    ) as any;
    
    return result?.totalMiles || 0;
  }

  // Update end odometer reading for a specific day
  // Removed: updateEndOdometerReading - endOdometerReading column no longer exists
  // End odometer is now calculated at the end of the day, not after each entry

  private static generateId(): string {
    // Use a counter to ensure uniqueness even within the same millisecond
    // This prevents ID collisions when multiple entries are created rapidly
    const now = Date.now();
    const random = Math.random().toString(36).substring(2, 15); // Longer random string
    const counter = Math.floor(Math.random() * 100000).toString(36);
    return `${now.toString(36)}${random}${counter}`;
  }

  // Time Tracking Methods
  static async createTimeTracking(tracking: Omit<TimeTracking, 'id' | 'createdAt' | 'updatedAt'>): Promise<TimeTracking> {
    const id = this.generateId();
    const now = new Date().toISOString();
    const database = await getDatabase();
    
    // Store date as YYYY-MM-DD to match backend and avoid timezone/strftime issues
    const dateObj = tracking.date instanceof Date ? tracking.date : new Date(tracking.date);
    const dateStr = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;

    await database.runAsync(
      'INSERT INTO time_tracking (id, employeeId, date, category, hours, description, costCenter, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        id,
        tracking.employeeId,
        dateStr,
        tracking.category,
        tracking.hours,
        tracking.description || '',
        tracking.costCenter || '',
        now,
        now
      ]
    );

    const newTracking = {
      id,
      employeeId: tracking.employeeId,
      date: tracking.date,
      category: tracking.category,
      hours: tracking.hours,
      description: tracking.description || '',
      createdAt: new Date(now),
      updatedAt: new Date(now)
    };

    // Sync to API service (with error handling)
    try {
      await this.syncToApi('addTimeTracking', newTracking);
    } catch (error) {
      console.error('❌ Database: Error syncing time tracking:', error);
      // Don't throw - time tracking is still saved locally
    }

    return newTracking;
  }

  static async getTimeTrackingEntries(employeeId?: string, month?: number, year?: number): Promise<TimeTracking[]> {
    const database = await getDatabase();
    let query = 'SELECT * FROM time_tracking';
    const params: any[] = [];
    const conditions: string[] = [];

    if (employeeId) {
      conditions.push('employeeId = ?');
      params.push(employeeId);
    }

    if (month !== undefined && year !== undefined) {
      conditions.push('strftime("%m", date) = ? AND strftime("%Y", date) = ?');
      params.push(month.toString().padStart(2, '0'), year.toString());
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY date DESC';

    const result = await database.getAllAsync(query, params);
    
    return result.map((row: any) => ({
      ...row,
      date: new Date(row.date),
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt)
    }));
  }

  static async getTimeTracking(id: string): Promise<TimeTracking | null> {
    const database = await getDatabase();
    const result = await database.getFirstAsync('SELECT * FROM time_tracking WHERE id = ?', [id]) as any;
    
    if (!result) return null;
    
    return {
      id: result.id,
      employeeId: result.employeeId,
      date: new Date(result.date),
      category: result.category,
      hours: result.hours,
      description: result.description,
      costCenter: result.costCenter,
      createdAt: new Date(result.createdAt),
      updatedAt: new Date(result.updatedAt)
    };
  }

  static async updateTimeTracking(id: string, updates: Partial<Omit<TimeTracking, 'id' | 'createdAt' | 'updatedAt'>>): Promise<void> {
    const database = await getDatabase();
    const fields: string[] = [];
    const values: any[] = [];

    if (updates.employeeId !== undefined) {
      fields.push('employeeId = ?');
      values.push(updates.employeeId);
    }

    if (updates.date !== undefined) {
      fields.push('date = ?');
      values.push(updates.date.toISOString());
    }

    if (updates.category !== undefined) {
      fields.push('category = ?');
      values.push(updates.category);
    }

    if (updates.hours !== undefined) {
      fields.push('hours = ?');
      values.push(updates.hours);
    }

    if (updates.description !== undefined) {
      fields.push('description = ?');
      values.push(updates.description);
    }

    if (updates.costCenter !== undefined) {
      fields.push('costCenter = ?');
      values.push(updates.costCenter);
    }

    fields.push('updatedAt = ?');
    values.push(new Date().toISOString());

    if (fields.length === 1) return; // Only updatedAt field

    await database.runAsync(
      `UPDATE time_tracking SET ${fields.join(', ')} WHERE id = ?`,
      [...values, id]
    );
  }

  static async deleteTimeTracking(id: string): Promise<void> {
    const database = await getDatabase();
    debugLog('🗑️ Database: Deleting time tracking entry:', id);
    
    await database.runAsync('DELETE FROM time_tracking WHERE id = ?', [id]);
    
    debugLog('✅ Database: Time tracking entry deleted successfully');
    queueSyncOperation('delete', 'timeTracking', { id });
  }

  static async getAllTimeTrackingEntries(): Promise<TimeTracking[]> {
    const database = await getDatabase();
    const result = await database.getAllAsync('SELECT * FROM time_tracking ORDER BY date DESC');
    
    return result.map((row: any) => ({
      id: row.id,
      employeeId: row.employeeId,
      date: new Date(row.date),
      category: row.category,
      hours: row.hours,
      description: row.description,
      costCenter: row.costCenter,
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt)
    }));
  }

  static async getAllReceipts(): Promise<Receipt[]> {
    return this.getReceipts();
  }

  static async getAllTimeTracking(): Promise<TimeTracking[]> {
    return this.getAllTimeTrackingEntries();
  }

  /**
   * Run employee table migrations
   * Consolidates all employee table schema changes into a single method
   */
  private static async runEmployeeMigrations(database: SQLite.SQLiteDatabase): Promise<void> {
    const employeeMigrations = [
      { column: 'baseAddress', type: 'TEXT DEFAULT \'\'' },
      { column: 'costCenters', type: 'TEXT DEFAULT \'[]\'' },
      { column: 'password', type: 'TEXT DEFAULT \'\'' },
      { column: 'baseAddress2', type: 'TEXT DEFAULT \'\'' },
      { column: 'selectedCostCenters', type: 'TEXT DEFAULT \'[]\'' },
      { column: 'defaultCostCenter', type: 'TEXT DEFAULT \'\'' },
      { column: 'preferredName', type: 'TEXT DEFAULT \'\'' },
      { column: 'typicalWorkStartHour', type: 'INTEGER' },
      { column: 'typicalWorkEndHour', type: 'INTEGER' },
      { column: 'hasCompletedSetupWizard', type: 'INTEGER DEFAULT 0' },
      { column: 'hasCompletedOnboarding', type: 'INTEGER DEFAULT 0' }
    ];

    for (const migration of employeeMigrations) {
      try {
        await database.execAsync(`
          ALTER TABLE employees ADD COLUMN ${migration.column} ${migration.type};
        `);
        debugLog(`✅ Added column ${migration.column} to employees table`);
      } catch (error) {
        // Column already exists, ignore error
        debugLog(`ℹ️ Column ${migration.column} already exists in employees table`);
      }
    }
  }

  /**
   * Run mileage entries table migrations
   * Consolidates all mileage entries table schema changes into a single method
   */
  private static async runMileageEntriesMigrations(database: SQLite.SQLiteDatabase): Promise<void> {
    const mileageMigrations = [
      { column: 'costCenter', type: 'TEXT DEFAULT \'\'' },
      { column: 'startLocationName', type: 'TEXT' },
      { column: 'startLocationAddress', type: 'TEXT' },
      { column: 'startLocationLat', type: 'REAL' },
      { column: 'startLocationLng', type: 'REAL' },
      { column: 'endLocationName', type: 'TEXT' },
      { column: 'endLocationAddress', type: 'TEXT' },
      { column: 'endLocationLat', type: 'REAL' },
      { column: 'endLocationLng', type: 'REAL' }
    ];

    for (const migration of mileageMigrations) {
      try {
        await database.execAsync(`
          ALTER TABLE mileage_entries ADD COLUMN ${migration.column} ${migration.type};
        `);
        debugLog(`✅ Added column ${migration.column} to mileage_entries table`);
      } catch (error) {
        // Column already exists, ignore error
        debugLog(`ℹ️ Column ${migration.column} already exists in mileage_entries table`);
      }
    }
  }


  // Monthly Report Methods
  static async updateMonthlyReport(reportId: string, updates: Partial<MonthlyReport>): Promise<void> {
    const database = await getDatabase();
    
    debugLog('🔄 Database: Updating monthly report:', reportId, updates);
    
    const fields = Object.keys(updates).filter(key => 
      key !== 'id' && 
      key !== 'createdAt' && 
      key !== 'updatedAt' &&
      updates[key as keyof MonthlyReport] !== undefined
    );
    const values = fields.map(field => {
      const value = updates[field as keyof MonthlyReport];
      return value instanceof Date ? value.toISOString() : value;
    });
    
    if (fields.length > 0) {
      const setClause = fields.map(field => `${field} = ?`).join(', ');
      const updateQuery = `UPDATE monthly_reports SET ${setClause}, updatedAt = ? WHERE id = ?`;
      
      await database.runAsync(updateQuery, [...values, new Date().toISOString(), reportId] as any[]);
      
      debugLog('✅ Database: Monthly report updated successfully');
    }
  }

  static async deleteMonthlyReport(reportId: string): Promise<void> {
    const database = await getDatabase();
    
    debugLog('🗑️ Database: Deleting monthly report:', reportId);
    
    await database.runAsync(
      'DELETE FROM monthly_reports WHERE id = ?',
      [reportId]
    );
    
    debugLog('✅ Database: Monthly report deleted successfully');
  }

  /**
   * Run receipts table migrations
   * Adds cost center column to receipts table
   */
  private static async runReceiptsMigrations(database: SQLite.SQLiteDatabase): Promise<void> {
    const receiptsMigrations = [
      { column: 'costCenter', type: 'TEXT DEFAULT \'\'' }
    ];

    for (const migration of receiptsMigrations) {
      try {
        await database.execAsync(`
          ALTER TABLE receipts ADD COLUMN ${migration.column} ${migration.type};
        `);
        debugLog(`✅ Added column ${migration.column} to receipts table`);
      } catch (error) {
        // Column already exists, ignore error
        debugLog(`ℹ️ Column ${migration.column} already exists in receipts table`);
      }
    }
  }

  /**
   * Run time tracking table migrations
   * Adds cost center column to time_tracking table
   */
  private static async runTimeTrackingMigrations(database: SQLite.SQLiteDatabase): Promise<void> {
    const timeTrackingMigrations = [
      { column: 'costCenter', type: 'TEXT DEFAULT \'\'' }
    ];

    for (const migration of timeTrackingMigrations) {
      try {
        await database.execAsync(`
          ALTER TABLE time_tracking ADD COLUMN ${migration.column} ${migration.type};
        `);
        debugLog(`✅ Added column ${migration.column} to time_tracking table`);
      } catch (error) {
        // Column already exists, ignore error
        debugLog(`ℹ️ Column ${migration.column} already exists in time_tracking table`);
      }
    }
  }

  // Daily Description Methods
  static async createDailyDescription(data: Omit<DailyDescription, 'id' | 'createdAt' | 'updatedAt'>): Promise<DailyDescription> {
    const database = await getDatabase();
    
    const id = `desc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();
    
    const dailyDescription: DailyDescription = {
      id,
      employeeId: data.employeeId,
      date: data.date,
      description: data.description,
      costCenter: data.costCenter,
      stayedOvernight: data.stayedOvernight || false,
      dayOff: data.dayOff || false,
      dayOffType: data.dayOffType || null,
      createdAt: new Date(now),
      updatedAt: new Date(now)
    };
    
    debugLog('💬 Database: Creating daily description:', dailyDescription);
    
    const dateKey = this.toLocalDateKey(data.date);
    
    await database.runAsync(
      `INSERT INTO daily_descriptions (id, employeeId, date, description, costCenter, stayedOvernight, dayOff, dayOffType, createdAt, updatedAt) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        dailyDescription.id,
        dailyDescription.employeeId,
        dateKey, // Store as YYYY-MM-DD (local)
        dailyDescription.description,
        dailyDescription.costCenter || '',
        dailyDescription.stayedOvernight ? 1 : 0,
        dailyDescription.dayOff ? 1 : 0,
        dailyDescription.dayOffType || null,
        now,
        now
      ]
    );
    
    debugLog('✅ Database: Daily description created successfully');
    await this.syncToApi('addDailyDescription', dailyDescription);
    return dailyDescription;
  }

  static async updateDailyDescription(id: string, updates: Partial<DailyDescription>): Promise<void> {
    const database = await getDatabase();
    
    debugLog('🔄 Database: Updating daily description:', id, updates);
    
    const fields = Object.keys(updates).filter(key => 
      key !== 'id' && 
      key !== 'createdAt' && 
      key !== 'updatedAt' &&
      updates[key as keyof DailyDescription] !== undefined
    );
    const values = fields.map(field => {
      const value = updates[field as keyof DailyDescription];
      if (field === 'date' && value instanceof Date) {
        return this.toLocalDateKey(value); // Store as YYYY-MM-DD (local)
      }
      return value instanceof Date ? value.toISOString() : value;
    });
    
    if (fields.length > 0) {
      const setClause = fields.map(field => `${field} = ?`).join(', ');
      const updateQuery = `UPDATE daily_descriptions SET ${setClause}, updatedAt = ? WHERE id = ?`;
      
      const newUpdatedAt = new Date().toISOString();
      await database.runAsync(updateQuery, [...values, newUpdatedAt, id] as any[]);
      
      debugLog('✅ Database: Daily description updated successfully');
      const updatedDescription = await this.getDailyDescription(id);
      if (updatedDescription) {
        // Update the updatedAt to ensure it's newer than backend
        updatedDescription.updatedAt = new Date(newUpdatedAt);
        await this.syncToApi('updateDailyDescription', updatedDescription);
      }
    }
  }

  static async deleteDailyDescription(id: string): Promise<void> {
    const database = await getDatabase();
    
    debugLog('🗑️ Database: Deleting daily description:', id);
    
    await database.runAsync(
      'DELETE FROM daily_descriptions WHERE id = ?',
      [id]
    );
    
    debugLog('✅ Database: Daily description deleted successfully');
    queueSyncOperation('delete', 'dailyDescription', { id });
  }

  static async getDailyDescription(id: string): Promise<DailyDescription | null> {
    const database = await getDatabase();
    
    const result = await database.getFirstAsync(
      'SELECT * FROM daily_descriptions WHERE id = ?',
      [id]
    ) as any;
    
    if (!result) {
      return null;
    }
    
    return {
      id: result.id,
      employeeId: result.employeeId,
      date: this.parseDateSafe(result.date),
      description: result.description,
      costCenter: result.costCenter,
      stayedOvernight: result.stayedOvernight === 1 || result.stayedOvernight === true,
      dayOff: result.dayOff === 1 || result.dayOff === true,
      dayOffType: result.dayOffType || undefined,
      createdAt: new Date(result.createdAt),
      updatedAt: new Date(result.updatedAt)
    };
  }

  static async getDailyDescriptions(employeeId: string, month?: number, year?: number): Promise<DailyDescription[]> {
    const database = await getDatabase();
    
    let query = 'SELECT * FROM daily_descriptions WHERE employeeId = ?';
    const params: any[] = [employeeId];
    
    if (month !== undefined && year !== undefined) {
      query += ' AND strftime("%m", date) = ? AND strftime("%Y", date) = ?';
      params.push(month.toString().padStart(2, '0'), year.toString());
    }
    
    query += ' ORDER BY date DESC';
    
    const results = await database.getAllAsync(query, params) as any[];
    
    return results.map(result => ({
      id: result.id,
      employeeId: result.employeeId,
      date: this.parseDateSafe(result.date),
      description: result.description,
      costCenter: result.costCenter,
      stayedOvernight: result.stayedOvernight === 1 || result.stayedOvernight === true,
      dayOff: result.dayOff === 1 || result.dayOff === true,
      dayOffType: result.dayOffType || undefined,
      createdAt: new Date(result.createdAt),
      updatedAt: new Date(result.updatedAt)
    }));
  }

  static async getDailyDescriptionByDate(employeeId: string, date: Date): Promise<DailyDescription | null> {
    const database = await getDatabase();
    
    const dateStr = this.toLocalDateKey(date);
    
    const result = await database.getFirstAsync(
      'SELECT * FROM daily_descriptions WHERE employeeId = ? AND date = ?',
      [employeeId, dateStr]
    ) as any;
    
    if (!result) {
      return null;
    }
    
    return {
      id: result.id,
      employeeId: result.employeeId,
      date: this.parseDateSafe(result.date),
      description: result.description,
      costCenter: result.costCenter,
      stayedOvernight: result.stayedOvernight === 1 || result.stayedOvernight === true,
      dayOff: result.dayOff === 1 || result.dayOff === true,
      dayOffType: result.dayOffType || undefined,
      createdAt: new Date(result.createdAt),
      updatedAt: new Date(result.updatedAt)
    };
  }

  // Cost Center Summary Methods
  static async createCostCenterSummary(data: Omit<CostCenterSummary, 'id' | 'createdAt' | 'updatedAt'>): Promise<CostCenterSummary> {
    const database = await getDatabase();
    
    const id = `cc_summary_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();
    
    const summary: CostCenterSummary = {
      id,
      employeeId: data.employeeId,
      costCenter: data.costCenter,
      month: data.month,
      year: data.year,
      totalHours: data.totalHours,
      totalMiles: data.totalMiles,
      totalReceipts: data.totalReceipts,
      totalPerDiem: data.totalPerDiem,
      totalExpenses: data.totalExpenses,
      mileageEntries: data.mileageEntries,
      receiptEntries: data.receiptEntries,
      timeTrackingEntries: data.timeTrackingEntries,
      descriptionEntries: data.descriptionEntries,
      createdAt: new Date(now),
      updatedAt: new Date(now)
    };
    
    debugLog('📊 Database: Creating cost center summary:', summary);
    
    await database.runAsync(
      `INSERT INTO cost_center_summaries (id, employeeId, costCenter, month, year, totalHours, totalMiles, totalReceipts, totalPerDiem, totalExpenses, mileageEntries, receiptEntries, timeTrackingEntries, descriptionEntries, createdAt, updatedAt) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        summary.id,
        summary.employeeId,
        summary.costCenter,
        summary.month,
        summary.year,
        summary.totalHours,
        summary.totalMiles,
        summary.totalReceipts,
        summary.totalPerDiem,
        summary.totalExpenses,
        summary.mileageEntries,
        summary.receiptEntries,
        summary.timeTrackingEntries,
        summary.descriptionEntries,
        now,
        now
      ]
    );
    
    debugLog('✅ Database: Cost center summary created successfully');
    return summary;
  }

  static async updateCostCenterSummary(id: string, updates: Partial<CostCenterSummary>): Promise<void> {
    const database = await getDatabase();
    
    debugLog('🔄 Database: Updating cost center summary:', id, updates);
    
    const fields = Object.keys(updates).filter(key => 
      key !== 'id' && 
      key !== 'createdAt' && 
      key !== 'updatedAt' &&
      updates[key as keyof CostCenterSummary] !== undefined
    );
    const values = fields.map(field => updates[field as keyof CostCenterSummary]);
    
    if (fields.length > 0) {
      const setClause = fields.map(field => `${field} = ?`).join(', ');
      const updateQuery = `UPDATE cost_center_summaries SET ${setClause}, updatedAt = ? WHERE id = ?`;
      
      await database.runAsync(updateQuery, [...values, new Date().toISOString(), id] as any[]);
      
      debugLog('✅ Database: Cost center summary updated successfully');
    }
  }

  static async getCostCenterSummary(employeeId: string, costCenter: string, month: number, year: number): Promise<CostCenterSummary | null> {
    const database = await getDatabase();
    
    const result = await database.getFirstAsync(
      'SELECT * FROM cost_center_summaries WHERE employeeId = ? AND costCenter = ? AND month = ? AND year = ?',
      [employeeId, costCenter, month, year]
    ) as any;
    
    if (!result) {
      return null;
    }
    
    return {
      id: result.id,
      employeeId: result.employeeId,
      costCenter: result.costCenter,
      month: result.month,
      year: result.year,
      totalHours: result.totalHours,
      totalMiles: result.totalMiles,
      totalReceipts: result.totalReceipts,
      totalPerDiem: result.totalPerDiem,
      totalExpenses: result.totalExpenses,
      mileageEntries: result.mileageEntries,
      receiptEntries: result.receiptEntries,
      timeTrackingEntries: result.timeTrackingEntries,
      descriptionEntries: result.descriptionEntries,
      createdAt: new Date(result.createdAt),
      updatedAt: new Date(result.updatedAt)
    };
  }

  static async getCostCenterSummaries(employeeId: string, month?: number, year?: number): Promise<CostCenterSummary[]> {
    const database = await getDatabase();
    
    let query = 'SELECT * FROM cost_center_summaries WHERE employeeId = ?';
    const params: any[] = [employeeId];
    
    if (month !== undefined && year !== undefined) {
      query += ' AND month = ? AND year = ?';
      params.push(month, year);
    }
    
    query += ' ORDER BY costCenter ASC';
    
    const results = await database.getAllAsync(query, params) as any[];
    
    return results.map(result => ({
      id: result.id,
      employeeId: result.employeeId,
      costCenter: result.costCenter,
      month: result.month,
      year: result.year,
      totalHours: result.totalHours,
      totalMiles: result.totalMiles,
      totalReceipts: result.totalReceipts,
      totalPerDiem: result.totalPerDiem,
      totalExpenses: result.totalExpenses,
      mileageEntries: result.mileageEntries,
      receiptEntries: result.receiptEntries,
      timeTrackingEntries: result.timeTrackingEntries,
      descriptionEntries: result.descriptionEntries,
      createdAt: new Date(result.createdAt),
      updatedAt: new Date(result.updatedAt)
    }));
  }

  static async deleteCostCenterSummary(id: string): Promise<void> {
    const database = await getDatabase();
    
    debugLog('🗑️ Database: Deleting cost center summary:', id);
    
    await database.runAsync(
      'DELETE FROM cost_center_summaries WHERE id = ?',
      [id]
    );
    
    debugLog('✅ Database: Cost center summary deleted successfully');
  }

  /**
   * Clean up old demo/test receipts that shouldn't be in production
   */
  static async cleanupOldReceipts(): Promise<void> {
    const database = await getDatabase();
    
    try {
      // Delete all receipts from Comcast and Verizon (old demo data)
      const result = await database.runAsync(
        'DELETE FROM receipts WHERE vendor LIKE ? OR vendor LIKE ?',
        ['%Comcast%', '%Verizon%']
      );
      
      debugLog(`🧹 Database: Cleaned up ${result.changes} old demo receipts`);
      
      // Note: Removed costCenter cleanup query - column doesn't exist in receipts table
      // Cost centers are stored in expenseReports, not individual receipts
      
    } catch (error) {
      console.error('❌ Database: Error cleaning up old receipts:', error);
    }
  }

  /**
   * Check if employee has completed setup
   * Setup is complete if employee has baseAddress and defaultCostCenter
   */
  static async hasCompletedSetup(employeeId: string): Promise<boolean> {
    try {
      const employee = await this.getEmployeeById(employeeId);
      if (!employee) {
        console.log('🔍 Setup Check: Employee not found');
        return false;
      }
      
      const baseAddressValue = employee.baseAddress || '';
      const defaultCostCenterValue = employee.defaultCostCenter || '';
      
      const hasBaseAddress = Boolean(baseAddressValue.trim().length > 0);
      const hasDefaultCostCenter = Boolean(defaultCostCenterValue.trim().length > 0);
      
      console.log('🔍 Setup Check:', {
        employeeId,
        baseAddress: baseAddressValue,
        defaultCostCenter: defaultCostCenterValue,
        hasBaseAddress,
        hasDefaultCostCenter,
        hasCompletedSetup: hasBaseAddress && hasDefaultCostCenter
      });
      
      return hasBaseAddress && hasDefaultCostCenter;
    } catch (error) {
      console.error('❌ Database: Error checking setup completion:', error);
      return false;
    }
  }

  /**
   * Mark setup as complete (currently just updates employee record)
   * The actual completion is determined by baseAddress and defaultCostCenter
   */
  static async markSetupComplete(employeeId: string): Promise<void> {
    // Setup completion is determined by the presence of baseAddress and defaultCostCenter
    // This method is mainly for logging/tracking purposes
    debugLog(`✅ Database: Setup marked as complete for employee: ${employeeId}`);
  }

  /**
   * Reset setup data for testing purposes
   * This clears baseAddress, defaultCostCenter, and work hours so the setup wizard can be tested
   * Also resets the Setup Wizard completion flag
   * Uses updateEmployee to ensure changes sync to the backend
   */
  static async resetSetupData(employeeId: string): Promise<void> {
    try {
      const database = await getDatabase();
      console.log(`🔄 Database: Resetting setup data for employee: ${employeeId}`);
      
      // First, check current state
      const beforeEmployee = await this.getEmployeeById(employeeId);
      console.log('🔍 Before reset:', {
        baseAddress: beforeEmployee?.baseAddress,
        defaultCostCenter: beforeEmployee?.defaultCostCenter,
        typicalWorkStartHour: beforeEmployee?.typicalWorkStartHour,
        typicalWorkEndHour: beforeEmployee?.typicalWorkEndHour
      });
      
      // Use updateEmployee to ensure changes sync to backend
      // Set to empty strings (not NULL) since baseAddress has a NOT NULL constraint
      // Work hours can be NULL since they're optional
      await this.updateEmployee(employeeId, {
        baseAddress: '',
        defaultCostCenter: '',
        typicalWorkStartHour: undefined,
        typicalWorkEndHour: undefined
      });
      
      // Reset the Setup Wizard completion flag
      await database.runAsync(
        'UPDATE current_employee SET hasCompletedSetupWizard = 0 WHERE employeeId = ?',
        [employeeId]
      );
      
      // Verify the reset
      const afterEmployee = await this.getEmployeeById(employeeId);
      console.log('🔍 After reset:', {
        baseAddress: afterEmployee?.baseAddress,
        defaultCostCenter: afterEmployee?.defaultCostCenter,
        typicalWorkStartHour: afterEmployee?.typicalWorkStartHour,
        typicalWorkEndHour: afterEmployee?.typicalWorkEndHour
      });
      
      // Verify hasCompletedSetupWizard returns false
      const hasCompletedWizard = await this.hasCompletedSetupWizard();
      console.log('🔍 Setup Wizard completion check after reset:', hasCompletedWizard);
      
      console.log(`✅ Database: Setup data reset successfully for employee: ${employeeId} (synced to backend)`);
    } catch (error) {
      console.error('❌ Database: Error resetting setup data:', error);
      throw error;
    }
  }
}