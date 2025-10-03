// Robust Excel Service - Generates Excel reports with minimal features to avoid corruption
import * as XLSX from 'xlsx';

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

export class RobustExcelService {
  static async generateEmployeeReport(data: EmployeeData): Promise<ArrayBuffer> {
    // Sanitize data
    const sanitizedData = this.sanitizeData(data);

    // Create workbook with minimal features
    const workbook = XLSX.utils.book_new();

    // Create summary sheet with basic data
    const summaryData = [
      ['Employee Report Summary'],
      [''],
      ['Employee Name:', sanitizedData.employeeName],
      ['Position:', sanitizedData.employeePosition],
      ['Cost Center:', sanitizedData.employeeCostCenter],
      ['Month:', sanitizedData.month.toString()],
      ['Year:', sanitizedData.year.toString()],
      [''],
      ['Total Miles:', sanitizedData.totalMiles.toString()],
      ['Total Receipts:', sanitizedData.totalReceipts.toString()],
      ['Total Hours:', sanitizedData.totalHours.toString()],
    ];

    const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');

    // Create mileage entries sheet
    if (sanitizedData.mileageEntries.length > 0) {
      const mileageHeaders = ['Date', 'Start Location', 'End Location', 'Purpose', 'Miles', 'Hours Worked'];
      const mileageData = sanitizedData.mileageEntries.map(entry => [
        this.formatDate(entry.date),
        this.sanitizeString(entry.startLocation),
        this.sanitizeString(entry.endLocation),
        this.sanitizeString(entry.purpose),
        this.sanitizeNumber(entry.miles).toString(),
        this.sanitizeNumber(entry.hoursWorked).toString(),
      ]);

      const mileageSheetData = [mileageHeaders, ...mileageData];
      const mileageSheet = XLSX.utils.aoa_to_sheet(mileageSheetData);
      XLSX.utils.book_append_sheet(workbook, mileageSheet, 'Mileage Entries');
    }

    // Create receipts sheet
    if (sanitizedData.receipts.length > 0) {
      const receiptHeaders = ['Date', 'Vendor', 'Description', 'Category', 'Amount'];
      const receiptData = sanitizedData.receipts.map(receipt => [
        this.formatDate(receipt.date),
        this.sanitizeString(receipt.vendor),
        this.sanitizeString(receipt.description),
        this.sanitizeString(receipt.category),
        this.sanitizeNumber(receipt.amount).toString(),
      ]);

      const receiptSheetData = [receiptHeaders, ...receiptData];
      const receiptSheet = XLSX.utils.aoa_to_sheet(receiptSheetData);
      XLSX.utils.book_append_sheet(workbook, receiptSheet, 'Receipts');
    }

    // Generate Excel file with minimal options
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    return excelBuffer;
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
      // Aggressive sanitization for robust Excel generation
      return value
        .replace(/[\x00-\x1F\x7F-\x9F]/g, '') // Remove all control characters
        .replace(/\r\n/g, ' ') // Replace line breaks with spaces
        .replace(/\n/g, ' ')
        .replace(/\r/g, ' ')
        .replace(/[^\x20-\x7E]/g, '') // Remove non-printable ASCII characters
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
