/**
 * Resolves the admin-configured weekly hours alert threshold for client-side hints
 * (e.g. the burnout-prevention anomaly hint surfaced when an employee logs hours).
 *
 * The actual supervisor email/in-app alert is computed server-side using the same
 * value, so this service exists purely so the mobile UI shows the same number the
 * supervisor will see - no more "60h fallback says one thing, but the supervisor
 * was told 50h."
 *
 * Strategy:
 *   1. In-memory cache (module-level) - instant after first resolve.
 *   2. AsyncStorage cache with 24h TTL - survives app restarts.
 *   3. Network fetch on first call or when cache is stale - fire-and-forget refresh.
 *   4. Fallback to FALLBACK_WEEKLY_HOURS_ALERT_THRESHOLD if everything fails.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../config/api';
import { FALLBACK_WEEKLY_HOURS_ALERT_THRESHOLD } from '../constants/weeklyHoursAlert';

const CACHE_KEY = 'weeklyHoursThreshold:v1';
const TTL_MS = 24 * 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 8000;

interface CachedValue {
  hoursThreshold: number;
  cachedAt: number;
}

let memoryCache: CachedValue | null = null;
let inFlightFetch: Promise<number> | null = null;

function clamp(n: unknown): number | null {
  const num = Number(n);
  if (!Number.isFinite(num)) return null;
  const rounded = Math.round(num);
  if (rounded < 1 || rounded > 168) return null;
  return rounded;
}

async function readPersistentCache(): Promise<CachedValue | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const value = clamp(parsed?.hoursThreshold);
    const cachedAt = Number(parsed?.cachedAt);
    if (value === null || !Number.isFinite(cachedAt)) return null;
    return { hoursThreshold: value, cachedAt };
  } catch {
    return null;
  }
}

async function writePersistentCache(value: CachedValue): Promise<void> {
  try {
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(value));
  } catch {
    // Cache write failures are non-fatal.
  }
}

async function fetchFromBackend(): Promise<number | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(`${API_BASE_URL}/settings/weekly-hours-threshold`, {
      method: 'GET',
      signal: controller.signal,
    });
    if (!response.ok) return null;
    const json = await response.json();
    return clamp(json?.hoursThreshold);
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function isFresh(value: CachedValue): boolean {
  return Date.now() - value.cachedAt < TTL_MS;
}

/**
 * Returns the effective weekly hours alert threshold. Always resolves; never throws.
 * Order of precedence: fresh memory cache -> fresh persistent cache -> live fetch ->
 * stale persistent cache -> constant fallback.
 */
export async function getWeeklyHoursAlertThreshold(): Promise<number> {
  if (memoryCache && isFresh(memoryCache)) {
    return memoryCache.hoursThreshold;
  }

  if (!memoryCache) {
    const persisted = await readPersistentCache();
    if (persisted) {
      memoryCache = persisted;
      if (isFresh(persisted)) return persisted.hoursThreshold;
    }
  }

  if (!inFlightFetch) {
    inFlightFetch = (async () => {
      const fetched = await fetchFromBackend();
      if (fetched !== null) {
        const next: CachedValue = { hoursThreshold: fetched, cachedAt: Date.now() };
        memoryCache = next;
        await writePersistentCache(next);
        return fetched;
      }
      if (memoryCache) return memoryCache.hoursThreshold;
      return FALLBACK_WEEKLY_HOURS_ALERT_THRESHOLD;
    })().finally(() => {
      inFlightFetch = null;
    });
  }

  return inFlightFetch;
}

/**
 * Synchronous accessor for code paths that cannot await (rare). Returns the most
 * recently resolved value, or the constant fallback if nothing has resolved yet.
 */
export function getCachedWeeklyHoursAlertThreshold(): number {
  return memoryCache?.hoursThreshold ?? FALLBACK_WEEKLY_HOURS_ALERT_THRESHOLD;
}

/** Test/debug hook to reset module state. */
export function __resetWeeklyHoursAlertThresholdCacheForTests(): void {
  memoryCache = null;
  inFlightFetch = null;
}
