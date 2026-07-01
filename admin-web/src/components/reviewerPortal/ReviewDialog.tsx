import React from 'react';
import { portalCertificationBoxSx } from '../../theme/portalSurfaces';
import {
  Box,
  Typography,
  Chip,
  Button,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  List,
  ListItem,
  ListItemText,
  Checkbox,
} from '@mui/material';
import { Visibility as VisibilityIcon } from '@mui/icons-material';
import { ReviewDialogMode, ReviewerComment, TeamReport } from './shared';

/**
 * Role-specific wording for the review dialog. The Supervisor and Senior Staff portals
 * share identical dialog structure but differ in a handful of strings; passing them in
 * keeps the two portals behaviorally identical to their pre-refactor versions.
 */
export interface ReviewDialogLabels {
  approveTitle: string;
  approveAlert: string;
  certNotRequiredText: string;
  revisionAlert: string;
  certificationCheckboxLabel: string;
  approveButtonLabel: string;
}

export interface ReviewDialogProps {
  open: boolean;
  onClose: () => void;
  mode: ReviewDialogMode | null;
  report: TeamReport | null;
  reviewComment: string;
  onReviewCommentChange: (value: string) => void;
  certificationAcknowledged: boolean;
  onCertificationAcknowledgedChange: (value: boolean) => void;
  savingAction: boolean;
  /**
   * Whether this reviewer signs/certifies on approval. Supervisors do; senior staff (a
   * review-only first pass) do not, so the certification UI and gating are hidden for them.
   */
  requiresCertification: boolean;
  labels: ReviewDialogLabels;
  /** Resolves the author name shown under a previous comment (role-specific field). */
  commentAuthorName: (comment: ReviewerComment) => string | undefined;
  onViewFullDetails: (reportId: string) => void;
  onApprove: (reportId: string) => void;
  onRequestRevision: (reportId: string) => void;
  onResubmitToFinance: (reportId: string) => void;
}

/**
 * Shared review dialog used by both reviewer portals: separate flows for approve vs
 * revision vs finance follow-up. Visual/behavioral output is identical to the original
 * inline dialog; the only differences are supplied via `labels` and `commentAuthorName`.
 */
const ReviewDialog: React.FC<ReviewDialogProps> = ({
  open,
  onClose,
  mode,
  report,
  reviewComment,
  onReviewCommentChange,
  certificationAcknowledged,
  onCertificationAcknowledgedChange,
  savingAction,
  requiresCertification,
  labels,
  commentAuthorName,
  onViewFullDetails,
  onApprove,
  onRequestRevision,
  onResubmitToFinance,
}) => {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        {mode === 'revision' && 'Request revision from employee'}
        {mode === 'approve' && labels.approveTitle}
        {mode === 'finance_return' && 'Finance follow-up'}
      </DialogTitle>
      <DialogContent>
        {report && (() => {
          const requiresSupervisorCertification =
            (report.submissionType || '').toLowerCase() !== 'weekly_checkup';
          const reportPeriodLabel = `${new Date(report.year, report.month - 1).toLocaleString('default', { month: 'long' })} ${report.year}`;
          return (
            <Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {report.employeeName} — {reportPeriodLabel}
              </Typography>
              <Box sx={{ display: 'flex', gap: 4, mb: 3 }}>
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    Total Amount
                  </Typography>
                  <Typography variant="h5">${report.totalAmount.toFixed(2)}</Typography>
                </Box>
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    Total Miles
                  </Typography>
                  <Typography variant="h5">{report.totalMiles.toFixed(1)}</Typography>
                </Box>
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    Total Hours
                  </Typography>
                  <Typography variant="h5">{report.totalHours.toFixed(1)}</Typography>
                </Box>
              </Box>

              <Typography variant="h6" gutterBottom sx={{ mt: 1 }}>
                Cost centers
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, mb: 3 }}>
                {report.costCenters.map((cc) => (
                  <Chip key={cc} label={cc} />
                ))}
              </Box>

              {report.comments && report.comments.length > 0 && (
                <>
                  <Typography variant="h6" gutterBottom>
                    Previous comments
                  </Typography>
                  <List>
                    {report.comments.map((comment) => (
                      <ListItem key={comment.id}>
                        <ListItemText
                          primary={comment.comment}
                          secondary={`by ${commentAuthorName(comment)} on ${new Date(comment.createdAt).toLocaleString()}`}
                        />
                      </ListItem>
                    ))}
                  </List>
                </>
              )}

              {mode === 'approve' && requiresCertification && requiresSupervisorCertification && (
                <Box sx={{ mt: 2, ...portalCertificationBoxSx }}>
                  <Typography variant="body2" sx={{ mb: 2, fontStyle: 'italic' }} component="div">
                    By signing and submitting this report to Oxford House, Inc., I certify under penalty of perjury that the pages herein document genuine, valid, and necessary expenditures, as well as an accurate record of my time and travel on behalf of Oxford House, Inc.
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Checkbox
                      checked={certificationAcknowledged}
                      onChange={(e) => onCertificationAcknowledgedChange(e.target.checked)}
                      size="small"
                    />
                    <Typography variant="body2" component="div">
                      {labels.certificationCheckboxLabel}
                    </Typography>
                  </Box>
                </Box>
              )}

              {mode === 'finance_return' && requiresCertification && requiresSupervisorCertification && (
                <Box sx={{ mt: 2, ...portalCertificationBoxSx }}>
                  <Typography variant="body2" sx={{ mb: 2, fontStyle: 'italic' }} component="div">
                    By signing and submitting this report to Oxford House, Inc., I certify under penalty of perjury that the pages herein document genuine, valid, and necessary expenditures, as well as an accurate record of my time and travel on behalf of Oxford House, Inc.
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Checkbox
                      checked={certificationAcknowledged}
                      onChange={(e) => onCertificationAcknowledgedChange(e.target.checked)}
                      size="small"
                    />
                    <Typography variant="body2" component="div">
                      {labels.certificationCheckboxLabel}
                    </Typography>
                  </Box>
                </Box>
              )}

              <Box sx={{ mt: 2, mb: 2 }}>
                <Button
                  variant="outlined"
                  startIcon={<VisibilityIcon />}
                  onClick={() => onViewFullDetails(report.id)}
                >
                  View full report details
                </Button>
              </Box>

              {mode === 'revision' && (
                <>
                  <Alert severity="info" sx={{ mb: 2 }}>
                    {labels.revisionAlert}
                  </Alert>
                  <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
                    Feedback for employee (required)
                  </Typography>
                  <TextField
                    fullWidth
                    multiline
                    rows={4}
                    value={reviewComment}
                    onChange={(e) => onReviewCommentChange(e.target.value)}
                    placeholder="Describe what needs to be corrected or clarified before they resubmit..."
                  />
                </>
              )}

              {mode === 'approve' && (
                <>
                  <Alert severity="success" sx={{ mb: 2 }} variant="outlined">
                    {labels.approveAlert}
                  </Alert>
                  {requiresCertification && !requiresSupervisorCertification && (
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      {labels.certNotRequiredText}
                    </Typography>
                  )}
                </>
              )}

              {mode === 'finance_return' && (
                <>
                  <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
                    Comments (required)
                  </Typography>
                  <TextField
                    fullWidth
                    multiline
                    rows={3}
                    value={reviewComment}
                    onChange={(e) => onReviewCommentChange(e.target.value)}
                    placeholder="Describe changes made (e.g. 'Fixed missing receipts, corrected mileage per finance feedback') or explain if sending back to the employee..."
                  />
                  <Alert severity="info" sx={{ mt: 2 }}>
                    <Typography component="div" variant="body2">
                      This report was returned from Finance. You can resubmit to Finance after corrections, or send it back to the employee for revision.
                    </Typography>
                  </Alert>
                </>
              )}
            </Box>
          );
        })()}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2, flexWrap: 'wrap', gap: 1 }}>
        <Button onClick={onClose}>Cancel</Button>
        {mode === 'revision' && (
          <Button
            variant="contained"
            color="warning"
            onClick={() => report && onRequestRevision(report.id)}
            disabled={savingAction || !reviewComment.trim()}
          >
            Request revision from employee
          </Button>
        )}
        {mode === 'approve' && (
          <Button
            variant="contained"
            color="success"
            onClick={() => report && onApprove(report.id)}
            disabled={
              savingAction ||
              (requiresCertification &&
                (report?.submissionType || '').toLowerCase() !== 'weekly_checkup' &&
                !certificationAcknowledged)
            }
          >
            {labels.approveButtonLabel}
          </Button>
        )}
        {mode === 'finance_return' && (
          <>
            <Button
              onClick={() => report && onRequestRevision(report.id)}
              color="error"
              disabled={savingAction || !reviewComment.trim()}
            >
              Send back to employee
            </Button>
            <Button
              onClick={() => report && onResubmitToFinance(report.id)}
              color="success"
              variant="contained"
              disabled={savingAction || !reviewComment.trim()}
            >
              Resubmit to finance
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default ReviewDialog;
