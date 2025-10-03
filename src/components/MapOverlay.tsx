import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  Dimensions,
  Alert,
} from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { MaterialIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { GpsTrackingService } from '../services/gpsTrackingService';
import { useGpsTracking } from '../contexts/GpsTrackingContext';

interface LocationPoint {
  latitude: number;
  longitude: number;
}

export default function MapOverlay() {
  const { showMapOverlay, setShowMapOverlay, isTracking, currentDistance, stopTracking } = useGpsTracking();
  const [currentLocation, setCurrentLocation] = useState<LocationPoint | null>(null);
  const [trackingPath, setTrackingPath] = useState<LocationPoint[]>([]);

  useEffect(() => {
    if (showMapOverlay) {
      loadCurrentLocation();
    }
  }, [showMapOverlay]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (showMapOverlay && isTracking) {
      interval = setInterval(() => {
        // Update tracking path periodically
        updateTrackingPath();
      }, 5000); // Update every 5 seconds
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [showMapOverlay, isTracking]);

  const loadCurrentLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission denied', 'Location permission is required for map functionality');
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      setCurrentLocation({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });
    } catch (error) {
      console.error('Error getting current location:', error);
    }
  };


  const updateTrackingPath = () => {
    // This would be implemented to track the path as the user moves
    // For now, we'll just show the current location
    if (currentLocation) {
      setTrackingPath([currentLocation]);
    }
  };

  const handleStopTracking = async () => {
    try {
      await stopTracking();
      setTrackingPath([]);
    } catch (error) {
      Alert.alert('Error', 'Failed to stop GPS tracking');
    }
  };

  const handleClose = () => {
    setShowMapOverlay(false);
  };

  const formatDistance = (miles: number): string => {
    if (miles < 0.1) {
      return `${(miles * 5280).toFixed(0)} ft`;
    } else {
      return `${miles.toFixed(1)} mi`;
    }
  };

  if (!showMapOverlay) return null;

  return (
    <View style={styles.overlay}>
      <View style={styles.mapContainer}>
        <MapView
          style={styles.map}
          initialRegion={
            currentLocation
              ? {
                  latitude: currentLocation.latitude,
                  longitude: currentLocation.longitude,
                  latitudeDelta: 0.01,
                  longitudeDelta: 0.01,
                }
              : {
                  latitude: 35.2271, // Default to Charlotte, NC
                  longitude: -80.8431,
                  latitudeDelta: 0.01,
                  longitudeDelta: 0.01,
                }
          }
          showsUserLocation={true}
          showsMyLocationButton={true}
          showsCompass={true}
          showsScale={true}
          mapType="standard"
        >
          {/* Current location marker */}
          {currentLocation && (
            <Marker
              coordinate={currentLocation}
              title="Current Location"
              description="Your current position"
              pinColor="blue"
            />
          )}

          {/* Tracking path */}
          {trackingPath.length > 1 && (
            <Polyline
              coordinates={trackingPath}
              strokeColor="#4CAF50"
              strokeWidth={3}
            />
          )}
        </MapView>

        {/* Map controls */}
        <View style={styles.mapControls}>
          {/* Close button */}
          <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
            <MaterialIcons name="close" size={24} color="#fff" />
          </TouchableOpacity>

          {/* Tracking status */}
          {isTracking && (
            <View style={styles.trackingStatus}>
              <View style={styles.trackingInfo}>
                <MaterialIcons name="gps-fixed" size={20} color="#4CAF50" />
                <Text style={styles.trackingText}>
                  Tracking: {formatDistance(currentDistance)}
                </Text>
              </View>
              
              <TouchableOpacity style={styles.stopButton} onPress={handleStopTracking}>
                <MaterialIcons name="stop" size={20} color="#fff" />
                <Text style={styles.stopButtonText}>Stop</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

const { width, height } = Dimensions.get('window');

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    zIndex: 1000,
  },
  mapContainer: {
    flex: 1,
    margin: 20,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  map: {
    flex: 1,
  },
  mapControls: {
    position: 'absolute',
    top: 10,
    right: 10,
    flexDirection: 'column',
    alignItems: 'flex-end',
  },
  closeButton: {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  trackingStatus: {
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    borderRadius: 8,
    padding: 10,
    alignItems: 'center',
    minWidth: 120,
  },
  trackingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  trackingText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  stopButton: {
    backgroundColor: '#f44336',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
  },
  stopButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
});
