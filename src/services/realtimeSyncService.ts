import { Platform } from 'react-native';
import { Employee, MileageEntry, Receipt, DailyOdometerReading, SavedAddress, TimeTracking } from '../types';

// Simple in-memory data store for real-time sync
// In a production app, this would be a real backend API
class SharedDataStore {
  private static instance: SharedDataStore;
  private data: {
    employees: Employee[];
    mileageEntries: MileageEntry[];
    receipts: Receipt[];
    dailyOdometerReadings: DailyOdometerReading[];
    savedAddresses: SavedAddress[];
    timeTracking: TimeTracking[];
    lastUpdate: Date;
  } = {
    employees: [],
    mileageEntries: [],
    receipts: [],
    dailyOdometerReadings: [],
    savedAddresses: [],
    timeTracking: [],
    lastUpdate: new Date()
  };

  private listeners: Array<(data: any) => void> = [];

  static getInstance(): SharedDataStore {
    if (!SharedDataStore.instance) {
      SharedDataStore.instance = new SharedDataStore();
    }
    return SharedDataStore.instance;
  }

  // Subscribe to data changes
  subscribe(listener: (data: any) => void): () => void {
    this.listeners.push(listener);
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  // Notify all listeners of data changes
  private notifyListeners() {
    this.listeners.forEach(listener => listener(this.data));
  }

  // Update data and notify listeners
  updateData(newData: Partial<typeof this.data>) {
    this.data = { ...this.data, ...newData, lastUpdate: new Date() };
    this.notifyListeners();
  }

  // Get current data
  getData() {
    return this.data;
  }

  // Add a new employee
  addEmployee(employee: Employee) {
    const employees = [...this.data.employees, employee];
    this.updateData({ employees });
  }

  // Update an employee
  updateEmployee(id: string, updates: Partial<Employee>) {
    const employees = this.data.employees.map(emp => 
      emp.id === id ? { ...emp, ...updates, updatedAt: new Date() } : emp
    );
    this.updateData({ employees });
  }

  // Add a new mileage entry
  addMileageEntry(entry: MileageEntry) {
    const mileageEntries = [...this.data.mileageEntries, entry];
    this.updateData({ mileageEntries });
  }

  // Add a new receipt
  addReceipt(receipt: Receipt) {
    const receipts = [...this.data.receipts, receipt];
    this.updateData({ receipts });
  }

  // Add a daily odometer reading
  addDailyOdometerReading(reading: DailyOdometerReading) {
    const dailyOdometerReadings = [...this.data.dailyOdometerReadings, reading];
    this.updateData({ dailyOdometerReadings });
  }

  // Add a saved address
  addSavedAddress(address: SavedAddress) {
    const savedAddresses = [...this.data.savedAddresses, address];
    this.updateData({ savedAddresses });
  }

  // Add a time tracking entry
  addTimeTracking(tracking: TimeTracking) {
    const timeTracking = [...this.data.timeTracking, tracking];
    this.updateData({ timeTracking });
  }
}

export class RealtimeSyncService {
  private static sharedStore = SharedDataStore.getInstance();
  private static isInitialized = false;

  /**
   * Initialize the real-time sync service
   */
  static async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      console.log('🔄 RealtimeSync: Initializing...');
      
      // Only initialize on mobile platforms
      if (Platform.OS !== 'web') {
        console.log('🔄 RealtimeSync: Initialized successfully');
      } else {
        console.log('🔄 RealtimeSync: Web platform - using shared store only');
      }
      
      this.isInitialized = true;
    } catch (error) {
      console.error('❌ RealtimeSync: Initialization failed:', error);
    }
  }

  /**
   * Subscribe to data changes
   */
  static subscribe(listener: (data: any) => void): () => void {
    return this.sharedStore.subscribe(listener);
  }

  /**
   * Get current shared data
   */
  static getSharedData() {
    return this.sharedStore.getData();
  }

  /**
   * Add a new employee (mobile app)
   */
  static async addEmployee(employee: Employee): Promise<void> {
    try {
      if (Platform.OS !== 'web') {
        // For mobile, just add to shared store (database is handled by callback)
        this.sharedStore.addEmployee(employee);
      } else {
        // Web platform - add directly to shared store
        this.sharedStore.addEmployee(employee);
      }
    } catch (error) {
      console.error('❌ RealtimeSync: Error adding employee:', error);
      throw error;
    }
  }

  /**
   * Update an employee (mobile app)
   */
  static async updateEmployee(id: string, updates: Partial<Employee>): Promise<void> {
    try {
      if (Platform.OS !== 'web') {
        // For mobile, just update shared store (database is handled by callback)
        this.sharedStore.updateEmployee(id, updates);
      } else {
        // Web platform - update directly in shared store
        this.sharedStore.updateEmployee(id, updates);
      }
    } catch (error) {
      console.error('❌ RealtimeSync: Error updating employee:', error);
      throw error;
    }
  }

  /**
   * Add a new mileage entry (mobile app)
   */
  static async addMileageEntry(entry: MileageEntry): Promise<void> {
    try {
      if (Platform.OS !== 'web') {
        // For mobile, just add to shared store (database is handled by callback)
        this.sharedStore.addMileageEntry(entry);
      } else {
        // Web platform - add directly to shared store
        this.sharedStore.addMileageEntry(entry);
      }
    } catch (error) {
      console.error('❌ RealtimeSync: Error adding mileage entry:', error);
      throw error;
    }
  }

  /**
   * Add a new receipt (mobile app)
   */
  static async addReceipt(receipt: Receipt): Promise<void> {
    try {
      if (Platform.OS !== 'web') {
        // For mobile, just add to shared store (database is handled by callback)
        this.sharedStore.addReceipt(receipt);
      } else {
        // Web platform - add directly to shared store
        this.sharedStore.addReceipt(receipt);
      }
    } catch (error) {
      console.error('❌ RealtimeSync: Error adding receipt:', error);
      throw error;
    }
  }

  /**
   * Add a daily odometer reading (mobile app)
   */
  static async addDailyOdometerReading(reading: DailyOdometerReading): Promise<void> {
    try {
      if (Platform.OS !== 'web') {
        // For mobile, just add to shared store (database is handled by callback)
        this.sharedStore.addDailyOdometerReading(reading);
      } else {
        // Web platform - add directly to shared store
        this.sharedStore.addDailyOdometerReading(reading);
      }
    } catch (error) {
      console.error('❌ RealtimeSync: Error adding daily odometer reading:', error);
      throw error;
    }
  }

  /**
   * Add a saved address (mobile app)
   */
  static async addSavedAddress(address: SavedAddress): Promise<void> {
    try {
      if (Platform.OS !== 'web') {
        // For mobile, just add to shared store (database is handled by callback)
        this.sharedStore.addSavedAddress(address);
      } else {
        // Web platform - add directly to shared store
        this.sharedStore.addSavedAddress(address);
      }
    } catch (error) {
      console.error('❌ RealtimeSync: Error adding saved address:', error);
      throw error;
    }
  }

  /**
   * Add a time tracking entry (mobile app)
   */
  static async addTimeTracking(tracking: TimeTracking): Promise<void> {
    try {
      if (Platform.OS !== 'web') {
        // For mobile, just add to shared store (database is handled by callback)
        this.sharedStore.addTimeTracking(tracking);
      } else {
        // Web platform - add directly to shared store
        this.sharedStore.addTimeTracking(tracking);
      }
    } catch (error) {
      console.error('❌ RealtimeSync: Error adding time tracking:', error);
      throw error;
    }
  }

  /**
   * Get sync status
   */
  static getSyncStatus(): {
    isConnected: boolean;
    lastSyncTime: Date;
    totalEmployees: number;
    totalEntries: number;
    totalReceipts: number;
  } {
    const data = this.getSharedData();
    return {
      isConnected: true,
      lastSyncTime: data.lastUpdate,
      totalEmployees: data.employees.length,
      totalEntries: data.mileageEntries.length,
      totalReceipts: data.receipts.length
    };
  }
}

