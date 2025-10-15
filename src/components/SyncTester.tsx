import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { ApiSyncService, SyncStatus } from '../services/apiSyncService';
import { SyncIntegrationService } from '../services/syncIntegrationService';
import { DatabaseService } from '../services/database';

export const SyncTester: React.FC = () => {
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [testResults, setTestResults] = useState<string[]>([]);

  useEffect(() => {
    loadSyncStatus();
  }, []);

  const loadSyncStatus = async () => {
    try {
      const status = await ApiSyncService.getSyncStatus();
      setSyncStatus(status);
    } catch (error) {
      console.error('Error loading sync status:', error);
    }
  };

  const addTestResult = (result: string) => {
    setTestResults(prev => [...prev, `${new Date().toLocaleTimeString()}: ${result}`]);
  };

  const testConnection = async () => {
    setIsLoading(true);
    addTestResult('Testing connection to backend...');
    
    try {
      const isConnected = await ApiSyncService.testConnection();
      if (isConnected) {
        addTestResult('✅ Connection test PASSED - Backend is accessible');
        Alert.alert('Connection Test', '✅ Successfully connected to backend API');
      } else {
        addTestResult('❌ Connection test FAILED - Backend not accessible');
        Alert.alert('Connection Test', '❌ Failed to connect to backend API');
      }
    } catch (error) {
      addTestResult(`❌ Connection test ERROR: ${error}`);
      Alert.alert('Connection Test Failed', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setIsLoading(false);
      loadSyncStatus();
    }
  };

  const testCreateEmployee = async () => {
    setIsLoading(true);
    addTestResult('Creating test employee...');
    
    try {
      const testEmployee = {
        name: `Test Employee ${Date.now()}`,
        email: `test${Date.now()}@example.com`,
        password: 'test123',
        oxfordHouseId: 'test-house',
        position: 'Test Position',
        phoneNumber: '555-0123',
        baseAddress: '123 Test St, Test City, TC 12345',
        costCenters: ['TEST-CC'],
        selectedCostCenters: ['TEST-CC']
      };

      const employee = await DatabaseService.createEmployee(testEmployee);
      addTestResult(`✅ Test employee created: ${employee.name} (ID: ${employee.id})`);
      
      // Queue should automatically sync this
      setTimeout(() => {
        addTestResult('🔄 Employee should be synced to backend automatically');
        loadSyncStatus();
      }, 2000);
      
    } catch (error) {
      addTestResult(`❌ Employee creation ERROR: ${error}`);
      Alert.alert('Test Failed', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };

  const testCreateMileageEntry = async () => {
    setIsLoading(true);
    addTestResult('Creating test mileage entry...');
    
    try {
      // Get first employee for testing
      const employees = await DatabaseService.getEmployees();
      if (employees.length === 0) {
        addTestResult('❌ No employees found - create an employee first');
        Alert.alert('Test Failed', 'No employees found. Create an employee first.');
        return;
      }

      const testEntry = {
        employeeId: employees[0].id,
        oxfordHouseId: employees[0].oxfordHouseId,
        costCenter: 'Administrative',
        date: new Date(),
        odometerReading: 50000,
        startLocation: 'Test Start Location',
        endLocation: 'Test End Location',
        purpose: 'Test Purpose',
        miles: 25.5,
        notes: 'Test mileage entry',
        hoursWorked: 2.5,
        isGpsTracked: false
      };

      const entry = await DatabaseService.createMileageEntry(testEntry);
      addTestResult(`✅ Test mileage entry created: ${entry.purpose} (${entry.miles} miles)`);
      
      // Queue should automatically sync this
      setTimeout(() => {
        addTestResult('🔄 Mileage entry should be synced to backend automatically');
        loadSyncStatus();
      }, 2000);
      
    } catch (error) {
      addTestResult(`❌ Mileage entry creation ERROR: ${error}`);
      Alert.alert('Test Failed', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };

  const testSyncToBackend = async () => {
    setIsLoading(true);
    addTestResult('Testing manual sync to backend...');
    
    try {
      const employees = await DatabaseService.getEmployees();
      const mileageEntries = await DatabaseService.getMileageEntries();
      const receipts = await DatabaseService.getReceipts();
      const timeTracking = await DatabaseService.getAllTimeTrackingEntries();

      const result = await ApiSyncService.syncToBackend({
        employees,
        mileageEntries,
        receipts,
        timeTracking
      });

      if (result.success) {
        addTestResult(`✅ Manual sync to backend SUCCESS`);
        addTestResult(`   Synced: ${employees.length} employees, ${mileageEntries.length} mileage entries, ${receipts.length} receipts, ${timeTracking.length} time entries`);
        Alert.alert('Sync Success', 'Data successfully synced to backend');
      } else {
        addTestResult(`❌ Manual sync to backend FAILED: ${result.error}`);
        Alert.alert('Sync Failed', result.error || 'Unknown error');
      }
    } catch (error) {
      addTestResult(`❌ Manual sync ERROR: ${error}`);
      Alert.alert('Sync Error', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setIsLoading(false);
      loadSyncStatus();
    }
  };

  const testSyncFromBackend = async () => {
    setIsLoading(true);
    addTestResult('Testing sync from backend...');
    
    try {
      const result = await ApiSyncService.syncFromBackend();

      if (result.success) {
        addTestResult(`✅ Sync from backend SUCCESS`);
        addTestResult(`   Downloaded data from backend`);
        Alert.alert('Sync Success', 'Data successfully synced from backend');
      } else {
        addTestResult(`❌ Sync from backend FAILED: ${result.error}`);
        Alert.alert('Sync Failed', result.error || 'Unknown error');
      }
    } catch (error) {
      addTestResult(`❌ Sync from backend ERROR: ${error}`);
      Alert.alert('Sync Error', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setIsLoading(false);
      loadSyncStatus();
    }
  };

  const testQueueStatus = () => {
    const queueStatus = SyncIntegrationService.getSyncQueueStatus();
    addTestResult(`📊 Queue Status:`);
    addTestResult(`   Queue Length: ${queueStatus.queueLength}`);
    addTestResult(`   Processing: ${queueStatus.isProcessing}`);
    addTestResult(`   Auto Sync: ${queueStatus.autoSyncEnabled}`);
    addTestResult(`   Next Sync In: ${queueStatus.nextSyncIn}ms`);
  };

  const clearTestResults = () => {
    setTestResults([]);
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Sync Functionality Tester</Text>
        <Text style={styles.subtitle}>Test mobile app data sync with backend</Text>
      </View>

      {/* Sync Status */}
      {syncStatus && (
        <View style={styles.statusCard}>
          <Text style={styles.cardTitle}>Current Sync Status</Text>
          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>Connection:</Text>
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
              {syncStatus.lastSyncTime ? syncStatus.lastSyncTime.toLocaleString() : 'Never'}
            </Text>
          </View>
          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>Pending Changes:</Text>
            <Text style={styles.statusText}>{syncStatus.pendingChanges}</Text>
          </View>
        </View>
      )}

      {/* Test Buttons */}
      <View style={styles.testCard}>
        <Text style={styles.cardTitle}>Test Operations</Text>
        
        <TouchableOpacity 
          style={[styles.testButton, styles.connectionButton]}
          onPress={testConnection}
          disabled={isLoading}
        >
          <Text style={styles.testButtonText}>Test Connection</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.testButton, styles.createButton]}
          onPress={testCreateEmployee}
          disabled={isLoading}
        >
          <Text style={styles.testButtonText}>Create Test Employee</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.testButton, styles.createButton]}
          onPress={testCreateMileageEntry}
          disabled={isLoading}
        >
          <Text style={styles.testButtonText}>Create Test Mileage Entry</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.testButton, styles.syncButton]}
          onPress={testSyncToBackend}
          disabled={isLoading}
        >
          <Text style={styles.testButtonText}>Sync to Backend</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.testButton, styles.syncButton]}
          onPress={testSyncFromBackend}
          disabled={isLoading}
        >
          <Text style={styles.testButtonText}>Sync from Backend</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.testButton, styles.infoButton]}
          onPress={testQueueStatus}
          disabled={isLoading}
        >
          <Text style={styles.testButtonText}>Check Queue Status</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.testButton, styles.clearButton]}
          onPress={clearTestResults}
        >
          <Text style={styles.testButtonText}>Clear Results</Text>
        </TouchableOpacity>
      </View>

      {/* Test Results */}
      <View style={styles.resultsCard}>
        <Text style={styles.cardTitle}>Test Results</Text>
        {isLoading && <ActivityIndicator size="small" color="#1976d2" />}
        <ScrollView style={styles.resultsContainer}>
          {testResults.map((result, index) => (
            <Text key={index} style={styles.resultText}>{result}</Text>
          ))}
        </ScrollView>
      </View>

      {/* Instructions */}
      <View style={styles.instructionsCard}>
        <Text style={styles.cardTitle}>Testing Instructions</Text>
        <Text style={styles.instructionText}>
          1. <Text style={styles.bold}>Test Connection</Text> - Verify backend connectivity
        </Text>
        <Text style={styles.instructionText}>
          2. <Text style={styles.bold}>Create Test Data</Text> - Add sample employees/entries
        </Text>
        <Text style={styles.instructionText}>
          3. <Text style={styles.bold}>Sync to Backend</Text> - Upload mobile data
        </Text>
        <Text style={styles.instructionText}>
          4. <Text style={styles.bold}>Check Web Portal</Text> - Verify data appears
        </Text>
        <Text style={styles.instructionText}>
          5. <Text style={styles.bold}>Sync from Backend</Text> - Download web data
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
    marginBottom: 8,
  },
  statusLabel: {
    fontSize: 14,
    color: '#666',
    width: 120,
  },
  statusText: {
    fontSize: 14,
    color: '#333',
    flex: 1,
  },
  testCard: {
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
  testButton: {
    padding: 12,
    borderRadius: 6,
    alignItems: 'center',
    marginBottom: 8,
  },
  connectionButton: {
    backgroundColor: '#2196F3',
  },
  createButton: {
    backgroundColor: '#4CAF50',
  },
  syncButton: {
    backgroundColor: '#FF9800',
  },
  infoButton: {
    backgroundColor: '#9C27B0',
  },
  clearButton: {
    backgroundColor: '#F44336',
  },
  testButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  resultsCard: {
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
  resultsContainer: {
    maxHeight: 200,
  },
  resultText: {
    fontSize: 12,
    color: '#333',
    marginBottom: 4,
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
