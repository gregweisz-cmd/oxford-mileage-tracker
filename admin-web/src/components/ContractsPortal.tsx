/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable react-hooks/exhaustive-deps */
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
  CheckCircle as CheckCircleIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import { ConfirmDeleteDialog } from './ConfirmDeleteDialog';
import { getEmployeeDisplayName } from '../utils/employeeUtils';
import { ReportsAnalyticsTab } from './ReportsAnalyticsTab';
import DetailedReportView from './DetailedReportView';
import { NotificationBell } from './NotificationBell';
import { PerDiemRulesManagement } from './PerDiemRulesManagement';
import { CostCenter, CostCenterApiService } from '../services/costCenterApiService';

// Keyboard shortcuts
import { useKeyboardShortcuts, KeyboardShortcut } from '../hooks/useKeyboardShortcuts';
import KeyboardShortcutsDialog from './KeyboardShortcutsDialog';

// Debug logging
import { debugLog, debugError, debugVerbose } from '../config/debug';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://oxford-mileage-backend.onrender.com';

interface ContractsPortalProps {
  contractsUserId: string;
  contractsUserName: string;
}

interface ExpenseReport {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeFullName?: string; // Full name from database (e.name), used for exports
  employeeEmail: string;
  month: number;
  year: number;
  status: 'draft' | 'submitted' | 'approved' | 'rejected' | 'needs_revision' | 'pending_supervisor' | 'pending_finance';
  totalMiles: number;
  totalMileageAmount: number;
  totalExpenses: number;
  submittedAt?: string;
  reportData?: any;
  state?: string;
  costCenters?: string[];
  currentApprovalStage?: string;
  currentApproverId?: string | null;
}

export const ContractsPortal: React.FC<ContractsPortalProps> = ({ contractsUserId, contractsUserName }) => {
  const [reports, setReports] = useState<ExpenseReport[]>([]);
  const [filteredReports, setFilteredReports] = useState<ExpenseReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(0);
  const [selectedReport, setSelectedReport] = useState<ExpenseReport | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [detailedReportViewOpen, setDetailedReportViewOpen] = useState(false);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  // Note: Contracts portal is review-only, no approval/revision functionality
  // Removed: revisionDialogOpen, revisionComments, handleRequestRevision, handleApproveReport
  const [printPreviewOpen, setPrintPreviewOpen] = useState(false);
  const [costCenters, setCostCenters] = useState<CostCenter[]>([]);
  
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
  
  // Keyboard shortcuts state
  const [shortcutsDialogOpen, setShortcutsDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [reportToDelete, setReportToDelete] = useState<ExpenseReport | null>(null);
  
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
    loadCostCenters();
  }, []);

  const loadCostCenters = async () => {
    try {
      const data = await CostCenterApiService.getAllCostCenters();
      setCostCenters(data);
    } catch (error) {
      debugError('Error loading cost centers:', error);
    }
  };

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
      debugVerbose('📊 Loaded reports:', data.length, 'reports');
      debugVerbose('📊 First report structure:', data[0]);
      
      // Calculate totals from reportData and extract state/cost centers
      const reportsWithTotals = data.map((report: any) => {
        const reportData = report.reportData || {};
        debugVerbose(`📊 Report ${report.id} data:`, reportData);
        
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
      debugError('Error loading reports:', error);
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
    setSelectedReportId(report.id);
    setDetailedReportViewOpen(true);
  };

  const handleDeleteReportClick = (report: ExpenseReport) => {
    setReportToDelete(report);
    setDeleteDialogOpen(true);
  };

  const handleDeleteReportConfirm = async () => {
    if (!reportToDelete) return;
    const id = reportToDelete.id;
    try {
      const res = await fetch(`${API_BASE_URL}/api/expense-reports/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Delete failed (${res.status})`);
      }
      setReportToDelete(null);
      setDeleteDialogOpen(false);
      if (selectedReport?.id === id) {
        setSelectedReport(null);
        setSelectedReportId(null);
        setDetailedReportViewOpen(false);
      }
      loadReports();
    } catch (e) {
      debugError('Delete report error:', e);
      alert(e instanceof Error ? e.message : 'Failed to delete report');
      throw e;
    }
  };

  const handleReportClickFromNotification = async (
    reportId: string,
    employeeId?: string,
    month?: number,
    year?: number
  ) => {
    // Find the report in the current reports list
    const report = reports.find(r => r.id === reportId);
    if (report) {
      handleViewReport(report);
      // Switch to appropriate tab based on status
      if (report.status === 'pending_finance' || report.status === 'submitted') {
        setActiveTab(1); // Pending Review tab
      } else if (report.status === 'approved') {
        setActiveTab(2); // Approved Reports tab
      } else if (report.status === 'needs_revision') {
        setActiveTab(3); // Needs Revision tab
      } else {
        setActiveTab(0); // All Reports tab
      }
      return;
    }

    // If report not in current list, fetch it
    try {
      const response = await fetch(`${API_BASE_URL}/api/expense-reports/${reportId}`);
      if (response.ok) {
        const fetchedReport = await response.json();
        // Convert to ExpenseReport format
        const reportData = fetchedReport.reportData || {};
        const expenseReport: ExpenseReport = {
          id: fetchedReport.id,
          employeeId: fetchedReport.employeeId,
          employeeName: fetchedReport.employeeName || 'Unknown',
          employeeFullName: fetchedReport.employeeFullName,
          employeeEmail: fetchedReport.employeeEmail || '',
          month: fetchedReport.month,
          year: fetchedReport.year,
          status: fetchedReport.status,
          totalMiles: reportData.totalMiles || 0,
          totalMileageAmount: reportData.totalMileageAmount || 0,
          totalExpenses: calculateTotalExpenses(reportData),
          submittedAt: fetchedReport.submittedAt,
          reportData: reportData,
          state: fetchedReport.state,
          costCenters: reportData.costCenters || [],
          currentApprovalStage: fetchedReport.currentApprovalStage,
          currentApproverId: fetchedReport.currentApproverId,
        };
        handleViewReport(expenseReport);
        // Reload reports to include this one
        loadReports();
      }
    } catch (error) {
        debugError('Error fetching report for navigation:', error);
    }
  };

  // Note: Contracts portal is review-only - approval/revision functions removed
  // Contracts team can only view reports, not approve or request revisions

  const handleExportToExcel = async (report: ExpenseReport) => {
    try {
      debugVerbose('📊 Exporting report:', report.id, report.employeeName);
      const response = await fetch(`${API_BASE_URL}/api/export/expense-report-pdf/${report.id}`, {
        method: 'GET',
      });

      if (!response.ok) {
        debugError('❌ Export failed with status:', response.status);
        const errorText = await response.text();
        debugError('❌ Export error response:', errorText);
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
      
      debugVerbose('✅ PDF export completed successfully');
      debugVerbose('✅ PDF export completed - Ready to print!');
      // Note: No alert for printing since Epson printers work fine
    } catch (error) {
      debugError('Error exporting to PDF:', error);
      alert(`Failed to export report: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handlePrintPreview = (report: ExpenseReport) => {
    debugVerbose('🔍 Print Preview - Report Data:', report);
    debugVerbose('🔍 Print Preview - Report Data Structure:', report.reportData);
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
            <strong>Contracts Department:</strong> _________________
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

  // Keyboard shortcuts setup (defined after all handler functions)
  const shortcuts: KeyboardShortcut[] = [
    {
      key: 'r',
      ctrl: true,
      action: () => {
        loadReports();
      },
      description: 'Refresh reports',
    },
    {
      key: 'f',
      ctrl: true,
      action: () => {
        // Focus filter field if available
        const filterInput = document.querySelector('input[placeholder*="Filter"], input[type="text"]') as HTMLInputElement;
        if (filterInput) {
          filterInput.focus();
          filterInput.select();
        }
      },
      description: 'Focus filter field',
    },
    {
      key: '/',
      ctrl: true,
      action: () => {
        setShortcutsDialogOpen(true);
      },
      description: 'Show keyboard shortcuts',
    },
  ];

  // Enable keyboard shortcuts
  useKeyboardShortcuts(shortcuts, true);

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <Box>
          <Typography variant="h4" gutterBottom>
            📋 Contracts Portal
          </Typography>
          <Typography variant="subtitle1" color="textSecondary">
            Welcome, {contractsUserName}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {/* Notification Bell */}
          <NotificationBell 
            employeeId={contractsUserId} 
            role="finance"
            onReportClick={handleReportClickFromNotification}
          />
        </Box>
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
                  <MenuItem value="pending_finance">Pending Finance Review</MenuItem>
                  <MenuItem value="pending_supervisor">Pending Supervisor</MenuItem>
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
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => handleDeleteReportClick(report)}
                        title="Delete report"
                      >
                        <DeleteIcon />
                      </IconButton>
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

      {/* Per Diem Rules */}
      <TabPanel value={activeTab} index={5}>
        <PerDiemRulesManagement costCenters={costCenters} />
      </TabPanel>

      {/* Pending Review Tab */}
      <TabPanel value={activeTab} index={1}>
        {filteredReports.filter(r => r.status === 'pending_finance' || r.status === 'submitted').length === 0 ? (
          <Alert severity="info">No reports pending Contracts review.</Alert>
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
                        color="error"
                        onClick={() => handleDeleteReportClick(report)}
                        title="Delete report"
                      >
                        <DeleteIcon />
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
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => handleDeleteReportClick(report)}
                        title="Delete report"
                      >
                        <DeleteIcon />
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
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => handleDeleteReportClick(report)}
                        title="Delete report"
                      >
                        <DeleteIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </TabPanel>

      {/* Delete report confirmation */}
      <ConfirmDeleteDialog
        open={deleteDialogOpen}
        onClose={() => {
          setDeleteDialogOpen(false);
          setReportToDelete(null);
        }}
        onConfirm={handleDeleteReportConfirm}
        title="Delete expense report?"
        message={
          reportToDelete
            ? `This will permanently delete the report for ${getDisplayName(reportToDelete)} – ${monthNames[reportToDelete.month - 1]} ${reportToDelete.year}. This cannot be undone.`
            : 'This will permanently delete the report. This cannot be undone.'
        }
        confirmButtonLabel="Delete report"
      />

      {/* Detailed Report View - Replaces simple View dialog */}
      {selectedReportId && (
        <DetailedReportView
          reportId={selectedReportId}
          open={detailedReportViewOpen}
          onClose={() => {
            setDetailedReportViewOpen(false);
            setSelectedReportId(null);
          }}
          supervisorMode={true}
          // Contracts portal is review-only - no approval/revision handlers
        />
      )}

      {/* Note: Revision dialog removed - Contracts portal is review-only */}

      {/* Print Preview Dialog - Now uses PDF from backend export endpoint */}
      <Dialog
        open={printPreviewOpen}
        onClose={() => setPrintPreviewOpen(false)}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>
          Print Preview - {selectedReport && getDisplayName(selectedReport)} - {selectedReport && monthNames[selectedReport.month - 1]} {selectedReport?.year}
          <IconButton
            onClick={() => setPrintPreviewOpen(false)}
            sx={{ position: 'absolute', right: 8, top: 8 }}
          >
            ×
          </IconButton>
        </DialogTitle>
        <DialogContent>
          {selectedReport && (
            <Box sx={{ width: '100%', height: '80vh', display: 'flex', flexDirection: 'column' }}>
              <Alert severity="info" sx={{ mb: 2 }}>
                This is the same report format as the Export button. Use your browser's print function (Ctrl+P / Cmd+P) to print.
              </Alert>
              <Box
                component="iframe"
                src={`${API_BASE_URL}/api/export/expense-report-pdf/${selectedReport.id}`}
                sx={{
                  width: '100%',
                  flex: 1,
                  border: '1px solid #ddd',
                  borderRadius: 1,
                  minHeight: '600px',
                }}
                title="Print Preview"
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPrintPreviewOpen(false)}>Close</Button>
          <Button
            variant="contained"
            startIcon={<PrintIcon />}
            onClick={() => {
              // Open PDF in new window for printing
              if (selectedReport) {
                window.open(`${API_BASE_URL}/api/export/expense-report-pdf/${selectedReport.id}`, '_blank');
              }
            }}
          >
            Open in New Window to Print
          </Button>
        </DialogActions>
      </Dialog>

      {/* Keyboard Shortcuts Dialog */}
      <KeyboardShortcutsDialog
        open={shortcutsDialogOpen}
        onClose={() => setShortcutsDialogOpen(false)}
        shortcuts={shortcuts}
        title="Keyboard Shortcuts - Contracts Portal"
      />
    </Container>
  );
};

export default ContractsPortal;

