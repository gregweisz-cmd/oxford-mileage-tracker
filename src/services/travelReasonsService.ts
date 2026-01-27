/**
 * Travel Reasons Service
 * Fetches dropdown options for trip purpose from the backend (used on GPS Tracking and Manual Entry).
 * Uses built-in fallback options when the API fails or returns empty.
 */

import { API_BASE_URL } from '../config/api';

export interface TravelReason {
  id: string;
  label: string;
  category: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

/** Fallback options when API fails or returns empty (matches backend defaults) */
const FALLBACK_REASONS: TravelReason[] = [
  { id: 'tr-fallback-1', label: 'House Stabilization', category: 'House/Resident Related', sortOrder: 0, createdAt: '', updatedAt: '' },
  { id: 'tr-fallback-2', label: 'Donation Pickup', category: 'Donations & Supplies', sortOrder: 10, createdAt: '', updatedAt: '' },
  { id: 'tr-fallback-3', label: 'Donation Delivery', category: 'Donations & Supplies', sortOrder: 11, createdAt: '', updatedAt: '' },
  { id: 'tr-fallback-4', label: 'Team Meeting', category: 'Meetings & Training', sortOrder: 20, createdAt: '', updatedAt: '' },
  { id: 'tr-fallback-5', label: 'Staff Meeting', category: 'Meetings & Training', sortOrder: 21, createdAt: '', updatedAt: '' },
  { id: 'tr-fallback-6', label: 'Staff Training', category: 'Meetings & Training', sortOrder: 22, createdAt: '', updatedAt: '' },
  { id: 'tr-fallback-7', label: 'Community Outreach', category: 'Meetings & Training', sortOrder: 23, createdAt: '', updatedAt: '' },
  { id: 'tr-fallback-8', label: 'Emergency response', category: 'Emergency & Special', sortOrder: 30, createdAt: '', updatedAt: '' },
  { id: 'tr-fallback-9', label: 'Crisis intervention', category: 'Emergency & Special', sortOrder: 31, createdAt: '', updatedAt: '' },
  { id: 'tr-fallback-10', label: 'Urgent visit', category: 'Emergency & Special', sortOrder: 32, createdAt: '', updatedAt: '' },
  { id: 'tr-fallback-11', label: 'Return to base', category: 'Travel & Logistics', sortOrder: 40, createdAt: '', updatedAt: '' },
  { id: 'tr-fallback-12', label: 'Travel between locations', category: 'Travel & Logistics', sortOrder: 41, createdAt: '', updatedAt: '' },
  { id: 'tr-fallback-13', label: 'Route optimization', category: 'Travel & Logistics', sortOrder: 42, createdAt: '', updatedAt: '' },
];

function normalizeReasons(raw: unknown): TravelReason[] {
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
      id: String(item.id ?? `tr-${i}`),
      label: String(item.label ?? ''),
      category: String(item.category ?? ''),
      sortOrder: Number(item.sortOrder ?? i),
      createdAt: String(item.createdAt ?? ''),
      updatedAt: String(item.updatedAt ?? ''),
    }))
    .filter((r) => r.label.length > 0);
}

let cachedReasons: TravelReason[] | null = null;

/**
 * Get all travel reasons. Results are cached for the session.
 * Pass forceRefresh true to bypass cache.
 * Returns fallback options when the API fails or returns empty.
 */
export async function getTravelReasons(forceRefresh = false): Promise<TravelReason[]> {
  if (!forceRefresh && cachedReasons && cachedReasons.length > 0) {
    return cachedReasons;
  }
  const url = `${API_BASE_URL.replace(/\/$/, '')}/travel-reasons`;
  try {
    if (__DEV__) {
      console.log('Travel reasons fetching:', url);
    }
    const res = await fetch(url, { method: 'GET', headers: { Accept: 'application/json' } });
    if (!res.ok) {
      if (__DEV__) {
        console.warn('Travel reasons non-ok:', res.status, res.statusText, 'Tried:', url);
      }
      cachedReasons = null;
      return FALLBACK_REASONS;
    }
    const data = await res.json();
    const list = normalizeReasons(data);
    if (list.length > 0) {
      cachedReasons = list;
      return list;
    }
    cachedReasons = null;
    return FALLBACK_REASONS;
  } catch (e) {
    if (__DEV__) {
      console.warn('Travel reasons fetch failed, using fallback:', e);
    }
    cachedReasons = null;
    return FALLBACK_REASONS;
  }
}

/**
 * Clear in-memory cache (e.g. after admin adds/edits reasons and user returns to app).
 */
export function clearTravelReasonsCache(): void {
  cachedReasons = null;
}
