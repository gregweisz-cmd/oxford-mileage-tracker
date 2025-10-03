import { Platform } from 'react-native';
import { Employee, MileageEntry, Receipt, DailyOdometerReading, SavedAddress, TimeTracking } from '../types';

// API Configuration
// Use cloud backend URL for all platforms
const API_BASE_URL = 'https://oxford-mileage-backend.onrender.com/api';

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
        },
        timeout: this.config.timeout
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
      
      this.lastSyncTime = new Date();
      await this.saveLastSyncTime(this.lastSyncTime);
      
      console.log('📥 ApiSync: Backend sync completed:', {
        employees: employees.length,
        mileageEntries: mileageEntries.length,
        receipts: receipts.length,
        timeTracking: timeTracking.length
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
      console.log(`📤 ApiSync: Syncing ${entries.length} mileage entries...`);
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
          
          console.log(`📤 ApiSync: Syncing mileage entry ${entry.id}:`, mileageData);
          
          // Validate JSON serialization
          const jsonPayload = JSON.stringify(mileageData);
          console.log(`📤 ApiSync: JSON payload for mileage entry ${entry.id}:`, jsonPayload);
          
          const response = await fetch(`${this.config.baseUrl}/mileage-entries`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: jsonPayload
          });
          
          if (!response.ok) {
            const errorText = await response.text();
            console.error(`❌ ApiSync: Failed to sync mileage entry ${entry.id}:`, response.status, errorText);
            throw new Error(`Failed to sync mileage entry: ${response.statusText}`);
          }
          
          console.log(`✅ ApiSync: Successfully synced mileage entry ${entry.id}`);
          results.push({ success: true, id: entry.id });
        } catch (error) {
          console.error(`❌ ApiSync: Error syncing mileage entry ${entry.id}:`, error);
          results.push({ success: false, id: entry.id, error: error instanceof Error ? error.message : 'Unknown error' });
        }
      }
      
      const allSuccessful = results.every(result => result.success);
      console.log(`📤 ApiSync: Mileage entries sync completed. Success: ${allSuccessful}, Total: ${results.length}`);
      
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
      console.log(`📤 ApiSync: Syncing ${receipts.length} receipts...`);
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
          console.log(`📤 ApiSync: Syncing receipt ${receipt.id}:`, receiptData);
          
          // Validate JSON serialization
          const jsonPayload = JSON.stringify(receiptData);
          console.log(`📤 ApiSync: JSON payload for receipt ${receipt.id}:`, jsonPayload);
          
          const response = await fetch(`${this.config.baseUrl}/receipts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: jsonPayload
          });
          
          if (!response.ok) {
            const errorText = await response.text();
            console.error(`❌ ApiSync: Receipt sync failed for ${receipt.id}:`, {
              status: response.status,
              statusText: response.statusText,
              errorText: errorText,
              url: response.url,
              headers: Object.fromEntries(response.headers.entries())
            });
            throw new Error(`Failed to sync receipt: ${response.status} ${response.statusText} - ${errorText}`);
          }
          
          const responseData = await response.json();
          console.log(`✅ ApiSync: Successfully synced receipt ${receipt.id}:`, responseData);
          results.push({ success: true, id: receipt.id });
        } catch (error) {
          console.error(`❌ ApiSync: Error syncing receipt ${receipt.id}:`, {
            error: error,
            errorMessage: error instanceof Error ? error.message : 'Unknown error',
            errorStack: error instanceof Error ? error.stack : undefined,
            receiptData: receiptData
          });
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
    const response = await fetch(`${this.config.baseUrl}/employees`);
    if (!response.ok) {
      throw new Error(`Failed to fetch employees: ${response.statusText}`);
    }
    
    const data = await response.json();
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
      costCenters: emp.costCenters ? JSON.parse(emp.costCenters) : [],
      createdAt: new Date(emp.createdAt),
      updatedAt: new Date(emp.updatedAt)
    }));
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
        costCenters: emp.costCenters ? JSON.parse(emp.costCenters) : [],
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
    const url = employeeId 
      ? `${this.config.baseUrl}/mileage-entries?employeeId=${employeeId}`
      : `${this.config.baseUrl}/mileage-entries`;
      
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch mileage entries: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.map((entry: any) => ({
      id: entry.id,
      employeeId: entry.employeeId,
      oxfordHouseId: entry.oxfordHouseId,
      date: new Date(entry.date),
      odometerReading: entry.odometerReading,
      startLocation: entry.startLocation,
      endLocation: entry.endLocation,
      purpose: entry.purpose,
      miles: entry.miles,
      notes: entry.notes,
      hoursWorked: entry.hoursWorked || 0,
      isGpsTracked: Boolean(entry.isGpsTracked),
      createdAt: new Date(entry.createdAt),
      updatedAt: new Date(entry.updatedAt)
    }));
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
