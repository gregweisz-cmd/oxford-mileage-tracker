import * as Location from 'expo-location';
import { GpsTrackingSession } from '../types';

export class GpsTrackingService {
  private static currentSession: GpsTrackingSession | null = null;
  private static watchId: Location.LocationSubscription | null = null;
  private static lastLocation: Location.LocationObject | null = null;
  private static totalDistance = 0;
  private static stationaryStartTime: Date | null = null;
  private static stationaryThreshold = 5 * 60 * 1000; // 5 minutes in milliseconds
  private static movementThreshold = 5; // 5 meters - very sensitive to movement

  static async requestPermissions(): Promise<boolean> {
    try {
      console.log('🔐 GPS: Requesting location permissions...');
      
      // Wait for location module to be ready
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Check if location services are enabled
      const isEnabled = await Location.hasServicesEnabledAsync();
      if (!isEnabled) {
        console.error('❌ GPS: Location services are disabled');
        return false;
      }

      // Check current permission status first
      const { status: currentStatus } = await Location.getForegroundPermissionsAsync();
      console.log('🔐 GPS: Current permission status:', currentStatus);
      
      if (currentStatus === 'granted') {
        console.log('✅ GPS: Location permissions already granted');
        return true;
      }

      // Request permissions if not already granted
      const { status } = await Location.requestForegroundPermissionsAsync();
      console.log('🔐 GPS: Permission request result:', status);
      
      if (status === 'granted') {
        console.log('✅ GPS: Location permissions granted');
        return true;
      } else {
        console.error('❌ GPS: Location permission denied');
        return false;
      }
    } catch (error) {
      console.error('❌ GPS: Error requesting location permissions:', error);
      // If it's a prepareAsync error, try again after a longer delay
      if (error instanceof Error && error.message.includes('prepareAsync')) {
        console.log('🔄 GPS: Retrying after prepareAsync error...');
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
      console.log('🚀 GPS: Starting tracking session...');
      console.log('🚀 GPS: Employee ID:', employeeId);
      console.log('🚀 GPS: Purpose:', purpose);
      console.log('🚀 GPS: Odometer Reading:', odometerReading);

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
      console.log('📍 GPS: Getting current location...');
      let location;
      try {
        location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced, // Changed from High to Balanced
          timeout: 15000, // Increased timeout to 15 seconds
          maximumAge: 30000, // Allow cached location up to 30 seconds old
        });
      } catch (locationError) {
        console.error('❌ GPS: Error getting location:', locationError);
        if (locationError instanceof Error && locationError.message.includes('prepareAsync')) {
          console.log('🔄 GPS: Retrying location after prepareAsync error...');
          await new Promise(resolve => setTimeout(resolve, 3000));
          location = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Lowest, // Use lowest accuracy for retry
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

      console.log('📍 GPS: Current location obtained:', location.coords);

      // Create tracking session
      const session: GpsTrackingSession = {
        id: this.generateId(),
        employeeId,
        startTime: new Date(),
        odometerReading,
        startLocation: await this.reverseGeocode(location.coords),
        totalMiles: 0,
        isActive: true,
        purpose,
        notes,
      };

      this.currentSession = session;
      this.lastLocation = location;
      this.totalDistance = 0;
      this.stationaryStartTime = null;

      // Start location tracking with more frequent updates
      this.watchId = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 10000, // Update every 10 seconds to reduce performance impact
          distanceInterval: 10, // Update every 10 meters to reduce calculations
        },
        (newLocation) => {
          // Reduced logging to improve performance
          console.log('📍 GPS: Location update received');
          this.updateDistance(newLocation);
        }
      );

      return session;
    } catch (error) {
      console.error('Error starting GPS tracking:', error);
      throw error;
    }
  }

  static async stopTracking(): Promise<GpsTrackingSession | null> {
    try {
      if (!this.currentSession || !this.watchId) {
        return null;
      }

      // Stop location tracking
      this.watchId.remove();
      this.watchId = null;

      // Get final location
      const finalLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      // Update session
      this.currentSession.endTime = new Date();
      this.currentSession.endLocation = await this.reverseGeocode(finalLocation.coords);
      this.currentSession.totalMiles = Math.round(this.totalDistance * 10) / 10; // Round to nearest tenth
      this.currentSession.isActive = false;

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

  static getCurrentSession(): GpsTrackingSession | null {
    return this.currentSession;
  }

  static isTracking(): boolean {
    return this.currentSession?.isActive || false;
  }

  static getCurrentDistance(): number {
    const distance = Math.round(this.totalDistance * 10) / 10; // Round to nearest tenth
    console.log('📍 GPS: getCurrentDistance called, returning:', distance, 'miles');
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

  private static updateDistance(newLocation: Location.LocationObject) {
    if (this.lastLocation && this.currentSession) {
      const distance = this.calculateDistance(
        this.lastLocation.coords.latitude,
        this.lastLocation.coords.longitude,
        newLocation.coords.latitude,
        newLocation.coords.longitude
      );

      // Check if movement is significant (convert meters to miles for comparison)
      const thresholdInMiles = this.movementThreshold / 1609.34; // Convert 10 meters to miles
      
      if (distance > thresholdInMiles) {
        // Significant movement detected
        this.stationaryStartTime = null;
        this.totalDistance += distance;
        
        // Update session immediately for more responsive UI
        this.currentSession.totalMiles = Math.round(this.totalDistance * 10) / 10; // Round to nearest tenth
      } else if (distance > 0.001) { // If distance is greater than ~5 feet, add it anyway
        // Small but real movement - add it to prevent getting stuck
        this.stationaryStartTime = null;
        this.totalDistance += distance;
        this.currentSession.totalMiles = Math.round(this.totalDistance * 10) / 10;
        if (!this.stationaryStartTime) {
          this.stationaryStartTime = new Date();
        }
        
        // Still update the session even for small movements to keep UI responsive
        this.currentSession.totalMiles = Math.round(this.totalDistance * 10) / 10;
      }
    }

    this.lastLocation = newLocation;
  }

  private static calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const R = 3959; // Earth's radius in miles
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) *
        Math.cos(this.toRadians(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private static toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  private static async reverseGeocode(coords: Location.LocationObjectCoords): Promise<string> {
    try {
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
}
