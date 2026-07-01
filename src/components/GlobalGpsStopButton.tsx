import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useGpsTracking } from '../contexts/GpsTrackingContext';
import { useNavigation } from '@react-navigation/native';
import { hapticMedium } from '../utils/haptics';
import { formatGpsTripDistance, showGpsTripOptionsAlert } from '../utils/gpsTripOptionsAlert';

interface GlobalGpsStopButtonProps {
  currentRouteName?: string;
}

export default function GlobalGpsStopButton({ currentRouteName }: GlobalGpsStopButtonProps) {
  const insets = useSafeAreaInsets();
  const { isTracking, tripPaused, pauseTrip, resumeTrip, currentDistance } =
    useGpsTracking();
  const navigation = useNavigation<any>();

  // On GPS Tracking screen, Stop is inline below the active tile (not floating here).
  if (currentRouteName === 'GpsTracking') {
    return null;
  }

  // Don't show if not tracking
  if (!isTracking) {
    return null;
  }

  const handleStopTracking = () => {
    void hapticMedium();
    showGpsTripOptionsAlert({
      tripPaused,
      currentDistance,
      onResume: () => void resumeTrip(),
      onPause: () => void pauseTrip(),
      onEndAndSave: () => {
        navigation.navigate('GpsTracking', { endTripOverlay: true });
      },
    });
  };

  return (
    <TouchableOpacity
        style={[styles.container, { top: insets.top + 8 }]}
        onPress={handleStopTracking}
        activeOpacity={0.8}
      >
        <View style={styles.button}>
          <MaterialIcons name="stop" size={24} color="#fff" />
          <View style={styles.textContainer}>
            <Text style={styles.stopText}>Stop Tracking</Text>
            <Text style={styles.distanceText}>
              {tripPaused ? `${formatGpsTripDistance(currentDistance)} · paused` : formatGpsTripDistance(currentDistance)}
            </Text>
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
