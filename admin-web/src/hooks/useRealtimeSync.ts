import { useState, useEffect, useCallback } from 'react';
import { realtimeSyncService, RealtimeUpdate } from '../services/realtimeSyncService';
import { debugError, debugVerbose } from '../config/debug';

export interface RealtimeSyncStatus {
  connected: boolean;
  reconnectAttempts: number;
  enabled: boolean;
}

export interface UseRealtimeSyncOptions {
  enabled?: boolean;
  onUpdate?: (update: RealtimeUpdate) => void;
  onConnectionChange?: (connected: boolean) => void;
}

/**
 * Hook for real-time sync functionality
 */
export function useRealtimeSync(options: UseRealtimeSyncOptions = {}) {
  const { enabled = true, onUpdate, onConnectionChange } = options;
  
  const [status, setStatus] = useState<RealtimeSyncStatus>({
    connected: false,
    reconnectAttempts: 0,
    enabled: false
  });

  // Initialize real-time sync
  useEffect(() => {
    const initializeSync = async () => {
      try {
        await realtimeSyncService.initialize();
        
        // Set enabled state
        realtimeSyncService.setEnabled(enabled);
        
        // Update status
        const connectionStatus = realtimeSyncService.getConnectionStatus();
        setStatus(prev => ({
          ...prev,
          enabled,
          ...connectionStatus
        }));
        
        debugVerbose('✅ useRealtimeSync: Real-time sync initialized');
      } catch (error) {
        debugError('❌ useRealtimeSync: Failed to initialize:', error);
      }
    };

    initializeSync();
  }, [enabled]);

  // Handle enabled state changes
  useEffect(() => {
    realtimeSyncService.setEnabled(enabled);
    setStatus(prev => ({ ...prev, enabled }));
  }, [enabled]);

  // Subscribe to updates
  useEffect(() => {
    if (!onUpdate) return;

    const unsubscribe = realtimeSyncService.subscribe('employee', onUpdate);
    
    return () => {
      unsubscribe();
    };
  }, [onUpdate]);

  // Monitor connection status
  useEffect(() => {
    const interval = setInterval(() => {
      const connectionStatus = realtimeSyncService.getConnectionStatus();
      setStatus(prev => {
        const newStatus = { ...prev, ...connectionStatus };
        
        // Notify of connection changes
        if (prev.connected !== newStatus.connected) {
          onConnectionChange?.(newStatus.connected);
        }
        
        return newStatus;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [onConnectionChange]);

  // Manual refresh function
  const refreshData = useCallback((entityType: string, employeeId?: string) => {
    realtimeSyncService.requestDataRefresh(entityType, employeeId);
  }, []);

  // Notify data change
  const notifyDataChange = useCallback((update: RealtimeUpdate) => {
    realtimeSyncService.notifyDataChange(update);
  }, []);

  // Enable/disable sync
  const setSyncEnabled = useCallback((enabled: boolean) => {
    realtimeSyncService.setEnabled(enabled);
    setStatus(prev => ({ ...prev, enabled }));
  }, []);

  return {
    status,
    refreshData,
    notifyDataChange,
    setSyncEnabled
  };
}

/**
 * Hook for subscribing to specific data type updates
 */
export function useRealtimeSubscription(
  dataType: string,
  callback: (update: RealtimeUpdate) => void
) {
  useEffect(() => {
    const unsubscribe = realtimeSyncService.subscribe(dataType, callback);
    return unsubscribe;
  }, [dataType, callback]);
}

/**
 * Hook for real-time sync status indicator
 */
export function useRealtimeStatus() {
  const [status, setStatus] = useState<RealtimeSyncStatus>({
    connected: false,
    reconnectAttempts: 0,
    enabled: false
  });

  useEffect(() => {
    const interval = setInterval(() => {
      const connectionStatus = realtimeSyncService.getConnectionStatus();
      setStatus(prev => ({ ...prev, ...connectionStatus }));
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  return status;
}
