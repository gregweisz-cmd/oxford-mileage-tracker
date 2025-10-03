// ExcelJS Report Service - Generates Excel reports using ExcelJS library
import ExcelJS from 'exceljs';

export interface EmployeeData {
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
}

export class ExcelJSReportService {
  static async generateEmployeeReport(data: EmployeeData): Promise<ArrayBuffer> {
    // Sanitize data
    const sanitizedData = this.sanitizeData(data);

    // Create workbook
    const workbook = new ExcelJS.Workbook();
    
    // Set workbook properties
    workbook.creator = 'Oxford Mileage Tracker';
    workbook.lastModifiedBy = 'Admin Portal';
    workbook.created = new Date();
    workbook.modified = new Date();

    // Create summary sheet
    const summarySheet = workbook.addWorksheet('Summary');
    
    // Add summary data
    summarySheet.addRow(['Employee Report Summary']);
    summarySheet.addRow([]);
    summarySheet.addRow(['Employee Name:', sanitizedData.employeeName]);
    summarySheet.addRow(['Position:', sanitizedData.employeePosition]);
    summarySheet.addRow(['Cost Center:', sanitizedData.employeeCostCenter]);
    summarySheet.addRow(['Month:', sanitizedData.month.toString()]);
    summarySheet.addRow(['Year:', sanitizedData.year.toString()]);
    summarySheet.addRow([]);
    summarySheet.addRow(['Total Miles:', sanitizedData.totalMiles.toString()]);
    summarySheet.addRow(['Total Receipts:', sanitizedData.totalReceipts.toString()]);
    summarySheet.addRow(['Total Hours:', sanitizedData.totalHours.toString()]);

    // Style the summary sheet
    summarySheet.getRow(1).font = { bold: true, size: 14 };
    summarySheet.getColumn(1).width = 20;
    summarySheet.getColumn(2).width = 30;

    // Create mileage entries sheet
    if (sanitizedData.mileageEntries.length > 0) {
      const mileageSheet = workbook.addWorksheet('Mileage Entries');
      
      // Add headers
      mileageSheet.addRow(['Date', 'Start Location', 'End Location', 'Purpose', 'Miles', 'Hours Worked']);
      
      // Style headers
      const headerRow = mileageSheet.getRow(1);
      headerRow.font = { bold: true };
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' }
      };

      // Add data
      sanitizedData.mileageEntries.forEach(entry => {
        mileageSheet.addRow([
          this.formatDate(entry.date),
          this.sanitizeString(entry.startLocation),
          this.sanitizeString(entry.endLocation),
          this.sanitizeString(entry.purpose),
          this.sanitizeNumber(entry.miles),
          this.sanitizeNumber(entry.hoursWorked)
        ]);
      });

      // Auto-fit columns
      mileageSheet.columns.forEach(column => {
        column.width = Math.max(column.width || 10, 15);
      });
    }

    // Create receipts sheet
    if (sanitizedData.receipts.length > 0) {
      const receiptSheet = workbook.addWorksheet('Receipts');
      
      // Add headers
      receiptSheet.addRow(['Date', 'Vendor', 'Description', 'Category', 'Amount']);
      
      // Style headers
      const headerRow = receiptSheet.getRow(1);
      headerRow.font = { bold: true };
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' }
      };

      // Add data
      sanitizedData.receipts.forEach(receipt => {
        receiptSheet.addRow([
          this.formatDate(receipt.date),
          this.sanitizeString(receipt.vendor),
          this.sanitizeString(receipt.description),
          this.sanitizeString(receipt.category),
          this.sanitizeNumber(receipt.amount)
        ]);
      });

      // Auto-fit columns
      receiptSheet.columns.forEach(column => {
        column.width = Math.max(column.width || 10, 15);
      });
    }

    // Generate buffer
    const buffer = await workbook.xlsx.writeBuffer();
    return buffer as ArrayBuffer;
  }

  private static sanitizeData(data: EmployeeData): EmployeeData {
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
      mileageEntries: Array.isArray(data.mileageEntries) ? data.mileageEntries : [],
      receipts: Array.isArray(data.receipts) ? data.receipts : []
    };
  }

  private static sanitizeString(value: any): string {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string') {
      return value
        .replace(/[\x00-\x1F\x7F-\x9F]/g, '') // Remove control characters
        .replace(/\r\n/g, ' ') // Replace line breaks with spaces
        .replace(/\n/g, ' ')
        .replace(/\r/g, ' ')
        .trim()
        .substring(0, 1000); // Limit string length
    }
    return String(value).trim().substring(0, 1000);
  }

  private static sanitizeNumber(value: any): number {
    if (value === null || value === undefined) return 0;
    const num = Number(value);
    return isNaN(num) ? 0 : Math.max(0, Math.min(num, 999999)); // Limit number range
  }

  private static formatDate(value: any): string {
    if (!value) return '';
    try {
      const date = new Date(value);
      if (isNaN(date.getTime())) return '';
      return date.toLocaleDateString('en-US');
    } catch {
      return '';
    }
  }
}
