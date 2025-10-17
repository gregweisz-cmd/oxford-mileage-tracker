import React, { useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useGpsTracking } from '../contexts/GpsTrackingContext';
import { useNavigation } from '@react-navigation/native';

interface GlobalGpsStopButtonProps {
  currentRouteName?: string;
}

export default function GlobalGpsStopButton({ currentRouteName }: GlobalGpsStopButtonProps) {
  const { isTracking, currentDistance, requestStopTracking, isStationaryTooLong, getStationaryDuration } = useGpsTracking();
  const navigation = useNavigation<any>();

  useEffect(() => {
    if (isTracking) {
      const checkStationary = setInterval(() => {
        if (isStationaryTooLong()) {
          const duration = getStationaryDuration();
          const minutes = Math.floor(duration / (1000 * 60));
          
          Alert.alert(
            'GPS Tracking Still Active',
            `You've been stationary for ${minutes} minutes. Are you still driving or would you like to stop tracking?`,
            [
              {
                text: 'Keep Tracking',
                style: 'default',
              },
              {
                text: 'Stop Tracking',
                style: 'destructive',
                onPress: () => {
                  requestStopTracking();
                },
              },
            ]
          );
        }
      }, 30000); // Check every 30 seconds

      return () => clearInterval(checkStationary);
    }
  }, [isTracking, isStationaryTooLong, getStationaryDuration, requestStopTracking]);

  // Don't show if not tracking
  if (!isTracking) {
    return null;
  }

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
      `Are you sure you want to stop tracking?\n\nDistance tracked: ${formatDistance(currentDistance)}\n\nYou'll be asked to confirm your destination.`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Continue',
          style: 'default',
          onPress: () => {
            // Navigate to GPS Tracking screen with flag to show end modal
            if (currentRouteName !== 'GpsTracking') {
              navigation.navigate('GpsTracking', { showEndModal: true });
            } else {
              // Already on GPS screen, show modal immediately
              requestStopTracking();
            }
          },
        },
      ]
    );
  };

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={handleStopTracking}
      activeOpacity={0.8}
    >
      <View style={styles.button}>
        <MaterialIcons name="stop" size={24} color="#fff" />
        <View style={styles.textContainer}>
          <Text style={styles.stopText}>Stop Tracking</Text>
          <Text style={styles.distanceText}>{formatDistance(currentDistance)}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 100, // Below the status bar
    right: 20,
    zIndex: 9999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  button: {
    backgroundColor: '#f44336',
    borderRadius: 25,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 140,
    justifyContent: 'center',
  },
  textContainer: {
    marginLeft: 8,
    alignItems: 'center',
  },
  stopText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  distanceText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    opacity: 0.9,
  },
});
