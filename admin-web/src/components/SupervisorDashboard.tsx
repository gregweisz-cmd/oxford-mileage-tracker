import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Card,
  CardContent,
  CardActions,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Alert,
  CircularProgress,
  Tabs,
  Tab,
  Divider,
} from '@mui/material';
import {
  CheckCircle,
  Edit,
  Visibility,
  Comment,
  People as PeopleIcon,
  AssignmentLate,
  TrendingUp,
  TrendingDown,
  TrendingFlat,
  AttachMoney,
  Speed,
} from '@mui/icons-material';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import StaffPortal from '../StaffPortal';
import { debugError, debugLog } from '../config/debug';

interface MonthlyReport {
  id: string;
  employeeId: string;
  employeeName?: string;
  employeeEmail?: string;
  month: number;
  year: number;
  totalMiles: number;
  totalExpenses: number;
  status: 'draft' | 'submitted' | 'approved' | 'rejected' | 'needs_revision';
  submittedAt?: string;
  submittedBy?: string;
  reviewedAt?: string;
  reviewedBy?: string;
  approvedAt?: string;
  approvedBy?: string;
  rejectedAt?: string;
  rejectedBy?: string;
  rejectionReason?: string;
  comments?: string;
  createdAt: string;
  updatedAt: string;
}

interface SupervisorDashboardProps {
  currentEmployee: any;
  showKpiCards?: boolean;
}

interface SupervisorKpiData {
  teamMembers: {
    total: number;
    active: number;
    archived: number;
  };
  reportStats: {
    pending: number;
    needsRevision: number;
    approvedTotal: number;
  };
  approvals: {
    thisMonth: { count: number; totalExpenses: number };
    lastMonth: { count: number; totalExpenses: number };
  };
  performance: {
    avgApprovalTimeHours: number | null;
    fastestApprovalHours: number | null;
    approvalRate: number | null;
    totalReviewed: number;
  };
  expenseTrend: {
    month: string;
    label: string;
    submitted: number;
    approved: number;
    totalExpenses: number;
  }[];
}

export default function SupervisorDashboard({ currentEmployee, showKpiCards = true }: SupervisorDashboardProps) {
  const [pendingReports, setPendingReports] = useState<MonthlyReport[]>([]);
  const [reviewedReports, setReviewedReports] = useState<MonthlyReport[]>([]);
  const [acceptedReports, setAcceptedReports] = useState<MonthlyReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState<MonthlyReport | null>(null);
  const [showReviewDialog, setShowReviewDialog] = useState(false);
  const [reviewAction, setReviewAction] = useState<'approve' | 'revision' | null>(null);
  const [comments, setComments] = useState('');
  const [activeTab, setActiveTab] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDetailedView, setShowDetailedView] = useState(false);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [viewingEmployeeReport, setViewingEmployeeReport] = useState<{id: string; name: string; email?: string} | null>(null);
  const [viewingReportMonth, setViewingReportMonth] = useState<number | null>(null);
  const [viewingReportYear, setViewingReportYear] = useState<number | null>(null);
  const [selectedItemsForRevision, setSelectedItemsForRevision] = useState<{ mileage: Set<string>, receipts: Set<string>, timeTracking: Set<string> } | null>(null);
  const [kpis, setKpis] = useState<SupervisorKpiData | null>(null);
  const [kpiLoading, setKpiLoading] = useState(true);
  const [kpiError, setKpiError] = useState<string | null>(null);
  const [hoursAlerts, setHoursAlerts] = useState<any[]>([]);

  const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3002';

  const handleCloseDetailedView = useCallback(() => {
    setShowDetailedView(false);
    setSelectedReportId(null);
    setViewingEmployeeReport(null);
    setViewingReportMonth(null);
    setViewingReportYear(null);
  }, []);

  // Memoized callback for selected items change to prevent infinite loops
  const handleSelectedItemsChange = useCallback((selectedItems: { mileage: Set<string>, receipts: Set<string>, timeTracking: Set<string> }) => {
    setSelectedItemsForRevision(selectedItems);
  }, []);

  const loadKpis = useCallback(async () => {
    if (!currentEmployee) {
      setKpis(null);
      return;
    }

    try {
      setKpiLoading(true);
      setKpiError(null);
      const { apiGet } = await import('../services/rateLimitedApi');
      const data = await apiGet(`/api/supervisors/${currentEmployee.id}/kpis`);
      setKpis(data);
    } catch (error: any) {
      debugError('Error loading supervisor KPIs:', error);
      setKpiError(error.message || 'Failed to load KPIs');
      setKpis(null);
    } finally {
      setKpiLoading(false);
    }
  }, [API_BASE_URL, currentEmployee]);

  const loadReports = useCallback(async () => {
    if (!currentEmployee) return;

    try {
      setLoading(true);
      setError(null);

      const { apiGet } = await import('../services/rateLimitedApi');
      
      // Load pending reports for this supervisor
      const pending = await apiGet<any[]>(
        `/api/monthly-reports/supervisor/${currentEmployee.id}/pending`
      );
      setPendingReports(pending);

      // Load all reports to filter for reviewed ones
      const all = await apiGet<any[]>(`/api/monthly-reports`);
      
      // Filter for reports reviewed by this supervisor (needs revision)
      const reviewed = all.filter(
        (report: MonthlyReport) =>
          report.reviewedBy === currentEmployee.id &&
          report.status === 'needs_revision'
      );
      
      setReviewedReports(reviewed);

      // Filter for reports approved by this supervisor
      const accepted = all.filter(
        (report: MonthlyReport) =>
          report.approvedBy === currentEmployee.id &&
          report.status === 'approved'
      );
      
      setAcceptedReports(accepted);
    } catch (error: any) {
      debugError('Error loading reports:', error);
      setError(error.message || 'Failed to load reports');
    } finally {
      setLoading(false);
    }
  }, [API_BASE_URL, currentEmployee]);

  useEffect(() => {
    loadReports();
    loadKpis();
  }, [loadReports, loadKpis]);

  const handleReview = (report: MonthlyReport, action: 'approve' | 'revision') => {
    setSelectedReport(report);
    setReviewAction(action);
    setComments('');
    setShowReviewDialog(true);
  };

  // Handlers for StaffPortal when viewing employee reports
  const handleApproveFromStaffPortal = useCallback(async () => {
    if (!viewingEmployeeReport || !viewingReportMonth || !viewingReportYear) {
      alert('Unable to approve: Report information not available');
      return;
    }

    // Find the report for this employee/month/year
    const report = pendingReports.find(
      r => r.employeeId === viewingEmployeeReport.id &&
           r.month === viewingReportMonth &&
           r.year === viewingReportYear
    ) || reviewedReports.find(
      r => r.employeeId === viewingEmployeeReport.id &&
           r.month === viewingReportMonth &&
           r.year === viewingReportYear
    );

    if (report) {
      handleReview(report, 'approve');
    } else {
      alert('Report not found in pending or reviewed reports');
    }
  }, [viewingEmployeeReport, viewingReportMonth, viewingReportYear, pendingReports, reviewedReports]);

  const handleRevisionFromStaffPortal = useCallback(async () => {
    if (!viewingEmployeeReport || !viewingReportMonth || !viewingReportYear) {
      alert('Unable to request revision: Report information not available');
      return;
    }

    // Find the report for this employee/month/year
    const report = pendingReports.find(
      r => r.employeeId === viewingEmployeeReport.id &&
           r.month === viewingReportMonth &&
           r.year === viewingReportYear
    ) || reviewedReports.find(
      r => r.employeeId === viewingEmployeeReport.id &&
           r.month === viewingReportMonth &&
           r.year === viewingReportYear
    );

    if (report) {
      handleReview(report, 'revision');
    } else {
      alert('Report not found in pending or reviewed reports');
    }
  }, [viewingEmployeeReport, viewingReportMonth, viewingReportYear, pendingReports, reviewedReports]);

  const submitReview = async () => {
    if (!selectedReport || !reviewAction) return;

    // Validation
    if (reviewAction === 'revision' && !comments.trim()) {
      alert('Please provide revision request details');
      return;
    }

    if (!currentEmployee?.id) {
      alert('Unable to submit: Supervisor information not available');
      return;
    }

    try {
      setSubmitting(true);

      // Use the correct approval endpoint
      const endpoint = `/api/expense-reports/${selectedReport.id}/approval`;
      
      const body = {
        action: reviewAction === 'approve' ? 'approve' : 'request_revision_to_employee',
        approverId: currentEmployee.id,
        approverName: currentEmployee.name || currentEmployee.preferredName || 'Supervisor',
        ...(comments && comments.trim() && { comments: comments.trim() }),
        ...(reviewAction === 'revision' && selectedItemsForRevision && {
          selectedItems: {
            mileage: Array.from(selectedItemsForRevision.mileage || []),
            receipts: Array.from(selectedItemsForRevision.receipts || []),
            timeTracking: Array.from(selectedItemsForRevision.timeTracking || [])
          }
        }),
      };

      // Debug: Log request details
      console.log('🔍 SupervisorDashboard: Submitting approval request:', {
        endpoint,
        body,
        reportId: selectedReport.id,
        currentEmployee: currentEmployee?.id
      });

      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        const errorMessage = errorData.error || `HTTP ${response.status}: ${response.statusText}`;
        throw new Error(errorMessage);
      }

      // Success!
      setShowReviewDialog(false);
      setSelectedReport(null);
      setReviewAction(null);
      
      // Reload reports
      await loadReports();

      // Show success message
      const actionText = {
        approve: 'approved',
        revision: 'returned for revision',
      }[reviewAction];

      alert(`Report ${actionText} successfully!`);
    } catch (error: any) {
      debugError('Error submitting review:', error);
      alert(`Failed to submit review: ${error.message}`);
    } finally {
      setSubmitting(false);
      await loadKpis();
    }
  };

  const formatCurrency = (amount: number) => new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(amount || 0);

  const formatDuration = (hours: number | null) => {
    if (hours === null || Number.isNaN(hours)) return 'N/A';
    if (hours < 1) {
      const minutes = Math.round(hours * 60);
      return `${minutes}m`;
    }
    if (hours < 72) {
      return `${Math.round(hours)}h`;
    }
    const days = hours / 24;
    return `${days.toFixed(1)}d`;
  };

  const computeChangePercent = (current: number, previous: number) => {
    if (previous === 0) {
      if (current === 0) return 0;
      return 100;
    }
    return ((current - previous) / previous) * 100;
  };

  const approvalChange = kpis
    ? computeChangePercent(kpis.approvals.thisMonth.count, kpis.approvals.lastMonth.count)
    : 0;

  const changeColor = approvalChange > 0
    ? 'success.main'
    : approvalChange < 0
      ? 'error.main'
      : 'text.secondary';

  const changeIcon = approvalChange > 0
    ? <TrendingUp fontSize="small" />
    : approvalChange < 0
      ? <TrendingDown fontSize="small" />
      : <TrendingFlat fontSize="small" />;

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatMonthYear = (month: number, year: number) => {
    return new Date(year, month - 1).toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric',
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'submitted':
        return 'primary';
      case 'approved':
        return 'success';
      case 'needs_revision':
        return 'warning';
      default:
        return 'default';
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight={400}>
        <CircularProgress />
        <Typography sx={{ mt: 2 }}>Loading reports...</Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Supervisor Dashboard
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Review and approve expense reports from your team
      </Typography>

      {kpiError && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setKpiError(null)}>
          {kpiError}
        </Alert>
      )}

      {/* 50+ Hours Alerts */}
      {hoursAlerts.length > 0 && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          <Typography variant="h6" gutterBottom>
            ⚠️ Employees Working 50+ Hours
          </Typography>
          {hoursAlerts.map((alert, index) => (
            <Box key={alert.id} sx={{ mt: index > 0 ? 2 : 0, p: 1, bgcolor: 'rgba(255, 152, 0, 0.1)', borderRadius: 1 }}>
              <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                {alert.employeeName || 'Employee'}
              </Typography>
              <Typography variant="body2">
                {alert.message}
              </Typography>
              {alert.metadata && (
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                  Week: {new Date(alert.metadata.weekStart).toLocaleDateString()} - {new Date(alert.metadata.weekEnd).toLocaleDateString()}
                </Typography>
              )}
            </Box>
          ))}
          <Typography variant="body2" sx={{ mt: 2, fontStyle: 'italic' }}>
            Please check in with these employees to ensure they are not overworking.
          </Typography>
        </Alert>
      )}

      {showKpiCards && (
        kpiLoading ? (
          <Box display="flex" justifyContent="center" py={3}>
            <CircularProgress size={24} />
          </Box>
        ) : kpis ? (
          <>
          <Box
            sx={{
              display: 'grid',
              gap: 2,
              gridTemplateColumns: {
                xs: 'repeat(1, minmax(0, 1fr))',
                sm: 'repeat(2, minmax(0, 1fr))',
                md: 'repeat(4, minmax(0, 1fr))',
              },
              mb: 3,
            }}
          >
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Team Members
                  </Typography>
                  <PeopleIcon color="primary" />
                </Box>
                <Typography variant="h4">{kpis.teamMembers.active}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {`${kpis.teamMembers.active} active / ${kpis.teamMembers.total} total`}
                </Typography>
                {kpis.teamMembers.archived > 0 && (
                  <Typography variant="caption" color="text.secondary">
                    {`${kpis.teamMembers.archived} archived`}
                  </Typography>
                )}
              </CardContent>
            </Card>

            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Pending Reviews
                  </Typography>
                  <AssignmentLate color="warning" />
                </Box>
                <Typography variant="h4">{kpis.reportStats.pending}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {`Needs revision: ${kpis.reportStats.needsRevision}`}
                </Typography>
              </CardContent>
            </Card>

            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Approvals This Month
                  </Typography>
                  <AttachMoney color="success" />
                </Box>
                <Typography variant="h4">{kpis.approvals.thisMonth.count}</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Box component="span" sx={{ color: changeColor, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    {changeIcon}
                    {`${approvalChange > 0 ? '+' : ''}${Math.round(approvalChange)}%`}
                  </Box>
                  vs last month
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {`Approved spend: ${formatCurrency(kpis.approvals.thisMonth.totalExpenses)}`}
                </Typography>
              </CardContent>
            </Card>

            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Avg Approval Time
                  </Typography>
                  <Speed color="info" />
                </Box>
                <Typography variant="h4">{formatDuration(kpis.performance.avgApprovalTimeHours)}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {`Fastest: ${formatDuration(kpis.performance.fastestApprovalHours)}`}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {`Approval rate: ${kpis.performance.approvalRate !== null
                    ? `${Math.round(kpis.performance.approvalRate * 100)}%`
                    : 'N/A'}`}
                </Typography>
              </CardContent>
            </Card>
          </Box>

          {kpis.expenseTrend.length > 0 && (
            <Paper sx={{ mb: 3, p: 2 }}>
              <Typography variant="subtitle1" gutterBottom>
                Team Expense Trend (Last 6 Months)
              </Typography>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={kpis.expenseTrend}>
                  <defs>
                    <linearGradient id="teamExpenseGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#1976d2" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#1976d2" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" vertical={false} />
                  <XAxis dataKey="label" stroke="#9e9e9e" />
                  <YAxis hide />
                  <RechartsTooltip
                    formatter={(value: number, name: string) => {
                      if (name === 'totalExpenses') {
                        return [formatCurrency(value), 'Approved Spend'];
                      }
                      return [value, name === 'approved' ? 'Approved' : 'Submitted'];
                    }}
                    labelFormatter={(label: string) => label}
                  />
                  <Area type="monotone" dataKey="totalExpenses" stroke="#1976d2" fill="url(#teamExpenseGradient)" name="totalExpenses" />
                </AreaChart>
              </ResponsiveContainer>
            </Paper>
          )}
        </>
        ) : null
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={activeTab} onChange={(e, newValue) => setActiveTab(newValue)}>
          <Tab 
            label={`Pending Review (${pendingReports.length})`}
            icon={<Comment />}
            iconPosition="start"
          />
          <Tab 
            label={`Needs Revision (${reviewedReports.length})`}
            icon={<Edit />}
            iconPosition="start"
          />
          <Tab 
            label={`Accepted (${acceptedReports.length})`}
            icon={<CheckCircle />}
            iconPosition="start"
          />
        </Tabs>
      </Box>

      {/* Pending Reports Tab */}
      {activeTab === 0 && (
        <Box>
          {pendingReports.length === 0 ? (
            <Paper sx={{ p: 4, textAlign: 'center' }}>
              <CheckCircle sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
              <Typography variant="h6" color="text.secondary">
                No Pending Reports
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                All reports have been reviewed!
              </Typography>
            </Paper>
          ) : (
            <Box>
              {pendingReports.map((report) => (
                <Card key={report.id} sx={{ mb: 2 }}>
                  <CardContent>
                    <Box display="flex" justifyContent="space-between" alignItems="start" mb={2}>
                      <Box>
                        <Typography variant="h6">
                          {report.employeeName || 'Unknown Employee'}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {report.employeeEmail}
                        </Typography>
                      </Box>
                      <Chip
                        label={report.status.toUpperCase()}
                        color={getStatusColor(report.status) as any}
                        size="small"
                      />
                    </Box>

                    <Divider sx={{ my: 2 }} />

                    <Box display="grid" gridTemplateColumns="1fr 1fr 1fr" gap={2}>
                      <Box>
                        <Typography variant="body2" color="text.secondary">
                          Period
                        </Typography>
                        <Typography variant="body1" fontWeight="bold">
                          {formatMonthYear(report.month, report.year)}
                        </Typography>
                      </Box>
                      <Box>
                        <Typography variant="body2" color="text.secondary">
                          Total Miles
                        </Typography>
                        <Typography variant="body1" fontWeight="bold">
                          {report.totalMiles.toFixed(1)} mi
                        </Typography>
                      </Box>
                      <Box>
                        <Typography variant="body2" color="text.secondary">
                          Total Expenses
                        </Typography>
                        <Typography variant="body1" fontWeight="bold">
                          ${report.totalExpenses.toFixed(2)}
                        </Typography>
                      </Box>
                    </Box>

                    <Box mt={2}>
                      <Typography variant="body2" color="text.secondary">
                        Submitted: {formatDate(report.submittedAt)}
                      </Typography>
                    </Box>
                  </CardContent>

                  <CardActions sx={{ justifyContent: 'flex-end', px: 2, pb: 2 }}>
                    <Button
                      startIcon={<Visibility />}
                      onClick={async () => {
                        try {
                          // Fetch employee details
                          const empResponse = await fetch(`${API_BASE_URL}/api/employees/${report.employeeId}`);
                          if (!empResponse.ok) throw new Error('Failed to load employee');
                          const employeeData = await empResponse.json();
                          
                          setViewingEmployeeReport({
                            id: employeeData.id,
                            name: employeeData.name || report.employeeName || 'Unknown',
                            email: employeeData.email || report.employeeEmail
                          });
                          setViewingReportMonth(report.month);
                          setViewingReportYear(report.year);
                          setShowDetailedView(true);
                        } catch (err) {
                          debugError('Error loading employee for report view:', err);
                          alert('Failed to load employee details');
                        }
                      }}
                    >
                      View Details
                    </Button>
                    <Button
                      startIcon={<Edit />}
                      color="warning"
                      onClick={() => handleReview(report, 'revision')}
                    >
                      Request Revision
                    </Button>
                    <Button
                      startIcon={<CheckCircle />}
                      variant="contained"
                      color="success"
                      onClick={() => handleReview(report, 'approve')}
                    >
                      Approve
                    </Button>
                  </CardActions>
                </Card>
              ))}
            </Box>
          )}
        </Box>
      )}

      {/* Reviewed Reports Tab */}
      {activeTab === 1 && (
        <Box>
          {reviewedReports.length === 0 ? (
            <Paper sx={{ p: 4, textAlign: 'center' }}>
              <Typography variant="h6" color="text.secondary">
                No Reviewed Reports Yet
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Reports you review will appear here
              </Typography>
            </Paper>
          ) : (
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Employee</TableCell>
                    <TableCell>Period</TableCell>
                    <TableCell align="right">Miles</TableCell>
                    <TableCell align="right">Expenses</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Reviewed Date</TableCell>
                    <TableCell>Comments</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {reviewedReports.map((report) => (
                    <TableRow key={report.id}>
                      <TableCell>
                        <Typography variant="body2" fontWeight="bold">
                          {report.employeeName}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {report.employeeEmail}
                        </Typography>
                      </TableCell>
                      <TableCell>{formatMonthYear(report.month, report.year)}</TableCell>
                      <TableCell align="right">{report.totalMiles.toFixed(1)}</TableCell>
                      <TableCell align="right">${report.totalExpenses.toFixed(2)}</TableCell>
                      <TableCell>
                        <Chip
                          label={report.status}
                          color={getStatusColor(report.status) as any}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>{formatDate(report.reviewedAt)}</TableCell>
                      <TableCell>
                        {report.comments || report.rejectionReason || '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Box>
      )}

      {/* Accepted Reports Tab */}
      {activeTab === 2 && (
        <Box>
          {acceptedReports.length === 0 ? (
            <Paper sx={{ p: 4, textAlign: 'center' }}>
              <Typography variant="h6" color="text.secondary">
                No Accepted Reports Yet
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Reports you approve will appear here
              </Typography>
            </Paper>
          ) : (
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Employee</TableCell>
                    <TableCell>Period</TableCell>
                    <TableCell align="right">Miles</TableCell>
                    <TableCell align="right">Expenses</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Approved Date</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {acceptedReports.map((report) => (
                    <TableRow key={report.id} hover>
                      <TableCell>
                        <Typography variant="body2" fontWeight="bold">
                          {report.employeeName}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {report.employeeEmail}
                        </Typography>
                      </TableCell>
                      <TableCell>{formatMonthYear(report.month, report.year)}</TableCell>
                      <TableCell align="right">{report.totalMiles.toFixed(1)}</TableCell>
                      <TableCell align="right">${report.totalExpenses.toFixed(2)}</TableCell>
                      <TableCell>
                        <Chip
                          label={report.status}
                          color={getStatusColor(report.status) as any}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>{formatDate(report.approvedAt)}</TableCell>
                      <TableCell>
                        <Button
                          size="small"
                          startIcon={<Visibility />}
                          onClick={async () => {
                            try {
                              // Fetch employee details
                              const empResponse = await fetch(`${API_BASE_URL}/api/employees/${report.employeeId}`);
                              if (!empResponse.ok) throw new Error('Failed to load employee');
                              const employeeData = await empResponse.json();
                              
                              setViewingEmployeeReport({
                                id: employeeData.id,
                                name: employeeData.name || report.employeeName || 'Unknown',
                                email: employeeData.email || report.employeeEmail
                              });
                              setViewingReportMonth(report.month);
                              setViewingReportYear(report.year);
                              setShowDetailedView(true);
                            } catch (err) {
                              debugError('Error loading employee for report view:', err);
                              alert('Failed to load employee details');
                            }
                          }}
                        >
                          View Details
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Box>
      )}

      {/* Review Dialog */}
      <Dialog
        open={showReviewDialog}
        onClose={() => !submitting && setShowReviewDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {reviewAction === 'approve' && 'Approve Report'}
          {reviewAction === 'revision' && 'Request Revision'}
        </DialogTitle>

        <DialogContent>
          {selectedReport && (
            <Box>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Employee: <strong>{selectedReport.employeeName}</strong>
              </Typography>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Period: <strong>{formatMonthYear(selectedReport.month, selectedReport.year)}</strong>
              </Typography>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Miles: <strong>{selectedReport.totalMiles.toFixed(1)}</strong>
              </Typography>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Expenses: <strong>${selectedReport.totalExpenses.toFixed(2)}</strong>
              </Typography>

              <Divider sx={{ my: 2 }} />

              <TextField
                label={reviewAction === 'revision' ? 'Revision Request *' : 'Comments (Optional)'}
                fullWidth
                multiline
                rows={4}
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                helperText={
                  reviewAction === 'approve'
                    ? 'Add any additional notes for the employee'
                    : 'Explain what needs to be corrected'
                }
                required={reviewAction === 'revision'}
              />
            </Box>
          )}
        </DialogContent>

        <DialogActions>
          <Button onClick={() => setShowReviewDialog(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button
            onClick={submitReview}
            variant="contained"
            color={reviewAction === 'approve' ? 'success' : 'warning'}
            disabled={submitting || (reviewAction === 'revision' && !comments.trim())}
          >
            {submitting ? <CircularProgress size={20} /> : 'Confirm'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Employee Report View Modal */}
      {showDetailedView && viewingEmployeeReport && viewingReportMonth && viewingReportYear && (
        <Dialog
          open={showDetailedView}
          onClose={handleCloseDetailedView}
          maxWidth="xl"
          fullWidth
          fullScreen
        >
          <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography variant="h5" component="div">
              {viewingEmployeeReport.name}'s Expense Report
            </Typography>
            <Button
              onClick={handleCloseDetailedView}
            >
              Close
            </Button>
          </DialogTitle>
          <DialogContent sx={{ p: 0 }}>
            <Box sx={{ p: 2 }}>
              <Alert severity="info" sx={{ mb: 2 }}>
                <Typography variant="body2">
                  <strong>Supervisor View:</strong> You are viewing {viewingEmployeeReport.name}'s expense report in supervisor mode.
                  Some features like direct editing may be limited.
                </Typography>
              </Alert>
              <StaffPortal
                employeeId={viewingEmployeeReport.id}
                reportMonth={viewingReportMonth}
                reportYear={viewingReportYear}
                supervisorMode={true}
                supervisorId={currentEmployee?.id}
                supervisorName={currentEmployee?.name || currentEmployee?.preferredName || 'Supervisor'}
                onSelectedItemsChange={handleSelectedItemsChange}
                onApproveReport={handleApproveFromStaffPortal}
                onRequestRevision={handleRevisionFromStaffPortal}
              />
            </Box>
          </DialogContent>
        </Dialog>
      )}
    </Box>
  );
}
