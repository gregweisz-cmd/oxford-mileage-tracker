/**
 * Calendar dates stored as YYYY-MM-DD must not be parsed with `new Date(isoDateOnly)` —
 * that form is UTC midnight, so US locales show the previous calendar day.
 * Use these helpers for month filtering and display.
 */

export function parseCalendarYmdParts(value: unknown): { year: number; month: number; day: number } | null {
  if (value == null || value === '') return null;
  const s = typeof value === 'string' ? value.trim() : String(value);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) {
    return { year: parseInt(m[1], 10), month: parseInt(m[2], 10), day: parseInt(m[3], 10) };
  }
  const d = new Date(s);
  if (isNaN(d.getTime())) return null;
  return { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() };
}

export function parseCalendarYearMonthFromStoredDate(value: unknown): { year: number; month: number } | null {
  const p = parseCalendarYmdParts(value);
  return p ? { year: p.year, month: p.month } : null;
}

/** Display a stored DB date in en-US short form using the calendar YYYY-MM-DD when present. */
export function formatStoredDateForDisplay(value: unknown): string {
  if (value == null || value === '') return '';
  const p = parseCalendarYmdParts(value);
  if (p) {
    const d = new Date(p.year, p.month - 1, p.day);
    return d.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: '2-digit' });
  }
  const d = new Date(String(value));
  if (isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: '2-digit' });
}
