import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Modal,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { MaterialIcons } from '@expo/vector-icons';
import { DatabaseService } from '../services/database';
import { UnifiedDataService, UnifiedDayData } from '../services/unifiedDataService';
import { ApiSyncService } from '../services/apiSyncService';
import { Employee } from '../types';
import { COST_CENTERS } from '../constants/costCenters';
import { useTips } from '../contexts/TipsContext';
import { TipCard } from '../components/TipCard';

interface DailyDescriptionScreenProps {
  navigation: any;
}

export default function DailyDescriptionScreen({ navigation }: DailyDescriptionScreenProps) {
  const { tips, loadTipsForScreen, dismissTip, markTipAsSeen, showTips, setCurrentEmployee: setTipsEmployee } = useTips();
  const [currentEmployee, setCurrentEmployee] = useState<Employee | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [daysWithData, setDaysWithData] = useState<UnifiedDayData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedDay, setSelectedDay] = useState<UnifiedDayData | null>(null);
  const [descriptionText, setDescriptionText] = useState<string>('');
  const [selectedCostCenter, setSelectedCostCenter] = useState<string>('');
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    loadData();
  }, [currentMonth]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Get current employee
      const employee = await DatabaseService.getCurrentEmployee();
      if (!employee) {
        console.error('❌ DailyDescriptionScreen: No current employee found');
        return;
      }
      setCurrentEmployee(employee);
      setTipsEmployee(employee);
      if (showTips) {
        await loadTipsForScreen('DailyDescriptionScreen', 'on_load');
      }
      
      // Get month data for all days
      const monthData = await UnifiedDataService.getMonthData(
        employee.id,
        currentMonth.getMonth() + 1,
        currentMonth.getFullYear()
      );
      
      // Show ALL days of the month
      setDaysWithData(monthData);
      
    } catch (error) {
      console.error('❌ DailyDescriptionScreen: Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSyncFromBackend = async () => {
    if (!currentEmployee) {
      Alert.alert('Error', 'No employee found');
      return;
    }

    try {
      setSyncing(true);
      console.log('🔄 DailyDescriptionScreen: Starting bi-directional sync...');
      
      // Step 1: First, get all local daily descriptions and sync them TO the backend
      console.log('📤 DailyDescriptionScreen: Syncing local data to backend...');
      const localDescriptions = await DatabaseService.getDailyDescriptions(currentEmployee.id);
      
      if (localDescriptions.length > 0) {
        const syncResult = await ApiSyncService.syncToBackend({
          dailyDescriptions: localDescriptions
        });
        if (!syncResult.success) {
          console.error('❌ DailyDescriptionScreen: Error syncing local descriptions:', syncResult.error);
        }
      }
      
      // Step 2: Then, pull any updates FROM the backend
      console.log('📥 DailyDescriptionScreen: Pulling updates from backend...');
      const result = await ApiSyncService.syncDailyDescriptionsFromBackend(currentEmployee.id);
      
      if (result.success) {
        console.log('✅ DailyDescriptionScreen: Bi-directional sync successful');
        Alert.alert('Success', 'Daily descriptions synced successfully! Your changes were saved and any updates from the web portal were loaded.');
        
        // Reload data to show the synced descriptions
        await loadData();
      } else {
        console.error('❌ DailyDescriptionScreen: Sync failed:', result.error);
        Alert.alert('Sync Failed', result.error || 'Failed to sync daily descriptions');
      }
    } catch (error) {
      console.error('❌ DailyDescriptionScreen: Error syncing:', error);
      Alert.alert('Error', 'Failed to sync daily descriptions. Please check your connection.');
    } finally {
      setSyncing(false);
    }
  };

  const handleEditDescription = (day: UnifiedDayData) => {
    setSelectedDay(day);
    
    // Initialize description text - get existing description from day data
    const existingDescription = day.description || '';
    setDescriptionText(existingDescription);
    
    // Initialize cost center - use existing or default
    const costCenter = day.costCenter || currentEmployee?.defaultCostCenter || currentEmployee?.selectedCostCenters?.[0] || '';
    setSelectedCostCenter(costCenter);
    
    setShowEditModal(true);
  };

  const handleSaveDescription = async () => {
    if (!selectedDay || !currentEmployee) return;

    try {
      console.log('💬 DailyDescriptionScreen: Saving description for date:', selectedDay.date.toISOString());
      console.log('💬 DailyDescriptionScreen: Description:', descriptionText);
      console.log('💬 DailyDescriptionScreen: Cost Center:', selectedCostCenter);
      
      // Save to database using UnifiedDataService
      await UnifiedDataService.updateDayDescription(
        currentEmployee.id,
        selectedDay.date,
        descriptionText.trim(),
        selectedCostCenter
      );
      
      setShowEditModal(false);
      setSelectedDay(null);
      setDescriptionText('');
      setSelectedCostCenter('');
      
      // Reload data to reflect changes
      await loadData();
      
      // Auto-sync to backend after saving
      try {
        console.log('📤 DailyDescriptionScreen: Auto-syncing to backend...');
        const savedDescription = await DatabaseService.getDailyDescriptionByDate(currentEmployee.id, selectedDay.date);
        if (savedDescription) {
          await ApiSyncService.syncToBackend({
            dailyDescriptions: [savedDescription]
          });
          console.log('✅ DailyDescriptionScreen: Auto-synced to backend');
        }
      } catch (error) {
        console.error('⚠️ DailyDescriptionScreen: Error auto-syncing to backend:', error);
        // Don't show error to user - it's saved locally
      }
      
      Alert.alert('Success', 'Daily description saved successfully');
      
    } catch (error) {
      console.error('❌ DailyDescriptionScreen: Error saving description:', error);
      Alert.alert('Error', 'Failed to save description');
    }
  };

  const formatDate = (date: Date) => {
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const year = date.getFullYear().toString().slice(-2);
    return `${month}/${day}/${year}`;
  };

  const getDayDescription = (day: UnifiedDayData) => {
    // For now, return placeholder text since we don't have description storage yet
    return day.description || 'Tap to add description';
  };

  const hasDescription = (day: UnifiedDayData) => {
    return day.description && day.description.trim().length > 0;
  };

  const getMonthRange = () => {
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    const monthName = monthNames[currentMonth.getMonth()];
    const year = currentMonth.getFullYear();
    return `${monthName} ${year}`;
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <StatusBar style="light" />
        
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <MaterialIcons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Daily Descriptions</Text>
          <View style={styles.placeholder} />
        </View>
        
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading calendar...</Text>
          <Text style={styles.loadingSubtext}>Please wait while we load the days</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <MaterialIcons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Daily Descriptions</Text>
        <TouchableOpacity 
          style={styles.syncButton} 
          onPress={handleSyncFromBackend}
          disabled={syncing}
        >
          <MaterialIcons 
            name={syncing ? "sync" : "sync"} 
            size={24} 
            color={syncing ? "#999" : "#2196F3"} 
          />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Summary */}
        <View style={styles.summaryContainer}>
          <Text style={styles.summaryText}>
            {daysWithData.filter(day => hasDescription(day)).length} days with descriptions • {getMonthRange()}
          </Text>
          <Text style={styles.summarySubtext}>
            Tap on any day to add or edit your daily description
          </Text>
        </View>

        {/* Days Grid */}
        {daysWithData.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialIcons name="description" size={48} color="#ccc" />
            <Text style={styles.emptyStateText}>No days available</Text>
            <Text style={styles.emptyStateSubtext}>Please check your calendar settings</Text>
          </View>
        ) : (
          <View style={styles.daysGrid}>
            {daysWithData.map((day) => (
              <TouchableOpacity
                key={day.date.toISOString()}
                style={[
                  styles.dayCard,
                  hasDescription(day) && styles.dayCardWithDescription
                ]}
                onPress={() => handleEditDescription(day)}
              >
                <Text style={styles.dayDate}>{formatDate(day.date)}</Text>
                <Text style={[
                  styles.dayDescription,
                  !hasDescription(day) && styles.dayDescriptionEmpty
                ]}>
                  {getDayDescription(day)}
                </Text>
                {hasDescription(day) && (
                  <MaterialIcons name="edit" size={16} color="#2196F3" style={styles.editIcon} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Edit Description Modal */}
      <Modal
        visible={showEditModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowEditModal(false)}
      >
        <View style={styles.modalContainer}>
          {/* Modal Header */}
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowEditModal(false)}>
              <MaterialIcons name="close" size={24} color="#666" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>
              {selectedDay ? formatDate(selectedDay.date) : 'Daily Description'}
            </Text>
            <TouchableOpacity onPress={handleSaveDescription}>
              <Text style={styles.saveButton}>Save</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
            {/* Tips Display */}
            {showTips && tips.length > 0 && (
              <View style={styles.tipsContainer}>
                <ScrollView 
                  style={styles.tipsScrollView} 
                  showsVerticalScrollIndicator={false}
                  nestedScrollEnabled={true}
                >
                  {tips.map((tip) => (
                    <TipCard
                      key={tip.id}
                      tip={tip}
                      onDismiss={dismissTip}
                      onMarkSeen={markTipAsSeen}
                    />
                  ))}
                </ScrollView>
              </View>
            )}

            {/* Description Input */}
            <View style={styles.descriptionSection}>
              <Text style={styles.descriptionLabel}>What did you do today?</Text>
              <TextInput
                style={styles.descriptionInput}
                value={descriptionText}
                onChangeText={setDescriptionText}
                placeholder="Describe your activities for this day..."
                placeholderTextColor="#999"
                multiline
                numberOfLines={8}
                textAlignVertical="top"
              />
            </View>

            {/* Cost Center Selector - only show if user has multiple cost centers */}
            {currentEmployee && currentEmployee.selectedCostCenters && currentEmployee.selectedCostCenters.length > 1 && (
              <View style={styles.costCenterSection}>
                <Text style={styles.costCenterLabel}>Cost Center</Text>
                <View style={styles.costCenterSelector}>
                  {currentEmployee.selectedCostCenters.map((costCenter) => (
                    <TouchableOpacity
                      key={costCenter}
                      style={[
                        styles.costCenterOption,
                        selectedCostCenter === costCenter && styles.costCenterOptionSelected
                      ]}
                      onPress={() => setSelectedCostCenter(costCenter)}
                    >
                      <Text style={[
                        styles.costCenterOptionText,
                        selectedCostCenter === costCenter && styles.costCenterOptionTextSelected
                      ]}>
                        {costCenter}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#2196F3',
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  placeholder: {
    width: 24,
  },
  syncButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  loadingSubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  summaryContainer: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  summaryText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  summarySubtext: {
    fontSize: 14,
    color: '#666',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
  daysGrid: {
    flexDirection: 'column',
    gap: 12,
  },
  dayCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    width: '100%',
    minHeight: 100,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  dayCardWithDescription: {
    borderColor: '#2196F3',
    borderWidth: 2,
  },
  dayDate: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  dayDescription: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
    flex: 1,
  },
  dayDescriptionEmpty: {
    color: '#999',
    fontStyle: 'italic',
  },
  editIcon: {
    position: 'absolute',
    top: 12,
    right: 12,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  modalHeader: {
    backgroundColor: '#fff',
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  saveButton: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2196F3',
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  tipsContainer: {
    marginTop: 8,
    marginBottom: 16,
    borderRadius: 12,
    backgroundColor: '#f8f9fa',
  },
  tipsScrollView: {
    maxHeight: 180,
  },
  descriptionSection: {
    marginBottom: 20,
  },
  descriptionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  descriptionInput: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#333',
    minHeight: 120,
    textAlignVertical: 'top',
  },
  costCenterSection: {
    marginBottom: 20,
  },
  costCenterLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  costCenterSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  costCenterOption: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    backgroundColor: '#fff',
  },
  costCenterOptionSelected: {
    backgroundColor: '#2196F3',
    borderColor: '#2196F3',
  },
  costCenterOptionText: {
    fontSize: 14,
    color: '#333',
  },
  costCenterOptionTextSelected: {
    color: '#fff',
    fontWeight: '600',
  },
});
