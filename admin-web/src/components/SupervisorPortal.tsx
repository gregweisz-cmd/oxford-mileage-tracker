/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable react-hooks/exhaustive-deps */
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  CircularProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Avatar,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Tabs,
  Tab,
  Badge,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  ListItemSecondaryAction,
  Tooltip,
  Checkbox,
  // Stepper, // Currently unused
  // Step, // Currently unused
  // StepLabel, // Currently unused
  // StepContent, // Currently unused
} from '@mui/material';
import {
  // Save as SaveIcon, // Currently unused
  Edit as EditIcon,
  Delete as DeleteIcon,
  // Add as AddIcon, // Currently unused
  Visibility as VisibilityIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  Comment as CommentIcon,
  Assignment as AssignmentIcon,
  People as PeopleIcon,
  Assessment as AssessmentIcon,
  PieChart as PieChartIcon,
  // FilterList as FilterListIcon, // Currently unused
  Refresh as RefreshIcon,
  Download as DownloadIcon,
  Send as SendIcon,
  VerifiedUser as SupervisorIcon,
  PersonAdd as PersonAddIcon,
  // Warning as WarningIcon, // Currently unused
  Check as CheckIcon,
  Close as CloseIcon,
  Search as SearchIcon,
  // AccountCircle as AccountCircleIcon, // Currently unused
  Schedule as ScheduleIcon,
} from '@mui/icons-material';

// Import StaffPortal for team member report viewing
import StaffPortal from '../StaffPortal';
import { useErrorPrompt, isHttpClientError } from '../contexts/ErrorPromptContext';
import OxfordHouseLogo from './OxfordHouseLogo';
import SupervisorDashboard from './SupervisorDashboard';
import SupervisorContractUtilizationTab from './SupervisorContractUtilizationTab';
import { NotificationBell } from './NotificationBell';
import DetailedReportView from './DetailedReportView';
import { ConfirmDeleteDialog } from './ConfirmDeleteDialog';

// Keyboard shortcuts
import { useKeyboardShortcuts, KeyboardShortcut } from '../hooks/useKeyboardShortcuts';
import { useVisibilityPolling } from '../hooks/useVisibilityPolling';
import KeyboardShortcutsDialog from './KeyboardShortcutsDialog';

// Debug logging
import { debugError, debugLog } from '../config/debug';

// Shared reviewer-portal types/helpers (identical across Supervisor + Senior Staff portals).
// Aliased to the local names this file already uses so call sites are unchanged.
import {
  ReportStatus,
  TeamReport,
  DashboardStats,
  ReviewerEmployee as Employee,
  ReviewerComment as SupervisorComment,
  ReviewDialogMode as SupervisorReviewDialogMode,
  putExpenseReportApproval,
  getDueInfo,
} from './reviewerPortal/shared';
import ReviewDialog from './reviewerPortal/ReviewDialog';
import { createReviewerApprovalHandlers } from './reviewerPortal/approvalHandlers';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://oxford-mileage-backend.onrender.com';

interface SupervisorPortalProps {
  supervisorId: string;
  supervisorName: string;
}

const SupervisorPortal: React.FC<SupervisorPortalProps> = ({ supervisorId, supervisorName }) => {
  const [activeTab, setActiveTab] = useState(0);
  const [teamMembers, setTeamMembers] = useState<Employee[]>([]);
  const [teamReports, setTeamReports] = useState<TeamReport[]>([]);
  const [dashboardStats, setDashboardStats] = useState<DashboardStats>({
    totalTeamMembers: 0,
    activeReports: 0,
    pendingReviews: 0,
    monthlyTotal: 0,
    approvalRate: 0,
    averageResponseTime: '0h',
  });

  // Filters and search
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [monthFilter, setMonthFilter] = useState<string>('all'); // Changed from 'current' to 'all' to show all reports by default

  // Selected report for review
  const [selectedReport, setSelectedReport] = useState<TeamReport | null>(null);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [reviewDialogMode, setReviewDialogMode] = useState<SupervisorReviewDialogMode | null>(null);
  const [commentDialogOpen, setCommentDialogOpen] = useState(false);
  const [supervisorCertificationAcknowledged, setSupervisorCertificationAcknowledged] = useState<boolean>(false);
  const [detailedReportViewOpen, setDetailedReportViewOpen] = useState(false);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [selectedItemsForRevision, setSelectedItemsForRevision] = useState<{
    mileage: Set<string>;
    dailyDescriptions: Set<string>;
    timeTracking: Set<string>;
    receipts: Set<string>;
    perDiemDays: Set<string>;
  } | null>(null);
  
  // Keyboard shortcuts state
  const [shortcutsDialogOpen, setShortcutsDialogOpen] = useState(false);

  // Employee report viewing
  const [viewingEmployeeReport, setViewingEmployeeReport] = useState<Employee | null>(null);
  const [viewingReportMonth, setViewingReportMonth] = useState<number | null>(new Date().getMonth() + 1);
  const [viewingReportYear, setViewingReportYear] = useState<number | null>(new Date().getFullYear());
  const [showEmployeeReportView, setShowEmployeeReportView] = useState(false);

  // Error prompt for 403/404 so user can go back instead of raw error
  const { showErrorPrompt } = useErrorPrompt();

  const closeReviewDialog = useCallback(() => {
    setReviewDialogOpen(false);
    setReviewDialogMode(null);
    setSupervisorCertificationAcknowledged(false);
    setReviewComment('');
  }, []);

  // Loading states
  const [loading, setLoading] = useState(true);
  const [savingAction, setSavingAction] = useState(false);
  const [delegateDialogOpen, setDelegateDialogOpen] = useState(false);
  const [delegateReport, setDelegateReport] = useState<TeamReport | null>(null);
  const [selectedDelegateId, setSelectedDelegateId] = useState<string>('');
  const [availableDelegates, setAvailableDelegates] = useState<Employee[]>([]);
  const [loadingDelegates, setLoadingDelegates] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [reportToDelete, setReportToDelete] = useState<TeamReport | null>(null);

  // Memoize the employee object to prevent SupervisorDashboard from re-rendering unnecessarily
  const currentEmployee = useMemo(() => ({ id: supervisorId, name: supervisorName }), [supervisorId, supervisorName]);

  // Widget toggle removed

  const loadTeamMembers = useCallback(async () => {
    try {
      const { apiGet } = await import('../services/rateLimitedApi');
      const data = await apiGet<any[]>(`/api/supervisors/${supervisorId}/team`);
      const mapped: Employee[] = data.map((member: any) => ({
        id: member.id,
        name: member.name,
        preferredName: member.preferredName,
        email: member.email,
        position: member.position,
        supervisorId: member.supervisorId,
        costCenters: member.costCenters || [],
        isActive: member.archived ? false : true,
        joinDate: member.joinDate,
      }));
      setTeamMembers(mapped);
    } catch (error) {
      debugError('Error loading team members:', error);
      setTeamMembers([]);
    }
  }, [supervisorId]);

  const loadTeamReports = useCallback(async () => {
    try {
      const { apiGet } = await import('../services/rateLimitedApi');
      // Use /api/monthly-reports endpoint which supports teamSupervisorId filtering
      const data = await apiGet<any[]>(`/api/monthly-reports?teamSupervisorId=${supervisorId}`);
      const mapped: TeamReport[] = data.map((report: any) => {
        const reportData = report.reportData || {};
        const approvalWorkflow = Array.isArray(report.approvalWorkflow) ? report.approvalWorkflow : [];
        const currentApprovalStep = Number.isInteger(report.currentApprovalStep)
          ? report.currentApprovalStep
          : parseInt(report.currentApprovalStep || '0', 10) || 0;

        return {
          id: report.id,
          employeeId: report.employeeId,
          employeeName: report.employeeName || 'Unknown',
          month: report.month,
          year: report.year,
          status: report.status,
          submittedAt: report.submittedAt,
          totalAmount: Number(report.totalExpenses ?? 0),
          totalMiles: Number(report.totalMiles ?? reportData.totalMiles ?? 0),
          totalMileageAmount: Number(report.totalMileageAmount ?? reportData.totalMileageAmount ?? 0),
          totalHours: Number(reportData.totalHours ?? 0),
          costCenters: reportData.costCenters || [],
          comments: Array.isArray(report.comments)
            ? report.comments.map((comment: any) => ({
                id: comment.id || `comment_${comment.createdAt}`,
                supervisorId: comment.supervisorId || '',
                supervisorName: comment.supervisorName || 'Supervisor',
                reportId: report.id,
                comment: comment.comment || '',
                createdAt: comment.createdAt || new Date().toISOString(),
                isResolved: comment.isResolved ?? false,
              }))
            : [],
          rejectionReason: report.rejectionReason,
          reviewedBy: report.reviewedBy,
          reviewedAt: report.reviewedAt,
          approvalWorkflow,
          currentApprovalStage: report.currentApprovalStage || '',
          currentApprovalStep,
          currentApproverId: report.currentApproverId ?? null,
          currentApproverName: report.currentApproverName ?? null,
          escalationDueAt: report.escalationDueAt ?? null,
          submissionType: report.submissionType || reportData.submissionType || 'monthly_submission',
        };
      });

      debugLog(`📊 Loaded ${mapped.length} team reports for supervisor ${supervisorId}`);
      setTeamReports(mapped);
    } catch (error) {
      debugError('Error loading team reports:', error);
      setTeamReports([]);
    }
  }, [supervisorId]);

  // Auto-refresh team reports every 60s while the tab is visible. Pauses when
  // the tab is hidden so background tabs don't keep hitting the API. Bumped
  // from 30s -> 60s to reduce queue pressure on the rate-limited backend.
  useVisibilityPolling(loadTeamReports, 60000);

  const calculateDashboardStats = useCallback(() => {
    const pendingStatuses: ReportStatus[] = ['pending_supervisor', 'pending_senior_staff', 'pending_finance', 'submitted', 'under_review'];
    const submittedReports = teamReports.filter(r => pendingStatuses.includes(r.status));
    const pendingSupervisorReports = teamReports.filter(r => r.status === 'pending_supervisor');
    const currentMonth = new Date().getMonth() + 1;
    const totalMonthlyAmount = teamReports
      .filter(r => r.status === 'approved' && r.month === currentMonth)
      .reduce((sum, r) => sum + (r.totalAmount || 0), 0);
    const approvalRate = teamReports.length > 0
      ? Math.round((teamReports.filter(r => r.status === 'approved').length / teamReports.length) * 100)
      : 0;

    setDashboardStats({
      totalTeamMembers: teamMembers.length,
      activeReports: submittedReports.length,
      pendingReviews: pendingSupervisorReports.length,
      monthlyTotal: totalMonthlyAmount,
      approvalRate,
      averageResponseTime: '48h',
    });
  }, [teamMembers, teamReports]);

  const loadSupervisorData = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadTeamMembers(),
        loadTeamReports(),
      ]);
    } catch (error) {
      debugError('Error loading supervisor data:', error);
    } finally {
      setLoading(false);
    }
  }, [loadTeamMembers, loadTeamReports]);

  useEffect(() => {
    loadSupervisorData();
  }, [loadSupervisorData]);

  useEffect(() => {
    calculateDashboardStats();
  }, [calculateDashboardStats]);

  // Memoized callback for selected items change to prevent infinite loops
  const handleSelectedItemsChange = useCallback((selectedItems: {
    mileage: Set<string>;
    dailyDescriptions: Set<string>;
    timeTracking: Set<string>;
    receipts: Set<string>;
    perDiemDays: Set<string>;
  }) => {
    setSelectedItemsForRevision(selectedItems);
  }, []);

  // Handler for approving report from StaffPortal — open approve-only dialog (certification + send to finance)
  const handleApproveFromPortal = useCallback(() => {
    if (!viewingEmployeeReport || !viewingReportMonth || !viewingReportYear) {
      alert('Unable to approve: Missing report information');
      return;
    }

    const report = teamReports.find(
      (r) =>
        r.employeeId === viewingEmployeeReport.id &&
        r.month === viewingReportMonth &&
        r.year === viewingReportYear
    );

    if (!report || !report.id) {
      alert('Unable to approve: Report not found');
      return;
    }

    setSelectedReport(report);
    setReviewComment('');
    setSupervisorCertificationAcknowledged(false);
    setReviewDialogMode('approve');
    setReviewDialogOpen(true);
  }, [viewingEmployeeReport, viewingReportMonth, viewingReportYear, teamReports]);

  // Handler for requesting revision from StaffPortal — open revision-only dialog
  const handleRequestRevisionFromPortal = useCallback(() => {
    if (!viewingEmployeeReport || !viewingReportMonth || !viewingReportYear) {
      alert('Unable to request revision: Missing report information');
      return;
    }

    const report = teamReports.find(
      (r) =>
        r.employeeId === viewingEmployeeReport.id &&
        r.month === viewingReportMonth &&
        r.year === viewingReportYear
    );

    if (!report || !report.id) {
      alert('Unable to request revision: Report not found');
      return;
    }

    setSelectedReport(report);
    setReviewComment('');
    setSupervisorCertificationAcknowledged(false);
    setReviewDialogMode('revision');
    setReviewDialogOpen(true);
  }, [viewingEmployeeReport, viewingReportMonth, viewingReportYear, teamReports]);

  // Store handlers in refs to ensure they're always available
  const approveHandlerRef = useRef(handleApproveFromPortal);
  const revisionHandlerRef = useRef(handleRequestRevisionFromPortal);
  
  // Update refs when handlers change
  useEffect(() => {
    approveHandlerRef.current = handleApproveFromPortal;
    revisionHandlerRef.current = handleRequestRevisionFromPortal;
  }, [handleApproveFromPortal, handleRequestRevisionFromPortal]);
  
  // Create stable handler references that are ALWAYS functions
  const stableApproveHandler = useCallback(() => {
    if (typeof approveHandlerRef.current === 'function') {
      approveHandlerRef.current();
    } else {
      console.error('❌ Approve handler is not a function!', approveHandlerRef.current);
    }
  }, []); // Empty deps - ref never changes

  const stableRevisionHandler = useCallback(() => {
    if (typeof revisionHandlerRef.current === 'function') {
      revisionHandlerRef.current();
    } else {
      console.error('❌ Revision handler is not a function!', revisionHandlerRef.current);
    }
  }, []); // Empty deps - ref never changes

  // Debug: Log handlers immediately after creation (only in development)
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log('🔍 SupervisorPortal: Handlers created/updated:', {
        handleApproveFromPortal: typeof handleApproveFromPortal,
        handleRequestRevisionFromPortal: typeof handleRequestRevisionFromPortal,
        stableApproveHandler: typeof stableApproveHandler,
        stableRevisionHandler: typeof stableRevisionHandler,
      });
    }
  }, [handleApproveFromPortal, handleRequestRevisionFromPortal, stableApproveHandler, stableRevisionHandler]);

  // Debug: Log handlers when dialog opens
  useEffect(() => {
    if (showEmployeeReportView && viewingEmployeeReport) {
      console.log('🔍 SupervisorPortal: Dialog opened, checking handlers:', {
        hasApprove: typeof handleApproveFromPortal === 'function',
        hasRevision: typeof handleRequestRevisionFromPortal === 'function',
        handleApproveFromPortal,
        handleRequestRevisionFromPortal,
        viewingEmployeeReport: !!viewingEmployeeReport,
        viewingReportMonth,
        viewingReportYear,
        supervisorId,
        supervisorName
      });
      debugLog('🔍 SupervisorPortal: Dialog opened, checking handlers:', {
        hasApprove: typeof handleApproveFromPortal === 'function',
        hasRevision: typeof handleRequestRevisionFromPortal === 'function',
        viewingEmployeeReport: !!viewingEmployeeReport,
        viewingReportMonth,
        viewingReportYear,
        supervisorId,
        supervisorName
      });
      if (typeof handleApproveFromPortal !== 'function') {
        console.error('❌ handleApproveFromPortal is not a function!', handleApproveFromPortal);
      }
      if (typeof handleRequestRevisionFromPortal !== 'function') {
        console.error('❌ handleRequestRevisionFromPortal is not a function!', handleRequestRevisionFromPortal);
      }
    }
  }, [showEmployeeReportView, viewingEmployeeReport, handleApproveFromPortal, handleRequestRevisionFromPortal, viewingReportMonth, viewingReportYear, supervisorId, supervisorName]);

  const loadDelegates = useCallback(async () => {
    setLoadingDelegates(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/employees?position=Supervisor&includeArchived=false`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('authToken') || ''}` },
      });
      if (!response.ok) throw new Error('Failed to load supervisors');
      const data = await response.json();
      const mapped: Employee[] = data
        .filter((emp: any) => emp.id !== supervisorId)
        .map((emp: any) => ({
          id: emp.id,
          name: emp.name,
          preferredName: emp.preferredName,
          email: emp.email,
          position: emp.position,
          supervisorId: emp.supervisorId,
          costCenters: emp.costCenters || [],
        }));
      setAvailableDelegates(mapped);
    } catch (error) {
      debugError('Error loading delegates:', error);
      setAvailableDelegates([]);
    } finally {
      setLoadingDelegates(false);
    }
  }, [supervisorId]);

  const handleOpenDelegateDialog = async (report: TeamReport) => {
    setDelegateReport(report);
    setDelegateDialogOpen(true);
    setSelectedDelegateId('');
    if (availableDelegates.length === 0) {
      await loadDelegates();
    }
  };

  const handleCloseDelegateDialog = () => {
    setDelegateDialogOpen(false);
    setDelegateReport(null);
    setSelectedDelegateId('');
  };

  // Approval-action handlers are shared with the Senior Staff portal; only id/name,
  // a few alert strings, and the revision-error strategy differ between the two.
  const {
    handleApproveReport,
    handleRejectReport,
    handleResubmitToFinance,
    handleDelegateSubmit,
    handleSendReminder,
    handleAddComment,
  } = createReviewerApprovalHandlers({
    reviewerId: supervisorId,
    reviewerName: supervisorName,
    requiresCertification: true,
    labels: {
      signatureMissingAlert:
        'Please upload your supervisor signature on the Cover Sheet before approving. Use Upload Signature and choose Upload saved or Upload new.',
      signatureVerifyError: 'Could not verify supervisor signature. Please try again.',
      approveSuccessAlert: 'Report approved and sent to finance team successfully!',
    },
    teamReports,
    certificationAcknowledged: supervisorCertificationAcknowledged,
    reviewComment,
    selectedItemsForRevision,
    showEmployeeReportView,
    delegateReport,
    selectedDelegateId,
    setSavingAction,
    closeReviewDialog,
    loadTeamReports,
    setShowEmployeeReportView,
    closeDelegateDialog: handleCloseDelegateDialog,
    setCommentDialogOpen,
    setReviewComment,
    onRequestRevisionError: (error, message) => {
      if (isHttpClientError(error)) {
        showErrorPrompt(message, { title: 'Could not request revision', goBackLabel: 'Back to list' });
      } else {
        alert(message);
      }
    },
  });

  const handleDeleteReportClick = (report: TeamReport) => {
    setReportToDelete(report);
    setDeleteDialogOpen(true);
  };

  const handleDeleteReportConfirm = async () => {
    if (!reportToDelete) return;
    const id = reportToDelete.id;
    try {
      const { apiDelete } = await import('../services/rateLimitedApi');
      await apiDelete(`/api/expense-reports/${id}`);
      setTeamReports((prev) => prev.filter((r) => r.id !== id));
      setReportToDelete(null);
      setDeleteDialogOpen(false);
      if (selectedReport?.id === id) setSelectedReport(null);
      if (selectedReportId === id) setSelectedReportId(null);
      setDetailedReportViewOpen(false);
      await loadTeamReports();
    } catch (e) {
      debugError('Delete report error:', e);
      alert(e instanceof Error ? e.message : 'Failed to delete report');
      throw e;
    }
  };

  const handleViewEmployeeReport = (employee: Employee, month?: number, year?: number) => {
    setViewingEmployeeReport(employee);
    if (month) setViewingReportMonth(month);
    if (year) setViewingReportYear(year);
    if (month) setViewingReportMonth(month);
    if (year) setViewingReportYear(year);
    setShowEmployeeReportView(true);
  };

  const handleReportClickFromNotification = async (
    reportId: string,
    employeeId?: string,
    month?: number,
    year?: number
  ) => {
    if (!employeeId) {
      // Try to fetch the report to get employeeId
      try {
        const response = await fetch(`${API_BASE_URL}/api/expense-reports/id/${reportId}`);
        if (response.ok) {
          const report = await response.json();
          const targetEmployeeId = report.employeeId;
          // Find the employee in team members or fetch it
          const employee = teamMembers.find(m => m.id === targetEmployeeId);
          if (employee) {
            handleViewEmployeeReport(employee, report.month, report.year);
            return;
          }
          // If not in team, fetch employee details
          const empResponse = await fetch(`${API_BASE_URL}/api/employees/${targetEmployeeId}`, {
            headers: { Authorization: `Bearer ${localStorage.getItem('authToken') || ''}` },
          });
          if (empResponse.ok) {
            const empData = await empResponse.json();
            handleViewEmployeeReport(
              {
                id: empData.id,
                name: empData.name,
                preferredName: empData.preferredName,
                email: empData.email,
                position: empData.position,
                supervisorId: empData.supervisorId,
                costCenters: empData.costCenters || [],
                isActive: !empData.archived,
                joinDate: empData.joinDate,
              },
              report.month || month,
              report.year || year
            );
          }
        }
      } catch (error) {
        debugError('Error fetching report for navigation:', error);
      }
      return;
    }

    // Find employee in team members
    const employee = teamMembers.find(m => m.id === employeeId);
    if (employee) {
      handleViewEmployeeReport(employee, month, year);
    } else {
      // Fetch employee if not in team
      try {
        const response = await fetch(`${API_BASE_URL}/api/employees/${employeeId}`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('authToken') || ''}` },
        });
        if (response.ok) {
          const empData = await response.json();
          handleViewEmployeeReport(
            {
              id: empData.id,
              name: empData.name,
              preferredName: empData.preferredName,
              email: empData.email,
              position: empData.position,
              supervisorId: empData.supervisorId,
              costCenters: empData.costCenters || [],
              isActive: !empData.archived,
              joinDate: empData.joinDate,
            },
            month,
            year
          );
        }
      } catch (error) {
        debugError('Error fetching employee for navigation:', error);
      }
    }
  };

  // Memoize filteredReports to prevent unnecessary recalculations and infinite loops
  const filteredReports = useMemo(() => {
    return teamReports.filter((report) => {
      const matchesSearch = report.employeeName.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus = (() => {
        if (statusFilter === 'all') return true;
        if (statusFilter === 'pending_supervisor') {
          return report.status === 'pending_supervisor' || report.status === 'submitted';
        }
        if (statusFilter === 'pending_senior_staff') {
          return report.status === 'pending_senior_staff';
        }
        if (statusFilter === 'pending_finance') {
          return report.status === 'pending_finance' || report.status === 'under_review';
        }
        return report.status === statusFilter;
      })();

      const matchesMonth = (() => {
        const currentDate = new Date();
        if (monthFilter === 'current') {
          return report.month === currentDate.getMonth() + 1 && report.year === currentDate.getFullYear();
        }
        if (monthFilter === 'all') return true;
        const monthNumber = parseInt(monthFilter, 10);
        if (!Number.isNaN(monthNumber)) {
          return report.month === monthNumber;
        }
        return true;
      })();

      return matchesSearch && matchesStatus && matchesMonth;
    });
  }, [teamReports, searchTerm, statusFilter, monthFilter]);

  const getStatusColor = (status: TeamReport['status']) => {
    switch (status) {
      case 'draft': return 'default';
      case 'submitted': return 'warning';
      case 'under_review': return 'info';
      case 'approved': return 'success';
      case 'rejected': return 'error';
      case 'pending_supervisor': return 'warning';
      case 'pending_senior_staff': return 'warning';
      case 'pending_finance': return 'info';
      case 'needs_revision': return 'error';
      default: return 'default';
    }
  };

  const getStatusIcon = (status: TeamReport['status']) => {
    switch (status) {
      case 'draft': return <EditIcon />;
      case 'submitted': return <ScheduleIcon />;
      case 'under_review': return <VisibilityIcon />;
      case 'approved': return <CheckCircleIcon />;
      case 'rejected': return <CancelIcon />;
      case 'pending_supervisor':
      case 'pending_senior_staff':
      case 'pending_finance':
        return <ScheduleIcon />;
      case 'needs_revision':
        return <CommentIcon />;
      default: return <AssignmentIcon />;
    }
  };

  // Keyboard shortcuts setup (defined after all handler functions)
  const shortcuts: KeyboardShortcut[] = [
    {
      key: 'r',
      ctrl: true,
      action: () => {
        loadTeamReports();
      },
      description: 'Refresh team reports',
    },
    {
      key: 'f',
      ctrl: true,
      action: () => {
        // Focus search field if available
        const searchInput = document.querySelector('input[placeholder*="Search"], input[type="search"]') as HTMLInputElement;
        if (searchInput) {
          searchInput.focus();
          searchInput.select();
        }
      },
      description: 'Focus search field',
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

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Typography variant="h6">Loading Supervisor Portal...</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'grey.50' }}>
      {/* Header */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <OxfordHouseLogo size={48} />
            <Box>
              <Typography variant="h4" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
                <SupervisorIcon sx={{ mr: 2 }} />
                Supervisor Portal
              </Typography>
              <Typography variant="h6" color="text.secondary">
                Welcome back, {supervisorName}
              </Typography>
            </Box>
          </Box>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              {/* Notification Bell */}
              <NotificationBell 
                employeeId={supervisorId} 
                role="supervisor"
                onReportClick={handleReportClickFromNotification}
              />
              
              <Button
                startIcon={<RefreshIcon />}
                onClick={loadSupervisorData}
                variant="outlined"
              >
                Refresh
              </Button>
              <Button
                startIcon={<DownloadIcon />}
                variant="contained"
                color="primary"
              >
                Export Reports
              </Button>
            </Box>
          </Box>
        </Box>
      </Paper>

      <Box sx={{ px: 3 }}>
        {/* Main Content */}
        <Paper sx={{ mb: 3 }}>
          <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <Tabs value={activeTab} onChange={(e, newValue) => setActiveTab(newValue)}>
              <Tab 
                icon={<CheckCircleIcon />} 
                label="Approvals" 
                iconPosition="start"
              />
              <Tab 
                icon={<AssignmentIcon />} 
                label={`Reports (${filteredReports.length})`} 
                iconPosition="start"
              />
              <Tab 
                icon={<PeopleIcon />} 
                label={`Team (${teamMembers.length})`} 
                iconPosition="start"
              />
              <Tab 
                icon={<PieChartIcon />} 
                label="Contract utilization" 
                iconPosition="start"
              />
              <Tab 
                icon={<AssessmentIcon />} 
                label="Analytics" 
                iconPosition="start"
              />
            </Tabs>
          </Box>

          {/* Approvals Tab */}
          {activeTab === 0 && (
            <Box sx={{ p: 3 }}>
              <SupervisorDashboard currentEmployee={currentEmployee} showKpiCards={false} />
            </Box>
          )}

          {/* Reports Tab */}
          {activeTab === 1 && (
            <Box sx={{ p: 3 }}>
              {/* Filters */}
              <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap', alignItems: 'center' }}>
                <TextField
                  size="small"
                  label="Search employees"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  InputProps={{
                    startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />,
                  }}
                  sx={{ minWidth: 200 }}
                />
                <FormControl size="small" sx={{ minWidth: 120 }}>
                  <InputLabel>Status</InputLabel>
                  <Select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    label="Status"
                  >
                    <MenuItem value="all">All Status</MenuItem>
                    <MenuItem value="pending_senior_staff">Waiting on Senior Staff</MenuItem>
                    <MenuItem value="pending_supervisor">Pending Supervisor</MenuItem>
                    <MenuItem value="pending_finance">Pending Finance</MenuItem>
                    <MenuItem value="approved">Approved</MenuItem>
                    <MenuItem value="needs_revision">Needs Revision</MenuItem>
                    <MenuItem value="rejected">Rejected</MenuItem>
                    <MenuItem value="draft">Drafts</MenuItem>
                  </Select>
                </FormControl>
                <FormControl size="small" sx={{ minWidth: 120 }}>
                  <InputLabel>Month</InputLabel>
                  <Select
                    value={monthFilter}
                    onChange={(e) => setMonthFilter(e.target.value)}
                    label="Month"
                  >
                    <MenuItem value="current">Current Month</MenuItem>
                    <MenuItem value="all">All Months</MenuItem>
                    <MenuItem value="9">September</MenuItem>
                    <MenuItem value="10">October</MenuItem>
                    <MenuItem value="11">November</MenuItem>
                    <MenuItem value="12">December</MenuItem>
                  </Select>
                </FormControl>
              </Box>

              {/* Dashboard Statistics */}

              {/* Reports Table */}
              <TableContainer sx={{ mt: 2 }}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Employee</TableCell>
                      <TableCell>Month/Year</TableCell>
                      <TableCell align="right">Amount</TableCell>
                      <TableCell align="right">Miles</TableCell>
                      <TableCell align="right">Hours</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Submitted</TableCell>
                      <TableCell align="center">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredReports.map((report) => {
                      const currentStepIndex = report.currentApprovalStep ?? 0;
                      const currentStep = report.approvalWorkflow?.[currentStepIndex];
                      const isSupervisorStage = (report.currentApprovalStage || '').toLowerCase() === 'supervisor';
                      const isSeniorStaffStage = report.status === 'pending_senior_staff' || (report.currentApprovalStage || '').toLowerCase() === 'senior_staff';
                      const isDelegatedToSupervisor = currentStep?.delegatedToId === supervisorId;
                      const isAwaitingSupervisor = !isSeniorStaffStage && isSupervisorStage && (
                        !report.currentApproverId ||
                        report.currentApproverId === supervisorId ||
                        isDelegatedToSupervisor
                      );
                      const dueInfo = getDueInfo(report.escalationDueAt);

                      return (
                      <TableRow key={report.id} hover>
                        <TableCell>
                          <Box 
                            sx={{ 
                              display: 'flex', 
                              alignItems: 'center',
                              cursor: 'pointer',
                              '&:hover': { backgroundColor: 'grey.50' }
                            }}
                            onClick={() => {
                              const employee = teamMembers.find(m => m.name === report.employeeName);
                              if (employee) handleViewEmployeeReport(employee);
                            }}
                          >
                            <Avatar sx={{ width: 32, height: 32, mr: 2 }}>
                              {report.employeeName.split(' ').map(n => n[0]).join('')}
                            </Avatar>
                            <Typography 
                              variant="body2" 
                              sx={{ 
                                color: 'primary.main',
                                fontWeight: 'bold',
                                '&:hover': { textDecoration: 'underline' }
                              }}
                            >
                              {report.employeeName}
                            </Typography>
                          </Box>
                        </TableCell>
                        <TableCell>
                          {new Date(report.year, report.month - 1).toLocaleString('default', { month: 'long' })} {report.year}
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                            ${report.totalAmount.toFixed(2)}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">{report.totalMiles.toFixed(1)}</TableCell>
                        <TableCell align="right">{report.totalHours.toFixed(1)}</TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                            <Chip
                              icon={getStatusIcon(report.status)}
                              label={isSeniorStaffStage ? 'Waiting on Senior Staff' : report.status.replace(/_/g, ' ').toUpperCase()}
                              color={getStatusColor(report.status) as any}
                              size="small"
                            />
                            {isSeniorStaffStage && report.currentApproverName && (
                              <Typography variant="caption" color="text.secondary">
                                With {report.currentApproverName}
                              </Typography>
                            )}
                          </Box>
                        </TableCell>
                        <TableCell>
                          {report.submittedAt 
                            ? new Date(report.submittedAt).toLocaleDateString()
                            : 'Not submitted'
                          }
                        </TableCell>
                        <TableCell align="center">
                          <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center', flexWrap: 'wrap' }}>
                            {isSeniorStaffStage && (
                              <Chip
                                size="small"
                                color="warning"
                                label="Waiting on Senior Staff"
                                sx={{ mr: 0.5 }}
                              />
                            )}
                            {dueInfo && (
                              <Chip
                                size="small"
                                color={dueInfo.color}
                                label={dueInfo.label}
                              />
                            )}
                            {currentStep?.delegatedToName && (
                              <Chip
                                size="small"
                                color="info"
                                label={`Delegated to ${currentStep.delegatedToName}`}
                              />
                            )}
                            <Tooltip title="View Full Report Details">
                              <IconButton
                                size="small"
                                onClick={() => {
                                  const employee = teamMembers.find(m => m.id === report.employeeId || m.name === report.employeeName);
                                  if (employee) {
                                    handleViewEmployeeReport(employee, report.month, report.year);
                                  } else {
                                    // If employee not in team list, fetch it
                                    fetch(`${API_BASE_URL}/api/employees/${report.employeeId}`, {
                                      headers: { Authorization: `Bearer ${localStorage.getItem('authToken') || ''}` },
                                    })
                                      .then(res => res.json())
                                      .then(empData => {
                                        handleViewEmployeeReport(
                                          {
                                            id: empData.id,
                                            name: empData.name || report.employeeName,
                                            email: empData.email || '',
                                            position: empData.position || '',
                                            supervisorId: empData.supervisorId,
                                            costCenters: empData.costCenters || [],
                                          },
                                          report.month,
                                          report.year
                                        );
                                      })
                                      .catch(err => {
                                        debugError('Error loading employee for report view:', err);
                                        alert('Failed to load employee details');
                                      });
                                  }
                                }}
                              >
                                <VisibilityIcon />
                              </IconButton>
                            </Tooltip>
                    {isAwaitingSupervisor && (
                      <>
                        <Tooltip title="Approve and Send to Finance">
                          <IconButton
                            size="small"
                            color="success"
                            onClick={() => {
                              setSelectedReport(report);
                              setReviewComment('');
                              setSupervisorCertificationAcknowledged(false);
                              setReviewDialogMode('approve');
                              setReviewDialogOpen(true);
                            }}
                          >
                            <CheckIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Request Revision from Employee">
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => {
                              setSelectedReport(report);
                              setReviewComment('');
                              setSupervisorCertificationAcknowledged(false);
                              setReviewDialogMode('revision');
                              setReviewDialogOpen(true);
                            }}
                          >
                            <CloseIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delegate">
                          <IconButton
                            size="small"
                            color="info"
                            onClick={() => handleOpenDelegateDialog(report)}
                          >
                            <PersonAddIcon />
                          </IconButton>
                        </Tooltip>
                      </>
                    )}
                    {/* Show resubmit button if report is in needs_revision status from finance feedback */}
                    {report.status === 'needs_revision' && report.currentApprovalStage === 'pending_supervisor' && (
                      <Tooltip title="Resubmit to Finance After Making Changes">
                        <IconButton
                          size="small"
                          color="success"
                          onClick={() => {
                            setSelectedReport(report);
                            setReviewComment('');
                            setSupervisorCertificationAcknowledged(false);
                            setReviewDialogMode('finance_return');
                            setReviewDialogOpen(true);
                          }}
                        >
                          <SendIcon />
                        </IconButton>
                      </Tooltip>
                    )}
                            {isSupervisorStage && (
                              <Tooltip title="Send Reminder">
                                <IconButton
                                  size="small"
                                  color={dueInfo?.color === 'error' ? 'error' : 'warning'}
                                  onClick={() => handleSendReminder(report.id)}
                                >
                                  <ScheduleIcon />
                                </IconButton>
                              </Tooltip>
                            )}
                            <Tooltip title="Add Comment">
                              <IconButton
                                size="small"
                                onClick={() => {
                                  setSelectedReport(report);
                                  setReviewComment('');
                                  setCommentDialogOpen(true);
                                }}
                              >
                                <CommentIcon />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Delete report">
                              <IconButton
                                size="small"
                                color="error"
                                onClick={() => handleDeleteReportClick(report)}
                              >
                                <DeleteIcon />
                              </IconButton>
                            </Tooltip>
                          </Box>
                        </TableCell>
                      </TableRow>
                    );})}
                  </TableBody>
                </Table>
              </TableContainer>

              {filteredReports.length === 0 && (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                  <AssignmentIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                  <Typography variant="h6" color="text.secondary">
                    No reports found matching your criteria
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Try adjusting your search or filter settings
                  </Typography>
                </Box>
              )}
            </Box>
          )}

          {/* Team Tab */}
          {activeTab === 2 && (
            <Box sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6">Team Members</Typography>
                <Button
                  startIcon={<PersonAddIcon />}
                  variant="outlined"
                  size="small"
                  onClick={() => {
                    showErrorPrompt(
                      'Supervisor team membership is managed in the Admin Portal (Employee Management / Supervisor Management). ' +
                      'If you need someone added to your team, please contact an administrator.'
                    );
                  }}
                >
                  Add Team Member
                </Button>
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                To change who appears in this list, an admin must update supervisor assignments in the Admin Portal.
              </Typography>

              <List>
                {teamMembers.map((member) => (
                  <ListItem key={member.id} divider>
                    <ListItemAvatar>
                      <Avatar>
                        {member.name.split(' ').map(n => n[0]).join('')}
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography 
                            variant="body1"
                            sx={{ 
                              color: 'primary.main',
                              fontWeight: 'bold',
                              cursor: 'pointer',
                              '&:hover': { textDecoration: 'underline' }
                            }}
                            onClick={() => handleViewEmployeeReport(member)}
                          >
                            {member.name}
                          </Typography>
                          <Chip
                            label={member.isActive ? 'Active' : 'Inactive'}
                            color={member.isActive ? 'success' : 'default'}
                            size="small"
                          />
                        </Box>
                      }
                      secondary={
                        <>
                          <Typography component="span" variant="body2" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                            {member.position} • {member.email}
                          </Typography>
                          <Box component="span" sx={{ display: 'inline-flex', gap: 1, flexWrap: 'wrap' }}>
                            {(member.costCenters || []).map((cc) => (
                              <Chip key={cc} label={cc} size="small" variant="outlined" />
                            ))}
                          </Box>
                        </>
                      }
                    />
                    <ListItemSecondaryAction>
                      <IconButton edge="end">
                        <VisibilityIcon />
                      </IconButton>
                    </ListItemSecondaryAction>
                  </ListItem>
                ))}
              </List>
            </Box>
          )}

          {/* Contract utilization (team cost centers vs monthly caps) */}
          {activeTab === 3 && (
            <SupervisorContractUtilizationTab supervisorId={supervisorId} />
          )}

          {/* Analytics Tab */}
          {activeTab === 4 && (
            <Box sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Team Performance Analytics
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Approval rates, submission patterns, expense trends, and team productivity metrics.
              </Typography>
              <SupervisorDashboard currentEmployee={currentEmployee} showKpiCards={true} kpiOnly />
            </Box>
          )}
        </Paper>
      </Box>

      {/* Review dialog: separate flows for approve vs revision vs finance follow-up */}
      <ReviewDialog
        open={reviewDialogOpen}
        onClose={closeReviewDialog}
        mode={reviewDialogMode}
        report={selectedReport}
        reviewComment={reviewComment}
        onReviewCommentChange={setReviewComment}
        certificationAcknowledged={supervisorCertificationAcknowledged}
        onCertificationAcknowledgedChange={setSupervisorCertificationAcknowledged}
        savingAction={savingAction}
        requiresCertification={true}
        labels={{
          approveTitle: 'Approve and send to finance',
          approveAlert:
            'This sends the report to the finance team. No revision notes are required; use revision instead if the employee still needs to make changes.',
          certNotRequiredText: 'Weekly check-up reports do not require the supervisor certification step.',
          revisionAlert:
            'The employee will get this report back as "needs revision" with the message below. You can select specific line items in full report details if your workflow uses item-level revision.',
          certificationCheckboxLabel: 'Supervisor: I have read and agree to the certification statement above',
          approveButtonLabel: 'Approve and send to finance',
        }}
        commentAuthorName={(comment) => comment.supervisorName}
        onViewFullDetails={(reportId) => {
          setDetailedReportViewOpen(true);
          setSelectedReportId(reportId);
        }}
        onApprove={handleApproveReport}
        onRequestRevision={handleRejectReport}
        onResubmitToFinance={handleResubmitToFinance}
      />

      {/* Comment Dialog */}
      <Dialog 
        open={commentDialogOpen} 
        onClose={() => setCommentDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          Add Comment to {selectedReport?.employeeName}'s Report
        </DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            multiline
            rows={4}
            value={reviewComment}
            onChange={(e) => setReviewComment(e.target.value)}
            placeholder="Add a comment or feedback..."
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCommentDialogOpen(false)}>Cancel</Button>
          <Button 
            onClick={() => selectedReport && handleAddComment(selectedReport.id)}
            variant="contained"
            disabled={savingAction || !reviewComment.trim()}
          >
            Add Comment
          </Button>
        </DialogActions>
      </Dialog>

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
            ? `This will permanently delete the report for ${reportToDelete.employeeName} – ${new Date(reportToDelete.year, reportToDelete.month - 1).toLocaleString('default', { month: 'long' })} ${reportToDelete.year}. This cannot be undone.`
            : 'This will permanently delete the report. This cannot be undone.'
        }
        confirmButtonLabel="Delete report"
      />

      {/* Delegate Dialog */}
      <Dialog
        open={delegateDialogOpen}
        onClose={handleCloseDelegateDialog}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Delegate Approval</DialogTitle>
        <DialogContent>
          {loadingDelegates ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
              <CircularProgress size={28} />
            </Box>
          ) : availableDelegates.length === 0 ? (
            <Alert severity="info">
              No other supervisors are currently available for delegation.
            </Alert>
          ) : (
            <FormControl fullWidth margin="normal">
              <InputLabel id="delegate-select-label">Select Delegate</InputLabel>
              <Select
                labelId="delegate-select-label"
                value={selectedDelegateId}
                label="Select Delegate"
                onChange={(e) => setSelectedDelegateId(e.target.value)}
              >
                {availableDelegates.map((delegate) => (
                  <MenuItem key={delegate.id} value={delegate.id}>
                    {(delegate.preferredName || delegate.name)}
                    {delegate.email ? ` • ${delegate.email}` : ''}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDelegateDialog}>Cancel</Button>
          <Button
            onClick={handleDelegateSubmit}
            variant="contained"
            disabled={savingAction || loadingDelegates || !selectedDelegateId}
          >
            Delegate
          </Button>
        </DialogActions>
      </Dialog>

      {/* Keyboard Shortcuts Dialog */}
      <KeyboardShortcutsDialog
        open={shortcutsDialogOpen}
        onClose={() => setShortcutsDialogOpen(false)}
        shortcuts={shortcuts}
        title="Keyboard Shortcuts - Supervisor Portal"
      />

      {/* Employee Report View Modal */}
      <Dialog 
        open={showEmployeeReportView} 
        onClose={() => setShowEmployeeReportView(false)}
        maxWidth="xl"
        fullWidth
        fullScreen={false}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="h5" component="div">
            {viewingEmployeeReport?.name}'s Expense Report
          </Typography>
          <Button 
            onClick={() => setShowEmployeeReportView(false)}
            startIcon={<CloseIcon />}
          >
            Close
          </Button>
        </DialogTitle>
        <DialogContent sx={{ p: 0, overflow: 'auto' }}>
          {viewingEmployeeReport && (
            <Box sx={{ p: 2 }}>
              <Alert severity="info" sx={{ mb: 2 }}>
                <Typography variant="body2">
                  <strong>Supervisor View:</strong> You are viewing {viewingEmployeeReport.name}'s expense report in supervisor mode.
                  Some features like direct editing may be limited.
                </Typography>
              </Alert>
              <StaffPortal
                employeeId={viewingEmployeeReport.id}
                reportMonth={viewingReportMonth ?? new Date().getMonth() + 1}
                reportYear={viewingReportYear ?? new Date().getFullYear()}
                supervisorMode={true}
                supervisorId={supervisorId}
                supervisorName={supervisorName}
                viewerUserIdForNotifications={supervisorId}
                onSelectedItemsChange={handleSelectedItemsChange}
                onApproveReport={stableApproveHandler}
                onRequestRevision={stableRevisionHandler}
              />
            </Box>
          )}
        </DialogContent>
      </Dialog>

    </Box>
  );
};

export default SupervisorPortal;
