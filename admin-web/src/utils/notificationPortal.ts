/**
 * Portal classification for notifications (frontend mirror of backend/utils/notificationPortal.js).
 * Each notification belongs to the portal where it is actionable, so a person who wears multiple
 * hats sees a labeled, per-portal view.
 */

export type NotificationPortal = 'staff' | 'senior_staff' | 'supervisor' | 'finance' | 'admin';

export const PORTAL_LABELS: Record<NotificationPortal, string> = {
  staff: 'Staff',
  senior_staff: 'Senior Staff',
  supervisor: 'Supervisor',
  finance: 'Finance',
  admin: 'Admin',
};

type ChipColor = 'default' | 'primary' | 'secondary' | 'info' | 'success' | 'warning';

export const PORTAL_CHIP_COLORS: Record<NotificationPortal, ChipColor> = {
  staff: 'default',
  senior_staff: 'secondary',
  supervisor: 'primary',
  finance: 'success',
  admin: 'warning',
};

export function getPortalLabel(portal?: string | null): string | null {
  if (!portal) return null;
  return PORTAL_LABELS[portal as NotificationPortal] || null;
}

export function getPortalChipColor(portal?: string | null): ChipColor {
  if (!portal) return 'default';
  return PORTAL_CHIP_COLORS[portal as NotificationPortal] || 'default';
}
