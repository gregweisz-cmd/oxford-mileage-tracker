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
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Checkbox,
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
import { formatNameForDisplay } from '../utils/employeeUtils';
import { debugLog, debugError } from '../config/debug';
import GooglePlacesTextField from './GooglePlacesTextField';
import { toCanonicalAddress } from '../utils/locationSelection';
import { formatBaseAddress, parseBaseAddress, updateBaseAddressPart as updateParsedBaseAddressPart } from '../utils/addressParse';
import {
  addDesignationPermission,
  hasSeniorStaffDesignation,
  hasSupervisorDesignation,
  inferSupervisorType,
  removeDesignationPermission,
  stripDesignationSuffixes,
  getDisplayPosition,
} from '../utils/staffDesignations';
import { EmployeeApiService } from '../services/employeeApiService';

function parseEmployeeCostCenters(emp: Employee): string[] {
  const raw = emp.selectedCostCenters?.length ? emp.selectedCostCenters : emp.costCenters;
  if (Array.isArray(raw)) return raw.map((cc) => String(cc || '').trim()).filter(Boolean);
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.map((cc) => String(cc || '').trim()).filter(Boolean);
      }
    } catch {
      const trimmed = raw.trim();
      return trimmed ? [trimmed] : [];
    }
  }
  return [];
}

function stateFromCostCenterCode(code: string): string {
  const part = String(code || '').split('.')[0]?.trim().toUpperCase() ?? '';
  return /^[A-Z]{2}$/.test(part) ? part : '';
}

function getEmployeeStateAndCostCenters(emp: Employee): { state: string; costCenters: string[] } {
  const costCenters = parseEmployeeCostCenters(emp);
  const primary = String(emp.defaultCostCenter || costCenters[0] || '').trim();
  let state = stateFromCostCenterCode(primary);
  if (!state) {
    for (const cc of costCenters) {
      state = stateFromCostCenterCode(cc);
      if (state) break;
    }
  }
  if (!state && emp.baseAddress) {
    const match = emp.baseAddress.match(/,\s*([A-Z]{2})(?:\s+\d{5}(?:-\d{4})?)?/i);
    if (match) state = match[1].toUpperCase();
  }
  return { state, costCenters };
}

function formatStaffAssignmentSecondary(emp: Employee): string {
  const { state, costCenters } = getEmployeeStateAndCostCenters(emp);
  const parts: string[] = [];
  if (state) parts.push(state);
  if (costCenters.length > 0) parts.push(costCenters.join(', '));
  return parts.join(' · ');
}

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

/** Emails of employees who do not require a supervisor (excluded from "needs supervisor" list). */
const EXCLUDED_FROM_SUPERVISOR_REQUIREMENT = ['kathleen.gibson@oxfordhouse.org'];

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
  const [assignStaffSearchInput, setAssignStaffSearchInput] = useState('');
  const [repairingSupervisorAssignments, setRepairingSupervisorAssignments] = useState(false);

  const employeeById = React.useMemo(
    () => new Map(employees.map((emp) => [emp.id, emp])),
    [employees]
  );

  const hasActiveSupervisor = React.useCallback(
    (emp: Employee) => !!(emp.supervisorId && employeeById.has(emp.supervisorId)),
    [employeeById]
  );

  const hasActiveSeniorStaff = React.useCallback(
    (emp: Employee) => !!(emp.seniorStaffId && employeeById.has(emp.seniorStaffId)),
    [employeeById]
  );

  // Save excluded list to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('excludedSupervisors', JSON.stringify(Array.from(excludedFromSupervisorList)));
  }, [excludedFromSupervisorList]);

  const organizeSupervisors = React.useCallback(() => {
    // Group employees by their supervisors
    const supervisorMap = new Map<string, SupervisorWithStaff>();

    // Find all employees who are supervisors or senior staff (permissions or legacy position suffix)
    employees.forEach(emp => {
      // Skip if this employee is in the excluded list
      if (excludedFromSupervisorList.has(emp.id)) {
        return;
      }

      let type: 'supervisor' | 'senior-staff' | null = null;

      if (hasSeniorStaffDesignation(emp)) {
        type = 'senior-staff';
        debugLog('👥 Found senior staff:', emp.name, emp.position);
      } else if (hasSupervisorDesignation(emp)) {
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

    // Also add employees who have staff reporting to them (by supervisorId or seniorStaffId)
    employees.forEach(emp => {
      if (emp.supervisorId && employeeById.has(emp.supervisorId) && !supervisorMap.has(emp.supervisorId)) {
        const supervisor = employeeById.get(emp.supervisorId);
        if (supervisor) {
          const type = inferSupervisorType(supervisor);
          supervisorMap.set(supervisor.id, {
            supervisor,
            staffMembers: [],
            type
          });
        }
      }
      const seniorId = emp.seniorStaffId;
      if (seniorId && employeeById.has(seniorId) && !supervisorMap.has(seniorId)) {
        const senior = employeeById.get(seniorId);
        if (senior) {
          supervisorMap.set(senior.id, {
            supervisor: senior,
            staffMembers: [],
            type: 'senior-staff'
          });
        }
      }
    });

    // Now assign staff to their supervisors (by supervisorId) or senior staff (by seniorStaffId)
    employees.forEach(emp => {
      if (emp.supervisorId && employeeById.has(emp.supervisorId) && supervisorMap.has(emp.supervisorId)) {
        const data = supervisorMap.get(emp.supervisorId);
        if (data && data.type === 'supervisor') {
          data.staffMembers.push(emp);
        }
      }
      const seniorId = emp.seniorStaffId;
      if (seniorId && employeeById.has(seniorId) && supervisorMap.has(seniorId)) {
        const data = supervisorMap.get(seniorId);
        if (data && data.type === 'senior-staff') {
          data.staffMembers.push(emp);
        }
      }
    });

    setSupervisors(Array.from(supervisorMap.values()));
  }, [employees, excludedFromSupervisorList, employeeById]);

  useEffect(() => {
    debugLog('🔄 SupervisorManagement: Reorganizing supervisors, employee count:', employees.length);
    organizeSupervisors();
  }, [employees, organizeSupervisors]);

  /** Staff with no active supervisor (includes those still linked to an archived supervisor). */
  const getUnassignedStaff = () => {
    const list = employees.filter(
      (emp) =>
        !hasActiveSupervisor(emp) &&
        !EXCLUDED_FROM_SUPERVISOR_REQUIREMENT.includes((emp.email || '').toLowerCase())
    );
    const seen = new Set<string>();
    return list.filter((emp) => {
      const key = (emp.email || '').toLowerCase().trim();
      if (!key) return true;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };

  /** Staff whose supervisorId points at someone who is archived (not in active employee list). */
  const getOrphanedSupervisorStaff = () => {
    return employees.filter(
      (emp) =>
        emp.supervisorId &&
        !employeeById.has(emp.supervisorId) &&
        !EXCLUDED_FROM_SUPERVISOR_REQUIREMENT.includes((emp.email || '').toLowerCase())
    );
  };

  const handleRepairOrphanedSupervisorAssignments = async () => {
    setRepairingSupervisorAssignments(true);
    try {
      const result = await EmployeeApiService.repairSupervisorAssignments();
      await onRefresh();
      alert(result.message || `Released ${result.clearedStaff} staff from archived supervisors.`);
    } catch (error) {
      debugError('Error repairing supervisor assignments:', error);
      alert(error instanceof Error ? error.message : 'Failed to release staff from archived supervisors.');
    } finally {
      setRepairingSupervisorAssignments(false);
    }
  };

  /** Everyone who can be assigned to a supervisor or senior staff: not designated themselves, and not the selected person. */
  const getAssignableStaff = () => {
    return employees.filter(emp => {
      if (emp.id === selectedSupervisor?.id) return false;
      if (EXCLUDED_FROM_SUPERVISOR_REQUIREMENT.includes((emp.email || '').toLowerCase())) return false;
      if (hasSeniorStaffDesignation(emp) || hasSupervisorDesignation(emp)) return false;
      return true;
    });
  };

  const handleOpenAssignDialog = (supervisor: Employee) => {
    setSelectedSupervisor(supervisor);
    setSelectedStaff([]);
    setAssignStaffSearchInput('');
    setAssignDialogOpen(true);
  };

  const handleAssignStaff = async () => {
    if (!selectedSupervisor || selectedStaff.length === 0) return;

    const entry = supervisors.find(s => s.supervisor.id === selectedSupervisor.id);
    const isSeniorStaff = entry?.type === 'senior-staff';

    try {
      const staffIds = selectedStaff.map(s => s.id);
      await onBulkUpdateEmployees(staffIds, isSeniorStaff
        ? { seniorStaffId: selectedSupervisor.id }
        : { supervisorId: selectedSupervisor.id }
      );
      setAssignDialogOpen(false);
      setSelectedStaff([]);

      await onRefresh();
    } catch (error) {
      debugError('Error assigning staff:', error);
    }
  };

  const handleRemoveStaff = async (staffMember: Employee, parentType: 'supervisor' | 'senior-staff') => {
    try {
      await onUpdateEmployee(staffMember.id, parentType === 'senior-staff'
        ? { seniorStaffId: null }
        : { supervisorId: null }
      );
      await onRefresh();
    } catch (error) {
      debugError('Error removing staff:', error);
    }
  };

  const handlePromoteToSupervisor = async () => {
    if (!employeeToPromote) return;

    try {
      const designation = promoteType === 'senior-staff' ? 'senior_staff' : 'supervisor';
      const cleanedPosition = stripDesignationSuffixes(employeeToPromote.position);
      const permissions = addDesignationPermission(employeeToPromote.permissions, designation);

      // Designation is stored in permissions; keep HR job title unchanged
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
        position: cleanedPosition,
        permissions,
        supervisorId: employeeToPromote.supervisorId ?? undefined
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

  const updateEditBaseAddressPart = (
    part: 'street' | 'city' | 'state' | 'zip',
    value: string
  ) => {
    const parsed = parseBaseAddress((editFormData.baseAddress as string) || '');
    const next = updateParsedBaseAddressPart(parsed, part, value);
    setEditFormData({
      ...editFormData,
      baseAddress: formatBaseAddress(next.street, next.city, next.state, next.zip),
    });
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

    const entry = supervisors.find(s => s.supervisor.id === supervisorToDelete.id);
    const staffIds = entry?.staffMembers.map(s => s.id) || [];
    const isSeniorStaff = entry?.type === 'senior-staff';

    try {
      debugLog('🗑️ Removing from list:', supervisorToDelete.name);

      const designation = isSeniorStaff ? 'senior_staff' : 'supervisor';
      const cleanedPosition = stripDesignationSuffixes(supervisorToDelete.position || '');
      const permissions = removeDesignationPermission(supervisorToDelete.permissions, designation);

      await onUpdateEmployee(supervisorToDelete.id, {
        ...supervisorToDelete,
        position: cleanedPosition,
        permissions,
      });

      // Also hide them locally from the list until the next refresh
      setExcludedFromSupervisorList(prev => new Set(prev).add(supervisorToDelete.id));

      if (staffIds.length > 0) {
        await onBulkUpdateEmployees(
          staffIds,
          isSeniorStaff ? { seniorStaffId: null } : { supervisorId: null }
        );
      }

      // Refresh data from the server so the change persists across reloads
      await onRefresh();

      setDeleteConfirmOpen(false);
      setSupervisorToDelete(null);
      debugLog('✅ Removed designation');
    } catch (error) {
      debugError('Error demoting:', error);
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

          const designation = bulkImportType === 'supervisor' ? 'supervisor' : 'senior_staff';
          const cleanedPosition = stripDesignationSuffixes(employee.position);
          const permissions = addDesignationPermission(employee.permissions, designation);

          await onUpdateEmployee(employee.id, {
            ...employee,
            position: cleanedPosition,
            permissions,
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
  const orphanedSupervisorStaff = getOrphanedSupervisorStaff();
  const assignableStaff = getAssignableStaff();
  const assignableStaffUnique = React.useMemo(() => {
    const entry = selectedSupervisor ? supervisors.find(s => s.supervisor.id === selectedSupervisor.id) : null;
    const type = entry?.type ?? 'supervisor';
    const withoutAssignment = type === 'senior-staff'
      ? assignableStaff.filter(emp => !hasActiveSeniorStaff(emp))
      : assignableStaff.filter(emp => !hasActiveSupervisor(emp));
    const seen = new Set<string>();
    return withoutAssignment.filter((emp) => {
      if (seen.has(emp.id)) return false;
      seen.add(emp.id);
      return true;
    });
  }, [assignableStaff, selectedSupervisor, supervisors, hasActiveSeniorStaff, hasActiveSupervisor]);
  const assignStaffOptions = React.useMemo(() => {
    const q = assignStaffSearchInput.trim().toLowerCase();
    if (!q) return assignableStaffUnique;
    return assignableStaffUnique.filter((opt) => {
      const name = (opt.name ?? '').toLowerCase();
      const position = (opt.position ?? '').toLowerCase();
      const email = (opt.email ?? '').toLowerCase();
      const { state, costCenters } = getEmployeeStateAndCostCenters(opt);
      const costCenterHaystack = costCenters.join(' ').toLowerCase();
      return (
        name.includes(q) ||
        position.includes(q) ||
        email.includes(q) ||
        state.toLowerCase().includes(q) ||
        costCenterHaystack.includes(q)
      );
    });
  }, [assignableStaffUnique, assignStaffSearchInput]);

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

      {/* Staff still linked to an archived supervisor */}
      {orphanedSupervisorStaff.length > 0 && (
        <Alert
          severity="error"
          sx={{ mb: 3 }}
          action={
            <Button
              color="inherit"
              size="small"
              onClick={handleRepairOrphanedSupervisorAssignments}
              disabled={repairingSupervisorAssignments}
            >
              {repairingSupervisorAssignments ? 'Releasing…' : 'Release staff'}
            </Button>
          }
        >
          <Typography variant="body1" gutterBottom>
            <strong>{orphanedSupervisorStaff.length} staff still assigned to an archived supervisor</strong>
          </Typography>
          <Typography variant="body2">
            {orphanedSupervisorStaff.map((s) => formatNameForDisplay(s.name)).join(', ')} — release them to reassign.
          </Typography>
        </Alert>
      )}

      {/* Unassigned Staff Alert */}
      {unassignedStaff.length > 0 && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          <Typography variant="body1" gutterBottom>
            <strong>{unassignedStaff.length} staff member(s) without a supervisor</strong>
          </Typography>
          <Typography variant="body2">
            {unassignedStaff.map(s => formatNameForDisplay(s.name)).join(', ')}
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
                      {formatNameForDisplay(supervisor.name)}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {getDisplayPosition(supervisor.position)}
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
                        label={formatNameForDisplay(staff.name)}
                        size="small"
                        onClick={() => handleOpenEditDialog(staff)}
                        onDelete={() => handleRemoveStaff(staff, type)}
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
                  disabled={assignableStaff.length === 0}
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
        onClose={() => {
          setAssignDialogOpen(false);
          setAssignStaffSearchInput('');
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          Assign Staff to {formatNameForDisplay(selectedSupervisor?.name)}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <TextField
              fullWidth
              label="Search staff"
              placeholder="Type name, position, email, state, or cost center..."
              value={assignStaffSearchInput}
              onChange={(e) => setAssignStaffSearchInput(e.target.value)}
              size="small"
              sx={{ mb: 2 }}
            />
            <List
              dense
              sx={{
                maxHeight: 320,
                overflow: 'auto',
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 1,
              }}
            >
              {assignStaffOptions.length === 0 ? (
                <ListItem sx={{ py: 2 }}>
                  <ListItemText
                    primary={assignStaffSearchInput.trim() ? 'No staff match your search.' : 'No assignable staff (everyone is already a Supervisor or Senior Staff).'}
                  />
                </ListItem>
              ) : (
                assignStaffOptions.map((emp) => {
                  const isSelected = selectedStaff.some((s) => s.id === emp.id);
                  const assignmentContext = formatStaffAssignmentSecondary(emp);
                  return (
                    <ListItemButton
                      key={emp.id}
                      onClick={() => {
                        if (isSelected) {
                          setSelectedStaff((prev) => prev.filter((s) => s.id !== emp.id));
                        } else {
                          setSelectedStaff((prev) => [...prev, emp]);
                        }
                      }}
                    >
                      <Checkbox checked={isSelected} size="small" sx={{ mr: 1 }} />
                      <ListItemText
                        primary={`${formatNameForDisplay(emp.name)} - ${getDisplayPosition(emp.position)}`}
                        secondary={assignmentContext || undefined}
                        primaryTypographyProps={{ variant: 'body2' }}
                        secondaryTypographyProps={{ variant: 'caption', color: 'text.secondary' }}
                      />
                    </ListItemButton>
                  );
                })
              )}
            </List>
            {selectedStaff.length > 0 && (
              <Box sx={{ mt: 2, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {selectedStaff.map((emp) => (
                  <Chip
                    key={emp.id}
                    label={formatNameForDisplay(emp.name)}
                    size="small"
                    onDelete={() => setSelectedStaff((prev) => prev.filter((s) => s.id !== emp.id))}
                  />
                ))}
              </Box>
            )}
            {assignableStaff.length === 0 && (
              <Alert severity="info" sx={{ mt: 2 }}>
                No assignable staff. Only employees who are not Supervisors or Senior Staff can be assigned.
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
                options={employees}
                getOptionLabel={(option) => `${formatNameForDisplay(option.name)} - ${getDisplayPosition(option.position)}`}
                value={employeeToPromote}
                onChange={(_, newValue) => setEmployeeToPromote(newValue)}
                filterOptions={(options, { inputValue }) => {
                  if (!inputValue || !inputValue.trim()) return options;
                  const q = inputValue.trim().toLowerCase();
                  return options.filter((opt) => {
                    const label = `${opt.name ?? ''} - ${opt.position ?? ''}`.toLowerCase();
                    return label.includes(q);
                  });
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Select Employee"
                    placeholder="Search by name or position..."
                  />
                )}
              />
            </FormControl>
            
            {employeeToPromote && (
              <Alert severity="info" sx={{ mt: 2 }}>
                This will grant {formatNameForDisplay(employeeToPromote.name)} the {promoteType === 'senior-staff' ? 'Senior Staff' : 'Supervisor'} designation
                {promoteType === 'supervisor' ? ' and allow them to have staff assigned' : ''}.
                {promoteType === 'senior-staff' && ' Senior Staff can approve reports before their supervisor.'}
                {' Their HR job title will not change.'}
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
          Remove {supervisorToDelete && hasSeniorStaffDesignation(supervisorToDelete) ? 'Senior Staff' : 'Supervisor'} Designation?
        </DialogTitle>
        <DialogContent>
          {supervisorToDelete && (() => {
            const supervisorData = supervisors.find(s => s.supervisor.id === supervisorToDelete.id);
            const staffCount = supervisorData?.staffMembers.length || 0;
            
            return (
              <Alert severity="warning" sx={{ mb: 2 }}>
                <Typography variant="body1" gutterBottom>
                  <strong>Are you sure you want to remove the designation from {formatNameForDisplay(supervisorToDelete?.name)}?</strong>
                </Typography>
            <Typography variant="body2">
              This will:
            </Typography>
            <ul>
              <li>Remove them from the supervisor/senior staff list</li>
              {staffCount > 0 && (
                <li>Unassign their {staffCount} staff member(s)</li>
              )}
              <li>Their job title will remain: <strong>{getDisplayPosition(supervisorToDelete.position)}</strong></li>
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
          Edit Employee - {formatNameForDisplay(employeeToEdit?.name)}
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
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              <GooglePlacesTextField
                label="Street Address"
                value={parseBaseAddress((editFormData.baseAddress as string) || '').street}
                onChange={(value) => updateEditBaseAddressPart('street', value)}
                onPlaceSelected={(address) => setEditFormData({ ...editFormData, baseAddress: toCanonicalAddress(address) })}
                fullWidth
                required
              />
              <Box sx={{ display: 'flex', gap: 1.5 }}>
                <TextField
                  label="City"
                  value={parseBaseAddress((editFormData.baseAddress as string) || '').city}
                  onChange={(e) => updateEditBaseAddressPart('city', e.target.value)}
                  fullWidth
                  required
                />
                <TextField
                  label="State"
                  value={parseBaseAddress((editFormData.baseAddress as string) || '').state}
                  onChange={(e) => updateEditBaseAddressPart('state', e.target.value.toUpperCase().slice(0, 2))}
                  sx={{ width: 100 }}
                  required
                />
                <TextField
                  label="ZIP"
                  value={parseBaseAddress((editFormData.baseAddress as string) || '').zip}
                  onChange={(e) => updateEditBaseAddressPart('zip', e.target.value.replace(/\D/g, '').slice(0, 10))}
                  sx={{ width: 130 }}
                  required
                />
              </Box>
            </Box>
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
              The system will grant the designation in the background without changing their HR job title.
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

