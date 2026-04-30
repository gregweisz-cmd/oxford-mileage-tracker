/**
 * Background location task - must be defined at app top level (before React).
 * Runs when app is in background; persists updates to AsyncStorage for main app to read.
 */
import { Platform } from 'react-native';
import * as TaskManager from 'expo-task-manager';
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
}

const VEHICLE_SPEED_THRESHOLD_MPH = 8;
const NON_DRIVING_GRACE_MS = 90 * 1000; // avoid false positives during slow parking-lot maneuvering
const STATIONARY_THRESHOLD_MS = 5 * 60 * 1000;
const STATIONARY_ALERT_COOLDOWN_MS = 10 * 60 * 1000;
const MIN_TRIP_DISTANCE_FOR_STATIONARY_ALERT_MILES = 0.25; // 1/4 mile
const R = 3959; // Earth radius in miles

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

TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }: any) => {
  if (error) {
    debugLog('GPS background task error:', error.message);
    return;
  }
  if (!data?.locations?.length) return;

  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return;

    const state: PersistedGpsState = JSON.parse(raw);
    const lastLat = state.lastLocation.latitude;
    const lastLon = state.lastLocation.longitude;

    // Use the most recent location
    const latest = data.locations[data.locations.length - 1];
    const newLat = latest.coords.latitude;
    const newLon = latest.coords.longitude;
    const latestTimestamp = typeof latest.timestamp === 'number' ? latest.timestamp : Date.now();
    const speedMph = Math.max(0, (latest.coords.speed ?? 0) * 2.23694);

    const distance = calculateDistance(lastLat, lastLon, newLat, newLon);
    const now = Date.now();
    const previousTimestamp = state.lastLocationTimestamp ?? now;
    const elapsedMs = Math.max(1000, latestTimestamp - previousTimestamp);
    const inferredSpeedMph = distance / (elapsedMs / 3600000);
    const isDrivingLikeSpeed =
      speedMph >= VEHICLE_SPEED_THRESHOLD_MPH || inferredSpeedMph >= VEHICLE_SPEED_THRESHOLD_MPH;

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
    await StationaryNotificationService.initialize();

    const hasTraveledMeaningfully = state.totalDistance >= MIN_TRIP_DISTANCE_FOR_STATIONARY_ALERT_MILES;
    if (isDrivingLikeSpeed) {
      state.hasSeenVehicleSpeed = true;
      state.stationaryStartTime = null;
      state.nonDrivingCandidateStartTime = null;
      state.stationaryAlertPending = false;
      await StationaryNotificationService.cancelScheduledAlert(state.stationaryAlertScheduledId);
      state.stationaryAlertScheduledId = null;
    } else if (!state.hasSeenVehicleSpeed && hasTraveledMeaningfully) {
      // Some devices intermittently report null/0 speed in background updates.
      // Fall back to observed trip distance so stationary reminders can still trigger.
      state.hasSeenVehicleSpeed = true;
    } else if (state.hasSeenVehicleSpeed) {
      if (!state.nonDrivingCandidateStartTime) {
        state.nonDrivingCandidateStartTime = now;
      }

      // Keep counting any non-driving window as "stationary enough" for reminders.
      // GPS jitter or walking after parking should not suppress the prompt.
      const nonDrivingGraceComplete =
        now - state.nonDrivingCandidateStartTime >= NON_DRIVING_GRACE_MS;

      if (nonDrivingGraceComplete && !state.stationaryStartTime) {
        state.stationaryStartTime = state.nonDrivingCandidateStartTime + NON_DRIVING_GRACE_MS;
        await StationaryNotificationService.cancelScheduledAlert(state.stationaryAlertScheduledId);
        state.stationaryAlertScheduledId = await StationaryNotificationService.scheduleDelayedStationaryAlert(
          state.session.id,
          STATIONARY_THRESHOLD_MS
        );
      }

      const hasExceededStationaryThreshold =
        !!state.stationaryStartTime && now - state.stationaryStartTime >= STATIONARY_THRESHOLD_MS;
      const cooldownComplete =
        !state.stationaryAlertLastPromptAt ||
        now - state.stationaryAlertLastPromptAt >= STATIONARY_ALERT_COOLDOWN_MS;

      if (hasExceededStationaryThreshold && cooldownComplete && !state.stationaryAlertPending) {
        state.stationaryAlertPending = true;
        await StationaryNotificationService.scheduleStationaryAlert(state.session.id);
        state.stationaryAlertLastPromptAt = now;
        await StationaryNotificationService.cancelScheduledAlert(state.stationaryAlertScheduledId);
        state.stationaryAlertScheduledId = null;
      }
    }

    state.totalDistance += distance;
    state.session.totalMiles = Math.round(state.totalDistance);
    state.lastLocation = { latitude: newLat, longitude: newLon };
    state.lastLocationTimestamp = latestTimestamp;

    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    if (Platform.OS === 'ios') {
      debugLog('GPS background: updated distance', state.session.totalMiles, 'miles');
    }
  } catch (err) {
    console.error('GPS background task storage error:', err);
  }
});
