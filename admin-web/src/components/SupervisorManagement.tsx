import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  Chip,
  IconButton,
  Alert,
  Autocomplete,
  Divider,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Person as PersonIcon,
  SupervisorAccount as SupervisorIcon,
  Groups as SeniorStaffIcon,
  CloudUpload as UploadIcon,
} from '@mui/icons-material';
import { Tabs, Tab } from '@mui/material';
import { Employee } from '../types';
import { debugLog, debugError } from '../config/debug';

interface SupervisorManagementProps {
  employees: Employee[];
  onUpdateEmployee: (id: string, updates: Partial<Employee>) => Promise<void>;
  onBulkUpdateEmployees: (employeeIds: string[], updates: Partial<Employee>) => Promise<void>;
  onRefresh: () => Promise<void>;
}

interface SupervisorWithStaff {
  supervisor: Employee;
  staffMembers: Employee[];
  type: 'supervisor' | 'senior-staff';
}

export const SupervisorManagement: React.FC<SupervisorManagementProps> = ({
  employees,
  onUpdateEmployee,
  onBulkUpdateEmployees,
  onRefresh,
}) => {
  const [supervisors, setSupervisors] = useState<SupervisorWithStaff[]>([]);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedSupervisor, setSelectedSupervisor] = useState<Employee | null>(null);
  const [selectedStaff, setSelectedStaff] = useState<Employee[]>([]);
  const [promoteSupervisorDialogOpen, setPromoteSupervisorDialogOpen] = useState(false);
  const [employeeToPromote, setEmployeeToPromote] = useState<Employee | null>(null);
  const [promoteType, setPromoteType] = useState<'supervisor' | 'senior-staff'>('supervisor');
  const [activeTab, setActiveTab] = useState(0); // 0 = Supervisors, 1 = Senior Staff
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [supervisorToDelete, setSupervisorToDelete] = useState<Employee | null>(null);
  const [excludedFromSupervisorList, setExcludedFromSupervisorList] = useState<Set<string>>(() => {
    // Load excluded list from localStorage
    const stored = localStorage.getItem('excludedSupervisors');
    return stored ? new Set(JSON.parse(stored)) : new Set();
  });
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [employeeToEdit, setEmployeeToEdit] = useState<Employee | null>(null);
  const [editFormData, setEditFormData] = useState<Partial<Employee>>({});
  const [bulkImportDialogOpen, setBulkImportDialogOpen] = useState(false);
  const [bulkImportEmails, setBulkImportEmails] = useState<string>('');
  const [bulkImportType, setBulkImportType] = useState<'supervisor' | 'senior-staff'>('supervisor');
  const [bulkImportResult, setBulkImportResult] = useState<{success: number; failed: number; errors: string[]} | null>(null);

  // Save excluded list to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('excludedSupervisors', JSON.stringify(Array.from(excludedFromSupervisorList)));
  }, [excludedFromSupervisorList]);

  const organizeSupervisors = React.useCallback(() => {
    // Group employees by their supervisors
    const supervisorMap = new Map<string, SupervisorWithStaff>();

    // Find all employees who are supervisors or senior staff
    // Includes: explicit "- Supervisor"/"- Senior Staff" OR anyone with Manager/Director in title
    // BUT exclude anyone in the excludedFromSupervisorList
    employees.forEach(emp => {
      // Skip if this employee is in the excluded list
      if (excludedFromSupervisorList.has(emp.id)) {
        return;
      }
      
      const positionLower = emp.position.toLowerCase();
      let type: 'supervisor' | 'senior-staff' | null = null;
      
      // Check for Senior Staff designation
      if (positionLower.includes('senior staff')) {
        type = 'senior-staff';
        debugLog('👥 Found senior staff:', emp.name, emp.position);
      }
      // Check for Supervisor, Manager, or Director
      else if (positionLower.includes('supervisor') || 
               positionLower.includes('manager') ||
               positionLower.includes('director')) {
        type = 'supervisor';
        debugLog('👔 Found supervisor:', emp.name, emp.position);
      }
      
      if (type && !supervisorMap.has(emp.id)) {
        supervisorMap.set(emp.id, {
          supervisor: emp,
          staffMembers: [],
          type
        });
      }
    });

    // Also add employees who have staff reporting to them
    employees.forEach(emp => {
      if (emp.supervisorId && !supervisorMap.has(emp.supervisorId)) {
        const supervisor = employees.find(e => e.id === emp.supervisorId);
        if (supervisor) {
          const positionLower = supervisor.position.toLowerCase();
          const type = positionLower.includes('senior staff') ? 'senior-staff' : 'supervisor';
          supervisorMap.set(supervisor.id, {
            supervisor,
            staffMembers: [],
            type
          });
        }
      }
    });

    // Now assign staff to their supervisors
    employees.forEach(emp => {
      if (emp.supervisorId && supervisorMap.has(emp.supervisorId)) {
        const supervisorData = supervisorMap.get(emp.supervisorId);
        if (supervisorData) {
          supervisorData.staffMembers.push(emp);
        }
      }
    });

    setSupervisors(Array.from(supervisorMap.values()));
  }, [employees, excludedFromSupervisorList]);

  useEffect(() => {
    debugLog('🔄 SupervisorManagement: Reorganizing supervisors, employee count:', employees.length);
    organizeSupervisors();
  }, [employees, organizeSupervisors]);

  const getUnassignedStaff = () => {
    return employees.filter(emp => 
      !emp.supervisorId && 
      !emp.position.toLowerCase().includes('supervisor') &&
      !emp.position.toLowerCase().includes('manager') &&
      !emp.position.toLowerCase().includes('director')
    );
  };

  const getPotentialSupervisors = () => {
    return employees.filter(emp =>
      emp.position.toLowerCase().includes('supervisor') ||
      emp.position.toLowerCase().includes('manager') ||
      emp.position.toLowerCase().includes('director')
    );
  };

  const handleOpenAssignDialog = (supervisor: Employee) => {
    setSelectedSupervisor(supervisor);
    setSelectedStaff([]);
    setAssignDialogOpen(true);
  };

  const handleAssignStaff = async () => {
    if (!selectedSupervisor || selectedStaff.length === 0) return;

    try {
      const staffIds = selectedStaff.map(s => s.id);
      await onBulkUpdateEmployees(staffIds, { supervisorId: selectedSupervisor.id });
      setAssignDialogOpen(false);
      setSelectedStaff([]);
      
      // Refresh the employee list
      await onRefresh();
    } catch (error) {
      debugError('Error assigning staff:', error);
    }
  };

  const handleRemoveStaff = async (staffMember: Employee) => {
    try {
      await onUpdateEmployee(staffMember.id, { supervisorId: null });
      
      // Refresh the employee list
      await onRefresh();
    } catch (error) {
      debugError('Error removing staff:', error);
    }
  };

  const handlePromoteToSupervisor = async () => {
    if (!employeeToPromote) return;

    try {
      // Update their position to include "Supervisor" or "Senior Staff"
      let newPosition = employeeToPromote.position;
      
      if (promoteType === 'senior-staff') {
        newPosition = employeeToPromote.position.includes('Senior Staff')
          ? employeeToPromote.position
          : `${employeeToPromote.position} - Senior Staff`;
      } else {
        newPosition = employeeToPromote.position.includes('Supervisor')
          ? employeeToPromote.position
          : `${employeeToPromote.position} - Supervisor`;
      }
      
      // Include all required employee fields in the update
      await onUpdateEmployee(employeeToPromote.id, { 
        name: employeeToPromote.name,
        email: employeeToPromote.email,
        oxfordHouseId: employeeToPromote.oxfordHouseId,
        phoneNumber: employeeToPromote.phoneNumber,
        baseAddress: employeeToPromote.baseAddress,
        baseAddress2: employeeToPromote.baseAddress2,
        costCenters: employeeToPromote.costCenters,
        selectedCostCenters: employeeToPromote.selectedCostCenters,
        defaultCostCenter: employeeToPromote.defaultCostCenter,
        position: newPosition,
        supervisorId: null // Supervisors/Senior Staff don't report to other supervisors
      });
      
      setPromoteSupervisorDialogOpen(false);
      setEmployeeToPromote(null);
      setPromoteType('supervisor');
      
      // Remove from excluded list in case they were previously excluded
      setExcludedFromSupervisorList(prev => {
        const newSet = new Set(prev);
        newSet.delete(employeeToPromote.id);
        return newSet;
      });
      
      // Refresh the employee list
      await onRefresh();
    } catch (error) {
      debugError('Error promoting employee:', error);
    }
  };

  const handleOpenDeleteConfirm = (supervisor: Employee) => {
    setSupervisorToDelete(supervisor);
    setDeleteConfirmOpen(true);
  };

  const handleOpenEditDialog = (employee: Employee) => {
    setEmployeeToEdit(employee);
    setEditFormData({
      name: employee.name,
      email: employee.email,
      position: employee.position,
      phoneNumber: employee.phoneNumber,
      baseAddress: employee.baseAddress,
      oxfordHouseId: employee.oxfordHouseId,
    });
    setEditDialogOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!employeeToEdit) return;

    try {
      await onUpdateEmployee(employeeToEdit.id, {
        ...employeeToEdit,
        ...editFormData,
      });
      setEditDialogOpen(false);
      setEmployeeToEdit(null);
      await onRefresh();
    } catch (error) {
      debugError('Error updating employee:', error);
    }
  };

  const handleConfirmDelete = async () => {
    if (!supervisorToDelete) return;

    try {
      debugLog('🗑️ Removing from supervisor list:', supervisorToDelete.name);
      debugLog('📝 Position (unchanged):', supervisorToDelete.position);
      
      // Add to excluded list (keeps their title but removes from supervisor view)
      setExcludedFromSupervisorList(prev => new Set(prev).add(supervisorToDelete.id));
      
      // Unassign all their staff
      const staffIds = supervisors
        .find(s => s.supervisor.id === supervisorToDelete.id)
        ?.staffMembers.map(s => s.id) || [];
      
      if (staffIds.length > 0) {
        await onBulkUpdateEmployees(staffIds, { supervisorId: null });
      }

      setDeleteConfirmOpen(false);
      setSupervisorToDelete(null);
      
      debugLog('✅ Removed from supervisor list (title unchanged)');
    } catch (error) {
      debugError('Error demoting supervisor:', error);
      setDeleteConfirmOpen(false);
      setSupervisorToDelete(null);
    }
  };

  const handleBulkImport = async () => {
    try {
      const emails = bulkImportEmails
        .split('\n')
        .map(e => e.trim())
        .filter(e => e.length > 0);

      if (emails.length === 0) {
        alert('Please enter at least one email address');
        return;
      }

      const results = {
        success: 0,
        failed: 0,
        errors: [] as string[]
      };

      for (const email of emails) {
        try {
          const employee = employees.find(e => e.email.toLowerCase() === email.toLowerCase());
          
          if (!employee) {
            results.failed++;
            results.errors.push(`${email}: Employee not found`);
            continue;
          }

          // Update position to add designation
          const positionSuffix = bulkImportType === 'supervisor' ? ' - Supervisor' : ' - Senior Staff';
          const newPosition = employee.position.includes(positionSuffix) 
            ? employee.position 
            : employee.position + positionSuffix;

          await onUpdateEmployee(employee.id, {
            ...employee,
            position: newPosition
          });

          results.success++;
        } catch (error) {
          results.failed++;
          results.errors.push(`${email}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      setBulkImportResult(results);
      await onRefresh();
    } catch (error) {
      debugError('Error during bulk import:', error);
      alert('Failed to bulk import: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  const unassignedStaff = getUnassignedStaff();
  
  // Filter supervisors by type based on active tab
  const filteredSupervisors = supervisors.filter(s => 
    activeTab === 0 ? s.type === 'supervisor' : s.type === 'senior-staff'
  );

  return (
    <Box>
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h4" gutterBottom>
          Supervisor & Senior Staff Management
        </Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="outlined"
            startIcon={<UploadIcon />}
            onClick={() => {
              setBulkImportType(activeTab === 0 ? 'supervisor' : 'senior-staff');
              setBulkImportDialogOpen(true);
              setBulkImportResult(null);
            }}
          >
            Bulk Import
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => {
              setPromoteType(activeTab === 0 ? 'supervisor' : 'senior-staff');
              setPromoteSupervisorDialogOpen(true);
            }}
          >
            Add {activeTab === 0 ? 'Supervisor' : 'Senior Staff'}
          </Button>
        </Box>
      </Box>

      {/* Tabs for Supervisors vs Senior Staff */}
      <Tabs value={activeTab} onChange={(e, newValue) => setActiveTab(newValue)} sx={{ mb: 3 }}>
        <Tab 
          label={`Supervisors (${supervisors.filter(s => s.type === 'supervisor').length})`}
          icon={<SupervisorIcon />}
          iconPosition="start"
        />
        <Tab 
          label={`Senior Staff (${supervisors.filter(s => s.type === 'senior-staff').length})`}
          icon={<SeniorStaffIcon />}
          iconPosition="start"
        />
      </Tabs>

      {/* Unassigned Staff Alert */}
      {unassignedStaff.length > 0 && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          <Typography variant="body1" gutterBottom>
            <strong>{unassignedStaff.length} staff member(s) without a supervisor</strong>
          </Typography>
          <Typography variant="body2">
            {unassignedStaff.map(s => s.name).join(', ')}
          </Typography>
        </Alert>
      )}

      {/* Supervisors/Senior Staff List */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
        {filteredSupervisors.map(({ supervisor, staffMembers, type }) => (
          <Box key={supervisor.id} sx={{ flexBasis: { xs: '100%', md: 'calc(50% - 12px)', lg: 'calc(33.333% - 16px)' } }}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  {type === 'senior-staff' ? 
                    <SeniorStaffIcon sx={{ mr: 1, color: 'primary.main' }} /> :
                    <SupervisorIcon sx={{ mr: 1, color: 'primary.main' }} />
                  }
                  <Box sx={{ flexGrow: 1 }}>
                    <Typography variant="h6">
                      {supervisor.name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {supervisor.position}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1 }}>
                    <Chip 
                      label={`${staffMembers.length} staff`} 
                      color="primary" 
                      size="small" 
                    />
                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                      <IconButton
                        size="small"
                        color="primary"
                        onClick={() => handleOpenEditDialog(supervisor)}
                        title="Edit profile"
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => handleOpenDeleteConfirm(supervisor)}
                        title="Remove designation"
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  </Box>
                </Box>

                <Divider sx={{ my: 2 }} />

                {/* Staff Members */}
                <Typography variant="subtitle2" gutterBottom>
                  Team Members:
                </Typography>
                {staffMembers.length === 0 ? (
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    No staff assigned yet
                  </Typography>
                ) : (
                  <Box sx={{ mb: 2 }}>
                    {staffMembers.map(staff => (
                      <Chip
                        key={staff.id}
                        label={staff.name}
                        size="small"
                        onClick={() => handleOpenEditDialog(staff)}
                        onDelete={() => handleRemoveStaff(staff)}
                        sx={{ 
                          m: 0.5,
                          cursor: 'pointer',
                          '&:hover': {
                            backgroundColor: 'primary.light',
                          }
                        }}
                        icon={<PersonIcon />}
                      />
                    ))}
                  </Box>
                )}

                <Button
                  fullWidth
                  variant="outlined"
                  startIcon={<AddIcon />}
                  onClick={() => handleOpenAssignDialog(supervisor)}
                  disabled={unassignedStaff.length === 0}
                >
                  Assign Staff
                </Button>
              </CardContent>
            </Card>
          </Box>
        ))}

        {filteredSupervisors.length === 0 && (
          <Box sx={{ width: '100%' }}>
            <Alert severity="info">
              No {activeTab === 0 ? 'supervisors' : 'senior staff'} found. Click "Add {activeTab === 0 ? 'Supervisor' : 'Senior Staff'}" to designate employees.
            </Alert>
          </Box>
        )}
      </Box>

      {/* Assign Staff Dialog */}
      <Dialog 
        open={assignDialogOpen} 
        onClose={() => setAssignDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          Assign Staff to {selectedSupervisor?.name}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <Autocomplete
              multiple
              options={unassignedStaff}
              getOptionLabel={(option) => `${option.name} - ${option.position}`}
              value={selectedStaff}
              onChange={(_, newValue) => setSelectedStaff(newValue)}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Select Staff Members"
                  placeholder="Choose employees..."
                />
              )}
              renderTags={(value, getTagProps) =>
                value.map((option, index) => (
                  <Chip
                    label={option.name}
                    {...getTagProps({ index })}
                    size="small"
                  />
                ))
              }
            />
            {unassignedStaff.length === 0 && (
              <Alert severity="info" sx={{ mt: 2 }}>
                All staff members are already assigned to supervisors.
              </Alert>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAssignDialogOpen(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleAssignStaff} 
            variant="contained"
            disabled={selectedStaff.length === 0}
          >
            Assign {selectedStaff.length > 0 && `(${selectedStaff.length})`}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Promote to Supervisor/Senior Staff Dialog */}
      <Dialog 
        open={promoteSupervisorDialogOpen} 
        onClose={() => {
          setPromoteSupervisorDialogOpen(false);
          setEmployeeToPromote(null);
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          Add {promoteType === 'senior-staff' ? 'Senior Staff' : 'Supervisor'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <FormControl fullWidth>
              <Autocomplete
                options={employees.filter(e => {
                  const pos = e.position.toLowerCase();
                  return !pos.includes('supervisor') &&
                         !pos.includes('manager') &&
                         !pos.includes('director') &&
                         !pos.includes('senior staff');
                })}
                getOptionLabel={(option) => `${option.name} - ${option.position}`}
                value={employeeToPromote}
                onChange={(_, newValue) => setEmployeeToPromote(newValue)}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Select Employee"
                    placeholder="Choose employee..."
                  />
                )}
              />
            </FormControl>
            
            {employeeToPromote && (
              <Alert severity="info" sx={{ mt: 2 }}>
                This will update {employeeToPromote.name}'s position to include "{promoteType === 'senior-staff' ? 'Senior Staff' : 'Supervisor'}"
                {promoteType === 'supervisor' && ' and allow them to have staff assigned'}.
                {promoteType === 'senior-staff' && '. Senior Staff can approve reports but do not manage staff members'}.
              </Alert>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setPromoteSupervisorDialogOpen(false);
            setEmployeeToPromote(null);
          }}>
            Cancel
          </Button>
          <Button 
            onClick={handlePromoteToSupervisor} 
            variant="contained"
            disabled={!employeeToPromote}
          >
            Add as {promoteType === 'senior-staff' ? 'Senior Staff' : 'Supervisor'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteConfirmOpen}
        onClose={() => {
          setDeleteConfirmOpen(false);
          setSupervisorToDelete(null);
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          Remove {supervisorToDelete?.position.toLowerCase().includes('senior staff') ? 'Senior Staff' : 'Supervisor'} Designation?
        </DialogTitle>
        <DialogContent>
          {supervisorToDelete && (() => {
            const supervisorData = supervisors.find(s => s.supervisor.id === supervisorToDelete.id);
            const staffCount = supervisorData?.staffMembers.length || 0;
            
            return (
              <Alert severity="warning" sx={{ mb: 2 }}>
                <Typography variant="body1" gutterBottom>
                  <strong>Are you sure you want to remove the designation from {supervisorToDelete.name}?</strong>
                </Typography>
            <Typography variant="body2">
              This will:
            </Typography>
            <ul>
              <li>Remove them from the supervisor/senior staff list</li>
              {staffCount > 0 && (
                <li>Unassign their {staffCount} staff member(s)</li>
              )}
              <li>Their job title will remain: <strong>{supervisorToDelete.position}</strong></li>
              <li>They will not appear in this supervisor management view</li>
            </ul>
              </Alert>
            );
          })()}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setDeleteConfirmOpen(false);
            setSupervisorToDelete(null);
          }}>
            Cancel
          </Button>
          <Button 
            onClick={handleConfirmDelete}
            variant="contained"
            color="error"
          >
            Remove Designation
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Employee Dialog */}
      <Dialog
        open={editDialogOpen}
        onClose={() => {
          setEditDialogOpen(false);
          setEmployeeToEdit(null);
        }}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Edit Employee - {employeeToEdit?.name}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label="Name"
              value={editFormData.name || ''}
              onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
              fullWidth
              required
            />
            <TextField
              label="Email"
              type="email"
              value={editFormData.email || ''}
              onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
              fullWidth
              required
            />
            <TextField
              label="Position"
              value={editFormData.position || ''}
              onChange={(e) => setEditFormData({ ...editFormData, position: e.target.value })}
              fullWidth
              required
            />
            <TextField
              label="Phone Number"
              value={editFormData.phoneNumber || ''}
              onChange={(e) => setEditFormData({ ...editFormData, phoneNumber: e.target.value })}
              fullWidth
            />
            <TextField
              label="Base Address"
              value={editFormData.baseAddress || ''}
              onChange={(e) => setEditFormData({ ...editFormData, baseAddress: e.target.value })}
              fullWidth
              required
              multiline
              rows={2}
            />
            <TextField
              label="Oxford House ID"
              value={editFormData.oxfordHouseId || ''}
              onChange={(e) => setEditFormData({ ...editFormData, oxfordHouseId: e.target.value })}
              fullWidth
              required
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setEditDialogOpen(false);
            setEmployeeToEdit(null);
          }}>
            Cancel
          </Button>
          <Button 
            onClick={handleSaveEdit}
            variant="contained"
            startIcon={<EditIcon />}
          >
            Save Changes
          </Button>
        </DialogActions>
      </Dialog>

      {/* Bulk Import Dialog */}
      <Dialog
        open={bulkImportDialogOpen}
        onClose={() => {
          setBulkImportDialogOpen(false);
          setBulkImportEmails('');
          setBulkImportResult(null);
        }}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Bulk Import {bulkImportType === 'supervisor' ? 'Supervisors' : 'Senior Staff'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <Alert severity="info" sx={{ mb: 2 }}>
              Enter email addresses (one per line) of employees to promote to {bulkImportType === 'supervisor' ? 'Supervisor' : 'Senior Staff'}.
              The system will add "- {bulkImportType === 'supervisor' ? 'Supervisor' : 'Senior Staff'}" to their position title.
            </Alert>

            <TextField
              label="Email Addresses"
              multiline
              rows={10}
              fullWidth
              value={bulkImportEmails}
              onChange={(e) => setBulkImportEmails(e.target.value)}
              placeholder="employee1@oxfordhouse.org&#10;employee2@oxfordhouse.org&#10;employee3@oxfordhouse.org"
              helperText="Enter one email address per line"
            />

            {bulkImportResult && (
              <Alert 
                severity={bulkImportResult.failed === 0 ? 'success' : 'warning'} 
                sx={{ mt: 2 }}
              >
                <Typography variant="body1">
                  <strong>Import Results:</strong>
                </Typography>
                <Typography variant="body2">
                  ✅ Successfully imported: {bulkImportResult.success}
                </Typography>
                {bulkImportResult.failed > 0 && (
                  <>
                    <Typography variant="body2">
                      ❌ Failed: {bulkImportResult.failed}
                    </Typography>
                    {bulkImportResult.errors.length > 0 && (
                      <Box component="ul" sx={{ mt: 1, pl: 2 }}>
                        {bulkImportResult.errors.map((error, index) => (
                          <li key={index}>
                            <Typography variant="caption">{error}</Typography>
                          </li>
                        ))}
                      </Box>
                    )}
                  </>
                )}
              </Alert>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setBulkImportDialogOpen(false);
            setBulkImportEmails('');
            setBulkImportResult(null);
          }}>
            Close
          </Button>
          <Button 
            onClick={handleBulkImport} 
            variant="contained"
            startIcon={<UploadIcon />}
          >
            Import {bulkImportType === 'supervisor' ? 'Supervisors' : 'Senior Staff'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

