/**
 * Daily Description Options Service
 * Fetches dropdown options for daily work descriptions from the backend.
 * Used on Hours & Description screen and (when wired) report grid.
 * Uses built-in fallback options when the API fails or returns empty.
 */

import { API_BASE_URL } from '../config/api';

export interface DailyDescriptionOption {
  id: string;
  label: string;
  category: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

/** Fallback options when API fails or returns empty (matches backend defaults) */
const FALLBACK_OPTIONS: DailyDescriptionOption[] = [
  { id: 'ddo-fallback-1', label: 'Telework from Base Address', category: 'Work location', sortOrder: 0, createdAt: '', updatedAt: '' },
  { id: 'ddo-fallback-2', label: 'Staff Meeting', category: 'Meetings & Events', sortOrder: 10, createdAt: '', updatedAt: '' },
  { id: 'ddo-fallback-3', label: 'Staff Training', category: 'Meetings & Events', sortOrder: 11, createdAt: '', updatedAt: '' },
  { id: 'ddo-fallback-4', label: 'World Convention', category: 'Meetings & Events', sortOrder: 12, createdAt: '', updatedAt: '' },
  { id: 'ddo-fallback-5', label: 'State Convention', category: 'Meetings & Events', sortOrder: 13, createdAt: '', updatedAt: '' },
  { id: 'ddo-fallback-6', label: 'Workshop', category: 'Meetings & Events', sortOrder: 14, createdAt: '', updatedAt: '' },
  { id: 'ddo-fallback-7', label: 'Site visit', category: 'Field work', sortOrder: 20, createdAt: '', updatedAt: '' },
  { id: 'ddo-fallback-8', label: 'Community outreach', category: 'Field work', sortOrder: 21, createdAt: '', updatedAt: '' },
];

function normalizeOptions(raw: unknown): DailyDescriptionOption[] {
  let arr: unknown[] = [];
  if (Array.isArray(raw)) {
    arr = raw;
  } else if (raw && typeof raw === 'object' && ('data' in raw || 'items' in raw || 'options' in raw)) {
    const o = raw as Record<string, unknown>;
    arr = Array.isArray(o.data) ? o.data : Array.isArray(o.items) ? o.items : Array.isArray(o.options) ? o.options : [];
  }
  return arr
    .filter((item): item is Record<string, unknown> => item != null && typeof item === 'object')
    .map((item, i) => ({
      id: String(item.id ?? `ddo-${i}`),
      label: String(item.label ?? ''),
      category: String(item.category ?? ''),
      sortOrder: Number(item.sortOrder ?? i),
      createdAt: String(item.createdAt ?? ''),
      updatedAt: String(item.updatedAt ?? ''),
    }))
    .filter((o) => o.label.length > 0);
}

let cachedOptions: DailyDescriptionOption[] | null = null;

export async function getDailyDescriptionOptions(forceRefresh = false): Promise<DailyDescriptionOption[]> {
  if (!forceRefresh && cachedOptions && cachedOptions.length > 0) {
    return cachedOptions;
  }
  try {
    const url = `${API_BASE_URL}/daily-description-options`;
    if (__DEV__) {
      console.log('Daily description options fetching:', url);
    }
    const res = await fetch(url, { method: 'GET', headers: { Accept: 'application/json' } });
    if (!res.ok) {
      if (__DEV__) console.warn('Daily description options non-ok:', res.status, res.statusText);
      cachedOptions = null;
      return FALLBACK_OPTIONS;
    }
    const data = await res.json();
    const list = normalizeOptions(data);
    if (list.length > 0) {
      cachedOptions = list;
      return list;
    }
    cachedOptions = null;
    return FALLBACK_OPTIONS;
  } catch (e) {
    if (__DEV__) console.warn('Daily description options fetch failed, using fallback:', e);
    cachedOptions = null;
    return FALLBACK_OPTIONS;
  }
}

export function clearDailyDescriptionOptionsCache(): void {
  cachedOptions = null;
}
