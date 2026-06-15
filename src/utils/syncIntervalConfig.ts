/**
 * User-configurable auto-sync timing for mobile → backend push.
 */

export type SyncInterval = 'immediate' | 'every_5min' | 'every_15min' | 'hourly' | 'daily';

export const DEFAULT_SYNC_INTERVAL: SyncInterval = 'every_5min';

export interface SyncTiming {
  debounceMs: number;
  periodicMs: number;
  label: string;
}

export function getSyncTiming(interval: SyncInterval): SyncTiming {
  switch (interval) {
    case 'immediate':
      return {
        debounceMs: 3_000,
        periodicMs: 30_000,
        label: 'Immediately',
      };
    case 'every_5min':
      return {
        debounceMs: 8_000,
        periodicMs: 5 * 60_000,
        label: 'Every 5 minutes',
      };
    case 'every_15min':
      return {
        debounceMs: 15_000,
        periodicMs: 15 * 60_000,
        label: 'Every 15 minutes',
      };
    case 'hourly':
      return {
        debounceMs: 30_000,
        periodicMs: 60 * 60_000,
        label: 'Every hour',
      };
    case 'daily':
      return {
        debounceMs: 60_000,
        periodicMs: 60 * 60_000,
        label: 'Every hour (daily mode)',
      };
    default:
      return getSyncTiming(DEFAULT_SYNC_INTERVAL);
  }
}

export const SYNC_INTERVAL_OPTIONS: {
  value: SyncInterval;
  label: string;
  description: string;
}[] = [
  {
    value: 'immediate',
    label: 'Immediately',
    description: 'Sync a few seconds after you save, plus every 30 seconds while the app is open',
  },
  {
    value: 'every_5min',
    label: 'Every 5 minutes',
    description: 'Batch changes and sync at most every 5 minutes (recommended)',
  },
  {
    value: 'every_15min',
    label: 'Every 15 minutes',
    description: 'Sync at most every 15 minutes to save battery',
  },
  {
    value: 'hourly',
    label: 'Every hour',
    description: 'Sync at most once per hour',
  },
  {
    value: 'daily',
    label: 'Daily',
    description: 'Sync about once per hour while open; best for very limited data use',
  },
];

export function formatSyncIntervalLabel(interval: SyncInterval): string {
  return getSyncTiming(interval).label;
}
