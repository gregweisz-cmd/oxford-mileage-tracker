import React from 'react';
import {
  Card,
  CardContent,
  Box,
  Typography,
  Chip,
  Divider,
  List,
  ListItem,
  ListItemText,
  Tooltip,
  Button,
  Stack,
  Avatar,
} from '@mui/material';
import CommentIcon from '@mui/icons-material/ModeCommentOutlined';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import ReplayIcon from '@mui/icons-material/Replay';
import SaveIcon from '@mui/icons-material/Save';
import DoneIcon from '@mui/icons-material/TaskAltOutlined';
import ScheduleIcon from '@mui/icons-material/Schedule';
import PersonIcon from '@mui/icons-material/PersonOutline';
import type { WeeklyCheckupStatusSummary } from '../utils/weeklyCheckup';
import { WEEKLY_CHECKUP_ROLE_LABELS } from '../utils/weeklyCheckup';

type WorkflowStatus = 'pending' | 'waiting' | 'approved' | 'rejected' | 'revision_requested';

export interface ApprovalWorkflowStepSummary {
  step: number;
  role: string;
  status: WorkflowStatus;
  approverId?: string | null;
  approverName?: string | null;
  delegatedToId?: string | null;
  delegatedToName?: string | null;
  dueAt?: string | null;
  actedAt?: string | null;
  comments?: string | null;
  reminders?: { sentAt: string; sentBy?: string | null }[];
}

export interface ApprovalHistoryEntry {
  id: string;
  action: string;
  actorId?: string | null;
  actorName?: string | null;
  actorRole?: 'employee' | 'supervisor' | 'senior_staff' | 'finance' | 'contracts' | 'admin' | 'approver' | 'system';
  timestamp: string;
  message?: string | null;
}

interface EmployeeApprovalStatusCardProps {
  status: string;
  workflow: ApprovalWorkflowStepSummary[];
  history: ApprovalHistoryEntry[];
  submittedAt?: string | null;
  currentStage?: string | null;
  currentApproverName?: string | null;
  loading?: boolean;
  onAddComment?: () => void;
  /** Jump to the tab with the most revision flags (employee portal) */
  onOpenRevisions?: () => void;
  onResubmit?: () => void;
  onWithdraw?: () => void;
  onSaveChanges?: () => void;
  disableResubmit?: boolean;
  disableWithdraw?: boolean;
  disableSaveChanges?: boolean;
  weeklyCheckupStatus?: WeeklyCheckupStatusSummary | null;
}

const STATUS_COLOR_MAP: Record<string, { label: string; color: 'default' | 'primary' | 'success' | 'warning' | 'error' | 'info' }> = {
  draft: { label: 'Draft', color: 'default' },
  submitted: { label: 'Submitted', color: 'info' },
  pending_supervisor: { label: 'Waiting for Supervisor', color: 'warning' },
  pending_senior_staff: { label: 'Waiting for Senior Staff', color: 'warning' },
  pending_finance: { label: 'Waiting for Finance', color: 'warning' },
  under_review: { label: 'Under Review', color: 'warning' },
  needs_revision: { label: 'Needs Revision', color: 'error' },
  approved: { label: 'Approved', color: 'success' },
  rejected: { label: 'Rejected', color: 'error' },
};

const STEP_STATUS_CONFIG: Record<WorkflowStatus, { label: string; color: string; icon: React.ReactNode }> = {
  pending: { label: 'Pending', color: '#f57c00', icon: <ScheduleIcon fontSize="small" /> },
  waiting: { label: 'Not Started', color: '#757575', icon: <ScheduleIcon fontSize="small" /> },
  approved: { label: 'Approved', color: '#2e7d32', icon: <DoneIcon fontSize="small" /> },
  rejected: { label: 'Rejected', color: '#c62828', icon: <DoneIcon fontSize="small" /> },
  revision_requested: { label: 'Revision Requested', color: '#f57c00', icon: <ReplayIcon fontSize="small" /> },
};

const formatDateTime = (value?: string | null) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

const formatRelative = (value?: string | null) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const now = Date.now();
  const diffMs = now - date.getTime();
  const diffMinutes = Math.round(diffMs / (1000 * 60));
  if (diffMinutes < 1) return 'just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.round(diffHours / 24);
  return `${diffDays}d ago`;
};

const getStatusChipProps = (status: string) => {
  const key = status?.toLowerCase?.() || 'draft';
  return STATUS_COLOR_MAP[key] || { label: status || 'Unknown', color: 'default' as const };
};

const roleLabels: Record<string, string> = {
  senior_staff: 'Senior Staff Review',
  supervisor: 'Supervisor Review',
  finance: 'Finance Review',
};

const EmployeeApprovalStatusCard: React.FC<EmployeeApprovalStatusCardProps> = ({
  status,
  workflow,
  history,
  submittedAt,
  currentStage,
  currentApproverName,
  loading = false,
  onAddComment,
  onOpenRevisions,
  onResubmit,
  onWithdraw,
  onSaveChanges,
  disableResubmit,
  disableWithdraw,
  disableSaveChanges,
  weeklyCheckupStatus,
}) => {
  const statusChip = getStatusChipProps(status);
  const normalizedStatus = (status || 'draft').toLowerCase();
  const isDraft = normalizedStatus === 'draft';
  const isTerminal = normalizedStatus === 'approved' || normalizedStatus === 'rejected';

  const workflowEmptyMessage = () => {
    if (loading) return 'Loading approval workflow…';
    if (isDraft) return 'Approval workflow will appear here once the report is submitted.';
    if (isTerminal) {
      return 'This report is complete. Detailed workflow steps are not available to display.';
    }
    return 'Workflow steps are not available to display. The status above reflects where this report is in the process.';
  };

  const activityEmptyMessage = () => {
    if (loading) return 'Loading activity…';
    if (isDraft) return 'Activity will appear here as the report moves through approvals.';
    if (isTerminal) {
      return 'No timeline entries are available to display for this report.';
    }
    return 'No approval activity has been logged yet for this report.';
  };

  return (
    <Card variant="outlined" sx={{ mb: 3 }}>
      <CardContent>
        <Box display="flex" flexDirection={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} gap={2} mb={3}>
          <Box>
            <Typography variant="h6" gutterBottom>
              Approval Progress
            </Typography>
            <Stack direction="row" spacing={1} alignItems="center">
              <Chip label={statusChip.label} color={statusChip.color} size="small" />
              {currentStage && (
                <Typography variant="body2" color="text.secondary">
                  Current Stage: {currentStage.replace(/_/g, ' ')}
                </Typography>
              )}
              {currentApproverName && (
                <Typography variant="body2" color="text.secondary">
                  Owner: {currentApproverName}
                </Typography>
              )}
            </Stack>
            {submittedAt && (
              <Typography variant="caption" color="text.secondary">
                Submitted {formatDateTime(submittedAt)}
              </Typography>
            )}
          </Box>
          <Stack direction="row" spacing={1} flexWrap="wrap">
            {onAddComment && (
              <Button variant="outlined" size="small" startIcon={<CommentIcon />} onClick={onAddComment} disabled={loading}>
                Add Comment
              </Button>
            )}
            {onOpenRevisions && (
              <Button
                variant="outlined"
                size="small"
                color="warning"
                startIcon={<OpenInNewIcon />}
                onClick={onOpenRevisions}
                disabled={loading}
                sx={{ textTransform: 'none' }}
              >
                Open revisions
              </Button>
            )}
            {onSaveChanges && (
              <Button
                variant="contained"
                size="small"
                startIcon={<SaveIcon />}
                color="primary"
                onClick={onSaveChanges}
                disabled={loading || disableSaveChanges}
                sx={{ textTransform: 'none' }}
              >
                Save Changes
              </Button>
            )}
            {onWithdraw && (
              <Button
                variant="outlined"
                size="small"
                color="warning"
                onClick={onWithdraw}
                disabled={loading || disableWithdraw}
              >
                Withdraw Submission
              </Button>
            )}
            {onResubmit && (
              <Button
                variant="contained"
                size="small"
                startIcon={<ReplayIcon />}
                color="primary"
                onClick={onResubmit}
                disabled={loading || disableResubmit}
              >
                Resubmit for Approval
              </Button>
            )}
          </Stack>
        </Box>

        {onSaveChanges && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Your report is in review, but you can still edit entries below. Click Save Changes when you are done — your reviewer will see the latest version. Withdraw is optional if you prefer to return the report to draft.
          </Typography>
        )}

        {weeklyCheckupStatus?.sharedAt && (
          <Box
            sx={{
              mb: 2,
              p: 2,
              border: '1px solid',
              borderColor: weeklyCheckupStatus.isFullyAcknowledged ? 'success.light' : 'info.light',
              borderRadius: 1,
              bgcolor: weeklyCheckupStatus.isFullyAcknowledged
                ? 'rgba(46, 125, 50, 0.08)'
                : 'rgba(2, 136, 209, 0.08)',
            }}
          >
            <Typography variant="subtitle2" gutterBottom>
              Weekly check-up
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              Shared {formatDateTime(weeklyCheckupStatus.sharedAt)}
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 1 }}>
              {(['senior_staff', 'supervisor'] as const).map((role) => {
                const ack = weeklyCheckupStatus.acknowledgments.find((item) => item.role === role);
                if (!ack && !weeklyCheckupStatus.pendingRoles.includes(role)) return null;
                const label = WEEKLY_CHECKUP_ROLE_LABELS[role];
                if (ack) {
                  return (
                    <Chip
                      key={role}
                      size="small"
                      color="success"
                      icon={<DoneIcon />}
                      label={`${label}: ${ack.approverName || 'Acknowledged'}`}
                    />
                  );
                }
                return (
                  <Chip
                    key={role}
                    size="small"
                    color="warning"
                    icon={<ScheduleIcon />}
                    label={`${label}: waiting`}
                  />
                );
              })}
            </Stack>
            <Typography variant="body2">
              {weeklyCheckupStatus.isFullyAcknowledged
                ? 'Your reviewers acknowledged this week\'s check-up. You\'re good to go.'
                : 'Waiting for your reviewer(s) to acknowledge this week\'s check-up. This is separate from monthly approval.'}
            </Typography>
          </Box>
        )}

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: '1fr',
              md: 'repeat(2, minmax(0, 1fr))',
            },
            gap: 2,
            mb: 2,
          }}
        >
          {workflow.length === 0 ? (
            <Box sx={{ gridColumn: '1 / -1' }}>
              <Typography variant="body2" color="text.secondary">
                {workflowEmptyMessage()}
              </Typography>
            </Box>
          ) : (
            workflow.map((step) => {
              const config = STEP_STATUS_CONFIG[step.status] || STEP_STATUS_CONFIG.pending;
              return (
                <Box
                  key={`${step.role}-${step.step}`}
                  sx={{
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 1,
                    p: 2,
                    height: '100%',
                  }}
                >
                  <Stack direction="row" spacing={1} alignItems="center" mb={1.5}>
                    <Avatar sx={{ width: 28, height: 28, bgcolor: config.color, color: '#fff' }}>
                      <PersonIcon fontSize="small" />
                    </Avatar>
                    <Box>
                      <Typography variant="subtitle2">{roleLabels[step.role] || step.role}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        Step {step.step + 1}
                      </Typography>
                    </Box>
                  </Stack>

                  <Stack direction="row" spacing={1} alignItems="center" mb={1}>
                    {config.icon}
                    <Typography variant="body2" sx={{ color: config.color }}>
                      {config.label}
                    </Typography>
                  </Stack>

                  <Typography variant="body2" gutterBottom>
                    Approver: {step.delegatedToName || step.approverName || 'Unassigned'}
                  </Typography>

                  <Typography variant="body2" color="text.secondary">
                    Due: {formatDateTime(step.dueAt)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Updated: {formatDateTime(step.actedAt)}
                  </Typography>
                  {step.comments && (
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                      Notes: {step.comments}
                    </Typography>
                  )}
                  {step.reminders && step.reminders.length > 0 && (
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                      {step.reminders.length} reminder{step.reminders.length > 1 ? 's' : ''} sent
                    </Typography>
                  )}
                </Box>
              );
            })
          )}
        </Box>

        <Divider sx={{ my: 2 }} />

        <Typography variant="subtitle1" gutterBottom>
          Activity
        </Typography>

        {history.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            {activityEmptyMessage()}
          </Typography>
        ) : (
          <List dense disablePadding>
            {history.map((entry) => (
              <React.Fragment key={entry.id}>
                <ListItem alignItems="flex-start" disableGutters>
                  <ListItemText
                    primary={
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Typography variant="body2" fontWeight={600}>
                          {entry.actorName || (entry.actorRole === 'system' ? 'System' : 'Unknown')}
                        </Typography>
                        <Chip
                          size="small"
                          variant="outlined"
                          label={entry.action.replace(/_/g, ' ')}
                        />
                        <Tooltip title={formatDateTime(entry.timestamp)} placement="top">
                          <Typography variant="caption" color="text.secondary">
                            {formatRelative(entry.timestamp)}
                          </Typography>
                        </Tooltip>
                      </Stack>
                    }
                    secondary={entry.message || undefined}
                    secondaryTypographyProps={{ component: 'div' }}
                  />
                </ListItem>
                <Divider component="li" />
              </React.Fragment>
            ))}
          </List>
        )}
      </CardContent>
    </Card>
  );
};

export default EmployeeApprovalStatusCard;

