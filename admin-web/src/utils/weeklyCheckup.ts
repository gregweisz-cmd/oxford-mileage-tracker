/** Sunday (local) of the calendar week containing `date`, as YYYY-MM-DD. */
export function getCalendarWeekStartKey(date: Date = new Date()): string {
  const weekStart = new Date(date);
  weekStart.setDate(date.getDate() - date.getDay());
  weekStart.setHours(0, 0, 0, 0);
  const year = weekStart.getFullYear();
  const month = String(weekStart.getMonth() + 1).padStart(2, '0');
  const day = String(weekStart.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatNextWeeklyCheckupAvailableLabel(weekStartKey: string): string {
  const parts = weekStartKey.split('-').map((p) => parseInt(p, 10));
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) {
    return 'next Sunday';
  }
  const nextSunday = new Date(parts[0], parts[1] - 1, parts[2] + 7);
  return nextSunday.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

export type WeeklyCheckupAckRole = 'senior_staff' | 'supervisor';

export interface WeeklyCheckupAcknowledgment {
  role: WeeklyCheckupAckRole;
  approverId?: string;
  approverName?: string;
  acceptedAt?: string;
}

export interface WeeklyCheckupEntry {
  at?: string;
  employeeId?: string;
  notified?: boolean;
  weekKey?: string;
  acknowledgments?: WeeklyCheckupAcknowledgment[];
}

export interface WeeklyCheckupStatusSummary {
  weekKey: string;
  sharedAt: string | null;
  acknowledgments: WeeklyCheckupAcknowledgment[];
  pendingRoles: WeeklyCheckupAckRole[];
  isFullyAcknowledged: boolean;
}

export function getCurrentWeekCheckupEntry(
  reportData: { weeklyCheckups?: WeeklyCheckupEntry[] } | null | undefined
): WeeklyCheckupEntry | null {
  if (!reportData?.weeklyCheckups?.length) return null;
  const currentWeekKey = getCalendarWeekStartKey();
  const match = [...reportData.weeklyCheckups]
    .reverse()
    .find((entry) => {
      if (!entry?.at) return false;
      const weekKey = entry.weekKey || getCalendarWeekStartKey(new Date(entry.at));
      return weekKey === currentWeekKey;
    });
  return match || null;
}

export function buildWeeklyCheckupStatus(
  reportData: { weeklyCheckups?: WeeklyCheckupEntry[] } | null | undefined,
  reviewers: { seniorStaffId?: string | null; supervisorId?: string | null }
): WeeklyCheckupStatusSummary | null {
  const entry = getCurrentWeekCheckupEntry(reportData);
  if (!entry?.at) return null;

  const weekKey = entry.weekKey || getCalendarWeekStartKey(new Date(entry.at));
  const acknowledgments = Array.isArray(entry.acknowledgments) ? entry.acknowledgments : [];
  const pendingRoles: WeeklyCheckupAckRole[] = [];

  if (reviewers.seniorStaffId && !acknowledgments.some((a) => a.role === 'senior_staff')) {
    pendingRoles.push('senior_staff');
  }
  if (reviewers.supervisorId && !acknowledgments.some((a) => a.role === 'supervisor')) {
    pendingRoles.push('supervisor');
  }

  return {
    weekKey,
    sharedAt: entry.at,
    acknowledgments,
    pendingRoles,
    isFullyAcknowledged: pendingRoles.length === 0,
  };
}

export function canViewerAcceptWeeklyCheckup(
  status: WeeklyCheckupStatusSummary | null,
  viewerId: string | null | undefined,
  reviewers: { seniorStaffId?: string | null; supervisorId?: string | null }
): boolean {
  if (!status?.sharedAt || !viewerId) return false;
  if (reviewers.seniorStaffId === viewerId && status.pendingRoles.includes('senior_staff')) {
    return true;
  }
  if (reviewers.supervisorId === viewerId && status.pendingRoles.includes('supervisor')) {
    return true;
  }
  return false;
}

export function resolveWeeklyCheckupNotificationWeekKey(reportData: {
  lastWeeklyCheckupNotificationWeekKey?: string | null;
  lastWeeklyCheckupNotificationAt?: string | null;
  lastWeeklyCheckupAt?: string | null;
  weeklyCheckups?: WeeklyCheckupEntry[];
} | null | undefined): string | null {
  if (!reportData) return null;
  if (reportData.lastWeeklyCheckupNotificationWeekKey) {
    return reportData.lastWeeklyCheckupNotificationWeekKey;
  }
  if (reportData.lastWeeklyCheckupNotificationAt) {
    return getCalendarWeekStartKey(new Date(reportData.lastWeeklyCheckupNotificationAt));
  }
  const checkups = reportData.weeklyCheckups || [];
  const lastNotified = [...checkups].reverse().find((entry) => entry?.at && entry.notified !== false);
  if (lastNotified?.at) {
    return lastNotified.weekKey || getCalendarWeekStartKey(new Date(lastNotified.at));
  }
  if (reportData.lastWeeklyCheckupAt) {
    return getCalendarWeekStartKey(new Date(reportData.lastWeeklyCheckupAt));
  }
  return null;
}

export function isWeeklyCheckupOnCooldown(lastNotificationWeekKey: string | null | undefined): boolean {
  if (!lastNotificationWeekKey) return false;
  return lastNotificationWeekKey === getCalendarWeekStartKey();
}

export const WEEKLY_CHECKUP_ROLE_LABELS: Record<WeeklyCheckupAckRole, string> = {
  senior_staff: 'Senior Staff',
  supervisor: 'Supervisor',
};
