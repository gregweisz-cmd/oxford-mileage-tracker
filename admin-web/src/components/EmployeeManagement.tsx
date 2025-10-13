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
} from '@mui/icons-material';

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

  useEffect(() => {
    loadEmployees();
  }, []);

  useEffect(() => {
    filterEmployees();
  }, [employees, searchTerm, roleFilter, statusFilter]);

  const loadEmployees = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('http://localhost:3002/api/employees');
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
      console.error('Error loading employees:', err);
      setError(err.message || 'Failed to load employees');
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
        const response = await fetch(`http://localhost:3002/api/employees/${editingEmployee.id}`, {
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
        const response = await fetch('http://localhost:3002/api/employees', {
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
      console.error('Error saving employee:', err);
      setError(err.message || 'Failed to save employee');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (employee: Employee) => {
    if (!window.confirm(`Are you sure you want to delete ${employee.name}? This action cannot be undone.`)) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`http://localhost:3002/api/employees/${employee.id}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete employee');
      }

      setSuccess('Employee deleted successfully!');
      await loadEmployees();
    } catch (err: any) {
      console.error('Error deleting employee:', err);
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
            Manage Employees
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => openDialog()}
            disabled={loading}
            sx={{ backgroundColor: '#6366f1' }}
          >
            Add Employee
          </Button>
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
                <TableCell sx={{ fontWeight: 'bold', cursor: 'pointer', userSelect: 'none' }}>
                  Full name ↕️
                </TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Display name</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Email address</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Account type</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Phone</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredEmployees.map((employee, index) => {
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
        <MenuItem onClick={() => { openDialog(selectedEmployee); handleMenuClose(); }}>
          <ListItemIcon>
            <EditIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Edit employee</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => { handleDelete(selectedEmployee!); handleMenuClose(); }}>
          <ListItemIcon>
            <DeleteIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Delete employee</ListItemText>
        </MenuItem>
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
    </Box>
  );
};

export default EmployeeManagement;