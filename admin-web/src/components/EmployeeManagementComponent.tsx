import React, { useState, useRef } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Typography,
  Alert,
  LinearProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
  Tooltip,
  Checkbox,
  Tabs,
  Tab,
  OutlinedInput,
  ListItemText,
  InputAdornment,
} from '@mui/material';
import {
  CloudUpload,
  Download,
  Delete,
  Edit,
  Add,
  Clear,
  LockReset,
  Search,
  ExpandMore,
  ExpandLess,
  Archive,
  Restore,
  FolderDelete
} from '@mui/icons-material';
import { BulkImportService, BulkImportResult, EmployeeImportData } from '../services/bulkImportService';
import { EmployeeApiService } from '../services/employeeApiService';
import { Employee } from '../types';
import { COST_CENTERS } from '../constants/costCenters';

interface EmployeeManagementProps {
  onImportComplete: (result: BulkImportResult) => void;
  existingEmployees: Employee[];
  onCreateEmployee: (employee: Omit<Employee, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Employee>;
  onUpdateEmployee: (id: string, employee: Partial<Employee>) => Promise<void>;
  onDeleteEmployee: (id: string) => Promise<void>;
  onBulkUpdateEmployees: (employeeIds: string[], updates: Partial<Employee>) => Promise<void>;
  onBulkDeleteEmployees: (employeeIds: string[]) => Promise<void>;
  onRefresh?: () => void;
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
      id={`employee-tabpanel-${index}`}
      aria-labelledby={`employee-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

export const EmployeeManagementComponent: React.FC<EmployeeManagementProps> = ({
  onImportComplete,
  existingEmployees,
  onCreateEmployee,
  onUpdateEmployee,
  onDeleteEmployee,
  onBulkUpdateEmployees,
  onBulkDeleteEmployees,
  onRefresh
}) => {
  const [activeTab, setActiveTab] = useState(0);
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);
  const [importResult, setImportResult] = useState<BulkImportResult | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [csvData, setCsvData] = useState<string>('');
  const [showPreview, setShowPreview] = useState(false);
  const [previewData, setPreviewData] = useState<EmployeeImportData[]>([]);
  const [showEmployeeDialog, setShowEmployeeDialog] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [showBulkEditDialog, setShowBulkEditDialog] = useState(false);
  const [bulkEditData, setBulkEditData] = useState<Partial<Employee>>({});
  const [selectedCostCenters, setSelectedCostCenters] = useState<string[]>([]);
  const [defaultCostCenter, setDefaultCostCenter] = useState<string>('');
  const [searchText, setSearchText] = useState<string>('');
  const [showProfileDialog, setShowProfileDialog] = useState(false);
  const [viewingEmployee, setViewingEmployee] = useState<Employee | null>(null);
  // const [isEditMode, setIsEditMode] = useState(false); // Currently unused
  const [showQuickCostCenterEdit, setShowQuickCostCenterEdit] = useState(false);
  const [quickEditEmployee, setQuickEditEmployee] = useState<Employee | null>(null);
  const [quickEditCostCenters, setQuickEditCostCenters] = useState<string[]>([]);
  const [showCostCenterDropdown, setShowCostCenterDropdown] = useState(false);
  const [showEmployeeCostCenterDropdown, setShowEmployeeCostCenterDropdown] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [archivedEmployees, setArchivedEmployees] = useState<Employee[]>([]);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [employeeToDelete, setEmployeeToDelete] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const employeeDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowCostCenterDropdown(false);
      }
      if (employeeDropdownRef.current && !employeeDropdownRef.current.contains(event.target as Node)) {
        setShowEmployeeCostCenterDropdown(false);
      }
    };

    if (showCostCenterDropdown || showEmployeeCostCenterDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showCostCenterDropdown, showEmployeeCostCenterDropdown]);

  // Load archived employees when viewing archived section
  React.useEffect(() => {
    if (showArchived) {
      loadArchivedEmployees();
    }
  }, [showArchived]);

  const loadArchivedEmployees = async () => {
    try {
      console.log('🔄 Loading archived employees...');
      const archived = await EmployeeApiService.getArchivedEmployees();
      console.log(`✅ Archived employees loaded: ${archived.length} employees`, archived);
      
      if (archived.length === 0) {
        console.log('ℹ️ No archived employees found in database');
      }
      
      setArchivedEmployees(archived);
    } catch (error) {
      console.error('❌ Error loading archived employees:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error details:', errorMessage);
      alert(`Failed to load archived employees: ${errorMessage}`);
      // Set empty array on error to avoid stale data
      setArchivedEmployees([]);
    }
  };

  // Filter employees based on search text
  const filteredEmployees = (showArchived ? archivedEmployees : existingEmployees).filter(employee => {
    if (!searchText) return true;
    const searchLower = searchText.toLowerCase();
    return (
      employee.name?.toLowerCase().includes(searchLower) ||
      employee.email?.toLowerCase().includes(searchLower) ||
      employee.position?.toLowerCase().includes(searchLower) ||
      employee.phoneNumber?.toLowerCase().includes(searchLower)
    );
  });

  // Helper function to safely parse costCenters
  const parseCostCenters = (costCenters: any): string[] => {
    if (Array.isArray(costCenters)) {
      return costCenters;
    }
    if (typeof costCenters === 'string') {
      try {
        return JSON.parse(costCenters);
      } catch {
        return [costCenters];
      }
    }
    if (costCenters && typeof costCenters === 'object') {
      // If it's an object, try to extract values or convert to array
      if (costCenters.toString && costCenters.toString() === '[object Object]') {
        return [];
      }
      // Try to convert object to array of values
      const values = Object.values(costCenters);
      return values.filter(v => typeof v === 'string') as string[];
    }
    return [];
  };

  // Individual Employee Management
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        setCsvData(text);
        setShowPreview(true);
        setPreviewData(BulkImportService.parseCSVData(text));
      };
      reader.readAsText(file);
    }
  };

  const handleImport = async () => {
    if (!csvData) return;

    setIsImporting(true);
    try {
      // Parse CSV data first
      const importData = BulkImportService.parseCSVData(csvData);
      
      // Convert to employee format
      const employees = importData.map(data => BulkImportService.convertToEmployee(data, existingEmployees));
      
      // Use bulk create endpoint instead of individual creates
      const result = await EmployeeApiService.bulkCreateEmployees({ employees });
      
      // Convert result to BulkImportResult format
      const bulkResult = {
        success: result.success,
        totalProcessed: result.totalProcessed || employees.length,
        successful: result.successful || 0,
        failed: result.failed || 0,
        errors: result.errors || [],
        createdEmployees: result.createdEmployees || []
      };
      
      setImportResult(bulkResult);
      onImportComplete(bulkResult);
    } catch (error: any) {
      setImportResult({
        success: false,
        totalProcessed: 0,
        successful: 0,
        failed: 0,
        errors: [error?.message || 'Import failed'],
        createdEmployees: []
      });
    } finally {
      setIsImporting(false);
    }
  };

  const handleDownloadTemplate = () => {
    const template = BulkImportService.generateCSVTemplate();
    const blob = new Blob([template], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'employee_import_template.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const handleExportEmployees = () => {
    const csv = BulkImportService.exportEmployeesToCSV(existingEmployees);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'employees_export.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // Multi-Select Management
  const handleSelectEmployee = (employeeId: string) => {
    setSelectedEmployees(prev => 
      prev.includes(employeeId) 
        ? prev.filter(id => id !== employeeId)
        : [...prev, employeeId]
    );
  };

  const handleSelectAll = () => {
    setSelectedEmployees(
      selectedEmployees.length === existingEmployees.length 
        ? [] 
        : existingEmployees.map(emp => emp.id)
    );
  };

  const handleBulkEdit = () => {
    if (selectedEmployees.length === 0) return;
    setBulkEditData({});
    setShowBulkEditDialog(true);
  };

  const handleBulkDelete = async () => {
    if (selectedEmployees.length === 0) return;
    if (window.confirm(`Are you sure you want to delete ${selectedEmployees.length} employees?`)) {
      try {
        await onBulkDeleteEmployees(selectedEmployees);
        setSelectedEmployees([]);
      } catch (error) {
        console.error('Error in bulk delete:', error);
        alert('Failed to delete employees. Please try again.');
      }
    }
  };

  const handleSaveBulkEdit = async () => {
    if (selectedEmployees.length === 0) return;
    try {
      await onBulkUpdateEmployees(selectedEmployees, bulkEditData);
      setShowBulkEditDialog(false);
      setSelectedEmployees([]);
      setBulkEditData({});
    } catch (error) {
      console.error('Error updating employees:', error);
    }
  };

  // Individual Employee Management
  const handleViewEmployee = (employee: Employee) => {
    setViewingEmployee(employee);
    // setIsEditMode(false); // Edit mode state currently unused
    setShowProfileDialog(true);
  };

  const handleEditFromProfile = () => {
    if (!viewingEmployee) return;
    setEditingEmployee(viewingEmployee);
    const costCenters = parseCostCenters(viewingEmployee.costCenters);
    setSelectedCostCenters(costCenters);
    setDefaultCostCenter(viewingEmployee.defaultCostCenter || costCenters[0] || '');
    setShowProfileDialog(false);
    setShowEmployeeDialog(true);
  };

  const handleEditEmployee = (employee: Employee) => {
    setEditingEmployee(employee);
    const costCenters = parseCostCenters(employee.costCenters);
    setSelectedCostCenters(costCenters);
    setDefaultCostCenter(employee.defaultCostCenter || costCenters[0] || '');
    setShowEmployeeDialog(true);
    setShowEmployeeCostCenterDropdown(true); // Open dropdown by default
  };

  const handleAddEmployee = () => {
    setEditingEmployee({
      id: '',
      name: '',
      email: '',
      password: '',
      oxfordHouseId: '',
      position: '',
      phoneNumber: '',
      baseAddress: '',
      costCenters: ['Program Services'],
      selectedCostCenters: ['Program Services'],
      defaultCostCenter: 'Program Services',
      createdAt: new Date(),
      updatedAt: new Date()
    });
    setSelectedCostCenters(['Program Services']);
    setDefaultCostCenter('Program Services');
    setShowEmployeeDialog(true);
    setShowEmployeeCostCenterDropdown(true); // Open dropdown by default
  };

  const handleSaveEmployee = async () => {
    if (!editingEmployee) return;
    
    // Validate that at least one cost center is selected
    if (selectedCostCenters.length === 0) {
      alert('Please select at least one cost center.');
      return;
    }
    
    // Validate that default cost center is selected if multiple cost centers are assigned
    if (selectedCostCenters.length > 1 && !defaultCostCenter) {
      alert('Please select a default cost center when multiple cost centers are assigned.');
      return;
    }
    
    try {
      const updatedEmployee: any = {
        ...editingEmployee,
        costCenters: selectedCostCenters,
        selectedCostCenters: selectedCostCenters,
        defaultCostCenter: defaultCostCenter || selectedCostCenters[0]
      };
      
      // Handle password: only include it if it's been changed (not a hash)
      // If password field is empty or still a hash, don't include it in the update
      // If password is a new plain text password, include it
      if (editingEmployee.password && 
          editingEmployee.password.trim() !== '' && 
          !editingEmployee.password.startsWith('$2b$')) {
        // This is a new plain text password - include it in the update
        updatedEmployee.password = editingEmployee.password;
      } else {
        // Remove password from update - keep existing password
        delete updatedEmployee.password;
      }
      
      if (editingEmployee.id) {
        await onUpdateEmployee(editingEmployee.id, updatedEmployee);
      } else {
        await onCreateEmployee(updatedEmployee);
      }
      setShowEmployeeDialog(false);
      setEditingEmployee(null);
      setSelectedCostCenters([]);
      setDefaultCostCenter('');
    } catch (error) {
      console.error('Error saving employee:', error);
    }
  };

  const handleDeleteEmployee = async (employeeId: string) => {
    if (window.confirm('Are you sure you want to archive this employee? They will be moved to the archived employees section. You can restore them later if needed.')) {
      try {
        // onDeleteEmployee now handles archiving (updated in AdminPortal)
        await onDeleteEmployee(employeeId);
        // Refresh archived list if user is viewing archived section
        if (showArchived) {
          await loadArchivedEmployees();
        }
      } catch (error: any) {
        console.error('Error archiving employee:', error);
        alert(error.message || 'Failed to archive employee. Please try again.');
      }
    }
  };

  const handleRestoreEmployee = async (employeeId: string) => {
    if (window.confirm('Are you sure you want to restore this employee? They will be moved back to the active employees list.')) {
      try {
        await EmployeeApiService.restoreEmployee(employeeId);
        await loadArchivedEmployees(); // Refresh archived list
        // Trigger parent refresh to update active employees list
        if (onRefresh) {
          onRefresh();
        }
        alert('Employee restored successfully');
      } catch (error: any) {
        console.error('Error restoring employee:', error);
        alert(error.message || 'Failed to restore employee. Please try again.');
      }
    }
  };

  const handleDeleteClick = (employeeId: string) => {
    setEmployeeToDelete(employeeId);
    setDeleteConfirmText('');
    setDeleteConfirmOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (deleteConfirmText !== 'CONFIRM') {
      alert('Please type "CONFIRM" to permanently delete this employee.');
      return;
    }

    if (!employeeToDelete) return;

    try {
      await EmployeeApiService.deleteEmployee(employeeToDelete);
      await loadArchivedEmployees(); // Refresh archived list
      setDeleteConfirmOpen(false);
      setEmployeeToDelete(null);
      setDeleteConfirmText('');
      alert('Employee permanently deleted');
    } catch (error: any) {
      console.error('Error deleting employee:', error);
      alert(error.message || 'Failed to delete employee. Please try again.');
    }
  };

  const handleResetPassword = async (employee: Employee) => {
    const newPassword = `${employee.name.split(' ')[0]}welcome1`;
    
    if (window.confirm(`Reset password for ${employee.name} to "${newPassword}"?`)) {
      try {
        // Use EmployeeApiService for consistent API URL handling
        await EmployeeApiService.resetEmployeePassword(employee.id, newPassword);
        alert(`Password reset successfully for ${employee.name} to "${newPassword}"`);
      } catch (error) {
        console.error('Error resetting password:', error);
        alert(`Error resetting password: ${error instanceof Error ? error.message : 'Please try again.'}`);
      }
    }
  };

  // Quick Cost Center Edit Functions
  const handleQuickCostCenterEdit = (employee: Employee) => {
    const costCenters = parseCostCenters(employee.costCenters);
    setQuickEditEmployee(employee);
    setQuickEditCostCenters(costCenters);
    setShowQuickCostCenterEdit(true);
    setShowCostCenterDropdown(true); // Open dropdown by default
  };

  const handleSaveQuickCostCenterEdit = async () => {
    if (!quickEditEmployee) return;
    
    try {
      await onUpdateEmployee(quickEditEmployee.id, {
        name: quickEditEmployee.name,
        preferredName: quickEditEmployee.preferredName || '',
        email: quickEditEmployee.email,
        oxfordHouseId: quickEditEmployee.oxfordHouseId || '',
        position: quickEditEmployee.position || '',
        phoneNumber: quickEditEmployee.phoneNumber || '',
        baseAddress: quickEditEmployee.baseAddress || '',
        baseAddress2: quickEditEmployee.baseAddress2 || '',
        costCenters: quickEditCostCenters,
        selectedCostCenters: quickEditCostCenters,
        defaultCostCenter: quickEditCostCenters.includes(quickEditEmployee.defaultCostCenter || '') 
          ? quickEditEmployee.defaultCostCenter 
          : quickEditCostCenters[0],
        signature: quickEditEmployee.signature || undefined
      });
      setShowQuickCostCenterEdit(false);
      setQuickEditEmployee(null);
      setQuickEditCostCenters([]);
    } catch (error) {
      console.error('Error updating cost centers:', error);
      alert('Failed to update cost centers. Please try again.');
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Employee Management
      </Typography>

      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={activeTab} onChange={(e, newValue) => setActiveTab(newValue)}>
          <Tab label="Individual Management" />
          <Tab label="Bulk Import" />
          <Tab label="Mass Operations" />
        </Tabs>
      </Box>

      {/* Individual Employee Management Tab */}
      <TabPanel value={activeTab} index={0}>
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6">
                {showArchived ? 'Archived Employees' : 'Current Employees'} ({filteredEmployees.length}{!showArchived && searchText && ` of ${existingEmployees.length}`})
              </Typography>
              <Box sx={{ display: 'flex', gap: 2 }}>
                {showArchived ? (
                                     <Button
                     variant="outlined"
                     startIcon={<Archive />}
                     onClick={() => {
                       setShowArchived(false);
                       setSearchText('');
                       // Clear archived employees when switching back to active
                       setArchivedEmployees([]);
                     }}
                   >
                     Back to Active Employees
                   </Button>
                ) : (
                  <>
                                         <Button
                       variant="outlined"
                       startIcon={<Archive />}
                       onClick={async () => {
                         setShowArchived(true);
                         setSearchText('');
                         // Explicitly load archived employees when switching to archived view
                         await loadArchivedEmployees();
                       }}
                     >
                       View Archived
                     </Button>
                    <Button
                      variant="contained"
                      startIcon={<Add />}
                      onClick={handleAddEmployee}
                    >
                      Add Employee
                    </Button>
                  </>
                )}
              </Box>
            </Box>
            
            {/* Search Bar */}
            <TextField
              fullWidth
              placeholder="Search by name, email, position, or phone..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              InputProps={{
                startAdornment: <Search sx={{ color: 'action.active', mr: 1 }} />,
                endAdornment: searchText && (
                  <IconButton
                    size="small"
                    onClick={() => setSearchText('')}
                    edge="end"
                  >
                    <Clear />
                  </IconButton>
                ),
              }}
              sx={{ mb: 2 }}
            />
            
            <TableContainer component={Paper} sx={{ maxHeight: 600 }}>
              <Table stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell padding="checkbox">
                      <Checkbox
                        indeterminate={selectedEmployees.length > 0 && selectedEmployees.length < filteredEmployees.length}
                        checked={selectedEmployees.length === filteredEmployees.length && filteredEmployees.length > 0}
                        onChange={handleSelectAll}
                      />
                    </TableCell>
                    <TableCell>Name</TableCell>
                    <TableCell>Email</TableCell>
                    <TableCell>Position</TableCell>
                    <TableCell>Phone</TableCell>
                    <TableCell>Supervisor</TableCell>
                    <TableCell>Cost Centers</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredEmployees.map((employee) => (
                    <TableRow key={employee.id}>
                      <TableCell padding="checkbox">
                        <Checkbox
                          checked={selectedEmployees.includes(employee.id)}
                          onChange={() => handleSelectEmployee(employee.id)}
                        />
                      </TableCell>
                      <TableCell>
                        <Box
                          onClick={() => handleViewEmployee(employee)}
                          sx={{
                            cursor: 'pointer',
                            color: 'primary.main',
                            fontWeight: 500,
                            '&:hover': {
                              textDecoration: 'underline',
                            },
                          }}
                        >
                          {employee.name}
                        </Box>
                      </TableCell>
                      <TableCell>{employee.email}</TableCell>
                      <TableCell>{employee.position}</TableCell>
                      <TableCell>{employee.phoneNumber}</TableCell>
                      <TableCell>
                        {employee.supervisorId ? 
                          existingEmployees.find(emp => emp.id === employee.supervisorId)?.name || 'Unknown' :
                          'No Supervisor'
                        }
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                          {parseCostCenters(employee.costCenters).map(center => (
                            <Chip 
                              key={center} 
                              label={center} 
                              size="small" 
                              clickable={!showArchived}
                              onClick={showArchived ? undefined : () => handleQuickCostCenterEdit(employee)}
                              sx={{ 
                                mr: 0.5,
                                cursor: showArchived ? 'default' : 'pointer',
                                '&:hover': showArchived ? {} : {
                                  backgroundColor: 'primary.light',
                                  color: 'primary.contrastText'
                                }
                              }}
                            />
                          ))}
                        </Box>
                        {!showArchived && (
                          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                            Click to edit cost centers
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        {showArchived ? (
                          <>
                            <Tooltip title="Restore Employee">
                              <IconButton 
                                size="small" 
                                onClick={() => handleRestoreEmployee(employee.id)}
                                color="primary"
                              >
                                <Restore />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Permanently Delete Employee">
                              <IconButton 
                                size="small" 
                                onClick={() => handleDeleteClick(employee.id)}
                                color="error"
                              >
                                <FolderDelete />
                              </IconButton>
                            </Tooltip>
                          </>
                        ) : (
                          <>
                            <Tooltip title="Edit Employee">
                              <IconButton 
                                size="small" 
                                onClick={() => handleEditEmployee(employee)}
                              >
                                <Edit />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Reset Password">
                              <IconButton 
                                size="small" 
                                onClick={() => handleResetPassword(employee)}
                                color="primary"
                              >
                                <LockReset />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Archive Employee">
                              <IconButton 
                                size="small" 
                                onClick={() => handleDeleteEmployee(employee.id)}
                                color="warning"
                              >
                                <Archive />
                              </IconButton>
                            </Tooltip>
                          </>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredEmployees.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} align="center" sx={{ py: 8 }}>
                        <Search sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
                        <Typography variant="h6" color="text.secondary" gutterBottom>
                          No employees found
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {searchText 
                            ? `No results for "${searchText}". Try a different search term.`
                            : showArchived
                            ? 'No archived employees found.'
                            : 'No employees have been added yet. Click "Add Employee" to get started.'}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      </TabPanel>

      {/* Bulk Import Tab */}
      <TabPanel value={activeTab} index={1}>
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Import Employees from CSV
            </Typography>
            
            <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
              <Button
                variant="contained"
                startIcon={<CloudUpload />}
                onClick={() => fileInputRef.current?.click()}
              >
                Upload CSV File
              </Button>
              
              <Button
                variant="outlined"
                startIcon={<Download />}
                onClick={handleDownloadTemplate}
              >
                Download Template
              </Button>
              
              <Button
                variant="outlined"
                startIcon={<Download />}
                onClick={handleExportEmployees}
              >
                Export Current Employees
              </Button>
            </Box>

            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              style={{ display: 'none' }}
            />

            {csvData && (
              <Box sx={{ mt: 2 }}>
                <Button
                  variant="contained"
                  onClick={handleImport}
                  disabled={isImporting}
                  sx={{ mb: 2 }}
                >
                  {isImporting ? 'Importing...' : 'Import Employees'}
                </Button>
                
                {isImporting && <LinearProgress sx={{ mb: 2 }} />}
              </Box>
            )}
          </CardContent>
        </Card>

        {/* Preview Section */}
        {showPreview && previewData.length > 0 && (
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Preview ({previewData.length} employees)
              </Typography>
              
              <TableContainer component={Paper} sx={{ maxHeight: 400 }}>
                <Table stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell>Name</TableCell>
                      <TableCell>Email</TableCell>
                      <TableCell>Position</TableCell>
                      <TableCell>Phone</TableCell>
                      <TableCell>Supervisor</TableCell>
                      <TableCell>Cost Centers</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {previewData.slice(0, 10).map((employee, index) => (
                      <TableRow key={index}>
                        <TableCell>{employee.FULL_NAME}</TableCell>
                        <TableCell>{employee.WORK_EMAIL}</TableCell>
                        <TableCell>{employee.EMPLOYEE_TITLE}</TableCell>
                        <TableCell>{employee.PHONE}</TableCell>
                        <TableCell>{employee.SUPERVISOR_EMAIL || 'No Supervisor'}</TableCell>
                        <TableCell>
                          {BulkImportService.parseCostCenters(employee.COST_CENTER).map(center => (
                            <Chip key={center} label={center} size="small" sx={{ mr: 0.5 }} />
                          ))}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
              
              {previewData.length > 10 && (
                <Typography variant="body2" sx={{ mt: 1, fontStyle: 'italic' }}>
                  Showing first 10 employees. Total: {previewData.length}
                </Typography>
              )}
            </CardContent>
          </Card>
        )}

        {/* Import Results */}
        {importResult && (
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Import Results
              </Typography>
              
              <Alert 
                severity={importResult.success ? 'success' : 'warning'}
                sx={{ mb: 2 }}
              >
                Processed {importResult.totalProcessed} employees. 
                {importResult.successful} successful, {importResult.failed} failed.
              </Alert>

              {importResult.errors.length > 0 && (
                <Box>
                  <Typography variant="subtitle2" gutterBottom>
                    Errors:
                  </Typography>
                  {importResult.errors.map((error, index) => (
                    <Alert key={index} severity="error" sx={{ mb: 1 }}>
                      {error}
                    </Alert>
                  ))}
                </Box>
              )}
            </CardContent>
          </Card>
        )}
      </TabPanel>

      {/* Mass Operations Tab */}
      <TabPanel value={activeTab} index={2}>
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Mass Operations ({selectedEmployees.length} selected)
            </Typography>
            
            <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
              <Button
                variant="contained"
                startIcon={<Edit />}
                onClick={handleBulkEdit}
                disabled={selectedEmployees.length === 0}
              >
                Bulk Edit Selected
              </Button>
              
              <Button
                variant="outlined"
                startIcon={<Delete />}
                onClick={handleBulkDelete}
                disabled={selectedEmployees.length === 0}
                color="error"
              >
                Delete Selected
              </Button>
              
              <Button
                variant="outlined"
                startIcon={<Clear />}
                onClick={() => setSelectedEmployees([])}
                disabled={selectedEmployees.length === 0}
              >
                Clear Selection
              </Button>
            </Box>

            {selectedEmployees.length > 0 && (
              <Alert severity="info" sx={{ mb: 2 }}>
                {selectedEmployees.length} employees selected for mass operations
              </Alert>
            )}
          </CardContent>
        </Card>
      </TabPanel>

      {/* Employee Edit Dialog */}
      <Dialog 
        open={showEmployeeDialog} 
        onClose={() => {
          setShowEmployeeDialog(false);
          setSelectedCostCenters([]);
          setDefaultCostCenter('');
          setShowEmployeeCostCenterDropdown(false);
        }}
        maxWidth="lg"
        fullWidth
        PaperProps={{
          sx: { 
            height: '90vh', 
            maxHeight: 800,
            minHeight: 600
          }
        }}
      >
        <DialogTitle>
          {editingEmployee?.id ? 'Edit Employee' : 'Add Employee'}
        </DialogTitle>
        <DialogContent>
          {editingEmployee && (
            <Box sx={{ pt: 2 }}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Box sx={{ display: 'flex', gap: 2 }}>
                  <TextField
                    fullWidth
                    label="Name"
                    value={editingEmployee.name}
                    onChange={(e) => setEditingEmployee({
                      ...editingEmployee,
                      name: e.target.value
                    })}
                  />
                  <TextField
                    fullWidth
                    label="Email"
                    value={editingEmployee.email}
                    onChange={(e) => setEditingEmployee({
                      ...editingEmployee,
                      email: e.target.value
                    })}
                  />
                </Box>
                
                <Box sx={{ display: 'flex', gap: 2 }}>
                  <FormControl fullWidth>
                    <InputLabel>Role</InputLabel>
                    <Select
                      value={editingEmployee.position}
                      onChange={(e) => setEditingEmployee({
                        ...editingEmployee,
                        position: e.target.value
                      })}
                      label="Role"
                    >
                      <MenuItem value="Staff">Staff</MenuItem>
                      <MenuItem value="Supervisor">Supervisor</MenuItem>
                      <MenuItem value="Manager">Manager</MenuItem>
                      <MenuItem value="Director">Director</MenuItem>
                      <MenuItem value="Admin">Admin</MenuItem>
                      <MenuItem value="CEO">CEO</MenuItem>
                    </Select>
                  </FormControl>
                  <TextField
                    fullWidth
                    label="Job Title"
                    value={editingEmployee.preferredName || ''}
                    onChange={(e) => setEditingEmployee({
                      ...editingEmployee,
                      preferredName: e.target.value
                    })}
                    placeholder="e.g., Outreach Worker, Regional Manager"
                  />
                </Box>
                
                <Box sx={{ display: 'flex', gap: 2 }}>
                  <TextField
                    fullWidth
                    label="Phone"
                    value={editingEmployee.phoneNumber}
                    onChange={(e) => setEditingEmployee({
                      ...editingEmployee,
                      phoneNumber: e.target.value
                    })}
                  />
                </Box>
                
                <TextField
                  fullWidth
                  label="Base Address"
                  value={editingEmployee.baseAddress}
                  onChange={(e) => setEditingEmployee({
                    ...editingEmployee,
                    baseAddress: e.target.value
                  })}
                />
                
                {/* Supervisor Assignment */}
                <FormControl fullWidth>
                  <InputLabel>Supervisor</InputLabel>
                  <Select
                    value={editingEmployee.supervisorId || ''}
                    onChange={(e) => setEditingEmployee({
                      ...editingEmployee,
                      supervisorId: e.target.value || undefined
                    })}
                    label="Supervisor"
                  >
                    <MenuItem value="">
                      <em>No Supervisor</em>
                    </MenuItem>
                    {existingEmployees
                      .filter(emp => ['Supervisor', 'Manager', 'Director', 'Admin', 'CEO'].includes(emp.position))
                      .map(emp => (
                        <MenuItem key={emp.id} value={emp.id}>
                          {emp.name} ({emp.position})
                        </MenuItem>
                      ))}
                  </Select>
                </FormControl>
                
                <Box sx={{ display: 'flex', gap: 2 }}>
                  <TextField
                    fullWidth
                    label="Employee ID"
                    value={editingEmployee.oxfordHouseId}
                    onChange={(e) => setEditingEmployee({
                      ...editingEmployee,
                      oxfordHouseId: e.target.value
                    })}
                  />
                  <TextField
                    fullWidth
                    label="Password"
                    type="password"
                    value={editingEmployee.password || ''}
                    placeholder={editingEmployee.password && editingEmployee.password.startsWith('$2b$') ? 'Enter new password to change' : 'Enter password'}
                    onChange={(e) => setEditingEmployee({
                      ...editingEmployee,
                      password: e.target.value
                    })}
                    helperText={editingEmployee.password && editingEmployee.password.startsWith('$2b$') ? 'Current password is hashed. Enter a new password to change it.' : 'Leave empty to keep current password'}
                  />
                </Box>
                
                {/* Cost Centers Selection */}
                <FormControl fullWidth sx={{ mt: 2, position: 'relative' }}>
                  <InputLabel>Cost Centers</InputLabel>
                  <OutlinedInput 
                    label="Cost Centers" 
                    value=""
                    readOnly
                    onClick={() => setShowEmployeeCostCenterDropdown(!showEmployeeCostCenterDropdown)}
                    endAdornment={
                      <InputAdornment position="end">
                        <IconButton onClick={() => setShowEmployeeCostCenterDropdown(!showEmployeeCostCenterDropdown)}>
                          {showEmployeeCostCenterDropdown ? <ExpandLess /> : <ExpandMore />}
                        </IconButton>
                      </InputAdornment>
                    }
                    sx={{ cursor: 'pointer' }}
                  />
                  {showEmployeeCostCenterDropdown && (
                    <Paper 
                      ref={employeeDropdownRef}
                      sx={{ 
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        right: 0,
                        zIndex: 1300,
                        maxHeight: 500,
                        border: 1,
                        borderColor: 'divider',
                        borderTop: 0,
                        boxShadow: 3
                      }}
                    >
                      <Box sx={{ height: 500, display: 'flex', flexDirection: 'column' }}>
                        {/* Selected Items - Fixed at Top */}
                        {selectedCostCenters.length > 0 && (
                          <Box sx={{ 
                            flexShrink: 0,
                            borderBottom: 1, 
                            borderColor: 'divider',
                            backgroundColor: 'primary.light',
                            color: 'primary.contrastText',
                            p: 2,
                            maxHeight: 200,
                            overflow: 'auto'
                          }}>
                            <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1 }}>
                              Selected ({selectedCostCenters.length})
                            </Typography>
                            {selectedCostCenters
                              .sort((a, b) => a.localeCompare(b))
                              .map((costCenter: string) => (
                                <MenuItem 
                                  key={costCenter} 
                                  onClick={() => {
                                    setSelectedCostCenters(prev => prev.filter(item => item !== costCenter));
                                    // If only one cost center is selected, set it as default
                                    if (selectedCostCenters.length === 2) {
                                      setDefaultCostCenter(selectedCostCenters.find(item => item !== costCenter) || '');
                                    }
                                    // If default cost center is removed, clear it
                                    if (costCenter === defaultCostCenter) {
                                      setDefaultCostCenter('');
                                    }
                                  }}
                                  sx={{ 
                                    py: 1,
                                    '&:hover': { backgroundColor: 'primary.main' }
                                  }}
                                >
                                  <Checkbox checked={true} sx={{ color: 'primary.contrastText' }} />
                                  <ListItemText 
                                    primary={costCenter} 
                                    sx={{ color: 'primary.contrastText' }}
                                  />
                                </MenuItem>
                              ))}
                          </Box>
                        )}
                        
                        {/* Unselected Items - Scrollable Below */}
                        <Box sx={{ 
                          flex: 1,
                          overflow: 'auto',
                          minHeight: 0
                        }}>
                          <Typography variant="subtitle2" sx={{ 
                            p: 2, 
                            fontWeight: 'bold', 
                            borderBottom: 1, 
                            borderColor: 'divider',
                            position: 'sticky',
                            top: 0,
                            backgroundColor: 'background.paper',
                            zIndex: 1
                          }}>
                            Available ({COST_CENTERS.length - selectedCostCenters.length})
                          </Typography>
                          {COST_CENTERS
                            .filter(costCenter => !selectedCostCenters.includes(costCenter))
                            .sort((a, b) => a.localeCompare(b))
                            .map((costCenter: string) => (
                              <MenuItem 
                                key={costCenter} 
                                onClick={() => {
                                  setSelectedCostCenters(prev => [...prev, costCenter]);
                                  // If only one cost center is selected, set it as default
                                  if (selectedCostCenters.length === 0) {
                                    setDefaultCostCenter(costCenter);
                                  }
                                }}
                                sx={{ py: 1 }}
                              >
                                <Checkbox checked={false} />
                                <ListItemText primary={costCenter} />
                              </MenuItem>
                            ))}
                        </Box>
                      </Box>
                    </Paper>
                  )}
                </FormControl>
                
                {/* Default Cost Center Selection - Only show if multiple cost centers are selected */}
                {selectedCostCenters.length > 1 && (
                  <FormControl fullWidth sx={{ mt: 2 }}>
                    <InputLabel>Default Cost Center</InputLabel>
                    <Select
                      value={defaultCostCenter}
                      onChange={(e) => setDefaultCostCenter(e.target.value)}
                      label="Default Cost Center"
                    >
                      {selectedCostCenters.map((costCenter) => (
                        <MenuItem key={costCenter} value={costCenter}>
                          {costCenter}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                )}
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setShowEmployeeDialog(false);
            setSelectedCostCenters([]);
            setDefaultCostCenter('');
            setShowEmployeeCostCenterDropdown(false);
          }}>
            Cancel
          </Button>
          <Button onClick={handleSaveEmployee} variant="contained">
            Save
          </Button>
        </DialogActions>
      </Dialog>

      {/* Bulk Edit Dialog */}
      <Dialog 
        open={showBulkEditDialog} 
        onClose={() => setShowBulkEditDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          Bulk Edit {selectedEmployees.length} Employees
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Leave fields empty to keep existing values
            </Typography>
            
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Role</InputLabel>
              <Select
                value={(bulkEditData as any).position || ''}
                onChange={(e) => setBulkEditData({
                  ...bulkEditData,
                  position: e.target.value
                } as any)}
                label="Role"
              >
                <MenuItem value="">Keep existing role</MenuItem>
                <MenuItem value="Staff">Staff</MenuItem>
                <MenuItem value="Supervisor">Supervisor</MenuItem>
                <MenuItem value="Manager">Manager</MenuItem>
                <MenuItem value="Director">Director</MenuItem>
                <MenuItem value="Admin">Admin</MenuItem>
                <MenuItem value="CEO">CEO</MenuItem>
              </Select>
            </FormControl>
            
            <TextField
              fullWidth
              label="Base Address"
              value={bulkEditData.baseAddress || ''}
              onChange={(e) => setBulkEditData({
                ...bulkEditData,
                baseAddress: e.target.value
              })}
              sx={{ mb: 2 }}
            />
            
            {/* Supervisor Assignment */}
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Supervisor</InputLabel>
              <Select
                value={(bulkEditData as any).supervisorId || ''}
                onChange={(e) => setBulkEditData({
                  ...bulkEditData,
                  supervisorId: e.target.value || undefined
                } as any)}
                label="Supervisor"
              >
                <MenuItem value="">
                  <em>No Supervisor</em>
                </MenuItem>
                {existingEmployees
                  .filter(emp => ['Supervisor', 'Manager', 'Director', 'Admin', 'CEO'].includes(emp.position))
                  .map(emp => (
                    <MenuItem key={emp.id} value={emp.id}>
                      {emp.name} ({emp.position})
                    </MenuItem>
                  ))}
              </Select>
            </FormControl>
            
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Default Cost Center</InputLabel>
              <Select
                value={(bulkEditData as any).defaultCostCenter || ''}
                onChange={(e) => setBulkEditData({
                  ...bulkEditData,
                  defaultCostCenter: e.target.value
                } as any)}
              >
                {COST_CENTERS.map((costCenter) => (
                  <MenuItem key={costCenter} value={costCenter}>
                    {costCenter}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowBulkEditDialog(false)}>
            Cancel
          </Button>
          <Button onClick={handleSaveBulkEdit} variant="contained">
            Apply to {selectedEmployees.length} Employees
          </Button>
        </DialogActions>
      </Dialog>

      {/* Employee Profile View Dialog */}
      <Dialog 
        open={showProfileDialog} 
        onClose={() => setShowProfileDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6">Employee Profile</Typography>
            <Box>
              <Button 
                startIcon={<Edit />}
                onClick={handleEditFromProfile}
                variant="contained"
                sx={{ mr: 1 }}
              >
                Edit
              </Button>
              <IconButton onClick={() => setShowProfileDialog(false)}>
                <Clear />
              </IconButton>
            </Box>
          </Box>
        </DialogTitle>
        <DialogContent>
          {viewingEmployee && (
            <Box sx={{ pt: 2 }}>
              {/* Personal Information */}
              <Typography variant="h6" sx={{ mb: 2, color: 'primary.main' }}>
                Personal Information
              </Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, mb: 3 }}>
                <Box>
                  <Typography variant="caption" color="text.secondary">Name</Typography>
                  <Typography variant="body1" fontWeight={500}>{viewingEmployee.name}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">Email</Typography>
                  <Typography variant="body1">{viewingEmployee.email}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">Position</Typography>
                  <Typography variant="body1">{viewingEmployee.position}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">Phone</Typography>
                  <Typography variant="body1">{viewingEmployee.phoneNumber || 'Not provided'}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">Supervisor</Typography>
                  <Typography variant="body1">
                    {viewingEmployee.supervisorId ? 
                      existingEmployees.find(emp => emp.id === viewingEmployee.supervisorId)?.name || 'Unknown' :
                      'No Supervisor'
                    }
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">Oxford House ID</Typography>
                  <Typography variant="body1">{viewingEmployee.oxfordHouseId}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">Employee ID</Typography>
                  <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                    {viewingEmployee.id}
                  </Typography>
                </Box>
              </Box>

              {/* Address Information */}
              <Typography variant="h6" sx={{ mb: 2, color: 'primary.main' }}>
                Address Information
              </Typography>
              <Box sx={{ mb: 3 }}>
                <Typography variant="caption" color="text.secondary">Base Address</Typography>
                <Typography variant="body1">{viewingEmployee.baseAddress || 'Not provided'}</Typography>
              </Box>

              {/* Cost Centers */}
              <Typography variant="h6" sx={{ mb: 2, color: 'primary.main' }}>
                Cost Centers
              </Typography>
              <Box sx={{ mb: 2 }}>
                <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                  Assigned Cost Centers
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {parseCostCenters(viewingEmployee.costCenters).map(center => (
                    <Chip 
                      key={center} 
                      label={center} 
                      color={center === viewingEmployee.defaultCostCenter ? 'primary' : 'default'}
                      icon={center === viewingEmployee.defaultCostCenter ? <Typography sx={{ ml: 1 }}>⭐</Typography> : undefined}
                    />
                  ))}
                </Box>
                {viewingEmployee.defaultCostCenter && (
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                    ⭐ Default: {viewingEmployee.defaultCostCenter}
                  </Typography>
                )}
              </Box>

              {/* Account Information */}
              <Typography variant="h6" sx={{ mb: 2, color: 'primary.main' }}>
                Account Information
              </Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                <Box>
                  <Typography variant="caption" color="text.secondary">Created</Typography>
                  <Typography variant="body2">
                    {viewingEmployee.createdAt 
                      ? new Date(viewingEmployee.createdAt).toLocaleDateString() 
                      : 'N/A'}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">Last Updated</Typography>
                  <Typography variant="body2">
                    {viewingEmployee.updatedAt 
                      ? new Date(viewingEmployee.updatedAt).toLocaleDateString() 
                      : 'N/A'}
                  </Typography>
                </Box>
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowProfileDialog(false)}>
            Close
          </Button>
          <Button 
            onClick={handleEditFromProfile}
            variant="contained"
            startIcon={<Edit />}
          >
            Edit Employee
          </Button>
        </DialogActions>
      </Dialog>

      {/* Quick Cost Center Edit Dialog */}
      <Dialog 
        open={showQuickCostCenterEdit} 
        onClose={() => setShowQuickCostCenterEdit(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: { height: '80vh', maxHeight: 600 }
        }}
      >
        <DialogTitle>
          Edit Cost Centers for {quickEditEmployee?.name}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Select or deselect cost centers for this employee
            </Typography>
            
            <FormControl fullWidth>
              <InputLabel>Cost Centers</InputLabel>
              <OutlinedInput 
                label="Cost Centers" 
                value=""
                readOnly
                onClick={() => setShowCostCenterDropdown(!showCostCenterDropdown)}
                endAdornment={
                  <InputAdornment position="end">
                    <IconButton onClick={() => setShowCostCenterDropdown(!showCostCenterDropdown)}>
                      {showCostCenterDropdown ? <ExpandLess /> : <ExpandMore />}
                    </IconButton>
                  </InputAdornment>
                }
                sx={{ cursor: 'pointer' }}
              />
              {showCostCenterDropdown && (
                <Paper 
                  ref={dropdownRef}
                  elevation={0}
                  sx={{ 
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    zIndex: 1300,
                    maxHeight: 300,
                    border: 'none',
                    boxShadow: 'none'
                  }}
                >
                  <Box sx={{ height: 400, display: 'flex', flexDirection: 'column' }}>
                    {/* Selected Items - Fixed at Top */}
                    {quickEditCostCenters.length > 0 && (
                      <Box sx={{ 
                        flexShrink: 0,
                        borderBottom: 1, 
                        borderColor: 'divider',
                        backgroundColor: 'primary.light',
                        color: 'primary.contrastText',
                        p: 1,
                        maxHeight: 150,
                        overflow: 'auto'
                      }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1 }}>
                          Selected ({quickEditCostCenters.length})
                        </Typography>
                        {quickEditCostCenters
                          .sort((a, b) => a.localeCompare(b))
                          .map((costCenter: string) => (
                          <MenuItem 
                            key={costCenter}
                            divider={false}
                            onClick={() => {
                              setQuickEditCostCenters(prev => prev.filter(item => item !== costCenter));
                            }}
                            sx={{ 
                              py: 0.5,
                              '&:hover': { backgroundColor: 'primary.main' },
                              border: 'none',
                              borderBottom: 'none',
                              borderTop: 'none'
                            }}
                          >
                              <Checkbox checked={true} sx={{ color: 'primary.contrastText' }} />
                              <ListItemText 
                                primary={costCenter} 
                                sx={{ color: 'primary.contrastText' }}
                              />
                            </MenuItem>
                          ))}
                      </Box>
                    )}
                    
                    {/* Unselected Items - Scrollable Below */}
                    <Box sx={{ 
                      flex: 1, 
                      overflow: 'auto',
                      minHeight: 0
                    }}>
                      <Typography variant="subtitle2" sx={{ 
                        p: 1, 
                        fontWeight: 'bold', 
                        position: 'sticky',
                        top: 0,
                        backgroundColor: 'background.paper',
                        zIndex: 1
                      }}>
                        Available ({COST_CENTERS.length - quickEditCostCenters.length})
                      </Typography>
                      {COST_CENTERS
                        .filter(costCenter => !quickEditCostCenters.includes(costCenter))
                        .sort((a, b) => a.localeCompare(b))
                        .map((costCenter: string) => (
                          <MenuItem 
                            key={costCenter}
                            divider={false}
                            onClick={() => {
                              setQuickEditCostCenters(prev => [...prev, costCenter]);
                            }}
                            sx={{ 
                              py: 0.5,
                              border: 'none',
                              borderBottom: 'none',
                              borderTop: 'none'
                            }}
                          >
                            <Checkbox checked={false} />
                            <ListItemText primary={costCenter} />
                          </MenuItem>
                        ))}
                    </Box>
                  </Box>
                </Paper>
              )}
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowQuickCostCenterEdit(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleSaveQuickCostCenterEdit} 
            variant="contained"
            disabled={quickEditCostCenters.length === 0}
          >
            Save Cost Centers
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteConfirmOpen}
        onClose={() => {
          setDeleteConfirmOpen(false);
          setDeleteConfirmText('');
          setEmployeeToDelete(null);
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <FolderDelete color="error" />
            <Typography variant="h6">Permanently Delete Employee</Typography>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            <Typography variant="body2" fontWeight="bold">
              Warning: This action cannot be undone!
            </Typography>
            <Typography variant="body2">
              This will permanently delete the employee and all associated data. 
              This action is only available for archived employees.
            </Typography>
          </Alert>
          <Typography variant="body1" sx={{ mb: 2 }}>
            To confirm permanent deletion, please type <strong>CONFIRM</strong> in the field below:
          </Typography>
          <TextField
            fullWidth
            label="Type CONFIRM to delete"
            value={deleteConfirmText}
            onChange={(e) => setDeleteConfirmText(e.target.value)}
            placeholder="CONFIRM"
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setDeleteConfirmOpen(false);
              setDeleteConfirmText('');
              setEmployeeToDelete(null);
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleDeleteConfirm}
            variant="contained"
            color="error"
            disabled={deleteConfirmText !== 'CONFIRM'}
            startIcon={<FolderDelete />}
          >
            Permanently Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
