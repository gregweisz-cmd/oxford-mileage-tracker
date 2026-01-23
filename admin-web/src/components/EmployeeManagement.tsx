import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Avatar,
  Chip,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Menu,
  ListItemIcon,
  ListItemText,
  InputAdornment,
  Paper,
  Divider,
  Tooltip,
} from '@mui/material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  Archive as ArchiveIcon,
  Restore as RestoreIcon,
  Add as AddIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
  MoreVert as MoreVertIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
  Person as PersonIcon,
  AdminPanelSettings as AdminIcon,
  SupervisorAccount as SupervisorIcon,
  AccountCircle as EmployeeIcon,
  Email as EmailIcon,
  Phone as PhoneIcon,
  LocationOn as LocationIcon,
  GetApp as ExportIcon,
  FolderDelete as FolderDeleteIcon,
  ArrowUpward as ArrowUpwardIcon,
  ArrowDownward as ArrowDownwardIcon,
  UnfoldMore as UnfoldMoreIcon,
} from '@mui/icons-material';

// API configuration - use environment variable or default to localhost for development
const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://oxford-mileage-backend.onrender.com';
import { debugError } from '../config/debug';

interface Employee {
  id: string;
  name: string;
  preferredName?: string;
  email: string;
  position: string;
  phoneNumber: string;
  baseAddress: string;
  baseAddress2?: string;
  costCenters: string;
  selectedCostCenters?: string;
  defaultCostCenter?: string;
  signature?: string;
  oxfordHouseId?: string;
  createdAt: string;
  updatedAt: string;
}

interface EmployeeFormData {
  name: string;
  email: string;
  position: string;
  phoneNumber: string;
  baseAddress: string;
  baseAddress2: string;
  costCenters: string[];
}

const COST_CENTERS = [
  'Central',
  'North',
  'South', 
  'East',
  'West',
  'Administrative',
  'Support Services',
  'Development',
  'Community Outreach',
  'AL-SOR',
  'G&A',
  'Fundraising'
];

const POSITIONS = [
  'Executive Director',
  'Program Director',
  'Regional Manager',
  'House Manager',
  'Counselor',
  'Administrative Assistant',
  'Support Staff',
  'Volunteer Coordinator',
  'Finance Manager',
  'Development Coordinator',
  'Case Manager',
  'Manager'
];

const getRoleIcon = (position: string) => {
  const positionLower = position.toLowerCase();
  if (positionLower.includes('executive') || positionLower.includes('director')) {
    return <AdminIcon />;
  } else if (positionLower.includes('manager') || positionLower.includes('supervisor') || positionLower.includes('coordinator')) {
    return <SupervisorIcon />;
  } else {
    return <EmployeeIcon />;
  }
};

const getRoleLabel = (position: string) => {
  const positionLower = position.toLowerCase();
  if (positionLower.includes('executive') || positionLower.includes('director')) {
    return 'Administrator';
  } else if (
    positionLower.includes('director') ||
    positionLower.includes('program director') ||
    positionLower.includes('regional manager') ||
    positionLower.includes('house manager') ||
    positionLower.includes('supervisor') ||
    positionLower.includes('coordinator') ||
    positionLower.includes('administrative assistant')
  ) {
    // Exclude case manager from supervisor
    if (!positionLower.includes('case manager')) {
      return 'Supervisor';
    }
  }
  return 'Employee';
};

const getRoleColor = (position: string) => {
  const positionLower = position.toLowerCase();
  if (positionLower.includes('executive') || positionLower.includes('director')) {
    return 'error';
  } else if (
    positionLower.includes('director') ||
    positionLower.includes('program director') ||
    positionLower.includes('regional manager') ||
    positionLower.includes('house manager') ||
    positionLower.includes('supervisor') ||
    positionLower.includes('coordinator') ||
    positionLower.includes('administrative assistant')
  ) {
    // Exclude case manager from supervisor color
    if (!positionLower.includes('case manager')) {
      return 'warning';
    }
  }
  return 'success';
};

const EmployeeManagement: React.FC = () => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [filteredEmployees, setFilteredEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [formData, setFormData] = useState<EmployeeFormData>({
    name: '',
    email: '',
    position: '',
    phoneNumber: '',
    baseAddress: '',
    baseAddress2: '',
    costCenters: []
  });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [archivedEmployees, setArchivedEmployees] = useState<Employee[]>([]);
  const [sortedArchivedEmployees, setSortedArchivedEmployees] = useState<Employee[]>([]);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [employeeToDelete, setEmployeeToDelete] = useState<Employee | null>(null);
  
  // Sorting state
  const [sortField, setSortField] = useState<keyof Employee | ''>('');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  useEffect(() => {
    loadEmployees();
    if (showArchived) {
      loadArchivedEmployees();
    }
  }, [showArchived]);

  useEffect(() => {
    filterEmployees();
  }, [employees, searchTerm, roleFilter, statusFilter]);

  // Helper function to sort employees
  const sortEmployees = (employees: Employee[]): Employee[] => {
    if (!sortField) return employees;
    
    const sorted = [...employees];
    sorted.sort((a, b) => {
      let aValue = a[sortField];
      let bValue = b[sortField];
      
      // Handle string comparisons
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        aValue = aValue.toLowerCase();
        bValue = bValue.toLowerCase();
      }
      
      // Handle null/undefined values
      if (aValue == null && bValue == null) return 0;
      if (aValue == null) return 1;
      if (bValue == null) return -1;
      
      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
    
    return sorted;
  };

  // Apply sorting to filtered employees
  useEffect(() => {
    setFilteredEmployees(prev => sortEmployees(prev));
  }, [sortField, sortDirection]);

  // Apply sorting to archived employees
  useEffect(() => {
    setSortedArchivedEmployees(sortEmployees(archivedEmployees));
  }, [archivedEmployees, sortField, sortDirection]);

  const handleSort = (field: keyof Employee) => {
    if (sortField === field) {
      // Toggle direction if clicking the same field
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // Set new field and default to ascending
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getSortIcon = (field: keyof Employee) => {
    if (sortField !== field) {
      return <UnfoldMoreIcon sx={{ fontSize: 16, opacity: 0.5 }} />;
    }
    return sortDirection === 'asc' 
      ? <ArrowUpwardIcon sx={{ fontSize: 16 }} />
      : <ArrowDownwardIcon sx={{ fontSize: 16 }} />;
  };

  const loadEmployees = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/api/employees`);
      if (!response.ok) throw new Error('Failed to fetch employees');
      
      const employeesData = await response.json();
      
      // Parse costCenters from JSON string if needed
      const parsedEmployees = employeesData.map((emp: any) => ({
        ...emp,
        costCenters: typeof emp.costCenters === 'string' 
          ? emp.costCenters 
          : JSON.stringify(emp.costCenters || [])
      }));
      
      setEmployees(parsedEmployees);
    } catch (err: any) {
      debugError('Error loading employees:', err);
      setError(err.message || 'Failed to load employees');
    } finally {
      setLoading(false);
    }
  };

  const loadArchivedEmployees = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/api/employees/archived`);
      if (!response.ok) throw new Error('Failed to fetch archived employees');
      
      const employeesData = await response.json();
      
      // Parse costCenters from JSON string if needed
      const parsedEmployees = employeesData.map((emp: any) => ({
        ...emp,
        costCenters: typeof emp.costCenters === 'string' 
          ? emp.costCenters 
          : JSON.stringify(emp.costCenters || [])
      }));
      
      setArchivedEmployees(parsedEmployees);
    } catch (err: any) {
      debugError('Error loading archived employees:', err);
      setError(err.message || 'Failed to load archived employees');
    } finally {
      setLoading(false);
    }
  };

  const filterEmployees = () => {
    let filtered = employees.filter(employee => {
      const matchesSearch = searchTerm === '' || 
        employee.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        employee.email.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesRole = roleFilter === 'all' || 
        getRoleLabel(employee.position).toLowerCase() === roleFilter.toLowerCase();
      
      const matchesStatus = statusFilter === 'all' || 
        (statusFilter === 'active' && employee.email) ||
        (statusFilter === 'inactive' && !employee.email);
      
      return matchesSearch && matchesRole && matchesStatus;
    });

    setFilteredEmployees(filtered);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      position: '',
      phoneNumber: '',
      baseAddress: '',
      baseAddress2: '',
      costCenters: []
    });
    setEditingEmployee(null);
    setError(null);
    setSuccess(null);
  };

  const openDialog = (employee: Employee | null = null) => {
    if (employee) {
      // Editing existing employee
      let costCenters: string[] = [];
      try {
        costCenters = JSON.parse(employee.costCenters);
      } catch (e) {
        costCenters = [];
      }
      
      setFormData({
        name: employee.name,
        email: employee.email,
        position: employee.position,
        phoneNumber: employee.phoneNumber || '',
        baseAddress: employee.baseAddress,
        baseAddress2: employee.baseAddress2 || '',
        costCenters: costCenters
      });
      setEditingEmployee(employee);
    } else {
      // Adding new employee
      resetForm();
    }
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    resetForm();
  };

  const handleSave = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      // Validate required fields
      if (!formData.name || !formData.email || !formData.position || !formData.baseAddress) {
        throw new Error('Name, email, position, and base address are required');
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email)) {
        throw new Error('Please enter a valid email address');
      }

      const employeeData = {
        name: formData.name.trim(),
        email: formData.email.trim().toLowerCase(),
        position: formData.position.trim(),
        phoneNumber: formData.phoneNumber.trim(),
        baseAddress: formData.baseAddress.trim(),
        baseAddress2: formData.baseAddress2.trim(),
        costCenters: JSON.stringify(formData.costCenters),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      if (editingEmployee) {
        // Update existing employee
        const response = await fetch(`${API_BASE_URL}/api/employees/${editingEmployee.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ...employeeData,
            id: editingEmployee.id
          })
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to update employee');
        }

        setSuccess('Employee updated successfully!');
      } else {
        // Create new employee
        const response = await fetch(`${API_BASE_URL}/api/employees`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(employeeData)
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to create employee');
        }

        setSuccess('Employee created successfully!');
      }

      // Reload employees and close dialog
      await loadEmployees();
      closeDialog();
      
    } catch (err: any) {
      debugError('Error saving employee:', err);
      setError(err.message || 'Failed to save employee');
    } finally {
      setLoading(false);
    }
  };

  const handleArchive = async (employee: Employee) => {
    if (!window.confirm(`Are you sure you want to archive ${employee.name}? They will be moved to the archived employees section.`)) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/employees/${employee.id}/archive`, {
        method: 'POST'
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to archive employee');
      }

      setSuccess('Employee archived successfully!');
      await loadEmployees();
      if (showArchived) {
        await loadArchivedEmployees();
      }
    } catch (err: any) {
      debugError('Error archiving employee:', err);
      setError(err.message || 'Failed to archive employee');
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async (employee: Employee) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/employees/${employee.id}/restore`, {
        method: 'POST'
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to restore employee');
      }

      setSuccess('Employee restored successfully!');
      await loadArchivedEmployees();
      await loadEmployees();
    } catch (err: any) {
      debugError('Error restoring employee:', err);
      setError(err.message || 'Failed to restore employee');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClick = (employee: Employee) => {
    setEmployeeToDelete(employee);
    setDeleteConfirmText('');
    setDeleteConfirmOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (deleteConfirmText !== 'CONFIRM') {
      setError('Please type "CONFIRM" to confirm deletion');
      return;
    }

    if (!employeeToDelete) return;

    setLoading(true);
    setError(null);
    setDeleteConfirmOpen(false);

    try {
      const response = await fetch(`${API_BASE_URL}/api/employees/${employeeToDelete.id}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete employee');
      }

      setSuccess('Employee permanently deleted successfully!');
      await loadArchivedEmployees();
      setEmployeeToDelete(null);
      setDeleteConfirmText('');
    } catch (err: any) {
      debugError('Error deleting employee:', err);
      setError(err.message || 'Failed to delete employee');
    } finally {
      setLoading(false);
    }
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedEmployee(null);
  };

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, employee: Employee) => {
    setAnchorEl(event.currentTarget);
    setSelectedEmployee(employee);
  };

  const parseCostCenters = (costCentersStr: string): string[] => {
    try {
      const parsed = JSON.parse(costCentersStr);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const exportEmployees = () => {
    const csv = [
      ['Name', 'Email', 'Position', 'Phone', 'Base Address', 'Cost Centers'].join(','),
      ...employees.map(emp => [
        emp.name,
        emp.email,
        emp.position,
        emp.phoneNumber || '',
        emp.baseAddress,
        parseCostCenters(emp.costCenters).join(';')
      ].join(','))
    ].join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'oxford-house-employees.csv';
    link.click();
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h4" component="h1" sx={{ fontWeight: 'bold' }}>
            {showArchived ? 'Archived Employees' : 'Manage Employees'}
          </Typography>
          <Box sx={{ display: 'flex', gap: 2 }}>
            {!showArchived && (
              <Button
                variant="outlined"
                startIcon={<FolderDeleteIcon />}
                onClick={() => {
                  setShowArchived(true);
                  loadArchivedEmployees();
                }}
                disabled={loading}
              >
                View Archived
              </Button>
            )}
            {showArchived && (
              <Button
                variant="outlined"
                onClick={() => setShowArchived(false)}
                disabled={loading}
              >
                Back to Active Employees
              </Button>
            )}
            {!showArchived && (
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => openDialog()}
                disabled={loading}
                sx={{ backgroundColor: '#6366f1' }}
              >
                Add Employee
              </Button>
            )}
          </Box>
        </Box>

        {/* Summary Bar */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="body1" color="text.secondary">
            {filteredEmployees.length} employees
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Typography 
              variant="body2" 
              component="a" 
              href="#" 
              onClick={exportEmployees}
              sx={{ 
                color: '#6366f1', 
                textDecoration: 'underline',
                cursor: 'pointer' 
              }}
            >
              Export employee list
            </Typography>
          </Box>
        </Box>

        {/* Search and Filter Bar */}
        <Paper sx={{ p: 2, mb: 2 }}>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
            <TextField
              placeholder="Filter by name or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ color: 'text.secondary' }} />
                  </InputAdornment>
                ),
              }}
              sx={{ flexGrow: 1, minWidth: 300 }}
              size="small"
            />
            
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>Role</InputLabel>
              <Select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                label="Role"
              >
                <MenuItem value="all">All roles</MenuItem>
                <MenuItem value="administrator">Administrators</MenuItem>
                <MenuItem value="supervisor">Supervisors</MenuItem>
                <MenuItem value="employee">Employees</MenuItem>
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>Status</InputLabel>
              <Select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                label="Status"
              >
                <MenuItem value="all">All status</MenuItem>
                <MenuItem value="active">Active</MenuItem>
                <MenuItem value="inactive">Inactive</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </Paper>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      {/* Employee Table */}
      <Paper sx={{ overflow: 'hidden' }}>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow sx={{ backgroundColor: '#f8fafc' }}>
                <TableCell 
                  sx={{ 
                    fontWeight: 'bold', 
                    cursor: 'pointer', 
                    userSelect: 'none',
                    '&:hover': { backgroundColor: '#f1f5f9' }
                  }}
                  onClick={() => handleSort('name')}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    Full name
                    {getSortIcon('name')}
                  </Box>
                </TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Display name</TableCell>
                <TableCell 
                  sx={{ 
                    fontWeight: 'bold', 
                    cursor: 'pointer', 
                    userSelect: 'none',
                    '&:hover': { backgroundColor: '#f1f5f9' }
                  }}
                  onClick={() => handleSort('email')}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    Email address
                    {getSortIcon('email')}
                  </Box>
                </TableCell>
                <TableCell 
                  sx={{ 
                    fontWeight: 'bold', 
                    cursor: 'pointer', 
                    userSelect: 'none',
                    '&:hover': { backgroundColor: '#f1f5f9' }
                  }}
                  onClick={() => handleSort('position')}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    Account type
                    {getSortIcon('position')}
                  </Box>
                </TableCell>
                <TableCell 
                  sx={{ 
                    fontWeight: 'bold', 
                    cursor: 'pointer', 
                    userSelect: 'none',
                    '&:hover': { backgroundColor: '#f1f5f9' }
                  }}
                  onClick={() => handleSort('phoneNumber')}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    Phone
                    {getSortIcon('phoneNumber')}
                  </Box>
                </TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(showArchived ? sortedArchivedEmployees : filteredEmployees).map((employee, index) => {
                const costCenters = parseCostCenters(employee.costCenters);
                const initials = getInitials(employee.name);
                const roleLabel = getRoleLabel(employee.position);
                const roleIcon = getRoleIcon(employee.position);
                const roleColor = getRoleColor(employee.position);
                const isActive = statusFilter === 'all' || statusFilter === 'active' || employee.email;

                return (
                  <TableRow 
                    key={employee.id}
                    sx={{ 
                      '&:hover': { backgroundColor: '#f8fafc' },
                      backgroundColor: index % 2 === 0 ? '#fafbfc' : 'white',
                      opacity: !isActive ? 0.7 : 1
                    }}
                  >
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Avatar sx={{ bgcolor: '#6366f1', fontSize: '0.875rem' }}>
                          {initials}
                        </Avatar>
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 500 }}>
                            {employee.name}
                          </Typography>
                          {costCenters.length > 0 && (
                            <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5 }}>
                              {costCenters.slice(0, 2).map((center) => (
                                <Chip
                                  key={center}
                                  label={center}
                                  size="small"
                                  sx={{ 
                                    fontSize: '0.75rem', 
                                    height: 18,
                                    '& .MuiChip-label': { px: 1 }
                                  }}
                                />
                              ))}
                              {costCenters.length > 2 && (
                                <Typography variant="caption" color="text.secondary">
                                  +{costCenters.length - 2} more
                                </Typography>
                              )}
                            </Box>
                          )}
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell>{employee.name}</TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <EmailIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                        <Typography variant="body2">{employee.email}</Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Chip
                        icon={roleIcon}
                        label={roleLabel}
                        color={roleColor as any}
                        size="small"
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <PhoneIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                        <Typography variant="body2">
                          {employee.phoneNumber || '—'}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        <Tooltip title="Edit">
                          <IconButton size="small" onClick={() => openDialog(employee)}>
                            <EditIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="More options">
                          <IconButton 
                            size="small" 
                            onClick={(e) => handleMenuOpen(e, employee)}
                          >
                            <MoreVertIcon />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Context Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        {!showArchived && (
          <>
            <MenuItem onClick={() => { openDialog(selectedEmployee); handleMenuClose(); }}>
              <ListItemIcon>
                <EditIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>Edit employee</ListItemText>
            </MenuItem>
            <MenuItem onClick={() => { handleArchive(selectedEmployee!); handleMenuClose(); }}>
              <ListItemIcon>
                <ArchiveIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>Archive employee</ListItemText>
            </MenuItem>
          </>
        )}
        {showArchived && (
          <>
            <MenuItem onClick={() => { handleRestore(selectedEmployee!); handleMenuClose(); }}>
              <ListItemIcon>
                <RestoreIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>Restore employee</ListItemText>
            </MenuItem>
            <MenuItem onClick={() => { handleDeleteClick(selectedEmployee!); handleMenuClose(); }}>
              <ListItemIcon>
                <DeleteIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>Permanently delete</ListItemText>
            </MenuItem>
          </>
        )}
      </Menu>

      {/* Employee Form Dialog */}
      <Dialog
        open={dialogOpen}
        onClose={closeDialog}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {editingEmployee ? 'Edit Employee' : 'Add New Employee'}
        </DialogTitle>
        
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <TextField
              fullWidth
              label="Full Name *"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              margin="normal"
              required
            />
            
            <TextField
              fullWidth
              label="Email Address *"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              margin="normal"
              required
            />
            
            <FormControl fullWidth margin="normal">
              <InputLabel>Position *</InputLabel>
              <Select
                value={formData.position}
                onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                required
              >
                {POSITIONS.map((position) => (
                  <MenuItem key={position} value={position}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {getRoleIcon(position)}
                      {position}
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            
            <TextField
              fullWidth
              label="Phone Number"
              value={formData.phoneNumber}
              onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
              margin="normal"
            />
            
            <TextField
              fullWidth
              label="Base Address *"
              multiline
              rows={3}
              value={formData.baseAddress}
              onChange={(e) => setFormData({ ...formData, baseAddress: e.target.value })}
              margin="normal"
              required
            />
            
            <TextField
              fullWidth
              label="Base Address 2"
              multiline
              rows={2}
              value={formData.baseAddress2}
              onChange={(e) => setFormData({ ...formData, baseAddress2: e.target.value })}
              margin="normal"
              placeholder="Additional address line (optional)"
            />
            
            <FormControl fullWidth margin="normal">
              <InputLabel>Cost Centers</InputLabel>
              <Select
                multiple
                value={formData.costCenters}
                onChange={(e) => {
                  const value = typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value;
                  setFormData({ ...formData, costCenters: value });
                }}
                renderValue={(selected) => (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {selected.map((value) => (
                      <Chip key={value} label={value} size="small" />
                    ))}
                  </Box>
                )}
              >
                {COST_CENTERS.map((center) => (
                  <MenuItem key={center} value={center}>
                    {center}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        
        <DialogActions>
          <Button
            onClick={closeDialog}
            startIcon={<CancelIcon />}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            variant="contained"
            startIcon={<SaveIcon />}
            disabled={loading}
            sx={{ backgroundColor: '#6366f1' }}
          >
            {loading ? 'Saving...' : editingEmployee ? 'Update' : 'Create'}
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
            <DeleteIcon sx={{ color: 'error.main' }} />
            Confirm Permanent Deletion
          </Box>
        </DialogTitle>
        <DialogContent>
          <Alert severity="error" sx={{ mb: 2 }}>
            <Typography variant="body1" sx={{ fontWeight: 'bold', mb: 1 }}>
              This action cannot be undone!
            </Typography>
            <Typography variant="body2">
              You are about to permanently delete <strong>{employeeToDelete?.name}</strong>. This will remove all data associated with this employee from the system.
            </Typography>
          </Alert>
          <Typography variant="body2" sx={{ mb: 2 }}>
            To confirm this deletion, please type <strong>CONFIRM</strong> in the box below:
          </Typography>
          <TextField
            fullWidth
            label="Type CONFIRM to delete"
            value={deleteConfirmText}
            onChange={(e) => setDeleteConfirmText(e.target.value)}
            error={deleteConfirmText !== '' && deleteConfirmText !== 'CONFIRM'}
            helperText={deleteConfirmText !== '' && deleteConfirmText !== 'CONFIRM' ? 'You must type "CONFIRM" exactly' : ''}
            autoFocus
          />
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setDeleteConfirmOpen(false);
              setDeleteConfirmText('');
              setEmployeeToDelete(null);
            }}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleDeleteConfirm}
            variant="contained"
            color="error"
            disabled={loading || deleteConfirmText !== 'CONFIRM'}
            startIcon={<DeleteIcon />}
          >
            Permanently Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default EmployeeManagement;