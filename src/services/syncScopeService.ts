/**
 * Calendar month used for scoped pull from the backend (mileage, receipts, time, etc.).
 * Screens that let the user change the visible month should call setSyncMonthScope so
 * foreground / realtime sync matches what they are viewing.
 */
const now = new Date();
let focusedMonth = now.getMonth() + 1;
let focusedYear = now.getFullYear();

export function setSyncMonthScope(month: number, year: number): void {
  focusedMonth = month;
  focusedYear = year;
}

export function getSyncMonthScope(): { month: number; year: number } {
  return { month: focusedMonth, year: focusedYear };
}

/** Inclusive YYYY-MM-DD bounds for a calendar month (1–12). */
export function monthDateBounds(month: number, year: number): { start: string; end: string } {
  const m = String(month).padStart(2, '0');
  const start = `${year}-${m}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const end = `${year}-${m}-${String(lastDay).padStart(2, '0')}`;
  return { start, end };
}
