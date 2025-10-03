// Simple Report Service - Generates basic Excel reports
import * as XLSX from 'xlsx';

export interface SimpleEmployeeData {
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

export class SimpleReportService {
  static async generateEmployeeReport(data: SimpleEmployeeData): Promise<ArrayBuffer> {
    // Sanitize data
    const sanitizedData = this.sanitizeData(data);

    // Create workbook
    const workbook = XLSX.utils.book_new();

    // Create summary sheet
    const summaryData = [
      ['Employee Report Summary'],
      [''],
      ['Employee Name:', sanitizedData.employeeName],
      ['Position:', sanitizedData.employeePosition],
      ['Cost Center:', sanitizedData.employeeCostCenter],
      ['Month:', sanitizedData.month],
      ['Year:', sanitizedData.year],
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

    // Generate Excel file
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    return excelBuffer;
  }

  private static sanitizeData(data: SimpleEmployeeData): SimpleEmployeeData {
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
      // Remove or replace problematic characters that can corrupt Excel
      // eslint-disable-next-line no-control-regex
      return value
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Remove control characters
        .replace(/\r\n/g, ' ') // Replace line breaks with spaces
        .replace(/\n/g, ' ')
        .replace(/\r/g, ' ')
        .replace(/[^\x20-\x7E]/g, '') // Remove non-printable ASCII characters
        .trim();
    }
    return String(value).trim();
  }

  private static sanitizeNumber(value: any): number {
    if (value === null || value === undefined) return 0;
    const num = Number(value);
    return isNaN(num) ? 0 : num;
  }

  private static formatDate(value: any): string {
    if (!value) return '';
    try {
      const date = new Date(value);
      if (isNaN(date.getTime())) return '';
      return date.toLocaleDateString();
    } catch {
      return '';
    }
  }

  private static sanitizeFileName(name: string): string {
    return name.replace(/[^a-zA-Z0-9_-]/g, '_').replace(/_+/g, '_');
  }
}
