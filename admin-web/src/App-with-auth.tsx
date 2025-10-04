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
  Avatar,
  Menu,
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
  Delete as DeleteIcon,
  AccountCircle as AccountCircleIcon,
  Logout as LogoutIcon,
  AdminPanelSettings as AdminIcon,
  SupervisorAccount as SupervisorIcon,
} from '@mui/icons-material';

// Import services and components
import { DataSyncService } from './services/dataSyncService';
import { SimpleReportService } from './services/simpleReportService';
import { AdvancedTemplateService } from './services/advancedTemplateService';
import authService, { AuthService, User, UserRole } from './services/authService';
import LoginForm from './components/LoginForm';
import EmployeeManagement from './components/EmployeeManagement';
import EmployeePortal from './components/EmployeePortal';
import { ExcelViewer } from './components/ExcelViewer';

// Types
interface Employee {
  id: string;
  name: string;
  email: string;
  position: string;
  phoneNumber: string;
  baseAddress: string;
  baseAddress2?: string;
  costCenters: string[];
  createdAt: string;
}

interface MileageEntry {
  id: string;
  employeeId: string;
  employee?: Employee;
  date: string;
  startLocation: string;
  endLocation: string;
  purpose: string;
  miles: number;
  hoursWorked?: number;
  isGpsTracked: boolean;
}

interface Receipt {
  id: string;
  employeeId: string;
  employee?: Employee;
  date: string;
  amount: number;
  vendor: string;
  description?: string;
  category: string;
}

interface TimeTrackingEntry {
  id: string;
  employeeId: string;
  employee?: Employee;
  date: string;
  category: string;
  hours: number;
  description?: string;
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
  // Authentication state
  const [authState, setAuthState] = useState(authService.getAuthState());
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  // Main app state
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

  // User menu state
  const [userMenuAnchor, setUserMenuAnchor] = useState<null | HTMLElement>(null);

  // Initialize authentication and load data
  useEffect(() => {
    authService.initializeAuth();
    
    const handleAuthChange = (newState: any) => {
      setAuthState(newState);
      setCurrentUser(newState.user);
      
      if (newState.isAuthenticated) {
        loadDashboardData();
      }
    };

    authService.addListener(handleAuthChange);
    
    return () => {
      authService.removeListener(handleAuthChange);
    };
  }, []);

  // Set up periodic refresh for authenticated users
  useEffect(() => {
    if (!authState.isAuthenticated) return;

    const interval = setInterval(() => {
      loadDashboardData();
    }, 30000);
    
    return () => clearInterval(interval);
  }, [authState.isAuthenticated]);

  const handleLoginSuccess = (user: User) => {
    setCurrentUser(user);
    loadDashboardData();
  };

  const handleLogout = () => {
    authService.logout();
    setUserMenuAnchor(null);
    setCurrentUser(null);
  };

  const loadDashboardData = async () => {
    if (!currentUser) return;

    try {
      // Load employees based on user role
      let employeesData = await DataSyncService.getEmployees() as Employee[];
      
      // Filter employees based on user role
      if (currentUser.role === 'employee') {
        // Only show current user
        employeesData = employeesData.filter(emp => emp.id === currentUser.id);
      } else if (currentUser.role === 'supervisor') {
        // Show current user and employees in same cost centers
        employeesData = employeesData.filter(emp => 
          emp.id === currentUser.id || 
          emp.costCenters.some(cc => currentUser.costCenters.includes(cc))
        );
      }
      // Admin sees all employees

      setEmployees(employeesData);

      // Load mileage entries (filtered for role)
      const mileageData = await DataSyncService.getMileageEntries() as MileageEntry[];
      const filteredMileage = currentUser.role === 'employee' 
        ? mileageData.filter(m => m.employeeId === currentUser.id)
        : mileageData;

      // Load receipts (filtered for role)  
      const receiptsData = await DataSyncService.getReceipts() as Receipt[];
      const filteredReceipts = currentUser.role === 'employee'
        ? receiptsData.filter(r => r.employeeId === currentUser.id)
        : receiptsData;

      // Load time tracking (filtered for role)
      const timeTrackingData = await DataSyncService.getTimeTracking() as TimeTrackingEntry[];
      const filteredTimeTracking = currentUser.role === 'employee'
        ? timeTrackingData.filter(t => t.employeeId === currentUser.id)
        : timeTrackingData;

      setMileageEntries(filteredMileage);
      setReceipts(filteredReceipts);
      setTimeTracking(filteredTimeTracking);

      // Calculate dashboard stats from filtered data
      const totalMiles = filteredMileage.reduce((sum: number, entry: MileageEntry) => sum + entry.miles, 0);
      const totalAmount = filteredReceipts.reduce((sum: number, receipt: Receipt) => sum + receipt.amount, 0);

      setDashboardStats({
        totalEmployees: currentUser.role === 'admin' ? employeesData.length : employeesData.length,
        totalMileageEntries: filteredMileage.length,
        totalReceipts: filteredReceipts.length,
        totalTimeTracking: filteredTimeTracking.length,
        totalMiles,
        totalAmount,
      });
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    }
  };

  // Get available tabs based on user role
  const getAvailableTabs = () => {
    const baseTabs = [
      { label: 'Dashboard', icon: <DashboardIcon />, value: 0 }
    ];

    if (AuthService.canManageEmployees(currentUser)) {
      baseTabs.push(
        { label: 'Employees', icon: <PeopleIcon />, value: 1 }
      );
    }

    if (AuthService.hasPermission(currentUser?.role || null, 'view_all_data')) {
      baseTabs.push(
        { label: 'Mileage', icon: <AssessmentIcon />, value: 2 },
        { label: 'Receipts', icon: <AssessmentIcon />, value: 3 },
        { label: 'Time Tracking', icon: <AssessmentIcon />, value: 4 }
      );
    }

    baseTabs.push(
      { label: 'Reports', icon: <AssessmentIcon />, value: 5 },
      { label: 'Data Sync', icon: <CloudUploadIcon />, value: 6 }
    );

    if (currentUser?.role === 'admin') {
      baseTabs.push({ label: 'Templates', icon: <SettingsIcon />, value: 7 });
    }

    return baseTabs;
  };

  // Render content based on current tab and user role
  const renderTabContent = () => {
    // For employees, show the full Employee Portal instead of tabbed interface
    if (currentUser?.role === 'employee') {
      return <EmployeePortal employee={currentUser} />;
    }
    
    // For supervisors and admins, show tabbed interface
    switch (currentTab) {
      case 0:
        return renderDashboard();
      case 1:
        return AuthService.canManageEmployees(currentUser) ? <EmployeeManagement /> : null;
      case 2:
        return renderMileageTable();
      case 3:
        return renderReceiptsTable();
      case 4:
        return renderTimeTrackingTable();
      case 5:
        return renderReports();
      case 6:
        return renderDataSync();
      case 7:
        return currentUser?.role === 'admin' ? renderTemplates() : null;
      default:
        return renderDashboard();
    }
  };

  // Render different content functions would go here...
  // For now, I'll create simplified versions

  const renderDashboard = () => (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h4" gutterBottom>
        Welcome, {currentUser?.name}
      </Typography>
      
      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        <Card sx={{ flex: '1 1 250px', minWidth: '250px' }}>
          <CardContent>
            <Typography color="textSecondary" gutterBottom>
              Total Employees
            </Typography>
            <Typography variant="h4">
              {dashboardStats.totalEmployees}
            </Typography>
          </CardContent>
        </Card>
        
        <Card sx={{ flex: '1 1 250px', minWidth: '250px' }}>
          <CardContent>
            <Typography color="textSecondary" gutterBottom>
              Total Miles
            </Typography>
            <Typography variant="h4">
              {dashboardStats.totalMiles.toFixed(1)}
            </Typography>
          </CardContent>
        </Card>
        
        <Card sx={{ flex: '1 1 250px', minWidth: '250px' }}>
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
    </Container>
  );

  const renderMileageTable = () => (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h5" gutterBottom>Mileage Entries</Typography>
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Employee</TableCell>
              <TableCell>Date</TableCell>
              <TableCell>Route</TableCell>
              <TableCell>Miles</TableCell>
              <TableCell>Purpose</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {mileageEntries.slice(0, 10).map((entry) => (
              <TableRow key={entry.id}>
                <TableCell>{entry.employee?.name || entry.employeeId}</TableCell>
                <TableCell>{new Date(entry.date).toLocaleDateString()}</TableCell>
                <TableCell>{entry.startLocation} → {entry.endLocation}</TableCell>
                <TableCell>{entry.miles}</TableCell>
                <TableCell>{entry.purpose}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Container>
  );

  const renderReceiptsTable = () => (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h5" gutterBottom>Receipts</Typography>
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Employee</TableCell>
              <TableCell>Date</TableCell>
              <TableCell>Vendor</TableCell>
              <TableCell>Amount</TableCell>
              <TableCell>Category</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {receipts.slice(0, 10).map((receipt) => (
              <TableRow key={receipt.id}>
                <TableCell>{receipt.employee?.name || receipt.employeeId}</TableCell>
                <TableCell>{new Date(receipt.date).toLocaleDateString()}</TableCell>
                <TableCell>{receipt.vendor}</TableCell>
                <TableCell>${receipt.amount.toFixed(2)}</TableCell>
                <TableCell>{receipt.category}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Container>
  );

  const renderTimeTrackingTable = () => (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h5" gutterBottom>Time Tracking</Typography>
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Employee</TableCell>
              <TableCell>Date</TableCell>
              <TableCell>Category</TableCell>
              <TableCell>Hours</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {timeTracking.slice(0, 10).map((entry) => (
              <TableRow key={entry.id}>
                <TableCell>{entry.employee?.name || entry.employeeId}</TableCell>
                <TableCell>{new Date(entry.date).toLocaleDateString()}</TableCell>
                <TableCell>{entry.category}</TableCell>
                <TableCell>{entry.hours}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Container>
  );

  const renderReports = () => (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h5" gutterBottom>Report Generation</Typography>
      <Button variant="contained" startIcon={<AssessmentIcon />}>
        Generate Employee Report
      </Button>
    </Container>
  );

  const renderDataSync = () => (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h5" gutterBottom>Data Sync</Typography>
      <Button variant="contained" startIcon={<CloudUploadIcon />}>
        Export Data
      </Button>
    </Container>
  );

  const renderTemplates = () => (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h5" gutterBottom>Template Management</Typography>
      <Typography>Admin-only template management features would go here.</Typography>
    </Container>
  );

  // Show login form if not authenticated
  if (!authState.isAuthenticated) {
    return <LoginForm onLoginSuccess={handleLoginSuccess} />;
  }

  const availableTabs = getAvailableTabs();

  return (
    <Box>
      <AppBar position="sticky">
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            Oxford House Expense System
          </Typography>
          
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {/* User role indicator */}
            <Chip 
              icon={
                currentUser?.role === 'admin' ? <AdminIcon /> :
                currentUser?.role === 'supervisor' ? <SupervisorIcon /> :
                <AccountCircleIcon />
              }
              label={`${currentUser?.role?.toUpperCase()}: ${currentUser?.name}`}
              color="secondary"
              variant="outlined"
            />
            
            {/* Direct Logout Button */}
            <Button
              variant="outlined"
              color="inherit"
              startIcon={<LogoutIcon />}
              onClick={handleLogout}
              sx={{ 
                borderColor: 'rgba(255,255,255,0.3)',
                color: 'white',
                '&:hover': {
                  borderColor: 'rgba(255,255,255,0.5)',
                  backgroundColor: 'rgba(255,255,255,0.1)'
                }
              }}
            >
              Logout
            </Button>
            
            {/* User menu */}
            <IconButton
              size="large"
              onClick={(event) => setUserMenuAnchor(event.currentTarget)}
              color="inherit"
              title="Account Options"
            >
              <AccountCircleIcon />
            </IconButton>
            
            <Menu
              anchorEl={userMenuAnchor}
              open={Boolean(userMenuAnchor)}
              onClose={() => setUserMenuAnchor(null)}
            >
              <MenuItem onClick={handleLogout}>
                <LogoutIcon sx={{ mr: 1 }} />
                Logout
              </MenuItem>
            </Menu>
          </Box>
        </Toolbar>
      </AppBar>

      {/* Only show tabs for supervisors and admins */}
      {currentUser?.role !== 'employee' && (
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs 
            value={currentTab} 
            onChange={(e, newValue) => setCurrentTab(newValue)}
            variant="scrollable"
            scrollButtons="auto"
          >
            {availableTabs.map((tab) => (
              <Tab 
                key={tab.value}
                label={tab.label} 
                icon={tab.icon}
                iconPosition="start"
              />
            ))}
          </Tabs>
        </Box>
      )}

      {renderTabContent()}

      {/* Excel Viewer Dialog */}
      <ExcelViewer
        open={excelViewerOpen}
        onClose={() => setExcelViewerOpen(false)}
        file={excelViewerFile}
        data={excelViewerData}
        fileName={excelViewerFileName}
      />
    </Box>
  );
}

export default App;