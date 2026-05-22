/**
 * Time-tracking dedupe — must match admin-web StaffPortal buildTimeTrackingDedupKey /
 * dedupeTimeTrackingEntries so mobile hours match the web portal Timesheet.
 */

export function normalizeCostCenterForMatch(value: string): string {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function toLocalDateKey(date: Date | string | undefined): string {
  if (!date) return '';
  if (date instanceof Date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const s = String(date);
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const parsed = new Date(s);
  if (!Number.isNaN(parsed.getTime())) {
    return toLocalDateKey(parsed);
  }
  return s.split('T')[0];
}

/** Same key as web StaffPortal — one row per day + cost-center bucket (or category for non-CC rows). */
export function buildTimeTrackingDedupKey(entry: {
  date?: Date | string;
  costCenter?: string;
  category?: string;
}): string {
  const dateKey = toLocalDateKey(entry.date);
  const normalizedCostCenter = normalizeCostCenterForMatch(entry.costCenter || '');
  const normalizedCategory = String(entry.category || '').trim().toLowerCase();
  const bucket = normalizedCostCenter || normalizedCategory || 'working hours';
  return `${dateKey}::${bucket}`;
}

export function isWorkingHoursCategory(category: string | undefined): boolean {
  const c = String(category || '').trim();
  return c === '' || c === 'Working Hours' || c === 'Regular Hours';
}

export function dedupeTimeTrackingEntries<T extends {
  date?: Date | string;
  costCenter?: string;
  category?: string;
  updatedAt?: Date | string;
  createdAt?: Date | string;
}>(entries: T[]): T[] {
  const entryMap = new Map<string, T>();
  (entries || []).forEach((entry) => {
    const key = buildTimeTrackingDedupKey(entry);
    const existing = entryMap.get(key);
    if (!existing) {
      entryMap.set(key, entry);
      return;
    }
    const existingUpdated = existing.updatedAt ? new Date(existing.updatedAt).getTime() : 0;
    const incomingUpdated = entry.updatedAt ? new Date(entry.updatedAt).getTime() : 0;
    const existingCreated = existing.createdAt ? new Date(existing.createdAt).getTime() : 0;
    const incomingCreated = entry.createdAt ? new Date(entry.createdAt).getTime() : 0;
    const existingRank = Math.max(existingUpdated, existingCreated);
    const incomingRank = Math.max(incomingUpdated, incomingCreated);
    if (incomingRank >= existingRank) {
      entryMap.set(key, entry);
    }
  });
  return Array.from(entryMap.values());
}

export type DayHoursBreakdown = {
  workingHours: number;
  gahours: number;
  holidayHours: number;
  ptoHours: number;
  stdLtdHours: number;
  pflPfmlHours: number;
};

/** Sum hours for one calendar day from time entries (after web-aligned dedupe). */
export function aggregateHoursFromTimeEntries(entries: Array<{
  date?: Date | string;
  costCenter?: string;
  category?: string;
  hours?: number;
  updatedAt?: Date | string;
  createdAt?: Date | string;
}>): {
  costCenterHours: Record<string, number>;
  hoursBreakdown: DayHoursBreakdown;
  totalHours: number;
} {
  const deduped = dedupeTimeTrackingEntries(entries);
  const costCenterHours: Record<string, number> = {};
  const hoursBreakdown: DayHoursBreakdown = {
    workingHours: 0,
    gahours: 0,
    holidayHours: 0,
    ptoHours: 0,
    stdLtdHours: 0,
    pflPfmlHours: 0,
  };

  deduped.forEach((entry) => {
    const category = String(entry.category || '').trim();
    const cc = String(entry.costCenter || '').trim();
    const hours = Number(entry.hours) || 0;
    if (hours <= 0) return;

    if (isWorkingHoursCategory(category)) {
      const key = cc || 'Unassigned';
      costCenterHours[key] = (costCenterHours[key] || 0) + hours;
      return;
    }

    switch (category) {
      case 'G&A Hours':
        hoursBreakdown.gahours += hours;
        break;
      case 'Holiday Hours':
        hoursBreakdown.holidayHours += hours;
        break;
      case 'PTO Hours':
        hoursBreakdown.ptoHours += hours;
        break;
      case 'STD/LTD Hours':
        hoursBreakdown.stdLtdHours += hours;
        break;
      case 'PFL/PFML Hours':
        hoursBreakdown.pflPfmlHours += hours;
        break;
      default:
        break;
    }
  });

  hoursBreakdown.workingHours = Object.values(costCenterHours).reduce((s, h) => s + h, 0);
  const totalHours =
    hoursBreakdown.workingHours +
    hoursBreakdown.gahours +
    hoursBreakdown.holidayHours +
    hoursBreakdown.ptoHours +
    hoursBreakdown.stdLtdHours +
    hoursBreakdown.pflPfmlHours;

  return { costCenterHours, hoursBreakdown, totalHours };
}
