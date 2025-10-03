import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { ApiSyncService, SyncStatus } from '../services/apiSyncService';
import { SyncIntegrationService } from '../services/syncIntegrationService';

interface SyncStatusBarProps {
  onPress?: () => void;
  showDetails?: boolean;
}

export const SyncStatusBar: React.FC<SyncStatusBarProps> = ({ 
  onPress, 
  showDetails = false 
}) => {
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    isConnected: false,
    lastSyncTime: null,
    totalEmployees: 0,
    totalMileageEntries: 0,
    totalReceipts: 0,
    totalTimeTracking: 0,
    pendingChanges: 0
  });
  const [queueStatus, setQueueStatus] = useState({
    queueLength: 0,
    isProcessing: false,
    autoSyncEnabled: true
  });

  useEffect(() => {
    loadSyncStatus();
    
    // Update status every 10 seconds
    const interval = setInterval(loadSyncStatus, 10000);
    
    return () => clearInterval(interval);
  }, []);

  const loadSyncStatus = async () => {
    try {
      const [apiStatus, integrationStatus] = await Promise.all([
        ApiSyncService.getSyncStatus(),
        Promise.resolve(SyncIntegrationService.getSyncQueueStatus())
      ]);
      
      setSyncStatus(apiStatus);
      setQueueStatus(integrationStatus);
    } catch (error) {
      console.error('❌ SyncStatusBar: Error loading sync status:', error);
    }
  };

  const handlePress = () => {
    if (onPress) {
      onPress();
    } else {
      // Default action - show sync details
      const lastSync = syncStatus.lastSyncTime 
        ? syncStatus.lastSyncTime.toLocaleString() 
        : 'Never';
      
      Alert.alert(
        'Sync Status',
        `Connection: ${syncStatus.isConnected ? 'Connected' : 'Disconnected'}\n` +
        `Last Sync: ${lastSync}\n` +
        `Pending Changes: ${syncStatus.pendingChanges}\n` +
        `Queue Length: ${queueStatus.queueLength}\n` +
        `Auto Sync: ${queueStatus.autoSyncEnabled ? 'Enabled' : 'Disabled'}`,
        [{ text: 'OK' }]
      );
    }
  };

  const getStatusColor = (): string => {
    if (!syncStatus.isConnected) return '#F44336'; // Red
    if (syncStatus.pendingChanges > 0 || queueStatus.queueLength > 0) return '#FF9800'; // Orange
    return '#4CAF50'; // Green
  };

  const getStatusText = (): string => {
    if (!syncStatus.isConnected) return 'Disconnected';
    if (queueStatus.isProcessing) return 'Syncing...';
    if (syncStatus.pendingChanges > 0 || queueStatus.queueLength > 0) return 'Pending';
    return 'Synced';
  };

  return (
    <TouchableOpacity 
      style={[styles.container, { backgroundColor: getStatusColor() }]}
      onPress={handlePress}
      activeOpacity={0.8}
    >
      <View style={styles.content}>
        <View style={styles.statusIndicator} />
        <Text style={styles.statusText}>{getStatusText()}</Text>
        
        {showDetails && (
          <View style={styles.details}>
            <Text style={styles.detailText}>
              {syncStatus.pendingChanges > 0 && `${syncStatus.pendingChanges} pending`}
              {queueStatus.queueLength > 0 && ` • ${queueStatus.queueLength} queued`}
            </Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    marginHorizontal: 16,
    marginVertical: 8,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#fff',
    marginRight: 8,
  },
  statusText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  details: {
    marginLeft: 'auto',
  },
  detailText: {
    color: '#fff',
    fontSize: 12,
    opacity: 0.9,
  },
});
