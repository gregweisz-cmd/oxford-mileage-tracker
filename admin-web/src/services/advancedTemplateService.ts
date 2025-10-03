// Advanced Template Service - Handles advanced Excel template processing
import * as XLSX from 'xlsx';

export interface EmployeeExpenseData {
  employeeId: string;
  employeeName: string;
  employeePosition: string;
  employeeCostCenter: string;
  month: number;
  year: number;
  totalMiles: number;
  totalReceipts: number;
  totalHours: number;
  mileageEntries: any[];
  receipts: any[];
  dailyOdometerReadings: any[];
  timeTracking: any[];
}

export class AdvancedTemplateService {
  private static templateCache: { [key: string]: XLSX.WorkBook } = {};

  static async uploadTemplate(arrayBuffer: ArrayBuffer, fileName: string): Promise<void> {
    try {
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      this.templateCache[fileName] = workbook;
      
      // Store template in localStorage for persistence
      const templateData = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
      localStorage.setItem('advancedTemplate', JSON.stringify(Array.from(templateData)));
      localStorage.setItem('templateFileName', fileName);
    } catch (error) {
      console.error('Error uploading template:', error);
      throw new Error('Failed to parse advanced template');
    }
  }

  static async generateEmployeeReport(data: EmployeeExpenseData): Promise<ArrayBuffer> {
    try {
      // Get template from cache or localStorage
      let templateWorkbook = this.getTemplateFromCache();
      
      if (!templateWorkbook) {
        throw new Error('No advanced template found. Please upload a template first.');
      }

      // Sanitize employee data
      const sanitizedData = this.sanitizeEmployeeData(data);

      // Clone the template workbook
      const newWorkbook = XLSX.utils.book_new();
      
      // Process each sheet in the template
      if (templateWorkbook) {
        const workbook = templateWorkbook; // Create a local reference to avoid null check issues
        workbook.SheetNames.forEach(sheetName => {
          const templateSheet = workbook.Sheets[sheetName];
          if (templateSheet) {
            // Clone the sheet
            const jsonData = XLSX.utils.sheet_to_json(templateSheet, { header: 1 }) as any[][];
            const newSheet = XLSX.utils.aoa_to_sheet(jsonData);
            
            // Replace placeholders
            this.replacePlaceholders(newSheet, sanitizedData);
            
            // Add the processed sheet to the workbook
            XLSX.utils.book_append_sheet(newWorkbook, newSheet, sheetName);
          }
        });
      }

      // Generate Excel file
      const excelBuffer = XLSX.write(newWorkbook, { bookType: 'xlsx', type: 'array' });
      return excelBuffer;
    } catch (error) {
      console.error('Error generating advanced report:', error);
      throw error;
    }
  }

  private static getTemplateFromCache(): XLSX.WorkBook | null {
    // Try to get from cache first
    const cachedTemplates = Object.keys(this.templateCache);
    if (cachedTemplates.length > 0) {
      return this.templateCache[cachedTemplates[0]];
    }

    // Try to get from localStorage
    try {
      const templateData = localStorage.getItem('advancedTemplate');
      if (templateData) {
        const arrayBuffer = new Uint8Array(JSON.parse(templateData));
        return XLSX.read(arrayBuffer, { type: 'array' });
      }
    } catch (error) {
      console.error('Error loading template from localStorage:', error);
    }

    return null;
  }

  private static replacePlaceholders(sheet: XLSX.WorkSheet, data: EmployeeExpenseData): void {
    const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1:A1');
    
    for (let row = range.s.r; row <= range.e.r; row++) {
      for (let col = range.s.c; col <= range.e.c; col++) {
        const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
        const cell = sheet[cellAddress];
        
        if (cell && cell.v && typeof cell.v === 'string') {
          const newValue = this.replacePlaceholderInCell(cell.v, data);
          if (newValue !== cell.v) {
            sheet[cellAddress] = { ...cell, v: this.sanitizeCellValue(newValue) };
          }
        }
      }
    }
  }

  private static replacePlaceholderInCell(cellValue: string, data: EmployeeExpenseData): string {
    let result = cellValue;

    // Employee information
    result = result.replace(/\{EMPLOYEE_NAME\}/g, this.sanitizeString(data.employeeName));
    result = result.replace(/\{EMPLOYEE_POSITION\}/g, this.sanitizeString(data.employeePosition));
    result = result.replace(/\{EMPLOYEE_COST_CENTER\}/g, this.sanitizeString(data.employeeCostCenter));
    result = result.replace(/\{MONTH\}/g, data.month.toString());
    result = result.replace(/\{YEAR\}/g, data.year.toString());
    
    // Date placeholders
    const lastDayOfMonth = new Date(data.year, data.month, 0).getDate();
    result = result.replace(/\{LAST_DAY_OF_MONTH\}/g, lastDayOfMonth.toString());

    // Summary totals
    result = result.replace(/\{TOTAL_MILES\}/g, data.totalMiles.toString());
    result = result.replace(/\{TOTAL_RECEIPTS\}/g, data.totalReceipts.toString());
    result = result.replace(/\{TOTAL_HOURS\}/g, data.totalHours.toString());

    // Receipt categories
    const receiptCategories = this.calculateReceiptCategories(data.receipts);
    result = result.replace(/\{PHONE_INTERNET_FAX\}/g, receiptCategories.phoneInternetFax.toString());
    result = result.replace(/\{EES\}/g, receiptCategories.ees.toString());
    result = result.replace(/\{POSTAGE\}/g, receiptCategories.postage.toString());
    result = result.replace(/\{PRINTING\}/g, receiptCategories.printing.toString());
    result = result.replace(/\{SUPPLIES\}/g, receiptCategories.supplies.toString());
    result = result.replace(/\{DEVICES\}/g, receiptCategories.devices.toString());
    result = result.replace(/\{AIRFARE\}/g, receiptCategories.airfare.toString());
    result = result.replace(/\{VEHICLE_RENTAL\}/g, receiptCategories.vehicleRental.toString());
    result = result.replace(/\{PARKING\}/g, receiptCategories.parking.toString());
    result = result.replace(/\{GROUND_TRANSPORTATION\}/g, receiptCategories.groundTransportation.toString());
    result = result.replace(/\{HOTEL\}/g, receiptCategories.hotel.toString());

    // Per diem
    const perDiem = this.calculatePerDiem(data.receipts);
    result = result.replace(/\{PER_DIEM\}/g, perDiem.toString());

    // Time tracking categories
    const timeCategories = this.calculateTimeCategories(data.timeTracking);
    result = result.replace(/\{GA_HOURS\}/g, timeCategories.gaHours.toString());
    result = result.replace(/\{HOLIDAY\}/g, timeCategories.holiday.toString());
    result = result.replace(/\{PTO\}/g, timeCategories.pto.toString());
    result = result.replace(/\{STD_LTD\}/g, timeCategories.stdLtd.toString());
    result = result.replace(/\{PFL_PFML\}/g, timeCategories.pflPfml.toString());

    // Daily odometer readings
    const odometerReadings = this.calculateOdometerReadings(data.dailyOdometerReadings);
    for (let day = 1; day <= 31; day++) {
      result = result.replace(new RegExp(`\\{ODOMETER_START_${day}\\}`, 'g'), odometerReadings[`start${day}`] || '');
      result = result.replace(new RegExp(`\\{ODOMETER_END_${day}\\}`, 'g'), odometerReadings[`end${day}`] || '');
    }

    return result;
  }

  private static calculateReceiptCategories(receipts: any[]): any {
    const categories = {
      phoneInternetFax: 0,
      ees: 0,
      postage: 0,
      printing: 0,
      supplies: 0,
      devices: 0,
      airfare: 0,
      vehicleRental: 0,
      parking: 0,
      groundTransportation: 0,
      hotel: 0
    };

    receipts.forEach(receipt => {
      const category = receipt.category?.toLowerCase() || '';
      const amount = this.sanitizeNumber(receipt.amount);

      if (category.includes('phone') || category.includes('internet') || category.includes('fax')) {
        categories.phoneInternetFax += amount;
      } else if (category.includes('ees')) {
        categories.ees += amount;
      } else if (category.includes('postage') || category.includes('shipping')) {
        categories.postage += amount;
      } else if (category.includes('printing') || category.includes('copying')) {
        categories.printing += amount;
      } else if (category.includes('supplies')) {
        categories.supplies += amount;
      } else if (category.includes('device')) {
        categories.devices += amount;
      } else if (category.includes('airfare') || category.includes('flight')) {
        categories.airfare += amount;
      } else if (category.includes('vehicle') || category.includes('rental')) {
        categories.vehicleRental += amount;
      } else if (category.includes('parking')) {
        categories.parking += amount;
      } else if (category.includes('ground') || category.includes('transportation')) {
        categories.groundTransportation += amount;
      } else if (category.includes('hotel') || category.includes('accommodation')) {
        categories.hotel += amount;
      }
    });

    return categories;
  }

  private static calculatePerDiem(receipts: any[]): number {
    return receipts
      .filter(receipt => receipt.category?.toLowerCase().includes('per diem'))
      .reduce((sum, receipt) => sum + this.sanitizeNumber(receipt.amount), 0);
  }

  private static calculateTimeCategories(timeTracking: any[]): any {
    const categories = {
      gaHours: 0,
      holiday: 0,
      pto: 0,
      stdLtd: 0,
      pflPfml: 0
    };

    timeTracking.forEach(entry => {
      const category = entry.category?.toLowerCase() || '';
      const hours = this.sanitizeNumber(entry.hours);

      if (category.includes('g&a') || category.includes('ga')) {
        categories.gaHours += hours;
      } else if (category.includes('holiday')) {
        categories.holiday += hours;
      } else if (category.includes('pto')) {
        categories.pto += hours;
      } else if (category.includes('std') || category.includes('ltd')) {
        categories.stdLtd += hours;
      } else if (category.includes('pfl') || category.includes('pfml')) {
        categories.pflPfml += hours;
      }
    });

    return categories;
  }

  private static calculateOdometerReadings(dailyReadings: any[]): any {
    const readings: any = {};

    dailyReadings.forEach(reading => {
      const day = new Date(reading.date).getDate();
      readings[`start${day}`] = this.sanitizeNumber(reading.startOdometerReading) || '';
      readings[`end${day}`] = this.sanitizeNumber(reading.endOdometerReading) || '';
    });

    return readings;
  }

  private static sanitizeEmployeeData(data: EmployeeExpenseData): EmployeeExpenseData {
    return {
      employeeId: this.sanitizeString(data.employeeId) || 'unknown',
      employeeName: this.sanitizeString(data.employeeName) || 'Unknown Employee',
      employeePosition: this.sanitizeString(data.employeePosition) || 'N/A',
      employeeCostCenter: this.sanitizeString(data.employeeCostCenter) || 'N/A',
      month: this.sanitizeNumber(data.month) || 1,
      year: this.sanitizeNumber(data.year) || new Date().getFullYear(),
      totalMiles: this.sanitizeNumber(data.totalMiles) || 0,
      totalReceipts: this.sanitizeNumber(data.totalReceipts) || 0,
      totalHours: this.sanitizeNumber(data.totalHours) || 0,
      mileageEntries: Array.isArray(data.mileageEntries) ? data.mileageEntries.map(entry => this.sanitizeMileageEntry(entry)) : [],
      receipts: Array.isArray(data.receipts) ? data.receipts.map(receipt => this.sanitizeReceipt(receipt)) : [],
      dailyOdometerReadings: Array.isArray(data.dailyOdometerReadings) ? data.dailyOdometerReadings : [],
      timeTracking: Array.isArray(data.timeTracking) ? data.timeTracking : []
    };
  }

  private static sanitizeMileageEntry(entry: any): any {
    if (!entry) return null;
    return {
      ...entry,
      startLocation: this.sanitizeString(entry.startLocation),
      endLocation: this.sanitizeString(entry.endLocation),
      purpose: this.sanitizeString(entry.purpose),
      miles: this.sanitizeNumber(entry.miles),
      hoursWorked: this.sanitizeNumber(entry.hoursWorked),
      date: entry.date ? new Date(entry.date) : new Date()
    };
  }

  private static sanitizeReceipt(receipt: any): any {
    if (!receipt) return null;
    return {
      ...receipt,
      vendor: this.sanitizeString(receipt.vendor),
      description: this.sanitizeString(receipt.description),
      category: this.sanitizeString(receipt.category),
      amount: this.sanitizeNumber(receipt.amount),
      date: receipt.date ? new Date(receipt.date) : new Date()
    };
  }

  private static sanitizeString(value: any): string {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string') {
      // Remove or replace problematic characters that can corrupt Excel
      // eslint-disable-next-line no-control-regex
      return value
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Remove control characters
        .replace(/\r\n/g, ' ') // Replace line breaks with spaces
        .replace(/\n/g, ' ')
        .replace(/\r/g, ' ')
        .trim();
    }
    return String(value).trim();
  }

  private static sanitizeNumber(value: any): number {
    if (value === null || value === undefined) return 0;
    const num = Number(value);
    return isNaN(num) ? 0 : Math.max(0, num); // Ensure non-negative numbers
  }

  private static sanitizeCellValue(value: any): any {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string') {
      // Limit string length to prevent Excel issues
      const sanitized = this.sanitizeString(value);
      return sanitized.length > 32767 ? sanitized.substring(0, 32767) : sanitized;
    }
    if (typeof value === 'number') {
      return this.sanitizeNumber(value);
    }
    if (value instanceof Date) {
      return value;
    }
    return String(value);
  }
}
