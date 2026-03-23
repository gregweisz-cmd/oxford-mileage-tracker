import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { GpsTrackingService } from '../services/gpsTrackingService';
import { GpsTrackingSession, LocationDetails } from '../types';

interface GpsTrackingContextType {
  isTracking: boolean;
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
  const [currentSession, setCurrentSession] = useState<GpsTrackingSession | null>(null);
  const [currentDistance, setCurrentDistance] = useState(0);
  const [showMapOverlay, setShowMapOverlay] = useState(false);
  const [shouldShowEndLocationModal, setShouldShowEndLocationModal] = useState(false);
  const [restoredTrackingOnLaunch, setRestoredTrackingOnLaunch] = useState(false);
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
        refreshTrackingStatus();
      }
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    // Set up interval to update distance when tracking (also syncs from storage for background updates)
    const interval = setInterval(async () => {
      if (isTracking) {
        await GpsTrackingService.syncFromStorage();
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
    
    if (tracking) {
      setCurrentDistance(GpsTrackingService.getCurrentDistance());
    } else {
      setCurrentDistance(0);
    }
  };

  const startTracking = async (employeeId: string, purpose: string, odometerReading: number, notes?: string) => {
    try {
      const session = await GpsTrackingService.startTracking(employeeId, purpose, odometerReading, notes);
      setCurrentSession(session);
      setIsTracking(true);
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
      setCurrentDistance(0);
      setShowMapOverlay(false);
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
