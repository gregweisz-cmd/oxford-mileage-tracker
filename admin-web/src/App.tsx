import React, { useState, useEffect, useCallback } from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  Container,
  Card,
  CardContent,
  Tabs,
  Tab,
  Box,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
  Alert,
  Chip,
  IconButton,
  Grid,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  People as PeopleIcon,
  Assessment as AssessmentIcon,
  CloudUpload as CloudUploadIcon,
  CloudDownload as CloudDownloadIcon,
  Settings as SettingsIcon,
  Close as CloseIcon,
  FileUpload as FileUploadIcon,
  GetApp as GetAppIcon,
} from '@mui/icons-material';

// Import services
import { DataSyncService } from './services/dataSyncService';
import { SimpleReportService } from './services/simpleReportService';
import { AdvancedTemplateService } from './services/advancedTemplateService';
import { CsvReportService } from './services/csvReportService';
import { RobustExcelService } from './services/robustExcelService';
import { ExcelJSReportService } from './services/excelJSReportService';

// Import components
import StaffPortal from './StaffPortal';
import { ExcelViewer } from './components/ExcelViewer';

// Types
interface Employee {
  id: string;
  name: string;
  position: string;
  costCenter: string;
}

interface MileageEntry {
  id: string;
  employeeId: string;
  date: string;
  startLocation: string;
  endLocation: string;
  purpose: string;
  miles: number;
  hoursWorked: number;
}

interface Receipt {
  id: string;
  employeeId: string;
  date: string;
  vendor: string;
  description: string;
  category: string;
  amount: number;
}

interface TimeTrackingEntry {
  id: string;
  employeeId: string;
  date: string;
  category: string;
  hours: number;
  description: string;
}

interface DashboardStats {
  totalEmployees: number;
  totalMileageEntries: number;
  totalReceipts: number;
  totalTimeTracking: number;
  totalMiles: number;
  totalAmount: number;
}

function App() {
  // State management
  const [currentTab, setCurrentTab] = useState(0);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [mileageEntries, setMileageEntries] = useState<MileageEntry[]>([]);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [timeTracking, setTimeTracking] = useState<TimeTrackingEntry[]>([]);
  const [dashboardStats, setDashboardStats] = useState<DashboardStats>({
    totalEmployees: 0,
    totalMileageEntries: 0,
    totalReceipts: 0,
    totalTimeTracking: 0,
    totalMiles: 0,
    totalAmount: 0,
  });

  // Dialog states
  const [dataSyncDialogOpen, setDataSyncDialogOpen] = useState(false);
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');

  // Report generation states
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [reportFormat, setReportFormat] = useState('excel');
  const [templateFile, setTemplateFile] = useState<File | null>(null);

  // Data sync states
  const [syncData, setSyncData] = useState<any>(null);
  const [importFile, setImportFile] = useState<File | null>(null);

  // Excel viewer states
  const [excelViewerOpen, setExcelViewerOpen] = useState(false);
  const [excelViewerFile, setExcelViewerFile] = useState<File | null>(null);
  const [excelViewerData, setExcelViewerData] = useState<ArrayBuffer | null>(null);
  const [excelViewerFileName, setExcelViewerFileName] = useState<string>('');

  // Load initial data
  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      // Load employees
      const employeesData = await DataSyncService.getEmployees() as Employee[];
      setEmployees(employeesData);

      // Load mileage entries
      const mileageData = await DataSyncService.getMileageEntries() as MileageEntry[];
      setMileageEntries(mileageData);

      // Load receipts
      const receiptsData = await DataSyncService.getReceipts() as Receipt[];
      setReceipts(receiptsData);

      // Load time tracking
      const timeTrackingData = await DataSyncService.getTimeTracking() as TimeTrackingEntry[];
      setTimeTracking(timeTrackingData);

      // Calculate dashboard stats
      const totalMiles = mileageData.reduce((sum: number, entry: MileageEntry) => sum + entry.miles, 0);
      const totalAmount = receiptsData.reduce((sum: number, receipt: Receipt) => sum + receipt.amount, 0);

      setDashboardStats({
        totalEmployees: employeesData.length,
        totalMileageEntries: mileageData.length,
        totalReceipts: receiptsData.length,
        totalTimeTracking: timeTrackingData.length,
        totalMiles,
        totalAmount,
      });
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    }
  };

  const handleDataSync = async () => {
    setLoading(true);
    setLoadingMessage('Syncing data...');
    try {
      const data = await DataSyncService.exportData();
      setSyncData(data);
      setDataSyncDialogOpen(true);
    } catch (error) {
      console.error('Error syncing data:', error);
      alert('Error syncing data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleImportData = async () => {
    if (!importFile) return;

    setLoading(true);
    setLoadingMessage('Importing data...');
    try {
      const text = await importFile.text();
      const data = JSON.parse(text);
      await DataSyncService.importData(data);
      await loadDashboardData();
      setDataSyncDialogOpen(false);
      alert('Data imported successfully!');
    } catch (error) {
      console.error('Error importing data:', error);
      alert('Error importing data. Please check the file format.');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateReport = async () => {
    if (!selectedEmployee) {
      alert('Please select an employee');
      return;
    }

    setLoading(true);
    setLoadingMessage('Generating report...');
    try {
      const employee = employees.find(emp => emp.id === selectedEmployee);
      if (!employee) {
        throw new Error('Employee not found');
      }

      const employeeData = {
        employeeId: employee.id,
        employeeName: employee.name,
        employeePosition: employee.position,
        employeeCostCenter: employee.costCenter,
        month: selectedMonth,
        year: selectedYear,
        totalMiles: mileageEntries
          .filter(entry => entry.employeeId === selectedEmployee)
          .reduce((sum, entry) => sum + entry.miles, 0),
        totalReceipts: receipts
          .filter(receipt => receipt.employeeId === selectedEmployee)
          .reduce((sum, receipt) => sum + receipt.amount, 0),
        totalHours: timeTracking
          .filter(entry => entry.employeeId === selectedEmployee)
          .reduce((sum, entry) => sum + entry.hours, 0),
        mileageEntries: mileageEntries.filter(entry => entry.employeeId === selectedEmployee),
        receipts: receipts.filter(receipt => receipt.employeeId === selectedEmployee),
        dailyOdometerReadings: [],
        timeTracking: timeTracking.filter(entry => entry.employeeId === selectedEmployee),
      };

      let reportData;
      switch (reportFormat) {
        case 'csv':
          reportData = await CsvReportService.generateEmployeeReport(employeeData);
          break;
        case 'robust-excel':
          reportData = await RobustExcelService.generateEmployeeReport(employeeData);
          break;
        case 'exceljs':
          reportData = await ExcelJSReportService.generateEmployeeReport(employeeData);
          break;
        default:
          reportData = await SimpleReportService.generateEmployeeReport(employeeData);
      }

      // Download the report
      const blob = new Blob([reportData], { type: 'application/octet-stream' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${employee.name}_${selectedMonth}_${selectedYear}_report.${reportFormat === 'csv' ? 'csv' : 'xlsx'}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      // If it's an Excel file, also open it in the viewer
      if (reportFormat !== 'csv' && reportData instanceof ArrayBuffer) {
        setExcelViewerData(reportData);
        setExcelViewerFileName(`${employee.name}_${selectedMonth}_${selectedYear}_report.xlsx`);
        setExcelViewerOpen(true);
      }

      setReportDialogOpen(false);
      alert('Report generated successfully!');
    } catch (error) {
      console.error('Error generating report:', error);
      alert('Error generating report. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleTemplateUpload = async () => {
    if (!templateFile) return;

    setLoading(true);
    setLoadingMessage('Uploading template...');
    try {
      const arrayBuffer = await templateFile.arrayBuffer();
      await AdvancedTemplateService.uploadTemplate(arrayBuffer, templateFile.name);
      setTemplateDialogOpen(false);
      alert('Template uploaded successfully!');
    } catch (error) {
      console.error('Error uploading template:', error);
      alert('Error uploading template. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateAdvancedReport = async () => {
    if (!selectedEmployee) {
      alert('Please select an employee');
      return;
    }

    setLoading(true);
    setLoadingMessage('Generating advanced report...');
    try {
      const employee = employees.find(emp => emp.id === selectedEmployee);
      if (!employee) {
        throw new Error('Employee not found');
      }

      const employeeData = {
        employeeId: employee.id,
        employeeName: employee.name,
        employeePosition: employee.position,
        employeeCostCenter: employee.costCenter,
        month: selectedMonth,
        year: selectedYear,
        totalMiles: mileageEntries
          .filter(entry => entry.employeeId === selectedEmployee)
          .reduce((sum, entry) => sum + entry.miles, 0),
        totalReceipts: receipts
          .filter(receipt => receipt.employeeId === selectedEmployee)
          .reduce((sum, receipt) => sum + receipt.amount, 0),
        totalHours: timeTracking
          .filter(entry => entry.employeeId === selectedEmployee)
          .reduce((sum, entry) => sum + entry.hours, 0),
        mileageEntries: mileageEntries.filter(entry => entry.employeeId === selectedEmployee),
        receipts: receipts.filter(receipt => receipt.employeeId === selectedEmployee),
        dailyOdometerReadings: [],
        timeTracking: timeTracking.filter(entry => entry.employeeId === selectedEmployee),
      };

      let reportData;
      switch (reportFormat) {
        case 'csv':
          reportData = await CsvReportService.generateEmployeeReport(employeeData);
          break;
        case 'robust-excel':
          reportData = await RobustExcelService.generateEmployeeReport(employeeData);
          break;
        case 'exceljs':
          reportData = await ExcelJSReportService.generateEmployeeReport(employeeData);
          break;
        default:
          reportData = await AdvancedTemplateService.generateEmployeeReport(employeeData);
      }

      // Download the report
      const blob = new Blob([reportData], { type: 'application/octet-stream' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${employee.name}_${selectedMonth}_${selectedYear}_advanced_report.${reportFormat === 'csv' ? 'csv' : 'xlsx'}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      // If it's an Excel file, also open it in the viewer
      if (reportFormat !== 'csv' && reportData instanceof ArrayBuffer) {
        setExcelViewerData(reportData);
        setExcelViewerFileName(`${employee.name}_${selectedMonth}_${selectedYear}_advanced_report.xlsx`);
        setExcelViewerOpen(true);
      }

      setTemplateDialogOpen(false);
      alert('Advanced report generated successfully!');
    } catch (error) {
      console.error('Error generating advanced report:', error);
      alert('Error generating advanced report. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const renderDashboard = () => (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Dashboard
      </Typography>
      
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 3 }}>
        <Card>
          <CardContent>
            <Typography color="textSecondary" gutterBottom>
              Total Employees
            </Typography>
            <Typography variant="h4">
              {dashboardStats.totalEmployees}
            </Typography>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent>
            <Typography color="textSecondary" gutterBottom>
              Mileage Entries
            </Typography>
            <Typography variant="h4">
              {dashboardStats.totalMileageEntries}
            </Typography>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent>
            <Typography color="textSecondary" gutterBottom>
              Total Miles
            </Typography>
            <Typography variant="h4">
              {dashboardStats.totalMiles.toFixed(1)}
            </Typography>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent>
            <Typography color="textSecondary" gutterBottom>
              Total Amount
            </Typography>
            <Typography variant="h4">
              ${dashboardStats.totalAmount.toFixed(2)}
            </Typography>
          </CardContent>
        </Card>
      </Box>

      <Box sx={{ mt: 3, display: 'flex', gap: 2 }}>
        <Button
          variant="contained"
          startIcon={<CloudUploadIcon />}
          onClick={handleDataSync}
        >
          Data Sync
        </Button>
        <Button
          variant="contained"
          startIcon={<AssessmentIcon />}
          onClick={() => setReportDialogOpen(true)}
        >
          Generate Report
        </Button>
        <Button
          variant="contained"
          startIcon={<FileUploadIcon />}
          onClick={() => setTemplateDialogOpen(true)}
        >
          Template Management
        </Button>
        <Button
          variant="contained"
          startIcon={<GetAppIcon />}
          onClick={() => {
            setExcelViewerFile(null);
            setExcelViewerData(null);
            setExcelViewerFileName('');
            setExcelViewerOpen(true);
          }}
        >
          Excel Viewer
        </Button>
      </Box>
    </Box>
  );

  const renderEmployees = () => (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Employees
      </Typography>
      
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Position</TableCell>
              <TableCell>Cost Center</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {employees.map((employee) => (
              <TableRow key={employee.id}>
                <TableCell>{employee.name}</TableCell>
                <TableCell>{employee.position}</TableCell>
                <TableCell>{employee.costCenter}</TableCell>
                <TableCell>
                  <Button
                    size="small"
                    onClick={() => {
                      setSelectedEmployee(employee.id);
                      setCurrentTab(4); // Switch to Staff Portal
                    }}
                  >
                    View Portal
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );

  const renderMileageEntries = () => (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Mileage Entries
      </Typography>
      
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Date</TableCell>
              <TableCell>Employee</TableCell>
              <TableCell>Start Location</TableCell>
              <TableCell>End Location</TableCell>
              <TableCell>Miles</TableCell>
              <TableCell>Purpose</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {mileageEntries.map((entry) => {
              const employee = employees.find(emp => emp.id === entry.employeeId);
              return (
                <TableRow key={entry.id}>
                  <TableCell>{new Date(entry.date).toLocaleDateString()}</TableCell>
                  <TableCell>{employee?.name || 'Unknown'}</TableCell>
                  <TableCell>{entry.startLocation}</TableCell>
                  <TableCell>{entry.endLocation}</TableCell>
                  <TableCell>{entry.miles}</TableCell>
                  <TableCell>{entry.purpose}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );

  const renderTimeTracking = () => (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Time Tracking
      </Typography>
      
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Date</TableCell>
              <TableCell>Employee</TableCell>
              <TableCell>Category</TableCell>
              <TableCell>Hours</TableCell>
              <TableCell>Description</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {timeTracking.map((entry) => {
              const employee = employees.find(emp => emp.id === entry.employeeId);
              return (
                <TableRow key={entry.id}>
                  <TableCell>{new Date(entry.date).toLocaleDateString()}</TableCell>
                  <TableCell>{employee?.name || 'Unknown'}</TableCell>
                  <TableCell>{entry.category}</TableCell>
                  <TableCell>{entry.hours}</TableCell>
                  <TableCell>{entry.description}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );

  return (
    <Box sx={{ flexGrow: 1 }}>
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            Oxford Mileage Tracker - Admin Portal
          </Typography>
        </Toolbar>
      </AppBar>

      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs value={currentTab} onChange={(e, newValue) => setCurrentTab(newValue)}>
          <Tab icon={<DashboardIcon />} label="Dashboard" />
          <Tab icon={<PeopleIcon />} label="Employees" />
          <Tab icon={<AssessmentIcon />} label="Mileage Entries" />
          <Tab icon={<AssessmentIcon />} label="Time Tracking" />
          {selectedEmployee && <Tab label="Staff Portal" />}
        </Tabs>
      </Box>

      {currentTab === 0 && renderDashboard()}
      {currentTab === 1 && renderEmployees()}
      {currentTab === 2 && renderMileageEntries()}
      {currentTab === 3 && renderTimeTracking()}
      {currentTab === 4 && selectedEmployee && (
        <StaffPortal
          employeeId={selectedEmployee}
          reportMonth={selectedMonth}
          reportYear={selectedYear}
          isAdminView={true}
        />
      )}

      {/* Data Sync Dialog */}
      <Dialog open={dataSyncDialogOpen} onClose={() => setDataSyncDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          Data Synchronization
          <IconButton
            onClick={() => setDataSyncDialogOpen(false)}
            sx={{ position: 'absolute', right: 8, top: 8 }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mb: 2 }}>
            <Typography variant="h6" gutterBottom>
              Export Data
            </Typography>
            <Button
              variant="contained"
              startIcon={<CloudDownloadIcon />}
              onClick={() => {
                if (syncData) {
                  const blob = new Blob([JSON.stringify(syncData, null, 2)], { type: 'application/json' });
                  const url = window.URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = 'mileage_data_export.json';
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                  window.URL.revokeObjectURL(url);
                }
              }}
              sx={{ mr: 2 }}
            >
              Download Export
            </Button>
          </Box>
          
          <Box>
            <Typography variant="h6" gutterBottom>
              Import Data
            </Typography>
            <input
              type="file"
              accept=".json"
              onChange={(e) => setImportFile(e.target.files?.[0] || null)}
              style={{ marginBottom: 16 }}
            />
            <Button
              variant="contained"
              startIcon={<CloudUploadIcon />}
              onClick={handleImportData}
              disabled={!importFile}
            >
              Import Data
            </Button>
          </Box>
        </DialogContent>
      </Dialog>

      {/* Report Generation Dialog */}
      <Dialog open={reportDialogOpen} onClose={() => setReportDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          Generate Employee Report
          <IconButton
            onClick={() => setReportDialogOpen(false)}
            sx={{ position: 'absolute', right: 8, top: 8 }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <FormControl fullWidth>
              <InputLabel>Employee</InputLabel>
              <Select
                value={selectedEmployee}
                onChange={(e) => setSelectedEmployee(e.target.value)}
              >
                {employees.map((employee) => (
                  <MenuItem key={employee.id} value={employee.id}>
                    {employee.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth>
              <InputLabel>Report Format</InputLabel>
              <Select
                value={reportFormat}
                onChange={(e) => setReportFormat(e.target.value)}
              >
                <MenuItem value="excel">Simple Excel</MenuItem>
                <MenuItem value="csv">CSV</MenuItem>
                <MenuItem value="robust-excel">Robust Excel</MenuItem>
                <MenuItem value="exceljs">ExcelJS</MenuItem>
              </Select>
            </FormControl>

            <TextField
              label="Month"
              type="number"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
              inputProps={{ min: 1, max: 12 }}
            />

            <TextField
              label="Year"
              type="number"
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setReportDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleGenerateReport} variant="contained">
            Generate Report
          </Button>
        </DialogActions>
      </Dialog>

      {/* Template Management Dialog */}
      <Dialog open={templateDialogOpen} onClose={() => setTemplateDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          Template Management
          <IconButton
            onClick={() => setTemplateDialogOpen(false)}
            sx={{ position: 'absolute', right: 8, top: 8 }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <Box>
              <Typography variant="h6" gutterBottom>
                Upload Advanced Template
              </Typography>
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={(e) => setTemplateFile(e.target.files?.[0] || null)}
                style={{ marginBottom: 16 }}
              />
              <Button
                variant="contained"
                startIcon={<FileUploadIcon />}
                onClick={handleTemplateUpload}
                disabled={!templateFile}
                sx={{ mb: 2 }}
              >
                Upload Template
              </Button>
            </Box>

            <Box>
              <Typography variant="h6" gutterBottom>
                Generate Advanced Report
              </Typography>
              <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel>Employee</InputLabel>
                <Select
                  value={selectedEmployee}
                  onChange={(e) => setSelectedEmployee(e.target.value)}
                >
                  {employees.map((employee) => (
                    <MenuItem key={employee.id} value={employee.id}>
                      {employee.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel>Report Format</InputLabel>
                <Select
                  value={reportFormat}
                  onChange={(e) => setReportFormat(e.target.value)}
                >
                  <MenuItem value="excel">Advanced Excel</MenuItem>
                  <MenuItem value="csv">CSV</MenuItem>
                  <MenuItem value="robust-excel">Robust Excel</MenuItem>
                  <MenuItem value="exceljs">ExcelJS</MenuItem>
                </Select>
              </FormControl>

              <TextField
                label="Month"
                type="number"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                inputProps={{ min: 1, max: 12 }}
                sx={{ mb: 2, mr: 2, width: '48%' }}
              />

              <TextField
                label="Year"
                type="number"
                value={selectedYear}
                onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                sx={{ mb: 2, width: '48%' }}
              />
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTemplateDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleGenerateAdvancedReport} variant="contained">
            Generate Advanced Report
          </Button>
        </DialogActions>
      </Dialog>

      {/* Loading Dialog */}
      <Dialog open={loading} onClose={() => {}}>
        <DialogContent sx={{ textAlign: 'center', p: 3 }}>
          <CircularProgress sx={{ mb: 2 }} />
          <Typography>{loadingMessage}</Typography>
        </DialogContent>
      </Dialog>

      {/* Excel Viewer Dialog */}
      <ExcelViewer
        open={excelViewerOpen}
        onClose={() => {
          setExcelViewerOpen(false);
          setExcelViewerFile(null);
          setExcelViewerData(null);
          setExcelViewerFileName('');
        }}
        file={excelViewerFile}
        data={excelViewerData}
        fileName={excelViewerFileName}
      />
    </Box>
  );
}

export default App;
