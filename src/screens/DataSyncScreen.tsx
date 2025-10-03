import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Share,
  Platform,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { MaterialIcons } from '@expo/vector-icons';
import { DataSyncService } from '../services/dataSyncService';
import { RealtimeSyncService } from '../services/realtimeSyncService';
import { SyncIntegrationService } from '../services/syncIntegrationService';
import { ApiSyncService } from '../services/apiSyncService';
import { DatabaseService } from '../services/database';
import UnifiedHeader from '../components/UnifiedHeader';

interface DataSyncScreenProps {
  navigation: any;
}

export default function DataSyncScreen({ navigation }: DataSyncScreenProps) {
  const [loading, setLoading] = useState(false);
  const [syncStatus, setSyncStatus] = useState<{
    lastSyncTime: Date | null;
    totalEntries: number;
    totalReceipts: number;
    totalEmployees: number;
  } | null>(null);
  const [realtimeStatus, setRealtimeStatus] = useState<{
    isConnected: boolean;
    lastSyncTime: Date;
    totalEmployees: number;
    totalEntries: number;
    totalReceipts: number;
  } | null>(null);
  const [syncQueueStatus, setSyncQueueStatus] = useState<{
    queueLength: number;
    isProcessing: boolean;
    autoSyncEnabled: boolean;
    nextSyncIn: number;
  } | null>(null);

  useEffect(() => {
    loadSyncStatus();
    loadRealtimeStatus();
    loadSyncQueueStatus();
    
    // Set up interval to refresh sync status
    const interval = setInterval(() => {
      loadSyncStatus();
      loadRealtimeStatus();
      loadSyncQueueStatus();
    }, 5000); // Refresh every 5 seconds
    
    return () => clearInterval(interval);
  }, []);

  const loadSyncStatus = async () => {
    try {
      const status = await DataSyncService.getSyncStatus();
      setSyncStatus(status);
    } catch (error) {
      console.error('Error loading sync status:', error);
    }
  };

  const loadRealtimeStatus = () => {
    try {
      const status = RealtimeSyncService.getSyncStatus();
      setRealtimeStatus(status);
    } catch (error) {
      console.error('Error loading real-time status:', error);
    }
  };

  const loadSyncQueueStatus = () => {
    try {
      const status = SyncIntegrationService.getSyncQueueStatus();
      setSyncQueueStatus(status);
    } catch (error) {
      console.error('Error loading sync queue status:', error);
    }
  };

  const handleExportData = async () => {
    try {
      setLoading(true);
      
      const jsonData = await DataSyncService.generateDataFile();
      
      // Share the data file
      if (Platform.OS === 'ios' || Platform.OS === 'android') {
        await Share.share({
          message: jsonData,
          title: 'Oxford Mileage Tracker Data Export',
        });
      } else {
        // For web, copy to clipboard
        if (navigator.clipboard) {
          await navigator.clipboard.writeText(jsonData);
          Alert.alert('Data Copied', 'Data has been copied to clipboard. Paste it into a text file and save as .json');
        } else {
          Alert.alert('Data Exported', 'Data has been prepared for sharing. Use the share button to send it.');
        }
      }
      
      Alert.alert('Success', 'Data exported successfully! Share this file with the web portal administrator.');
    } catch (error) {
      console.error('Error exporting data:', error);
      Alert.alert('Error', 'Failed to export data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleImportData = () => {
    Alert.alert(
      'Import Data',
      'To import data from the web portal:\n\n1. Get the data file from the web portal administrator\n2. Use the "Import Data" button below\n3. Select the data file to import',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Import Data', onPress: () => {
          // TODO: Implement file picker for data import
          Alert.alert('Coming Soon', 'Data import functionality will be available soon.');
        }}
      ]
    );
  };

  const handleManualSync = async () => {
    try {
      setLoading(true);
      
      // API sync is disabled - use export/import workflow instead
      Alert.alert(
        'Manual Sync Not Available',
        'API sync is currently disabled. Please use the export/import workflow:\n\n1. Tap "Export Data" to create a file\n2. Import the file in the web portal\n3. This ensures all your data is synced properly',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Export Data Instead', onPress: handleExportData }
        ]
      );
      return;
    } catch (error) {
      console.error('Error during manual sync:', error);
      Alert.alert('Sync Error', 'An error occurred during sync. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleForceSync = async () => {
    try {
      setLoading(true);
      
      const success = await SyncIntegrationService.forceSync();
      
      if (success) {
        Alert.alert('Force Sync Successful', 'All pending changes have been synced to the web portal!');
        // Refresh status
        loadSyncStatus();
        loadRealtimeStatus();
        loadSyncQueueStatus();
      } else {
        Alert.alert('Force Sync Failed', 'Failed to sync pending changes. Please try again.');
      }
      
    } catch (error) {
      console.error('Error during force sync:', error);
      Alert.alert('Force Sync Error', 'An error occurred during force sync. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleAutoSync = () => {
    const isCurrentlyEnabled = syncQueueStatus?.autoSyncEnabled || false;
    SyncIntegrationService.setAutoSyncEnabled(!isCurrentlyEnabled);
    
    // Refresh status to show the change
    loadSyncQueueStatus();
    
    Alert.alert(
      'Auto Sync Toggled', 
      `Auto sync has been ${!isCurrentlyEnabled ? 'enabled' : 'disabled'}. ${!isCurrentlyEnabled ? 'Your data will now sync automatically every 30 seconds.' : 'You can still sync manually using the buttons above.'}`
    );
  };

  const formatLastSyncTime = (date: Date | null): string => {
    if (!date) return 'Never';
    
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffDays > 0) {
      return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    } else if (diffHours > 0) {
      return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    } else {
      return 'Just now';
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <UnifiedHeader
        title="Data Sync"
        onBackPress={() => navigation.goBack()}
        showBackButton={true}
      />
      
      <ScrollView style={styles.content}>
        {/* Real-time Sync Status */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Real-time Sync Status</Text>
          <View style={styles.statusCard}>
            <View style={styles.statusRow}>
              <MaterialIcons 
                name={realtimeStatus?.isConnected ? "wifi" : "wifi-off"} 
                size={20} 
                color={realtimeStatus?.isConnected ? "#4CAF50" : "#F44336"} 
              />
              <Text style={styles.statusLabel}>Connection:</Text>
              <Text style={[styles.statusValue, { color: realtimeStatus?.isConnected ? "#4CAF50" : "#F44336" }]}>
                {realtimeStatus?.isConnected ? "Connected" : "Disconnected"}
              </Text>
            </View>
            
            <View style={styles.statusRow}>
              <MaterialIcons name="schedule" size={20} color="#666" />
              <Text style={styles.statusLabel}>Last Sync:</Text>
              <Text style={styles.statusValue}>
                {formatLastSyncTime(realtimeStatus?.lastSyncTime || null)}
              </Text>
            </View>
            
            <View style={styles.statusRow}>
              <MaterialIcons name="people" size={20} color="#666" />
              <Text style={styles.statusLabel}>Employees:</Text>
              <Text style={styles.statusValue}>{realtimeStatus?.totalEmployees || 0}</Text>
            </View>
            
            <View style={styles.statusRow}>
              <MaterialIcons name="speed" size={20} color="#666" />
              <Text style={styles.statusLabel}>Mileage Entries:</Text>
              <Text style={styles.statusValue}>{realtimeStatus?.totalEntries || 0}</Text>
            </View>
            
            <View style={styles.statusRow}>
              <MaterialIcons name="receipt" size={20} color="#666" />
              <Text style={styles.statusLabel}>Receipts:</Text>
              <Text style={styles.statusValue}>{realtimeStatus?.totalReceipts || 0}</Text>
            </View>
          </View>
        </View>

        {/* Sync Queue Status */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Sync Queue Status</Text>
          <View style={styles.statusCard}>
            <View style={styles.statusRow}>
              <MaterialIcons 
                name={syncQueueStatus?.isProcessing ? "sync" : "sync-disabled"} 
                size={20} 
                color={syncQueueStatus?.isProcessing ? "#FF9800" : "#666"} 
              />
              <Text style={styles.statusLabel}>Status:</Text>
              <Text style={[styles.statusValue, { color: syncQueueStatus?.isProcessing ? "#FF9800" : "#666" }]}>
                {syncQueueStatus?.isProcessing ? "Processing" : "Idle"}
              </Text>
            </View>
            
            <View style={styles.statusRow}>
              <MaterialIcons name="queue" size={20} color="#666" />
              <Text style={styles.statusLabel}>Pending Items:</Text>
              <Text style={styles.statusValue}>{syncQueueStatus?.queueLength || 0}</Text>
            </View>
            
            <TouchableOpacity 
              style={styles.statusRow}
              onPress={handleToggleAutoSync}
            >
              <MaterialIcons 
                name={syncQueueStatus?.autoSyncEnabled ? "autorenew" : "pause"} 
                size={20} 
                color={syncQueueStatus?.autoSyncEnabled ? "#4CAF50" : "#666"} 
              />
              <Text style={styles.statusLabel}>Auto Sync:</Text>
              <Text style={[styles.statusValue, { color: syncQueueStatus?.autoSyncEnabled ? "#4CAF50" : "#666" }]}>
                {syncQueueStatus?.autoSyncEnabled ? "Enabled" : "Disabled"}
              </Text>
              <MaterialIcons name="touch-app" size={16} color="#999" style={{ marginLeft: 8 }} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Manual Sync Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Manual Sync Actions</Text>
          <Text style={styles.sectionDescription}>
            Use these buttons to manually sync your data with the web portal.
          </Text>
          
          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.actionButton, styles.halfWidth, loading && styles.disabledButton]}
              onPress={handleManualSync}
              disabled={loading}
            >
              <MaterialIcons name="sync" size={24} color="#fff" />
              <Text style={styles.actionButtonText}>
                {loading ? 'Syncing...' : 'Sync All Data'}
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.actionButton, styles.halfWidth, loading && styles.disabledButton]}
              onPress={handleForceSync}
              disabled={loading}
            >
              <MaterialIcons name="sync-problem" size={24} color="#fff" />
              <Text style={styles.actionButtonText}>
                {loading ? 'Syncing...' : 'Force Sync'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Export Data */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Export Data</Text>
          <Text style={styles.sectionDescription}>
            Export all your mileage entries, receipts, and employee data to share with the web portal.
          </Text>
          
          <TouchableOpacity
            style={[styles.actionButton, loading && styles.disabledButton]}
            onPress={handleExportData}
            disabled={loading}
          >
            <MaterialIcons name="file-download" size={24} color="#fff" />
            <Text style={styles.actionButtonText}>
              {loading ? 'Exporting...' : 'Export Data'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Import Data */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Import Data</Text>
          <Text style={styles.sectionDescription}>
            Import data from the web portal to sync changes made by administrators.
          </Text>
          
          <TouchableOpacity
            style={styles.actionButton}
            onPress={handleImportData}
          >
            <MaterialIcons name="file-upload" size={24} color="#fff" />
            <Text style={styles.actionButtonText}>Import Data</Text>
          </TouchableOpacity>
        </View>

        {/* Instructions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Real-time Sync</Text>
          <View style={styles.instructionsCard}>
            <View style={styles.instructionStep}>
              <Text style={styles.stepNumber}>1</Text>
              <Text style={styles.stepText}>
                Your data automatically syncs with the web portal in real-time
              </Text>
            </View>
            
            <View style={styles.instructionStep}>
              <Text style={styles.stepNumber}>2</Text>
              <Text style={styles.stepText}>
                When you create mileage entries, receipts, or update employee info, it's instantly available in the web portal
              </Text>
            </View>
            
            <View style={styles.instructionStep}>
              <Text style={styles.stepNumber}>3</Text>
              <Text style={styles.stepText}>
                Administrators can view and manage your data immediately without manual file transfers
              </Text>
            </View>
            
            <View style={styles.instructionStep}>
              <Text style={styles.stepNumber}>4</Text>
              <Text style={styles.stepText}>
                The connection status above shows if your data is syncing properly
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  section: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  sectionDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 15,
    lineHeight: 20,
  },
  statusCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  statusLabel: {
    fontSize: 14,
    color: '#666',
    marginLeft: 10,
    flex: 1,
  },
  statusValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  actionButton: {
    backgroundColor: '#2196F3',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  disabledButton: {
    backgroundColor: '#ccc',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 10,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  halfWidth: {
    flex: 1,
  },
  instructionsCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  instructionStep: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 15,
  },
  stepNumber: {
    backgroundColor: '#2196F3',
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
    width: 24,
    height: 24,
    borderRadius: 12,
    textAlign: 'center',
    lineHeight: 24,
    marginRight: 10,
  },
  stepText: {
    fontSize: 14,
    color: '#666',
    flex: 1,
    lineHeight: 20,
  },
});
