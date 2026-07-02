import type { PersistedGpsState } from '../services/gpsBackgroundTask';

export interface GpsTrackingDiagnosticsCounters {
  locationPointsReceived: number;
  locationPointsCounted: number;
  duplicatePointsSkipped: number;
  implausibleSegmentsDropped: number;
  implausibleMilesDropped: number;
  maxGapSeconds: number;
  pausedMsTotal: number;
  pausedStartedAt: number | null;
  accuracySum: number;
  accuracyCount: number;
}

export interface GpsTrackingDiagnostics {
  locationPointsReceived: number;
  locationPointsCounted: number;
  duplicatePointsSkipped: number;
  implausibleSegmentsDropped: number;
  implausibleMilesDropped: number;
  maxGapSeconds: number;
  pausedMinutes: number;
  avgAccuracyMeters: number | null;
  rawDistanceMiles: number;
  roundedMiles: number;
  trackingDurationMinutes: number | null;
}

export function createEmptyGpsDiagnosticsCounters(): GpsTrackingDiagnosticsCounters {
  return {
    locationPointsReceived: 0,
    locationPointsCounted: 0,
    duplicatePointsSkipped: 0,
    implausibleSegmentsDropped: 0,
    implausibleMilesDropped: 0,
    maxGapSeconds: 0,
    pausedMsTotal: 0,
    pausedStartedAt: null,
    accuracySum: 0,
    accuracyCount: 0,
  };
}

export function ensureGpsDiagnosticsCounters(state: PersistedGpsState): GpsTrackingDiagnosticsCounters {
  if (!state.diagnostics) {
    state.diagnostics = createEmptyGpsDiagnosticsCounters();
  }
  return state.diagnostics;
}

export function recordGpsPauseStart(state: PersistedGpsState, now = Date.now()): void {
  const diagnostics = ensureGpsDiagnosticsCounters(state);
  if (diagnostics.pausedStartedAt == null) {
    diagnostics.pausedStartedAt = now;
  }
}

export function recordGpsPauseEnd(state: PersistedGpsState, now = Date.now()): void {
  const diagnostics = ensureGpsDiagnosticsCounters(state);
  if (diagnostics.pausedStartedAt != null) {
    diagnostics.pausedMsTotal += Math.max(0, now - diagnostics.pausedStartedAt);
    diagnostics.pausedStartedAt = null;
  }
}

export function buildGpsTrackingDiagnostics(
  state: PersistedGpsState,
  endTimeMs = Date.now()
): GpsTrackingDiagnostics {
  const diagnostics = state.diagnostics || createEmptyGpsDiagnosticsCounters();
  let pausedMs = diagnostics.pausedMsTotal;
  if (state.isPaused && diagnostics.pausedStartedAt != null) {
    pausedMs += Math.max(0, endTimeMs - diagnostics.pausedStartedAt);
  }

  const rawDistanceMiles = Number(state.totalDistance || 0);
  const roundedMiles = Math.round(rawDistanceMiles);

  let trackingDurationMinutes: number | null = null;
  const startedMs = new Date(state.session.startTime).getTime();
  if (Number.isFinite(startedMs) && endTimeMs >= startedMs) {
    trackingDurationMinutes = Number(((endTimeMs - startedMs) / 60000).toFixed(1));
  }

  return {
    locationPointsReceived: diagnostics.locationPointsReceived,
    locationPointsCounted: diagnostics.locationPointsCounted,
    duplicatePointsSkipped: diagnostics.duplicatePointsSkipped,
    implausibleSegmentsDropped: diagnostics.implausibleSegmentsDropped,
    implausibleMilesDropped: Number(diagnostics.implausibleMilesDropped.toFixed(2)),
    maxGapSeconds: Math.round(diagnostics.maxGapSeconds),
    pausedMinutes: Number((pausedMs / 60000).toFixed(1)),
    avgAccuracyMeters:
      diagnostics.accuracyCount > 0
        ? Math.round(diagnostics.accuracySum / diagnostics.accuracyCount)
        : null,
    rawDistanceMiles: Number(rawDistanceMiles.toFixed(2)),
    roundedMiles,
    trackingDurationMinutes,
  };
}

export function parseGpsTrackingDiagnostics(value: unknown): GpsTrackingDiagnostics | null {
  if (!value) return null;
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    if (!parsed || typeof parsed !== 'object') return null;
    if (typeof parsed.locationPointsReceived !== 'number') return null;
    return parsed as GpsTrackingDiagnostics;
  } catch {
    return null;
  }
}
