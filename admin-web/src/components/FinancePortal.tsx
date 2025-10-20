import React, { useState, useEffect } from 'react';
import {
  Container,
  Card,
  CardContent,
  Typography,
  Box,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Tabs,
  Tab,
  CircularProgress,
  Alert,
  Grid,
} from '@mui/material';
import {
  Print as PrintIcon,
  GetApp as DownloadIcon,
  Refresh as RefreshIcon,
  Edit as EditIcon,
  Visibility as ViewIcon,
  Send as SendIcon,
  FilterList as FilterIcon,
} from '@mui/icons-material';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3002';

interface FinancePortalProps {
  financeUserId: string;
  financeUserName: string;
}

interface ExpenseReport {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeEmail: string;
  month: number;
  year: number;
  status: 'draft' | 'submitted' | 'approved' | 'rejected' | 'needs_revision';
  totalMiles: number;
  totalMileageAmount: number;
  totalExpenses: number;
  submittedAt?: string;
  reportData?: any;
}

export const FinancePortal: React.FC<FinancePortalProps> = ({ financeUserId, financeUserName }) => {
  const [reports, setReports] = useState<ExpenseReport[]>([]);
  const [filteredReports, setFilteredReports] = useState<ExpenseReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(0);
  const [selectedReport, setSelectedReport] = useState<ExpenseReport | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [revisionDialogOpen, setRevisionDialogOpen] = useState(false);
  const [revisionComments, setRevisionComments] = useState('');
  const [printPreviewOpen, setPrintPreviewOpen] = useState(false);
  
  // Filter states
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterMonth, setFilterMonth] = useState<number>(new Date().getMonth() + 1);
  const [filterYear, setFilterYear] = useState<number>(new Date().getFullYear());
  const [filterEmployee, setFilterEmployee] = useState<string>('all');
  
  // Print style customization
  const [printStyles, setPrintStyles] = useState({
    fontSize: '12px',
    headerColor: '#1976d2',
    borderColor: '#cccccc',
    spacing: 'normal',
    showLogo: true,
    pageOrientation: 'portrait',
  });

  useEffect(() => {
    loadReports();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [reports, filterStatus, filterMonth, filterYear, filterEmployee]);

  const loadReports = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/expense-reports`);
      if (!response.ok) throw new Error('Failed to load reports');
      
      const data = await response.json();
      
      // Calculate totals from reportData
      const reportsWithTotals = data.map((report: any) => {
        const reportData = report.reportData || {};
        return {
          ...report,
          totalMiles: reportData.totalMiles || 0,
          totalMileageAmount: reportData.totalMileageAmount || 0,
          totalExpenses: calculateTotalExpenses(reportData),
        };
      });
      
      setReports(reportsWithTotals);
    } catch (error) {
      console.error('Error loading reports:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateTotalExpenses = (reportData: any) => {
    const {
      totalMileageAmount = 0,
      airRailBus = 0,
      vehicleRentalFuel = 0,
      parkingTolls = 0,
      groundTransportation = 0,
      hotelsAirbnb = 0,
      perDiem = 0,
      phoneInternetFax = 0,
      shippingPostage = 0,
      printingCopying = 0,
      officeSupplies = 0,
      eesReceipt = 0,
      meals = 0,
      other = 0,
    } = reportData;

    return totalMileageAmount + airRailBus + vehicleRentalFuel + parkingTolls +
           groundTransportation + hotelsAirbnb + perDiem + phoneInternetFax +
           shippingPostage + printingCopying + officeSupplies + eesReceipt + meals + other;
  };

  const applyFilters = () => {
    let filtered = [...reports];

    // Filter by status
    if (filterStatus !== 'all') {
      filtered = filtered.filter(r => r.status === filterStatus);
    }

    // Filter by month/year
    if (filterMonth && filterYear) {
      filtered = filtered.filter(r => r.month === filterMonth && r.year === filterYear);
    }

    // Filter by employee
    if (filterEmployee !== 'all') {
      filtered = filtered.filter(r => r.employeeId === filterEmployee);
    }

    setFilteredReports(filtered);
  };

  const handleViewReport = (report: ExpenseReport) => {
    setSelectedReport(report);
    setViewDialogOpen(true);
  };

  const handleRequestRevision = async () => {
    if (!selectedReport) return;

    try {
      const response = await fetch(`${API_BASE_URL}/api/expense-reports/${selectedReport.id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'needs_revision',
          comments: revisionComments,
          reviewedBy: financeUserName,
        }),
      });

      if (!response.ok) throw new Error('Failed to request revision');

      alert('Revision request sent to employee successfully!');
      setRevisionDialogOpen(false);
      setRevisionComments('');
      loadReports();
    } catch (error) {
      console.error('Error requesting revision:', error);
      alert('Failed to request revision');
    }
  };

  const handleExportToExcel = async (report: ExpenseReport) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/export/expense-report/${report.id}`, {
        method: 'GET',
      });

      if (!response.ok) throw new Error('Export failed');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `ExpenseReport_${report.employeeName}_${report.month}-${report.year}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      alert('Failed to export report');
    }
  };

  const handlePrintPreview = (report: ExpenseReport) => {
    setSelectedReport(report);
    setPrintPreviewOpen(true);
  };

  const handlePrint = () => {
    window.print();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'default';
      case 'submitted': return 'info';
      case 'approved': return 'success';
      case 'rejected': return 'error';
      case 'needs_revision': return 'warning';
      default: return 'default';
    }
  };

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  // Get unique employees for filter
  const uniqueEmployees = Array.from(new Set(reports.map(r => r.employeeId)))
    .map(id => {
      const report = reports.find(r => r.employeeId === id);
      return { id, name: report?.employeeName || id };
    });

  const TabPanel = ({ children, value, index }: any) => (
    <div role="tabpanel" hidden={value !== index}>
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" gutterBottom>
          💰 Finance Portal
        </Typography>
        <Typography variant="subtitle1" color="textSecondary">
          Welcome, {financeUserName}
        </Typography>
      </Box>

      {/* Tabs */}
      <Tabs value={activeTab} onChange={(e, val) => setActiveTab(val)} sx={{ mb: 3 }}>
        <Tab label="All Reports" />
        <Tab label="Pending Review" />
        <Tab label="Approved Reports" />
        <Tab label="Needs Revision" />
      </Tabs>

      {/* Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} sm={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Status</InputLabel>
                <Select
                  value={filterStatus}
                  label="Status"
                  onChange={(e) => setFilterStatus(e.target.value)}
                >
                  <MenuItem value="all">All Statuses</MenuItem>
                  <MenuItem value="draft">Draft</MenuItem>
                  <MenuItem value="submitted">Submitted</MenuItem>
                  <MenuItem value="approved">Approved</MenuItem>
                  <MenuItem value="needs_revision">Needs Revision</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Month</InputLabel>
                <Select
                  value={filterMonth}
                  label="Month"
                  onChange={(e) => setFilterMonth(Number(e.target.value))}
                >
                  {monthNames.map((month, idx) => (
                    <MenuItem key={idx} value={idx + 1}>{month}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={2}>
              <TextField
                fullWidth
                size="small"
                label="Year"
                type="number"
                value={filterYear}
                onChange={(e) => setFilterYear(Number(e.target.value))}
              />
            </Grid>
            <Grid item xs={12} sm={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Employee</InputLabel>
                <Select
                  value={filterEmployee}
                  label="Employee"
                  onChange={(e) => setFilterEmployee(e.target.value)}
                >
                  <MenuItem value="all">All Employees</MenuItem>
                  {uniqueEmployees.map(emp => (
                    <MenuItem key={emp.id} value={emp.id}>{emp.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={1}>
              <Button
                variant="outlined"
                startIcon={<RefreshIcon />}
                onClick={loadReports}
                fullWidth
              >
                Refresh
              </Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Reports Table */}
      <TabPanel value={activeTab} index={0}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress />
          </Box>
        ) : filteredReports.length === 0 ? (
          <Alert severity="info">No reports found matching the filters.</Alert>
        ) : (
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow sx={{ bgcolor: 'grey.100' }}>
                  <TableCell><strong>Employee</strong></TableCell>
                  <TableCell><strong>Period</strong></TableCell>
                  <TableCell align="right"><strong>Miles</strong></TableCell>
                  <TableCell align="right"><strong>Mileage ($)</strong></TableCell>
                  <TableCell align="right"><strong>Total Expenses ($)</strong></TableCell>
                  <TableCell><strong>Status</strong></TableCell>
                  <TableCell><strong>Submitted</strong></TableCell>
                  <TableCell align="center"><strong>Actions</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredReports.map((report) => (
                  <TableRow key={report.id} hover>
                    <TableCell>{report.employeeName}</TableCell>
                    <TableCell>{monthNames[report.month - 1]} {report.year}</TableCell>
                    <TableCell align="right">{report.totalMiles.toFixed(1)}</TableCell>
                    <TableCell align="right">${report.totalMileageAmount.toFixed(2)}</TableCell>
                    <TableCell align="right">${report.totalExpenses.toFixed(2)}</TableCell>
                    <TableCell>
                      <Chip
                        label={report.status.replace('_', ' ').toUpperCase()}
                        color={getStatusColor(report.status) as any}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      {report.submittedAt ? new Date(report.submittedAt).toLocaleDateString() : '-'}
                    </TableCell>
                    <TableCell align="center">
                      <IconButton
                        size="small"
                        color="primary"
                        onClick={() => handleViewReport(report)}
                        title="View Report"
                      >
                        <ViewIcon />
                      </IconButton>
                      <IconButton
                        size="small"
                        color="secondary"
                        onClick={() => handlePrintPreview(report)}
                        title="Print Preview"
                      >
                        <PrintIcon />
                      </IconButton>
                      <IconButton
                        size="small"
                        color="success"
                        onClick={() => handleExportToExcel(report)}
                        title="Export to Excel"
                      >
                        <DownloadIcon />
                      </IconButton>
                      {report.status === 'submitted' && (
                        <IconButton
                          size="small"
                          color="warning"
                          onClick={() => {
                            setSelectedReport(report);
                            setRevisionDialogOpen(true);
                          }}
                          title="Request Revision"
                        >
                          <SendIcon />
                        </IconButton>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </TabPanel>

      {/* Pending Review Tab */}
      <TabPanel value={activeTab} index={1}>
        {filteredReports.filter(r => r.status === 'submitted').length === 0 ? (
          <Alert severity="info">No reports pending review.</Alert>
        ) : (
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow sx={{ bgcolor: 'grey.100' }}>
                  <TableCell><strong>Employee</strong></TableCell>
                  <TableCell><strong>Period</strong></TableCell>
                  <TableCell align="right"><strong>Total Expenses ($)</strong></TableCell>
                  <TableCell><strong>Submitted</strong></TableCell>
                  <TableCell align="center"><strong>Actions</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredReports.filter(r => r.status === 'submitted').map((report) => (
                  <TableRow key={report.id} hover>
                    <TableCell>{report.employeeName}</TableCell>
                    <TableCell>{monthNames[report.month - 1]} {report.year}</TableCell>
                    <TableCell align="right">${report.totalExpenses.toFixed(2)}</TableCell>
                    <TableCell>
                      {report.submittedAt ? new Date(report.submittedAt).toLocaleDateString() : '-'}
                    </TableCell>
                    <TableCell align="center">
                      <IconButton
                        size="small"
                        color="primary"
                        onClick={() => handleViewReport(report)}
                      >
                        <ViewIcon />
                      </IconButton>
                      <IconButton
                        size="small"
                        color="warning"
                        onClick={() => {
                          setSelectedReport(report);
                          setRevisionDialogOpen(true);
                        }}
                      >
                        <SendIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </TabPanel>

      {/* Approved Reports Tab */}
      <TabPanel value={activeTab} index={2}>
        {filteredReports.filter(r => r.status === 'approved').length === 0 ? (
          <Alert severity="info">No approved reports.</Alert>
        ) : (
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow sx={{ bgcolor: 'grey.100' }}>
                  <TableCell><strong>Employee</strong></TableCell>
                  <TableCell><strong>Period</strong></TableCell>
                  <TableCell align="right"><strong>Total Expenses ($)</strong></TableCell>
                  <TableCell align="center"><strong>Actions</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredReports.filter(r => r.status === 'approved').map((report) => (
                  <TableRow key={report.id} hover>
                    <TableCell>{report.employeeName}</TableCell>
                    <TableCell>{monthNames[report.month - 1]} {report.year}</TableCell>
                    <TableCell align="right">${report.totalExpenses.toFixed(2)}</TableCell>
                    <TableCell align="center">
                      <IconButton
                        size="small"
                        color="primary"
                        onClick={() => handleViewReport(report)}
                      >
                        <ViewIcon />
                      </IconButton>
                      <IconButton
                        size="small"
                        color="secondary"
                        onClick={() => handlePrintPreview(report)}
                      >
                        <PrintIcon />
                      </IconButton>
                      <IconButton
                        size="small"
                        color="success"
                        onClick={() => handleExportToExcel(report)}
                      >
                        <DownloadIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </TabPanel>

      {/* Needs Revision Tab */}
      <TabPanel value={activeTab} index={3}>
        {filteredReports.filter(r => r.status === 'needs_revision').length === 0 ? (
          <Alert severity="info">No reports needing revision.</Alert>
        ) : (
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow sx={{ bgcolor: 'grey.100' }}>
                  <TableCell><strong>Employee</strong></TableCell>
                  <TableCell><strong>Period</strong></TableCell>
                  <TableCell align="right"><strong>Total Expenses ($)</strong></TableCell>
                  <TableCell align="center"><strong>Actions</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredReports.filter(r => r.status === 'needs_revision').map((report) => (
                  <TableRow key={report.id} hover>
                    <TableCell>{report.employeeName}</TableCell>
                    <TableCell>{monthNames[report.month - 1]} {report.year}</TableCell>
                    <TableCell align="right">${report.totalExpenses.toFixed(2)}</TableCell>
                    <TableCell align="center">
                      <IconButton
                        size="small"
                        color="primary"
                        onClick={() => handleViewReport(report)}
                      >
                        <ViewIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </TabPanel>

      {/* View Report Dialog */}
      <Dialog
        open={viewDialogOpen}
        onClose={() => setViewDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {selectedReport?.employeeName} - {selectedReport && monthNames[selectedReport.month - 1]} {selectedReport?.year}
        </DialogTitle>
        <DialogContent>
          {selectedReport && (
            <Box>
              <Typography variant="h6" gutterBottom>Report Summary</Typography>
              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={6}>
                  <Typography><strong>Status:</strong></Typography>
                  <Chip
                    label={selectedReport.status.replace('_', ' ').toUpperCase()}
                    color={getStatusColor(selectedReport.status) as any}
                    size="small"
                    sx={{ mt: 1 }}
                  />
                </Grid>
                <Grid item xs={6}>
                  <Typography><strong>Submitted:</strong></Typography>
                  <Typography>
                    {selectedReport.submittedAt ? new Date(selectedReport.submittedAt).toLocaleDateString() : 'Not submitted'}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography><strong>Total Miles:</strong></Typography>
                  <Typography>{selectedReport.totalMiles.toFixed(1)} miles</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography><strong>Mileage Amount:</strong></Typography>
                  <Typography>${selectedReport.totalMileageAmount.toFixed(2)}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography><strong>Total Expenses:</strong></Typography>
                  <Typography variant="h6" color="primary">
                    ${selectedReport.totalExpenses.toFixed(2)}
                  </Typography>
                </Grid>
              </Grid>

              {selectedReport.reportData?.dailyEntries && (
                <Box>
                  <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>Daily Breakdown</Typography>
                  <Typography variant="body2" color="textSecondary">
                    {selectedReport.reportData.dailyEntries.filter((e: any) => e.milesTraveled > 0 || e.hoursWorked > 0).length} days with activity
                  </Typography>
                </Box>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setViewDialogOpen(false)}>Close</Button>
          <Button
            variant="contained"
            startIcon={<PrintIcon />}
            onClick={() => {
              setViewDialogOpen(false);
              handlePrintPreview(selectedReport!);
            }}
          >
            Print Preview
          </Button>
          <Button
            variant="contained"
            color="success"
            startIcon={<DownloadIcon />}
            onClick={() => handleExportToExcel(selectedReport!)}
          >
            Export
          </Button>
        </DialogActions>
      </Dialog>

      {/* Request Revision Dialog */}
      <Dialog
        open={revisionDialogOpen}
        onClose={() => setRevisionDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Request Revision</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
            Request revisions from {selectedReport?.employeeName} for {selectedReport && monthNames[selectedReport.month - 1]} {selectedReport?.year}
          </Typography>
          <TextField
            fullWidth
            multiline
            rows={4}
            label="Comments / Issues to Address"
            value={revisionComments}
            onChange={(e) => setRevisionComments(e.target.value)}
            placeholder="Please specify what needs to be corrected..."
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRevisionDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            color="warning"
            onClick={handleRequestRevision}
            disabled={!revisionComments.trim()}
          >
            Send Revision Request
          </Button>
        </DialogActions>
      </Dialog>

      {/* Print Preview Dialog */}
      <Dialog
        open={printPreviewOpen}
        onClose={() => setPrintPreviewOpen(false)}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>
          Print Preview - {selectedReport?.employeeName}
          <IconButton
            onClick={() => setPrintPreviewOpen(false)}
            sx={{ position: 'absolute', right: 8, top: 8 }}
          >
            ×
          </IconButton>
        </DialogTitle>
        <DialogContent>
          {/* Print Style Customization */}
          <Card sx={{ mb: 3, bgcolor: 'grey.50' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>🎨 Print Style Customization</Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={4}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Font Size</InputLabel>
                    <Select
                      value={printStyles.fontSize}
                      label="Font Size"
                      onChange={(e) => setPrintStyles({ ...printStyles, fontSize: e.target.value })}
                    >
                      <MenuItem value="10px">Small (10px)</MenuItem>
                      <MenuItem value="12px">Normal (12px)</MenuItem>
                      <MenuItem value="14px">Large (14px)</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={4}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Spacing</InputLabel>
                    <Select
                      value={printStyles.spacing}
                      label="Spacing"
                      onChange={(e) => setPrintStyles({ ...printStyles, spacing: e.target.value })}
                    >
                      <MenuItem value="compact">Compact</MenuItem>
                      <MenuItem value="normal">Normal</MenuItem>
                      <MenuItem value="relaxed">Relaxed</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={4}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Orientation</InputLabel>
                    <Select
                      value={printStyles.pageOrientation}
                      label="Orientation"
                      onChange={(e) => setPrintStyles({ ...printStyles, pageOrientation: e.target.value })}
                    >
                      <MenuItem value="portrait">Portrait</MenuItem>
                      <MenuItem value="landscape">Landscape</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
              </Grid>
            </CardContent>
          </Card>

          {/* Print Preview Content */}
          <Paper
            id="printable-report"
            sx={{
              p: 4,
              fontSize: printStyles.fontSize,
              '@media print': {
                boxShadow: 'none',
                padding: 0,
              },
            }}
            style={{
              pageBreakAfter: 'always',
              orientation: printStyles.pageOrientation === 'landscape' ? 'landscape' : 'portrait',
            }}
          >
            {/* Report Header */}
            <Box sx={{ textAlign: 'center', mb: 4, borderBottom: `2px solid ${printStyles.headerColor}`, pb: 2 }}>
              {printStyles.showLogo && (
                <Typography variant="h5" sx={{ color: printStyles.headerColor, fontWeight: 'bold' }}>
                  Oxford House
                </Typography>
              )}
              <Typography variant="h6">Expense Report</Typography>
              <Typography variant="body2" color="textSecondary">
                {selectedReport?.employeeName} - {selectedReport && monthNames[selectedReport.month - 1]} {selectedReport?.year}
              </Typography>
            </Box>

            {/* Summary Section */}
            <Box sx={{ mb: 3 }}>
              <Typography variant="h6" gutterBottom>Summary</Typography>
              <Table size="small" sx={{ border: `1px solid ${printStyles.borderColor}` }}>
                <TableBody>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 'bold', width: '50%' }}>Total Miles</TableCell>
                    <TableCell>{selectedReport?.totalMiles.toFixed(1)}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 'bold' }}>Mileage Reimbursement</TableCell>
                    <TableCell>${selectedReport?.totalMileageAmount.toFixed(2)}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 'bold' }}>Total Expenses</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', fontSize: '1.1em' }}>
                      ${selectedReport?.totalExpenses.toFixed(2)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </Box>

            {/* Daily Entries */}
            {selectedReport?.reportData?.dailyEntries && (
              <Box>
                <Typography variant="h6" gutterBottom>Daily Activity</Typography>
                <Table size="small" sx={{ border: `1px solid ${printStyles.borderColor}` }}>
                  <TableHead>
                    <TableRow sx={{ bgcolor: 'grey.100' }}>
                      <TableCell>Date</TableCell>
                      <TableCell>Description</TableCell>
                      <TableCell align="right">Miles</TableCell>
                      <TableCell align="right">Hours</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {selectedReport.reportData.dailyEntries
                      .filter((entry: any) => entry.milesTraveled > 0 || entry.hoursWorked > 0)
                      .map((entry: any, idx: number) => (
                        <TableRow key={idx}>
                          <TableCell>{entry.date}</TableCell>
                          <TableCell sx={{ whiteSpace: 'pre-wrap' }}>{entry.description}</TableCell>
                          <TableCell align="right">{entry.milesTraveled > 0 ? entry.milesTraveled.toFixed(1) : '-'}</TableCell>
                          <TableCell align="right">{entry.hoursWorked > 0 ? entry.hoursWorked : '-'}</TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </Box>
            )}
          </Paper>
        </DialogContent>
        <DialogActions sx={{ '@media print': { display: 'none' } }}>
          <Button onClick={() => setPrintPreviewOpen(false)}>Close</Button>
          <Button
            variant="contained"
            startIcon={<PrintIcon />}
            onClick={handlePrint}
          >
            Print
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default FinancePortal;

