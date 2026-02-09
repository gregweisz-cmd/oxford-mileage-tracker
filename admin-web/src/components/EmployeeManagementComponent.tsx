import React, { useState, useRef, useMemo } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Typography,
  Alert,
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
  Popover,
} from '@mui/material';
import {
  CloudUpload,
  Edit,
  Add,
  Clear,
  LockReset,
  Search,
  ExpandMore,
  ExpandLess,
  Archive,
  Restore,
  FolderDelete,
  ArrowUpward,
  ArrowDownward,
  FilterList,
} from '@mui/icons-material';
import { EmployeeApiService } from '../services/employeeApiService';
import { Employee } from '../types';
import { COST_CENTERS } from '../constants/costCenters';
import { debugLog, debugError } from '../config/debug';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://oxford-mileage-backend.onrender.com';

const PORTAL_PERMISSIONS = [
  {
    id: 'admin',
    label: 'Admin Portal',
    description: 'Full system access - manage employees and settings',
  },
  {
    id: 'finance',
    label: 'Finance Portal',
    description: 'Review, export, and print expense reports',
  },
  {
    id: 'contracts',
    label: 'Contracts Portal',
    description: 'Review expense reports for quarterly audit',
  },
  {
    id: 'supervisor',
    label: 'Supervisor Portal',
    description: 'Review team reports and approve expenses',
  },
  {
    id: 'staff',
    label: 'Staff Portal',
    description: 'Manage your own expense reports and mileage',
  },
];

const getDefaultPermissions = (role: string, position: string): Array<'admin' | 'finance' | 'contracts' | 'supervisor' | 'staff'> => {
  const normalizedRole = (role || '').toLowerCase();
  const normalizedPosition = (position || '').toLowerCase();

  if (normalizedRole.includes('admin') || normalizedRole.includes('ceo')) {
    return ['admin', 'finance', 'contracts', 'supervisor', 'staff'];
  }
  if (normalizedRole.includes('finance') || normalizedRole.includes('accounting')) {
    return ['finance', 'staff'];
  }
  if (normalizedRole.includes('contracts')) {
    return ['contracts', 'staff'];
  }
  if (normalizedRole.includes('supervisor') || normalizedRole.includes('director') || normalizedRole.includes('manager')) {
    return ['supervisor', 'staff'];
  }

  if (!normalizedRole || normalizedRole === 'employee') {
    if (normalizedPosition.includes('admin') || normalizedPosition.includes('ceo')) {
      return ['admin', 'finance', 'contracts', 'supervisor', 'staff'];
    }
    if (normalizedPosition.includes('finance') || normalizedPosition.includes('accounting')) {
      return ['finance', 'staff'];
    }
    if (normalizedPosition.includes('contracts')) {
      return ['contracts', 'staff'];
    }
    if (normalizedPosition.includes('supervisor') || normalizedPosition.includes('director') || normalizedPosition.includes('regional manager') || normalizedPosition.includes('manager')) {
      return ['supervisor', 'staff'];
    }
  }

  return ['staff'];
};

interface EmployeeManagementProps {
  existingEmployees: Employee[];
  onCreateEmployee: (employee: Omit<Employee, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Employee>;
  onUpdateEmployee: (id: string, employee: Partial<Employee>) => Promise<void>;
  onDeleteEmployee: (id: string) => Promise<void>;
  onBulkUpdateEmployees: (employeeIds: string[], updates: Partial<Employee>) => Promise<void>;
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
  existingEmployees,
  onCreateEmployee,
  onUpdateEmployee,
  onDeleteEmployee,
  onBulkUpdateEmployees,
  onRefresh
}) => {
  const [activeTab, setActiveTab] = useState(0);
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);
  const [showEmployeeDialog, setShowEmployeeDialog] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [showBulkEditDialog, setShowBulkEditDialog] = useState(false);
  const [bulkEditData, setBulkEditData] = useState<Partial<Employee>>({});
  const [selectedCostCenters, setSelectedCostCenters] = useState<string[]>([]);
  const [defaultCostCenter, setDefaultCostCenter] = useState<string>('');
  const [searchText, setSearchText] = useState<string>('');
  const [showProfileDialog, setShowProfileDialog] = useState(false);
  const [viewingEmployee, setViewingEmployee] = useState<Employee | null>(null);
  
  // Sorting state
  const [sortBy, setSortBy] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  
  // Column filter state
  const [columnFilters, setColumnFilters] = useState<{
    name?: string;
    email?: string;
    position?: string;
    role?: string;
    lastLogin?: string;
    phone?: string;
    supervisor?: string;
    costCenters?: string;
  }>({});
  
  // Filter menu state
  const [filterMenuAnchor, setFilterMenuAnchor] = useState<{ [key: string]: HTMLElement | null }>({});
  // const [isEditMode, setIsEditMode] = useState(false); // Currently unused
  const [showQuickCostCenterEdit, setShowQuickCostCenterEdit] = useState(false);
  const [quickEditEmployee, setQuickEditEmployee] = useState<Employee | null>(null);
  const [quickEditCostCenters, setQuickEditCostCenters] = useState<string[]>([]);
  const [quickEditCostCenterSearch, setQuickEditCostCenterSearch] = useState('');
  const [showCostCenterDropdown, setShowCostCenterDropdown] = useState(false);
  const [showEmployeeCostCenterDropdown, setShowEmployeeCostCenterDropdown] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [archivedEmployees, setArchivedEmployees] = useState<Employee[]>([]);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [employeeToDelete, setEmployeeToDelete] = useState<string | null>(null);
  const [syncFromExternalLoading, setSyncFromExternalLoading] = useState(false);
  const [syncFromExternalMessage, setSyncFromExternalMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [syncPreviewOpen, setSyncPreviewOpen] = useState(false);
  const [syncPreviewPlan, setSyncPreviewPlan] = useState<{
    creates: Array<{ email: string; name: string; position: string; costCenters: string[] }>;
    updates: Array<{ email: string; name: string; position: string; costCenters: string[]; previous: { name: string; position: string; costCenters: string[] } }>;
    archives: Array<{ id: string; name: string; email: string }>;
  } | null>(null);
  const [syncPreviewApproved, setSyncPreviewApproved] = useState<{
    creates: Set<string>;
    updates: Set<string>;
    archives: Set<string>;
  }>({ creates: new Set(), updates: new Set(), archives: new Set() });
  const [syncApplyLoading, setSyncApplyLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const employeeDropdownRef = useRef<HTMLDivElement>(null);

  // Format phone number to (###) ###-####
  const formatPhoneNumber = (phone: string | null | undefined): string => {
    if (!phone || phone === '-') return '-';
    
    // Remove all non-numeric characters
    const cleaned = phone.replace(/\D/g, '');
    
    // If it starts with 1 (US country code), remove it
    const digits = cleaned.startsWith('1') && cleaned.length === 11 ? cleaned.slice(1) : cleaned;
    
    // Format as (###) ###-#### if we have 10 digits
    if (digits.length === 10) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    }
    
    // If not 10 digits, return original or cleaned if it's a reasonable format
    if (digits.length > 0) {
      return phone; // Return original if it doesn't match expected format
    }
    
    return '-';
  };

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

  // Filtered available cost centers for quick-edit dialog (excludes selected, filters by search)
  const quickEditAvailableCostCenters = useMemo(() => {
    const available = COST_CENTERS.filter(cc => !quickEditCostCenters.includes(cc));
    const q = quickEditCostCenterSearch.trim().toLowerCase();
    const filtered = q ? available.filter(cc => cc.toLowerCase().includes(q)) : available;
    return filtered.sort((a, b) => a.localeCompare(b));
  }, [quickEditCostCenters, quickEditCostCenterSearch]);

  // Load archived employees when viewing archived section
  React.useEffect(() => {
    if (showArchived) {
      loadArchivedEmployees();
    }
  }, [showArchived]);

  const loadArchivedEmployees = async () => {
    try {
      debugLog('🔄 Loading archived employees...');
      const archived = await EmployeeApiService.getArchivedEmployees();
      debugLog(`✅ Archived employees loaded: ${archived.length} employees`, archived);
      
      if (archived.length === 0) {
        debugLog('ℹ️ No archived employees found in database');
      }
      
      setArchivedEmployees(archived);
    } catch (error) {
      debugError('❌ Error loading archived employees:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      debugError('Error details:', errorMessage);
      alert(`Failed to load archived employees: ${errorMessage}`);
      // Set empty array on error to avoid stale data
      setArchivedEmployees([]);
    }
  };

  // Handle column sorting
  const handleSort = (column: string) => {
    if (sortBy === column) {
      // Toggle direction if clicking same column
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // Set new column and default to ascending
      setSortBy(column);
      setSortDirection('asc');
    }
  };

  // Handle column filter change
  const handleColumnFilterChange = (column: string, value: string) => {
    setColumnFilters(prev => ({
      ...prev,
      [column]: value || undefined
    }));
  };

  // Clear column filter
  const clearColumnFilter = (column: string) => {
    setColumnFilters(prev => {
      const newFilters = { ...prev };
      delete newFilters[column as keyof typeof newFilters];
      return newFilters;
    });
  };

  // Open filter menu
  const openFilterMenu = (column: string, event: React.MouseEvent<HTMLElement>) => {
    setFilterMenuAnchor(prev => ({
      ...prev,
      [column]: event.currentTarget
    }));
  };

  // Close filter menu
  const closeFilterMenu = (column: string) => {
    setFilterMenuAnchor(prev => ({
      ...prev,
      [column]: null
    }));
  };

  // Get unique values for a column (for filter dropdowns)
  const getUniqueColumnValues = (column: string): string[] => {
    const employees = showArchived ? archivedEmployees : existingEmployees;
    const values = new Set<string>();
    
    employees.forEach(employee => {
      let value: string | null | undefined;
      
      switch (column) {
        case 'position':
          value = employee.position;
          break;
        case 'role':
          value = employee.role || 'employee';
          break;
        case 'supervisor':
          value = employee.supervisorId ? 'Has Supervisor' : 'No Supervisor';
          break;
        default:
          return;
      }
      
      if (value) {
        values.add(value);
      }
    });
    
    return Array.from(values).sort();
  };

  // Filter and sort employees
  const filteredEmployees = React.useMemo(() => {
    let employees = (showArchived ? archivedEmployees : existingEmployees);
    
    // Apply global search text filter
    if (searchText) {
      const searchLower = searchText.toLowerCase();
      employees = employees.filter(employee =>
        employee.name?.toLowerCase().includes(searchLower) ||
        employee.email?.toLowerCase().includes(searchLower) ||
        employee.position?.toLowerCase().includes(searchLower) ||
        employee.phoneNumber?.toLowerCase().includes(searchLower)
      );
    }
    
    // Apply column-specific filters
    if (columnFilters.name) {
      const filterLower = columnFilters.name.toLowerCase();
      employees = employees.filter(emp => emp.name?.toLowerCase().includes(filterLower));
    }
    if (columnFilters.email) {
      const filterLower = columnFilters.email.toLowerCase();
      employees = employees.filter(emp => emp.email?.toLowerCase().includes(filterLower));
    }
    if (columnFilters.position) {
      employees = employees.filter(emp => emp.position === columnFilters.position);
    }
    if (columnFilters.role) {
      employees = employees.filter(emp => (emp.role || 'employee') === columnFilters.role);
    }
    if (columnFilters.phone) {
      const filterLower = columnFilters.phone.toLowerCase();
      employees = employees.filter(emp => 
        emp.phoneNumber?.toLowerCase().includes(filterLower) ||
        formatPhoneNumber(emp.phoneNumber)?.toLowerCase().includes(filterLower)
      );
    }
    if (columnFilters.supervisor) {
      if (columnFilters.supervisor === 'Has Supervisor') {
        employees = employees.filter(emp => emp.supervisorId);
      } else if (columnFilters.supervisor === 'No Supervisor') {
        employees = employees.filter(emp => !emp.supervisorId);
      }
    }
    
    // Apply sorting
    if (sortBy) {
      employees = [...employees].sort((a, b) => {
        let aValue: any;
        let bValue: any;
        
        switch (sortBy) {
          case 'name':
            aValue = a.name?.toLowerCase() || '';
            bValue = b.name?.toLowerCase() || '';
            break;
          case 'email':
            aValue = a.email?.toLowerCase() || '';
            bValue = b.email?.toLowerCase() || '';
            break;
          case 'position':
            aValue = a.position?.toLowerCase() || '';
            bValue = b.position?.toLowerCase() || '';
            break;
          case 'role':
            aValue = (a.role || 'employee').toLowerCase();
            bValue = (b.role || 'employee').toLowerCase();
            break;
          case 'lastLogin':
            aValue = a.lastLoginAt ? new Date(a.lastLoginAt).getTime() : 0;
            bValue = b.lastLoginAt ? new Date(b.lastLoginAt).getTime() : 0;
            break;
          case 'phone':
            aValue = a.phoneNumber?.toLowerCase() || '';
            bValue = b.phoneNumber?.toLowerCase() || '';
            break;
          case 'supervisor':
            aValue = a.supervisorId ? '1' : '0';
            bValue = b.supervisorId ? '1' : '0';
            break;
          default:
            return 0;
        }
        
        if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
    }
    
    return employees;
  }, [showArchived, archivedEmployees, existingEmployees, searchText, columnFilters, sortBy, sortDirection]);

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

  const handleSyncFromExternalApi = async () => {
    setSyncFromExternalLoading(true);
    setSyncFromExternalMessage(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/employees/sync-from-external/preview`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        const plan = data as { creates: Array<{ email: string; name: string; position: string; costCenters: string[] }>; updates: Array<{ email: string; name: string; position: string; costCenters: string[]; previous: { name: string; position: string; costCenters: string[] } }>; archives: Array<{ id: string; name: string; email: string }> };
        setSyncPreviewPlan(plan);
        setSyncPreviewApproved({
          creates: new Set((plan.creates || []).map((c: { email: string }) => c.email)),
          updates: new Set((plan.updates || []).map((u: { email: string }) => u.email)),
          archives: new Set((plan.archives || []).map((a: { id: string }) => a.id)),
        });
        setSyncPreviewOpen(true);
      } else {
        setSyncFromExternalMessage({ type: 'error', text: data.error || `Preview failed (${res.status})` });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Preview request failed';
      setSyncFromExternalMessage({ type: 'error', text: msg });
      debugError('Sync from HR API preview failed', e);
    } finally {
      setSyncFromExternalLoading(false);
    }
  };

  const handleSyncPreviewToggle = (kind: 'creates' | 'updates' | 'archives', key: string, checked: boolean) => {
    setSyncPreviewApproved((prev) => {
      const next = new Set(prev[kind]);
      if (checked) next.add(key);
      else next.delete(key);
      return { ...prev, [kind]: next };
    });
  };

  const handleSyncPreviewApply = async () => {
    if (!syncPreviewPlan) return;
    setSyncApplyLoading(true);
    setSyncFromExternalMessage(null);
    try {
      const toCreate = syncPreviewPlan.creates.filter((c) => syncPreviewApproved.creates.has(c.email)).map((c) => c.email);
      const toUpdate = syncPreviewPlan.updates.filter((u) => syncPreviewApproved.updates.has(u.email)).map((u) => u.email);
      const toArchive = syncPreviewPlan.archives.filter((a) => syncPreviewApproved.archives.has(a.id)).map((a) => a.id);
      const res = await fetch(`${API_BASE_URL}/api/employees/sync-from-external/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toCreate, toUpdate, toArchive }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        const { created = 0, updated = 0, archived = 0, duplicatesRemoved = 0, errors = [] } = data;
        const parts = [];
        if (created) parts.push(`${created} created`);
        if (updated) parts.push(`${updated} updated`);
        if (archived) parts.push(`${archived} archived`);
        if (duplicatesRemoved) parts.push(`${duplicatesRemoved} duplicate(s) removed`);
        setSyncFromExternalMessage({
          type: 'success',
          text: parts.length ? parts.join('; ') + (errors.length ? `. ${errors.length} issue(s) logged.` : '') : 'No changes applied.',
        });
        setSyncPreviewOpen(false);
        setSyncPreviewPlan(null);
        if (onRefresh) onRefresh();
      } else {
        setSyncFromExternalMessage({ type: 'error', text: data.error || `Apply failed (${res.status})` });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Apply request failed';
      setSyncFromExternalMessage({ type: 'error', text: msg });
    } finally {
      setSyncApplyLoading(false);
    }
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
    // Create a copy of employee but clear the password field (don't show hashed password)
    const employeeToEdit = {
      ...viewingEmployee,
      password: '', // Clear password field - user can enter new password if needed
      permissions: viewingEmployee.permissions && viewingEmployee.permissions.length > 0
        ? viewingEmployee.permissions
        : getDefaultPermissions(viewingEmployee.role || 'employee', viewingEmployee.position || '')
    };
    setEditingEmployee(employeeToEdit);
    const costCenters = parseCostCenters(viewingEmployee.costCenters);
    setSelectedCostCenters(costCenters);
    setDefaultCostCenter(viewingEmployee.defaultCostCenter || costCenters[0] || '');
    setShowProfileDialog(false);
    setShowEmployeeDialog(true);
  };

  const handleEditEmployee = (employee: Employee) => {
    // Create a copy of employee but clear the password field (don't show hashed password)
    const employeeToEdit = {
      ...employee,
      password: '', // Clear password field - user can enter new password if needed
      permissions: employee.permissions && employee.permissions.length > 0
        ? employee.permissions
        : getDefaultPermissions(employee.role || 'employee', employee.position || '')
    };
    setEditingEmployee(employeeToEdit);
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
      role: 'employee', // Default login role
      permissions: getDefaultPermissions('employee', ''),
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
        role: editingEmployee.role || 'employee', // Ensure role is set (defaults to 'employee')
        permissions: editingEmployee.permissions && editingEmployee.permissions.length > 0
          ? editingEmployee.permissions
          : getDefaultPermissions(editingEmployee.role || 'employee', editingEmployee.position || ''),
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
    setQuickEditCostCenterSearch('');
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
                    <Button
                      variant="outlined"
                      startIcon={<CloudUpload />}
                      onClick={handleSyncFromExternalApi}
                      disabled={syncFromExternalLoading}
                    >
                      {syncFromExternalLoading ? 'Syncing...' : 'Sync from HR API'}
                    </Button>
                  </>
                )}
              </Box>
            </Box>
            {syncFromExternalMessage && (
              <Alert
                severity={syncFromExternalMessage.type}
                onClose={() => setSyncFromExternalMessage(null)}
                sx={{ mb: 2 }}
              >
                {syncFromExternalMessage.text}
              </Alert>
            )}
            
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
            
            <TableContainer 
              component={Paper} 
              sx={{ 
                maxHeight: 600,
                width: '100%',
                overflowX: 'auto',
                overflowY: 'auto'
              }}
            >
              <Table stickyHeader size="medium" sx={{ tableLayout: 'fixed', width: '100%' }}>
                <TableHead>
                  <TableRow>
                    <TableCell padding="checkbox" sx={{ width: '56px', minWidth: '56px', paddingLeft: '10px', paddingRight: '10px' }}>
                      <Checkbox
                        indeterminate={selectedEmployees.length > 0 && selectedEmployees.length < filteredEmployees.length}
                        checked={selectedEmployees.length === filteredEmployees.length && filteredEmployees.length > 0}
                        onChange={handleSelectAll}
                        size="small"
                      />
                    </TableCell>
                    {/* Name Column Header */}
                    <TableCell sx={{ width: '14%', minWidth: 140 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Box 
                          sx={{ display: 'flex', alignItems: 'center', gap: 0.5, cursor: 'pointer', userSelect: 'none', flex: 1 }}
                          onClick={() => handleSort('name')}
                        >
                          <Typography variant="subtitle2" fontWeight="bold">Name</Typography>
                          {sortBy === 'name' && (
                            sortDirection === 'asc' ? <ArrowUpward fontSize="small" /> : <ArrowDownward fontSize="small" />
                          )}
                        </Box>
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            openFilterMenu('name', e);
                          }}
                          sx={{ p: 0.5 }}
                        >
                          {columnFilters.name ? <FilterList fontSize="small" color="primary" /> : <FilterList fontSize="small" />}
                        </IconButton>
                      </Box>
                    </TableCell>
                    {/* Email Column Header */}
                    <TableCell sx={{ width: '18%', minWidth: 180 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Box 
                          sx={{ display: 'flex', alignItems: 'center', gap: 0.5, cursor: 'pointer', userSelect: 'none', flex: 1 }}
                          onClick={() => handleSort('email')}
                        >
                          <Typography variant="subtitle2" fontWeight="bold">Email</Typography>
                          {sortBy === 'email' && (
                            sortDirection === 'asc' ? <ArrowUpward fontSize="small" /> : <ArrowDownward fontSize="small" />
                          )}
                        </Box>
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            openFilterMenu('email', e);
                          }}
                          sx={{ p: 0.5 }}
                        >
                          {columnFilters.email ? <FilterList fontSize="small" color="primary" /> : <FilterList fontSize="small" />}
                        </IconButton>
                      </Box>
                    </TableCell>
                    {/* Position Column Header */}
                    <TableCell sx={{ width: '14%', minWidth: 140 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Box 
                          sx={{ display: 'flex', alignItems: 'center', gap: 0.5, cursor: 'pointer', userSelect: 'none', flex: 1 }}
                          onClick={() => handleSort('position')}
                        >
                          <Typography variant="subtitle2" fontWeight="bold">Position</Typography>
                          {sortBy === 'position' && (
                            sortDirection === 'asc' ? <ArrowUpward fontSize="small" /> : <ArrowDownward fontSize="small" />
                          )}
                        </Box>
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            openFilterMenu('position', e);
                          }}
                          sx={{ p: 0.5 }}
                        >
                          {columnFilters.position ? <FilterList fontSize="small" color="primary" /> : <FilterList fontSize="small" />}
                        </IconButton>
                      </Box>
                    </TableCell>
                    {/* Login Role Column Header */}
                    <TableCell sx={{ width: '10%', minWidth: 90 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Box 
                          sx={{ display: 'flex', alignItems: 'center', gap: 0.5, cursor: 'pointer', userSelect: 'none', flex: 1 }}
                          onClick={() => handleSort('role')}
                        >
                          <Typography variant="subtitle2" fontWeight="bold">Login Role</Typography>
                          {sortBy === 'role' && (
                            sortDirection === 'asc' ? <ArrowUpward fontSize="small" /> : <ArrowDownward fontSize="small" />
                          )}
                        </Box>
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            openFilterMenu('role', e);
                          }}
                          sx={{ p: 0.5 }}
                        >
                          {columnFilters.role ? <FilterList fontSize="small" color="primary" /> : <FilterList fontSize="small" />}
                        </IconButton>
                      </Box>
                    </TableCell>
                    {/* Last Login Column Header */}
                    <TableCell sx={{ width: '12%', minWidth: 120 }}>
                      <Box 
                        sx={{ display: 'flex', alignItems: 'center', gap: 0.5, cursor: 'pointer', userSelect: 'none' }}
                        onClick={() => handleSort('lastLogin')}
                      >
                        <Typography variant="subtitle2" fontWeight="bold">Last Login</Typography>
                        {sortBy === 'lastLogin' && (
                          sortDirection === 'asc' ? <ArrowUpward fontSize="small" /> : <ArrowDownward fontSize="small" />
                        )}
                      </Box>
                    </TableCell>
                    {/* Phone Column Header */}
                    <TableCell sx={{ width: '10%', minWidth: 100 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Box 
                          sx={{ display: 'flex', alignItems: 'center', gap: 0.5, cursor: 'pointer', userSelect: 'none', flex: 1 }}
                          onClick={() => handleSort('phone')}
                        >
                          <Typography variant="subtitle2" fontWeight="bold">Phone</Typography>
                          {sortBy === 'phone' && (
                            sortDirection === 'asc' ? <ArrowUpward fontSize="small" /> : <ArrowDownward fontSize="small" />
                          )}
                        </Box>
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            openFilterMenu('phone', e);
                          }}
                          sx={{ p: 0.5 }}
                        >
                          {columnFilters.phone ? <FilterList fontSize="small" color="primary" /> : <FilterList fontSize="small" />}
                        </IconButton>
                      </Box>
                    </TableCell>
                    {/* Supervisor Column Header */}
                    <TableCell sx={{ width: '12%', minWidth: 120 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Box 
                          sx={{ display: 'flex', alignItems: 'center', gap: 0.5, cursor: 'pointer', userSelect: 'none', flex: 1 }}
                          onClick={() => handleSort('supervisor')}
                        >
                          <Typography variant="subtitle2" fontWeight="bold">Supervisor</Typography>
                          {sortBy === 'supervisor' && (
                            sortDirection === 'asc' ? <ArrowUpward fontSize="small" /> : <ArrowDownward fontSize="small" />
                          )}
                        </Box>
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            openFilterMenu('supervisor', e);
                          }}
                          sx={{ p: 0.5 }}
                        >
                          {columnFilters.supervisor ? <FilterList fontSize="small" color="primary" /> : <FilterList fontSize="small" />}
                        </IconButton>
                      </Box>
                    </TableCell>
                    <TableCell sx={{ width: '10%', minWidth: 100 }}>Cost Centers</TableCell>
                    <TableCell sx={{ width: '8%', minWidth: 80 }}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredEmployees.map((employee) => (
                    <TableRow key={employee.id}>
                      <TableCell padding="checkbox" sx={{ width: '56px', minWidth: '56px', paddingLeft: '10px', paddingRight: '10px' }}>
                        <Checkbox
                          checked={selectedEmployees.includes(employee.id)}
                          onChange={() => handleSelectEmployee(employee.id)}
                          size="small"
                        />
                      </TableCell>
                      <TableCell sx={{ width: '14%', minWidth: 140, fontSize: '0.875rem', padding: '10px' }}>
                        <Box
                          onClick={() => handleViewEmployee(employee)}
                          sx={{
                            cursor: 'pointer',
                            color: 'primary.main',
                            fontWeight: 500,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            '&:hover': {
                              textDecoration: 'underline',
                            },
                          }}
                        >
                          {employee.name}
                        </Box>
                      </TableCell>
                      <TableCell sx={{ width: '18%', minWidth: 180, fontSize: '0.875rem', padding: '10px' }}>
                        <Typography
                          variant="body2"
                          sx={{
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          {employee.email}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ width: '14%', minWidth: 140, fontSize: '0.875rem', padding: '10px' }}>
                        <Typography
                          variant="body2"
                          sx={{
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          {employee.position || '-'}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ width: '10%', minWidth: 90, padding: '10px' }}>
                        <Chip
                          label={employee.role || 'employee'}
                          size="small"
                          color={
                            employee.role === 'admin' ? 'error' :
                            employee.role === 'finance' ? 'warning' :
                            employee.role === 'supervisor' ? 'info' :
                            'default'
                          }
                          sx={{ 
                            textTransform: 'capitalize',
                            fontSize: '0.7rem',
                            height: 22,
                            fontWeight: employee.role === 'admin' || employee.role === 'finance' ? 'bold' : 'normal'
                          }}
                        />
                      </TableCell>
                      <TableCell sx={{ width: '12%', minWidth: 120, fontSize: '0.875rem', padding: '10px' }}>
                        {employee.lastLoginAt 
                          ? new Date(employee.lastLoginAt).toLocaleString('en-US', {
                              month: '2-digit',
                              day: '2-digit',
                              year: 'numeric',
                              hour: 'numeric',
                              minute: '2-digit',
                              hour12: true
                            })
                          : <Typography component="span" variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                              Never
                            </Typography>
                        }
                      </TableCell>
                      <TableCell sx={{ width: '10%', minWidth: 100, fontSize: '0.875rem', padding: '10px' }}>
                        <Typography
                          variant="body2"
                          sx={{
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          {formatPhoneNumber(employee.phoneNumber)}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ width: '12%', minWidth: 120, fontSize: '0.875rem', padding: '10px' }}>
                        <Typography
                          variant="body2"
                          sx={{
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          {employee.supervisorId ? 
                            existingEmployees.find(emp => emp.id === employee.supervisorId)?.name || 'Unknown' :
                            'No Supervisor'}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ width: '10%', minWidth: 100, fontSize: '0.875rem', padding: '10px' }}>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.25, maxWidth: 200 }}>
                          {parseCostCenters(employee.costCenters).slice(0, 2).map(center => (
                            <Chip 
                              key={center} 
                              label={center} 
                              size="small"
                              sx={{ 
                                fontSize: '0.7rem',
                                height: 20,
                                cursor: showArchived ? 'default' : 'pointer',
                                '&:hover': showArchived ? {} : {
                                  backgroundColor: 'primary.light',
                                  color: 'primary.contrastText'
                                }
                              }}
                              clickable={!showArchived}
                              onClick={showArchived ? undefined : () => handleQuickCostCenterEdit(employee)}
                            />
                          ))}
                          {parseCostCenters(employee.costCenters).length > 2 && (
                            <Chip 
                              label={`+${parseCostCenters(employee.costCenters).length - 2}`}
                              size="small"
                              sx={{ 
                                fontSize: '0.7rem',
                                height: 20,
                                cursor: showArchived ? 'default' : 'pointer',
                                '&:hover': showArchived ? {} : {
                                  backgroundColor: 'primary.light',
                                  color: 'primary.contrastText'
                                }
                              }}
                              clickable={!showArchived}
                              onClick={showArchived ? undefined : () => handleQuickCostCenterEdit(employee)}
                            />
                          )}
                        </Box>
                        {!showArchived && parseCostCenters(employee.costCenters).length > 0 && (
                          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.25, display: 'block', fontSize: '0.7rem' }}>
                            Click to edit
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell sx={{ width: '8%', minWidth: 80, padding: '10px' }}>
                        <Box sx={{ display: 'flex', gap: 0.25 }}>
                          {showArchived ? (
                            <>
                              <Tooltip title="Restore">
                                <IconButton 
                                  size="small" 
                                  onClick={() => handleRestoreEmployee(employee.id)}
                                  color="primary"
                                  sx={{ padding: '4px' }}
                                >
                                  <Restore fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Delete">
                                <IconButton 
                                  size="small" 
                                  onClick={() => handleDeleteClick(employee.id)}
                                  color="error"
                                  sx={{ padding: '4px' }}
                                >
                                  <FolderDelete fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            </>
                          ) : (
                            <>
                              <Tooltip title="Edit">
                                <IconButton 
                                  size="small" 
                                  onClick={() => handleEditEmployee(employee)}
                                  sx={{ padding: '4px' }}
                                >
                                  <Edit fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Reset Password">
                                <IconButton 
                                  size="small" 
                                  onClick={() => handleResetPassword(employee)}
                                  color="primary"
                                  sx={{ padding: '4px' }}
                                >
                                  <LockReset fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Archive">
                                <IconButton 
                                  size="small" 
                                  onClick={() => handleDeleteEmployee(employee.id)}
                                  color="warning"
                                  sx={{ padding: '4px' }}
                                >
                                  <Archive fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            </>
                          )}
                        </Box>
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
            
            {/* Filter Menus for each column */}
            {(['name', 'email', 'position', 'role', 'phone', 'supervisor'] as const).map((column) => (
              <Popover
                key={column}
                open={Boolean(filterMenuAnchor[column])}
                anchorEl={filterMenuAnchor[column]}
                onClose={() => closeFilterMenu(column)}
                anchorOrigin={{
                  vertical: 'bottom',
                  horizontal: 'left',
                }}
                transformOrigin={{
                  vertical: 'top',
                  horizontal: 'left',
                }}
              >
                <Box sx={{ p: 2, minWidth: 250 }}>
                  <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'bold' }}>
                    Filter {column.charAt(0).toUpperCase() + column.slice(1)}
                  </Typography>
                  {column === 'position' || column === 'role' || column === 'supervisor' ? (
                    // Dropdown for position, role, and supervisor
                    <FormControl fullWidth size="small" sx={{ mb: 1 }}>
                      <InputLabel>Select {column}</InputLabel>
                      <Select
                        value={columnFilters[column] || ''}
                        onChange={(e) => handleColumnFilterChange(column, e.target.value)}
                        label={`Select ${column}`}
                      >
                        <MenuItem value="">
                          <em>All</em>
                        </MenuItem>
                        {getUniqueColumnValues(column).map((value) => (
                          <MenuItem key={value} value={value}>
                            {value}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  ) : (
                    // Text input for name, email, phone
                    <TextField
                      fullWidth
                      size="small"
                      label={`Filter ${column}`}
                      value={columnFilters[column] || ''}
                      onChange={(e) => handleColumnFilterChange(column, e.target.value)}
                      placeholder={`Enter ${column} to filter...`}
                      sx={{ mb: 1 }}
                    />
                  )}
                  <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                    {columnFilters[column] && (
                      <Button
                        size="small"
                        onClick={() => clearColumnFilter(column)}
                        startIcon={<Clear />}
                      >
                        Clear
                      </Button>
                    )}
                    <Button
                      size="small"
                      variant="contained"
                      onClick={() => closeFilterMenu(column)}
                    >
                      Done
                    </Button>
                  </Box>
                </Box>
              </Popover>
            ))}
          </CardContent>
        </Card>
      </TabPanel>

      {/* Mass Operations Tab */}
      <TabPanel value={activeTab} index={1}>
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
                
                <TextField
                  fullWidth
                  label="Job Title"
                  value={editingEmployee.position || ''}
                  onChange={(e) => setEditingEmployee({
                    ...editingEmployee,
                    position: e.target.value
                  })}
                  placeholder="e.g., Senior Data Analyst, Outreach Worker, Regional Manager"
                  helperText="Enter the employee's job title"
                />
                
                {/* Login Role Field - Separate from Position/Job Title */}
                <FormControl fullWidth>
                  <InputLabel>Login Role (System Access)</InputLabel>
                  <Select
                    value={editingEmployee.role || 'employee'}
                    onChange={(e) => setEditingEmployee({
                      ...editingEmployee,
                      role: e.target.value as 'employee' | 'supervisor' | 'admin' | 'finance' | 'contracts',
                      permissions: (editingEmployee.permissions && editingEmployee.permissions.length > 0)
                        ? editingEmployee.permissions
                        : getDefaultPermissions(e.target.value as string, editingEmployee.position || '')
                    })}
                    label="Login Role (System Access)"
                  >
                    <MenuItem value="employee">
                      <Box>
                        <Typography variant="body2" fontWeight="bold">Employee</Typography>
                        <Typography variant="caption" color="text.secondary" display="block">
                          Standard employee - can submit expense reports
                        </Typography>
                      </Box>
                    </MenuItem>
                    <MenuItem value="supervisor">
                      <Box>
                        <Typography variant="body2" fontWeight="bold">Supervisor</Typography>
                        <Typography variant="caption" color="text.secondary" display="block">
                          Can review and approve employee expense reports
                        </Typography>
                      </Box>
                    </MenuItem>
                    <MenuItem value="finance">
                      <Box>
                        <Typography variant="body2" fontWeight="bold">Finance</Typography>
                        <Typography variant="caption" color="text.secondary" display="block">
                          Finance team - can review reports and mark for revisions
                        </Typography>
                      </Box>
                    </MenuItem>
                    <MenuItem value="contracts">
                      <Box>
                        <Typography variant="body2" fontWeight="bold">Contracts</Typography>
                        <Typography variant="caption" color="text.secondary" display="block">
                          Contracts team - can review reports for quarterly audit
                        </Typography>
                      </Box>
                    </MenuItem>
                    <MenuItem value="admin">
                      <Box>
                        <Typography variant="body2" fontWeight="bold">Admin</Typography>
                        <Typography variant="caption" color="text.secondary" display="block">
                          Full system access - manage all employees and settings
                        </Typography>
                      </Box>
                    </MenuItem>
                  </Select>
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                    Login role determines system access and permissions (separate from job title)
                  </Typography>
                </FormControl>
                
                <FormControl fullWidth sx={{ mt: 2 }}>
                  <InputLabel>Portal Permissions</InputLabel>
                  <Select
                    multiple
                    value={editingEmployee.permissions || []}
                    onChange={(e) => setEditingEmployee({
                      ...editingEmployee,
                      permissions: e.target.value as Array<'admin' | 'finance' | 'contracts' | 'supervisor' | 'staff'>
                    })}
                    input={<OutlinedInput label="Portal Permissions" />}
                    renderValue={(selected) =>
                      (selected as string[])
                        .map((permission) => {
                          const match = PORTAL_PERMISSIONS.find((item) => item.id === permission);
                          return match ? match.label : permission;
                        })
                        .join(', ')
                    }
                  >
                    {PORTAL_PERMISSIONS.map((permission) => (
                      <MenuItem key={permission.id} value={permission.id}>
                        <Checkbox checked={(editingEmployee.permissions || []).includes(permission.id as any)} />
                        <ListItemText
                          primary={permission.label}
                          secondary={permission.description}
                        />
                      </MenuItem>
                    ))}
                  </Select>
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                    Select which portals this user can access. If none are selected, defaults are based on Login Role.
                  </Typography>
                </FormControl>
                
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
                    {existingEmployees.map(emp => (
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
                    placeholder="Enter new password to change (leave empty to keep current)"
                    onChange={(e) => setEditingEmployee({
                      ...editingEmployee,
                      password: e.target.value
                    })}
                    helperText="Leave empty to keep current password. Enter a new password to change it."
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
                  <Typography variant="body1">{formatPhoneNumber(viewingEmployee.phoneNumber) || 'Not provided'}</Typography>
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
        onClose={() => {
          setShowQuickCostCenterEdit(false);
          setQuickEditCostCenterSearch('');
        }}
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
                      <TextField
                        fullWidth
                        size="small"
                        placeholder="Search cost centers..."
                        value={quickEditCostCenterSearch}
                        onChange={(e) => setQuickEditCostCenterSearch(e.target.value)}
                        sx={{ 
                          px: 1, 
                          pt: 1, 
                          pb: 0.5,
                          '& .MuiOutlinedInput-root': { backgroundColor: 'background.default' }
                        }}
                        inputProps={{ 'aria-label': 'Search cost centers' }}
                      />
                      <Typography variant="subtitle2" sx={{ 
                        p: 1, 
                        fontWeight: 'bold', 
                        position: 'sticky',
                        top: 0,
                        backgroundColor: 'background.paper',
                        zIndex: 1
                      }}>
                        Available ({quickEditAvailableCostCenters.length})
                      </Typography>
                      {quickEditAvailableCostCenters.length === 0 ? (
                        <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
                          {quickEditCostCenterSearch.trim() ? 'No cost centers match your search.' : 'All cost centers are selected.'}
                        </Typography>
                      ) : (
                        quickEditAvailableCostCenters.map((costCenter: string) => (
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
                        ))
                      )}
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

      {/* Sync from HR API – Preview & Approve/Deny */}
      <Dialog
        open={syncPreviewOpen}
        onClose={() => {
          setSyncPreviewOpen(false);
          setSyncPreviewPlan(null);
        }}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { maxHeight: '85vh' } }}
      >
        <DialogTitle>Sync from HR API – Review changes</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Select which changes to apply. Uncheck any you want to skip.
          </Typography>
          {syncPreviewPlan && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {syncPreviewPlan.creates.length > 0 && (
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1, color: 'success.main' }}>
                    Create ({syncPreviewPlan.creates.length})
                  </Typography>
                  <Box sx={{ maxHeight: 160, overflow: 'auto', border: 1, borderColor: 'divider', borderRadius: 1, p: 0.5 }}>
                    {syncPreviewPlan.creates.map((c) => (
                      <Box key={c.email} sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.5 }}>
                        <Checkbox size="small" checked={syncPreviewApproved.creates.has(c.email)} onChange={(e) => handleSyncPreviewToggle('creates', c.email, e.target.checked)} />
                        <ListItemText primary={`${c.name} (${c.email})`} secondary={`${c.position} · ${(c.costCenters || []).join(', ')}`} primaryTypographyProps={{ variant: 'body2' }} secondaryTypographyProps={{ variant: 'caption' }} />
                      </Box>
                    ))}
                  </Box>
                </Box>
              )}
              {syncPreviewPlan.updates.length > 0 && (
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1, color: 'info.main' }}>
                    Update ({syncPreviewPlan.updates.length})
                  </Typography>
                  <Box sx={{ maxHeight: 160, overflow: 'auto', border: 1, borderColor: 'divider', borderRadius: 1, p: 0.5 }}>
                    {syncPreviewPlan.updates.map((u) => (
                      <Box key={u.email} sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.5 }}>
                        <Checkbox size="small" checked={syncPreviewApproved.updates.has(u.email)} onChange={(e) => handleSyncPreviewToggle('updates', u.email, e.target.checked)} />
                        <ListItemText
                          primary={`${u.name} (${u.email})`}
                          secondary={u.previous ? `Name/position/cost centers will update from HR` : `${u.position} · ${(u.costCenters || []).join(', ')}`}
                          primaryTypographyProps={{ variant: 'body2' }}
                          secondaryTypographyProps={{ variant: 'caption' }}
                        />
                      </Box>
                    ))}
                  </Box>
                </Box>
              )}
              {syncPreviewPlan.archives.length > 0 && (
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1, color: 'warning.main' }}>
                    Archive – not in HR ({syncPreviewPlan.archives.length})
                  </Typography>
                  <Box sx={{ maxHeight: 160, overflow: 'auto', border: 1, borderColor: 'divider', borderRadius: 1, p: 0.5 }}>
                    {syncPreviewPlan.archives.map((a) => (
                      <Box key={a.id} sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.5 }}>
                        <Checkbox size="small" checked={syncPreviewApproved.archives.has(a.id)} onChange={(e) => handleSyncPreviewToggle('archives', a.id, e.target.checked)} />
                        <ListItemText primary={`${a.name} (${a.email})`} secondary="Will be archived" primaryTypographyProps={{ variant: 'body2' }} secondaryTypographyProps={{ variant: 'caption' }} />
                      </Box>
                    ))}
                  </Box>
                </Box>
              )}
              {syncPreviewPlan.creates.length === 0 && syncPreviewPlan.updates.length === 0 && syncPreviewPlan.archives.length === 0 && (
                <Typography variant="body2" color="text.secondary">No changes from HR.</Typography>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setSyncPreviewOpen(false); setSyncPreviewPlan(null); }}>
            Cancel
          </Button>
          <Button variant="contained" onClick={handleSyncPreviewApply} disabled={syncApplyLoading || !syncPreviewPlan}>
            {syncApplyLoading ? 'Applying...' : 'Apply selected'}
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
