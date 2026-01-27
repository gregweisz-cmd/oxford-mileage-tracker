import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Tabs,
  Tab,
  Container,
  Alert,
  Snackbar
} from '@mui/material';
import { EmployeeManagementComponent } from './EmployeeManagementComponent';
import { CostCenterManagement } from './CostCenterManagement';
import { ReportsAnalyticsTab } from './ReportsAnalyticsTab';
import { SupervisorManagement } from './SupervisorManagement';
import { SystemSettings } from './SystemSettings';
import { TravelReasonsManagement } from './TravelReasonsManagement';
import { DailyDescriptionOptionsManagement } from './DailyDescriptionOptionsManagement';
import { EmployeeApiService } from '../services/employeeApiService';
import { BulkImportResult } from '../services/bulkImportService';
import { debugLog, debugError, debugVerbose } from '../config/debug';
import { Employee } from '../types';
import { NotificationBell } from './NotificationBell';
// import OxfordHouseLogo from './OxfordHouseLogo'; // Logo is in PortalSwitcher

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

  const showSnackbar = useCallback((message: string, severity: 'success' | 'error' | 'info' | 'warning') => {
    setSnackbar({ open: true, message, severity });
  }, []);

  const loadEmployees = useCallback(async (skipCache: boolean = false) => {
    try {
      setLoading(true);
      const employeeData = await EmployeeApiService.getAllEmployees(skipCache);
      debugVerbose(`📊 Loaded ${employeeData.length} employees${skipCache ? ' (cache bypassed)' : ''}`);
      setEmployees(employeeData);
    } catch (error) {
      debugError('Error loading employees:', error);
      showSnackbar('Failed to load employees', 'error');
    } finally {
      setLoading(false);
    }
  }, [showSnackbar]);

  useEffect(() => {
    loadEmployees();
  }, [loadEmployees]);

  const handleCreateEmployee = async (employee: Omit<Employee, 'id' | 'createdAt' | 'updatedAt'>): Promise<Employee> => {
    try {
      const createdEmployee = await EmployeeApiService.createEmployee(employee);
      await loadEmployees(); // Refresh the list
      showSnackbar('Employee created successfully', 'success');
      return createdEmployee;
    } catch (error) {
      debugError('Error creating employee:', error);
      showSnackbar('Failed to create employee', 'error');
      throw error;
    }
  };

  const handleUpdateEmployee = async (id: string, employee: Partial<Employee>): Promise<void> => {
    try {
      await EmployeeApiService.updateEmployee(id, employee);
      await loadEmployees(true); // Refresh the list, skip cache
      showSnackbar('Employee updated successfully', 'success');
    } catch (error) {
      debugError('Error updating employee:', error);
      showSnackbar('Failed to update employee', 'error');
      throw error;
    }
  };

  const handleDeleteEmployee = async (id: string): Promise<void> => {
    try {
      // Archive instead of delete - employees should be archived first, then permanently deleted from archived section
      await EmployeeApiService.archiveEmployee(id);
      await loadEmployees(); // Refresh the list
      showSnackbar('Employee archived successfully', 'success');
    } catch (error: any) {
      debugError('Error archiving employee:', error);
      showSnackbar(error.message || 'Failed to archive employee', 'error');
      throw error;
    }
  };

  const handleBulkUpdateEmployees = async (employeeIds: string[], updates: Partial<Employee>): Promise<void> => {
    try {
      const result = await EmployeeApiService.bulkUpdateEmployees({ employeeIds, updates });
      await loadEmployees(); // Refresh the list
      showSnackbar(`Successfully updated ${result.updatedCount} employees`, 'success');
    } catch (error) {
      debugError('Error bulk updating employees:', error);
      showSnackbar('Failed to bulk update employees', 'error');
      throw error;
    }
  };

  const handleBulkDeleteEmployees = async (employeeIds: string[]): Promise<void> => {
    try {
      debugLog(`🗑️ Deleting ${employeeIds.length} employees:`, employeeIds);
      const result = await EmployeeApiService.bulkDeleteEmployees({ employeeIds });
      debugLog(`✅ Delete result:`, result);
      await loadEmployees(true); // Refresh the list, skip cache
      showSnackbar(`Successfully deleted ${result.deletedCount} employees`, 'success');
    } catch (error) {
      debugError('Error bulk deleting employees:', error);
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
      <Container maxWidth="xl" sx={{ mt: 3 }}>
        {/* Header */}
        <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box>
            <Typography variant="h4" gutterBottom>
              👨‍💼 Admin Portal
            </Typography>
            <Typography variant="subtitle1" color="textSecondary">
              Welcome, {adminName}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {/* Notification Bell */}
            <NotificationBell employeeId={adminId} role="admin" />
          </Box>
        </Box>

        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={activeTab} onChange={(e, newValue) => setActiveTab(newValue)}>
            <Tab label="Employee Management" />
            <Tab label="Supervisor Management" />
            <Tab label="Cost Center Management" />
            <Tab label="Reports & Analytics" />
            <Tab label="Travel Reasons" />
            <Tab label="Daily Description" />
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
            onRefresh={() => loadEmployees(true)}
          />
        </TabPanel>

        <TabPanel value={activeTab} index={1}>
          <SupervisorManagement
            employees={employees}
            onUpdateEmployee={handleUpdateEmployee}
            onBulkUpdateEmployees={handleBulkUpdateEmployees}
            onRefresh={() => loadEmployees(true)}
          />
        </TabPanel>

        <TabPanel value={activeTab} index={2}>
          <CostCenterManagement />
        </TabPanel>

        <TabPanel value={activeTab} index={3}>
          <ReportsAnalyticsTab />
        </TabPanel>

        <TabPanel value={activeTab} index={4}>
          <TravelReasonsManagement />
        </TabPanel>

        <TabPanel value={activeTab} index={5}>
          <DailyDescriptionOptionsManagement />
        </TabPanel>

        <TabPanel value={activeTab} index={6}>
          <SystemSettings />
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
