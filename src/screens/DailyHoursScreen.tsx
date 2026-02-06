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
import { UnifiedDayData } from '../services/unifiedDataService';
import { BackendDataService } from '../services/backendDataService';
import { getDailyDescriptionOptions } from '../services/dailyDescriptionOptionsService';
import { Employee } from '../types';
import { COST_CENTERS } from '../constants/costCenters';
import UnifiedHeader from '../components/UnifiedHeader';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface DailyHoursScreenProps {
  navigation: any;
}

const CATEGORY_HOURS_LABELS = [
  'G&A Hours',
  'Holiday Hours',
  'PTO Hours',
  'STD/LTD Hours',
  'PFL/PFML Hours'
] as const;

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
  const [stayedOvernight, setStayedOvernight] = useState(false);
  const [showDayOffDropdown, setShowDayOffDropdown] = useState(false);
  const [showDescriptionDropdown, setShowDescriptionDropdown] = useState(false);
  const [descriptionTemplates, setDescriptionTemplates] = useState<string[]>(DEFAULT_DESCRIPTION_TEMPLATES);
  const [recentDescriptions, setRecentDescriptions] = useState<string[]>([]);
  const [descriptionOptions, setDescriptionOptions] = useState<Array<{ id: string; label: string }>>([]);
  const [showDescriptionPickerModal, setShowDescriptionPickerModal] = useState(false);
  
  // Refs for scroll position management
  const scrollViewRef = useRef<ScrollView>(null);
  const scrollPositionRef = useRef<number>(0);
  const selectedDayIndexRef = useRef<number>(-1);
  const dayLayoutsRef = useRef<Record<string, number>>({});
  const scrollToTodayPendingRef = useRef(false);

  // Load data when month changes
  useEffect(() => {
    loadData();
    loadDescriptionTemplates();
  }, [currentMonth]);

  useEffect(() => {
    getDailyDescriptionOptions().then((opts) => setDescriptionOptions(opts));
  }, []);

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
      
      // Load unified data (hours + descriptions) directly from backend
      const monthData = await BackendDataService.getMonthData(
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
    
    // Initialize day off and stayed overnight state
    const dailyDesc = day as any;
    setIsDayOff(dailyDesc.dayOff || false);
    setDayOffType(dailyDesc.dayOffType || 'Day Off');
    setStayedOvernight(dailyDesc.stayedOvernight ?? false);
    
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
    const costCenter = day.costCenter || currentEmployee?.defaultCostCenter || currentEmployee?.selectedCostCenters?.[0] || '';
    setSelectedCostCenter(costCenter);
    
    setShowEditModal(true);
  };

  const handleClearDay = () => {
    if (!selectedDay || !currentEmployee) return;
    const dayLabel = formatDate(selectedDay.date);
    const employeeId = currentEmployee.id;
    const dateToClear = selectedDay.date;
    const costCenterToUse = selectedCostCenter;
    Alert.alert(
      'Clear this day?',
      `Remove all hours and description for ${dayLabel}. This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear Day',
          style: 'destructive',
          onPress: async () => {
            try {
              const savedScrollPosition = scrollPositionRef.current;
              setShowEditModal(false);
              setSelectedDay(null);
              setDescriptionText('');
              setTimeTrackingInputs({});
              setIsDayOff(false);
              setDayOffType('Day Off');
              // Delete description (empty + not day off)
              await BackendDataService.updateDayDescription(
                employeeId,
                dateToClear,
                '',
                costCenterToUse,
                undefined,
                false,
                undefined,
                selectedDay?.descriptionId
              );
              await BackendDataService.updateDayHours(employeeId, dateToClear, {
                costCenterHours: {},
                hoursBreakdown: { gahours: 0, holidayHours: 0, ptoHours: 0, stdLtdHours: 0, pflPfmlHours: 0 }
              });
              await loadData();
              setTimeout(() => {
                if (scrollViewRef.current && savedScrollPosition >= 0) {
                  scrollViewRef.current.scrollTo({ y: savedScrollPosition, animated: false });
                }
              }, 150);
            } catch (error) {
              if (__DEV__) console.error('DailyHoursScreen: Error clearing day:', error);
              Alert.alert('Error', 'Failed to clear day');
            }
          }
        }
      ]
    );
  };

  const handleSave = async () => {
    if (!selectedDay || !currentEmployee) return;

    try {
      // Save the current scroll position before closing modal
      const savedScrollPosition = scrollPositionRef.current;
      const savedDayIndex = selectedDayIndexRef.current;
      
      // Determine what to save
      // If user unchecks "Day Off" and clears description, delete the entry
      // If user checks "Day Off", save the dayOffType
      // If user enters text (not day off), save the text
      const descriptionToSave = isDayOff ? dayOffType : (descriptionText || '').trim();
      const shouldDelete = !isDayOff && !descriptionToSave;
      
      console.log(`💾 DailyHoursScreen: Saving description for ${selectedDay.date.toISOString()}:`, {
        descriptionToSave,
        shouldDelete,
        isDayOff,
        originalDescription: selectedDay.description
      });
      
      // Save description directly to backend (pass descriptionId for reliable delete/update)
      await BackendDataService.updateDayDescription(
        currentEmployee.id,
        selectedDay.date,
        descriptionToSave,
        selectedCostCenter,
        stayedOvernight,
        isDayOff, // Only set dayOff if user explicitly checked it
        isDayOff ? dayOffType : undefined,
        selectedDay.descriptionId // use id when available so delete/update always targets the right row
      );
      
      if (!isDayOff) {
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
        await BackendDataService.updateDayHours(currentEmployee.id, selectedDay.date, {
          costCenterHours,
          hoursBreakdown
        });
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
      setStayedOvernight(false);
      
      // Reload data from backend (no sync needed - already saved directly)
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

  const isViewingCurrentMonth =
    currentMonth.getMonth() === new Date().getMonth() &&
    currentMonth.getFullYear() === new Date().getFullYear();

  const scrollToToday = () => {
    const now = new Date();
    const todayKey = now.toISOString().split('T')[0];
    if (!isViewingCurrentMonth) {
      setCurrentMonth(new Date(now.getFullYear(), now.getMonth(), 1));
      scrollToTodayPendingRef.current = true;
      return;
    }
    const idx = daysWithData.findIndex(
      (d) => d.date.toISOString().split('T')[0] === todayKey
    );
    if (idx < 0) return;
    const y = dayLayoutsRef.current[todayKey];
    if (typeof y === 'number') {
      scrollViewRef.current?.scrollTo({ y, animated: true });
    } else {
      scrollViewRef.current?.scrollTo({
        y: Math.max(0, idx * 88),
        animated: true,
      });
    }
  };

  useEffect(() => {
    if (!scrollToTodayPendingRef.current || loading || daysWithData.length === 0) return;
    const now = new Date();
    const isCurrent =
      currentMonth.getMonth() === now.getMonth() &&
      currentMonth.getFullYear() === now.getFullYear();
    if (!isCurrent) return;
    scrollToTodayPendingRef.current = false;
    const todayKey = now.toISOString().split('T')[0];
    const id = setTimeout(() => {
      const y = dayLayoutsRef.current[todayKey];
      const idx = daysWithData.findIndex(
        (d) => d.date.toISOString().split('T')[0] === todayKey
      );
      if (typeof y === 'number') {
        scrollViewRef.current?.scrollTo({ y, animated: true });
      } else if (idx >= 0) {
        scrollViewRef.current?.scrollTo({
          y: Math.max(0, idx * 88),
          animated: true,
        });
      }
    }, 200);
    return () => clearTimeout(id);
  }, [loading, daysWithData, currentMonth]);

  if (loading) {
    return (
      <View style={styles.container}>
        <UnifiedHeader
          title="Hours & Description"
          showBackButton
          onBackPress={() => navigation.goBack()}
          onHomePress={() => navigation.navigate('Home')}
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
          onHomePress={() => navigation.navigate('Home')}
        />

        {/* Month Navigation */}
        <View style={styles.monthNavigation}>
          <TouchableOpacity onPress={() => navigateMonth('prev')} style={styles.navButton}>
            <MaterialIcons name="chevron-left" size={24} color="#007AFF" />
          </TouchableOpacity>
          <Text style={styles.monthTitle}>{getMonthName(currentMonth)}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <TouchableOpacity onPress={scrollToToday} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 6, paddingHorizontal: 10, backgroundColor: '#007AFF', borderRadius: 8 }}>
              <MaterialIcons name="today" size={18} color="#fff" style={{ marginRight: 6 }} />
              <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>Go to today</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => navigateMonth('next')} style={styles.navButton}>
              <MaterialIcons name="chevron-right" size={24} color="#007AFF" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Summary */}
        <View style={styles.summary}>
          <Text style={styles.summaryText}>
            {daysWithData.filter(day => hasData(day)).length} days with data • {daysWithData.reduce((sum, day) => sum + day.totalHours, 0)} total hours
          </Text>
          <Text style={styles.instructionText}>
            Tap on any day to enter or edit hours and description
          </Text>
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
              const dateKey = day.date.toISOString().split('T')[0];
              return (
                <View
                  key={day.date.toISOString()}
                  onLayout={(e) => {
                    dayLayoutsRef.current[dateKey] = e.nativeEvent.layout.y;
                  }}
                  collapsable={false}
                >
                <TouchableOpacity
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
                </View>
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
              <View style={styles.modalHeaderSpacer} />
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
                        setDescriptionText(''); // Clear description when unchecking so the stored value is removed on save
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

              {/* Stayed out of town - for per diem eligibility (50+ mi from base) */}
              {!isDayOff && (
                <View style={styles.section}>
                  <View style={styles.checkboxRow}>
                    <TouchableOpacity
                      style={styles.checkbox}
                      onPress={() => setStayedOvernight(!stayedOvernight)}
                    >
                      {stayedOvernight && <MaterialIcons name="check" size={20} color="#007AFF" />}
                    </TouchableOpacity>
                    <Text style={styles.checkboxLabel}>Stayed out of town (50+ miles from base)</Text>
                  </View>
                </View>
              )}

              {/* Description Section */}
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Description</Text>
                
                {!isDayOff && (
                  <>
                    <TouchableOpacity
                      style={styles.descriptionDropdown}
                      onPress={() => setShowDescriptionPickerModal(true)}
                    >
                      <Text style={[styles.descriptionDropdownText, !descriptionText && styles.descriptionDropdownPlaceholder]}>
                        {descriptionText || (descriptionOptions.length === 0 ? 'Loading...' : 'Select description...')}
                      </Text>
                      <MaterialIcons name="arrow-drop-down" size={24} color="#666" />
                    </TouchableOpacity>
                    <Modal
                      visible={showDescriptionPickerModal}
                      transparent
                      animationType="slide"
                      onRequestClose={() => setShowDescriptionPickerModal(false)}
                    >
                      <View style={styles.descriptionPickerOverlay}>
                        <TouchableOpacity
                          style={StyleSheet.absoluteFill}
                          activeOpacity={1}
                          onPress={() => setShowDescriptionPickerModal(false)}
                        />
                        <View style={styles.descriptionPickerContent}>
                          <Text style={styles.descriptionPickerTitle}>Description</Text>
                          <ScrollView style={styles.descriptionPickerList} keyboardShouldPersistTaps="handled">
                            {descriptionOptions.filter((o) => o.label !== 'Other').length === 0 ? (
                              <Text style={styles.descriptionPickerEmpty}>No options configured. Set up Daily Description Options in Admin Portal.</Text>
                            ) : (
                              descriptionOptions.filter((o) => o.label !== 'Other').map((o) => (
                                <TouchableOpacity
                                  key={o.id}
                                  style={[styles.descriptionPickerItem, descriptionText === o.label && styles.descriptionPickerItemSelected]}
                                  onPress={() => {
                                    setDescriptionText(o.label);
                                    setShowDescriptionPickerModal(false);
                                  }}
                                >
                                  <Text style={styles.descriptionPickerItemText}>{o.label}</Text>
                                  {descriptionText === o.label && (
                                    <MaterialIcons name="check" size={20} color="#4CAF50" />
                                  )}
                                </TouchableOpacity>
                              ))
                            )}
                          </ScrollView>
                          <TouchableOpacity style={styles.descriptionPickerClose} onPress={() => setShowDescriptionPickerModal(false)}>
                            <Text style={styles.descriptionPickerCloseText}>Cancel</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    </Modal>
                  </>
                )}
                
                {isDayOff && (
                  <TextInput
                    style={[styles.descriptionInput, styles.disabledInput]}
                    value={dayOffType}
                    editable={false}
                    placeholder="Day Off"
                    placeholderTextColor="#999"
                  />
                )}
              </View>

              {/* Hours Section - per cost center (matches web portal) */}
              {!isDayOff && (
                <View style={styles.section}>
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
                      />
                    </View>
                  ))}
                  <Text style={[styles.sectionLabel, { marginTop: 12 }]}>Other</Text>
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
                      />
                    </View>
                  ))}
                  <View style={styles.totalSection}>
                    <Text style={styles.totalLabel}>Total Hours:</Text>
                    <Text style={styles.totalValue}>
                      {Object.values(timeTrackingInputs).reduce((sum, hours) => sum + (typeof hours === 'number' ? hours : 0), 0)}
                    </Text>
                  </View>
                </View>
              )}

              {/* Save and Clear Day buttons at bottom of form */}
              <View style={styles.modalSaveSection}>
                <TouchableOpacity style={styles.modalSaveButton} onPress={handleSave} activeOpacity={0.8}>
                  <Text style={styles.modalSaveButtonText}>Save</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.modalClearButton} onPress={handleClearDay} activeOpacity={0.8}>
                  <Text style={styles.modalClearButtonText}>Clear Day</Text>
                </TouchableOpacity>
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
  modalHeaderSpacer: {
    minWidth: 56,
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
  modalSaveSection: {
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 32,
    gap: 12,
  },
  modalSaveButton: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSaveButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#fff',
  },
  modalClearButton: {
    marginTop: 12,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#dc3545',
  },
  modalClearButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#dc3545',
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
  descriptionDropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
  },
  descriptionDropdownText: {
    fontSize: 16,
    color: '#333',
  },
  descriptionDropdownPlaceholder: {
    color: '#999',
  },
  descriptionPickerOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  descriptionPickerContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
    maxHeight: '70%',
  },
  descriptionPickerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  descriptionPickerList: {
    maxHeight: 320,
  },
  descriptionPickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  descriptionPickerItemSelected: {
    backgroundColor: 'rgba(76, 175, 80, 0.08)',
  },
  descriptionPickerItemText: {
    fontSize: 16,
    color: '#333',
  },
  descriptionPickerEmpty: {
    fontSize: 14,
    color: '#666',
    paddingVertical: 16,
    paddingHorizontal: 12,
    textAlign: 'center',
  },
  descriptionPickerClose: {
    marginTop: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  descriptionPickerCloseText: {
    fontSize: 16,
    color: '#666',
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
