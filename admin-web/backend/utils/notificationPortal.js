/**
 * Notification "portal" classification.
 *
 * A single person can wear multiple hats (staff member AND supervisor AND finance, etc.), so each
 * notification belongs to the *portal* where it is actionable rather than to the recipient's role.
 * New notifications store an explicit `portal` (set at the call site where the context is known).
 * For legacy rows created before the column existed we fall back to a best-effort derivation from
 * the (coarse) notification `type` + `recipientRole`.
 */

const PORTALS = ['staff', 'senior_staff', 'supervisor', 'finance', 'admin'];

const PORTAL_LABELS = {
  staff: 'Staff',
  senior_staff: 'Senior Staff',
  supervisor: 'Supervisor',
  finance: 'Finance',
  admin: 'Admin',
};

/** Map an approval-chain role to the portal that role acts in. */
function portalForRole(role) {
  switch (role) {
    case 'senior_staff':
      return 'senior_staff';
    case 'finance':
      return 'finance';
    case 'admin':
      return 'admin';
    case 'supervisor':
      return 'supervisor';
    case 'employee':
    default:
      return 'staff';
  }
}

/**
 * Best-effort portal for legacy rows with no stored portal. The stored `type` is coarse
 * (e.g. `approval_needed` is used for both supervisor and finance; `revision_requested` for staff,
 * supervisor, senior, and finance), so this can only approximate. New rows set `portal` explicitly.
 */
function derivePortalFromType(type, recipientRole) {
  switch (type) {
    case 'sunday_reminder':
    case 'report_approved':
    case 'report_rejected':
    case 'weekly_checkup_accepted':
      return 'staff';
    case '50_plus_hours_alert':
      return 'supervisor';
    case 'report_submitted':
    case 'weekly_checkup_shared':
      // Could be senior_staff or supervisor; not distinguishable from type alone.
      return recipientRole === 'senior_staff' ? 'senior_staff' : 'supervisor';
    case 'approval_needed':
      return recipientRole === 'finance' ? 'finance' : 'supervisor';
    case 'revision_requested':
      if (recipientRole === 'employee') return 'staff';
      if (recipientRole === 'finance') return 'finance';
      if (recipientRole === 'senior_staff') return 'senior_staff';
      if (recipientRole === 'supervisor') return 'supervisor';
      return 'staff';
    default:
      return portalForRole(recipientRole);
  }
}

/** Normalize/validate a portal value, falling back to derivation when missing/invalid. */
function resolvePortal(portal, type, recipientRole) {
  if (portal && PORTALS.includes(portal)) return portal;
  return derivePortalFromType(type, recipientRole);
}

module.exports = {
  PORTALS,
  PORTAL_LABELS,
  portalForRole,
  derivePortalFromType,
  resolvePortal,
};
