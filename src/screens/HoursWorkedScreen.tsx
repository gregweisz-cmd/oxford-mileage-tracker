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
  Keyboard,
  TouchableWithoutFeedback,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { MaterialIcons } from '@expo/vector-icons';
import { DatabaseService } from '../services/database';
import { UnifiedDataService, UnifiedDayData } from '../services/unifiedDataService';
import { Employee } from '../types';

interface HoursWorkedScreenProps {
  navigation: any;
}

const CATEGORY_HOURS_LABELS = [
  'G&A Hours',
  'Holiday Hours',
  'PTO Hours',
  'STD/LTD Hours',
  'PFL/PFML Hours'
] as const;

export default function HoursWorkedScreen({ navigation }: HoursWorkedScreenProps) {
  const [currentEmployee, setCurrentEmployee] = useState<Employee | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [daysWithHours, setDaysWithHours] = useState<UnifiedDayData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedDay, setSelectedDay] = useState<UnifiedDayData | null>(null);
  /** Keys: 'cc:Cost Center Name' for cost center hours, or category name for G&A, PTO, etc. */
  const [timeTrackingInputs, setTimeTrackingInputs] = useState<{[key: string]: number}>({});

  useEffect(() => {
    loadData();
  }, [currentMonth]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Wait a bit for database to be ready
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Get current employee
      const employee = await DatabaseService.getCurrentEmployee();
      
      if (!employee) {
        console.error('❌ HoursWorkedScreen: No current employee found');
        setLoading(false);
        return;
      }
      
      setCurrentEmployee(employee);
      
      // Use unified data service to get month data
      console.log('🕒 HoursWorkedScreen: Loading unified data for month:', currentMonth.getMonth() + 1, 'year:', currentMonth.getFullYear());
      const monthData = await UnifiedDataService.getMonthData(
        employee.id,
        currentMonth.getMonth() + 1,
        currentMonth.getFullYear()
      );
      
      // Show ALL days of the month (not just days with existing hours)
      // This allows users to enter hours for any day
      setDaysWithHours(monthData);
      
    } catch (error) {
      console.error('❌ HoursWorkedScreen: Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };


  const handleEditHours = (day: UnifiedDayData) => {
    setSelectedDay(day);
    const costCenters = currentEmployee?.selectedCostCenters || currentEmployee?.costCenters || [];
    const inputs: {[key: string]: number} = {};
    costCenters.forEach(cc => {
      inputs[`cc:${cc}`] = day.costCenterHours?.[cc] ?? 0;
    });
    CATEGORY_HOURS_LABELS.forEach(category => {
      const key = category === 'G&A Hours' ? 'gahours' : category === 'Holiday Hours' ? 'holidayHours' : category === 'PTO Hours' ? 'ptoHours' : category === 'STD/LTD Hours' ? 'stdLtdHours' : 'pflPfmlHours';
      inputs[category] = day.hoursBreakdown[key] || 0;
    });
    setTimeTrackingInputs(inputs);
    setShowEditModal(true);
  };

  const handleSaveHours = async () => {
    if (!selectedDay || !currentEmployee) return;
    const costCenters = currentEmployee.selectedCostCenters || currentEmployee.costCenters || [];
    const costCenterHours: Record<string, number> = {};
    costCenters.forEach(cc => {
      const h = timeTrackingInputs[`cc:${cc}`];
      if (h != null && h > 0) costCenterHours[cc] = h;
    });
    const hoursBreakdown = {
      gahours: timeTrackingInputs['G&A Hours'] ?? 0,
      holidayHours: timeTrackingInputs['Holiday Hours'] ?? 0,
      ptoHours: timeTrackingInputs['PTO Hours'] ?? 0,
      stdLtdHours: timeTrackingInputs['STD/LTD Hours'] ?? 0,
      pflPfmlHours: timeTrackingInputs['PFL/PFML Hours'] ?? 0
    };
    try {
      await UnifiedDataService.updateDayHours(currentEmployee.id, selectedDay.date, {
        costCenterHours,
        hoursBreakdown
      });
      setShowEditModal(false);
      setSelectedDay(null);
      setTimeTrackingInputs({});
      await loadData();
    } catch (error) {
      console.error('❌ HoursWorkedScreen: Error saving hours:', error);
      Alert.alert('Error', 'Failed to save hours');
    }
  };

  const getTotalHoursForDay = (day: UnifiedDayData) => {
    return day.totalHours;
  };

  const formatDate = (date: Date) => {
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const year = date.getFullYear().toString().slice(-2);
    return `${month}/${day}/${year}`;
  };

  const getMonthName = (date: Date) => {
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    const newMonth = new Date(currentMonth);
    if (direction === 'prev') {
      newMonth.setMonth(newMonth.getMonth() - 1);
    } else {
      newMonth.setMonth(newMonth.getMonth() + 1);
    }
    setCurrentMonth(newMonth);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text>Loading hours data...</Text>
      </View>
    );
  }

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View style={styles.container}>
        <StatusBar style="light" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <MaterialIcons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Hours Worked</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Month Navigation */}
      <View style={styles.monthNavigation}>
        <TouchableOpacity onPress={() => navigateMonth('prev')} style={styles.navButton}>
          <MaterialIcons name="chevron-left" size={24} color="#007AFF" />
        </TouchableOpacity>
        <Text style={styles.monthTitle}>{getMonthName(currentMonth)}</Text>
        <TouchableOpacity onPress={() => navigateMonth('next')} style={styles.navButton}>
          <MaterialIcons name="chevron-right" size={24} color="#007AFF" />
        </TouchableOpacity>
      </View>

      {/* Summary */}
      <View style={styles.summary}>
        <Text style={styles.summaryText}>
          {daysWithHours.filter(day => day.totalHours > 0).length} days with hours • {daysWithHours.reduce((sum, day) => sum + day.totalHours, 0)} total hours
        </Text>
        <Text style={styles.instructionText}>
          Tap on any day to enter or edit hours
        </Text>
      </View>

      {/* Days List */}
      <ScrollView style={styles.daysList} showsVerticalScrollIndicator={false}>
        {daysWithHours.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialIcons name="schedule" size={48} color="#ccc" />
            <Text style={styles.emptyText}>Loading calendar...</Text>
            <Text style={styles.emptySubtext}>Please wait while we load the days</Text>
          </View>
        ) : (
          daysWithHours.map((day) => (
            <TouchableOpacity
              key={day.date.toISOString()}
              style={styles.dayCard}
              onPress={() => handleEditHours(day)}
            >
              <View style={styles.dayInfo}>
                <Text style={styles.dayDate}>{formatDate(day.date)}</Text>
                <Text style={[styles.dayHours, getTotalHoursForDay(day) === 0 && styles.dayHoursZero]}>
                  {getTotalHoursForDay(day)} hours
                </Text>
              </View>
              <View style={styles.dayDetails}>
                {getTotalHoursForDay(day) > 0 ? (
                  <>
                    {day.costCenterHours && Object.entries(day.costCenterHours).map(([cc, h]) => h > 0 ? (
                      <Text key={cc} style={styles.hourDetail}>{cc}: {h}h</Text>
                    ) : null)}
                    {day.hoursBreakdown.gahours > 0 && (
                      <Text style={styles.hourDetail}>G&A: {day.hoursBreakdown.gahours}h</Text>
                    )}
                    {day.hoursBreakdown.holidayHours > 0 && (
                      <Text style={styles.hourDetail}>Holiday: {day.hoursBreakdown.holidayHours}h</Text>
                    )}
                    {day.hoursBreakdown.ptoHours > 0 && (
                      <Text style={styles.hourDetail}>PTO: {day.hoursBreakdown.ptoHours}h</Text>
                    )}
                    {day.hoursBreakdown.stdLtdHours > 0 && (
                      <Text style={styles.hourDetail}>STD/LTD: {day.hoursBreakdown.stdLtdHours}h</Text>
                    )}
                    {day.hoursBreakdown.pflPfmlHours > 0 && (
                      <Text style={styles.hourDetail}>PFL/PFML: {day.hoursBreakdown.pflPfmlHours}h</Text>
                    )}
                  </>
                ) : (
                  <Text style={styles.tapToAddText}>Tap to add hours</Text>
                )}
              </View>
              <MaterialIcons name="edit" size={20} color="#007AFF" />
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      {/* Edit Hours Modal */}
      <Modal
        visible={showEditModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowEditModal(false)}>
              <Text style={styles.cancelButton}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>
              Edit Hours - {selectedDay ? formatDate(selectedDay.date) : ''}
            </Text>
            <TouchableOpacity onPress={handleSaveHours}>
              <Text style={styles.saveButton}>Save</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            <Text style={styles.sectionLabel}>Hours per cost center</Text>
            {(currentEmployee?.selectedCostCenters || currentEmployee?.costCenters || []).map((cc) => (
              <View key={cc} style={styles.inputRow}>
                <Text style={styles.inputLabel} numberOfLines={1}>{cc}</Text>
                <TextInput
                  style={styles.input}
                  value={timeTrackingInputs[`cc:${cc}`]?.toString() ?? '0'}
                  onChangeText={(text) => {
                    const value = parseFloat(text) || 0;
                    setTimeTrackingInputs(prev => ({ ...prev, [`cc:${cc}`]: value }));
                  }}
                  keyboardType="numeric"
                  placeholder="0"
                  selectTextOnFocus
                  returnKeyType="done"
                  blurOnSubmit
                />
              </View>
            ))}
            <Text style={[styles.sectionLabel, { marginTop: 16 }]}>Other</Text>
            {CATEGORY_HOURS_LABELS.map((category) => (
              <View key={category} style={styles.inputRow}>
                <Text style={styles.inputLabel}>{category}</Text>
                <TextInput
                  style={styles.input}
                  value={timeTrackingInputs[category]?.toString() ?? '0'}
                  onChangeText={(text) => {
                    const value = parseFloat(text) || 0;
                    setTimeTrackingInputs(prev => ({ ...prev, [category]: value }));
                  }}
                  keyboardType="numeric"
                  placeholder="0"
                  selectTextOnFocus
                  returnKeyType="done"
                  blurOnSubmit
                />
              </View>
            ))}
            <View style={styles.totalSection}>
              <Text style={styles.totalLabel}>Total Hours:</Text>
              <Text style={styles.totalValue}>
                {Object.values(timeTrackingInputs).reduce((sum, hours) => sum + (typeof hours === 'number' ? hours : 0), 0)}
              </Text>
            </View>
          </ScrollView>
        </View>
      </Modal>
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
  monthNavigation: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  navButton: {
    padding: 8,
  },
  monthTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
  },
  summary: {
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  summaryText: {
    fontSize: 16,
    color: '#333',
    marginBottom: 4,
  },
  instructionText: {
    fontSize: 14,
    color: '#666',
  },
  daysList: {
    flex: 1,
    padding: 16,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    color: '#666',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
  dayCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  dayInfo: {
    flex: 1,
  },
  dayDate: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  dayHours: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '500',
  },
  dayHoursZero: {
    color: '#999',
  },
  dayDetails: {
    flex: 2,
    marginLeft: 16,
  },
  hourDetail: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
  tapToAddText: {
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
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
  modalContainer: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  cancelButton: {
    fontSize: 16,
    color: '#007AFF',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  saveButton: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 16,
    color: '#333',
    flex: 1,
  },
  input: {
    fontSize: 16,
    color: '#333',
    textAlign: 'right',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minWidth: 80,
  },
  totalSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#007AFF',
    borderRadius: 8,
    padding: 16,
    marginTop: 16,
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  totalValue: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
});