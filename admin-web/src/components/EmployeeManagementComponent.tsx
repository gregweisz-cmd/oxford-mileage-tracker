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
} from '@mui/material';
import {
  CloudUpload,
  Download,
  Delete,
  Edit,
  Add,
  Clear,
  LockReset,
  Search
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
  onBulkDeleteEmployees
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
  const [isEditMode, setIsEditMode] = useState(false);
  const [showQuickCostCenterEdit, setShowQuickCostCenterEdit] = useState(false);
  const [quickEditEmployee, setQuickEditEmployee] = useState<Employee | null>(null);
  const [quickEditCostCenters, setQuickEditCostCenters] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Filter employees based on search text
  const filteredEmployees = existingEmployees.filter(employee => {
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
      const employees = importData.map(data => BulkImportService.convertToEmployee(data));
      
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
    setIsEditMode(false);
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
      const updatedEmployee = {
        ...editingEmployee,
        costCenters: selectedCostCenters,
        selectedCostCenters: selectedCostCenters,
        defaultCostCenter: defaultCostCenter || selectedCostCenters[0]
      };
      
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
    if (window.confirm('Are you sure you want to delete this employee?')) {
      try {
        await onDeleteEmployee(employeeId);
      } catch (error) {
        console.error('Error deleting employee:', error);
      }
    }
  };

  const handleResetPassword = async (employee: Employee) => {
    const newPassword = `${employee.name.split(' ')[0]}welcome1`;
    
    if (window.confirm(`Reset password for ${employee.name} to "${newPassword}"?`)) {
      try {
        // Use dedicated password endpoint instead of full employee update
        const response = await fetch(`http://localhost:3002/api/employees/${employee.id}/password`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ password: newPassword }),
        });
        
        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Failed to reset password');
        }
        
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
                Current Employees ({filteredEmployees.length} {searchText && `of ${existingEmployees.length}`})
              </Typography>
              <Button
                variant="contained"
                startIcon={<Add />}
                onClick={handleAddEmployee}
              >
                Add Employee
              </Button>
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
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                          {parseCostCenters(employee.costCenters).map(center => (
                            <Chip 
                              key={center} 
                              label={center} 
                              size="small" 
                              clickable
                              onClick={() => handleQuickCostCenterEdit(employee)}
                              sx={{ 
                                mr: 0.5,
                                cursor: 'pointer',
                                '&:hover': {
                                  backgroundColor: 'primary.light',
                                  color: 'primary.contrastText'
                                }
                              }}
                            />
                          ))}
                        </Box>
                        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                          Click to edit cost centers
                        </Typography>
                      </TableCell>
                      <TableCell>
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
                        <Tooltip title="Delete Employee">
                          <IconButton 
                            size="small" 
                            onClick={() => handleDeleteEmployee(employee.id)}
                            color="error"
                          >
                            <Delete />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredEmployees.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} align="center" sx={{ py: 8 }}>
                        <Search sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
                        <Typography variant="h6" color="text.secondary" gutterBottom>
                          No employees found
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {searchText 
                            ? `No results for "${searchText}". Try a different search term.`
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
        }}
        maxWidth="md"
        fullWidth
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
                  <TextField
                    fullWidth
                    label="Position"
                    value={editingEmployee.position}
                    onChange={(e) => setEditingEmployee({
                      ...editingEmployee,
                      position: e.target.value
                    })}
                  />
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
                    value={editingEmployee.password}
                    onChange={(e) => setEditingEmployee({
                      ...editingEmployee,
                      password: e.target.value
                    })}
                  />
                </Box>
                
                {/* Cost Centers Selection */}
                <FormControl fullWidth sx={{ mt: 2 }}>
                  <InputLabel>Cost Centers</InputLabel>
                  <Select
                    multiple
                    value={selectedCostCenters}
                    onChange={(e) => {
                      const value = e.target.value as string[];
                      setSelectedCostCenters(value);
                      // If only one cost center is selected, set it as default
                      if (value.length === 1) {
                        setDefaultCostCenter(value[0]);
                      }
                      // If default cost center is removed, clear it
                      if (value.length > 1 && !value.includes(defaultCostCenter)) {
                        setDefaultCostCenter('');
                      }
                    }}
                    input={<OutlinedInput label="Cost Centers" />}
                    renderValue={(selected) => (
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {(selected as string[]).map((value) => (
                          <Chip key={value} label={value} size="small" />
                        ))}
                      </Box>
                    )}
                  >
                    {COST_CENTERS.map((costCenter: string) => (
                      <MenuItem key={costCenter} value={costCenter}>
                        <Checkbox checked={selectedCostCenters.indexOf(costCenter) > -1} />
                        <ListItemText primary={costCenter} />
                      </MenuItem>
                    ))}
                  </Select>
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
            
            <TextField
              fullWidth
              label="Position"
              value={(bulkEditData as any).position || ''}
              onChange={(e) => setBulkEditData({
                ...bulkEditData,
                position: e.target.value
              } as any)}
              sx={{ mb: 2 }}
            />
            
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
        maxWidth="sm"
        fullWidth
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
              <Select
                multiple
                value={quickEditCostCenters}
                onChange={(e) => setQuickEditCostCenters(e.target.value as string[])}
                input={<OutlinedInput label="Cost Centers" />}
                renderValue={(selected) => (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {(selected as string[]).map((value) => (
                      <Chip key={value} label={value} size="small" />
                    ))}
                  </Box>
                )}
              >
                {(() => {
                  // Create a sorted array with selected items first
                  const sortedCostCenters = [...COST_CENTERS].sort((a, b) => {
                    const aSelected = quickEditCostCenters.includes(a);
                    const bSelected = quickEditCostCenters.includes(b);
                    
                    // Selected items come first
                    if (aSelected && !bSelected) return -1;
                    if (!aSelected && bSelected) return 1;
                    
                    // Within each group (selected/unselected), sort alphabetically
                    return a.localeCompare(b);
                  });
                  
                  return sortedCostCenters.map((costCenter: string) => (
                    <MenuItem key={costCenter} value={costCenter}>
                      <Checkbox checked={quickEditCostCenters.includes(costCenter)} />
                      <ListItemText primary={costCenter} />
                    </MenuItem>
                  ));
                })()}
              </Select>
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
    </Box>
  );
};
