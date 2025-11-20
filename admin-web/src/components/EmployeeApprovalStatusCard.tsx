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
import ReplayIcon from '@mui/icons-material/Replay';
import DoneIcon from '@mui/icons-material/TaskAltOutlined';
import ScheduleIcon from '@mui/icons-material/Schedule';
import PersonIcon from '@mui/icons-material/PersonOutline';

type WorkflowStatus = 'pending' | 'waiting' | 'approved' | 'rejected';

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
  actorRole?: 'employee' | 'supervisor' | 'system';
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
  onResubmit?: () => void;
  disableResubmit?: boolean;
}

const STATUS_COLOR_MAP: Record<string, { label: string; color: 'default' | 'primary' | 'success' | 'warning' | 'error' | 'info' }> = {
  draft: { label: 'Draft', color: 'default' },
  submitted: { label: 'Submitted', color: 'info' },
  pending_supervisor: { label: 'Waiting for Supervisor', color: 'warning' },
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
  onResubmit,
  disableResubmit,
}) => {
  const statusChip = getStatusChipProps(status);

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
          <Stack direction="row" spacing={1}>
            {onAddComment && (
              <Button variant="outlined" size="small" startIcon={<CommentIcon />} onClick={onAddComment} disabled={loading}>
                Add Comment
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
                Approval workflow will appear here once the report is submitted.
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
            Activity will appear here as the report moves through approvals.
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

