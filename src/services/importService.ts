import * as FileSystem from 'expo-file-system/legacy';
import { DatabaseService } from './database';
import { Employee, MileageEntry } from '../types';

export interface ImportResult {
  success: boolean;
  message: string;
  importedCount: number;
  errorCount: number;
  errors: string[];
}

export interface EmployeeImportData {
  'Employee ID': string;
  'Name': string;
  'Email': string;
  'Position': string;
  'Phone Number'?: string;
  'Oxford House ID': string;
  'Base Address'?: string;
  'Cost Center': string;
}

export interface MileageImportData {
  'Employee ID': string;
  'Date': string;
  'Start Location': string;
  'End Location': string;
  'Purpose': string;
  'Miles': string;
  'Hours Worked'?: string;
  'GPS Tracked'?: string;
  'Notes'?: string;
}

export class ImportService {
  static async importEmployeesFromCSV(fileUri: string): Promise<ImportResult> {
    try {
      // Read the CSV file
      const csvContent = await FileSystem.readAsStringAsync(fileUri);
      const lines = csvContent.split('\n').filter(line => line.trim());
      
      if (lines.length < 2) {
        return {
          success: false,
          message: 'CSV file must contain at least a header row and one data row',
          importedCount: 0,
          errorCount: 0,
          errors: []
        };
      }
      
      // Parse header
      const headers = this.parseCSVLine(lines[0]);
      const requiredHeaders = ['Employee ID', 'Name', 'Email', 'Position', 'Oxford House ID', 'Cost Center'];
      
      // Validate headers
      const missingHeaders = requiredHeaders.filter(header => !headers.includes(header));
      if (missingHeaders.length > 0) {
        return {
          success: false,
          message: `Missing required headers: ${missingHeaders.join(', ')}`,
          importedCount: 0,
          errorCount: 0,
          errors: []
        };
      }
      
      // Parse data rows
      const employees: EmployeeImportData[] = [];
      const errors: string[] = [];
      
      for (let i = 1; i < lines.length; i++) {
        try {
          const values = this.parseCSVLine(lines[i]);
          if (values.length !== headers.length) {
            errors.push(`Row ${i + 1}: Column count mismatch`);
            continue;
          }
          
          const employeeData: any = {};
          headers.forEach((header, index) => {
            employeeData[header] = values[index]?.trim() || '';
          });
          
          // Validate required fields
          const validationError = this.validateEmployeeData(employeeData, i + 1);
          if (validationError) {
            errors.push(validationError);
            continue;
          }
          
          employees.push(employeeData as EmployeeImportData);
        } catch (error) {
          errors.push(`Row ${i + 1}: ${error}`);
        }
      }
      
      // Import valid employees
      let importedCount = 0;
      for (const employeeData of employees) {
        try {
          // Check if employee already exists
          const existingEmployees = await DatabaseService.getEmployees();
          const existingEmployee = existingEmployees.find(emp => emp.id === employeeData['Employee ID']);
          
          if (existingEmployee) {
            errors.push(`Employee ID ${employeeData['Employee ID']}: Already exists`);
            continue;
          }
          
          // Create new employee
          await DatabaseService.createEmployee({
            name: employeeData['Name'],
            email: employeeData['Email'],
            password: '', // Default password
            oxfordHouseId: employeeData['Oxford House ID'],
            position: employeeData['Position'],
            phoneNumber: employeeData['Phone Number'] || '',
            baseAddress: employeeData['Base Address'] || '',
            costCenters: [employeeData['Cost Center']],
            selectedCostCenters: [employeeData['Cost Center']]
          });
          
          importedCount++;
        } catch (error) {
          errors.push(`Employee ${employeeData['Employee ID']}: ${error}`);
        }
      }
      
      return {
        success: importedCount > 0,
        message: `Imported ${importedCount} employees successfully`,
        importedCount,
        errorCount: errors.length,
        errors
      };
      
    } catch (error) {
      return {
        success: false,
        message: `Failed to import employees: ${error}`,
        importedCount: 0,
        errorCount: 0,
        errors: [error.toString()]
      };
    }
  }
  
  static async importMileageFromCSV(fileUri: string): Promise<ImportResult> {
    try {
      // Read the CSV file
      const csvContent = await FileSystem.readAsStringAsync(fileUri);
      const lines = csvContent.split('\n').filter(line => line.trim());
      
      if (lines.length < 2) {
        return {
          success: false,
          message: 'CSV file must contain at least a header row and one data row',
          importedCount: 0,
          errorCount: 0,
          errors: []
        };
      }
      
      // Parse header
      const headers = this.parseCSVLine(lines[0]);
      const requiredHeaders = ['Employee ID', 'Date', 'Start Location', 'End Location', 'Purpose', 'Miles'];
      
      // Validate headers
      const missingHeaders = requiredHeaders.filter(header => !headers.includes(header));
      if (missingHeaders.length > 0) {
        return {
          success: false,
          message: `Missing required headers: ${missingHeaders.join(', ')}`,
          importedCount: 0,
          errorCount: 0,
          errors: []
        };
      }
      
      // Parse data rows
      const mileageEntries: MileageImportData[] = [];
      const errors: string[] = [];
      
      for (let i = 1; i < lines.length; i++) {
        try {
          const values = this.parseCSVLine(lines[i]);
          if (values.length !== headers.length) {
            errors.push(`Row ${i + 1}: Column count mismatch`);
            continue;
          }
          
          const mileageData: any = {};
          headers.forEach((header, index) => {
            mileageData[header] = values[index]?.trim() || '';
          });
          
          // Validate required fields
          const validationError = this.validateMileageData(mileageData, i + 1);
          if (validationError) {
            errors.push(validationError);
            continue;
          }
          
          mileageEntries.push(mileageData as MileageImportData);
        } catch (error) {
          errors.push(`Row ${i + 1}: ${error}`);
        }
      }
      
      // Import valid mileage entries
      let importedCount = 0;
      for (const mileageData of mileageEntries) {
        try {
          // Find employee
          const employees = await DatabaseService.getEmployees();
          const employee = employees.find(emp => emp.id === mileageData['Employee ID']);
          
          if (!employee) {
            errors.push(`Employee ID ${mileageData['Employee ID']}: Not found`);
            continue;
          }
          
          // Create new mileage entry
          await DatabaseService.createMileageEntry({
            employeeId: employee.id,
            oxfordHouseId: employee.oxfordHouseId,
            costCenter: employee.selectedCostCenters[0] || 'Administrative',
            date: new Date(mileageData['Date']),
            odometerReading: 0, // Default odometer reading
            startLocation: mileageData['Start Location'],
            endLocation: mileageData['End Location'],
            purpose: mileageData['Purpose'],
            miles: parseFloat(mileageData['Miles']),
            notes: mileageData['Notes'] || '',
            hoursWorked: mileageData['Hours Worked'] ? parseFloat(mileageData['Hours Worked']) : undefined,
            isGpsTracked: mileageData['GPS Tracked']?.toLowerCase() === 'yes'
          });
          
          importedCount++;
        } catch (error) {
          errors.push(`Mileage entry ${importedCount + 1}: ${error}`);
        }
      }
      
      return {
        success: importedCount > 0,
        message: `Imported ${importedCount} mileage entries successfully`,
        importedCount,
        errorCount: errors.length,
        errors
      };
      
    } catch (error) {
      return {
        success: false,
        message: `Failed to import mileage entries: ${error}`,
        importedCount: 0,
        errorCount: 0,
        errors: [error.toString()]
      };
    }
  }
  
  private static parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++; // Skip next quote
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    
    result.push(current);
    return result;
  }
  
  private static validateEmployeeData(data: any, rowNumber: number): string | null {
    if (!data['Employee ID']) return `Row ${rowNumber}: Employee ID is required`;
    if (!data['Name']) return `Row ${rowNumber}: Name is required`;
    if (!data['Email']) return `Row ${rowNumber}: Email is required`;
    if (!data['Position']) return `Row ${rowNumber}: Position is required`;
    if (!data['Oxford House ID']) return `Row ${rowNumber}: Oxford House ID is required`;
    if (!data['Cost Center']) return `Row ${rowNumber}: Cost Center is required`;
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data['Email'])) {
      return `Row ${rowNumber}: Invalid email format`;
    }
    
    return null;
  }
  
  private static validateMileageData(data: any, rowNumber: number): string | null {
    if (!data['Employee ID']) return `Row ${rowNumber}: Employee ID is required`;
    if (!data['Date']) return `Row ${rowNumber}: Date is required`;
    if (!data['Start Location']) return `Row ${rowNumber}: Start Location is required`;
    if (!data['End Location']) return `Row ${rowNumber}: End Location is required`;
    if (!data['Purpose']) return `Row ${rowNumber}: Purpose is required`;
    if (!data['Miles']) return `Row ${rowNumber}: Miles is required`;
    
    // Validate date format
    const date = new Date(data['Date']);
    if (isNaN(date.getTime())) {
      return `Row ${rowNumber}: Invalid date format (use YYYY-MM-DD)`;
    }
    
    // Validate miles
    const miles = parseFloat(data['Miles']);
    if (isNaN(miles) || miles < 0) {
      return `Row ${rowNumber}: Invalid miles value`;
    }
    
    // Validate hours if provided
    if (data['Hours Worked']) {
      const hours = parseFloat(data['Hours Worked']);
      if (isNaN(hours) || hours < 0) {
        return `Row ${rowNumber}: Invalid hours worked value`;
      }
    }
    
    return null;
  }
}


