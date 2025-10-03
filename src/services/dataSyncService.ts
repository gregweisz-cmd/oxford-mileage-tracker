import { Platform } from 'react-native';
import { DatabaseService } from './database';
import { Employee, MileageEntry, Receipt, DailyOdometerReading, SavedAddress, TimeTracking } from '../types';

export interface SyncData {
  employees: Employee[];
  mileageEntries: MileageEntry[];
  receipts: Receipt[];
  dailyOdometerReadings: DailyOdometerReading[];
  savedAddresses: SavedAddress[];
  timeTracking: TimeTracking[];
  lastSyncTime: Date;
}

export interface WebData {
  employees: any[];
  mileageEntries: any[];
  receipts: any[];
  lastSyncTime: string;
}

export class DataSyncService {
  /**
   * Export all data from the mobile app database
   */
  static async exportMobileData(): Promise<SyncData> {
    try {
      console.log('📤 DataSync: Exporting mobile data...');
      
      const employees = await DatabaseService.getEmployees();
      const mileageEntries = await DatabaseService.getMileageEntries();
      const receipts = await DatabaseService.getReceipts();
      const dailyOdometerReadings = await DatabaseService.getDailyOdometerReadings();
      const savedAddresses = await DatabaseService.getSavedAddresses();
      const timeTracking = await DatabaseService.getAllTimeTrackingEntries();

      const syncData: SyncData = {
        employees,
        mileageEntries,
        receipts,
        dailyOdometerReadings,
        savedAddresses,
        timeTracking,
        lastSyncTime: new Date()
      };

      console.log('📤 DataSync: Export completed:', {
        employees: employees.length,
        mileageEntries: mileageEntries.length,
        receipts: receipts.length,
        dailyOdometerReadings: dailyOdometerReadings.length,
        savedAddresses: savedAddresses.length,
        timeTracking: timeTracking.length
      });

      return syncData;
    } catch (error) {
      console.error('❌ DataSync: Error exporting mobile data:', error);
      throw error;
    }
  }

  /**
   * Convert mobile data to web-compatible format
   */
  static convertToWebFormat(mobileData: SyncData): WebData {
    console.log('🔄 DataSync: Converting to web format...');
    
    const webData: WebData = {
      employees: mobileData.employees.map(emp => ({
        id: emp.id,
        name: emp.name,
        email: emp.email,
        position: emp.position,
        phoneNumber: emp.phoneNumber || '',
        baseAddress: emp.baseAddress,
        costCenter: emp.costCenter || '',
        createdAt: emp.createdAt.toISOString()
      })),
      mileageEntries: mobileData.mileageEntries.map(entry => ({
        id: entry.id,
        employeeId: entry.employeeId,
        employeeName: mobileData.employees.find(emp => emp.id === entry.employeeId)?.name || 'Unknown',
        date: entry.date.toISOString(),
        startLocation: entry.startLocation,
        endLocation: entry.endLocation,
        purpose: entry.purpose,
        miles: entry.miles,
        odometerReading: entry.odometerReading,
        notes: entry.notes || '',
        hoursWorked: entry.hoursWorked || 0,
        isGpsTracked: entry.isGpsTracked,
        createdAt: entry.createdAt.toISOString()
      })),
      receipts: mobileData.receipts.map(receipt => ({
        id: receipt.id,
        employeeId: receipt.employeeId,
        employeeName: mobileData.employees.find(emp => emp.id === receipt.employeeId)?.name || 'Unknown',
        date: receipt.date.toISOString(),
        amount: receipt.amount,
        vendor: receipt.vendor,
        description: receipt.description,
        category: receipt.category,
        createdAt: receipt.createdAt.toISOString()
      })),
      lastSyncTime: mobileData.lastSyncTime.toISOString()
    };

    console.log('🔄 DataSync: Web format conversion completed');
    return webData;
  }

  /**
   * Generate a JSON file for sharing data
   */
  static async generateDataFile(): Promise<string> {
    try {
      const mobileData = await this.exportMobileData();
      const webData = this.convertToWebFormat(mobileData);
      
      const jsonString = JSON.stringify(webData, null, 2);
      
      console.log('📄 DataSync: Generated data file:', jsonString.length, 'characters');
      
      return jsonString;
    } catch (error) {
      console.error('❌ DataSync: Error generating data file:', error);
      throw error;
    }
  }

  /**
   * Import data from web format to mobile database
   */
  static async importWebData(webData: WebData): Promise<void> {
    try {
      console.log('📥 DataSync: Importing web data...');
      
      // Import employees
      for (const empData of webData.employees) {
        const employee: Employee = {
          id: empData.id,
          name: empData.name,
          email: empData.email,
          oxfordHouseId: 'default-house', // Default house ID
          position: empData.position,
          phoneNumber: empData.phoneNumber,
          baseAddress: empData.baseAddress,
          costCenter: empData.costCenter,
          createdAt: new Date(empData.createdAt),
          updatedAt: new Date()
        };
        
        // Check if employee exists, if not create
        const existingEmployee = await DatabaseService.getEmployee(employee.id);
        if (!existingEmployee) {
          await DatabaseService.createEmployee(employee);
        } else {
          await DatabaseService.updateEmployee(employee.id, {
            position: employee.position,
            phoneNumber: employee.phoneNumber,
            baseAddress: employee.baseAddress,
            costCenter: employee.costCenter
          });
        }
      }

      // Import mileage entries
      for (const entryData of webData.mileageEntries) {
        const mileageEntry: MileageEntry = {
          id: entryData.id,
          employeeId: entryData.employeeId,
          oxfordHouseId: 'default-house',
          date: new Date(entryData.date),
          odometerReading: entryData.odometerReading || 0,
          startLocation: entryData.startLocation,
          endLocation: entryData.endLocation,
          purpose: entryData.purpose,
          miles: entryData.miles,
          notes: entryData.notes,
          hoursWorked: entryData.hoursWorked,
          isGpsTracked: entryData.isGpsTracked,
          createdAt: new Date(entryData.createdAt),
          updatedAt: new Date()
        };
        
        // Check if entry exists, if not create
        const existingEntry = await DatabaseService.getMileageEntry(mileageEntry.id);
        if (!existingEntry) {
          await DatabaseService.createMileageEntry(mileageEntry);
        }
      }

      // Import receipts
      for (const receiptData of webData.receipts) {
        const receipt: Receipt = {
          id: receiptData.id,
          employeeId: receiptData.employeeId,
          date: new Date(receiptData.date),
          amount: receiptData.amount,
          vendor: receiptData.vendor,
          description: receiptData.description,
          category: receiptData.category,
          imageUri: '', // No image URI from web data
          createdAt: new Date(receiptData.createdAt),
          updatedAt: new Date()
        };
        
        // Check if receipt exists, if not create
        const existingReceipt = await DatabaseService.getReceipt(receipt.id);
        if (!existingReceipt) {
          await DatabaseService.createReceipt(receipt);
        }
      }

      console.log('📥 DataSync: Web data import completed');
    } catch (error) {
      console.error('❌ DataSync: Error importing web data:', error);
      throw error;
    }
  }

  /**
   * Get sync status information
   */
  static async getSyncStatus(): Promise<{
    lastSyncTime: Date | null;
    totalEntries: number;
    totalReceipts: number;
    totalEmployees: number;
  }> {
    try {
      const employees = await DatabaseService.getEmployees();
      const mileageEntries = await DatabaseService.getMileageEntries();
      const receipts = await DatabaseService.getReceipts();
      
      // Get the most recent update time
      const allDates = [
        ...employees.map(emp => emp.updatedAt),
        ...mileageEntries.map(entry => entry.updatedAt),
        ...receipts.map(receipt => receipt.updatedAt)
      ];
      
      const lastSyncTime = allDates.length > 0 ? new Date(Math.max(...allDates.map(d => d.getTime()))) : null;
      
      return {
        lastSyncTime,
        totalEntries: mileageEntries.length,
        totalReceipts: receipts.length,
        totalEmployees: employees.length
      };
    } catch (error) {
      console.error('❌ DataSync: Error getting sync status:', error);
      return {
        lastSyncTime: null,
        totalEntries: 0,
        totalReceipts: 0,
        totalEmployees: 0
      };
    }
  }
}

