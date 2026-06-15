export type ExpenseReportStatus =
  | 'draft'
  | 'submitted'
  | 'approved'
  | 'rejected'
  | 'needs_revision'
  | 'pending_supervisor'
  | 'pending_senior_staff'
  | 'pending_finance'
  | 'under_review';

/** Report is with reviewers but not yet finally approved. */
export const PENDING_APPROVAL_STATUSES: ExpenseReportStatus[] = [
  'submitted',
  'pending_supervisor',
  'pending_senior_staff',
  'pending_finance',
  'under_review',
];

/** Staff may edit until finance (or workflow) marks the report approved. */
export function isStaffReportEditable(status: string | null | undefined): boolean {
  if (!status || status === 'draft') return true;
  return status.toLowerCase() !== 'approved';
}

export function isPendingApprovalStatus(status: string | null | undefined): boolean {
  if (!status) return false;
  return PENDING_APPROVAL_STATUSES.includes(status as ExpenseReportStatus);
}
