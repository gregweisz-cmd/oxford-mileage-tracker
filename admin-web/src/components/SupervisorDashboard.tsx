import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Tabs,
  Tab,
  Grid,
  Alert,
  CircularProgress,
  Divider,
  Paper,
  Badge,
  Tooltip
} from '@mui/material';
import {
  CheckCircle,
  Cancel,
  Edit,
  Message,
  Notifications,
  History,
  Send,
  Visibility,
  Refresh
} from '@mui/icons-material';
import { ReportApprovalService, ReportStatus, SupervisorNotification, StaffNotification } from '../services/reportApprovalService';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`supervisor-tabpanel-${index}`}
      aria-labelledby={`supervisor-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ p: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

interface SupervisorDashboardProps {
  supervisorId: string;
  supervisorName: string;
}

export const SupervisorDashboard: React.FC<SupervisorDashboardProps> = ({
  supervisorId,
  supervisorName
}) => {
  const [activeTab, setActiveTab] = useState(0);
  const [pendingReports, setPendingReports] = useState<ReportStatus[]>([]);
  const [reportHistory, setReportHistory] = useState<ReportStatus[]>([]);
  const [notifications, setNotifications] = useState<SupervisorNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Dialog states
  const [approvalDialog, setApprovalDialog] = useState<{
    open: boolean;
    report: ReportStatus | null;
    action: 'approve' | 'reject' | 'revision';
  }>({
    open: false,
    report: null,
    action: 'approve'
  });
  const [messageDialog, setMessageDialog] = useState<{
    open: boolean;
    employeeId: string;
    employeeName: string;
  }>({
    open: false,
    employeeId: '',
    employeeName: ''
  });
  const [comments, setComments] = useState('');
  const [messageText, setMessageText] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [pending, history, notifs] = await Promise.all([
        ReportApprovalService.getPendingReports(supervisorId),
        ReportApprovalService.getReportHistory(supervisorId),
        ReportApprovalService.getSupervisorNotifications(supervisorId)
      ]);

      setPendingReports(pending);
      setReportHistory(history);
      setNotifications(notifs);

    } catch (err) {
      console.error('Error loading supervisor data:', err);
      setError('Failed to load data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  const handleApprovalAction = (report: ReportStatus, action: 'approve' | 'reject' | 'revision') => {
    setApprovalDialog({
      open: true,
      report,
      action
    });
    setComments('');
  };

  const handleApprovalSubmit = async () => {
    if (!approvalDialog.report) return;

    try {
      const { report, action } = approvalDialog;
      
      if (action === 'approve') {
        await ReportApprovalService.approveReport(
          report.reportId,
          supervisorId,
          supervisorName,
          comments || undefined
        );
      } else if (action === 'reject') {
        await ReportApprovalService.rejectReport(
          report.reportId,
          supervisorId,
          supervisorName,
          comments
        );
      } else if (action === 'revision') {
        await ReportApprovalService.requestRevision(
          report.reportId,
          supervisorId,
          supervisorName,
          comments
        );
      }

      setApprovalDialog({ open: false, report: null, action: 'approve' });
      setComments('');
      await loadData(); // Refresh data

    } catch (err) {
      console.error('Error processing approval:', err);
      setError('Failed to process approval. Please try again.');
    }
  };

  const handleSendMessage = (employeeId: string, employeeName: string) => {
    setMessageDialog({
      open: true,
      employeeId,
      employeeName
    });
    setMessageText('');
  };

  const handleMessageSubmit = async () => {
    if (!messageText.trim()) return;

    try {
      await ReportApprovalService.sendMessageToStaff(
        messageDialog.employeeId,
        supervisorId,
        supervisorName,
        messageText
      );

      setMessageDialog({ open: false, employeeId: '', employeeName: '' });
      setMessageText('');
      await loadData(); // Refresh notifications

    } catch (err) {
      console.error('Error sending message:', err);
      setError('Failed to send message. Please try again.');
    }
  };

  const handleMarkNotificationAsRead = async (notificationId: string) => {
    try {
      await ReportApprovalService.markNotificationAsRead(notificationId, 'supervisor');
      await loadData(); // Refresh notifications
    } catch (err) {
      console.error('Error marking notification as read:', err);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'warning';
      case 'approved': return 'success';
      case 'rejected': return 'error';
      case 'needs_revision': return 'info';
      default: return 'default';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Notifications />;
      case 'approved': return <CheckCircle />;
      case 'rejected': return <Cancel />;
      case 'needs_revision': return <Edit />;
      default: return <Visibility />;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
        <Typography variant="h6" sx={{ ml: 2 }}>Loading supervisor dashboard...</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ width: '100%' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          Supervisor Dashboard
        </Typography>
        <Button
          variant="outlined"
          startIcon={<Refresh />}
          onClick={loadData}
          disabled={loading}
        >
          Refresh
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs value={activeTab} onChange={handleTabChange} aria-label="supervisor dashboard tabs">
          <Tab
            label={
              <Badge badgeContent={pendingReports.length} color="error">
                Pending Reports
              </Badge>
            }
            id="supervisor-tab-0"
            aria-controls="supervisor-tabpanel-0"
          />
          <Tab
            label={
              <Badge badgeContent={notifications.filter(n => !n.isRead).length} color="primary">
                Notifications
              </Badge>
            }
            id="supervisor-tab-1"
            aria-controls="supervisor-tabpanel-1"
          />
          <Tab
            label="Report History"
            id="supervisor-tab-2"
            aria-controls="supervisor-tabpanel-2"
          />
        </Tabs>
      </Box>

      <TabPanel value={activeTab} index={0}>
        <Typography variant="h6" gutterBottom>
          Pending Reports ({pendingReports.length})
        </Typography>
        
        {pendingReports.length === 0 ? (
          <Paper sx={{ p: 3, textAlign: 'center' }}>
            <Typography variant="body1" color="text.secondary">
              No pending reports at this time.
            </Typography>
          </Paper>
        ) : (
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 2 }}>
            {pendingReports.map((report) => (
              <Box key={report.id}>
                <Card>
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                      <Typography variant="h6" component="div">
                        Report #{report.reportId.slice(-8)}
                      </Typography>
                      <Chip
                        icon={getStatusIcon(report.status)}
                        label={report.status.toUpperCase()}
                        color={getStatusColor(report.status) as any}
                        size="small"
                      />
                    </Box>
                    
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      Employee: {report.employeeId}
                    </Typography>
                    
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      Submitted: {formatDate(report.submittedAt.toString())}
                    </Typography>

                    <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
                      <Button
                        variant="contained"
                        color="success"
                        size="small"
                        startIcon={<CheckCircle />}
                        onClick={() => handleApprovalAction(report, 'approve')}
                      >
                        Approve
                      </Button>
                      <Button
                        variant="contained"
                        color="error"
                        size="small"
                        startIcon={<Cancel />}
                        onClick={() => handleApprovalAction(report, 'reject')}
                      >
                        Reject
                      </Button>
                      <Button
                        variant="contained"
                        color="info"
                        size="small"
                        startIcon={<Edit />}
                        onClick={() => handleApprovalAction(report, 'revision')}
                      >
                        Request Revision
                      </Button>
                      <Button
                        variant="outlined"
                        size="small"
                        startIcon={<Message />}
                        onClick={() => handleSendMessage(report.employeeId, `Employee ${report.employeeId}`)}
                      >
                        Message
                      </Button>
                    </Box>
                  </CardContent>
                </Card>
              </Box>
            ))}
          </Box>
        )}
      </TabPanel>

      <TabPanel value={activeTab} index={1}>
        <Typography variant="h6" gutterBottom>
          Notifications ({notifications.length})
        </Typography>
        
        {notifications.length === 0 ? (
          <Paper sx={{ p: 3, textAlign: 'center' }}>
            <Typography variant="body1" color="text.secondary">
              No notifications at this time.
            </Typography>
          </Paper>
        ) : (
          <List>
            {notifications.map((notification) => (
              <ListItem
                key={notification.id}
                sx={{
                  backgroundColor: notification.isRead ? 'transparent' : 'action.hover',
                  borderRadius: 1,
                  mb: 1
                }}
              >
                <ListItemText
                  primary={notification.message}
                  secondary={`${formatDate(notification.createdAt.toString())} • ${notification.type}`}
                />
                <ListItemSecondaryAction>
                  {!notification.isRead && (
                    <Tooltip title="Mark as read">
                      <IconButton
                        edge="end"
                        onClick={() => handleMarkNotificationAsRead(notification.id)}
                      >
                        <Notifications />
                      </IconButton>
                    </Tooltip>
                  )}
                </ListItemSecondaryAction>
              </ListItem>
            ))}
          </List>
        )}
      </TabPanel>

      <TabPanel value={activeTab} index={2}>
        <Typography variant="h6" gutterBottom>
          Report History ({reportHistory.length})
        </Typography>
        
        {reportHistory.length === 0 ? (
          <Paper sx={{ p: 3, textAlign: 'center' }}>
            <Typography variant="body1" color="text.secondary">
              No report history available.
            </Typography>
          </Paper>
        ) : (
          <List>
            {reportHistory.map((report) => (
              <ListItem key={report.id} divider>
                <ListItemText
                  primary={`Report #${report.reportId.slice(-8)} - ${report.status.toUpperCase()}`}
                  secondary={
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        Employee: {report.employeeId}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Submitted: {formatDate(report.submittedAt.toString())}
                        {report.reviewedAt && ` • Reviewed: ${formatDate(report.reviewedAt.toString())}`}
                      </Typography>
                      {report.comments && (
                        <Typography variant="body2" color="text.secondary">
                          Comments: {report.comments}
                        </Typography>
                      )}
                    </Box>
                  }
                />
                <ListItemSecondaryAction>
                  <Chip
                    icon={getStatusIcon(report.status)}
                    label={report.status.toUpperCase()}
                    color={getStatusColor(report.status) as any}
                    size="small"
                  />
                </ListItemSecondaryAction>
              </ListItem>
            ))}
          </List>
        )}
      </TabPanel>

      {/* Approval Dialog */}
      <Dialog open={approvalDialog.open} onClose={() => setApprovalDialog({ open: false, report: null, action: 'approve' })} maxWidth="sm" fullWidth>
        <DialogTitle>
          {approvalDialog.action === 'approve' && 'Approve Report'}
          {approvalDialog.action === 'reject' && 'Reject Report'}
          {approvalDialog.action === 'revision' && 'Request Revision'}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body1" gutterBottom>
            {approvalDialog.action === 'approve' && 'Are you sure you want to approve this report?'}
            {approvalDialog.action === 'reject' && 'Please provide a reason for rejecting this report:'}
            {approvalDialog.action === 'revision' && 'Please provide feedback for the requested revision:'}
          </Typography>
          
          <TextField
            autoFocus
            margin="dense"
            label="Comments"
            fullWidth
            multiline
            rows={4}
            variant="outlined"
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            required={approvalDialog.action !== 'approve'}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setApprovalDialog({ open: false, report: null, action: 'approve' })}>
            Cancel
          </Button>
          <Button
            onClick={handleApprovalSubmit}
            variant="contained"
            color={approvalDialog.action === 'approve' ? 'success' : approvalDialog.action === 'reject' ? 'error' : 'info'}
            disabled={approvalDialog.action !== 'approve' && !comments.trim()}
          >
            {approvalDialog.action === 'approve' && 'Approve'}
            {approvalDialog.action === 'reject' && 'Reject'}
            {approvalDialog.action === 'revision' && 'Request Revision'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Message Dialog */}
      <Dialog open={messageDialog.open} onClose={() => setMessageDialog({ open: false, employeeId: '', employeeName: '' })} maxWidth="sm" fullWidth>
        <DialogTitle>Send Message to Staff</DialogTitle>
        <DialogContent>
          <Typography variant="body1" gutterBottom>
            Sending message to: {messageDialog.employeeName}
          </Typography>
          
          <TextField
            autoFocus
            margin="dense"
            label="Message"
            fullWidth
            multiline
            rows={4}
            variant="outlined"
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            required
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMessageDialog({ open: false, employeeId: '', employeeName: '' })}>
            Cancel
          </Button>
          <Button
            onClick={handleMessageSubmit}
            variant="contained"
            disabled={!messageText.trim()}
            startIcon={<Send />}
          >
            Send Message
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
