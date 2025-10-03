// CSV Report Service - Generates CSV reports
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

export class CsvReportService {
  static async generateEmployeeReport(data: EmployeeData): Promise<string> {
    const sanitizedData = this.sanitizeData(data);
    
    let csvContent = '';
    
    // Add header
    csvContent += 'Employee Report\n';
    csvContent += `Employee: ${sanitizedData.employeeName}\n`;
    csvContent += `Position: ${sanitizedData.employeePosition}\n`;
    csvContent += `Cost Center: ${sanitizedData.employeeCostCenter}\n`;
    csvContent += `Month: ${sanitizedData.month}\n`;
    csvContent += `Year: ${sanitizedData.year}\n`;
    csvContent += `Total Miles: ${sanitizedData.totalMiles}\n`;
    csvContent += `Total Receipts: $${sanitizedData.totalReceipts}\n`;
    csvContent += `Total Hours: ${sanitizedData.totalHours}\n\n`;

    // Add mileage entries
    if (sanitizedData.mileageEntries.length > 0) {
      csvContent += 'Mileage Entries\n';
      csvContent += 'Date,Start Location,End Location,Purpose,Miles,Hours Worked\n';
      
      sanitizedData.mileageEntries.forEach(entry => {
        csvContent += `${this.formatDate(entry.date)},${this.escapeCsv(entry.startLocation)},${this.escapeCsv(entry.endLocation)},${this.escapeCsv(entry.purpose)},${entry.miles},${entry.hoursWorked}\n`;
      });
      
      csvContent += '\n';
    }

    // Add receipts
    if (sanitizedData.receipts.length > 0) {
      csvContent += 'Receipts\n';
      csvContent += 'Date,Vendor,Description,Category,Amount\n';
      
      sanitizedData.receipts.forEach(receipt => {
        csvContent += `${this.formatDate(receipt.date)},${this.escapeCsv(receipt.vendor)},${this.escapeCsv(receipt.description)},${this.escapeCsv(receipt.category)},${receipt.amount}\n`;
      });
    }

    return csvContent;
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
      return value.trim();
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

  private static escapeCsv(value: any): string {
    if (value === null || value === undefined) return '';
    const str = String(value);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }
}
