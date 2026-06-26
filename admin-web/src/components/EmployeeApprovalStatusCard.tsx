import React from 'react';
import {
  Card,
  CardContent,
  Box,
  Typography,
  Chip,
  Button,
  Stack,
} from '@mui/material';
import CommentIcon from '@mui/icons-material/ModeCommentOutlined';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import ReplayIcon from '@mui/icons-material/Replay';
import SaveIcon from '@mui/icons-material/Save';
import DoneIcon from '@mui/icons-material/TaskAltOutlined';
import ScheduleIcon from '@mui/icons-material/Schedule';
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

const getStatusChipProps = (status: string) => {
  const key = status?.toLowerCase?.() || 'draft';
  return STATUS_COLOR_MAP[key] || { label: status || 'Unknown', color: 'default' as const };
};

const EmployeeApprovalStatusCard: React.FC<EmployeeApprovalStatusCardProps> = ({
  status,
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

  return (
    <Card variant="outlined" sx={{ mb: 2 }}>
      <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
        <Box display="flex" flexDirection={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} gap={1.5}>
          <Box>
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
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
              {submittedAt && (
                <Typography variant="caption" color="text.secondary">
                  Submitted {formatDateTime(submittedAt)}
                </Typography>
              )}
            </Stack>
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

      </CardContent>
    </Card>
  );
};

export default EmployeeApprovalStatusCard;

