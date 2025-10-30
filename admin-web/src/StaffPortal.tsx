// Staff Portal - Expense Report Management Interface
// Designed to mirror the uploaded spreadsheet layout for easy transition
import React, { useState, useEffect, useCallback } from 'react';

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
  Alert,
  AlertTitle,
} from '@mui/material';

import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Close as CloseIcon,
  CloudUpload as UploadIcon,
} from '@mui/icons-material';

// PDF generation imports
import TabPdfExportService from './services/tabPdfExportService';

// Tips system imports
import { TipCard } from './components/TipCard';
import { useWebTips, TipsProvider } from './contexts/TipsContext';

// Real-time sync imports
import { useRealtimeSync, useRealtimeStatus } from './hooks/useRealtimeSync';

// Per Diem Rules imports
import { PerDiemRulesService } from './services/perDiemRulesService';

// Data entry imports
import { DataEntryManager } from './components/DataEntryManager';

// UI Enhancement imports
import { ToastProvider, useToast } from './contexts/ToastContext';
import { LoadingOverlay, useLoadingState } from './components/LoadingOverlay';
import { EnhancedHeader } from './components/EnhancedHeader';
import { EnhancedTabNavigation, createTabConfig } from './components/EnhancedTabNavigation';
import { UIEnhancementProvider } from './services/uiEnhancementService';

// Report completeness checker
import { ReportCompletenessService, CompletenessReport, CompletenessIssue } from './services/reportCompletenessService';

// Report approval service
import { ReportApprovalService } from './services/reportApprovalService';

// User settings component
import UserSettings from './components/UserSettings';

// Address formatting utility
import { formatAddressForDisplay } from './utils/addressFormatter';

// API URL configuration
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3002';

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
  eesReceipt: number;
  
  // Other expenses
  meals: number;
  other: number;
  
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
  supervisorName
}) => {
  const [activeTab, setActiveTab] = useState(0);
  const [employeeData, setEmployeeData] = useState<EmployeeExpenseData | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingCell, setEditingCell] = useState<{row: number, field: string} | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const [receipts, setReceipts] = useState<ReceiptData[]>([]);
  const [dailyDescriptions, setDailyDescriptions] = useState<any[]>([]);
  const [receiptDialogOpen, setReceiptDialogOpen] = useState(false);
  const [editingReceipt, setEditingReceipt] = useState<ReceiptData | null>(null);
  const [signatureImage, setSignatureImage] = useState<string | null>(null);
  const [signatureDialogOpen, setSignatureDialogOpen] = useState(false);
  const [supervisorSignatureState, setSupervisorSignature] = useState<string | null>(supervisorSignature || null);
  const [editingTimesheetCell, setEditingTimesheetCell] = useState<{costCenter: number, day: number, type: string} | null>(null);
  const [editingTimesheetValue, setEditingTimesheetValue] = useState('');
  const [editingCategoryCell, setEditingCategoryCell] = useState<{category: string, day: number} | null>(null);
  const [editingCategoryValue, setEditingCategoryValue] = useState('');
  const [reportsDialogOpen, setReportsDialogOpen] = useState(false);
  const [allReports, setAllReports] = useState<any[]>([]);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0); // Used to force data reload
  
  // Report completeness checker state
  const [completenessReport, setCompletenessReport] = useState<CompletenessReport | null>(null);
  const [completenessDialogOpen, setCompletenessDialogOpen] = useState(false);
  const [completenessLoading, setCompletenessLoading] = useState(false);

  // Report submission and approval state
  const [reportStatus, setReportStatus] = useState<'draft' | 'submitted' | 'approved' | 'rejected' | 'needs_revision'>('draft');
  const [revisionItems, setRevisionItems] = useState<{mileage: number, receipts: number, time: number}>({mileage: 0, receipts: 0, time: 0});
  // Raw line item data for revision checking
  const [rawMileageEntries, setRawMileageEntries] = useState<any[]>([]);
  const [rawTimeEntries, setRawTimeEntries] = useState<any[]>([]);
  // Note: submissionLoading, approvalDialogOpen, approvalAction, approvalComments reserved for future approval workflow implementation

  // Real-time sync
  useRealtimeStatus();
  useRealtimeSync({
    enabled: true,
    onUpdate: (update) => {
      console.log('🔄 StaffPortal: Received real-time update:', update);
      // Refresh data when updates are received
      // Note: loadEmployeeData will be called via useEffect on employeeId/reportMonth/reportYear changes
    },
    onConnectionChange: (connected) => {
      console.log(`🔄 StaffPortal: Real-time sync ${connected ? 'connected' : 'disconnected'}`);
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
  const daysInMonth = new Date(reportYear, reportMonth, 0).getDate();

  // State to prevent multiple simultaneous calls to refreshTimesheetData
  const [isRefreshingTimesheet, setIsRefreshingTimesheet] = useState(false);

  // Function to refresh timesheet data after saving - NEW APPROACH: Daily Hours Distribution
  const refreshTimesheetData = useCallback(async (dataToUse?: any) => {
    console.log('🔄 refreshTimesheetData called');
    const data = dataToUse || employeeData;
    if (!data) {
      console.log('❌ No employeeData, skipping refresh');
      return;
    }
    
    // Prevent multiple simultaneous calls
    if (isRefreshingTimesheet) {
      console.log('⏳ refreshTimesheetData already running, skipping');
      return;
    }
    setIsRefreshingTimesheet(true);
    
    try {
      // Fetch updated time tracking data
      const timeTrackingResponse = await fetch(`${API_BASE_URL}/api/time-tracking?employeeId=${employeeId}&month=${reportMonth}&year=${reportYear}`);
      const timeTracking = timeTrackingResponse.ok ? await timeTrackingResponse.json() : [];
      
      // Filter for current month
      const currentMonthTimeTracking = timeTracking.filter((tracking: any) => {
        const trackingDate = new Date(tracking.date);
        const trackingMonth = trackingDate.getUTCMonth() + 1;
        const trackingYear = trackingDate.getUTCFullYear();
        return trackingMonth === reportMonth && trackingYear === reportYear;
      });
      
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
      
      // Process all time tracking entries and group by day
      console.log('🔍 Processing time tracking entries:', currentMonthTimeTracking.length);
      currentMonthTimeTracking.forEach((tracking: any) => {
        const trackingDate = new Date(tracking.date);
        const day = trackingDate.getUTCDate();
        
        console.log(`🔍 Processing entry: Day ${day}, CostCenter: "${tracking.costCenter}", Category: "${tracking.category}", Hours: ${tracking.hours}`);
        
        if (day >= 1 && day <= daysInMonth) {
          const dayData = dailyHourDistributions[day];
          const categoryTypes = ['G&A', 'Holiday', 'PTO', 'STD/LTD', 'PFL/PFML'];
          
          if (tracking.costCenter && tracking.costCenter !== '') {
            // Cost center entry - use assignment since deterministic IDs should prevent duplicates
            const costCenterIndex = data.costCenters.findIndex((cc: string) => cc === tracking.costCenter);
            console.log(`🔍 Cost center entry: "${tracking.costCenter}" -> index ${costCenterIndex}`);
            if (costCenterIndex >= 0) {
              dayData.costCenterHours[costCenterIndex] = (tracking.hours || 0);
              console.log(`✅ Updated cost center ${costCenterIndex} for day ${day}: ${tracking.hours} hours`);
            }
          } else if (categoryTypes.includes(tracking.category)) {
            // Category entry - use assignment since deterministic IDs should prevent duplicates
            dayData.categoryHours[tracking.category] = (tracking.hours || 0);
            console.log(`✅ Updated category "${tracking.category}" for day ${day}: ${tracking.hours} hours`);
          } else if (tracking.category === 'Working Hours' || tracking.category === 'Regular Hours') {
            // Working hours entry - treat as cost center 0, use assignment since deterministic IDs should prevent duplicates
            dayData.costCenterHours[0] = (tracking.hours || 0);
            console.log(`✅ Updated working hours (cost center 0) for day ${day}: ${tracking.hours} hours`);
          } else {
            // Unknown entry type - log for debugging
            console.log(`⚠️ Unknown entry type: CostCenter="${tracking.costCenter}", Category="${tracking.category}"`);
          }
        }
      });
      
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
      
      // Update daily entries with the new distribution approach
      const updatedDailyEntries = data.dailyEntries.map((entry: any) => {
        const dayData = dailyHourDistributions[entry.day] || {
          costCenterHours: {},
          categoryHours: {},
          totalHours: 0,
          workingHours: 0
        };
        
        
        // Build updated entry with distributed hours
        const updatedEntry = {
          ...entry,
          hoursWorked: dayData.totalHours,
          workingHours: dayData.workingHours
        };
        
        // Add cost center specific hours
        data.costCenters.forEach((costCenter: string, index: number) => {
          const propertyName = `costCenter${index}Hours`;
          (updatedEntry as any)[propertyName] = dayData.costCenterHours[index] || 0;
        });
        
        // Add category hours
        (updatedEntry as any).categoryHours = dayData.categoryHours;
        
        // Debug logging for this entry
        if (dayData.totalHours > 0) {
          console.log(`🔍 Day ${entry.day} distribution:`, {
            costCenterHours: dayData.costCenterHours,
            categoryHours: dayData.categoryHours,
            totalHours: dayData.totalHours,
            workingHours: dayData.workingHours
          });
        }
        
        return updatedEntry;
      });
      
      // Calculate total hours for the month
      const totalHours = Object.values(dailyHourDistributions).reduce((sum: number, dayData: any) => sum + dayData.totalHours, 0);
      
      // Update employee data
      setEmployeeData(prev => prev ? {
        ...prev,
        dailyEntries: updatedDailyEntries,
        totalHours: totalHours
      } : null);
      
      console.log('✅ Timesheet data refreshed with new distribution approach');
    } catch (error) {
      console.error('❌ Error refreshing timesheet data:', error);
    } finally {
      setIsRefreshingTimesheet(false);
    }
    console.log('🔄 refreshTimesheetData completed');
  }, [employeeId, reportMonth, reportYear, daysInMonth]); // eslint-disable-line react-hooks/exhaustive-deps

  // Debug logging for delete button visibility - DISABLED to prevent infinite loop
  // console.log('🔍 StaffPortal Debug:', {
  //   reportStatus,
  //   isAdminView,
  //   showDeleteButton: (reportStatus === 'draft' || reportStatus === 'submitted') && !isAdminView
  // });
  
  // Format month name
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                    'July', 'August', 'September', 'October', 'November', 'December'];
  const monthName = monthNames[reportMonth - 1];

  // Load employee data based on props
  useEffect(() => {
    const loadEmployeeData = async () => {
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
      const backendEmployeeId = employeeIdMap[employeeId] || employeeId;
      
      try {
        // Fetch employee details from backend
        const employeeResponse = await fetch(`${API_BASE_URL}/api/employees/${backendEmployeeId}`);
        if (!employeeResponse.ok) {
          // If employee not found, silently try with fallback ID
          console.log(`Employee ${backendEmployeeId} not found in backend, using fallback employee data...`);
          const fallbackResponse = await fetch(`${API_BASE_URL}/api/employees/mggwglbfk9dij3oze8l`);
          if (fallbackResponse.ok) {
            employee = await fallbackResponse.json();
            console.log('✅ Successfully loaded fallback employee data for:', employee.name);
          } else {
            throw new Error('Failed to fetch employee data');
          }
        } else {
          employee = await employeeResponse.json();
          console.log('✅ Successfully loaded employee data for:', employee.name);
        }
        
        // Parse costCenters if it's a JSON string
        if (employee.costCenters) {
          console.log('🔍 StaffPortal: costCenters type:', typeof employee.costCenters, 'value:', employee.costCenters);
          try {
            if (typeof employee.costCenters === 'string') {
              // Check if it's the string "[object Object]" which means it's not valid JSON
              if (employee.costCenters === '[object Object]') {
                console.warn('costCenters is "[object Object]" string, using default');
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
            console.warn('Failed to parse costCenters:', error);
            costCenters = ['NC.F-SAPTBG']; // Use default
          }
        }
        
        // Load real data from mobile app database for current month
        // Loading real data for employee
          
          const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                            'July', 'August', 'September', 'October', 'November', 'December'];
          const monthName = monthNames[reportMonth - 1];
          const daysInMonth = new Date(reportYear, reportMonth, 0).getDate();
          
          // Fetch real data from backend APIs
          const [mileageResponse, receiptsResponse, timeTrackingResponse, dailyDescriptionsResponse, reportResponse] = await Promise.all([
            fetch(`${API_BASE_URL}/api/mileage-entries?employeeId=${employeeId}&month=${reportMonth}&year=${reportYear}`),
            fetch(`${API_BASE_URL}/api/receipts?employeeId=${employeeId}&month=${reportMonth}&year=${reportYear}`),
            fetch(`${API_BASE_URL}/api/time-tracking?employeeId=${employeeId}&month=${reportMonth}&year=${reportYear}`),
            fetch(`${API_BASE_URL}/api/daily-descriptions?employeeId=${employeeId}&month=${reportMonth}&year=${reportYear}`),
            fetch(`${API_BASE_URL}/api/monthly-reports?employeeId=${employeeId}&month=${reportMonth}&year=${reportYear}`)
          ]);
          
          const mileageEntries = mileageResponse.ok ? await mileageResponse.json() : [];
          const receipts = receiptsResponse.ok ? await receiptsResponse.json() : [];
          const timeTracking = timeTrackingResponse.ok ? await timeTrackingResponse.json() : [];
          const dailyDescriptions = dailyDescriptionsResponse.ok ? await dailyDescriptionsResponse.json() : [];
          
          // Parse monthly report status
          if (reportResponse.ok) {
            const reports = await reportResponse.json();
            const currentReport = Array.isArray(reports) && reports.length > 0 
              ? reports.filter((r: any) => r.month === reportMonth && r.year === reportYear)[0]
              : null;
            if (currentReport?.status) {
              setReportStatus(currentReport.status);
            }
          }
          
          const currentMonthMileage = mileageEntries.filter((entry: any) => {
            const entryDate = new Date(entry.date);
            const entryMonth = entryDate.getUTCMonth() + 1; // Use UTC to avoid timezone issues
            const entryYear = entryDate.getUTCFullYear();
            return entryMonth === reportMonth && entryYear === reportYear;
          });
          
          const currentMonthReceipts = receipts.filter((receipt: any) => {
            const receiptDate = new Date(receipt.date);
            const receiptMonth = receiptDate.getUTCMonth() + 1;
            const receiptYear = receiptDate.getUTCFullYear();
            return receiptMonth === reportMonth && receiptYear === reportYear;
          });
          
          const currentMonthTimeTracking = timeTracking.filter((tracking: any) => {
            const trackingDate = new Date(tracking.date);
            const trackingMonth = trackingDate.getUTCMonth() + 1;
            const trackingYear = trackingDate.getUTCFullYear();
            return trackingMonth === reportMonth && trackingYear === reportYear;
          });
          
          // Data filtered for current month
          
          // Generate daily entries based on real data
          const dailyEntries = await Promise.all(Array.from({ length: daysInMonth }, async (_, i) => {
            const day = i + 1;
            const date = new Date(reportYear, reportMonth - 1, day);
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
              
              dayMileageEntries.forEach((entry: any, index: number) => {
                // For the first trip, include the starting location
                if (index === 0) {
                  const startLocation = entry.startLocation || '';
                  // Check if it's already formatted (contains parentheses)
                  if (startLocation.includes('(') && startLocation.includes(')')) {
                    tripSegments.push(startLocation);
                  } else if (startLocation === 'BA' || startLocation.toLowerCase() === 'base address') {
                    tripSegments.push('BA');
                  } else if (startLocation) {
                    // Try to format if we can detect it's a base address
                    tripSegments.push(formatAddressForDisplay(startLocation, false));
                  } else {
                    tripSegments.push(startLocation);
                  }
                }
                
                // Add the trip segment: "to [EndLocation] ([Address]) for [Purpose]"
                const endLocation = entry.endLocation || '';
                const purpose = entry.purpose || 'Travel';
                
                // Check if endLocation is BA - don't add purpose for base address returns
                if (endLocation === 'BA' || endLocation.toLowerCase() === 'base address') {
                  tripSegments.push('to BA');
                } else if (endLocation.includes('(') && endLocation.includes(')')) {
                  // Already formatted
                  tripSegments.push(`to ${endLocation} for ${purpose}`);
                } else if (endLocation) {
                  // Try to format if we can detect it's a base address
                  tripSegments.push(`to ${formatAddressForDisplay(endLocation, false)} for ${purpose}`);
                } else {
                  tripSegments.push(`to ${endLocation} for ${purpose}`);
                }
              });
              
              // Format: "Start to End (Address) for Purpose"
              drivingSummary = tripSegments.join(' ');
            }
            
            // Concatenate daily description + driving summary
            let fullDescription = '';
            if (dayDescription && dayDescription.description) {
              fullDescription = dayDescription.description.trim();
              if (drivingSummary) {
                fullDescription += '\n\n' + drivingSummary;
              }
            } else if (drivingSummary) {
              fullDescription = drivingSummary;
            } else {
              fullDescription = ''; // Empty description for blank days
            }
            
            // Calculate total miles for the day
            const totalDayMiles = dayMileageEntries.reduce((sum: number, entry: any) => sum + (entry.miles || 0), 0);
            
            // Get first odometer start and last odometer end
            const firstEntry = dayMileageEntries[0];
            const lastEntry = dayMileageEntries[dayMileageEntries.length - 1];
            
            // Find time tracking for this day (use UTC to avoid timezone issues)
            const dayTimeTracking = currentMonthTimeTracking.find((tracking: any) => {
              const trackingDate = new Date(tracking.date);
              return trackingDate.getUTCDate() === day;
            });
            
            // Find Per Diem receipts for this day (use UTC to avoid timezone issues)
            const dayPerDiemReceipts = currentMonthReceipts.filter((receipt: any) => {
              const receiptDate = new Date(receipt.date);
              return receiptDate.getUTCDate() === day && receipt.category === 'Per Diem';
            });
            
            // Calculate Per Diem amount from receipts
            const perDiemFromReceipts = dayPerDiemReceipts.reduce((sum: number, receipt: any) => sum + (receipt.amount || 0), 0);
            
            // Calculate Per Diem based on rules if no receipts exist
            let calculatedPerDiem = perDiemFromReceipts;
            if (perDiemFromReceipts === 0 && totalDayMiles > 0 && dayTimeTracking?.hours > 0) {
              // Get employee's cost center
              const costCenter = employee.defaultCostCenter || employee.costCenters?.[0] || 'Program Services';
              
              // Calculate Per Diem using rules
              try {
                const perDiemResult = await PerDiemRulesService.calculatePerDiem(
                  costCenter,
                  dayTimeTracking.hours || 0,
                  totalDayMiles,
                  0, // distanceFromBase - would need geocoding
                  perDiemFromReceipts
                );
                
                if (perDiemResult.meetsRequirements) {
                  calculatedPerDiem = perDiemResult.amount;
                  console.log(`💰 StaffPortal: Calculated Per Diem for ${employee.name} on ${dateStr}:`, {
                    costCenter,
                    hours: dayTimeTracking.hours,
                    miles: totalDayMiles,
                    amount: calculatedPerDiem,
                    rule: perDiemResult.rule
                  });
                }
              } catch (error) {
                console.error('❌ StaffPortal: Error calculating Per Diem:', error);
              }
            }
            
            return {
              day,
              date: dateStr,
              description: fullDescription,
              hoursWorked: dayTimeTracking?.hours || 0,
              workingHours: dayTimeTracking?.hours || 0, // Set workingHours to match hoursWorked for existing data
              odometerStart: Math.round(firstEntry?.odometerReading || 0),
              odometerEnd: Math.round(lastEntry ? (lastEntry.odometerReading + lastEntry.miles) : 0),
              milesTraveled: Math.round(totalDayMiles),
              mileageAmount: totalDayMiles * 0.445,
              airRailBus: 0,
              vehicleRentalFuel: 0,
              parkingTolls: 0,
              groundTransportation: 0,
              hotelsAirbnb: 0,
              perDiem: calculatedPerDiem
            };
          }));
          
          // Calculate totals from real data
          const totalMiles = currentMonthMileage.reduce((sum: number, entry: any) => sum + (entry.miles || 0), 0);
          const totalMileageAmount = totalMiles * 0.445;
          const totalReceipts = currentMonthReceipts.reduce((sum: number, receipt: any) => sum + (receipt.amount || 0), 0);
          const totalHours = currentMonthTimeTracking.reduce((sum: number, tracking: any) => sum + (tracking.hours || 0), 0);
          
          // Calculate total Per Diem from receipts (separate from other receipts)
          const totalPerDiemFromReceipts = currentMonthReceipts
            .filter((receipt: any) => receipt.category === 'Per Diem')
            .reduce((sum: number, receipt: any) => sum + (receipt.amount || 0), 0);
          
          // Calculate total Per Diem from daily entries (manual entries + receipt-based)
          const totalPerDiemFromEntries = dailyEntries.reduce((sum: number, entry: any) => sum + (entry.perDiem || 0), 0);
          
          // Create employee expense data with real data
          const expenseData: EmployeeExpenseData = {
            employeeId: employee.id,
            name: employee.name,
            preferredName: employee.preferredName,
            month: monthName,
            year: reportYear,
            dateCompleted: new Date(reportYear, reportMonth, 0).toLocaleDateString('en-US', { 
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
            perDiem: totalPerDiemFromReceipts, // Use Per Diem receipts total
            phoneInternetFax: totalReceipts - totalPerDiemFromReceipts, // Exclude Per Diem from other receipts
            shippingPostage: 0,
            printingCopying: 0,
            officeSupplies: 0,
            eesReceipt: 0,
            meals: 0,
            other: 0,
            
            baseAddress: employee.baseAddress || '230 Wagner St, Troutman, NC 28166',
            baseAddress2: employee.baseAddress2
          };
          
          setEmployeeData(expenseData);
          setReceipts(currentMonthReceipts.map((receipt: any) => ({
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
          })));
          setDailyDescriptions(dailyDescriptions);
          
          // Refresh timesheet data to load actual hours from database
          await refreshTimesheetData(expenseData);
      } catch (error) {
        console.error('Error loading employee data:', error);
        // Create dynamic fallback data instead of using hardcoded mock data
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                          'July', 'August', 'September', 'October', 'November', 'December'];
        const monthName = monthNames[reportMonth - 1];
        const daysInMonth = new Date(reportYear, reportMonth, 0).getDate();
        
        // Generate daily entries for the selected month
        const dailyEntries = Array.from({ length: daysInMonth }, (_, i) => {
          const day = i + 1;
          const date = new Date(reportYear, reportMonth - 1, day);
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
          year: reportYear,
          dateCompleted: new Date(reportYear, reportMonth, 0).toLocaleDateString('en-US', { 
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
          meals: 0,
          other: 0,
          
          baseAddress: employee?.baseAddress || '230 Wagner St, Troutman, NC 28166',
          baseAddress2: employee?.baseAddress2
        };
        
        setEmployeeData(fallbackData);
        setReceipts([]); // Start with empty receipts
        
        // Refresh timesheet data to load actual hours from database
        await refreshTimesheetData(fallbackData);
      } finally {
        setLoading(false);
      }
    };
    
    loadEmployeeData();
  }, [employeeId, reportMonth, reportYear, refreshTrigger]);

  // Initialize tips when employee data is loaded
  useEffect(() => {
    if (employeeId && !loading) {
      setCurrentUserId(employeeId);
      loadTipsForScreen('staff_portal', 'on_load');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeeId, loading]);

  // Check for revision requests
  useEffect(() => {
    const checkRevisionItems = async () => {
      if (reportStatus === 'needs_revision' && employeeId) {
        try {
          // Fetch receipts, mileage entries, and time entries to check for revision flags
          const [receiptsRes, mileageRes, timeRes] = await Promise.all([
            fetch(`http://localhost:3002/api/receipts?employeeId=${employeeId}&month=${reportMonth}&year=${reportYear}`),
            fetch(`http://localhost:3002/api/mileage-entries?employeeId=${employeeId}&month=${reportMonth}&year=${reportYear}`),
            fetch(`http://localhost:3002/api/time-tracking?employeeId=${employeeId}&month=${reportMonth}&year=${reportYear}`)
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
          console.error('Error checking revision items:', error);
        }
      } else {
        setRevisionItems({ mileage: 0, receipts: 0, time: 0 });
        setRawMileageEntries([]);
        setRawTimeEntries([]);
      }
    };

    checkRevisionItems();
  }, [reportStatus, employeeId, reportMonth, reportYear]);

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
      console.error('Error deleting report:', error);
      alert('Error deleting report. Please try again.');
    }
  };


  // Handle cell editing
  const handleCellEdit = (rowIndex: number, field: string, currentValue: any) => {
    setEditingCell({ row: rowIndex, field });
    setEditingValue(currentValue.toString());
  };

  // Save cell edit
  const handleCellSave = async () => {
    if (!editingCell || !employeeData) return;
    
    const { row, field } = editingCell;
    const newEntries = [...employeeData.dailyEntries];
    
    if (field === 'description') {
      newEntries[row].description = editingValue;
      
      // Also update the dailyDescriptions state for proper syncing
      const updatedDailyDescriptions = [...dailyDescriptions];
      const entry = newEntries[row];
      const dateStr = `${reportYear}-${reportMonth.toString().padStart(2, '0')}-${entry.day.toString().padStart(2, '0')}`;
      const hasDescription = editingValue && editingValue.trim();
      
      // Find existing daily description for this date
      const existingDescIndex = updatedDailyDescriptions.findIndex(desc => desc.date === dateStr);
      
      if (existingDescIndex >= 0) {
        if (hasDescription) {
          // Update existing description
          updatedDailyDescriptions[existingDescIndex].description = editingValue;
        } else {
          // Remove existing description if it's empty
          updatedDailyDescriptions.splice(existingDescIndex, 1);
        }
      } else if (hasDescription) {
        // Create new description entry only if it has content
        updatedDailyDescriptions.push({
          id: `desc-${entry.day}`,
          employeeId: employeeData.employeeId,
          date: dateStr,
          description: editingValue,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      }
      
      setDailyDescriptions(updatedDailyDescriptions);
    } else if (field === 'odometerStart') {
      const value = parseInt(editingValue) || 0;
      newEntries[row].odometerStart = value;
      // Recalculate miles if both odometer values are present
      if (newEntries[row].odometerEnd > 0) {
        newEntries[row].milesTraveled = newEntries[row].odometerEnd - value;
        newEntries[row].mileageAmount = newEntries[row].milesTraveled * 0.445;
      }
    } else if (field === 'odometerEnd') {
      const value = parseInt(editingValue) || 0;
      newEntries[row].odometerEnd = value;
      // Recalculate miles if both odometer values are present
      if (newEntries[row].odometerStart > 0) {
        newEntries[row].milesTraveled = value - newEntries[row].odometerStart;
        newEntries[row].mileageAmount = newEntries[row].milesTraveled * 0.445;
      }
    } else if (field === 'hoursWorked') {
      newEntries[row].hoursWorked = parseInt(editingValue) || 0;
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
    
    // Update totals
    const updatedData = {
      ...employeeData,
      dailyEntries: newEntries,
      totalMileageAmount: newEntries.reduce((sum, entry) => sum + entry.mileageAmount, 0),
      totalHours: newEntries.reduce((sum, entry) => sum + entry.hoursWorked, 0),
      totalMiles: newEntries.reduce((sum, entry) => sum + entry.milesTraveled, 0),
      perDiem: Math.min(newEntries.reduce((sum, entry) => sum + entry.perDiem, 0), 350)
    };
    
    setEmployeeData(updatedData);
    setEditingCell(null);
    setEditingValue('');
    
    // Auto-save changes to backend and sync to source tables
    try {
      const reportData = {
        ...updatedData,
        receipts: receipts,
        dailyDescriptions: dailyDescriptions,
        employeeSignature: signatureImage,
        supervisorSignature: supervisorSignatureState
      };

      // Sync to source tables (mileage_entries, time_tracking, receipts, employees)
      await fetch(`${API_BASE_URL}/api/expense-reports/sync-to-source`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          employeeId: updatedData.employeeId,
          month: reportMonth,
          year: reportYear,
          reportData: reportData
        }),
      });
      
      console.log('✅ Changes auto-saved and synced to source tables');
    } catch (error) {
      console.error('Error auto-saving changes:', error);
      // Don't show alert for auto-save failures to avoid interrupting user workflow
    }
  };

  // Handle timesheet cell editing
  const handleTimesheetCellEdit = (costCenter: number, day: number, type: string, currentValue: any) => {
    setEditingTimesheetCell({ costCenter, day, type });
    setEditingTimesheetValue(currentValue.toString());
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
    
    console.log('🔍 NEW APPROACH: Saving timesheet cell');
    console.log(`  Day: ${day}, Type: ${type}, Cost Center Index: ${costCenter}, Value: ${value}`);
    
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
    
    console.log(`  Final actualCostCenter: "${actualCostCenter}"`);
    console.log(`  Final category: "${category}"`);
    
    // Save to time tracking API with correct cost center and category
    try {
      const dateStr = `${reportYear}-${reportMonth.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
      
      // Save to time tracking table
      await fetch(`${API_BASE_URL}/api/time-tracking`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          employeeId: employeeData.employeeId,
          date: dateStr,
          hours: value,
          category: category,
          description: `${category} hours worked on ${dateStr}`,
          costCenter: actualCostCenter
        }),
      });
  
      console.log(`✅ Saved ${value} hours as "${category}" for "${actualCostCenter}" on day ${day}`);
    } catch (error) {
      console.error('Error saving to time tracking API:', error);
    }
    
    // Auto-save changes to backend and sync to source tables
    try {
      const reportData = {
        ...employeeData,
        receipts: receipts,
        dailyDescriptions: dailyDescriptions,
        employeeSignature: signatureImage,
        supervisorSignature: supervisorSignatureState
      };
  
      await fetch(`${API_BASE_URL}/api/expense-reports/sync-to-source`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          employeeId: employeeData.employeeId,
          month: reportMonth,
          year: reportYear,
          reportData: reportData
        }),
      });
      
      console.log('✅ Timesheet changes auto-saved and synced to source tables');
    } catch (error) {
      console.error('Error auto-saving timesheet changes:', error);
    }
    
    // Clear editing state
    setEditingTimesheetCell(null);
    setEditingTimesheetValue('');
    
    // Refresh timesheet data to show updated values with new distribution approach
    await refreshTimesheetData(employeeData);
  };

  // Cancel timesheet cell edit
  const handleTimesheetCellCancel = () => {
    setEditingTimesheetCell(null);
    setEditingTimesheetValue('');
  };

  // Handle category cell editing
  const handleCategoryCellEdit = (category: string, day: number, currentValue: any) => {
    console.log(`🔍 Debug category cell edit: ${category} for day ${day}, current value: ${currentValue}`);
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
    
    console.log('🔍 NEW APPROACH: Saving category cell');
    console.log(`  Day: ${day}, Category: ${category}, Mapped: ${mappedCategory}, Value: ${value}`);
    console.log(`  Cost Center: "${actualCostCenter}" (empty for categories)`);
    
    // Save to time tracking API with correct category
    try {
      const dateStr = `${reportYear}-${reportMonth.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
      
      // Save to time tracking table
      await fetch(`${API_BASE_URL}/api/time-tracking`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          employeeId: employeeData.employeeId,
          date: dateStr,
          hours: value,
          category: mappedCategory,
          description: `${mappedCategory} hours worked on ${dateStr}`,
          costCenter: actualCostCenter
        }),
      });

      console.log(`✅ Saved ${value} hours as "${mappedCategory}" for "${actualCostCenter}" on day ${day}`);
    } catch (error) {
      console.error('Error saving category hours to time tracking API:', error);
    }
    
    // Auto-save changes to backend and sync to source tables
    try {
      const reportData = {
        ...employeeData,
        receipts: receipts,
        dailyDescriptions: dailyDescriptions,
        employeeSignature: signatureImage,
        supervisorSignature: supervisorSignatureState
      };

      await fetch(`${API_BASE_URL}/api/expense-reports/sync-to-source`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          employeeId: employeeData.employeeId,
          month: reportMonth,
          year: reportYear,
          reportData: reportData
        }),
      });
      
      console.log('✅ Category hours synced to source tables');
    } catch (error) {
      console.error('Error syncing category hours:', error);
    }
    
    // Refresh timesheet data to show updated values
    await refreshTimesheetData(employeeData);
  };

  // Cancel category cell edit
  const handleCategoryCellCancel = () => {
    setEditingCategoryCell(null);
    setEditingCategoryValue('');
  };

  // Handle signature file upload
  const handleSignatureUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type === 'image/png') {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const result = e.target?.result as string;
        // Signature uploaded successfully
        setSignatureImage(result);
        setSignatureDialogOpen(false);
        
        // Auto-save signature
        if (employeeData) {
          try {
            const reportData = {
              ...employeeData,
              receipts: receipts,
              employeeSignature: result,
              supervisorSignature: supervisorSignatureState
            };

            await fetch(`${API_BASE_URL}/api/expense-reports/sync-to-source`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                employeeId: employeeData.employeeId,
                month: reportMonth,
                year: reportYear,
                reportData: reportData
              }),
            });
            
            console.log('✅ Signature upload synced to source tables');
          } catch (error) {
            console.error('Error syncing signature upload:', error);
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
    
    // Auto-save signature removal
    if (employeeData) {
      try {
        const reportData = {
          ...employeeData,
          receipts: receipts,
          employeeSignature: null,
          supervisorSignature: supervisorSignatureState
        };

        await fetch(`${API_BASE_URL}/api/expense-reports/sync-to-source`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            employeeId: employeeData.employeeId,
            month: reportMonth,
            year: reportYear,
            reportData: reportData
          }),
        });
        
        console.log('✅ Signature removal synced to source tables');
      } catch (error) {
        console.error('Error syncing signature removal:', error);
      }
    }
  };

  // Handle receipt image upload
  const handleReceiptImageUpload = (receiptId: string, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        // Update the receipt with the new image
        setReceipts(receipts.map(receipt => 
          receipt.id === receiptId 
            ? { ...receipt, imageUri: result }
            : receipt
        ));
      };
      reader.readAsDataURL(file);
    } else {
      alert('Please upload an image file.');
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
        reportMonth,
        reportYear
      );
      
      setCompletenessReport(report);
    } catch (error) {
      console.error('Error checking report completeness:', error);
      // Show error state
      setCompletenessReport({
        employeeId: employeeData.employeeId,
        month: reportMonth,
        year: reportYear,
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

  async function generateSummarySheet(pdf: any, data: EmployeeExpenseData) {
    // Generating Summary Sheet
    console.log('🔧 generateSummarySheet called with updated alignment logic');
    
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
      { label: 'AIR / RAIL / BUS', value: data.airRailBus },
      { label: 'VEHICLE RENTAL / FUEL', value: data.vehicleRentalFuel },
      { label: 'PARKING / TOLLS', value: data.parkingTolls },
      { label: 'GROUND', value: data.groundTransportation },
      { label: 'LODGING', value: data.hotelsAirbnb },
      { label: 'PER DIEM', value: data.perDiem }
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
    pdf.text('OTHER EXPENSES', tableStartX + 2, yPos + 3);
    
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
    pdf.text('COMMUNICATIONS', tableStartX + 2, yPos + 3);
    
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
    pdf.text('SUPPLIES', tableStartX + 2, yPos + 3);
    
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
    const totalExpenses = data.totalMileageAmount + data.airRailBus + data.vehicleRentalFuel + 
                         data.parkingTolls + data.groundTransportation + data.hotelsAirbnb + 
                         data.perDiem + data.phoneInternetFax + data.shippingPostage + 
                         data.printingCopying + data.officeSupplies + data.eesReceipt + 
                         data.meals + data.other;
    
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
      const milesTraveled = entry?.milesTraveled || 0;
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
    
    pdf.text(totalMiles.toString(), subtotalX, tableY);
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
          console.warn('Could not add receipt image:', error);
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
        supervisorSignature: supervisorSignatureState
      };

      // Use the sync endpoint to save AND sync to source tables
      const response = await fetch(`${API_BASE_URL}/api/expense-reports/sync-to-source`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          employeeId: employeeData.employeeId,
          month: reportMonth,
          year: reportYear,
          reportData: reportData
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save expense report');
      }

      await response.json();
      showSuccess('Report saved and synced successfully! Changes will appear in the mobile app.');
      
      // Wait a moment to ensure database commits, then refresh
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Refresh the data to update all tabs
      setRefreshTrigger(prev => prev + 1);
      
    } catch (error) {
      console.error('Error saving report:', error);
      showError(`Error saving report: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      stopLoading();
    }
  };

  // Load expense report from backend
  const handleLoadReport = async () => {
    if (!employeeId || !reportMonth || !reportYear) {
      alert('Missing employee ID, month, or year');
      return;
    }

    try {
      setLoading(true);
      
      const response = await fetch(`${API_BASE_URL}/api/expense-reports/${employeeId}/${reportMonth}/${reportYear}`);
      
      if (response.status === 404) {
        // No saved report found, using current data
        return; // No saved report, keep current data
      }
      
      if (!response.ok) {
        throw new Error('Failed to load expense report');
      }

      const savedReport = await response.json();
      // Loaded saved report
      
      // Restore the saved data
      if (savedReport.reportData) {
        const { receipts: savedReceipts, signatureImage: savedSignature, supervisorSignature: savedSupervisorSignature, ...savedEmployeeData } = savedReport.reportData;
        
        setEmployeeData(savedEmployeeData);
        setReceipts(savedReceipts || []);
        setSignatureImage(savedSignature || null);
        setSupervisorSignature(savedSupervisorSignature || null);
        
        // Also load the report status
        if (savedReport.status) {
          setReportStatus(savedReport.status);
        }
        
        alert('Expense report loaded successfully!');
      }
      
    } catch (error) {
      console.error('Error loading report:', error);
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

    // First, run completeness check automatically
    let completenessReport: CompletenessReport;
    try {
      setLoading(true);
      
      console.log('🔍 Running automatic completeness check before submission...');
      completenessReport = await ReportCompletenessService.analyzeReportCompleteness(
        employeeData.employeeId,
        reportMonth,
        reportYear
      );
      
      console.log('📊 Completeness check results:', {
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
      console.log('✅ Report passed completeness check, proceeding with submission...');
      
    } catch (error) {
      console.error('❌ Error running completeness check:', error);
      alert('Error running completeness check. Please try again.');
      setLoading(false);
      return;
    }

    // Proceed with normal submission confirmation
    const confirmSubmit = window.confirm(
      `✅ Report Completeness Check Passed!\n\nCompleteness Score: ${completenessReport.overallScore}/100\n\nAre you sure you want to submit this expense report? Once submitted, you will not be able to make further edits.`
    );
    
    if (!confirmSubmit) {
      setLoading(false);
      return;
    }

    try {
      const reportData = {
        ...employeeData,
        receipts: receipts,
        signatureImage: signatureImage,
        supervisorSignature: supervisorSignatureState
      };

      const response = await fetch('http://localhost:3002/api/expense-reports', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          employeeId: employeeData.employeeId,
          month: reportMonth,
          year: reportYear,
          reportData: reportData,
          status: 'submitted'
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to submit expense report');
      }

      await response.json();
      
      // If supervisor mode is enabled, submit for approval workflow
      if (supervisorMode && supervisorId) {
        try {
          const reportId = `report-${employeeData.employeeId}-${reportYear}-${reportMonth.toString().padStart(2, '0')}`;
          await ReportApprovalService.submitReportForApproval(
            reportId,
            employeeData.employeeId,
            supervisorId
          );
          setReportStatus('submitted');
          alert('🎉 Expense report submitted successfully! It has been sent to your supervisor for review.');
        } catch (approvalError) {
          console.error('Error submitting for approval:', approvalError);
          alert('Report saved but failed to submit for approval. Please contact your supervisor.');
        }
      } else {
        setReportStatus('submitted');
        alert('🎉 Expense report submitted successfully! It is now ready for supervisor review.');
      }
      
    } catch (error) {
      console.error('Error submitting report:', error);
      alert(`Error submitting report: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  // Fetch all reports for the employee
  const fetchAllReports = async () => {
    if (!employeeId) {
      alert('No employee ID provided');
      return;
    }

    try {
      setReportsLoading(true);
      
      const response = await fetch(`http://localhost:3002/api/expense-reports/${employeeId}`);
      
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
      console.error('Error fetching reports:', error);
      alert(`Error fetching reports: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setReportsLoading(false);
    }
  };

  // Handle PDF export
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
        // Prepare data for PDF export with comprehensive safety checks
        const exportData = {
          ...employeeData,
          // Ensure all arrays exist
          costCenters: employeeData.costCenters || [],
          dailyEntries: employeeData.dailyEntries || [],
          otherExpenses: (employeeData as any).otherExpenses || [],
          dailyOdometerReadings: (employeeData as any).dailyOdometerReadings || [],
          // Ensure all numeric values exist
          airRailBus: (employeeData as any).airRailBus || 0,
          vehicleRentalFuel: (employeeData as any).vehicleRentalFuel || 0,
          parkingTolls: (employeeData as any).parkingTolls || 0,
          groundTransportation: (employeeData as any).groundTransportation || 0,
          hotelsAirbnb: (employeeData as any).hotelsAirbnb || 0,
          perDiem: (employeeData as any).perDiem || 0,
          phoneInternetFax: (employeeData as any).phoneInternetFax || 0,
          shippingPostage: (employeeData as any).shippingPostage || 0,
          printingCopying: (employeeData as any).printingCopying || 0,
          officeSupplies: (employeeData as any).officeSupplies || 0,
          eesSupplies: (employeeData as any).eesSupplies || 0,
          devices: (employeeData as any).devices || 0,
          gaHours: (employeeData as any).gaHours || 0,
          holidayHours: (employeeData as any).holidayHours || 0,
          ptoHours: (employeeData as any).ptoHours || 0,
          stdLtdHours: (employeeData as any).stdLtdHours || 0,
          pflPfmlHours: (employeeData as any).pflPfmlHours || 0,
          employeeSignature: signatureImage,
          supervisorSignature: supervisorSignature
        } as any;
        
        // Use the new comprehensive PDF export service
        await TabPdfExportService.exportAllTabsInOnePDF(
          exportData,
          receipts as any,
          [] // Empty time tracking array for now
        );
        
        // PDF export completed successfully
        alert('Complete PDF exported successfully with all tabs!');
        
    } catch (error) {
      console.error('Error generating PDF:', error);
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
    employeeData.perDiem
  ) : 0;

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
        reportMonth={reportMonth}
        reportYear={reportYear}
        loading={loading}
        isAdminView={isAdminView}
        onExportPdf={handleExportPdf}
        onSaveReport={handleSaveReport}
        onSubmitReport={handleSubmitReport}
        onSignatureCapture={() => setSignatureDialogOpen(true)}
        onViewAllReports={fetchAllReports}
        onCheckCompleteness={handleCheckCompleteness}
        onRefresh={() => {
          console.log('🔄 StaffPortal: Refreshing data from backend...');
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
        showRealTimeStatus={true}
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

      {/* Enhanced Tab Navigation */}
      <EnhancedTabNavigation
        value={activeTab}
        onChange={handleTabChange}
        tabs={createTabConfig(employeeData)}
        employeeData={employeeData}
        showStatus={true}
      />

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
                    <Typography variant="body2" color="textSecondary" component="div"><strong>Preferred Name:</strong> {employeeData.preferredName}</Typography>
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
                    <Typography variant="body2" color="textSecondary">{employeeData.name}</Typography>
                    <Typography variant="body2" color="textSecondary">Date: ___________</Typography>
                  </Box>
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Box sx={{ border: '1px solid #ccc', p: 2, borderRadius: 1 }}>
                    <Typography variant="body1" component="div"><strong>Direct Supervisor</strong></Typography>
                    <Box sx={{ mt: 2, mb: 2, minHeight: 40, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {supervisorSignature ? (
                        <img 
                          src={supervisorSignature} 
                          alt="Supervisor Signature" 
                          style={{ 
                            maxHeight: '40px', 
                            maxWidth: '100%',
                            objectFit: 'contain'
                          }} 
                        />
                      ) : (
                        <Box sx={{ borderBottom: '1px solid #333', width: '100%', height: 40 }} />
                      )}
                    </Box>
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
                      TRANSPORTATION
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell sx={{ pl: 8 }}>Mileage</TableCell>
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
                    <TableCell sx={{ pl: 8 }}>Air / Rail / Bus</TableCell>
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
                    <TableCell sx={{ pl: 8 }}>Vehicle Rental / Fuel</TableCell>
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
                    <TableCell sx={{ pl: 8 }}>Parking / Tolls</TableCell>
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
                    <TableCell sx={{ pl: 8 }}>Ground Transportation</TableCell>
                    <TableCell align="center">$0.00</TableCell>
                    {employeeData.costCenters.slice(1).map((center, index) => (
                      <TableCell key={index} align="center">$0.00</TableCell>
                    ))}
                    <TableCell align="right">$0.00</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell sx={{ pl: 4, fontWeight: 'bold' }}>LODGING</TableCell>
                    <TableCell align="center">$0.00</TableCell>
                    {employeeData.costCenters.slice(1).map((center, index) => (
                      <TableCell key={index} align="center">$0.00</TableCell>
                    ))}
                    <TableCell align="right">$0.00</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell sx={{ pl: 8 }}>PER DIEM</TableCell>
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
                      COMMUNICATIONS
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell sx={{ pl: 4 }}>Phone / Internet / Fax</TableCell>
                    <TableCell align="right">
                      ${employeeData.phoneInternetFax.toFixed(2)}
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
                    <TableCell align="right"><strong>${employeeData.phoneInternetFax.toFixed(2)}</strong></TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell sx={{ pl: 4, fontWeight: 'bold' }}>Shipping / Postage</TableCell>
                    <TableCell align="center">$0.00</TableCell>
                    {employeeData.costCenters.slice(1).map((center, index) => (
                      <TableCell key={index} align="center">$0.00</TableCell>
                    ))}
                    <TableCell align="right">$0.00</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell sx={{ pl: 4 }}>Printing / Copying</TableCell>
                    <TableCell align="center">$0.00</TableCell>
                    {employeeData.costCenters.slice(1).map((center, index) => (
                      <TableCell key={index} align="center">$0.00</TableCell>
                    ))}
                    <TableCell align="right">$0.00</TableCell>
                  </TableRow>
                  
                  {/* SUPPLIES Section */}
                  <TableRow>
                    <TableCell colSpan={employeeData.costCenters.length + 2} align="center" sx={{ fontWeight: 'bold', bgcolor: 'grey.100' }}>
                      SUPPLIES
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell colSpan={employeeData.costCenters.length + 2} sx={{ pl: 4 }}>All Suppliers categories: $0.00</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell colSpan={employeeData.costCenters.length + 2} sx={{ pl: 4 }}>All Suppliers categories: $0.00</TableCell>
                  </TableRow>
                  
                  {/* OTHER EXPENSES Section */}
                  <TableRow>
                    <TableCell colSpan={employeeData.costCenters.length + 2} align="center" sx={{ fontWeight: 'bold', bgcolor: 'grey.100' }}>
                      OTHER EXPENSES
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell colSpan={employeeData.costCenters.length + 2} sx={{ pl: 4 }}>All Other Expenses categories: $0.00</TableCell>
                  </TableRow>
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
              <Typography variant="h6" gutterBottom><strong>GRAND TOTAL REQUESTED</strong></Typography>
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
            <Typography variant="h5" gutterBottom sx={{ fontWeight: 'bold' }}>
              Mileage Entries
            </Typography>
            <Typography variant="body2" color="textSecondary" sx={{ mb: 3 }}>
              Enter mileage data for each day. The system will automatically track locations, miles traveled, and calculate reimbursement.
            </Typography>
            
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
                  </TableRow>
                </TableHead>
                <TableBody>
                  {employeeData.dailyEntries.filter((entry: any) => entry.milesTraveled > 0).map((entry: any, index: number) => {
                    // Check if any mileage entries for this date need revision
                    const entryDate = new Date(entry.date);
                    const needsRevision = rawMileageEntries.some((m: any) => {
                      const mDate = new Date(m.date);
                      return mDate.getUTCDate() === entryDate.getUTCDate() && 
                             mDate.getUTCMonth() === entryDate.getUTCMonth() && 
                             m.needsRevision;
                    });
                    
                    return (
                      <TableRow key={index} sx={{ bgcolor: needsRevision ? 'warning.light' : 'transparent' }}>
                        <TableCell sx={{ border: '1px solid #ccc', p: 1 }}>
                          {entry.date}
                          {needsRevision && (
                            <Chip label="⚠️ Revision Requested" size="small" sx={{ ml: 1, bgcolor: 'warning.main', color: 'white' }} />
                          )}
                        </TableCell>
                        <TableCell sx={{ border: '1px solid #ccc', p: 1 }}>
                          {entry.startLocationName || 'N/A'}
                        </TableCell>
                        <TableCell sx={{ border: '1px solid #ccc', p: 1 }}>
                          {entry.endLocationName || 'N/A'}
                        </TableCell>
                        <TableCell align="center" sx={{ border: '1px solid #ccc', p: 1 }}>
                          {Math.round(entry.milesTraveled)}
                        </TableCell>
                        <TableCell align="center" sx={{ border: '1px solid #ccc', p: 1 }}>
                          ${entry.mileageAmount?.toFixed(2) || '0.00'}
                        </TableCell>
                        <TableCell sx={{ border: '1px solid #ccc', p: 1 }}>
                          {entry.costCenter || employeeData.costCenters[0] || 'N/A'}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {employeeData.dailyEntries.filter((entry: any) => entry.milesTraveled > 0).length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} align="center" sx={{ border: '1px solid #ccc', p: 3 }}>
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
                <strong>💡 Tip:</strong> Mileage entries are created in the mobile app when you track your trips. 
                The Data Entry tab can also be used to manually add or edit mileage entries.
              </Typography>
            </Box>
          </CardContent>
        </Card>
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
                    <TableCell sx={{ border: '1px solid #ccc', p: 1, width: '15%' }}><strong>Date</strong></TableCell>
                    <TableCell sx={{ border: '1px solid #ccc', p: 1, width: '70%' }}><strong>Activity Description</strong></TableCell>
                    <TableCell sx={{ border: '1px solid #ccc', p: 1, width: '15%' }}><strong>Cost Center</strong></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {employeeData && employeeData.dailyEntries && employeeData.dailyEntries.map((entry: any, index: number) => {
                    // Find the corresponding daily description
                    const dayDescription = dailyDescriptions.find((desc: any) => {
                      const entryDate = new Date(entry.date);
                      const descDate = new Date(desc.date);
                      return entryDate.getUTCDate() === descDate.getUTCDate();
                    });
                    
                    return (
                      <TableRow key={index}>
                        <TableCell sx={{ border: '1px solid #ccc', p: 1 }}>{entry.date}</TableCell>
                        <TableCell sx={{ border: '1px solid #ccc', p: 1 }}>
                          <TextField
                            value={dayDescription?.description || ''}
                            onChange={(e) => {
                              // Update or create daily description
                              const newDescriptions = [...dailyDescriptions];
                              const existingIndex = newDescriptions.findIndex((desc: any) => {
                                const entryDate = new Date(entry.date);
                                const descDate = new Date(desc.date);
                                return entryDate.getUTCDate() === descDate.getUTCDate();
                              });
                              
                              if (existingIndex >= 0) {
                                // Update existing
                                newDescriptions[existingIndex] = {
                                  ...newDescriptions[existingIndex],
                                  description: e.target.value
                                };
                              } else {
                                // Create new
                                const entryDate = new Date(entry.date);
                                entryDate.setHours(12, 0, 0, 0); // Set to noon to avoid timezone issues
                                newDescriptions.push({
                                  id: `desc-${employeeId}-${entry.date}`,
                                  employeeId: employeeId,
                                  date: entryDate.toISOString(),
                                  description: e.target.value,
                                  costCenter: entry.costCenter || employeeData.costCenters[0] || '',
                                  createdAt: new Date().toISOString(),
                                  updatedAt: new Date().toISOString()
                                });
                              }
                              
                              setDailyDescriptions(newDescriptions);
                            }}
                            fullWidth
                            multiline
                            rows={2}
                            size="small"
                            placeholder="Describe daily activities (e.g., 'Meetings, phone calls, site visits')"
                            disabled={isAdminView}
                          />
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
                    <TableCell sx={{ border: '1px solid #ccc', p: 1, width: '10%' }}><strong>DATE</strong></TableCell>
                    <TableCell sx={{ border: '1px solid #ccc', p: 1, width: '40%' }}><strong>Description of Activity</strong></TableCell>
                    <TableCell align="center" sx={{ border: '1px solid #ccc', p: 1, width: '8%' }}><strong>Hours Worked</strong></TableCell>
                    <TableCell align="center" sx={{ border: '1px solid #ccc', p: 1, width: '8%' }}><strong>Odometer Start</strong></TableCell>
                    <TableCell align="center" sx={{ border: '1px solid #ccc', p: 1, width: '8%' }}><strong>Odometer End</strong></TableCell>
                    <TableCell align="center" sx={{ border: '1px solid #ccc', p: 1, width: '8%' }}><strong>Miles Traveled</strong></TableCell>
                    <TableCell align="center" sx={{ border: '1px solid #ccc', p: 1, width: '9%' }}><strong>Mileage ($)</strong></TableCell>
                    <TableCell align="center" sx={{ border: '1px solid #ccc', p: 1, width: '9%' }}><strong>Per Diem ($)</strong></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {employeeData.dailyEntries.map((entry, index) => {
                    // Check if any time entries for this date need revision
                    const entryDate = new Date(entry.date);
                    const needsRevision = rawTimeEntries.some((t: any) => {
                      const tDate = new Date(t.date);
                      return tDate.getUTCDate() === entryDate.getUTCDate() && 
                             tDate.getUTCMonth() === entryDate.getUTCMonth() && 
                             t.needsRevision;
                    });
                    
                    return (
                      <TableRow key={index} sx={{ bgcolor: needsRevision ? 'warning.light' : 'transparent' }}>
                        <TableCell sx={{ border: '1px solid #ccc', p: 1 }}>
                          {entry.date}
                          {needsRevision && (
                            <Chip label="⚠️ Revision Requested" size="small" sx={{ ml: 1, bgcolor: 'warning.main', color: 'white' }} />
                          )}
                        </TableCell>
                      <TableCell sx={{ wordWrap: 'break-word', border: '1px solid #ccc', p: 1 }}>
                        {editingCell?.row === index && editingCell?.field === 'description' ? (
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
                            fullWidth
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
                      <TableCell align="center" sx={{ border: '1px solid #ccc', p: 1 }}>{entry.milesTraveled || 0}</TableCell>
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
                    </TableRow>
                    );
                  })}
                  
                  {/* Subtotals row */}
                  <TableRow sx={{ bgcolor: 'grey.200', fontWeight: 'bold' }}>
                    <TableCell sx={{ border: '1px solid #ccc', p: 1 }}><strong>SUBTOTALS</strong></TableCell>
                    <TableCell sx={{ border: '1px solid #ccc', p: 1 }}></TableCell>
                    <TableCell align="center" sx={{ border: '1px solid #ccc', p: 1 }}><strong>{typeof employeeData.totalHours === 'number' ? employeeData.totalHours.toFixed(1) : employeeData.totalHours}</strong></TableCell>
                    <TableCell align="center" sx={{ border: '1px solid #ccc', p: 1 }}></TableCell>
                    <TableCell align="center" sx={{ border: '1px solid #ccc', p: 1 }}></TableCell>
                    <TableCell align="center" sx={{ border: '1px solid #ccc', p: 1 }}><strong>{employeeData.totalMiles}</strong></TableCell>
                    <TableCell align="center" sx={{ border: '1px solid #ccc', p: 1 }}><strong>${employeeData.totalMileageAmount.toFixed(2)}</strong></TableCell>
                    <TableCell align="center" sx={{ border: '1px solid #ccc', p: 1 }}><strong>${employeeData.perDiem.toFixed(2)}</strong></TableCell>
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
                    {Array.from({ length: daysInMonth }, (_, i) => (
                      <TableCell key={i} align="center" sx={{ width: 25, minWidth: 25, maxWidth: 25, border: '1px solid #ccc', p: 0.5, fontSize: '0.75rem' }}>
                        {i + 1}
                      </TableCell>
                    ))}
                    <TableCell align="center" sx={{ border: '1px solid #ccc', p: 1, width: 100, minWidth: 100, maxWidth: 100 }}><strong>TOTALS</strong></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {/* Used Cost Centers */}
                  {employeeData?.costCenters.map((center, index) => (
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
                  ))}
                  
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
                    const needsRevision = (receipt as any).needsRevision;
                    return (
                      <TableRow 
                        key={receipt.id}
                        sx={needsRevision ? { bgcolor: 'warning.light' } : {}}
                      >
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
                        {receipt.imageUri ? (
                          <Box sx={{ 
                            width: 40, 
                            height: 40, 
                            borderRadius: 1, 
                            overflow: 'hidden',
                            border: '1px solid #ddd',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            bgcolor: 'grey.50'
                          }}>
                            <img 
                              src={receipt.imageUri} 
                              alt="Receipt" 
                              style={{ 
                                maxWidth: '100%', 
                                maxHeight: '100%',
                                objectFit: 'cover'
                              }} 
                            />
                          </Box>
                        ) : (
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
                              accept="image/*"
                              style={{ display: 'none' }}
                              id={`receipt-upload-${receipt.id}`}
                              onChange={(e) => handleReceiptImageUpload(receipt.id, e)}
                            />
                            <label htmlFor={`receipt-upload-${receipt.id}`} style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%' }}>
                              <div style={{ 
                                width: '20px', 
                                height: '20px', 
                                border: '2px solid #1976d2', 
                                borderRadius: '4px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                marginBottom: '4px',
                                fontSize: '12px',
                                fontWeight: 'bold',
                                color: '#1976d2'
                              }}>
                                +
                              </div>
                              <Typography variant="caption" sx={{ fontSize: 8, color: 'primary.main', textAlign: 'center' }}>
                                Upload
                              </Typography>
                            </label>
                          </Box>
                        )}
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
      <Dialog open={signatureDialogOpen} onClose={() => setSignatureDialogOpen(false)} maxWidth="sm" fullWidth>
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
                  Choose PNG File
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

      {/* Receipt Dialog */}
      <Dialog open={receiptDialogOpen} onClose={() => setReceiptDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingReceipt ? 'Edit Receipt' : 'Add Receipt'}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              label="Date"
              value={editingReceipt?.date || ''}
              onChange={(e) => setEditingReceipt({...editingReceipt!, date: e.target.value})}
              placeholder="MM/DD/YY"
            />
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
                <MenuItem value="Working Hours">Working Hours</MenuItem>
                <MenuItem value="G&A">G&A</MenuItem>
                <MenuItem value="Holiday">Holiday</MenuItem>
                <MenuItem value="PTO">PTO</MenuItem>
                <MenuItem value="STD/LTD">STD/LTD</MenuItem>
                <MenuItem value="PFL/PFML">PFL/PFML</MenuItem>
                <MenuItem value="Training">Training</MenuItem>
                <MenuItem value="Travel">Travel</MenuItem>
                <MenuItem value="Other">Other</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setReceiptDialogOpen(false)}>Cancel</Button>
          <Button 
            onClick={() => {
              if (editingReceipt) {
                if (editingReceipt.id) {
                  // Update existing receipt
                  setReceipts(receipts.map(r => r.id === editingReceipt.id ? editingReceipt : r));
                } else {
                  // Add new receipt
                  const newReceipt = {
                    ...editingReceipt,
                    id: `receipt-${Date.now()}`
                  };
                  setReceipts([...receipts, newReceipt]);
                }
                // Update phone/internet/fax total
                const updatedReceipts = editingReceipt.id 
                  ? receipts.map(r => r.id === editingReceipt.id ? editingReceipt : r)
                  : [...receipts, {...editingReceipt, id: `receipt-${Date.now()}`}];
                const updatedData = {
                  ...employeeData,
                  phoneInternetFax: updatedReceipts.reduce((sum, r) => sum + r.amount, 0)
                };
                setEmployeeData(updatedData);
              }
              setReceiptDialogOpen(false);
            }} 
            variant="contained"
          >
            {editingReceipt?.id ? 'Update' : 'Add'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* All Reports Dialog */}
      <Dialog open={reportsDialogOpen} onClose={() => setReportsDialogOpen(false)} maxWidth="lg" fullWidth>
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
                                  setSupervisorSignature(savedSupervisorSignature || null);
                                  
                                  // Update the current month/year to match the loaded report
                                  // Note: This would require updating the parent component's state
                                  
                                  setReportsDialogOpen(false);
                                  alert(`Report for ${monthNames[report.month - 1]} ${report.year} loaded successfully!`);
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
            console.log('Settings updated:', settings);
          }} 
        />
      </TabPanel>

    </Container>
  );
};

// Wrap StaffPortal with UI Enhancement providers
const StaffPortalWithProviders: React.FC<StaffPortalProps> = (props) => {
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
