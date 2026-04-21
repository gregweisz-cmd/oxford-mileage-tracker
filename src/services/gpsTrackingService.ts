import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { debugLog, debugError, debugWarn } from '../config/debug';
import { GpsTrackingSession, LocationDetails } from '../types';
import { LOCATION_TASK_NAME, GPS_TRACKING_STORAGE_KEY, PersistedGpsState } from './gpsBackgroundTask';
import { GooglePlacesService } from './googlePlacesService';
import { StationaryNotificationService } from './stationaryNotificationService';

export class GpsTrackingService {
  private static currentSession: GpsTrackingSession | null = null;
  private static lastLocation: Location.LocationObject | null = null;
  private static totalDistance = 0;
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
          timeout: 15000,
          maximumAge: 30000,
        });
      } catch (locationError) {
        console.error('❌ GPS: Error getting location:', locationError);
        if (locationError instanceof Error && locationError.message.includes('prepareAsync')) {
          debugLog('🔄 GPS: Retrying location after prepareAsync error...');
          await new Promise(resolve => setTimeout(resolve, 3000));
          location = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Lowest,
            timeout: 20000,
            maximumAge: 60000,
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
      const rawState = await AsyncStorage.getItem(GPS_TRACKING_STORAGE_KEY);
      if (rawState) {
        const persistedState: PersistedGpsState = JSON.parse(rawState);
        await StationaryNotificationService.cancelScheduledAlert(persistedState.stationaryAlertScheduledId);
      }

      if (!this.currentSession) {
        // Don't block UI on location stop / storage clearing.
        void Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME).catch(() => {});
        void AsyncStorage.removeItem(GPS_TRACKING_STORAGE_KEY).catch(() => {});
        return null;
      }

      // Stop background location updates
      // Location APIs can be slow and are a common cause of "freezes" when awaited.
      // We best-effort stop updates asynchronously and continue ending the session.
      void Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME).catch(() => {});

      // Clear persisted state
      void AsyncStorage.removeItem(GPS_TRACKING_STORAGE_KEY).catch(() => {});

      this.currentSession.endTime = new Date();
      this.currentSession.totalMiles = Math.round(this.totalDistance * 10) / 10;
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
      this.stationaryStartTime = null;

      return completedSession;
    } catch (error) {
      console.error('Error stopping GPS tracking:', error);
      throw error;
    }
  }

  /** Restore in-memory state from persisted storage (e.g. after app was killed and restarted) */
  static async restoreFromStorage(): Promise<boolean> {
    try {
      const raw = await AsyncStorage.getItem(GPS_TRACKING_STORAGE_KEY);
      if (!raw) return false;

      const state: PersistedGpsState = JSON.parse(raw);
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

      const state: PersistedGpsState = JSON.parse(raw);
      if (state.session.id !== this.currentSession.id) return;

      this.totalDistance = state.totalDistance;
      this.currentSession.totalMiles = state.session.totalMiles;
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

  static getCurrentDistance(): number {
    const distance = Math.round(this.totalDistance * 10) / 10;
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
