import React, { useState, useEffect } from 'react';
import {
  Container,
  Card,
  CardContent,
  Typography,
  Box,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Tabs,
  Tab,
  CircularProgress,
  Alert,
} from '@mui/material';
import {
  Print as PrintIcon,
  GetApp as DownloadIcon,
  Refresh as RefreshIcon,
  Edit as EditIcon,
  Visibility as ViewIcon,
  Send as SendIcon,
  FilterList as FilterIcon,
  ArrowUpward as ArrowUpwardIcon,
  ArrowDownward as ArrowDownwardIcon,
  UnfoldMore as UnfoldMoreIcon,
} from '@mui/icons-material';
import { getEmployeeDisplayName } from '../utils/employeeUtils';
import { ReportsAnalyticsTab } from './ReportsAnalyticsTab';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3002';

interface FinancePortalProps {
  financeUserId: string;
  financeUserName: string;
}

interface ExpenseReport {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeFullName?: string; // Full name from database (e.name), used for exports
  employeeEmail: string;
  month: number;
  year: number;
  status: 'draft' | 'submitted' | 'approved' | 'rejected' | 'needs_revision';
  totalMiles: number;
  totalMileageAmount: number;
  totalExpenses: number;
  submittedAt?: string;
  reportData?: any;
  state?: string;
  costCenters?: string[];
}

export const FinancePortal: React.FC<FinancePortalProps> = ({ financeUserId, financeUserName }) => {
  const [reports, setReports] = useState<ExpenseReport[]>([]);
  const [filteredReports, setFilteredReports] = useState<ExpenseReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(0);
  const [selectedReport, setSelectedReport] = useState<ExpenseReport | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [revisionDialogOpen, setRevisionDialogOpen] = useState(false);
  const [revisionComments, setRevisionComments] = useState('');
  const [printPreviewOpen, setPrintPreviewOpen] = useState(false);
  
  // Filter states
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterMonth, setFilterMonth] = useState<number>(new Date().getMonth() + 1);
  const [filterYear, setFilterYear] = useState<number>(new Date().getFullYear());
  const [filterEmployee, setFilterEmployee] = useState<string>('all');
  const [dateRangePreset, setDateRangePreset] = useState<string>('custom');
  const [filterStartDate, setFilterStartDate] = useState<string>('');
  const [filterEndDate, setFilterEndDate] = useState<string>('');
  const [filterState, setFilterState] = useState<string>('all');
  const [filterCostCenter, setFilterCostCenter] = useState<string>('all');
  
  // Sorting state
  const [sortField, setSortField] = useState<keyof ExpenseReport | ''>('');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  
  // Print style customization
  const [printStyles, setPrintStyles] = useState({
    fontSize: '12px',
    headerColor: '#1976d2',
    borderColor: '#cccccc',
    spacing: 'normal',
    showLogo: true,
    pageOrientation: 'portrait', // Always portrait to match Staff Portal
  });

  useEffect(() => {
    loadReports();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [reports, filterStatus, filterMonth, filterYear, filterEmployee, dateRangePreset, filterStartDate, filterEndDate, filterState, filterCostCenter]);

  // Apply sorting to filtered reports
  useEffect(() => {
    if (!sortField) return;
    
    setFilteredReports(prev => {
      const sorted = [...prev];
      
      sorted.sort((a, b) => {
        let aValue: any = a[sortField];
        let bValue: any = b[sortField];
        
        // Handle date comparisons
        if (sortField === 'submittedAt') {
          aValue = aValue ? new Date(aValue).getTime() : 0;
          bValue = bValue ? new Date(bValue).getTime() : 0;
        }
        
        // Handle string comparisons
        if (typeof aValue === 'string' && typeof bValue === 'string') {
          aValue = aValue.toLowerCase();
          bValue = bValue.toLowerCase();
        }
        
        // Handle null/undefined values
        if (aValue == null && bValue == null) return 0;
        if (aValue == null) return 1;
        if (bValue == null) return -1;
        
        if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
      
      return sorted;
    });
  }, [sortField, sortDirection]);

  const handleSort = (field: keyof ExpenseReport) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getSortIcon = (field: keyof ExpenseReport) => {
    if (sortField !== field) {
      return <UnfoldMoreIcon sx={{ fontSize: 16, opacity: 0.5 }} />;
    }
    return sortDirection === 'asc' 
      ? <ArrowUpwardIcon sx={{ fontSize: 16 }} />
      : <ArrowDownwardIcon sx={{ fontSize: 16 }} />;
  };

  // Helper function to get display name: "PreferredName LastName" format
  // e.g., "Greg Weisz" (preferredName + lastName from full name)
  const getDisplayName = (report: ExpenseReport): string => {
    const preferredName = report.employeeName || ''; // This is the preferredName from backend
    const fullName = report.employeeFullName || preferredName || '';
    
    // If we have a full name, extract the last name and combine with preferred name
    if (fullName && fullName !== preferredName) {
      const nameParts = fullName.trim().split(/\s+/).filter(p => p.length > 0);
      if (nameParts.length >= 2) {
        const lastName = nameParts[nameParts.length - 1];
        // Return "PreferredName LastName"
        return `${preferredName} ${lastName}`;
      }
    }
    
    // Fallback: use preferredName if available, otherwise fullName, otherwise 'Unknown'
    return preferredName || fullName || 'Unknown';
  };

  const loadReports = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/expense-reports`);
      if (!response.ok) throw new Error('Failed to load reports');
      
      const data = await response.json();
      console.log('📊 Loaded reports:', data.length, 'reports');
      console.log('📊 First report structure:', data[0]);
      
      // Calculate totals from reportData and extract state/cost centers
      const reportsWithTotals = data.map((report: any) => {
        const reportData = report.reportData || {};
        console.log(`📊 Report ${report.id} data:`, reportData);
        
        // Extract state from baseAddress (format: "City, ST ZIP" or "Address, City, ST ZIP")
        let state = '';
        const baseAddress = reportData.baseAddress || '';
        if (baseAddress) {
          // Try to extract state from address (look for 2-letter state code followed by ZIP)
          const stateMatch = baseAddress.match(/\b([A-Z]{2})\s+\d{5}(-\d{4})?\b/);
          if (stateMatch) {
            state = stateMatch[1];
          } else {
            // Fallback: try to find state after comma
            const parts = baseAddress.split(',');
            if (parts.length >= 2) {
              const lastPart = parts[parts.length - 1].trim();
              const stateFromLastPart = lastPart.match(/\b([A-Z]{2})\b/);
              if (stateFromLastPart) {
                state = stateFromLastPart[1];
              }
            }
          }
        }
        
        return {
          ...report,
          totalMiles: reportData.totalMiles || 0,
          totalMileageAmount: reportData.totalMileageAmount || 0,
          totalExpenses: calculateTotalExpenses(reportData),
          state: state,
          costCenters: reportData.costCenters || [],
        };
      });
      
      setReports(reportsWithTotals);
    } catch (error) {
      console.error('Error loading reports:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateTotalExpenses = (reportData: any) => {
    const {
      totalMileageAmount = 0,
      airRailBus = 0,
      vehicleRentalFuel = 0,
      parkingTolls = 0,
      groundTransportation = 0,
      hotelsAirbnb = 0,
      perDiem = 0,
      phoneInternetFax = 0,
      shippingPostage = 0,
      printingCopying = 0,
      officeSupplies = 0,
      eesReceipt = 0,
      meals = 0,
      other = 0,
    } = reportData;

    return totalMileageAmount + airRailBus + vehicleRentalFuel + parkingTolls +
           groundTransportation + hotelsAirbnb + perDiem + phoneInternetFax +
           shippingPostage + printingCopying + officeSupplies + eesReceipt + meals + other;
  };

  // Helper function to check if a report month/year falls within a preset range
  const isReportInPresetRange = (reportMonth: number, reportYear: number, preset: string): boolean => {
    const today = new Date();
    const currentMonth = today.getMonth() + 1;
    const currentYear = today.getFullYear();
    
    switch (preset) {
      case 'this-week':
      case 'last-week':
        // For weekly presets, we'll include the current month (since reports are monthly)
        return reportMonth === currentMonth && reportYear === currentYear;
      case 'this-month':
        return reportMonth === currentMonth && reportYear === currentYear;
      case 'last-month':
        const lastMonth = currentMonth === 1 ? 12 : currentMonth - 1;
        const lastMonthYear = currentMonth === 1 ? currentYear - 1 : currentYear;
        return reportMonth === lastMonth && reportYear === lastMonthYear;
      case 'this-quarter':
        const quarter = Math.floor((currentMonth - 1) / 3);
        const quarterStartMonth = quarter * 3 + 1;
        const quarterEndMonth = (quarter + 1) * 3;
        return reportYear === currentYear && reportMonth >= quarterStartMonth && reportMonth <= quarterEndMonth;
      case 'last-quarter':
        const lastQuarter = Math.floor((currentMonth - 1) / 3) - 1;
        if (lastQuarter < 0) {
          // Last quarter of previous year
          const lastQuarterStartMonth = 10;
          const lastQuarterEndMonth = 12;
          return reportYear === currentYear - 1 && reportMonth >= lastQuarterStartMonth && reportMonth <= lastQuarterEndMonth;
        } else {
          const lastQuarterStartMonth = lastQuarter * 3 + 1;
          const lastQuarterEndMonth = (lastQuarter + 1) * 3;
          return reportYear === currentYear && reportMonth >= lastQuarterStartMonth && reportMonth <= lastQuarterEndMonth;
        }
      case 'this-year':
        return reportYear === currentYear;
      default:
        return true;
    }
  };

  const applyFilters = () => {
    let filtered = [...reports];

    // Filter by status
    if (filterStatus !== 'all') {
      filtered = filtered.filter(r => r.status === filterStatus);
    }

    // Filter by date range preset or custom date range
    if (dateRangePreset !== 'custom') {
      filtered = filtered.filter(r => isReportInPresetRange(r.month, r.year, dateRangePreset));
    } else if (filterStartDate || filterEndDate) {
      // Custom date range
      if (filterStartDate) {
        const start = new Date(filterStartDate);
        filtered = filtered.filter(r => {
          const reportDate = new Date(r.year, r.month - 1, 1);
          return reportDate >= start;
        });
      }
      if (filterEndDate) {
        const end = new Date(filterEndDate);
        end.setMonth(end.getMonth() + 1); // End of month
        filtered = filtered.filter(r => {
          const reportDate = new Date(r.year, r.month - 1, 1);
          return reportDate < end;
        });
      }
    } else {
      // Fallback to month/year filter if no date range preset
      if (filterYear) {
        // Always filter by year if year is selected
        filtered = filtered.filter(r => r.year === filterYear);
        
        // If a specific month is selected (not "All Months" which is 0), also filter by month
        if (filterMonth && filterMonth !== 0) {
          filtered = filtered.filter(r => r.month === filterMonth);
        }
      }
    }

    // Filter by employee
    if (filterEmployee !== 'all') {
      filtered = filtered.filter(r => r.employeeId === filterEmployee);
    }

    // Filter by state
    if (filterState !== 'all') {
      filtered = filtered.filter(r => r.state === filterState);
    }

    // Filter by cost center
    if (filterCostCenter !== 'all') {
      filtered = filtered.filter(r => {
        const costCenters = r.costCenters || [];
        return costCenters.includes(filterCostCenter);
      });
    }

    setFilteredReports(filtered);
  };

  const handleViewReport = (report: ExpenseReport) => {
    setSelectedReport(report);
    setViewDialogOpen(true);
  };

  const handleRequestRevision = async () => {
    if (!selectedReport) return;

    try {
      const response = await fetch(`${API_BASE_URL}/api/expense-reports/${selectedReport.id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'needs_revision',
          comments: revisionComments,
          reviewedBy: financeUserName,
        }),
      });

      if (!response.ok) throw new Error('Failed to request revision');

      alert('Revision request sent to employee successfully!');
      setRevisionDialogOpen(false);
      setRevisionComments('');
      loadReports();
    } catch (error) {
      console.error('Error requesting revision:', error);
      alert('Failed to request revision');
    }
  };

  const handleExportToExcel = async (report: ExpenseReport) => {
    try {
      console.log('📊 Exporting report:', report.id, report.employeeName);
      const response = await fetch(`${API_BASE_URL}/api/export/expense-report-pdf/${report.id}`, {
        method: 'GET',
      });

      if (!response.ok) {
        console.error('❌ Export failed with status:', response.status);
        const errorText = await response.text();
        console.error('❌ Export error response:', errorText);
        throw new Error(`Export failed: ${response.status} ${errorText}`);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      // Generate filename matching Staff Portal format: LASTNAME, FIRSTNAME EXPENSES MMM-YY.pdf
      // Use employeeFullName (full name from database) if available, otherwise fall back to employeeName
      const fullName = report.employeeFullName || report.employeeName || '';
      
      let lastName = 'UNKNOWN';
      let firstName = 'UNKNOWN';
      
      if (fullName.includes(',')) {
        // Format: "Lastname, Firstname"
        const parts = fullName.split(',').map(p => p.trim());
        lastName = parts[0] || 'UNKNOWN';
        firstName = parts[1] || 'UNKNOWN';
      } else {
        // Format: "Firstname Lastname" or single name
        const nameParts = fullName.trim().split(/\s+/).filter(p => p.length > 0);
        if (nameParts.length >= 2) {
          // Multiple words: last word is last name, first word(s) are first name
          lastName = nameParts[nameParts.length - 1];
          firstName = nameParts.slice(0, -1).join(' ');
        } else if (nameParts.length === 1) {
          // Single word: use as last name, no first name
          lastName = nameParts[0];
          firstName = '';
        }
      }
      
      const monthNamesShort = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
      const monthAbbr = monthNamesShort[report.month - 1] || 'UNK';
      const yearShort = report.year.toString().slice(-2);
      
      // Format: LASTNAME, FIRSTNAME EXPENSES MMM-YY.pdf (with space after comma)
      const namePart = firstName ? `${lastName.toUpperCase()}, ${firstName.toUpperCase()}` : lastName.toUpperCase();
      link.download = `${namePart} EXPENSES ${monthAbbr}-${yearShort}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      console.log('✅ PDF export completed successfully');
      
      // Show helpful message about printing workaround for HP printers
      // Note: jsPDF-generated PDFs sometimes have issues with HP printer drivers
      // Only show warning for HP printers (Epson and most others work fine)
      // Show a simpler success message since Epson printers work well
      console.log('✅ PDF export completed - Ready to print!');
      // Note: No alert for printing since Epson printers work fine
    } catch (error) {
      console.error('Error exporting to PDF:', error);
      alert(`Failed to export report: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handlePrintPreview = (report: ExpenseReport) => {
    console.log('🔍 Print Preview - Report Data:', report);
    console.log('🔍 Print Preview - Report Data Structure:', report.reportData);
    setSelectedReport(report);
    setPrintPreviewOpen(true);
  };

  const handlePrint = () => {
    if (!selectedReport) return;
    
    // Create a comprehensive multi-page print document
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    
    const reportData = selectedReport.reportData;
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                       'July', 'August', 'September', 'October', 'November', 'December'];
    const displayName = getDisplayName(selectedReport);
    
    // Generate all pages
    const pages = generateAllPages(selectedReport, reportData, monthNames, displayName);
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Expense Report - ${displayName} - ${monthNames[selectedReport.month - 1]} ${selectedReport.year}</title>
        <style>
          @media print {
            @page {
              size: portrait;
              margin: 0.5in;
            }
            body { font-family: Arial, sans-serif; font-size: ${printStyles.fontSize}; }
            .no-print { display: none !important; }
            .page-break { page-break-before: always; }
            .summary-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
            .summary-table th, .summary-table td { border: 1px solid #000; padding: 8px; text-align: left; }
            .summary-table th { background-color: #f0f0f0; font-weight: bold; }
            .daily-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
            .daily-table th, .daily-table td { border: 1px solid #000; padding: 6px; text-align: left; font-size: ${printStyles.fontSize === '14px' ? '12px' : printStyles.fontSize === '10px' ? '8px' : '10px'}; }
            .daily-table th { background-color: #f0f0f0; font-weight: bold; }
            .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #000; padding-bottom: 20px; }
            .section { margin: 30px 0; }
            .section-title { font-size: 18px; font-weight: bold; margin-bottom: 15px; border-bottom: 1px solid #ccc; padding-bottom: 5px; }
            .approval-box { border: 2px solid #000; padding: 20px; margin: 20px 0; }
            .signature-line { border-bottom: 1px solid #000; height: 30px; margin: 10px 0; }
            .cost-center-header { background-color: #e0e0e0; font-weight: bold; padding: 10px; }
          }
          body { font-family: Arial, sans-serif; font-size: ${printStyles.fontSize}; }
          .summary-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          .summary-table th, .summary-table td { border: 1px solid #000; padding: 8px; text-align: left; }
          .summary-table th { background-color: #f0f0f0; font-weight: bold; }
          .daily-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          .daily-table th, .daily-table td { border: 1px solid #000; padding: 6px; text-align: left; font-size: ${printStyles.fontSize === '14px' ? '12px' : printStyles.fontSize === '10px' ? '8px' : '10px'}; }
          .daily-table th { background-color: #f0f0f0; font-weight: bold; }
          .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #000; padding-bottom: 20px; }
          .section { margin: 30px 0; }
          .section-title { font-size: 18px; font-weight: bold; margin-bottom: 15px; border-bottom: 1px solid #ccc; padding-bottom: 5px; }
          .approval-box { border: 2px solid #000; padding: 20px; margin: 20px 0; }
          .signature-line { border-bottom: 1px solid #000; height: 30px; margin: 10px 0; }
          .cost-center-header { background-color: #e0e0e0; font-weight: bold; padding: 10px; }
        </style>
      </head>
      <body>
        ${pages.join('')}
      </body>
      </html>
    `);
    
    printWindow.document.close();
    printWindow.focus();
    
    // Wait for content to load, then print
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 500);
  };

  const generateAllPages = (report: any, reportData: any, monthNames: string[], displayName: string) => {
    const pages = [];
    
    // Page 1: Approval Cover Sheet
    pages.push(generateApprovalPage(report, reportData, monthNames, displayName));
    
    // Page 2: Summary Sheet
    pages.push(generateSummaryPage(report, reportData, monthNames, displayName));
    
    // Pages 3+: Cost Center Sheets
    if (reportData?.costCenters && reportData.costCenters.length > 0) {
      reportData.costCenters.forEach((costCenter: string, index: number) => {
        pages.push(generateCostCenterPage(report, reportData, monthNames, costCenter, index, displayName));
      });
    }
    
    // Last Page: Timesheet
    pages.push(generateTimesheetPage(report, reportData, monthNames, displayName));
    
    return pages;
  };

  const generateApprovalPage = (report: any, reportData: any, monthNames: string[], displayName: string) => {
    return `
      <div class="page-break">
        <div class="header">
          <h1>MONTHLY EXPENSE REPORT APPROVAL COVER SHEET</h1>
        </div>
        
        <div style="margin: 30px 0;">
          <h2>OXFORD HOUSE, INC.</h2>
          <p>1010 Wayne Ave. Suite # 300<br>Silver Spring, MD 20910</p>
        </div>
        
        <div class="section">
          <table class="summary-table">
            <tr><th>Name:</th><td>${displayName}</td></tr>
            <tr><th>Month:</th><td>${monthNames[report.month - 1]}, ${report.year}</td></tr>
            <tr><th>Date Completed:</th><td>${report.submittedAt ? new Date(report.submittedAt).toLocaleDateString() : 'Not submitted'}</td></tr>
            <tr><th>Total Miles:</th><td>${report.totalMiles.toFixed(1)}</td></tr>
            <tr><th>Total Expenses:</th><td><strong>$${report.totalExpenses.toFixed(2)}</strong></td></tr>
          </table>
        </div>
        
        <div class="approval-box">
          <h3>Signatures of Approval:</h3>
          <div class="signature-line">
            <strong>Direct Supervisor:</strong> ${reportData?.supervisorSignature ? '✓ Signed' : '_________________'}
            <span style="float: right;">Date: _________________</span>
          </div>
          <div class="signature-line">
            <strong>Finance Department:</strong> _________________
            <span style="float: right;">Date: _________________</span>
          </div>
        </div>
      </div>
    `;
  };

  const generateSummaryPage = (report: any, reportData: any, monthNames: string[], displayName: string) => {
    return `
      <div class="page-break">
        <div class="header">
          <h1>MONTHLY EXPENSE REPORT SUMMARY SHEET</h1>
        </div>
        
        <div class="section">
          <table class="summary-table">
            <tr><th>Name:</th><td>${displayName}</td></tr>
            <tr><th>Month:</th><td>${monthNames[report.month - 1]}, ${report.year}</td></tr>
            <tr><th>Date Completed:</th><td>${report.submittedAt ? new Date(report.submittedAt).toLocaleDateString() : 'Not submitted'}</td></tr>
          </table>
        </div>
        
        <div class="section">
          <div class="section-title">Expense Summary</div>
          <table class="summary-table">
            <tr><th>Mileage Reimbursement</th><td>$${report.totalMileageAmount.toFixed(2)}</td></tr>
            <tr><th>Phone/Internet/Fax</th><td>$${reportData?.phoneInternetFax || 0}</td></tr>
            <tr><th>Air/Rail/Bus</th><td>$${reportData?.airRailBus || 0}</td></tr>
            <tr><th>Vehicle Rental/Fuel</th><td>$${reportData?.vehicleRentalFuel || 0}</td></tr>
            <tr><th>Parking/Tolls</th><td>$${reportData?.parkingTolls || 0}</td></tr>
            <tr><th>Ground Transportation</th><td>$${reportData?.groundTransportation || 0}</td></tr>
            <tr><th>Hotels/Airbnb</th><td>$${reportData?.hotelsAirbnb || 0}</td></tr>
            <tr><th>Per Diem</th><td>$${reportData?.perDiem || 0}</td></tr>
            <tr><th>Other Expenses</th><td>$${reportData?.other || 0}</td></tr>
            <tr style="border-top: 2px solid #000;"><th><strong>Total Expenses</strong></th><td><strong>$${report.totalExpenses.toFixed(2)}</strong></td></tr>
          </table>
        </div>
        
        <div class="section">
          <p><strong>Payable to:</strong> ${displayName}</p>
          <p><strong>Base Address:</strong> ${reportData?.baseAddress || 'N/A'}</p>
        </div>
      </div>
    `;
  };

  const generateCostCenterPage = (report: any, reportData: any, monthNames: string[], costCenter: string, index: number, displayName: string) => {
    const daysInMonth = new Date(report.year, report.month - 1, 0).getDate();
    
    return `
      <div class="page-break">
        <div class="header">
          <h1>COST CENTER TRAVEL SHEET - ${costCenter}</h1>
          <h3>${displayName} - ${monthNames[report.month - 1]} ${report.year}</h3>
        </div>
        
        <div class="section">
          <table class="daily-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Description/Activity</th>
                <th>Hours</th>
                <th>Odometer Start</th>
                <th>Odometer End</th>
                <th>Miles</th>
                <th>Mileage ($)</th>
                <th>Per Diem</th>
              </tr>
            </thead>
            <tbody>
              ${Array.from({ length: daysInMonth }, (_, i) => {
                const day = i + 1;
                const dateStr = `${report.month.toString().padStart(2, '0')}/${day.toString().padStart(2, '0')}/${report.year.toString().slice(-2)}`;
                const entry = reportData?.dailyEntries?.find((e: any) => e.date === dateStr);
                
                return `
                  <tr>
                    <td>${dateStr}</td>
                    <td style="white-space: pre-wrap;">${entry?.description || ''}</td>
                    <td>${entry?.hoursWorked || 0}</td>
                    <td>${entry?.odometerStart || 0}</td>
                    <td>${entry?.odometerEnd || 0}</td>
                    <td>${entry?.milesTraveled || 0}</td>
                    <td>$${entry?.mileageAmount?.toFixed(2) || '0.00'}</td>
                    <td>$${entry?.perDiem?.toFixed(2) || '0.00'}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
        
        <div class="section">
          <div class="section-title">Subtotals</div>
          <table class="summary-table">
            <tr><th>Total Hours:</th><td>${reportData?.totalHours || 0}</td></tr>
            <tr><th>Total Miles:</th><td>${report.totalMiles.toFixed(1)}</td></tr>
            <tr><th>Total Mileage Amount:</th><td>$${report.totalMileageAmount.toFixed(2)}</td></tr>
            <tr><th>Total Per Diem:</th><td>$${reportData?.perDiem || 0}</td></tr>
          </table>
        </div>
      </div>
    `;
  };

  const generateTimesheetPage = (report: any, reportData: any, monthNames: string[], displayName: string) => {
    const daysInMonth = new Date(report.year, report.month - 1, 0).getDate();
    
    return `
      <div class="page-break">
        <div class="header">
          <h1>MONTHLY TIMESHEET</h1>
          <h3>${displayName} - ${monthNames[report.month - 1]} ${report.year}</h3>
        </div>
        
        <div class="section">
          <table class="daily-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Cost Center</th>
                <th>Hours Worked</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              ${Array.from({ length: daysInMonth }, (_, i) => {
                const day = i + 1;
                const dateStr = `${report.month.toString().padStart(2, '0')}/${day.toString().padStart(2, '0')}/${report.year.toString().slice(-2)}`;
                const entry = reportData?.dailyEntries?.find((e: any) => e.date === dateStr);
                
                return `
                  <tr>
                    <td>${dateStr}</td>
                    <td>${reportData?.costCenters?.[0] || 'N/A'}</td>
                    <td>${entry?.hoursWorked || 0}</td>
                    <td style="white-space: pre-wrap;">${entry?.description || ''}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
        
        <div class="section">
          <div class="section-title">Cost Center Hours Summary</div>
          <table class="summary-table">
            ${reportData?.costCenters?.map((cc: string) => `
              <tr><th>${cc}:</th><td>${reportData?.totalHours || 0} hours</td></tr>
            `).join('') || '<tr><th>No cost centers assigned</th><td>0 hours</td></tr>'}
            <tr style="border-top: 2px solid #000;"><th><strong>Total Hours:</strong></th><td><strong>${reportData?.totalHours || 0}</strong></td></tr>
          </table>
        </div>
        
        <div class="approval-box">
          <h3>Employee Signature:</h3>
          <div class="signature-line">
            ${reportData?.employeeSignature ? '✓ Signed' : '_________________'}
            <span style="float: right;">Date: _________________</span>
          </div>
        </div>
      </div>
    `;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'default';
      case 'submitted': return 'info';
      case 'approved': return 'success';
      case 'rejected': return 'error';
      case 'needs_revision': return 'warning';
      default: return 'default';
    }
  };

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  // Get unique employees for filter
  const uniqueEmployees = Array.from(new Set(reports.map(r => r.employeeId)))
    .map(id => {
      const report = reports.find(r => r.employeeId === id);
      return { id, name: report ? getDisplayName(report) : id };
    });

  // Get unique states for filter
  const uniqueStates = Array.from(new Set(
    reports
      .map(r => r.state)
      .filter((state): state is string => !!state)
  )).sort();

  // Get unique cost centers for filter
  const uniqueCostCenters = Array.from(new Set(
    reports.flatMap(r => r.costCenters || [])
  )).sort();

  // Handle date range preset change
  const handleDateRangePresetChange = (preset: string) => {
    setDateRangePreset(preset);
    if (preset !== 'custom') {
      // Clear month/year filters when using preset
      setFilterMonth(0);
      setFilterYear(0);
      setFilterStartDate('');
      setFilterEndDate('');
    }
  };

  const TabPanel = ({ children, value, index }: any) => (
    <div role="tabpanel" hidden={value !== index}>
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" gutterBottom>
          💰 Finance Portal
        </Typography>
        <Typography variant="subtitle1" color="textSecondary">
          Welcome, {financeUserName}
        </Typography>
      </Box>

      {/* Tabs */}
      <Tabs value={activeTab} onChange={(e, val) => setActiveTab(val)} sx={{ mb: 3 }}>
        <Tab label="All Reports" />
        <Tab label="Pending Review" />
        <Tab label="Approved Reports" />
        <Tab label="Needs Revision" />
        <Tab label="Reports & Analytics" />
      </Tabs>

      {/* Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {/* First Row: Date Range Presets */}
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
              <FormControl size="small" sx={{ minWidth: 180 }}>
                <InputLabel>Date Range</InputLabel>
                <Select
                  value={dateRangePreset}
                  label="Date Range"
                  onChange={(e) => handleDateRangePresetChange(e.target.value)}
                >
                  <MenuItem value="custom">Custom Range</MenuItem>
                  <MenuItem value="this-week">This Week</MenuItem>
                  <MenuItem value="last-week">Last Week</MenuItem>
                  <MenuItem value="this-month">This Month</MenuItem>
                  <MenuItem value="last-month">Last Month</MenuItem>
                  <MenuItem value="this-quarter">This Quarter</MenuItem>
                  <MenuItem value="last-quarter">Last Quarter</MenuItem>
                  <MenuItem value="this-year">This Year</MenuItem>
                </Select>
              </FormControl>

              {dateRangePreset === 'custom' && (
                <>
                  <TextField
                    size="small"
                    label="Start Date"
                    type="date"
                    value={filterStartDate}
                    onChange={(e) => setFilterStartDate(e.target.value)}
                    InputLabelProps={{ shrink: true }}
                    sx={{ width: 160 }}
                  />
                  <TextField
                    size="small"
                    label="End Date"
                    type="date"
                    value={filterEndDate}
                    onChange={(e) => setFilterEndDate(e.target.value)}
                    InputLabelProps={{ shrink: true }}
                    sx={{ width: 160 }}
                  />
                  <FormControl size="small" sx={{ minWidth: 120 }}>
                    <InputLabel>Month</InputLabel>
                    <Select
                      value={filterMonth}
                      label="Month"
                      onChange={(e) => setFilterMonth(Number(e.target.value))}
                    >
                      <MenuItem value={0}>All Months</MenuItem>
                      {monthNames.map((month, idx) => (
                        <MenuItem key={idx} value={idx + 1}>{month}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <TextField
                    size="small"
                    label="Year"
                    type="number"
                    value={filterYear || ''}
                    onChange={(e) => setFilterYear(Number(e.target.value) || 0)}
                    sx={{ width: 100 }}
                    placeholder="All Years"
                  />
                </>
              )}
            </Box>

            {/* Second Row: Other Filters */}
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
              <FormControl size="small" sx={{ minWidth: 150 }}>
                <InputLabel>Status</InputLabel>
                <Select
                  value={filterStatus}
                  label="Status"
                  onChange={(e) => setFilterStatus(e.target.value)}
                >
                  <MenuItem value="all">All Statuses</MenuItem>
                  <MenuItem value="draft">Draft</MenuItem>
                  <MenuItem value="submitted">Submitted</MenuItem>
                  <MenuItem value="approved">Approved</MenuItem>
                  <MenuItem value="needs_revision">Needs Revision</MenuItem>
                </Select>
              </FormControl>
              
              <FormControl size="small" sx={{ minWidth: 180 }}>
                <InputLabel>Employee</InputLabel>
                <Select
                  value={filterEmployee}
                  label="Employee"
                  onChange={(e) => setFilterEmployee(e.target.value)}
                >
                  <MenuItem value="all">All Employees</MenuItem>
                  {uniqueEmployees.map(emp => (
                    <MenuItem key={emp.id} value={emp.id}>{emp.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl size="small" sx={{ minWidth: 120 }}>
                <InputLabel>State</InputLabel>
                <Select
                  value={filterState}
                  label="State"
                  onChange={(e) => setFilterState(e.target.value)}
                >
                  <MenuItem value="all">All States</MenuItem>
                  {uniqueStates.map(state => (
                    <MenuItem key={state} value={state}>{state}</MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl size="small" sx={{ minWidth: 200 }}>
                <InputLabel>Cost Center</InputLabel>
                <Select
                  value={filterCostCenter}
                  label="Cost Center"
                  onChange={(e) => setFilterCostCenter(e.target.value)}
                >
                  <MenuItem value="all">All Cost Centers</MenuItem>
                  {uniqueCostCenters.map(cc => (
                    <MenuItem key={cc} value={cc}>{cc}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              
              <Button
                variant="outlined"
                startIcon={<RefreshIcon />}
                onClick={loadReports}
              >
                Refresh
              </Button>
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* Reports Table */}
      <TabPanel value={activeTab} index={0}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress />
          </Box>
        ) : filteredReports.length === 0 ? (
          <Alert severity="info">No reports found matching the filters.</Alert>
        ) : (
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow sx={{ bgcolor: 'grey.100' }}>
                  <TableCell 
                    sx={{ cursor: 'pointer', userSelect: 'none', '&:hover': { bgcolor: 'grey.200' } }}
                    onClick={() => handleSort('employeeName')}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <strong>Employee</strong>
                      {getSortIcon('employeeName')}
                    </Box>
                  </TableCell>
                  <TableCell><strong>Period</strong></TableCell>
                  <TableCell 
                    align="right"
                    sx={{ cursor: 'pointer', userSelect: 'none', '&:hover': { bgcolor: 'grey.200' } }}
                    onClick={() => handleSort('totalMiles')}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.5 }}>
                      <strong>Miles</strong>
                      {getSortIcon('totalMiles')}
                    </Box>
                  </TableCell>
                  <TableCell 
                    align="right"
                    sx={{ cursor: 'pointer', userSelect: 'none', '&:hover': { bgcolor: 'grey.200' } }}
                    onClick={() => handleSort('totalMileageAmount')}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.5 }}>
                      <strong>Mileage ($)</strong>
                      {getSortIcon('totalMileageAmount')}
                    </Box>
                  </TableCell>
                  <TableCell 
                    align="right"
                    sx={{ cursor: 'pointer', userSelect: 'none', '&:hover': { bgcolor: 'grey.200' } }}
                    onClick={() => handleSort('totalExpenses')}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.5 }}>
                      <strong>Total Expenses ($)</strong>
                      {getSortIcon('totalExpenses')}
                    </Box>
                  </TableCell>
                  <TableCell 
                    sx={{ cursor: 'pointer', userSelect: 'none', '&:hover': { bgcolor: 'grey.200' } }}
                    onClick={() => handleSort('status')}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <strong>Status</strong>
                      {getSortIcon('status')}
                    </Box>
                  </TableCell>
                  <TableCell 
                    sx={{ cursor: 'pointer', userSelect: 'none', '&:hover': { bgcolor: 'grey.200' } }}
                    onClick={() => handleSort('submittedAt')}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <strong>Submitted</strong>
                      {getSortIcon('submittedAt')}
                    </Box>
                  </TableCell>
                  <TableCell align="center"><strong>Actions</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredReports.map((report) => (
                  <TableRow key={report.id} hover>
                    <TableCell>{getDisplayName(report)}</TableCell>
                    <TableCell>{monthNames[report.month - 1]} {report.year}</TableCell>
                    <TableCell align="right">{report.totalMiles.toFixed(1)}</TableCell>
                    <TableCell align="right">${report.totalMileageAmount.toFixed(2)}</TableCell>
                    <TableCell align="right">${report.totalExpenses.toFixed(2)}</TableCell>
                    <TableCell>
                      <Chip
                        label={report.status.replace('_', ' ').toUpperCase()}
                        color={getStatusColor(report.status) as any}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      {report.submittedAt ? new Date(report.submittedAt).toLocaleDateString() : '-'}
                    </TableCell>
                    <TableCell align="center">
                      <IconButton
                        size="small"
                        color="primary"
                        onClick={() => handleViewReport(report)}
                        title="View Report"
                      >
                        <ViewIcon />
                      </IconButton>
                      <IconButton
                        size="small"
                        color="secondary"
                        onClick={() => handlePrintPreview(report)}
                        title="Print Preview"
                      >
                        <PrintIcon />
                      </IconButton>
                      <IconButton
                        size="small"
                        color="success"
                        onClick={() => handleExportToExcel(report)}
                        title="Export to Excel"
                      >
                        <DownloadIcon />
                      </IconButton>
                      {report.status === 'submitted' && (
                        <IconButton
                          size="small"
                          color="warning"
                          onClick={() => {
                            setSelectedReport(report);
                            setRevisionDialogOpen(true);
                          }}
                          title="Request Revision"
                        >
                          <SendIcon />
                        </IconButton>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </TabPanel>

      {/* Reports & Analytics */}
      <TabPanel value={activeTab} index={4}>
        <ReportsAnalyticsTab />
      </TabPanel>

      {/* Pending Review Tab */}
      <TabPanel value={activeTab} index={1}>
        {filteredReports.filter(r => r.status === 'submitted').length === 0 ? (
          <Alert severity="info">No reports pending review.</Alert>
        ) : (
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow sx={{ bgcolor: 'grey.100' }}>
                  <TableCell><strong>Employee</strong></TableCell>
                  <TableCell><strong>Period</strong></TableCell>
                  <TableCell align="right"><strong>Total Expenses ($)</strong></TableCell>
                  <TableCell><strong>Submitted</strong></TableCell>
                  <TableCell align="center"><strong>Actions</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredReports.filter(r => r.status === 'submitted').map((report) => (
                  <TableRow key={report.id} hover>
                    <TableCell>{getDisplayName(report)}</TableCell>
                    <TableCell>{monthNames[report.month - 1]} {report.year}</TableCell>
                    <TableCell align="right">${report.totalExpenses.toFixed(2)}</TableCell>
                    <TableCell>
                      {report.submittedAt ? new Date(report.submittedAt).toLocaleDateString() : '-'}
                    </TableCell>
                    <TableCell align="center">
                      <IconButton
                        size="small"
                        color="primary"
                        onClick={() => handleViewReport(report)}
                      >
                        <ViewIcon />
                      </IconButton>
                      <IconButton
                        size="small"
                        color="warning"
                        onClick={() => {
                          setSelectedReport(report);
                          setRevisionDialogOpen(true);
                        }}
                      >
                        <SendIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </TabPanel>

      {/* Approved Reports Tab */}
      <TabPanel value={activeTab} index={2}>
        {filteredReports.filter(r => r.status === 'approved').length === 0 ? (
          <Alert severity="info">No approved reports.</Alert>
        ) : (
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow sx={{ bgcolor: 'grey.100' }}>
                  <TableCell><strong>Employee</strong></TableCell>
                  <TableCell><strong>Period</strong></TableCell>
                  <TableCell align="right"><strong>Total Expenses ($)</strong></TableCell>
                  <TableCell align="center"><strong>Actions</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredReports.filter(r => r.status === 'approved').map((report) => (
                  <TableRow key={report.id} hover>
                    <TableCell>{getDisplayName(report)}</TableCell>
                    <TableCell>{monthNames[report.month - 1]} {report.year}</TableCell>
                    <TableCell align="right">${report.totalExpenses.toFixed(2)}</TableCell>
                    <TableCell align="center">
                      <IconButton
                        size="small"
                        color="primary"
                        onClick={() => handleViewReport(report)}
                      >
                        <ViewIcon />
                      </IconButton>
                      <IconButton
                        size="small"
                        color="secondary"
                        onClick={() => handlePrintPreview(report)}
                      >
                        <PrintIcon />
                      </IconButton>
                      <IconButton
                        size="small"
                        color="success"
                        onClick={() => handleExportToExcel(report)}
                      >
                        <DownloadIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </TabPanel>

      {/* Needs Revision Tab */}
      <TabPanel value={activeTab} index={3}>
        {filteredReports.filter(r => r.status === 'needs_revision').length === 0 ? (
          <Alert severity="info">No reports needing revision.</Alert>
        ) : (
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow sx={{ bgcolor: 'grey.100' }}>
                  <TableCell><strong>Employee</strong></TableCell>
                  <TableCell><strong>Period</strong></TableCell>
                  <TableCell align="right"><strong>Total Expenses ($)</strong></TableCell>
                  <TableCell align="center"><strong>Actions</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredReports.filter(r => r.status === 'needs_revision').map((report) => (
                  <TableRow key={report.id} hover>
                    <TableCell>{getDisplayName(report)}</TableCell>
                    <TableCell>{monthNames[report.month - 1]} {report.year}</TableCell>
                    <TableCell align="right">${report.totalExpenses.toFixed(2)}</TableCell>
                    <TableCell align="center">
                      <IconButton
                        size="small"
                        color="primary"
                        onClick={() => handleViewReport(report)}
                      >
                        <ViewIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </TabPanel>

      {/* View Report Dialog */}
      <Dialog
        open={viewDialogOpen}
        onClose={() => setViewDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {selectedReport && getDisplayName(selectedReport)} - {selectedReport && monthNames[selectedReport.month - 1]} {selectedReport?.year}
        </DialogTitle>
        <DialogContent>
          {selectedReport && (
            <Box>
              <Typography variant="h6" gutterBottom>Report Summary</Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, mb: 3 }}>
                <Box>
                  <Typography><strong>Status:</strong></Typography>
                  <Chip
                    label={selectedReport.status.replace('_', ' ').toUpperCase()}
                    color={getStatusColor(selectedReport.status) as any}
                    size="small"
                    sx={{ mt: 1 }}
                  />
                </Box>
                <Box>
                  <Typography><strong>Submitted:</strong></Typography>
                  <Typography>
                    {selectedReport.submittedAt ? new Date(selectedReport.submittedAt).toLocaleDateString() : 'Not submitted'}
                  </Typography>
                </Box>
                <Box>
                  <Typography><strong>Total Miles:</strong></Typography>
                  <Typography>{selectedReport.totalMiles.toFixed(1)} miles</Typography>
                </Box>
                <Box>
                  <Typography><strong>Mileage Amount:</strong></Typography>
                  <Typography>${selectedReport.totalMileageAmount.toFixed(2)}</Typography>
                </Box>
                <Box>
                  <Typography><strong>Total Expenses:</strong></Typography>
                  <Typography variant="h6" color="primary">
                    ${selectedReport.totalExpenses.toFixed(2)}
                  </Typography>
                </Box>
              </Box>

              {selectedReport.reportData?.dailyEntries && (
                <Box>
                  <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>Daily Breakdown</Typography>
                  <Typography variant="body2" color="textSecondary">
                    {selectedReport.reportData.dailyEntries.filter((e: any) => e.milesTraveled > 0 || e.hoursWorked > 0).length} days with activity
                  </Typography>
                </Box>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setViewDialogOpen(false)}>Close</Button>
          <Button
            variant="contained"
            startIcon={<PrintIcon />}
            onClick={() => {
              setViewDialogOpen(false);
              handlePrintPreview(selectedReport!);
            }}
          >
            Print Preview
          </Button>
          <Button
            variant="contained"
            color="success"
            startIcon={<DownloadIcon />}
            onClick={() => handleExportToExcel(selectedReport!)}
          >
            Export
          </Button>
        </DialogActions>
      </Dialog>

      {/* Request Revision Dialog */}
      <Dialog
        open={revisionDialogOpen}
        onClose={() => setRevisionDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Request Revision</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
            Request revisions from {selectedReport && getDisplayName(selectedReport)} for {selectedReport && monthNames[selectedReport.month - 1]} {selectedReport?.year}
          </Typography>
          <TextField
            fullWidth
            multiline
            rows={4}
            label="Comments / Issues to Address"
            value={revisionComments}
            onChange={(e) => setRevisionComments(e.target.value)}
            placeholder="Please specify what needs to be corrected..."
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRevisionDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            color="warning"
            onClick={handleRequestRevision}
            disabled={!revisionComments.trim()}
          >
            Send Revision Request
          </Button>
        </DialogActions>
      </Dialog>

      {/* Print Preview Dialog */}
      <Dialog
        open={printPreviewOpen}
        onClose={() => setPrintPreviewOpen(false)}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>
          Print Preview - {selectedReport && getDisplayName(selectedReport)}
          <IconButton
            onClick={() => setPrintPreviewOpen(false)}
            sx={{ position: 'absolute', right: 8, top: 8 }}
          >
            ×
          </IconButton>
        </DialogTitle>
        <DialogContent>
          {/* Print Style Customization */}
          <Card sx={{ mb: 3, bgcolor: 'grey.50' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>🎨 Print Style Customization</Typography>
              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                <FormControl size="small" sx={{ minWidth: 150 }}>
                  <InputLabel>Font Size</InputLabel>
                  <Select
                    value={printStyles.fontSize}
                    label="Font Size"
                    onChange={(e) => setPrintStyles({ ...printStyles, fontSize: e.target.value })}
                  >
                    <MenuItem value="10px">Small (10px)</MenuItem>
                    <MenuItem value="12px">Normal (12px)</MenuItem>
                    <MenuItem value="14px">Large (14px)</MenuItem>
                  </Select>
                </FormControl>
                
                <FormControl size="small" sx={{ minWidth: 150 }}>
                  <InputLabel>Spacing</InputLabel>
                  <Select
                    value={printStyles.spacing}
                    label="Spacing"
                    onChange={(e) => setPrintStyles({ ...printStyles, spacing: e.target.value })}
                  >
                    <MenuItem value="compact">Compact</MenuItem>
                    <MenuItem value="normal">Normal</MenuItem>
                    <MenuItem value="relaxed">Relaxed</MenuItem>
                  </Select>
                </FormControl>
                
                <FormControl size="small" sx={{ minWidth: 150 }}>
                  <InputLabel>Orientation</InputLabel>
                  <Select
                    value={printStyles.pageOrientation}
                    label="Orientation"
                    onChange={(e) => setPrintStyles({ ...printStyles, pageOrientation: e.target.value })}
                  >
                    <MenuItem value="portrait">Portrait</MenuItem>
                    <MenuItem value="landscape">Landscape</MenuItem>
                  </Select>
                </FormControl>
              </Box>
            </CardContent>
          </Card>

          {/* Print Preview Content */}
          <Paper
            id="printable-report"
            sx={{
              p: 4,
              fontSize: printStyles.fontSize,
              '@media print': {
                boxShadow: 'none',
                padding: 0,
                size: 'portrait', // Always portrait to match Staff Portal
              },
            }}
          >
            {/* Report Header */}
            <Box sx={{ textAlign: 'center', mb: 4, borderBottom: '2px solid #000', pb: 2 }}>
              <Typography variant="h4" sx={{ fontWeight: 'bold', mb: 1 }}>
                OXFORD HOUSE, INC.
              </Typography>
              <Typography variant="h5" sx={{ fontWeight: 'bold', mb: 1 }}>
                MONTHLY EXPENSE REPORT
              </Typography>
              <Typography variant="h6" color="textSecondary">
                {selectedReport && getDisplayName(selectedReport)} - {selectedReport && monthNames[selectedReport.month - 1]} {selectedReport?.year}
              </Typography>
            </Box>

            {/* Report Summary */}
            <Box sx={{ mb: 4 }}>
              <Typography variant="h6" gutterBottom sx={{ borderBottom: '1px solid #ccc', pb: 1 }}>
                Report Summary
              </Typography>
              <Table size="small" sx={{ border: '1px solid #000', borderCollapse: 'collapse' }}>
                <TableBody>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 'bold', border: '1px solid #000', bgcolor: 'grey.100' }}>Status</TableCell>
                    <TableCell sx={{ border: '1px solid #000' }}>{selectedReport?.status.replace('_', ' ').toUpperCase()}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 'bold', border: '1px solid #000', bgcolor: 'grey.100' }}>Submitted Date</TableCell>
                    <TableCell sx={{ border: '1px solid #000' }}>
                      {selectedReport?.submittedAt ? new Date(selectedReport.submittedAt).toLocaleDateString() : 'Not submitted'}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 'bold', border: '1px solid #000', bgcolor: 'grey.100' }}>Total Miles</TableCell>
                    <TableCell sx={{ border: '1px solid #000' }}>{selectedReport?.totalMiles.toFixed(1)}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 'bold', border: '1px solid #000', bgcolor: 'grey.100' }}>Mileage Reimbursement</TableCell>
                    <TableCell sx={{ border: '1px solid #000' }}>${selectedReport?.totalMileageAmount.toFixed(2)}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 'bold', border: '1px solid #000', bgcolor: 'grey.100' }}>Total Expenses</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', fontSize: '1.1em', border: '1px solid #000' }}>
                      ${selectedReport?.totalExpenses.toFixed(2)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </Box>

            {/* Daily Activity Breakdown */}
            {selectedReport?.reportData?.dailyEntries && (
              <Box sx={{ mb: 4 }}>
                <Typography variant="h6" gutterBottom sx={{ borderBottom: '1px solid #ccc', pb: 1 }}>
                  Daily Activity Breakdown
                </Typography>
                <Table size="small" sx={{ border: '1px solid #000', borderCollapse: 'collapse' }}>
                  <TableHead>
                    <TableRow sx={{ bgcolor: 'grey.100' }}>
                      <TableCell sx={{ border: '1px solid #000', fontWeight: 'bold' }}>Date</TableCell>
                      <TableCell sx={{ border: '1px solid #000', fontWeight: 'bold' }}>Description of Activity</TableCell>
                      <TableCell sx={{ border: '1px solid #000', fontWeight: 'bold' }} align="right">Miles Traveled</TableCell>
                      <TableCell sx={{ border: '1px solid #000', fontWeight: 'bold' }} align="right">Hours Worked</TableCell>
                      <TableCell sx={{ border: '1px solid #000', fontWeight: 'bold' }} align="right">Mileage Amount</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {selectedReport.reportData.dailyEntries
                      .filter((entry: any) => entry.milesTraveled > 0 || entry.hoursWorked > 0)
                      .map((entry: any, idx: number) => (
                        <TableRow key={idx}>
                          <TableCell sx={{ border: '1px solid #000' }}>{entry.date}</TableCell>
                          <TableCell sx={{ whiteSpace: 'pre-wrap', border: '1px solid #000' }}>{entry.description || ''}</TableCell>
                          <TableCell sx={{ border: '1px solid #000' }} align="right">
                            {entry.milesTraveled > 0 ? entry.milesTraveled.toFixed(1) : '-'}
                          </TableCell>
                          <TableCell sx={{ border: '1px solid #000' }} align="right">
                            {entry.hoursWorked > 0 ? entry.hoursWorked : '-'}
                          </TableCell>
                          <TableCell sx={{ border: '1px solid #000' }} align="right">
                            ${entry.mileageAmount ? entry.mileageAmount.toFixed(2) : '0.00'}
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </Box>
            )}

            {/* Receipt Summary */}
            {selectedReport?.reportData?.receipts && selectedReport.reportData.receipts.length > 0 && (
              <Box sx={{ mb: 4 }}>
                <Typography variant="h6" gutterBottom sx={{ borderBottom: '1px solid #ccc', pb: 1 }}>
                  Receipt Summary
                </Typography>
                <Table size="small" sx={{ border: '1px solid #000', borderCollapse: 'collapse' }}>
                  <TableHead>
                    <TableRow sx={{ bgcolor: 'grey.100' }}>
                      <TableCell sx={{ border: '1px solid #000', fontWeight: 'bold' }}>Date</TableCell>
                      <TableCell sx={{ border: '1px solid #000', fontWeight: 'bold' }}>Vendor</TableCell>
                      <TableCell sx={{ border: '1px solid #000', fontWeight: 'bold' }}>Description</TableCell>
                      <TableCell sx={{ border: '1px solid #000', fontWeight: 'bold' }}>Category</TableCell>
                      <TableCell sx={{ border: '1px solid #000', fontWeight: 'bold' }} align="right">Amount</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {selectedReport.reportData.receipts.map((receipt: any, idx: number) => (
                      <TableRow key={idx}>
                        <TableCell sx={{ border: '1px solid #000' }}>
                          {new Date(receipt.date).toLocaleDateString()}
                        </TableCell>
                        <TableCell sx={{ border: '1px solid #000' }}>{receipt.vendor || ''}</TableCell>
                        <TableCell sx={{ border: '1px solid #000' }}>{receipt.description || ''}</TableCell>
                        <TableCell sx={{ border: '1px solid #000' }}>{receipt.category || ''}</TableCell>
                        <TableCell sx={{ border: '1px solid #000' }} align="right">
                          ${receipt.amount ? receipt.amount.toFixed(2) : '0.00'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Box>
            )}

            {/* Expense Categories Breakdown */}
            <Box sx={{ mb: 4 }}>
              <Typography variant="h6" gutterBottom sx={{ borderBottom: '1px solid #ccc', pb: 1 }}>
                Expense Categories Breakdown
              </Typography>
              <Table size="small" sx={{ border: '1px solid #000', borderCollapse: 'collapse' }}>
                <TableBody>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 'bold', border: '1px solid #000', bgcolor: 'grey.100' }}>Mileage Reimbursement</TableCell>
                    <TableCell sx={{ border: '1px solid #000' }}>${selectedReport?.totalMileageAmount.toFixed(2)}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 'bold', border: '1px solid #000', bgcolor: 'grey.100' }}>Phone/Internet/Fax</TableCell>
                    <TableCell sx={{ border: '1px solid #000' }}>${selectedReport?.reportData?.phoneInternetFax || 0}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 'bold', border: '1px solid #000', bgcolor: 'grey.100' }}>Air/Rail/Bus</TableCell>
                    <TableCell sx={{ border: '1px solid #000' }}>${selectedReport?.reportData?.airRailBus || 0}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 'bold', border: '1px solid #000', bgcolor: 'grey.100' }}>Vehicle Rental/Fuel</TableCell>
                    <TableCell sx={{ border: '1px solid #000' }}>${selectedReport?.reportData?.vehicleRentalFuel || 0}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 'bold', border: '1px solid #000', bgcolor: 'grey.100' }}>Parking/Tolls</TableCell>
                    <TableCell sx={{ border: '1px solid #000' }}>${selectedReport?.reportData?.parkingTolls || 0}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 'bold', border: '1px solid #000', bgcolor: 'grey.100' }}>Ground Transportation</TableCell>
                    <TableCell sx={{ border: '1px solid #000' }}>${selectedReport?.reportData?.groundTransportation || 0}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 'bold', border: '1px solid #000', bgcolor: 'grey.100' }}>Hotels/Airbnb</TableCell>
                    <TableCell sx={{ border: '1px solid #000' }}>${selectedReport?.reportData?.hotelsAirbnb || 0}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 'bold', border: '1px solid #000', bgcolor: 'grey.100' }}>Per Diem</TableCell>
                    <TableCell sx={{ border: '1px solid #000' }}>${selectedReport?.reportData?.perDiem || 0}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 'bold', border: '1px solid #000', bgcolor: 'grey.100' }}>Other Expenses</TableCell>
                    <TableCell sx={{ border: '1px solid #000' }}>${selectedReport?.reportData?.other || 0}</TableCell>
                  </TableRow>
                  <TableRow sx={{ borderTop: '2px solid #000' }}>
                    <TableCell sx={{ fontWeight: 'bold', border: '1px solid #000', bgcolor: 'grey.100' }}>
                      <strong>Total Expenses</strong>
                    </TableCell>
                    <TableCell sx={{ fontWeight: 'bold', fontSize: '1.1em', border: '1px solid #000' }}>
                      <strong>${selectedReport?.totalExpenses.toFixed(2)}</strong>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </Box>

            {/* Approval Section */}
            <Box sx={{ mb: 4 }}>
              <Typography variant="h6" gutterBottom sx={{ borderBottom: '1px solid #ccc', pb: 1 }}>
                Approval Section
              </Typography>
              <Table size="small" sx={{ border: '1px solid #000', borderCollapse: 'collapse' }}>
                <TableBody>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 'bold', border: '1px solid #000', bgcolor: 'grey.100', width: '30%' }}>Employee Signature</TableCell>
                    <TableCell sx={{ border: '1px solid #000', height: '50px' }}>
                      {selectedReport?.reportData?.employeeSignature ? '✓ Signed' : '_________________'}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 'bold', border: '1px solid #000', bgcolor: 'grey.100' }}>Supervisor Signature</TableCell>
                    <TableCell sx={{ border: '1px solid #000', height: '50px' }}>
                      {selectedReport?.reportData?.supervisorSignature ? '✓ Signed' : '_________________'}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 'bold', border: '1px solid #000', bgcolor: 'grey.100' }}>Finance Approval</TableCell>
                    <TableCell sx={{ border: '1px solid #000', height: '50px' }}>_________________</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </Box>

            {/* Footer */}
            <Box sx={{ textAlign: 'center', mt: 4, fontSize: '10px', color: 'text.secondary' }}>
              Generated on {new Date().toLocaleDateString()} at {new Date().toLocaleTimeString()}
            </Box>
          </Paper>
        </DialogContent>
        <DialogActions sx={{ '@media print': { display: 'none' } }}>
          <Button onClick={() => setPrintPreviewOpen(false)}>Close</Button>
          <Button
            variant="contained"
            startIcon={<PrintIcon />}
            onClick={handlePrint}
          >
            Print
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default FinancePortal;

