import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { Save as SaveIcon, Refresh as RefreshIcon } from '@mui/icons-material';
import { apiGet, apiFetch } from '../services/rateLimitedApi';
import { useToast } from '../contexts/ToastContext';
import { formatNameForDisplay } from '../utils/employeeUtils';
import { getDisplayPosition } from '../utils/staffDesignations';
import { debugError } from '../config/debug';

interface GroupMember {
  id: string;
  name: string;
  preferredName?: string | null;
  email: string;
  position: string;
  seniorStaffId: string | null;
  isSeniorStaff: boolean;
}

interface GroupResponse {
  supervisorId: string;
  members: GroupMember[];
  seniorStaff: Array<{ id: string; name: string; preferredName?: string | null; email: string }>;
}

interface SupervisorTeamManagementTabProps {
  supervisorId: string;
  supervisorName: string;
  /** Called after group changes so parent can refresh its team list (e.g. Reports tab). */
  onGroupChanged?: () => void;
}

function memberDisplayName(m: Pick<GroupMember, 'name' | 'preferredName'>): string {
  return formatNameForDisplay(m.preferredName?.trim() || m.name);
}

const SupervisorTeamManagementTab: React.FC<SupervisorTeamManagementTabProps> = ({
  supervisorId,
  supervisorName,
  onGroupChanged,
}) => {
  const { showSuccess, showError, showInfo } = useToast();
  const [loading, setLoading] = useState(true);
  const [savingAssignments, setSavingAssignments] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [seniorStaffOptions, setSeniorStaffOptions] = useState<GroupResponse['seniorStaff']>([]);
  const [draftAssignments, setDraftAssignments] = useState<Record<string, string | null>>({});
  const [savedAssignments, setSavedAssignments] = useState<Record<string, string | null>>({});

  const loadGroup = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiGet<GroupResponse>(
        `/api/supervisors/${encodeURIComponent(supervisorId)}/group`,
        { skipCache: true }
      );
      const list = data.members || [];
      setMembers(list);
      setSeniorStaffOptions(data.seniorStaff || []);
      const assignments: Record<string, string | null> = {};
      for (const m of list) {
        assignments[m.id] = m.seniorStaffId || null;
      }
      setDraftAssignments(assignments);
      setSavedAssignments(assignments);
    } catch (error) {
      debugError('Failed to load supervisor group:', error);
      showError('Could not load your team. Try refreshing or sign in again.');
      setMembers([]);
      setSeniorStaffOptions([]);
    } finally {
      setLoading(false);
    }
  }, [supervisorId, showError]);

  useEffect(() => {
    loadGroup();
  }, [loadGroup]);

  const assignmentChanges = useMemo(() => {
    const changes: Array<{ employeeId: string; seniorStaffId: string | null }> = [];
    for (const m of members) {
      if (m.isSeniorStaff) continue;
      const draft = draftAssignments[m.id] ?? null;
      const saved = savedAssignments[m.id] ?? null;
      if (draft !== saved) {
        changes.push({ employeeId: m.id, seniorStaffId: draft });
      }
    }
    return changes;
  }, [members, draftAssignments, savedAssignments]);

  const hasUnsavedAssignments = assignmentChanges.length > 0;

  const seniorStaffNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of seniorStaffOptions) {
      map.set(s.id, formatNameForDisplay(s.preferredName?.trim() || s.name));
    }
    return map;
  }, [seniorStaffOptions]);

  const approvalChainForMember = useCallback(
    (member: GroupMember): string => {
      const supervisorLabel = `${formatNameForDisplay(supervisorName)} (Supervisor)`;
      if (member.isSeniorStaff) {
        return `${memberDisplayName(member)} (Senior Staff) → ${supervisorLabel} → Finance`;
      }
      const assignId = draftAssignments[member.id] ?? null;
      if (assignId) {
        const seniorLabel = seniorStaffNameById.get(assignId) || 'Senior Staff';
        return `${memberDisplayName(member)} → ${seniorLabel} (Senior Staff) → ${supervisorLabel} → Finance`;
      }
      return `${memberDisplayName(member)} → ${supervisorLabel} → Finance`;
    },
    [draftAssignments, seniorStaffNameById, supervisorName]
  );

  const handleToggleSeniorStaff = async (member: GroupMember, next: boolean) => {
    if (!next) {
      const dependents = members.filter((m) => m.seniorStaffId === member.id);
      const dependentNames = dependents.map((d) => memberDisplayName(d)).join(', ');
      const msg =
        dependents.length > 0
          ? `${memberDisplayName(member)} will no longer be Senior Staff.\n\nThese team members report to them and will be unassigned: ${dependentNames}.\n\nAny reports waiting on ${memberDisplayName(member)} will be re-routed to you or the next approver.\n\nContinue?`
          : `${memberDisplayName(member)} will no longer be Senior Staff. Continue?`;
      if (!window.confirm(msg)) return;
    }

    setTogglingId(member.id);
    try {
      const response = await apiFetch(
        `/api/supervisors/${encodeURIComponent(supervisorId)}/group/members/${encodeURIComponent(member.id)}/senior-staff`,
        {
          method: 'PATCH',
          body: JSON.stringify({ isSeniorStaff: next }),
        }
      );
      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}));
        throw new Error(errBody.error || 'Failed to update designation');
      }
      const result = await response.json();
      showSuccess(
        next
          ? `${memberDisplayName(member)} is now Senior Staff.`
          : `${memberDisplayName(member)} is no longer Senior Staff.`
      );
      if (result.detachedReports?.length) {
        const rerouted = result.detachedReports.reduce(
          (sum: number, d: { reroutedReports?: number }) => sum + (d.reroutedReports || 0),
          0
        );
        if (rerouted > 0) {
          showInfo(`${rerouted} in-flight report(s) were re-routed to the new approver.`);
        }
      }
      await loadGroup();
      onGroupChanged?.();
    } catch (error) {
      debugError('Senior staff toggle failed:', error);
      showError(error instanceof Error ? error.message : 'Failed to update Senior Staff designation');
    } finally {
      setTogglingId(null);
    }
  };

  const handleSaveAssignments = async () => {
    if (assignmentChanges.length === 0) return;
    setSavingAssignments(true);
    try {
      const response = await apiFetch(
        `/api/supervisors/${encodeURIComponent(supervisorId)}/group/assignments`,
        {
          method: 'PATCH',
          body: JSON.stringify({ assignments: assignmentChanges }),
        }
      );
      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}));
        throw new Error(errBody.error || 'Failed to save assignments');
      }
      const result = await response.json();
      const failed = (result.results || []).filter((r: { ok?: boolean }) => !r.ok);
      const succeeded = (result.results || []).filter((r: { ok?: boolean }) => r.ok);
      if (failed.length > 0) {
        const firstErr = failed[0]?.error || 'Some assignments could not be saved';
        showError(firstErr);
      }
      if (succeeded.length > 0) {
        const rerouted = succeeded.reduce(
          (sum: number, r: { reroutedReports?: number }) => sum + (r.reroutedReports || 0),
          0
        );
        showSuccess(
          rerouted > 0
            ? `Assignments saved. ${rerouted} in-flight report(s) re-routed to the new approver.`
            : 'Reporting assignments saved.'
        );
      }
      await loadGroup();
      onGroupChanged?.();
    } catch (error) {
      debugError('Save assignments failed:', error);
      showError(error instanceof Error ? error.message : 'Failed to save assignments');
    } finally {
      setSavingAssignments(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2, gap: 2, flexWrap: 'wrap' }}>
        <Box>
          <Typography variant="h6" gutterBottom>
            Team setup
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 720 }}>
            Designate Senior Staff in your group and choose who each team member reports to for expense
            report approval. Changes apply to future submissions; reports already waiting on Senior Staff
            are re-routed to the new approver when you change an assignment.
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button startIcon={<RefreshIcon />} variant="outlined" onClick={loadGroup} disabled={savingAssignments}>
            Refresh
          </Button>
          <Button
            startIcon={<SaveIcon />}
            variant="contained"
            disabled={!hasUnsavedAssignments || savingAssignments}
            onClick={handleSaveAssignments}
          >
            {savingAssignments ? 'Saving…' : 'Save assignments'}
          </Button>
        </Box>
      </Box>

      {seniorStaffOptions.length === 0 && members.length > 0 && (
        <Alert severity="info" sx={{ mb: 2 }}>
          No Senior Staff in your group yet. Turn on &quot;Senior Staff&quot; for one or more team members
          below, then assign who reports to whom.
        </Alert>
      )}

      {hasUnsavedAssignments && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          You have unsaved reporting assignment changes.
        </Alert>
      )}

      {members.length === 0 ? (
        <Alert severity="info">No active team members are assigned to you yet. Contact an administrator if someone is missing.</Alert>
      ) : (
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Employee</TableCell>
                <TableCell>Position</TableCell>
                <TableCell align="center">Senior Staff</TableCell>
                <TableCell>Reports to (Senior Staff)</TableCell>
                <TableCell>Approval chain</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {members.map((member) => {
                const isToggling = togglingId === member.id;
                const assignValue = draftAssignments[member.id] ?? null;
                const assignDirty = (savedAssignments[member.id] ?? null) !== assignValue;

                return (
                  <TableRow key={member.id} hover>
                    <TableCell>
                      <Typography variant="body2" fontWeight={600}>
                        {memberDisplayName(member)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {member.email}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{getDisplayPosition(member.position)}</Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Switch
                        checked={member.isSeniorStaff}
                        disabled={isToggling || savingAssignments}
                        onChange={(_, checked) => handleToggleSeniorStaff(member, checked)}
                        inputProps={{ 'aria-label': `Senior Staff for ${memberDisplayName(member)}` }}
                      />
                      {isToggling && <CircularProgress size={16} sx={{ ml: 1, verticalAlign: 'middle' }} />}
                    </TableCell>
                    <TableCell sx={{ minWidth: 220 }}>
                      {member.isSeniorStaff ? (
                        <Chip label="Senior Staff reviewer" size="small" color="primary" variant="outlined" />
                      ) : seniorStaffOptions.length === 0 ? (
                        <Typography variant="body2" color="text.secondary">
                          —
                        </Typography>
                      ) : (
                        <FormControl size="small" fullWidth>
                          <InputLabel id={`senior-staff-${member.id}`}>Senior Staff</InputLabel>
                          <Select
                            labelId={`senior-staff-${member.id}`}
                            label="Senior Staff"
                            value={assignValue || ''}
                            onChange={(e) => {
                              const v = e.target.value;
                              setDraftAssignments((prev) => ({
                                ...prev,
                                [member.id]: v ? String(v) : null,
                              }));
                            }}
                            disabled={savingAssignments}
                            sx={assignDirty ? { '& .MuiOutlinedInput-notchedOutline': { borderColor: 'warning.main' } } : undefined}
                          >
                            <MenuItem value="">
                              <em>None (goes to Supervisor)</em>
                            </MenuItem>
                            {seniorStaffOptions
                              .filter((s) => s.id !== member.id)
                              .map((s) => (
                                <MenuItem key={s.id} value={s.id}>
                                  {formatNameForDisplay(s.preferredName?.trim() || s.name)}
                                </MenuItem>
                              ))}
                          </Select>
                        </FormControl>
                      )}
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', maxWidth: 280 }}>
                        {approvalChainForMember(member)}
                      </Typography>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
};

export default SupervisorTeamManagementTab;
