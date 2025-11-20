import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
  Switch,
  FormControlLabel,
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
  // Delete as DeleteIcon, // Currently unused
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
  // Send as SendIcon, // Currently unused
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
import SupervisorDashboard from './SupervisorDashboard';
import { DashboardStatistics } from './DashboardStatistics';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3002';

interface SupervisorPortalProps {
  supervisorId: string;
  supervisorName: string;
}

interface Employee {
  id: string;
  name: string;
  preferredName?: string;
  email: string;
  position: string;
  supervisorId?: string | null;
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
  supervisorId: string;
  supervisorName: string;
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
  const [monthFilter, setMonthFilter] = useState<string>('current');

  // Selected report for review
  const [selectedReport, setSelectedReport] = useState<TeamReport | null>(null);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [commentDialogOpen, setCommentDialogOpen] = useState(false);
  const [supervisorCertificationAcknowledged, setSupervisorCertificationAcknowledged] = useState<boolean>(false);

  // Employee report viewing
  const [viewingEmployeeReport, setViewingEmployeeReport] = useState<Employee | null>(null);
  const [showEmployeeReportView, setShowEmployeeReportView] = useState(false);

  const [showDashboardWidgets, setShowDashboardWidgets] = useState<boolean>(() => {
    if (typeof window === 'undefined') {
      return true;
    }
    const stored = window.localStorage.getItem('supervisorPortal.showDashboardWidgets');
    return stored !== 'false';
  });
  const [showSupervisorDashboard, setShowSupervisorDashboard] = useState<boolean>(() => {
    if (typeof window === 'undefined') {
      return true;
    }
    const stored = window.localStorage.getItem('supervisorPortal.showSupervisorDashboard');
    return stored !== 'false';
  });

  // Loading states
  const [loading, setLoading] = useState(true);
  const [savingAction, setSavingAction] = useState(false);
  const [delegateDialogOpen, setDelegateDialogOpen] = useState(false);
  const [delegateReport, setDelegateReport] = useState<TeamReport | null>(null);
  const [selectedDelegateId, setSelectedDelegateId] = useState<string>('');
  const [availableDelegates, setAvailableDelegates] = useState<Employee[]>([]);
  const [loadingDelegates, setLoadingDelegates] = useState(false);

  // Memoize the employee object to prevent SupervisorDashboard from re-rendering unnecessarily
  const currentEmployee = useMemo(() => ({ id: supervisorId, name: supervisorName }), [supervisorId, supervisorName]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(
        'supervisorPortal.showDashboardWidgets',
        showDashboardWidgets ? 'true' : 'false'
      );
    }
  }, [showDashboardWidgets]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(
        'supervisorPortal.showSupervisorDashboard',
        showSupervisorDashboard ? 'true' : 'false'
      );
    }
  }, [showSupervisorDashboard]);


  const loadTeamMembers = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/supervisors/${supervisorId}/team`);
      if (!response.ok) throw new Error('Failed to load team members');
      const data = await response.json();
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
      console.error('Error loading team members:', error);
      setTeamMembers([]);
    }
  }, [supervisorId]);

  const loadTeamReports = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/expense-reports?teamSupervisorId=${supervisorId}`);
      if (!response.ok) throw new Error('Failed to load reports');
      const data = await response.json();
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
        };
      });

      setTeamReports(mapped);
    } catch (error) {
      console.error('Error loading team reports:', error);
      setTeamReports([]);
    }
  }, [supervisorId]);

  useEffect(() => {
    const interval = setInterval(() => {
      loadTeamReports();
    }, 30000); // Auto-refresh every 30 seconds

    return () => clearInterval(interval);
  }, [loadTeamReports]);

  const calculateDashboardStats = useCallback(() => {
    const pendingStatuses: ReportStatus[] = ['pending_supervisor', 'pending_finance', 'submitted', 'under_review'];
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
      console.error('Error loading supervisor data:', error);
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
          approverId: supervisorId,
          approverName: supervisorName,
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
      console.error('Error approving report:', error);
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
      const response = await fetch(`${API_BASE_URL}/api/expense-reports/${reportId}/approval`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reject',
          approverId: supervisorId,
          approverName: supervisorName,
          comments: reviewComment.trim(),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to reject report');
      }

      setReviewDialogOpen(false);
      setReviewComment('');
      await loadTeamReports();
    } catch (error) {
      console.error('Error rejecting report:', error);
      alert('Failed to reject report. Please try again.');
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
      console.error('Error loading delegates:', error);
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
          approverId: supervisorId,
          approverName: supervisorName,
          delegateId: selectedDelegateId,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to delegate report');
      }

      await loadTeamReports();
      handleCloseDelegateDialog();
    } catch (error) {
      console.error('Error delegating report:', error);
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
          approverId: supervisorId,
          approverName: supervisorName,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to send reminder');
      }

      await loadTeamReports();
    } catch (error) {
      console.error('Error sending reminder:', error);
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
          approverId: supervisorId,
          approverName: supervisorName,
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
      console.error('Error adding comment:', error);
      alert('Failed to add comment. Please try again.');
    } finally {
      setSavingAction(false);
    }
  };

  const handleViewEmployeeReport = (employee: Employee) => {
    setViewingEmployeeReport(employee);
    setShowEmployeeReportView(true);
  };

  const filteredReports = teamReports.filter((report) => {
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
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <FormControlLabel
              control={
                <Switch
                  checked={showDashboardWidgets}
                  onChange={(_, checked) => setShowDashboardWidgets(checked)}
                  color="primary"
                />
              }
              label="Show widgets"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={showSupervisorDashboard}
                  onChange={(_, checked) => setShowSupervisorDashboard(checked)}
                  color="primary"
                />
              }
              label="Show supervisor dashboard"
            />
          </Box>
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
      </Paper>

      <Box sx={{ px: 3 }}>
        {/* Dashboard Stats */}
        {showDashboardWidgets && (
          <Box sx={{ display: 'flex', gap: 3, mb: 4, flexWrap: 'wrap' }}>
            <Card sx={{ minWidth: 200, flex: 1 }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <PeopleIcon color="primary" sx={{ mr: 2 }} />
                  <Box>
                    <Typography variant="h4">{dashboardStats.totalTeamMembers}</Typography>
                    <Typography color="text.secondary">Team Members</Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
            <Card sx={{ minWidth: 200, flex: 1 }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <AssignmentIcon color="warning" sx={{ mr: 2 }} />
                  <Box sx={{ position: 'relative' }}>
                    <Typography variant="h4">{dashboardStats.activeReports}</Typography>
                    <Typography color="text.secondary">Active Reports</Typography>
                    <Badge 
                      badgeContent={dashboardStats.pendingReviews} 
                      color="error"
                      sx={{ position: 'absolute', top: -8, right: -8 }}
                    />
                  </Box>
                </Box>
              </CardContent>
            </Card>
            <Card sx={{ minWidth: 200, flex: 1 }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <AssessmentIcon color="success" sx={{ mr: 2 }} />
                  <Box>
                    <Typography variant="h4">${dashboardStats.monthlyTotal.toFixed(2)}</Typography>
                    <Typography color="text.secondary">Monthly Total</Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
            <Card sx={{ minWidth: 200, flex: 1 }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <CheckCircleIcon color="info" sx={{ mr: 2 }} />
                  <Box>
                    <Typography variant="h4">{dashboardStats.approvalRate}%</Typography>
                    <Typography color="text.secondary">Approval Rate</Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Box>
        )}

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
              {/* Dashboard Statistics */}
              {showDashboardWidgets && (
                <Box sx={{ mb: 3 }}>
                  <DashboardStatistics 
                    userId={supervisorId} 
                    userRole="supervisor"
                  />
                </Box>
              )}
              {showSupervisorDashboard && (
                <SupervisorDashboard currentEmployee={currentEmployee} showKpiCards={showDashboardWidgets} />
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
              {showDashboardWidgets && (
                <Box sx={{ mb: 3 }}>
                  <DashboardStatistics 
                    userId={supervisorId} 
                    userRole="supervisor"
                  />
                </Box>
              )}

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
                      const isDelegatedToSupervisor = currentStep?.delegatedToId === supervisorId;
                      const isAwaitingSupervisor = isSupervisorStage && (
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
                            <Tooltip title="View Report">
                              <IconButton
                                size="small"
                                onClick={() => {
                                  setSelectedReport(report);
                                  setReviewComment('');
                                  setReviewDialogOpen(true);
                                }}
                              >
                                <VisibilityIcon />
                              </IconButton>
                            </Tooltip>
                            {isAwaitingSupervisor && (
                              <>
                                <Tooltip title="Approve">
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
                                <Tooltip title="Request Changes">
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
                        <Box>
                          <Typography variant="body2" color="text.secondary">
                            {member.position} • {member.email}
                          </Typography>
                          <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                            {(member.costCenters || []).map((cc) => (
                              <Chip key={cc} label={cc} size="small" variant="outlined" />
                            ))}
                          </Box>
                        </Box>
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
                          secondary={`by ${comment.supervisorName} on ${new Date(comment.createdAt).toLocaleString()}`}
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

              <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
                Add Review Comment
              </Typography>
              <TextField
                fullWidth
                multiline
                rows={3}
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                placeholder="Add any feedback or notes about this report..."
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setReviewDialogOpen(false)}>Cancel</Button>
          <Button 
            onClick={() => selectedReport && handleRejectReport(selectedReport.id)}
            color="error"
            disabled={savingAction || !reviewComment.trim()}
          >
            Reject Report
          </Button>
          <Button 
            onClick={() => selectedReport && handleApproveReport(selectedReport.id)}
            color="success"
            variant="contained"
            disabled={savingAction}
          >
            Approve Report
          </Button>
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
                reportMonth={new Date().getMonth() + 1}
                reportYear={new Date().getFullYear()}
                supervisorMode={true}
                supervisorId={supervisorId}
                supervisorName={supervisorName}
              />
            </Box>
          )}
        </DialogContent>
      </Dialog>
    </Box>
  );
};

export default SupervisorPortal;
