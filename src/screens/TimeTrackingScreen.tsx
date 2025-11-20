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
import { TimeTracking, Employee } from '../types';
import UnifiedHeader from '../components/UnifiedHeader';
import { useTips } from '../contexts/TipsContext';
import { TipCard } from '../components/TipCard';
import { AnomalyDetectionService } from '../services/anomalyDetectionService';

interface TimeTrackingScreenProps {
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

export default function TimeTrackingScreen({ navigation }: TimeTrackingScreenProps) {
  const { tips, loadTipsForScreen, dismissTip, markTipAsSeen, showTips, setCurrentEmployee: setTipsEmployee } = useTips();
  const [currentEmployee, setCurrentEmployee] = useState<Employee | null>(null);
  const [selectedCostCenter, setSelectedCostCenter] = useState<string>('');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [timeEntries, setTimeEntries] = useState<TimeTracking[]>([]);
  const [allTimeEntries, setAllTimeEntries] = useState<TimeTracking[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState<TimeTracking | null>(null);
  const [inlineEditingEntry, setInlineEditingEntry] = useState<string | null>(null);
  const [inlineEditingValue, setInlineEditingValue] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    category: 'Working Hours',
    hours: '',
    description: '',
    costCenter: ''
  });

  useEffect(() => {
    loadEmployee();
  }, []);

  useEffect(() => {
    if (currentEmployee) {
      loadTimeEntries();
    }
  }, [currentEmployee, currentMonth]);

  // Filter time entries based on search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      setTimeEntries(allTimeEntries);
      return;
    }

    const query = searchQuery.toLowerCase().trim();
    const filtered = allTimeEntries.filter(entry => {
      const category = entry.category?.toLowerCase() || '';
      const description = entry.description?.toLowerCase() || '';
      const costCenter = entry.costCenter?.toLowerCase() || '';
      const hours = entry.hours.toString();
      const date = entry.date.toLocaleDateString('en-US').toLowerCase();
      
      return (
        category.includes(query) ||
        description.includes(query) ||
        costCenter.includes(query) ||
        hours.includes(query) ||
        date.includes(query)
      );
    });
    
    setTimeEntries(filtered);
  }, [searchQuery, allTimeEntries]);

  const loadEmployee = async () => {
    try {
      const currentEmployee = await DatabaseService.getCurrentEmployee();
      if (currentEmployee) {
        setCurrentEmployee(currentEmployee);
        
        // Initialize cost center
        const costCenter = currentEmployee.defaultCostCenter || currentEmployee.selectedCostCenters?.[0] || '';
        setSelectedCostCenter(costCenter);
        
        // Set employee for tips context and load time tracking tips
        setTipsEmployee(currentEmployee);
        if (showTips) {
          await loadTipsForScreen('TimeTrackingScreen', 'on_load');
        }
      }
    } catch (error) {
      console.error('Error loading current employee:', error);
      Alert.alert('Error', 'Failed to load employee data');
    }
  };

  const createSampleTimeEntries = async () => {
    if (!currentEmployee) return;
    
    try {
      // Create sample time entries for the current month if none exist
      const existingEntries = await DatabaseService.getTimeTrackingEntries(
        currentEmployee.id,
        currentMonth.getMonth() + 1,
        currentMonth.getFullYear()
      );
      
      if (existingEntries.length === 0) {
        console.log('🕒 Creating sample time entries for', currentMonth.toLocaleDateString());
        
        // Create sample entries for the first few days of the month
        const sampleEntries = [
          {
            employeeId: currentEmployee.id,
            date: new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1),
            category: 'Working Hours' as const,
            hours: 8,
            description: 'Regular work day'
          },
          {
            employeeId: currentEmployee.id,
            date: new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 2),
            category: 'Working Hours' as const,
            hours: 8,
            description: 'Regular work day'
          },
          {
            employeeId: currentEmployee.id,
            date: new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 3),
            category: 'Working Hours' as const,
            hours: 7.5,
            description: 'Half day - training'
          },
          {
            employeeId: currentEmployee.id,
            date: new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 4),
            category: 'Working Hours' as const,
            hours: 8,
            description: 'Regular work day'
          },
          {
            employeeId: currentEmployee.id,
            date: new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 5),
            category: 'Working Hours' as const,
            hours: 8,
            description: 'Regular work day'
          }
        ];
        
        for (const entry of sampleEntries) {
          await DatabaseService.createTimeTracking(entry);
        }
        
        console.log('✅ Created', sampleEntries.length, 'sample time entries');
        
        // Reload the time entries to show the new data
        const entries = await DatabaseService.getTimeTrackingEntries(
          currentEmployee.id,
          currentMonth.getMonth() + 1,
          currentMonth.getFullYear()
        );
        setTimeEntries(entries);
      }
    } catch (error) {
      console.error('Error creating sample time entries:', error);
    }
  };

  const loadTimeEntries = async () => {
    if (!currentEmployee) return;
    
    try {
      setLoading(true);
      console.log('🕒 Loading time entries for:', currentEmployee.name, 'Month:', currentMonth.getMonth() + 1, 'Year:', currentMonth.getFullYear());
      
      const entries = await DatabaseService.getTimeTrackingEntries(
        currentEmployee.id,
        currentMonth.getMonth() + 1,
        currentMonth.getFullYear()
      );
      console.log('🕒 Loaded time entries:', entries.length, 'entries');
      setAllTimeEntries(entries);
      setTimeEntries(entries);
    } catch (error) {
      console.error('Error loading time entries:', error);
      Alert.alert('Error', 'Failed to load time entries');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!currentEmployee) return;

    try {
      // Validation
      if (!formData.date.trim()) {
        Alert.alert('Validation Error', 'Please select a date');
        return;
      }

      if (!formData.hours.trim() || isNaN(Number(formData.hours)) || Number(formData.hours) <= 0) {
        Alert.alert('Validation Error', 'Please enter valid hours (greater than 0)');
        return;
      }

      const timeTrackingData: TimeTracking = {
        id: editingEntry?.id || `temp-${Date.now()}`, // Temporary ID for new entries
        employeeId: currentEmployee.id,
        date: new Date(formData.date),
        category: formData.category as TimeTracking['category'],
        hours: Number(formData.hours),
        description: formData.description.trim(),
        costCenter: selectedCostCenter,
        createdAt: editingEntry?.createdAt || new Date(),
        updatedAt: new Date()
      };

      if (editingEntry) {
        await DatabaseService.updateTimeTracking(editingEntry.id, timeTrackingData);
        Alert.alert('Success', 'Time entry updated successfully!');
      } else {
        await DatabaseService.createTimeTracking(timeTrackingData);
        Alert.alert('Success', 'Time entry added successfully!');
        
        // Run anomaly detection for new entries
        try {
          console.log('🔍 Running time tracking anomaly detection...');
          const anomalies = await AnomalyDetectionService.detectTimeTrackingAnomaly(
            currentEmployee.id, 
            timeTrackingData
          );
          
          if (anomalies.length > 0) {
            console.log('⚠️ Time tracking anomalies detected:', anomalies.length);
            
            // Show alerts for each anomaly
            anomalies.forEach((anomaly, index) => {
              setTimeout(() => {
                Alert.alert(
                  anomaly.severity === 'critical' ? '🚨 Critical Alert' : 
                  anomaly.severity === 'high' ? '⚠️ High Priority' :
                  anomaly.severity === 'medium' ? '📊 Time Tracking Alert' : 'ℹ️ Info',
                  anomaly.reason,
                  [
                    { text: 'OK', style: 'default' },
                    ...(anomaly.suggestedAction ? [{ 
                      text: 'Learn More', 
                      onPress: () => Alert.alert('Suggestion', anomaly.suggestedAction || '')
                    }] : [])
                  ]
                );
              }, index * 1000); // Stagger alerts by 1 second
            });
          } else {
            console.log('✅ No time tracking anomalies detected');
          }
        } catch (error) {
          console.error('❌ Error running time tracking anomaly detection:', error);
        }
      }

      // Reset form and reload data
      setFormData({
        date: new Date().toISOString().split('T')[0],
        category: 'G&A Hours',
        hours: '',
        description: '',
        costCenter: selectedCostCenter
      });
      setShowAddModal(false);
      setEditingEntry(null);
      loadTimeEntries();
    } catch (error) {
      console.error('Error saving time entry:', error);
      Alert.alert('Error', 'Failed to save time entry');
    }
  };

  const handleEdit = (entry: TimeTracking) => {
    setEditingEntry(entry);
    setFormData({
      date: entry.date.toISOString().split('T')[0],
      category: entry.category,
      hours: entry.hours.toString(),
      description: entry.description || '',
      costCenter: entry.costCenter || selectedCostCenter
    });
    setShowAddModal(true);
  };

  const handleDelete = async (entry: TimeTracking) => {
    Alert.alert(
      'Delete Time Entry',
      'Are you sure you want to delete this time entry?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await DatabaseService.deleteTimeTracking(entry.id);
              Alert.alert('Success', 'Time entry deleted successfully!');
              loadTimeEntries();
            } catch (error) {
              console.error('Error deleting time entry:', error);
              Alert.alert('Error', 'Failed to delete time entry');
            }
          }
        }
      ]
    );
  };

  const handleInlineEdit = (entry: TimeTracking) => {
    if (entry.category === 'Working Hours') {
      setInlineEditingEntry(entry.id);
      setInlineEditingValue(entry.hours.toString());
    }
  };

  const handleInlineSave = async () => {
    if (!inlineEditingEntry || !currentEmployee) return;

    try {
      const entry = timeEntries.find(e => e.id === inlineEditingEntry);
      if (!entry) return;

      const updatedEntry = {
        ...entry,
        hours: parseFloat(inlineEditingValue) || 0,
        updatedAt: new Date()
      };

      await DatabaseService.updateTimeTracking(entry.id, updatedEntry);
      await loadTimeEntries();
      
      setInlineEditingEntry(null);
      setInlineEditingValue('');
      
      // Run anomaly detection for updated entries
      try {
        console.log('🔍 Running time tracking anomaly detection...');
        const anomalies = await AnomalyDetectionService.detectTimeTrackingAnomaly(
          currentEmployee.id, 
          updatedEntry
        );
        
        if (anomalies.length > 0) {
          console.log('⚠️ Time tracking anomalies detected:', anomalies.length);
          
          // Show alerts for each anomaly
          anomalies.forEach((anomaly, index) => {
            setTimeout(() => {
              Alert.alert(
                anomaly.severity === 'critical' ? '🚨 Critical Alert' : 
                anomaly.severity === 'high' ? '⚠️ High Priority' :
                anomaly.severity === 'medium' ? '📊 Time Tracking Alert' : 'ℹ️ Info',
                anomaly.reason,
                [
                  { text: 'OK', style: 'default' },
                  ...(anomaly.suggestedAction ? [{ 
                    text: 'Learn More', 
                    onPress: () => Alert.alert('Suggestion', anomaly.suggestedAction || '')
                  }] : [])
                ]
              );
            }, index * 1000); // Stagger alerts by 1 second
          });
        } else {
          console.log('✅ No time tracking anomalies detected');
        }
      } catch (error) {
        console.error('❌ Error running time tracking anomaly detection:', error);
      }
    } catch (error) {
      console.error('Error updating time entry:', error);
      Alert.alert('Error', 'Failed to update time entry');
    }
  };

  const handleInlineCancel = () => {
    setInlineEditingEntry(null);
    setInlineEditingValue('');
  };

  const getTotalHoursByCategory = () => {
    const totals: { [key: string]: number } = {};
    TIME_CATEGORIES.forEach(category => {
      totals[category] = timeEntries
        .filter(entry => entry.category === category)
        .reduce((sum, entry) => sum + entry.hours, 0);
    });
    return totals;
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const changeMonth = (direction: 'prev' | 'next') => {
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
        <Text>Loading time entries...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      
      <UnifiedHeader
        title="Time Tracking"
        showBackButton={true}
        onBackPress={() => navigation.goBack()}
        rightButton={{
          icon: 'add',
          onPress: () => setShowAddModal(true),
          color: '#007AFF'
        }}
        leftButton={{
          icon: 'schedule',
          onPress: () => {
            // Quick add working hours for today
            const today = new Date().toISOString().split('T')[0];
            setFormData({
              date: today,
              category: 'Working Hours',
              hours: '8',
              description: 'Regular work day',
              costCenter: selectedCostCenter
            });
            setShowAddModal(true);
          },
          color: '#34C759'
        }}
      />

      {/* Month Navigation */}
      <View style={styles.monthNavigation}>
        <TouchableOpacity onPress={() => changeMonth('prev')} style={styles.monthButton}>
          <MaterialIcons name="chevron-left" size={24} color="#007AFF" />
        </TouchableOpacity>
        <Text style={styles.monthText}>
          {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </Text>
        <TouchableOpacity onPress={() => changeMonth('next')} style={styles.monthButton}>
          <MaterialIcons name="chevron-right" size={24} color="#007AFF" />
        </TouchableOpacity>
      </View>

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

      {/* Summary Cards */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <MaterialIcons name="search" size={20} color="#999" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search entries by category, description, hours, date..."
            placeholderTextColor="#999"
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearchQuery('')}
              style={styles.clearSearchButton}
            >
              <MaterialIcons name="close" size={20} color="#999" />
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.summaryContainer}>
          <Text style={styles.summaryTitle}>Monthly Summary</Text>
          {TIME_CATEGORIES.map(category => {
            const total = getTotalHoursByCategory()[category];
            return (
              <View key={category} style={styles.summaryCard}>
                <Text style={styles.summaryLabel}>{category}</Text>
                <Text style={styles.summaryValue}>{total.toFixed(1)} hours</Text>
              </View>
            );
          })}
        </View>

        {/* Hours Worked Header */}
        <View style={styles.entriesContainer}>
          <Text style={styles.entriesTitle}>Hours Worked</Text>
          {timeEntries.length === 0 ? (
            <View style={styles.emptyState}>
              <MaterialIcons name="schedule" size={48} color="#ccc" />
              <Text style={styles.emptyText}>
                {searchQuery.trim() ? 'No entries found matching your search' : 'No time entries for this month'}
              </Text>
              <Text style={styles.emptySubtext}>
                {searchQuery.trim() 
                  ? 'Try adjusting your search terms' 
                  : 'Tap the + button to add your first entry'}
              </Text>
              <TouchableOpacity 
                style={styles.sampleButton}
                onPress={createSampleTimeEntries}
              >
                <Text style={styles.sampleButtonText}>Create Sample Data</Text>
              </TouchableOpacity>
            </View>
          ) : (
            timeEntries.map(entry => (
              <View key={entry.id} style={styles.entryCard}>
                <View style={styles.entryHeader}>
                  <Text style={styles.entryDate}>{formatDate(entry.date)}</Text>
                  <View style={styles.entryActions}>
                    <TouchableOpacity onPress={() => handleEdit(entry)} style={styles.actionButton}>
                      <MaterialIcons name="edit" size={20} color="#007AFF" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleDelete(entry)} style={styles.actionButton}>
                      <MaterialIcons name="delete" size={20} color="#FF3B30" />
                    </TouchableOpacity>
                  </View>
                </View>
                <Text style={styles.entryCategory}>{entry.category}</Text>
                {inlineEditingEntry === entry.id ? (
                  <View style={styles.inlineEditContainer}>
                    <TextInput
                      style={styles.inlineEditInput}
                      value={inlineEditingValue}
                      onChangeText={setInlineEditingValue}
                      keyboardType="numeric"
                      autoFocus
                      onBlur={handleInlineSave}
                      onSubmitEditing={handleInlineSave}
                    />
                    <Text style={styles.inlineEditLabel}>hours</Text>
                    <TouchableOpacity onPress={handleInlineSave} style={styles.inlineEditButton}>
                      <MaterialIcons name="check" size={16} color="#34C759" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={handleInlineCancel} style={styles.inlineEditButton}>
                      <MaterialIcons name="close" size={16} color="#FF3B30" />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity 
                    onPress={() => handleInlineEdit(entry)}
                    style={entry.category === 'Working Hours' ? styles.editableHours : null}
                  >
                    <Text style={[
                      styles.entryHours,
                      entry.category === 'Working Hours' && styles.editableHoursText
                    ]}>
                      {entry.hours} hours
                    </Text>
                  </TouchableOpacity>
                )}
                {entry.description && (
                  <Text style={styles.entryDescription}>{entry.description}</Text>
                )}
                {entry.costCenter && (
                  <Text style={styles.entryCostCenter}>Cost Center: {entry.costCenter}</Text>
                )}
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* Add/Edit Modal */}
      <Modal visible={showAddModal} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => {
              setShowAddModal(false);
              setEditingEntry(null);
              setFormData({
                date: new Date().toISOString().split('T')[0],
                category: 'Working Hours',
                hours: '',
                description: '',
                costCenter: selectedCostCenter
              });
            }}>
              <Text style={styles.cancelButton}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>
              {editingEntry ? 'Edit Time Entry' : 'Add Time Entry'}
            </Text>
            <TouchableOpacity onPress={handleSave}>
              <Text style={styles.saveButton}>Save</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Date</Text>
              <TextInput
                style={styles.input}
                value={formData.date}
                onChangeText={(value) => handleInputChange('date', value)}
                placeholder="YYYY-MM-DD"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Category</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryContainer}>
                {TIME_CATEGORIES.map(category => (
                  <TouchableOpacity
                    key={category}
                    style={[
                      styles.categoryButton,
                      formData.category === category && styles.categoryButtonSelected
                    ]}
                    onPress={() => handleInputChange('category', category)}
                  >
                    <Text style={[
                      styles.categoryButtonText,
                      formData.category === category && styles.categoryButtonTextSelected
                    ]}>
                      {category}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Hours</Text>
              <TextInput
                style={styles.input}
                value={formData.hours}
                onChangeText={(value) => handleInputChange('hours', value)}
                placeholder="Enter hours worked"
                keyboardType="numeric"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Description (Optional)</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={formData.description}
                onChangeText={(value) => handleInputChange('description', value)}
                placeholder="Enter description or notes"
                multiline
                numberOfLines={3}
              />
            </View>

            {/* Cost Center Selector - only show if user has multiple cost centers */}
            {currentEmployee && currentEmployee.selectedCostCenters && currentEmployee.selectedCostCenters.length > 1 && (
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Cost Center</Text>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  addButton: {
    padding: 8,
  },
  monthNavigation: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  monthButton: {
    padding: 8,
  },
  monthText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#ddd',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
    color: '#333',
  },
  clearSearchButton: {
    padding: 4,
    marginLeft: 8,
  },
  summaryContainer: {
    marginBottom: 24,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  summaryCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#666',
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  entriesContainer: {
    marginBottom: 24,
  },
  entriesTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 4,
  },
  sampleButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 16,
  },
  sampleButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  entryCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  entryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  entryDate: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  entryActions: {
    flexDirection: 'row',
  },
  actionButton: {
    padding: 4,
    marginLeft: 8,
  },
  entryCategory: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
    marginBottom: 4,
  },
  entryHours: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  entryDescription: {
    fontSize: 14,
    color: '#999',
    fontStyle: 'italic',
  },
  entryCostCenter: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  editableHours: {
    padding: 4,
    borderRadius: 4,
    backgroundColor: '#f0f8ff',
  },
  editableHoursText: {
    color: '#007AFF',
    textDecorationLine: 'underline',
  },
  inlineEditContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  inlineEditInput: {
    borderWidth: 1,
    borderColor: '#007AFF',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    backgroundColor: '#fff',
    minWidth: 60,
    textAlign: 'center',
  },
  inlineEditLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginLeft: 8,
  },
  inlineEditButton: {
    padding: 4,
    marginLeft: 8,
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
    color: '#FF3B30',
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
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  categoryContainer: {
    flexDirection: 'row',
  },
  categoryButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
  },
  categoryButtonSelected: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  categoryButtonText: {
    fontSize: 14,
    color: '#666',
  },
  categoryButtonTextSelected: {
    color: '#fff',
    fontWeight: '500',
  },
  tipsContainer: {
    marginTop: 8,
    maxHeight: 200,
    borderRadius: 12,
    backgroundColor: '#f8f9fa',
    marginHorizontal: 16,
    marginBottom: 16,
  },
  tipsScrollView: {
    maxHeight: 180,
  },
  costCenterSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  costCenterOption: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  costCenterOptionSelected: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  costCenterOptionText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  costCenterOptionTextSelected: {
    color: '#fff',
    fontWeight: '600',
  },
});

