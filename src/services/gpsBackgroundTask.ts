/**
 * Background location task - must be defined at app top level (before React).
 * Runs when app is in background; persists updates to AsyncStorage for main app to read.
 */
import { Platform } from 'react-native';
import * as TaskManager from 'expo-task-manager';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { debugLog } from '../config/debug';

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
  totalDistance: number;
  stationaryStartTime: number | null;
}

const MOVEMENT_THRESHOLD_MILES = 5 / 1609.34; // 5 meters in miles
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

TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
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

    const distance = calculateDistance(lastLat, lastLon, newLat, newLon);

    if (distance > MOVEMENT_THRESHOLD_MILES) {
      state.stationaryStartTime = null;
    } else if (distance > 0.001 && !state.stationaryStartTime) {
      state.stationaryStartTime = Date.now();
    } else if (distance < 0.001 && !state.stationaryStartTime) {
      state.stationaryStartTime = Date.now();
    }

    state.totalDistance += distance;
    state.session.totalMiles = Math.round(state.totalDistance * 10) / 10;
    state.lastLocation = { latitude: newLat, longitude: newLon };

    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    if (Platform.OS === 'ios') {
      debugLog('GPS background: updated distance', state.session.totalMiles, 'miles');
    }
  } catch (err) {
    console.error('GPS background task storage error:', err);
  }
});
