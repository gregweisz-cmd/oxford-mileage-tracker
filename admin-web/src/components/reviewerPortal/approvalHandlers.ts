/**
 * Shared approval-action handlers for the reviewer portals (Supervisor + Senior Staff).
 *
 * These six handlers were duplicated almost verbatim between the two portals; they differ
 * only by the reviewer's id/name, three user-facing alert strings, and the revision-error
 * strategy. Everything else (request bodies, success/failure flow, state orchestration) is
 * identical, so it lives here and is parameterized via `ReviewerApprovalParams`.
 *
 * This is a plain factory (not a React hook): it uses no hooks internally and simply closes
 * over the values/setters passed in. The portals call it on every render exactly where they
 * previously declared these handlers inline, so behavior (including re-creating the closures
 * each render) is unchanged.
 */
import { fetchExpenseReportById, requiresSupervisorCertification } from '../../utils/signatureApi';
import { debugError } from '../../config/debug';
import { putExpenseReportApproval, TeamReport } from './shared';

export interface SelectedItemsForRevision {
  mileage: Set<string>;
  dailyDescriptions: Set<string>;
  timeTracking: Set<string>;
  receipts: Set<string>;
  perDiemDays: Set<string>;
}

/** Role-specific, user-facing strings used by the approve flow. */
export interface ReviewerApprovalLabels {
  /** Shown when the reviewer must upload a signature before approving. */
  signatureMissingAlert: string;
  /** Shown when signature validation fails unexpectedly. */
  signatureVerifyError: string;
  /** Shown after a successful approval initiated from the employee report view. */
  approveSuccessAlert: string;
}

export interface ReviewerApprovalParams {
  reviewerId: string;
  reviewerName: string;
  labels: ReviewerApprovalLabels;
  /**
   * Whether this reviewer signs/certifies on approval. Supervisors do (subject to submission
   * type); senior staff are a review-only first pass and never sign — they just advance the
   * report to the supervisor. When false, the approve flow skips signature/certification.
   */
  requiresCertification: boolean;

  // Live state read by the handlers.
  teamReports: TeamReport[];
  certificationAcknowledged: boolean;
  reviewComment: string;
  selectedItemsForRevision: SelectedItemsForRevision | null;
  showEmployeeReportView: boolean;
  delegateReport: TeamReport | null;
  selectedDelegateId: string;

  // Setters / callbacks the handlers invoke.
  setSavingAction: (value: boolean) => void;
  closeReviewDialog: () => void;
  loadTeamReports: () => Promise<void> | void;
  setShowEmployeeReportView: (value: boolean) => void;
  closeDelegateDialog: () => void;
  setCommentDialogOpen: (value: boolean) => void;
  setReviewComment: (value: string) => void;

  /** Role-specific handling for an error thrown while requesting a revision. */
  onRequestRevisionError: (error: unknown, message: string) => void;
}

export interface ReviewerApprovalHandlers {
  handleApproveReport: (reportId: string) => Promise<void>;
  handleRejectReport: (reportId: string) => Promise<void>;
  handleResubmitToFinance: (reportId: string) => Promise<void>;
  handleDelegateSubmit: () => Promise<void>;
  handleSendReminder: (reportId: string) => Promise<void>;
  handleAddComment: (reportId: string) => Promise<void>;
}

export function createReviewerApprovalHandlers(
  params: ReviewerApprovalParams
): ReviewerApprovalHandlers {
  const {
    reviewerId,
    reviewerName,
    labels,
    requiresCertification,
    teamReports,
    certificationAcknowledged,
    reviewComment,
    selectedItemsForRevision,
    showEmployeeReportView,
    delegateReport,
    selectedDelegateId,
    setSavingAction,
    closeReviewDialog,
    loadTeamReports,
    setShowEmployeeReportView,
    closeDelegateDialog,
    setCommentDialogOpen,
    setReviewComment,
    onRequestRevisionError,
  } = params;

  const handleApproveReport = async (reportId: string) => {
    const report = teamReports.find((r) => r.id === reportId);
    const needsCert = requiresSupervisorCertification(report?.submissionType);

    // Senior staff (requiresCertification === false) approve without signing: this is a
    // review-only step that just advances the report to the supervisor.
    if (requiresCertification) {
      if (needsCert && !certificationAcknowledged) {
        alert('Please acknowledge the certification statement before approving the report.');
        return;
      }

      try {
        const fullReport = await fetchExpenseReportById(reportId);
        const reportData = (fullReport.reportData || {}) as Record<string, unknown>;
        if (needsCert && !reportData.supervisorSignature) {
          alert(labels.signatureMissingAlert);
          return;
        }
      } catch (error) {
        debugError('Error validating signature:', error);
        alert(labels.signatureVerifyError);
        return;
      }
    }

    setSavingAction(true);
    try {
      const approvalBody: Record<string, unknown> = {
        action: 'approve',
        approverId: reviewerId,
        approverName: reviewerName,
      };
      // Only the signing reviewer (supervisor) sends a certification acknowledgment.
      if (requiresCertification) {
        approvalBody.supervisorCertificationAcknowledged = needsCert ? certificationAcknowledged : false;
      }
      await putExpenseReportApproval(reportId, approvalBody);

      closeReviewDialog();
      await loadTeamReports();
      if (showEmployeeReportView) {
        setShowEmployeeReportView(false);
        alert(labels.approveSuccessAlert);
      }
    } catch (error) {
      debugError('Error approving report:', error);
      alert('Failed to approve report. Please try again.');
    } finally {
      setSavingAction(false);
    }
  };

  const handleRejectReport = async (reportId: string) => {
    if (!reviewComment.trim()) {
      alert('Please provide a reason for rejection.');
      return;
    }

    setSavingAction(true);
    try {
      // Use request_revision_to_employee action to send back to employee
      const body: any = {
        action: 'request_revision_to_employee',
        approverId: reviewerId,
        approverName: reviewerName,
        comments: reviewComment.trim(),
      };

      // Include selected items if any were selected
      if (selectedItemsForRevision) {
        body.selectedItems = {
          mileage: Array.from(selectedItemsForRevision.mileage),
          dailyDescriptions: Array.from(selectedItemsForRevision.dailyDescriptions),
          receipts: Array.from(selectedItemsForRevision.receipts),
          timeTracking: Array.from(selectedItemsForRevision.timeTracking),
          perDiemDays: Array.from(selectedItemsForRevision.perDiemDays),
        };
      }

      await putExpenseReportApproval(reportId, body);

      closeReviewDialog();
      await loadTeamReports();
      alert('Report sent back to employee for revision.');
    } catch (error) {
      debugError('Error requesting revision:', error);
      const message =
        error instanceof Error ? error.message : 'Failed to request revision. Please try again.';
      onRequestRevisionError(error, message);
    } finally {
      setSavingAction(false);
    }
  };

  const handleResubmitToFinance = async (reportId: string) => {
    if (!reviewComment.trim()) {
      alert('Please provide comments about the changes made (e.g., "Changes made per finance feedback").');
      return;
    }

    setSavingAction(true);
    try {
      await putExpenseReportApproval(reportId, {
        action: 'resubmit_to_finance',
        approverId: reviewerId,
        approverName: reviewerName,
        comments: reviewComment.trim(),
      });

      closeReviewDialog();
      await loadTeamReports();
      alert('Report resubmitted to Finance team.');
    } catch (error) {
      debugError('Error resubmitting to finance:', error);
      alert('Failed to resubmit to finance. Please try again.');
    } finally {
      setSavingAction(false);
    }
  };

  const handleDelegateSubmit = async () => {
    if (!delegateReport || !selectedDelegateId) {
      alert('Please select a delegate.');
      return;
    }

    setSavingAction(true);
    try {
      await putExpenseReportApproval(delegateReport.id, {
        action: 'delegate',
        approverId: reviewerId,
        approverName: reviewerName,
        delegateId: selectedDelegateId,
      });

      await loadTeamReports();
      closeDelegateDialog();
    } catch (error) {
      debugError('Error delegating report:', error);
      alert('Failed to delegate report. Please try again.');
    } finally {
      setSavingAction(false);
    }
  };

  const handleSendReminder = async (reportId: string) => {
    try {
      await putExpenseReportApproval(reportId, {
        action: 'remind',
        approverId: reviewerId,
        approverName: reviewerName,
      });

      await loadTeamReports();
    } catch (error) {
      debugError('Error sending reminder:', error);
      alert('Failed to send reminder. Please try again.');
    }
  };

  const handleAddComment = async (reportId: string) => {
    if (!reviewComment.trim()) return;

    setSavingAction(true);
    try {
      await putExpenseReportApproval(reportId, {
        action: 'comment',
        approverId: reviewerId,
        approverName: reviewerName,
        comments: reviewComment.trim(),
      });

      setCommentDialogOpen(false);
      setReviewComment('');
      await loadTeamReports();
    } catch (error) {
      debugError('Error adding comment:', error);
      alert('Failed to add comment. Please try again.');
    } finally {
      setSavingAction(false);
    }
  };

  return {
    handleApproveReport,
    handleRejectReport,
    handleResubmitToFinance,
    handleDelegateSubmit,
    handleSendReminder,
    handleAddComment,
  };
}
