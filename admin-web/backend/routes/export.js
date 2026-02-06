/**
 * Export Routes
 * Extracted from server.js for better organization
 * Includes: Excel export, PDF export, HTML to PDF conversion
 */

const express = require('express');
const router = express.Router();
const dbService = require('../services/dbService');
const config = require('../config');
const helpers = require('../utils/helpers');
const dateHelpers = require('../utils/dateHelpers');
const { debugLog, debugWarn, debugError } = require('../debug');
const XLSX = require('xlsx');
const { jsPDF } = require('jspdf');
const { PDFDocument } = require('pdf-lib');
const googleMapsService = require('../services/googleMapsService');

// Export data to Excel
router.get('/api/export/excel', (req, res) => {
  const db = dbService.getDb();
  const { type } = req.query;
  
  let query, filename;
  
  switch (type) {
    case 'employees':
      query = 'SELECT * FROM employees ORDER BY name';
      filename = 'employees.xlsx';
      break;
    case 'mileage':
      query = `
        SELECT me.*, e.name as employeeName, e.costCenter 
        FROM mileage_entries me 
        LEFT JOIN employees e ON me.employeeId = e.id 
        ORDER BY me.date DESC
      `;
      filename = 'mileage_entries.xlsx';
      break;
    case 'receipts':
      query = `
        SELECT r.*, e.name as employeeName, e.costCenter 
        FROM receipts r 
        LEFT JOIN employees e ON r.employeeId = e.id 
        ORDER BY r.date DESC
      `;
      filename = 'receipts.xlsx';
      break;
    default:
      res.status(400).json({ error: 'Invalid export type' });
      return;
  }

  db.all(query, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(workbook, worksheet, type);
    
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(excelBuffer);
  });
});

// Export individual expense report to Excel (matching PDF format)
router.get('/api/export/expense-report/:id', (req, res) => {
  const db = dbService.getDb();
  const { id } = req.params;
  
  debugLog(`📊 Exporting expense report to Excel: ${id}`);
  
  db.get('SELECT * FROM expense_reports WHERE id = ?', [id], (err, report) => {
    if (err) {
      debugError('❌ Database error:', err);
      res.status(500).json({ error: err.message });
      return;
    }
    
    if (!report) {
      res.status(404).json({ error: 'Report not found' });
      return;
    }
    
    try {
      const reportData = JSON.parse(report.reportData);
      
      // Create workbook
      const workbook = XLSX.utils.book_new();
      
      // Sheet 1: Approval Cover Sheet
      const approvalData = [
        ['MONTHLY EXPENSE REPORT APPROVAL COVER SHEET'],
        [''],
        ['OXFORD HOUSE, INC.'],
        ['1010 Wayne Ave. Suite # 300'],
        ['Silver Spring, MD 20910'],
        [''],
        ['Personal Information'],
        ['Name:', reportData.name || 'N/A'],
        ['Month:', `${reportData.month}, ${reportData.year}`],
        ['Date Completed:', new Date().toLocaleDateString()],
        [''],
        ['Cost Centers:'],
        ['#', 'Cost Center'],
        ...(reportData.costCenters || []).map((center, index) => [`${index + 1}.`, center]),
        [''],
        ['SUMMARY TOTALS'],
        ['Total Miles:', `${(reportData.totalMiles || 0).toFixed(1)}`],
        ['Total Mileage Amount:', `$${(reportData.totalMileageAmount || 0).toFixed(2)}`],
        ['Total Hours:', `${(reportData.totalHours || 0).toFixed(1)}`],
        ['Total Expenses:', `$${((reportData.totalMileageAmount || 0) + (reportData.perDiem || 0) + (reportData.phoneInternetFax || 0)).toFixed(2)}`],
        [''],
        ['CERTIFICATION STATEMENT:'],
        ['By signing and submitting this report to Oxford House, Inc., I certify under penalty of perjury that the pages herein document genuine, valid, and necessary expenditures, as well as an accurate record of my time and travel on behalf of Oxford House, Inc.'],
        [''],
        [`Employee Acknowledgment: ${reportData.employeeCertificationAcknowledged ? '✓ Yes' : '☐ No'}`],
        [`Supervisor Acknowledgment: ${reportData.supervisorCertificationAcknowledged ? '✓ Yes' : '☐ No'}`],
        [''],
        ['SIGNATURES:'],
        ['Employee Signature', 'Supervisor Signature'],
        ['', ''],
        ['', ''],
        ['', '']
      ];
      const approvalSheet = XLSX.utils.aoa_to_sheet(approvalData);
      XLSX.utils.book_append_sheet(workbook, approvalSheet, 'Approval Cover Sheet');
      
      // Sheet 2: Summary Sheet
      const summaryData = [
        ['', 'Cost Center #1', 'Cost Center #2', 'Cost Center #3', 'Cost Center #4', 'Cost Center #5', 'SUBTOTALS (by category)'],
        ['MILEAGE', `$${(reportData.totalMileageAmount || 0).toFixed(2)}`, '$0.00', '$0.00', '$0.00', '$0.00', `$${(reportData.totalMileageAmount || 0).toFixed(2)}`],
        ['AIR / RAIL / BUS', `$${(reportData.airRailBus || 0).toFixed(2)}`, '$0.00', '$0.00', '$0.00', '$0.00', `$${(reportData.airRailBus || 0).toFixed(2)}`],
        ['VEHICLE RENTAL / FUEL', `$${(reportData.vehicleRentalFuel || 0).toFixed(2)}`, '$0.00', '$0.00', '$0.00', '$0.00', `$${(reportData.vehicleRentalFuel || 0).toFixed(2)}`],
        ['PARKING / TOLLS', `$${(reportData.parkingTolls || 0).toFixed(2)}`, '$0.00', '$0.00', '$0.00', '$0.00', `$${(reportData.parkingTolls || 0).toFixed(2)}`],
        ['GROUND', `$${(reportData.groundTransportation || 0).toFixed(2)}`, '$0.00', '$0.00', '$0.00', '$0.00', `$${(reportData.groundTransportation || 0).toFixed(2)}`],
        ['LODGING', `$${(reportData.hotelsAirbnb || 0).toFixed(2)}`, '$0.00', '$0.00', '$0.00', '$0.00', `$${(reportData.hotelsAirbnb || 0).toFixed(2)}`],
        ['PER DIEM', `$${(reportData.perDiem || 0).toFixed(2)}`, '$0.00', '$0.00', '$0.00', '$0.00', `$${(reportData.perDiem || 0).toFixed(2)}`],
        ['OTHER EXPENSES', '$0.00', '$0.00', '$0.00', '$0.00', '$0.00', '$0.00'],
        ['OXFORD HOUSE E.E.S.', '$0.00', '$0.00', '$0.00', '$0.00', '$0.00', '$0.00'],
        ['', '$0.00', '$0.00', '$0.00', '$0.00', '$0.00', '$0.00'],
        ['COMMUNICATIONS', '$0.00', '$0.00', '$0.00', '$0.00', '$0.00', '$0.00'],
        ['Phone / Internet / Fax', `$${(reportData.phoneInternetFax || 0).toFixed(2)}`, '$0.00', '$0.00', '$0.00', '$0.00', `$${(reportData.phoneInternetFax || 0).toFixed(2)}`],
        ['Postage / Shipping', '$0.00', '$0.00', '$0.00', '$0.00', '$0.00', '$0.00'],
        ['Printing / Copying', '$0.00', '$0.00', '$0.00', '$0.00', '$0.00', '$0.00'],
        ['SUPPLIES', '$0.00', '$0.00', '$0.00', '$0.00', '$0.00', '$0.00'],
        ['Outreach Supplies', '$0.00', '$0.00', '$0.00', '$0.00', '$0.00', '$0.00'],
        ['', '$0.00', '$0.00', '$0.00', '$0.00', '$0.00', '$0.00'],
        ['SUBTOTALS (by cost center)', `$${(reportData.totalMileageAmount || 0).toFixed(2)}`, '$0.00', '$0.00', '$0.00', '$0.00', `$${((reportData.totalMileageAmount || 0) + (reportData.phoneInternetFax || 0) + (reportData.airRailBus || 0) + (reportData.vehicleRentalFuel || 0) + (reportData.parkingTolls || 0) + (reportData.groundTransportation || 0) + (reportData.hotelsAirbnb || 0) + (reportData.perDiem || 0) + (reportData.other || 0)).toFixed(2)}`],
        ['Less Cash Advance', '$0.00', '$0.00', '$0.00', '$0.00', '$0.00', '$0.00'],
        [''],
        ['GRAND TOTAL', `$${((reportData.totalMileageAmount || 0) + (reportData.phoneInternetFax || 0) + (reportData.airRailBus || 0) + (reportData.vehicleRentalFuel || 0) + (reportData.parkingTolls || 0) + (reportData.groundTransportation || 0) + (reportData.hotelsAirbnb || 0) + (reportData.perDiem || 0) + (reportData.other || 0)).toFixed(2)}`],
        [''],
        ['Payable to:', reportData.name || 'N/A']
      ];
      const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary Sheet');
      
      // Sheet 3: Cost Center Travel Sheets
      const costCenters = reportData.costCenters || ['Program Services'];
      costCenters.forEach((costCenter, index) => {
        const month = new Date().getMonth() + 1;
        const year = new Date().getFullYear();
        const daysInMonth = new Date(year, month, 0).getDate();
        
        const ccData = [
          [`Cost Center Travel Sheet - ${costCenter}`],
          [''],
          ['Date', 'Description/Activity', 'Hours', 'Odometer Start', 'Odometer End', 'Miles', 'Mileage ($)']
        ];
        
        // Generate rows for all days of the month
        for (let day = 1; day <= daysInMonth; day++) {
          const dateStr = `${month.toString().padStart(2, '0')}/${day.toString().padStart(2, '0')}/${year.toString().slice(-2)}`;
          const entry = reportData.dailyEntries?.find(e => e.date === dateStr) || {};
          
          ccData.push([
            dateStr,
            entry.description || '',
            (entry.hoursWorked || 0).toString(),
            (entry.odometerStart || 0).toString(),
            (entry.odometerEnd || 0).toString(),
            (entry.milesTraveled || 0).toFixed(1),
            `$${(entry.mileageAmount || 0).toFixed(2)}`
          ]);
        }
        
        const ccSheet = XLSX.utils.aoa_to_sheet(ccData);
        XLSX.utils.book_append_sheet(workbook, ccSheet, `Cost Center ${index + 1}`);
      });
      
      // Sheet 4: Timesheet
      const month = new Date().getMonth() + 1;
      const year = new Date().getFullYear();
      const daysInMonth = new Date(year, month, 0).getDate();
      
      const timesheetData = [
        ['MONTHLY TIMESHEET'],
        [''],
        [`${reportData.name || 'N/A'} - ${reportData.month} ${reportData.year}`],
        [''],
        ['Date', 'Cost Center', 'Hours Worked']
      ];
      
      // Generate rows for all days of the month
      for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${month.toString().padStart(2, '0')}/${day.toString().padStart(2, '0')}/${year.toString().slice(-2)}`;
        const entry = reportData.dailyEntries?.find(e => e.date === dateStr) || {};
        
        timesheetData.push([
          dateStr,
          (reportData.costCenters && reportData.costCenters[0]) || 'N/A',
          (entry.hoursWorked || 0).toString()
        ]);
      }
      
      timesheetData.push(['']);
      timesheetData.push(['TIME TRACKING SUMMARY:']);
      timesheetData.push(['Category', 'Hours']);
      timesheetData.push(['G&A Hours', reportData.gaHours || 0]);
      timesheetData.push(['Holiday Hours', reportData.holidayHours || 0]);
      timesheetData.push(['PTO Hours', reportData.ptoHours || 0]);
      timesheetData.push(['STD/LTD Hours', reportData.stdLtdHours || 0]);
      timesheetData.push(['PFL/PFML Hours', reportData.pflPfmlHours || 0]);
      timesheetData.push(['Total Hours:', reportData.totalHours || 0]);
      
      const timesheetSheet = XLSX.utils.aoa_to_sheet(timesheetData);
      XLSX.utils.book_append_sheet(workbook, timesheetSheet, 'Timesheet');
      
      // Generate Excel file
      const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });
      
      const filename = `${reportData.name?.toUpperCase().replace(/\s+/g, ',') || 'UNKNOWN'} EXPENSES ${reportData.month?.substring(0, 3).toUpperCase() || 'UNK'}-${reportData.year?.toString().slice(-2) || 'XX'}.xlsx`;
      
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(excelBuffer);
      
      debugLog(`✅ Exported expense report to Excel: ${filename}`);
    } catch (parseError) {
      debugError('❌ Error parsing report data:', parseError);
      res.status(500).json({ error: 'Failed to parse report data' });
    }
  });
});

// Export individual expense report to PDF (matching Staff Portal format)
router.get('/api/export/expense-report-pdf/:id', async (req, res) => {
  const db = dbService.getDb();
  const { id } = req.params;
  const { mapViewMode } = req.query; // 'day' or 'costCenter'
  
  debugLog(`📊 Exporting expense report to PDF: ${id}, mapViewMode: ${mapViewMode || 'none'}`);
  
  // Helper function to check if user is finance team
  const isFinanceUser = async () => {
    try {
      const authHeader = req.headers.authorization;
      const token = authHeader?.replace('Bearer ', '') || req.query.token;
      
      debugLog(`🔐 Checking finance user - token present: ${!!token}, header: ${!!authHeader}`);
      
      if (!token) {
        debugLog('🔐 No token found in request');
        return false;
      }
      
      const employeeId = token.split('_')[1];
      if (!employeeId) {
        debugLog('🔐 Could not extract employee ID from token');
        return false;
      }
      
      debugLog(`🔐 Checking employee ID: ${employeeId}`);
      
      return new Promise((resolve) => {
        db.get('SELECT role FROM employees WHERE id = ?', [employeeId], (err, employee) => {
          if (err || !employee) {
            debugLog(`🔐 Employee not found or error: ${err?.message || 'not found'}`);
            resolve(false);
            return;
          }
          const isFinance = employee.role === 'finance' || employee.role === 'admin';
          debugLog(`🔐 Employee role: ${employee.role}, isFinance: ${isFinance}`);
          resolve(isFinance);
        });
      });
    } catch (error) {
      debugError('Error checking finance user:', error);
      return false;
    }
  };
  
  // Helper function to check if cost center has Google Maps enabled
  const isCostCenterMapsEnabled = (costCenterName) => {
    return new Promise((resolve) => {
      db.get('SELECT enableGoogleMaps FROM cost_centers WHERE name = ?', [costCenterName], (err, row) => {
        if (err || !row) {
          resolve(false);
          return;
        }
        resolve(row.enableGoogleMaps === 1);
      });
    });
  };
  
  db.get('SELECT * FROM expense_reports WHERE id = ?', [id], async (err, report) => {
    if (err) {
      debugError('❌ Database error:', err);
      res.status(500).json({ error: err.message });
      return;
    }
    
    if (!report) {
      res.status(404).json({ error: 'Report not found' });
      return;
    }
    
    try {
      const reportData = JSON.parse(report.reportData);
      
      // Create PDF in portrait mode with proper PDF version for printer compatibility
      // Disable compression for maximum printer driver compatibility (some drivers have issues with compressed PDFs)
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'pt',
        format: 'a4',
        compress: false, // Disable compression for better printer compatibility
        precision: 2 // Use standard precision (some drivers have issues with high precision)
      });
      
      // Set PDF metadata for proper printing
      doc.setProperties({
        title: `Expense Report - ${report.month}/${report.year}`,
        subject: 'Monthly Expense Report',
        author: 'Oxford House, Inc.',
        creator: 'Oxford House Expense Tracker',
        producer: 'Oxford House Expense Tracker',
        keywords: 'expense report, mileage, receipts'
      });
      
      // Ensure PDF uses standard fonts only (better printer compatibility)
      // jsPDF uses Helvetica by default which is standard and printer-compatible
      // Don't use custom fonts that might not be embedded properly
      
      // Set PDF version to 1.4 for maximum printer compatibility
      // This is done automatically by jsPDF, but we ensure it's set
      if (doc.internal && doc.internal.pdfVersion) {
        // Ensure PDF version is 1.4 (widely supported by printers)
        // jsPDF should handle this automatically
      }
      
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 40;
      
      // Helper function for safe text
      const safeText = (text, x, y, options) => {
        const safeTextValue = text !== null && text !== undefined ? String(text) : '';
        doc.text(safeTextValue, x, y, options);
      };
      
      // Helper function to set colors
      const setColor = (color) => {
        switch(color) {
          case 'lightGreen': doc.setFillColor(200, 255, 200); break;
          case 'lightBlue': doc.setFillColor(200, 220, 255); break;
          case 'lightOrange': doc.setFillColor(255, 220, 180); break;
          case 'darkBlue': doc.setFillColor(50, 50, 150); break;
          default: doc.setFillColor(255, 255, 255);
        }
      };
      
      // Page 1: Approval Cover Sheet
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      safeText('MONTHLY EXPENSE REPORT APPROVAL COVER SHEET', pageWidth / 2, 60, { align: 'center' });
      
      doc.setFontSize(14);
      safeText('OXFORD HOUSE, INC.', pageWidth / 2, 85, { align: 'center' });
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      safeText('1010 Wayne Ave. Suite # 300', pageWidth / 2, 105, { align: 'center' });
      safeText('Silver Spring, MD 20910', pageWidth / 2, 120, { align: 'center' });
      
      let yPos = 160;
      
      // Personal Information Table
      const personalInfoTableWidth = 300;
      const personalInfoTableStartX = (pageWidth - personalInfoTableWidth) / 2; // Center the table
      const personalInfoRowHeight = 20;
      const personalInfoLabelColWidth = 120; // Width for label column
      const personalInfoValueColWidth = 180; // Width for value column
      
      doc.setFontSize(11);
      const personalInfoItems = [
        ['Name:', reportData.name || 'N/A'],
        ['Month:', `${reportData.month}, ${reportData.year}`],
        ['Date Completed:', new Date().toLocaleDateString()]
      ];
      
      personalInfoItems.forEach(([label, value]) => {
        doc.setFont('helvetica', 'bold');
        setColor('white');
        doc.rect(personalInfoTableStartX, yPos, personalInfoLabelColWidth, personalInfoRowHeight, 'FD');
        doc.setTextColor(0, 0, 0);
        safeText(label, personalInfoTableStartX + 10, yPos + personalInfoRowHeight/2 + 3);
        
        doc.setFont('helvetica', 'normal');
        setColor('white');
        doc.rect(personalInfoTableStartX + personalInfoLabelColWidth, yPos, personalInfoValueColWidth, personalInfoRowHeight, 'FD');
        doc.setTextColor(0, 0, 0);
        safeText(value, personalInfoTableStartX + personalInfoLabelColWidth + 10, yPos + personalInfoRowHeight/2 + 3);
        yPos += personalInfoRowHeight;
      });
      
      yPos += 30;
      
      // Cost Centers Table
      const costCentersTableWidth = 300;
      const costCentersTableStartX = (pageWidth - costCentersTableWidth) / 2; // Center the table
      const costCentersRowHeight = 20;
      const costCentersNumberColWidth = 40; // Width for number column
      const costCentersNameColWidth = 260; // Width for name column
      
      doc.setFont('helvetica', 'bold');
      setColor('darkBlue');
      doc.rect(costCentersTableStartX, yPos, costCentersNumberColWidth, costCentersRowHeight, 'FD');
      doc.rect(costCentersTableStartX + costCentersNumberColWidth, yPos, costCentersNameColWidth, costCentersRowHeight, 'FD');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(11);
      safeText('#', costCentersTableStartX + 10, yPos + costCentersRowHeight/2 + 3);
      safeText('Cost Center', costCentersTableStartX + costCentersNumberColWidth + 10, yPos + costCentersRowHeight/2 + 3);
      yPos += costCentersRowHeight;
      
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(0, 0, 0);
      const costCenters = reportData.costCenters || [];
      costCenters.forEach((center, index) => {
        setColor('white');
        doc.rect(costCentersTableStartX, yPos, costCentersNumberColWidth, costCentersRowHeight, 'FD');
        doc.rect(costCentersTableStartX + costCentersNumberColWidth, yPos, costCentersNameColWidth, costCentersRowHeight, 'FD');
        safeText(`${index + 1}.`, costCentersTableStartX + 10, yPos + costCentersRowHeight/2 + 3);
        safeText(center, costCentersTableStartX + costCentersNumberColWidth + 10, yPos + costCentersRowHeight/2 + 3);
        yPos += costCentersRowHeight;
      });
      
      yPos += 30;
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      safeText('SUMMARY TOTALS', pageWidth / 2, yPos, { align: 'center' });
      yPos += 25;
      
      // Calculate dimensions for Summary Totals table
      const summaryTableWidth = 200;
      const summaryTableStartX = (pageWidth - summaryTableWidth) / 2; // Center the summary table
      const summaryRowHeight = 20;
      const summaryLabelColWidth = 120; // Width for label column
      const summaryValueColWidth = 80; // Width for value column
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      const summaryItems = [
        ['Total Miles:', `${Math.round(reportData.totalMiles || 0)}`],
        ['Total Mileage Amount:', `$${(reportData.totalMileageAmount || 0).toFixed(2)}`],
        ['Total Hours:', `${(reportData.totalHours || 0).toFixed(1)}`],
        ['Total Expenses:', `$${((reportData.totalMileageAmount || 0) + (reportData.perDiem || 0) + (reportData.phoneInternetFax || 0)).toFixed(2)}`]
      ];
      
      summaryItems.forEach(([label, value]) => {
        doc.setFont('helvetica', 'bold');
        setColor('white');
        doc.rect(summaryTableStartX, yPos, summaryLabelColWidth, summaryRowHeight, 'FD');
        doc.setTextColor(0, 0, 0);
        safeText(label, summaryTableStartX + 10, yPos + summaryRowHeight/2 + 3);
        
        doc.setFont('helvetica', 'normal');
        setColor('white');
        doc.rect(summaryTableStartX + summaryLabelColWidth, yPos, summaryValueColWidth, summaryRowHeight, 'FD');
        doc.setTextColor(0, 0, 0);
        safeText(value, summaryTableStartX + summaryLabelColWidth + 10, yPos + summaryRowHeight/2 + 3);
        yPos += summaryRowHeight;
      });
      
      yPos += 40;
      
      // Certification Statement
      const certificationStatement = "By signing and submitting this report to Oxford House, Inc., I certify under penalty of perjury that the pages herein document genuine, valid, and necessary expenditures, as well as an accurate record of my time and travel on behalf of Oxford House, Inc.";
      
      // Draw certification statement box (light pink background)
      const certBoxWidth = pageWidth - (margin * 2);
      const certBoxHeight = 60;
      const certBoxStartX = margin;
      doc.setFillColor(255, 240, 245); // Light pink
      doc.rect(certBoxStartX, yPos, certBoxWidth, certBoxHeight, 'FD');
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      
      // Wrap text to fit in box
      const maxWidth = certBoxWidth - 20;
      const certLines = doc.splitTextToSize(certificationStatement, maxWidth);
      let certY = yPos + 15;
      certLines.forEach((line) => {
        safeText(line, certBoxStartX + 10, certY);
        certY += 12;
      });
      
      yPos += certBoxHeight + 20;
      
      // Acknowledgment checkboxes
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      const checkboxSize = 8;
      const checkboxY = yPos;
      
      // Employee acknowledgment checkbox
      const employeeAcknowledged = reportData.employeeCertificationAcknowledged || false;
      doc.setFillColor(255, 255, 255);
      doc.rect(margin + 10, checkboxY, checkboxSize, checkboxSize, 'FD');
      if (employeeAcknowledged) {
        doc.setFillColor(0, 0, 0);
        doc.rect(margin + 12, checkboxY + 2, checkboxSize - 4, checkboxSize - 4, 'FD');
      }
      doc.setDrawColor(0, 0, 0);
      doc.rect(margin + 10, checkboxY, checkboxSize, checkboxSize, 'D');
      safeText('I have read and agree to the certification statement above', margin + 25, checkboxY + 7);
      
      yPos += 25;
      
      // Supervisor acknowledgment checkbox
      const supervisorAcknowledged = reportData.supervisorCertificationAcknowledged || false;
      doc.setFillColor(255, 255, 255);
      doc.rect(margin + 10, yPos, checkboxSize, checkboxSize, 'FD');
      if (supervisorAcknowledged) {
        doc.setFillColor(0, 0, 0);
        doc.rect(margin + 12, yPos + 2, checkboxSize - 4, checkboxSize - 4, 'FD');
      }
      doc.setDrawColor(0, 0, 0);
      doc.rect(margin + 10, yPos, checkboxSize, checkboxSize, 'D');
      safeText('Supervisor: I have read and agree to the certification statement above', margin + 25, yPos + 7);
      
      yPos += 40;
      
      doc.setFont('helvetica', 'bold');
      safeText('SIGNATURES:', pageWidth / 2, yPos, { align: 'center' });
      yPos += 25;
      
      // Calculate dimensions for Signatures table
      const signaturesTableWidth = 400;
      const signaturesTableStartX = (pageWidth - signaturesTableWidth) / 2; // Center the signatures table
      const signaturesRowHeight = 50;
      const signaturesColWidth = 200; // Width for each signature column
      
      // Draw header row
      doc.setFont('helvetica', 'bold');
      setColor('darkBlue');
      doc.rect(signaturesTableStartX, yPos, signaturesColWidth, 20, 'FD');
      doc.rect(signaturesTableStartX + signaturesColWidth, yPos, signaturesColWidth, 20, 'FD');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(10);
      safeText('Employee Signature', signaturesTableStartX + 10, yPos + 10);
      safeText('Supervisor Signature', signaturesTableStartX + signaturesColWidth + 10, yPos + 10);
      yPos += 20;
      
      // Draw signature boxes
      doc.setFont('helvetica', 'normal');
      setColor('white');
      doc.rect(signaturesTableStartX, yPos, signaturesColWidth, signaturesRowHeight, 'FD');
      doc.rect(signaturesTableStartX + signaturesColWidth, yPos, signaturesColWidth, signaturesRowHeight, 'FD');
      doc.setTextColor(0, 0, 0);
      
      // Add signature images if they exist
      const signatureImgWidth = 150; // Width for signature images
      const signatureImgHeight = 40; // Height for signature images
      const signatureImgPadding = 5; // Padding from box edges
      
      // Employee signature (left box)
      if (reportData.employeeSignature) {
        try {
          doc.addImage(
            reportData.employeeSignature,
            'PNG',
            signaturesTableStartX + signatureImgPadding,
            yPos + signatureImgPadding,
            signatureImgWidth,
            signatureImgHeight
          );
        } catch (err) {
          debugError('❌ Error adding employee signature:', err);
          // Signature box will remain empty if image fails to load
        }
      }
      
      // Supervisor signature (right box)
      if (reportData.supervisorSignature) {
        try {
          doc.addImage(
            reportData.supervisorSignature,
            'PNG',
            signaturesTableStartX + signaturesColWidth + signatureImgPadding,
            yPos + signatureImgPadding,
            signatureImgWidth,
            signatureImgHeight
          );
        } catch (err) {
          debugError('❌ Error adding supervisor signature:', err);
          // Signature box will remain empty if image fails to load
        }
      }
      
      // Page 2: Summary Sheet (with colors and grid like screenshot)
      debugLog(`📄 Before summary page: yPos=${yPos}, pageHeight=${pageHeight}`);
      // Calculate estimated space needed for summary section (title, 3 lines of info, table)
      const estimatedSummaryHeight = 40 + 60 + 300; // title + info + table estimate
      const remainingSpace = pageHeight - yPos - margin;
      
      // Only add page if we don't have enough space
      if (remainingSpace < estimatedSummaryHeight) {
        debugLog(`📄 Adding page for summary (remaining space ${remainingSpace.toFixed(0)} < ${estimatedSummaryHeight})`);
      doc.addPage();
      yPos = margin + 20;
      } else {
        // Continue on same page, just add some spacing
        yPos += 20;
        debugLog(`📄 Summary continuing on same page (remaining space ${remainingSpace.toFixed(0)}px, added spacing, yPos=${yPos})`);
      }
      debugLog(`📄 After summary page setup: yPos=${yPos}`);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      safeText('MONTHLY EXPENSE REPORT SUMMARY SHEET', pageWidth / 2, yPos, { align: 'center' });
      
      yPos += 40;
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      safeText(`Name: ${reportData.name || 'N/A'}`, margin, yPos);
      yPos += 20;
      safeText(`Date Completed: ${new Date().toLocaleDateString()}`, margin, yPos);
      yPos += 20;
      safeText(`Month: ${reportData.month}, ${reportData.year}`, margin, yPos);
      
      yPos += 40;
      
      // Helper function to draw table cell with color and border and text wrapping
      const drawCell = (x, y, width, height, text, color = 'white', textColor = 'black', align = 'left', wrapText = false) => {
        // Defensive guards to prevent jsPDF.rect invalid args
        if (!Number.isFinite(width) || width <= 0) {
          debugWarn('⚠️ drawCell: invalid width, substituting 10', { width, text });
          width = 10;
        }
        if (!Number.isFinite(height) || height <= 0) {
          debugWarn('⚠️ drawCell: invalid height, substituting 10', { height, text });
          height = 10;
        }
        if (!Number.isFinite(x)) x = tableStartX || 40;
        if (!Number.isFinite(y)) y = 40;
        // Set fill color
        setColor(color);
        
        // Set text color and font BEFORE drawing text
        if (textColor === 'white') {
          doc.setTextColor(255, 255, 255); // White text
        } else {
          doc.setTextColor(0, 0, 0); // Black text
        }
        doc.setFontSize(7); // Reduced from default 8 to 7 (~12.5% reduction)
        doc.setFont('helvetica', 'bold');
        
        let actualHeight = height; // Default to original height
        
        if (wrapText && text && text.length > 15) {
          // Calculate maximum characters that can fit in the cell width
          // Using font size 7, adjusted to be about 10px wider
          const maxCharsPerLine = Math.floor((width - 10) / 4.0); // 10px padding, ~4.0px per character at size 7
          
          // Split text into multiple lines for wrapping
          const words = text.split(' ');
          const lines = [];
          let currentLine = '';
          
          for (const word of words) {
            const testLine = currentLine ? `${currentLine} ${word}` : word;
            if (testLine.length <= maxCharsPerLine) {
              currentLine = testLine;
            } else {
              if (currentLine) lines.push(currentLine);
              currentLine = word;
            }
          }
          if (currentLine) lines.push(currentLine);
          
          // Calculate exact height needed: text content + one line height of padding
          const textHeight = 8 + (lines.length * 8) + 8; // 8px top padding + 8px per line + 8px bottom padding (one line height)
          actualHeight = textHeight; // Use exact calculated height, not Math.max
          
          // Draw filled rectangle with exact height
          doc.rect(x, y, width, actualHeight, 'FD'); // Fill and draw border
          
          // Draw multiple lines with original spacing
          lines.forEach((line, index) => {
            const lineY = y + 8 + (index * 8); // 8px top padding + 8px per line
            if (align === 'right') {
              safeText(line, x + width - 5, lineY);
            } else if (align === 'center') {
              safeText(line, x + width/2, lineY, { align: 'center' });
            } else {
              safeText(line, x + 5, lineY);
            }
          });
        } else {
          // Single line text - draw rectangle with original height
          doc.rect(x, y, width, height, 'FD'); // Fill and draw border
          
          if (align === 'right') {
            safeText(text, x + width - 5, y + height/2 + 3);
          } else if (align === 'center') {
            safeText(text, x + width/2, y + height/2 + 3, { align: 'center' });
          } else {
            safeText(text, x + 5, y + height/2 + 3);
          }
        }
        
        // Reset to black text color after drawing
        doc.setTextColor(0, 0, 0);
        return actualHeight; // Return actual height used
      };
      
      // Table dimensions - adjusted for portrait page with proper widths (downsized by ~20% total)
      const cellHeight = 16; // ~20% reduction from original 20
      // Base widths: [label, centers x N, subtotal]
      let colWidths = [96, 64, 64, 64, 64, 64, 80];
      const employeeCenters = (reportData.costCenters || []).slice(0, 5);
      const numCenters = employeeCenters.length;
      // Build dynamic widths to match number of assigned centers
      colWidths = [colWidths[0], ...Array(numCenters).fill(64), colWidths[colWidths.length - 1]];
      const tableWidth = colWidths.reduce((sum, width) => sum + width, 0);
      const tableStartX = (pageWidth - tableWidth) / 2; // Center the summary table
      
      // Header row - dynamic: show only this employee's assigned cost centers
      const headers = [''].concat(employeeCenters).concat(['SUBTOTALS (by category)']);
      let xPos = tableStartX;
      
      // Check if any header needs wrapping and calculate dynamic height
      let maxHeaderHeight = cellHeight;
      headers.forEach(header => {
        if (header.length > 15) {
          const words = header.split(' ');
          let lines = [];
          let currentLine = '';
          
          for (const word of words) {
            const testLine = currentLine ? `${currentLine} ${word}` : word;
            if (testLine.length <= 20) {
              currentLine = testLine;
            } else {
              if (currentLine) lines.push(currentLine);
              currentLine = word;
            }
          }
          if (currentLine) lines.push(currentLine);
          
          const headerHeight = cellHeight + (lines.length - 1) * 8 + 4; // 8px line spacing + 4px buffer
          maxHeaderHeight = Math.max(maxHeaderHeight, headerHeight);
        }
      });
      
      headers.forEach((header, i) => {
        const colWidth = colWidths[i] ?? 10;
        const needsWrapping = header.length > 15;
        drawCell(xPos, yPos, colWidth, maxHeaderHeight, header, 'darkBlue', 'white', 'center', needsWrapping);
        xPos += colWidth;
      });
      yPos += maxHeaderHeight;
      
      // Helper function to calculate amounts for a category from receipts
      const calculateCategoryAmounts = (categoryLabel, receiptCategoryMatches) => {
        const normalizeCategory = (c) => (c || '').toString().trim().toLowerCase().replace(/\s+/g, ' ').replace(/\s*\/\s*/g, ' / ');
        const matchingReceipts = (reportData.receipts || []).filter(r => {
          const cat = normalizeCategory(r.category);
          return receiptCategoryMatches.some(match => cat === normalizeCategory(match));
        });
        const total = matchingReceipts.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);
        
        // Distribute across visible cost center columns
        const centerTotals = Array(numCenters).fill(0);
        const normalizeName = (s) => (s || '').toString().trim().toLowerCase()
          .replace(/&/g, 'and').replace(/\./g, '').replace(/\s+/g, ' ');
        const centersList = (reportData.costCenters || []).slice(0, numCenters);
        const centersNorm = centersList.map(c => normalizeName(c));
        matchingReceipts.forEach(r => {
          const rc = r.costCenter || r.costCenterName || r.center || r.cc || '';
          let idx = centersNorm.indexOf(normalizeName(rc));
          // Fallbacks: if no match, default to first assigned center
          if (idx < 0) idx = 0;
          if (idx >= 0 && idx < centerTotals.length) {
            centerTotals[idx] += (parseFloat(r.amount) || 0);
          }
        });
        
        return [centerTotals, total];
      };
      
      // Travel expenses section (light green)
      const travelExpenses = [
        ['MILEAGE', reportData.totalMileageAmount || 0, 0, 0, 0, 0, reportData.totalMileageAmount || 0],
        ['AIR / RAIL / BUS', reportData.airRailBus || 0, 0, 0, 0, 0, reportData.airRailBus || 0],
        ['VEHICLE RENTAL / FUEL', reportData.vehicleRentalFuel || 0, 0, 0, 0, 0, reportData.vehicleRentalFuel || 0],
        ['PARKING / TOLLS', reportData.parkingTolls || 0, 0, 0, 0, 0, reportData.parkingTolls || 0],
        ['GROUND', reportData.groundTransportation || 0, 0, 0, 0, 0, reportData.groundTransportation || 0],
        ['LODGING', reportData.hotelsAirbnb || 0, 0, 0, 0, 0, reportData.hotelsAirbnb || 0],
        ['PER DIEM', reportData.perDiem || 0, 0, 0, 0, 0, reportData.perDiem || 0]
      ];
      
      travelExpenses.forEach(([category, ...amounts]) => {
        // Check for page break before drawing row
        if (yPos > pageHeight - 50) {
          doc.addPage();
          yPos = margin;
        }
        
        // Check if category needs wrapping and calculate required height
        const categoryNeedsWrapping = category.length > 15;
        let maxRowHeight = cellHeight;
        
        if (categoryNeedsWrapping) {
          // Use the same calculation as drawCell for consistency
          const maxCharsPerLine = Math.floor((colWidths[0] - 10) / 4.0); // 10px padding, ~4.0px per character at size 7
          
          const words = category.split(' ');
          let lines = [];
          let currentLine = '';
          
          for (const word of words) {
            const testLine = currentLine ? `${currentLine} ${word}` : word;
            if (testLine.length <= maxCharsPerLine) {
              currentLine = testLine;
            } else {
              if (currentLine) lines.push(currentLine);
              currentLine = word;
            }
          }
          if (currentLine) lines.push(currentLine);
          
          // Calculate height needed: text content + one line height of padding
          maxRowHeight = 8 + (lines.length * 8) + 8; // 8px top padding + 8px per line + 8px bottom padding
        }
        
        xPos = tableStartX;
        // All cells in the row should be the same height as the tallest cell
        drawCell(xPos, yPos, colWidths[0], maxRowHeight, category, 'lightGreen', 'black', 'left', categoryNeedsWrapping);
        xPos += colWidths[0];
        
        // Draw only assigned cost centers, then the subtotal column
        for (let i = 0; i < numCenters; i++) {
          const amount = amounts[i] || 0;
          drawCell(xPos, yPos, colWidths[i + 1], maxRowHeight, `$${amount.toFixed(2)}`, 'lightGreen', 'black', 'left');
          xPos += colWidths[i + 1];
        }
        // Subtotal is the last value in amounts
        const subtotal = amounts[amounts.length - 1] || 0;
        drawCell(xPos, yPos, colWidths[colWidths.length - 1], maxRowHeight, `$${subtotal.toFixed(2)}`, 'lightGreen', 'black', 'left');
        yPos += maxRowHeight;
      });
      
      // Other expenses section
      drawCell(tableStartX, yPos, colWidths[0], cellHeight, 'OTHER EXPENSES', 'lightBlue', 'black', 'left');
      xPos = tableStartX + colWidths[0];
      for (let i = 1; i < colWidths.length; i++) {
        drawCell(xPos, yPos, colWidths[i], cellHeight, '$0.00', 'lightBlue', 'black', 'left');
        xPos += colWidths[i];
      }
      yPos += cellHeight;
      
      // OXFORD HOUSE E.E.S. row
      drawCell(tableStartX, yPos, colWidths[0], cellHeight, 'OXFORD HOUSE E.E.S.', 'lightOrange', 'black', 'left');
      xPos = tableStartX + colWidths[0];
      for (let i = 1; i < colWidths.length; i++) {
        drawCell(xPos, yPos, colWidths[i], cellHeight, '$0.00', 'lightOrange', 'black', 'left');
        xPos += colWidths[i];
      }
      yPos += cellHeight;
      
      // Two blank rows under OTHER EXPENSES
      for (let blank = 0; blank < 2; blank++) {
        drawCell(tableStartX, yPos, colWidths[0], cellHeight, '', 'lightOrange', 'black', 'left');
        xPos = tableStartX + colWidths[0];
        for (let i = 1; i < colWidths.length; i++) {
          drawCell(xPos, yPos, colWidths[i], cellHeight, '$0.00', 'lightOrange', 'black', 'left');
          xPos += colWidths[i];
        }
        yPos += cellHeight;
      }
      
      // Communications section
      drawCell(tableStartX, yPos, colWidths[0], cellHeight, 'COMMUNICATIONS', 'lightBlue', 'black', 'left');
      xPos = tableStartX + colWidths[0];
      for (let i = 1; i < colWidths.length; i++) {
        drawCell(xPos, yPos, colWidths[i], cellHeight, '$0.00', 'lightBlue', 'black', 'left');
        xPos += colWidths[i];
      }
      yPos += cellHeight;
      
      // Phone / Internet / Fax
          const [phoneInternetFaxCenters, phoneInternetFaxTotal] = calculateCategoryAmounts(
            'Phone / Internet / Fax',
            ['Phone/Internet/Fax', 'Phone / Internet / Fax']
          );
          debugLog(`📦 Phone/Internet/Fax distribution`, { centers: phoneInternetFaxCenters, total: phoneInternetFaxTotal });

      drawCell(tableStartX, yPos, colWidths[0], cellHeight, 'Phone / Internet / Fax', 'lightOrange', 'black', 'left');
      xPos = tableStartX + colWidths[0];
          // Cost center columns (#1..numCenters)
          for (let i = 1; i <= numCenters; i++) {
            const val = phoneInternetFaxCenters[i - 1] || 0;
            drawCell(xPos, yPos, colWidths[i], cellHeight, `$${val.toFixed(2)}`, 'lightOrange', 'black', 'left');
        xPos += colWidths[i];
      }
          // Subtotals (by category) column
          drawCell(xPos, yPos, colWidths[colWidths.length - 1], cellHeight, `$${phoneInternetFaxTotal.toFixed(2)}`, 'lightOrange', 'black', 'left');
      yPos += cellHeight;
      
      // Postage / Shipping
      const [postageShippingCenters, postageShippingTotal] = calculateCategoryAmounts(
        'Postage / Shipping',
        ['Postage/Shipping', 'Postage / Shipping', 'Postage', 'Shipping']
      );
      drawCell(tableStartX, yPos, colWidths[0], cellHeight, 'Postage / Shipping', 'lightOrange', 'black', 'left');
      xPos = tableStartX + colWidths[0];
      for (let i = 1; i <= numCenters; i++) {
        const val = postageShippingCenters[i - 1] || 0;
        drawCell(xPos, yPos, colWidths[i], cellHeight, `$${val.toFixed(2)}`, 'lightOrange', 'black', 'left');
        xPos += colWidths[i];
      }
      drawCell(xPos, yPos, colWidths[colWidths.length - 1], cellHeight, `$${postageShippingTotal.toFixed(2)}`, 'lightOrange', 'black', 'left');
      yPos += cellHeight;
      
      // Printing / Copying
      const [printingCopyingCenters, printingCopyingTotal] = calculateCategoryAmounts(
        'Printing / Copying',
        ['Printing/Copying', 'Printing / Copying', 'Printing', 'Copying']
      );
      drawCell(tableStartX, yPos, colWidths[0], cellHeight, 'Printing / Copying', 'lightOrange', 'black', 'left');
      xPos = tableStartX + colWidths[0];
      for (let i = 1; i <= numCenters; i++) {
        const val = printingCopyingCenters[i - 1] || 0;
        drawCell(xPos, yPos, colWidths[i], cellHeight, `$${val.toFixed(2)}`, 'lightOrange', 'black', 'left');
        xPos += colWidths[i];
      }
      drawCell(xPos, yPos, colWidths[colWidths.length - 1], cellHeight, `$${printingCopyingTotal.toFixed(2)}`, 'lightOrange', 'black', 'left');
      yPos += cellHeight;
      
      // Supplies section
      drawCell(tableStartX, yPos, colWidths[0], cellHeight, 'SUPPLIES', 'lightBlue', 'black', 'left');
      xPos = tableStartX + colWidths[0];
      for (let i = 1; i < colWidths.length; i++) {
        drawCell(xPos, yPos, colWidths[i], cellHeight, '$0.00', 'lightBlue', 'black', 'left');
        xPos += colWidths[i];
      }
      yPos += cellHeight;
      
      // Outreach Supplies
      const [outreachSuppliesCenters, outreachSuppliesTotal] = calculateCategoryAmounts(
        'Outreach Supplies',
        ['Outreach Supplies', 'Office Supplies', 'Supplies']
      );
      drawCell(tableStartX, yPos, colWidths[0], cellHeight, 'Outreach Supplies', 'lightOrange', 'black', 'left');
      xPos = tableStartX + colWidths[0];
      for (let i = 1; i <= numCenters; i++) {
        const val = outreachSuppliesCenters[i - 1] || 0;
        drawCell(xPos, yPos, colWidths[i], cellHeight, `$${val.toFixed(2)}`, 'lightOrange', 'black', 'left');
        xPos += colWidths[i];
      }
      drawCell(xPos, yPos, colWidths[colWidths.length - 1], cellHeight, `$${outreachSuppliesTotal.toFixed(2)}`, 'lightOrange', 'black', 'left');
      yPos += cellHeight;
      
      // Blank row under SUPPLIES
      drawCell(tableStartX, yPos, colWidths[0], cellHeight, '', 'lightOrange', 'black', 'left');
      xPos = tableStartX + colWidths[0];
      for (let i = 1; i < colWidths.length; i++) {
        drawCell(xPos, yPos, colWidths[i], cellHeight, '$0.00', 'lightOrange', 'black', 'left');
        xPos += colWidths[i];
      }
      yPos += cellHeight;
      
      // Subtotals by cost center (light green)
      const totalExpenses = (reportData.totalMileageAmount || 0) + 
                           (reportData.airRailBus || 0) + (reportData.vehicleRentalFuel || 0) + 
                           (reportData.parkingTolls || 0) + (reportData.groundTransportation || 0) + 
                           (reportData.hotelsAirbnb || 0) + (reportData.perDiem || 0) + (reportData.other || 0) +
                           phoneInternetFaxTotal + postageShippingTotal + printingCopyingTotal + outreachSuppliesTotal;
      
      // Subtotals by cost center (light green) - with dynamic height for text wrapping
      const subtotalsText = 'SUBTOTALS (by cost center)';
      const subtotalsNeedsWrapping = subtotalsText.length > 15;
      let subtotalsRowHeight = cellHeight;
      
      if (subtotalsNeedsWrapping) {
        const words = subtotalsText.split(' ');
        let lines = [];
        let currentLine = '';
        
        for (const word of words) {
          const testLine = currentLine ? `${currentLine} ${word}` : word;
          if (testLine.length <= 20) {
            currentLine = testLine;
          } else {
            if (currentLine) lines.push(currentLine);
            currentLine = word;
          }
        }
        if (currentLine) lines.push(currentLine);
        
        subtotalsRowHeight = cellHeight + (lines.length - 1) * 8 + 4; // 8px line spacing + 4px buffer
      }
      
      // Calculate subtotals for each cost center column by summing all category amounts
      const costCenterSubtotals = [];
      for (let i = 0; i < numCenters; i++) {
        let columnTotal = 0;
        // Add mileage for this column (all mileage currently goes to first column)
        if (i === 0) {
          columnTotal += (reportData.totalMileageAmount || 0);
        }
        // Add receipt-based category amounts
        columnTotal += phoneInternetFaxCenters[i] || 0;
        columnTotal += postageShippingCenters[i] || 0;
        columnTotal += printingCopyingCenters[i] || 0;
        columnTotal += outreachSuppliesCenters[i] || 0;
        costCenterSubtotals.push(columnTotal);
      }
      
      drawCell(tableStartX, yPos, colWidths[0], subtotalsRowHeight, subtotalsText, 'lightGreen', 'black', 'left', subtotalsNeedsWrapping);
      xPos = tableStartX + colWidths[0];
      // Draw subtotals for each cost center column
      for (let i = 0; i < numCenters; i++) {
        drawCell(xPos, yPos, colWidths[i + 1], subtotalsRowHeight, `$${costCenterSubtotals[i].toFixed(2)}`, 'lightGreen', 'black', 'left');
        xPos += colWidths[i + 1];
      }
      // Draw grand total in subtotals column
      drawCell(xPos, yPos, colWidths[colWidths.length - 1], subtotalsRowHeight, `$${totalExpenses.toFixed(2)}`, 'lightGreen', 'black', 'left');
      yPos += subtotalsRowHeight;
      
      // Less Cash Advance (label in second-to-last column, value in subtotals column)
      // Leave first column blank
      drawCell(tableStartX, yPos, colWidths[0], cellHeight, '', 'lightGreen', 'black', 'left');
      xPos = tableStartX + colWidths[0];
      // Leave cost center columns blank until second-to-last
      for (let i = 0; i < numCenters - 1; i++) {
        drawCell(xPos, yPos, colWidths[i + 1], cellHeight, '', 'lightGreen', 'black', 'left');
        xPos += colWidths[i + 1];
      }
      // Put "Less Cash Advance" label in the second-to-last column (last cost center)
      drawCell(xPos, yPos, colWidths[numCenters], cellHeight, 'Less Cash Advance', 'lightGreen', 'black', 'left');
      xPos += colWidths[numCenters];
      // Show Less Cash Advance value in subtotals column (currently 0)
      drawCell(xPos, yPos, colWidths[colWidths.length - 1], cellHeight, '$0.00', 'lightGreen', 'black', 'left');
      yPos += cellHeight;
      
      // Grand Total (dark blue for label with white text, light blue for value) - aligned with columns
      yPos += 20;
      // GRAND TOTAL label spans all employee cost center columns; value is in the SUBTOTALS column
      const numCentersForGT = numCenters; // reuse computed count
      const sumWidths = (arr, start, end) => arr.slice(start, end).reduce((s, w) => s + w, 0);
      // Columns layout: [0]=Label, [1..numCenters]=Centers, [last]=Subtotal
      const centersStartX = tableStartX + colWidths[0];
      const centersTotalWidth = sumWidths(colWidths, 1, 1 + numCentersForGT);
      const grandTotalValueX = centersStartX + centersTotalWidth; // start of subtotal column
      const subtotalColWidth = colWidths[colWidths.length - 1];

      drawCell(centersStartX, yPos, centersTotalWidth, cellHeight, 'GRAND TOTAL', 'darkBlue', 'white', 'center');
      drawCell(grandTotalValueX, yPos, subtotalColWidth, cellHeight, `$${totalExpenses.toFixed(2)}`, 'lightBlue', 'black', 'left');
      
      yPos += 40;
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      
      // Start "Payable to" and cost center sheets on a fresh page
      // Calculate estimated space needed for first cost center (title + table header + at least a few rows)
      const estimatedCostCenterHeight = 100 + 30 + 200; // title + header + rows estimate
      const remainingSpaceForCC = pageHeight - yPos - margin;
      
      debugLog(`📄 Before cost center section: yPos=${yPos}, pageHeight=${pageHeight}, remaining=${remainingSpaceForCC.toFixed(0)}`);
      // Only add page if we don't have enough space for the cost center content
      if (remainingSpaceForCC < estimatedCostCenterHeight) {
        debugLog(`📄 Adding page for cost center section (remaining space ${remainingSpaceForCC.toFixed(0)} < ${estimatedCostCenterHeight})`);
        doc.addPage();
        yPos = margin + 20;
      } else {
        // Continue on same page, just add some spacing
        yPos += 20;
        debugLog(`📄 Cost center section continuing on same page (remaining space ${remainingSpaceForCC.toFixed(0)}px, added spacing, yPos=${yPos})`);
      }
      debugLog(`📄 After cost center page check: yPos=${yPos}`);
      
      safeText(`Payable to: ${reportData.name || 'N/A'}`, margin, yPos);
      yPos += 30;
      debugLog(`📄 After "Payable to": yPos=${yPos}`);
      
      
      // Page 3+: Cost Center Travel Sheets (with all days of month and grid)
      
      // Ensure we have at least one cost center sheet
      const costCentersToProcess = reportData.costCenters && reportData.costCenters.length > 0 
        ? reportData.costCenters 
        : ['Program Services']; // Default cost center if none provided
      
      // Track completion of all cost center sheets
      let costCenterSheetsCompleted = 0;
      const totalCostCenterSheets = costCentersToProcess.length;
      
      // Function to generate timesheet and finalize PDF (called after all cost center sheets are done)
      const generateTimesheetAndFinalizePDF = async () => {
        // Collectors for receipt media (must be in scope for async IIFE below)
        const pdfsToEmbed = [];
        const imagesToAdd = [];
        // Page Last: Timesheet (with grid layout showing cost centers and categories)
        debugLog(`📄 Starting timesheet section: yPos=${yPos}, pageHeight=${pageHeight}`);
        // Calculate estimated space needed for timesheet (title + table with multiple rows)
        const estimatedTimesheetHeight = 100 + 400; // title + table estimate
        const remainingSpaceForTS = pageHeight - yPos - margin;
        
        // Only add page if we don't have enough space
        if (remainingSpaceForTS < estimatedTimesheetHeight) {
          debugLog(`📄 Adding page for timesheet (remaining space ${remainingSpaceForTS.toFixed(0)} < ${estimatedTimesheetHeight})`);
          doc.addPage();
          yPos = margin + 20;
        } else {
          // Continue on same page, just add some spacing
          yPos += 20;
          debugLog(`📄 Timesheet continuing on same page (remaining space ${remainingSpaceForTS.toFixed(0)}px, added spacing, yPos=${yPos})`);
        }
        debugLog(`📄 After timesheet page check: yPos=${yPos}`);
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        safeText('MONTHLY TIMESHEET', pageWidth / 2, yPos, { align: 'center' });
        
        yPos += 30;
        doc.setFontSize(11);
        safeText(`${reportData.name || 'N/A'} - ${reportData.month} ${reportData.year}`, pageWidth / 2, yPos, { align: 'center' });
        
        yPos += 40;
        
        // Grid Timesheet dimensions - matching Oxford House FY 25/26 format
        // Grid: 80px (name) + 14px × 30 (days) + 70px (total) = 570px total width
        const gridCellHeight = 12;
        const gridNameColWidth = 80;
        const gridDayColWidth = 14;
        const gridTotalColWidth = 70;
        const gridDaysToShow = 30; // Show days 1-30 (we'll cap longer months at 30)
        
        const gridTotalWidth = gridNameColWidth + (gridDayColWidth * gridDaysToShow) + gridTotalColWidth;
        const gridStartX = (pageWidth - gridTotalWidth) / 2; // Center the grid
        
        // Generate month and year info
        let month = reportData.month;
        if (typeof month === 'string' && isNaN(parseInt(month))) {
          const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                             'July', 'August', 'September', 'October', 'November', 'December'];
          month = monthNames.indexOf(month) + 1;
        } else {
          month = parseInt(month);
        }
        const year = parseInt(reportData.year);
        const monthStr = month.toString().padStart(2, '0');
        const yearStr = year.toString();
        
        // Helper function for grid cells
        const drawGridCell = (x, y, width, height, text, color = 'white', textColor = 'black', align = 'center', fontSize = 6) => {
          setColor(color);
          doc.setDrawColor(0, 0, 0);
          doc.rect(x, y, width, height, 'FD');
          
          if (textColor === 'white') {
            doc.setTextColor(255, 255, 255);
          } else if (textColor === 'red') {
            doc.setTextColor(255, 0, 0);
          } else {
            doc.setTextColor(0, 0, 0);
          }
          
          doc.setFontSize(fontSize);
          doc.setFont('helvetica', 'bold');
          
          if (align === 'right') {
            safeText(text || '', x + width - 2, y + height/2 + 3);
          } else if (align === 'center') {
            safeText(text || '', x + width/2, y + height/2 + 3, { align: 'center' });
          } else {
            safeText(text || '', x + 2, y + height/2 + 3);
          }
          
          doc.setTextColor(0, 0, 0);
        };
        
        // Fetch detailed time tracking data by day and cost center
        const detailedTimeQuery = `
          SELECT date, costCenter, hours, category
          FROM time_tracking 
          WHERE employeeId = ? 
          AND strftime("%m", date) = ? 
          AND strftime("%Y", date) = ?
          ORDER BY date, costCenter
        `;
        
        db.all(detailedTimeQuery, [reportData.employeeId, monthStr, yearStr], (err, timeEntries) => {
          if (err) {
            debugError('❌ Error fetching detailed time tracking data:', err);
            timeEntries = [];
          }
          
          // Build data structure: costCenterDailyMap[costCenter][day] = hours
          // And categoryDailyMap[category][day] = hours
          const costCenterDailyMap = {};
          const categoryDailyMap = {
            'G&A': {},
            'HOLIDAY': {},
            'PTO': {},
            'STD/LTD': {},
            'PFL/PFML': {}
          };
          
          timeEntries.forEach(entry => {
            // Parse date to get day number
            let day;
            if (entry.date.includes('-')) {
              day = parseInt(entry.date.split('-')[2]);
            } else if (entry.date.includes('/')) {
              day = parseInt(entry.date.split('/')[1]);
            }
            
            if (day && day <= gridDaysToShow) {
              const hours = parseFloat(entry.hours) || 0;
              
              // Map by cost center
              if (entry.costCenter) {
                if (!costCenterDailyMap[entry.costCenter]) {
                  costCenterDailyMap[entry.costCenter] = {};
                }
                costCenterDailyMap[entry.costCenter][day] = (costCenterDailyMap[entry.costCenter][day] || 0) + hours;
              }
              
              // Map by category (if provided)
              if (entry.category && categoryDailyMap[entry.category]) {
                categoryDailyMap[entry.category][day] = (categoryDailyMap[entry.category][day] || 0) + hours;
              }
            }
          });
          
          // Use all assigned cost centers from the report, even if they have no hours
          const assignedCenters = (reportData.costCenters || []);
          const discoveredCenters = Object.keys(costCenterDailyMap);
          const costCenters = Array.from(new Set([ ...assignedCenters, ...discoveredCenters ])).filter(Boolean);
          
          // Draw header row: Name column + Days 1-30 + Total column
          let gridX = gridStartX;
          
          // Name column header (blank or label)
          drawGridCell(gridX, yPos, gridNameColWidth, gridCellHeight, '', 'darkBlue', 'white', 'center');
          gridX += gridNameColWidth;
          
          // Day number columns (1-30)
          for (let day = 1; day <= gridDaysToShow; day++) {
            drawGridCell(gridX, yPos, gridDayColWidth, gridCellHeight, day.toString(), 'darkBlue', 'white', 'center', 5);
            gridX += gridDayColWidth;
          }
          
          // Total column header
          drawGridCell(gridX, yPos, gridTotalColWidth, gridCellHeight, 'COST CENTER TOTAL', 'darkBlue', 'white', 'center');
          yPos += gridCellHeight;
          
          // Draw cost center rows
          costCenters.forEach(costCenter => {
            if (yPos > pageHeight - gridCellHeight * 10) {
              doc.addPage();
              yPos = margin + 20;
              // Redraw header row on new page
              let gridX = gridStartX;
              drawGridCell(gridX, yPos, gridNameColWidth, gridCellHeight, '', 'darkBlue', 'white', 'center');
              gridX += gridNameColWidth;
              for (let day = 1; day <= gridDaysToShow; day++) {
                drawGridCell(gridX, yPos, gridDayColWidth, gridCellHeight, day.toString(), 'darkBlue', 'white', 'center', 5);
                gridX += gridDayColWidth;
              }
              drawGridCell(gridX, yPos, gridTotalColWidth, gridCellHeight, 'COST CENTER TOTAL', 'darkBlue', 'white', 'center');
              yPos += gridCellHeight;
            }
            
            gridX = gridStartX;
            let rowTotal = 0;
            
            // Cost center name
            drawGridCell(gridX, yPos, gridNameColWidth, gridCellHeight, costCenter, 'white', 'black', 'left');
            gridX += gridNameColWidth;
            
            // Daily hours for this cost center
            for (let day = 1; day <= gridDaysToShow; day++) {
              const hours = (costCenterDailyMap[costCenter]?.[day]) || 0;
              rowTotal += hours;
              drawGridCell(gridX, yPos, gridDayColWidth, gridCellHeight, hours > 0 ? hours.toString() : '', 'white', 'black', 'center');
              gridX += gridDayColWidth;
            }
            
            // Cost center total
            drawGridCell(gridX, yPos, gridTotalColWidth, gridCellHeight, rowTotal > 0 ? rowTotal.toString() : '', 'white', 'black', 'center');
            yPos += gridCellHeight;
          });
          
          // BILLABLE HOURS totals row (sum of all cost center rows)
          if (yPos > pageHeight - gridCellHeight * 10) {
            doc.addPage();
            yPos = margin + 20;
          }
          
          gridX = gridStartX;
          let billableTotals = new Array(gridDaysToShow).fill(0);
          let billableGrandTotal = 0;
          
          costCenters.forEach(costCenter => {
            for (let day = 1; day <= gridDaysToShow; day++) {
              const hours = (costCenterDailyMap[costCenter]?.[day]) || 0;
              billableTotals[day - 1] += hours;
            }
          });
          billableGrandTotal = billableTotals.reduce((sum, val) => sum + val, 0);
          
          drawGridCell(gridX, yPos, gridNameColWidth, gridCellHeight, 'BILLABLE HOURS', 'lightGray', 'black', 'left');
          gridX += gridNameColWidth;
          
          for (let day = 1; day <= gridDaysToShow; day++) {
            const total = billableTotals[day - 1];
            drawGridCell(gridX, yPos, gridDayColWidth, gridCellHeight, total > 0 ? total.toString() : '', 'lightGray', 'black', 'center');
            gridX += gridDayColWidth;
          }
          
          drawGridCell(gridX, yPos, gridTotalColWidth, gridCellHeight, billableGrandTotal > 0 ? billableGrandTotal.toString() : '', 'lightGray', 'black', 'center');
          yPos += gridCellHeight;
          
          // Add spacing before categories
          yPos += 5;
          
          // Draw category rows (G&A, HOLIDAY, PTO, STD/LTD, PFL/PFML)
          const categories = ['G&A', 'HOLIDAY', 'PTO', 'STD/LTD', 'PFL/PFML'];
          
          categories.forEach(category => {
            if (yPos > pageHeight - gridCellHeight * 10) {
              doc.addPage();
              yPos = margin + 20;
            }
            
            gridX = gridStartX;
            let categoryTotals = new Array(gridDaysToShow).fill(0);
            let categoryGrandTotal = 0;
            
            // Calculate totals for this category
            for (let day = 1; day <= gridDaysToShow; day++) {
              categoryTotals[day - 1] = categoryDailyMap[category][day] || 0;
              categoryGrandTotal += categoryTotals[day - 1];
            }
            
            drawGridCell(gridX, yPos, gridNameColWidth, gridCellHeight, category, 'white', 'black', 'left');
            gridX += gridNameColWidth;
            
            for (let day = 1; day <= gridDaysToShow; day++) {
              const hours = categoryTotals[day - 1];
              drawGridCell(gridX, yPos, gridDayColWidth, gridCellHeight, hours > 0 ? hours.toString() : '', 'white', 'black', 'center');
              gridX += gridDayColWidth;
            }
            
            drawGridCell(gridX, yPos, gridTotalColWidth, gridCellHeight, categoryGrandTotal > 0 ? categoryGrandTotal.toString() : '', 'white', 'black', 'center');
            yPos += gridCellHeight;
          });
          
          // DAILY TOTALS row (sum of all rows above)
          if (yPos > pageHeight - gridCellHeight * 5) {
            doc.addPage();
            yPos = margin + 20;
          }
          
          gridX = gridStartX;
          let dailyTotals = new Array(gridDaysToShow).fill(0);
          let dailyGrandTotal = 0;
          
          // Sum all cost centers
          costCenters.forEach(costCenter => {
            for (let day = 1; day <= gridDaysToShow; day++) {
              dailyTotals[day - 1] += ((costCenterDailyMap[costCenter]?.[day]) || 0);
            }
          });
          
          // Sum all categories
          categories.forEach(category => {
            for (let day = 1; day <= gridDaysToShow; day++) {
              dailyTotals[day - 1] += (categoryDailyMap[category][day] || 0);
            }
          });
          
          dailyGrandTotal = dailyTotals.reduce((sum, val) => sum + val, 0);
          
          drawGridCell(gridX, yPos, gridNameColWidth, gridCellHeight, 'DAILY TOTALS', 'lightGray', 'black', 'left');
          gridX += gridNameColWidth;
          
          for (let day = 1; day <= gridDaysToShow; day++) {
            const total = dailyTotals[day - 1];
            drawGridCell(gridX, yPos, gridDayColWidth, gridCellHeight, total > 0 ? total.toString() : '', 'lightGray', 'black', 'center');
            gridX += gridDayColWidth;
          }
          
          drawGridCell(gridX, yPos, gridTotalColWidth, gridCellHeight, dailyGrandTotal > 0 ? dailyGrandTotal.toString() : '', 'lightGray', 'black', 'center');
          yPos += gridCellHeight;
          
          // GRAND TOTAL row
          if (yPos > pageHeight - gridCellHeight * 5) {
            doc.addPage();
            yPos = margin + 20;
          }
          
          drawGridCell(gridStartX, yPos, gridNameColWidth + (gridDayColWidth * gridDaysToShow), gridCellHeight, 'GRAND TOTAL', 'lightBlue', 'black', 'left');
          drawGridCell(gridStartX + gridNameColWidth + (gridDayColWidth * gridDaysToShow), yPos, gridTotalColWidth, gridCellHeight, dailyGrandTotal > 0 ? dailyGrandTotal.toString() : '', 'lightBlue', 'black', 'center');
          yPos += gridCellHeight;
          
          debugLog(`📄 Time tracking summary completed: yPos=${yPos}`);
        
          // Add Receipts section if there are any
          if (reportData.receipts && reportData.receipts.length > 0) {
            debugLog(`📄 Before receipts section: yPos=${yPos}, pageHeight=${pageHeight}`);
            // Always start receipts on a new page
            debugLog(`📄 Adding new page for receipts section`);
        doc.addPage();
        yPos = margin + 20;
        
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
          safeText('RECEIPTS', pageWidth / 2, yPos, { align: 'center' });
        
        yPos += 30;
        doc.setFontSize(11);
        safeText(`${reportData.name || 'N/A'} - ${reportData.month} ${reportData.year}`, pageWidth / 2, yPos, { align: 'center' });
        
        yPos += 40;
          
          // Receipts table
          const receiptColWidths = [70, 100, 80, 100, 150];
          const receiptHeaders = ['Date', 'Vendor', 'Amount', 'Category', 'Description'];
          const receiptTableWidth = receiptColWidths.reduce((sum, w) => sum + w, 0);
          const receiptTableStartX = (pageWidth - receiptTableWidth) / 2;
          
          // Header
          let xPos = receiptTableStartX;
          receiptHeaders.forEach((header, i) => {
            setColor('darkBlue');
            doc.rect(xPos, yPos, receiptColWidths[i], 15, 'FD');
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(7);
            safeText(header, xPos + receiptColWidths[i]/2, yPos + 10, { align: 'center' });
            xPos += receiptColWidths[i];
          });
          yPos += 15;
          
          // Helper function for receipt cells with text wrapping
          const drawReceiptCell = (x, y, width, height, text) => {
            setColor('white');
            doc.rect(x, y, width, height, 'FD');
            doc.setTextColor(0, 0, 0);
            doc.setFontSize(7);
            doc.setFont('helvetica', 'normal');
            
            const maxCharsPerLine = Math.floor((width - 6) / 3.5);
            const words = text.split(' ');
            let lines = [];
            let currentLine = '';
            
            for (const word of words) {
              const testLine = currentLine ? `${currentLine} ${word}` : word;
              if (testLine.length <= maxCharsPerLine) {
                currentLine = testLine;
              } else {
                if (currentLine) lines.push(currentLine);
                currentLine = word;
              }
            }
            if (currentLine) lines.push(currentLine);
            
            lines.forEach((line, index) => {
              safeText(line, x + 3, y + 6 + (index * 6));
            });
            
            return 6 + (lines.length * 6) + 6;
          };
          
          // Data rows
          debugLog(`📄 Starting receipts section: yPos=${yPos}, receipts count=${reportData.receipts?.length || 0}`);
          reportData.receipts.forEach((receipt, idx) => {
            const rawUri = receipt.imagePath || receipt.imageUrl || receipt.image || receipt.imageUri;
            if (rawUri) {
              const uriType = typeof rawUri === 'string' && rawUri.startsWith('data:application/pdf') ? 'PDF data URL' : typeof rawUri === 'string' && rawUri.startsWith('data:image/') ? 'image data URL' : 'path';
              debugLog(`📄 Receipt ${idx + 1} (id=${receipt.id}): imageUri type=${uriType}, length=${String(rawUri).length}`);
            } else {
              debugLog(`📄 Receipt ${idx + 1} (id=${receipt.id}): no imageUri`);
            }
            // Check if we need a new page for the receipt row
            if (yPos > pageHeight - 150) {
              debugLog(`📄 Adding page in receipts loop (receipt ${idx + 1}, yPos ${yPos} > ${pageHeight - 150})`);
              doc.addPage();
              yPos = margin;
            }
            
            const rowData = [
              receipt.date || '',
              receipt.vendor || '',
              receipt.amount ? `$${parseFloat(receipt.amount).toFixed(2)}` : '',
              receipt.category || '',
              receipt.description || ''
            ];
            
            let maxRowHeight = 15;
            rowData.forEach((data, i) => {
              const cellHeight = drawReceiptCell(receiptTableStartX + receiptColWidths.slice(0, i).reduce((sum, w) => sum + w, 0), yPos, receiptColWidths[i], 15, data);
              maxRowHeight = Math.max(maxRowHeight, cellHeight);
            });
            
            // Redraw all cells with uniform height
            xPos = receiptTableStartX;
            rowData.forEach((data, i) => {
              const actualHeight = drawReceiptCell(xPos, yPos, receiptColWidths[i], maxRowHeight, data);
              xPos += receiptColWidths[i];
            });
            
            yPos += maxRowHeight;

            // Collect receipt images to render after the table
            if (receipt.imagePath || receipt.imageUrl || receipt.image || receipt.imageUri) {
              try {
                const imagePath = receipt.imagePath || receipt.imageUrl || receipt.image || receipt.imageUri;
                const fs = require('fs');
                const path = require('path');
                
                // Use config.upload.directory (e.g. /data/uploads on Render persistent disk)
                const uploadsDir = config.upload.directory;
                if (typeof imagePath === 'string' && imagePath.startsWith('data:image/')) {
                  const base64Data = imagePath.split(',')[1];
                  const format = imagePath.includes('png') ? 'PNG' : 'JPEG';
                  imagesToAdd.push({ type: 'base64', data: base64Data, format });
                } else if (typeof imagePath === 'string' && imagePath.startsWith('data:application/pdf')) {
                  const base64Data = imagePath.split(',')[1];
                  if (base64Data) pdfsToEmbed.push({ type: 'base64', data: base64Data });
                } else {
                  let cleanPath = imagePath;
                  if (typeof imagePath === 'string' && imagePath.startsWith('file://')) {
                    cleanPath = imagePath.replace(/^file:\/\//, '');
                  }
                  let fullImagePath = null;
                  if (typeof cleanPath === 'string' && cleanPath.startsWith('/uploads/')) {
                    fullImagePath = path.join(uploadsDir, path.basename(cleanPath));
                  } else if (path.isAbsolute(cleanPath)) {
                    fullImagePath = cleanPath;
                  } else {
                    const uploadsPath = path.join(uploadsDir, cleanPath);
                    const uploadsSubPath = path.join(uploadsDir, 'test-receipts', cleanPath);
                    const hashPath = path.join(uploadsDir, path.basename(cleanPath));
                    const receiptsPath = path.join(__dirname, '..', 'receipts', cleanPath);
                    if (fs.existsSync(uploadsPath)) fullImagePath = uploadsPath;
                    else if (fs.existsSync(uploadsSubPath)) fullImagePath = uploadsSubPath;
                    else if (fs.existsSync(hashPath)) fullImagePath = hashPath;
                    else if (fs.existsSync(receiptsPath)) fullImagePath = receiptsPath;
                    else {
                      const filename = path.basename(cleanPath);
                      const filenamePath = path.join(uploadsDir, filename);
                      if (fs.existsSync(filenamePath)) fullImagePath = filenamePath;
                    }
                  }
                  if (fullImagePath && fs.existsSync(fullImagePath)) {
                    const ext = (path.extname(fullImagePath) || '').toLowerCase();
                    if (ext === '.pdf') {
                      pdfsToEmbed.push({ type: 'file', path: fullImagePath });
                    } else {
                      const format = ext === '.png' ? 'PNG' : 'JPEG';
                      imagesToAdd.push({ type: 'file', path: fullImagePath, format });
                    }
                  } else {
                    const triedPaths = [
                      path.isAbsolute(cleanPath) ? cleanPath : path.join(uploadsDir, cleanPath),
                      path.join(uploadsDir, 'test-receipts', cleanPath),
                      path.join(uploadsDir, path.basename(cleanPath)),
                      path.join(__dirname, '..', 'receipts', cleanPath)
                    ];
                    debugLog(`⚠️ Receipt image not found for receipt ${idx + 1} (deferring):`);
                    debugLog(`   Original path: ${imagePath}`);
                    debugLog(`   Cleaned path: ${cleanPath}`);
                    debugLog(`   Tried paths: ${triedPaths.join(', ')}`);
                  }
                }
              } catch (imageError) {
                debugError(`❌ Error preparing receipt image for receipt ${idx + 1}:`, imageError);
              }
            }
          });
          debugLog(`📄 Receipt media: ${imagesToAdd.length} image(s) to render, ${pdfsToEmbed.length} PDF(s) to embed`);
          // After table, render all images
          if (imagesToAdd.length > 0) {
            doc.addPage();
            yPos = margin + 20;
            doc.setFontSize(14);
            doc.setFont('helvetica', 'bold');
            safeText('RECEIPT IMAGES', pageWidth / 2, yPos, { align: 'center' });
            yPos += 30;
            const maxImageWidth = 200;
            const maxImageHeight = 150;
            const startX = margin;
            let xCursor = startX;
            let imagesPerRow = Math.floor((pageWidth - margin * 2) / (maxImageWidth + 20)) || 1;
            let col = 0;
            imagesToAdd.forEach((img, i) => {
              if (yPos > pageHeight - maxImageHeight - 40) {
                doc.addPage();
                yPos = margin + 20;
                col = 0;
                xCursor = startX;
              }
              try {
                if (img.type === 'placeholder') {
                  doc.setFillColor(240, 240, 240);
                  doc.rect(xCursor, yPos, maxImageWidth, maxImageHeight, 'F');
                  doc.setFontSize(10);
                  doc.text(img.label || 'Receipt', xCursor + maxImageWidth / 2, yPos + maxImageHeight / 2, { align: 'center' });
                } else if (img.type === 'base64') {
                  const format = img.format || 'JPEG';
                  doc.addImage(img.data, format, xCursor, yPos, maxImageWidth, maxImageHeight, undefined, 'FAST');
                } else {
                  const format = img.format || 'JPEG';
                  doc.addImage(img.path, format, xCursor, yPos, maxImageWidth, maxImageHeight, undefined, 'FAST');
                }
              } catch (e) {
                debugError('❌ Error drawing receipt image:', e);
              }
              col++;
              if (col >= imagesPerRow) {
                col = 0;
                xCursor = startX;
                yPos += maxImageHeight + 20;
              } else {
                xCursor += maxImageWidth + 20;
              }
            });
          }
          debugLog(`📄 Receipts section completed: yPos=${yPos}`);
        }
        
        // Generate filename matching Staff Portal format
        const nameParts = (reportData.name || 'UNKNOWN').split(' ');
        const lastName = nameParts[nameParts.length - 1] || 'UNKNOWN';
        const firstName = nameParts[0] || 'UNKNOWN';
        const monthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
        const monthIndex = parseInt(report.month) - 1;
        const monthAbbr = monthNames[monthIndex] || 'UNK';
        const yearShort = report.year.toString().slice(-2);
        const filename = `${lastName.toUpperCase()},${firstName.toUpperCase()} EXPENSES ${monthAbbr}-${yearShort}.pdf`;
        
        // Finalize PDF and get output - use 'arraybuffer' for best printer compatibility
        // Ensure all pages and resources are properly closed
        const numPages = doc.internal.getNumberOfPages();
        debugLog(`📄 Finalizing PDF with ${numPages} pages for printing`);
        
        // Force PDF finalization by accessing all pages
        for (let i = 1; i <= numPages; i++) {
          doc.setPage(i);
        }
        
        // Get PDF as arraybuffer (most compatible format for printing)
        // Disable compression was set above for better printer compatibility
        // Use 'arraybuffer' output which creates a standard PDF structure
        const pdfArrayBuffer = doc.output('arraybuffer');
        
        // Additional validation - ensure output is valid
        if (!pdfArrayBuffer || pdfArrayBuffer.byteLength === 0) {
          res.status(500).json({ error: 'PDF output is empty or invalid' });
          return;
        }
        
        debugLog(`✅ PDF arraybuffer generated: ${pdfArrayBuffer.byteLength} bytes`);
        
        // Helper function to send the final PDF (defined before use)
        const sendOptimizedPdf = (pdfBuffer) => {
          try {
            // Verify PDF buffer is valid and not empty
            if (!pdfBuffer || pdfBuffer.length === 0) {
              throw new Error('Failed to generate PDF buffer - buffer is empty');
            }
            
            // Verify minimum PDF size (a valid PDF should be at least a few KB)
            if (pdfBuffer.length < 1024) {
              throw new Error(`PDF buffer too small (${pdfBuffer.length} bytes) - PDF may be corrupted`);
            }
            
            // Verify PDF header (PDFs start with %PDF-)
            const pdfHeader = pdfBuffer.slice(0, 4).toString();
            if (pdfHeader !== '%PDF') {
              debugWarn(`⚠️ PDF header mismatch: Expected "%PDF", got "${pdfHeader}" - but continuing anyway`);
            } else {
              debugLog(`✅ PDF header verified: ${pdfHeader}`);
            }
            
            // Set response headers with proper content type for printing
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
            // Add headers to ensure PDF can be printed and is compatible with printer drivers
            res.setHeader('Content-Length', pdfBuffer.length.toString());
            res.setHeader('Content-Transfer-Encoding', 'binary');
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
            // Ensure PDF is treated as a printable document
            res.setHeader('X-Content-Type-Options', 'nosniff');
            
            // Send buffer
            res.send(pdfBuffer);
            
            debugLog(`✅ PDF buffer sent successfully: ${pdfBuffer.length} bytes, ${numPages} pages`);
            debugLog(`✅ Exported expense report to PDF: ${filename}`);
          } catch (outputError) {
            debugError('❌ Error finalizing PDF:', outputError);
            res.status(500).json({ error: `Failed to finalize PDF: ${outputError.message}` });
          }
        };
        
        // Post-process PDF: embed receipt PDFs as actual pages, then optimize for printer compatibility
        (async () => {
          debugLog(`🔧 Post-processing PDF for printer compatibility...`);
          try {
            const pdfDoc = await PDFDocument.load(Buffer.from(pdfArrayBuffer));
            
            // Embed receipt PDFs as actual pages (so the uploaded PDF receipt appears in the report)
            const path = require('path');
            const fs = require('fs');
            for (let i = 0; i < (pdfsToEmbed || []).length; i++) {
              const item = pdfsToEmbed[i];
              try {
                debugLog(`📎 Embedding PDF receipt ${i + 1}/${pdfsToEmbed.length} (${item.type})...`);
                const receiptPdfBytes = item.type === 'base64'
                  ? Buffer.from(item.data, 'base64')
                  : fs.readFileSync(item.path);
                if (!receiptPdfBytes || receiptPdfBytes.length === 0) {
                  debugError(`⚠️ PDF receipt ${i + 1}: empty buffer`);
                  continue;
                }
                const receiptDoc = await PDFDocument.load(receiptPdfBytes);
                const pageIndices = receiptDoc.getPageIndices();
                if (pageIndices.length > 0) {
                  const copiedPages = await pdfDoc.copyPages(receiptDoc, pageIndices);
                  copiedPages.forEach(p => pdfDoc.addPage(p));
                  debugLog(`✅ Embedded PDF receipt ${i + 1}: ${pageIndices.length} page(s), ${receiptPdfBytes.length} bytes`);
                } else {
                  debugError(`⚠️ PDF receipt ${i + 1}: no pages in document`);
                }
              } catch (embedErr) {
                debugError(`⚠️ Could not embed PDF receipt ${i + 1}:`, embedErr.message);
              }
            }
            
            // Set PDF metadata for printer compatibility
            pdfDoc.setTitle(`Expense Report - ${report.month}/${report.year}`);
            pdfDoc.setSubject('Monthly Expense Report');
            pdfDoc.setAuthor('Oxford House, Inc.');
            pdfDoc.setCreator('Oxford House Expense Tracker');
            pdfDoc.setProducer('Oxford House Expense Tracker');
            pdfDoc.setKeywords(['expense report', 'mileage', 'receipts']);
            pdfDoc.setLanguage('en-US');
            
            const optimizedPdfBytes = await pdfDoc.save({ 
              useObjectStreams: false,
              addDefaultPage: false,
              updateFieldAppearances: false
            });
            
            const optimizedPdfBuffer = Buffer.from(optimizedPdfBytes);
            debugLog(`✅ PDF optimized for printer compatibility: ${optimizedPdfBuffer.length} bytes (was ${pdfArrayBuffer.byteLength} bytes)`);
            
            sendOptimizedPdf(optimizedPdfBuffer);
          } catch (optimizationError) {
            debugError('⚠️ Error optimizing PDF, using original:', optimizationError);
            sendOptimizedPdf(Buffer.from(pdfArrayBuffer));
          }
        })();
      }); // Close costCenterQuery callback for time tracking summary
      }; // Close generateTimesheetAndFinalizePDF function
      
      const processCostCenterSheet = (costCenter, index, onComplete) => {
        // Always start each cost center sheet on a new page
        // But only if we're not already at the top of a page
        // For first cost center, check if we need a page (if yPos is already low, we don't)
        debugLog(`📄 Processing cost center ${index} (${costCenter}): yPos=${yPos}`);
        if (index === 0) {
          // First cost center - we're already on a fresh page (added above before "Payable to")
          debugLog(`📄 First cost center on existing fresh page (yPos ${yPos})`);
          if (yPos < margin + 60) {
            yPos = margin + 60; // Leave space for title
          }
        } else {
          // Subsequent cost centers - always start on new page
          debugLog(`📄 Adding new page for cost center ${index}`);
          doc.addPage();
          yPos = margin + 20;
        }
        
        // Table dimensions for Cost Center sheet - increased widths for better text fitting
        const ccCellHeight = 12; // Base height
        const ccColWidths = [50, 140, 50, 60, 50, 50, 60]; // Increased Description column width significantly
        const ccHeaders = ['Date', 'Description/Activity', 'Hours', 'Odometer Start', 'Odometer End', 'Miles', 'Mileage ($)'];
        
        // Calculate total table width and center it on the page
        const totalTableWidth = ccColWidths.reduce((sum, width) => sum + width, 0);
        const ccTableStartX = (pageWidth - totalTableWidth) / 2;
        
        // Helper function for Cost Center table cells with text wrapping
        const drawCCCell = (x, y, width, height, text, color = 'white', textColor = 'black', align = 'left', wrapText = false) => {
          // Set fill color
          setColor(color);
          
          // Calculate actual height needed based on text wrapping
          let actualHeight = height;
          let lines = [];
          
          if (wrapText && text && text.length > 20) {
            // Calculate maximum characters that can fit in the cell width
            // Using font size 6, adjusted to be about 10px wider
            const maxCharsPerLine = Math.floor((width - 6) / 3.5); // 6px padding, ~3.5px per character at size 6
            
            // First split on explicit newlines, then apply word wrapping to each segment
            const segments = text.split('\n');
            lines = [];
            
            segments.forEach(segment => {
              if (segment.trim()) { // Only process non-empty segments
                const words = segment.trim().split(' ');
                let currentLine = '';
                
                for (const word of words) {
                  const testLine = currentLine ? `${currentLine} ${word}` : word;
                  if (testLine.length <= maxCharsPerLine) {
                    currentLine = testLine;
                  } else {
                    if (currentLine) lines.push(currentLine);
                    currentLine = word;
                  }
                }
                if (currentLine) lines.push(currentLine);
              } else {
                // Empty segment (from \n\n) - add empty line
                lines.push('');
              }
            });
            
            // Calculate exact height needed: text content + one line height of padding
            const textHeight = 6 + (lines.length * 6) + 6; // 6px top padding + 6px per line + 6px bottom padding (one line height)
            actualHeight = textHeight; // Use exact calculated height, not Math.max
          }
          
          // Set draw color for borders BEFORE drawing rectangle
          doc.setDrawColor(0, 0, 0); // Black border
          
          // Draw filled rectangle with border using exact height
          // 'FD' means Fill and Draw border - ensures cell is visible even if empty
          doc.rect(x, y, width, actualHeight, 'FD'); // Fill and draw border
          
          // Set text color and font (ensure black text for visibility)
          if (textColor !== 'white') {
            doc.setTextColor(0, 0, 0); // Black text
          } else {
            doc.setTextColor(255, 255, 255); // White text
          }
          doc.setFontSize(6); // Reduced from default 8 to 6 (~25% reduction)
          doc.setFont('helvetica', 'bold');
          
          if (wrapText && text && text.length > 20 && lines.length > 0) {
            // Draw multiple lines with original spacing
            lines.forEach((line, index) => {
              const lineY = y + 6 + (index * 6); // Original line spacing
              if (align === 'right') {
                safeText(line, x + width - 3, lineY);
              } else {
                safeText(line, x + 3, lineY);
              }
            });
          } else {
            // Single line text - always draw text, even if empty (for cell borders)
            if (align === 'right') {
              safeText(text || '', x + width - 3, y + actualHeight/2 + 3);
            } else {
              safeText(text || '', x + 3, y + actualHeight/2 + 3);
            }
          }
          
          doc.setTextColor(0, 0, 0); // Reset to black
          return actualHeight; // Return actual height used
        };
        
        // Header row - calculate dynamic height based on longest header
        let maxHeaderHeight = ccCellHeight;
        ccHeaders.forEach((header, i) => {
          if (header.length > 20) {
            // Use the same calculation as drawCCCell for consistency
            const maxCharsPerLine = Math.floor((ccColWidths[i] - 6) / 3.5); // 6px padding, ~3.5px per character at size 6
            
            const words = header.split(' ');
            let lines = [];
            let currentLine = '';
            
            for (const word of words) {
              const testLine = currentLine ? `${currentLine} ${word}` : word;
              if (testLine.length <= maxCharsPerLine) {
                currentLine = testLine;
              } else {
                if (currentLine) lines.push(currentLine);
                currentLine = word;
              }
            }
            if (currentLine) lines.push(currentLine);
            
            const headerHeight = ccCellHeight + (lines.length - 1) * 6 + 4; // 6px line spacing + 4px buffer
            maxHeaderHeight = Math.max(maxHeaderHeight, headerHeight);
          }
        });
        
        // Generate all days of the month
        // Convert month name to number if necessary
        let month = reportData.month;
        if (typeof month === 'string' && isNaN(parseInt(month))) {
          const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                             'July', 'August', 'September', 'October', 'November', 'December'];
          month = monthNames.indexOf(month) + 1;
        } else {
          month = parseInt(month);
        }
        const year = parseInt(reportData.year);
        const daysInMonth = new Date(year, month, 0).getDate();
        const monthStr = month.toString().padStart(2, '0');
        const yearStr = year.toString();
        
        // Query database for cost center filtered data
        debugLog(`📊 Export: Querying for cost center "${costCenter}", employeeId: ${reportData.employeeId}, month: ${monthStr}, year: ${yearStr}`);
        
        // Build date range for month (YYYY-MM-DD format)
        const startDateYYYYMMDD = `${yearStr}-${monthStr}-01`;
        const endDateYYYYMMDD = `${yearStr}-${monthStr}-${daysInMonth.toString().padStart(2, '0')}`;
        
        // Query that handles both YYYY-MM-DD and MM/DD/YY date formats
        // STRICT cost center matching - only match exact cost center (no empty string fallback)
        const mileageQuery = `
          SELECT date, startLocation, endLocation, miles, odometerReading, costCenter,
                 startLocationAddress, endLocationAddress, startLocationName, endLocationName,
                 startLocationLat, startLocationLng, endLocationLat, endLocationLng, createdAt
          FROM mileage_entries 
          WHERE employeeId = ? 
          AND (
            (date LIKE '%-%-%' AND strftime("%m", date) = ? AND strftime("%Y", date) = ?)
            OR (date LIKE '%/%/%' AND CAST(SUBSTR(date, 1, 2) AS INTEGER) = ? AND SUBSTR(date, 7) = ?)
          )
          AND costCenter = ?
          ORDER BY date, createdAt
        `;
        
        const timeTrackingQuery = `
          SELECT date, description, hours, costCenter
          FROM time_tracking 
          WHERE employeeId = ? 
          AND (
            (date LIKE '%-%-%' AND strftime("%m", date) = ? AND strftime("%Y", date) = ?)
            OR (date LIKE '%/%/%' AND CAST(SUBSTR(date, 1, 2) AS INTEGER) = ? AND SUBSTR(date, 7) = ?)
          )
          AND costCenter = ?
          ORDER BY date
        `;
        
        const dailyDescriptionsQuery = `
          SELECT date, description, costCenter
          FROM daily_descriptions 
          WHERE employeeId = ? 
          AND (
            (date LIKE '%-%-%' AND strftime("%m", date) = ? AND strftime("%Y", date) = ?)
            OR (date LIKE '%/%/%' AND CAST(SUBSTR(date, 1, 2) AS INTEGER) = ? AND SUBSTR(date, 7) = ?)
          )
          AND costCenter = ?
          ORDER BY date
        `;
        
        // Parameters: employeeId, monthStr (YYYY-MM-DD), yearStr (YYYY-MM-DD), monthInt (MM/DD/YY), year2digit (MM/DD/YY), costCenter
        // Total: 6 parameters - STRICT cost center matching (no empty string fallback)
        const monthInt = parseInt(monthStr);
        const year2digit = yearStr.slice(-2);
        const mileageParams = [reportData.employeeId, monthStr, yearStr, monthInt, year2digit, costCenter];
        debugLog(`📊 Mileage query params:`, mileageParams);
        debugLog(`📊 Querying for employeeId: ${reportData.employeeId}, month: ${monthStr}, year: ${yearStr}, costCenter: ${costCenter}`);
        db.all(mileageQuery, mileageParams, (err, mileageEntries) => {
          if (err) {
            debugError('❌ Error fetching mileage entries:', err);
            debugError('❌ SQL Error details:', err.message);
            mileageEntries = [];
          } else {
            debugLog(`📊 Found ${mileageEntries.length} mileage entries for ${costCenter}`);
            if (mileageEntries.length > 0) {
              debugLog(`📊 Sample mileage entries (first 3):`, mileageEntries.slice(0, 3));
            } else {
              // Debug: Check what mileage entries exist at all for this employee/month
              db.all(
                'SELECT date, costCenter, miles FROM mileage_entries WHERE employeeId = ? LIMIT 10',
                [reportData.employeeId],
                (debugErr, debugRows) => {
                  if (!debugErr && debugRows) {
                    debugLog(`📊 Debug: Found ${debugRows.length} total mileage entries for employee ${reportData.employeeId}:`, debugRows);
                  }
                }
              );
            }
          }
          
          // Parameters: employeeId, monthStr, yearStr, monthInt, year2digit, costCenter
          const timeTrackingParams = [reportData.employeeId, monthStr, yearStr, monthInt, year2digit, costCenter];
          debugLog(`📊 Time tracking query params:`, timeTrackingParams);
          
          // Also query daily descriptions
          const dailyDescriptionsParams = [reportData.employeeId, monthStr, yearStr, monthInt, year2digit, costCenter];
          db.all(dailyDescriptionsQuery, dailyDescriptionsParams, (descErr, dailyDescriptions) => {
            if (descErr) {
              debugError('❌ Error fetching daily descriptions:', descErr);
              dailyDescriptions = [];
            } else {
              debugLog(`📊 Found ${dailyDescriptions.length} daily descriptions for ${costCenter}`);
              if (dailyDescriptions.length === 0) {
                // Debug: Check what daily descriptions exist
                db.all(
                  'SELECT date, costCenter, description FROM daily_descriptions WHERE employeeId = ? LIMIT 10',
                  [reportData.employeeId],
                  (debugErr, debugRows) => {
                    if (!debugErr && debugRows) {
                      debugLog(`📊 Debug: Found ${debugRows.length} total daily descriptions for employee:`, debugRows);
                    }
                  }
                );
              }
            }
            
            db.all(timeTrackingQuery, timeTrackingParams, (err, timeEntries) => {
              if (err) {
                debugError('❌ Error fetching time tracking entries:', err);
                timeEntries = [];
              } else {
                debugLog(`📊 Found ${timeEntries.length} time tracking entries for ${costCenter}`);
                if (timeEntries.length > 0) {
                  debugLog(`📊 Sample time entries (first 3):`, timeEntries.slice(0, 3));
                } else {
                  // Debug: Check what time tracking entries exist
                  db.all(
                    'SELECT date, costCenter, hours FROM time_tracking WHERE employeeId = ? LIMIT 10',
                    [reportData.employeeId],
                    (debugErr, debugRows) => {
                      if (!debugErr && debugRows) {
                        debugLog(`📊 Debug: Found ${debugRows.length} total time tracking entries for employee:`, debugRows);
                      }
                    }
                  );
                }
              }
            
            // NOW draw the title, subtitle, and header AFTER data is fetched
            doc.setFontSize(14);
            doc.setFont('helvetica', 'bold');
            safeText(`COST CENTER TRAVEL SHEET - ${costCenter}`, pageWidth / 2, yPos, { align: 'center' });
            
            yPos += 30;
            doc.setFontSize(11);
            safeText(`${reportData.name || 'N/A'} - ${reportData.month} ${reportData.year}`, pageWidth / 2, yPos, { align: 'center' });
            
            yPos += 40;
            
            // Draw header row AFTER titles
            let ccXPos = ccTableStartX;
            ccHeaders.forEach((header, i) => {
              const needsWrapping = header.length > 20;
              drawCCCell(ccXPos, yPos, ccColWidths[i], maxHeaderHeight, header, 'darkBlue', 'white', 'center', needsWrapping);
              ccXPos += ccColWidths[i];
            });
            yPos += maxHeaderHeight;
            
            // Build maps for daily data aggregation
            const dailyDataMap = {};
            
            // Process mileage entries - filter by cost center and normalize dates
            mileageEntries
              .filter(entry => {
                // Only process entries that match this cost center
                return entry.costCenter === costCenter;
              })
              .forEach(entry => {
                // Handle YYYY-MM-DD, YYYY-MM-DDTHH:MM:SS, and MM/DD/YY formats
                let day;
                let dateStr = entry.date;
                
                // Handle ISO date strings (e.g., '2025-11-03T12:00:00.000Z')
                if (dateStr.includes('T')) {
                  dateStr = dateStr.split('T')[0]; // Extract just the date part
                }
                
                if (dateStr.includes('-')) {
                  // YYYY-MM-DD format
                  const parts = dateStr.split('-');
                  day = parseInt(parts[2], 10);
                } else if (dateStr.includes('/')) {
                  // MM/DD/YY format
                  day = parseInt(dateStr.split('/')[1], 10);
                } else {
                  debugWarn(`⚠️ Unrecognized date format: ${entry.date}`);
                  return; // Skip this entry
                }
              if (!dailyDataMap[day]) {
                dailyDataMap[day] = {
                  date: entry.date,
                  description: '',
                  hours: 0,
                  odometerStart: entry.odometerReading || 0,
                  odometerEnd: entry.odometerReading || 0,
                  miles: entry.miles || 0,
                  mileageAmount: (entry.miles || 0) * 0.655 // Standard IRS mileage rate (can be adjusted)
                };
              } else {
                // Sum mileage data if multiple entries per day
                dailyDataMap[day].miles += (entry.miles || 0);
                dailyDataMap[day].mileageAmount += ((entry.miles || 0) * 0.655);
                if (entry.odometerReading && entry.odometerReading > dailyDataMap[day].odometerEnd) {
                  dailyDataMap[day].odometerEnd = entry.odometerReading;
                }
              }
            });
            
            // Process time tracking entries (for hours) - filter by cost center and normalize dates
            timeEntries
              .filter(entry => {
                // Only process entries that match this cost center
                return entry.costCenter === costCenter;
              })
              .forEach(entry => {
                // Handle YYYY-MM-DD, YYYY-MM-DDTHH:MM:SS, and MM/DD/YY formats
                let day;
                let dateStr = entry.date;
                
                // Handle ISO date strings (e.g., '2025-11-03T12:00:00.000Z')
                if (dateStr.includes('T')) {
                  dateStr = dateStr.split('T')[0]; // Extract just the date part
                }
                
                if (dateStr.includes('-')) {
                  // YYYY-MM-DD format
                  const parts = dateStr.split('-');
                  day = parseInt(parts[2], 10);
                } else if (dateStr.includes('/')) {
                  // MM/DD/YY format
                  day = parseInt(dateStr.split('/')[1], 10);
                } else {
                  debugWarn(`⚠️ Unrecognized date format: ${entry.date}`);
                  return; // Skip this entry
                }
              if (!dailyDataMap[day]) {
                dailyDataMap[day] = {
                  date: entry.date,
                  description: entry.description || '',
                  hours: parseFloat(entry.hours) || 0,
                  odometerStart: 0,
                  odometerEnd: 0,
                  miles: 0,
                  mileageAmount: 0
                };
              } else {
                // Append description if multiple entries per day
                if (entry.description) {
                  dailyDataMap[day].description = dailyDataMap[day].description 
                    ? `${dailyDataMap[day].description}\n${entry.description}` 
                    : entry.description;
                }
                dailyDataMap[day].hours += (parseFloat(entry.hours) || 0);
              }
            });
            
            // Process daily descriptions (for descriptions - these take priority) - filter by cost center and normalize dates
            if (dailyDescriptions && dailyDescriptions.length > 0) {
              dailyDescriptions
                .filter(desc => {
                  // Only process entries that match this cost center
                  return desc.costCenter === costCenter;
                })
                .forEach(desc => {
                  // Handle YYYY-MM-DD, YYYY-MM-DDTHH:MM:SS, and MM/DD/YY formats
                  let day;
                  let dateStr = desc.date;
                  
                  // Handle ISO date strings (e.g., '2025-11-03T12:00:00.000Z')
                  if (dateStr.includes('T')) {
                    dateStr = dateStr.split('T')[0]; // Extract just the date part
                  }
                  
                  if (dateStr.includes('-')) {
                    // YYYY-MM-DD format
                    const parts = dateStr.split('-');
                    day = parseInt(parts[2], 10);
                  } else if (dateStr.includes('/')) {
                    // MM/DD/YY format
                    day = parseInt(dateStr.split('/')[1], 10);
                  } else {
                    debugWarn(`⚠️ Unrecognized date format: ${desc.date}`);
                    return; // Skip this entry
                  }
                if (desc.description && desc.description.trim()) {
                  if (!dailyDataMap[day]) {
                    dailyDataMap[day] = {
                      date: desc.date,
                      description: desc.description,
                      hours: 0,
                      odometerStart: 0,
                      odometerEnd: 0,
                      miles: 0,
                      mileageAmount: 0
                    };
                  } else {
                    // Daily description takes priority over time tracking description
                    dailyDataMap[day].description = desc.description;
                  }
                }
              });
            }
            
            // Calculate totals for this cost center
            let totalMiles = 0;
            let totalHours = 0;
            let totalAmount = 0;
            Object.values(dailyDataMap).forEach(dayData => {
              totalMiles += dayData.miles;
              totalHours += dayData.hours;
              totalAmount += dayData.mileageAmount;
            });
            
            debugLog(`📊 ${costCenter}: ${Object.keys(dailyDataMap).length} days with data, Total: ${totalMiles} miles, ${totalHours} hours`);
            debugLog(`📊 About to draw rows for ${costCenter}`);
            debugLog(`📊 Variables: yPos=${yPos}, daysInMonth=${daysInMonth}, month=${month}, year=${year}`);
            debugLog(`📊 Drawing rows for ${costCenter}, yPos before loop: ${yPos}, daysIn readable: ${daysInMonth}`);
            
            // Draw header row first
            let headerXPos = ccTableStartX;
            ccHeaders.forEach((header, i) => {
              const headerColor = 'lightBlue'; // Header row background
              drawCCCell(headerXPos, yPos, ccColWidths[i], ccCellHeight, header, headerColor, 'black', 'left', false);
              headerXPos += ccColWidths[i];
            });
            yPos += ccCellHeight;
            debugLog(`📊 Drew header row, yPos now: ${yPos}`);
        
        // Generate rows for all days of the month
            let rowsDrawn = 0;
        for (let day = 1; day <= daysInMonth; day++) {
          if (yPos > pageHeight - 100) {
            doc.addPage();
            yPos = margin;
          }
          
          const dateStr = `${month.toString().padStart(2, '0')}/${day.toString().padStart(2, '0')}/${year.toString().slice(-2)}`;
              const dayData = dailyDataMap[day] || {
                date: dateStr,
                description: '',
                hours: 0,
                odometerStart: 0,
                odometerEnd: 0,
                miles: 0,
                mileageAmount: 0
              };
              
              // Debug: Log first few rows with data
              if (day <= 5 || dayData.hours > 0 || dayData.description) {
                debugLog(`  Day ${day}: hours=${dayData.hours}, desc="${dayData.description?.substring(0, 30)}", yPos=${yPos}`);
              }
          
          ccXPos = ccTableStartX;
          const rowData = [
            dateStr,
                dayData.description || '',
                dayData.hours > 0 ? dayData.hours.toString() : '',
                dayData.odometerStart > 0 ? dayData.odometerStart.toString() : '',
                dayData.odometerEnd > 0 ? dayData.odometerEnd.toString() : '',
                dayData.miles > 0 ? Math.round(dayData.miles).toString() : '',
                dayData.mileageAmount > 0 ? `$${dayData.mileageAmount.toFixed(2)}` : ''
          ];
          
          // Check if description needs wrapping and calculate required height
              const descriptionNeedsWrapping = (dayData.description || '').length > 20;
          let maxRowHeight = ccCellHeight; // Start with base height
          
          // Calculate the height needed for the description cell if it needs wrapping
          if (descriptionNeedsWrapping) {
            // Use the same calculation as drawCCCell for consistency
            const maxCharsPerLine = Math.floor((ccColWidths[1] - 6) / 3.5); // 6px padding, ~3.5px per character at size 6
            
                const descriptionText = dayData.description || '';
            // First split on explicit newlines, then apply word wrapping to each segment
            const segments = descriptionText.split('\n');
            let lines = [];
            
            segments.forEach(segment => {
              if (segment.trim()) { // Only process non-empty segments
                const words = segment.trim().split(' ');
                let currentLine = '';
                
                for (const word of words) {
                  const testLine = currentLine ? `${currentLine} ${word}` : word;
                  if (testLine.length <= maxCharsPerLine) {
                    currentLine = testLine;
                  } else {
                    if (currentLine) lines.push(currentLine);
                    currentLine = word;
                  }
                }
                if (currentLine) lines.push(currentLine);
              } else {
                // Empty segment (from \n\n) - add empty line
                lines.push('');
              }
            });
            
            // Calculate height needed: text content + one line height of padding
            maxRowHeight = 6 + (lines.length * 6) + 6; // 6px top padding + 6px per line + 6px bottom padding
          }
          
          rowData.forEach((data, i) => {
            const cellColor = i === 0 ? 'lightBlue' : 'white'; // Date column in light blue
            const textAlign = 'left'; // All data left-aligned
            const shouldWrap = i === 1 && descriptionNeedsWrapping; // Wrap description column if needed
                
                // Debug: Log first few cells with data
                if (day <= 3 && i === 0) {
                  debugLog(`    Drawing cell ${i} for day ${day}: text="${data}", x=${ccXPos}, y=${yPos}, color=${cellColor}`);
                }
            
            // All cells in the row should be the same height as the tallest cell
            drawCCCell(ccXPos, yPos, ccColWidths[i], maxRowHeight, data, cellColor, 'black', textAlign, shouldWrap);
            ccXPos += ccColWidths[i];
          });
          
          yPos += maxRowHeight;
              rowsDrawn++;
        }
            
            debugLog(`📊 ${costCenter}: Drew ${rowsDrawn} rows, yPos after loop: ${yPos}`);
        
        yPos += 25;
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
            safeText(`Total Miles: ${Math.round(totalMiles)}`, margin, yPos);
        yPos += 18;
            safeText(`Total Hours: ${totalHours.toFixed(1)}`, margin, yPos);
        yPos += 18;
            safeText(`Total Amount: $${totalAmount.toFixed(2)}`, margin, yPos);
            
            // Generate Google Maps if enabled and user is finance
            (async () => {
              try {
                const userIsFinance = await isFinanceUser();
                const mapsEnabled = await isCostCenterMapsEnabled(costCenter);
                const apiConfigured = googleMapsService.isConfigured();
                
                debugLog(`🗺️ Map generation check for ${costCenter}:`);
                debugLog(`   - User is finance: ${userIsFinance}`);
                debugLog(`   - Maps enabled for cost center: ${mapsEnabled}`);
                debugLog(`   - API configured: ${apiConfigured}`);
                debugLog(`   - Map view mode: ${mapViewMode || 'none'}`);
                debugLog(`   - Mileage entries count: ${mileageEntries?.length || 0}`);
                
                if (!userIsFinance) {
                  debugLog(`⚠️ Maps skipped: User is not finance team`);
                } else if (!mapsEnabled) {
                  debugLog(`⚠️ Maps skipped: Cost center ${costCenter} does not have maps enabled`);
                } else if (!apiConfigured) {
                  debugLog(`⚠️ Maps skipped: Google Maps API key not configured`);
                } else if (!mapViewMode) {
                  debugLog(`⚠️ Maps skipped: No map view mode specified`);
                }
                
                if (userIsFinance && mapsEnabled && apiConfigured && mapViewMode) {
                  debugLog(`🗺️ Generating Google Maps for cost center: ${costCenter}, mode: ${mapViewMode}`);
                  
                  // mapViewMode: 'day' = one map per trip (one page per route); 'costCenter' = one map for all routes
                  let mapPoints = [];
                  if (mapViewMode === 'costCenter') {
                    mapPoints = googleMapsService.collectPointsForCostCenter(mileageEntries);
                  } else if (mapViewMode === 'day') {
                    // Day mode: one map per trip (one page per mileage entry), zoomed to that route
                    const entriesByDate = {};
                    mileageEntries.forEach(entry => {
                      const dateKey = entry.date.split('T')[0] || entry.date.split(' ')[0];
                      if (!entriesByDate[dateKey]) {
                        entriesByDate[dateKey] = [];
                      }
                      entriesByDate[dateKey].push(entry);
                    });
                    
                    debugLog(`🗺️ Grouped ${mileageEntries.length} entries into ${Object.keys(entriesByDate).length} days`);
                    
                    // Generate one map per route; API auto-fits zoom when we omit center/zoom
                    const sortedDates = Object.keys(entriesByDate).sort();
                    for (const date of sortedDates) {
                      const dayRoutes = googleMapsService.collectRoutesForDay(entriesByDate[date]);
                      debugLog(`🗺️ Day ${date}: Found ${dayRoutes.length} routes (one map per route)`);
                      for (let tripIndex = 0; tripIndex < dayRoutes.length; tripIndex++) {
                        const singleRoute = [dayRoutes[tripIndex]];
                        const tripNum = tripIndex + 1;
                        try {
                          const mapImage = await googleMapsService.downloadStaticMapImageFromRoutes(singleRoute, { size: '600x400' });
                          const imageDataUrl = googleMapsService.imageBufferToDataUrl(mapImage);
                          doc.addPage();
                          yPos = margin + 20;
                          doc.setFontSize(14);
                          doc.setFont('helvetica', 'bold');
                          safeText(`Daily Routes - ${date} - Trip ${tripNum}`, pageWidth / 2, yPos, { align: 'center' });
                          yPos += 30;
                          const imageWidth = pageWidth - (margin * 2);
                          const imageHeight = (imageWidth * 400) / 600;
                          doc.addImage(imageDataUrl, 'PNG', margin, yPos, imageWidth, imageHeight);
                          yPos += imageHeight + 20;
                        } catch (mapError) {
                          const errMsg = (mapError && mapError.message) ? String(mapError.message) : '';
                          debugError(`❌ Error generating map for date ${date} trip ${tripNum}:`, mapError);
                          // Fallback: show page with message and actual error so Finance can troubleshoot
                          doc.addPage();
                          yPos = margin + 20;
                          doc.setFontSize(14);
                          doc.setFont('helvetica', 'bold');
                          safeText(`Daily Routes - ${date} - Trip ${tripNum}`, pageWidth / 2, yPos, { align: 'center' });
                          yPos += 30;
                          doc.setFontSize(10);
                          doc.setFont('helvetica', 'normal');
                          safeText('Map unavailable. PDF maps use Maps Static API (different from the Calculate button). Enable "Maps Static API" in Google Cloud and check billing (g.co/staticmaperror).', margin, yPos, { maxWidth: pageWidth - margin * 2 });
                          if (errMsg && errMsg.length < 280 && !/AIza[A-Za-z0-9_-]{30,}/.test(errMsg)) {
                            yPos += 24;
                            safeText(`Details: ${errMsg}`, margin, yPos, { maxWidth: pageWidth - margin * 2 });
                          }
                        }
                      }
                    }
                    
                    // Skip the cost center map if we did daily maps
                    onComplete();
                    return;
                  }
                  
                  debugLog(`🗺️ Cost center mode: Collected ${mapPoints.length} map points`);
                  if (mapPoints.length > 0) {
                    try {
                      debugLog(`🗺️ Downloading map image for ${mapPoints.length} points...`);
                      const mapImage = await googleMapsService.downloadStaticMapImage(mapPoints, { size: '600x400' });
                      debugLog(`🗺️ Map image downloaded: ${mapImage.length} bytes`);
                      const imageDataUrl = googleMapsService.imageBufferToDataUrl(mapImage);
                      debugLog(`🗺️ Adding map image to PDF...`);
                      
                      // Add new page for map
                      doc.addPage();
                      yPos = margin + 20;
                      
                      // Add title
                      doc.setFontSize(14);
                      doc.setFont('helvetica', 'bold');
                      safeText(`Cost Center Routes - ${costCenter}`, pageWidth / 2, yPos, { align: 'center' });
                      yPos += 30;
                      
                      // Add map image (600x400, scaled to fit page width)
                      const imageWidth = pageWidth - (margin * 2);
                      const imageHeight = (imageWidth * 400) / 600; // Maintain aspect ratio
                      doc.addImage(imageDataUrl, 'PNG', margin, yPos, imageWidth, imageHeight);
                      yPos += imageHeight + 20;
                      debugLog(`✅ Map added to PDF for cost center ${costCenter}`);
                    } catch (mapError) {
                      const errMsg = (mapError && mapError.message) ? String(mapError.message) : '';
                      debugError(`❌ Error generating map for cost center ${costCenter}:`, mapError);
                      debugError(`❌ Map error details:`, mapError.message, mapError.stack);
                      doc.addPage();
                      yPos = margin + 20;
                      doc.setFontSize(14);
                      doc.setFont('helvetica', 'bold');
                      safeText(`Cost Center Routes - ${costCenter}`, pageWidth / 2, yPos, { align: 'center' });
                      yPos += 30;
                      doc.setFontSize(10);
                      doc.setFont('helvetica', 'normal');
                      safeText('Map unavailable. PDF maps use Maps Static API (different from the Calculate button). Enable "Maps Static API" in Google Cloud and check billing (g.co/staticmaperror).', margin, yPos, { maxWidth: pageWidth - margin * 2 });
                      if (errMsg && errMsg.length < 280 && !/AIza[A-Za-z0-9_-]{30,}/.test(errMsg)) {
                        yPos += 24;
                        safeText(`Details: ${errMsg}`, margin, yPos, { maxWidth: pageWidth - margin * 2 });
                      }
                    }
                  } else {
                    debugLog(`⚠️ No map points found for cost center ${costCenter}`);
                  }
                } else {
                  debugLog(`⚠️ Map generation conditions not met for ${costCenter}`);
                }
              } catch (error) {
                debugError('❌ Error in map generation:', error);
                debugError('❌ Error details:', error.message, error.stack);
              }
              
              // This cost center sheet is complete, call the callback to process the next one
              onComplete();
            })();
            }); // Close timeTrackingQuery callback
          }); // Close dailyDescriptionsQuery callback
        }); // Close mileageEntries callback
      };
      
      // Process cost centers sequentially, one at a time
      const processCostCenterSheetsSequentially = (index = 0) => {
        if (index >= costCentersToProcess.length) {
          // All cost center sheets done, now generate timesheet and finalize PDF
          generateTimesheetAndFinalizePDF().catch(err => {
            debugError('❌ Error generating timesheet and finalizing PDF:', err);
            res.status(500).json({ error: 'Failed to finalize PDF' });
          });
          return;
        }
        
        const costCenter = costCentersToProcess[index];
        processCostCenterSheet(costCenter, index, () => {
          // Callback: this cost center is done, process the next one
          processCostCenterSheetsSequentially(index + 1);
            });
          };
          
      // Start processing cost centers sequentially
      processCostCenterSheetsSequentially(0);
            
      // NOTE: The above function is called after all cost center sheets complete
    } catch (error) {
      debugError('❌ Error exporting report to PDF:', error);
      res.status(500).json({ error: 'Failed to generate PDF' });
    }
  });
});

// Convert HTML to PDF endpoint (for Finance Portal Export)
router.post('/api/export/html-to-pdf', (req, res) => {
  try {
    const { html } = req.body;
    
    if (!html) {
      return res.status(400).json({ error: 'HTML content is required' });
    }
    
    debugLog('📄 Converting HTML to PDF for Finance Portal Export');
    
    // For now, we'll use a simple approach - return the HTML as a downloadable file
    // In a production environment, you'd want to use a proper HTML-to-PDF library like Puppeteer
    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Content-Disposition', 'attachment; filename="expense-report.html"');
    res.send(html);
    
    debugLog('✅ HTML export completed');
  } catch (error) {
    debugError('❌ Error converting HTML to PDF:', error);
    res.status(500).json({ error: 'Failed to convert HTML to PDF' });
  }
});

module.exports = router;
