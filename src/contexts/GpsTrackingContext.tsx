import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { AppState, AppStateStatus, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as Notifications from 'expo-notifications';
import { GpsTrackingService } from '../services/gpsTrackingService';
import { GpsTrackingSession, LocationDetails } from '../types';
import {
  GPS_STATIONARY_ACTION_END,
  GPS_STATIONARY_ACTION_KEEP,
  StationaryNotificationService,
} from '../services/stationaryNotificationService';

interface GpsTrackingContextType {
  isTracking: boolean;
  /** Mileage paused (errand/pit stop) while GPS session stays active */
  tripPaused: boolean;
  pauseTrip: () => Promise<void>;
  resumeTrip: () => Promise<void>;
  currentSession: GpsTrackingSession | null;
  currentDistance: number;
  setCurrentDistance: (distance: number) => void;
  showMapOverlay: boolean;
  setShowMapOverlay: (show: boolean) => void;
  startTracking: (employeeId: string, purpose: string, odometerReading: number, notes?: string) => Promise<void>;
  stopTracking: (presetEndLocation?: LocationDetails) => Promise<GpsTrackingSession | null>;
  requestStopTracking: () => void;
  refreshTrackingStatus: () => void;
  isStationaryTooLong: () => boolean;
  getStationaryDuration: () => number;
  shouldShowEndLocationModal: boolean;
  setShouldShowEndLocationModal: (show: boolean) => void;
  /** True when we restored an active session from storage (e.g. app was killed during tracking) */
  restoredTrackingOnLaunch: boolean;
}

const GpsTrackingContext = createContext<GpsTrackingContextType | undefined>(undefined);

interface GpsTrackingProviderProps {
  children: ReactNode;
}

export function GpsTrackingProvider({ children }: GpsTrackingProviderProps) {
  const [isTracking, setIsTracking] = useState(false);
  const [tripPaused, setTripPaused] = useState(false);
  const [currentSession, setCurrentSession] = useState<GpsTrackingSession | null>(null);
  const [currentDistance, setCurrentDistance] = useState(0);
  const [showMapOverlay, setShowMapOverlay] = useState(false);
  const [shouldShowEndLocationModal, setShouldShowEndLocationModal] = useState(false);
  const [restoredTrackingOnLaunch, setRestoredTrackingOnLaunch] = useState(false);
  const [showStationaryPrompt, setShowStationaryPrompt] = useState(false);
  const restoredRef = useRef(false);

  // Restore session from storage on mount (handles app kill/restart during tracking)
  useEffect(() => {
    let mounted = true;
    (async () => {
      const restored = await GpsTrackingService.restoreFromStorage();
      if (mounted && restored && !restoredRef.current) {
        restoredRef.current = true;
        setRestoredTrackingOnLaunch(true);
        refreshTrackingStatus();
      } else if (mounted && !restored) {
        refreshTrackingStatus();
      }
    })();
    return () => { mounted = false; };
  }, []);

  // When app returns to foreground, sync from persisted storage (background task may have updated it)
  useEffect(() => {
    const sub = AppState.addEventListener('change', async (nextState: AppStateStatus) => {
      if (nextState === 'active' && GpsTrackingService.isTracking()) {
        await GpsTrackingService.syncFromStorage();
        setTripPaused(GpsTrackingService.isTripPaused());
        refreshTrackingStatus();
        const hasPendingAlert = await GpsTrackingService.hasPendingStationaryAlert();
        if (hasPendingAlert) {
          setShowStationaryPrompt(true);
          await GpsTrackingService.consumeStationaryAlertPrompt();
        }
      }
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    let receivedSubscription: Notifications.EventSubscription | undefined;
    let responseSubscription: Notifications.EventSubscription | undefined;
    let mounted = true;

    const openStationaryPrompt = async () => {
      if (!GpsTrackingService.isTracking() || GpsTrackingService.isTripPaused()) return;
      setShowStationaryPrompt(true);
      await GpsTrackingService.consumeStationaryAlertPrompt();
    };

    (async () => {
      await StationaryNotificationService.initialize();
      if (!mounted) return;
      receivedSubscription = Notifications.addNotificationReceivedListener((notification) => {
        const type = (notification.request.content.data as any)?.type;
        if (type === 'gps_stationary') {
          void openStationaryPrompt();
        }
      });
      responseSubscription = Notifications.addNotificationResponseReceivedListener((response) => {
        const actionId = response.actionIdentifier;
        const type = (response.notification.request.content.data as any)?.type;
        if (type === 'gps_stationary' && actionId === GPS_STATIONARY_ACTION_END) {
          setShowStationaryPrompt(false);
          void GpsTrackingService.consumeStationaryAlertPrompt();
          requestStopTracking();
        } else if (type === 'gps_stationary' && actionId === GPS_STATIONARY_ACTION_KEEP) {
          setShowStationaryPrompt(false);
          void GpsTrackingService.consumeStationaryAlertPrompt();
        } else if (type === 'gps_stationary') {
          void openStationaryPrompt();
        }
      });
    })();

    return () => {
      mounted = false;
      receivedSubscription?.remove();
      responseSubscription?.remove();
    };
  }, []);

  useEffect(() => {
    // Set up interval to update distance when tracking (also syncs from storage for background updates)
    const interval = setInterval(async () => {
      if (isTracking) {
        await GpsTrackingService.syncFromStorage();
        setTripPaused(GpsTrackingService.isTripPaused());
        const newDistance = GpsTrackingService.getCurrentDistance();
        setCurrentDistance(prevDistance => {
          if (Math.abs(newDistance - prevDistance) > 0.01) return newDistance;
          return prevDistance;
        });
      }
    }, 15000);
    return () => clearInterval(interval);
  }, [isTracking]);

  const refreshTrackingStatus = () => {
    const session = GpsTrackingService.getCurrentSession();
    const tracking = GpsTrackingService.isTracking();
    
    setIsTracking(tracking);
    setCurrentSession(session);
    setTripPaused(tracking ? GpsTrackingService.isTripPaused() : false);

    if (tracking) {
      setCurrentDistance(GpsTrackingService.getCurrentDistance());
    } else {
      setCurrentDistance(0);
    }
  };

  const pauseTrip = async () => {
    await GpsTrackingService.pauseTripMileage();
    await GpsTrackingService.syncFromStorage();
    refreshTrackingStatus();
  };

  const resumeTrip = async () => {
    await GpsTrackingService.resumeTripMileage();
    await GpsTrackingService.syncFromStorage();
    refreshTrackingStatus();
  };

  const startTracking = async (employeeId: string, purpose: string, odometerReading: number, notes?: string) => {
    try {
      const session = await GpsTrackingService.startTracking(employeeId, purpose, odometerReading, notes);
      setCurrentSession(session);
      setIsTracking(true);
      setTripPaused(false);
      setCurrentDistance(0);
    } catch (error) {
      console.error('Error starting tracking:', error);
      throw error;
    }
  };

  const stopTracking = async (presetEndLocation?: LocationDetails) => {
    try {
      const completedSession = await GpsTrackingService.stopTracking(presetEndLocation);
      setCurrentSession(null);
      setIsTracking(false);
      setTripPaused(false);
      setCurrentDistance(0);
      setShowMapOverlay(false);
      setShowStationaryPrompt(false);
      return completedSession;
    } catch (error) {
      console.error('Error stopping tracking:', error);
      throw error;
    }
  };

  const isStationaryTooLong = () => {
    if (!currentSession) return false;
    return GpsTrackingService.isStationaryTooLong();
  };

  const getStationaryDuration = () => {
    if (!currentSession) return 0;
    return GpsTrackingService.getStationaryDuration();
  };

  const requestStopTracking = () => {
    // Signal to show the end location modal
    setShouldShowEndLocationModal(true);
  };

  const value: GpsTrackingContextType = {
    isTracking,
    tripPaused,
    pauseTrip,
    resumeTrip,
    currentSession,
    currentDistance,
    setCurrentDistance,
    showMapOverlay,
    setShowMapOverlay,
    startTracking,
    stopTracking,
    requestStopTracking,
    refreshTrackingStatus,
    isStationaryTooLong,
    getStationaryDuration,
    shouldShowEndLocationModal,
    setShouldShowEndLocationModal,
    restoredTrackingOnLaunch,
  };

  return (
    <GpsTrackingContext.Provider value={value}>
      {children}
      <Modal
        visible={showStationaryPrompt && isTracking && !tripPaused}
        transparent
        animationType="fade"
        onRequestClose={() => setShowStationaryPrompt(false)}
      >
        <View style={styles.stationaryOverlay}>
          <View style={styles.stationaryCard}>
            <Text style={styles.stationaryTitle}>Still tracking your trip</Text>
            <Text style={styles.stationaryBody}>
              We detected you are no longer moving at driving speed. Do you want to end tracking?
            </Text>
            <View style={styles.stationaryActions}>
              <TouchableOpacity
                style={styles.stationarySecondaryButton}
                onPress={() => setShowStationaryPrompt(false)}
              >
                <Text style={styles.stationarySecondaryButtonText}>Continue Tracking</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.stationaryPrimaryButton}
                onPress={() => {
                  setShowStationaryPrompt(false);
                  requestStopTracking();
                }}
              >
                <Text style={styles.stationaryPrimaryButtonText}>End Tracking</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </GpsTrackingContext.Provider>
  );
}

export function useGpsTracking(): GpsTrackingContextType {
  const context = useContext(GpsTrackingContext);
  if (context === undefined) {
    throw new Error('useGpsTracking must be used within a GpsTrackingProvider');
  }
  return context;
}

const styles = StyleSheet.create({
  stationaryOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  stationaryCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
  },
  stationaryTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#222',
    marginBottom: 8,
  },
  stationaryBody: {
    fontSize: 14,
    color: '#555',
    lineHeight: 20,
    marginBottom: 16,
  },
  stationaryActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  stationarySecondaryButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#2196F3',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  stationarySecondaryButtonText: {
    color: '#2196F3',
    fontWeight: '600',
  },
  stationaryPrimaryButton: {
    flex: 1,
    backgroundColor: '#f44336',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  stationaryPrimaryButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
});
