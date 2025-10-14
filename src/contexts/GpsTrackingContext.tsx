import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { GpsTrackingService } from '../services/gpsTrackingService';
import { GpsTrackingSession } from '../types';

interface GpsTrackingContextType {
  isTracking: boolean;
  currentSession: GpsTrackingSession | null;
  currentDistance: number;
  setCurrentDistance: (distance: number) => void;
  showMapOverlay: boolean;
  setShowMapOverlay: (show: boolean) => void;
  startTracking: (employeeId: string, purpose: string, odometerReading: number, notes?: string) => Promise<void>;
  stopTracking: () => Promise<GpsTrackingSession | null>;
  refreshTrackingStatus: () => void;
  isStationaryTooLong: () => boolean;
  getStationaryDuration: () => number;
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

  useEffect(() => {
    // Check initial tracking status
    refreshTrackingStatus();

    // Set up interval to update distance when tracking
    const interval = setInterval(() => {
      if (isTracking) {
        const newDistance = GpsTrackingService.getCurrentDistance();
        setCurrentDistance(newDistance);
        
        // Also update the current session if it exists
        const session = GpsTrackingService.getCurrentSession();
        if (session) {
          setCurrentSession({ ...session });
        }
      }
    }, 5000); // Update every 5 seconds to reduce performance impact

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

  const stopTracking = async () => {
    try {
      const completedSession = await GpsTrackingService.stopTracking();
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

  const value: GpsTrackingContextType = {
    isTracking,
    currentSession,
    currentDistance,
    setCurrentDistance,
    showMapOverlay,
    setShowMapOverlay,
    startTracking,
    stopTracking,
    refreshTrackingStatus,
    isStationaryTooLong,
    getStationaryDuration,
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
