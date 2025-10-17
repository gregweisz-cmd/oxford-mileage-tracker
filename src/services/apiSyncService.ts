import { Platform } from 'react-native';
import { Employee, MileageEntry, Receipt, DailyOdometerReading, SavedAddress, TimeTracking, DailyDescription } from '../types';
import { DatabaseService } from './database';

// API Configuration
// Use local backend for testing, cloud backend for production
// For mobile devices, use the computer's local IP address instead of localhost
const API_BASE_URL = __DEV__ 
  ? 'http://192.168.86.101:3002/api' 
  : 'https://oxford-mileage-backend.onrender.com/api';

export interface ApiSyncConfig {
  baseUrl: string;
  timeout: number;
  retryAttempts: number;
}

export interface SyncResult {
  success: boolean;
  data?: any;
  error?: string;
  timestamp: Date;
}

export interface SyncStatus {
  isConnected: boolean;
  lastSyncTime: Date | null;
  totalEmployees: number;
  totalMileageEntries: number;
  totalReceipts: number;
  totalTimeTracking: number;
  pendingChanges: number;
}

export class ApiSyncService {
  private static config: ApiSyncConfig = {
    baseUrl: API_BASE_URL,
    timeout: 10000, // 10 seconds
    retryAttempts: 3
  };

  private static lastSyncTime: Date | null = null;
  private static pendingChanges: number = 0;

  /**
   * Parse date safely - treats YYYY-MM-DD as local date
   */
  private static parseDateSafe(dateStr: string | Date): Date {
    if (dateStr instanceof Date) {
      return dateStr;
    }
    
    // Check if it's YYYY-MM-DD format (date-only, no time)
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      const [year, month, day] = dateStr.split('-').map(Number);
      // Create date at noon local time to avoid timezone issues
      return new Date(year, month - 1, day, 12, 0, 0);
    }
    
    // For datetime strings, parse normally
    return new Date(dateStr);
  }

  /**
   * Initialize the API sync service
   */
  static async initialize(): Promise<void> {
    try {
      console.log('🔄 ApiSync: Initializing API sync service...');
      
      // Test connection to backend
      const isConnected = await this.testConnection();
      if (isConnected) {
        console.log('✅ ApiSync: Connected to backend API');
      } else {
        console.log('⚠️ ApiSync: Backend API not available');
      }
      
      // Load last sync time from storage
      this.lastSyncTime = await this.getLastSyncTime();
      
      console.log('🔄 ApiSync: Initialization completed');
    } catch (error) {
      console.error('❌ ApiSync: Initialization failed:', error);
    }
  }

  /**
   * Test connection to the backend API
   */
  static async testConnection(): Promise<boolean> {
    try {
      console.log('🔄 ApiSync: Testing connection to cloud backend...');
      
      const response = await fetch(`${this.config.baseUrl}/health`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      if (response.ok) {
        console.log('✅ ApiSync: Successfully connected to cloud backend');
        return true;
      } else {
        console.log('⚠️ ApiSync: Cloud backend responded with status:', response.status);
        return false;
      }
    } catch (error) {
      console.error('❌ ApiSync: Connection test failed:', error);
      return false;
    }
  }

  /**
   * Sync all data from mobile to backend
   */
  static async syncToBackend(data: {
    employees?: Employee[];
    mileageEntries?: MileageEntry[];
    receipts?: Receipt[];
    timeTracking?: TimeTracking[];
  }): Promise<SyncResult> {
    try {
      console.log('📤 ApiSync: Syncing data to backend...');
      
      const results: SyncResult[] = [];
      
      // Sync employees
      if (data.employees && data.employees.length > 0) {
        const employeeResult = await this.syncEmployees(data.employees);
        results.push(employeeResult);
      }
      
      // Sync mileage entries
      if (data.mileageEntries && data.mileageEntries.length > 0) {
        const mileageResult = await this.syncMileageEntries(data.mileageEntries);
        results.push(mileageResult);
      }
      
      // Sync receipts
      if (data.receipts && data.receipts.length > 0) {
        const receiptResult = await this.syncReceipts(data.receipts);
        results.push(receiptResult);
      }
      
      // Sync time tracking
      if (data.timeTracking && data.timeTracking.length > 0) {
        const timeResult = await this.syncTimeTracking(data.timeTracking);
        results.push(timeResult);
      }
      
      // Check if all syncs were successful
      const allSuccessful = results.every(result => result.success);
      
      if (allSuccessful) {
        this.lastSyncTime = new Date();
        this.pendingChanges = 0;
        await this.saveLastSyncTime(this.lastSyncTime);
      }
      
      console.log('📤 ApiSync: Backend sync completed:', {
        successful: allSuccessful,
        results: results.length
      });
      
      return {
        success: allSuccessful,
        data: results,
        timestamp: new Date()
      };
      
    } catch (error) {
      console.error('❌ ApiSync: Error syncing to backend:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date()
      };
    }
  }

  /**
   * Sync data from backend to mobile
   */
  static async syncFromBackend(employeeId?: string): Promise<SyncResult> {
    try {
      console.log('📥 ApiSync: Syncing data from backend...');
      
      const syncData: any = {};
      
      // Fetch employees
      const employees = await this.fetchEmployees();
      syncData.employees = employees;
      
      // Fetch mileage entries
      const mileageEntries = await this.fetchMileageEntries(employeeId);
      syncData.mileageEntries = mileageEntries;
      
      // Fetch receipts
      const receipts = await this.fetchReceipts(employeeId);
      syncData.receipts = receipts;
      
      // Fetch time tracking
      const timeTracking = await this.fetchTimeTracking(employeeId);
      syncData.timeTracking = timeTracking;
      
      // Fetch daily descriptions
      const dailyDescriptions = await this.fetchDailyDescriptions(employeeId);
      syncData.dailyDescriptions = dailyDescriptions;
      
      // Fetch Per Diem rules
      const perDiemRules = await this.fetchPerDiemRules();
      syncData.perDiemRules = perDiemRules;
      
      // Sync all data to local database
      if (mileageEntries.length > 0) {
        await this.syncMileageEntriesToLocal(mileageEntries);
      }
      if (receipts.length > 0) {
        await this.syncReceiptsToLocal(receipts);
      }
      if (timeTracking.length > 0) {
        await this.syncTimeTrackingToLocal(timeTracking);
      }
      if (dailyDescriptions.length > 0) {
        await this.syncDailyDescriptionsToLocal(dailyDescriptions);
      }
      if (perDiemRules.length > 0) {
        await this.syncPerDiemRulesToLocal(perDiemRules);
      }
      
      this.lastSyncTime = new Date();
      await this.saveLastSyncTime(this.lastSyncTime);
      
      console.log('📥 ApiSync: Backend sync completed:', {
        employees: employees.length,
        mileageEntries: mileageEntries.length,
        receipts: receipts.length,
        timeTracking: timeTracking.length,
        dailyDescriptions: dailyDescriptions.length,
        perDiemRules: perDiemRules.length
      });
      
      return {
        success: true,
        data: syncData,
        timestamp: new Date()
      };
      
    } catch (error) {
      console.error('❌ ApiSync: Error syncing from backend:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date()
      };
    }
  }

  /**
   * Sync employees to backend
   */
  private static async syncEmployees(employees: Employee[]): Promise<SyncResult> {
    try {
      const results = [];
      
      for (const employee of employees) {
        try {
          // Check if employee exists
          const existingEmployee = await this.fetchEmployee(employee.id);
          
          if (existingEmployee) {
            // Update existing employee
            const response = await fetch(`${this.config.baseUrl}/employees/${employee.id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                name: employee.name,
                email: employee.email,
                oxfordHouseId: employee.oxfordHouseId,
                position: employee.position,
                phoneNumber: employee.phoneNumber,
                baseAddress: employee.baseAddress,
                baseAddress2: employee.baseAddress2,
                costCenters: employee.costCenters
              })
            });
            
            if (!response.ok) {
              throw new Error(`Failed to update employee: ${response.statusText}`);
            }
          } else {
            // Create new employee
            const response = await fetch(`${this.config.baseUrl}/employees`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                name: employee.name,
                email: employee.email,
                oxfordHouseId: employee.oxfordHouseId,
                position: employee.position,
                phoneNumber: employee.phoneNumber,
                baseAddress: employee.baseAddress,
                baseAddress2: employee.baseAddress2,
                costCenters: employee.costCenters
              })
            });
            
            if (!response.ok) {
              throw new Error(`Failed to create employee: ${response.statusText}`);
            }
          }
          
          results.push({ success: true, id: employee.id });
        } catch (error) {
          console.error(`❌ ApiSync: Error syncing employee ${employee.id}:`, error);
          results.push({ success: false, id: employee.id, error: error instanceof Error ? error.message : 'Unknown error' });
        }
      }
      
      const allSuccessful = results.every(result => result.success);
      
      return {
        success: allSuccessful,
        data: results,
        timestamp: new Date()
      };
      
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date()
      };
    }
  }

  /**
   * Sync mileage entries to backend
   */
  private static async syncMileageEntries(entries: MileageEntry[]): Promise<SyncResult> {
    try {
      const results = [];
      
      for (const entry of entries) {
        try {
          // Validate and prepare mileage entry data
          const mileageData = {
            id: entry.id, // Include ID to prevent duplicates on backend
            employeeId: entry.employeeId,
            oxfordHouseId: entry.oxfordHouseId,
            date: entry.date instanceof Date ? entry.date.toISOString() : new Date(entry.date).toISOString(),
            odometerReading: entry.odometerReading,
            startLocation: entry.startLocation || '',
            endLocation: entry.endLocation || '',
            purpose: entry.purpose || '',
            miles: entry.miles,
            notes: entry.notes || '',
            hoursWorked: entry.hoursWorked,
            isGpsTracked: entry.isGpsTracked || false
          };
          
          const response = await fetch(`${this.config.baseUrl}/mileage-entries`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(mileageData)
          });
          
          if (!response.ok) {
            const errorText = await response.text();
            console.error(`❌ ApiSync: Failed to sync mileage entry ${entry.id}:`, response.status, errorText);
            throw new Error(`Failed to sync mileage entry: ${response.statusText}`);
          }
          
          results.push({ success: true, id: entry.id });
        } catch (error) {
          console.error(`❌ ApiSync: Error syncing mileage entry ${entry.id}:`, error);
          results.push({ success: false, id: entry.id, error: error instanceof Error ? error.message : 'Unknown error' });
        }
      }
      
      const allSuccessful = results.every(result => result.success);
      
      return {
        success: allSuccessful,
        data: results,
        timestamp: new Date()
      };
      
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date()
      };
    }
  }

  /**
   * Sync receipts to backend
   */
  private static async syncReceipts(receipts: Receipt[]): Promise<SyncResult> {
    try {
      const results = [];
      
      for (const receipt of receipts) {
        // Validate and prepare receipt data
        const receiptData = {
          id: receipt.id, // Include ID to prevent duplicates on backend
          employeeId: receipt.employeeId,
          date: receipt.date instanceof Date ? receipt.date.toISOString() : new Date(receipt.date).toISOString(),
          amount: receipt.amount,
          vendor: receipt.vendor || '',
          description: receipt.description || '',
          category: receipt.category || '',
          imageUri: receipt.imageUri || ''
        };
        
        try {
          const response = await fetch(`${this.config.baseUrl}/receipts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(receiptData)
          });
          
          if (!response.ok) {
            const errorText = await response.text();
            console.error(`❌ ApiSync: Receipt sync failed ${receipt.id}:`, response.status, errorText);
            throw new Error(`Failed to sync receipt: ${response.status} ${response.statusText}`);
          }
          
          results.push({ success: true, id: receipt.id });
        } catch (error) {
          console.error(`❌ ApiSync: Error syncing receipt ${receipt.id}:`, error instanceof Error ? error.message : 'Unknown error');
          results.push({ success: false, id: receipt.id, error: error instanceof Error ? error.message : 'Unknown error' });
        }
      }
      
      const allSuccessful = results.every(result => result.success);
      
      return {
        success: allSuccessful,
        data: results,
        timestamp: new Date()
      };
      
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date()
      };
    }
  }

  /**
   * Sync time tracking to backend
   */
  private static async syncTimeTracking(entries: TimeTracking[]): Promise<SyncResult> {
    try {
      const results = [];
      
      for (const entry of entries) {
        try {
          // Validate and prepare time tracking data
          const timeTrackingData = {
            id: entry.id, // Include ID to prevent duplicates on backend
            employeeId: entry.employeeId,
            date: entry.date instanceof Date ? entry.date.toISOString() : new Date(entry.date).toISOString(),
            category: entry.category || '',
            hours: entry.hours,
            description: entry.description || ''
          };
          
          console.log(`📤 ApiSync: Syncing time tracking ${entry.id}:`, timeTrackingData);
          
          // Validate JSON serialization
          const jsonPayload = JSON.stringify(timeTrackingData);
          console.log(`📤 ApiSync: JSON payload for time tracking ${entry.id}:`, jsonPayload);
          
          const response = await fetch(`${this.config.baseUrl}/time-tracking`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: jsonPayload
          });
          
          if (!response.ok) {
            throw new Error(`Failed to sync time tracking: ${response.statusText}`);
          }
          
          results.push({ success: true, id: entry.id });
        } catch (error) {
          console.error(`❌ ApiSync: Error syncing time tracking ${entry.id}:`, error);
          results.push({ success: false, id: entry.id, error: error instanceof Error ? error.message : 'Unknown error' });
        }
      }
      
      const allSuccessful = results.every(result => result.success);
      
      return {
        success: allSuccessful,
        data: results,
        timestamp: new Date()
      };
      
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date()
      };
    }
  }

  /**
   * Fetch employees from backend
   */
  private static async fetchEmployees(): Promise<Employee[]> {
    try {
      const url = `${this.config.baseUrl}/employees`;
      
      const response = await fetch(url);
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ ApiSync: Failed to fetch employees: HTTP ${response.status}`);
        throw new Error(`Failed to fetch employees: ${response.statusText}`);
      }
      
      const responseText = await response.text();
      const data = JSON.parse(responseText);
      
      return data.map((emp: any) => ({
        id: emp.id,
        name: emp.name,
        email: emp.email,
        password: emp.password || '',
        oxfordHouseId: emp.oxfordHouseId,
        position: emp.position,
        phoneNumber: emp.phoneNumber,
        baseAddress: emp.baseAddress,
        baseAddress2: emp.baseAddress2 || '',
        costCenters: Array.isArray(emp.costCenters) ? emp.costCenters : (emp.costCenters ? JSON.parse(emp.costCenters) : []),
        createdAt: new Date(emp.createdAt),
        updatedAt: new Date(emp.updatedAt)
      }));
    } catch (error) {
      console.error('❌ ApiSync: Error in fetchEmployees:', error);
      throw error;
    }
  }

  /**
   * Fetch single employee from backend
   */
  private static async fetchEmployee(id: string): Promise<Employee | null> {
    try {
      const response = await fetch(`${this.config.baseUrl}/employees/${id}`);
      if (response.status === 404) {
        return null;
      }
      if (!response.ok) {
        throw new Error(`Failed to fetch employee: ${response.statusText}`);
      }
      
      const emp = await response.json();
      return {
        id: emp.id,
        name: emp.name,
        email: emp.email,
        password: emp.password || '',
        oxfordHouseId: emp.oxfordHouseId,
        position: emp.position,
        phoneNumber: emp.phoneNumber,
        baseAddress: emp.baseAddress,
        baseAddress2: emp.baseAddress2 || '',
        costCenters: Array.isArray(emp.costCenters) ? emp.costCenters : (emp.costCenters ? JSON.parse(emp.costCenters) : []),
        selectedCostCenters: Array.isArray(emp.selectedCostCenters) ? emp.selectedCostCenters : (emp.selectedCostCenters ? JSON.parse(emp.selectedCostCenters) : []),
        defaultCostCenter: emp.defaultCostCenter || '',
        createdAt: new Date(emp.createdAt),
        updatedAt: new Date(emp.updatedAt)
      };
    } catch (error) {
      console.error('❌ ApiSync: Error fetching employee:', error);
      return null;
    }
  }

  /**
   * Fetch mileage entries from backend
   */
  private static async fetchMileageEntries(employeeId?: string): Promise<MileageEntry[]> {
    try {
      const url = employeeId 
        ? `${this.config.baseUrl}/mileage-entries?employeeId=${employeeId}`
        : `${this.config.baseUrl}/mileage-entries`;
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch mileage entries: ${response.statusText}`);
      }
      
      const responseText = await response.text();
      const data = JSON.parse(responseText);
      
      return data.map((entry: any) => ({
        id: entry.id,
        employeeId: entry.employeeId,
        oxfordHouseId: entry.oxfordHouseId,
        date: this.parseDateSafe(entry.date),
        odometerReading: entry.odometerReading,
        startLocation: entry.startLocation,
        endLocation: entry.endLocation,
        purpose: entry.purpose,
        miles: entry.miles,
        notes: entry.notes,
        hoursWorked: entry.hoursWorked || 0,
        isGpsTracked: Boolean(entry.isGpsTracked),
        costCenter: entry.costCenter || '',
        createdAt: new Date(entry.createdAt),
        updatedAt: new Date(entry.updatedAt)
      }));
    } catch (error) {
      console.error('❌ ApiSync: Error in fetchMileageEntries:', error);
      throw error; // Re-throw so caller knows it failed
    }
  }

  /**
   * Fetch receipts from backend
   */
  private static async fetchReceipts(employeeId?: string): Promise<Receipt[]> {
    const url = employeeId 
      ? `${this.config.baseUrl}/receipts?employeeId=${employeeId}`
      : `${this.config.baseUrl}/receipts`;
      
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch receipts: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.map((receipt: any) => ({
      id: receipt.id,
      employeeId: receipt.employeeId,
      date: new Date(receipt.date),
      amount: receipt.amount,
      vendor: receipt.vendor,
      description: receipt.description,
      category: receipt.category,
      imageUri: receipt.imageUri || '',
      createdAt: new Date(receipt.createdAt),
      updatedAt: new Date(receipt.updatedAt)
    }));
  }

  /**
   * Fetch time tracking from backend
   */
  private static async fetchTimeTracking(employeeId?: string): Promise<TimeTracking[]> {
    const url = employeeId 
      ? `${this.config.baseUrl}/time-tracking?employeeId=${employeeId}`
      : `${this.config.baseUrl}/time-tracking`;
      
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch time tracking: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.map((entry: any) => ({
      id: entry.id,
      employeeId: entry.employeeId,
      date: new Date(entry.date),
      category: entry.category,
      hours: entry.hours,
      description: entry.description,
      createdAt: new Date(entry.createdAt),
      updatedAt: new Date(entry.updatedAt)
    }));
  }

  /**
   * Fetch daily descriptions from backend
   */
  private static async fetchDailyDescriptions(employeeId?: string): Promise<DailyDescription[]> {
    const url = employeeId 
      ? `${this.config.baseUrl}/daily-descriptions?employeeId=${employeeId}`
      : `${this.config.baseUrl}/daily-descriptions`;
      
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch daily descriptions: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.map((desc: any) => ({
      id: desc.id,
      employeeId: desc.employeeId,
      date: new Date(desc.date),
      description: desc.description,
      costCenter: desc.costCenter,
      createdAt: new Date(desc.createdAt),
      updatedAt: new Date(desc.updatedAt)
    }));
  }

  /**
   * Fetch Per Diem rules from backend
   */
  private static async fetchPerDiemRules(): Promise<any[]> {
    const response = await fetch(`${this.config.baseUrl}/per-diem-rules`);
    if (!response.ok) {
      throw new Error(`Failed to fetch per diem rules: ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log(`📋 ApiSync: Fetched ${data.length} Per Diem rules from backend`);
    return data.map((rule: any) => ({
      id: rule.id,
      costCenter: rule.costCenter,
      maxAmount: rule.maxAmount,
      minHours: rule.minHours,
      minMiles: rule.minMiles,
      minDistanceFromBase: rule.minDistanceFromBase,
      description: rule.description,
      useActualAmount: Boolean(rule.useActualAmount),
      createdAt: rule.createdAt,
      updatedAt: rule.updatedAt
    }));
  }

  /**
   * Sync Per Diem rules from backend to local database
   */
  private static async syncPerDiemRulesToLocal(perDiemRules: any[]): Promise<void> {
    try {
      console.log(`📥 ApiSync: Syncing ${perDiemRules.length} Per Diem rules to local database...`);
      
      const { getDatabaseConnection } = await import('../utils/databaseConnection');
      const database = await getDatabaseConnection();

      // Clear existing rules
      await database.runAsync('DELETE FROM per_diem_rules');

      // Insert new rules
      for (const rule of perDiemRules) {
        await database.runAsync(
          `INSERT INTO per_diem_rules (
            id, costCenter, maxAmount, minHours, minMiles, minDistanceFromBase,
            description, useActualAmount, createdAt, updatedAt
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            rule.id,
            rule.costCenter,
            rule.maxAmount,
            rule.minHours,
            rule.minMiles,
            rule.minDistanceFromBase,
            rule.description,
            rule.useActualAmount ? 1 : 0,
            rule.createdAt,
            rule.updatedAt
          ]
        );
      }

      console.log(`✅ ApiSync: Stored ${perDiemRules.length} Per Diem rules locally`);
    } catch (error) {
      console.error('❌ ApiSync: Error syncing Per Diem rules to local database:', error);
    }
  }

  /**
   * Sync daily descriptions from backend to local database
   */
  private static async syncDailyDescriptionsToLocal(dailyDescriptions: DailyDescription[]): Promise<void> {
    try {
      console.log(`📥 ApiSync: Syncing ${dailyDescriptions.length} daily descriptions to local database...`);
      
      for (const desc of dailyDescriptions) {
        try {
          // Check if description already exists in local database
          const existingDesc = await DatabaseService.getDailyDescriptionByDate(desc.employeeId, desc.date);
          
          if (existingDesc) {
            // Update existing description
            await DatabaseService.updateDailyDescription(existingDesc.id, {
              description: desc.description,
              costCenter: desc.costCenter
            });
            console.log(`✅ ApiSync: Updated daily description for ${desc.date}`);
          } else {
            // Create new description
            await DatabaseService.createDailyDescription({
              employeeId: desc.employeeId,
              date: desc.date,
              description: desc.description,
              costCenter: desc.costCenter || ''
            });
            console.log(`✅ ApiSync: Created daily description for ${desc.date}`);
          }
        } catch (error) {
          console.error(`❌ ApiSync: Error syncing daily description for ${desc.date}:`, error);
        }
      }
      
      console.log(`✅ ApiSync: Daily descriptions sync completed`);
    } catch (error) {
      console.error('❌ ApiSync: Error syncing daily descriptions to local database:', error);
    }
  }

  /**
   * Sync mileage entries from backend to local database
   */
  private static async syncMileageEntriesToLocal(mileageEntries: MileageEntry[]): Promise<void> {
    try {
      console.log(`📥 ApiSync: Syncing ${mileageEntries.length} mileage entries to local database...`);
      
      const { getDatabaseConnection } = await import('../utils/databaseConnection');
      const database = await getDatabaseConnection();
      
      for (const entry of mileageEntries) {
        try {
          // Check if entry with this backend ID already exists
          const existing = await database.getFirstAsync(
            'SELECT id FROM mileage_entries WHERE id = ?',
            [entry.id]
          );
          
          if (existing) {
            continue; // Skip existing entries
          }
          
          // Convert date to YYYY-MM-DD format only (timezone-safe)
          const entryDate = entry.date;
          const dateOnly = `${entryDate.getFullYear()}-${String(entryDate.getMonth() + 1).padStart(2, '0')}-${String(entryDate.getDate()).padStart(2, '0')}`;
          
          // Insert with the SAME ID from backend to avoid duplicates
          await database.runAsync(
            `INSERT INTO mileage_entries (
              id, employeeId, oxfordHouseId, costCenter, date, odometerReading,
              startLocation, endLocation, purpose, miles, notes, hoursWorked,
              isGpsTracked, createdAt, updatedAt
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              entry.id, // Preserve backend ID
              entry.employeeId,
              entry.oxfordHouseId,
              entry.costCenter || '',
              dateOnly, // Store as YYYY-MM-DD only
              entry.odometerReading,
              entry.startLocation,
              entry.endLocation,
              entry.purpose,
              entry.miles,
              entry.notes || '',
              entry.hoursWorked || 0,
              entry.isGpsTracked ? 1 : 0,
              entry.createdAt instanceof Date ? entry.createdAt.toISOString() : (entry.createdAt || new Date().toISOString()),
              new Date().toISOString()
            ]
          );
        } catch (error) {
          console.error(`❌ ApiSync: Error syncing entry ${entry.id}:`, error);
        }
      }
      
      console.log(`✅ ApiSync: Mileage entries sync completed`);
    } catch (error) {
      console.error('❌ ApiSync: Error syncing mileage entries to local database:', error);
    }
  }

  /**
   * Sync receipts from backend to local database
   */
  private static async syncReceiptsToLocal(receipts: Receipt[]): Promise<void> {
    try {
      console.log(`📥 ApiSync: Syncing ${receipts.length} receipts to local database...`);
      
      for (const receipt of receipts) {
        try {
          // Check if receipt already exists in local database
          const existingReceipt = await DatabaseService.getReceipt(receipt.id);
          
          if (existingReceipt) {
            // Update existing receipt - skip to avoid overwriting local changes
            console.log(`ℹ️ ApiSync: Receipt ${receipt.id} already exists locally, skipping`);
          } else {
            // Create new receipt
            await DatabaseService.createReceipt({
              employeeId: receipt.employeeId,
              date: receipt.date,
              amount: receipt.amount,
              vendor: receipt.vendor,
              description: receipt.description,
              category: receipt.category,
              imageUri: receipt.imageUri,
              costCenter: receipt.costCenter || ''
            });
            console.log(`✅ ApiSync: Created receipt for ${receipt.date}`);
          }
        } catch (error) {
          console.error(`❌ ApiSync: Error syncing receipt ${receipt.id}:`, error);
        }
      }
      
      console.log(`✅ ApiSync: Receipts sync completed`);
    } catch (error) {
      console.error('❌ ApiSync: Error syncing receipts to local database:', error);
    }
  }

  /**
   * Sync time tracking from backend to local database
   */
  private static async syncTimeTrackingToLocal(timeTracking: TimeTracking[]): Promise<void> {
    try {
      console.log(`📥 ApiSync: Syncing ${timeTracking.length} time tracking entries to local database...`);
      
      // Get all existing time tracking entries for this employee to avoid duplicates
      const existingEntries = await DatabaseService.getTimeTrackingEntries(timeTracking[0]?.employeeId || '');
      const existingKeys = new Set(existingEntries.map(t => 
        `${t.date.toDateString()}_${t.category}_${t.hours}`
      ));
      
      let syncedCount = 0;
      let skippedCount = 0;
      
      for (const tracking of timeTracking) {
        try {
          const trackingKey = `${tracking.date.toDateString()}_${tracking.category}_${tracking.hours}`;
          
          if (existingKeys.has(trackingKey)) {
            console.log(`ℹ️ ApiSync: Time tracking for ${tracking.date} (${tracking.category}) already exists locally, skipping`);
            skippedCount++;
            continue;
          }
          
          // Create new time tracking entry
          await DatabaseService.createTimeTracking({
            employeeId: tracking.employeeId,
            date: tracking.date,
            hours: tracking.hours,
            category: tracking.category,
            description: tracking.description,
            costCenter: tracking.costCenter || ''
          });
          console.log(`✅ ApiSync: Created time tracking for ${tracking.date} (${tracking.category})`);
          syncedCount++;
        } catch (error) {
          console.error(`❌ ApiSync: Error syncing time tracking ${tracking.id}:`, error);
        }
      }
      
      console.log(`✅ ApiSync: Time tracking sync completed - ${syncedCount} synced, ${skippedCount} skipped`);
    } catch (error) {
      console.error('❌ ApiSync: Error syncing time tracking to local database:', error);
    }
  }

  /**
   * Sync mileage entries from backend for a specific employee
   */
  static async syncMileageEntriesFromBackend(employeeId: string): Promise<SyncResult> {
    try {
      console.log(`📥 ApiSync: Syncing mileage entries for employee ${employeeId}...`);
      
      const mileageEntries = await this.fetchMileageEntries(employeeId);
      
      if (mileageEntries.length > 0) {
        await this.syncMileageEntriesToLocal(mileageEntries);
      }
      
      console.log(`✅ ApiSync: Mileage entries sync completed for employee ${employeeId}: ${mileageEntries.length} entries`);
      
      return {
        success: true,
        data: { mileageEntries },
        timestamp: new Date()
      };
      
    } catch (error) {
      console.error(`❌ ApiSync: Error syncing mileage entries for employee ${employeeId}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date()
      };
    }
  }

  /**
   * Sync receipts from backend for a specific employee
   */
  static async syncReceiptsFromBackend(employeeId: string): Promise<SyncResult> {
    try {
      console.log(`📥 ApiSync: Syncing receipts for employee ${employeeId}...`);
      
      const receipts = await this.fetchReceipts(employeeId);
      
      if (receipts.length > 0) {
        await this.syncReceiptsToLocal(receipts);
      }
      
      console.log(`✅ ApiSync: Receipts sync completed for employee ${employeeId}: ${receipts.length} receipts`);
      
      return {
        success: true,
        data: { receipts },
        timestamp: new Date()
      };
      
    } catch (error) {
      console.error(`❌ ApiSync: Error syncing receipts for employee ${employeeId}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date()
      };
    }
  }

  /**
   * Sync time tracking from backend for a specific employee
   */
  static async syncTimeTrackingFromBackend(employeeId: string): Promise<SyncResult> {
    try {
      console.log(`📥 ApiSync: Syncing time tracking for employee ${employeeId}...`);
      
      const timeTracking = await this.fetchTimeTracking(employeeId);
      
      // Safety check: if there are too many entries, something might be wrong
      if (timeTracking.length > 1000) {
        console.warn(`⚠️ ApiSync: Too many time tracking entries (${timeTracking.length}), skipping sync to prevent issues`);
        return {
          success: false,
          error: `Too many time tracking entries (${timeTracking.length}), skipping sync`,
          timestamp: new Date()
        };
      }
      
      if (timeTracking.length > 0) {
        await this.syncTimeTrackingToLocal(timeTracking);
      }
      
      console.log(`✅ ApiSync: Time tracking sync completed for employee ${employeeId}: ${timeTracking.length} entries`);
      
      return {
        success: true,
        data: { timeTracking },
        timestamp: new Date()
      };
      
    } catch (error) {
      console.error(`❌ ApiSync: Error syncing time tracking for employee ${employeeId}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date()
      };
    }
  }

  /**
   * Sync daily descriptions from backend for a specific employee
   */
  static async syncDailyDescriptionsFromBackend(employeeId: string): Promise<SyncResult> {
    try {
      console.log(`📥 ApiSync: Syncing daily descriptions for employee ${employeeId}...`);
      
      const dailyDescriptions = await this.fetchDailyDescriptions(employeeId);
      
      if (dailyDescriptions.length > 0) {
        await this.syncDailyDescriptionsToLocal(dailyDescriptions);
      }
      
      console.log(`✅ ApiSync: Daily descriptions sync completed for employee ${employeeId}: ${dailyDescriptions.length} descriptions`);
      
      return {
        success: true,
        data: { dailyDescriptions },
        timestamp: new Date()
      };
      
    } catch (error) {
      console.error(`❌ ApiSync: Error syncing daily descriptions for employee ${employeeId}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date()
      };
    }
  }

  /**
   * Sync all data from backend for a specific employee
   */
  static async syncAllDataFromBackend(employeeId: string): Promise<SyncResult> {
    try {
      console.log(`📥 ApiSync: Syncing all data for employee ${employeeId}...`);
      
      const results = await Promise.all([
        this.syncMileageEntriesFromBackend(employeeId),
        this.syncReceiptsFromBackend(employeeId),
        this.syncTimeTrackingFromBackend(employeeId),
        this.syncDailyDescriptionsFromBackend(employeeId)
      ]);
      
      const allSuccessful = results.every(result => result.success);
      
      if (allSuccessful) {
        console.log(`✅ ApiSync: All data sync completed successfully for employee ${employeeId}`);
      } else {
        console.error(`❌ ApiSync: Some data sync operations failed for employee ${employeeId}`);
      }
      
      return {
        success: allSuccessful,
        data: results,
        timestamp: new Date()
      };
      
    } catch (error) {
      console.error(`❌ ApiSync: Error syncing all data for employee ${employeeId}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date()
      };
    }
  }

  /**
   * Get sync status
   */
  static async getSyncStatus(): Promise<SyncStatus> {
    try {
      const isConnected = await this.testConnection();
      
      // Get stats from backend if connected
      let stats = {
        totalEmployees: 0,
        totalMileageEntries: 0,
        totalReceipts: 0,
        totalTimeTracking: 0
      };
      
      if (isConnected) {
        try {
          const response = await fetch(`${this.config.baseUrl}/stats`);
          if (response.ok) {
            stats = await response.json();
          }
        } catch (error) {
          console.error('❌ ApiSync: Error fetching stats:', error);
        }
      }
      
      return {
        isConnected,
        lastSyncTime: this.lastSyncTime,
        totalEmployees: stats.totalEmployees,
        totalMileageEntries: stats.totalMileageEntries,
        totalReceipts: stats.totalReceipts,
        totalTimeTracking: stats.totalTimeTracking,
        pendingChanges: this.pendingChanges
      };
      
    } catch (error) {
      console.error('❌ ApiSync: Error getting sync status:', error);
      return {
        isConnected: false,
        lastSyncTime: this.lastSyncTime,
        totalEmployees: 0,
        totalMileageEntries: 0,
        totalReceipts: 0,
        totalTimeTracking: 0,
        pendingChanges: this.pendingChanges
      };
    }
  }

  /**
   * Increment pending changes counter
   */
  static incrementPendingChanges(): void {
    this.pendingChanges++;
  }

  /**
   * Reset pending changes counter
   */
  static resetPendingChanges(): void {
    this.pendingChanges = 0;
  }

  /**
   * Save last sync time to local storage
   */
  private static async saveLastSyncTime(time: Date): Promise<void> {
    try {
      // In React Native, you would use AsyncStorage
      // For now, we'll just store it in memory
      console.log('💾 ApiSync: Last sync time saved:', time.toISOString());
    } catch (error) {
      console.error('❌ ApiSync: Error saving last sync time:', error);
    }
  }

  /**
   * Get last sync time from local storage
   */
  private static async getLastSyncTime(): Promise<Date | null> {
    try {
      // In React Native, you would use AsyncStorage
      // For now, we'll just return the in-memory value
      return this.lastSyncTime;
    } catch (error) {
      console.error('❌ ApiSync: Error getting last sync time:', error);
      return null;
    }
  }

  /**
   * Update API configuration
   */
  static updateConfig(newConfig: Partial<ApiSyncConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log('🔄 ApiSync: Configuration updated:', this.config);
  }
}
