import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { debugLog, debugError, debugWarn } from '../config/debug';
import { GpsTrackingSession, LocationDetails } from '../types';
import {
  LOCATION_TASK_NAME,
  GPS_TRACKING_STORAGE_KEY,
  PersistedGpsState,
  MAX_PERSISTED_TRACKING_SESSION_MS,
  flushPendingGpsLocationUpdates,
} from './gpsBackgroundTask';
import { GooglePlacesService } from './googlePlacesService';
import { promptForNotificationAccessIfNeeded } from './localNotificationSetup';
import { StationaryNotificationService } from './stationaryNotificationService';

/** Reject corrupt / partial AsyncStorage blobs so restore cannot throw mid-hydration. */
function isPersistedStateRestorable(state: unknown): state is PersistedGpsState {
  if (!state || typeof state !== 'object') return false;
  const s = state as Partial<PersistedGpsState>;
  if (!s.session || typeof s.session !== 'object') return false;
  const { id, employeeId, startTime } = s.session;
  if (typeof id !== 'string' || !id) return false;
  if (typeof employeeId !== 'string' || !employeeId) return false;
  if (typeof startTime !== 'string' || !startTime) return false;
  if (!s.lastLocation || typeof s.lastLocation !== 'object') return false;
  const { latitude, longitude } = s.lastLocation;
  if (typeof latitude !== 'number' || typeof longitude !== 'number') return false;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return false;
  return true;
}

export class GpsTrackingService {
  private static currentSession: GpsTrackingSession | null = null;
  private static lastLocation: Location.LocationObject | null = null;
  private static totalDistance = 0;
  /** True while user paused mileage for errand/pit stop; session stays active */
  private static tripPaused = false;
  private static stationaryStartTime: Date | null = null;
  private static stationaryThreshold = 5 * 60 * 1000; // 5 minutes in milliseconds
  private static movementThreshold = 5; // 5 meters - very sensitive to movement

  static async requestPermissions(): Promise<boolean> {
    try {
      debugLog('🔐 GPS: Requesting location permissions...');
      
      // Wait for location module to be ready
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Check if location services are enabled
      const isEnabled = await Location.hasServicesEnabledAsync();
      if (!isEnabled) {
        console.error('❌ GPS: Location services are disabled');
        return false;
      }

      // Check foreground permission status first
      const { status: foregroundStatus } = await Location.getForegroundPermissionsAsync();
      debugLog('🔐 GPS: Foreground permission status:', foregroundStatus);
      
      // Request foreground permissions if not granted
      if (foregroundStatus !== 'granted') {
        const { status: requestedForegroundStatus } = await Location.requestForegroundPermissionsAsync();
        debugLog('🔐 GPS: Foreground permission request result:', requestedForegroundStatus);
        
        if (requestedForegroundStatus !== 'granted') {
          console.error('❌ GPS: Foreground location permission denied');
          return false;
        }
      }

      // Now try to get background permissions for tracking when app is backgrounded
      try {
        const { status: backgroundStatus } = await Location.getBackgroundPermissionsAsync();
        debugLog('🔐 GPS: Background permission status:', backgroundStatus);
        
        if (backgroundStatus !== 'granted') {
          debugLog('🔐 GPS: Requesting background location permissions...');
          const { status: requestedBackgroundStatus } = await Location.requestBackgroundPermissionsAsync();
          debugLog('🔐 GPS: Background permission request result:', requestedBackgroundStatus);
          
          if (requestedBackgroundStatus !== 'granted') {
            debugLog('⚠️ GPS: Background location permission denied - tracking will pause when app is in background');
          } else {
            debugLog('✅ GPS: Background location permissions granted');
          }
        } else {
          debugLog('✅ GPS: Background location permissions already granted');
        }
      } catch (backgroundError) {
        // Background permissions might not be available on all platforms
        debugLog('⚠️ GPS: Background permissions not available on this platform:', backgroundError);
      }

      return true;
    } catch (error) {
      console.error('❌ GPS: Error requesting location permissions:', error);
      // If it's a prepareAsync error, try again after a longer delay
      if (error instanceof Error && error.message.includes('prepareAsync')) {
        debugLog('🔄 GPS: Retrying after prepareAsync error...');
        await new Promise(resolve => setTimeout(resolve, 2000));
        try {
          const { status } = await Location.requestForegroundPermissionsAsync();
          return status === 'granted';
        } catch (retryError) {
          console.error('❌ GPS: Retry failed:', retryError);
          return false;
        }
      }
      return false;
    }
  }

  static async startTracking(
    employeeId: string,
    purpose: string,
    odometerReading: number,
    notes?: string
  ): Promise<GpsTrackingSession> {
    try {
      await StationaryNotificationService.cancelAllStationaryAlerts();
      StationaryNotificationService.resetAlertThrottle();

      debugLog('🚀 GPS: Starting tracking session...');
      debugLog('🚀 GPS: Employee ID:', employeeId);
      debugLog('🚀 GPS: Purpose:', purpose);
      debugLog('🚀 GPS: Odometer Reading:', odometerReading);

      // Wait for location module to initialize properly
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Request permissions
      const hasPermission = await this.requestPermissions();
      if (!hasPermission) {
        throw new Error('Location permission denied. Please enable location permissions in your device settings.');
      }

      await promptForNotificationAccessIfNeeded();
      await StationaryNotificationService.initialize();

      // Check if location services are enabled
      const isEnabled = await Location.hasServicesEnabledAsync();
      if (!isEnabled) {
        throw new Error('Location services are disabled. Please enable location services in your device settings.');
      }

      // Get current location with more lenient settings
      debugLog('📍 GPS: Getting current location...');
      let location;
      try {
        location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
      } catch (locationError) {
        console.error('❌ GPS: Error getting location:', locationError);
        if (locationError instanceof Error && locationError.message.includes('prepareAsync')) {
          debugLog('🔄 GPS: Retrying location after prepareAsync error...');
          await new Promise(resolve => setTimeout(resolve, 3000));
          location = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Lowest,
          });
        } else {
          throw locationError;
        }
      }

      if (!location) {
        throw new Error('Unable to get current location. Please check your GPS signal.');
      }

      debugLog('📍 GPS: Current location obtained:', location.coords);

      const startLocation = await this.reverseGeocode(location.coords);

      // Create tracking session
      const session: GpsTrackingSession = {
        id: this.generateId(),
        employeeId,
        startTime: new Date(),
        odometerReading,
        startLocation,
        totalMiles: 0,
        isActive: true,
        purpose,
        notes,
      };

      this.currentSession = session;
      this.lastLocation = location;
      this.totalDistance = 0;
      this.tripPaused = false;
      this.stationaryStartTime = null;

      // Persist state for background task and app-restore
      const persistedState: PersistedGpsState = {
        session: {
          id: session.id,
          employeeId: session.employeeId,
          startTime: session.startTime.toISOString(),
          odometerReading: session.odometerReading,
          startLocation,
          totalMiles: 0,
          purpose: session.purpose,
          notes: session.notes,
        },
        lastLocation: {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        },
        lastLocationTimestamp: location.timestamp,
        totalDistance: 0,
        stationaryStartTime: null,
        hasSeenVehicleSpeed: false,
        stationaryAlertPending: false,
        stationaryAlertLastPromptAt: null,
        stationaryAlertScheduledId: null,
        isPaused: false,
        pausedDrivingAlertPending: false,
      };
      await AsyncStorage.setItem(GPS_TRACKING_STORAGE_KEY, JSON.stringify(persistedState));

      // Use background-capable location updates (works when app is in background or screen is off)
      const taskOptions: Location.LocationTaskOptions = {
        accuracy: Location.Accuracy.Balanced,
        timeInterval: 15000,
        // Keep periodic updates flowing even while stopped so idle-state logic can run reliably.
        distanceInterval: 0,
        showsBackgroundLocationIndicator: true,
      };

      if (Platform.OS === 'android') {
        taskOptions.foregroundService = {
          notificationTitle: 'Mileage Tracking',
          notificationBody: 'Oxford House is tracking your trip for mileage.',
          notificationColor: '#1C75BC',
        };
      }

      await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, taskOptions);
      debugLog('✅ GPS: Background location updates started');

      return session;
    } catch (error) {
      console.error('Error starting GPS tracking:', error);
      throw error;
    }
  }

  /**
   * @param presetEndLocation When the user already confirmed end location in the UI, pass it here
   * to avoid a slow `getCurrentPositionAsync` + reverse geocode after stopping updates (common freeze on Android).
   */
  static async stopTracking(presetEndLocation?: LocationDetails): Promise<GpsTrackingSession | null> {
    try {
      await StationaryNotificationService.cancelAllStationaryAlerts();
      StationaryNotificationService.resetAlertThrottle();

      if (!this.currentSession) {
        void Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME).catch(() => {});
        void AsyncStorage.removeItem(GPS_TRACKING_STORAGE_KEY).catch(() => {});
        return null;
      }

      const sessionId = this.currentSession.id;

      try {
        await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
      } catch {
        /* best-effort */
      }

      await flushPendingGpsLocationUpdates();
      await this.syncFromStorage();

      let finalDistance = this.totalDistance;
      try {
        const raw = await AsyncStorage.getItem(GPS_TRACKING_STORAGE_KEY);
        if (raw) {
          const parsed: unknown = JSON.parse(raw);
          if (
            isPersistedStateRestorable(parsed) &&
            parsed.session.id === sessionId &&
            typeof parsed.totalDistance === 'number' &&
            Number.isFinite(parsed.totalDistance)
          ) {
            finalDistance = parsed.totalDistance;
            this.totalDistance = parsed.totalDistance;
            this.currentSession.totalMiles = parsed.session.totalMiles;
          }
        }
      } catch {
        /* use synced in-memory distance */
      }

      await AsyncStorage.removeItem(GPS_TRACKING_STORAGE_KEY).catch(() => {});

      this.currentSession.endTime = new Date();
      this.currentSession.totalMiles = Math.round(finalDistance);
      this.currentSession.isActive = false;

      if (presetEndLocation) {
        const label =
          presetEndLocation.name?.trim() ||
          presetEndLocation.address?.trim() ||
          'Unknown';
        this.currentSession.endLocation = label;
      } else {
        // Fallback: fetch position (can block several seconds; only used if no UI-provided end)
        const finalLocation = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        this.currentSession.endLocation = await this.reverseGeocode(finalLocation.coords);
      }

      const completedSession = { ...this.currentSession };
      this.currentSession = null;
      this.lastLocation = null;
      this.totalDistance = 0;
      this.tripPaused = false;
      this.stationaryStartTime = null;

      return completedSession;
    } catch (error) {
      console.error('Error stopping GPS tracking:', error);
      throw error;
    }
  }

  /** Clear orphaned/stale persisted GPS state and stop background updates. */
  static async abandonPersistedTracking(reason?: string): Promise<void> {
    debugLog('GPS: abandoning persisted tracking', reason ?? '');
    await StationaryNotificationService.cancelAllStationaryAlerts();
    StationaryNotificationService.resetAlertThrottle();
    this.currentSession = null;
    this.lastLocation = null;
    this.totalDistance = 0;
    this.tripPaused = false;
    this.stationaryStartTime = null;
    try {
      void Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME).catch(() => {});
    } catch {
      /* ignore */
    }
    await AsyncStorage.removeItem(GPS_TRACKING_STORAGE_KEY).catch(() => {});
  }

  /** Returns true if stale/invalid persisted state was removed. */
  static async pruneStalePersistedSession(): Promise<boolean> {
    try {
      const raw = await AsyncStorage.getItem(GPS_TRACKING_STORAGE_KEY);
      if (!raw) return false;

      const parsed: unknown = JSON.parse(raw);
      if (!isPersistedStateRestorable(parsed)) {
        await this.abandonPersistedTracking('invalid-persisted-state');
        return true;
      }

      const startMs = new Date(parsed.session.startTime).getTime();
      if (!Number.isFinite(startMs) || Date.now() - startMs > MAX_PERSISTED_TRACKING_SESSION_MS) {
        await this.abandonPersistedTracking('stale-persisted-session');
        return true;
      }
    } catch {
      await this.abandonPersistedTracking('corrupt-persisted-state');
      return true;
    }
    return false;
  }

  /** Restore in-memory state from persisted storage (e.g. after app was killed and restarted) */
  static async restoreFromStorage(): Promise<boolean> {
    try {
      if (await this.pruneStalePersistedSession()) {
        return false;
      }

      const raw = await AsyncStorage.getItem(GPS_TRACKING_STORAGE_KEY);
      if (!raw) return false;

      const parsed: unknown = JSON.parse(raw);
      if (!isPersistedStateRestorable(parsed)) {
        debugWarn('GPS: persisted session invalid or incomplete; clearing storage');
        await this.abandonPersistedTracking('invalid-persisted-state');
        return false;
      }
      const state = parsed;
      const session = state.session;

      this.currentSession = {
        id: session.id,
        employeeId: session.employeeId,
        startTime: new Date(session.startTime),
        odometerReading: session.odometerReading,
        startLocation: session.startLocation,
        totalMiles: session.totalMiles,
        isActive: true,
        purpose: session.purpose,
        notes: session.notes,
      };
      this.lastLocation = {
        coords: {
          ...state.lastLocation,
          altitude: null,
          accuracy: null,
          altitudeAccuracy: null,
          heading: null,
          speed: null,
        },
        timestamp: Date.now(),
      };
      this.totalDistance = state.totalDistance;
      this.tripPaused = state.isPaused === true;
      this.stationaryStartTime = state.stationaryStartTime ? new Date(state.stationaryStartTime) : null;

      // Resume location updates if not already running
      const isRunning = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
      if (!isRunning) {
        const taskOptions: Location.LocationTaskOptions = {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 15000,
          distanceInterval: 0,
          showsBackgroundLocationIndicator: true,
        };
        if (Platform.OS === 'android') {
          taskOptions.foregroundService = {
            notificationTitle: 'Mileage Tracking',
            notificationBody: 'Oxford House is tracking your trip for mileage.',
            notificationColor: '#1C75BC',
          };
        }
        await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, taskOptions);
      }

      debugLog('✅ GPS: Restored tracking session from storage');
      return true;
    } catch (err) {
      debugError('GPS restore error:', err);
      return false;
    }
  }

  /** Sync in-memory state from persisted storage (e.g. after returning from background) */
  static async syncFromStorage(): Promise<void> {
    try {
      const raw = await AsyncStorage.getItem(GPS_TRACKING_STORAGE_KEY);
      if (!raw || !this.currentSession) return;

      const parsed: unknown = JSON.parse(raw);
      if (!isPersistedStateRestorable(parsed)) return;
      const state = parsed;
      if (state.session.id !== this.currentSession.id) return;

      this.totalDistance = state.totalDistance;
      this.currentSession.totalMiles = state.session.totalMiles;
      this.tripPaused = state.isPaused === true;
      this.stationaryStartTime = state.stationaryStartTime ? new Date(state.stationaryStartTime) : null;
      this.lastLocation = {
        coords: {
          ...state.lastLocation,
          altitude: null,
          accuracy: null,
          altitudeAccuracy: null,
          heading: null,
          speed: null,
        },
        timestamp: Date.now(),
      };
    } catch {
      // Ignore sync errors
    }
  }

  static async hasPendingStationaryAlert(): Promise<boolean> {
    try {
      const raw = await AsyncStorage.getItem(GPS_TRACKING_STORAGE_KEY);
      if (!raw) return false;
      const state: PersistedGpsState = JSON.parse(raw);
      return !!state.stationaryAlertPending;
    } catch {
      return false;
    }
  }

  static async consumeStationaryAlertPrompt(): Promise<void> {
    try {
      const raw = await AsyncStorage.getItem(GPS_TRACKING_STORAGE_KEY);
      if (!raw) return;
      const state: PersistedGpsState = JSON.parse(raw);
      state.stationaryAlertPending = false;
      state.stationaryAlertLastPromptAt = Date.now();
      state.stationaryAlertScheduledId = null;
      await AsyncStorage.setItem(GPS_TRACKING_STORAGE_KEY, JSON.stringify(state));
      await StationaryNotificationService.cancelAllStationaryAlerts();
    } catch {
      // Ignore storage errors for non-critical UX prompts
    }
  }

  static async hasPendingPausedDrivingAlert(): Promise<boolean> {
    try {
      const raw = await AsyncStorage.getItem(GPS_TRACKING_STORAGE_KEY);
      if (!raw) return false;
      const state: PersistedGpsState = JSON.parse(raw);
      return state.pausedDrivingAlertPending === true;
    } catch {
      return false;
    }
  }

  static async consumePausedDrivingAlertPrompt(): Promise<void> {
    try {
      const raw = await AsyncStorage.getItem(GPS_TRACKING_STORAGE_KEY);
      if (!raw) return;
      const state: PersistedGpsState = JSON.parse(raw);
      state.pausedDrivingAlertPending = false;
      await AsyncStorage.setItem(GPS_TRACKING_STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Ignore storage errors for non-critical UX prompts
    }
  }

  static getCurrentSession(): GpsTrackingSession | null {
    return this.currentSession;
  }

  static isTracking(): boolean {
    return this.currentSession?.isActive || false;
  }

  static isTripPaused(): boolean {
    return this.tripPaused;
  }

  /** Pause accumulating miles; GPS keeps fixing position so resume does not add a bogus jump */
  static async pauseTripMileage(): Promise<void> {
    const raw = await AsyncStorage.getItem(GPS_TRACKING_STORAGE_KEY);
    if (!raw || !this.currentSession) return;
    try {
      const state: PersistedGpsState = JSON.parse(raw);
      if (state.session.id !== this.currentSession.id) return;

      await StationaryNotificationService.cancelAllStationaryAlerts();
      state.stationaryAlertScheduledId = null;
      state.stationaryAlertPending = false;
      state.stationaryStartTime = null;
      state.nonDrivingCandidateStartTime = null;
      state.isPaused = true;
      state.pausedDrivingAlertPending = false;

      try {
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        state.lastLocation = {
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        };
        state.lastLocationTimestamp = loc.timestamp;
        this.lastLocation = {
          coords: {
            ...state.lastLocation,
            altitude: null,
            accuracy: null,
            altitudeAccuracy: null,
            heading: null,
            speed: null,
          },
          timestamp: loc.timestamp,
        };
      } catch {
        // Keep previous anchor from storage if fix fails
      }

      await AsyncStorage.setItem(GPS_TRACKING_STORAGE_KEY, JSON.stringify(state));
      this.tripPaused = true;
      this.stationaryStartTime = null;
    } catch {
      /* ignore storage errors */
    }
  }

  /** Resume accumulating miles after pause; snaps anchor to current position */
  static async resumeTripMileage(): Promise<void> {
    const raw = await AsyncStorage.getItem(GPS_TRACKING_STORAGE_KEY);
    if (!raw || !this.currentSession) return;
    try {
      const state: PersistedGpsState = JSON.parse(raw);
      if (state.session.id !== this.currentSession.id) return;

      state.isPaused = false;
      state.pausedDrivingAlertPending = false;
      await StationaryNotificationService.cancelAllStationaryAlerts();
      state.stationaryAlertScheduledId = null;
      state.stationaryStartTime = null;
      state.nonDrivingCandidateStartTime = null;

      try {
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        state.lastLocation = {
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        };
        state.lastLocationTimestamp = loc.timestamp;
        this.lastLocation = {
          coords: {
            ...state.lastLocation,
            altitude: null,
            accuracy: null,
            altitudeAccuracy: null,
            heading: null,
            speed: null,
          },
          timestamp: loc.timestamp,
        };
      } catch {
        /* keep lastLocation from persisted state */
      }

      await AsyncStorage.setItem(GPS_TRACKING_STORAGE_KEY, JSON.stringify(state));
      this.tripPaused = false;
      this.stationaryStartTime = null;
    } catch {
      /* ignore */
    }
  }

  static getCurrentDistance(): number {
    const distance = Math.round(this.totalDistance);
    return distance;
  }

  static isStationaryTooLong(): boolean {
    if (!this.stationaryStartTime) {
      return false;
    }
    return Date.now() - this.stationaryStartTime.getTime() > this.stationaryThreshold;
  }

  static getStationaryDuration(): number {
    if (!this.stationaryStartTime) {
      return 0;
    }
    return Date.now() - this.stationaryStartTime.getTime();
  }

  private static async reverseGeocode(coords: Location.LocationObjectCoords): Promise<string> {
    try {
      // Prefer Google geocoding (via backend proxy) for fuller street-level addresses.
      const preciseAddress = await GooglePlacesService.getAddressFromCoordinates(
        coords.latitude,
        coords.longitude
      );
      if (preciseAddress) {
        return preciseAddress;
      }

      const result = await Location.reverseGeocodeAsync({
        latitude: coords.latitude,
        longitude: coords.longitude,
      });

      if (result.length > 0) {
        const address = result[0];
        return `${address.street || ''} ${address.city || ''}, ${address.region || ''} ${address.postalCode || ''}`.trim();
      }

      return `${coords.latitude.toFixed(6)}, ${coords.longitude.toFixed(6)}`;
    } catch (error) {
      console.error('Error reverse geocoding:', error);
      return `${coords.latitude.toFixed(6)}, ${coords.longitude.toFixed(6)}`;
    }
  }

  private static generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  static async getCurrentSpeed(): Promise<number> {
    try {
      if (!this.lastLocation || !this.lastLocation.coords.speed) {
        return 0;
      }
      
      const speedMPS = this.lastLocation.coords.speed;
      const speedMPH = speedMPS * 2.23694;
      return Math.max(0, speedMPH);
    } catch (error) {
      console.error('Error getting current speed:', error);
      return 0;
    }
  }
}
