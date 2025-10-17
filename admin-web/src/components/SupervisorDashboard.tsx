import React, { useState, useEffect } from 'react';
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
import { CheckCircle, Cancel, Edit, Visibility, Comment } from '@mui/icons-material';

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
}

export default function SupervisorDashboard({ currentEmployee }: SupervisorDashboardProps) {
  const [pendingReports, setPendingReports] = useState<MonthlyReport[]>([]);
  const [reviewedReports, setReviewedReports] = useState<MonthlyReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState<MonthlyReport | null>(null);
  const [showReviewDialog, setShowReviewDialog] = useState(false);
  const [reviewAction, setReviewAction] = useState<'approve' | 'reject' | 'revision' | null>(null);
  const [comments, setComments] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [activeTab, setActiveTab] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3002';

  useEffect(() => {
    loadReports();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentEmployee]);

  const loadReports = async () => {
    if (!currentEmployee) return;

    try {
      setLoading(true);
      setError(null);

      // Load pending reports for this supervisor
      const pendingResponse = await fetch(
        `${API_BASE_URL}/api/monthly-reports/supervisor/${currentEmployee.id}/pending`
      );

      if (!pendingResponse.ok) {
        throw new Error('Failed to fetch pending reports');
      }

      const pending = await pendingResponse.json();
      setPendingReports(pending);

      // Load all reports to filter for reviewed ones
      const allResponse = await fetch(`${API_BASE_URL}/api/monthly-reports`);
      
      if (!allResponse.ok) {
        throw new Error('Failed to fetch reports');
      }

      const all = await allResponse.json();
      
      // Filter for reports reviewed by this supervisor
      const reviewed = all.filter(
        (report: MonthlyReport) =>
          report.reviewedBy === currentEmployee.id &&
          (report.status === 'approved' || report.status === 'rejected')
      );
      
      setReviewedReports(reviewed);
    } catch (error: any) {
      console.error('Error loading reports:', error);
      setError(error.message || 'Failed to load reports');
    } finally {
      setLoading(false);
    }
  };

  const handleReview = (report: MonthlyReport, action: 'approve' | 'reject' | 'revision') => {
    setSelectedReport(report);
    setReviewAction(action);
    setComments('');
    setRejectionReason('');
    setShowReviewDialog(true);
  };

  const submitReview = async () => {
    if (!selectedReport || !reviewAction) return;

    // Validation
    if (reviewAction === 'reject' && !rejectionReason.trim()) {
      alert('Please provide a reason for rejection');
      return;
    }

    try {
      setSubmitting(true);

      const endpoint = {
        approve: `/api/monthly-reports/${selectedReport.id}/approve`,
        reject: `/api/monthly-reports/${selectedReport.id}/reject`,
        revision: `/api/monthly-reports/${selectedReport.id}/request-revision`,
      }[reviewAction];

      const body = {
        [reviewAction === 'approve' ? 'approvedBy' : reviewAction === 'reject' ? 'rejectedBy' : 'reviewedBy']:
          currentEmployee.id,
        ...(reviewAction === 'reject' && { rejectionReason }),
        ...(comments && { comments }),
      };

      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        throw new Error('Failed to submit review');
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
        reject: 'rejected',
        revision: 'returned for revision',
      }[reviewAction];

      alert(`Report ${actionText} successfully!`);
    } catch (error: any) {
      console.error('Error submitting review:', error);
      alert(`Failed to submit review: ${error.message}`);
    } finally {
      setSubmitting(false);
    }
  };

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
      case 'rejected':
        return 'error';
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
            label={`Reviewed (${reviewedReports.length})`}
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
              <Typography variant="body2" color="text.secondary">
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
                      onClick={() => {
                        // TODO: Open detailed report view
                        alert('View details - Coming soon');
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
                      startIcon={<Cancel />}
                      color="error"
                      onClick={() => handleReview(report, 'reject')}
                    >
                      Reject
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

      {/* Review Dialog */}
      <Dialog
        open={showReviewDialog}
        onClose={() => !submitting && setShowReviewDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {reviewAction === 'approve' && 'Approve Report'}
          {reviewAction === 'reject' && 'Reject Report'}
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

              {reviewAction === 'reject' && (
                <TextField
                  label="Reason for Rejection *"
                  fullWidth
                  multiline
                  rows={3}
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  sx={{ mb: 2 }}
                  required
                  helperText="Please explain why this report is being rejected"
                />
              )}

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
                    : reviewAction === 'reject'
                    ? 'Add any additional context or instructions'
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
            color={
              reviewAction === 'approve'
                ? 'success'
                : reviewAction === 'reject'
                ? 'error'
                : 'warning'
            }
            disabled={submitting || (reviewAction === 'reject' && !rejectionReason.trim()) || (reviewAction === 'revision' && !comments.trim())}
          >
            {submitting ? <CircularProgress size={20} /> : 'Confirm'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
