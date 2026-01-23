import React, { useState, useEffect, useRef } from 'react';
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
  FlatList,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { MaterialIcons } from '@expo/vector-icons';
import { DatabaseService } from '../services/database';
import { UnifiedDataService, UnifiedDayData } from '../services/unifiedDataService';
import { ApiSyncService } from '../services/apiSyncService';
import { Employee } from '../types';
import { COST_CENTERS } from '../constants/costCenters';
import UnifiedHeader from '../components/UnifiedHeader';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface DailyHoursScreenProps {
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

const DAY_OFF_TYPES = [
  'Day Off',
  'PTO',
  'Sick Day',
  'Holiday',
  'Unpaid Leave'
];

const DEFAULT_DESCRIPTION_TEMPLATES = [
  'Telework from Base Address',
  'Staff Meeting',
  'Staff Training',
  'World Convention',
  'State Convention',
  'Workshop'
];

// AsyncStorage keys for persisting description templates and recent descriptions
const DESCRIPTION_TEMPLATES_KEY = '@description_templates';
const RECENT_DESCRIPTIONS_KEY = '@recent_descriptions';

/**
 * Daily Hours Screen Component
 * 
 * Unified screen for managing daily hours worked and descriptions.
 * Features:
 * - View/edit hours for each day of the month
 * - Add/edit daily descriptions
 * - Day off selection with type dropdown
 * - Quick description menu with templates
 * - Scroll position preservation after editing
 * - Auto-sync on save
 */
export default function DailyHoursScreen({ navigation }: DailyHoursScreenProps) {
  const [currentEmployee, setCurrentEmployee] = useState<Employee | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [daysWithData, setDaysWithData] = useState<UnifiedDayData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedDay, setSelectedDay] = useState<UnifiedDayData | null>(null);
  const [descriptionText, setDescriptionText] = useState<string>('');
  const [timeTrackingInputs, setTimeTrackingInputs] = useState<{[key: string]: number}>({});
  const [selectedCostCenter, setSelectedCostCenter] = useState<string>('');
  const [isDayOff, setIsDayOff] = useState(false);
  const [dayOffType, setDayOffType] = useState<string>('Day Off');
  const [showDayOffDropdown, setShowDayOffDropdown] = useState(false);
  const [showDescriptionDropdown, setShowDescriptionDropdown] = useState(false);
  const [descriptionTemplates, setDescriptionTemplates] = useState<string[]>(DEFAULT_DESCRIPTION_TEMPLATES);
  const [recentDescriptions, setRecentDescriptions] = useState<string[]>([]);
  
  // Refs for scroll position management
  const scrollViewRef = useRef<ScrollView>(null);
  const scrollPositionRef = useRef<number>(0);
  const selectedDayIndexRef = useRef<number>(-1);

  // Load data when month changes
  useEffect(() => {
    loadData();
    loadDescriptionTemplates();
  }, [currentMonth]);

  /**
   * Loads description templates and recent descriptions from AsyncStorage
   */
  const loadDescriptionTemplates = async () => {
    try {
      // Load custom templates
      const customTemplatesJson = await AsyncStorage.getItem(DESCRIPTION_TEMPLATES_KEY);
      if (customTemplatesJson) {
        const customTemplates = JSON.parse(customTemplatesJson);
        setDescriptionTemplates([...DEFAULT_DESCRIPTION_TEMPLATES, ...customTemplates]);
      }
      
      // Load recent descriptions
      const recentJson = await AsyncStorage.getItem(RECENT_DESCRIPTIONS_KEY);
      if (recentJson) {
        const recent = JSON.parse(recentJson);
        setRecentDescriptions(recent.slice(0, 10)); // Keep last 10 recent descriptions
      }
    } catch (error) {
      // Silently fail - templates are optional
      if (__DEV__) {
        console.error('Error loading description templates:', error);
      }
    }
  };

  /**
   * Saves a description to the recent descriptions list
   * @param description - Description text to save
   */
  const saveRecentDescription = async (description: string) => {
    if (!description.trim()) return;
    
    try {
      const recent = [...recentDescriptions];
      // Remove if already exists
      const index = recent.indexOf(description);
      if (index > -1) {
        recent.splice(index, 1);
      }
      // Add to front
      recent.unshift(description);
      // Keep only last 10 recent descriptions
      const limited = recent.slice(0, 10);
      setRecentDescriptions(limited);
      await AsyncStorage.setItem(RECENT_DESCRIPTIONS_KEY, JSON.stringify(limited));
    } catch (error) {
      // Silently fail - recent descriptions are optional
      if (__DEV__) {
        console.error('Error saving recent description:', error);
      }
    }
  };

  /**
   * Saves a custom description template
   * @param template - Template text to save
   */
  const saveCustomTemplate = async (template: string) => {
    if (!template.trim()) return;
    
    try {
      const customTemplatesJson = await AsyncStorage.getItem(DESCRIPTION_TEMPLATES_KEY);
      const customTemplates = customTemplatesJson ? JSON.parse(customTemplatesJson) : [];
      
      // Don't add if already exists
      if (!customTemplates.includes(template) && !DEFAULT_DESCRIPTION_TEMPLATES.includes(template)) {
        customTemplates.push(template);
        await AsyncStorage.setItem(DESCRIPTION_TEMPLATES_KEY, JSON.stringify(customTemplates));
        setDescriptionTemplates([...DEFAULT_DESCRIPTION_TEMPLATES, ...customTemplates]);
      }
    } catch (error) {
      // Silently fail - custom templates are optional
      if (__DEV__) {
        console.error('Error saving custom template:', error);
      }
    }
  };

  /**
   * Loads employee data and month data for the current month
   */
  const loadData = async () => {
    try {
      setLoading(true);
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const employee = await DatabaseService.getCurrentEmployee();
      
      if (!employee) {
        Alert.alert('Error', 'No employee data found. Please log in again.');
        setLoading(false);
        return;
      }
      
      setCurrentEmployee(employee);
      
      // Load unified data (hours + descriptions) for the current month
      const monthData = await UnifiedDataService.getMonthData(
        employee.id,
        currentMonth.getMonth() + 1,
        currentMonth.getFullYear()
      );
      
      setDaysWithData(monthData);
      
    } catch (error) {
      Alert.alert('Error', 'Failed to load data. Please try again.');
      if (__DEV__) {
        console.error('DailyHoursScreen: Error loading data:', error);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleEditDay = (day: UnifiedDayData, index: number) => {
    // Save the day index for later scroll restoration
    selectedDayIndexRef.current = index;
    
    setSelectedDay(day);
    
    // Initialize description
    const existingDescription = day.description || '';
    setDescriptionText(existingDescription);
    
    // Initialize day off state
    const dailyDesc = day as any;
    setIsDayOff(dailyDesc.dayOff || false);
    setDayOffType(dailyDesc.dayOffType || 'Day Off');
    
    // Initialize hours inputs
    const inputs: {[key: string]: number} = {};
    TIME_CATEGORIES.forEach(category => {
      let categoryKey: keyof typeof day.hoursBreakdown;
      switch (category) {
        case 'Working Hours':
          categoryKey = 'workingHours';
          break;
        case 'G&A Hours':
          categoryKey = 'gahours';
          break;
        case 'Holiday Hours':
          categoryKey = 'holidayHours';
          break;
        case 'PTO Hours':
          categoryKey = 'ptoHours';
          break;
        case 'STD/LTD Hours':
          categoryKey = 'stdLtdHours';
          break;
        case 'PFL/PFML Hours':
          categoryKey = 'pflPfmlHours';
          break;
        default:
          categoryKey = 'workingHours';
      }
      inputs[category] = day.hoursBreakdown[categoryKey] || 0;
    });
    setTimeTrackingInputs(inputs);
    
    // Initialize cost center
    const costCenter = day.costCenter || currentEmployee?.defaultCostCenter || currentEmployee?.selectedCostCenters?.[0] || '';
    setSelectedCostCenter(costCenter);
    
    setShowEditModal(true);
  };

  const handleSave = async () => {
    if (!selectedDay || !currentEmployee) return;

    try {
      // Save the current scroll position before closing modal
      const savedScrollPosition = scrollPositionRef.current;
      const savedDayIndex = selectedDayIndexRef.current;
      
      // Save description - use trimmed text, but allow empty strings if user cleared it
      const descriptionToSave = isDayOff ? dayOffType : (descriptionText || '').trim();
      await UnifiedDataService.updateDayDescription(
        currentEmployee.id,
        selectedDay.date,
        descriptionToSave,
        selectedCostCenter,
        undefined, // stayedOvernight
        isDayOff,
        isDayOff ? dayOffType : undefined
      );
      
      // Save hours (only if not day off)
      if (!isDayOff) {
        const hoursBreakdown = {
          workingHours: timeTrackingInputs['Working Hours'] || 0,
          gahours: timeTrackingInputs['G&A Hours'] || 0,
          holidayHours: timeTrackingInputs['Holiday Hours'] || 0,
          ptoHours: timeTrackingInputs['PTO Hours'] || 0,
          stdLtdHours: timeTrackingInputs['STD/LTD Hours'] || 0,
          pflPfmlHours: timeTrackingInputs['PFL/PFML Hours'] || 0
        };
        
        await UnifiedDataService.updateDayHours(
          currentEmployee.id,
          selectedDay.date,
          hoursBreakdown,
          selectedCostCenter
        );
      }
      
      // Save recent description if not day off and has content
      if (!isDayOff && descriptionText.trim()) {
        await saveRecentDescription(descriptionText.trim());
      }
      
      setShowEditModal(false);
      setSelectedDay(null);
      setDescriptionText('');
      setTimeTrackingInputs({});
      setIsDayOff(false);
      setDayOffType('Day Off');
      
      // Reload data
      await loadData();
      
      // Restore scroll position to exact saved position
      setTimeout(() => {
        if (scrollViewRef.current && savedScrollPosition >= 0) {
          scrollViewRef.current.scrollTo({
            y: savedScrollPosition,
            animated: false // Use false for exact positioning
          });
        }
      }, 150); // Slightly longer delay to ensure data is rendered
      
      // Auto-sync to backend
      try {
        const savedDescription = await DatabaseService.getDailyDescriptionByDate(currentEmployee.id, selectedDay.date);
        if (savedDescription) {
          await ApiSyncService.syncToBackend({
            dailyDescriptions: [savedDescription]
          });
        }
      } catch (error) {
        // Auto-sync errors are non-critical, log only in dev mode
        if (__DEV__) {
          console.error('Error auto-syncing:', error);
        }
      }
      
    } catch (error) {
      if (__DEV__) {
        console.error('DailyHoursScreen: Error saving:', error);
      }
      Alert.alert('Error', 'Failed to save data');
    }
  };

  const handleDescriptionTemplateSelect = (template: string) => {
    if (template === 'Custom...') {
      // Show input for custom template
      Alert.prompt(
        'Custom Description',
        'Enter a custom description template:',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Save',
            onPress: async (text) => {
              if (text && text.trim()) {
                await saveCustomTemplate(text.trim());
                setDescriptionText(text.trim());
              }
            }
          }
        ],
        'plain-text'
      );
    } else {
      setDescriptionText(template);
      setShowDescriptionDropdown(false);
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

  const getDayDescription = (day: UnifiedDayData) => {
    const dailyDesc = day as any;
    if (dailyDesc.dayOff && dailyDesc.dayOffType) {
      return dailyDesc.dayOffType;
    }
    return day.description || '';
  };

  const hasData = (day: UnifiedDayData) => {
    const dailyDesc = day as any;
    return (day.description && day.description.trim().length > 0) || 
           day.totalHours > 0 || 
           (dailyDesc.dayOff && dailyDesc.dayOffType);
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <UnifiedHeader
          title="Hours & Description"
          showBackButton
          onBackPress={() => navigation.goBack()}
        />
        <View style={styles.loadingContainer}>
          <Text>Loading data...</Text>
        </View>
      </View>
    );
  }

  const allTemplates = [...recentDescriptions, ...descriptionTemplates, 'Custom...'];

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View style={styles.container}>
        <StatusBar style="dark" />
        
        <UnifiedHeader
          title="Hours & Description"
          showBackButton
          onBackPress={() => navigation.goBack()}
        />

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
            {daysWithData.filter(day => hasData(day)).length} days with data • {daysWithData.reduce((sum, day) => sum + day.totalHours, 0)} total hours
          </Text>
          <Text style={styles.instructionText}>
            Tap on any day to enter or edit hours and description
          </Text>
          {currentEmployee && (
            <TouchableOpacity
              style={styles.resetButton}
              onPress={async () => {
                Alert.alert(
                  'Reset All Hours',
                  `Are you sure you want to reset all hours for ${getMonthName(currentMonth)}? This will set all hours to 0 for all days.`,
                  [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Reset',
                      style: 'destructive',
                      onPress: async () => {
                        try {
                          await UnifiedDataService.resetMonthHours(
                            currentEmployee.id,
                            currentMonth.getMonth() + 1,
                            currentMonth.getFullYear()
                          );
                          await loadData();
                          Alert.alert('Success', 'All hours have been reset to 0 for this month.');
                        } catch (error) {
                          Alert.alert('Error', 'Failed to reset hours. Please try again.');
                          console.error('Error resetting hours:', error);
                        }
                      }
                    }
                  ]
                );
              }}
            >
              <MaterialIcons name="refresh" size={20} color="#fff" />
              <Text style={styles.resetButtonText}>Reset All Hours</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Days List */}
        <ScrollView 
          ref={scrollViewRef}
          style={styles.daysList} 
          showsVerticalScrollIndicator={false}
          onScroll={(event) => {
            scrollPositionRef.current = event.nativeEvent.contentOffset.y;
          }}
          scrollEventThrottle={16}
        >
          {daysWithData.length === 0 ? (
            <View style={styles.emptyState}>
              <MaterialIcons name="calendar-today" size={48} color="#ccc" />
              <Text style={styles.emptyText}>Loading calendar...</Text>
            </View>
          ) : (
            daysWithData.map((day, index) => {
              const dailyDesc = day as any;
              const isDayOffDay = dailyDesc.dayOff && dailyDesc.dayOffType;
              
              return (
                <TouchableOpacity
                  key={day.date.toISOString()}
                  style={styles.dayCard}
                  onPress={() => handleEditDay(day, index)}
                >
                  <View style={styles.dayInfo}>
                    <Text style={styles.dayDate}>{formatDate(day.date)}</Text>
                    {isDayOffDay ? (
                      <Text style={styles.dayOffBadge}>{dailyDesc.dayOffType}</Text>
                    ) : (
                      <Text style={[styles.dayHours, getTotalHoursForDay(day) === 0 && styles.dayHoursZero]}>
                        {getTotalHoursForDay(day)} hours
                      </Text>
                    )}
                  </View>
                  <View style={styles.dayDetails}>
                    {isDayOffDay ? (
                      <Text style={styles.dayOffText}>Day Off</Text>
                    ) : getTotalHoursForDay(day) > 0 ? (
                      <>
                        {day.hoursBreakdown.workingHours > 0 && (
                          <Text style={styles.hourDetail}>Working: {day.hoursBreakdown.workingHours}h</Text>
                        )}
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
                      <Text style={styles.tapToAddText}>Tap to add</Text>
                    )}
                    {getDayDescription(day) && !isDayOffDay && (
                      <Text style={styles.descriptionPreview} numberOfLines={2}>
                        {getDayDescription(day)}
                      </Text>
                    )}
                  </View>
                  <MaterialIcons name="edit" size={20} color="#007AFF" />
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>

        {/* Edit Modal */}
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
                {selectedDay ? formatDate(selectedDay.date) : ''}
              </Text>
              <TouchableOpacity onPress={handleSave}>
                <Text style={styles.saveButton}>Save</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
              {/* Day Off Section */}
              <View style={styles.section}>
                <View style={styles.checkboxRow}>
                  <TouchableOpacity
                    style={styles.checkbox}
                    onPress={() => {
                      const newValue = !isDayOff;
                      setIsDayOff(newValue);
                      if (!newValue) {
                        setDayOffType('Day Off');
                      }
                    }}
                  >
                    {isDayOff && <MaterialIcons name="check" size={20} color="#007AFF" />}
                  </TouchableOpacity>
                  <Text style={styles.checkboxLabel}>Day Off</Text>
                </View>
                
                {isDayOff && (
                  <View style={styles.dropdownContainer}>
                    <TouchableOpacity
                      style={styles.dropdownButton}
                      onPress={() => setShowDayOffDropdown(!showDayOffDropdown)}
                    >
                      <Text style={styles.dropdownButtonText}>{dayOffType}</Text>
                      <MaterialIcons name="arrow-drop-down" size={24} color="#666" />
                    </TouchableOpacity>
                    
                    {showDayOffDropdown && (
                      <View style={styles.dropdown}>
                        {DAY_OFF_TYPES.map((type) => (
                          <TouchableOpacity
                            key={type}
                            style={styles.dropdownItem}
                            onPress={() => {
                              setDayOffType(type);
                              setShowDayOffDropdown(false);
                            }}
                          >
                            <Text style={styles.dropdownItemText}>{type}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  </View>
                )}
              </View>

              {/* Description Section */}
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Description</Text>
                
                {/* Quick Menu Dropdown */}
                {!isDayOff && (
                  <View style={styles.quickMenuContainer}>
                    <TouchableOpacity
                      style={styles.quickMenuButton}
                      onPress={() => setShowDescriptionDropdown(!showDescriptionDropdown)}
                    >
                      <MaterialIcons name="menu" size={20} color="#007AFF" />
                      <Text style={styles.quickMenuButtonText}>Quick Menu</Text>
                      <MaterialIcons name="arrow-drop-down" size={20} color="#666" />
                    </TouchableOpacity>
                    
                    {showDescriptionDropdown && (
                      <View style={styles.quickMenuDropdown}>
                        <ScrollView style={styles.quickMenuScroll} nestedScrollEnabled>
                          {allTemplates.map((template, idx) => (
                            <TouchableOpacity
                              key={idx}
                              style={[
                                styles.quickMenuItem,
                                idx < recentDescriptions.length && styles.recentItem
                              ]}
                              onPress={() => handleDescriptionTemplateSelect(template)}
                            >
                              <Text style={styles.quickMenuItemText}>{template}</Text>
                            </TouchableOpacity>
                          ))}
                        </ScrollView>
                      </View>
                    )}
                  </View>
                )}
                
                <TextInput
                  style={[styles.descriptionInput, isDayOff && styles.disabledInput]}
                  value={isDayOff ? dayOffType : descriptionText}
                  onChangeText={(text) => {
                    if (!isDayOff) {
                      setDescriptionText(text);
                    }
                  }}
                  placeholder={isDayOff ? "Day Off" : "Describe your activities for this day..."}
                  placeholderTextColor="#999"
                  multiline
                  numberOfLines={6}
                  textAlignVertical="top"
                  editable={!isDayOff}
                />
              </View>

              {/* Hours Section */}
              {!isDayOff && (
                <View style={styles.section}>
                  <Text style={styles.sectionLabel}>Hours Worked</Text>
                  {TIME_CATEGORIES.map((category) => (
                    <View key={category} style={styles.inputRow}>
                      <Text style={styles.inputLabel}>{category}</Text>
                      <TextInput
                        style={styles.input}
                        value={timeTrackingInputs[category]?.toString() || '0'}
                        onChangeText={(text) => {
                          const value = parseFloat(text) || 0;
                          setTimeTrackingInputs(prev => ({
                            ...prev,
                            [category]: value
                          }));
                        }}
                        keyboardType="numeric"
                        placeholder="0"
                        selectTextOnFocus={true}
                      />
                    </View>
                  ))}
                  
                  <View style={styles.totalSection}>
                    <Text style={styles.totalLabel}>Total Hours:</Text>
                    <Text style={styles.totalValue}>
                      {Object.values(timeTrackingInputs).reduce((sum, hours) => sum + hours, 0)}
                    </Text>
                  </View>
                </View>
              )}

              {/* Cost Center Selector */}
              {currentEmployee && currentEmployee.selectedCostCenters && currentEmployee.selectedCostCenters.length > 1 && (
                <View style={styles.section}>
                  <Text style={styles.sectionLabel}>Cost Center</Text>
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
  resetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF3B30',
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
    gap: 8,
  },
  resetButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
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
  dayOffBadge: {
    fontSize: 14,
    color: '#FF6B6B',
    fontWeight: '600',
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
  descriptionPreview: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  dayOffText: {
    fontSize: 14,
    color: '#FF6B6B',
    fontWeight: '500',
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
  section: {
    marginBottom: 24,
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: '#007AFF',
    borderRadius: 4,
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxLabel: {
    fontSize: 16,
    color: '#333',
  },
  dropdownContainer: {
    marginTop: 8,
  },
  dropdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 12,
  },
  dropdownButtonText: {
    fontSize: 16,
    color: '#333',
  },
  dropdown: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    marginTop: 4,
    maxHeight: 200,
  },
  dropdownItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  dropdownItemText: {
    fontSize: 16,
    color: '#333',
  },
  quickMenuContainer: {
    marginBottom: 12,
  },
  quickMenuButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E3F2FD',
    borderRadius: 8,
    padding: 12,
    gap: 8,
  },
  quickMenuButtonText: {
    flex: 1,
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '500',
  },
  quickMenuDropdown: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    marginTop: 4,
    maxHeight: 200,
  },
  quickMenuScroll: {
    maxHeight: 200,
  },
  quickMenuItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  recentItem: {
    backgroundColor: '#F5F5F5',
  },
  quickMenuItemText: {
    fontSize: 14,
    color: '#333',
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
  disabledInput: {
    backgroundColor: '#f5f5f5',
    color: '#999',
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
    marginTop: 8,
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
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
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
