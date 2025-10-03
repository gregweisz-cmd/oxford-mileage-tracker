import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  CardActions,
  Button,
  Chip,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
  Alert,
  Avatar,
  Divider,
  Paper,
  IconButton,
  Tooltip,
  Badge
} from '@mui/material';
import {
  Person,
  Assignment,
  CheckCircle,
  Pending,
  Edit,
  Send,
  Visibility,
  Refresh,
  CalendarMonth,
  Group
} from '@mui/icons-material';
import { ReportApprovalService, ReportStatus } from '../services/reportApprovalService';

interface TeamMember {
  id: string;
  name: string;
  email: string;
  position: string;
  oxfordHouseId: string;
  phoneNumber?: string;
  baseAddress: string;
  costCenters: string[];
}

interface TeamMemberReportStatus {
  employeeId: string;
  employeeName: string;
  reportStatus: 'draft' | 'submitted' | 'approved' | 'rejected' | 'needs_revision' | 'not_started';
  submittedAt?: string;
  reviewedAt?: string;
  approvedAt?: string;
  supervisorComments?: string;
  lastModified?: string;
  hasData: boolean; // Whether there's any mileage/receipt/time data for this month
}

interface SupervisorTeamLandingProps {
  supervisorId: string;
  supervisorName: string;
}

export const SupervisorTeamLanding: React.FC<SupervisorTeamLandingProps> = ({
  supervisorId,
  supervisorName
}) => {
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [reportStatuses, setReportStatuses] = useState<TeamMemberReportStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const months = [
    { value: 1, label: 'January' },
    { value: 2, label: 'February' },
    { value: 3, label: 'March' },
    { value: 4, label: 'April' },
    { value: 5, label: 'May' },
    { value: 6, label: 'June' },
    { value: 7, label: 'July' },
    { value: 8, label: 'August' },
    { value: 9, label: 'September' },
    { value: 10, label: 'October' },
    { value: 11, label: 'November' },
    { value: 12, label: 'December' }
  ];

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

  useEffect(() => {
    loadTeamData();
  }, [selectedMonth, selectedYear]);

  const loadTeamData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load team members (for now, we'll get all employees - in a real app, this would be filtered by supervisor)
      const employeesResponse = await fetch('/api/employees');
      const employees = await employeesResponse.json();
      
      // Filter to get team members (in a real app, this would be based on supervisor relationship)
      const team = employees.filter((emp: any) => emp.id !== supervisorId); // Exclude supervisor
      setTeamMembers(team);

      // Load report statuses for the selected month/year
      const statuses: TeamMemberReportStatus[] = [];
      
      for (const member of team) {
        try {
          // Check if there's a report status for this employee and month/year
          const reportStatusesResponse = await fetch(`/api/reports/employee/${member.id}`);
          const employeeReports = await reportStatusesResponse.json();
          
          // Find report for the selected month/year
          const currentReport = employeeReports.find((report: any) => {
            // We'll need to match by month/year - this might need to be enhanced
            return true; // For now, get the most recent report
          });

          // Check if there's any data for this month (mileage, receipts, time tracking)
          const hasData = await checkEmployeeHasData(member.id, selectedMonth, selectedYear);

          let reportStatus: TeamMemberReportStatus['reportStatus'] = 'not_started';
          let submittedAt, reviewedAt, approvedAt, supervisorComments, lastModified;

          if (currentReport) {
            reportStatus = currentReport.status;
            submittedAt = currentReport.submittedAt;
            reviewedAt = currentReport.reviewedAt;
            approvedAt = currentReport.approvedAt;
            supervisorComments = currentReport.comments;
            lastModified = currentReport.updatedAt;
          } else if (hasData) {
            reportStatus = 'draft';
          }

          statuses.push({
            employeeId: member.id,
            employeeName: member.name,
            reportStatus,
            submittedAt,
            reviewedAt,
            approvedAt,
            supervisorComments,
            lastModified,
            hasData
          });

        } catch (err) {
          console.error(`Error loading data for employee ${member.id}:`, err);
          statuses.push({
            employeeId: member.id,
            employeeName: member.name,
            reportStatus: 'not_started',
            hasData: false
          });
        }
      }

      setReportStatuses(statuses);

    } catch (err) {
      console.error('Error loading team data:', err);
      setError('Failed to load team data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const checkEmployeeHasData = async (employeeId: string, month: number, year: number): Promise<boolean> => {
    try {
      // Check for mileage entries
      const mileageResponse = await fetch(`/api/mileage-entries?employeeId=${employeeId}&month=${month}&year=${year}`);
      const mileageEntries = await mileageResponse.json();
      
      // Check for receipts
      const receiptsResponse = await fetch(`/api/receipts?employeeId=${employeeId}&month=${month}&year=${year}`);
      const receipts = await receiptsResponse.json();
      
      // Check for time tracking
      const timeTrackingResponse = await fetch(`/api/time-tracking?employeeId=${employeeId}&month=${month}&year=${year}`);
      const timeTracking = await timeTrackingResponse.json();

      return mileageEntries.length > 0 || receipts.length > 0 || timeTracking.length > 0;
    } catch (err) {
      console.error('Error checking employee data:', err);
      return false;
    }
  };

  const handleViewReport = (employeeId: string, employeeName: string) => {
    // Navigate to the staff portal for this employee
    const url = `/staff-portal?employeeId=${employeeId}&month=${selectedMonth}&year=${selectedYear}&supervisorMode=true&supervisorId=${supervisorId}&supervisorName=${encodeURIComponent(supervisorName)}`;
    window.open(url, '_blank');
  };

  const handleSubmitForReview = async (employeeId: string, employeeName: string) => {
    try {
      const reportId = `report-${employeeId}-${selectedYear}-${selectedMonth.toString().padStart(2, '0')}`;
      
      await ReportApprovalService.submitReportForApproval(
        reportId,
        employeeId,
        supervisorId
      );

      // Refresh data
      await loadTeamData();

    } catch (err) {
      console.error('Error submitting report for review:', err);
      setError('Failed to submit report for review. Please try again.');
    }
  };

  const getStatusColor = (status: TeamMemberReportStatus['reportStatus']) => {
    switch (status) {
      case 'draft': return 'default';
      case 'submitted': return 'warning';
      case 'approved': return 'success';
      case 'rejected': return 'error';
      case 'needs_revision': return 'info';
      case 'not_started': return 'secondary';
      default: return 'default';
    }
  };

  const getStatusIcon = (status: TeamMemberReportStatus['reportStatus']) => {
    switch (status) {
      case 'draft': return <Edit />;
      case 'submitted': return <Send />;
      case 'approved': return <CheckCircle />;
      case 'rejected': return <Assignment />;
      case 'needs_revision': return <Edit />;
      case 'not_started': return <Assignment />;
      default: return <Assignment />;
    }
  };

  const getStatusText = (status: TeamMemberReportStatus['reportStatus']) => {
    switch (status) {
      case 'draft': return 'Draft';
      case 'submitted': return 'Submitted for Review';
      case 'approved': return 'Approved';
      case 'rejected': return 'Rejected';
      case 'needs_revision': return 'Needs Revision';
      case 'not_started': return 'Not Started';
      default: return 'Unknown';
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
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
        <Typography variant="h6" sx={{ ml: 2 }}>Loading team data...</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ width: '100%' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Group sx={{ fontSize: 32, color: 'primary.main' }} />
          <Box>
            <Typography variant="h4" component="h1">
              Team Reports
            </Typography>
            <Typography variant="subtitle1" color="text.secondary">
              {supervisorName} - Supervisor Dashboard
            </Typography>
          </Box>
        </Box>
        <Button
          variant="outlined"
          startIcon={<Refresh />}
          onClick={loadTeamData}
          disabled={loading}
        >
          Refresh
        </Button>
      </Box>

      {/* Month/Year Selection */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
          <CalendarMonth sx={{ color: 'primary.main' }} />
          <Typography variant="h6">Select Month & Year</Typography>
        </Box>
        
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <FormControl sx={{ minWidth: 150 }}>
            <InputLabel>Month</InputLabel>
            <Select
              value={selectedMonth}
              label="Month"
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
            >
              {months.map((month) => (
                <MenuItem key={month.value} value={month.value}>
                  {month.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl sx={{ minWidth: 120 }}>
            <InputLabel>Year</InputLabel>
            <Select
              value={selectedYear}
              label="Year"
              onChange={(e) => setSelectedYear(Number(e.target.value))}
            >
              {years.map((year) => (
                <MenuItem key={year} value={year}>
                  {year}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Typography variant="body1" color="text.secondary">
            {months.find(m => m.value === selectedMonth)?.label} {selectedYear}
          </Typography>
        </Box>
      </Paper>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Team Members Grid */}
      <Typography variant="h6" gutterBottom sx={{ mb: 2 }}>
        Team Members ({teamMembers.length})
      </Typography>

      {teamMembers.length === 0 ? (
        <Paper sx={{ p: 3, textAlign: 'center' }}>
          <Typography variant="body1" color="text.secondary">
            No team members found.
          </Typography>
        </Paper>
      ) : (
        <Grid container spacing={3}>
          {teamMembers.map((member) => {
            const reportStatus = reportStatuses.find(status => status.employeeId === member.id);
            
            return (
              <Box key={member.id} sx={{ minWidth: '300px' }}>
                <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                  <CardContent sx={{ flexGrow: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                      <Avatar sx={{ bgcolor: 'primary.main', mr: 2 }}>
                        <Person />
                      </Avatar>
                      <Box sx={{ flexGrow: 1 }}>
                        <Typography variant="h6" component="div">
                          {member.name}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {member.position}
                        </Typography>
                      </Box>
                    </Box>

                    <Divider sx={{ my: 2 }} />

                    {/* Report Status */}
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        Report Status
                      </Typography>
                      <Chip
                        icon={getStatusIcon(reportStatus?.reportStatus || 'not_started')}
                        label={getStatusText(reportStatus?.reportStatus || 'not_started')}
                        color={getStatusColor(reportStatus?.reportStatus || 'not_started') as any}
                        size="small"
                        sx={{ mb: 1 }}
                      />
                      
                      {reportStatus?.submittedAt && (
                        <Typography variant="caption" display="block" color="text.secondary">
                          Submitted: {formatDate(reportStatus.submittedAt)}
                        </Typography>
                      )}
                      
                      {reportStatus?.reviewedAt && (
                        <Typography variant="caption" display="block" color="text.secondary">
                          Reviewed: {formatDate(reportStatus.reviewedAt)}
                        </Typography>
                      )}

                      {reportStatus?.supervisorComments && (
                        <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 1 }}>
                          Comments: {reportStatus.supervisorComments}
                        </Typography>
                      )}
                    </Box>

                    {/* Data Status */}
                    <Box>
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        Data Status
                      </Typography>
                      <Chip
                        label={reportStatus?.hasData ? 'Has Data' : 'No Data'}
                        color={reportStatus?.hasData ? 'success' : 'default'}
                        size="small"
                        variant={reportStatus?.hasData ? 'filled' : 'outlined'}
                      />
                    </Box>
                  </CardContent>

                  <CardActions sx={{ p: 2, pt: 0 }}>
                    <Button
                      variant="contained"
                      startIcon={<Visibility />}
                      onClick={() => handleViewReport(member.id, member.name)}
                      fullWidth
                      sx={{ mb: 1 }}
                    >
                      View Report
                    </Button>
                    
                    {reportStatus?.reportStatus === 'draft' && reportStatus?.hasData && (
                      <Button
                        variant="outlined"
                        startIcon={<Send />}
                        onClick={() => handleSubmitForReview(member.id, member.name)}
                        fullWidth
                        color="warning"
                      >
                        Submit for Review
                      </Button>
                    )}
                  </CardActions>
                </Card>
              </Box>
            );
          })}
        </Grid>
      )}

      {/* Summary Stats */}
      <Paper sx={{ p: 3, mt: 3 }}>
        <Typography variant="h6" gutterBottom>
          Summary for {months.find(m => m.value === selectedMonth)?.label} {selectedYear}
        </Typography>
        
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 2 }}>
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="h4" color="primary">
              {reportStatuses.filter(s => s.reportStatus === 'submitted').length}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Submitted for Review
            </Typography>
          </Box>
          
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="h4" color="success.main">
              {reportStatuses.filter(s => s.reportStatus === 'approved').length}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Approved
            </Typography>
          </Box>
          
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="h4" color="info.main">
              {reportStatuses.filter(s => s.reportStatus === 'draft').length}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Draft
            </Typography>
          </Box>
          
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="h4" color="error.main">
              {reportStatuses.filter(s => s.reportStatus === 'rejected' || s.reportStatus === 'needs_revision').length}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Needs Attention
            </Typography>
          </Box>
        </Box>
      </Paper>
    </Box>
  );
};
