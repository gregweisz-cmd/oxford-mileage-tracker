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
import { MileageEntry, Employee, TimeTracking } from '../types';

interface HoursWorkedScreenProps {
  navigation: any;
}

const TIME_CATEGORIES = [
  'Working Hours',
  'G&A Hours',
  'Holiday Hours', 
  'PTO Hours',
  'STD/LTD Hours',
  'PFL/PFML Hours'
];

interface DayHours {
  date: Date;
  hours: number;
  entries: MileageEntry[];
  timeTracking: TimeTracking[];
}

export default function HoursWorkedScreen({ navigation }: HoursWorkedScreenProps) {
  const [currentEmployee, setCurrentEmployee] = useState<Employee | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [daysWithHours, setDaysWithHours] = useState<DayHours[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [currentMonth]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Wait a bit for database to be ready
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Get current employee
      const employees = await DatabaseService.getEmployees();
      let employee = employees[0];
      
      if (!employee) {
        // Create a default employee for demo
        employee = await DatabaseService.createEmployee({
          name: 'Demo Employee',
          email: 'demo@oxfordhouse.org',
          password: 'demo123',
          oxfordHouseId: 'demo-house',
          position: 'House Manager',
          phoneNumber: '555-0123',
          baseAddress: '123 Main Street, Oxford House, NC 27514',
          costCenters: ['NC.F-SAPTBG']
        });
      }
      
      setCurrentEmployee(employee);
      
      // Get all entries for the current month
      const monthEntries = await DatabaseService.getMileageEntries(
        employee.id,
        currentMonth.getMonth() + 1,
        currentMonth.getFullYear()
      );
      
      // Get all time tracking entries for the current month
      const timeTrackingEntries = await DatabaseService.getTimeTrackingEntries(
        employee.id,
        currentMonth.getMonth() + 1,
        currentMonth.getFullYear()
      );
      
      // Group entries by date and calculate hours
      const daysMap = new Map<string, DayHours>();
      
      // Initialize all days of the month
      const daysInMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate();
      for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
        const dateKey = date.toISOString().split('T')[0];
        daysMap.set(dateKey, {
          date,
          hours: 0,
          entries: [],
          timeTracking: []
        });
      }
      
      // Add entries to their respective days
      monthEntries.forEach(entry => {
        const dateKey = entry.date.toISOString().split('T')[0];
        const dayData = daysMap.get(dateKey);
        if (dayData) {
          dayData.entries.push(entry);
          // Don't add hours here - we'll calculate them separately to avoid double counting
          const entryHours = entry.hoursWorked || 0;
          if (entryHours > 0) {
            console.log(`📊 Found ${entryHours} hours from mileage entry on ${dateKey}`);
          }
        }
      });
      
      // Add time tracking entries to their respective days
      timeTrackingEntries.forEach(tracking => {
        const dateKey = tracking.date.toISOString().split('T')[0];
        const dayData = daysMap.get(dateKey);
        if (dayData) {
          dayData.timeTracking.push(tracking);
          // Don't add hours here - we'll calculate them separately to avoid double counting
          const trackingHours = tracking.hours || 0;
          if (trackingHours > 0) {
            console.log(`⏰ Found ${trackingHours} hours from time tracking (${tracking.category}) on ${dateKey}`);
          }
        }
      });
      
      // Now calculate total hours for each day, prioritizing time tracking over mileage
      daysMap.forEach((dayData, dateKey) => {
        const mileageHours = dayData.entries.reduce((sum, entry) => sum + (entry.hoursWorked || 0), 0);
        const timeTrackingHours = dayData.timeTracking.reduce((sum, entry) => sum + entry.hours, 0);
        
        // If there are time tracking entries, use those; otherwise use mileage hours
        if (timeTrackingHours > 0) {
          dayData.hours = timeTrackingHours;
          console.log(`⏰ Using time tracking hours for ${dateKey}: ${timeTrackingHours}`);
        } else {
          dayData.hours = mileageHours;
          console.log(`📊 Using mileage hours for ${dateKey}: ${mileageHours}`);
        }
      });
      
      setDaysWithHours(Array.from(daysMap.values()).sort((a, b) => a.date.getTime() - b.date.getTime()));
      
    } catch (error) {
      console.error('Error loading hours data:', error);
      Alert.alert('Error', 'Failed to load hours data');
    } finally {
      setLoading(false);
    }
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

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });
  };

  const getTotalHours = () => {
    return daysWithHours.reduce((sum, day) => sum + day.hours, 0);
  };

  const getDaysWithHours = () => {
    return daysWithHours.filter(day => day.hours > 0).length;
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading...</Text>
        <StatusBar style="auto" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="auto" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <MaterialIcons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Hours Worked Summary</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Month Navigation */}
      <View style={styles.monthNavigation}>
        <TouchableOpacity onPress={() => navigateMonth('prev')}>
          <MaterialIcons name="chevron-left" size={24} color="#2196F3" />
        </TouchableOpacity>
        
        <Text style={styles.monthTitle}>
          {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </Text>
        
        <TouchableOpacity onPress={() => navigateMonth('next')}>
          <MaterialIcons name="chevron-right" size={24} color="#2196F3" />
        </TouchableOpacity>
      </View>

      {/* Edit Note */}
      <View style={styles.editNoteContainer}>
        <View style={styles.editNote}>
          <MaterialIcons name="info" size={16} color="#2196F3" />
          <Text style={styles.editNoteText}>
            To edit hours, go to the Time Tracking screen
          </Text>
        </View>
      </View>

      {/* Summary Stats */}
      <View style={styles.summaryContainer}>
        <View style={styles.summaryCard}>
          <MaterialIcons name="access-time" size={24} color="#FF5722" />
          <Text style={styles.summaryValue}>{getTotalHours().toFixed(1)}h</Text>
          <Text style={styles.summaryLabel}>Total Hours</Text>
        </View>
        
        <View style={styles.summaryCard}>
          <MaterialIcons name="event" size={24} color="#4CAF50" />
          <Text style={styles.summaryValue}>{getDaysWithHours()}</Text>
          <Text style={styles.summaryLabel}>Days Worked</Text>
        </View>
      </View>

      {/* Days List */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {daysWithHours.map((day) => (
          <View
            key={day.date.toISOString()}
            style={styles.dayCard}
          >
            <View style={styles.dayInfo}>
              <Text style={styles.dayDate}>{formatDate(day.date)}</Text>
              <Text style={styles.dayEntries}>
                {day.entries.length} {day.entries.length === 1 ? 'entry' : 'entries'}
              </Text>
            </View>
            
            <View style={styles.dayHours}>
              <Text style={styles.hoursValue}>{day.hours.toFixed(1)}h</Text>
              <MaterialIcons name="info" size={20} color="#999" />
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
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
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
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
  headerSpacer: {
    width: 24,
  },
  monthNavigation: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  monthTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  editNoteContainer: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  editNote: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e3f2fd',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2196F3',
  },
  editNoteText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#1976D2',
    fontWeight: '500',
  },
  summaryContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  summaryCard: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 5,
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 4,
  },
  summaryLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  dayCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  dayInfo: {
    flex: 1,
  },
  dayDate: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  dayEntries: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  dayHours: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  hoursValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FF5722',
    marginRight: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    width: '90%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
    textAlign: 'center',
  },
  hoursInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#333',
    backgroundColor: '#f9f9f9',
    marginBottom: 20,
    textAlign: 'center',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalButtonSecondary: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2196F3',
    marginRight: 8,
  },
  modalButtonSecondaryText: {
    color: '#2196F3',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  modalButtonPrimary: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#2196F3',
    marginLeft: 8,
  },
  modalButtonPrimaryText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  timeTrackingInputsContainer: {
    maxHeight: 300,
    marginBottom: 20,
  },
  timeTrackingInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
    paddingHorizontal: 5,
  },
  timeTrackingLabel: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  timeTrackingInput: {
    width: 80,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
    padding: 8,
    fontSize: 16,
    color: '#333',
    backgroundColor: '#f9f9f9',
    textAlign: 'center',
  },
  workingHoursRow: {
    backgroundColor: '#e3f2fd',
    borderRadius: 8,
    padding: 8,
    marginBottom: 20,
    borderWidth: 2,
    borderColor: '#2196F3',
  },
  workingHoursLabel: {
    fontWeight: 'bold',
    color: '#1976D2',
    fontSize: 18,
  },
  workingHoursInput: {
    width: 100,
    borderWidth: 2,
    borderColor: '#2196F3',
    backgroundColor: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  hoursSummary: {
    backgroundColor: '#f5f5f5',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  hoursSummaryTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  hoursSummaryText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
});
