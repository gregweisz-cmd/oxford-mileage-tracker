import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useGpsTracking } from '../contexts/GpsTrackingContext';

export default function FloatingGpsButton() {
  const { 
    isTracking, 
    currentDistance, 
    showMapOverlay, 
    setShowMapOverlay, 
    stopTracking 
  } = useGpsTracking();

  if (!isTracking) return null;

  const formatDistance = (miles: number): string => {
    if (miles < 0.1) {
      return `${(miles * 5280).toFixed(0)} ft`;
    } else {
      return `${miles.toFixed(1)} mi`;
    }
  };

  const handleStopTracking = () => {
    Alert.alert(
      'Stop GPS Tracking',
      `Are you sure you want to stop tracking?\n\nDistance tracked: ${formatDistance(currentDistance)}`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Stop',
          style: 'destructive',
          onPress: async () => {
            try {
              await stopTracking();
            } catch (error) {
              Alert.alert('Error', 'Failed to stop GPS tracking');
            }
          },
        },
      ]
    );
  };

  const handleToggleMap = () => {
    setShowMapOverlay(!showMapOverlay);
  };

  return (
    <View style={styles.container}>
      {/* Main tracking button */}
      <TouchableOpacity style={styles.mainButton} onPress={handleStopTracking}>
        <MaterialIcons name="gps-fixed" size={24} color="#fff" />
        <Text style={styles.distanceText}>{formatDistance(currentDistance)}</Text>
        <MaterialIcons name="stop" size={20} color="#fff" />
      </TouchableOpacity>

      {/* Map toggle button */}
      <TouchableOpacity 
        style={[styles.mapButton, showMapOverlay && styles.mapButtonActive]} 
        onPress={handleToggleMap}
      >
        <MaterialIcons 
          name={showMapOverlay ? "map" : "map"} 
          size={20} 
          color={showMapOverlay ? "#4CAF50" : "#fff"} 
        />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    zIndex: 999,
    alignItems: 'flex-end',
  },
  mainButton: {
    backgroundColor: '#4CAF50',
    borderRadius: 25,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    marginBottom: 8,
    minWidth: 120,
    justifyContent: 'space-between',
  },
  distanceText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginHorizontal: 8,
  },
  mapButton: {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  mapButtonActive: {
    backgroundColor: 'rgba(76, 175, 80, 0.9)',
  },
});
