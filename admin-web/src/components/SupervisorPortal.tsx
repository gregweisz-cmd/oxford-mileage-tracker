import React, { useState, useEffect, useCallback } from 'react';
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
  // Divider, // Currently unused
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
  // Switch, // Currently unused
  // FormControlLabel, // Currently unused
  Tabs,
  Tab,
  Badge,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  ListItemSecondaryAction,
  Tooltip,
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

interface SupervisorPortalProps {
  supervisorId: string;
  supervisorName: string;
}

interface Employee {
  id: string;
  name: string;
  email: string;
  position: string;
  costCenters: string[];
  isActive: boolean;
  joinDate: string;
  lastActivity?: string;
}

interface TeamReport {
  id: string;
  employeeId: string;
  employeeName: string;
  month: number;
  year: number;
  status: 'draft' | 'submitted' | 'under_review' | 'approved' | 'rejected';
  submittedAt?: string;
  totalAmount: number;
  totalMiles: number;
  totalHours: number;
  costCenters: string[];
  comments?: SupervisorComment[];
  rejectionReason?: string;
  reviewedBy?: string;
  reviewedAt?: string;
}

interface SupervisorComment {
  id: string;
  supervisorId: string;
  supervisorName: string;
  reportId: string;
  comment: string;
  createdAt: string;
  isResolved: boolean;
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

  // Employee report viewing
  const [viewingEmployeeReport, setViewingEmployeeReport] = useState<Employee | null>(null);
  const [showEmployeeReportView, setShowEmployeeReportView] = useState(false);

  // Loading states
  const [loading, setLoading] = useState(true);
  const [savingAction, setSavingAction] = useState(false);

  const loadSupervisorData = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadTeamMembers(),
        loadTeamReports(),
        calculateDashboardStats(),
      ]);
    } catch (error) {
      console.error('Error loading supervisor data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSupervisorData();
  }, [supervisorId, loadSupervisorData]);


  const loadTeamMembers = async () => {
    try {
      // Load team members from localStorage or API
      const storedMembers = localStorage.getItem(`supervisor_team_${supervisorId}`);
      if (storedMembers) {
        setTeamMembers(JSON.parse(storedMembers));
      } else {
        // Mock data for demonstration
        const mockMembers: Employee[] = [
          {
            id: 'emp001',
            name: 'Sarah Johnson',
            email: 'sarah.j@oxfordhouse.org',
            position: 'Field Staff',
            costCenters: ['NC-SUBG', 'NC-SOR'],
            isActive: true,
            joinDate: '2024-01-15',
            lastActivity: '2024-10-03T14:30:00Z',
          },
          {
            id: 'emp002',
            name: 'Mike Rodriguez',
            email: 'mike.r@oxfordhouse.org',
            position: 'Senior Field Staff',
            costCenters: ['NC-SUBG'],
            isActive: true,
            joinDate: '2023-08-22',
            lastActivity: '2024-10-02T09:15:00Z',
          },
          {
            id: 'emp003',
            name: 'Emma Davis',
            email: 'emma.d@oxfordhouse.org',
            position: 'Field Staff',
            costCenters: ['NC-SUBG'],
            isActive: false,
            joinDate: '2024-03-10',
            lastActivity: '2024-09-28T16:45:00Z',
          },
        ];
        setTeamMembers(mockMembers);
        localStorage.setItem(`supervisor_team_${supervisorId}`, JSON.stringify(mockMembers));
      }
    } catch (error) {
      console.error('Error loading team members:', error);
    }
  };

  const loadTeamReports = useCallback(async () => {
    try {
      // Load reports from localStorage or API
      const storedReports = localStorage.getItem(`supervisor_reports_${supervisorId}`);
      if (storedReports) {
        setTeamReports(JSON.parse(storedReports));
      } else {
        // Mock data for demonstration
        const mockReports: TeamReport[] = [
          {
            id: 'report001',
            employeeId: 'emp001',
            employeeName: 'Sarah Johnson',
            month: 9,
            year: 2024,
            status: 'submitted',
            submittedAt: '2024-10-01T10:30:00Z',
            totalAmount: 1256.75,
            totalMiles: 412.5,
            totalHours: 168.5,
            costCenters: ['NC-SUBG', 'NC-SOR'],
          },
          {
            id: 'report002',
            employeeId: 'emp002',
            employeeName: 'Mike Rodriguez',
            month: 9,
            year: 2024,
            status: 'under_review',
            submittedAt: '2024-10-02T15:20:00Z',
            totalAmount: 892.30,
            totalMiles: 295.8,
            totalHours: 140.0,
            costCenters: ['NC-SUBG'],
          },
          {
            id: 'report003',
            employeeId: 'emp001',
            employeeName: 'Sarah Johnson',
            month: 10,
            year: 2024,
            status: 'draft',
            totalAmount: 0,
            totalMiles: 0,
            totalHours: 0,
            costCenters: ['NC-SUBG', 'NC-SOR'],
          },
        ];
        setTeamReports(mockReports);
        localStorage.setItem(`supervisor_reports_${supervisorId}`, JSON.stringify(mockReports));
      }
    } catch (error) {
      console.error('Error loading team reports:', error);
    }
  }, [supervisorId]);

  useEffect(() => {
    const interval = setInterval(() => {
      loadTeamReports();
    }, 30000); // Auto-refresh every 30 seconds

    return () => clearInterval(interval);
  }, [loadTeamReports]);

  const calculateDashboardStats = async () => {
    const activeMembers = teamMembers.filter(m => m.isActive);
    const submittedReports = teamReports.filter(r => r.status === 'submitted');
    const pendingReports = teamReports.filter(r => ['submitted', 'under_review'].includes(r.status));
    const totalMonthlyAmount = teamReports
      .filter(r => r.status === 'approved' && r.month === new Date().getMonth() + 1)
      .reduce((sum, r) => sum + r.totalAmount, 0);
    const approvalRate = teamReports.length > 0 
      ? (teamReports.filter(r => r.status === 'approved').length / teamReports.length) * 100 
      : 0;

    setDashboardStats({
      totalTeamMembers: activeMembers.length,
      activeReports: submittedReports.length,
      pendingReviews: pendingReports.length,
      monthlyTotal: totalMonthlyAmount,
      approvalRate: Math.round(approvalRate),
      averageResponseTime: '2.5h',
    });
  };

  const handleApproveReport = async (reportId: string) => {
    setSavingAction(true);
    try {
      const updatedReports = teamReports.map(report =>
        report.id === reportId
          ? {
              ...report,
              status: 'approved' as const,
              reviewedBy: supervisorName,
              reviewedAt: new Date().toISOString(),
            }
          : report
      );
      setTeamReports(updatedReports);
      localStorage.setItem(`supervisor_reports_${supervisorId}`, JSON.stringify(updatedReports));
      setReviewDialogOpen(false);
      await calculateDashboardStats();
    } catch (error) {
      console.error('Error approving report:', error);
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
      const updatedReports = teamReports.map(report =>
        report.id === reportId
          ? {
              ...report,
              status: 'rejected' as const,
              rejectionReason: reviewComment,
              reviewedBy: supervisorName,
              reviewedAt: new Date().toISOString(),
            }
          : report
      );
      setTeamReports(updatedReports);
      localStorage.setItem(`supervisor_reports_${supervisorId}`, JSON.stringify(updatedReports));
      setReviewDialogOpen(false);
      setReviewComment('');
      await calculateDashboardStats();
    } catch (error) {
      console.error('Error rejecting report:', error);
    } finally {
      setSavingAction(false);
    }
  };

  const handleAddComment = async (reportId: string) => {
    if (!reviewComment.trim()) return;

    setSavingAction(true);
    try {
      const newComment: SupervisorComment = {
        id: `comment_${Date.now()}`,
        supervisorId,
        supervisorName,
        reportId,
        comment: reviewComment,
        createdAt: new Date().toISOString(),
        isResolved: false,
      };

      const updatedReports = teamReports.map(report =>
        report.id === reportId
          ? {
              ...report,
              comments: [...(report.comments || []), newComment],
            }
          : report
      );
      setTeamReports(updatedReports);
      localStorage.setItem(`supervisor_reports_${supervisorId}`, JSON.stringify(updatedReports));
      setCommentDialogOpen(false);
      setReviewComment('');
    } catch (error) {
      console.error('Error adding comment:', error);
    } finally {
      setSavingAction(false);
    }
  };

  const handleViewEmployeeReport = (employee: Employee) => {
    setViewingEmployeeReport(employee);
    setShowEmployeeReportView(true);
  };

  const filteredReports = teamReports.filter(report => {
    const matchesSearch = report.employeeName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || report.status === statusFilter;
    const currentMonth = new Date().getMonth() + 1;
    const matchesMonth = monthFilter === 'current' 
      ? report.month === currentMonth 
      : true;

    return matchesSearch && matchesStatus && matchesMonth;
  });

  const getStatusColor = (status: TeamReport['status']) => {
    switch (status) {
      case 'draft': return 'default';
      case 'submitted': return 'warning';
      case 'under_review': return 'info';
      case 'approved': return 'success';
      case 'rejected': return 'error';
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
      default: return <AssignmentIcon />;
    }
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
          <Box sx={{ display: 'flex', gap: 2 }}>
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

        {/* Main Content */}
        <Paper sx={{ mb: 3 }}>
          <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <Tabs value={activeTab} onChange={(e, newValue) => setActiveTab(newValue)}>
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

          {/* Reports Tab */}
          {activeTab === 0 && (
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
                    <MenuItem value="submitted">Submitted</MenuItem>
                    <MenuItem value="under_review">Under Review</MenuItem>
                    <MenuItem value="approved">Approved</MenuItem>
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
                    {filteredReports.map((report) => (
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
                          <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
                            <Tooltip title="View Report">
                              <IconButton
                                size="small"
                                onClick={() => {
                                  setSelectedReport(report);
                                  setReviewDialogOpen(true);
                                }}
                              >
                                <VisibilityIcon />
                              </IconButton>
                            </Tooltip>
                            {report.status === 'submitted' && (
                              <>
                                <Tooltip title="Approve">
                                  <IconButton
                                    size="small"
                                    color="success"
                                    onClick={() => {
                                      setSelectedReport(report);
                                      if (window.confirm(`Approve ${report.employeeName}'s report for ${new Date(report.year, report.month - 1).toLocaleString('default', { month: 'long' })} ${report.year}?`)) {
                                        handleApproveReport(report.id);
                                      }
                                    }}
                                  >
                                    <CheckIcon />
                                  </IconButton>
                                </Tooltip>
                                <Tooltip title="Reject">
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
                              </>
                            )}
                            <Tooltip title="Add Comment">
                              <IconButton
                                size="small"
                                onClick={() => {
                                  setSelectedReport(report);
                                  setCommentDialogOpen(true);
                                }}
                              >
                                <CommentIcon />
                              </IconButton>
                            </Tooltip>
                          </Box>
                        </TableCell>
                      </TableRow>
                    ))}
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
          {activeTab === 1 && (
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
                            {member.costCenters.map((cc) => (
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
          {activeTab === 2 && (
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
        onClose={() => setReviewDialogOpen(false)}
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
