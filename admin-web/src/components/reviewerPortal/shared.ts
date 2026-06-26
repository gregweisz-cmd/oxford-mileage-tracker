/**
 * Shared types and helpers for the reviewer portals (Supervisor + Senior Staff).
 *
 * These two portals are ~90% identical. This module holds the pieces that are byte-for-byte
 * identical between them so they live in exactly one place. Behavior-divergent pieces
 * (different tabs, endpoints, microcopy, status handling) deliberately stay in each portal.
 *
 * Type note: `ReviewerEmployee` and `ReviewerComment` are supersets that carry BOTH the
 * supervisor-named and senior-staff-named id/name fields as optional. Each portal continues
 * to populate only its own fields from the API, so runtime behavior is unchanged.
 */

export type ReportStatus =
  | 'draft'
  | 'submitted'
  | 'under_review'
  | 'approved'
  | 'rejected'
  | 'pending_supervisor'
  | 'pending_senior_staff'
  | 'pending_finance'
  | 'needs_revision';

export interface ApprovalReminder {
  sentAt: string;
  sentBy?: string | null;
}

export interface ApprovalStep {
  step: number;
  role: string;
  approverId?: string | null;
  approverName?: string | null;
  status: 'pending' | 'waiting' | 'approved' | 'rejected';
  delegatedToId?: string | null;
  delegatedToName?: string | null;
  dueAt?: string | null;
  actedAt?: string | null;
  comments?: string;
  reminders?: ApprovalReminder[];
}

export interface ReviewerComment {
  id: string;
  reportId: string;
  comment: string;
  createdAt: string;
  isResolved?: boolean;
  // Populated by the Supervisor portal:
  supervisorId?: string;
  supervisorName?: string;
  // Populated by the Senior Staff portal:
  seniorStaffId?: string;
  seniorStaffName?: string;
}

export interface ReviewerEmployee {
  id: string;
  name: string;
  preferredName?: string;
  email: string;
  position: string;
  costCenters?: string[];
  isActive?: boolean;
  joinDate?: string;
  lastActivity?: string;
  // Each portal sets its own reviewer-id field; both kept optional here.
  supervisorId?: string | null;
  seniorStaffId?: string | null;
}

export interface TeamReport {
  id: string;
  employeeId: string;
  employeeName: string;
  month: number;
  year: number;
  status: ReportStatus;
  submittedAt?: string;
  totalAmount: number;
  totalMiles: number;
  totalMileageAmount?: number;
  totalHours: number;
  costCenters: string[];
  comments?: ReviewerComment[];
  rejectionReason?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  approvalWorkflow?: ApprovalStep[];
  currentApprovalStage?: string;
  currentApprovalStep?: number;
  currentApproverId?: string | null;
  currentApproverName?: string | null;
  escalationDueAt?: string | null;
  submissionType?: string;
}

export interface DashboardStats {
  totalTeamMembers: number;
  activeReports: number;
  pendingReviews: number;
  monthlyTotal: number;
  approvalRate: number;
  averageResponseTime: string;
}

/** Controls which single-purpose flow the review dialog shows (never approve + revision together). */
export type ReviewDialogMode = 'approve' | 'revision' | 'finance_return';

/** PUT an approval action against an expense report. Identical for both reviewer roles. */
export async function putExpenseReportApproval(reportId: string, body: Record<string, unknown>) {
  const { apiPut } = await import('../../services/rateLimitedApi');
  return apiPut(`/api/expense-reports/${reportId}/approval`, body);
}

/** Derive an escalation due-date chip label/color from an ISO timestamp. */
export function getDueInfo(dueAt?: string | null) {
  if (!dueAt) return null;
  const dueDate = new Date(dueAt);
  if (Number.isNaN(dueDate.getTime())) return null;
  const diffMs = dueDate.getTime() - Date.now();
  const hours = Math.max(1, Math.round(Math.abs(diffMs) / 3600000));
  if (diffMs <= 0) {
    return { label: `Overdue ${hours}h`, color: 'error' as const };
  }
  if (diffMs < 6 * 3600000) {
    return { label: `Due in ${hours}h`, color: 'warning' as const };
  }
  return { label: `Due in ${hours}h`, color: 'default' as const };
}
