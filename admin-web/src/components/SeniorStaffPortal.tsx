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
import OxfordHouseLogo from './OxfordHouseLogo';
import { NotificationBell } from './NotificationBell';
import DetailedReportView from './DetailedReportView';
import { ConfirmDeleteDialog } from './ConfirmDeleteDialog';

// Keyboard shortcuts
import { useKeyboardShortcuts, KeyboardShortcut } from '../hooks/useKeyboardShortcuts';
import KeyboardShortcutsDialog from './KeyboardShortcutsDialog';

// Debug logging
import { debugError, debugLog } from '../config/debug';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://oxford-mileage-backend.onrender.com';

interface SeniorStaffPortalProps {
  seniorStaffId: string;
  seniorStaffName: string;
}

interface Employee {
  id: string;
  name: string;
  preferredName?: string;
  email: string;
  position: string;
  seniorStaffId?: string | null;
  costCenters?: string[];
  isActive?: boolean;
  joinDate?: string;
  lastActivity?: string;
}

type ReportStatus =
  | 'draft'
  | 'submitted'
  | 'under_review'
  | 'approved'
  | 'rejected'
  | 'pending_supervisor'
  | 'pending_senior_staff'
  | 'pending_finance'
  | 'needs_revision';

interface ApprovalReminder {
  sentAt: string;
  sentBy?: string | null;
}

interface ApprovalStep {
  step: number;
  role: string;
  approverId?: string | null;
  approverName?: string | null;
  status: 'pending' | 'waiting' | 'approved' | 'rejected';
  delegatedToId?: string | null;
  delegatedToName?: string | null;
  dueAt?: string | null;
  actedAt?: string | null;
  comments?: string;
  reminders?: ApprovalReminder[];
}

interface TeamReport {
  id: string;
  employeeId: string;
  employeeName: string;
  month: number;
  year: number;
  status: ReportStatus;
  submittedAt?: string;
  totalAmount: number;
  totalMiles: number;
  totalMileageAmount?: number;
  totalHours: number;
  costCenters: string[];
  comments?: SupervisorComment[];
  rejectionReason?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  approvalWorkflow?: ApprovalStep[];
  currentApprovalStage?: string;
  currentApprovalStep?: number;
  currentApproverId?: string | null;
  currentApproverName?: string | null;
  escalationDueAt?: string | null;
}

interface SupervisorComment {
  id: string;
  seniorStaffId: string;
  seniorStaffName: string;
  reportId: string;
  comment: string;
  createdAt: string;
  isResolved?: boolean;
}

interface DashboardStats {
  totalTeamMembers: number;
  activeReports: number;
  pendingReviews: number;
  monthlyTotal: number;
  approvalRate: number;
  averageResponseTime: string;
}

const SeniorStaffPortal: React.FC<SeniorStaffPortalProps> = ({ seniorStaffId, seniorStaffName }) => {
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
  const [commentDialogOpen, setCommentDialogOpen] = useState(false);
  const [supervisorCertificationAcknowledged, setSupervisorCertificationAcknowledged] = useState<boolean>(false);
  const [detailedReportViewOpen, setDetailedReportViewOpen] = useState(false);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [selectedItemsForRevision, setSelectedItemsForRevision] = useState<{ mileage: Set<string>, receipts: Set<string>, timeTracking: Set<string> } | null>(null);
  
  // Keyboard shortcuts state
  const [shortcutsDialogOpen, setShortcutsDialogOpen] = useState(false);

  // Employee report viewing
  const [viewingEmployeeReport, setViewingEmployeeReport] = useState<Employee | null>(null);
  const [viewingReportMonth, setViewingReportMonth] = useState<number | null>(new Date().getMonth() + 1);
  const [viewingReportYear, setViewingReportYear] = useState<number | null>(new Date().getFullYear());
  const [showEmployeeReportView, setShowEmployeeReportView] = useState(false);

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

  const currentEmployee = useMemo(() => ({ id: seniorStaffId, name: seniorStaffName }), [seniorStaffId, seniorStaffName]);

  // Widget toggle removed

  const loadTeamMembers = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/senior-staff/${seniorStaffId}/team`);
      if (!response.ok) throw new Error('Failed to load team members');
      const data = await response.json();
      const mapped: Employee[] = data.map((member: any) => ({
        id: member.id,
        name: member.name,
        preferredName: member.preferredName,
        email: member.email,
        position: member.position,
        seniorStaffId: member.seniorStaffId,
        costCenters: member.costCenters || [],
        isActive: member.archived ? false : true,
        joinDate: member.joinDate,
      }));
      setTeamMembers(mapped);
    } catch (error) {
      debugError('Error loading team members:', error);
      setTeamMembers([]);
    }
  }, [seniorStaffId]);

  const loadTeamReports = useCallback(async () => {
    try {
      const { apiGet } = await import('../services/rateLimitedApi');
      // Use /api/monthly-reports endpoint which supports teamSupervisorId filtering
      const data = await apiGet<any[]>(`/api/monthly-reports?teamSeniorStaffId=${seniorStaffId}`);
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
                seniorStaffId: comment.seniorStaffId || '',
                seniorStaffName: comment.seniorStaffName || 'Supervisor',
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
        };
      });

      debugLog(`📊 Loaded ${mapped.length} team reports for senior staff ${seniorStaffId}`);
      setTeamReports(mapped);
    } catch (error) {
      debugError('Error loading team reports:', error);
      setTeamReports([]);
    }
  }, [seniorStaffId]);

  useEffect(() => {
    const interval = setInterval(() => {
      loadTeamReports();
    }, 30000); // Auto-refresh every 30 seconds

    return () => clearInterval(interval);
  }, [loadTeamReports]);

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

  const handleApproveReport = async (reportId: string) => {
    if (!supervisorCertificationAcknowledged) {
      alert('Please acknowledge the certification statement before approving the report.');
      return;
    }
    
    setSavingAction(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/expense-reports/${reportId}/approval`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'approve',
          approverId: seniorStaffId,
          approverName: seniorStaffName,
          supervisorCertificationAcknowledged: supervisorCertificationAcknowledged,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to approve report');
      }

      setReviewDialogOpen(false);
      setReviewComment('');
      setSupervisorCertificationAcknowledged(false);
      await loadTeamReports();
    } catch (error) {
      debugError('Error approving report:', error);
      alert('Failed to approve report. Please try again.');
    } finally {
      setSavingAction(false);
    }
  };

  const handleRejectReport = async (reportId: string) => {
    if (!reviewComment.trim()) {
      alert('Please provide a reason for rejection.');
      return;
    }

    setSavingAction(true);
    try {
      // Use request_revision_to_employee action to send back to employee
      const body: any = {
        action: 'request_revision_to_employee',
        approverId: seniorStaffId,
        approverName: seniorStaffName,
        comments: reviewComment.trim(),
      };
      
      // Include selected items if any were selected
      if (selectedItemsForRevision) {
        body.selectedItems = {
          mileage: Array.from(selectedItemsForRevision.mileage),
          receipts: Array.from(selectedItemsForRevision.receipts),
          timeTracking: Array.from(selectedItemsForRevision.timeTracking),
        };
      }
      
      const response = await fetch(`${API_BASE_URL}/api/expense-reports/${reportId}/approval`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}));
        const msg = errBody?.error || response.statusText || 'Failed to request revision';
        throw new Error(msg);
      }

      setReviewDialogOpen(false);
      setReviewComment('');
      await loadTeamReports();
      alert('Report sent back to employee for revision.');
    } catch (error) {
      debugError('Error requesting revision:', error);
      const message = error instanceof Error ? error.message : 'Failed to request revision. Please try again.';
      alert(message);
    } finally {
      setSavingAction(false);
    }
  };

  // Memoized callback for selected items change to prevent infinite loops
  const handleSelectedItemsChange = useCallback((selectedItems: { mileage: Set<string>, receipts: Set<string>, timeTracking: Set<string> }) => {
    setSelectedItemsForRevision(selectedItems);
  }, []);

  // Handler for approving report from StaffPortal - sends to finance
  const handleApproveFromPortal = useCallback(async () => {
    if (!viewingEmployeeReport || !viewingReportMonth || !viewingReportYear) {
      alert('Unable to approve: Missing report information');
      return;
    }
    
    // Find the report ID from teamReports
    const report = teamReports.find(r => 
      r.employeeId === viewingEmployeeReport.id && 
      r.month === viewingReportMonth && 
      r.year === viewingReportYear
    );
    
    if (!report || !report.id) {
      alert('Unable to approve: Report not found');
      return;
    }
    
    // Check if supervisor certification is acknowledged
    if (!supervisorCertificationAcknowledged) {
      const shouldAcknowledge = window.confirm('Please acknowledge the certification statement before approving. Would you like to acknowledge now?');
      if (shouldAcknowledge) {
        setSupervisorCertificationAcknowledged(true);
      } else {
        return;
      }
    }
    
    const confirmApprove = window.confirm(`Are you sure you want to approve this report and send it to the next reviewer (supervisor)?`);
    if (!confirmApprove) {
      return;
    }
    
    setSavingAction(true);
    try {
      // Use 'approve' action which sends to finance
      const response = await fetch(`${API_BASE_URL}/api/expense-reports/${report.id}/approval`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'approve',
          approverId: seniorStaffId,
          approverName: seniorStaffName,
          supervisorCertificationAcknowledged: supervisorCertificationAcknowledged,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to approve report: ${errorText}`);
      }

      setSupervisorCertificationAcknowledged(false);
      await loadTeamReports();
      setShowEmployeeReportView(false);
      alert('Report approved and sent to the next reviewer successfully!');
    } catch (error) {
      debugError('Error approving report:', error);
      alert(`Failed to approve report. Please try again. Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setSavingAction(false);
    }
  }, [viewingEmployeeReport, viewingReportMonth, viewingReportYear, teamReports, seniorStaffId, seniorStaffName, supervisorCertificationAcknowledged, loadTeamReports]);

  // Handler for requesting revision from StaffPortal - sends back to employee with notes
  const handleRequestRevisionFromPortal = useCallback(async () => {
    if (!viewingEmployeeReport || !viewingReportMonth || !viewingReportYear) {
      alert('Unable to request revision: Missing report information');
      return;
    }
    
    // Find the report ID from teamReports
    const report = teamReports.find(r => 
      r.employeeId === viewingEmployeeReport.id && 
      r.month === viewingReportMonth && 
      r.year === viewingReportYear
    );
    
    if (!report || !report.id) {
      alert('Unable to request revision: Report not found');
      return;
    }
    
    // Open the review dialog with the report selected
    setSelectedReport(report);
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
      console.log('🔍 SeniorStaffPortal: Handlers created/updated:', {
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
      console.log('🔍 SeniorStaffPortal: Dialog opened, checking handlers:', {
        hasApprove: typeof handleApproveFromPortal === 'function',
        hasRevision: typeof handleRequestRevisionFromPortal === 'function',
        handleApproveFromPortal,
        handleRequestRevisionFromPortal,
        viewingEmployeeReport: !!viewingEmployeeReport,
        viewingReportMonth,
        viewingReportYear,
        seniorStaffId,
        seniorStaffName
      });
      debugLog('🔍 SeniorStaffPortal: Dialog opened, checking handlers:', {
        hasApprove: typeof handleApproveFromPortal === 'function',
        hasRevision: typeof handleRequestRevisionFromPortal === 'function',
        viewingEmployeeReport: !!viewingEmployeeReport,
        viewingReportMonth,
        viewingReportYear,
        seniorStaffId,
        seniorStaffName
      });
      if (typeof handleApproveFromPortal !== 'function') {
        console.error('❌ handleApproveFromPortal is not a function!', handleApproveFromPortal);
      }
      if (typeof handleRequestRevisionFromPortal !== 'function') {
        console.error('❌ handleRequestRevisionFromPortal is not a function!', handleRequestRevisionFromPortal);
      }
    }
  }, [showEmployeeReportView, viewingEmployeeReport, handleApproveFromPortal, handleRequestRevisionFromPortal, viewingReportMonth, viewingReportYear, seniorStaffId, seniorStaffName]);

  const handleResubmitToFinance = async (reportId: string) => {
    if (!reviewComment.trim()) {
      alert('Please provide comments about the changes made (e.g., "Changes made per finance feedback").');
      return;
    }

    setSavingAction(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/expense-reports/${reportId}/approval`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'resubmit_to_finance',
          approverId: seniorStaffId,
          approverName: seniorStaffName,
          comments: reviewComment.trim(),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to resubmit to finance');
      }

      setReviewDialogOpen(false);
      setReviewComment('');
      await loadTeamReports();
      alert('Report resubmitted to Finance team.');
    } catch (error) {
      debugError('Error resubmitting to finance:', error);
      alert('Failed to resubmit to finance. Please try again.');
    } finally {
      setSavingAction(false);
    }
  };

  const loadDelegates = useCallback(async () => {
    setLoadingDelegates(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/employees?position=Supervisor&includeArchived=false`);
      if (!response.ok) throw new Error('Failed to load supervisors');
      const data = await response.json();
      const mapped: Employee[] = data
        .filter((emp: any) => emp.id !== seniorStaffId)
        .map((emp: any) => ({
          id: emp.id,
          name: emp.name,
          preferredName: emp.preferredName,
          email: emp.email,
          position: emp.position,
          seniorStaffId: emp.seniorStaffId,
          costCenters: emp.costCenters || [],
        }));
      setAvailableDelegates(mapped);
    } catch (error) {
      debugError('Error loading delegates:', error);
      setAvailableDelegates([]);
    } finally {
      setLoadingDelegates(false);
    }
  }, [seniorStaffId]);

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

  const handleDelegateSubmit = async () => {
    if (!delegateReport || !selectedDelegateId) {
      alert('Please select a delegate.');
      return;
    }

    setSavingAction(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/expense-reports/${delegateReport.id}/approval`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'delegate',
          approverId: seniorStaffId,
          approverName: seniorStaffName,
          delegateId: selectedDelegateId,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to delegate report');
      }

      await loadTeamReports();
      handleCloseDelegateDialog();
    } catch (error) {
      debugError('Error delegating report:', error);
      alert('Failed to delegate report. Please try again.');
    } finally {
      setSavingAction(false);
    }
  };

  const handleSendReminder = async (reportId: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/expense-reports/${reportId}/approval`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'remind',
          approverId: seniorStaffId,
          approverName: seniorStaffName,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to send reminder');
      }

      await loadTeamReports();
    } catch (error) {
      debugError('Error sending reminder:', error);
      alert('Failed to send reminder. Please try again.');
    }
  };

  const handleAddComment = async (reportId: string) => {
    if (!reviewComment.trim()) return;

    setSavingAction(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/expense-reports/${reportId}/approval`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'comment',
          approverId: seniorStaffId,
          approverName: seniorStaffName,
          comments: reviewComment.trim(),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to add comment');
      }

      setCommentDialogOpen(false);
      setReviewComment('');
      await loadTeamReports();
    } catch (error) {
      debugError('Error adding comment:', error);
      alert('Failed to add comment. Please try again.');
    } finally {
      setSavingAction(false);
    }
  };

  const handleDeleteReportClick = (report: TeamReport) => {
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
        const response = await fetch(`${API_BASE_URL}/api/expense-reports/${reportId}`);
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
          const empResponse = await fetch(`${API_BASE_URL}/api/employees/${targetEmployeeId}`);
          if (empResponse.ok) {
            const empData = await empResponse.json();
            handleViewEmployeeReport(
              {
                id: empData.id,
                name: empData.name,
                preferredName: empData.preferredName,
                email: empData.email,
                position: empData.position,
                seniorStaffId: empData.seniorStaffId,
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
        const response = await fetch(`${API_BASE_URL}/api/employees/${employeeId}`);
        if (response.ok) {
          const empData = await response.json();
          handleViewEmployeeReport(
            {
              id: empData.id,
              name: empData.name,
              preferredName: empData.preferredName,
              email: empData.email,
              position: empData.position,
              seniorStaffId: empData.seniorStaffId,
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
      case 'pending_finance':
        return <ScheduleIcon />;
      case 'needs_revision':
        return <CommentIcon />;
      default: return <AssignmentIcon />;
    }
  };

  const getDueInfo = (dueAt?: string | null) => {
    if (!dueAt) return null;
    const dueDate = new Date(dueAt);
    if (Number.isNaN(dueDate.getTime())) return null;
    const diffMs = dueDate.getTime() - Date.now();
    const hours = Math.max(1, Math.round(Math.abs(diffMs) / 3600000));
    if (diffMs <= 0) {
      return { label: `Overdue ${hours}h`, color: 'error' as const };
    }
    if (diffMs < 6 * 3600000) {
      return { label: `Due in ${hours}h`, color: 'warning' as const };
    }
    return { label: `Due in ${hours}h`, color: 'default' as const };
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
        <Typography variant="h6">Loading Senior Staff Portal...</Typography>
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
                Senior Staff Portal
              </Typography>
              <Typography variant="h6" color="text.secondary">
                Welcome back, {seniorStaffName}
              </Typography>
            </Box>
          </Box>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              {/* Notification Bell */}
              <NotificationBell 
                employeeId={seniorStaffId} 
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
                icon={<AssessmentIcon />} 
                label="Analytics" 
                iconPosition="start"
              />
            </Tabs>
          </Box>

          {/* Approvals Tab */}
          {activeTab === 0 && (
            <Box sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>Reports pending your review</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Reports from your team waiting for your approval. Click a report to review it.
              </Typography>
              {filteredReports.filter(r => r.status === 'pending_senior_staff').length === 0 ? (
                <Alert severity="info">No reports pending your review.</Alert>
              ) : (
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Employee</TableCell>
                        <TableCell>Period</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell align="right">Amount</TableCell>
                        <TableCell align="right">Miles</TableCell>
                        <TableCell padding="none" align="right">Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {filteredReports.filter(r => r.status === 'pending_senior_staff').map((report) => (
                        <TableRow key={report.id} hover>
                          <TableCell>{report.employeeName}</TableCell>
                          <TableCell>{report.month}/{report.year}</TableCell>
                          <TableCell><Chip label={report.status.replace(/_/g, ' ')} size="small" color="warning" /></TableCell>
                          <TableCell align="right">${(report.totalAmount || 0).toFixed(2)}</TableCell>
                          <TableCell align="right">{report.totalMiles ?? 0}</TableCell>
                          <TableCell padding="none" align="right">
                            <IconButton size="small" onClick={() => handleViewEmployeeReport(teamMembers.find(m => m.id === report.employeeId) || { id: report.employeeId, name: report.employeeName, email: '', position: '' }, report.month, report.year)} title="View">
                              <VisibilityIcon fontSize="small" />
                            </IconButton>
                            <IconButton size="small" onClick={() => { setSelectedReport(report); setDetailedReportViewOpen(true); }} title="Details">
                              <AssignmentIcon fontSize="small" />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
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
                    <MenuItem value="pending_senior_staff">Pending Senior Staff</MenuItem>
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
                      const isDelegatedToSupervisor = currentStep?.delegatedToId === seniorStaffId;
                      const isAwaitingSupervisor = isSupervisorStage && (
                        !report.currentApproverId ||
                        report.currentApproverId === seniorStaffId ||
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
                          <Chip
                            icon={getStatusIcon(report.status)}
                            label={report.status.replace('_', ' ').toUpperCase()}
                            color={getStatusColor(report.status) as any}
                            size="small"
                          />
                        </TableCell>
                        <TableCell>
                          {report.submittedAt 
                            ? new Date(report.submittedAt).toLocaleDateString()
                            : 'Not submitted'
                          }
                        </TableCell>
                        <TableCell align="center">
                          <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center', flexWrap: 'wrap' }}>
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
                                    fetch(`${API_BASE_URL}/api/employees/${report.employeeId}`)
                                      .then(res => res.json())
                                      .then(empData => {
                                        handleViewEmployeeReport(
                                          {
                                            id: empData.id,
                                            name: empData.name || report.employeeName,
                                            email: empData.email || '',
                                            position: empData.position || '',
                                            seniorStaffId: empData.seniorStaffId,
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
                              handleApproveReport(report.id);
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
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h6">Team Members</Typography>
                <Button
                  startIcon={<PersonAddIcon />}
                  variant="contained"
                  size="small"
                >
                  Add Team Member
                </Button>
              </Box>

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

          {/* Analytics Tab */}
          {activeTab === 3 && (
            <Box sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Team Performance Analytics
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Comprehensive analytics and performance metrics will be available here.
                This will include approval rates, submission patterns, expense trends, and team productivity metrics.
              </Typography>
            </Box>
          )}
        </Paper>
      </Box>

      {/* Review Dialog */}
      <Dialog 
        open={reviewDialogOpen} 
        onClose={() => {
          setReviewDialogOpen(false);
          setSupervisorCertificationAcknowledged(false);
          setReviewComment('');
        }}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {selectedReport ? `${selectedReport.employeeName}'s Report - ${new Date(selectedReport.year, selectedReport.month - 1).toLocaleString('default', { month: 'long' })} ${selectedReport.year}` : ''}
        </DialogTitle>
        <DialogContent>
          {selectedReport && (
            <Box>
              <Box sx={{ display: 'flex', gap: 4, mb: 3 }}>
                <Box>
                  <Typography variant="body2" color="text.secondary">Total Amount</Typography>
                  <Typography variant="h5">${selectedReport.totalAmount.toFixed(2)}</Typography>
                </Box>
                <Box>
                  <Typography variant="body2" color="text.secondary">Total Miles</Typography>
                  <Typography variant="h5">{selectedReport.totalMiles.toFixed(1)}</Typography>
                </Box>
                <Box>
                  <Typography variant="body2" color="text.secondary">Total Hours</Typography>
                  <Typography variant="h5">{selectedReport.totalHours.toFixed(1)}</Typography>
                </Box>
              </Box>

              <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
                Cost Centers
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, mb: 3 }}>
                {selectedReport.costCenters.map((cc) => (
                  <Chip key={cc} label={cc} />
                ))}
              </Box>

              {selectedReport.comments && selectedReport.comments.length > 0 && (
                <>
                  <Typography variant="h6" gutterBottom>
                    Previous Comments
                  </Typography>
                  <List>
                    {selectedReport.comments.map((comment) => (
                      <ListItem key={comment.id}>
                        <ListItemText
                          primary={comment.comment}
                          secondary={`by ${comment.seniorStaffName} on ${new Date(comment.createdAt).toLocaleString()}`}
                        />
                      </ListItem>
                    ))}
                  </List>
                </>
              )}

              {/* Certification Statement */}
              <Box sx={{ mt: 3, p: 2, border: '1px solid #ccc', borderRadius: 1, bgcolor: '#fff0f5' }}>
                <Typography variant="body2" sx={{ mb: 2, fontStyle: 'italic' }} component="div">
                  By signing and submitting this report to Oxford House, Inc., I certify under penalty of perjury that the pages herein document genuine, valid, and necessary expenditures, as well as an accurate record of my time and travel on behalf of Oxford House, Inc.
                </Typography>
                
                {/* Supervisor Acknowledgment Checkbox */}
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <Checkbox
                    checked={supervisorCertificationAcknowledged}
                    onChange={(e) => setSupervisorCertificationAcknowledged(e.target.checked)}
                    size="small"
                  />
                  <Typography variant="body2" component="div">
                    Supervisor: I have read and agree to the certification statement above
                  </Typography>
                </Box>
              </Box>

              <Box sx={{ mt: 3, mb: 2 }}>
                <Button
                  variant="outlined"
                  startIcon={<VisibilityIcon />}
                  onClick={() => {
                    if (selectedReport) {
                      setDetailedReportViewOpen(true);
                      setSelectedReportId(selectedReport.id);
                    }
                  }}
                >
                  View Full Report Details
                </Button>
              </Box>

              <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
                Add Review Comment
              </Typography>
              <TextField
                fullWidth
                multiline
                rows={3}
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                placeholder={
                  selectedReport?.status === 'needs_revision' && selectedReport?.currentApprovalStage === 'pending_supervisor'
                    ? "Describe changes made (e.g., 'Fixed missing receipts, corrected mileage amounts per finance feedback')..."
                    : "Add any feedback or notes about this report..."
                }
              />
              {selectedReport?.status === 'needs_revision' && selectedReport?.currentApprovalStage === 'pending_supervisor' && (
                <Alert severity="info" sx={{ mt: 2 }}>
                  <Typography component="div" variant="body2">
                    This report was returned from Finance for revision. You can either:
                    <Box component="ul" sx={{ marginTop: '8px', marginBottom: 0, paddingLeft: '20px' }}>
                      <li>Make changes and resubmit to Finance</li>
                      <li>Send it back to the employee for revision</li>
                    </Box>
                  </Typography>
                </Alert>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setReviewDialogOpen(false);
            setReviewComment('');
            setSupervisorCertificationAcknowledged(false);
          }}>Cancel</Button>
          {/* Show different actions based on report status */}
          {selectedReport?.status === 'needs_revision' && selectedReport?.currentApprovalStage === 'pending_supervisor' ? (
            <>
              <Button 
                onClick={() => selectedReport && handleRejectReport(selectedReport.id)}
                color="error"
                disabled={savingAction || !reviewComment.trim()}
              >
                Send Back to Employee
              </Button>
              <Button 
                onClick={() => selectedReport && handleResubmitToFinance(selectedReport.id)}
                color="success"
                variant="contained"
                disabled={savingAction || !reviewComment.trim()}
              >
                Resubmit to Finance
              </Button>
            </>
          ) : (
            <>
              <Button 
                onClick={() => selectedReport && handleRejectReport(selectedReport.id)}
                color="error"
                disabled={savingAction || !reviewComment.trim()}
              >
                Request Revision from Employee
              </Button>
              <Button 
                onClick={() => selectedReport && handleApproveReport(selectedReport.id)}
                color="success"
                variant="contained"
                disabled={savingAction}
              >
                Approve and Send to Finance
              </Button>
            </>
          )}
        </DialogActions>
      </Dialog>

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
        title="Keyboard Shortcuts - Senior Staff Portal"
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
        <DialogContent sx={{ p: 0 }}>
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
                seniorStaffId={seniorStaffId}
                seniorStaffName={seniorStaffName}
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

export default SeniorStaffPortal;
