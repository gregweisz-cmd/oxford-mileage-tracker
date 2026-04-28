import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useGpsTracking } from '../contexts/GpsTrackingContext';
import { useNavigation } from '@react-navigation/native';
import { hapticMedium } from '../utils/haptics';

interface GlobalGpsStopButtonProps {
  currentRouteName?: string;
}

export default function GlobalGpsStopButton({ currentRouteName }: GlobalGpsStopButtonProps) {
  const insets = useSafeAreaInsets();
  const { isTracking, currentDistance, requestStopTracking } = useGpsTracking();
  const navigation = useNavigation<any>();

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
    void hapticMedium();
    // Intentionally no "discard / cancel session" action here — it was easy to tap by mistake.
    // To end tracking, users must use "End & save trip" and confirm destination. Staff who truly
    // need to abandon a session can force-close the app or contact support (rare).
    Alert.alert(
      'End this trip?',
      `Distance so far: ${formatDistance(currentDistance)}\n\nTap "End & save trip" to enter your destination and save this drive. Tap "Keep tracking" if you tapped Stop by accident.`,
      [
        {
          text: 'Keep tracking',
          style: 'cancel',
        },
        {
          text: 'End & save trip',
          style: 'default',
          onPress: () => {
            requestStopTracking();
            if (currentRouteName !== 'GpsTracking') {
              navigation.navigate('GpsTracking', { showEndModal: true });
            }
          },
        },
      ]
    );
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
