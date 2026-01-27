import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Modal,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useGpsTracking } from '../contexts/GpsTrackingContext';
import { useNavigation } from '@react-navigation/native';

interface GlobalGpsStopButtonProps {
  currentRouteName?: string;
}

export default function GlobalGpsStopButton({ currentRouteName }: GlobalGpsStopButtonProps) {
  const insets = useSafeAreaInsets();
  const { isTracking, currentDistance, requestStopTracking, isStationaryTooLong, getStationaryDuration } = useGpsTracking();
  const navigation = useNavigation<any>();
  const [showStationaryAlert, setShowStationaryAlert] = useState(false);
  const [stationaryMinutes, setStationaryMinutes] = useState(0);

  useEffect(() => {
    if (isTracking) {
      const checkStationary = setInterval(() => {
        if (isStationaryTooLong()) {
          const duration = getStationaryDuration();
          const minutes = Math.floor(duration / (1000 * 60));
          setStationaryMinutes(minutes);
          
          // Show persistent notification
          if (!showStationaryAlert) {
            setShowStationaryAlert(true);
          }
        } else {
          // Movement detected, clear notification
          if (showStationaryAlert) {
            setShowStationaryAlert(false);
          }
        }
      }, 30000); // Check every 30 seconds

      // Update minutes count in real-time when alert is shown
      let updateInterval: NodeJS.Timeout | null = null;
      if (showStationaryAlert) {
        updateInterval = setInterval(() => {
          if (isStationaryTooLong()) {
            const duration = getStationaryDuration();
            const minutes = Math.floor(duration / (1000 * 60));
            setStationaryMinutes(minutes);
          }
        }, 10000); // Update every 10 seconds
      }

      return () => {
        clearInterval(checkStationary);
        if (updateInterval) {
          clearInterval(updateInterval);
        }
      };
    } else {
      // Not tracking, clear any stationary alert
      if (showStationaryAlert) {
        setShowStationaryAlert(false);
      }
    }
  }, [isTracking, isStationaryTooLong, getStationaryDuration, showStationaryAlert]);

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
    <>
      {/* Persistent Stationary Alert Modal */}
      <Modal
        visible={showStationaryAlert && isTracking}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          // Don't allow dismissing by back button - must stop tracking or dismiss explicitly
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.alertContainer}>
            <View style={styles.alertHeader}>
              <MaterialIcons name="warning" size={32} color="#FF9800" />
              <Text style={styles.alertTitle}>GPS Tracking Still Active</Text>
            </View>
            <Text style={styles.alertMessage}>
              You've been stationary for {stationaryMinutes} minutes. Are you still driving or would you like to stop tracking?
            </Text>
            <Text style={styles.alertSubtext}>
              This notification will remain until you stop tracking or dismiss it.
            </Text>
            <View style={styles.alertButtons}>
              <TouchableOpacity
                style={[styles.alertButton, styles.alertButtonSecondary]}
                onPress={() => {
                  setShowStationaryAlert(false);
                }}
              >
                <Text style={styles.alertButtonTextSecondary}>Dismiss</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.alertButton, styles.alertButtonPrimary]}
                onPress={() => {
                  setShowStationaryAlert(false);
                  requestStopTracking();
                }}
              >
                <Text style={styles.alertButtonTextPrimary}>Stop Tracking</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

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
    </>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  alertContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  alertHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  alertTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginLeft: 12,
    color: '#333',
  },
  alertMessage: {
    fontSize: 16,
    color: '#666',
    marginBottom: 8,
    lineHeight: 22,
  },
  alertSubtext: {
    fontSize: 14,
    color: '#999',
    marginBottom: 20,
    fontStyle: 'italic',
  },
  alertButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  alertButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    minWidth: 120,
    alignItems: 'center',
  },
  alertButtonSecondary: {
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  alertButtonPrimary: {
    backgroundColor: '#F44336',
  },
  alertButtonTextSecondary: {
    color: '#333',
    fontSize: 16,
    fontWeight: '600',
  },
  alertButtonTextPrimary: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
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
