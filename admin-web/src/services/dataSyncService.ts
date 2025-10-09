/**
 * DataSyncService
 * Centralized service for loading and syncing data from the backend API
 * 
 * Features:
 * - Centralized data loading
 * - Caching with TTL
 * - Error handling with retries
 * - Optimized API calls
 * - Type safety
 */

// Types
export interface Employee {
  id: string;
  name: string;
  email: string;
  oxfordHouseId: string;
  position: string;
  phoneNumber: string;
  baseAddress: string;
  baseAddress2?: string;
  costCenters: string[];
  selectedCostCenters?: string[];
  defaultCostCenter?: string;
  role?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface MileageEntry {
  id: string;
  employeeId: string;
  date: string;
  startLocation: string;
  endLocation: string;
  miles: number;
  purpose: string;
  notes?: string;
  odometerReading?: number;
  costCenter?: string;
  hoursWorked?: number;
  isGpsTracked?: boolean;
  createdAt?: string;
}

export interface Receipt {
  id: string;
  employeeId: string;
  date: string;
  vendor: string;
  amount: number;
  category: string;
  description: string;
  imageUri?: string;
  costCenter?: string;
  createdAt?: string;
}

export interface TimeTracking {
  id: string;
  employeeId: string;
  date: string;
  hours: number;
  type: string;
  description?: string;
  costCenter?: string;
  category?: string; // Added for backward compatibility
  createdAt?: string;
}

export interface ExpenseReport {
  id: string;
  employeeId: string;
  month: number;
  year: number;
  status: 'draft' | 'submitted' | 'approved' | 'rejected';
  reportData: any;
  submittedAt?: string;
  approvedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

// Cache configuration
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second

// API base URL
const API_BASE_URL = 'http://localhost:3002/api';

// Initialize real-time sync
let realtimeInitialized = false;

/**
 * Cache entry structure
 */
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

/**
 * DataSyncService
 */
class DataSyncServiceClass {
  private cache: Map<string, CacheEntry<any>> = new Map();

  constructor() {
    this.initializeRealtimeSync();
  }

  /**
   * Initialize real-time sync
   */
  private async initializeRealtimeSync(): Promise<void> {
    if (realtimeInitialized) return;
    
    try {
      // Dynamically import realtime sync service to avoid circular dependencies
      const { realtimeSyncService } = await import('./realtimeSyncService');
      
      // Initialize real-time sync
      await realtimeSyncService.initialize();
      
      // Subscribe to data updates
      realtimeSyncService.subscribe('employee', (update) => {
        this.handleRealtimeUpdate('employee', update);
      });
      
      realtimeSyncService.subscribe('mileage', (update) => {
        this.handleRealtimeUpdate('mileage', update);
      });
      
      realtimeSyncService.subscribe('receipt', (update) => {
        this.handleRealtimeUpdate('receipt', update);
      });
      
      realtimeSyncService.subscribe('time_tracking', (update) => {
        this.handleRealtimeUpdate('time_tracking', update);
      });
      
      realtimeInitialized = true;
      console.log('✅ DataSyncService: Real-time sync initialized');
    } catch (error) {
      console.warn('⚠️ DataSyncService: Failed to initialize real-time sync:', error);
    }
  }

  /**
   * Handle real-time updates
   */
  private handleRealtimeUpdate(type: string, update: any): void {
    console.log(`🔄 DataSyncService: Handling ${type} update:`, update);
    
    // Clear relevant cache entries
    const cacheKeysToClear = Array.from(this.cache.keys()).filter(key => 
      key.includes(type) || key.includes('all_')
    );
    
    cacheKeysToClear.forEach(key => {
      this.cache.delete(key);
      console.log(`🗑️ DataSyncService: Cleared cache for ${key}`);
    });
    
    // Trigger cache refresh for affected data
    this.refreshAffectedData(type, update.employeeId);
  }

  /**
   * Refresh affected data after real-time update
   */
  private async refreshAffectedData(type: string, employeeId?: string): Promise<void> {
    try {
      // Refresh data based on update type
      switch (type) {
        case 'employee':
          await this.getAllEmployees(true); // Skip cache
          break;
        case 'mileage':
          if (employeeId) {
            await this.getMileageEntries(employeeId, undefined, undefined, true);
          } else {
            await this.getMileageEntries(undefined, undefined, undefined, true);
          }
          break;
        case 'receipt':
          if (employeeId) {
            await this.getReceipts(employeeId, undefined, undefined, true);
          } else {
            await this.getReceipts(undefined, undefined, undefined, true);
          }
          break;
        case 'time_tracking':
          if (employeeId) {
            await this.getTimeTracking(employeeId, undefined, undefined, true);
          } else {
            await this.getTimeTracking(undefined, undefined, undefined, true);
          }
          break;
      }
    } catch (error) {
      console.error('❌ DataSyncService: Error refreshing data:', error);
    }
  }

  /**
   * Generic fetch with retry logic
   */
  private async fetchWithRetry<T>(
    url: string,
    options: RequestInit = {},
    retries = MAX_RETRIES
  ): Promise<T> {
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      if (retries > 0) {
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY));
        return this.fetchWithRetry<T>(url, options, retries - 1);
      }
      throw error;
    }
  }

  /**
   * Get data from cache or fetch from API
   */
  private async getCachedOrFetch<T>(
    cacheKey: string,
    fetcher: () => Promise<T>,
    skipCache = false
  ): Promise<T> {
    // Check cache first (unless skipCache is true)
    if (!skipCache) {
      const cached = this.cache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return cached.data as T;
      }
    }

    // Fetch fresh data
    const data = await fetcher();

    // Update cache
    this.cache.set(cacheKey, {
      data,
      timestamp: Date.now(),
    });

    return data;
  }

  /**
   * Clear cache
   */
  clearCache(key?: string): void {
    if (key) {
      this.cache.delete(key);
    } else {
      this.cache.clear();
    }
  }

  /**
   * Get employee by ID
   */
  async getEmployee(employeeId: string, skipCache = false): Promise<Employee | null> {
    try {
      const cacheKey = `employee_${employeeId}`;
      return await this.getCachedOrFetch(
        cacheKey,
        () => this.fetchWithRetry<Employee>(`${API_BASE_URL}/employees/${employeeId}`),
        skipCache
      );
    } catch (error) {
      console.error('Error fetching employee:', error);
      return null;
    }
  }

  /**
   * Get all employees
   */
  async getAllEmployees(skipCache = false): Promise<Employee[]> {
    try {
      const cacheKey = 'all_employees';
      return await this.getCachedOrFetch(
        cacheKey,
        () => this.fetchWithRetry<Employee[]>(`${API_BASE_URL}/employees`),
        skipCache
      );
    } catch (error) {
      console.error('Error fetching employees:', error);
      return [];
    }
  }

  /**
   * Alias for getAllEmployees (for backward compatibility)
   */
  async getEmployees(skipCache = false): Promise<Employee[]> {
    return this.getAllEmployees(skipCache);
  }

  /**
   * Get mileage entries for an employee
   */
  async getMileageEntries(
    employeeId?: string,
    month?: number,
    year?: number,
    skipCache = false
  ): Promise<MileageEntry[]> {
    try {
      const params = new URLSearchParams();
      if (employeeId) params.append('employeeId', employeeId);
      if (month !== undefined) params.append('month', month.toString());
      if (year !== undefined) params.append('year', year.toString());

      const cacheKey = employeeId 
        ? `mileage_${employeeId}_${month}_${year}`
        : `mileage_all_${month}_${year}`;
      
      const url = `${API_BASE_URL}/mileage-entries?${params.toString()}`;

      return await this.getCachedOrFetch(
        cacheKey,
        () => this.fetchWithRetry<MileageEntry[]>(url),
        skipCache
      );
    } catch (error) {
      console.error('Error fetching mileage entries:', error);
      return [];
    }
  }

  /**
   * Get receipts for an employee
   */
  async getReceipts(
    employeeId?: string,
    month?: number,
    year?: number,
    skipCache = false
  ): Promise<Receipt[]> {
    try {
      const params = new URLSearchParams();
      if (employeeId) params.append('employeeId', employeeId);
      if (month !== undefined) params.append('month', month.toString());
      if (year !== undefined) params.append('year', year.toString());

      const cacheKey = employeeId 
        ? `receipts_${employeeId}_${month}_${year}`
        : `receipts_all_${month}_${year}`;
      
      const url = `${API_BASE_URL}/receipts?${params.toString()}`;

      return await this.getCachedOrFetch(
        cacheKey,
        () => this.fetchWithRetry<Receipt[]>(url),
        skipCache
      );
    } catch (error) {
      console.error('Error fetching receipts:', error);
      return [];
    }
  }

  /**
   * Get time tracking entries for an employee
   */
  async getTimeTracking(
    employeeId?: string,
    month?: number,
    year?: number,
    skipCache = false
  ): Promise<TimeTracking[]> {
    try {
      const params = new URLSearchParams();
      if (employeeId) params.append('employeeId', employeeId);
      if (month !== undefined) params.append('month', month.toString());
      if (year !== undefined) params.append('year', year.toString());

      const cacheKey = employeeId 
        ? `time_tracking_${employeeId}_${month}_${year}`
        : `time_tracking_all_${month}_${year}`;
      
      const url = `${API_BASE_URL}/time-tracking?${params.toString()}`;

      return await this.getCachedOrFetch(
        cacheKey,
        () => this.fetchWithRetry<TimeTracking[]>(url),
        skipCache
      );
    } catch (error) {
      console.error('Error fetching time tracking:', error);
      return [];
    }
  }

  /**
   * Get all data for an employee in a single call (optimized)
   */
  async getEmployeeData(
    employeeId: string,
    month?: number,
    year?: number,
    skipCache = false
  ): Promise<{
    employee: Employee | null;
    mileage: MileageEntry[];
    receipts: Receipt[];
    timeTracking: TimeTracking[];
  }> {
    try {
      // Use Promise.all to fetch all data in parallel
      const [employee, mileage, receipts, timeTracking] = await Promise.all([
        this.getEmployee(employeeId, skipCache),
        this.getMileageEntries(employeeId, month, year, skipCache),
        this.getReceipts(employeeId, month, year, skipCache),
        this.getTimeTracking(employeeId, month, year, skipCache),
      ]);

      return {
        employee,
        mileage,
        receipts,
        timeTracking,
      };
    } catch (error) {
      console.error('Error fetching employee data:', error);
      return {
        employee: null,
        mileage: [],
        receipts: [],
        timeTracking: [],
      };
    }
  }

  /**
   * Get expense reports for an employee
   */
  async getExpenseReports(employeeId: string, skipCache = false): Promise<ExpenseReport[]> {
    try {
      const cacheKey = `expense_reports_${employeeId}`;
      return await this.getCachedOrFetch(
        cacheKey,
        () => this.fetchWithRetry<ExpenseReport[]>(`${API_BASE_URL}/expense-reports/${employeeId}`),
        skipCache
      );
    } catch (error) {
      console.error('Error fetching expense reports:', error);
      return [];
    }
  }

  /**
   * Save expense report
   */
  async saveExpenseReport(
    employeeId: string,
    month: number,
    year: number,
    reportData: any,
    status: 'draft' | 'submitted' = 'draft'
  ): Promise<ExpenseReport | null> {
    try {
      const result = await this.fetchWithRetry<ExpenseReport>(`${API_BASE_URL}/expense-reports`, {
        method: 'POST',
        body: JSON.stringify({
          employeeId,
          month,
          year,
          reportData,
          status,
        }),
      });

      // Clear cache for this employee's reports
      this.clearCache(`expense_reports_${employeeId}`);

      return result;
    } catch (error) {
      console.error('Error saving expense report:', error);
      return null;
    }
  }

  /**
   * Submit expense report
   */
  async submitExpenseReport(
    employeeId: string,
    month: number,
    year: number,
    reportData: any
  ): Promise<ExpenseReport | null> {
    return this.saveExpenseReport(employeeId, month, year, reportData, 'submitted');
  }

  /**
   * Delete expense report
   */
  async deleteExpenseReport(reportId: string): Promise<boolean> {
    try {
      await this.fetchWithRetry(`${API_BASE_URL}/expense-reports/${reportId}`, {
        method: 'DELETE',
      });

      // Clear all expense reports cache
      this.clearCache();

      return true;
    } catch (error) {
      console.error('Error deleting expense report:', error);
      return false;
    }
  }

  /**
   * Update employee
   */
  async updateEmployee(employeeId: string, updates: Partial<Employee>): Promise<Employee | null> {
    try {
      const result = await this.fetchWithRetry<Employee>(`${API_BASE_URL}/employees/${employeeId}`, {
        method: 'PUT',
        body: JSON.stringify(updates),
      });

      // Clear cache for this employee
      this.clearCache(`employee_${employeeId}`);
      this.clearCache('all_employees');

      return result;
    } catch (error) {
      console.error('Error updating employee:', error);
      return null;
    }
  }

  /**
   * Create mileage entry
   */
  async createMileageEntry(entry: Omit<MileageEntry, 'id' | 'createdAt'>): Promise<MileageEntry | null> {
    try {
      const result = await this.fetchWithRetry<MileageEntry>(`${API_BASE_URL}/mileage-entries`, {
        method: 'POST',
        body: JSON.stringify(entry),
      });

      // Clear cache for this employee's mileage
      const date = new Date(entry.date);
      this.clearCache(`mileage_${entry.employeeId}_${date.getMonth() + 1}_${date.getFullYear()}`);

      return result;
    } catch (error) {
      console.error('Error creating mileage entry:', error);
      return null;
    }
  }

  /**
   * Create receipt
   */
  async createReceipt(receipt: Omit<Receipt, 'id' | 'createdAt'>): Promise<Receipt | null> {
    try {
      const result = await this.fetchWithRetry<Receipt>(`${API_BASE_URL}/receipts`, {
        method: 'POST',
        body: JSON.stringify(receipt),
      });

      // Clear cache for this employee's receipts
      const date = new Date(receipt.date);
      this.clearCache(`receipts_${receipt.employeeId}_${date.getMonth() + 1}_${date.getFullYear()}`);

      return result;
    } catch (error) {
      console.error('Error creating receipt:', error);
      return null;
    }
  }

  /**
   * Create time tracking entry
   */
  async createTimeTracking(entry: Omit<TimeTracking, 'id' | 'createdAt'>): Promise<TimeTracking | null> {
    try {
      const result = await this.fetchWithRetry<TimeTracking>(`${API_BASE_URL}/time-tracking`, {
        method: 'POST',
        body: JSON.stringify(entry),
      });

      // Clear cache for this employee's time tracking
      const date = new Date(entry.date);
      this.clearCache(`time_tracking_${entry.employeeId}_${date.getMonth() + 1}_${date.getFullYear()}`);

      return result;
    } catch (error) {
      console.error('Error creating time tracking entry:', error);
      return null;
    }
  }
}

// Export singleton instance
export const DataSyncService = new DataSyncServiceClass();

export default DataSyncService;
