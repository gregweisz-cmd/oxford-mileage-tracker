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
  Alert,
  CircularProgress,
  Divider,
  Paper,
  Badge,
  Tooltip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Autocomplete,
  FormControl,
  InputLabel,
  Select,
  MenuItem
} from '@mui/material';
import {
  CheckCircle,
  Edit,
  Delete,
  Add,
  Download,
  Print,
  CloudSync,
  Receipt,
  DirectionsCar,
  Schedule,
  AccountBalance,
  Assessment,
  FileUpload,
  Refresh
} from '@mui/icons-material';
import { DataSyncService, Employee, MileageEntry, Receipt as ReceiptType, TimeTracking } from '../services/dataSyncService';
import { SimpleReportService } from '../services/simpleReportService';
import { AdvancedTemplateService } from '../services/advancedTemplateService';

interface EmployeePortalProps {
  employee: any;
  onBack?: () => void;
}

interface EmployeePortalData {
  employees: Employee[];
  mileageEntries: MileageEntry[];
  receipts: ReceiptType[];
  timeTracking: TimeTracking[];
}

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
      id={`simple-tabpanel-${index}`}
      aria-labelledby={`simple-tab-${index}`}
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

function a11yProps(index: number) {
  return {
    id: `simple-tab-${index}`,
    'aria-controls': `simple-tabpanel-${index}`,
  };
}

const COST_CENTERS = [
  'CC001 - Program Service',
  'CC002 - Administration',
  'CC003 - Fundraising',
  'CC004 - Management & General',
  'AL-SOR',
  'G&A',
  'Fundraising'
];

export default function EmployeePortal({ employee, onBack }: EmployeePortalProps) {
  const [activeTab, setActiveTab] = useState(0);
  const [data, setData] = useState<EmployeePortalData>({
    employees: [],
    mileageEntries: [],
    receipts: [],
    timeTracking: []
  });
  
  const [reportFilters, setReportFilters] = useState({
    startDate: '',
    endDate: '',
    costCenter: ''
  });
  
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [reportLoadingMessage, setReportLoadingMessage] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [excelDialogOpen, setExcelDialogOpen] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().substring(0, 7));

  // Load employee data
  const loadData = async () => {
    try {
      const [employeesData, mileageData, receiptsData, timeTrackingData] = await Promise.all([
        DataSyncService.getEmployees(),
        DataSyncService.getMileageEntries(),
        DataSyncService.getReceipts(),
        DataSyncService.getTimeTracking()
      ]);

      // Filter data for current employee
      const employeeId = employee?.id;
      const filteredMileage = mileageData.filter((entry: any) => entry.employeeId === employeeId);
      const filteredReceipts = receiptsData.filter((receipt: any) => receipt.employeeId === employeeId);
      const filteredTimeTracking = timeTrackingData.filter((entry: any) => entry.employeeId === employeeId);

      setData({
        employees: employeesData,
        mileageEntries: filteredMileage,
        receipts: filteredReceipts,
        timeTracking: filteredTimeTracking
      });
    } catch (error) {
      console.error('Error loading employee data:', error);
    }
  };

  useEffect(() => {
    loadData();
  }, [employee]);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  // Report Generation Functions
  const generateSimpleReport = async () => {
    setIsGeneratingReport(true);
    setReportLoadingMessage('Generating report...');
    
    try {
      const currentDate = new Date();
      const reportData = {
        employeeId: employee.id,
        employeeName: employee.name,
        employeePosition: employee.position || 'Employee',
        employeeCostCenter: employee.costCenters?.[0] || 'Default',
        month: currentDate.getMonth() + 1,
        year: currentDate.getFullYear(),
        totalMiles: data.mileageEntries.reduce((sum: number, entry: any) => sum + (entry.miles || 0), 0),
        totalReceipts: data.receipts.reduce((sum: number, receipt: any) => sum + (receipt.amount || 0), 0),
        totalHours: data.timeTracking.reduce((sum: number, entry: any) => sum + (entry.hours || 0), 0),
        mileageEntries: data.mileageEntries.filter((entry: any) => {
          if (!reportFilters.startDate) return true;
          const entryDate = new Date(entry.date);
          const start = new Date(reportFilters.startDate);
          return entryDate >= start;
        }),
        receipts: data.receipts.filter((receipt: any) => {
          if (!reportFilters.startDate) return true;
          const receiptDate = new Date(receipt.date);
          const start = new Date(reportFilters.startDate);
          return receiptDate >= start;
        })
      };

      setReportLoadingMessage('Creating Excel file...');
      const buffer = await SimpleReportService.generateEmployeeReport(reportData);
      const blob = new Blob([buffer], { 
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
      });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = `Monthly_Report_${employee.name}_${selectedMonth}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
    } catch (error) {
      console.error('Error generating report:', error);
      alert('Error generating report. Please try again.');
    } finally {
      setIsGeneratingReport(false);
      setReportLoadingMessage('');
    }
  };

  const handleTemplateUpload = async () => {
    if (!selectedTemplate) return;
    
    setIsGeneratingReport(true);
    setReportLoadingMessage('Generating Report...');
    
    try {
      const currentDate = new Date();
      const reportData = {
        employeeId: employee.id,
        employeeName: employee.name,
        employeePosition: employee.position || 'Employee',
        employeeCostCenter: employee.costCenters?.[0] || 'Default',
        month: currentDate.getMonth() + 1,
        year: currentDate.getFullYear(),
        totalMiles: data.mileageEntries.reduce((sum: number, entry: any) => sum + (entry.miles || 0), 0),
        totalReceipts: data.receipts.reduce((sum: number, receipt: any) => sum + (receipt.amount || 0), 0),
        totalHours: data.timeTracking.reduce((sum: number, entry: any) => sum + (entry.hours || 0), 0),
        mileageEntries: data.mileageEntries.filter((entry: any) => {
          if (!reportFilters.startDate) return true;
          const entryDate = new Date(entry.date);
          const start = new Date(reportFilters.startDate);
          return entryDate >= start;
        }),
        receipts: data.receipts.filter((receipt: any) => {
          if (!reportFilters.startDate) return true;
          const receiptDate = new Date(receipt.date);
          const start = new Date(reportFilters.startDate);
          return receiptDate >= start;
        }),
        dailyOdometerReadings: [], // TODO: Implement when available
        timeTracking: data.timeTracking.filter((entry: any) => {
          if (!reportFilters.startDate) return true;
          const entryDate = new Date(entry.date);
          const start = new Date(reportFilters.startDate);
          return entryDate >= start;
        })
      };

      const buffer = await AdvancedTemplateService.generateEmployeeReport(reportData);
      const blob = new Blob([buffer], { 
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
      });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = `Advanced_Report_${employee.name}_${selectedMonth}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
    } catch (error) {
      console.error('Error generating advanced report:', error);
      alert('Failed to generate advanced report: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setIsGeneratingReport(false);
      setReportLoadingMessage('');
      setUploadDialogOpen(false);
    }
  };

  // Calculate total expenses
  const calculateTotalExpenses = () => {
    const totalMileage = data.mileageEntries.reduce((sum: number, entry: any) => sum + (entry.miles || 0) * 0.655, 0);
    const totalReceipts = data.receipts.reduce((sum: number, receipt: any) => sum + (receipt.amount || 0), 0);
    const totalTimeTracking = data.timeTracking.reduce((sum: number, entry: any) => sum + (entry.hours || 0), 0);
    
    return {
      totalMileage: totalMileage,
      totalReceipts: totalReceipts,
      totalTimeTracking: totalTimeTracking,
      grandTotal: totalMileage + totalReceipts
    };
  };

  const totals = calculateTotalExpenses();

  return (
    <Box sx={{ width: '100%', bgcolor: 'background.default' }}>
      {/* Header */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', bgcolor: '#1976d221', p: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box>
            <Typography variant="h4" component="h1" gutterBottom>
              Employee Portal - {employee?.name}
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Manage your expense reports and mileage entries
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              variant="contained"
              color="primary"
              startIcon={<Refresh />}
              onClick={loadData}
            >
              Refresh Data
            </Button>
            {onBack && (
              <Button
                variant="outlined"
                onClick={onBack}
              >
                Back to Dashboard
              </Button>
            )}
          </Box>
        </Box>
      </Box>

      {/* Navigation Tabs */}
      <Box>
        <Tabs value={activeTab} onChange={handleTabChange} aria-label="employee portal tabs">
          <Tab icon={<Assessment />} label="Dashboard" {...a11yProps(0)} />
          <Tab icon={<DirectionsCar />} label="Mileage" {...a11yProps(1)} />
          <Tab icon={<Receipt />} label="Receipts" {...a11yProps(2)} />
          <Tab icon={<Schedule />} label="Time Tracking" {...a11yProps(3)} />
          <Tab icon={<Download />} label="Reports" {...a11yProps(4)} />
          <Tab icon={<AccountBalance />} label="Monthly Summary" {...a11yProps(5)} />
        </Tabs>
      </Box>

      {/* Dashboard Tab */}
      <TabPanel value={activeTab} index={0}>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <Card sx={{ flex: '1 1 200px', minWidth: '200px' }}>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Total Miles This Month
              </Typography>
              <Typography variant="h4">
                {data.mileageEntries.reduce((sum: number, entry: any) => sum + (entry.miles || 0), 0).toFixed(1)}
              </Typography>
            </CardContent>
          </Card>
          <Card sx={{ flex: '1 1 200px', minWidth: '200px' }}>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Total Receipts
              </Typography>
              <Typography variant="h4">
                ${totals.totalReceipts.toFixed(2)}
              </Typography>
            </CardContent>
          </Card>
          <Card sx={{ flex: '1 1 200px', minWidth: '200px' }}>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Total Hours
              </Typography>
              <Typography variant="h4">
                {totals.totalTimeTracking.toFixed(1)}
              </Typography>
            </CardContent>
          </Card>
          <Card sx={{ flex: '1 1 200px', minWidth: '200px' }}>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Total Expenses
              </Typography>
              <Typography variant="h4">
                ${totals.grandTotal.toFixed(2)}
              </Typography>
            </CardContent>
          </Card>
        </Box>
      </TabPanel>

      {/* Mileage Tab */}
      <TabPanel value={activeTab} index={1}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6">Mileage Entries</Typography>
          <Button variant="contained" startIcon={<Add />}>
            Add Mileage Entry
          </Button>
        </Box>
        
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Date</TableCell>
                <TableCell>Start Location</TableCell>
                <TableCell>End Location</TableCell>
                <TableCell>Miles</TableCell>
                <TableCell>Purpose</TableCell>
                <TableCell>Hours</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data.mileageEntries.map((entry: any) => (
                <TableRow key={entry.id}>
                  <TableCell>{new Date(entry.date).toLocaleDateString()}</TableCell>
                  <TableCell>{entry.startLocation}</TableCell>
                  <TableCell>{entry.endLocation}</TableCell>
                  <TableCell>{entry.miles}</TableCell>
                  <TableCell>{entry.purpose}</TableCell>
                  <TableCell>{entry.hoursWorked || 0}</TableCell>
                  <TableCell>
                    <IconButton size="small" onClick={() => console.log('Edit entry:', entry.id)}>
                      <Edit />
                    </IconButton>
                    <IconButton size="small" onClick={() => console.log('Delete entry:', entry.id)}>
                      <Delete />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </TabPanel>

      {/* Receipts Tab */}
      <TabPanel value={activeTab} index={2}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6">Receipts</Typography>
          <Button variant="contained" startIcon={<Add />}>
            Add Receipt
          </Button>
        </Box>
        
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Date</TableCell>
                <TableCell>Vendor</TableCell>
                <TableCell>Amount</TableCell>
                <TableCell>Category</TableCell>
                <TableCell>Purpose</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data.receipts.map((receipt: any) => (
                <TableRow key={receipt.id}>
                  <TableCell>{new Date(receipt.date).toLocaleDateString()}</TableCell>
                  <TableCell>{receipt.vendor}</TableCell>
                  <TableCell>${receipt.amount}</TableCell>
                  <TableCell>{receipt.category}</TableCell>
                  <TableCell>{receipt.purpose}</TableCell>
                  <TableCell>
                    <IconButton size="small" onClick={() => console.log('Edit receipt:', receipt.id)}>
                      <Edit />
                    </IconButton>
                    <IconButton size="small" onClick={() => console.log('Delete receipt:', receipt.id)}>
                      <Delete />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </TabPanel>

      {/* Time Tracking Tab */}
      <TabPanel value={activeTab} index={3}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6">Time Tracking</Typography>
          <Button variant="contained" startIcon={<Add />}>
            Add Time Entry
          </Button>
        </Box>
        
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Date</TableCell>
                <TableCell>Category</TableCell>
                <TableCell>Hours</TableCell>
                <TableCell>Description</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data.timeTracking.map((entry: any) => (
                <TableRow key={entry.id}>
                  <TableCell>{new Date(entry.date).toLocaleDateString()}</TableCell>
                  <TableCell>{entry.category}</TableCell>
                  <TableCell>{entry.hours}</TableCell>
                  <TableCell>{entry.description}</TableCell>
                  <TableCell>
                    <IconButton size="small" onClick={() => console.log('Edit time entry:', entry.id)}>
                      <Edit />
                    </IconButton>
                    <IconButton size="small" onClick={() => console.log('Delete time entry:', entry.id)}>
                      <Delete />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </TabPanel>

      {/* Reports Tab */}
      <TabPanel value={activeTab} index={4}>
        <Typography variant="h6" gutterBottom>
          Generate Reports
        </Typography>
        
        {/* Report Filters */}
        <Paper sx={{ p: 2, mb: 3 }}>
          <Typography variant="subtitle1" gutterBottom>
            Report Filters
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <Box sx={{ flex: '1 1 200px', minWidth: '200px' }}>
              <TextField
                label="Start Date"
                type="date"
                fullWidth
                value={reportFilters.startDate}
                onChange={(e) => setReportFilters(prev => ({ ...prev, startDate: e.target.value }))}
                InputLabelProps={{ shrink: true }}
              />
            </Box>
            <Box sx={{ flex: '1 1 200px', minWidth: '200px' }}>
              <TextField
                label="End Date"
                type="date"
                fullWidth
                value={reportFilters.endDate}
                onChange={(e) => setReportFilters(prev => ({ ...prev, endDate: e.target.value }))}
                InputLabelProps={{ shrink: true }}
              />
            </Box>
            <Box sx={{ flex: '1 1 200px', minWidth: '200px' }}>
              <FormControl fullWidth>
                <InputLabel>Cost Center</InputLabel>
                <Select
                  value={reportFilters.costCenter}
                  label="Cost Center"
                  onChange={(e) => setReportFilters(prev => ({ ...prev, costCenter: e.target.value }))}
                >
                  <MenuItem value="">All Cost Centers</MenuItem>
                  {COST_CENTERS.map((cc) => (
                    <MenuItem key={cc} value={cc}>{cc}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>
          </Box>
        </Paper>

        {/* Report Generation Options */}
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <Card sx={{ flex: '1 1 300px', minWidth: '300px' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Simple Report
              </Typography>
              <Typography variant="body2" color="text.secondary" paragraph>
                Generate a basic Excel report with your expense data
              </Typography>
              <Button
                variant="contained"
                startIcon={<Download />}
                onClick={generateSimpleReport}
                disabled={isGeneratingReport}
                fullWidth
              >
                {isGeneratingReport ? reportLoadingMessage : 'Generate Simple Report'}
              </Button>
            </CardContent>
          </Card>
          
          <Card sx={{ flex: '1 1 300px', minWidth: '300px' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Advanced Template
              </Typography>
              <Typography variant="body2" color="text.secondary" paragraph>
                Upload a custom template for formatted reports
              </Typography>
              <Button
                variant="outlined"
                startIcon={<FileUpload />}
                onClick={() => setUploadDialogOpen(true)}
                disabled={isGeneratingReport}
                fullWidth
              >
                Upload Advanced Template
              </Button>
            </CardContent>
          </Card>
        </Box>
      </TabPanel>

      {/* Monthly Summary Tab */}
      <TabPanel value={activeTab} index={5}>
        <Typography variant="h6" gutterBottom>
          Monthly Expense Summary
        </Typography>
        
        <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
          <Card sx={{ flex: '1 1 300px', minWidth: '300px' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Expense Breakdown
              </Typography>
              <Box sx={{ mb: 2 }}>
                <Typography variant="body1">
                  Mileage Reimbursement (${(0.655).toFixed(3)}/mile): 
                  <Typography component="span" sx={{ fontWeight: 'bold', ml: 1 }}>
                    ${totals.totalMileage.toFixed(2)}
                  </Typography>
                </Typography>
              </Box>
              <Box sx={{ mb: 2 }}>
                <Typography variant="body1">
                  Receipt Expenses: 
                  <Typography component="span" sx={{ fontWeight: 'bold', ml: 1 }}>
                    ${totals.totalReceipts.toFixed(2)}
                  </Typography>
                </Typography>
              </Box>
              <Divider sx={{ my: 2 }} />
              <Typography variant="h6">
                Total Monthly Expenses: ${totals.grandTotal.toFixed(2)}
              </Typography>
            </CardContent>
          </Card>
          
          <Card sx={{ flex: '1 1 300px', minWidth: '300px' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Summary Statistics
              </Typography>
              <Typography variant="body1" paragraph>
                Total Miles Driven: {data.mileageEntries.reduce((sum: number, entry: any) => sum + (entry.miles || 0), 0)}
              </Typography>
              <Typography variant="body1" paragraph>
                Total Hours Worked: {totals.totalTimeTracking}
              </Typography>
              <Typography variant="body1" paragraph>
                Number of Trips: {data.mileageEntries.length}
              </Typography>
              <Typography variant="body1">
                Receipt Entries: {data.receipts.length}
              </Typography>
            </CardContent>
          </Card>
        </Box>
      </TabPanel>


      {/* Advanced Template Upload Dialog */}
      <Dialog open={uploadDialogOpen} onClose={() => setUploadDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Upload Advanced Template</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" paragraph>
            Upload an Excel template file (.xlsx) to generate formatted reports.
          </Typography>
          <Button
            variant="contained"
            startIcon={<FileUpload />}
            sx={{ mt: 2 }}
            onClick={() => console.log('File upload clicked')}
          >
            Select Template File
          </Button>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setUploadDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleTemplateUpload} disabled={!selectedTemplate}>
            Generate Report
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
