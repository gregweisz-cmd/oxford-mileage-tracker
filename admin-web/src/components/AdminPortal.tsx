import React, { useState, useEffect } from 'react';
import {
  Box,
  AppBar,
  Toolbar,
  Typography,
  Tabs,
  Tab,
  Container,
  Alert,
  Snackbar
} from '@mui/material';
import { EmployeeManagementComponent } from './EmployeeManagementComponent';
import { CostCenterManagement } from './CostCenterManagement';
import { EmployeeApiService } from '../services/employeeApiService';
import { BulkImportResult } from '../services/bulkImportService';
import { Employee } from '../types';

interface AdminPortalProps {
  adminId: string;
  adminName: string;
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
      id={`admin-tabpanel-${index}`}
      aria-labelledby={`admin-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

export const AdminPortal: React.FC<AdminPortalProps> = ({ adminId, adminName }) => {
  const [activeTab, setActiveTab] = useState(0);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [, setLoading] = useState(true);
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'info' | 'warning';
  }>({
    open: false,
    message: '',
    severity: 'info'
  });

  useEffect(() => {
    loadEmployees();
  }, []);

  const loadEmployees = async (skipCache: boolean = false) => {
    try {
      setLoading(true);
      const employeeData = await EmployeeApiService.getAllEmployees(skipCache);
      console.log(`📊 Loaded ${employeeData.length} employees${skipCache ? ' (cache bypassed)' : ''}`);
      setEmployees(employeeData);
    } catch (error) {
      console.error('Error loading employees:', error);
      showSnackbar('Failed to load employees', 'error');
    } finally {
      setLoading(false);
    }
  };

  const showSnackbar = (message: string, severity: 'success' | 'error' | 'info' | 'warning') => {
    setSnackbar({ open: true, message, severity });
  };

  const handleCreateEmployee = async (employee: Omit<Employee, 'id' | 'createdAt' | 'updatedAt'>): Promise<Employee> => {
    try {
      const createdEmployee = await EmployeeApiService.createEmployee(employee);
      await loadEmployees(); // Refresh the list
      showSnackbar('Employee created successfully', 'success');
      return createdEmployee;
    } catch (error) {
      console.error('Error creating employee:', error);
      showSnackbar('Failed to create employee', 'error');
      throw error;
    }
  };

  const handleUpdateEmployee = async (id: string, employee: Partial<Employee>): Promise<void> => {
    try {
      await EmployeeApiService.updateEmployee(id, employee);
      await loadEmployees(); // Refresh the list
      showSnackbar('Employee updated successfully', 'success');
    } catch (error) {
      console.error('Error updating employee:', error);
      showSnackbar('Failed to update employee', 'error');
      throw error;
    }
  };

  const handleDeleteEmployee = async (id: string): Promise<void> => {
    try {
      await EmployeeApiService.deleteEmployee(id);
      await loadEmployees(); // Refresh the list
      showSnackbar('Employee deleted successfully', 'success');
    } catch (error) {
      console.error('Error deleting employee:', error);
      showSnackbar('Failed to delete employee', 'error');
      throw error;
    }
  };

  const handleBulkUpdateEmployees = async (employeeIds: string[], updates: Partial<Employee>): Promise<void> => {
    try {
      const result = await EmployeeApiService.bulkUpdateEmployees({ employeeIds, updates });
      await loadEmployees(); // Refresh the list
      showSnackbar(`Successfully updated ${result.updatedCount} employees`, 'success');
    } catch (error) {
      console.error('Error bulk updating employees:', error);
      showSnackbar('Failed to bulk update employees', 'error');
      throw error;
    }
  };

  const handleBulkDeleteEmployees = async (employeeIds: string[]): Promise<void> => {
    try {
      console.log(`🗑️ Deleting ${employeeIds.length} employees:`, employeeIds);
      const result = await EmployeeApiService.bulkDeleteEmployees({ employeeIds });
      console.log(`✅ Delete result:`, result);
      await loadEmployees(true); // Refresh the list, skip cache
      showSnackbar(`Successfully deleted ${result.deletedCount} employees`, 'success');
    } catch (error) {
      console.error('Error bulk deleting employees:', error);
      showSnackbar('Failed to bulk delete employees', 'error');
      throw error;
    }
  };

  const handleImportComplete = (result: BulkImportResult) => {
    if (result.success) {
      showSnackbar(`Successfully imported ${result.successful} employees`, 'success');
      loadEmployees(); // Refresh the list
    } else {
      showSnackbar(`Import completed with ${result.failed} errors`, 'warning');
      loadEmployees(); // Refresh the list anyway
    }
  };

  const handleCloseSnackbar = () => {
    setSnackbar(prev => ({ ...prev, open: false }));
  };

  return (
    <Box sx={{ flexGrow: 1 }}>
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            Oxford House Admin Portal - Welcome, {adminName}
          </Typography>
        </Toolbar>
      </AppBar>

      <Container maxWidth="xl" sx={{ mt: 3 }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={activeTab} onChange={(e, newValue) => setActiveTab(newValue)}>
            <Tab label="Employee Management" />
            <Tab label="Cost Center Management" />
            <Tab label="Reports & Analytics" />
            <Tab label="System Settings" />
          </Tabs>
        </Box>

        <TabPanel value={activeTab} index={0}>
          <EmployeeManagementComponent
            onImportComplete={handleImportComplete}
            existingEmployees={employees}
            onCreateEmployee={handleCreateEmployee}
            onUpdateEmployee={handleUpdateEmployee}
            onDeleteEmployee={handleDeleteEmployee}
            onBulkUpdateEmployees={handleBulkUpdateEmployees}
            onBulkDeleteEmployees={handleBulkDeleteEmployees}
          />
        </TabPanel>

        <TabPanel value={activeTab} index={1}>
          <CostCenterManagement />
        </TabPanel>

        <TabPanel value={activeTab} index={2}>
          <Typography variant="h4" gutterBottom>
            Reports & Analytics
          </Typography>
          <Typography variant="body1" color="text.secondary">
            This section will contain comprehensive reporting and analytics features.
            Coming soon!
          </Typography>
        </TabPanel>

        <TabPanel value={activeTab} index={3}>
          <Typography variant="h4" gutterBottom>
            System Settings
          </Typography>
          <Typography variant="body1" color="text.secondary">
            This section will contain system configuration and settings.
            Coming soon!
          </Typography>
        </TabPanel>
      </Container>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert onClose={handleCloseSnackbar} severity={snackbar.severity} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};
