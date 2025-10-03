import * as SQLite from 'expo-sqlite';
import { Platform } from 'react-native';
import { Employee, OxfordHouse, MileageEntry, MonthlyReport, Receipt, DailyOdometerReading, SavedAddress, TimeTracking } from '../types';
import { MileageAnalysisService } from './mileageAnalysisService';
import { ApiSyncService } from './apiSyncService';
import { SyncIntegrationService } from './syncIntegrationService';

let db: SQLite.SQLiteDatabase | null = null;

const getDatabase = async (): Promise<SQLite.SQLiteDatabase> => {
  if (!db) {
    try {
      // Use different database names for web vs native to avoid conflicts
      const dbName = Platform.OS === 'web' ? 'oxford_tracker_web.db' : 'oxford_tracker.db';
      db = await SQLite.openDatabaseAsync(dbName);
      console.log(`📱 Database: Opened ${Platform.OS} database: ${dbName}`);
    } catch (error) {
      console.error('❌ Database: Failed to open database:', error);
      throw error;
    }
  }
  return db;
};

export class DatabaseService {
  private static isInitialized = false;

  private static async syncToApi(operation: string, data: any) {
    try {
      // Increment pending changes counter
      ApiSyncService.incrementPendingChanges();
      
      // Queue the sync operation for batch processing
      const entityType = operation.replace('add', '').toLowerCase();
      SyncIntegrationService.queueSyncOperation('create', entityType as any, data);
      
      console.log(`🔄 Database: Queued ${operation} for sync:`, data.id || data);
      
    } catch (error) {
      console.error(`❌ Database: Error queuing ${operation} for sync:`, error);
    }
  }
  
  static async initDatabase(): Promise<void> {
    if (this.isInitialized) {
      console.log('Database already initialized, skipping...');
      return;
    }
    
    try {
      // For web platform, add a small delay to allow WASM to load
      if (Platform.OS === 'web') {
        console.log('🌐 Database: Web platform detected, waiting for WASM initialization...');
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      const database = await getDatabase();
      
      // Initialize database schema (only create tables if they don't exist)
      console.log('Initializing database schema...');
      
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
          approvedAt TEXT,
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
          endOdometerReading REAL,
          notes TEXT,
          createdAt TEXT NOT NULL,
          updatedAt TEXT NOT NULL
        );
      `);

      // Add endOdometerReading column if it doesn't exist (migration)
      try {
        console.log('🔄 Database: Checking for endOdometerReading column...');
        const result = await database.getFirstAsync(`
          PRAGMA table_info(daily_odometer_readings);
        `);
        
        // Check if endOdometerReading column exists
        const columns = await database.getAllAsync(`
          PRAGMA table_info(daily_odometer_readings);
        `);
        
        const hasEndOdometerColumn = columns.some((col: any) => col.name === 'endOdometerReading');
        
        if (!hasEndOdometerColumn) {
          console.log('🔄 Database: Adding endOdometerReading column...');
          await database.execAsync(`
            ALTER TABLE daily_odometer_readings ADD COLUMN endOdometerReading REAL;
          `);
          console.log('✅ Database: Added endOdometerReading column to daily_odometer_readings table');
        } else {
          console.log('ℹ️ Database: endOdometerReading column already exists');
        }
      } catch (error) {
        console.error('❌ Database: Error during migration:', error);
        // Try alternative approach - recreate table
        try {
          console.log('🔄 Database: Attempting to recreate table with new schema...');
          await database.execAsync(`
            CREATE TABLE IF NOT EXISTS daily_odometer_readings_new (
              id TEXT PRIMARY KEY,
              employeeId TEXT NOT NULL,
              date TEXT NOT NULL,
              odometerReading REAL NOT NULL,
              endOdometerReading REAL,
              notes TEXT,
              createdAt TEXT NOT NULL,
              updatedAt TEXT NOT NULL
            );
          `);
          
          // Copy data from old table
          await database.execAsync(`
            INSERT INTO daily_odometer_readings_new 
            SELECT id, employeeId, date, odometerReading, NULL as endOdometerReading, notes, createdAt, updatedAt 
            FROM daily_odometer_readings;
          `);
          
          // Drop old table and rename new one
          await database.execAsync(`DROP TABLE daily_odometer_readings;`);
          await database.execAsync(`ALTER TABLE daily_odometer_readings_new RENAME TO daily_odometer_readings;`);
          
          console.log('✅ Database: Successfully recreated daily_odometer_readings table with new schema');
        } catch (recreateError) {
          console.error('❌ Database: Failed to recreate table:', recreateError);
        }
      }

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

      // Create time_tracking table
      await database.execAsync(`
        CREATE TABLE IF NOT EXISTS time_tracking (
          id TEXT PRIMARY KEY,
          employeeId TEXT NOT NULL,
          date TEXT NOT NULL,
          category TEXT NOT NULL,
          hours REAL NOT NULL,
          description TEXT,
          createdAt TEXT NOT NULL,
          updatedAt TEXT NOT NULL
        );
      `);

      // Create current_employee table
      await database.execAsync(`
        CREATE TABLE IF NOT EXISTS current_employee (
          id INTEGER PRIMARY KEY,
          employeeId TEXT NOT NULL,
          lastLogin TEXT NOT NULL
        );
      `);

      // Create performance indexes
      console.log('Creating database indexes for performance...');
      
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
      
      console.log('✅ Database indexes created successfully');

      
      console.log('Database initialized successfully');
      
      // Initialize sync integration service
      try {
        await SyncIntegrationService.initialize();
        console.log('✅ Database: Sync integration service initialized');
      } catch (error) {
        console.error('❌ Database: Failed to initialize sync integration service:', error);
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
    
    if (!result) return null;
    
    const employee = await this.getEmployeeById(result.employeeId);
    return employee;
  }

  static async setCurrentEmployee(employeeId: string): Promise<void> {
    const database = await getDatabase();
    
    // Clear existing current employee and set new one
    await database.execAsync('DELETE FROM current_employee');
    await database.runAsync(
      'INSERT INTO current_employee (employeeId, lastLogin) VALUES (?, ?)',
      [employeeId, new Date().toISOString()]
    );
  }

  static async clearCurrentEmployee(): Promise<void> {
    const database = await getDatabase();
    await database.execAsync('DELETE FROM current_employee');
  }





  static async getEmployeeById(id: string): Promise<Employee | null> {
    const database = await getDatabase();
    const result = await database.getFirstAsync('SELECT * FROM employees WHERE id = ?', [id]) as any;
    
    if (!result) return null;
    
    return {
      id: result.id,
      name: result.name,
      email: result.email,
      password: result.password,
      oxfordHouseId: result.oxfordHouseId,
      position: result.position,
      phoneNumber: result.phoneNumber,
      baseAddress: result.baseAddress,
      baseAddress2: result.baseAddress2 || '',
      costCenters: result.costCenters ? JSON.parse(result.costCenters) : [],
      selectedCostCenters: result.selectedCostCenters ? JSON.parse(result.selectedCostCenters) : [],
      defaultCostCenter: result.defaultCostCenter || '',
      createdAt: new Date(result.createdAt),
      updatedAt: new Date(result.updatedAt)
    };
  }

  static async createEmployee(employee: Omit<Employee, 'id' | 'createdAt' | 'updatedAt'>): Promise<Employee> {
    const id = this.generateId();
    const now = new Date().toISOString();
    const database = await getDatabase();
    
    await database.runAsync(
      'INSERT INTO employees (id, name, email, password, oxfordHouseId, position, phoneNumber, baseAddress, costCenters, selectedCostCenters, defaultCostCenter, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [id, employee.name, employee.email, employee.password, employee.oxfordHouseId, employee.position, employee.phoneNumber || '', employee.baseAddress, JSON.stringify(employee.costCenters || []), JSON.stringify(employee.selectedCostCenters || []), employee.defaultCostCenter || '', now, now]
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
      costCenters: row.costCenters ? JSON.parse(row.costCenters) : [],
      selectedCostCenters: row.selectedCostCenters ? JSON.parse(row.selectedCostCenters) : [],
      defaultCostCenter: row.defaultCostCenter || '',
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt)
    }));
  }

  static async updateEmployee(id: string, updates: Partial<Employee>): Promise<void> {
    const now = new Date().toISOString();
    const database = await getDatabase();
    
    console.log('💾 Database: Updating employee');
    console.log('💾 Database: Employee ID:', id);
    console.log('💾 Database: Updates:', updates);
    
    // Filter out fields we don't want to update
    const fields = Object.keys(updates).filter(key => 
      key !== 'id' && 
      key !== 'createdAt' && 
      key !== 'updatedAt'
    );
    
    console.log('💾 Database: Fields to update:', fields);
    
    if (fields.length === 0) {
      console.log('💾 Database: No fields to update');
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
    
    console.log('💾 Database: SQL Query:', `UPDATE employees SET ${setClause}, updatedAt = ? WHERE id = ?`);
    console.log('💾 Database: Values:', [...values, now, id]);
    
    await database.runAsync(
      `UPDATE employees SET ${setClause}, updatedAt = ? WHERE id = ?`,
      [...values, now, id] as any[]
    );
    
    console.log('✅ Database: Employee updated successfully');
  }

  // Mileage entry operations
  static async createMileageEntry(entry: Omit<MileageEntry, 'id' | 'createdAt' | 'updatedAt'>): Promise<MileageEntry> {
    const id = this.generateId();
    const now = new Date().toISOString();
    const database = await getDatabase();
    
    console.log('💾 Creating mileage entry:', {
      id,
      employeeId: entry.employeeId,
      date: entry.date.toISOString(),
      startLocation: entry.startLocation,
      endLocation: entry.endLocation,
      purpose: entry.purpose,
      miles: entry.miles,
      odometerReading: entry.odometerReading
    });
    
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
        entry.date.toISOString(), 
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
    
    console.log('✅ Mileage entry created successfully with ID:', id);

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

    // Update end odometer reading for the day
    try {
      await this.updateEndOdometerReading(entry.employeeId, entry.date);
    } catch (error) {
      console.error('❌ Database: Error updating end odometer reading:', error);
    }

    return newEntry;
  }

  static async getRecentMileageEntries(employeeId: string, limit: number = 5): Promise<MileageEntry[]> {
    const database = await getDatabase();
    const query = 'SELECT * FROM mileage_entries WHERE employeeId = ? ORDER BY date DESC LIMIT ?';
    
    const result = await database.getAllAsync(query, [employeeId, limit]);
    
    return result.map((row: any) => ({
      ...row,
      date: new Date(row.date),
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

    console.log('🔍 Database Query:', query);
    console.log('🔍 Query Params:', params);
    
    const result = await database.getAllAsync(query, params);
    console.log('🔍 Raw Database Result:', result);
    
    return result.map((row: any) => ({
      ...row,
      date: new Date(row.date),
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
    const fields = Object.keys(updates).filter(key => key !== 'id' && key !== 'createdAt');
    const setClause = fields.map(field => `${field} = ?`).join(', ');
    const values = fields.map(field => {
      const value = updates[field as keyof MileageEntry];
      if (value instanceof Date) return value.toISOString();
      return value;
    });
    
    await database.runAsync(
      `UPDATE mileage_entries SET ${setClause}, updatedAt = ? WHERE id = ?`,
      [...values, now, id] as any[]
    );
  }

  static async deleteMileageEntry(id: string): Promise<void> {
    const database = await getDatabase();
    await database.runAsync('DELETE FROM mileage_entries WHERE id = ?', [id]);
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

  static async updateMonthlyReport(id: string, updates: Partial<MonthlyReport>): Promise<void> {
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
      const value = updates[field as keyof MonthlyReport];
      return value instanceof Date ? value.toISOString() : value;
    });
    
    await database.runAsync(
      `UPDATE monthly_reports SET ${setClause}, updatedAt = ? WHERE id = ?`,
      [...values, now, id] as any[]
    );
  }

  // Receipt operations
  static async createReceipt(receipt: Omit<Receipt, 'id' | 'createdAt' | 'updatedAt'>): Promise<Receipt> {
    const id = this.generateId();
    const now = new Date().toISOString();
    const database = await getDatabase();
    
    await database.runAsync(
      'INSERT INTO receipts (id, employeeId, date, amount, vendor, description, category, imageUri, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [id, receipt.employeeId, receipt.date.toISOString(), receipt.amount, receipt.vendor, receipt.description || '', receipt.category, receipt.imageUri, now, now]
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

    console.log('📊 Database: Getting dashboard stats for employee:', employeeId, 'month:', month, 'year:', year);

    try {
      // Get recent entries and receipts in parallel
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
        createdAt: new Date(row.createdAt),
        updatedAt: new Date(row.updatedAt)
      }));

      // Calculate totals
      const totalMiles = processedMileageEntries.reduce((sum, entry) => sum + entry.miles, 0);
      
      // Calculate total hours from time tracking (preferred) or mileage entries (fallback)
      const totalTimeTrackingHours: number = monthlyTimeTracking.reduce((sum: number, entry: any) => sum + (entry.hours || 0), 0);
      const totalMileageHours = processedMileageEntries.reduce((sum, entry) => sum + (entry.hoursWorked || 0), 0);
      const totalHours: number = totalTimeTrackingHours > 0 ? totalTimeTrackingHours : totalMileageHours;
      
      const totalReceipts = processedReceipts.reduce((sum, receipt) => sum + receipt.amount, 0);

      console.log('📊 Database: Dashboard stats calculated:', {
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
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt)
    }));
  }

  static async updateReceipt(id: string, receipt: Partial<Receipt>): Promise<void> {
    const database = await getDatabase();
    const now = new Date().toISOString();
    
    const fields = [];
    const values = [];
    
    if (receipt.amount !== undefined) {
      fields.push('amount = ?');
      values.push(receipt.amount);
    }
    if (receipt.vendor !== undefined) {
      fields.push('vendor = ?');
      values.push(receipt.vendor);
    }
    if (receipt.category !== undefined) {
      fields.push('category = ?');
      values.push(receipt.category);
    }
    if (receipt.description !== undefined) {
      fields.push('description = ?');
      values.push(receipt.description);
    }
    if (receipt.imageUri !== undefined) {
      fields.push('imageUri = ?');
      values.push(receipt.imageUri);
    }
    
    fields.push('updatedAt = ?');
    values.push(now);
    values.push(id);
    
    await database.runAsync(
      `UPDATE receipts SET ${fields.join(', ')} WHERE id = ?`,
      values
    );
  }

  static async deleteReceipt(id: string): Promise<void> {
    const database = await getDatabase();
    await database.runAsync('DELETE FROM receipts WHERE id = ?', [id]);
  }

  // Daily Odometer Reading methods
  static async createDailyOdometerReading(reading: Omit<DailyOdometerReading, 'id' | 'createdAt' | 'updatedAt'>): Promise<DailyOdometerReading> {
    const id = this.generateId();
    const now = new Date().toISOString();
    const database = await getDatabase();
    
    console.log('💾 Database: Creating daily odometer reading');
    console.log('💾 Database: Employee ID:', reading.employeeId);
    console.log('💾 Database: Date:', reading.date.toISOString());
    console.log('💾 Database: Odometer Reading:', reading.odometerReading);
    
    // Calculate end odometer reading by adding total miles for the day
    const totalMilesForDay = await this.getTotalMilesForDay(reading.employeeId, reading.date);
    const endOdometerReading = reading.odometerReading + totalMilesForDay;
    
    await database.runAsync(
      'INSERT INTO daily_odometer_readings (id, employeeId, date, odometerReading, endOdometerReading, notes, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [
        id, 
        reading.employeeId, 
        reading.date.toISOString(), 
        reading.odometerReading,
        endOdometerReading,
        reading.notes || '', 
        now, 
        now
      ]
    );

    console.log('✅ Database: Daily odometer reading created successfully with ID:', id);

    const newReading = {
      id,
      ...reading,
      endOdometerReading: endOdometerReading,
      notes: reading.notes,
      createdAt: new Date(now),
      updatedAt: new Date(now)
    };

    // Sync to API service
    await this.syncToApi('addDailyOdometerReading', newReading);

    return newReading;
  }

  static async getDailyOdometerReading(employeeId: string, date: Date): Promise<DailyOdometerReading | null> {
    const database = await getDatabase();
    const dateStr = date.toISOString().split('T')[0]; // Get YYYY-MM-DD format
    
    console.log('🔍 Database: Looking for odometer reading');
    console.log('🔍 Database: Employee ID:', employeeId);
    console.log('🔍 Database: Date string:', dateStr);
    
    const result = await database.getFirstAsync(
      'SELECT * FROM daily_odometer_readings WHERE employeeId = ? AND date = ?',
      [employeeId, dateStr]
    ) as any;

    console.log('🔍 Database: Query result:', result);

    if (!result) {
      console.log('🔍 Database: No reading found for this date');
      return null;
    }

    console.log('🔍 Database: Reading found:', result);
    return {
      id: result.id,
      employeeId: result.employeeId,
      date: new Date(result.date),
      odometerReading: result.odometerReading,
      endOdometerReading: result.endOdometerReading,
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
      endOdometerReading: row.endOdometerReading,
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
  private static async updateEndOdometerReading(employeeId: string, date: Date): Promise<void> {
    const database = await getDatabase();
    const dateStr = date.toISOString().split('T')[0];
    
    // Get the daily odometer reading for this day
    const dailyReading = await database.getFirstAsync(
      'SELECT * FROM daily_odometer_readings WHERE employeeId = ? AND date(date) = date(?)',
      [employeeId, dateStr]
    ) as any;
    
    if (dailyReading) {
      // Calculate new end reading
      const totalMiles = await this.getTotalMilesForDay(employeeId, date);
      const endOdometerReading = dailyReading.odometerReading + totalMiles;
      
      // Update the end reading
      await database.runAsync(
        'UPDATE daily_odometer_readings SET endOdometerReading = ?, updatedAt = ? WHERE id = ?',
        [endOdometerReading, new Date().toISOString(), dailyReading.id]
      );
      
      console.log(`📊 Updated end odometer reading for ${dateStr}: ${dailyReading.odometerReading} + ${totalMiles} = ${endOdometerReading}`);
    }
  }

  private static generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  // Time Tracking Methods
  static async createTimeTracking(tracking: Omit<TimeTracking, 'id' | 'createdAt' | 'updatedAt'>): Promise<TimeTracking> {
    const id = this.generateId();
    const now = new Date().toISOString();
    const database = await getDatabase();
    
    console.log('💾 Database: Creating time tracking entry');
    console.log('💾 Database: Employee ID:', tracking.employeeId);
    console.log('💾 Database: Date:', tracking.date.toISOString());
    console.log('💾 Database: Category:', tracking.category);
    console.log('💾 Database: Hours:', tracking.hours);
    
    await database.runAsync(
      'INSERT INTO time_tracking (id, employeeId, date, category, hours, description, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [
        id, 
        tracking.employeeId, 
        tracking.date.toISOString(), 
        tracking.category,
        tracking.hours,
        tracking.description || '', 
        now, 
        now
      ]
    );

    console.log('✅ Database: Time tracking entry created successfully with ID:', id);

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
      console.error('❌ Database: Error syncing time tracking to API:', error);
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
    await database.runAsync('DELETE FROM time_tracking WHERE id = ?', [id]);
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
      { column: 'defaultCostCenter', type: 'TEXT DEFAULT \'\'' }
    ];

    for (const migration of employeeMigrations) {
      try {
        await database.execAsync(`
          ALTER TABLE employees ADD COLUMN ${migration.column} ${migration.type};
        `);
        console.log(`✅ Added column ${migration.column} to employees table`);
      } catch (error) {
        // Column already exists, ignore error
        console.log(`ℹ️ Column ${migration.column} already exists in employees table`);
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
        console.log(`✅ Added column ${migration.column} to mileage_entries table`);
      } catch (error) {
        // Column already exists, ignore error
        console.log(`ℹ️ Column ${migration.column} already exists in mileage_entries table`);
      }
    }
  }

}