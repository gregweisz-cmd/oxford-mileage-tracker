import * as XLSX from 'xlsx';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Employee, MileageEntry, Receipt } from '../types';

export interface ExcelExportOptions {
  includeEmployees?: boolean;
  includeMileageEntries?: boolean;
  includeReceipts?: boolean;
  dateRange?: {
    start: Date;
    end: Date;
  };
  employeeIds?: string[];
}

export class ExcelExportService {
  static async exportToExcel(
    data: {
      employees?: Employee[];
      mileageEntries?: MileageEntry[];
      receipts?: Receipt[];
    },
    options: ExcelExportOptions = {}
  ): Promise<string> {
    try {
      const workbook = XLSX.utils.book_new();
      
      // Export employees if requested
      if (options.includeEmployees && data.employees) {
        const employeeSheet = this.createEmployeeSheet(data.employees);
        XLSX.utils.book_append_sheet(workbook, employeeSheet, 'Employees');
      }
      
      // Export mileage entries if requested
      if (options.includeMileageEntries && data.mileageEntries) {
        const mileageSheet = this.createMileageSheet(data.mileageEntries);
        XLSX.utils.book_append_sheet(workbook, mileageSheet, 'Mileage Entries');
      }
      
      // Export receipts if requested
      if (options.includeReceipts && data.receipts) {
        const receiptSheet = this.createReceiptSheet(data.receipts);
        XLSX.utils.book_append_sheet(workbook, receiptSheet, 'Receipts');
      }
      
      // Generate Excel file
      const excelBuffer = XLSX.write(workbook, { type: 'base64', bookType: 'xlsx' });
      
      // Create filename with timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const filename = `Oxford_House_Export_${timestamp}.xlsx`;
      
      // Save to device
      const fileUri = `${FileSystem.documentDirectory}${filename}`;
      await FileSystem.writeAsStringAsync(fileUri, excelBuffer, {
        encoding: FileSystem.EncodingType.Base64,
      });
      
      return fileUri;
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      throw new Error('Failed to export data to Excel');
    }
  }
  
  static async shareExcelFile(fileUri: string): Promise<void> {
    try {
      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          dialogTitle: 'Share Oxford House Data',
        });
      } else {
        throw new Error('Sharing is not available on this device');
      }
    } catch (error) {
      console.error('Error sharing Excel file:', error);
      throw new Error('Failed to share Excel file');
    }
  }
  
  private static createEmployeeSheet(employees: Employee[]): XLSX.WorkSheet {
    const employeeData = employees.map(emp => ({
      'Employee ID': emp.id,
      'Name': emp.name,
      'Email': emp.email,
      'Position': emp.position,
      'Phone Number': emp.phoneNumber,
      'Oxford House ID': emp.oxfordHouseId,
      'Base Address': emp.baseAddress,
      'Cost Center': emp.costCenter,
      'Created Date': emp.createdAt.toISOString().split('T')[0],
      'Last Updated': emp.updatedAt.toISOString().split('T')[0],
    }));
    
    return XLSX.utils.json_to_sheet(employeeData);
  }
  
  private static createMileageSheet(entries: MileageEntry[]): XLSX.WorkSheet {
    const mileageData = entries.map(entry => ({
      'Entry ID': entry.id,
      'Employee ID': entry.employeeId,
      'Oxford House ID': entry.oxfordHouseId,
      'Date': entry.date.toISOString().split('T')[0],
      'Start Location': entry.startLocation,
      'End Location': entry.endLocation,
      'Purpose': entry.purpose,
      'Miles': entry.miles,
      'Hours Worked': entry.hoursWorked || 0,
      'GPS Tracked': entry.isGpsTracked ? 'Yes' : 'No',
      'Notes': entry.notes || '',
      'Created Date': entry.createdAt.toISOString().split('T')[0],
      'Last Updated': entry.updatedAt.toISOString().split('T')[0],
    }));
    
    return XLSX.utils.json_to_sheet(mileageData);
  }
  
  private static createReceiptSheet(receipts: Receipt[]): XLSX.WorkSheet {
    const receiptData = receipts.map(receipt => ({
      'Receipt ID': receipt.id,
      'Employee ID': receipt.employeeId,
      'Date': receipt.date.toISOString().split('T')[0],
      'Amount': receipt.amount,
      'Vendor': receipt.vendor,
      'Description': receipt.description,
      'Category': receipt.category,
      'Image URI': receipt.imageUri || '',
      'Created Date': receipt.createdAt.toISOString().split('T')[0],
      'Last Updated': receipt.updatedAt.toISOString().split('T')[0],
    }));
    
    return XLSX.utils.json_to_sheet(receiptData);
  }
  
  // Template generation methods
  static async generateEmployeeTemplate(): Promise<string> {
    const templateData = [
      {
        'Employee ID': 'EMP001',
        'Name': 'John Doe',
        'Email': 'john.doe@oxfordhouse.org',
        'Position': 'Outreach Worker',
        'Phone Number': '+15551234567',
        'Oxford House ID': 'NC-TEAM',
        'Base Address': '123 Main St, Charlotte, NC 28201',
        'Cost Center': 'North Carolina',
        'Created Date': new Date().toISOString().split('T')[0],
        'Last Updated': new Date().toISOString().split('T')[0],
      },
      {
        'Employee ID': 'EMP002',
        'Name': 'Jane Smith',
        'Email': 'jane.smith@oxfordhouse.org',
        'Position': 'Senior Outreach Coordinator',
        'Phone Number': '+15551234568',
        'Oxford House ID': 'NC-TEAM',
        'Base Address': '456 Oak Ave, Matthews, NC 28105',
        'Cost Center': 'North Carolina',
        'Created Date': new Date().toISOString().split('T')[0],
        'Last Updated': new Date().toISOString().split('T')[0],
      }
    ];
    
    const workbook = XLSX.utils.book_new();
    const sheet = XLSX.utils.json_to_sheet(templateData);
    
    // Add instructions sheet
    const instructionsData = [
      ['Oxford House Employee Import Template'],
      [''],
      ['Instructions:'],
      ['1. Fill in the employee information below'],
      ['2. Remove the example rows (EMP001, EMP002)'],
      ['3. Save as CSV format'],
      ['4. Import using the Admin screen'],
      [''],
      ['Required Fields:'],
      ['- Employee ID: Unique identifier'],
      ['- Name: Full name'],
      ['- Email: Valid email address'],
      ['- Position: Job title'],
      ['- Oxford House ID: Cost center identifier'],
      ['- Cost Center: From approved list'],
      [''],
      ['Optional Fields:'],
      ['- Phone Number: Contact number'],
      ['- Base Address: Home/office address'],
    ];
    
    const instructionsSheet = XLSX.utils.aoa_to_sheet(instructionsData);
    XLSX.utils.book_append_sheet(workbook, instructionsSheet, 'Instructions');
    XLSX.utils.book_append_sheet(workbook, sheet, 'Employee Template');
    
    const excelBuffer = XLSX.write(workbook, { type: 'base64', bookType: 'xlsx' });
    const filename = `Oxford_House_Employee_Template.xlsx`;
    const fileUri = `${FileSystem.documentDirectory}${filename}`;
    
    await FileSystem.writeAsStringAsync(fileUri, excelBuffer, {
      encoding: FileSystem.EncodingType.Base64,
    });
    
    return fileUri;
  }
  
  static async generateMileageTemplate(): Promise<string> {
    const templateData = [
      {
        'Entry ID': 'MIL001',
        'Employee ID': 'EMP001',
        'Date': new Date().toISOString().split('T')[0],
        'Start Location': 'Office',
        'End Location': 'Client Home',
        'Purpose': 'Client visit',
        'Miles': 15.5,
        'Hours Worked': 8.0,
        'GPS Tracked': 'No',
        'Notes': 'Initial client meeting',
      }
    ];
    
    const workbook = XLSX.utils.book_new();
    const sheet = XLSX.utils.json_to_sheet(templateData);
    
    const instructionsData = [
      ['Oxford House Mileage Entry Template'],
      [''],
      ['Instructions:'],
      ['1. Fill in the mileage information below'],
      ['2. Remove the example row (MIL001)'],
      ['3. Save as CSV format'],
      ['4. Import using the Admin screen'],
      [''],
      ['Required Fields:'],
      ['- Employee ID: Must match existing employee'],
      ['- Date: YYYY-MM-DD format'],
      ['- Start Location: Starting address'],
      ['- End Location: Destination address'],
      ['- Purpose: Business purpose'],
      ['- Miles: Decimal number'],
      [''],
      ['Optional Fields:'],
      ['- Hours Worked: Decimal number'],
      ['- GPS Tracked: Yes/No'],
      ['- Notes: Additional information'],
    ];
    
    const instructionsSheet = XLSX.utils.aoa_to_sheet(instructionsData);
    XLSX.utils.book_append_sheet(workbook, instructionsSheet, 'Instructions');
    XLSX.utils.book_append_sheet(workbook, sheet, 'Mileage Template');
    
    const excelBuffer = XLSX.write(workbook, { type: 'base64', bookType: 'xlsx' });
    const filename = `Oxford_House_Mileage_Template.xlsx`;
    const fileUri = `${FileSystem.documentDirectory}${filename}`;
    
    await FileSystem.writeAsStringAsync(fileUri, excelBuffer, {
      encoding: FileSystem.EncodingType.Base64,
    });
    
    return fileUri;
  }
}


