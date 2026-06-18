/**
 * Background location task - must be defined at app top level (before React).
 * Runs when app is in background; persists updates to AsyncStorage for main app to read.
 */
import { Platform } from 'react-native';
import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { debugLog } from '../config/debug';
import { StationaryNotificationService } from './stationaryNotificationService';

const LOCATION_TASK_NAME = 'background-location-task';
export { LOCATION_TASK_NAME };

export const GPS_TRACKING_STORAGE_KEY = '@gps_tracking_session';
const STORAGE_KEY = GPS_TRACKING_STORAGE_KEY;

export interface PersistedGpsState {
  session: {
    id: string;
    employeeId: string;
    startTime: string;
    odometerReading: number;
    startLocation?: string;
    totalMiles: number;
    purpose: string;
    notes?: string;
  };
  lastLocation: { latitude: number; longitude: number };
  lastLocationTimestamp?: number | null;
  totalDistance: number;
  stationaryStartTime: number | null;
  hasSeenVehicleSpeed?: boolean;
  stationaryAlertPending?: boolean;
  stationaryAlertLastPromptAt?: number | null;
  stationaryAlertScheduledId?: string | null;
  nonDrivingCandidateStartTime?: number | null;
  /** When true, location updates still run but mileage is not accumulated (errand / pit stop) */
  isPaused?: boolean;
  /** True when movement is detected while mileage is paused */
  pausedDrivingAlertPending?: boolean;
}

const VEHICLE_SPEED_THRESHOLD_MPH = 8;
const PAUSED_DRIVING_ALERT_SPEED_THRESHOLD_MPH = 15;
const NON_DRIVING_GRACE_MS = 90 * 1000; // avoid false positives during slow parking-lot maneuvering
const STATIONARY_THRESHOLD_MS = 5 * 60 * 1000;
const STATIONARY_ALERT_COOLDOWN_MS = 10 * 60 * 1000;
const MIN_TRIP_DISTANCE_FOR_STATIONARY_ALERT_MILES = 0.25; // 1/4 mile
/** Reject GPS/cell-tower spikes (common when service returns after a dead zone). */
const MAX_IMPLAUSIBLE_SPEED_MPH = 120;
const DUPLICATE_COORD_EPSILON = 0.00001; // ~1 meter
/** Drop orphaned sessions so background GPS does not notify when the user is not on a trip. */
export const MAX_PERSISTED_TRACKING_SESSION_MS = 8 * 60 * 60 * 1000;
const R = 3959; // Earth radius in miles

/** Serialize read-modify-write so burst/replayed location batches cannot double-count. */
let locationUpdateChain: Promise<void> = Promise.resolve();

export async function flushPendingGpsLocationUpdates(): Promise<void> {
  await locationUpdateChain;
}

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function sortLocationsByTimestamp(locations: Location.LocationObject[]): Location.LocationObject[] {
  return [...locations].sort((a, b) => {
    const ta = typeof a.timestamp === 'number' ? a.timestamp : 0;
    const tb = typeof b.timestamp === 'number' ? b.timestamp : 0;
    return ta - tb;
  });
}

function isAlreadyProcessedLocation(
  lat: number,
  lon: number,
  timestamp: number,
  lastLat: number,
  lastLon: number,
  lastTimestamp: number | null | undefined
): boolean {
  if (lastTimestamp != null && Number.isFinite(lastTimestamp) && timestamp <= lastTimestamp) {
    return true;
  }
  return (
    Math.abs(lat - lastLat) < DUPLICATE_COORD_EPSILON &&
    Math.abs(lon - lastLon) < DUPLICATE_COORD_EPSILON
  );
}

function isImplausibleSegment(distanceMiles: number, elapsedMs: number): boolean {
  if (distanceMiles <= 0) return false;
  const hours = Math.max(elapsedMs / 3600000, 1 / 3600);
  return distanceMiles / hours > MAX_IMPLAUSIBLE_SPEED_MPH;
}

function normalizePersistedDefaults(state: PersistedGpsState, now: number): void {
  if (typeof state.hasSeenVehicleSpeed !== 'boolean') {
    state.hasSeenVehicleSpeed = false;
  }
  if (typeof state.stationaryAlertPending !== 'boolean') {
    state.stationaryAlertPending = false;
  }
  if (typeof state.stationaryAlertLastPromptAt === 'undefined') {
    state.stationaryAlertLastPromptAt = null;
  }
  if (typeof state.stationaryAlertScheduledId === 'undefined') {
    state.stationaryAlertScheduledId = null;
  }
  if (typeof state.nonDrivingCandidateStartTime === 'undefined') {
    state.nonDrivingCandidateStartTime = null;
  }
  if (typeof state.lastLocationTimestamp === 'undefined') {
    state.lastLocationTimestamp = now;
  }
  if (typeof state.pausedDrivingAlertPending !== 'boolean') {
    state.pausedDrivingAlertPending = false;
  }
}

async function abandonPersistedSession(reason: string): Promise<void> {
  debugLog('GPS background: abandoning persisted session:', reason);
  await StationaryNotificationService.cancelAllStationaryAlerts();
  StationaryNotificationService.resetAlertThrottle();
  await AsyncStorage.removeItem(STORAGE_KEY);
  try {
    const running = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
    if (running) {
      await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
    }
  } catch {
    // Best-effort stop when clearing stale/orphan state.
  }
}

function isSessionTooOld(startTimeIso: string): boolean {
  const started = new Date(startTimeIso).getTime();
  if (!Number.isFinite(started)) return true;
  return Date.now() - started > MAX_PERSISTED_TRACKING_SESSION_MS;
}

async function processLocationBatch(locations: Location.LocationObject[]): Promise<void> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return;

  const state: PersistedGpsState = JSON.parse(raw);

  if (!state.session?.id || !state.session?.startTime) {
    await abandonPersistedSession('missing-session');
    return;
  }
  if (isSessionTooOld(state.session.startTime)) {
    await abandonPersistedSession('stale-session');
    return;
  }

  if (
    !state.lastLocation ||
    typeof state.lastLocation.latitude !== 'number' ||
    typeof state.lastLocation.longitude !== 'number' ||
    !Number.isFinite(state.lastLocation.latitude) ||
    !Number.isFinite(state.lastLocation.longitude)
  ) {
    return;
  }

  const now = Date.now();
  normalizePersistedDefaults(state, now);

  const sortedLocations = sortLocationsByTimestamp(locations);
  if (sortedLocations.length === 0) return;

  const batchStartLat = state.lastLocation.latitude;
  const batchStartLon = state.lastLocation.longitude;
  const batchStartTimestamp = state.lastLocationTimestamp ?? now;

  let anchorLat = batchStartLat;
  let anchorLon = batchStartLon;
  let anchorTimestamp = batchStartTimestamp;

  if (state.isPaused === true) {
    for (const loc of sortedLocations) {
      const lat = loc.coords.latitude;
      const lon = loc.coords.longitude;
      const ts = typeof loc.timestamp === 'number' ? loc.timestamp : now;
      if (isAlreadyProcessedLocation(lat, lon, ts, anchorLat, anchorLon, anchorTimestamp)) {
        continue;
      }
      anchorLat = lat;
      anchorLon = lon;
      anchorTimestamp = ts;
    }

    const latest = sortedLocations[sortedLocations.length - 1];
    const speedMph = Math.max(0, (latest.coords.speed ?? 0) * 2.23694);
    const elapsedMs = Math.max(1000, anchorTimestamp - (state.lastLocationTimestamp ?? now));
    const inferredSpeedMph =
      calculateDistance(
        state.lastLocation.latitude,
        state.lastLocation.longitude,
        anchorLat,
        anchorLon
      ) /
      (elapsedMs / 3600000);

    if (
      speedMph >= PAUSED_DRIVING_ALERT_SPEED_THRESHOLD_MPH ||
      inferredSpeedMph >= PAUSED_DRIVING_ALERT_SPEED_THRESHOLD_MPH
    ) {
      state.pausedDrivingAlertPending = true;
    }

    state.lastLocation = { latitude: anchorLat, longitude: anchorLon };
    state.lastLocationTimestamp = anchorTimestamp;
    state.stationaryStartTime = null;
    state.nonDrivingCandidateStartTime = null;
    state.stationaryAlertPending = false;
    await StationaryNotificationService.cancelAllStationaryAlerts();
    state.stationaryAlertScheduledId = null;
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return;
  }

  for (const loc of sortedLocations) {
    const lat = loc.coords.latitude;
    const lon = loc.coords.longitude;
    const ts = typeof loc.timestamp === 'number' ? loc.timestamp : now;

    if (isAlreadyProcessedLocation(lat, lon, ts, anchorLat, anchorLon, anchorTimestamp)) {
      continue;
    }

    const segmentMiles = calculateDistance(anchorLat, anchorLon, lat, lon);
    const elapsedMs = Math.max(1000, ts - anchorTimestamp);

    if (isImplausibleSegment(segmentMiles, elapsedMs)) {
      debugLog(
        'GPS background: skipping implausible segment',
        segmentMiles.toFixed(2),
        'mi'
      );
      anchorLat = lat;
      anchorLon = lon;
      anchorTimestamp = ts;
      continue;
    }

    state.totalDistance += segmentMiles;
    anchorLat = lat;
    anchorLon = lon;
    anchorTimestamp = ts;
  }

  state.lastLocation = { latitude: anchorLat, longitude: anchorLon };
  state.lastLocationTimestamp = anchorTimestamp;
  state.session.totalMiles = Math.round(state.totalDistance);

  const latest = sortedLocations[sortedLocations.length - 1];
  const speedMph = Math.max(0, (latest.coords.speed ?? 0) * 2.23694);
  const batchElapsedMs = Math.max(1000, anchorTimestamp - batchStartTimestamp);
  const batchDistanceMiles = calculateDistance(
    batchStartLat,
    batchStartLon,
    anchorLat,
    anchorLon
  );
  const inferredSpeedMph = batchDistanceMiles / (batchElapsedMs / 3600000);
  const isDrivingLikeSpeed =
    speedMph >= VEHICLE_SPEED_THRESHOLD_MPH || inferredSpeedMph >= VEHICLE_SPEED_THRESHOLD_MPH;

  await StationaryNotificationService.initialize();

  const hasTraveledMeaningfully =
    state.totalDistance >= MIN_TRIP_DISTANCE_FOR_STATIONARY_ALERT_MILES;
  if (isDrivingLikeSpeed) {
    state.hasSeenVehicleSpeed = true;
    state.stationaryStartTime = null;
    state.nonDrivingCandidateStartTime = null;
    state.stationaryAlertPending = false;
    await StationaryNotificationService.cancelAllStationaryAlerts();
    state.stationaryAlertScheduledId = null;
  } else if (!state.hasSeenVehicleSpeed && hasTraveledMeaningfully) {
    state.hasSeenVehicleSpeed = true;
  } else if (state.hasSeenVehicleSpeed) {
    if (!state.nonDrivingCandidateStartTime) {
      state.nonDrivingCandidateStartTime = now;
    }

    const nonDrivingGraceComplete =
      now - state.nonDrivingCandidateStartTime >= NON_DRIVING_GRACE_MS;

    if (nonDrivingGraceComplete && !state.stationaryStartTime) {
      state.stationaryStartTime = state.nonDrivingCandidateStartTime + NON_DRIVING_GRACE_MS;
    }

    const hasExceededStationaryThreshold =
      !!state.stationaryStartTime && now - state.stationaryStartTime >= STATIONARY_THRESHOLD_MS;
    const cooldownComplete =
      !state.stationaryAlertLastPromptAt ||
      now - state.stationaryAlertLastPromptAt >= STATIONARY_ALERT_COOLDOWN_MS;

    if (hasExceededStationaryThreshold && cooldownComplete && !state.stationaryAlertPending) {
      state.stationaryAlertPending = true;
      state.stationaryAlertLastPromptAt = now;
      state.stationaryAlertScheduledId = null;
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      await StationaryNotificationService.scheduleStationaryAlert(state.session.id);
      return;
    }
  }

  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  if (Platform.OS === 'ios') {
    debugLog('GPS background: updated distance', state.session.totalMiles, 'miles');
  }
}

TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }: any) => {
  if (error) {
    debugLog('GPS background task error:', error.message);
    return;
  }
  if (!data?.locations?.length) return;

  const locations = data.locations as Location.LocationObject[];
  const run = () => processLocationBatch(locations);

  const queued = locationUpdateChain.then(run);
  locationUpdateChain = queued.catch(() => {});
  await queued;
});
