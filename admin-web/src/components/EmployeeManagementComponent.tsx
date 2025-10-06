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
  Tab
} from '@mui/material';
import {
  CloudUpload,
  Download,
  Delete,
  Edit,
  Add,
  Clear
} from '@mui/icons-material';
import { BulkImportService, BulkImportResult, EmployeeImportData } from '../services/bulkImportService';
import { Employee } from '../types';

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
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Helper function to safely parse costCenters
  const parseCostCenters = (costCenters: any): string[] => {
    console.log('🔍 parseCostCenters input:', costCenters, 'type:', typeof costCenters, 'isArray:', Array.isArray(costCenters));
    
    if (Array.isArray(costCenters)) {
      console.log('✅ Returning array as-is:', costCenters);
      return costCenters;
    }
    if (typeof costCenters === 'string') {
      try {
        const parsed = JSON.parse(costCenters);
        console.log('✅ Parsed JSON string:', parsed);
        return parsed;
      } catch (error) {
        console.log('❌ Failed to parse JSON, returning as single item:', costCenters);
        return [costCenters];
      }
    }
    if (costCenters && typeof costCenters === 'object') {
      console.log('🔧 Handling object type:', costCenters);
      // If it's an object, try to extract values or convert to array
      if (costCenters.toString && costCenters.toString() === '[object Object]') {
        console.log('❌ Detected [object Object], returning empty array');
        return [];
      }
      // Try to convert object to array of values
      const values = Object.values(costCenters);
      console.log('✅ Converted object to array:', values);
      return values.filter(v => typeof v === 'string') as string[];
    }
    console.log('❌ Unknown type, returning empty array');
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
      const result = await BulkImportService.processBulkImport(csvData, onCreateEmployee);
      setImportResult(result);
      onImportComplete(result);
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

  const handleBulkDelete = () => {
    if (selectedEmployees.length === 0) return;
    if (window.confirm(`Are you sure you want to delete ${selectedEmployees.length} employees?`)) {
      onBulkDeleteEmployees(selectedEmployees);
      setSelectedEmployees([]);
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
  const handleEditEmployee = (employee: Employee) => {
    setEditingEmployee(employee);
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
    setShowEmployeeDialog(true);
  };

  const handleSaveEmployee = async () => {
    if (!editingEmployee) return;
    
    try {
      if (editingEmployee.id) {
        await onUpdateEmployee(editingEmployee.id, editingEmployee);
      } else {
        await onCreateEmployee(editingEmployee);
      }
      setShowEmployeeDialog(false);
      setEditingEmployee(null);
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
                Current Employees ({existingEmployees.length})
              </Typography>
              <Button
                variant="contained"
                startIcon={<Add />}
                onClick={handleAddEmployee}
              >
                Add Employee
              </Button>
            </Box>
            
            <TableContainer component={Paper} sx={{ maxHeight: 600 }}>
              <Table stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell padding="checkbox">
                      <Checkbox
                        indeterminate={selectedEmployees.length > 0 && selectedEmployees.length < existingEmployees.length}
                        checked={selectedEmployees.length === existingEmployees.length && existingEmployees.length > 0}
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
                  {existingEmployees.map((employee) => (
                    <TableRow key={employee.id}>
                      <TableCell padding="checkbox">
                        <Checkbox
                          checked={selectedEmployees.includes(employee.id)}
                          onChange={() => handleSelectEmployee(employee.id)}
                        />
                      </TableCell>
                      <TableCell>{employee.name}</TableCell>
                      <TableCell>{employee.email}</TableCell>
                      <TableCell>{employee.position}</TableCell>
                      <TableCell>{employee.phoneNumber}</TableCell>
                      <TableCell>
                        {parseCostCenters(employee.costCenters).map(center => (
                          <Chip key={center} label={center} size="small" sx={{ mr: 0.5 }} />
                        ))}
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
        onClose={() => setShowEmployeeDialog(false)}
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
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowEmployeeDialog(false)}>
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
                <MenuItem value="Program Services">Program Services</MenuItem>
                <MenuItem value="Finance">Finance</MenuItem>
                <MenuItem value="G&A">G&A</MenuItem>
                <MenuItem value="Fundraising">Fundraising</MenuItem>
                <MenuItem value="IL-STATE">IL-STATE</MenuItem>
                <MenuItem value="MN-STATE">MN-STATE</MenuItem>
                <MenuItem value="WI-STATE">WI-STATE</MenuItem>
                <MenuItem value="WA.KING">WA.KING</MenuItem>
                <MenuItem value="OK-SUBG">OK-SUBG</MenuItem>
                <MenuItem value="SC-STATE">SC-STATE</MenuItem>
                <MenuItem value="OR-STATE">OR-STATE</MenuItem>
                <MenuItem value="AZ.MC-SUBG">AZ.MC-SUBG</MenuItem>
                <MenuItem value="KY-SOR">KY-SOR</MenuItem>
                <MenuItem value="NC.F-SOR">NC.F-SOR</MenuItem>
                <MenuItem value="FL-SOR">FL-SOR</MenuItem>
                <MenuItem value="NC.MECKCO-OSG">NC.MECKCO-OSG</MenuItem>
                <MenuItem value="TX-SUBG">TX-SUBG</MenuItem>
                <MenuItem value="WA-SUBG">WA-SUBG</MenuItem>
                <MenuItem value="NE-SOR">NE-SOR</MenuItem>
                <MenuItem value="TN-SUBG">TN-SUBG</MenuItem>
                <MenuItem value="TN-STATE">TN-STATE</MenuItem>
                <MenuItem value="OH-SOR">OH-SOR</MenuItem>
                <MenuItem value="OH-SOS">OH-SOS</MenuItem>
                <MenuItem value="NC.F-SUBG">NC.F-SUBG</MenuItem>
                <MenuItem value="NJ-SUBG">NJ-SUBG</MenuItem>
                <MenuItem value="NC.AHP">NC.AHP</MenuItem>
                <MenuItem value="LA-SOR">LA-SOR</MenuItem>
                <MenuItem value="NJ-SOR">NJ-SOR</MenuItem>
                <MenuItem value="CT-STATE">CT-STATE</MenuItem>
                <MenuItem value="DE-STATE">DE-STATE</MenuItem>
                <MenuItem value="NJ-STATE">NJ-STATE</MenuItem>
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
    </Box>
  );
};
