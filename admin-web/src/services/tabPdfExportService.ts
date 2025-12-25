import jsPDF from 'jspdf';
import { debugLog } from '../config/debug';

// Helper function to safely add text to PDF
function safeText(doc: jsPDF, text: any, x: number, y: number, options?: any) {
  const safeTextValue = text !== null && text !== undefined ? String(text) : '';
  doc.text(safeTextValue, x, y, options);
}

// Simple table generation without autoTable dependency
interface TableOptions {
  head?: string[][];
  body: string[][];
  startY?: number;
  styles?: any;
  headStyles?: any;
  alternateRowStyles?: any;
  sectionTitleStyles?: any;
}

// Enhanced table generation function with content-based sizing and pagination
function addSimpleTable(doc: jsPDF, options: TableOptions) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  
  let yPos = options.startY || 10;
  const cellHeight = 16; // Reduced cell height for better vertical fit
  const fontSize = options.styles?.fontSize || 8;
  
  // Calculate optimal column widths based on content
  const numColumns = options.head && options.head.length > 0 ? options.head[0].length : 
                    options.body && options.body.length > 0 ? options.body[0].length : 1;
  
  // Set minimum and maximum column widths for better page fit
  const minColumnWidth = 30;
  const maxColumnWidth = 80;
  
  // Calculate content-based column widths
  const columnWidths: number[] = [];
  
  // Start with minimum widths
  for (let i = 0; i < numColumns; i++) {
    columnWidths[i] = minColumnWidth;
  }
  
  // Check header content
  if (options.head && options.head.length > 0) {
    options.head[0].forEach((header, index) => {
      const textWidth = doc.getTextWidth(String(header)) + 10; // Add padding
      const validWidth = Math.max(minColumnWidth, Math.min(textWidth || minColumnWidth, maxColumnWidth));
      columnWidths[index] = Math.max(columnWidths[index], validWidth);
    });
  }
  
  // Check body content
  options.body.forEach(row => {
    row.forEach((cell, index) => {
      const textWidth = doc.getTextWidth(String(cell)) + 10; // Add padding
      const validWidth = Math.max(minColumnWidth, Math.min(textWidth || minColumnWidth, maxColumnWidth));
      columnWidths[index] = Math.max(columnWidths[index], validWidth);
    });
  });
  
  // Final validation - ensure all widths are valid
  columnWidths.forEach((width, index) => {
    if (!width || width <= 0 || isNaN(width)) {
      columnWidths[index] = minColumnWidth;
    }
  });
  
  // Calculate total table width
  let totalTableWidth = columnWidths.reduce((sum, width) => sum + width, 0);
  
  // Ensure table fits on page - if too wide, scale down proportionally
  const maxTableWidth = pageWidth - (margin * 2);
  if (totalTableWidth > maxTableWidth) {
    const scaleFactor = maxTableWidth / totalTableWidth;
    columnWidths.forEach((width, index) => {
      columnWidths[index] = Math.max(minColumnWidth, width * scaleFactor);
    });
    totalTableWidth = columnWidths.reduce((sum, width) => sum + width, 0);
  }
  
  // Center the table on the page
  const startX = Math.max(margin, (pageWidth - totalTableWidth) / 2);
  
  doc.setFontSize(fontSize);

  // Draw header with grid lines
  if (options.head && options.head.length > 0) {
    const headers = options.head[0];
    let xPos = startX;
    
    headers.forEach((header, index) => {
      const cellWidth = columnWidths[index];
      
      // Validate cell dimensions before drawing
      if (cellWidth > 0 && !isNaN(cellWidth) && cellHeight > 0 && !isNaN(cellHeight)) {
        // Draw cell background
        if (options.headStyles?.fillColor) {
          doc.setFillColor(options.headStyles.fillColor[0], options.headStyles.fillColor[1], options.headStyles.fillColor[2]);
          doc.rect(xPos, yPos, cellWidth, cellHeight, 'F');
        }
        
        // Draw cell border
        doc.setDrawColor(0, 0, 0);
        doc.rect(xPos, yPos, cellWidth, cellHeight);
        
        // Draw text
        doc.setTextColor(30, 30, 30);
        safeText(doc, header, xPos + 5, yPos + cellHeight/2 + 2);
      }
      xPos += cellWidth;
    });
    yPos += cellHeight;
  }

  // Draw body rows with grid lines and pagination
  options.body.forEach((row, rowIndex) => {
    // Check if we need a new page
    if (yPos + cellHeight > pageHeight - margin) {
      doc.addPage();
      yPos = margin;
    }
    
    let xPos = startX;
    
    // Check if this is a section title row (first cell is not empty and others are empty)
    const isSectionTitle = row[0] && row[0].trim() !== '' && 
                          row.slice(1).every(cell => !cell || cell.trim() === '');
    
    if (isSectionTitle) {
      // Draw section title with special styling
      const sectionTitleWidth = totalTableWidth;
      
      // Draw section title background
      if (options.sectionTitleStyles?.fillColor) {
        doc.setFillColor(options.sectionTitleStyles.fillColor[0], options.sectionTitleStyles.fillColor[1], options.sectionTitleStyles.fillColor[2]);
        doc.rect(startX, yPos, sectionTitleWidth, cellHeight, 'F');
      }
      
      // Draw section title border
      doc.setDrawColor(0, 0, 0);
      doc.rect(startX, yPos, sectionTitleWidth, cellHeight);
      
      // Draw section title text (centered)
      doc.setTextColor(30, 30, 30);
      doc.setFont('helvetica', 'bold');
      const textWidth = doc.getTextWidth(row[0]);
      const textX = startX + (sectionTitleWidth - textWidth) / 2;
      safeText(doc, row[0], textX, yPos + cellHeight/2 + 2);
      doc.setFont('helvetica', 'normal');
    } else {
      // Draw row background
      if (options.alternateRowStyles && rowIndex % 2 === 1) {
        if (options.alternateRowStyles.fillColor && totalTableWidth > 0 && !isNaN(totalTableWidth) && cellHeight > 0 && !isNaN(cellHeight)) {
          doc.setFillColor(options.alternateRowStyles.fillColor[0], options.alternateRowStyles.fillColor[1], options.alternateRowStyles.fillColor[2]);
          doc.rect(startX, yPos, totalTableWidth, cellHeight, 'F');
        }
      }

      // Draw cells with borders
      row.forEach((cell, cellIndex) => {
        const cellWidth = columnWidths[cellIndex];
        
        // Validate cell dimensions before drawing
        if (cellWidth > 0 && !isNaN(cellWidth) && cellHeight > 0 && !isNaN(cellHeight)) {
          // Draw cell border
          doc.setDrawColor(0, 0, 0);
          doc.rect(xPos, yPos, cellWidth, cellHeight);
          
          // Draw text
          doc.setTextColor(30, 30, 30);
          safeText(doc, cell, xPos + 5, yPos + cellHeight/2 + 2);
        }
        xPos += cellWidth;
      });
    }
    
    yPos += cellHeight;
  });

  return yPos;
}

interface EmployeeExpenseData {
  employeeId: string;
  name: string;
  month: string;
  year: number;
  dateCompleted: string;
  costCenters: string[];
  
  // Summary totals
  totalMiles: number;
  totalMileageAmount: number;
  totalReceipts: number;
  totalHours: number;
  
  // Daily travel data
  dailyEntries: DailyExpenseEntry[];
  
  // Receipt categories
  airRailBus: number;
  vehicleRentalFuel: number;
  parkingTolls: number;
  groundTransportation: number;
  hotelsAirbnb: number;
  perDiem: number;
  
  // Communication expenses
  phoneInternetFax: number;
  shippingPostage: number;
  printingCopying: number;
  
  // Supply expenses
  officeSupplies: number;
  eesSupplies: number;
  devices: number;
  
  // Other expenses
  otherExpenses: OtherExpense[];
  
  // Time tracking
  gaHours: number;
  holidayHours: number;
  ptoHours: number;
  stdLtdHours: number;
  pflPfmlHours: number;
  
  // Odometer readings
  dailyOdometerReadings: DailyOdometerReading[];
  
  // Signatures
  employeeSignature: string | null;
  supervisorSignature: string | null;
}

interface DailyExpenseEntry {
  date: string;
  startLocation: string;
  endLocation: string;
  purpose: string;
  miles: number;
  notes: string;
  hoursWorked: number;
}

interface OtherExpense {
  description: string;
  amount: number;
}

interface DailyOdometerReading {
  date: string;
  startReading: number;
  endReading: number;
}

interface ReceiptEntry {
  id: string;
  date: string;
  vendor: string;
  amount: number;
  category: string;
  description?: string;
}

interface TimeTrackingEntry {
  id: string;
  date: string;
  category: string;
  hours: number;
  description?: string;
}

export class TabPdfExportService {
  // Helper function to generate standardized filename
  private static generateFilename(employeeData: EmployeeExpenseData): string {
    const nameParts = employeeData.name.split(' ');
    const lastName = nameParts[nameParts.length - 1] || 'UNKNOWN';
    const firstName = nameParts[0] || 'UNKNOWN';
    const monthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    const monthIndex = monthNames.findIndex(month => month === employeeData.month.toUpperCase().substring(0, 3));
    const monthAbbr = monthIndex >= 0 ? monthNames[monthIndex] : employeeData.month.toUpperCase().substring(0, 3);
    const yearShort = employeeData.year.toString().slice(-2);
    return `${lastName.toUpperCase()},${firstName.toUpperCase()} EXPENSES ${monthAbbr}-${yearShort}.pdf`;
  }
  static exportApprovalCoverSheet(
    employeeData: EmployeeExpenseData,
    receipts: ReceiptEntry[],
    timeTracking: TimeTrackingEntry[]
  ): void {
    const doc = new jsPDF('landscape', 'pt', 'a4');
    
    // Header
    // Header - centered
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    safeText(doc,'MONTHLY EXPENSE REPORT APPROVAL COVER SHEET', 280, 40, { align: 'center' });
    doc.setFontSize(16);
    safeText(doc,'OXFORD HOUSE, INC.', 280, 65, { align: 'center' });
    doc.setFontSize(14);
    doc.setFont('helvetica', 'normal');
    safeText(doc,'1010 Wayne Ave. Suite # 300, Silver Spring, MD 20910', 280, 85, { align: 'center' });
    
    let yPos = 120;
    
    // Employee Information
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    safeText(doc,'EMPLOYEE INFORMATION', 50, yPos);
    yPos += 25;
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    safeText(doc,`Name: ${employeeData.name}`, 50, yPos);
    safeText(doc,`Employee ID: ${employeeData.employeeId}`, 300, yPos);
    safeText(doc,`Month/Year: ${employeeData.month} ${employeeData.year}`, 500, yPos);
    yPos += 20;
    
    safeText(doc,`Date Completed: ${employeeData.dateCompleted || new Date().toLocaleDateString()}`, 50, yPos);
    yPos += 30;
    
    // Cost Centers
    safeText(doc,'COST CENTERS:', 50, yPos);
    yPos += 20;
    employeeData.costCenters.forEach((center, index) => {
      safeText(doc,`${index + 1}.) ${center}`, 60, yPos);
      yPos += 15;
    });
    yPos += 10;
    
    // Summary Totals - Create a proper table
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    safeText(doc,'SUMMARY TOTALS', 50, yPos);
    yPos += 25;
    
    // Create summary table
    const summaryData = [
      ['Total Miles:', employeeData.totalMiles.toFixed(1)],
      ['Total Receipts:', `$${employeeData.totalReceipts.toFixed(2)}`],
      ['Total Amount:', `$${(employeeData.totalMileageAmount + employeeData.totalReceipts).toFixed(2)}`],
      ['Total Hours:', employeeData.totalHours.toFixed(1)]
    ];
    
    const summaryFinalY = addSimpleTable(doc, {
      head: [['Category', 'Amount']],
      body: summaryData,
      startY: yPos,
      styles: { fontSize: 10 },
      headStyles: { fillColor: [25, 118, 210] },
      alternateRowStyles: { fillColor: [245, 245, 245] },
    }) + 20;
    
    yPos = summaryFinalY;
    
    // Signatures
    doc.setFontSize(12);
    safeText(doc,'SIGNATURES:', 50, yPos);
    yPos += 25;
    
    // Signature boxes
    doc.rect(50, yPos, 150, 60);
    safeText(doc,'Employee Signature', 60, yPos - 5);
    
    doc.rect(250, yPos, 150, 60);
    safeText(doc,'Supervisor Signature', 260, yPos - 5);
    
    if (employeeData.employeeSignature) {
      try {
        doc.addImage(employeeData.employeeSignature, 'PNG', 60, yPos + 10, 130, 40);
      } catch (e) {
        safeText(doc,'Signature Present', 70, yPos + 30);
      }
    }
    
    if (employeeData.supervisorSignature) {
      try {
        doc.addImage(employeeData.supervisorSignature, 'PNG', 260, yPos + 10, 130, 40);
      } catch (e) {
        safeText(doc,'Signature Present', 270, yPos + 30);
      }
    }
    
    doc.save(this.generateFilename(employeeData));
  }

  static exportSummarySheet(
    employeeData: EmployeeExpenseData,
    receipts: ReceiptEntry[]
  ): void {
    const doc = new jsPDF('landscape', 'pt', 'a4');
    
    // Header - centered
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    safeText(doc,'Oxford House Expense Report', 280, 40, { align: 'center' });
    doc.setFontSize(14);
    safeText(doc,`Summary Sheet - ${employeeData.name} (${employeeData.month} ${employeeData.year})`, 280, 70, { align: 'center' });
    
    let yPos = 110;
    
    // Receipt Categories
    doc.setFontSize(12);
    safeText(doc,'RECEIPT CATEGORIES:', 50, yPos);
    yPos += 25;
    
    const receiptCategories = [
      ['Air/Rail/Bus', employeeData.airRailBus],
      ['Vehicle Rental/Fuel', employeeData.vehicleRentalFuel],
      ['Parking/Tolls', employeeData.parkingTolls],
      ['Ground Transportation', employeeData.groundTransportation],
      ['Hotels/Airbnb', employeeData.hotelsAirbnb],
      ['Per Diem', employeeData.perDiem],
      ['Phone/Internet/Fax', employeeData.phoneInternetFax],
      ['Shipping/Postage', employeeData.shippingPostage],
      ['Printing/Copying', employeeData.printingCopying],
      ['Office Supplies', employeeData.officeSupplies],
      ['EES Supplies', employeeData.eesSupplies],
      ['Devices', employeeData.devices],
    ];
    
    doc.setFontSize(10);
    receiptCategories.forEach(([category, amount]) => {
      safeText(doc,`${category}:`, 60, yPos);
      safeText(doc,`$${Number(amount).toFixed(2)}`, 300, yPos);
      yPos += 20;
    });
    
    yPos += 20;
    
    // Other Expenses
    if ((employeeData.otherExpenses || []).length > 0) {
      doc.setFontSize(12);
      safeText(doc,'Other Expenses:', 50, yPos);
      yPos += 25;
      
      doc.setFontSize(10);
      (employeeData.otherExpenses || []).forEach(expense => {
        safeText(doc,`${expense.description}:`, 60, yPos);
        safeText(doc,`$${Number(expense.amount).toFixed(2)}`, 300, yPos);
        yPos += 20;
      });
    }
    
    doc.save(this.generateFilename(employeeData));
  }

  static exportCostCenterTravel(employeeData: EmployeeExpenseData, costCenterIndex: number): void {
    const costCenter = (employeeData.costCenters || [])[costCenterIndex] || 'Unknown';
    const doc = new jsPDF('landscape', 'pt', 'a4');
    
    // Header - centered
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    safeText(doc,'Oxford House Expense Report', 280, 40, { align: 'center' });
    doc.setFontSize(14);
    safeText(doc,`Cost Center #${costCenterIndex + 1} Travel - ${employeeData.name}`, 280, 70, { align: 'center' });
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    safeText(doc,`Cost Center: ${costCenter}`, 280, 100, { align: 'center' });
    
    // Daily Entries Table with better formatting
    const tableData = (employeeData.dailyEntries || []).map(entry => [
      entry.date || '',
      entry.startLocation || '',
      entry.endLocation || '',
      entry.purpose || '',
      (entry.miles || 0).toString(),
      (entry.hoursWorked || 0).toString(),
      entry.notes || ''
    ]);
    
    const finalY = addSimpleTable(doc, {
      head: [['Date', 'Start Location', 'End Location', 'Purpose', 'Miles', 'Hours', 'Notes']],
      body: tableData,
      startY: 130,
      styles: { fontSize: 9 },
      headStyles: { fillColor: [25, 118, 210] },
      alternateRowStyles: { fillColor: [245, 245, 245] },
    }) + 20;
    doc.setFontSize(10);
    safeText(doc,`Total Miles: ${employeeData.totalMiles.toFixed(1)}`, 50, finalY);
    safeText(doc,`Total Hours: ${employeeData.totalHours.toFixed(1)}`, 200, finalY);
    safeText(doc,`Total Amount: $${employeeData.totalMileageAmount.toFixed(2)}`, 350, finalY);
    
    doc.save(this.generateFilename(employeeData));
  }

  static exportTimesheet(employeeData: EmployeeExpenseData, timeTracking: TimeTrackingEntry[]): void {
    const doc = new jsPDF('landscape', 'pt', 'a4');
    
    // Header - centered
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    safeText(doc,'Oxford House Expense Report', 280, 40, { align: 'center' });
    doc.setFontSize(14);
    safeText(doc,`Timesheet - ${employeeData.name} (${employeeData.month} ${employeeData.year})`, 280, 70, { align: 'center' });
    
    // Time Tracking Categories Summary
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    safeText(doc,'TIME TRACKING SUMMARY:', 50, 110);
    
    let yPos = 135;
    doc.setFontSize(10);
    
    const timeCategories = [
      ['G&A Hours', employeeData.gaHours],
      ['Holiday Hours', employeeData.holidayHours],
      ['PTO Hours', employeeData.ptoHours],
      ['STD/LTD Hours', employeeData.stdLtdHours],
      ['PFL/PFML Hours', employeeData.pflPfmlHours],
    ];
    
    timeCategories.forEach(([category, hours]) => {
      safeText(doc,`${category}:`, 60, yPos);
      safeText(doc,`${Number(hours).toFixed(1)} hours`, 250, yPos);
      yPos += 20;
    });
    
    yPos += 20;
    
    // Detailed Time Tracking Table
    if ((timeTracking || []).length > 0) {
      doc.setFontSize(12);
      safeText(doc,'DETAILED TIME ENTRIES:', 50, yPos);
      yPos += 15;
      
      const tableData = timeTracking.map(entry => [
        entry.date,
        entry.category,
        (entry.hours || 0).toString(),
        entry.description || ''
      ]);
      
      addSimpleTable(doc, {
        head: [['Date', 'Category', 'Hours', 'Description']],
        body: tableData,
        startY: yPos,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [25, 118, 210] },
        alternateRowStyles: { fillColor: [245, 245, 245] },
      });
    }
    
    // Daily Odometer Readings
    if ((employeeData.dailyOdometerReadings || []).length > 0) {
      const odometerFinalY = (doc as any).lastAutoTable ? (doc as any).lastAutoTable?.finalY || 200 + 20 : yPos + 50;
      
      doc.setFontSize(12);
      safeText(doc,'DAILY ODOMETER READINGS:', 50, odometerFinalY);
      
      const odometerTableData = (employeeData.dailyOdometerReadings || []).map(reading => [
        reading.date,
        (reading.startReading || 0).toString(),
        (reading.endReading || 0).toString(),
        (reading.endReading - reading.startReading).toFixed(1)
      ]);
      
      addSimpleTable(doc, {
        head: [['Date', 'Start Reading', 'End Reading', 'Daily Miles']],
        body: odometerTableData,
        startY: odometerFinalY + 15,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [76, 175, 80] },
        alternateRowStyles: { fillColor: [245, 245, 245] },
      });
    }
    
    doc.save(this.generateFilename(employeeData));
  }

  static exportReceiptManagement(receipts: ReceiptEntry[]): void {
    const doc = new jsPDF('landscape', 'pt', 'a4');
    
    // Header - centered
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    safeText(doc,'Oxford House Expense Report', 280, 40, { align: 'center' });
    doc.setFontSize(14);
    safeText(doc,'Receipt Management', 280, 70, { align: 'center' });
    
    if ((receipts || []).length === 0) {
      doc.setFontSize(12);
      doc.setFont('helvetica', 'normal');
      safeText(doc,'No receipts uploaded for this period.', 50, 120);
    } else {
      const tableData = receipts.map(receipt => [
        receipt.date,
        receipt.vendor,
        receipt.category,
        Number(receipt.amount).toFixed(2),
        receipt.description || ''
      ]);
      
      addSimpleTable(doc, {
        head: [['Date', 'Vendor', 'Category', 'Amount', 'Description']],
        body: tableData,
        startY: 100,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [156, 39, 176] },
        alternateRowStyles: { fillColor: [245, 245, 245] },
      });
      
      // Summary
      const totalAmount = receipts.reduce((sum, receipt) => sum + receipt.amount, 0);
      const finalY = (doc as any).lastAutoTable?.finalY || 200 + 20;
      doc.setFontSize(12);
      safeText(doc,`Total Receipt Amount: $${totalAmount.toFixed(2)}`, 50, finalY);
    }
    
    doc.save(`Receipt_Management_${new Date().toISOString().split('T')[0]}.pdf`);
  }

  static async exportAllTabsInOnePDF(
    employeeData: EmployeeExpenseData,
    receipts: ReceiptEntry[],
    timeTracking: TimeTrackingEntry[]
  ): Promise<void> {
    const doc = new jsPDF('landscape', 'pt', 'a4');
    
    // Page 1: Approval Cover Sheet
    await this.addApprovalCoverSheetPage(doc, employeeData, receipts, timeTracking);
    
    // Page 2: Summary Sheet
    await this.addSummarySheetPage(doc, employeeData, receipts);
    
    // Add Cost Center Travel Pages (one page per cost center)
    for (let i = 0; i < (employeeData.costCenters || []).length; i++) {
      await this.addCostCenterTravelPage(doc, employeeData, i);
    }
    
    // Add Timesheet Page
    await this.addTimesheetPage(doc, employeeData, timeTracking);
    
    // Add Receipt Management Page
    await this.addReceiptManagementPage(doc, receipts);
    
    // Save the complete PDF
    doc.save(this.generateFilename(employeeData));
    
    debugLog('Complete expense report PDF exported successfully!');
  }

  private static async addApprovalCoverSheetPage(
    doc: jsPDF,
    employeeData: EmployeeExpenseData,
    receipts: ReceiptEntry[],
    timeTracking: TimeTrackingEntry[]
  ): Promise<void> {
    // Header - exactly matching the screenshot
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    safeText(doc, 'MONTHLY EXPENSE REPORT APPROVAL COVER SHEET', 280, 40, { align: 'center' });
    
    doc.setFontSize(16);
    safeText(doc, 'OXFORD HOUSE, INC.', 280, 65, { align: 'center' });
    
    doc.setFontSize(14);
    doc.setFont('helvetica', 'normal');
    safeText(doc, '1010 Wayne Ave. Suite # 300', 280, 85, { align: 'center' });
    safeText(doc, 'Silver Spring, MD 20910', 280, 100, { align: 'center' });
    
    let yPos = 130;
    
    // Employee Information section - Left side matching screenshot
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    safeText(doc, `Name:`, 50, yPos);
    doc.setFont('helvetica', 'normal');
    safeText(doc, `${employeeData.name}`, 100, yPos);
    
    doc.setFont('helvetica', 'bold');
    safeText(doc,`Month:`, 50, yPos + 25);
    doc.setFont('helvetica', 'normal');
    safeText(doc,`${employeeData.month}, ${employeeData.year}`, 100, yPos + 25);

    doc.setFont('helvetica', 'bold');
    safeText(doc,`Date Completed:`, 50, yPos + 50);
    doc.setFont('helvetica', 'normal');
    safeText(doc,`${employeeData.dateCompleted || new Date().toLocaleDateString()}`, 150, yPos + 50);
    
    // Right column - Cost Centers matching screenshot
    doc.setFont('helvetica', 'bold');
    safeText(doc,`Cost Centers:`, 350, yPos);
    
    doc.setFont('helvetica', 'normal');
    const costCenters = employeeData.costCenters || [];
    for (let i = 0; i < 5; i++) {
      const center = costCenters[i] || 'n/a';
      safeText(doc,`${i + 1}.) ${center}`, 360, yPos + 25 + (i * 20));
    }
    
    yPos += 150;
    
    // Summary Totals - Create a proper table matching the screenshot
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    safeText(doc,'SUMMARY TOTALS', 50, yPos);
    yPos += 30;
    
    // Create summary table with proper formatting
    const summaryData = [
      ['Total Miles:', employeeData.totalMiles.toFixed(1)],
      ['Total Receipts:', `$${employeeData.totalReceipts.toFixed(2)}`],
      ['Total Amount:', `$${(employeeData.totalMileageAmount + employeeData.totalReceipts).toFixed(2)}`],
      ['Total Hours:', employeeData.totalHours.toFixed(1)]
    ];
    
    const summaryFinalY = addSimpleTable(doc, {
      head: [['Category', 'Amount']],
      body: summaryData,
      startY: yPos,
      styles: { fontSize: 10 },
      headStyles: { fillColor: [25, 118, 210] },
      alternateRowStyles: { fillColor: [245, 245, 245] },
    }) + 20;
    
    yPos = summaryFinalY;
    
    // Signatures
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    safeText(doc,'SIGNATURES:', 50, yPos);
    yPos += 30;
    
    // Signature boxes
    doc.setDrawColor(0, 0, 0);
    doc.rect(50, yPos, 150, 60);
    safeText(doc,'Employee Signature', 60, yPos - 5);
    
    doc.rect(250, yPos, 150, 60);
    safeText(doc,'Supervisor Signature', 260, yPos - 5);
    
    if (employeeData.employeeSignature) {
      try {
        doc.addImage(employeeData.employeeSignature, 'PNG', 60, yPos + 10, 130, 40);
      } catch (e) {
        safeText(doc,'Signature Present', 60, yPos + 30);
      }
    }
    
    if (employeeData.supervisorSignature) {
      try {
        doc.addImage(employeeData.supervisorSignature, 'PNG', 260, yPos + 10, 130, 40);
      } catch (e) {
        safeText(doc,'Signature Present', 260, yPos + 30);
      }
    }
  }

  private static async addSummarySheetPage(
    doc: jsPDF,
    employeeData: EmployeeExpenseData,
    receipts: ReceiptEntry[]
  ): Promise<void> {
    doc.addPage();
    
    // Header - exactly matching the screenshot
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    safeText(doc, 'MONTHLY EXPENSE REPORT SUMMARY SHEET', 280, 40, { align: 'center' });
    
    doc.setFontSize(16);
    safeText(doc, 'OXFORD HOUSE, INC.', 280, 65, { align: 'center' });
    
    doc.setFontSize(14);
    doc.setFont('helvetica', 'normal');
    safeText(doc, '1010 Wayne Ave. Suite # 300, Silver Spring, MD 20910', 280, 85, { align: 'center' });
    
    // Employee info - left aligned
    doc.setFontSize(12);
    safeText(doc, `Name: ${employeeData.name}`, 50, 120);
    safeText(doc, `Month: ${employeeData.month}, ${employeeData.year}`, 50, 140);
    safeText(doc, `Date Completed: ${employeeData.dateCompleted || new Date().toLocaleDateString()}`, 400, 120);
    
    let yPos = 170;
    
    // Cost Center Headers - Create the main expense table with A1 empty cell
    const costCenters = employeeData.costCenters || [];
    const costCenterHeaders = ['']; // Start with empty A1 cell
    for (let i = 0; i < 5; i++) {
      const center = costCenters[i] || '[N/A]';
      costCenterHeaders.push(`Cost Center #${i + 1} ${center}`);
    }
    costCenterHeaders.push('SUBTOTALS (by category)');
    
    // Create the main expense table data with section titles
    const expenseData = [
      // Travel Expenses section
      ['Transportation', '', '', '', '', '', ''], // Section title row
      ['Mileage', employeeData.totalMileageAmount.toFixed(2), '0.00', '0.00', '0.00', '0.00', employeeData.totalMileageAmount.toFixed(2)],
      ['Air / Rail / Bus', '0.00', '0.00', '0.00', '0.00', '0.00', '0.00'],
      ['Vehicle Rental / Fuel', '0.00', '0.00', '0.00', '0.00', '0.00', '0.00'],
      ['Parking / Tolls', '0.00', '0.00', '0.00', '0.00', '0.00', '0.00'],
      ['Ground Transportation', '0.00', '0.00', '0.00', '0.00', '0.00', '0.00'],
      ['Lodging', '0.00', '0.00', '0.00', '0.00', '0.00', '0.00'],
      ['Per Diem', employeeData.perDiem.toFixed(2), '0.00', '0.00', '0.00', '0.00', employeeData.perDiem.toFixed(2)],
      
      // Other Expenses section
      ['Other Expenses', '', '', '', '', '', ''], // Section title row
      
      // Communications section
      ['Communications', '', '', '', '', '', ''], // Section title row
      ['Phone / Internet / Fax', employeeData.phoneInternetFax.toFixed(2), '0.00', '0.00', '0.00', '0.00', employeeData.phoneInternetFax.toFixed(2)],
      ['Postage / Shipping', '0.00', '0.00', '0.00', '0.00', '0.00', '0.00'],
      ['Printing / Copying', '0.00', '0.00', '0.00', '0.00', '0.00', '0.00'],
      
      // Supplies section
      ['Supplies', '', '', '', '', '', ''], // Section title row
      ['Outreach Supplies', '0.00', '0.00', '0.00', '0.00', '0.00', '0.00'],
      ['', '0.00', '0.00', '0.00', '0.00', '0.00', '0.00'],
      
      // Subtotals by cost center
      ['SUBTOTALS (by cost center)', 
       (employeeData.totalMileageAmount + employeeData.perDiem + employeeData.phoneInternetFax).toFixed(2), 
       '0.00', '0.00', '0.00', '0.00', 
       (employeeData.totalMileageAmount + employeeData.perDiem + employeeData.phoneInternetFax).toFixed(2)]
    ];
    
    // Add Other Expenses entries to the table
    const otherExpenses = employeeData.otherExpenses || [];
    if (otherExpenses.length > 0) {
      otherExpenses.forEach((expense, index) => {
        expenseData.push([
          `Other Expenses ${index + 1}`,
          expense.amount.toFixed(2),
          '0.00',
          '0.00',
          '0.00',
          '0.00',
          expense.amount.toFixed(2)
        ]);
      });
    }
    
    const finalY = addSimpleTable(doc, {
      head: [costCenterHeaders],
      body: expenseData,
      startY: yPos,
      styles: { fontSize: 8 }, // Reduced font size for better fit
      headStyles: { fillColor: [25, 118, 210] },
      alternateRowStyles: { fillColor: [245, 245, 245] },
      sectionTitleStyles: { fillColor: [173, 216, 230] }, // Light blue background for section titles
    }) + 20;
    
    // Add Other Expenses descriptions below the table
    let descY = finalY;
    if (otherExpenses.length > 0) {
      doc.setFontSize(9);
      doc.setFont('helvetica', 'italic');
      otherExpenses.forEach((expense, index) => {
        if (expense.description) {
          safeText(doc, `Other Expenses ${index + 1}: ${expense.description}`, 60, descY);
          descY += 15;
        }
      });
    }
    
    // Add totals below the table (or below descriptions)
    const totalsY = otherExpenses.length > 0 && otherExpenses.some(e => e.description) ? descY + 10 : finalY;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    safeText(doc, 'Less Cash Advance:', 400, totalsY);
    safeText(doc, '$0.00', 500, totalsY);
    
    // Calculate grand total including other expenses
    const totalOtherExpenses = (employeeData.otherExpenses || []).reduce((sum, e) => sum + e.amount, 0);
    const grandTotal = employeeData.totalMileageAmount + employeeData.perDiem + employeeData.phoneInternetFax + totalOtherExpenses;
    
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    safeText(doc, 'GRAND TOTAL REQUESTED:', 400, totalsY + 20);
    safeText(doc, `$${grandTotal.toFixed(2)}`, 500, totalsY + 20);
    
    // Footer information
    const footerY = totalsY + 50;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    safeText(doc, `Payable to: ${employeeData.name}`, 50, footerY);
    safeText(doc, 'Base Address #1:', 50, footerY + 20);
    safeText(doc, 'City, State Zip:', 50, footerY + 40);
    safeText(doc, 'Signature:', 50, footerY + 60);
    safeText(doc, 'Date Signed:', 50, footerY + 80);
    safeText(doc, 'Base Address #2:', 50, footerY + 100);
    safeText(doc, 'City, State Zip:', 50, footerY + 120);
  }

  private static async addCostCenterTravelPage(
    doc: jsPDF,
    employeeData: EmployeeExpenseData,
    costCenterIndex: number
  ): Promise<void> {
    doc.addPage();
    
    const costCenter = (employeeData.costCenters || [])[costCenterIndex] || 'Unknown';
    
    // Header
    doc.setFontSize(18);
    safeText(doc,'Oxford House Expense Report', 50, 40);
    doc.setFontSize(14);
    safeText(doc,`Cost Center #${costCenterIndex + 1} Travel - ${employeeData.name}`, 50, 70);
    doc.setFontSize(12);
    safeText(doc,`Cost Center: ${costCenter}`, 50, 100);
    
    // Daily Entries Table
    const tableData = (employeeData.dailyEntries || []).map(entry => [
      entry.date,
      entry.startLocation,
      entry.endLocation,
      entry.purpose,
      (entry.miles || 0).toString(),
      (entry.hoursWorked || 0).toString(),
      entry.notes
    ]);
    
    addSimpleTable(doc, {
      head: [['Date', 'Start Location', 'End Location', 'Purpose', 'Miles', 'Hours', 'Notes']],
      body: tableData,
      startY: 130,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [25, 118, 210] },
      alternateRowStyles: { fillColor: [245, 245, 245] },
    });
    
    // Summary
    const finalY = (doc as any).lastAutoTable?.finalY || 200 + 20;
    doc.setFontSize(10);
    safeText(doc,`Total Miles: ${employeeData.totalMiles.toFixed(1)}`, 50, finalY);
    safeText(doc,`Total Hours: ${employeeData.totalHours.toFixed(1)}`, 200, finalY);
    safeText(doc,`Total Amount: $${employeeData.totalMileageAmount.toFixed(2)}`, 350, finalY);
  }

  private static async addTimesheetPage(
    doc: jsPDF,
    employeeData: EmployeeExpenseData,
    timeTracking: TimeTrackingEntry[]
  ): Promise<void> {
    doc.addPage();
    
    // Header
    doc.setFontSize(18);
    safeText(doc,'Oxford House Expense Report', 50, 40);
    doc.setFontSize(14);
    safeText(doc,`Timesheet - ${employeeData.name} (${employeeData.month} ${employeeData.year})`, 50, 70);
    
    // Time Tracking Categories Summary
    doc.setFontSize(12);
    safeText(doc,'TIME TRACKING SUMMARY:', 50, 110);
    
    let yPos = 135;
    doc.setFontSize(10);
    
    const timeCategories = [
      ['G&A Hours', employeeData.gaHours],
      ['Holiday Hours', employeeData.holidayHours],
      ['PTO Hours', employeeData.ptoHours],
      ['STD/LTD Hours', employeeData.stdLtdHours],
      ['PFL/PFML Hours', employeeData.pflPfmlHours],
    ];
    
    timeCategories.forEach(([category, hours]) => {
      safeText(doc,`${category}:`, 60, yPos);
      safeText(doc,`${Number(hours).toFixed(1)} hours`, 250, yPos);
      yPos += 20;
    });
    
    yPos += 20;
    
    // Detailed Time Tracking Table
    if ((timeTracking || []).length > 0) {
      doc.setFontSize(12);
      safeText(doc,'DETAILED TIME ENTRIES:', 50, yPos);
      yPos += 15;
      
      const tableData = timeTracking.map(entry => [
        entry.date,
        entry.category,
        (entry.hours || 0).toString(),
        entry.description || ''
      ]);
      
      addSimpleTable(doc, {
        head: [['Date', 'Category', 'Hours', 'Description']],
        body: tableData,
        startY: yPos,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [25, 118, 210] },
        alternateRowStyles: { fillColor: [245, 245, 245] },
      });
    }
    
    // Daily Odometer Readings
    if ((employeeData.dailyOdometerReadings || []).length > 0) {
      const odometerFinalY = (doc as any).lastAutoTable ? (doc as any).lastAutoTable?.finalY || 200 + 20 : yPos + 50;
      
      doc.setFontSize(12);
      safeText(doc,'DAILY ODOMETER READINGS:', 50, odometerFinalY);
      
      const odometerTableData = (employeeData.dailyOdometerReadings || []).map(reading => [
        reading.date,
        (reading.startReading || 0).toString(),
        (reading.endReading || 0).toString(),
        (reading.endReading - reading.startReading).toFixed(1)
      ]);
      
      addSimpleTable(doc, {
        head: [['Date', 'Start Reading', 'End Reading', 'Daily Miles']],
        body: odometerTableData,
        startY: odometerFinalY + 15,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [76, 175, 80] },
        alternateRowStyles: { fillColor: [245, 245, 245] },
      });
    }
  }

  private static async addReceiptManagementPage(
    doc: jsPDF,
    receipts: ReceiptEntry[]
  ): Promise<void> {
    doc.addPage();
    
    // Header
    doc.setFontSize(18);
    safeText(doc,'Oxford House Expense Report', 50, 40);
    doc.setFontSize(14);
    safeText(doc,'Receipt Management', 50, 70);
    
    if ((receipts || []).length === 0) {
      doc.setFontSize(12);
      safeText(doc,'No receipts uploaded for this period.', 50, 120);
    } else {
      const tableData = receipts.map(receipt => [
        receipt.date,
        receipt.vendor,
        receipt.category,
        Number(receipt.amount).toFixed(2),
        receipt.description || ''
      ]);
      
      addSimpleTable(doc, {
        head: [['Date', 'Vendor', 'Category', 'Amount', 'Description']],
        body: tableData,
        startY: 100,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [156, 39, 176] },
        alternateRowStyles: { fillColor: [245, 245, 245] },
      });
      
      // Summary
      const totalAmount = receipts.reduce((sum, receipt) => sum + receipt.amount, 0);
      const finalY = (doc as any).lastAutoTable?.finalY || 200 + 20;
      doc.setFontSize(12);
      safeText(doc,`Total Receipt Amount: $${totalAmount.toFixed(2)}`, 50, finalY);
    }
  }
}

export default TabPdfExportService;
