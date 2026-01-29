// Staff Portal - Expense Report Management Interface
// Designed to mirror the uploaded spreadsheet layout for easy transition
import React, { useState, useEffect, useCallback } from 'react';
import { debugLog, debugError, debugWarn, debugVerbose } from './config/debug';

// Material-UI components for spreadsheet-like interface
import {
  Container,
  Card,
  CardContent,
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  TextField,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Autocomplete,
  Alert,
  AlertTitle,
  Checkbox,
  Tooltip,
} from '@mui/material';

import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Close as CloseIcon,
  CloudUpload as UploadIcon,
  CloudDownload as CloudDownloadIcon,
  Check as CheckIcon,
} from '@mui/icons-material';

// PDF generation imports

// Tips system imports
import { TipCard } from './components/TipCard';
import { useWebTips, TipsProvider } from './contexts/TipsContext';

// Real-time sync imports
import { useRealtimeSync, useRealtimeStatus } from './hooks/useRealtimeSync';

// Per Diem Rules imports
import { PerDiemRulesService } from './services/perDiemRulesService';

// Data entry imports
import { DataEntryManager } from './components/DataEntryManager';
import { MileageEntryForm, MileageEntryFormData } from './components/DataEntryForms';

// UI Enhancement imports
import { ToastProvider, useToast } from './contexts/ToastContext';
import { LoadingOverlay, useLoadingState } from './components/LoadingOverlay';
import { EnhancedHeader } from './components/EnhancedHeader';
import { EnhancedTabNavigation, createTabConfig } from './components/EnhancedTabNavigation';
import { UIEnhancementProvider } from './services/uiEnhancementService';

// Report completeness checker
import { ReportCompletenessService, CompletenessReport, CompletenessIssue } from './services/reportCompletenessService';

// User settings component
import UserSettings from './components/UserSettings';

// Dashboard notifications component
import { DashboardNotifications } from './components/DashboardNotifications';

// Approval status card
import EmployeeApprovalStatusCard, { ApprovalWorkflowStepSummary, ApprovalHistoryEntry } from './components/EmployeeApprovalStatusCard';

// Address formatting utility
import { formatLocationForDescription } from './utils/addressFormatter';

// Keyboard shortcuts
import { useKeyboardShortcuts, KeyboardShortcut } from './hooks/useKeyboardShortcuts';
import KeyboardShortcutsDialog from './components/KeyboardShortcutsDialog';

// Date picker imports
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs, { Dayjs } from 'dayjs';

// API URL configuration
const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://oxford-mileage-backend.onrender.com';

// Props interface for the StaffPortal component
interface StaffPortalProps {
  employeeId: string;
  reportMonth: number;
  reportYear: number;
  isAdminView?: boolean; // Optional prop to indicate admin review mode
  supervisorSignature?: string | null; // Optional supervisor signature for admin view
  supervisorMode?: boolean; // Optional prop to indicate supervisor is viewing
  supervisorId?: string; // Supervisor ID for approval workflow
  supervisorName?: string; // Supervisor name for approval workflow
  onSelectedItemsChange?: (selectedItems: { mileage: Set<string>, receipts: Set<string>, timeTracking: Set<string> }) => void; // Callback for selected items when in supervisor mode
  onApproveReport?: () => void; // Callback for approving report in supervisor mode
  onRequestRevision?: () => void; // Callback for requesting revision in supervisor mode
}

// Mock data interfaces matching spreadsheet structure
interface EmployeeExpenseData {
  employeeId: string;
  name: string;
  preferredName?: string;
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
  
  // Receipt categories (totals)
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
  eesReceipt: number;
  
  // Other expenses (array of entries with amount and description)
  otherExpenses?: Array<{ amount: number; description: string; id?: string; costCenterIndex?: number }>;
  // Legacy support - keep 'other' for backward compatibility
  other?: number;
  
  // Cost center breakdowns for each category (optional - for per-cost-center editing)
  costCenterBreakdowns?: {
    [category: string]: number[]; // Array indexed by cost center index
  };
  
  baseAddress: string;
  baseAddress2?: string;
}

interface DailyExpenseEntry {
  day: number;
  date: string;
  description: string;
  hoursWorked: number;
  workingHours?: number;
  odometerStart: number;
  odometerEnd: number;
  milesTraveled: number;
  mileageAmount: number;
  startLocation?: string;
  startLocationName?: string;
  endLocation?: string;
  endLocationName?: string;
  costCenter?: string;
  airRailBus: number;
  vehicleRentalFuel: number;
  parkingTolls: number;
  groundTransportation: number;
  hotelsAirbnb: number;
  perDiem: number;
}

interface ReceiptData {
  id: string;
  date: string;
  amount: number;
  vendor: string;
  description: string;
  category: string;
  imageUri?: string;
  fileType?: 'image' | 'pdf'; // Type of file (image or PDF)
  costCenter?: string;
}


// TabPanel component for rendering different expense report sheets
interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`expense-tabpanel-${index}`}
      aria-labelledby={`expense-tab-${index}`}
    >
      {value === index && (
        <Box sx={{ p: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

// Main StaffPortal component
const StaffPortal: React.FC<StaffPortalProps> = ({ 
  employeeId, 
  reportMonth, 
  reportYear, 
  isAdminView = false, 
  supervisorSignature = null,
  supervisorMode = false,
  supervisorId,
  supervisorName,
  onSelectedItemsChange,
  onApproveReport,
  onRequestRevision,
}) => {
  // Debug: Log handlers when in supervisor mode
  React.useEffect(() => {
    if (supervisorMode) {
      debugLog('🔍 StaffPortal received handlers:', { 
        onApproveReport: !!onApproveReport, 
        onRequestRevision: !!onRequestRevision,
        supervisorMode 
      });
    }
  }, [supervisorMode, onApproveReport, onRequestRevision]);

  // Get effective employeeId from props or localStorage (for dependency tracking)
  // This must be declared early so it can be used in callbacks and effects
  const effectiveEmployeeId = React.useMemo(() => {
    return employeeId || localStorage.getItem('currentEmployeeId') || '';
  }, [employeeId]);

  // Use state for current month/year so users can change them
  const [currentMonth, setCurrentMonth] = useState(reportMonth);
  const [currentYear, setCurrentYear] = useState(reportYear);
  const [activeTab, setActiveTab] = useState(0);
  const [employeeData, setEmployeeData] = useState<EmployeeExpenseData | null>(null);
  const [employeeRole, setEmployeeRole] = useState<'employee' | 'supervisor' | 'admin' | 'finance' | 'contracts'>('employee');
  const [loading, setLoading] = useState(true);
  const [editingCell, setEditingCell] = useState<{row: number, field: string} | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const [receipts, setReceipts] = useState<ReceiptData[]>([]);
  const [dailyDescriptions, setDailyDescriptions] = useState<any[]>([]);
  const [dailyDescriptionOptions, setDailyDescriptionOptions] = useState<Array<{ id: string; label: string }>>([]);
  
  // Selected items for supervisor revision requests (only when supervisorMode is true)
  const [selectedMileageItems, setSelectedMileageItems] = useState<Set<string>>(new Set());
  const [selectedReceiptItems, setSelectedReceiptItems] = useState<Set<string>>(new Set());
  const [selectedTimeTrackingItems, setSelectedTimeTrackingItems] = useState<Set<string>>(new Set());
  
  // Items that need revision (highlighted in light red for staff)
  const [itemsNeedingRevision, setItemsNeedingRevision] = useState<Set<string>>(new Set());
  const [daysNeedingRevision, setDaysNeedingRevision] = useState<Set<number>>(new Set()); // Days (1-31) that need revision for time tracking
  const [currentReportId, setCurrentReportId] = useState<string | null>(null);
  
  // Notify parent component when selected items change
  // Use useRef to track previous values and only call callback when values actually change
  const prevSelectedItemsRef = React.useRef<string>('');
  
  useEffect(() => {
    if (supervisorMode && onSelectedItemsChange) {
      // Create a string representation of selected items for comparison
      const currentItemsString = JSON.stringify({
        mileage: Array.from(selectedMileageItems).sort(),
        receipts: Array.from(selectedReceiptItems).sort(),
        timeTracking: Array.from(selectedTimeTrackingItems).sort()
      });
      
      // Only call callback if values actually changed
      if (prevSelectedItemsRef.current !== currentItemsString) {
        prevSelectedItemsRef.current = currentItemsString;
        onSelectedItemsChange({
          mileage: selectedMileageItems,
          receipts: selectedReceiptItems,
          timeTracking: selectedTimeTrackingItems
        });
      }
    }
  }, [selectedMileageItems, selectedReceiptItems, selectedTimeTrackingItems, supervisorMode, onSelectedItemsChange]);

  // Load daily description options for dropdown (shared with mobile Hours & Description)
  useEffect(() => {
    fetch(`${API_BASE_URL}/api/daily-description-options`)
      .then((r) => (r.ok ? r.json() : []))
      .then((d: any) => setDailyDescriptionOptions(Array.isArray(d) ? d : []))
      .catch(() => setDailyDescriptionOptions([]));
  }, []);

  // Helper function to normalize dates to YYYY-MM-DD format
  const normalizeDate = (dateValue: any): string => {
    if (!dateValue) return '';
    
    // If already in YYYY-MM-DD format, ensure proper padding and return
    if (typeof dateValue === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
      return dateValue;
    }
    
    // Handle MM/DD/YY or MM/DD/YYYY format
    if (typeof dateValue === 'string' && /^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(dateValue)) {
      const parts = dateValue.split('/');
      const month = parseInt(parts[0], 10);
      const day = parseInt(parts[1], 10);
      let year = parseInt(parts[2], 10);
      // Convert 2-digit year to 4-digit (assuming 2000s)
      if (year < 100) {
        year += 2000;
      }
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
    
    // Handle YYYY-MM-DD format (may have inconsistent padding)
    if (typeof dateValue === 'string') {
      const dateStr = dateValue.split('T')[0]; // Remove time if present
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        const year = parts[0];
        const month = parts[1].padStart(2, '0');
        const day = parts[2].padStart(2, '0');
        return `${year}-${month}-${day}`;
      }
    }
    
    // Handle Date objects
    if (dateValue instanceof Date) {
      const year = dateValue.getFullYear();
      const month = String(dateValue.getMonth() + 1).padStart(2, '0');
      const day = String(dateValue.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
    
    // Fallback: try to parse as date string
    try {
      const date = new Date(dateValue);
      if (!isNaN(date.getTime())) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      }
    } catch (e) {
      // Ignore parsing errors
    }
    
    return String(dateValue).split('T')[0];
  };
  const [receiptDialogOpen, setReceiptDialogOpen] = useState(false);
  const [editingReceipt, setEditingReceipt] = useState<ReceiptData | null>(null);
  const [signatureImage, setSignatureImage] = useState<string | null>(null);
  const [savedSignature, setSavedSignature] = useState<string | null>(null); // Signature saved in Settings
  const [signatureDialogOpen, setSignatureDialogOpen] = useState(false);
  const [supervisorSignatureDialogOpen, setSupervisorSignatureDialogOpen] = useState(false);
  const [supervisorSignatureState, setSupervisorSignatureState] = useState<string | null>(supervisorSignature || null);
  const [employeeCertificationAcknowledged, setEmployeeCertificationAcknowledged] = useState<boolean>(false);
  const [supervisorCertificationAcknowledged, setSupervisorCertificationAcknowledged] = useState<boolean>(false);
  const [editingTimesheetCell, setEditingTimesheetCell] = useState<{costCenter: number, day: number, type: string} | null>(null);
  const [editingTimesheetValue, setEditingTimesheetValue] = useState('');
  const [editingCategoryCell, setEditingCategoryCell] = useState<{category: string, day: number} | null>(null);
  const [editingCategoryValue, setEditingCategoryValue] = useState('');
  const [reportsDialogOpen, setReportsDialogOpen] = useState(false);
  const [allReports, setAllReports] = useState<any[]>([]);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0); // Used to force data reload
  
  // Summary Sheet editing state
  const [editingSummaryItem, setEditingSummaryItem] = useState<{field: string, label: string, index?: number} | null>(null);
  const [editingSummaryValue, setEditingSummaryValue] = useState('');
  const [editingSummaryDescription, setEditingSummaryDescription] = useState('');
  const [editingCostCenterIndex, setEditingCostCenterIndex] = useState<number>(0);
  const [summaryEditDialogOpen, setSummaryEditDialogOpen] = useState(false);
  const [receiptTotalsByCategory, setReceiptTotalsByCategory] = useState<{[key: string]: number}>({});
  
  // Report completeness checker state
  const [completenessReport, setCompletenessReport] = useState<CompletenessReport | null>(null);
  const [completenessDialogOpen, setCompletenessDialogOpen] = useState(false);
  const [completenessLoading, setCompletenessLoading] = useState(false);

  // Submission type dialog state
  const [submissionTypeDialogOpen, setSubmissionTypeDialogOpen] = useState(false);

  // Report submission and approval state
  const [reportStatus, setReportStatus] = useState<
    'draft' | 'submitted' | 'approved' | 'rejected' | 'needs_revision' | 'pending_supervisor' | 'pending_finance' | 'under_review'
  >('draft');
  const [revisionItems, setRevisionItems] = useState<{mileage: number, receipts: number, time: number}>({mileage: 0, receipts: 0, time: 0});
  // Raw line item data for revision checking
  const [rawMileageEntries, setRawMileageEntries] = useState<any[]>([]);
  const [rawTimeEntries, setRawTimeEntries] = useState<any[]>([]);
  
  // Mileage entry editing state
  const [editingMileageEntry, setEditingMileageEntry] = useState<any | null>(null);
  const [mileageFormOpen, setMileageFormOpen] = useState(false);
  // Note: submissionLoading, approvalDialogOpen, approvalAction, approvalComments reserved for future approval workflow implementation

  // Approval workflow data
  const [approvalWorkflow, setApprovalWorkflow] = useState<ApprovalWorkflowStepSummary[]>([]);
  const [approvalHistory, setApprovalHistory] = useState<ApprovalHistoryEntry[]>([]);
  const [approvalHistoryLoading, setApprovalHistoryLoading] = useState(false);
  const [reportSubmittedAt, setReportSubmittedAt] = useState<string | null>(null);
  const [, setReportApprovedAt] = useState<string | null>(null);
  const [currentApprovalStage, setCurrentApprovalStage] = useState<string | null>(null);
  const [currentApproverName, setCurrentApproverName] = useState<string | null>(null);
  const [approvalCommentDialogOpen, setApprovalCommentDialogOpen] = useState(false);
  const [approvalCommentText, setApprovalCommentText] = useState('');

  // Keyboard shortcuts state
  const [shortcutsDialogOpen, setShortcutsDialogOpen] = useState(false);

  // Real-time sync
  useRealtimeStatus();
  useRealtimeSync({
    enabled: true,
    onUpdate: (update) => {
      debugVerbose('🔄 StaffPortal: Received real-time update:', update);
      // Refresh data when updates are received
      // Note: loadEmployeeData will be called via useEffect on employeeId/reportMonth/reportYear changes
    },
    onConnectionChange: (connected) => {
      debugVerbose(`🔄 StaffPortal: Real-time sync ${connected ? 'connected' : 'disconnected'}`);
    }
  });

  // UI Enhancement hooks
  const { showSuccess, showError } = useToast();
  const { isLoading: uiLoading, startLoading, stopLoading } = useLoadingState();

  // Tips system integration
  const { 
    tips, 
    showTips, 
    loadTipsForScreen, 
    dismissTip, 
    markTipAsSeen, 
    setCurrentUserId 
  } = useWebTips();

  // Calculate days in the current month
  const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();

  // State to prevent multiple simultaneous calls to refreshTimesheetData
  const [isRefreshingTimesheet, setIsRefreshingTimesheet] = useState(false);

  const fetchApprovalHistory = useCallback(
    async (reportId: string) => {
      if (!reportId) {
        return;
      }

      setApprovalHistoryLoading(true);
      try {
        const response = await fetch(`${API_BASE_URL}/api/expense-reports/${reportId}/history`);
        if (!response.ok) {
          throw new Error(`Failed to load approval history (${response.status})`);
        }

        const data = await response.json();
        if (Array.isArray(data.workflow)) {
          setApprovalWorkflow(data.workflow);
        } else {
          setApprovalWorkflow([]);
        }

        if (Array.isArray(data.history)) {
          setApprovalHistory(data.history);
        } else {
          setApprovalHistory([]);
        }

        if (data.report) {
          const statusValue = (data.report.status || 'draft') as
            | 'draft'
            | 'submitted'
            | 'approved'
            | 'rejected'
            | 'needs_revision'
            | 'pending_supervisor'
            | 'pending_finance'
            | 'under_review';

          setReportStatus(statusValue);
          setCurrentApprovalStage(data.report.currentApprovalStage || null);
          setCurrentApproverName(data.report.currentApproverName || null);
          setReportSubmittedAt(data.report.submittedAt || null);
          setReportApprovedAt(data.report.approvedAt || null);
        }
      } catch (error) {
        debugError('Error fetching approval history:', error);
        setApprovalWorkflow([]);
        setApprovalHistory([]);
        if (typeof showError === 'function') {
          showError('Failed to load approval progress. Please try again.');
        }
      } finally {
        setApprovalHistoryLoading(false);
      }
    },
    [showError]
  );

  // Function to refresh timesheet data after saving - NEW APPROACH: Daily Hours Distribution
  const refreshTimesheetData = useCallback(async (dataToUse?: any) => {
    // Reduced logging for performance - only log errors
    // Prefer current employeeData from state, but use dataToUse if state is not available
    // This is needed during initial load when state hasn't been set yet
    const data = employeeData || dataToUse;
    if (!data) {
      // Silently skip if no data available (will retry when data is loaded)
      return;
    }
    
    // Prevent multiple simultaneous calls
    if (isRefreshingTimesheet) {
      return; // Silently skip if already refreshing
    }
    setIsRefreshingTimesheet(true);
    
    try {
      // Fetch updated time tracking data - no delay needed
      const timeTrackingResponse = await fetch(`${API_BASE_URL}/api/time-tracking?employeeId=${effectiveEmployeeId}&month=${currentMonth}&year=${currentYear}`);
      const timeTracking = timeTrackingResponse.ok ? await timeTrackingResponse.json() : [];
      
      // Reduced logging for performance
      
      // Filter for current month - optimized to avoid creating Date objects multiple times
      const monthStr = currentMonth.toString().padStart(2, '0');
      const yearStr = currentYear.toString();
      const currentMonthTimeTracking = timeTracking.filter((tracking: any) => {
        // Fast string-based filtering for YYYY-MM-DD format
        const dateStr = typeof tracking.date === 'string' ? tracking.date.split('T')[0] : tracking.date;
        if (dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
          const [year, month] = dateStr.split('-');
          return month === monthStr && year === yearStr;
        }
        // Fallback to Date parsing only if needed
        const trackingDate = new Date(tracking.date);
        const trackingMonth = trackingDate.getUTCMonth() + 1;
        const trackingYear = trackingDate.getUTCFullYear();
        return trackingMonth === currentMonth && trackingYear === currentYear;
      });
      
      // Reduced logging for performance
      // debugLog(`🔍 Filtered to ${currentMonthTimeTracking.length} entries for month ${currentMonth}/${currentYear}`);
      
      // NEW APPROACH: Group by day and create daily hour distributions
      const dailyHourDistributions: { [day: number]: any } = {};
      
      // Initialize all days with empty distributions
      for (let day = 1; day <= daysInMonth; day++) {
        dailyHourDistributions[day] = {
          costCenterHours: {},
          categoryHours: {},
          totalHours: 0,
          workingHours: 0
        };
      }
      
      // Helper function to extract day from date string (treat YYYY-MM-DD as local)
      const getDayFromDate = (dateValue: any): number => {
        const dateStr = typeof dateValue === 'string' ? dateValue.split('T')[0] : dateValue;
        if (dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
          // Parse YYYY-MM-DD as local date to avoid timezone shifts
          const [, , day] = dateStr.split('-').map(Number);
          return day;
        }
        // Fallback to Date parsing for other formats
        return new Date(dateValue).getDate();
      };
      
      // DEDUPLICATION: Group entries by day/costCenter/category and keep only the most recent
      // This prevents duplicate entries from causing hours to reappear after deletion
      const entryMap = new Map<string, any>();
      
      currentMonthTimeTracking.forEach((tracking: any) => {
        const day = getDayFromDate(tracking.date);
        if (day < 1 || day > daysInMonth) return;
        
        // Create a unique key for this entry: day-costCenter-category
        let key: string;
        if (tracking.costCenter && tracking.costCenter !== '') {
          key = `${day}-${tracking.costCenter}-Working Hours`;
        } else if (tracking.category) {
          key = `${day}--${tracking.category}`;
        } else {
          key = `${day}--Working Hours`;
        }
        
        // Keep only the most recent entry for this key (by updatedAt timestamp)
        const existing = entryMap.get(key);
        if (!existing) {
          entryMap.set(key, tracking);
        } else {
          const existingTime = existing.updatedAt ? new Date(existing.updatedAt).getTime() : 0;
          const trackingTime = tracking.updatedAt ? new Date(tracking.updatedAt).getTime() : 0;
          // If tracking is more recent, or if existing has no timestamp, use tracking
          if (trackingTime > existingTime || existingTime === 0) {
            entryMap.set(key, tracking);
          }
        }
      });
      
      // Process deduplicated entries and group by day
      const deduplicatedEntries = Array.from(entryMap.values());
      debugLog(`🔍 Deduplicated ${currentMonthTimeTracking.length} entries to ${deduplicatedEntries.length} unique entries`);
      
      deduplicatedEntries.forEach((tracking: any) => {
        // Use helper function to extract day from date (treat YYYY-MM-DD as local)
        const day = getDayFromDate(tracking.date);
        
        if (day >= 1 && day <= daysInMonth) {
          const dayData = dailyHourDistributions[day];
          const categoryTypes = ['G&A', 'Holiday', 'PTO', 'STD/LTD', 'PFL/PFML'];
          
          if (tracking.costCenter && tracking.costCenter !== '') {
            // Cost center entry - use assignment (deduplication already handled)
            const costCenterIndex = data.costCenters.findIndex((cc: string) => cc === tracking.costCenter);
            if (costCenterIndex >= 0) {
              dayData.costCenterHours[costCenterIndex] = (tracking.hours || 0);
            }
          } else if (categoryTypes.includes(tracking.category)) {
            // Category entry - use assignment (deduplication already handled)
            dayData.categoryHours[tracking.category] = (tracking.hours || 0);
            // Reduced logging for performance
            // debugLog(`✅ Processed ${tracking.category} for day ${day}: ${tracking.hours} hours (ID: ${tracking.id})`);
          } else if (tracking.category === 'Working Hours' || tracking.category === 'Regular Hours') {
            // Working hours entry - treat as cost center 0, use assignment (deduplication already handled)
            dayData.costCenterHours[0] = (tracking.hours || 0);
          }
        } else {
          debugWarn(`⚠️ Entry with day ${day} is outside valid range (1-${daysInMonth})`);
        }
      });
      
      // Reduced logging for performance - removed expensive debug operations
      
      // Calculate totals AFTER processing all entries to avoid accumulation
      for (let day = 1; day <= daysInMonth; day++) {
        const dayData = dailyHourDistributions[day];
        dayData.totalHours = 0;
        dayData.workingHours = 0;
        
        // Sum up all cost center hours
        Object.values(dayData.costCenterHours).forEach((hours) => {
          dayData.totalHours += hours as number;
          dayData.workingHours += hours as number; // All cost center hours count as working hours
        });
        
        // Sum up all category hours
        Object.values(dayData.categoryHours).forEach((hours) => {
          dayData.totalHours += hours as number;
          // Category hours don't count as working hours
        });
      }
      
      // Ensure we have entries for all days - create missing ones if needed
      const allDays = Array.from({ length: daysInMonth }, (_, i) => i + 1);
      const existingDays = new Set(data.dailyEntries.map((e: any) => e.day));
      const missingDays = allDays.filter(day => !existingDays.has(day));
      
      if (missingDays.length > 0) {
        debugLog(`🔍 Creating entries for missing days: ${missingDays.join(', ')}`);
      }
      
      // Create entries for missing days
      const entriesForMissingDays = missingDays.map((day: number) => {
        const date = new Date(currentYear, currentMonth - 1, day);
        const dateStr = date.toISOString().split('T')[0];
        return {
          day,
          date: dateStr,
          hoursWorked: 0,
          workingHours: 0,
          description: '',
          costCenter0Hours: 0,
          costCenter1Hours: 0,
          costCenter2Hours: 0,
          costCenter3Hours: 0,
          categoryHours: {}
        };
      });
      
      // Combine existing entries with missing day entries
      const allDailyEntries = [...data.dailyEntries, ...entriesForMissingDays].sort((a: any, b: any) => a.day - b.day);
      
      // Reduced logging for performance
      // debugLog(`🔍 Total daily entries to process: ${allDailyEntries.length} (${data.dailyEntries.length} existing + ${entriesForMissingDays.length} new)`);
      
      // Update daily entries with the new distribution approach
      const updatedDailyEntries = allDailyEntries.map((entry: any) => {
        const dayData = dailyHourDistributions[entry.day] || {
          costCenterHours: {},
          categoryHours: {},
          totalHours: 0,
          workingHours: 0
        };
        
        // Check if this day is marked as day off and sync description
        const entryDateStr = normalizeDate(entry.date);
        const dayDescription = dailyDescriptions.find((desc: any) => {
          const descDateStr = normalizeDate(desc.date);
          return entryDateStr === descDateStr;
        });
        
        // Build updated entry with distributed hours
        const updatedEntry = {
          ...entry,
          hoursWorked: dayData.totalHours,
          workingHours: dayData.workingHours
        };
        
        // If it's a day off, populate description with day off type
        if (dayDescription?.dayOff && dayDescription?.dayOffType) {
          updatedEntry.description = dayDescription.dayOffType;
        }
        
        // Add cost center specific hours
        data.costCenters.forEach((costCenter: string, index: number) => {
          const propertyName = `costCenter${index}Hours`;
          (updatedEntry as any)[propertyName] = dayData.costCenterHours[index] || 0;
        });
        
        // Add category hours
        (updatedEntry as any).categoryHours = dayData.categoryHours;
        
        // Removed verbose logging for performance
        
        return updatedEntry;
      });
      
      // Calculate total hours for the month
      const totalHours = Object.values(dailyHourDistributions).reduce((sum: number, dayData: any) => sum + dayData.totalHours, 0);
      
      // Removed expensive verification operations for performance
      // These were only used for debugging and caused significant lag
      
      // Update employee data - use functional update to ensure we're working with latest state
      // If employeeData is null, we need to merge with the data we used for processing
      setEmployeeData(prev => {
        // If prev is null, use the data parameter we processed with
        const baseData = prev || data;
        if (!baseData) {
          debugWarn('⚠️ No base data available for state update');
          return null;
        }
        
        // Reduced logging for performance
        // debugLog(`🔄 Updating state with ${updatedDailyEntries.length} daily entries`);
        
        // Merge category hours from previous state to preserve any that might not be in database yet
        // This is a safety measure in case of race conditions
        const mergedDailyEntries = updatedDailyEntries.map((updatedEntry: any) => {
          if (prev && prev.dailyEntries) {
            const prevEntry = prev.dailyEntries.find((e: any) => e.day === updatedEntry.day);
            if (prevEntry && (prevEntry as any).categoryHours) {
              // Merge previous category hours with updated ones (updated takes precedence)
              const mergedCategoryHours = {
                ...(prevEntry as any).categoryHours,
                ...(updatedEntry as any).categoryHours
              };
              // Only keep merged if updated has actual hours (not just empty object)
              if (Object.keys((updatedEntry as any).categoryHours || {}).length > 0) {
                (updatedEntry as any).categoryHours = mergedCategoryHours;
              }
            }
          }
          return updatedEntry;
        });
        
        const newData = {
          ...baseData,
          dailyEntries: mergedDailyEntries,
          totalHours: totalHours
        };
        
        // Verify the update
        // Removed expensive debug operations for performance
        
        return newData;
      });
      
      // Reduced logging for performance
      // debugLog('✅ Timesheet data refreshed with new distribution approach');
    } catch (error) {
      debugError('❌ Error refreshing timesheet data:', error);
    } finally {
      setIsRefreshingTimesheet(false);
    }
    // Reduced logging for performance
    // debugLog('🔄 refreshTimesheetData completed');
  }, [effectiveEmployeeId, currentMonth, currentYear, daysInMonth]); // eslint-disable-line react-hooks/exhaustive-deps

  // Function to sync daily description changes to the cost center screen
  /**
   * Extracts user-entered description by removing any existing driving summary
   * Driving summary patterns: "to [Location]" sequences, odometer readings, etc.
   * This prevents duplication when descriptions are saved and then rebuilt from mileage entries.
   */
  const extractUserDescription = useCallback((fullDescription: string): string => {
    if (!fullDescription) return '';
    
    // Remove odometer readings first
    let cleaned = fullDescription
      .replace(/Odometer:\s*\d+/gi, '')
      .replace(/\s+to\s+Odometer:\s*\d+/gi, '')
      .trim();
    
    // Split by double newlines (driving summary is typically separated by \n\n)
    const parts = cleaned.split(/\n\n+/);
    
    // The driving summary typically contains patterns like:
    // - "to [Location]" sequences (especially multiple "to" patterns)
    // - Location names with addresses in parentheses: "OH Location (address)"
    // - Patterns like "BA to OH Location (address) to OH Location2 (address)"
    // - Repeated "for [purpose]" patterns
    
    // Filter out parts that look like driving summaries
    const userParts = parts.filter(part => {
      const trimmedPart = part.trim();
      if (!trimmedPart) return false;
      
      // Count "to" patterns - driving summaries typically have multiple "to [Location]" patterns
      const toMatches = trimmedPart.match(/\bto\s+/gi);
      const toCount = toMatches ? toMatches.length : 0;
      
      // If there are 2+ "to" patterns, it's almost certainly a driving summary
      // Also check for patterns like "to OH Location (address) for purpose to OH Location2"
      if (toCount >= 2) {
        return false;
      }
      
      // Check for very long descriptions with multiple location patterns (likely duplicated driving summary)
      // Pattern: "to [Location] for [purpose] to [Location2] for [purpose]" repeated
      const repeatedTripPattern = /to\s+[^to]+for\s+[^to]+to\s+[^to]+for\s+[^to]+/i;
      if (repeatedTripPattern.test(trimmedPart) && trimmedPart.length > 200) {
        return false; // Very long with repeated trip patterns = duplicated
      }
      
      // Check for location patterns with addresses in parentheses
      // Pattern: "to OH LocationName (address)" or "to LocationName (address)"
      const locationPattern = /\bto\s+(?:OH\s+)?[^(]+\([^)]+\)/gi;
      const locationMatches = trimmedPart.match(locationPattern);
      
      // If there are location patterns with addresses, it's likely a driving summary
      if (locationMatches && locationMatches.length >= 1 && toCount >= 1) {
        return false;
      }
      
      // Check for repeated patterns (like "for House stabilization" appearing multiple times)
      // This indicates a duplicated driving summary
      const purposePattern = /\bfor\s+[^to\s]+/gi;
      const purposeMatches = trimmedPart.match(purposePattern);
      if (purposeMatches && purposeMatches.length >= 2) {
        // Multiple "for [purpose]" patterns = likely duplicated driving summary
        return false;
      }
      
      // If it contains "to BA" or "to BA1" or "to BA2" and has other location patterns, it's a driving summary
      if (/\bto\s+(?:BA|BA1|BA2)\b/i.test(trimmedPart) && toCount >= 1) {
        return false;
      }
      
      // Otherwise, it's likely user-entered text
      return true;
    });
    
    // Join remaining parts (user description) and clean up extra whitespace
    const result = userParts.join('\n\n').trim();
    
    // Remove any remaining odometer patterns that might have slipped through
    return result
      .replace(/Odometer:\s*\d+/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
  }, []);

  /**
   * Syncs daily description to the cost center screen
   * Extracts user-entered description (removing any existing driving summary) and recalculates driving summary
   * to prevent duplication when saving multiple times
   */
  const syncDescriptionToCostCenter = useCallback(async (descToSave: any, entryDate: Date) => {
    if (!employeeData) return;

    const dateStr = normalizeDate(entryDate);
    const description = descToSave.description || '';
    const dayOff = descToSave.dayOff || false;
    const dayOffType = descToSave.dayOffType || null;

    const updatedEntries = [...employeeData.dailyEntries];
    const entryIndex = updatedEntries.findIndex((e: any) => normalizeDate(e.date) === dateStr);

    if (entryIndex >= 0) {
      // Use the description exactly as saved - don't re-generate or add driving summary
      // This prevents deleted content from coming back
      let fullDescription = '';
      
      if (dayOff && dayOffType) {
        fullDescription = dayOffType;
      } else {
        // Use the description as-is (user may have deleted content intentionally)
        fullDescription = description;
      }

      updatedEntries[entryIndex].description = fullDescription;

      setEmployeeData({
        ...employeeData,
        dailyEntries: updatedEntries
      });
    }
  }, [employeeData]);

  // Debug logging for delete button visibility - DISABLED to prevent infinite loop
  // debugLog('🔍 StaffPortal Debug:', {
  //   reportStatus,
  //   isAdminView,
  //   showDeleteButton: (reportStatus === 'draft' || reportStatus === 'submitted') && !isAdminView
  // });
  
  // Format month name (use currentMonth for display)
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                    'July', 'August', 'September', 'October', 'November', 'December'];
  const monthName = monthNames[currentMonth - 1];

  // Load employee data based on props
  useEffect(() => {
    const loadEmployeeData = async () => {
      if (!effectiveEmployeeId) {
        debugWarn('⚠️ StaffPortal: No employeeId provided and none found in localStorage');
        setLoading(false);
        return;
      }
      
      setLoading(true);
      let employee: any = null;
      let costCenters: string[] = ['NC.F-SAPTBG']; // Default fallback
      
      // Map common employee IDs to backend IDs
      const employeeIdMap: { [key: string]: string } = {
        'emp001': 'emp2', // Map emp001 to Sarah Johnson
        'emp002': 'emp3', // Map emp002 to Mike Rodriguez
        'emp003': 'emp4', // Map emp003 to Lisa Chen
      };
      
      // Use mapped ID or original ID
      const backendEmployeeId = employeeIdMap[effectiveEmployeeId] || effectiveEmployeeId;
      
      try {
        // Fetch employee details from backend
        const employeeResponse = await fetch(`${API_BASE_URL}/api/employees/${backendEmployeeId}`);
        if (!employeeResponse.ok) {
          // If employee not found, silently try with fallback ID
          debugLog(`Employee ${backendEmployeeId} not found in backend, using fallback employee data...`);
          const fallbackResponse = await fetch(`${API_BASE_URL}/api/employees/mggwglbfk9dij3oze8l`);
          if (fallbackResponse.ok) {
            employee = await fallbackResponse.json();
            debugLog('✅ Successfully loaded fallback employee data for:', employee.name);
          } else {
            throw new Error('Failed to fetch employee data');
          }
        } else {
          employee = await employeeResponse.json();
          debugVerbose('✅ Successfully loaded employee data for:', employee.name);
        }
        
        // Set employee role for notifications
        if (employee && employee.role) {
          setEmployeeRole(employee.role as 'employee' | 'supervisor' | 'admin' | 'finance' | 'contracts');
        } else {
          setEmployeeRole('employee'); // Default to employee
        }
        
        // Parse costCenters if it's a JSON string
        if (employee.costCenters) {
          debugVerbose('🔍 StaffPortal: costCenters type:', typeof employee.costCenters, 'value:', employee.costCenters);
          try {
            if (typeof employee.costCenters === 'string') {
              // Check if it's the string "[object Object]" which means it's not valid JSON
              if (employee.costCenters === '[object Object]') {
                debugWarn('costCenters is "[object Object]" string, using default');
                costCenters = ['NC.F-SAPTBG'];
              } else {
                costCenters = JSON.parse(employee.costCenters);
              }
            } else if (Array.isArray(employee.costCenters)) {
              costCenters = employee.costCenters;
            } else if (typeof employee.costCenters === 'object') {
              // If it's an object but not an array, try to convert it
              costCenters = Object.values(employee.costCenters);
            }
          } catch (error) {
            debugWarn('Failed to parse costCenters:', error);
            costCenters = ['NC.F-SAPTBG']; // Use default
          }
        }
        
        // Load real data from mobile app database for current month
        // Loading real data for employee
          
          const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                            'July', 'August', 'September', 'October', 'November', 'December'];
          const monthName = monthNames[currentMonth - 1];
          const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();
          
          // Fetch real data from backend APIs using rate-limited API
          const { apiFetch } = await import('./services/rateLimitedApi');
          const [mileageResponse, receiptsResponse, timeTrackingResponse, dailyDescriptionsResponse, reportResponse, expenseReportResponse] = await Promise.all([
            apiFetch(`/api/mileage-entries?employeeId=${effectiveEmployeeId}&month=${currentMonth}&year=${currentYear}`),
            apiFetch(`/api/receipts?employeeId=${effectiveEmployeeId}&month=${currentMonth}&year=${currentYear}`),
            apiFetch(`/api/time-tracking?employeeId=${effectiveEmployeeId}&month=${currentMonth}&year=${currentYear}`),
            apiFetch(`/api/daily-descriptions?employeeId=${effectiveEmployeeId}&month=${currentMonth}&year=${currentYear}`),
            apiFetch(`/api/monthly-reports?employeeId=${effectiveEmployeeId}&month=${currentMonth}&year=${currentYear}`),
            apiFetch(`/api/expense-reports/${effectiveEmployeeId}/${currentMonth}/${currentYear}`).catch(() => ({ ok: false } as Response)) // Load expense report if it exists
          ]);
          
          const mileageEntries = mileageResponse.ok ? await mileageResponse.json() : [];
          const receipts = receiptsResponse.ok ? await receiptsResponse.json() : [];
          const timeTracking = timeTrackingResponse.ok ? await timeTrackingResponse.json() : [];
          const dailyDescriptionsRaw = dailyDescriptionsResponse.ok ? await dailyDescriptionsResponse.json() : [];
          
          // Set raw mileage entries for the mileage entries tab
          setRawMileageEntries(mileageEntries);
          setRawTimeEntries(timeTracking);
          // Normalize all dates in dailyDescriptions to ensure consistent format
          const dailyDescriptions = dailyDescriptionsRaw.map((desc: any) => ({
            ...desc,
            date: normalizeDate(desc.date) // Normalize date to YYYY-MM-DD format
          }));
          
          // Parse monthly report status
          let currentReport: any = null;
          if (reportResponse.ok) {
            const reports = await reportResponse.json();
            currentReport = Array.isArray(reports) && reports.length > 0 
              ? reports.filter((r: any) => r.month === currentMonth && r.year === currentYear)[0]
              : null;
            if (currentReport) {
              if (currentReport.status) {
                setReportStatus(currentReport.status);
              }
              if (currentReport.id) {
                setCurrentReportId(currentReport.id);
              }
            }
          }

          // Load expense report data (including checkbox states) if it exists
          let savedExpenseReport: any = null;
          if (expenseReportResponse && expenseReportResponse.ok) {
            try {
              savedExpenseReport = await expenseReportResponse.json();
              if (savedExpenseReport && savedExpenseReport.reportData) {
                // Restore checkbox states from saved report
                const { employeeCertificationAcknowledged: savedEmployeeCert, supervisorCertificationAcknowledged: savedSupervisorCert } = savedExpenseReport.reportData;
                setEmployeeCertificationAcknowledged(savedEmployeeCert || false);
                setSupervisorCertificationAcknowledged(savedSupervisorCert || false);
                
                // Also restore signature images if they exist
                if (savedExpenseReport.reportData.signatureImage) {
                  setSignatureImage(savedExpenseReport.reportData.signatureImage);
                }
                if (savedExpenseReport.reportData.supervisorSignature) {
                  setSupervisorSignatureState(savedExpenseReport.reportData.supervisorSignature);
                }
                
                // Restore report status and ID
                if (savedExpenseReport.status) {
                  setReportStatus(savedExpenseReport.status);
                }
                if (savedExpenseReport.id) {
                  setCurrentReportId(savedExpenseReport.id);
                }
                if (savedExpenseReport.submittedAt) {
                  setReportSubmittedAt(savedExpenseReport.submittedAt);
                }
                if (savedExpenseReport.approvedAt) {
                  setReportApprovedAt(savedExpenseReport.approvedAt);
                }
                if (savedExpenseReport.currentApprovalStage) {
                  setCurrentApprovalStage(savedExpenseReport.currentApprovalStage);
                }
                if (savedExpenseReport.currentApproverName) {
                  setCurrentApproverName(savedExpenseReport.currentApproverName);
                }
              }
            } catch (error) {
              debugWarn('Could not parse expense report data:', error);
            }
          } else {
            // No expense report exists for this month - clear checkbox states for new month
            setEmployeeCertificationAcknowledged(false);
            setSupervisorCertificationAcknowledged(false);
            setSignatureImage(null);
            setSupervisorSignatureState(null);
            setCurrentReportId(null);
            setReportStatus('draft');
            setReportSubmittedAt(null);
            setReportApprovedAt(null);
            setCurrentApprovalStage(null);
            setCurrentApproverName(null);
          }
          
          const currentMonthMileage = mileageEntries.filter((entry: any) => {
            const entryDate = new Date(entry.date);
            const entryMonth = entryDate.getUTCMonth() + 1; // Use UTC to avoid timezone issues
            const entryYear = entryDate.getUTCFullYear();
            return entryMonth === currentMonth && entryYear === currentYear;
          });
          
          const currentMonthReceipts = receipts.filter((receipt: any) => {
            const receiptDate = new Date(receipt.date);
            const receiptMonth = receiptDate.getUTCMonth() + 1;
            const receiptYear = receiptDate.getUTCFullYear();
            return receiptMonth === currentMonth && receiptYear === currentYear;
          });
          
          const currentMonthTimeTracking = timeTracking.filter((tracking: any) => {
            const trackingDate = new Date(tracking.date);
            const trackingMonth = trackingDate.getUTCMonth() + 1;
            const trackingYear = trackingDate.getUTCFullYear();
            return trackingMonth === currentMonth && trackingYear === currentYear;
          });
          
          // Data filtered for current month
          
          // Generate daily entries based on real data
          const dailyEntries = await Promise.all(Array.from({ length: daysInMonth }, async (_, i) => {
            const day = i + 1;
            const date = new Date(currentYear, currentMonth - 1, day);
            const dateStr = date.toLocaleDateString('en-US', { 
              month: '2-digit', 
              day: '2-digit', 
              year: '2-digit' 
            });
            
            // Find ALL mileage entries for this day (use UTC to avoid timezone issues)
            const dayMileageEntries = currentMonthMileage.filter((entry: any) => {
              const entryDate = new Date(entry.date);
              return entryDate.getUTCDate() === day;
            });
            
            // Sort entries by time (chronological order)
            dayMileageEntries.sort((a: any, b: any) => {
              return new Date(a.date).getTime() - new Date(b.date).getTime();
            });
            
            // Find daily description for this day
            const dayDescription = dailyDescriptions.find((desc: any) => {
              const descDate = new Date(desc.date);
              return descDate.getUTCDate() === day;
            });
            
            // Build driving summary from mileage entries
            let drivingSummary = '';
            if (dayMileageEntries.length > 0) {
              const tripSegments: string[] = [];
              const baseAddress = employee?.baseAddress;
              const baseAddress2 = employee?.baseAddress2;
              
              dayMileageEntries.forEach((entry: any, index: number) => {
                // For the first trip, include the starting location
                if (index === 0) {
                  const startLocation = entry.startLocation || '';
                  const formattedStart = formatLocationForDescription(startLocation, baseAddress, baseAddress2);
                  if (formattedStart) {
                    tripSegments.push(formattedStart);
                  }
                }
                
                // Add the trip segment: "to [EndLocation]" or "to BA"
                const endLocation = entry.endLocation || '';
                const purpose = entry.purpose || 'Travel';
                const formattedEnd = formatLocationForDescription(endLocation, baseAddress, baseAddress2);
                
                // Check if endLocation is BA - don't add purpose for base address returns
                const isBaseAddress = formattedEnd === 'BA' || formattedEnd === 'BA1' || formattedEnd === 'BA2';
                
                if (formattedEnd) {
                  if (isBaseAddress) {
                    tripSegments.push(`to ${formattedEnd}`);
                  } else {
                    // Only add purpose if it's not a generic "Travel"
                    if (purpose && purpose.toLowerCase() !== 'travel' && purpose.trim() !== '') {
                      tripSegments.push(`to ${formattedEnd} for ${purpose}`);
                    } else {
                      tripSegments.push(`to ${formattedEnd}`);
                    }
                  }
                }
              });
              
              // Format: "LocationName (Address) to BA" or "LocationName (Address) to LocationName (Address)"
              drivingSummary = tripSegments.join(' ');
            }
            
            // Extract user-entered description (removing any existing driving summary)
            // This prevents duplication when rebuilding the description
            const userDescription = dayDescription && dayDescription.description 
              ? extractUserDescription(dayDescription.description)
              : '';
            
            // Concatenate user description + driving summary (NO odometer readings)
            // Only append driving summary if it's not already in the user description
            let fullDescription = '';
            if (userDescription) {
              fullDescription = userDescription;
              // Only add driving summary if it's not already present
              if (drivingSummary && !userDescription.includes(drivingSummary)) {
                fullDescription += '\n\n' + drivingSummary;
              }
            } else if (drivingSummary) {
              fullDescription = drivingSummary;
            } else {
              fullDescription = ''; // Empty description for blank days
            }
            
            // Calculate total miles for the day
            const totalDayMiles = dayMileageEntries.reduce((sum: number, entry: any) => sum + (entry.miles || 0), 0);
            
            // Get odometer start from first entry's odometerReading (this is the starting odometer for the day)
            const firstEntry = dayMileageEntries.length > 0 ? dayMileageEntries[0] : null;
            const lastEntry = dayMileageEntries.length > 0 ? dayMileageEntries[dayMileageEntries.length - 1] : null;
            const odometerStart = firstEntry?.odometerReading || 0;
            
            // Calculate odometer end = start + total miles for the day
            const odometerEnd = odometerStart + totalDayMiles;
            
            // Extract location information from first and last entries
            // Prioritize startLocationName over startLocation, and skip startLocation if it contains "Odometer:"
            const startLocationRaw = firstEntry?.startLocation || '';
            const startLocationNameRaw = firstEntry?.startLocationName || '';
            // Use startLocationName if available, otherwise use startLocation only if it doesn't contain "Odometer:"
            const startLocationName = startLocationNameRaw || 
              (startLocationRaw && !startLocationRaw.toLowerCase().includes('odometer:') ? startLocationRaw : '');
            const startLocation = (startLocationRaw && !startLocationRaw.toLowerCase().includes('odometer:')) ? startLocationRaw : '';
            
            const endLocationRaw = lastEntry?.endLocation || '';
            const endLocationNameRaw = lastEntry?.endLocationName || '';
            // Use endLocationName if available, otherwise use endLocation only if it doesn't contain "Odometer:"
            const endLocationName = endLocationNameRaw || 
              (endLocationRaw && !endLocationRaw.toLowerCase().includes('odometer:') ? endLocationRaw : '');
            const endLocation = (endLocationRaw && !endLocationRaw.toLowerCase().includes('odometer:')) ? endLocationRaw : '';
            
            // Get cost center from entries (prefer first entry's cost center, or use default)
            const costCenter = firstEntry?.costCenter || dayMileageEntries.find((e: any) => e.costCenter)?.costCenter || employee.defaultCostCenter || employee.costCenters?.[0] || '';
            
            // Find ALL time tracking entries for this day (use UTC to avoid timezone issues)
            const dayTimeTrackingEntries = currentMonthTimeTracking.filter((tracking: any) => {
              const trackingDate = new Date(tracking.date);
              return trackingDate.getUTCDate() === day;
            });
            
            // Build hours breakdown from time tracking entries
            const costCenterHours: { [key: number]: number } = {};
            const categoryHours: { [key: string]: number } = {};
            
            dayTimeTrackingEntries.forEach((tracking: any) => {
              if (tracking.costCenter && tracking.costCenter !== '') {
                // Cost center entry
                const costCenterIndex = costCenters.findIndex((cc: string) => cc === tracking.costCenter);
                if (costCenterIndex >= 0) {
                  costCenterHours[costCenterIndex] = (tracking.hours || 0);
                }
              } else if (tracking.category && tracking.category !== '') {
                // Category entry (PTO, Holiday, etc.)
                categoryHours[tracking.category] = (tracking.hours || 0);
              } else {
                // Default to cost center 0 for working hours
                costCenterHours[0] = (tracking.hours || 0);
              }
            });
            
            // Get single time tracking entry for backward compatibility
            const dayTimeTracking = dayTimeTrackingEntries[0];
            
            // Find Per Diem receipts for this day (use UTC to avoid timezone issues)
            const dayPerDiemReceipts = currentMonthReceipts.filter((receipt: any) => {
              const receiptDate = new Date(receipt.date);
              return receiptDate.getUTCDate() === day && receipt.category === 'Per Diem';
            });
            
            // Calculate Per Diem amount from receipts
            const perDiemFromReceipts = dayPerDiemReceipts.reduce((sum: number, receipt: any) => sum + (receipt.amount || 0), 0);
            
            // Check if stayed overnight for this day
            const stayedOvernight = dayDescription?.stayedOvernight || false;
            
            // Calculate Per Diem based on rules if no receipts exist
            // New requirement: Per Diem qualifies if stayedOvernight is checked AND 50+ miles from base address
            let calculatedPerDiem = perDiemFromReceipts;
            if (perDiemFromReceipts === 0) {
              // Get employee's cost center
              const costCenterForPerDiem = employee.defaultCostCenter || employee.costCenters?.[0] || 'Program Services';
              
              // Calculate distance from base address (simplified: use total miles as proxy if no geocoding available)
              // For now, if stayedOvernight is checked and there are mileage entries, assume they qualify
              // In a full implementation, this would use geocoding to calculate actual distance
              let distanceFromBase = 0;
              if (stayedOvernight && totalDayMiles > 0) {
                // If stayed overnight and has mileage, estimate they're at least 50 miles away
                // This is a simplified check - in production, use actual geocoding
                distanceFromBase = Math.max(totalDayMiles, 50); // Use miles traveled as proxy, minimum 50
              }
              
              // Calculate Per Diem using rules
              // Requirement: stayedOvernight must be true AND distanceFromBase >= 50
              try {
                const perDiemResult = await PerDiemRulesService.calculatePerDiem(
                  costCenterForPerDiem,
                  dayTimeTracking?.hours || 0,
                  totalDayMiles,
                  distanceFromBase,
                  perDiemFromReceipts
                );
                
                // Additional check: must have stayed overnight AND be 50+ miles from base
                const qualifiesForPerDiem = stayedOvernight && distanceFromBase >= 50 && perDiemResult.meetsRequirements;
                
                if (qualifiesForPerDiem) {
                  calculatedPerDiem = perDiemResult.amount;
                  debugVerbose(`💰 StaffPortal: Calculated Per Diem for ${employee.name} on ${dateStr}:`, {
                    costCenter: costCenterForPerDiem,
                    hours: dayTimeTracking?.hours || 0,
                    miles: totalDayMiles,
                    stayedOvernight,
                    distanceFromBase,
                    amount: calculatedPerDiem,
                    rule: perDiemResult.rule
                  });
                } else {
                  debugVerbose(`💰 StaffPortal: Per Diem not qualified for ${employee.name} on ${dateStr}:`, {
                    stayedOvernight,
                    distanceFromBase,
                    meetsRequirements: perDiemResult.meetsRequirements
                  });
                }
              } catch (error) {
                debugError('❌ StaffPortal: Error calculating Per Diem:', error);
              }
            }
            
            // Include costCenter*Hours and categoryHours so sync-to-source persists time_tracking (doesn't wipe)
            const costCenterHoursPayload: { [key: string]: number } = {};
            costCenters.forEach((_, i) => {
              costCenterHoursPayload[`costCenter${i}Hours`] = costCenterHours[i] || 0;
            });
            return {
              day,
              date: dateStr,
              description: fullDescription,
              hoursWorked: dayTimeTracking?.hours || 0,
              workingHours: dayTimeTracking?.hours || 0,
              ...costCenterHoursPayload,
              categoryHours,
              odometerStart: Math.round(odometerStart),
              odometerEnd: Math.round(odometerEnd),
              milesTraveled: Math.round(totalDayMiles),
              mileageAmount: totalDayMiles * 0.445,
              startLocation: startLocation,
              startLocationName: startLocationName,
              endLocation: endLocation,
              endLocationName: endLocationName,
              costCenter: costCenter,
              airRailBus: 0,
              vehicleRentalFuel: 0,
              parkingTolls: 0,
              groundTransportation: 0,
              hotelsAirbnb: 0,
              perDiem: calculatedPerDiem
            };
          }));
          
          // Merge portal-edited values from saved expense report so Cost Ctr page edits persist.
          // Only overlay odometer/miles when the API-built entry has mileage for that day (milesTraveled > 0).
          // Otherwise we keep 0 so we don't restore bad values (e.g. 182702) after user cleared or deleted mileage.
          if (savedExpenseReport?.reportData?.dailyEntries && Array.isArray(savedExpenseReport.reportData.dailyEntries)) {
            const savedByDate = new Map<string, any>();
            for (const se of savedExpenseReport.reportData.dailyEntries) {
              const key = normalizeDate(se.date);
              if (key) savedByDate.set(key, se);
            }
            for (const entry of dailyEntries) {
              const key = normalizeDate(entry.date);
              const saved = key ? savedByDate.get(key) : null;
              if (saved) {
                if (typeof saved.perDiem === 'number') entry.perDiem = saved.perDiem;
                // Only overlay odometer/miles when API says this day has mileage (don't restore 182702 after clear/delete)
                const builtMiles = (entry.milesTraveled ?? 0);
                if (builtMiles > 0) {
                  if (typeof saved.odometerStart === 'number') entry.odometerStart = saved.odometerStart;
                  if (typeof saved.odometerEnd === 'number') entry.odometerEnd = saved.odometerEnd;
                  if (typeof saved.milesTraveled === 'number') entry.milesTraveled = saved.milesTraveled;
                  if (typeof saved.mileageAmount === 'number') entry.mileageAmount = saved.mileageAmount;
                }
                // Merge hours from saved so Cost Ctr hours-worked edits persist (sync writes costCenter0Hours to time_tracking)
                if (typeof saved.hoursWorked === 'number') {
                  entry.hoursWorked = saved.hoursWorked;
                  (entry as any).costCenter0Hours = saved.hoursWorked;
                }
                // Merge description from saved report so Cost Ctr description edits persist
                if (saved.description != null && String(saved.description).trim() !== '') {
                  entry.description = saved.description;
                }
              }
            }
          }
          
          // Calculate totals from real data (use dailyEntries so portal-edited mileage/per diem are included)
          const totalMiles = Math.round(dailyEntries.reduce((sum: number, e: any) => sum + (e.milesTraveled || 0), 0));
          const totalMileageAmount = dailyEntries.reduce((sum: number, e: any) => sum + (e.mileageAmount || 0), 0);
          const totalReceipts = currentMonthReceipts.reduce((sum: number, receipt: any) => sum + (receipt.amount || 0), 0);
          const totalHours = currentMonthTimeTracking.reduce((sum: number, tracking: any) => sum + (tracking.hours || 0), 0);
          
          // Per diem total from daily entries (includes portal-edited values after merge)
          const totalPerDiemFromDailyEntries = dailyEntries.reduce((sum: number, e: any) => sum + (e.perDiem || 0), 0);
          const totalPerDiemFromReceipts = currentMonthReceipts
            .filter((receipt: any) => receipt.category === 'Per Diem')
            .reduce((sum: number, receipt: any) => sum + (receipt.amount || 0), 0);
          
          // Create employee expense data with real data
          const expenseData: EmployeeExpenseData = {
            employeeId: employee.id,
            name: employee.name,
            preferredName: employee.preferredName,
            month: monthName,
            year: currentYear,
            dateCompleted: new Date(currentYear, currentMonth, 0).toLocaleDateString('en-US', { 
              month: '2-digit', 
              day: '2-digit', 
              year: '2-digit' 
            }),
            costCenters: costCenters,
            
            totalMiles,
            totalMileageAmount,
            totalReceipts,
            totalHours,
            
            dailyEntries,
            
            // All expenses default to 0 (can be updated from receipts)
            airRailBus: 0,
            vehicleRentalFuel: 0,
            parkingTolls: 0,
            groundTransportation: 0,
            hotelsAirbnb: 0,
            perDiem: totalPerDiemFromDailyEntries, // Sum of daily table (includes portal-edited per diem)
            phoneInternetFax: totalReceipts - totalPerDiemFromReceipts, // Exclude Per Diem from other receipts
            shippingPostage: 0,
            printingCopying: 0,
            officeSupplies: 0,
            eesReceipt: 0,
            other: 0,
            otherExpenses: [],
            costCenterBreakdowns: {},
            
            baseAddress: employee.baseAddress || '230 Wagner St, Troutman, NC 28166',
            baseAddress2: employee.baseAddress2
          };
          
          // Initialize cost center breakdowns from existing report data if available
          if (currentReport?.reportData?.costCenterBreakdowns) {
            expenseData.costCenterBreakdowns = currentReport.reportData.costCenterBreakdowns;
          }
          
          // Calculate receipt totals by category for validation
          const categoryTotals: {[key: string]: number} = {};
          // Reduced logging for performance
          currentMonthReceipts.forEach((receipt: any) => {
            const category = receipt.category?.toLowerCase() || '';
            const amount = receipt.amount || 0;
            
            // Map receipt categories to summary sheet categories
            if (category.includes('air') || category.includes('rail') || category.includes('bus') || category.includes('flight')) {
              categoryTotals['airRailBus'] = (categoryTotals['airRailBus'] || 0) + amount;
              // Reduced logging for performance
              // debugLog(`✅ Matched to airRailBus: total now = $${categoryTotals['airRailBus']}`);
            } else if (category.includes('vehicle') || category.includes('rental') || category.includes('fuel')) {
              categoryTotals['vehicleRentalFuel'] = (categoryTotals['vehicleRentalFuel'] || 0) + amount;
            } else if (category.includes('parking') || category.includes('toll')) {
              categoryTotals['parkingTolls'] = (categoryTotals['parkingTolls'] || 0) + amount;
            } else if (category.includes('ground') || category.includes('transportation') || category.includes('taxi') || category.includes('uber') || category.includes('lyft')) {
              categoryTotals['groundTransportation'] = (categoryTotals['groundTransportation'] || 0) + amount;
            } else if (category.includes('hotel') || category.includes('lodging') || category.includes('airbnb')) {
              categoryTotals['hotelsAirbnb'] = (categoryTotals['hotelsAirbnb'] || 0) + amount;
            } else if (category.includes('phone') || category.includes('internet') || category.includes('fax')) {
              categoryTotals['phoneInternetFax'] = (categoryTotals['phoneInternetFax'] || 0) + amount;
            } else if (category.includes('shipping') || category.includes('postage')) {
              categoryTotals['shippingPostage'] = (categoryTotals['shippingPostage'] || 0) + amount;
            } else if (category.includes('printing') || category.includes('copying')) {
              categoryTotals['printingCopying'] = (categoryTotals['printingCopying'] || 0) + amount;
            } else if (category.includes('supplies') || category.includes('office')) {
              categoryTotals['officeSupplies'] = (categoryTotals['officeSupplies'] || 0) + amount;
            } else if (category.includes('ees')) {
              categoryTotals['eesReceipt'] = (categoryTotals['eesReceipt'] || 0) + amount;
            } else if (category.includes('other') && category !== 'per diem') {
              categoryTotals['other'] = (categoryTotals['other'] || 0) + amount;
            }
          });
          // Reduced logging for performance
          // debugLog(`🔍 Final receipt totals by category:`, categoryTotals);
          setReceiptTotalsByCategory(categoryTotals);
          
          // Auto-populate summary sheet from receipt totals (only if value is 0 or undefined)
          const autoPopulatedData = { ...expenseData };
          let needsUpdate = false;
          
          // Helper function to auto-populate a category
          const autoPopulateCategory = (categoryKey: string, receiptTotal: number, currentValue: number) => {
            if (receiptTotal > 0 && (currentValue === 0 || currentValue === undefined || currentValue === null)) {
              (autoPopulatedData as any)[categoryKey] = receiptTotal;
              if (!autoPopulatedData.costCenterBreakdowns) autoPopulatedData.costCenterBreakdowns = {};
              if (!autoPopulatedData.costCenterBreakdowns[categoryKey]) (autoPopulatedData.costCenterBreakdowns as any)[categoryKey] = [];
              (autoPopulatedData.costCenterBreakdowns as any)[categoryKey][0] = receiptTotal;
              needsUpdate = true;
            }
          };
          
          autoPopulateCategory('airRailBus', categoryTotals['airRailBus'] || 0, expenseData.airRailBus || 0);
          autoPopulateCategory('vehicleRentalFuel', categoryTotals['vehicleRentalFuel'] || 0, expenseData.vehicleRentalFuel || 0);
          autoPopulateCategory('parkingTolls', categoryTotals['parkingTolls'] || 0, expenseData.parkingTolls || 0);
          autoPopulateCategory('groundTransportation', categoryTotals['groundTransportation'] || 0, expenseData.groundTransportation || 0);
          autoPopulateCategory('hotelsAirbnb', categoryTotals['hotelsAirbnb'] || 0, expenseData.hotelsAirbnb || 0);
          autoPopulateCategory('phoneInternetFax', categoryTotals['phoneInternetFax'] || 0, expenseData.phoneInternetFax || 0);
          autoPopulateCategory('shippingPostage', categoryTotals['shippingPostage'] || 0, expenseData.shippingPostage || 0);
          autoPopulateCategory('printingCopying', categoryTotals['printingCopying'] || 0, expenseData.printingCopying || 0);
          autoPopulateCategory('officeSupplies', categoryTotals['officeSupplies'] || 0, expenseData.officeSupplies || 0);
          autoPopulateCategory('eesReceipt', categoryTotals['eesReceipt'] || 0, expenseData.eesReceipt || 0);
          
          // Save auto-populated data to backend if it changed
          if (needsUpdate) {
            try {
              const response = await fetch(`${API_BASE_URL}/api/expense-reports/${employeeId}/${currentMonth}/${currentYear}/summary`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  reportData: autoPopulatedData
                })
              });
              if (response.ok) {
                debugLog('✅ Auto-populated summary sheet from receipt totals on load');
                // Update expenseData with auto-populated values
                Object.assign(expenseData, autoPopulatedData);
              }
            } catch (error) {
              debugError('Error auto-populating summary sheet on load:', error);
            }
          }
          
          // Initialize otherExpenses array if not present
          if (!expenseData.otherExpenses) {
            expenseData.otherExpenses = expenseData.other && expenseData.other > 0 
              ? [{ amount: expenseData.other, description: '', id: Date.now().toString() }]
              : [];
          }
          
          // Calculate category hours for status indicators (gaHours, holidayHours, ptoHours)
          const gaHours = currentMonthTimeTracking
            .filter((t: any) => t.category === 'G&A' || t.category === 'G&a')
            .reduce((sum: number, t: any) => sum + (t.hours || 0), 0);
          const holidayHours = currentMonthTimeTracking
            .filter((t: any) => t.category === 'Holiday')
            .reduce((sum: number, t: any) => sum + (t.hours || 0), 0);
          const ptoHours = currentMonthTimeTracking
            .filter((t: any) => t.category === 'PTO')
            .reduce((sum: number, t: any) => sum + (t.hours || 0), 0);
          
          // Set fields required for status indicators
          (expenseData as any).gaHours = gaHours;
          (expenseData as any).holidayHours = holidayHours;
          (expenseData as any).ptoHours = ptoHours;
          (expenseData as any).receipts = currentMonthReceipts;
          // Set employeeSignature from saved expense report or signature state
          (expenseData as any).employeeSignature = savedExpenseReport?.reportData?.signatureImage || savedExpenseReport?.reportData?.employeeSignature || signatureImage || employee.signature || null;
          // Set employeeCertificationAcknowledged from saved expense report or current state
          (expenseData as any).employeeCertificationAcknowledged = savedExpenseReport?.reportData?.employeeCertificationAcknowledged || employeeCertificationAcknowledged || false;
          
          setEmployeeData(expenseData);
          const formattedReceipts = currentMonthReceipts.map((receipt: any) => ({
            id: receipt.id,
            date: new Date(receipt.date).toLocaleDateString('en-US', { 
              month: '2-digit', 
              day: '2-digit', 
              year: '2-digit' 
            }),
            amount: receipt.amount,
            vendor: receipt.vendor,
            description: receipt.description,
            category: receipt.category,
            imageUri: receipt.imageUri
          }));
          setReceipts(formattedReceipts);
          
          // Also set receipts on expenseData for status indicator
          (expenseData as any).receipts = currentMonthReceipts;
          setDailyDescriptions(dailyDescriptions);
          
          // Load signature from employee data
          if (employee.signature) {
            setSavedSignature(employee.signature); // Save as the saved signature
            setSignatureImage(employee.signature); // Also set as current for this report
          }
          
          // Refresh timesheet data immediately using the data we just loaded
          // Pass expenseData directly since React state updates are async
          await refreshTimesheetData(expenseData);
      } catch (error) {
        debugError('Error loading employee data:', error);
        // Create dynamic fallback data instead of using hardcoded mock data
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                          'July', 'August', 'September', 'October', 'November', 'December'];
        const monthName = monthNames[currentMonth - 1];
        const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();
        
        // Generate daily entries for the selected month
        const dailyEntries = Array.from({ length: daysInMonth }, (_, i) => {
          const day = i + 1;
          const date = new Date(currentYear, currentMonth - 1, day);
          const dateStr = date.toLocaleDateString('en-US', { 
            month: '2-digit', 
            day: '2-digit', 
            year: '2-digit' 
          });
          
          return {
            day,
            date: dateStr,
            description: '', // Empty description for blank days
            hoursWorked: 0,
            workingHours: 0, // Add workingHours field to fallback data
            odometerStart: 0,
            odometerEnd: 0,
            milesTraveled: 0,
            mileageAmount: 0,
            airRailBus: 0,
            vehicleRentalFuel: 0,
            parkingTolls: 0,
            groundTransportation: 0,
            hotelsAirbnb: 0,
            perDiem: 0
          };
        });
        
        // Create fallback employee expense data with correct date
        const fallbackData: EmployeeExpenseData = {
          employeeId: employee?.id || employeeId,
          name: employee?.name || 'Unknown Employee',
          preferredName: employee?.preferredName,
          month: monthName,
          year: currentYear,
          dateCompleted: new Date(currentYear, currentMonth, 0).toLocaleDateString('en-US', { 
            month: '2-digit', 
            day: '2-digit', 
            year: '2-digit' 
          }),
          costCenters: costCenters,
          
          totalMiles: 0,
          totalMileageAmount: 0,
          totalReceipts: 0,
          totalHours: 0,
          
          dailyEntries,
          
          // All expenses default to 0
          airRailBus: 0,
          vehicleRentalFuel: 0,
          parkingTolls: 0,
          groundTransportation: 0,
          hotelsAirbnb: 0,
          perDiem: 0,
          phoneInternetFax: 0,
          shippingPostage: 0,
          printingCopying: 0,
          officeSupplies: 0,
          eesReceipt: 0,
          other: 0,
          otherExpenses: [],
          
          baseAddress: employee?.baseAddress || '230 Wagner St, Troutman, NC 28166',
          baseAddress2: employee?.baseAddress2
        };
        
        setEmployeeData(fallbackData);
        setReceipts([]); // Start with empty receipts
        
        // Wait for state to be set, then refresh timesheet data to load actual hours from database
        await new Promise(resolve => setTimeout(resolve, 50));
        // Call refresh without parameters so it uses the current state (which should now be set)
        await refreshTimesheetData();
      } finally {
        setLoading(false);
      }
    };
    
    // Clear cache when refreshTrigger changes to ensure fresh data
    // This is critical because the API service caches responses for 60 seconds
    if (refreshTrigger > 0) {
      import('./services/rateLimitedApi').then(({ rateLimitedApi }) => {
        rateLimitedApi.clearCacheFor('/api/daily-descriptions');
        rateLimitedApi.clearCacheFor('/api/time-tracking');
        rateLimitedApi.clearCacheFor('/api/mileage-entries');
        rateLimitedApi.clearCacheFor('/api/receipts');
      });
    }
    
    loadEmployeeData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveEmployeeId, currentMonth, currentYear, refreshTrigger]);
  
  // Sync receipts to employeeData whenever receipts change (for status indicators)
  useEffect(() => {
    if (employeeData && receipts) {
      setEmployeeData({ ...employeeData, receipts: receipts } as any);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [receipts.length]); // Only update when count changes to avoid infinite loops

  // Initialize tips when employee data is loaded
  useEffect(() => {
    if (effectiveEmployeeId && !loading) {
      setCurrentUserId(effectiveEmployeeId);
      loadTipsForScreen('staff_portal', 'on_load');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveEmployeeId, loading]);

  // Check for revision requests
  useEffect(() => {
    const checkRevisionItems = async () => {
      if (reportStatus === 'needs_revision' && effectiveEmployeeId) {
        try {
          // Fetch receipts, mileage entries, and time entries to check for revision flags
          const { apiFetch } = await import('./services/rateLimitedApi');
          const [receiptsRes, mileageRes, timeRes] = await Promise.all([
            apiFetch(`/api/receipts?employeeId=${effectiveEmployeeId}&month=${currentMonth}&year=${currentYear}`),
            apiFetch(`/api/mileage-entries?employeeId=${effectiveEmployeeId}&month=${currentMonth}&year=${currentYear}`),
            apiFetch(`/api/time-tracking?employeeId=${effectiveEmployeeId}&month=${currentMonth}&year=${currentYear}`)
          ]);

          const receipts = await receiptsRes.json();
          const mileageEntries = await mileageRes.json();
          const timeEntries = await timeRes.json();

          // Store raw data for revision checking
          setRawMileageEntries(mileageEntries);
          setRawTimeEntries(timeEntries);

          // Count items needing revision
          const revisionCounts = {
            mileage: (mileageEntries as any[]).filter((e: any) => e.needsRevision).length,
            receipts: (receipts as any[]).filter((e: any) => e.needsRevision).length,
            time: (timeEntries as any[]).filter((e: any) => e.needsRevision).length
          };

          setRevisionItems(revisionCounts);
        } catch (error) {
          debugError('Error checking revision items:', error);
        }
      } else {
        setRevisionItems({ mileage: 0, receipts: 0, time: 0 });
        setRawMileageEntries([]);
        setRawTimeEntries([]);
      }
    };

    checkRevisionItems();
  }, [reportStatus, effectiveEmployeeId, currentMonth, currentYear]);

  // Fetch revision notes and highlight items that need revision
  useEffect(() => {
    const fetchRevisionNotes = async () => {
      if (currentReportId && reportStatus === 'needs_revision') {
        try {
          const response = await fetch(`${API_BASE_URL}/api/expense-reports/${currentReportId}/revision-notes?resolved=false`);
          if (response.ok) {
            const notes = await response.json();
            const itemsNeedingRev = new Set<string>();
            const daysNeedingRev = new Set<number>();
            
            notes.forEach((note: any) => {
              if (note.resolved === 0 || note.resolved === false) {
                const category = note.category || note.itemType;
                const itemId = note.itemId;
                
                if (category === 'mileage' && itemId !== null && itemId !== undefined) {
                  const index = parseInt(itemId, 10);
                  if (!isNaN(index)) {
                    itemsNeedingRev.add(`mileage-${index}`);
                    // Daily entry index corresponds to day number (index 0 = day 1, index 1 = day 2, etc.)
                    const day = index + 1;
                    daysNeedingRev.add(day);
                  }
                } else if (category === 'receipt' && itemId) {
                  itemsNeedingRev.add(`receipt-${itemId}`);
                } else if (category === 'time' && itemId !== null && itemId !== undefined) {
                  const index = parseInt(itemId, 10);
                  if (!isNaN(index)) {
                    // Daily entry index corresponds to day number
                    const day = index + 1;
                    daysNeedingRev.add(day);
                  }
                }
              }
            });
            
            setItemsNeedingRevision(itemsNeedingRev);
            setDaysNeedingRevision(daysNeedingRev);
          }
        } catch (error) {
          debugError('Error fetching revision notes:', error);
        }
      } else {
        setItemsNeedingRevision(new Set());
        setDaysNeedingRevision(new Set());
      }
    };

    fetchRevisionNotes();
  }, [currentReportId, reportStatus]);

  // Handle tab change
  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  // Handle delete report
  const handleDeleteReport = async (reportId: string) => {
    try {
      // Remove from local storage
      const savedReports = JSON.parse(localStorage.getItem('savedReports') || '[]');
      const updatedReports = savedReports.filter((report: any) => report.id !== reportId);
      localStorage.setItem('savedReports', JSON.stringify(updatedReports));
      
      // Update the allReports state
      setAllReports(updatedReports);
      
      alert('Report deleted successfully!');
    } catch (error) {
      debugError('Error deleting report:', error);
      alert('Error deleting report. Please try again.');
    }
  };


  // Handle cell editing
  const handleCellEdit = (rowIndex: number, field: string, currentValue: any) => {
    // Don't allow editing description if it's a day off
    if (field === 'description' && employeeData) {
      const entry = employeeData.dailyEntries[rowIndex];
      const entryDateStr = normalizeDate(entry.date);
      const dayDescription = dailyDescriptions.find((desc: any) => {
        const descDateStr = normalizeDate(desc.date);
        return entryDateStr === descDateStr;
      });
      
      if (dayDescription?.dayOff) {
        // Day off - don't allow editing
        return;
      }
    }
    
    setEditingCell({ row: rowIndex, field });
    setEditingValue(currentValue.toString());
  };

  // Save cell edit
  const handleCellSave = async () => {
    if (!editingCell || !employeeData) return;
    
    const { row, field } = editingCell;
    const newEntries = [...employeeData.dailyEntries];
    // Use this when building reportData so sync-to-source gets the latest (state may not have updated yet)
    let dailyDescriptionsForSync = dailyDescriptions;
    
    if (field === 'description') {
      // Allow editing all descriptions, including day off entries
      // User should be able to change or delete day off entries
      const entry = newEntries[row];
      newEntries[row].description = editingValue;
      
      // Also update the dailyDescriptions state for proper syncing
      const updatedDailyDescriptions = [...dailyDescriptions];
      const dateStr = normalizeDate(entry.date);
      const hasDescription = editingValue && editingValue.trim();
      
      // Find existing daily description for this date
      const existingDescIndex = updatedDailyDescriptions.findIndex((desc: any) => {
        const descDateStr = normalizeDate(desc.date);
        return descDateStr === dateStr;
      });
      
      // Extract user description (remove any existing driving summary) before saving
      // This prevents the driving summary from being saved and then duplicated on reload
      const userDescriptionToSave = hasDescription 
        ? extractUserDescription(editingValue)
        : '';
      
      if (existingDescIndex >= 0) {
        if (userDescriptionToSave) {
          // Update existing description with user-entered text
          // Allow updating even if it was previously a day off (user is changing it)
          updatedDailyDescriptions[existingDescIndex].description = userDescriptionToSave;
          updatedDailyDescriptions[existingDescIndex].dayOff = false; // Clear day off flag when user enters text
          updatedDailyDescriptions[existingDescIndex].dayOffType = null; // Clear day off type
          updatedDailyDescriptions[existingDescIndex].updatedAt = new Date().toISOString();
        } else {
          // Remove existing description from array if it's empty
          // Allow deletion even if it was previously a day off (user wants to delete it)
          // Actually remove it from the array (not just set to empty) so it gets deleted on save
          updatedDailyDescriptions.splice(existingDescIndex, 1);
        }
      } else if (userDescriptionToSave) {
        // Create new description entry only with user-entered text (no driving summary)
        // Use full date string in ID to ensure uniqueness (not just day number)
        updatedDailyDescriptions.push({
          id: `desc-${employeeData.employeeId}-${dateStr}`,
          employeeId: employeeData.employeeId,
          date: dateStr,
          description: userDescriptionToSave,
          costCenter: entry.costCenter || employeeData.costCenters[0] || '',
          stayedOvernight: false,
          dayOff: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      }
      // If empty and no existing entry, don't add anything to the array
      // This ensures empty descriptions are not saved (they'll be deleted from backend)
      
      setDailyDescriptions(updatedDailyDescriptions);
      dailyDescriptionsForSync = updatedDailyDescriptions;
      
      // Save to backend immediately to prevent syncDescriptionToCostCenter from overwriting
      try {
        const descToSave = updatedDailyDescriptions.find((desc: any) => {
          const descDateStr = normalizeDate(desc.date);
          return descDateStr === dateStr;
        });
        
        if (descToSave) {
          const response = await fetch(`${API_BASE_URL}/api/daily-descriptions`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              id: descToSave.id,
              employeeId: descToSave.employeeId,
              date: dateStr,
              description: descToSave.description || '',
              costCenter: descToSave.costCenter || '',
              stayedOvernight: descToSave.stayedOvernight || false,
              dayOff: descToSave.dayOff || false,
              dayOffType: descToSave.dayOffType || null
            })
          });
          
          if (!response.ok) {
            debugError('Error saving description:', response.status);
          }
        }
      } catch (error) {
        debugError('Error saving description to backend:', error);
      }
    } else if (field === 'odometerStart') {
      const value = parseInt(editingValue) || 0;
      newEntries[row].odometerStart = value;
      // Always recalculate miles (zero when either odometer is 0)
      const start = value;
      const end = newEntries[row].odometerEnd || 0;
      newEntries[row].milesTraveled = Math.max(0, end - start);
      newEntries[row].mileageAmount = newEntries[row].milesTraveled * 0.445;
    } else if (field === 'odometerEnd') {
      const value = parseInt(editingValue) || 0;
      newEntries[row].odometerEnd = value;
      // Always recalculate miles (zero when either odometer is 0)
      const start = newEntries[row].odometerStart || 0;
      const end = value;
      newEntries[row].milesTraveled = Math.max(0, end - start);
      newEntries[row].mileageAmount = newEntries[row].milesTraveled * 0.445;
    } else if (field === 'hoursWorked') {
      const value = parseFloat(editingValue) || 0;
      newEntries[row].hoursWorked = value;
      // Persist to time_tracking via sync-to-source: backend reads costCenter0Hours (first cost center)
      (newEntries[row] as any).costCenter0Hours = value;
    } else if (field === 'perDiem') {
      const value = parseFloat(editingValue) || 0;
      // Cap per diem at $35 per day
      newEntries[row].perDiem = Math.min(value, 35);
    }
    
    // Calculate total per diem and check monthly cap
    const totalPerDiem = newEntries.reduce((sum, entry) => sum + entry.perDiem, 0);
    
    // If we hit the cap, adjust the current entry
    if (field === 'perDiem' && totalPerDiem > 350) {
      const excess = totalPerDiem - 350;
      newEntries[row].perDiem = Math.max(0, newEntries[row].perDiem - excess);
    }
    
    // Calculate category hours for status indicators from rawTimeEntries
    const currentMonthTimeTracking = rawTimeEntries.filter((t: any) => {
      const trackingDate = new Date(t.date);
      const trackingMonth = trackingDate.getUTCMonth() + 1;
      const trackingYear = trackingDate.getUTCFullYear();
      return trackingMonth === currentMonth && trackingYear === currentYear;
    });
    
    const gaHours = currentMonthTimeTracking
      .filter((t: any) => t.category === 'G&A' || t.category === 'G&a')
      .reduce((sum: number, t: any) => sum + (t.hours || 0), 0);
    const holidayHours = currentMonthTimeTracking
      .filter((t: any) => t.category === 'Holiday')
      .reduce((sum: number, t: any) => sum + (t.hours || 0), 0);
    const ptoHours = currentMonthTimeTracking
      .filter((t: any) => t.category === 'PTO')
      .reduce((sum: number, t: any) => sum + (t.hours || 0), 0);
    
    // Update totals
    const updatedData = {
      ...employeeData,
      dailyEntries: newEntries,
      totalMileageAmount: newEntries.reduce((sum, entry) => sum + entry.mileageAmount, 0),
      totalHours: newEntries.reduce((sum, entry) => sum + entry.hoursWorked, 0),
      totalMiles: Math.round(newEntries.reduce((sum, entry) => sum + entry.milesTraveled, 0)),
      perDiem: Math.min(newEntries.reduce((sum, entry) => sum + entry.perDiem, 0), 350)
    };
    
    // Set status indicator fields
    (updatedData as any).gaHours = gaHours;
    (updatedData as any).holidayHours = holidayHours;
    (updatedData as any).ptoHours = ptoHours;
    (updatedData as any).receipts = receipts;
    (updatedData as any).employeeSignature = signatureImage;
    (updatedData as any).employeeCertificationAcknowledged = employeeCertificationAcknowledged;
    
    setEmployeeData(updatedData);
    setEditingCell(null);
    setEditingValue('');
    
    // Auto-save changes to backend and sync to source tables
    try {
      const reportData = {
        ...updatedData,
        receipts: receipts,
        dailyDescriptions: dailyDescriptionsForSync,
        employeeSignature: signatureImage,
        supervisorSignature: supervisorSignatureState,
        employeeCertificationAcknowledged: employeeCertificationAcknowledged,
        supervisorCertificationAcknowledged: supervisorCertificationAcknowledged
      };

      // Sync to source tables and expense report (we send reportData directly so state doesn't need to be updated yet)
      await fetch(`${API_BASE_URL}/api/expense-reports/sync-to-source`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          employeeId: updatedData.employeeId,
          month: currentMonth,
          year: currentYear,
          reportData: reportData
        }),
      });
      
      debugVerbose('✅ Changes auto-saved and synced to source tables');
      
      // If we saved a description (especially if it was deleted), wait a bit before reloading
      // This gives the backend time to process the deletion
      if (field === 'description') {
        // Clear API cache to ensure we get fresh data after save
        // This is critical because the API service caches responses for 60 seconds
        const { rateLimitedApi } = await import('./services/rateLimitedApi');
        rateLimitedApi.clearCacheFor('/api/daily-descriptions');
        
        setLoading(true); // Show loading state
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second (increased from 500ms)
        setRefreshTrigger(prev => prev + 1); // Trigger reload
        setLoading(false); // Hide loading state (loadEmployeeData will set it appropriately)
      }
    } catch (error) {
      debugError('Error auto-saving changes:', error);
      // Don't show alert for auto-save failures to avoid interrupting user workflow
      if (field === 'description') {
        setLoading(false); // Make sure to clear loading state on error
      }
    }
  };

  // Handle timesheet cell editing
  const handleTimesheetCellEdit = (costCenter: number, day: number, type: string, currentValue: any) => {
    setEditingTimesheetCell({ costCenter, day, type });
    setEditingTimesheetValue(currentValue.toString());
  };

  // Handle mileage entry save
  const handleMileageEntrySave = async (formData: MileageEntryFormData) => {
    try {
      // Prepare the data for the backend, mapping startingOdometer to odometerReading
      const backendData = {
        ...formData,
        odometerReading: formData.startingOdometer || 0
      };
      
      let response;
      const isEdit = editingMileageEntry && editingMileageEntry.id;
      
      if (isEdit) {
        // Update existing entry
        response = await fetch(`${API_BASE_URL}/api/mileage-entries/${editingMileageEntry.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(backendData)
        });
      } else {
        // Create new entry
        response = await fetch(`${API_BASE_URL}/api/mileage-entries`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(backendData)
        });
      }
      
      if (!response.ok) {
        throw new Error(`Failed to ${isEdit ? 'update' : 'create'} mileage entry`);
      }
      
      // Reload mileage entries to refresh the display
      const mileageRes = await fetch(`${API_BASE_URL}/api/mileage-entries?employeeId=${employeeId}&month=${currentMonth}&year=${currentYear}`);
      if (mileageRes.ok) {
        const mileageEntries = await mileageRes.json();
        setRawMileageEntries(mileageEntries);
      }
      
      // Trigger a refresh of employee data by incrementing refreshTrigger
      setRefreshTrigger(prev => prev + 1);
      
      setEditingMileageEntry(null);
      setMileageFormOpen(false);
    } catch (error) {
      debugError('Error saving mileage entry:', error);
      alert(`Failed to ${editingMileageEntry && editingMileageEntry.id ? 'update' : 'create'} mileage entry. Please try again.`);
    }
  };

  const handleMileageEntryDelete = async (entryId: string) => {
    if (!window.confirm('Are you sure you want to delete this mileage entry? This action cannot be undone.')) {
      return;
    }
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/mileage-entries/${entryId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete mileage entry');
      }
      
      // Reload mileage entries to refresh the display
      const mileageRes = await fetch(`${API_BASE_URL}/api/mileage-entries?employeeId=${effectiveEmployeeId}&month=${currentMonth}&year=${currentYear}`);
      if (mileageRes.ok) {
        const mileageEntries = await mileageRes.json();
        setRawMileageEntries(mileageEntries);
      }
      
      // Trigger a full refresh of employee data to recalculate odometer end and daily entries
      // This ensures odometer end is recalculated after deletion
      setRefreshTrigger(prev => prev + 1);
    } catch (error) {
      debugError('Error deleting mileage entry:', error);
      alert('Failed to delete mileage entry. Please try again.');
    }
  };

  /** Delete all mileage entries for a given date (used from Cost Center tab). Also clear that day's odometer/miles in saved report so merge on reload doesn't restore old values. */
  const handleDeleteDayMileageEntries = async (dateStr: string) => {
    const entriesForDate = rawMileageEntries.filter((e: any) => normalizeDate(e.date) === dateStr);
    if (entriesForDate.length === 0) {
      alert('No mileage entries to delete for this date.');
      return;
    }
    if (!window.confirm(`Delete ${entriesForDate.length} mileage entry(ies) for this date? This cannot be undone.`)) {
      return;
    }
    try {
      for (const entry of entriesForDate) {
        const response = await fetch(`${API_BASE_URL}/api/mileage-entries/${entry.id}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' }
        });
        if (!response.ok) throw new Error(`Failed to delete entry ${entry.id}`);
      }
      const mileageRes = await fetch(`${API_BASE_URL}/api/mileage-entries?employeeId=${effectiveEmployeeId}&month=${currentMonth}&year=${currentYear}`);
      if (mileageRes.ok) {
        const mileageEntries = await mileageRes.json();
        setRawMileageEntries(mileageEntries);
      }
      // Clear this day's odometer/miles in saved reportData so reload merge doesn't restore old values
      if (employeeData?.dailyEntries) {
        const updatedEntries = employeeData.dailyEntries.map((e: any) => {
          const key = normalizeDate(e.date);
          if (key === dateStr) {
            return { ...e, odometerStart: 0, odometerEnd: 0, milesTraveled: 0, mileageAmount: 0 };
          }
          return e;
        });
        const reportData = {
          ...employeeData,
          dailyEntries: updatedEntries,
          receipts,
          dailyDescriptions,
          employeeSignature: signatureImage,
          supervisorSignature: supervisorSignatureState,
          employeeCertificationAcknowledged: employeeCertificationAcknowledged,
          supervisorCertificationAcknowledged: supervisorCertificationAcknowledged
        };
        await fetch(`${API_BASE_URL}/api/expense-reports/sync-to-source`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            employeeId: employeeData.employeeId,
            month: currentMonth,
            year: currentYear,
            reportData
          })
        });
        setEmployeeData({ ...employeeData, dailyEntries: updatedEntries });
      }
      setRefreshTrigger(prev => prev + 1);
    } catch (error) {
      debugError('Error deleting day mileage entries:', error);
      alert('Failed to delete one or more entries. Please try again.');
    }
  };

  // Save timesheet cell edit
  // Save timesheet cell edit - NEW APPROACH: Daily Hours Distribution with Validation
  const handleTimesheetCellSave = async () => {
    if (!editingTimesheetCell || !employeeData) return;
    
    const { costCenter, day, type } = editingTimesheetCell;
    const value = parseFloat(editingTimesheetValue) || 0;
    
    // Validate daily hours limit
    if (value > 24) {
      alert('Cannot enter more than 24 hours in a single day');
      return;
    }
    
    debugLog('🔍 NEW APPROACH: Saving timesheet cell');
    debugLog(`  Day: ${day}, Type: ${type}, Cost Center Index: ${costCenter}, Value: ${value}`);
    
    // Determine the actual cost center name and category based on the cell type
    let actualCostCenter = '';
    let category = '';
    
    if (type === 'costCenter' || type === 'billable') {
      // For cost center rows, use the specific cost center based on the costCenter index
      actualCostCenter = employeeData.costCenters[costCenter] || 'Program Services';
      category = 'Working Hours';
    } else if (type === 'workingHours') {
      // For working hours row, use the first cost center
      actualCostCenter = employeeData.costCenters[0] || 'Program Services';
      category = 'Working Hours';
    } else {
      // For other category rows (G&A, Holiday, PTO, etc.)
      const categoryMap: { [key: string]: string } = {
        'ga': 'G&A',
        'holiday': 'Holiday',
        'pto': 'PTO',
        'stdLtd': 'STD/LTD',
        'pflPfml': 'PFL/PFML'
      };
      category = categoryMap[type] || 'Working Hours';
      actualCostCenter = ''; // Category entries don't have cost centers
    }
    
    debugLog(`  Final actualCostCenter: "${actualCostCenter}"`);
    debugLog(`  Final category: "${category}"`);
    
    // Update the UI optimistically FIRST - show the change immediately
    setEmployeeData(prev => {
      if (!prev) return null;
      const updatedEntries = prev.dailyEntries.map((entry: any) => {
        if (entry.day === day) {
          const updatedEntry = { ...entry };
          if (type === 'costCenter' || type === 'billable') {
            // Update cost center hours
            const costCenterKey = `costCenter${costCenter}Hours`;
            const oldValue = (updatedEntry as any)[costCenterKey] || 0;
            (updatedEntry as any)[costCenterKey] = value;
            updatedEntry.hoursWorked = Math.max(0, (updatedEntry.hoursWorked || 0) - oldValue + value);
            updatedEntry.workingHours = Math.max(0, (updatedEntry.workingHours || 0) - oldValue + value);
          } else if (type === 'workingHours') {
            // Update working hours (cost center 0)
            const oldValue = (updatedEntry as any).costCenter0Hours || 0;
            (updatedEntry as any).costCenter0Hours = value;
            updatedEntry.hoursWorked = Math.max(0, (updatedEntry.hoursWorked || 0) - oldValue + value);
            updatedEntry.workingHours = Math.max(0, (updatedEntry.workingHours || 0) - oldValue + value);
          }
          return updatedEntry;
        }
        return entry;
      });
      return {
        ...prev,
        dailyEntries: updatedEntries,
        totalHours: updatedEntries.reduce((sum: number, e: any) => sum + (e.hoursWorked || 0), 0)
      };
    });
    
    // Save to time tracking API with correct cost center and category
    try {
      const dateStr = `${currentYear}-${currentMonth.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
      
      // First, check if entries exist for this day, category, and cost center
      // IMPORTANT: Find ALL matching entries (not just one) to handle duplicates
      const checkResponse = await fetch(`${API_BASE_URL}/api/time-tracking?employeeId=${employeeData.employeeId}&month=${currentMonth}&year=${currentYear}`);
      let existingEntries: any[] = [];
      
      if (checkResponse.ok) {
        const allEntries = await checkResponse.json();
        
        // Find ALL entries matching this day, category, and cost center
        // Use local date parsing to avoid timezone issues
        existingEntries = allEntries.filter((entry: any) => {
          const entryDateStr = typeof entry.date === 'string' ? entry.date.split('T')[0] : entry.date;
          const [entryYear, entryMonth, entryDay] = entryDateStr.split('-').map(Number);
          const entryCostCenter = entry.costCenter || '';
          const entryCategory = entry.category || '';
          
          // For cost center entries, we need to match:
          // 1. Same date (day, month, year)
          // 2. Same cost center
          // 3. Category should be "Working Hours", "Regular Hours", or empty/null (for entries created via sync-to-source)
          const dateMatches = entryDay === day && entryMonth === currentMonth && entryYear === currentYear;
          const costCenterMatches = entryCostCenter === actualCostCenter && actualCostCenter !== '';
          
          // Category matching: for cost center entries, accept:
          // - Exact match with "Working Hours"
          // - "Regular Hours" (legacy)
          // - Empty/null category (from sync-to-source endpoint)
          const categoryMatches = entryCategory === category || 
                                  (category === 'Working Hours' && (
                                    entryCategory === 'Working Hours' || 
                                    entryCategory === 'Regular Hours' || 
                                    entryCategory === '' || 
                                    !entryCategory
                                  ));
          
          return dateMatches && costCenterMatches && categoryMatches;
        });
      }
      
      // If value is 0, delete ALL matching entries (handle duplicates)
      if (value === 0) {
        if (existingEntries.length > 0) {
          debugLog(`🗑️ Deleting ${existingEntries.length} time tracking entry/entries (0 hours):`, existingEntries.map(e => e.id));
          
          // Delete all matching entries in parallel
          const deletePromises = existingEntries.map(entry => 
            fetch(`${API_BASE_URL}/api/time-tracking/${entry.id}`, {
              method: 'DELETE',
            })
          );
          
          const deleteResults = await Promise.allSettled(deletePromises);
          
          // Check if any deletions failed
          const failedDeletions = deleteResults.filter((result, index) => {
            if (result.status === 'rejected') {
              debugError(`❌ Failed to delete entry ${existingEntries[index].id}:`, result.reason);
              return true;
            }
            if (result.status === 'fulfilled' && !result.value.ok) {
              debugError(`❌ Failed to delete entry ${existingEntries[index].id}: ${result.value.status}`);
              return true;
            }
            return false;
          });
          
          if (failedDeletions.length > 0) {
            // Revert optimistic update on error
            refreshTimesheetData(employeeData).catch(() => {});
            throw new Error(`Failed to delete ${failedDeletions.length} of ${existingEntries.length} entries`);
          }
          
          debugLog(`✅ Deleted ${existingEntries.length} time tracking entry/entries for day ${day}`);
        } else {
          debugLog(`ℹ️ Value is 0 and no existing entries found - nothing to delete`);
          // Even if no entry found, the optimistic update already shows 0, which is correct
        }
      } else if (value > 0) {
        // Save or update entry
        // If multiple entries exist, delete all but the most recent one, then update that one
        if (existingEntries.length > 1) {
          debugLog(`⚠️ Found ${existingEntries.length} duplicate entries, deleting all but the most recent`);
          // Sort by updatedAt (most recent first) and keep the first one
          existingEntries.sort((a, b) => {
            const aTime = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
            const bTime = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
            return bTime - aTime; // Most recent first
          });
          
          // Delete all but the first (most recent) entry
          const entriesToDelete = existingEntries.slice(1);
          const deletePromises = entriesToDelete.map(entry => 
            fetch(`${API_BASE_URL}/api/time-tracking/${entry.id}`, {
              method: 'DELETE',
            })
          );
          
          await Promise.allSettled(deletePromises);
          debugLog(`🗑️ Deleted ${entriesToDelete.length} duplicate entries`);
        }
        
        // Use the most recent entry if one exists, otherwise create new
        const entryToUpdate = existingEntries.length > 0 
          ? existingEntries.sort((a, b) => {
              const aTime = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
              const bTime = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
              return bTime - aTime; // Most recent first
            })[0]
          : null;
        
        const requestBody = {
            employeeId: employeeData.employeeId,
            date: dateStr,
            hours: value,
            category: category,
            description: `${category} hours worked on ${dateStr}`,
            costCenter: actualCostCenter
        };
        
        debugLog(`📤 Saving to time tracking API:`, requestBody);
        debugLog(`🔍 Existing entry to update:`, entryToUpdate);
        
        // Use PUT if entry exists, POST if it doesn't
        const response = entryToUpdate 
          ? await fetch(`${API_BASE_URL}/api/time-tracking/${entryToUpdate.id}`, {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(requestBody),
            })
          : await fetch(`${API_BASE_URL}/api/time-tracking`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(requestBody),
            });
        
        if (!response.ok) {
          const errorText = await response.text();
          debugError(`❌ Failed to save time tracking: ${response.status} - ${errorText}`);
          throw new Error(`Failed to save: ${response.status}`);
        }
        
        const result = await response.json();
        debugLog(`✅ Saved ${value} hours as "${category}" for "${actualCostCenter}" on day ${day}. Response:`, result);
      }
    } catch (error) {
      debugError('❌ Error saving to time tracking API:', error);
      alert(`Failed to save hours: ${error instanceof Error ? error.message : 'Unknown error'}`);
      // Revert optimistic update on error
      refreshTimesheetData(employeeData).catch(() => {});
      return; // Don't continue if save failed
    }
    
    // Clear editing state
    setEditingTimesheetCell(null);
    setEditingTimesheetValue('');
    
    // Save to expense report table for persistence
    try {
      await syncReportData();
    } catch (error) {
      debugError('Error saving timesheet to expense report:', error);
    }
    
    // REMOVED: Automatic refresh after save
    // The optimistic update already shows the correct value in the UI immediately
    // Refreshing immediately can overwrite the optimistic update if:
    // 1. Backend hasn't fully processed the save yet (race condition)
    // 2. User clicks on another cell before refresh completes
    // 3. There are duplicate entries that haven't been cleaned up yet
    // 
    // Data will be refreshed naturally on:
    // - Next page navigation
    // - Explicit "Refresh Data" button click
    // - Month/year change
    // - Initial page load
    //
    // This ensures the optimistic update persists and user sees their changes immediately
  };

  // Cancel timesheet cell edit
  const handleTimesheetCellCancel = () => {
    setEditingTimesheetCell(null);
    setEditingTimesheetValue('');
  };

  // Handle category cell editing
  const handleCategoryCellEdit = (category: string, day: number, currentValue: any) => {
    debugLog(`🔍 Debug category cell edit: ${category} for day ${day}, current value: ${currentValue}`);
    setEditingCategoryCell({ category, day });
    setEditingCategoryValue(currentValue.toString());
  };

  // Save category cell edit - NEW APPROACH: Daily Hours Distribution with Validation
  const handleCategoryCellSave = async () => {
    if (!editingCategoryCell || !employeeData) return;
    
    // Store the values and clear editing state immediately to prevent duplicate saves
    const { category, day } = editingCategoryCell;
    const value = parseFloat(editingCategoryValue) || 0;
    
    // Clear editing state immediately
    setEditingCategoryCell(null);
    setEditingCategoryValue('');
    
    // Optimistically update the UI immediately - show the value right away
    setEmployeeData(prev => {
      if (!prev) return null;
      const updatedEntries = prev.dailyEntries.map((entry: any) => {
        if (entry.day === day) {
          const currentCategoryHours = (entry as any).categoryHours || {};
          const oldValue = currentCategoryHours[category] || 0;
          const updatedCategoryHours = {
            ...currentCategoryHours,
            [category]: value
          };
          // Recalculate total hours for the day
          const newTotalHours = (entry.hoursWorked || 0) - oldValue + value;
          return {
            ...entry,
            categoryHours: updatedCategoryHours,
            hoursWorked: newTotalHours
          };
        }
        return entry;
      });
      return {
        ...prev,
        dailyEntries: updatedEntries
      };
    });
    
    // Validate daily hours limit
    if (value > 24) {
      alert('Cannot enter more than 24 hours in a single day');
      return;
    }
    
    // Map category names to the correct format
    const categoryMap: { [key: string]: string } = {
      'G&A': 'G&A',
      'Holiday': 'Holiday',
      'PTO': 'PTO',
      'STD/LTD': 'STD/LTD',
      'PFL/PFML': 'PFL/PFML'
    };
    
    const mappedCategory = categoryMap[category] || category;
    const actualCostCenter = ''; // Category rows don't belong to specific cost centers
    
    debugLog('🔍 NEW APPROACH: Saving category cell');
    debugLog(`  Day: ${day}, Category: ${category}, Mapped: ${mappedCategory}, Value: ${value}`);
    debugLog(`  Cost Center: "${actualCostCenter}" (empty for categories)`);
    
    // Save to time tracking API with correct category
    try {
      const dateStr = `${currentYear}-${currentMonth.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
      
      // First, check if an entry already exists for this day and category
      const checkResponse = await fetch(`${API_BASE_URL}/api/time-tracking?employeeId=${employeeData.employeeId}&month=${currentMonth}&year=${currentYear}`);
      let existingEntry = null;
      
      if (checkResponse.ok) {
        const allEntries = await checkResponse.json();
        // Find entry for this specific day and category
        // Use local date parsing to avoid timezone issues
        existingEntry = allEntries.find((entry: any) => {
          const entryDateStr = typeof entry.date === 'string' ? entry.date.split('T')[0] : entry.date;
          const [entryYear, entryMonth, entryDay] = entryDateStr.split('-').map(Number);
          return entryDay === day && 
                 entryMonth === currentMonth && 
                 entryYear === currentYear &&
                 entry.category === mappedCategory &&
                 (!entry.costCenter || entry.costCenter === '');
        });
      }
      
      const requestBody = {
          employeeId: employeeData.employeeId,
          date: dateStr,
          hours: value,
          category: mappedCategory,
          description: `${mappedCategory} hours worked on ${dateStr}`,
          costCenter: actualCostCenter
      };
      
      debugLog(`📤 Saving to time tracking API:`, requestBody);
      debugLog(`🔍 Existing entry found:`, existingEntry);
      
      // If value is 0, delete the entry if it exists
      if (value === 0) {
        if (existingEntry) {
          debugLog(`🗑️ Deleting time tracking entry (0 hours):`, existingEntry.id);
          const deleteResponse = await fetch(`${API_BASE_URL}/api/time-tracking/${existingEntry.id}`, {
            method: 'DELETE',
          });
          
          if (!deleteResponse.ok) {
            // If entry doesn't exist (404), that's fine - it's already deleted
            // Only throw error for other status codes
            if (deleteResponse.status === 404) {
              debugLog(`ℹ️ Entry ${existingEntry.id} already deleted (404) - continuing`);
            } else {
              const errorText = await deleteResponse.text();
              debugError(`❌ Failed to delete time tracking: ${deleteResponse.status} - ${errorText}`);
              // Revert optimistic update on error
              refreshTimesheetData(employeeData).catch(() => {});
              throw new Error(`Failed to delete: ${deleteResponse.status}`);
            }
          } else {
            debugLog(`✅ Deleted time tracking entry for day ${day}`);
          }
        } else {
          debugLog(`ℹ️ Value is 0 and no existing entry found - nothing to delete`);
        }
      } else if (value > 0) {
        // Use PUT if entry exists, POST if it doesn't (POST will use INSERT OR REPLACE with deterministic ID)
        const response = existingEntry 
          ? await fetch(`${API_BASE_URL}/api/time-tracking/${existingEntry.id}`, {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(requestBody),
            })
          : await fetch(`${API_BASE_URL}/api/time-tracking`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(requestBody),
            });
        
        if (!response.ok) {
          const errorText = await response.text();
          debugError(`❌ Failed to save time tracking: ${response.status} - ${errorText}`);
          throw new Error(`Failed to save: ${response.status}`);
        }
        
        const result = await response.json();
        debugLog(`✅ Saved ${value} hours as "${mappedCategory}" for "${actualCostCenter}" on day ${day}. Response:`, result);
      } else {
        // Value is 0 and no existing entry - nothing to do
        debugLog(`ℹ️ Value is 0 and no existing entry - nothing to save`);
      }
    } catch (error) {
      debugError('❌ Error saving category hours to time tracking API:', error);
      alert(`Failed to save hours: ${error instanceof Error ? error.message : 'Unknown error'}`);
      // Revert optimistic update on error
      refreshTimesheetData(employeeData).catch(() => {});
      return; // Don't continue if save failed
    }
    
    // Clear editing state
    setEditingCategoryCell(null);
    setEditingCategoryValue('');
    
    // REMOVED: Automatic refresh after save
    // Same reasoning as handleTimesheetCellSave - optimistic update already shows correct value
    // Refreshing immediately can overwrite the optimistic update before backend processes the save
    // Data will be refreshed naturally on next page navigation or explicit refresh
  };

  // Cancel category cell edit
  const handleCategoryCellCancel = () => {
    setEditingCategoryCell(null);
    setEditingCategoryValue('');
  };

  const buildReportData = (overrides: Record<string, unknown> = {}) => {
    if (!employeeData) return null;
    
    // Normalize all dates in dailyDescriptions array to ensure consistent YYYY-MM-DD format
    // Filter to only include descriptions for the current month/year being saved
    // This prevents descriptions from other months from being saved to wrong dates
    const normalizedDailyDescriptions = dailyDescriptions
      .map((desc: any) => ({
        ...desc,
        date: normalizeDate(desc.date) // Ensure all dates are in YYYY-MM-DD format
      }))
      .filter((desc: any) => {
        // Only include descriptions for the current month/year
        const descDate = new Date(desc.date);
        const descMonth = descDate.getMonth() + 1; // getMonth() returns 0-11
        const descYear = descDate.getFullYear();
        return descMonth === currentMonth && descYear === currentYear;
      });
    
    return {
      ...employeeData,
      receipts: receipts,
      dailyDescriptions: normalizedDailyDescriptions,
      employeeSignature: signatureImage,
      supervisorSignature: supervisorSignatureState,
      employeeCertificationAcknowledged: employeeCertificationAcknowledged,
      supervisorCertificationAcknowledged: supervisorCertificationAcknowledged,
      ...overrides,
    };
  };

  const syncReportData = async (overrides: Record<string, unknown> = {}) => {
    if (!employeeData) return;
    const reportData = buildReportData(overrides);
    if (!reportData) return;

    const response = await fetch(`${API_BASE_URL}/api/expense-reports/sync-to-source`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        employeeId: employeeData.employeeId,
        month: currentMonth,
        year: currentYear,
        reportData: reportData,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(`Failed to sync report data: ${errorData.error || errorData.message || 'Unknown error'}`);
    }
  };

  // Handle signature file upload
  const handleSignatureUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type === 'image/png') {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const result = e.target?.result as string;
        // Signature uploaded successfully
        setSignatureImage(result);
        setSavedSignature(result); // Also save as the saved signature
        setSignatureDialogOpen(false);
        
        // Auto-save signature to expense report
        if (employeeData) {
          try {
            await syncReportData({ employeeSignature: result });
            
            // Update employeeData for status indicator
            setEmployeeData({ ...employeeData, employeeSignature: result } as any);
            
            debugVerbose('✅ Signature upload synced to expense report');
            
            // Also save to user settings in the backend
            await fetch(`${API_BASE_URL}/api/employees/${employeeData.employeeId}`, {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                signature: result
              }),
            });
            
            debugLog('✅ Signature saved to user settings');
            showSuccess('Signature saved to Settings and applied to this report');
          } catch (error) {
            debugError('Error saving signature:', error);
            showError('Failed to save signature');
          }
        }
      };
      reader.readAsDataURL(file);
    } else {
      alert('Please upload a PNG file only.');
    }
  };

  // Handle supervisor signature upload
  const handleSupervisorSignatureUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type === 'image/png') {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const result = e.target?.result as string;
        // Supervisor signature uploaded successfully
        setSupervisorSignatureState(result);
        setSupervisorSignatureDialogOpen(false);
        setSupervisorCertificationAcknowledged(true); // Auto-check the checkbox when signature is uploaded
        
        // Auto-save supervisor signature to expense report
        if (employeeData) {
          try {
            await syncReportData({ 
              supervisorSignature: result,
              supervisorCertificationAcknowledged: true,
            });
            
            debugVerbose('✅ Supervisor signature upload synced to expense report');
            showSuccess('Supervisor signature saved and acknowledgment checked');
          } catch (error) {
            debugError('Error saving supervisor signature:', error);
            showError('Failed to save supervisor signature');
          }
        }
      };
      reader.readAsDataURL(file);
    } else {
      alert('Please upload a PNG file only.');
    }
  };

  // Remove signature
  const handleRemoveSignature = async () => {
    setSignatureImage(null);
    // Don't clear savedSignature - user may want to re-import it later
    
    // Auto-save signature removal
    if (employeeData) {
      try {
        await syncReportData({ employeeSignature: null });
        
        // Update employeeData for status indicator
        setEmployeeData({ ...employeeData, employeeSignature: null } as any);
        
        debugVerbose('✅ Signature removal synced to expense report');
        setSignatureDialogOpen(false);
        showSuccess('Signature removed from this report');
      } catch (error) {
        debugError('Error removing signature:', error);
        showError('Failed to remove signature');
      }
    }
  };

  // Handle receipt image upload
  const handleReceiptImageUpload = async (receiptId: string, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && (file.type.startsWith('image/') || file.type === 'application/pdf')) {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const result = e.target?.result as string;
        // Update the receipt with the new file
        const updatedReceipts = receipts.map(receipt => 
          receipt.id === receiptId 
            ? { ...receipt, imageUri: result }
            : receipt
        );
        setReceipts(updatedReceipts);
        
        // Update employeeData for status indicator
        if (employeeData) {
          setEmployeeData({ ...employeeData, receipts: updatedReceipts } as any);
        }
        
        // Save to backend
        try {
          // Update receipt in backend
          const receipt = updatedReceipts.find(r => r.id === receiptId);
          if (receipt) {
            const response = await fetch(`${API_BASE_URL}/api/receipts/${receiptId}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                ...receipt,
                imageUri: result
              })
            });
            
            if (response.ok) {
              // Also save to expense report table for persistence
              await syncReportData();
            }
          }
        } catch (error) {
          debugError('Error saving receipt image:', error);
        }
      };
      reader.readAsDataURL(file);
    } else {
      alert('Please upload an image file or PDF.');
    }
  };

  // Report Completeness Checker
  const handleCheckCompleteness = async () => {
    if (!employeeData) return;
    
    setCompletenessLoading(true);
    setCompletenessDialogOpen(true);
    
    try {
      const report = await ReportCompletenessService.analyzeReportCompleteness(
        employeeData.employeeId,
        currentMonth,
        currentYear
      );
      
      setCompletenessReport(report);
    } catch (error) {
      debugError('Error checking report completeness:', error);
      // Show error state
      setCompletenessReport({
        employeeId: employeeData.employeeId,
        month: currentMonth,
        year: currentYear,
        overallScore: 0,
        issues: [{
          id: 'error-analysis',
          type: 'missing_odometer',
          severity: 'critical',
          title: 'Analysis Error',
          description: `Failed to analyze report completeness: ${error instanceof Error ? error.message : 'Unknown error'}`,
          suggestion: 'Please check your data and try again',
          category: 'System Error'
        }],
        recommendations: ['Error analyzing report completeness'],
        isReadyForSubmission: false
      });
    } finally {
      setCompletenessLoading(false);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return '#d32f2f';
      case 'high': return '#f57c00';
      case 'medium': return '#fbc02d';
      case 'low': return '#388e3c';
      default: return '#666';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical': return '🚨';
      case 'high': return '⚠️';
      case 'medium': return '⚡';
      case 'low': return 'ℹ️';
      default: return '📋';
    }
  };

  // PDF Generation Functions
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async function generateApprovalCoverSheet(pdf: any, data: EmployeeExpenseData, isFirstPage: boolean) {
    // Generating Approval Cover Sheet
    
    // Header with grey background box - moved up 5mm
    pdf.setFillColor(200, 200, 200);
    pdf.rect(20, 15, 170, 15, 'F');
    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(0, 0, 0);
    pdf.text('MONTHLY EXPENSE REPORT APPROVAL COVER SHEET', 25, 25);
    
    // Company information - moved up 5mm
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'bold');
    pdf.text('OXFORD HOUSE, INC.', 20, 45);
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    pdf.text('1010 Wayne Ave. Suite # 300', 20, 53);
    pdf.text('Silver Spring, MD 20910', 20, 61);
    
    // Employee Info section with horizontal lines - moved up 5mm, labels moved up 2mm
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    pdf.text('Name:', 20, 80);
    pdf.line(35, 80, 100, 80);
    pdf.text(data.name, 36, 79); // Moved down by 1mm
    
    pdf.text('Month:', 120, 80);
    pdf.line(140, 80, 180, 80);
    pdf.text(`${data.month}, ${data.year}`, 141, 79); // Moved down by 1mm
    
    pdf.text('Date Completed:', 20, 95);
    pdf.line(60, 95, 100, 95);
    pdf.text(data.dateCompleted, 61, 94); // Moved down by 1mm
    
    // Employee Signature - moved up 5mm, label moved up 2mm
    pdf.text('Signature:', 20, 110);
    pdf.line(50, 110, 120, 110);
    if (signatureImage) {
      try {
        const img = new Image();
        img.onload = () => {
          const imgWidth = 60;
          const imgHeight = 20;
          pdf.addImage(signatureImage, 'PNG', 51, 105, imgWidth, imgHeight);
        };
        img.src = signatureImage;
      } catch (error) {
        pdf.text('Signature uploaded', 51, 110);
      }
    }
    
    // Certification text - moved up 5mm
    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'normal');
    const certificationText = 'By signing and submitting this report to Oxford House, Inc., I certify under penalty of perjury that the pages herein document genuine, valid, and necessary expenditures as well as an accurate record of my time and travel on behalf of Oxford House, Inc.';
    pdf.text(certificationText, 20, 125, { maxWidth: 170 });
    
    // Cost Centers section - moved up 5mm, tightened by 5mm vertically
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'bold');
    pdf.text('COST CENTERS:', 120, 145);
    
    // Cost center lines - moved up 5mm, tightened by 5mm vertically
    for (let i = 0; i < 5; i++) {
      const yPos = 150 + (i * 6); // Reduced to 6mm spacing
      pdf.text(`${i + 1}.)`, 120, yPos);
      pdf.line(135, yPos, 180, yPos);
      if (data.costCenters[i]) {
        pdf.text(data.costCenters[i], 136, yPos - 1); // Moved up by 1mm for PS-Unfunded
      } else {
        pdf.text('[N/A]', 136, yPos - 1); // Moved up by 1mm for [N/A] entries
      }
    }
    
    // Notes section - moved up 5mm
    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'normal');
    const notes = [
      '*Note: signatures are also required on both the Summary Sheet and the Timesheet.',
      '*Note: in order to be reimbursed for any purchase, the receipt must be included. All attached receipts should include the description of purchase, date, and amount circled or highlighted.',
      '*Note: in order to qualify for per diem, your daily work activities must entail your having been away from home for a minimum of eight hours,',
      'as documented in your Travel Descriptions. Additional requirements, such as staying away from your BA overnight, may also be made at any time.'
    ];
    
    let yPos = 215;
    notes.forEach(note => {
      pdf.text(note, 20, yPos, { maxWidth: 170 });
      yPos += 8;
    });
    
    // Signatures of Approval section with border - moved up 5mm
    pdf.setDrawColor(0, 0, 0);
    pdf.rect(20, 255, 170, 40);
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Signatures of Approval:', 25, 265);
    
    // Direct Supervisor
    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'normal');
    pdf.text('Direct Supervisor', 25, 275);
    pdf.line(25, 280, 80, 280);
    pdf.text('Date', 85, 275);
    pdf.line(100, 280, 120, 280);
    
    // Finance Department
    pdf.text('Finance Department', 25, 290);
    pdf.line(25, 295, 80, 295);
    pdf.text('Date', 85, 290);
    pdf.line(100, 295, 120, 295);
    
    // Approval Cover Sheet generated
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async function generateSummarySheet(pdf: any, data: EmployeeExpenseData) {
    // Generating Summary Sheet
    debugLog('🔧 generateSummarySheet called with updated alignment logic');
    
    // Header (moved up by 10mm)
    pdf.setFontSize(16);
    pdf.setFont('helvetica', 'bold');
    pdf.text('MONTHLY EXPENSE REPORT SUMMARY SHEET', 20, 15);
    
    
    // Employee Info with horizontal lines (Name on separate line)
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    
    // Name on its own line
    pdf.text('Name:', 20, 30);
    pdf.line(35, 30, 100, 30);
    pdf.text(data.name, 36, 29);
    
    // Date Completed and Month on the next line with regular spacing
    pdf.text('Date Completed:', 20, 40);
    pdf.line(60, 40, 100, 40);
    pdf.text(data.dateCompleted, 61, 39);
    
    pdf.text('Month:', 120, 40);
    pdf.line(140, 40, 180, 40);
    pdf.text(`${data.month}, ${data.year}`, 141, 39);
    
    // Table structure - 7 columns total (reduced by 10% total)
    const headerY = 50; // Adjusted for new header layout
    const rowHeight = 4.5; // Made smaller to fit more content
    
    // Column widths (7 columns total) - reduced by 10% total
    const colWidths = [31.5, 22.5, 22.5, 22.5, 22.5, 22.5, 27]; // Reduced by 10% total
    const totalTableWidth = colWidths.reduce((sum, width) => sum + width, 0);
    
    // Center the table on the page (letter size landscape: 279mm wide)
    const pageWidth = 279; // Letter size landscape width
    const tableStartX = (pageWidth - totalTableWidth) / 2;
    
    // Draw table grid
    pdf.setDrawColor(0, 0, 0);
    pdf.setLineWidth(0.1);
    
    // Header row 1 - Cost Center headers
    pdf.setFillColor(173, 216, 230);
    pdf.rect(tableStartX, headerY, totalTableWidth, rowHeight, 'F');
    
    // Draw vertical lines for all columns
    let currentX = tableStartX;
    for (let i = 0; i <= colWidths.length; i++) {
      pdf.line(currentX, headerY, currentX, headerY + rowHeight);
      if (i < colWidths.length) currentX += colWidths[i];
    }
    
    // Draw horizontal line
    pdf.line(tableStartX, headerY, tableStartX + totalTableWidth, headerY);
    pdf.line(tableStartX, headerY + rowHeight, tableStartX + totalTableWidth, headerY + rowHeight);
    
    // Header text - Cost Center #1 through #5, SUBTOTALS (made smaller to fit more content)
    pdf.setFontSize(6.5); // Made smaller to fit more content
    pdf.setFont('helvetica', 'bold');
    let textX = tableStartX + colWidths[0] + 2; // Start after expense label column
    pdf.text('Cost Center #1', textX, headerY + 3);
    textX += colWidths[1];
    pdf.text('Cost Center #2', textX, headerY + 3);
    textX += colWidths[2];
    pdf.text('Cost Center #3', textX, headerY + 3);
    textX += colWidths[3];
    pdf.text('Cost Center #4', textX, headerY + 3);
    textX += colWidths[4];
    pdf.text('Cost Center #5', textX, headerY + 3);
    textX += colWidths[5];
    pdf.text('SUBTOTALS', textX, headerY + 2);
    pdf.setFontSize(6.5); // Match column header font size
    pdf.text('(by category)', textX, headerY + 4);
    pdf.setFontSize(6.5); // Keep consistent size
    
    // Header row 2 - Cost Center names
    const header2Y = headerY + rowHeight;
    pdf.rect(tableStartX, header2Y, totalTableWidth, rowHeight, 'F');
    
    // Draw vertical lines for all columns
    currentX = tableStartX;
    for (let i = 0; i <= colWidths.length; i++) {
      pdf.line(currentX, header2Y, currentX, header2Y + rowHeight);
      if (i < colWidths.length) currentX += colWidths[i];
    }
    
    // Draw horizontal lines
    pdf.line(tableStartX, header2Y, tableStartX + totalTableWidth, header2Y);
    pdf.line(tableStartX, header2Y + rowHeight, tableStartX + totalTableWidth, header2Y + rowHeight);
    
    // Header text - Cost Center names (made smaller to fit more content)
    pdf.setFontSize(5.5); // Made smaller to fit more content
    pdf.setFont('helvetica', 'bold');
    textX = tableStartX + colWidths[0] + 2; // Start after expense label column
    pdf.text(data.costCenters[0] || '[N/A]', textX, header2Y + 3);
    textX += colWidths[1];
    pdf.text('[N/A]', textX, header2Y + 3);
    textX += colWidths[2];
    pdf.text('[N/A]', textX, header2Y + 3);
    textX += colWidths[3];
    pdf.text('[N/A]', textX, header2Y + 3);
    textX += colWidths[4];
    pdf.text('[N/A]', textX, header2Y + 3);
    textX += colWidths[5];
    // SUBTOTALS column is empty in second header row
    
    // Helper function to draw a table row
    const drawTableRow = (y: number, label: string, values: number[], bgColor: number[]) => {
      // Fill background
      pdf.setFillColor(bgColor[0], bgColor[1], bgColor[2]);
      pdf.rect(tableStartX, y, totalTableWidth, rowHeight, 'F');
      
      // Draw grid lines
      currentX = tableStartX;
      for (let i = 0; i <= colWidths.length; i++) {
        pdf.line(currentX, y, currentX, y + rowHeight);
        if (i < colWidths.length) currentX += colWidths[i];
      }
      pdf.line(tableStartX, y, tableStartX + totalTableWidth, y);
      pdf.line(tableStartX, y + rowHeight, tableStartX + totalTableWidth, y + rowHeight);
      
      // Add text (made smaller to fit more content)
      pdf.setFontSize(5.5); // Made smaller to fit more content
      pdf.setFont('helvetica', 'bold');
      pdf.text(label, tableStartX + 2, y + 3);
      
      pdf.setFont('helvetica', 'normal');
      textX = tableStartX + colWidths[0] + 2;
      for (let i = 0; i < values.length; i++) {
        pdf.text(`$${values[i].toFixed(2)}`, textX, y + 3);
        textX += colWidths[i + 1];
      }
    };
    
    // TRAVEL EXPENSES section
    let yPos = header2Y + rowHeight + 5;
    
    // Section header (made smaller to fit more content)
    pdf.setFillColor(173, 216, 230);
    pdf.rect(tableStartX, yPos, totalTableWidth, rowHeight, 'F');
    pdf.setFontSize(7); // Made smaller to fit more content
    pdf.setFont('helvetica', 'bold');
    pdf.text('TRAVEL EXPENSES', tableStartX + 2, yPos + 3);
    
    // Travel note removed as requested
    
    // Travel expense rows (7 rows total)
    const travelExpenses = [
      { label: 'MILEAGE', value: data.totalMileageAmount },
      { label: 'Air / Rail / Bus', value: data.airRailBus },
      { label: 'Vehicle Rental / Fuel', value: data.vehicleRentalFuel },
      { label: 'Parking / Tolls', value: data.parkingTolls },
      { label: 'Ground Transportation', value: data.groundTransportation },
      { label: 'Lodging', value: data.hotelsAirbnb },
      { label: 'Per Diem', value: data.perDiem }
    ];
    
    travelExpenses.forEach(expense => {
      const values = [expense.value, 0, 0, 0, 0, expense.value]; // Cost Center #1, #2-5, Subtotal
      drawTableRow(yPos, expense.label, values, [144, 238, 144]); // Light green
      yPos += rowHeight;
    });
    
    // OTHER EXPENSES section (3 rows total) - removed gap
    
    // Section header
    pdf.setFillColor(173, 216, 230);
    pdf.rect(tableStartX, yPos, totalTableWidth, rowHeight, 'F');
    pdf.setFontSize(7); // Made smaller to fit more content
    pdf.setFont('helvetica', 'bold');
    pdf.text('Other Expenses', tableStartX + 2, yPos + 3);
    
    yPos += rowHeight;
    
    // Other expense rows (3 rows total)
    const otherExpenses = [
      { label: 'OXFORD HOUSE E.E.S.', value: 0 },
      { label: '', value: 0 }, // Blank row
      { label: '', value: 0 }  // Blank row
    ];
    
    otherExpenses.forEach(expense => {
      const values = [expense.value, 0, 0, 0, 0, expense.value]; // All $0.00
      drawTableRow(yPos, expense.label, values, [255, 218, 185]); // Light orange
      yPos += rowHeight;
    });
    
    // COMMUNICATIONS section (3 rows total) - removed gap
    
    // Section header (made smaller to fit more content)
    pdf.setFillColor(173, 216, 230);
    pdf.rect(tableStartX, yPos, totalTableWidth, rowHeight, 'F');
    pdf.setFontSize(7); // Made smaller to fit more content
    pdf.setFont('helvetica', 'bold');
    pdf.text('Communications', tableStartX + 2, yPos + 3);
    
    yPos += rowHeight;
    
    // Communications expense rows (3 rows total)
    const communications = [
      { label: 'Phone / Internet / Fax', value: data.phoneInternetFax },
      { label: 'Postage / Shipping', value: data.shippingPostage },
      { label: 'Printing / Copying', value: data.printingCopying }
    ];
    
    communications.forEach(comm => {
      const values = [comm.value, 0, 0, 0, 0, comm.value]; // Cost Center #1, #2-5, Subtotal
      drawTableRow(yPos, comm.label, values, [255, 218, 185]); // Light orange
      yPos += rowHeight;
    });
    
    // SUPPLIES section (2 rows total) - removed gap
    
    // Section header (made smaller to fit more content)
    pdf.setFillColor(173, 216, 230);
    pdf.rect(tableStartX, yPos, totalTableWidth, rowHeight, 'F');
    pdf.setFontSize(7); // Made smaller to fit more content
    pdf.setFont('helvetica', 'bold');
    pdf.text('Supplies', tableStartX + 2, yPos + 3);
    
    yPos += rowHeight;
    
    // Supplies expense rows (2 rows total)
    const supplies = [
      { label: 'Outreach Supplies', value: 0 },
      { label: '', value: 0 } // Blank row
    ];
    
    supplies.forEach(supply => {
      const values = [supply.value, 0, 0, 0, 0, supply.value]; // All $0.00
      drawTableRow(yPos, supply.label, values, [255, 218, 185]); // Light orange
      yPos += rowHeight;
    });
    
    // Calculate totals
    const totalOtherExpenses = (data.otherExpenses || []).reduce((sum, e) => sum + e.amount, 0);
    const totalExpenses = data.totalMileageAmount + data.airRailBus + data.vehicleRentalFuel + 
                         data.parkingTolls + data.groundTransportation + data.hotelsAirbnb + 
                         data.perDiem + data.phoneInternetFax + data.shippingPostage + 
                         data.printingCopying + data.officeSupplies + data.eesReceipt + 
                         totalOtherExpenses;
    
    // Summary section
    yPos += 5;
    
    // SUBTOTALS (by cost center) row
    const subtotalValues = [totalExpenses, 0, 0, 0, 0, totalExpenses];
    drawTableRow(yPos, 'SUBTOTALS (by cost center)', subtotalValues, [144, 238, 144]); // Light green
    yPos += rowHeight;
    
    // Less Cash Advance row
    const cashAdvanceValues = [0, 0, 0, 0, 0, 0];
    drawTableRow(yPos, 'Less Cash Advance', cashAdvanceValues, [255, 218, 185]); // Light orange
    yPos += rowHeight;
    
    // GRAND TOTAL REQUESTED - separate 2-cell block aligned to the right
    yPos += 5; // Add some space below Less Cash Advance
    
    // Calculate position for the 2-cell block (right-aligned)
    // Make the text cell twice the size to fit "GRAND TOTAL REQUESTED"
    const grandTotalTextWidth = colWidths[5] * 2; // Double the size of Cost Center #5 column
    const grandTotalValueWidth = colWidths[6]; // SUBTOTALS column
    const grandTotalBlockWidth = grandTotalTextWidth + grandTotalValueWidth;
    // Right-align the block by calculating from the right edge
    const grandTotalBlockX = tableStartX + totalTableWidth - grandTotalBlockWidth;
    
    // Draw the 2-cell block background
    pdf.setFillColor(173, 216, 230); // Light blue background
    pdf.rect(grandTotalBlockX, yPos, grandTotalBlockWidth, rowHeight, 'F');
    
    // Draw borders for the 2-cell block
    pdf.setDrawColor(0, 0, 0);
    pdf.setLineWidth(0.1);
    pdf.line(grandTotalBlockX, yPos, grandTotalBlockX + grandTotalBlockWidth, yPos); // Top
    pdf.line(grandTotalBlockX, yPos + rowHeight, grandTotalBlockX + grandTotalBlockWidth, yPos + rowHeight); // Bottom
    pdf.line(grandTotalBlockX, yPos, grandTotalBlockX, yPos + rowHeight); // Left
    pdf.line(grandTotalBlockX + grandTotalTextWidth, yPos, grandTotalBlockX + grandTotalTextWidth, yPos + rowHeight); // Middle divider
    pdf.line(grandTotalBlockX + grandTotalBlockWidth, yPos, grandTotalBlockX + grandTotalBlockWidth, yPos + rowHeight); // Right
    
    // Add text to the 2-cell block (right-aligned)
    pdf.setFontSize(6); // Reduced by 1 font point (from 7 to 6)
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(0, 0, 0); // Black text
    // Right-align the text within the text cell
    const textWidth = pdf.getTextWidth('GRAND TOTAL REQUESTED');
    pdf.text('GRAND TOTAL REQUESTED', grandTotalBlockX + grandTotalTextWidth - textWidth - 2, yPos + 4);
    pdf.text(`$${totalExpenses.toFixed(2)}`, grandTotalBlockX + grandTotalTextWidth + 2, yPos + 4);
    
    // Footer section - moved back to left side to fit on one page
    yPos += 10; // Reduced spacing
    pdf.setFontSize(7); // Made smaller to fit more content
    pdf.setFont('helvetica', 'normal');
    // Position on the left side of the page
    const payableToX = tableStartX; // Left side positioning
    pdf.text('Payable to:', payableToX, yPos);
    pdf.line(payableToX + 30, yPos, payableToX + 100, yPos);
    pdf.text(data.name, payableToX + 31, yPos - 1); // Moved up by 1mm
    
    // Add base address fields
    yPos += 8; // Small spacing
    pdf.text('Base Address:', payableToX, yPos);
    pdf.line(payableToX + 30, yPos, payableToX + 100, yPos);
    
    yPos += 6; // Small spacing
    pdf.text('City, State ZIP:', payableToX, yPos);
    pdf.line(payableToX + 30, yPos, payableToX + 100, yPos);
    
    // Summary Sheet generated
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  function generateCostCenterSheet(pdf: any, data: EmployeeExpenseData, costCenter: string, index: number) {
    // Generating Cost Center Sheet - Compact layout to fit all days on one page
    
    // Header
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'bold');
    pdf.text('TRAVEL DESCRIPTIONS', 20, 20);
    
    // Employee Info - compact layout
    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'normal');
    pdf.text('Name:', 20, 30);
    pdf.line(35, 30, 100, 30);
    pdf.text(data.name, 36, 29);
    
    pdf.text('Cost Center:', 20, 35);
    pdf.line(50, 35, 100, 35);
    pdf.text(costCenter, 51, 34);
    
    pdf.text('Month:', 120, 30);
    pdf.line(140, 30, 180, 30);
    pdf.text(`${data.month} ${data.year}`, 141, 29);
    
    pdf.text('Date:', 120, 35);
    pdf.line(140, 35, 180, 35);
    pdf.text(data.dateCompleted, 141, 34);
    
    pdf.text('Mileage Rate:', 20, 40);
    pdf.text('$0.445', 60, 40);
    pdf.line(60, 41, 80, 41); // Underline the mileage rate
    
    // Instructions - compact
    pdf.setFontSize(6);
    pdf.setFont('helvetica', 'normal');
    pdf.text('Enter locations, full physical addresses (in parentheses), and brief description of all work-related travel. Also, list any work done from BA or current location.', 20, 45, { maxWidth: 170 });
    
    // Table Headers - compact layout
    const headerY = 55;
    const headerRowHeight = 6; // Reduced header row height by 3mm (from 9 to 6)
    const rowHeight = 4; // Data row height
    const colWidths = [17, 50, 13, 15, 15, 13, 15, 13, 13, 13, 13, 13, 13]; // Compact column widths (removed extra column)
    const totalTableWidth = colWidths.reduce((sum, width) => sum + width, 0);
    
    // Center the table
    const pageWidth = 279; // Letter size landscape width
    const tableStartX = (pageWidth - totalTableWidth) / 2;
    
    // Draw header row background and borders
    pdf.setFillColor(240, 240, 240);
    pdf.rect(tableStartX, headerY, totalTableWidth, headerRowHeight, 'F');
    pdf.setDrawColor(0, 0, 0);
    pdf.setLineWidth(0.1);
    pdf.rect(tableStartX, headerY, totalTableWidth, headerRowHeight);
    
    // Draw vertical gridlines for header row
    let lineX = tableStartX;
    for (let i = 0; i < colWidths.length; i++) {
      lineX += colWidths[i];
      pdf.line(lineX, headerY, lineX, headerY + headerRowHeight);
    }
    
    // Header text - two rows for better organization
    pdf.setFontSize(6);
    pdf.setFont('helvetica', 'bold');
    let headerX = tableStartX + 1;
    
    // First row - main headers
    const mainHeaders = [
      'DATE', 'Description/Activity', 'Hours', 'Odometer', 'Odometer', 
      'Miles', 'Mileage ($)', 'Air/Rail', 'Vehicle', 'Parking', 'Ground', 'Lodging', 'Per Diem'
    ];
    
    mainHeaders.forEach((header, i) => {
      pdf.text(header, headerX, headerY + 2);
      headerX += colWidths[i];
    });
    
    // Second row - sub-headers for Odometer columns
    headerX = tableStartX + 1;
    const subHeaders = [
      '', '', '', 'Start', 'End', 
      '', '', '', '', '', '', ''
    ];
    
    subHeaders.forEach((subHeader, i) => {
      if (subHeader) {
        pdf.setFontSize(5);
        pdf.text(subHeader, headerX, headerY + 4);
      }
      headerX += colWidths[i];
    });
    
    // Instructions below headers
    pdf.setFontSize(4);
    pdf.setFont('helvetica', 'normal');
    pdf.text('Attach all receipts with description of purchase, date & amount circled.', tableStartX + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + colWidths[4] + colWidths[5] + colWidths[6], headerY + 8);
    pdf.text('*$35 max/day', tableStartX + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + colWidths[4] + colWidths[5] + colWidths[6] + colWidths[7] + colWidths[8] + colWidths[9] + colWidths[10] + colWidths[11], headerY + 8);
    
    // Table data - all days of the month
    let tableY = headerY + headerRowHeight + 10;
    
    // Convert month name to number
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                       'July', 'August', 'September', 'October', 'November', 'December'];
    const monthNumber = monthNames.indexOf(data.month) + 1;
    const daysInMonth = new Date(data.year, monthNumber - 1, 0).getDate();
    
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${monthNumber.toString().padStart(2, '0')}/${day.toString().padStart(2, '0')}/${data.year.toString().slice(-2)}`;
      const entry = data.dailyEntries.find(e => e.date === dateStr);
      
      // Draw row background
      if (day % 2 === 0) {
        pdf.setFillColor(248, 248, 248);
        pdf.rect(tableStartX, tableY - 2, totalTableWidth, rowHeight, 'F');
      }
      
      // Draw row borders
      pdf.setDrawColor(0, 0, 0);
      pdf.setLineWidth(0.1);
      pdf.rect(tableStartX, tableY - 2, totalTableWidth, rowHeight);
      
      // Draw vertical lines
      let lineX = tableStartX;
      for (let i = 0; i < colWidths.length; i++) {
        lineX += colWidths[i];
        pdf.line(lineX, tableY - 2, lineX, tableY + rowHeight - 2);
      }
      
      pdf.setFontSize(5);
      pdf.setFont('helvetica', 'normal');
      let dataX = tableStartX + 1;
      
      // Date
      pdf.text(dateStr, dataX, tableY);
      dataX += colWidths[0];
      
      // Description
      const description = entry?.description || '';
      pdf.text(description, dataX, tableY, { maxWidth: colWidths[1] - 1 });
      dataX += colWidths[1];
      
      // Hours Worked - use actual data only
      const hours = entry?.hoursWorked || 0;
      pdf.text(hours.toString(), dataX, tableY);
      dataX += colWidths[2];
      
      // Odometer Start
      const odometerStart = entry?.odometerStart || 0;
      pdf.text(odometerStart.toString(), dataX, tableY);
      dataX += colWidths[3];
      
      // Odometer End
      const odometerEnd = entry?.odometerEnd || 0;
      pdf.text(odometerEnd.toString(), dataX, tableY);
      dataX += colWidths[4];
      
      // Miles Traveled
      const milesTraveled = Math.round(entry?.milesTraveled || 0);
      pdf.text(milesTraveled.toString(), dataX, tableY);
      dataX += colWidths[5];
      
      // Mileage Amount
      const mileageAmount = entry?.mileageAmount || 0;
      pdf.text(`$${mileageAmount.toFixed(2)}`, dataX, tableY);
      dataX += colWidths[6];
      
      // Travel/Transportation categories (all 0.00)
      for (let i = 7; i < 12; i++) {
        pdf.text('0.00', dataX, tableY);
        dataX += colWidths[i];
      }
      
      // Per Diem (highlighted in green if > 0)
      const perDiem = entry?.perDiem || 0;
      if (perDiem > 0) {
        pdf.setFillColor(144, 238, 144);
        pdf.rect(dataX - 1, tableY - 2, colWidths[12], rowHeight, 'F');
      }
      pdf.text(`$${perDiem.toFixed(2)}`, dataX, tableY);
      
      tableY += rowHeight;
    }
    
    // Subtotals - compact layout (reduced gap by 5mm)
    tableY += 0;
    pdf.setFontSize(6);
    pdf.setFont('helvetica', 'bold');
    
    // Draw subtotals row background
    pdf.setFillColor(200, 200, 200);
    pdf.rect(tableStartX, tableY - 2, totalTableWidth, rowHeight, 'F');
    pdf.setDrawColor(0, 0, 0);
    pdf.setLineWidth(0.1);
    pdf.rect(tableStartX, tableY - 2, totalTableWidth, rowHeight);
    
    // Use pre-calculated totals from web portal data
    const totalHours = data.totalHours;
    const totalMiles = data.totalMiles;
    const totalMileageAmount = data.totalMileageAmount;
    const totalPerDiem = data.perDiem;
    
    let subtotalX = tableStartX + 1;
    pdf.text('SUBTOTALS', subtotalX, tableY);
    subtotalX += colWidths[0]; // Move to Description column (empty)
    subtotalX += colWidths[1]; // Move to Hours column
    
    pdf.text(totalHours.toString(), subtotalX, tableY);
    subtotalX += colWidths[2]; // Move to Odometer Start column (empty)
    subtotalX += colWidths[3]; // Move to Odometer End column (empty)
    subtotalX += colWidths[4]; // Move to Miles column
    
    pdf.text(Math.round(totalMiles).toString(), subtotalX, tableY);
    subtotalX += colWidths[5]; // Move to Mileage ($) column
    
    pdf.text(`$${totalMileageAmount.toFixed(2)}`, subtotalX, tableY);
    subtotalX += colWidths[6]; // Move to Air/Rail column
    
    // Travel/Transportation subtotals (all 0.00)
    for (let i = 7; i < 12; i++) {
      pdf.text('0.00', subtotalX, tableY);
      subtotalX += colWidths[i];
    }
    
    pdf.text(`$${totalPerDiem.toFixed(2)}`, subtotalX, tableY);
    
    // Travel Total - stacked vertically to avoid overlap
    tableY += rowHeight + 5;
    const costCenterTravelTotal = totalMileageAmount + totalPerDiem;
    pdf.setFontSize(6);
    pdf.setFont('helvetica', 'bold');
    pdf.text('TRAVEL', tableStartX + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + colWidths[4] + colWidths[5] + colWidths[6] + colWidths[7] + colWidths[8] + colWidths[9] + colWidths[10], tableY);
    pdf.text('TOTAL', tableStartX + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + colWidths[4] + colWidths[5] + colWidths[6] + colWidths[7] + colWidths[8] + colWidths[9] + colWidths[10], tableY + 3);
    pdf.text(`$${costCenterTravelTotal.toFixed(2)}`, tableStartX + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + colWidths[4] + colWidths[5] + colWidths[6] + colWidths[7] + colWidths[8] + colWidths[9] + colWidths[10] + colWidths[11], tableY + 1.5);
    
    // Cost Center Sheet generated
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async function generateTimesheet(pdf: any, data: EmployeeExpenseData) {
    // Generating Timesheet
    
    // Header - moved up 5mm
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'bold');
    pdf.text('OXFORD HOUSE, INC.', 20, 25);
    pdf.text('FY 25/26 TIMESHEET', 20, 35);
    
    // Month/Year in corners - moved up 5mm
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'bold');
    pdf.text(`${data.month}-${data.year.toString().slice(-2)}`, 20, 50);
    pdf.text(`${data.month}-${data.year.toString().slice(-2)}`, 180, 50);
    
    // Employee Info with horizontal lines - reduced gap to 10mm
    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'normal');
    pdf.text('Name:', 20, 65);
    pdf.line(35, 65, 100, 65);
    pdf.text(data.name, 36, 65);
    
    // Cost Centers instruction - reduced gap to 10mm (was 35mm, now 10mm)
    pdf.setFontSize(7);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(255, 0, 0);
    pdf.text('* Selected cost center(s) should appear below. *', 20, 75);
    pdf.setTextColor(0, 0, 0);
    
    // Cost Centers table - adjusted for reduced gap
    const tableY = 85;
    const colWidth = 5.5; // Wider columns for landscape
    const rowHeight = 6;
    
    // Headers with grid lines
    pdf.setFontSize(7);
    pdf.setFont('helvetica', 'bold');
    
    // Draw header row background and borders
    const headerRowHeight = 8;
    const totalTableWidth = (32 * colWidth) + 20; // 31 days + TOTAL column + margin
    pdf.setFillColor(240, 240, 240);
    pdf.rect(20, tableY - 2, totalTableWidth, headerRowHeight, 'F');
    pdf.setDrawColor(0, 0, 0);
    pdf.setLineWidth(0.1);
    pdf.rect(20, tableY - 2, totalTableWidth, headerRowHeight);
    
    // Draw vertical gridlines for header row
    let headerLineX = 20;
    for (let i = 0; i <= 32; i++) {
      headerLineX += colWidth;
      pdf.line(headerLineX, tableY - 2, headerLineX, tableY + headerRowHeight - 2);
    }
    
    pdf.text('DATE OF MONTH', 20, tableY);
    
    // Day numbers 1-31
    for (let day = 1; day <= 31; day++) {
      const xPos = 20 + (day * colWidth);
      pdf.text(day.toString(), xPos, tableY);
    }
    pdf.text('TOTAL', 20 + (32 * colWidth), tableY);
    pdf.text('COST CENTER', 20 + (32 * colWidth), tableY + 4);
    
    // Cost Center rows
    const costCenters = data.costCenters.filter(cc => cc && cc !== '[N/A]');
    const allCostCenters = [...costCenters, ...Array(4 - costCenters.length).fill('[N/A]')];
    
    allCostCenters.forEach((costCenter, ccIndex) => {
      const rowY = tableY + 10 + (ccIndex * rowHeight);
      
      // Draw row background and borders
      if (ccIndex % 2 === 0) {
        pdf.setFillColor(248, 248, 248);
        pdf.rect(20, rowY - 2, totalTableWidth, rowHeight, 'F');
      }
      pdf.setDrawColor(0, 0, 0);
      pdf.setLineWidth(0.1);
      pdf.rect(20, rowY - 2, totalTableWidth, rowHeight);
      
      // Draw vertical gridlines for data rows
      let dataLineX = 20;
      for (let i = 0; i <= 32; i++) {
        dataLineX += colWidth;
        pdf.line(dataLineX, rowY - 2, dataLineX, rowY + rowHeight - 2);
      }
      
      pdf.setFontSize(6);
      pdf.setFont('helvetica', 'bold');
      pdf.text(costCenter, 20, rowY);
      
      // Use pre-calculated data from web portal
      if (ccIndex === 0) { // Only show hours for the first (active) cost center
        // Display daily hours from data
        for (let day = 1; day <= 31; day++) {
          const dateStr = `${data.month.toString().padStart(2, '0')}/${day.toString().padStart(2, '0')}/${data.year.toString().slice(-2)}`;
          const entry = data.dailyEntries.find(e => e.date === dateStr);
          const hours = entry?.hoursWorked || 0;
          
          pdf.setFontSize(5);
          pdf.setFont('helvetica', 'normal');
          const xPos = 20 + (day * colWidth);
          pdf.text(hours.toString(), xPos, rowY);
        }
        
        // Use pre-calculated total
        pdf.setFontSize(6);
        pdf.setFont('helvetica', 'bold');
        pdf.text(data.totalHours.toString(), 20 + (32 * colWidth), rowY);
      } else {
        // Show 0 for inactive cost centers
        for (let day = 1; day <= 31; day++) {
          pdf.setFontSize(5);
          pdf.setFont('helvetica', 'normal');
          const xPos = 20 + (day * colWidth);
          pdf.text('0', xPos, rowY);
        }
        
        pdf.setFontSize(6);
        pdf.setFont('helvetica', 'bold');
        pdf.text('0', 20 + (32 * colWidth), rowY);
      }
    });
    
    // Billable Hours row with grid lines
    const billableRowY = tableY + 10 + (4 * rowHeight) + 5;
    
    // Draw row background and borders
    pdf.setFillColor(200, 200, 200);
    pdf.rect(20, billableRowY - 2, totalTableWidth, rowHeight, 'F');
    pdf.setDrawColor(0, 0, 0);
    pdf.setLineWidth(0.1);
    pdf.rect(20, billableRowY - 2, totalTableWidth, rowHeight);
    
    // Draw vertical gridlines
    let billableLineX = 20;
    for (let i = 0; i <= 32; i++) {
      billableLineX += colWidth;
      pdf.line(billableLineX, billableRowY - 2, billableLineX, billableRowY + rowHeight - 2);
    }
    
    pdf.setFontSize(6);
    pdf.setFont('helvetica', 'bold');
    pdf.text('BILLABLE HOURS', 20, billableRowY);
    
    // Use pre-calculated data from web portal
    for (let day = 1; day <= 31; day++) {
      const dateStr = `${data.month.toString().padStart(2, '0')}/${day.toString().padStart(2, '0')}/${data.year.toString().slice(-2)}`;
      const entry = data.dailyEntries.find(e => e.date === dateStr);
      const hours = entry?.hoursWorked || 0;
      
      pdf.setFontSize(5);
      pdf.setFont('helvetica', 'normal');
      const xPos = 20 + (day * colWidth);
      pdf.text(hours.toString(), xPos, billableRowY);
    }
    
    pdf.setFontSize(6);
    pdf.setFont('helvetica', 'bold');
    pdf.text(data.totalHours.toString(), 20 + (32 * colWidth), billableRowY);
    
    // Categories for Hours instruction
    const categoriesY = billableRowY + 15;
    pdf.setFontSize(7);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(255, 0, 0);
    pdf.text('* If and when applicable, manually enter hours corresponding w/ the categories shown below. *', 20, categoriesY);
    pdf.setTextColor(0, 0, 0);
    
    // Categories table
    const categoriesTableY = categoriesY + 10;
    const timesheetCategories = ['G&A', 'HOLIDAY', 'PTO', 'STD/LTD', 'PFL/PFML'];
    
    timesheetCategories.forEach((category, catIndex) => {
      const rowY = categoriesTableY + (catIndex * rowHeight);
      
      // Draw row background and borders
      if (catIndex % 2 === 0) {
        pdf.setFillColor(248, 248, 248);
        pdf.rect(20, rowY - 2, totalTableWidth, rowHeight, 'F');
      }
      pdf.setDrawColor(0, 0, 0);
      pdf.setLineWidth(0.1);
      pdf.rect(20, rowY - 2, totalTableWidth, rowHeight);
      
      // Draw vertical gridlines
      let categoryLineX = 20;
      for (let i = 0; i <= 32; i++) {
        categoryLineX += colWidth;
        pdf.line(categoryLineX, rowY - 2, categoryLineX, rowY + rowHeight - 2);
      }
      
      pdf.setFontSize(6);
      pdf.setFont('helvetica', 'bold');
      pdf.text(category, 20, rowY);
      
      // All days show 0 for categories
      for (let day = 1; day <= 31; day++) {
        pdf.setFontSize(5);
        pdf.setFont('helvetica', 'normal');
        const xPos = 20 + (day * colWidth);
        pdf.text('0', xPos, rowY);
      }
      
      // Total for this category
      pdf.setFontSize(6);
      pdf.setFont('helvetica', 'bold');
      pdf.text('0', 20 + (32 * colWidth), rowY);
    });
    
    // Daily Totals row with grid lines
    const dailyTotalsY = categoriesTableY + (5 * rowHeight) + 5;
    
    // Draw row background and borders
    pdf.setFillColor(200, 200, 200);
    pdf.rect(20, dailyTotalsY - 2, totalTableWidth, rowHeight, 'F');
    pdf.setDrawColor(0, 0, 0);
    pdf.setLineWidth(0.1);
    pdf.rect(20, dailyTotalsY - 2, totalTableWidth, rowHeight);
    
    // Draw vertical gridlines
    let totalsLineX = 20;
    for (let i = 0; i <= 32; i++) {
      totalsLineX += colWidth;
      pdf.line(totalsLineX, dailyTotalsY - 2, totalsLineX, dailyTotalsY + rowHeight - 2);
    }
    
    pdf.setFontSize(6);
    pdf.setFont('helvetica', 'bold');
    pdf.text('DAILY TOTALS', 20, dailyTotalsY);
    
    for (let day = 1; day <= 31; day++) {
      const dateStr = `${data.month.toString().padStart(2, '0')}/${day.toString().padStart(2, '0')}/${data.year.toString().slice(-2)}`;
      const entry = data.dailyEntries.find(e => e.date === dateStr);
      const hours = entry?.hoursWorked || 0;
      
      pdf.setFontSize(5);
      pdf.setFont('helvetica', 'normal');
      const xPos = 20 + (day * colWidth);
      pdf.text(hours.toString(), xPos, dailyTotalsY);
    }
    
    pdf.setFontSize(6);
    pdf.setFont('helvetica', 'bold');
    pdf.text(data.totalHours.toString(), 20 + (32 * colWidth), dailyTotalsY);
    pdf.text('GRAND TOTAL', 20 + (32 * colWidth), dailyTotalsY + 4);
    
    // Signature section removed for now - will be added back once tables are correct
    
    // Footer - simplified since signature section was removed
    const footerY = dailyTotalsY + 15;
    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'bold');
    pdf.text('OXFORD HOUSE, INC.', 20, footerY);
    pdf.text('FY 25/26 TIMESHEET', 20, footerY + 8);
    
    // Cost Center Hours section with better formatting
    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Cost Center Hours:', 20, 180);
    
    // Cost Center Hours table with borders
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Cost Center', 20, 200);
    pdf.text('Hours', 100, 200);
    
    // Draw table borders
    pdf.setDrawColor(0, 0, 0);
    pdf.setLineWidth(0.3);
    
    let yPos = 210;
    data.costCenters.forEach((center, index) => {
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      pdf.text(`${center}`, 20, yPos);
      pdf.text(`${index === 0 ? data.totalHours : 0}`, 100, yPos);
      yPos += 10;
    });
    
    // Categories Hours section with better formatting
    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Categories Hours:', 20, yPos + 20);
    
    // Categories Hours table with borders
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Category', 20, yPos + 40);
    pdf.text('Hours', 100, yPos + 40);
    
    const timesheetCategories2 = [
      { name: 'Direct Care', hours: 0 },
      { name: 'Administrative', hours: 0 },
      { name: 'Training', hours: 0 },
      { name: 'Travel', hours: 0 },
      { name: 'Other', hours: 0 }
    ];
    
    yPos += 60;
    timesheetCategories2.forEach(category => {
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      pdf.text(category.name, 20, yPos);
      pdf.text(category.hours.toString(), 100, yPos);
      yPos += 10;
    });
    
    // Timesheet generated
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async function generateReceiptManagement(pdf: any, receipts: any[]) {
    // Generating Receipt Management
    
    // Header
    pdf.setFontSize(16);
    pdf.setFont('helvetica', 'bold');
    pdf.text('RECEIPT MANAGEMENT', 20, 30);
    
    if (receipts.length === 0) {
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'normal');
      pdf.text('No receipts uploaded', 20, 50);
      return;
    }
    
    // Receipts table
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Receipt Details:', 20, 50);
    
    let yPos = 65;
    receipts.forEach((receipt, index) => {
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      pdf.text(`${index + 1}. Vendor: ${receipt.vendor}`, 20, yPos);
      pdf.text(`   Amount: $${receipt.amount}`, 20, yPos + 8);
      pdf.text(`   Date: ${receipt.date}`, 20, yPos + 16);
      pdf.text(`   Description: ${receipt.description}`, 20, yPos + 24);
      
      yPos += 35;
      
      // Add receipt image if available
      if (receipt.imageUri && yPos < 250) {
        try {
          // Note: jsPDF doesn't handle base64 images well in this context
          // We'll just indicate that an image exists
          pdf.text('   [Receipt Image Available]', 20, yPos);
          yPos += 10;
        } catch (error) {
          debugWarn('Could not add receipt image:', error);
        }
      }
      
      // Add new page if needed
      if (yPos > 250) {
        pdf.addPage();
        yPos = 20;
      }
    });
    
    // Receipt Management generated
  };

  // Save expense report to backend and sync to source tables
  const handleSaveReport = async () => {
    if (!employeeData) {
      showError('No employee data to save');
      return;
    }

    try {
      startLoading('Saving and syncing report...');
      
      const reportData = {
        ...employeeData,
        receipts: receipts,
        dailyDescriptions: dailyDescriptions,
        employeeSignature: signatureImage,
        supervisorSignature: supervisorSignatureState,
        employeeCertificationAcknowledged: employeeCertificationAcknowledged,
        supervisorCertificationAcknowledged: supervisorCertificationAcknowledged
      };

      // Use the sync endpoint to save AND sync to source tables
      const response = await fetch(`${API_BASE_URL}/api/expense-reports/sync-to-source`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          employeeId: employeeData.employeeId,
          month: currentMonth,
          year: currentYear,
          reportData: reportData
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        debugError('❌ Save error response:', errorData);
        throw new Error(`Failed to save expense report: ${errorData.error || errorData.message || 'Unknown error'}`);
      }

      await response.json();
      
      // Clear API cache to ensure we get fresh data after save
      // This is critical because the API service caches responses for 60 seconds
      const { rateLimitedApi } = await import('./services/rateLimitedApi');
      rateLimitedApi.clearCacheFor('/api/daily-descriptions');
      rateLimitedApi.clearCacheFor('/api/time-tracking');
      rateLimitedApi.clearCacheFor('/api/mileage-entries');
      rateLimitedApi.clearCacheFor('/api/receipts');
      
      // Wait longer to ensure backend processes all deletions before reloading
      // This is especially important for daily descriptions that were deleted
      // Show loading state during the wait
      startLoading('Processing changes...');
      await new Promise(resolve => setTimeout(resolve, 1500)); // Increased to 1.5 seconds
      
      // Refresh the data to update all tabs
      setRefreshTrigger(prev => prev + 1);
      
      showSuccess('Report saved and synced successfully! Changes will appear in the mobile app.');
      
    } catch (error) {
      debugError('Error saving report:', error);
      showError(`Error saving report: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      stopLoading();
    }
  };

  // Load expense report from backend
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleLoadReport = async () => {
    if (!employeeId || !reportMonth || !reportYear) {
      alert('Missing employee ID, month, or year');
      return;
    }

    try {
      setLoading(true);
      
      const response = await fetch(`${API_BASE_URL}/api/expense-reports/${employeeId}/${reportMonth}/${reportYear}`);
      
      if (response.status === 404) {
        setCurrentReportId(null);
        setApprovalWorkflow([]);
        setApprovalHistory([]);
        setCurrentApprovalStage(null);
        setCurrentApproverName(null);
        setReportSubmittedAt(null);
        setReportApprovedAt(null);
        return;
      }
      
      if (!response.ok) {
        throw new Error('Failed to load expense report');
      }

      const savedReport = await response.json();
      // Loaded saved report
      
      // Restore the saved data
      if (savedReport.reportData) {
        const { receipts: savedReceipts, signatureImage: savedSignature, supervisorSignature: savedSupervisorSignature, employeeCertificationAcknowledged: savedEmployeeCert, supervisorCertificationAcknowledged: savedSupervisorCert, ...savedEmployeeData } = savedReport.reportData;
        
        setEmployeeData(savedEmployeeData);
        setReceipts(savedReceipts || []);
        setSignatureImage(savedSignature || null);
        setSupervisorSignatureState(savedSupervisorSignature || null);
        setEmployeeCertificationAcknowledged(savedEmployeeCert || false);
        setSupervisorCertificationAcknowledged(savedSupervisorCert || false);
        
        // Also load the report status
        if (savedReport.status) {
          const statusValue = (savedReport.status || 'draft') as
            | 'draft'
            | 'submitted'
            | 'approved'
            | 'rejected'
            | 'needs_revision'
            | 'pending_supervisor'
            | 'pending_finance'
            | 'under_review';
          setReportStatus(statusValue);
        }
        setCurrentReportId(savedReport.id || null);
        setCurrentApprovalStage(savedReport.currentApprovalStage || null);
        setCurrentApproverName(savedReport.currentApproverName || null);
        setReportSubmittedAt(savedReport.submittedAt || null);
        setReportApprovedAt(savedReport.approvedAt || null);
        if (savedReport.id) {
          fetchApprovalHistory(savedReport.id);
        } else {
          setApprovalWorkflow([]);
          setApprovalHistory([]);
        }
        
        alert('Expense report loaded successfully!');
      }
      
    } catch (error) {
      debugError('Error loading report:', error);
      alert(`Error loading report: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  // Submit expense report (change status to submitted)
  const handleSubmitReport = async () => {
    if (!employeeData) {
      alert('No employee data to submit');
      return;
    }

    // Check if employee has acknowledged the certification statement
    if (!employeeCertificationAcknowledged) {
      alert('Please check the employee acknowledgment box and add your signature before submitting your report.');
      return;
    }
    
    // Check if employee signature exists
    if (!signatureImage) {
      alert('Please add your employee signature before submitting your report. Click "Signature Capture" to upload your signature.');
      return;
    }
    
    // Check if supervisor has acknowledged and signed (if supervisor mode)
    if (supervisorMode) {
      if (!supervisorCertificationAcknowledged) {
        alert('Please check the supervisor acknowledgment box before submitting your report.');
        return;
      }
      if (!supervisorSignatureState) {
        alert('Please add supervisor signature before submitting your report. Check the supervisor acknowledgment box to upload the signature.');
        return;
      }
    }

    // Open submission type dialog - actual submission will happen in handleSubmissionTypeSelected
    setSubmissionTypeDialogOpen(true);
  };

  // Handle submission type selection from dialog
  const handleSubmissionTypeSelected = async (isWeeklyCheckup: boolean) => {
    setSubmissionTypeDialogOpen(false);
    
    if (!employeeData) {
      return;
    }

    // Set loading state
    setLoading(true);

    // Only run completeness check for monthly submissions
    let completenessReport: CompletenessReport | null = null;
    if (!isWeeklyCheckup) {
      // First, run completeness check automatically
      try {
        debugLog('🔍 Running automatic completeness check before submission...');
        completenessReport = await ReportCompletenessService.analyzeReportCompleteness(
          employeeData.employeeId,
          reportMonth,
          reportYear
        );
        
        debugLog('📊 Completeness check results:', {
          score: completenessReport.overallScore,
          isReady: completenessReport.isReadyForSubmission,
          issuesCount: completenessReport.issues.length
        });
        
        // Check if report is ready for submission
        if (!completenessReport.isReadyForSubmission) {
          const criticalIssues = completenessReport.issues.filter(issue => issue.severity === 'critical');
          const highIssues = completenessReport.issues.filter(issue => issue.severity === 'high');
          
          let errorMessage = `❌ Report Not Ready for Submission\n\n`;
          errorMessage += `Completeness Score: ${completenessReport.overallScore}/100\n\n`;
          
          if (criticalIssues.length > 0) {
            errorMessage += `🚨 Critical Issues (${criticalIssues.length}):\n`;
            criticalIssues.forEach(issue => {
              errorMessage += `• ${issue.title}: ${issue.description}\n`;
            });
            errorMessage += `\n`;
          }
          
          if (highIssues.length > 0) {
            errorMessage += `⚠️ High Priority Issues (${highIssues.length}):\n`;
            highIssues.forEach(issue => {
              errorMessage += `• ${issue.title}: ${issue.description}\n`;
            });
            errorMessage += `\n`;
          }
          
          errorMessage += `💡 Recommendations:\n`;
          completenessReport.recommendations.forEach(rec => {
            errorMessage += `• ${rec}\n`;
          });
          
          errorMessage += `\nPlease fix these issues before submitting your report.`;
          
          alert(errorMessage);
          setLoading(false);
          return;
        }
        
        // If we get here, the report passed completeness check
        debugLog('✅ Report passed completeness check, proceeding with submission...');
        
      } catch (error) {
        debugError('❌ Error running completeness check:', error);
        alert('Error running completeness check. Please try again.');
        setLoading(false);
        return;
      }
    }

    // Proceed with submission confirmation based on type
    let confirmSubmit: boolean;
    if (!isWeeklyCheckup && completenessReport) {
      // Monthly submission with completeness check
      confirmSubmit = window.confirm(
        `✅ Report Completeness Check Passed!\n\nCompleteness Score: ${completenessReport.overallScore}/100\n\nAre you sure you want to submit this expense report? Once submitted, you will not be able to make further edits.`
      );
    } else {
      // Weekly checkup - skip completeness check
      confirmSubmit = window.confirm(
        `📋 Weekly Checkup Submission\n\nThis report will be submitted for weekly review by your Regional Manager. Completeness check has been skipped.\n\nAre you sure you want to submit this weekly checkup?`
      );
    }
    
    if (!confirmSubmit) {
      setLoading(false);
      return;
    }

    try {
      const reportData = buildReportData();

      if (!reportData) {
        throw new Error('Missing report data for submission');
      }

      const response = await fetch(`${API_BASE_URL}/api/expense-reports`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          employeeId: employeeData.employeeId,
          month: currentMonth,
          year: currentYear,
          reportData: {
            ...reportData,
            submissionType: isWeeklyCheckup ? 'weekly_checkup' : 'monthly_submission'
          },
          status: 'submitted',
          submissionType: isWeeklyCheckup ? 'weekly_checkup' : 'monthly_submission'
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to submit expense report');
      }

      await response.json();

      let resolvedReportId = currentReportId;

      if (!resolvedReportId) {
        try {
          const latestReportResponse = await fetch(
            `${API_BASE_URL}/api/expense-reports/${employeeData.employeeId}/${currentMonth}/${currentYear}`
          );
          if (latestReportResponse.ok) {
            const latestReport = await latestReportResponse.json();
            if (latestReport && latestReport.id) {
              resolvedReportId = latestReport.id;
              setCurrentReportId(latestReport.id);
            }
          }
        } catch (resolveError) {
          debugError('Error determining report ID after submission:', resolveError);
        }
      }

      if (resolvedReportId) {
        const statusResponse = await fetch(`${API_BASE_URL}/api/expense-reports/${resolvedReportId}/status`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ status: 'submitted' }),
        });

        if (!statusResponse.ok) {
          throw new Error('Failed to start approval workflow');
        }

        const statusPayload = await statusResponse.json();
        const statusValue = (statusPayload.status || 'submitted') as
          | 'draft'
          | 'submitted'
          | 'approved'
          | 'rejected'
          | 'needs_revision'
          | 'pending_supervisor'
          | 'pending_finance'
          | 'under_review';

        setReportStatus(statusValue);
        setCurrentApprovalStage(statusPayload.currentApprovalStage || null);
        setCurrentApproverName(statusPayload.currentApproverName || null);
        setReportSubmittedAt(statusPayload.submittedAt || new Date().toISOString());
        setReportApprovedAt(statusPayload.approvedAt || null);
        fetchApprovalHistory(resolvedReportId);

        if (typeof showSuccess === 'function') {
          if (isWeeklyCheckup) {
            showSuccess('Weekly checkup submitted successfully! Your Regional Manager will review this report.');
          } else {
            showSuccess('Expense report submitted! Your supervisor has been notified.');
          }
        } else {
          if (isWeeklyCheckup) {
            alert('✅ Weekly checkup submitted successfully! Your Regional Manager will review this report.');
          } else {
            alert('🎉 Expense report submitted successfully! It has been sent to your supervisor for review.');
          }
        }
      } else {
        setReportStatus('submitted');
        if (typeof showSuccess === 'function') {
          if (isWeeklyCheckup) {
            showSuccess('Weekly checkup submitted successfully! Your Regional Manager will review this report.');
          } else {
            showSuccess('Expense report submitted! Your supervisor has been notified.');
          }
        } else {
          if (isWeeklyCheckup) {
            alert('✅ Weekly checkup submitted successfully! Your Regional Manager will review this report.');
          } else {
            alert('🎉 Expense report submitted successfully! It is now ready for supervisor review.');
          }
        }
      }
      
    } catch (error) {
      debugError('Error submitting report:', error);
      alert(`Error submitting report: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  // Handle canceling submission type selection
  const handleSubmissionTypeCancel = () => {
    setSubmissionTypeDialogOpen(false);
    setLoading(false);
  };

  const handleCloseApprovalComment = () => {
    setApprovalCommentDialogOpen(false);
    setApprovalCommentText('');
  };

  const handleSubmitApprovalComment = async () => {
    if (!currentReportId || !employeeData || !approvalCommentText.trim()) {
      handleCloseApprovalComment();
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/expense-reports/${currentReportId}/approval`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'comment',
          approverId: employeeData.employeeId,
          approverName: employeeData.preferredName || employeeData.name,
          comments: approvalCommentText.trim(),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to send comment');
      }

      if (typeof showSuccess === 'function') {
        showSuccess('Comment sent to your supervisor.');
      }

      handleCloseApprovalComment();
      fetchApprovalHistory(currentReportId);
    } catch (error) {
      debugError('Error submitting approval comment:', error);
      if (typeof showError === 'function') {
        showError('Unable to send comment. Please try again.');
      }
    }
  };

  // Keyboard shortcuts setup (defined after all handler functions)
  const shortcuts: KeyboardShortcut[] = [
    {
      key: 's',
      ctrl: true,
      action: () => {
        if (employeeData && handleSaveReport) {
          handleSaveReport();
        }
      },
      description: 'Save current report',
    },
    {
      key: 'Enter',
      ctrl: true,
      action: () => {
        if (employeeData && reportStatus === 'draft' && handleSubmitReport) {
          handleSubmitReport();
        }
      },
      description: 'Submit report (when draft)',
      disabled: reportStatus !== 'draft',
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

  // Fetch all reports for the employee
  const fetchAllReports = async () => {
    if (!employeeId) {
      alert('No employee ID provided');
      return;
    }

    try {
      setReportsLoading(true);
      
      const response = await fetch(`${API_BASE_URL}/api/expense-reports/${employeeId}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch reports');
      }

      const reports = await response.json();
      
      // Handle empty response
      if (!reports || reports.length === 0) {
        setAllReports([]);
        setReportsDialogOpen(true);
        return;
      }
      
      // Sort reports by year (descending) then by month (descending)
      const sortedReports = reports.sort((a: any, b: any) => {
        if (a.year !== b.year) {
          return b.year - a.year; // Newer years first
        }
        return b.month - a.month; // Newer months first
      });
      
      setAllReports(sortedReports);
      setReportsDialogOpen(true);
      
    } catch (error) {
      debugError('Error fetching reports:', error);
      alert(`Error fetching reports: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setReportsLoading(false);
    }
  };

  // Handle PDF export - using backend export endpoint for consistency
  const handleExportPdf = async () => {
    if (!employeeData) {
      alert('No employee data available');
      return;
    }
    
    // Check for supervisor signature in admin view - show warning but allow export
    if (isAdminView && !supervisorSignature) {
      const proceed = window.confirm(
        'Warning: No supervisor signature has been uploaded yet.\n\n' +
        'If you are exporting this report for final submission, you should upload your signature first.\n\n' +
        'Do you want to proceed with the export anyway?'
      );
      if (!proceed) {
        return;
      }
    }
    
    // Starting PDF export
    setLoading(true);
      
      try {
        // First, ensure report is saved to backend
        const reportData = {
          ...employeeData,
          receipts: receipts,
          dailyDescriptions: dailyDescriptions,
          employeeSignature: signatureImage,
          supervisorSignature: supervisorSignatureState,
          employeeCertificationAcknowledged: employeeCertificationAcknowledged,
          supervisorCertificationAcknowledged: supervisorCertificationAcknowledged
        };

        // Save report to backend
        await fetch(`${API_BASE_URL}/api/expense-reports/sync-to-source`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            employeeId: employeeData.employeeId,
            month: currentMonth,
            year: currentYear,
            reportData: reportData
          }),
        });

        // Now fetch the report to get its ID
        const loadResponse = await fetch(`${API_BASE_URL}/api/expense-reports/${employeeData.employeeId}/${currentMonth}/${currentYear}`);
        
        if (!loadResponse.ok) {
          throw new Error('Failed to load expense report');
        }

        const savedReport = await loadResponse.json();
        const reportId = savedReport.id;

        // Use the backend PDF export endpoint (same as Finance Portal)
        const response = await fetch(`${API_BASE_URL}/api/export/expense-report-pdf/${reportId}`, {
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
        
        // Generate filename matching Staff Portal format: LASTNAME,FIRSTNAME EXPENSES MMM-YY.pdf
        // Always use full legal name for filename, not preferred name
        const nameParts = employeeData.name.split(' ');
        const lastName = nameParts[nameParts.length - 1] || 'UNKNOWN';
        const firstName = nameParts[0] || 'UNKNOWN';
        const monthNamesShort = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
        const monthAbbr = monthNamesShort[currentMonth - 1] || 'UNK';
        const yearShort = currentYear.toString().slice(-2);
        
        link.download = `${lastName.toUpperCase()},${firstName.toUpperCase()} EXPENSES ${monthAbbr}-${yearShort}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        
        debugLog('✅ PDF export completed successfully');
    } catch (error) {
      debugError('Error generating PDF:', error);
      alert(`Error generating PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      // Setting loading to false
      setLoading(false);
    }
  };

  // Calculate totals
  const totalExpenses = employeeData ? (
    employeeData.totalMileageAmount + 
    employeeData.phoneInternetFax + 
    employeeData.airRailBus + 
    employeeData.vehicleRentalFuel + 
    employeeData.parkingTolls + 
    employeeData.groundTransportation + 
    employeeData.hotelsAirbnb + 
    employeeData.perDiem +
    (employeeData.other || 0)
  ) : 0;

  // Handle Summary Sheet editing
  // Helper function to get cost center amount for a category
  const getCostCenterAmount = (category: string, costCenterIndex: number): number => {
    if (!employeeData) return 0;
    const breakdown = employeeData.costCenterBreakdowns?.[category];
    if (breakdown && breakdown[costCenterIndex] !== undefined) {
      return breakdown[costCenterIndex];
    }
    // If no breakdown exists, return 0 (will be populated when user edits)
    return 0;
  };

  const handleEditSummaryItem = (field: string, label: string, index?: number) => {
    if (!employeeData) return;
    
    let currentValue = 0;
    let currentDescription = '';
    
    if (field === 'other' && index !== undefined) {
      // Editing specific Other Expenses entry
      const otherExpenses = employeeData.otherExpenses || [];
      if (otherExpenses[index]) {
        currentValue = otherExpenses[index].amount;
        currentDescription = otherExpenses[index].description || '';
      }
    } else if (field === 'other' && index === undefined) {
      // Adding new Other Expenses entry
      currentValue = 0;
      currentDescription = '';
    } else {
      // Regular category editing - get value for selected cost center (default to first)
      const breakdown = employeeData.costCenterBreakdowns?.[field];
      if (breakdown && breakdown.length > 0) {
        // Use cost center breakdown if available, default to first cost center
        currentValue = breakdown[0] || 0;
      } else {
        // Fall back to total divided by number of cost centers
        let total = 0;
        switch (field) {
          case 'airRailBus':
            total = employeeData.airRailBus;
            break;
          case 'vehicleRentalFuel':
            total = employeeData.vehicleRentalFuel;
            break;
          case 'parkingTolls':
            total = employeeData.parkingTolls;
            break;
          case 'groundTransportation':
            total = employeeData.groundTransportation;
            break;
          case 'hotelsAirbnb':
            total = employeeData.hotelsAirbnb;
            break;
          case 'phoneInternetFax':
            total = employeeData.phoneInternetFax;
            break;
          case 'shippingPostage':
            total = employeeData.shippingPostage || 0;
            break;
          case 'printingCopying':
            total = employeeData.printingCopying || 0;
            break;
          case 'officeSupplies':
            total = employeeData.officeSupplies || 0;
            break;
          case 'eesReceipt':
            total = employeeData.eesReceipt || 0;
            break;
        }
        currentValue = total / employeeData.costCenters.length;
      }
    }
    
    setEditingSummaryItem({ field, label, index });
    setEditingSummaryValue(currentValue.toFixed(2));
    setEditingSummaryDescription(currentDescription);
    setEditingCostCenterIndex(0); // Default to first cost center
    setSummaryEditDialogOpen(true);
  };

  const handleSaveSummaryEdit = async () => {
    if (!employeeData || !editingSummaryItem) return;
    
    const newValue = parseFloat(editingSummaryValue) || 0;
    if (newValue < 0) {
      alert('Amount cannot be negative');
      return;
    }

    // Validate against receipt totals (except for Other Expenses)
    if (editingSummaryItem.field !== 'other') {
      const receiptTotal = receiptTotalsByCategory[editingSummaryItem.field] || 0;
      if (receiptTotal > 0 && Math.abs(newValue - receiptTotal) > 0.01) {
        const proceed = window.confirm(
          `Warning: The amount you entered ($${newValue.toFixed(2)}) does not match your receipt total for this category ($${receiptTotal.toFixed(2)}). ` +
          `Do you want to proceed anyway?`
        );
        if (!proceed) {
          return;
        }
      }
    }

    try {
      setLoading(true);
      
      // Update local state
      const updatedData = { ...employeeData };
      
      if (editingSummaryItem.field === 'other') {
        // Handle Other Expenses array
        if (!updatedData.otherExpenses) {
          updatedData.otherExpenses = [];
        }
        
        if (editingSummaryItem.index !== undefined) {
          // Update existing entry
          updatedData.otherExpenses[editingSummaryItem.index] = {
            amount: newValue,
            description: editingSummaryDescription,
            id: updatedData.otherExpenses[editingSummaryItem.index]?.id || Date.now().toString()
          };
        } else {
          // Add new entry
          updatedData.otherExpenses.push({
            amount: newValue,
            description: editingSummaryDescription,
            id: Date.now().toString()
          });
        }
        // Update legacy 'other' field for backward compatibility
        updatedData.other = updatedData.otherExpenses.reduce((sum, entry) => sum + entry.amount, 0);
      } else {
        // Regular category editing - update cost center breakdown
        if (!updatedData.costCenterBreakdowns) {
          updatedData.costCenterBreakdowns = {};
        }
        if (!updatedData.costCenterBreakdowns[editingSummaryItem.field]) {
          updatedData.costCenterBreakdowns[editingSummaryItem.field] = new Array(employeeData.costCenters.length).fill(0);
        }
        
        // Update the specific cost center amount
        updatedData.costCenterBreakdowns[editingSummaryItem.field][editingCostCenterIndex] = newValue;
        
        // Recalculate total for this category
        const total = updatedData.costCenterBreakdowns[editingSummaryItem.field].reduce((sum, val) => sum + val, 0);
        
        // Update the category total
        switch (editingSummaryItem.field) {
          case 'airRailBus':
            updatedData.airRailBus = total;
            break;
          case 'vehicleRentalFuel':
            updatedData.vehicleRentalFuel = total;
            break;
          case 'parkingTolls':
            updatedData.parkingTolls = total;
            break;
          case 'groundTransportation':
            updatedData.groundTransportation = total;
            break;
          case 'hotelsAirbnb':
            updatedData.hotelsAirbnb = total;
            break;
          case 'phoneInternetFax':
            updatedData.phoneInternetFax = total;
            break;
          case 'shippingPostage':
            updatedData.shippingPostage = total;
            break;
          case 'printingCopying':
            updatedData.printingCopying = total;
            break;
          case 'officeSupplies':
            updatedData.officeSupplies = total;
            break;
          case 'eesReceipt':
            updatedData.eesReceipt = total;
            break;
        }
      }
      
      setEmployeeData(updatedData);

      // Update backend
      const reportData: any = {
        airRailBus: updatedData.airRailBus,
        vehicleRentalFuel: updatedData.vehicleRentalFuel,
        parkingTolls: updatedData.parkingTolls,
        groundTransportation: updatedData.groundTransportation,
        hotelsAirbnb: updatedData.hotelsAirbnb,
        phoneInternetFax: updatedData.phoneInternetFax,
        shippingPostage: updatedData.shippingPostage || 0,
        printingCopying: updatedData.printingCopying || 0,
        officeSupplies: updatedData.officeSupplies || 0,
        eesReceipt: updatedData.eesReceipt || 0,
      };
      
      // Include cost center breakdowns if they exist
      if (updatedData.costCenterBreakdowns) {
        reportData.costCenterBreakdowns = updatedData.costCenterBreakdowns;
      }
      
      // Include otherExpenses array if it exists
      if (updatedData.otherExpenses && updatedData.otherExpenses.length > 0) {
        reportData.otherExpenses = updatedData.otherExpenses;
        reportData.other = updatedData.other; // Legacy support
      } else {
        reportData.other = 0;
      }

      const { apiPut } = await import('./services/rateLimitedApi');
      await apiPut(`/api/expense-reports/${employeeId}/${currentMonth}/${currentYear}/summary`, { reportData });

      setSummaryEditDialogOpen(false);
      setEditingSummaryItem(null);
      setEditingSummaryValue('');
      setEditingSummaryDescription('');
      setEditingCostCenterIndex(0);
      debugLog('✅ Summary sheet updated successfully');
    } catch (error) {
      debugError('Error updating summary sheet:', error);
      alert(`Error updating summary sheet: ${error instanceof Error ? error.message : 'Unknown error'}`);
      // Revert local state on error - reload data by triggering useEffect
      window.location.reload();
    } finally {
      setLoading(false);
    }
  };

  // Debug logging removed for production

  // Show loading state
  if (loading || !employeeData) {
    return (
      <Container maxWidth="xl" sx={{ mt: 2, mb: 4, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
        <CircularProgress size={60} />
        <Typography variant="h6" sx={{ ml: 2 }}>
          Loading employee data...
        </Typography>
      </Container>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ mt: 2, mb: 4 }} id="expense-report-content">
      {/* Enhanced Header */}
        <EnhancedHeader
        title="MONTHLY EXPENSE REPORT - OXFORD HOUSE, INC."
        subtitle="Comprehensive expense tracking and reporting system"
        employeeName={employeeData?.preferredName || employeeData?.name}
        employeeId={employeeId}
        employeeRole={employeeRole}
        reportMonth={currentMonth}
        reportYear={currentYear}
        loading={loading}
        isAdminView={isAdminView}
        supervisorMode={supervisorMode}
        onExportPdf={handleExportPdf}
        onSaveReport={handleSaveReport}
        onSubmitReport={handleSubmitReport}
        onApproveReport={onApproveReport}
        onRequestRevision={onRequestRevision}
        onViewAllReports={fetchAllReports}
        onCheckCompleteness={handleCheckCompleteness}
        onRefresh={() => {
          debugVerbose('🔄 StaffPortal: Refreshing data from backend...');
          startLoading('Refreshing data from backend...');
          
          // Increment the refresh trigger to force useEffect to re-run
          setRefreshTrigger(prev => prev + 1);
          
          // Show success message after a brief delay to allow data to load
          setTimeout(() => {
            stopLoading();
            showSuccess('Data refreshed successfully from backend!');
          }, 1500);
        }}
        onSettings={() => setActiveTab(employeeData ? employeeData.costCenters.length + 7 : 7)}
        onMonthYearChange={(month, year) => {
          setCurrentMonth(month);
          setCurrentYear(year);
        }}
        onReportClick={async (reportId: string, employeeId?: string, month?: number, year?: number) => {
          // Navigate to the report's month/year if provided
          if (month && year) {
            setCurrentMonth(month);
            setCurrentYear(year);
            showSuccess(`Navigated to ${new Date(year, month - 1).toLocaleString('default', { month: 'long', year: 'numeric' })} report`);
          } else {
            // Fetch report details to get month/year
            try {
              const response = await fetch(`${API_BASE_URL}/api/expense-reports/${reportId}`);
              if (response.ok) {
                const report = await response.json();
                if (report.month && report.year) {
                  setCurrentMonth(report.month);
                  setCurrentYear(report.year);
                  showSuccess(`Navigated to ${new Date(report.year, report.month - 1).toLocaleString('default', { month: 'long', year: 'numeric' })} report`);
                }
              }
            } catch (error) {
              debugError('Error fetching report for navigation:', error);
              showError('Could not navigate to report');
            }
          }
        }}
        showRealTimeStatus={true}
        tabs={
          <EnhancedTabNavigation
            value={activeTab}
            onChange={handleTabChange}
            tabs={createTabConfig(employeeData)}
            employeeData={employeeData}
            showStatus={!!employeeData}
            rawTimeEntries={rawTimeEntries}
            currentMonth={currentMonth}
            currentYear={currentYear}
            daysInMonth={new Date(currentYear, currentMonth, 0).getDate()}
          />
        }
      />

      {/* Dashboard Notifications */}
      <DashboardNotifications
        employeeId={employeeId}
        role={employeeRole}
        onReportClick={async (reportId: string, employeeId?: string, month?: number, year?: number) => {
          // Navigate to the report's month/year if provided
          if (month && year) {
            setCurrentMonth(month);
            setCurrentYear(year);
            showSuccess(`Navigated to ${new Date(year, month - 1).toLocaleString('default', { month: 'long', year: 'numeric' })} report`);
          } else {
            // Fetch report details to get month/year
            try {
              const response = await fetch(`${API_BASE_URL}/api/expense-reports/${reportId}`);
              if (response.ok) {
                const report = await response.json();
                if (report.month && report.year) {
                  setCurrentMonth(report.month);
                  setCurrentYear(report.year);
                  showSuccess(`Navigated to ${new Date(report.year, report.month - 1).toLocaleString('default', { month: 'long', year: 'numeric' })} report`);
                }
              }
            } catch (error) {
              debugError('Error fetching report for navigation:', error);
              showError('Could not navigate to report');
            }
          }
        }}
      />

      {/* Tips Display */}
      {showTips && tips.length > 0 && (
        <div className="tips-container">
          <div className="tips-scroll-view">
            {tips.map((tip) => (
              <TipCard
                key={tip.id}
                tip={tip}
                onDismiss={dismissTip}
                onMarkSeen={markTipAsSeen}
              />
            ))}
          </div>
        </div>
      )}

      {/* Loading Overlay */}
      <LoadingOverlay 
        open={loading || uiLoading} 
        message={uiLoading ? 'Refreshing data...' : 'Loading...'} 
        variant="backdrop" 
      />

      <EmployeeApprovalStatusCard
        status={reportStatus}
        workflow={approvalWorkflow}
        history={approvalHistory}
        submittedAt={reportSubmittedAt || undefined}
        currentStage={currentApprovalStage || undefined}
        currentApproverName={currentApproverName || undefined}
        loading={approvalHistoryLoading}
        onAddComment={() => setApprovalCommentDialogOpen(true)}
        onResubmit={reportStatus === 'needs_revision' ? handleSubmitReport : undefined}
        disableResubmit={loading}
      />

      {/* Enhanced Tab Navigation - Now in header */}

      <Dialog 
        open={approvalCommentDialogOpen} 
        onClose={handleCloseApprovalComment} 
        maxWidth={false}
        fullWidth
        PaperProps={{
          sx: {
            maxWidth: '90vw',
            maxHeight: '90vh',
            width: 'auto',
            height: 'auto',
          }
        }}
      >
        <DialogTitle>Send a Comment to Your Supervisor</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Add any notes or clarification for your supervisor. They will see this in their approval timeline.
          </Typography>
          <TextField
            autoFocus
            margin="dense"
            label="Message"
            fullWidth
            multiline
            minRows={4}
            value={approvalCommentText}
            onChange={(event) => setApprovalCommentText(event.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseApprovalComment}>Cancel</Button>
          <Button
            onClick={handleSubmitApprovalComment}
            disabled={!approvalCommentText.trim() || !currentReportId}
            variant="contained"
          >
            Send Comment
          </Button>
        </DialogActions>
      </Dialog>

      {/* Revision Notification Banner */}
      {reportStatus === 'needs_revision' && (revisionItems.mileage > 0 || revisionItems.receipts > 0 || revisionItems.time > 0) && (
        <Alert severity="warning" sx={{ mb: 2, mt: 2 }}>
          <AlertTitle><strong>⚠️ Revision Requested</strong></AlertTitle>
          <Typography variant="body2">
            Your supervisor has requested revisions on the following items:
          </Typography>
          <Box component="ul" sx={{ mt: 1, mb: 0, pl: 2 }}>
            {revisionItems.mileage > 0 && (
              <li><strong>{revisionItems.mileage}</strong> mileage entries need revision</li>
            )}
            {revisionItems.receipts > 0 && (
              <li><strong>{revisionItems.receipts}</strong> receipts need revision</li>
            )}
            {revisionItems.time > 0 && (
              <li><strong>{revisionItems.time}</strong> time entries need revision</li>
            )}
          </Box>
          <Typography variant="body2" sx={{ mt: 1 }}>
            Please review and update the flagged items, then resubmit your report.
          </Typography>
        </Alert>
      )}

      {/* Approval Cover Sheet Tab */}
      <TabPanel value={activeTab} index={0}>
        <Card variant="outlined">
          <CardContent>
            <Typography variant="h4" align="center" gutterBottom sx={{ textTransform: 'uppercase', fontWeight: 'bold' }}>
              Monthly Expense Report Approval Cover Sheet
            </Typography>
            
            <Typography variant="h5" align="center" gutterBottom sx={{ fontWeight: 'bold' }}>
              OXFORD HOUSE, INC.
            </Typography>
            
            <Typography variant="h6" align="center" gutterBottom color="textSecondary">
              1010 Wayne Ave. Suite # 300, Silver Spring, MD 20910
            </Typography>

            <Box sx={{ mt: 4 }}>
              <Box sx={{ display: 'flex', gap: 6 }}>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="body1" component="div"><strong>Name:</strong> {employeeData.name}</Typography>
                  {employeeData.preferredName && employeeData.preferredName !== employeeData.name && (
                    <Tooltip title="Your preferred name is only used in the app and web portal. Your legal name will always be used on expense reports and official documents." arrow>
                      <Typography variant="body2" color="textSecondary" component="div" sx={{ cursor: 'help' }}>
                        <strong>Preferred Name:</strong> {employeeData.preferredName}
                      </Typography>
                    </Tooltip>
                  )}
                  <Typography variant="body1" component="div"><strong>Month:</strong> {monthName}, {reportYear}</Typography>
                  <Typography variant="body1" component="div"><strong>Date Completed:</strong> {employeeData.dateCompleted}</Typography>
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="body1" component="div"><strong>Cost Centers:</strong></Typography>
                  <Box sx={{ mt: 1 }}>
                    {employeeData.costCenters.map((center, index) => (
                      <Chip key={index} label={`${index + 1}.) ${center}`} variant="outlined" sx={{ mr: 1, mb: 1 }} />
                    ))}
                    {/* Show placeholders for unused cost centers */}
                    {Array.from({ length: 5 - employeeData.costCenters.length }, (_, i) => (
                      <Chip key={i + employeeData.costCenters.length} label={`${i + employeeData.costCenters.length + 1}.) {n/a}`} variant="outlined" sx={{ mr: 1, mb: 1 }} />
                    ))}
                  </Box>
                </Box>
              </Box>
            </Box>

            <Box sx={{ mt: 6, p: 2, border: '1px solid #ccc', borderRadius: 1, bgcolor: 'grey.50' }}>
              <Typography variant="body2" color="error" sx={{ mb: 2 }} component="div">
                <strong>* Note:</strong> Signature also required on Summary Sheet & Timesheet
              </Typography>
              <Typography variant="body2" color="error" component="div">
                <strong>* Note:</strong> in order to be reimbursed for per diem, your daily work activities must 
                entail your having been away from home for a minimum of eight hours, as documented in your Travel
              </Typography>
            </Box>

            {/* Certification Statement */}
            <Box sx={{ mt: 4, p: 2, border: '1px solid #ccc', borderRadius: 1, bgcolor: '#fff0f5' }}>
              <Typography variant="body2" sx={{ mb: 2, fontStyle: 'italic' }} component="div">
                By signing and submitting this report to Oxford House, Inc., I certify under penalty of perjury that the pages herein document genuine, valid, and necessary expenditures, as well as an accurate record of my time and travel on behalf of Oxford House, Inc.
              </Typography>
              
              {/* Employee Acknowledgment Checkbox */}
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Checkbox
                  checked={employeeCertificationAcknowledged}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    // If checking the box and no employee signature exists, prompt user to add signature first
                    if (checked && !signatureImage) {
                      alert('Please upload your signature first before checking the acknowledgment box. Click "Signature Capture" to upload your signature.');
                      setEmployeeCertificationAcknowledged(false);
                    } else {
                      setEmployeeCertificationAcknowledged(checked);
                      void syncReportData({ employeeCertificationAcknowledged: checked })
                        .catch((error) => debugError('Error syncing employee acknowledgment:', error));
                    }
                  }}
                  size="small"
                />
                <Typography variant="body2" component="div">
                  I have read and agree to the certification statement above
                </Typography>
              </Box>

              {/* Supervisor Acknowledgment Checkbox (only visible if supervisor mode) */}
              {supervisorMode && (
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <Checkbox
                    checked={supervisorCertificationAcknowledged}
                    onChange={async (e) => {
                      const checked = e.target.checked;
                      setSupervisorCertificationAcknowledged(checked);
                      
                      // If checking the box and no supervisor signature exists, open signature dialog
                      if (checked && !supervisorSignatureState) {
                        setSupervisorSignatureDialogOpen(true);
                      }
                      // If unchecking, clear the signature requirement
                      else if (!checked) {
                        setSupervisorSignatureState(null);
                      }

                      void syncReportData({
                        supervisorCertificationAcknowledged: checked,
                        supervisorSignature: checked ? supervisorSignatureState : null,
                      }).catch((error) => debugError('Error syncing supervisor acknowledgment:', error));
                    }}
                    size="small"
                  />
                  <Typography variant="body2" component="div">
                    Supervisor: I have read and agree to the certification statement above
                  </Typography>
                </Box>
              )}
            </Box>

            <Box sx={{ mt: 4 }}>
              <Typography variant="h6" gutterBottom component="div"><strong>Signatures of Approval:</strong></Typography>
              <Box sx={{ display: 'flex', gap: 4 }}>
                <Box sx={{ flex: 1 }}>
                  <Box sx={{ border: '1px solid #ccc', p: 2, borderRadius: 1 }}>
                    <Typography variant="body1" component="div"><strong>Employee Signature</strong></Typography>
                    <Box sx={{ 
                      mt: 2, 
                      mb: 2, 
                      minHeight: 40, 
                      border: '1px solid #ccc', 
                      borderRadius: 1,
                      bgcolor: 'white',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      position: 'relative',
                      overflow: 'hidden'
                    }}>
                      {signatureImage ? (
                        <Box sx={{ position: 'relative', width: '100%', height: '100%' }}>
                          <img 
                            src={signatureImage} 
                            alt="Employee Signature" 
                            style={{ 
                              maxHeight: '100%', 
                              maxWidth: '100%',
                              objectFit: 'contain'
                            }} 
                          />
                          <IconButton
                            size="small"
                            onClick={() => setSignatureDialogOpen(true)}
                            sx={{ 
                              position: 'absolute', 
                              top: 4, 
                              right: 4, 
                              bgcolor: 'white',
                              '&:hover': { bgcolor: 'grey.100' }
                            }}
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Box>
                      ) : (
                        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, p: 2 }}>
                          <Typography variant="caption" color="textSecondary">
                            No signature available
                          </Typography>
                          <Button
                            variant="outlined"
                            size="small"
                            onClick={() => setSignatureDialogOpen(true)}
                            startIcon={<UploadIcon />}
                          >
                            Upload Signature
                          </Button>
                        </Box>
                      )}
                    </Box>
                    {/* Import Saved Signature Button */}
                    {savedSignature && (!signatureImage || signatureImage !== savedSignature) && (
                      <Box sx={{ mt: 1 }}>
                        <Button
                          variant="text"
                          size="small"
                          onClick={async () => {
                            setSignatureImage(savedSignature);
                            
                            // Auto-save to expense report
                            if (employeeData) {
                              try {
                                const reportData = {
                                  ...employeeData,
                                  receipts: receipts,
                                  employeeSignature: savedSignature,
                                  supervisorSignature: supervisorSignatureState
                                };

                                await fetch(`${API_BASE_URL}/api/expense-reports/sync-to-source`, {
                                  method: 'POST',
                                  headers: {
                                    'Content-Type': 'application/json',
                                  },
                                  body: JSON.stringify({
                                    employeeId: employeeData.employeeId,
                                    month: currentMonth,
                                    year: currentYear,
                                    reportData: reportData
                                  }),
                                });
                                
                                debugLog('✅ Imported saved signature to report');
                                showSuccess('Saved signature imported');
                              } catch (error) {
                                debugError('Error importing signature:', error);
                                showError('Failed to import signature');
                              }
                            }
                          }}
                          startIcon={<CloudDownloadIcon />}
                          sx={{ fontSize: '0.8rem', textTransform: 'none' }}
                        >
                          Import Saved Signature
                        </Button>
                      </Box>
                    )}
                    <Typography variant="body2" color="textSecondary">{employeeData.name}</Typography>
                    <Typography variant="body2" color="textSecondary">Date: ___________</Typography>
                  </Box>
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Box sx={{ border: '1px solid #ccc', p: 2, borderRadius: 1 }}>
                    <Typography variant="body1" component="div"><strong>Direct Supervisor</strong></Typography>
                    <Box sx={{ 
                      mt: 2, 
                      mb: 2, 
                      minHeight: 40, 
                      border: '1px solid #ccc', 
                      borderRadius: 1,
                      bgcolor: 'white',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      position: 'relative',
                      overflow: 'hidden'
                    }}>
                      {supervisorSignatureState ? (
                        <Box sx={{ position: 'relative', width: '100%', height: '100%' }}>
                          <img 
                            src={supervisorSignatureState} 
                            alt="Supervisor Signature" 
                            style={{ 
                              maxHeight: '100%', 
                              maxWidth: '100%',
                              objectFit: 'contain'
                            }} 
                          />
                          {supervisorMode && (
                            <IconButton
                              size="small"
                              onClick={() => setSupervisorSignatureDialogOpen(true)}
                              sx={{ 
                                position: 'absolute', 
                                top: 4, 
                                right: 4, 
                                bgcolor: 'white',
                                '&:hover': { bgcolor: 'grey.100' }
                              }}
                            >
                              <EditIcon fontSize="small" />
                            </IconButton>
                          )}
                        </Box>
                      ) : supervisorMode ? (
                        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, p: 2 }}>
                          <Typography variant="caption" color="textSecondary">
                            No supervisor signature available
                          </Typography>
                          <Button
                            variant="outlined"
                            size="small"
                            onClick={() => setSupervisorSignatureDialogOpen(true)}
                            startIcon={<UploadIcon />}
                          >
                            Upload Supervisor Signature
                          </Button>
                        </Box>
                      ) : (
                        <Typography variant="caption" color="textSecondary">
                          Supervisor signature will appear here
                        </Typography>
                      )}
                    </Box>
                    {supervisorMode && supervisorSignatureState && (
                      <Box sx={{ mt: 1 }}>
                        <Button
                          variant="text"
                          size="small"
                          color="error"
                          onClick={async () => {
                            setSupervisorSignatureState(null);
                            setSupervisorCertificationAcknowledged(false);
                            
                            // Auto-save signature removal
                            if (employeeData) {
                              try {
                                await syncReportData({
                                  supervisorSignature: null,
                                  supervisorCertificationAcknowledged: false,
                                });
                                
                                debugVerbose('✅ Supervisor signature removal synced to expense report');
                                showSuccess('Supervisor signature removed from this report');
                              } catch (error) {
                                debugError('Error removing supervisor signature:', error);
                                showError('Failed to remove supervisor signature');
                              }
                            }
                          }}
                          startIcon={<DeleteIcon />}
                          sx={{ fontSize: '0.8rem', textTransform: 'none' }}
                        >
                          Remove Supervisor Signature
                        </Button>
                      </Box>
                    )}
                    <Typography variant="body2" color="textSecondary">Date: ___________</Typography>
                  </Box>
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Box sx={{ border: '1px solid #ccc', p: 2, borderRadius: 1 }}>
                    <Typography variant="body1" component="div"><strong>Finance Department</strong></Typography>
                    <Box sx={{ mt: 2, mb: 2, borderBottom: '1px solid #333', minHeight: 40 }} />
                    <Typography variant="body2" color="textSecondary">Date: ___________</Typography>
                  </Box>
                </Box>
              </Box>
            </Box>
          </CardContent>
        </Card>
      </TabPanel>

      {/* Summary Sheet Tab */}
      <TabPanel value={activeTab} index={1}>
        <Card variant="outlined">
          <CardContent sx={{ textAlign: 'left' }}>
            {/* Header matching spreadsheet */}
            <Typography variant="h4" align="center" gutterBottom sx={{ fontWeight: 'bold', textTransform: 'uppercase' }}>
              MONTHLY EXPENSE REPORT SUMMARY SHEET
            </Typography>
            
            <Typography variant="h5" align="center" gutterBottom sx={{ fontWeight: 'bold' }}>
              OXFORD HOUSE, INC.
            </Typography>
            
            <Typography variant="h6" align="center" gutterBottom color="textSecondary">
              1010 Wayne Ave. Suite # 300, Silver Spring, MD 20910
            </Typography>

            <Box sx={{ mt: 3 }}>
              <Box sx={{ display: 'flex', gap: 6 }}>
                <Box sx={{ flex: 0.5 }}>
                  <Typography variant="body1"><strong>Name:</strong> {employeeData.name}</Typography>
                  <Typography variant="body1"><strong>Month:</strong> {monthName}, {reportYear}</Typography>
                  <Typography variant="body1"><strong>Date Completed:</strong> {employeeData.dateCompleted}</Typography>
                </Box>
                <Box sx={{ flex: 2 }}>
                  <Typography variant="body1"><strong>Cost Centers:</strong></Typography>
                  <Box sx={{ mt: 1 }}>
                    {employeeData.costCenters.map((center, index) => (
                      <Chip key={index} label={`Cost Center #${index + 1}: ${center}`} variant="outlined" sx={{ mr: 1, mb: 1 }} />
                    ))}
                    {employeeData.costCenters.length < 5 && (
                      <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
                        Cost Centers #{employeeData.costCenters.length + 1}-#5: {'n/a'}
                      </Typography>
                    )}
                  </Box>
                </Box>
              </Box>
            </Box>

            {/* Summary table matching spreadsheet format */}
            <Box sx={{ mt: 4 }}>
              <TableContainer component={Paper} sx={{ width: '100%' }}>
                <Table size="small" sx={{ 
                  width: '100%', 
                  tableLayout: 'fixed', 
                  borderCollapse: 'collapse',
                  '& td, & th': {
                    padding: '8px 4px',
                    border: '1px solid #e0e0e0',
                    textAlign: 'center'
                  }
                }}>
                <TableHead>
                  <TableRow sx={{ bgcolor: 'grey.100' }}>
                    <TableCell sx={{ width: '30%', textAlign: 'left' }}></TableCell>
                    <TableCell align="center" sx={{ width: '14%' }}>
                      Cost Center #1
                    </TableCell>
                    {employeeData.costCenters.length > 1 && (
                      <>
                        {employeeData.costCenters.slice(1).map((center, index) => (
                          <TableCell key={index + 1} align="center" sx={{ width: '14%' }}>
                            Cost Center #{index + 2}
                          </TableCell>
                        ))}
                      </>
                    )}
                    <TableCell align="center" sx={{ width: '14%' }}>SUBTOTALS (by category)</TableCell>
                  </TableRow>
                </TableHead>
                <TableHead>
                  <TableRow sx={{ bgcolor: 'grey.50' }}>
                    <TableCell sx={{ width: '30%', textAlign: 'left' }}></TableCell>
                    <TableCell align="center" sx={{ width: '14%' }}>{employeeData.costCenters[0]}</TableCell>
                    {employeeData.costCenters.length > 1 && (
                      <>
                        {employeeData.costCenters.slice(1).map((center, index) => (
                          <TableCell key={index + 1} align="center" sx={{ width: '14%' }}>{center}</TableCell>
                        ))}
                      </>
                    )}
                    <TableCell align="center" sx={{ width: '14%' }}></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {/* TRAVEL Section */}
                  <TableRow>
                    <TableCell colSpan={employeeData.costCenters.length + 2} align="center" sx={{ fontWeight: 'bold', bgcolor: 'grey.100' }}>
                      Transportation
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell align="center">
                      Mileage
                    </TableCell>
                    <TableCell align="right">
                      ${employeeData.totalMileageAmount.toFixed(2)}
                    </TableCell>
                    {employeeData.costCenters.length > 1 && (
                      <>
                        {employeeData.costCenters.slice(1).map((center, index) => (
                          <TableCell key={index + 1} align="center">
                            $0.00
                          </TableCell>
                        ))}
                      </>
                    )}
                    <TableCell align="right"><strong>${employeeData.totalMileageAmount.toFixed(2)}</strong></TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell align="center" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                      Air / Rail / Bus
                      <IconButton 
                        size="small" 
                        onClick={() => handleEditSummaryItem('airRailBus', 'Air / Rail / Bus')}
                        sx={{ p: 0.5 }}
                        title="Edit Air / Rail / Bus Amount"
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                    <TableCell align="right">
                      ${((employeeData.costCenterBreakdowns?.airRailBus?.[0]) || 0).toFixed(2)}
                    </TableCell>
                    {employeeData.costCenters.length > 1 && (
                      <>
                        {employeeData.costCenters.slice(1).map((center, index) => (
                          <TableCell key={index + 1} align="center">
                            ${((employeeData.costCenterBreakdowns?.airRailBus?.[index + 1]) || 0).toFixed(2)}
                          </TableCell>
                        ))}
                      </>
                    )}
                    <TableCell align="right"><strong>${employeeData.airRailBus.toFixed(2)}</strong></TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell align="center" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                      Vehicle Rental / Fuel
                      <IconButton 
                        size="small" 
                        onClick={() => handleEditSummaryItem('vehicleRentalFuel', 'Vehicle Rental / Fuel')}
                        sx={{ p: 0.5 }}
                        title="Edit Vehicle Rental / Fuel Amount"
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                    <TableCell align="right">
                      ${getCostCenterAmount('parkingTolls', 0).toFixed(2)}
                    </TableCell>
                    {employeeData.costCenters.length > 1 && (
                      <>
                        {employeeData.costCenters.slice(1).map((center, index) => (
                          <TableCell key={index + 1} align="center">
                            ${getCostCenterAmount('parkingTolls', index + 1).toFixed(2)}
                          </TableCell>
                        ))}
                      </>
                    )}
                    <TableCell align="right"><strong>${employeeData.parkingTolls.toFixed(2)}</strong></TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell align="center" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                      Parking / Tolls
                      <IconButton 
                        size="small" 
                        onClick={() => handleEditSummaryItem('parkingTolls', 'Parking / Tolls')}
                        sx={{ p: 0.5 }}
                        title="Edit Parking / Tolls Amount"
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                    <TableCell align="center">$0.00</TableCell>
                    {employeeData.costCenters.length > 1 && (
                      <>
                        {employeeData.costCenters.slice(1).map((center, index) => (
                          <TableCell key={index + 1} align="center">$0.00</TableCell>
                        ))}
                      </>
                    )}
                    <TableCell align="right">$0.00</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell align="center" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                      Ground Transportation
                      <IconButton 
                        size="small" 
                        onClick={() => handleEditSummaryItem('groundTransportation', 'Ground Transportation')}
                        sx={{ p: 0.5 }}
                        title="Edit Ground Transportation Amount"
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                    <TableCell align="right">
                      ${getCostCenterAmount('groundTransportation', 0).toFixed(2)}
                    </TableCell>
                    {employeeData.costCenters.slice(1).map((center, index) => (
                      <TableCell key={index} align="center">
                        ${getCostCenterAmount('groundTransportation', index + 1).toFixed(2)}
                      </TableCell>
                    ))}
                    <TableCell align="right"><strong>${employeeData.groundTransportation.toFixed(2)}</strong></TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell align="center" sx={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                      Lodging
                      <IconButton 
                        size="small" 
                        onClick={() => handleEditSummaryItem('hotelsAirbnb', 'Lodging')}
                        sx={{ p: 0.5 }}
                        title="Edit Lodging Amount"
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                    <TableCell align="right">
                      ${getCostCenterAmount('hotelsAirbnb', 0).toFixed(2)}
                    </TableCell>
                    {employeeData.costCenters.slice(1).map((center, index) => (
                      <TableCell key={index} align="center">
                        ${getCostCenterAmount('hotelsAirbnb', index + 1).toFixed(2)}
                      </TableCell>
                    ))}
                    <TableCell align="right"><strong>${employeeData.hotelsAirbnb.toFixed(2)}</strong></TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell align="center">
                      Per Diem
                    </TableCell>
                    <TableCell align="right">${employeeData.perDiem.toFixed(2)}</TableCell>
                    {employeeData.costCenters.length > 1 && (
                      <>
                        {employeeData.costCenters.slice(1).map((center, index) => (
                          <TableCell key={index + 1} align="center">$0.00</TableCell>
                        ))}
                      </>
                    )}
                    <TableCell align="right">${employeeData.perDiem.toFixed(2)}</TableCell>
                  </TableRow>
                  
                  {/* COMMUNICATIONS Section */}
                  <TableRow>
                    <TableCell colSpan={employeeData.costCenters.length + 2} align="center" sx={{ fontWeight: 'bold', bgcolor: 'grey.100' }}>
                      Communications
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell align="center" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                      Phone / Internet / Fax
                      <IconButton 
                        size="small" 
                        onClick={() => handleEditSummaryItem('phoneInternetFax', 'Phone / Internet / Fax')}
                        sx={{ p: 0.5 }}
                        title="Edit Phone / Internet / Fax Amount"
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                    <TableCell align="right">
                      ${getCostCenterAmount('phoneInternetFax', 0).toFixed(2)}
                    </TableCell>
                    {employeeData.costCenters.length > 1 && (
                      <>
                        {employeeData.costCenters.slice(1).map((center, index) => (
                          <TableCell key={index + 1} align="center">
                            ${getCostCenterAmount('phoneInternetFax', index + 1).toFixed(2)}
                          </TableCell>
                        ))}
                      </>
                    )}
                    <TableCell align="right"><strong>${employeeData.phoneInternetFax.toFixed(2)}</strong></TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell align="center" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                      Shipping / Postage
                      <IconButton 
                        size="small" 
                        onClick={() => handleEditSummaryItem('shippingPostage', 'Shipping / Postage')}
                        sx={{ p: 0.5 }}
                        title="Edit Shipping / Postage Amount"
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                    <TableCell align="right">
                      ${getCostCenterAmount('shippingPostage', 0).toFixed(2)}
                    </TableCell>
                    {employeeData.costCenters.length > 1 && (
                      <>
                        {employeeData.costCenters.slice(1).map((center, index) => (
                          <TableCell key={index + 1} align="center">
                            ${getCostCenterAmount('shippingPostage', index + 1).toFixed(2)}
                          </TableCell>
                        ))}
                      </>
                    )}
                    <TableCell align="right"><strong>${(employeeData.shippingPostage || 0).toFixed(2)}</strong></TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell align="center" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                      Printing / Copying
                      <IconButton 
                        size="small" 
                        onClick={() => handleEditSummaryItem('printingCopying', 'Printing / Copying')}
                        sx={{ p: 0.5 }}
                        title="Edit Printing / Copying Amount"
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                    <TableCell align="right">
                      ${getCostCenterAmount('printingCopying', 0).toFixed(2)}
                    </TableCell>
                    {employeeData.costCenters.length > 1 && (
                      <>
                        {employeeData.costCenters.slice(1).map((center, index) => (
                          <TableCell key={index + 1} align="center">
                            ${getCostCenterAmount('printingCopying', index + 1).toFixed(2)}
                          </TableCell>
                        ))}
                      </>
                    )}
                    <TableCell align="right"><strong>${(employeeData.printingCopying || 0).toFixed(2)}</strong></TableCell>
                  </TableRow>
                  
                  {/* SUPPLIES Section */}
                  <TableRow>
                    <TableCell colSpan={employeeData.costCenters.length + 2} align="center" sx={{ fontWeight: 'bold', bgcolor: 'grey.100' }}>
                      Supplies
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell align="center" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                      Office Supplies
                      <IconButton 
                        size="small" 
                        onClick={() => handleEditSummaryItem('officeSupplies', 'Office Supplies')}
                        sx={{ p: 0.5 }}
                        title="Edit Office Supplies Amount"
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                    <TableCell align="right">
                      ${(employeeData.officeSupplies || 0).toFixed(2)}
                    </TableCell>
                    {employeeData.costCenters.length > 1 && (
                      <>
                        {employeeData.costCenters.slice(1).map((center, index) => (
                          <TableCell key={index + 1} align="center">$0.00</TableCell>
                        ))}
                      </>
                    )}
                    <TableCell align="right"><strong>${(employeeData.officeSupplies || 0).toFixed(2)}</strong></TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell align="center" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                      Oxford House E.E.S.
                      <IconButton 
                        size="small" 
                        onClick={() => handleEditSummaryItem('eesReceipt', 'Oxford House E.E.S.')}
                        sx={{ p: 0.5 }}
                        title="Edit Oxford House E.E.S. Amount"
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                    <TableCell align="right">
                      ${(employeeData.eesReceipt || 0).toFixed(2)}
                    </TableCell>
                    {employeeData.costCenters.length > 1 && (
                      <>
                        {employeeData.costCenters.slice(1).map((center, index) => (
                          <TableCell key={index + 1} align="center">$0.00</TableCell>
                        ))}
                      </>
                    )}
                    <TableCell align="right"><strong>${(employeeData.eesReceipt || 0).toFixed(2)}</strong></TableCell>
                  </TableRow>
                  
                  {/* OTHER EXPENSES Section */}
                  <TableRow>
                    <TableCell colSpan={employeeData.costCenters.length + 2} align="center" sx={{ fontWeight: 'bold', bgcolor: 'grey.100' }}>
                      Other Expenses
                    </TableCell>
                  </TableRow>
                  {(employeeData.otherExpenses && employeeData.otherExpenses.length > 0) ? (
                    employeeData.otherExpenses.map((entry, index) => {
                      return (
                        <TableRow key={entry.id || index}>
                          <TableCell align="center" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                            <Tooltip title={entry.description || 'No description'} arrow>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                Other Expenses {index + 1}
                                {entry.description && (
                                  <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                                    ({entry.description.length > 30 ? entry.description.substring(0, 30) + '...' : entry.description})
                                  </Typography>
                                )}
                              </Box>
                            </Tooltip>
                            <IconButton 
                              size="small" 
                              onClick={() => handleEditSummaryItem('other', 'Other Expenses', index)}
                              sx={{ p: 0.5 }}
                              title="Edit Other Expenses Entry"
                            >
                              <EditIcon fontSize="small" />
                            </IconButton>
                            <IconButton 
                              size="small" 
                              onClick={async () => {
                                if (window.confirm('Are you sure you want to delete this Other Expenses entry?')) {
                                  const updatedData = { ...employeeData };
                                  if (updatedData.otherExpenses) {
                                    updatedData.otherExpenses = updatedData.otherExpenses.filter((_, i) => i !== index);
                                    updatedData.other = updatedData.otherExpenses.reduce((sum, e) => sum + e.amount, 0);
                                    setEmployeeData(updatedData);
                                    
                                    const reportData: any = {
                                      ...updatedData,
                                      otherExpenses: updatedData.otherExpenses,
                                      other: updatedData.other
                                    };
                                    const { apiPut } = await import('./services/rateLimitedApi');
                                    await apiPut(`/api/expense-reports/${employeeId}/${currentMonth}/${currentYear}/summary`, { reportData });
                                    window.location.reload();
                                  }
                                }
                              }}
                              sx={{ p: 0.5 }}
                              title="Delete Other Expenses Entry"
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </TableCell>
                          <TableCell align="right">
                            ${entry.amount.toFixed(2)}
                          </TableCell>
                          {employeeData.costCenters.length > 1 && (
                            <>
                              {employeeData.costCenters.slice(1).map((center, idx) => (
                                <TableCell key={idx + 1} align="center">$0.00</TableCell>
                              ))}
                            </>
                          )}
                          <TableCell align="right">
                            <strong>${entry.amount.toFixed(2)}</strong>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  ) : (
                    <TableRow>
                      <TableCell align="center" colSpan={employeeData.costCenters.length + 2}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="body2" color="text.secondary">No other expenses added</Typography>
                          <Button
                            size="small"
                            variant="outlined"
                            startIcon={<AddIcon />}
                            onClick={() => handleEditSummaryItem('other', 'Other Expenses')}
                          >
                            Add Other Expense
                          </Button>
                        </Box>
                      </TableCell>
                    </TableRow>
                  )}
                  {(employeeData.otherExpenses && employeeData.otherExpenses.length > 0) && (
                    <TableRow>
                      <TableCell align="center" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<AddIcon />}
                          onClick={() => handleEditSummaryItem('other', 'Other Expenses')}
                        >
                          Add Other Expense
                        </Button>
                      </TableCell>
                      <TableCell align="right" colSpan={employeeData.costCenters.length + 1}>
                        <strong>Total: ${((employeeData.otherExpenses?.reduce((sum, e) => sum + e.amount, 0)) || 0).toFixed(2)}</strong>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
            </Box>

            {/* Summary totals section */}
            <Box sx={{ mt: 4 }}>
              <TableContainer component={Paper} sx={{ width: '100%' }}>
                <Table size="small" sx={{ width: '100%', tableLayout: 'fixed' }}>
                  <TableHead>
                    <TableRow sx={{ bgcolor: 'grey.100' }}>
                      <TableCell sx={{ fontWeight: 'bold', width: '70%' }}>SUBTOTALS (by cost center)</TableCell>
                      <TableCell align="center" sx={{ width: '30%' }}>TOTAL</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {employeeData.costCenters.map((center, index) => (
                      <TableRow key={index}>
                        <TableCell>Cost Center #{index + 1}: {center}</TableCell>
                        <TableCell align="right">
                          <strong>${index === 0 ? totalExpenses.toFixed(2) : '0.00'}</strong>
                        </TableCell>
                      </TableRow>
                    ))}
                    {employeeData.costCenters.length < 5 && (
                      <TableRow>
                        <TableCell>Cost Centers #{employeeData.costCenters.length + 1}-#5</TableCell>
                        <TableCell align="center">$0.00</TableCell>
                      </TableRow>
                    )}
                    <TableRow sx={{ bgcolor: 'grey.200', fontWeight: 'bold' }}>
                      <TableCell>Overall Subtotal:</TableCell>
                      <TableCell align="right"><strong>${totalExpenses.toFixed(2)}</strong></TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Less Cash Advance:</TableCell>
                      <TableCell align="center">$0.00</TableCell>
                    </TableRow>
                    <TableRow sx={{ bgcolor: 'grey.300', fontWeight: 'bold' }}>
                      <TableCell>GRAND TOTAL REQUESTED:</TableCell>
                      <TableCell align="right"><strong>${totalExpenses.toFixed(2)}</strong></TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>

            {/* Footer section with base address */}
            <Box sx={{ mt: 6 }}>
              <Box sx={{ display: 'flex', gap: 4 }}>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="body1"><strong>Payable to:</strong> {employeeData.name}</Typography>
                  <Typography variant="body1"><strong>Base Address #1:</strong> {employeeData.baseAddress.split(',')[0]}</Typography>
                  <Typography variant="body1"><strong>City, State Zip:</strong> {employeeData.baseAddress.split(',')[1]?.trim()}</Typography>
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Box sx={{ border: '1px solid #ccc', p: 2, borderRadius: 1, minHeight: 80 }}>
                    <Typography variant="body1"><strong>Signature:</strong></Typography>
                    <Box sx={{ 
                      mt: 1, 
                      mb: 2, 
                      minHeight: 40, 
                      border: '1px solid #ccc', 
                      borderRadius: 1,
                      bgcolor: 'white',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      position: 'relative',
                      overflow: 'hidden'
                    }}>
                      {signatureImage ? (
                        <img 
                          src={signatureImage} 
                          alt="Employee Signature" 
                          style={{ 
                            maxHeight: '100%', 
                            maxWidth: '100%',
                            objectFit: 'contain'
                          }} 
                        />
                      ) : (
                        <Typography variant="caption" color="textSecondary">
                          Upload signature using "Signature Capture" button
                        </Typography>
                      )}
                    </Box>
                    <Typography variant="body1" component="div"><strong>Date Signed:</strong> {employeeData.dateCompleted}</Typography>
                  </Box>
                </Box>
              </Box>
            </Box>
          </CardContent>
        </Card>
      </TabPanel>

      {/* Mileage Entries Tab */}
      <TabPanel value={activeTab} index={2}>
        <Card variant="outlined">
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Box>
                <Typography variant="h5" gutterBottom sx={{ fontWeight: 'bold' }}>
                  Mileage Entries
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  Enter mileage data for each day. The system will automatically track locations, miles traveled, and calculate reimbursement.
                </Typography>
              </Box>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => {
                  setEditingMileageEntry(null);
                  setMileageFormOpen(true);
                }}
                sx={{ ml: 2 }}
              >
                Add Mileage Entry
              </Button>
            </Box>
            
            <TableContainer component={Paper}>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: 'grey.100' }}>
                    <TableCell sx={{ border: '1px solid #ccc', p: 1 }}><strong>Date</strong></TableCell>
                    <TableCell sx={{ border: '1px solid #ccc', p: 1 }}><strong>Start Location</strong></TableCell>
                    <TableCell sx={{ border: '1px solid #ccc', p: 1 }}><strong>End Location</strong></TableCell>
                    <TableCell align="center" sx={{ border: '1px solid #ccc', p: 1 }}><strong>Miles</strong></TableCell>
                    <TableCell align="center" sx={{ border: '1px solid #ccc', p: 1 }}><strong>Mileage ($)</strong></TableCell>
                    <TableCell sx={{ border: '1px solid #ccc', p: 1 }}><strong>Cost Center</strong></TableCell>
                    <TableCell sx={{ border: '1px solid #ccc', p: 1 }}><strong>Actions</strong></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rawMileageEntries
                    .filter((entry: any) => {
                      // Use string-based date comparison to avoid timezone issues
                      const entryDateStr = normalizeDate(entry.date);
                      const entryDateParts = entryDateStr.split('-');
                      if (entryDateParts.length !== 3) return false;
                      const entryYear = parseInt(entryDateParts[0], 10);
                      const entryMonth = parseInt(entryDateParts[1], 10);
                      return entryMonth === currentMonth && entryYear === currentYear;
                    })
                    .map((entry: any) => {
                      const mileageAmount = (entry.miles || 0) * 0.445; // Standard mileage rate ($0.445 per mile)
                      const startLocation = entry.startLocationName || entry.startLocation || '';
                      const endLocation = entry.endLocationName || entry.endLocation || '';
                      
                      return (
                        <TableRow key={entry.id} sx={{ bgcolor: entry.needsRevision ? 'warning.light' : 'transparent' }}>
                          <TableCell sx={{ border: '1px solid #ccc', p: 1 }}>
                            {(() => {
                              // Use normalizeDate to get YYYY-MM-DD format, then parse and format consistently
                              const normalizedDate = normalizeDate(entry.date);
                              const dateParts = normalizedDate.split('-');
                              if (dateParts.length === 3) {
                                const [year, month, day] = dateParts.map(Number);
                                const date = new Date(year, month - 1, day);
                                return date.toLocaleDateString('en-US', {
                                  month: '2-digit',
                                  day: '2-digit',
                                  year: '2-digit'
                                });
                              }
                              // Fallback to original formatting if normalization fails
                              try {
                                const date = new Date(entry.date);
                                return date.toLocaleDateString('en-US', {
                                  month: '2-digit',
                                  day: '2-digit',
                                  year: '2-digit'
                                });
                              } catch {
                                return entry.date;
                              }
                            })()}
                            {entry.needsRevision && (
                              <Chip label="⚠️ Revision Requested" size="small" sx={{ ml: 1, bgcolor: 'warning.main', color: 'white' }} />
                            )}
                          </TableCell>
                          <TableCell sx={{ border: '1px solid #ccc', p: 1 }}>
                            {startLocation.toLowerCase().includes('odometer:') ? (entry.startLocationName || 'N/A') : (startLocation || 'N/A')}
                          </TableCell>
                          <TableCell sx={{ border: '1px solid #ccc', p: 1 }}>
                            {endLocation.toLowerCase().includes('odometer:') ? (entry.endLocationName || 'N/A') : (endLocation || 'N/A')}
                          </TableCell>
                          <TableCell align="center" sx={{ border: '1px solid #ccc', p: 1 }}>
                            {Math.round(entry.miles || 0)}
                          </TableCell>
                          <TableCell align="center" sx={{ border: '1px solid #ccc', p: 1 }}>
                            ${mileageAmount.toFixed(2)}
                          </TableCell>
                          <TableCell sx={{ border: '1px solid #ccc', p: 1 }}>
                            {entry.costCenter || employeeData.costCenters[0] || 'N/A'}
                          </TableCell>
                          <TableCell sx={{ border: '1px solid #ccc', p: 1 }}>
                            <Box sx={{ display: 'flex', gap: 0.5 }}>
                              <IconButton
                                size="small"
                                onClick={() => {
                                  setEditingMileageEntry(entry);
                                  setMileageFormOpen(true);
                                }}
                                sx={{ color: 'primary.main' }}
                                title="Edit mileage entry"
                              >
                                <EditIcon fontSize="small" />
                              </IconButton>
                              <IconButton
                                size="small"
                                onClick={() => handleMileageEntryDelete(entry.id)}
                                sx={{ color: 'error.main' }}
                                title="Delete mileage entry"
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </Box>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  {rawMileageEntries.filter((entry: any) => {
                    // Use string-based date comparison to avoid timezone issues (same as main filter)
                    const entryDateStr = normalizeDate(entry.date);
                    const entryDateParts = entryDateStr.split('-');
                    if (entryDateParts.length !== 3) return false;
                    const entryYear = parseInt(entryDateParts[0], 10);
                    const entryMonth = parseInt(entryDateParts[1], 10);
                    return entryMonth === currentMonth && entryYear === currentYear;
                  }).length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} align="center" sx={{ border: '1px solid #ccc', p: 3 }}>
                        <Typography variant="body2" color="textSecondary">
                          No mileage entries found. Use the mobile app or Data Entry tab to add mileage.
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
            
            <Box sx={{ mt: 3, p: 2, bgcolor: 'info.light', borderRadius: 1 }}>
              <Typography variant="body2">
                <strong>💡 Tip:</strong> You can add, edit, or delete mileage entries directly from this page. 
                Click "Add Mileage Entry" to create a new entry, or use the edit/delete icons to modify existing entries.
              </Typography>
            </Box>
          </CardContent>
        </Card>
        
        {/* Mileage Entry Form (Create or Edit) */}
        {employeeData && (
          <MileageEntryForm
            open={mileageFormOpen}
            onClose={() => {
              setMileageFormOpen(false);
              setEditingMileageEntry(null);
            }}
            onSave={handleMileageEntrySave}
            employee={{
              id: employeeData.employeeId,
              name: employeeData.name,
              email: '', // Not needed for form
              password: '', // Not needed for form
              oxfordHouseId: '',
              position: '',
              phoneNumber: '',
              baseAddress: '',
              defaultCostCenter: employeeData.costCenters[0] || '',
              selectedCostCenters: employeeData.costCenters || [],
              costCenters: employeeData.costCenters || []
            } as any}
            initialData={editingMileageEntry ? {
              id: editingMileageEntry.id,
              employeeId: editingMileageEntry.employeeId || employeeData.employeeId,
              date: new Date(editingMileageEntry.date).toISOString().split('T')[0],
              startLocation: editingMileageEntry.startLocation || editingMileageEntry.startLocationName || '',
              endLocation: editingMileageEntry.endLocation || editingMileageEntry.endLocationName || '',
              purpose: editingMileageEntry.purpose || '',
              miles: editingMileageEntry.miles || 0,
              startingOdometer: editingMileageEntry.odometerReading || 0,
              notes: editingMileageEntry.notes || '',
              hoursWorked: editingMileageEntry.hoursWorked || 0,
              isGpsTracked: editingMileageEntry.isGpsTracked || false,
              costCenter: editingMileageEntry.costCenter || employeeData.costCenters[0] || ''
            } : {
              employeeId: employeeData.employeeId,
              date: new Date(currentYear, currentMonth - 1, new Date().getDate()).toISOString().split('T')[0],
              startLocation: '',
              endLocation: '',
              purpose: '',
              miles: 0,
              startingOdometer: 0,
              notes: '',
              hoursWorked: 0,
              isGpsTracked: false,
              costCenter: employeeData.costCenters[0] || ''
            }}
            mode={editingMileageEntry ? 'edit' : 'create'}
          />
        )}
      </TabPanel>

      {/* Daily Descriptions Tab */}
      <TabPanel value={activeTab} index={3}>
        <Card variant="outlined">
          <CardContent>
            <Typography variant="h5" gutterBottom sx={{ fontWeight: 'bold' }}>
              Daily Activity Descriptions
            </Typography>
            <Typography variant="body2" color="textSecondary" sx={{ mb: 3 }}>
              Enter or edit descriptions of your daily work activities. These are separate from driving descriptions.
            </Typography>
            
            <TableContainer component={Paper}>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: 'grey.100' }}>
                    {supervisorMode && (
                      <TableCell padding="checkbox" sx={{ border: '1px solid #ccc', p: 1, width: '3%' }}>
                        <Typography variant="caption" sx={{ fontSize: '0.7rem', fontWeight: 'bold', mb: 0.5, display: 'block' }}>
                          Select for Revision
                        </Typography>
                        <Checkbox
                          indeterminate={selectedTimeTrackingItems.size > 0 && selectedTimeTrackingItems.size < employeeData.dailyEntries.length}
                          checked={employeeData.dailyEntries.length > 0 && selectedTimeTrackingItems.size === employeeData.dailyEntries.length}
                          onChange={(e) => {
                            if (e.target.checked) {
                              const allIds = new Set(employeeData.dailyEntries.map((_, idx) => `time-${idx}`));
                              setSelectedTimeTrackingItems(allIds);
                            } else {
                              setSelectedTimeTrackingItems(new Set());
                            }
                          }}
                          size="small"
                        />
                      </TableCell>
                    )}
                    <TableCell sx={{ border: '1px solid #ccc', p: 1, width: supervisorMode ? '13%' : '15%' }}><strong>Date</strong></TableCell>
                    <TableCell sx={{ border: '1px solid #ccc', p: 1 }}><strong>Activity Description</strong></TableCell>
                    <TableCell sx={{ border: '1px solid #ccc', p: 1, whiteSpace: 'nowrap', width: '140px' }}><strong>Stayed overnight</strong></TableCell>
                    <TableCell sx={{ border: '1px solid #ccc', p: 1, whiteSpace: 'nowrap', width: '80px' }}><strong>Day Off</strong></TableCell>
                    <TableCell sx={{ border: '1px solid #ccc', p: 1, width: '15%' }}><strong>Cost Center</strong></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {employeeData && employeeData.dailyEntries && employeeData.dailyEntries.map((entry: any, index: number) => {
                    // Find the corresponding daily description
                    const entryDateStr = normalizeDate(entry.date);
                    const dayDescription = dailyDescriptions.find((desc: any) => {
                      const descDateStr = normalizeDate(desc.date);
                      return entryDateStr === descDateStr;
                    });
                    
                    const timeItemId = `time-${index}`;
                    const isTimeSelected = selectedTimeTrackingItems.has(timeItemId);
                    
                    return (
                      <TableRow key={index}>
                        {supervisorMode && (
                          <TableCell padding="checkbox" sx={{ border: '1px solid #ccc', p: 1 }}>
                            <Checkbox
                              checked={isTimeSelected}
                              onChange={(e) => {
                                const newSet = new Set(selectedTimeTrackingItems);
                                if (e.target.checked) {
                                  newSet.add(timeItemId);
                                } else {
                                  newSet.delete(timeItemId);
                                }
                                setSelectedTimeTrackingItems(newSet);
                              }}
                              size="small"
                            />
                          </TableCell>
                        )}
                        <TableCell sx={{ border: '1px solid #ccc', p: 1 }}>{entry.date}</TableCell>
                        <TableCell sx={{ border: '1px solid #ccc', p: 1 }}>
                          {dailyDescriptionOptions.length > 0 && !dayDescription?.dayOff && !isAdminView ? (
                            <Autocomplete
                              freeSolo={false}
                              options={dailyDescriptionOptions.map((o) => o.label).filter((l) => l !== 'Other')}
                              value={(() => {
                                const allowed = dailyDescriptionOptions.map((o) => o.label).filter((l) => l !== 'Other');
                                const current = dayDescription?.description || '';
                                return allowed.includes(current) ? current : '';
                              })()}
                              onChange={(_e, value) => {
                                const val = typeof value === 'string' ? value : (value ?? '');
                                try {
                                  const newDescriptions = [...dailyDescriptions];
                                  const entryDateStr = normalizeDate(entry.date);
                                  const existingIndex = newDescriptions.findIndex((desc: any) => normalizeDate(desc.date) === entryDateStr);
                                  const hasDescription = val.trim().length > 0;
                                  let descToSave: any;
                                  if (existingIndex >= 0) {
                                    newDescriptions[existingIndex] = { ...newDescriptions[existingIndex], description: val, dayOff: hasDescription ? false : newDescriptions[existingIndex].dayOff, dayOffType: hasDescription ? null : newDescriptions[existingIndex].dayOffType };
                                    descToSave = newDescriptions[existingIndex];
                                  } else {
                                    descToSave = { id: `desc-${employeeId}-${entryDateStr}`, employeeId, date: entryDateStr, description: val, costCenter: entry.costCenter || employeeData.costCenters[0] || '', stayedOvernight: false, dayOff: false, dayOffType: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
                                    newDescriptions.push(descToSave);
                                  }
                                  setDailyDescriptions(newDescriptions);
                                  const dateToSave = normalizeDate(descToSave.date);
                                  setTimeout(async () => {
                                    try {
                                      const response = await fetch(`${API_BASE_URL}/api/daily-descriptions`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: descToSave.id, employeeId: descToSave.employeeId, date: dateToSave, description: descToSave.description || '', costCenter: descToSave.costCenter || '', stayedOvernight: descToSave.stayedOvernight || false, dayOff: descToSave.dayOff || false, dayOffType: descToSave.dayOffType || null }) });
                                      if (response.ok) syncDescriptionToCostCenter(descToSave, new Date(entry.date));
                                      else debugError('Error saving description:', await response.text());
                                    } catch (error) { debugError('Error saving description:', error); }
                                  }, 500);
                                } catch (error) { debugError('Error saving description:', error); }
                              }}
                              renderInput={(params) => (
                                <TextField {...params} size="small" placeholder="Select description..." />
                              )}
                              sx={{ minWidth: 180 }}
                            />
                          ) : (
                            <TextField
                              value={dayDescription?.description || ''}
                              onChange={async (e) => {
                                try {
                                  const newDescriptions = [...dailyDescriptions];
                                  const entryDateStr = normalizeDate(entry.date);
                                  const existingIndex = newDescriptions.findIndex((desc: any) => normalizeDate(desc.date) === entryDateStr);
                                  let descToSave: any;
                                  const hasDescription = e.target.value.trim().length > 0;
                                  if (existingIndex >= 0) {
                                    newDescriptions[existingIndex] = {
                                      ...newDescriptions[existingIndex],
                                      description: e.target.value,
                                      dayOff: hasDescription ? false : newDescriptions[existingIndex].dayOff,
                                      dayOffType: hasDescription ? null : newDescriptions[existingIndex].dayOffType
                                    };
                                    descToSave = newDescriptions[existingIndex];
                                  } else {
                                    descToSave = {
                                      id: `desc-${employeeId}-${entryDateStr}`,
                                      employeeId: employeeId,
                                      date: entryDateStr,
                                      description: e.target.value,
                                      costCenter: entry.costCenter || employeeData.costCenters[0] || '',
                                      stayedOvernight: false,
                                      dayOff: false,
                                      dayOffType: null,
                                      createdAt: new Date().toISOString(),
                                      updatedAt: new Date().toISOString()
                                    };
                                    newDescriptions.push(descToSave);
                                  }
                                  setDailyDescriptions(newDescriptions);
                                  const dateToSave = normalizeDate(descToSave.date);
                                  setTimeout(async () => {
                                    try {
                                      const response = await fetch(`${API_BASE_URL}/api/daily-descriptions`, {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({
                                          id: descToSave.id,
                                          employeeId: descToSave.employeeId,
                                          date: dateToSave,
                                          description: descToSave.description || '',
                                          costCenter: descToSave.costCenter || '',
                                          stayedOvernight: descToSave.stayedOvernight || false,
                                          dayOff: descToSave.dayOff || false,
                                          dayOffType: descToSave.dayOffType || null
                                        })
                                      });
                                      if (response.ok) syncDescriptionToCostCenter(descToSave, new Date(entry.date));
                                      else debugError('Error saving description:', await response.text());
                                    } catch (error) {
                                      debugError('Error saving description:', error);
                                    }
                                  }, 500);
                                } catch (error) {
                                  debugError('Error saving description:', error);
                                }
                              }}
                              fullWidth
                              multiline
                              minRows={1}
                              maxRows={15}
                              size="small"
                              sx={{
                                '& .MuiInputBase-root': { alignItems: 'flex-start', minHeight: 'auto' },
                                '& .MuiInputBase-input': { whiteSpace: 'pre-wrap', wordBreak: 'break-word', overflowWrap: 'break-word', padding: '8px !important', lineHeight: 1.5, minHeight: 'auto' },
                                '& .MuiInputBase-inputMultiline': { overflow: 'auto', resize: 'vertical' }
                              }}
                              placeholder={dayDescription?.dayOff ? `${dayDescription?.dayOffType || 'Day Off'}` : "Describe daily activities (e.g., 'Meetings, phone calls, site visits')"}
                              disabled={isAdminView || dayDescription?.dayOff}
                            />
                          )}
                        </TableCell>
                        <TableCell sx={{ border: '1px solid #ccc', p: 1, textAlign: 'center', whiteSpace: 'nowrap', width: '140px' }}>
                          <Checkbox
                            checked={dayDescription?.stayedOvernight || false}
                            onChange={async (e) => {
                              try {
                                // Update or create daily description
                                const newDescriptions = [...dailyDescriptions];
                                const entryDateStr = normalizeDate(entry.date);
                                const existingIndex = newDescriptions.findIndex((desc: any) => {
                                  const descDateStr = normalizeDate(desc.date);
                                  return entryDateStr === descDateStr;
                                });
                                
                                let descToSave: any;
                                
                                if (existingIndex >= 0) {
                                  // Update existing
                                  newDescriptions[existingIndex] = {
                                    ...newDescriptions[existingIndex],
                                    stayedOvernight: e.target.checked
                                  };
                                  descToSave = newDescriptions[existingIndex];
                                } else {
                                  // Create new - use normalized date string
                                  descToSave = {
                                    id: `desc-${employeeId}-${entryDateStr}`,
                                    employeeId: employeeId,
                                    date: entryDateStr, // Use normalized date string
                                    description: '',
                                    costCenter: entry.costCenter || employeeData.costCenters[0] || '',
                                    stayedOvernight: e.target.checked,
                                    dayOff: false,
                                    createdAt: new Date().toISOString(),
                                    updatedAt: new Date().toISOString()
                                  };
                                  newDescriptions.push(descToSave);
                                }
                                
                                setDailyDescriptions(newDescriptions);
                                
                                // Save to backend first
                                const dateToSave = normalizeDate(descToSave.date);
                                const response = await fetch(`${API_BASE_URL}/api/daily-descriptions`, {
                                  method: 'POST',
                                  headers: {
                                    'Content-Type': 'application/json',
                                  },
                                  body: JSON.stringify({
                                    id: descToSave.id,
                                    employeeId: descToSave.employeeId,
                                    date: dateToSave,
                                    description: descToSave.description || '',
                                    costCenter: descToSave.costCenter || '',
                                    stayedOvernight: descToSave.stayedOvernight || false,
                                    dayOff: descToSave.dayOff || false,
                                    dayOffType: descToSave.dayOffType || null
                                  })
                                });
                                
                                if (!response.ok) {
                                  const errorText = await response.text();
                                  debugError('Error saving stayed overnight status:', response.status, errorText);
                                } else {
                                  // Only sync to cost center screen AFTER successful save
                                  syncDescriptionToCostCenter(descToSave, new Date(entry.date));
                                }
                              } catch (error) {
                                debugError('Error saving stayed overnight status:', error);
                              }
                            }}
                            disabled={isAdminView}
                          />
                        </TableCell>
                        <TableCell sx={{ border: '1px solid #ccc', p: 1, whiteSpace: 'nowrap', width: '80px' }}>
                          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, alignItems: 'center' }}>
                            <Checkbox
                              checked={dayDescription?.dayOff || false}
                              disabled={isAdminView || (!dayDescription?.dayOff && dayDescription?.description && dayDescription.description.trim().length > 0)}
                              onChange={async (e) => {
                                try {
                                  // Update or create daily description
                                  const newDescriptions = [...dailyDescriptions];
                                  // Normalize entry date to YYYY-MM-DD format
                                  const entryDateStr = normalizeDate(entry.date);
                                  const existingIndex = newDescriptions.findIndex((desc: any) => {
                                    const descDateStr = normalizeDate(desc.date);
                                    return entryDateStr === descDateStr;
                                  });
                                  
                                  let descToSave: any;
                                  
                                  if (existingIndex >= 0) {
                                    // Update existing
                                    const dayOffType = e.target.checked ? (newDescriptions[existingIndex].dayOffType || 'Day Off') : null;
                                    // Check if the current description is a day off type
                                    const currentDesc = newDescriptions[existingIndex].description || '';
                                    const isDayOffType = currentDesc === 'Day Off' || currentDesc === 'PTO' || currentDesc === 'Sick Day' || currentDesc === 'Holiday' || currentDesc === 'Unpaid Leave';
                                    
                                    newDescriptions[existingIndex] = {
                                      ...newDescriptions[existingIndex],
                                      dayOff: e.target.checked,
                                      dayOffType: dayOffType,
                                      // Clear description if unchecking, or if it was a day off type
                                      description: e.target.checked ? (dayOffType || 'Day Off') : (isDayOffType ? '' : newDescriptions[existingIndex].description)
                                    };
                                    descToSave = newDescriptions[existingIndex];
                                  } else {
                                    // Create new - use normalized date string (YYYY-MM-DD) instead of ISO string
                                    const dayOffType = e.target.checked ? 'Day Off' : null;
                                    descToSave = {
                                      id: `desc-${employeeId}-${entryDateStr}`,
                                      employeeId: employeeId,
                                      date: entryDateStr, // Use normalized date string
                                      description: e.target.checked ? (dayOffType || 'Day Off') : '',
                                      costCenter: entry.costCenter || employeeData.costCenters[0] || '',
                                      dayOff: e.target.checked,
                                      dayOffType: dayOffType,
                                      stayedOvernight: false,
                                      createdAt: new Date().toISOString(),
                                      updatedAt: new Date().toISOString()
                                    };
                                    newDescriptions.push(descToSave);
                                  }
                                  
                                  // Update state first for immediate UI feedback
                                  setDailyDescriptions(newDescriptions);
                                  
                                  // Also update the corresponding entry in dailyEntries (for cost center screen)
                                  syncDescriptionToCostCenter(descToSave, new Date(entry.date));
                                  
                                  // Immediately save to backend - use normalized date string
                                  const dateToSave = normalizeDate(descToSave.date);
                                  const response = await fetch(`${API_BASE_URL}/api/daily-descriptions`, {
                                    method: 'POST',
                                    headers: {
                                      'Content-Type': 'application/json',
                                    },
                                    body: JSON.stringify({
                                      id: descToSave.id,
                                      employeeId: descToSave.employeeId,
                                      date: dateToSave, // Use normalized date string
                                      description: descToSave.description || '',
                                      costCenter: descToSave.costCenter || '',
                                      stayedOvernight: descToSave.stayedOvernight || false,
                                      dayOff: descToSave.dayOff || false,
                                      dayOffType: descToSave.dayOffType || null
                                    })
                                  });
                                  
                                  if (!response.ok) {
                                    const errorText = await response.text();
                                    debugError('Error saving day off status:', response.status, errorText);
                                  }
                                } catch (error) {
                                  debugError('Error saving day off status:', error);
                                }
                              }}
                            />
                            {Boolean(dayDescription?.dayOff) && (
                              <FormControl size="small" sx={{ minWidth: 120 }}>
                                <Select
                                  value={dayDescription?.dayOffType || 'Day Off'}
                                  onChange={async (e) => {
                                    try {
                                      const newDescriptions = [...dailyDescriptions];
                                      const entryDateStr = normalizeDate(entry.date);
                                      const existingIndex = newDescriptions.findIndex((desc: any) => {
                                        const descDateStr = normalizeDate(desc.date);
                                        return entryDateStr === descDateStr;
                                      });
                                      
                                      if (existingIndex >= 0) {
                                        const dayOffType = e.target.value;
                                        newDescriptions[existingIndex] = {
                                          ...newDescriptions[existingIndex],
                                          dayOffType: dayOffType,
                                          description: dayOffType // Update description to match day off type
                                        };
                                        
                                        setDailyDescriptions(newDescriptions);
                                        
                                        // Also update the corresponding entry in dailyEntries (for cost center screen)
                                        const descToSave = newDescriptions[existingIndex];
                                        syncDescriptionToCostCenter(descToSave, new Date(entry.date));
                                        
                                        // Save to backend
                                        const dateToSave = normalizeDate(descToSave.date);
                                        const response = await fetch(`${API_BASE_URL}/api/daily-descriptions`, {
                                          method: 'POST',
                                          headers: {
                                            'Content-Type': 'application/json',
                                          },
                                          body: JSON.stringify({
                                            id: descToSave.id,
                                            employeeId: descToSave.employeeId,
                                            date: dateToSave,
                                            description: descToSave.description || '',
                                            costCenter: descToSave.costCenter || '',
                                            stayedOvernight: descToSave.stayedOvernight || false,
                                            dayOff: descToSave.dayOff || false,
                                            dayOffType: descToSave.dayOffType || null
                                          })
                                        });
                                        
                                        if (!response.ok) {
                                          const errorText = await response.text();
                                          debugError('Error saving day off type:', response.status, errorText);
                                        }
                                      }
                                    } catch (error) {
                                      debugError('Error saving day off type:', error);
                                    }
                                  }}
                                  disabled={isAdminView}
                                >
                                  <MenuItem value="Day Off">Day Off</MenuItem>
                                  <MenuItem value="PTO">PTO</MenuItem>
                                  <MenuItem value="Sick Day">Sick Day</MenuItem>
                                  <MenuItem value="Holiday">Holiday</MenuItem>
                                  <MenuItem value="Unpaid Leave">Unpaid Leave</MenuItem>
                                </Select>
                              </FormControl>
                            )}
                          </Box>
                        </TableCell>
                        <TableCell sx={{ border: '1px solid #ccc', p: 1 }}>
                          {entry.costCenter || employeeData.costCenters[0] || 'N/A'}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
            
            <Box sx={{ mt: 3, p: 2, bgcolor: 'info.light', borderRadius: 1 }}>
              <Typography variant="body2">
                <strong>💡 Tip:</strong> Daily descriptions are for general work activities. 
                Driving descriptions are automatically generated from your mileage entries.
              </Typography>
            </Box>
          </CardContent>
        </Card>
      </TabPanel>

      {/* Cost Ctr #1 Travel Tab */}
      {employeeData.costCenters.length >= 1 && (
        <TabPanel value={activeTab} index={4}>
        <Card variant="outlined">
          <CardContent>
            {/* Header matching spreadsheet */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
              <Box>
                <Typography variant="h6" component="div"><strong>Name:</strong> {employeeData.name}</Typography>
                <Typography variant="h6" component="div"><strong>Cost Center:</strong> {employeeData.costCenters[0] || 'EMPLOYEE_COST_CENTER_1'}</Typography>
              </Box>
              <Box>
                <Typography variant="h6" component="div"><strong>Month:</strong> {monthName} / {reportYear}</Typography>
                <Typography variant="h6" component="div"><strong>Date Completed:</strong> {employeeData.dateCompleted}</Typography>
              </Box>
            </Box>

            <Box sx={{ mb: 3, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
              <Typography variant="h6" gutterBottom component="div"><strong>Mileage Rate:</strong> $0.445</Typography>
              <Typography variant="body2" color="textSecondary" sx={{ mb: 1 }}>
                * Enter locations, full physical addresses (in parentheses), and brief description of all work-related travel. 
                Also, list any work done from BA or current location.
              </Typography>
              <Typography variant="body2" color="textSecondary">
                * Per Diem: $35 max per day, $350 max per month. No receipts required when rules are met.
              </Typography>
            </Box>

            {/* Daily travel table */}
            <TableContainer component={Paper} sx={{ mt: 2 }}>
              <Table size="small" sx={{ tableLayout: 'fixed', borderCollapse: 'collapse', width: '100%' }}>
                <TableHead>
                  <TableRow sx={{ bgcolor: 'grey.100' }}>
                    {supervisorMode && (
                      <TableCell padding="checkbox" sx={{ border: '1px solid #ccc', p: 1, width: '3%' }}>
                        <Typography variant="caption" sx={{ fontSize: '0.7rem', fontWeight: 'bold', mb: 0.5, display: 'block' }}>
                          Select for Revision
                        </Typography>
                        <Checkbox
                          indeterminate={selectedMileageItems.size > 0 && selectedMileageItems.size < employeeData.dailyEntries.length}
                          checked={employeeData.dailyEntries.length > 0 && selectedMileageItems.size === employeeData.dailyEntries.length}
                          onChange={(e) => {
                            if (e.target.checked) {
                              const allIds = new Set(employeeData.dailyEntries.map((_, idx) => `mileage-${idx}`));
                              setSelectedMileageItems(allIds);
                            } else {
                              setSelectedMileageItems(new Set());
                            }
                          }}
                          size="small"
                        />
                      </TableCell>
                    )}
                    <TableCell sx={{ border: '1px solid #ccc', p: 1, width: supervisorMode ? '9%' : '10%' }}><strong>DATE</strong></TableCell>
                    <TableCell sx={{ border: '1px solid #ccc', p: 1, width: supervisorMode ? '36%' : '40%' }}><strong>Description of Activity</strong></TableCell>
                    <TableCell align="center" sx={{ border: '1px solid #ccc', p: 1, width: '8%' }}><strong>Hours Worked</strong></TableCell>
                    <TableCell align="center" sx={{ border: '1px solid #ccc', p: 1, width: '8%' }}><strong>Odometer Start</strong></TableCell>
                    <TableCell align="center" sx={{ border: '1px solid #ccc', p: 1, width: '8%' }}><strong>Odometer End</strong></TableCell>
                    <TableCell align="center" sx={{ border: '1px solid #ccc', p: 1, width: '8%' }}><strong>Miles Traveled</strong></TableCell>
                    <TableCell align="center" sx={{ border: '1px solid #ccc', p: 1, width: '9%' }}><strong>Mileage ($)</strong></TableCell>
                    <TableCell align="center" sx={{ border: '1px solid #ccc', p: 1, width: '9%' }}><strong>Per Diem ($)</strong></TableCell>
                    <TableCell sx={{ border: '1px solid #ccc', p: 1, width: '8%' }}><strong>Actions</strong></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {employeeData.dailyEntries.map((entry, index) => {
                    // Check if any time entries for this date need revision
                    const entryDate = new Date(entry.date);
                    const needsRevisionFromRaw = rawTimeEntries.some((t: any) => {
                      const tDate = new Date(t.date);
                      return tDate.getUTCDate() === entryDate.getUTCDate() && 
                             tDate.getUTCMonth() === entryDate.getUTCMonth() && 
                             t.needsRevision;
                    });
                    
                    // Check if this item needs revision from revision notes
                    const itemId = `mileage-${index}`;
                    const needsRevisionFromNotes = itemsNeedingRevision.has(itemId);
                    const needsRevision = needsRevisionFromRaw || needsRevisionFromNotes;
                    
                    // Check if this day needs revision for time tracking
                    const day = entryDate.getUTCDate();
                    const dayNeedsRevision = daysNeedingRevision.has(day);
                    
                    // Check if this day is marked as day off
                    // Normalize dates to YYYY-MM-DD format for comparison
                    const entryDateStr = normalizeDate(entry.date);
                    const dayDescription = dailyDescriptions.find((desc: any) => {
                      const descDateStr = normalizeDate(desc.date);
                      return entryDateStr === descDateStr;
                    });
                    const isDayOff = dayDescription?.dayOff === true || dayDescription?.dayOff === 1;
                    
                    const isSelected = selectedMileageItems.has(itemId);
                    
                    return (
                      <TableRow 
                        key={index} 
                        sx={{ 
                          ...((needsRevision || dayNeedsRevision) && { 
                            bgcolor: '#ffcccc', // Light red background for items needing revision
                            '& td': {
                              bgcolor: '#ffcccc'
                            }
                          }),
                          ...(isDayOff && !needsRevision && !dayNeedsRevision && { 
                            bgcolor: '#e0e0e0',
                            opacity: 0.6,
                            '& td': {
                              bgcolor: '#e0e0e0',
                              opacity: 0.6
                            }
                          })
                        }}
                      >
                        {supervisorMode && (
                          <TableCell padding="checkbox" sx={{ border: '1px solid #ccc', p: 1 }}>
                            <Checkbox
                              checked={isSelected}
                              onChange={(e) => {
                                const newSet = new Set(selectedMileageItems);
                                if (e.target.checked) {
                                  newSet.add(itemId);
                                } else {
                                  newSet.delete(itemId);
                                }
                                setSelectedMileageItems(newSet);
                              }}
                              size="small"
                            />
                          </TableCell>
                        )}
                        <TableCell sx={{ border: '1px solid #ccc', p: 1 }}>
                          {entry.date}
                          {needsRevision && (
                            <Chip label="⚠️ Revision Requested" size="small" sx={{ ml: 1, bgcolor: 'warning.main', color: 'white' }} />
                          )}
                        </TableCell>
                      <TableCell sx={{ wordWrap: 'break-word', border: '1px solid #ccc', p: 1 }}>
                        {isDayOff ? (
                          // Day off - show day off type and make it uneditable
                          <Box 
                            sx={{ 
                              minHeight: '24px',
                              whiteSpace: 'pre-wrap',
                              color: 'text.secondary',
                              fontStyle: 'italic'
                            }}
                          >
                            {dayDescription?.dayOffType || 'Day Off'}
                          </Box>
                        ) : editingCell?.row === index && editingCell?.field === 'description' ? (
                          <TextField
                            value={editingValue}
                            onChange={(e) => setEditingValue(e.target.value)}
                            onBlur={handleCellSave}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                                // Ctrl+Enter or Cmd+Enter to save
                                handleCellSave();
                              } else if (e.key === 'Escape') {
                                handleTimesheetCellCancel();
                              }
                              // Allow Enter to create new lines
                            }}
                            autoFocus
                            multiline
                            minRows={6}
                            maxRows={20}
                            fullWidth
                            sx={{
                              '& .MuiInputBase-root': {
                                minHeight: '150px',
                                alignItems: 'flex-start',
                                paddingTop: '8px',
                              },
                              '& .MuiInputBase-input': {
                                whiteSpace: 'pre-wrap',
                                wordBreak: 'break-word',
                                overflowWrap: 'break-word',
                                lineHeight: '1.5',
                              }
                            }}
                          />
                        ) : (
                          <Box 
                            onClick={() => handleCellEdit(index, 'description', entry.description)}
                            sx={{ 
                              cursor: 'pointer', 
                              '&:hover': { bgcolor: 'grey.100' },
                              minHeight: '24px', // Ensure clickable area even when empty
                              whiteSpace: 'pre-wrap' // Preserve newlines and whitespace
                            }}
                          >
                            {entry.description || <span style={{ color: '#999', fontStyle: 'italic' }}>Click to add description</span>}
                          </Box>
                        )}
                      </TableCell>
                      <TableCell align="center" sx={{ border: '1px solid #ccc', p: 1 }}>
                        {editingCell?.row === index && editingCell?.field === 'hoursWorked' ? (
                          <TextField
                            value={editingValue}
                            onChange={(e) => setEditingValue(e.target.value)}
                            onBlur={handleCellSave}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleCellSave();
                              if (e.key === 'Escape') handleTimesheetCellCancel();
                            }}
                            autoFocus
                            size="small"
                            type="number"
                            sx={{ width: 60 }}
                          />
                        ) : (
                          <Box 
                            onClick={() => handleCellEdit(index, 'hoursWorked', entry.hoursWorked)}
                            sx={{ 
                              cursor: 'pointer', 
                              '&:hover': { bgcolor: 'grey.100' } 
                            }}
                          >
                            {typeof entry.hoursWorked === 'number' ? entry.hoursWorked.toFixed(1) : entry.hoursWorked}
                          </Box>
                        )}
                      </TableCell>
                      <TableCell align="center" sx={{ border: '1px solid #ccc', p: 1 }}>
                        {editingCell?.row === index && editingCell?.field === 'odometerStart' ? (
                          <TextField
                            value={editingValue}
                            onChange={(e) => setEditingValue(e.target.value)}
                            onBlur={handleCellSave}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleCellSave();
                              if (e.key === 'Escape') handleTimesheetCellCancel();
                            }}
                            autoFocus
                            size="small"
                            type="number"
                            sx={{ width: 80 }}
                          />
                        ) : (
                          <Box 
                            onClick={() => handleCellEdit(index, 'odometerStart', entry.odometerStart)}
                            sx={{ 
                              cursor: 'pointer', 
                              '&:hover': { bgcolor: 'grey.100' } 
                            }}
                          >
                            {entry.odometerStart || 0}
                          </Box>
                        )}
                      </TableCell>
                      <TableCell align="center" sx={{ border: '1px solid #ccc', p: 1 }}>
                        {editingCell?.row === index && editingCell?.field === 'odometerEnd' ? (
                          <TextField
                            value={editingValue}
                            onChange={(e) => setEditingValue(e.target.value)}
                            onBlur={handleCellSave}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleCellSave();
                              if (e.key === 'Escape') handleTimesheetCellCancel();
                            }}
                            autoFocus
                            size="small"
                            type="number"
                            sx={{ width: 80 }}
                          />
                        ) : (
                          <Box 
                            onClick={() => handleCellEdit(index, 'odometerEnd', entry.odometerEnd)}
                            sx={{ 
                              cursor: 'pointer', 
                              '&:hover': { bgcolor: 'grey.100' } 
                            }}
                          >
                            {entry.odometerEnd || 0}
                          </Box>
                        )}
                      </TableCell>
                      <TableCell align="center" sx={{ border: '1px solid #ccc', p: 1 }}>{Math.round(entry.milesTraveled || 0)}</TableCell>
                      <TableCell align="center" sx={{ border: '1px solid #ccc', p: 1 }}>${entry.mileageAmount.toFixed(2)}</TableCell>
                      <TableCell align="center" sx={{ border: '1px solid #ccc', p: 1 }}>
                        {editingCell?.row === index && editingCell?.field === 'perDiem' ? (
                          <TextField
                            value={editingValue}
                            onChange={(e) => setEditingValue(e.target.value)}
                            onBlur={handleCellSave}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleCellSave();
                              if (e.key === 'Escape') handleTimesheetCellCancel();
                            }}
                            autoFocus
                            size="small"
                            type="number"
                            inputProps={{ 
                              min: 0, 
                              max: 35, 
                              step: 0.01,
                              style: { 
                                MozAppearance: 'textfield',
                                WebkitAppearance: 'none',
                                appearance: 'none'
                              }
                            }}
                            sx={{ 
                              width: 60,
                              '& input[type=number]': {
                                MozAppearance: 'textfield',
                              },
                              '& input[type=number]::-webkit-outer-spin-button': {
                                WebkitAppearance: 'none',
                                margin: 0,
                              },
                              '& input[type=number]::-webkit-inner-spin-button': {
                                WebkitAppearance: 'none',
                                margin: 0,
                              },
                            }}
                          />
                        ) : (
                          <Box 
                            onClick={() => handleCellEdit(index, 'perDiem', entry.perDiem)}
                            sx={{ 
                              cursor: 'pointer', 
                              '&:hover': { bgcolor: 'grey.100' } 
                            }}
                          >
                            ${entry.perDiem.toFixed(2)}
                          </Box>
                        )}
                      </TableCell>
                      <TableCell sx={{ border: '1px solid #ccc', p: 1 }}>
                        <IconButton
                          size="small"
                          onClick={() => handleDeleteDayMileageEntries(entryDateStr)}
                          sx={{ color: 'error.main' }}
                          title="Delete entries for this date"
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                    );
                  })}
                  
                  {/* Subtotals row */}
                  <TableRow sx={{ bgcolor: 'grey.200', fontWeight: 'bold' }}>
                    {supervisorMode && <TableCell sx={{ border: '1px solid #ccc', p: 1 }} />}
                    <TableCell sx={{ border: '1px solid #ccc', p: 1 }}><strong>SUBTOTALS</strong></TableCell>
                    <TableCell sx={{ border: '1px solid #ccc', p: 1 }}></TableCell>
                    <TableCell align="center" sx={{ border: '1px solid #ccc', p: 1 }}><strong>{typeof employeeData.totalHours === 'number' ? employeeData.totalHours.toFixed(1) : employeeData.totalHours}</strong></TableCell>
                    <TableCell align="center" sx={{ border: '1px solid #ccc', p: 1 }}></TableCell>
                    <TableCell align="center" sx={{ border: '1px solid #ccc', p: 1 }}></TableCell>
                    <TableCell align="center" sx={{ border: '1px solid #ccc', p: 1 }}><strong>{employeeData.totalMiles}</strong></TableCell>
                    <TableCell align="center" sx={{ border: '1px solid #ccc', p: 1 }}><strong>${employeeData.totalMileageAmount.toFixed(2)}</strong></TableCell>
                    <TableCell align="center" sx={{ border: '1px solid #ccc', p: 1 }}><strong>${employeeData.perDiem.toFixed(2)}</strong></TableCell>
                    <TableCell sx={{ border: '1px solid #ccc', p: 1 }}></TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>

            {/* Travel expense categories */}
            <Box sx={{ mt: 4 }}>
              <Typography variant="h6" gutterBottom component="div"><strong>Travel/Transportation</strong></Typography>
              <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                * Attach all receipts with description of purchase, date & amount circled.
              </Typography>
              
              <TableContainer component={Paper}>
                <Table size="small" sx={{ tableLayout: 'fixed', borderCollapse: 'collapse' }}>
                  <TableHead>
                    <TableRow sx={{ bgcolor: 'grey.100' }}>
                      <TableCell sx={{ border: '1px solid #ccc', p: 1 }}><strong>Expense Type</strong></TableCell>
                      <TableCell align="center" sx={{ border: '1px solid #ccc', p: 1 }}><strong>Amount</strong></TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    <TableRow>
                      <TableCell sx={{ border: '1px solid #ccc', p: 1 }}>Air / Rail / Bus Fare</TableCell>
                      <TableCell align="center" sx={{ border: '1px solid #ccc', p: 1 }}>$0.00</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell sx={{ border: '1px solid #ccc', p: 1 }}>Vehicle Rental / Fuel</TableCell>
                      <TableCell align="center" sx={{ border: '1px solid #ccc', p: 1 }}>$0.00</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell sx={{ border: '1px solid #ccc', p: 1 }}>Parking / Tolls</TableCell>
                      <TableCell align="center" sx={{ border: '1px solid #ccc', p: 1 }}>$0.00</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell sx={{ border: '1px solid #ccc', p: 1 }}>Ground Transportation</TableCell>
                      <TableCell align="center" sx={{ border: '1px solid #ccc', p: 1 }}>$0.00</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell sx={{ border: '1px solid #ccc', p: 1 }}>Lodging Hotel / AirBnB</TableCell>
                      <TableCell align="center" sx={{ border: '1px solid #ccc', p: 1 }}>$0.00</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell sx={{ border: '1px solid #ccc', p: 1 }}>Per Diem (meals while traveling) * $35 max / day</TableCell>
                      <TableCell align="center" sx={{ border: '1px solid #ccc', p: 1 }}>${employeeData.perDiem.toFixed(2)}</TableCell>
                    </TableRow>
                    <TableRow sx={{ bgcolor: 'grey.200', fontWeight: 'bold' }}>
                      <TableCell sx={{ border: '1px solid #ccc', p: 1 }}><strong>TRAVEL TOTAL:</strong></TableCell>
                      <TableCell align="center" sx={{ border: '1px solid #ccc', p: 1 }}><strong>${(employeeData.totalMileageAmount + employeeData.perDiem).toFixed(2)}</strong></TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          </CardContent>
        </Card>
        </TabPanel>
      )}

      {/* Cost Center Travel Sheets Tabs 2-5 */}
      {employeeData && employeeData.costCenters.length >= 2 && (
        <TabPanel value={activeTab} index={5}>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="h5" gutterBottom>
                Cost Ctr #2 Travel
              </Typography>
              <Typography color="textSecondary">
                Cost center #2 travel data will be populated here.
              </Typography>
            </CardContent>
          </Card>
        </TabPanel>
      )}

      {employeeData && employeeData.costCenters.length >= 3 && (
        <TabPanel value={activeTab} index={4}>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="h5" gutterBottom>
                Cost Ctr #3 Travel
              </Typography>
              <Typography color="textSecondary">
                Cost center #3 travel data will be populated here.
              </Typography>
            </CardContent>
          </Card>
        </TabPanel>
      )}

      {employeeData && employeeData.costCenters.length >= 4 && (
        <TabPanel value={activeTab} index={5}>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="h5" gutterBottom>
                Cost Ctr #4 Travel
              </Typography>
              <Typography color="textSecondary">
                Cost center #4 travel data will be populated here.
              </Typography>
            </CardContent>
          </Card>
        </TabPanel>
      )}

      {employeeData && employeeData.costCenters.length >= 5 && (
        <TabPanel value={activeTab} index={6}>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="h5" gutterBottom>
                Cost Ctr #5 Travel
              </Typography>
              <Typography color="textSecondary">
                Cost center #5 travel data will be populated here.
              </Typography>
            </CardContent>
          </Card>
        </TabPanel>
      )}

      {/* Timesheet Tab */}
      <TabPanel value={activeTab} index={employeeData ? employeeData.costCenters.length + 4 : 4}>
        <Card variant="outlined">
          <CardContent>
            {/* Header matching spreadsheet */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
              <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                {monthName} / {reportYear}
              </Typography>
              <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                {monthName} / {reportYear}
              </Typography>
            </Box>

            {/* Signature section at the top */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 4 }}>
              <Box sx={{ flex: 1, mr: 4 }}>
                <Typography variant="h6" component="div"><strong>Name:</strong> {employeeData?.name}</Typography>
                <Box sx={{ 
                  mt: 2, 
                  mb: 2, 
                  minHeight: 40, 
                  width: 200,
                  border: '1px solid #ccc', 
                  borderRadius: 1,
                  bgcolor: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative',
                  overflow: 'hidden'
                }}>
                  {signatureImage ? (
                    <>
                      {/* Displaying signature image */}
                      <img 
                        src={signatureImage} 
                        alt="Employee Signature" 
                        style={{ 
                          maxHeight: '100%', 
                          maxWidth: '100%',
                          objectFit: 'contain',
                          filter: 'contrast(1.2) brightness(0.8)',
                          backgroundColor: 'transparent',
                          mixBlendMode: 'darken'
                        }} 
                      />
                    </>
                  ) : (
                    <>
                      {/* No signature image, showing placeholder */}
                      <Typography variant="caption" color="textSecondary">
                        Upload signature using "Signature Capture" button
                      </Typography>
                    </>
                  )}
                </Box>
                <Typography variant="body2" color="textSecondary">Signature:</Typography>
              </Box>
              <Box sx={{ flex: 1 }}>
                <Typography variant="h6"><strong>Supervisor:</strong></Typography>
                <Box sx={{ mt: 2, mb: 2, borderBottom: '1px solid #333', minHeight: 40, width: 200 }} />
                <Typography variant="body2" color="textSecondary">Supervisor Signature:</Typography>
              </Box>
            </Box>

            <Typography variant="body2" color="error" sx={{ mb: 3 }}>
              * Selected cost center(s) should appear below.
            </Typography>

            {/* Cost Center Hours Table */}
            <TableContainer component={Paper} sx={{ mb: 4, overflowX: 'auto' }}>
              <Table size="small" sx={{ borderCollapse: 'collapse', minWidth: '100%' }}>
                <TableHead>
                  <TableRow sx={{ bgcolor: 'grey.100' }}>
                    <TableCell sx={{ border: '1px solid #ccc', p: 1, width: 120, minWidth: 120, maxWidth: 120 }}><strong>Cost Center</strong></TableCell>
                    {Array.from({ length: daysInMonth }, (_, i) => {
                      const day = i + 1;
                      // Check if all cost centers for this day are selected
                      const allCostCentersSelected = employeeData?.costCenters.every((_, costCenterIdx) => {
                        const dayId = `time-${costCenterIdx}-${day}`;
                        return selectedTimeTrackingItems.has(dayId);
                      }) || false;
                      const someCostCentersSelected = employeeData?.costCenters.some((_, costCenterIdx) => {
                        const dayId = `time-${costCenterIdx}-${day}`;
                        return selectedTimeTrackingItems.has(dayId);
                      }) || false;
                      
                      return (
                        <TableCell key={i} align="center" sx={{ width: supervisorMode ? 30 : 25, minWidth: supervisorMode ? 30 : 25, maxWidth: supervisorMode ? 30 : 25, border: '1px solid #ccc', p: 0.5, fontSize: '0.75rem' }}>
                          {supervisorMode ? (
                            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
                              <Checkbox
                                indeterminate={someCostCentersSelected && !allCostCentersSelected}
                                checked={allCostCentersSelected && (employeeData?.costCenters.length || 0) > 0}
                                onChange={(e) => {
                                  const newSet = new Set(selectedTimeTrackingItems);
                                  if (e.target.checked && employeeData) {
                                    // Select all cost centers for this day
                                    employeeData.costCenters.forEach((_, costCenterIdx) => {
                                      newSet.add(`time-${costCenterIdx}-${day}`);
                                    });
                                  } else {
                                    // Deselect all cost centers for this day
                                    employeeData?.costCenters.forEach((_, costCenterIdx) => {
                                      newSet.delete(`time-${costCenterIdx}-${day}`);
                                    });
                                  }
                                  setSelectedTimeTrackingItems(newSet);
                                }}
                                size="small"
                                sx={{ p: 0 }}
                              />
                              <Typography variant="caption" sx={{ fontSize: '0.65rem', lineHeight: 1 }}>
                                {i + 1}
                              </Typography>
                            </Box>
                          ) : (
                            i + 1
                          )}
                        </TableCell>
                      );
                    })}
                    <TableCell align="center" sx={{ border: '1px solid #ccc', p: 1, width: 100, minWidth: 100, maxWidth: 100 }}><strong>TOTALS</strong></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {/* Used Cost Centers */}
                  {employeeData?.costCenters.map((center, index) => {
                    return (
                    <TableRow key={index}>
                      <TableCell sx={{ fontWeight: 'bold', color: 'primary.main', border: '1px solid #ccc', p: 1 }}>
                        {center}
                      </TableCell>
                      {Array.from({ length: daysInMonth }, (_, i) => {
                        const day = i + 1;
                        const entry = employeeData?.dailyEntries.find(e => e.day === day);
                        
                        // Get hours for this specific cost center from time tracking data
                        // All cost centers should use the same logic - get specific cost center hours
                        const propertyName = `costCenter${index}Hours`;
                        const currentValue = (entry as any)?.[propertyName] || 0;
                        
                        const isEditing = editingTimesheetCell?.costCenter === index && 
                                        editingTimesheetCell?.day === day && 
                                        editingTimesheetCell?.type === 'costCenter';
                        
                        // Check if any time entries for this day need revision
                        const entryDate = new Date(reportYear, reportMonth - 1, day);
                        const needsRevisionFromRaw = rawTimeEntries.some((t: any) => {
                          const tDate = new Date(t.date);
                          return tDate.getUTCDate() === entryDate.getUTCDate() && 
                                 tDate.getUTCMonth() === entryDate.getUTCMonth() && 
                                 t.needsRevision;
                        });
                        
                        // Check if this day needs revision from revision notes
                        const dayNeedsRevision = daysNeedingRevision.has(day);
                        const needsRevision = needsRevisionFromRaw || dayNeedsRevision;
                        
                        return (
                          <TableCell key={i} align="center" sx={{ border: '1px solid #ccc', p: 0.5, bgcolor: needsRevision ? '#ffcccc' : 'transparent' }}>
                            {isEditing ? (
                              <TextField
                                value={editingTimesheetValue}
                                onChange={(e) => setEditingTimesheetValue(e.target.value)}
                                onBlur={handleTimesheetCellSave}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleTimesheetCellSave();
                                  if (e.key === 'Escape') handleTimesheetCellCancel();
                                }}
                                autoFocus
                                size="small"
                                type="number"
                                inputProps={{ 
                                  min: 0, 
                                  max: 24, 
                                  step: 0.25,
                                  style: { 
                                    MozAppearance: 'textfield',
                                    WebkitAppearance: 'none',
                                    appearance: 'none'
                                  }
                                }}
                                sx={{ 
                                  width: 40, 
                                  fontSize: '0.75rem',
                                  '& input[type=number]': {
                                    MozAppearance: 'textfield',
                                  },
                                  '& input[type=number]::-webkit-outer-spin-button': {
                                    WebkitAppearance: 'none',
                                    margin: 0,
                                  },
                                  '& input[type=number]::-webkit-inner-spin-button': {
                                    WebkitAppearance: 'none',
                                    margin: 0,
                                  },
                                }}
                              />
                            ) : (
                              <Box 
                                onClick={() => !isAdminView && handleTimesheetCellEdit(index, day, 'costCenter', currentValue)}
                                sx={{ 
                                  cursor: isAdminView ? 'default' : 'pointer', 
                                  '&:hover': isAdminView ? {} : { bgcolor: 'grey.100' }, 
                                  fontSize: '0.75rem' 
                                }}
                              >
                                {currentValue}
                              </Box>
                            )}
                          </TableCell>
                        );
                      })}
                      <TableCell align="center" sx={{ fontWeight: 'bold', color: 'primary.main', border: '1px solid #ccc', p: 1 }}>
                        {(employeeData?.dailyEntries.reduce((sum, entry) => {
                          const propertyName = `costCenter${index}Hours`;
                          return sum + ((entry as any)?.[propertyName] || 0);
                        }, 0) || 0).toFixed(1)} {center}
                      </TableCell>
                    </TableRow>
                    );
                  })}
                  
                  {/* Billable Hours Row */}
                  <TableRow sx={{ bgcolor: 'grey.200' }}>
                    <TableCell sx={{ fontWeight: 'bold', border: '1px solid #ccc', p: 1 }}>BILLABLE HOURS</TableCell>
                    {Array.from({ length: daysInMonth }, (_, i) => {
                      const day = i + 1;
                      const entry = employeeData?.dailyEntries.find(e => e.day === day);
                      // BILLABLE HOURS should show the sum of all cost center hours for this day
                      const costCenterHours = employeeData?.costCenters.reduce((sum, _, costCenterIndex) => {
                        const propertyName = `costCenter${costCenterIndex}Hours`;
                        return sum + ((entry as any)?.[propertyName] || 0);
                      }, 0) || 0;
                      const currentValue = costCenterHours;
                      const isEditing = editingTimesheetCell?.costCenter === -1 && 
                                      editingTimesheetCell?.day === day && 
                                      editingTimesheetCell?.type === 'billable';
                      
                      // Check if any time entries for this day need revision
                      const entryDate = new Date(reportYear, reportMonth - 1, day);
                      const needsRevision = rawTimeEntries.some((t: any) => {
                        const tDate = new Date(t.date);
                        return tDate.getUTCDate() === entryDate.getUTCDate() && 
                               tDate.getUTCMonth() === entryDate.getUTCMonth() && 
                               t.needsRevision;
                      });
                      
                      return (
                        <TableCell key={i} align="center" sx={{ border: '1px solid #ccc', p: 0.5, bgcolor: needsRevision ? 'warning.light' : 'transparent' }}>
                          {isEditing ? (
                            <TextField
                              value={editingTimesheetValue}
                              onChange={(e) => setEditingTimesheetValue(e.target.value)}
                              onBlur={handleTimesheetCellSave}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleTimesheetCellSave();
                                if (e.key === 'Escape') handleTimesheetCellCancel();
                              }}
                              autoFocus
                              size="small"
                              type="number"
                              inputProps={{ min: 0, max: 24, step: 0.25 }}
                              sx={{ width: 40, fontSize: '0.75rem' }}
                            />
                          ) : (
                            <Box 
                              onClick={() => !isAdminView && handleTimesheetCellEdit(-1, day, 'billable', currentValue)}
                              sx={{ 
                                cursor: isAdminView ? 'default' : 'pointer', 
                                '&:hover': isAdminView ? {} : { bgcolor: 'grey.100' }, 
                                fontSize: '0.75rem' 
                              }}
                            >
                              {currentValue}
                            </Box>
                          )}
                        </TableCell>
                      );
                    })}
                    <TableCell align="center" sx={{ fontWeight: 'bold', color: 'primary.main', border: '1px solid #ccc', p: 1 }}>
                      {(employeeData?.dailyEntries.reduce((sum, entry) => {
                        const costCenterHours = employeeData?.costCenters.reduce((costSum, _, costCenterIndex) => {
                          const propertyName = `costCenter${costCenterIndex}Hours`;
                          return costSum + ((entry as any)?.[propertyName] || 0);
                        }, 0) || 0;
                        return sum + costCenterHours;
                      }, 0) || 0).toFixed(1)} BILLABLE HOURS
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>

            <Typography variant="body2" color="error" sx={{ mb: 3 }}>
              * If and when applicable, manually enter hours corresponding w/ the categories shown below.
            </Typography>

            {/* Category Hours Table */}
            <TableContainer component={Paper}>
              <Table size="small" sx={{ borderCollapse: 'collapse', minWidth: '100%' }}>
                <TableHead>
                  <TableRow sx={{ bgcolor: 'grey.100' }}>
                    <TableCell sx={{ border: '1px solid #ccc', p: 1, width: 120, minWidth: 120, maxWidth: 120 }}><strong>Category</strong></TableCell>
                    {Array.from({ length: daysInMonth }, (_, i) => (
                      <TableCell key={i} align="center" sx={{ width: 25, minWidth: 25, maxWidth: 25, border: '1px solid #ccc', p: 0.5, fontSize: '0.75rem' }}>
                        {i + 1}
                      </TableCell>
                    ))}
                    <TableCell align="center" sx={{ border: '1px solid #ccc', p: 1, width: 100, minWidth: 100, maxWidth: 100 }}><strong>TOTAL</strong></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {['G&A', 'Holiday', 'PTO', 'STD/LTD', 'PFL/PFML'].map((category) => (
                    <TableRow key={category}>
                      <TableCell sx={{ fontWeight: 'bold', border: '1px solid #ccc', p: 1, fontSize: '0.75rem' }}>{category}</TableCell>
                      {Array.from({ length: daysInMonth }, (_, i) => {
                        const day = i + 1;
                        const entry = employeeData?.dailyEntries.find(e => e.day === day);
                        const currentValue = (entry as any)?.categoryHours?.[category] || 0;
                        const isEditing = editingCategoryCell?.category === category && 
                                        editingCategoryCell?.day === day;
                        
                        // Check if any time entries for this day need revision
                        const entryDate = new Date(reportYear, reportMonth - 1, day);
                        const needsRevision = rawTimeEntries.some((t: any) => {
                          const tDate = new Date(t.date);
                          return tDate.getUTCDate() === entryDate.getUTCDate() && 
                                 tDate.getUTCMonth() === entryDate.getUTCMonth() && 
                                 t.needsRevision;
                        });
                        
                        return (
                          <TableCell key={i} align="center" sx={{ border: '1px solid #ccc', p: 0.5, bgcolor: needsRevision ? 'warning.light' : 'transparent' }}>
                            {isEditing ? (
                              <TextField
                                value={editingCategoryValue}
                                onChange={(e) => setEditingCategoryValue(e.target.value)}
                                onBlur={handleCategoryCellSave}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleCategoryCellSave();
                                  if (e.key === 'Escape') handleCategoryCellCancel();
                                }}
                                autoFocus
                                size="small"
                                type="number"
                                inputProps={{ 
                                  min: 0, 
                                  max: 24, 
                                  step: 0.25,
                                  style: { 
                                    MozAppearance: 'textfield',
                                    WebkitAppearance: 'none',
                                    appearance: 'none'
                                  }
                                }}
                                sx={{ 
                                  width: 40, 
                                  fontSize: '0.75rem',
                                  '& input[type=number]': {
                                    MozAppearance: 'textfield',
                                  },
                                  '& input[type=number]::-webkit-outer-spin-button': {
                                    WebkitAppearance: 'none',
                                    margin: 0,
                                  },
                                  '& input[type=number]::-webkit-inner-spin-button': {
                                    WebkitAppearance: 'none',
                                    margin: 0,
                                  },
                                }}
                              />
                            ) : (
                              <Box 
                                onClick={() => !isAdminView && handleCategoryCellEdit(category, day, currentValue)}
                                sx={{ 
                                  cursor: isAdminView ? 'default' : 'pointer', 
                                  '&:hover': isAdminView ? {} : { bgcolor: 'grey.100' }, 
                                  fontSize: '0.75rem' 
                                }}
                              >
                                {currentValue}
                              </Box>
                            )}
                          </TableCell>
                        );
                      })}
                      <TableCell align="center" sx={{ fontWeight: 'bold', border: '1px solid #ccc', p: 1, fontSize: '0.75rem' }}>
                        {(employeeData?.dailyEntries.reduce((sum, entry) => sum + ((entry as any)?.categoryHours?.[category] || 0), 0) || 0).toFixed(1)} {category}
                      </TableCell>
                    </TableRow>
                  ))}
                  
                  
                  {/* Daily Totals Row */}
                  <TableRow sx={{ bgcolor: 'grey.200' }}>
                    <TableCell sx={{ fontWeight: 'bold', border: '1px solid #ccc', p: 1, fontSize: '0.75rem' }}>DAILY TOTALS</TableCell>
                    {Array.from({ length: daysInMonth }, (_, i) => {
                      const day = i + 1;
                      const entry = employeeData?.dailyEntries.find(e => e.day === day);
                      
                      // Calculate total hours for this day by summing all cost center and category hours
                      const costCenterHours = employeeData?.costCenters.reduce((sum, _, costCenterIndex) => {
                        const propertyName = `costCenter${costCenterIndex}Hours`;
                        return sum + ((entry as any)?.[propertyName] || 0);
                      }, 0) || 0;
                      
                      const categoryHours = ['G&A', 'Holiday', 'PTO', 'STD/LTD', 'PFL/PFML'].reduce((sum, category) => {
                        return sum + ((entry as any)?.categoryHours?.[category] || 0);
                      }, 0);
                      
                      const totalHoursForDay = costCenterHours + categoryHours;
                      
                      // Check if any time entries for this day need revision
                      const entryDate = new Date(reportYear, reportMonth - 1, day);
                      const needsRevision = rawTimeEntries.some((t: any) => {
                        const tDate = new Date(t.date);
                        return tDate.getUTCDate() === entryDate.getUTCDate() && 
                               tDate.getUTCMonth() === entryDate.getUTCMonth() && 
                               t.needsRevision;
                      });
                      
                      return (
                        <TableCell key={i} align="center" sx={{ border: '1px solid #ccc', p: 0.5, fontSize: '0.75rem', bgcolor: needsRevision ? 'warning.light' : 'transparent' }}>
                          {totalHoursForDay}
                        </TableCell>
                      );
                    })}
                    <TableCell align="center" sx={{ fontWeight: 'bold', border: '1px solid #ccc', p: 1, fontSize: '0.75rem' }}>
                      {(employeeData?.dailyEntries.reduce((sum, entry) => {
                        // Calculate total hours for this day by summing all cost center and category hours
                        const costCenterHours = employeeData?.costCenters.reduce((costSum, _, costCenterIndex) => {
                          const propertyName = `costCenter${costCenterIndex}Hours`;
                          return costSum + ((entry as any)?.[propertyName] || 0);
                        }, 0) || 0;
                        
                        const categoryHours = ['G&A', 'Holiday', 'PTO', 'STD/LTD', 'PFL/PFML'].reduce((catSum, category) => {
                          return catSum + ((entry as any)?.categoryHours?.[category] || 0);
                        }, 0);
                        
                        return sum + costCenterHours + categoryHours;
                      }, 0) || 0).toFixed(1)} GRAND TOTAL
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      </TabPanel>

      {/* Receipt Management Tab */}
      <TabPanel value={activeTab} index={employeeData ? employeeData.costCenters.length + 5 : 5}>
        <Card variant="outlined">
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
              <Typography variant="h5" gutterBottom>
                Receipt Management - {monthName} {reportYear}
              </Typography>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => {
                  setEditingReceipt({
                    id: '',
                    date: '',
                    amount: 0,
                    vendor: '',
                    description: '',
                    category: ''
                  });
                  setReceiptDialogOpen(true);
                }}
              >
                Add Receipt
              </Button>
            </Box>

            <TableContainer component={Paper}>
              <Table sx={{ borderCollapse: 'collapse' }}>
                <TableHead>
                  <TableRow sx={{ bgcolor: 'grey.100' }}>
                    {supervisorMode && (
                      <TableCell padding="checkbox" sx={{ border: '1px solid #ccc', p: 1 }}>
                        <Typography variant="caption" sx={{ fontSize: '0.7rem', fontWeight: 'bold', mb: 0.5, display: 'block' }}>
                          Select for Revision
                        </Typography>
                        <Checkbox
                          indeterminate={selectedReceiptItems.size > 0 && selectedReceiptItems.size < receipts.length}
                          checked={receipts.length > 0 && selectedReceiptItems.size === receipts.length}
                          onChange={(e) => {
                            if (e.target.checked) {
                              const allIds = new Set(receipts.map(r => `receipt-${r.id}`));
                              setSelectedReceiptItems(allIds);
                            } else {
                              setSelectedReceiptItems(new Set());
                            }
                          }}
                          size="small"
                        />
                      </TableCell>
                    )}
                    <TableCell sx={{ border: '1px solid #ccc', p: 1 }}><strong>Date</strong></TableCell>
                    <TableCell sx={{ border: '1px solid #ccc', p: 1 }}><strong>Vendor</strong></TableCell>
                    <TableCell sx={{ border: '1px solid #ccc', p: 1 }}><strong>Description</strong></TableCell>
                    <TableCell align="center" sx={{ border: '1px solid #ccc', p: 1 }}><strong>Amount</strong></TableCell>
                    <TableCell sx={{ border: '1px solid #ccc', p: 1 }}><strong>Category</strong></TableCell>
                    <TableCell align="center" sx={{ border: '1px solid #ccc', p: 1 }}><strong>Picture</strong></TableCell>
                    <TableCell align="center" sx={{ border: '1px solid #ccc', p: 1 }}><strong>Actions</strong></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {receipts.map((receipt) => {
                    const needsRevisionFromFlag = (receipt as any).needsRevision;
                    const receiptId = `receipt-${receipt.id}`;
                    const needsRevisionFromNotes = itemsNeedingRevision.has(receiptId);
                    const needsRevision = needsRevisionFromFlag || needsRevisionFromNotes;
                    const isSelected = selectedReceiptItems.has(receiptId);
                    return (
                      <TableRow 
                        key={receipt.id}
                        sx={needsRevision ? { 
                          bgcolor: '#ffcccc', // Light red background for items needing revision
                          '& td': {
                            bgcolor: '#ffcccc'
                          }
                        } : {}}
                      >
                        {supervisorMode && (
                          <TableCell padding="checkbox" sx={{ border: '1px solid #ccc', p: 1 }}>
                            <Checkbox
                              checked={isSelected}
                              onChange={(e) => {
                                const newSet = new Set(selectedReceiptItems);
                                if (e.target.checked) {
                                  newSet.add(receiptId);
                                } else {
                                  newSet.delete(receiptId);
                                }
                                setSelectedReceiptItems(newSet);
                              }}
                              size="small"
                            />
                          </TableCell>
                        )}
                        <TableCell sx={{ border: '1px solid #ccc', p: 1 }}>
                          {receipt.date}
                          {needsRevision && (
                            <Chip 
                              label="⚠️ Revision Requested" 
                              size="small" 
                              color="warning" 
                              sx={{ ml: 1 }} 
                            />
                          )}
                        </TableCell>
                        <TableCell sx={{ border: '1px solid #ccc', p: 1 }}>{receipt.vendor}</TableCell>
                        <TableCell sx={{ border: '1px solid #ccc', p: 1 }}>
                          {receipt.description}
                          {needsRevision && (receipt as any).revisionReason && (
                            <Typography variant="caption" color="error" display="block">
                              Reason: {(receipt as any).revisionReason}
                            </Typography>
                          )}
                        </TableCell>
                      <TableCell align="center" sx={{ border: '1px solid #ccc', p: 1 }}>${receipt.amount.toFixed(2)}</TableCell>
                      <TableCell sx={{ border: '1px solid #ccc', p: 1 }}>{receipt.category}</TableCell>
                      <TableCell align="center" sx={{ border: '1px solid #ccc', p: 1 }}>
                        {(() => {
                          const raw = receipt.imageUri || '';
                          // Only render if it's a backend-served path, not a local file URI
                          if (!raw || raw.startsWith('file://')) {
                            return (
                              <Box sx={{ 
                                width: 40, 
                                height: 40, 
                                borderRadius: 1, 
                                border: '1px solid #ddd',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                bgcolor: 'grey.100',
                                cursor: 'pointer',
                                '&:hover': {
                                  bgcolor: 'grey.200'
                                }
                              }}>
                                <input
                                  type="file"
                                  accept="image/*,application/pdf"
                                  style={{ display: 'none' }}
                                  id={`receipt-upload-${receipt.id}`}
                                  onChange={(e) => handleReceiptImageUpload(receipt.id, e)}
                                />
                                <label htmlFor={`receipt-upload-${receipt.id}`} style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%' }}>
                                  <div style={{ 
                                    width: '20px', 
                                    height: '20px', 
                                    borderRadius: '50%',
                                    border: '2px dashed #999',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '12px',
                                    color: '#999'
                                  }}>
                                    +
                                  </div>
                                </label>
                              </Box>
                            );
                          }
                          // Construct proper backend URL for the image
                          const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://oxford-mileage-backend.onrender.com';
                          const path = raw.startsWith('/uploads')
                            ? raw
                            : (raw.startsWith('uploads')
                              ? `/${raw}`
                              : (`/uploads/${raw}`));
                          const imageSrc = path.startsWith('http') ? path : `${API_BASE_URL}${path}`;
                          const isPDF = receipt.imageUri && (receipt.imageUri.toLowerCase().endsWith('.pdf') || (receipt as any).fileType === 'pdf');
                          
                          return (
                            <Box 
                              component="a"
                              href={imageSrc}
                              target="_blank"
                              rel="noopener noreferrer"
                              sx={{ 
                                width: 40, 
                                height: 40, 
                                borderRadius: 1, 
                                overflow: 'hidden',
                                border: '1px solid #ddd',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                bgcolor: 'grey.50',
                                cursor: 'pointer',
                                textDecoration: 'none',
                                '&:hover': {
                                  borderColor: 'primary.main',
                                  boxShadow: 1
                                }
                              }}
                            >
                              {isPDF ? (
                                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', p: 1 }}>
                                  <Box sx={{ color: '#F44336', mb: 0.5 }}>
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                                      <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z" />
                                    </svg>
                                  </Box>
                                  <Typography variant="caption" sx={{ fontSize: '0.6rem', color: '#666' }}>PDF</Typography>
                                </Box>
                              ) : (
                                <img 
                                  src={imageSrc} 
                                  alt="Receipt - Click to view full size" 
                                  style={{ 
                                    maxWidth: '100%', 
                                    maxHeight: '100%',
                                    objectFit: 'cover'
                                  }}
                                  onError={(e) => {
                                    // If image fails to load, show placeholder
                                    const target = e.target as HTMLImageElement;
                                    target.style.display = 'none';
                                    const parent = target.parentElement;
                                    if (parent) {
                                      parent.innerHTML = '<div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; color: #999; font-size: 10px;">No image</div>';
                                    }
                                  }}
                                />
                              )}
                            </Box>
                          );
                        })()}
                      </TableCell>
                      <TableCell align="center" sx={{ border: '1px solid #ccc', p: 1 }}>
                        <IconButton
                          size="small"
                          onClick={() => {
                            setEditingReceipt(receipt);
                            setReceiptDialogOpen(true);
                          }}
                        >
                          <EditIcon />
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={() => {
                            setReceipts(receipts.filter(r => r.id !== receipt.id));
                            // Update phone/internet/fax total
                            const updatedData = {
                              ...employeeData,
                              phoneInternetFax: receipts
                                .filter(r => r.id !== receipt.id)
                                .reduce((sum, r) => sum + r.amount, 0)
                            };
                            setEmployeeData(updatedData);
                          }}
                        >
                          <DeleteIcon />
                        </IconButton>
                      </TableCell>
                      </TableRow>
                    );
                  })}
                  {receipts.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} align="center" sx={{ border: '1px solid #ccc', p: 1 }}>
                        No receipts found. Click "Add Receipt" to get started.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>

            <Box sx={{ mt: 3, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
              <Typography variant="h6" gutterBottom>
                Receipt Summary
              </Typography>
              <Typography variant="body1">
                <strong>Total Receipts:</strong> ${receipts.reduce((sum, r) => sum + r.amount, 0).toFixed(2)}
              </Typography>
              <Typography variant="body1">
                <strong>Number of Receipts:</strong> {receipts.length}
              </Typography>
            </Box>
          </CardContent>
        </Card>
      </TabPanel>

      {/* Signature Dialog */}
      <Dialog 
        open={signatureDialogOpen} 
        onClose={() => setSignatureDialogOpen(false)} 
        maxWidth={false}
        fullWidth
        PaperProps={{
          sx: {
            maxWidth: '90vw',
            maxHeight: '90vh',
            width: 'auto',
            height: 'auto',
          }
        }}
      >
        <DialogTitle>Signature Capture</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <Typography variant="body1">
              Upload a PNG file containing your signature. Please ensure the background is transparent or white for best results.
            </Typography>
            
            {signatureImage && (
              <Box sx={{ textAlign: 'center', mb: 2 }}>
                <Typography variant="subtitle2" gutterBottom>Current Signature:</Typography>
                <Box sx={{ 
                  border: '1px solid #ccc', 
                  borderRadius: 1, 
                  p: 2, 
                  bgcolor: 'white',
                  display: 'inline-block'
                }}>
                  <img 
                    src={signatureImage} 
                    alt="Current Signature" 
                    style={{ 
                      maxHeight: 100, 
                      maxWidth: 200,
                      objectFit: 'contain'
                    }} 
                  />
                </Box>
              </Box>
            )}

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {savedSignature && (
                <Button
                  variant="outlined"
                  color="success"
                  startIcon={<CheckIcon />}
                  onClick={async () => {
                    setSignatureImage(savedSignature);
                    
                    // Auto-save to expense report
                    if (employeeData) {
                      try {
                        await syncReportData({ employeeSignature: savedSignature });
                        
                        debugVerbose('✅ Saved signature synced to source tables');
                      } catch (error) {
                        debugError('Error syncing saved signature:', error);
                      }
                    }
                    
                    setSignatureDialogOpen(false);
                    showSuccess('Using saved signature');
                  }}
                  fullWidth
                >
                  Use Saved Signature
                </Button>
              )}
              
              <input
                type="file"
                accept=".png"
                onChange={handleSignatureUpload}
                style={{ display: 'none' }}
                id="signature-upload"
              />
              <label htmlFor="signature-upload">
                <Button
                  variant="outlined"
                  component="span"
                  startIcon={<UploadIcon />}
                  fullWidth
                >
                  Upload New Signature
                </Button>
              </label>
              
              {signatureImage && (
                <Button
                  variant="outlined"
                  color="error"
                  onClick={handleRemoveSignature}
                  fullWidth
                >
                  Remove Signature
                </Button>
              )}
            </Box>

            <Typography variant="caption" color="textSecondary" component="div">
              <strong>Instructions:</strong>
              <br />• Use a PNG file with transparent background for best results
              <br />• Signature should be black or dark colored
              <br />• Recommended size: 200x100 pixels or similar
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSignatureDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Supervisor Signature Dialog */}
      <Dialog 
        open={supervisorSignatureDialogOpen} 
        onClose={() => setSupervisorSignatureDialogOpen(false)} 
        maxWidth={false}
        fullWidth
        PaperProps={{
          sx: {
            maxWidth: '90vw',
            maxHeight: '90vh',
            width: 'auto',
            height: 'auto',
          }
        }}
      >
        <DialogTitle>Supervisor Signature Capture</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <Typography variant="body1">
              Upload a PNG file containing the supervisor signature. Please ensure the background is transparent or white for best results.
            </Typography>
            
            {supervisorSignatureState && (
              <Box sx={{ textAlign: 'center', mb: 2 }}>
                <Typography variant="subtitle2" gutterBottom>Current Supervisor Signature:</Typography>
                <Box sx={{ 
                  border: '1px solid #ccc', 
                  borderRadius: 1, 
                  p: 2, 
                  bgcolor: 'white',
                  display: 'inline-block'
                }}>
                  <img 
                    src={supervisorSignatureState} 
                    alt="Current Supervisor Signature" 
                    style={{ 
                      maxHeight: 100, 
                      maxWidth: 200,
                      objectFit: 'contain'
                    }} 
                  />
                </Box>
              </Box>
            )}

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <input
                type="file"
                accept=".png"
                onChange={handleSupervisorSignatureUpload}
                style={{ display: 'none' }}
                id="supervisor-signature-upload"
              />
              <label htmlFor="supervisor-signature-upload">
                <Button
                  variant="outlined"
                  component="span"
                  startIcon={<UploadIcon />}
                  fullWidth
                >
                  Upload Supervisor Signature
                </Button>
              </label>
              
              {supervisorSignatureState && (
                <Button
                  variant="outlined"
                  color="error"
                  startIcon={<DeleteIcon />}
                  onClick={async () => {
                    setSupervisorSignatureState(null);
                    setSupervisorCertificationAcknowledged(false);
                    
                    // Auto-save signature removal
                    if (employeeData) {
                      try {
                        await syncReportData({
                          supervisorSignature: null,
                          supervisorCertificationAcknowledged: false,
                        });
                        
                        debugVerbose('✅ Supervisor signature removal synced to expense report');
                        showSuccess('Supervisor signature removed');
                      } catch (error) {
                        debugError('Error removing supervisor signature:', error);
                        showError('Failed to remove supervisor signature');
                      }
                    }
                    
                    setSupervisorSignatureDialogOpen(false);
                  }}
                  fullWidth
                >
                  Remove Supervisor Signature
                </Button>
              )}
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSupervisorSignatureDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Receipt Dialog */}
      <Dialog 
        open={receiptDialogOpen} 
        onClose={() => setReceiptDialogOpen(false)} 
        maxWidth={false}
        fullWidth
        PaperProps={{
          sx: {
            maxWidth: '90vw',
            maxHeight: '90vh',
            width: 'auto',
            height: 'auto',
          }
        }}
      >
        <DialogTitle>{editingReceipt ? 'Edit Receipt' : 'Add Receipt'}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <LocalizationProvider dateAdapter={AdapterDayjs}>
              <DatePicker
                label="Date"
                value={editingReceipt?.date ? dayjs(editingReceipt.date) : null}
                onChange={(newValue: Dayjs | null) => {
                  if (newValue && editingReceipt) {
                    setEditingReceipt({...editingReceipt, date: newValue.format('YYYY-MM-DD')});
                  }
                }}
                slotProps={{
                  textField: {
                    fullWidth: true,
                  },
                }}
              />
            </LocalizationProvider>
            <TextField
              label="Vendor"
              value={editingReceipt?.vendor || ''}
              onChange={(e) => setEditingReceipt({...editingReceipt!, vendor: e.target.value})}
              fullWidth
            />
            <TextField
              label="Description"
              value={editingReceipt?.description || ''}
              onChange={(e) => setEditingReceipt({...editingReceipt!, description: e.target.value})}
              fullWidth
              multiline
              rows={2}
            />
            <TextField
              label="Amount"
              type="number"
              value={editingReceipt?.amount || ''}
              onChange={(e) => setEditingReceipt({...editingReceipt!, amount: parseFloat(e.target.value) || 0})}
              inputProps={{ step: 0.01 }}
            />
            <FormControl fullWidth>
              <InputLabel>Category</InputLabel>
              <Select
                value={editingReceipt?.category || ''}
                onChange={(e) => setEditingReceipt({...editingReceipt!, category: e.target.value})}
              >
                <MenuItem value="Airfare/Bus/Train">Airfare/Bus/Train</MenuItem>
                <MenuItem value="Communication">Communication</MenuItem>
                <MenuItem value="EES">EES</MenuItem>
                <MenuItem value="Equipment">Equipment</MenuItem>
                <MenuItem value="Ground Transportation">Ground Transportation</MenuItem>
                <MenuItem value="Hotels/AirBnB">Hotels/AirBnB</MenuItem>
                <MenuItem value="Meals">Meals</MenuItem>
                <MenuItem value="Office Supplies">Office Supplies</MenuItem>
                <MenuItem value="Other">Other</MenuItem>
                <MenuItem value="Parking/Tolls">Parking/Tolls</MenuItem>
                <MenuItem value="Per Diem">Per Diem</MenuItem>
                <MenuItem value="Phone/Internet/Fax">Phone/Internet/Fax</MenuItem>
                <MenuItem value="Postage/Shipping">Postage/Shipping</MenuItem>
                <MenuItem value="Printing">Printing</MenuItem>
                <MenuItem value="Rental Car">Rental Car</MenuItem>
                <MenuItem value="Rental Car Fuel">Rental Car Fuel</MenuItem>
                <MenuItem value="Training">Training</MenuItem>
                <MenuItem value="Travel">Travel</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setReceiptDialogOpen(false)}>Cancel</Button>
          <Button 
            onClick={async () => {
              if (editingReceipt && employeeData) {
                let updatedReceipts: ReceiptData[];
                if (editingReceipt.id) {
                  // Update existing receipt
                  updatedReceipts = receipts.map(r => r.id === editingReceipt.id ? editingReceipt : r);
                } else {
                  // Add new receipt
                  const newReceipt = {
                    ...editingReceipt,
                    id: `receipt-${Date.now()}`
                  };
                  updatedReceipts = [...receipts, newReceipt];
                }
                setReceipts(updatedReceipts);
                
                // Save receipt to backend
                try {
                  // Normalize date to YYYY-MM-DD format for backend
                  const normalizedDate = normalizeDate(editingReceipt.date);
                  if (!normalizedDate) {
                    alert('Invalid date format. Please use MM/DD/YY format.');
                    return;
                  }
                  
                  const receiptToSave = {
                    employeeId: employeeData.employeeId,
                    date: normalizedDate,
                    amount: editingReceipt.amount,
                    vendor: editingReceipt.vendor,
                    description: editingReceipt.description || '',
                    category: editingReceipt.category,
                    costCenter: (editingReceipt as any).costCenter || employeeData.costCenters[0] || ''
                  };
                  
                  if (editingReceipt.id && !editingReceipt.id.startsWith('receipt-')) {
                    // Update existing receipt (has real backend ID)
                    const response = await fetch(`${API_BASE_URL}/api/receipts/${editingReceipt.id}`, {
                      method: 'PUT',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify(receiptToSave)
                    });
                    if (!response.ok) throw new Error('Failed to update receipt');
                  } else {
                    // Create new receipt
                    const response = await fetch(`${API_BASE_URL}/api/receipts`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify(receiptToSave)
                    });
                    if (!response.ok) throw new Error('Failed to create receipt');
                    const savedReceipt = await response.json();
                    // Update the receipt ID with the one from backend
                    updatedReceipts = updatedReceipts.map(r => 
                      (!r.id || r.id.startsWith('receipt-')) && r.vendor === editingReceipt.vendor && r.date === editingReceipt.date
                        ? { ...r, id: savedReceipt.id } 
                        : r
                    );
                    setReceipts(updatedReceipts);
                  }
                } catch (error) {
                  debugError('Error saving receipt:', error);
                  alert('Error saving receipt. Please try again.');
                  return;
                }
                
                // Auto-populate summary sheet from receipt totals
                const categoryTotals: {[key: string]: number} = {};
                updatedReceipts.forEach((receipt: any) => {
                  const category = receipt.category?.toLowerCase() || '';
                  const amount = receipt.amount || 0;
                  
                  // Map receipt categories to summary sheet categories
                  if (category.includes('air') || category.includes('rail') || category.includes('bus') || category.includes('flight')) {
                    categoryTotals['airRailBus'] = (categoryTotals['airRailBus'] || 0) + amount;
                  } else if (category.includes('vehicle') || category.includes('rental') || category.includes('fuel')) {
                    categoryTotals['vehicleRentalFuel'] = (categoryTotals['vehicleRentalFuel'] || 0) + amount;
                  } else if (category.includes('parking') || category.includes('toll')) {
                    categoryTotals['parkingTolls'] = (categoryTotals['parkingTolls'] || 0) + amount;
                  } else if (category.includes('ground') || category.includes('transportation') || category.includes('taxi') || category.includes('uber') || category.includes('lyft')) {
                    categoryTotals['groundTransportation'] = (categoryTotals['groundTransportation'] || 0) + amount;
                  } else if (category.includes('hotel') || category.includes('lodging') || category.includes('airbnb')) {
                    categoryTotals['hotelsAirbnb'] = (categoryTotals['hotelsAirbnb'] || 0) + amount;
                  } else if (category.includes('phone') || category.includes('internet') || category.includes('fax')) {
                    categoryTotals['phoneInternetFax'] = (categoryTotals['phoneInternetFax'] || 0) + amount;
                  } else if (category.includes('shipping') || category.includes('postage')) {
                    categoryTotals['shippingPostage'] = (categoryTotals['shippingPostage'] || 0) + amount;
                  } else if (category.includes('printing') || category.includes('copying')) {
                    categoryTotals['printingCopying'] = (categoryTotals['printingCopying'] || 0) + amount;
                  } else if (category.includes('supplies') || category.includes('office')) {
                    categoryTotals['officeSupplies'] = (categoryTotals['officeSupplies'] || 0) + amount;
                  } else if (category.includes('ees')) {
                    categoryTotals['eesReceipt'] = (categoryTotals['eesReceipt'] || 0) + amount;
                  } else if (category.includes('other') && category !== 'per diem') {
                    categoryTotals['other'] = (categoryTotals['other'] || 0) + amount;
                  }
                });
                
                // Update summary sheet amounts from receipt totals (always update when receipt is saved)
                const updatedData = { ...employeeData };
                const updateCategory = (categoryKey: string, receiptTotal: number) => {
                  if (receiptTotal > 0) {
                    (updatedData as any)[categoryKey] = receiptTotal;
                    if (!updatedData.costCenterBreakdowns) updatedData.costCenterBreakdowns = {};
                    if (!updatedData.costCenterBreakdowns[categoryKey]) (updatedData.costCenterBreakdowns as any)[categoryKey] = [];
                    (updatedData.costCenterBreakdowns as any)[categoryKey][0] = receiptTotal;
                  }
                };
                
                updateCategory('airRailBus', categoryTotals['airRailBus'] || 0);
                updateCategory('vehicleRentalFuel', categoryTotals['vehicleRentalFuel'] || 0);
                updateCategory('parkingTolls', categoryTotals['parkingTolls'] || 0);
                updateCategory('groundTransportation', categoryTotals['groundTransportation'] || 0);
                updateCategory('hotelsAirbnb', categoryTotals['hotelsAirbnb'] || 0);
                updateCategory('phoneInternetFax', categoryTotals['phoneInternetFax'] || 0);
                updateCategory('shippingPostage', categoryTotals['shippingPostage'] || 0);
                updateCategory('printingCopying', categoryTotals['printingCopying'] || 0);
                updateCategory('officeSupplies', categoryTotals['officeSupplies'] || 0);
                updateCategory('eesReceipt', categoryTotals['eesReceipt'] || 0);
                
                // Save updated summary sheet to backend
                try {
                  const response = await fetch(`${API_BASE_URL}/api/expense-reports/${employeeData.employeeId}/${currentMonth}/${currentYear}/summary`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      reportData: {
                        ...updatedData,
                        receipts: updatedReceipts
                      }
                    })
                  });
                  if (!response.ok) throw new Error('Failed to update summary sheet');
                  
                  setEmployeeData(updatedData);
                  debugLog('✅ Auto-populated summary sheet from receipt totals');
                } catch (error) {
                  debugError('Error auto-populating summary sheet:', error);
                  // Still update local state even if backend save fails
                  setEmployeeData(updatedData);
                }
              }
              setReceiptDialogOpen(false);
            }} 
            variant="contained"
          >
            {editingReceipt?.id ? 'Update' : 'Add'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Summary Sheet Edit Dialog */}
      <Dialog open={summaryEditDialogOpen} onClose={() => {
        setSummaryEditDialogOpen(false);
        setEditingSummaryItem(null);
        setEditingSummaryValue('');
        setEditingSummaryDescription('');
        setEditingCostCenterIndex(0);
      }} maxWidth="sm" fullWidth>
        <DialogTitle>Edit {editingSummaryItem?.label || 'Expense Amount'}</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
            {editingSummaryItem?.field !== 'other' && (
              <FormControl fullWidth>
                <InputLabel>Cost Center</InputLabel>
                <Select
                  value={editingCostCenterIndex}
                  label="Cost Center"
                  onChange={(e) => {
                    const selectedIndex = e.target.value as number;
                    setEditingCostCenterIndex(selectedIndex);
                    // Update the displayed value based on selected cost center
                    if (employeeData && editingSummaryItem) {
                      const breakdown = employeeData.costCenterBreakdowns?.[editingSummaryItem.field];
                      if (breakdown && breakdown[selectedIndex] !== undefined) {
                        setEditingSummaryValue(breakdown[selectedIndex].toFixed(2));
                      } else {
                        // If no breakdown exists, show 0 or divide total
                        const total = (() => {
                          switch (editingSummaryItem.field) {
                            case 'airRailBus': return employeeData.airRailBus;
                            case 'vehicleRentalFuel': return employeeData.vehicleRentalFuel;
                            case 'parkingTolls': return employeeData.parkingTolls;
                            case 'groundTransportation': return employeeData.groundTransportation;
                            case 'hotelsAirbnb': return employeeData.hotelsAirbnb;
                            case 'phoneInternetFax': return employeeData.phoneInternetFax;
                            case 'shippingPostage': return employeeData.shippingPostage || 0;
                            case 'printingCopying': return employeeData.printingCopying || 0;
                            case 'officeSupplies': return employeeData.officeSupplies || 0;
                            case 'eesReceipt': return employeeData.eesReceipt || 0;
                            default: return 0;
                          }
                        })();
                        setEditingSummaryValue((total / employeeData.costCenters.length).toFixed(2));
                      }
                    }
                  }}
                >
                  {employeeData?.costCenters.map((center, index) => (
                    <MenuItem key={index} value={index}>
                      Cost Center #{index + 1}: {center}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}
            <TextField
              fullWidth
              label="Amount"
              type="number"
              value={editingSummaryValue}
              onChange={(e) => setEditingSummaryValue(e.target.value)}
              inputProps={{ 
                step: "0.01",
                min: "0"
              }}
              helperText="Enter the amount in dollars (e.g., 125.50)"
              autoFocus={editingSummaryItem?.field === 'other'}
            />
            {editingSummaryItem?.field === 'other' && (
              <TextField
                fullWidth
                label="Description"
                value={editingSummaryDescription}
                onChange={(e) => setEditingSummaryDescription(e.target.value)}
                multiline
                rows={3}
                helperText="Enter a description for this expense. This will appear as a tooltip on the page and below the entry when exporting/printing."
                placeholder="e.g., Conference registration fee, Equipment purchase, etc."
              />
            )}
            {editingSummaryItem?.field !== 'other' && receiptTotalsByCategory[editingSummaryItem?.field || ''] !== undefined && (
              <Alert severity="info" sx={{ mt: 1 }}>
                Receipt total for this category: ${(receiptTotalsByCategory[editingSummaryItem?.field || ''] || 0).toFixed(2)}
              </Alert>
            )}
            <Alert severity="info" sx={{ mt: 1 }}>
              {editingSummaryItem?.field === 'other' 
                ? 'This will add/update an Other Expenses entry in your summary sheet. The description will appear as a tooltip and in exports.'
                : `This will update the ${editingSummaryItem?.label || 'expense'} amount in your summary sheet. The change will be saved to your expense report.`}
            </Alert>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setSummaryEditDialogOpen(false);
            setEditingSummaryItem(null);
            setEditingSummaryValue('');
            setEditingSummaryDescription('');
          }}>
            Cancel
          </Button>
          <Button onClick={handleSaveSummaryEdit} variant="contained" color="primary">
            {editingSummaryItem?.field === 'other' && editingSummaryItem?.index === undefined ? 'Add' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* All Reports Dialog */}
      <Dialog 
        open={reportsDialogOpen} 
        onClose={() => setReportsDialogOpen(false)} 
        maxWidth={false}
        fullWidth
        PaperProps={{
          sx: {
            maxWidth: '90vw',
            maxHeight: '90vh',
            width: 'auto',
            height: 'auto',
          }
        }}
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6" component="div">All Submitted Reports</Typography>
            <IconButton onClick={() => setReportsDialogOpen(false)}>
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          {reportsLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 4 }}>
              <CircularProgress />
              <Typography variant="body1" sx={{ ml: 2 }}>Loading reports...</Typography>
            </Box>
          ) : allReports.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography variant="h6" color="textSecondary">No Reports Found</Typography>
              <Typography variant="body2" color="textSecondary">
                You haven't submitted any expense reports yet.
              </Typography>
            </Box>
          ) : (
            <TableContainer component={Paper} variant="outlined">
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell><strong>Year</strong></TableCell>
                    <TableCell><strong>Month</strong></TableCell>
                    <TableCell><strong>Status</strong></TableCell>
                    <TableCell><strong>Submitted Date</strong></TableCell>
                    <TableCell><strong>Approved Date</strong></TableCell>
                    <TableCell><strong>Total Amount</strong></TableCell>
                    <TableCell><strong>Actions</strong></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {allReports.map((report, index) => {
                    const monthNames = [
                      'January', 'February', 'March', 'April', 'May', 'June',
                      'July', 'August', 'September', 'October', 'November', 'December'
                    ];
                    
                    const getStatusColor = (status: string) => {
                      switch (status) {
                        case 'draft': return 'default';
                        case 'submitted': return 'primary';
                        case 'approved': return 'success';
                        case 'rejected': return 'error';
                        default: return 'default';
                      }
                    };
                    
                    const getTotalAmount = (reportData: any) => {
                      if (!reportData) return '$0.00';
                      
                      const total = (reportData.totalMileageAmount || 0) + 
                                  (reportData.phoneInternetFax || 0) + 
                                  (reportData.airRailBus || 0) + 
                                  (reportData.vehicleRentalFuel || 0) + 
                                  (reportData.parkingTolls || 0) + 
                                  (reportData.groundTransportation || 0) + 
                                  (reportData.hotelsAirbnb || 0) + 
                                  (reportData.perDiem || 0);
                      
                      return `$${total.toFixed(2)}`;
                    };
                    
                    return (
                      <TableRow key={report.id || index}>
                        <TableCell>{report.year}</TableCell>
                        <TableCell>{monthNames[report.month - 1]}</TableCell>
                        <TableCell>
                          <Chip 
                            label={report.status.toUpperCase()} 
                            color={getStatusColor(report.status)}
                            size="small"
                          />
                        </TableCell>
                        <TableCell>
                          {report.submittedAt ? new Date(report.submittedAt).toLocaleDateString() : '-'}
                        </TableCell>
                        <TableCell>
                          {report.approvedAt ? new Date(report.approvedAt).toLocaleDateString() : '-'}
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                            {getTotalAmount(report.reportData)}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                            <Button
                              size="small"
                              variant="outlined"
                              onClick={() => {
                                // Load this report
                                if (report.reportData) {
                                  const { receipts: savedReceipts, signatureImage: savedSignature, supervisorSignature: savedSupervisorSignature, ...savedEmployeeData } = report.reportData;
                                  
                                  setEmployeeData(savedEmployeeData);
                                  setReceipts(savedReceipts || []);
                                  setSignatureImage(savedSignature || null);
                                  setSupervisorSignatureState(savedSupervisorSignature || null);
                                  
                                  // Update the current month/year to match the loaded report
                                  setCurrentMonth(report.month);
                                  setCurrentYear(report.year);
                                  
                                  setReportsDialogOpen(false);
                                  showSuccess(`Report for ${monthNames[report.month - 1]} ${report.year} loaded successfully!`);
                                }
                              }}
                              disabled={report.status === 'draft'}
                            >
                              View
                            </Button>
                            {report.status === 'submitted' && (
                              <Button
                                size="small"
                                variant="contained"
                                color="primary"
                                onClick={() => {
                                  // Export PDF for this report
                                  alert(`PDF export for ${monthNames[report.month - 1]} ${report.year} would be implemented here`);
                                }}
                              >
                                Export PDF
                              </Button>
                            )}
                            {(report.status === 'draft' || report.status === 'submitted') && (
                              <Button
                                size="small"
                                variant="outlined"
                                color="error"
                                startIcon={<DeleteIcon />}
                                onClick={() => {
                                  if (window.confirm(`Are you sure you want to delete the ${report.status} report for ${monthNames[report.month - 1]} ${report.year}? This action cannot be undone.`)) {
                                    handleDeleteReport(report.id);
                                  }
                                }}
                              >
                                Delete
                              </Button>
                            )}
                          </Box>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setReportsDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Report Completeness Checker Dialog */}
      <Dialog 
        open={completenessDialogOpen} 
        onClose={() => setCompletenessDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="h6" component="div">Report Completeness Check</Typography>
            {completenessReport && (
              <Chip 
                label={`Score: ${completenessReport.overallScore}/100`}
                color={completenessReport.overallScore >= 80 ? 'success' : 
                       completenessReport.overallScore >= 60 ? 'warning' : 'error'}
                size="small"
              />
            )}
          </Box>
        </DialogTitle>
        <DialogContent>
          {completenessLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 4 }}>
              <CircularProgress />
              <Typography variant="body1" sx={{ ml: 2 }}>Analyzing report completeness...</Typography>
            </Box>
          ) : completenessReport ? (
            <Box>
              {/* Overall Status */}
              <Box sx={{ mb: 3, p: 2, bgcolor: completenessReport.isReadyForSubmission ? 'success.light' : 'warning.light', borderRadius: 1 }}>
                <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1 }}>
                  {completenessReport.isReadyForSubmission ? '✅ Ready for Submission' : '⚠️ Needs Attention'}
                </Typography>
                <Typography variant="body2">
                  {completenessReport.isReadyForSubmission 
                    ? 'Your report appears complete and ready for supervisor review.'
                    : 'Please review the issues below before submitting your report.'
                  }
                </Typography>
              </Box>

              {/* Issues List */}
              {completenessReport.issues.length > 0 ? (
                <Box sx={{ mb: 3 }}>
                  <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold' }}>
                    Issues Found ({completenessReport.issues.length})
                  </Typography>
                  {completenessReport.issues.map((issue: CompletenessIssue, index: number) => (
                    <Box key={issue.id} sx={{ mb: 2, p: 2, border: 1, borderColor: 'divider', borderRadius: 1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                        <Typography variant="body2" sx={{ fontSize: '1.2em' }}>
                          {getSeverityIcon(issue.severity)}
                        </Typography>
                        <Typography variant="subtitle1" sx={{ fontWeight: 'bold', color: getSeverityColor(issue.severity) }}>
                          {issue.title}
                        </Typography>
                        <Chip 
                          label={issue.severity.toUpperCase()} 
                          size="small" 
                          sx={{ 
                            bgcolor: getSeverityColor(issue.severity), 
                            color: 'white',
                            fontWeight: 'bold'
                          }} 
                        />
                      </Box>
                      <Typography variant="body2" sx={{ mb: 1 }}>
                        {issue.description}
                      </Typography>
                      <Typography variant="body2" sx={{ fontStyle: 'italic', color: 'text.secondary' }}>
                        💡 {issue.suggestion}
                      </Typography>
                      {issue.date && (
                        <Typography variant="caption" sx={{ display: 'block', mt: 1, color: 'text.secondary' }}>
                          Date: {issue.date.toLocaleDateString()}
                        </Typography>
                      )}
                    </Box>
                  ))}
                </Box>
              ) : (
                <Box sx={{ mb: 3, p: 2, bgcolor: 'success.light', borderRadius: 1 }}>
                  <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1 }}>
                    🎉 No Issues Found!
                  </Typography>
                  <Typography variant="body2">
                    Your report appears to be complete and well-structured.
                  </Typography>
                </Box>
              )}

              {/* Recommendations */}
              <Box sx={{ mb: 2 }}>
                <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold' }}>
                  Recommendations
                </Typography>
                {completenessReport.recommendations.map((recommendation: string, index: number) => (
                  <Typography key={index} variant="body2" sx={{ mb: 1, pl: 2 }}>
                    {recommendation}
                  </Typography>
                ))}
              </Box>
            </Box>
          ) : (
            <Typography variant="body1">No completeness data available.</Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCompletenessDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Submission Type Selection Dialog */}
      <Dialog 
        open={submissionTypeDialogOpen} 
        onClose={handleSubmissionTypeCancel}
        maxWidth={false}
        PaperProps={{
          sx: {
            maxWidth: '90vw',
            maxHeight: '90vh',
            width: 'auto',
            height: 'auto',
          }
        }}
        fullWidth
      >
        <DialogTitle>
          <Typography variant="h6" component="div">Select Submission Type</Typography>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body1" sx={{ mb: 3 }}>
            Please select the type of submission:
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Box sx={{ p: 2, border: 1, borderColor: 'divider', borderRadius: 1 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1 }}>
                📅 Monthly Submission
              </Typography>
              <Typography variant="body2" sx={{ mb: 2, color: 'text.secondary' }}>
                Full expense report submission with completeness check. This is the standard monthly submission.
              </Typography>
              <Button
                variant="contained"
                color="primary"
                fullWidth
                onClick={() => handleSubmissionTypeSelected(false)}
              >
                Submit Monthly Report
              </Button>
            </Box>
            <Box sx={{ p: 2, border: 1, borderColor: 'divider', borderRadius: 1 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1 }}>
                📋 Weekly Check-up
              </Typography>
              <Typography variant="body2" sx={{ mb: 2, color: 'text.secondary' }}>
                Submit for weekly review by your Regional Manager. Completeness check will be skipped.
              </Typography>
              <Button
                variant="outlined"
                color="primary"
                fullWidth
                onClick={() => handleSubmissionTypeSelected(true)}
              >
                Submit Weekly Check-up
              </Button>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleSubmissionTypeCancel}>Cancel</Button>
        </DialogActions>
      </Dialog>

      {/* Keyboard Shortcuts Dialog */}
      <KeyboardShortcutsDialog
        open={shortcutsDialogOpen}
        onClose={() => setShortcutsDialogOpen(false)}
        shortcuts={shortcuts}
        title={`Keyboard Shortcuts - ${employeeData?.preferredName ? `${employeeData.preferredName.split(' ')[0]}'s Portal` : employeeData?.name ? `${employeeData.name.split(' ')[0]}'s Portal` : 'Staff Portal'}`}
      />

      {/* Data Entry Tab */}
      <TabPanel value={activeTab} index={employeeData ? employeeData.costCenters.length + 6 : 6}>
        {employeeData ? (
          <DataEntryManager 
            employee={{
              id: employeeData.employeeId,
              name: employeeData.name,
              email: '', // Not needed for data entry
              password: '', // Not needed for data entry
              oxfordHouseId: '',
              position: '',
              phoneNumber: '',
              baseAddress: '',
              costCenters: employeeData.costCenters,
              selectedCostCenters: employeeData.costCenters,
              defaultCostCenter: employeeData.costCenters[0] || '',
              createdAt: new Date(),
              updatedAt: new Date()
            }}
            month={reportMonth}
            year={reportYear}
          />
        ) : (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography variant="h6" color="textSecondary">
              Loading employee data...
            </Typography>
          </Box>
        )}
      </TabPanel>

      {/* Settings Tab */}
      <TabPanel value={activeTab} index={employeeData ? employeeData.costCenters.length + 7 : 7}>
        <UserSettings 
          employeeId={employeeId} 
          onSettingsUpdate={(settings) => {
            // Optional callback when settings are updated
            debugLog('Settings updated:', settings);
          }} 
        />
      </TabPanel>

    </Container>
  );
};

// Wrap StaffPortal with UI Enhancement providers
const StaffPortalWithProviders: React.FC<StaffPortalProps> = (props) => {
  React.useEffect(() => {
    if (props.supervisorMode) {
      console.log('🔍 StaffPortalWithProviders received props:', {
        onApproveReport: typeof props.onApproveReport,
        onRequestRevision: typeof props.onRequestRevision,
        supervisorMode: props.supervisorMode,
        onApproveReportValue: props.onApproveReport,
        onRequestRevisionValue: props.onRequestRevision
      });
    }
  }, [props.supervisorMode, props.onApproveReport, props.onRequestRevision]);
  
  return (
    <UIEnhancementProvider>
      <ToastProvider>
        <TipsProvider>
          <StaffPortal {...props} />
        </TipsProvider>
      </ToastProvider>
    </UIEnhancementProvider>
  );
};

export default StaffPortalWithProviders;
