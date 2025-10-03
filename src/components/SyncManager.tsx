import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { DatabaseService } from '../services/database';
import { ApiSyncService, SyncStatus } from '../services/apiSyncService';

interface SyncManagerProps {
  employeeId?: string;
  onSyncComplete?: (success: boolean) => void;
}

export const SyncManager: React.FC<SyncManagerProps> = ({ 
  employeeId, 
  onSyncComplete 
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
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncResult, setLastSyncResult] = useState<string>('');

  useEffect(() => {
    initializeSync();
    loadSyncStatus();
  }, []);

  const initializeSync = async () => {
    try {
      await ApiSyncService.initialize();
      console.log('✅ SyncManager: API sync service initialized');
    } catch (error) {
      console.error('❌ SyncManager: Failed to initialize sync service:', error);
    }
  };

  const loadSyncStatus = async () => {
    try {
      const status = await ApiSyncService.getSyncStatus();
      setSyncStatus(status);
    } catch (error) {
      console.error('❌ SyncManager: Error loading sync status:', error);
    }
  };

  const handleSyncToBackend = async () => {
    setIsSyncing(true);
    setLastSyncResult('');

    try {
      console.log('📤 SyncManager: Starting sync to backend...');
      
      // Get all data from mobile database
      const employees = await DatabaseService.getEmployees();
      const mileageEntries = await DatabaseService.getMileageEntries(employeeId);
      const receipts = await DatabaseService.getReceipts(employeeId);
      const timeTracking = await DatabaseService.getTimeTrackingEntries(employeeId);

      // Sync to backend
      const result = await ApiSyncService.syncToBackend({
        employees,
        mileageEntries,
        receipts,
        timeTracking
      });

      if (result.success) {
        setLastSyncResult('✅ Sync to backend completed successfully');
        Alert.alert('Sync Complete', 'Data has been successfully synced to the backend.');
        await loadSyncStatus(); // Refresh status
        onSyncComplete?.(true);
      } else {
        setLastSyncResult(`❌ Sync failed: ${result.error}`);
        Alert.alert('Sync Failed', result.error || 'Unknown error occurred during sync.');
        onSyncComplete?.(false);
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setLastSyncResult(`❌ Sync error: ${errorMessage}`);
      console.error('❌ SyncManager: Sync to backend failed:', error);
      Alert.alert('Sync Error', errorMessage);
      onSyncComplete?.(false);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSyncFromBackend = async () => {
    setIsSyncing(true);
    setLastSyncResult('');

    try {
      console.log('📥 SyncManager: Starting sync from backend...');
      
      // Sync from backend
      const result = await ApiSyncService.syncFromBackend(employeeId);

      if (result.success) {
        setLastSyncResult('✅ Sync from backend completed successfully');
        Alert.alert('Sync Complete', 'Data has been successfully synced from the backend.');
        await loadSyncStatus(); // Refresh status
        onSyncComplete?.(true);
      } else {
        setLastSyncResult(`❌ Sync failed: ${result.error}`);
        Alert.alert('Sync Failed', result.error || 'Unknown error occurred during sync.');
        onSyncComplete?.(false);
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setLastSyncResult(`❌ Sync error: ${errorMessage}`);
      console.error('❌ SyncManager: Sync from backend failed:', error);
      Alert.alert('Sync Error', errorMessage);
      onSyncComplete?.(false);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleTestConnection = async () => {
    try {
      const isConnected = await ApiSyncService.testConnection();
      Alert.alert(
        'Connection Test', 
        isConnected 
          ? '✅ Successfully connected to backend API' 
          : '❌ Failed to connect to backend API'
      );
      await loadSyncStatus(); // Refresh status
    } catch (error) {
      Alert.alert('Connection Test Failed', 'Unable to test connection to backend.');
    }
  };

  const formatLastSyncTime = (time: Date | null): string => {
    if (!time) return 'Never';
    return time.toLocaleString();
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Data Sync Manager</Text>
        <Text style={styles.subtitle}>
          {employeeId ? `Employee: ${employeeId}` : 'All Employees'}
        </Text>
      </View>

      {/* Connection Status */}
      <View style={styles.statusCard}>
        <Text style={styles.cardTitle}>Connection Status</Text>
        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>Backend API:</Text>
          <View style={[
            styles.statusIndicator, 
            { backgroundColor: syncStatus.isConnected ? '#4CAF50' : '#F44336' }
          ]} />
          <Text style={[
            styles.statusText,
            { color: syncStatus.isConnected ? '#4CAF50' : '#F44336' }
          ]}>
            {syncStatus.isConnected ? 'Connected' : 'Disconnected'}
          </Text>
        </View>
        
        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>Last Sync:</Text>
          <Text style={styles.statusText}>
            {formatLastSyncTime(syncStatus.lastSyncTime)}
          </Text>
        </View>

        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>Pending Changes:</Text>
          <Text style={[
            styles.statusText,
            { color: syncStatus.pendingChanges > 0 ? '#FF9800' : '#4CAF50' }
          ]}>
            {syncStatus.pendingChanges}
          </Text>
        </View>
      </View>

      {/* Data Statistics */}
      <View style={styles.statusCard}>
        <Text style={styles.cardTitle}>Data Statistics</Text>
        <View style={styles.statsGrid}>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{syncStatus.totalEmployees}</Text>
            <Text style={styles.statLabel}>Employees</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{syncStatus.totalMileageEntries}</Text>
            <Text style={styles.statLabel}>Mileage Entries</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{syncStatus.totalReceipts}</Text>
            <Text style={styles.statLabel}>Receipts</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{syncStatus.totalTimeTracking}</Text>
            <Text style={styles.statLabel}>Time Entries</Text>
          </View>
        </View>
      </View>

      {/* Sync Actions */}
      <View style={styles.actionsCard}>
        <Text style={styles.cardTitle}>Sync Actions</Text>
        
        <TouchableOpacity 
          style={[styles.actionButton, styles.testButton]}
          onPress={handleTestConnection}
          disabled={isSyncing}
        >
          <Text style={styles.actionButtonText}>Test Connection</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.actionButton, styles.syncToButton]}
          onPress={handleSyncToBackend}
          disabled={isSyncing}
        >
          {isSyncing ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.actionButtonText}>Sync to Backend</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.actionButton, styles.syncFromButton]}
          onPress={handleSyncFromBackend}
          disabled={isSyncing}
        >
          {isSyncing ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.actionButtonText}>Sync from Backend</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Last Sync Result */}
      {lastSyncResult && (
        <View style={styles.resultCard}>
          <Text style={styles.cardTitle}>Last Sync Result</Text>
          <Text style={styles.resultText}>{lastSyncResult}</Text>
        </View>
      )}

      {/* Instructions */}
      <View style={styles.instructionsCard}>
        <Text style={styles.cardTitle}>Instructions</Text>
        <Text style={styles.instructionText}>
          • <Text style={styles.bold}>Test Connection:</Text> Check if the backend API is accessible
        </Text>
        <Text style={styles.instructionText}>
          • <Text style={styles.bold}>Sync to Backend:</Text> Upload your mobile data to the web portal
        </Text>
        <Text style={styles.instructionText}>
          • <Text style={styles.bold}>Sync from Backend:</Text> Download data from the web portal to your mobile app
        </Text>
        <Text style={styles.instructionText}>
          • Ensure both mobile app and web portal are connected to the same network
        </Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 16,
  },
  header: {
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
  },
  statusCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusLabel: {
    fontSize: 14,
    color: '#666',
    width: 120,
  },
  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  statusText: {
    fontSize: 14,
    color: '#333',
    flex: 1,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statItem: {
    width: '48%',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    marginBottom: 8,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1976d2',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  actionsCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  actionButton: {
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12,
  },
  testButton: {
    backgroundColor: '#2196F3',
  },
  syncToButton: {
    backgroundColor: '#4CAF50',
  },
  syncFromButton: {
    backgroundColor: '#FF9800',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  resultCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  resultText: {
    fontSize: 14,
    color: '#333',
    fontFamily: 'monospace',
  },
  instructionsCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  instructionText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
    lineHeight: 20,
  },
  bold: {
    fontWeight: 'bold',
    color: '#333',
  },
});
