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

export function resolveWeeklyCheckupNotificationWeekKey(reportData: {
  lastWeeklyCheckupNotificationWeekKey?: string | null;
  lastWeeklyCheckupNotificationAt?: string | null;
  lastWeeklyCheckupAt?: string | null;
  weeklyCheckups?: Array<{ at?: string; notified?: boolean; weekKey?: string }>;
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
