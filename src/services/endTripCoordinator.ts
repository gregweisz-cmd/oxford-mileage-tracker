import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert, InteractionManager, Platform } from 'react-native';
import { DatabaseService } from './database';
import { Employee, GpsTrackingSession, LocationDetails } from '../types';
import { formatLocation } from '../utils/locationFormatter';

export const GPS_TRIP_UI_STATE_KEY = '@gps_trip_ui_state';

export type EndTripPhase = 'idle' | 'choosing' | 'capturing' | 'saving';

const STOP_TRACKING_TIMEOUT_MS = 12000;
const SAVE_TRIP_TIMEOUT_MS = 12000;

export async function withTimeout<T>(
  task: Promise<T>,
  timeoutMs: number,
  label: string
): Promise<T> {
  return await Promise.race([
    task,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
    }),
  ]);
}

export interface ExecuteEndTripSaveParams {
  normalizedDetails: LocationDetails;
  normalizedStart: LocationDetails | null;
  startLocationDetails: LocationDetails | null;
  currentEmployee: Employee;
  selectedVehicleId: string;
  selectedCostCenter: string;
  trackingTimeSeconds: number;
  stopTracking: (presetEndLocation?: LocationDetails) => Promise<GpsTrackingSession | null>;
}

export interface ExecuteEndTripSaveResult {
  mileageSaved: boolean;
  actualMiles: number;
  completedSession: GpsTrackingSession;
  endDisplay: string;
  alertMessage: string;
  normalizedDetails: LocationDetails;
}

function formatTripDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m ${secs}s`;
  }
  if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  }
  return `${secs}s`;
}

/**
 * Stop GPS tracking and persist the mileage entry. Does not navigate or tear down UI —
 * call `finalizeEndTripNavigation` after modals are dismissed.
 */
export async function executeEndTripSave(
  params: ExecuteEndTripSaveParams
): Promise<ExecuteEndTripSaveResult | null> {
  const {
    normalizedDetails,
    normalizedStart,
    startLocationDetails,
    currentEmployee,
    selectedVehicleId,
    selectedCostCenter,
    trackingTimeSeconds,
    stopTracking,
  } = params;

  const completedSession = await withTimeout(
    stopTracking(normalizedDetails),
    STOP_TRACKING_TIMEOUT_MS,
    'Stop tracking'
  );

  if (!completedSession) {
    return null;
  }

  const rawMiles = completedSession.totalMiles || 0;
  const actualMiles =
    rawMiles > 0.1 ? Math.max(1, Math.round(rawMiles)) : Math.round(rawMiles);

  const endDisplay =
    normalizedDetails.name ||
    normalizedDetails.address ||
    completedSession.endLocation ||
    'Unknown';
  const startDisplay =
    normalizedStart?.name ||
    normalizedStart?.address ||
    completedSession.startLocationDetails?.name ||
    completedSession.startLocationDetails?.address ||
    completedSession.startLocation ||
    'Unknown';

  console.log('🚗 GPS Trip completed, saving to database:', {
    employeeId: currentEmployee.id,
    employeeName: currentEmployee.name,
    date: completedSession.startTime,
    startLocation: startDisplay,
    startAddress: normalizedStart?.address,
    endLocation: endDisplay,
    endAddress: normalizedDetails.address,
    purpose: completedSession.purpose,
    miles: actualMiles,
    odometerReading: completedSession.odometerReading,
    isGpsTracked: true,
  });

  let mileageSaved = true;
  try {
    await withTimeout(
      DatabaseService.createMileageEntry({
        employeeId: currentEmployee.id,
        oxfordHouseId: currentEmployee.oxfordHouseId,
        vehicleId: selectedVehicleId || undefined,
        date: completedSession.startTime,
        odometerReading: completedSession.odometerReading,
        startLocation: startDisplay,
        endLocation: endDisplay,
        startLocationDetails: normalizedStart || completedSession.startLocationDetails || undefined,
        endLocationDetails: normalizedDetails,
        purpose: completedSession.purpose,
        miles: actualMiles,
        notes: completedSession.notes,
        isGpsTracked: true,
        costCenter: selectedCostCenter,
        gpsTrackStartedAt: completedSession.startTime,
        gpsTrackEndedAt: completedSession.endTime,
        gpsStartLat: completedSession.gpsDeviceStartLat,
        gpsStartLng: completedSession.gpsDeviceStartLng,
        gpsEndLat: completedSession.gpsDeviceEndLat,
        gpsEndLng: completedSession.gpsDeviceEndLng,
      }),
      SAVE_TRIP_TIMEOUT_MS,
      'Save trip data'
    );
  } catch (saveError) {
    mileageSaved = false;
    console.error('⚠️ GPS trip save timed out/faulted:', saveError);
  }

  if (mileageSaved) {
    console.log('✅ GPS Trip saved successfully!');
  }

  const saveWarning = mileageSaved
    ? ''
    : '\n\nWarning: Trip ended, but saving took too long. Please check your mileage list and refresh if needed.';

  const alertMessage = `Trip completed!\nDistance: ${actualMiles} miles (GPS tracked)\nDuration: ${formatTripDuration(trackingTimeSeconds)}\nFrom: ${formatLocation(completedSession.startLocation || '', normalizedStart || completedSession.startLocationDetails || startLocationDetails || undefined)}\nTo: ${formatLocation(completedSession.endLocation || '', normalizedDetails)}${saveWarning}`;

  return {
    mileageSaved,
    actualMiles,
    completedSession,
    endDisplay,
    alertMessage,
    normalizedDetails,
  };
}

export interface FinalizeEndTripNavigationParams {
  navigation: { reset: (state: { index: number; routes: { name: string }[] }) => void };
  alertMessage: string;
}

/**
 * Mandatory post-save sequence: clear persisted trip UI, wait for native modals to
 * unmount, then reset navigation home. Prevents invisible iOS modal layers blocking touches.
 */
export async function finalizeEndTripNavigation(
  params: FinalizeEndTripNavigationParams
): Promise<void> {
  const { navigation, alertMessage } = params;

  await AsyncStorage.removeItem(GPS_TRIP_UI_STATE_KEY);

  await new Promise<void>((resolve) => {
    InteractionManager.runAfterInteractions(() => {
      const resetDelayMs = Platform.OS === 'ios' ? 350 : 50;
      setTimeout(() => {
        navigation.reset({
          index: 0,
          routes: [{ name: 'Home' }],
        });
        const alertDelayMs = Platform.OS === 'ios' ? 450 : 300;
        setTimeout(() => {
          Alert.alert('Tracking Complete', alertMessage);
          resolve();
        }, alertDelayMs);
      }, resetDelayMs);
    });
  });
}
