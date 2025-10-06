import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  Platform,
  Modal,
  Keyboard,
  TouchableWithoutFeedback,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { MaterialIcons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { DatabaseService } from '../services/database';
import { DistanceService } from '../services/distanceService';
import { MileageEntry, Employee } from '../types';
import { formatLocationForInput } from '../utils/locationFormatter';
import UnifiedHeader from '../components/UnifiedHeader';
import { OxfordHouseSearchInput } from '../components/OxfordHouseSearchInput';
import EnhancedLocationInput from '../components/EnhancedLocationInput';
import { useTips } from '../contexts/TipsContext';
import { TipCard } from '../components/TipCard';
import { DuplicateDetectionService } from '../services/duplicateDetectionService';
import { HoursEstimationService } from '../services/hoursEstimationService';
import { TripPurposeAiService, PurposeSuggestion } from '../services/tripPurposeAiService';
import { AnomalyDetectionService } from '../services/anomalyDetectionService';
import { useNotifications } from '../contexts/NotificationContext';
import { TripChainingAiService, TripChainSuggestion } from '../services/tripChainingAiService';
import TripChainingModal from '../components/TripChainingModal';
import { COST_CENTERS } from '../constants/costCenters';

interface MileageEntryScreenProps {
  navigation: any;
  route: any;
}

export default function MileageEntryScreen({ navigation, route }: MileageEntryScreenProps) {
  const { tips, loadTipsForScreen, dismissTip, markTipAsSeen, showTips, setCurrentEmployee: setTipsEmployee } = useTips();
  const { showAnomalyAlert } = useNotifications();
  const [formData, setFormData] = useState({
    date: new Date(),
    odometerReading: '',
    startLocation: '',
    endLocation: '',
    purpose: '',
    miles: '',
    notes: '',
    isGpsTracked: false,
  });
  
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [currentEmployee, setCurrentEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [calculatingDistance, setCalculatingDistance] = useState(false);
  const [startLocationDetails, setStartLocationDetails] = useState<any>(null);
  const [endLocationDetails, setEndLocationDetails] = useState<any>(null);
  const [lastSavedDate, setLastSavedDate] = useState<Date | null>(null);
  const [showDateContinuePrompt, setShowDateContinuePrompt] = useState(false);
  const [purposeSuggestions, setPurposeSuggestions] = useState<PurposeSuggestion[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [tripChainingSuggestions, setTripChainingSuggestions] = useState<TripChainSuggestion[]>([]);
  const [showTripChainingModal, setShowTripChainingModal] = useState(false);
  const [loadingChainingSuggestions, setLoadingChainingSuggestions] = useState(false);
  const [selectedCostCenter, setSelectedCostCenter] = useState<string>('');
  const [hasStartedGpsToday, setHasStartedGpsToday] = useState(false);
  
  // TextInput refs for keyboard navigation
  const odometerInputRef = useRef<TextInput>(null);
  const purposeInputRef = useRef<TextInput>(null);
  const milesInputRef = useRef<TextInput>(null);
  const notesInputRef = useRef<TextInput>(null);

  useEffect(() => {
    const initializeAndLoad = async () => {
      try {
        // Initialize database first
        await DatabaseService.initDatabase();
        await loadEmployee();
        
        // Check if we're editing an existing entry
        if (route.params?.entryId) {
          setIsEditing(true);
          await loadExistingEntry(route.params.entryId);
        }
      } catch (error) {
        console.error('Error initializing MileageEntryScreen:', error);
      }
    };
    
    initializeAndLoad();
  }, [route.params]);

  // Load purpose suggestions when both locations are entered
  useEffect(() => {
    const loadPurposeSuggestions = async () => {
      if (!currentEmployee || !formData.startLocation || !formData.endLocation || formData.purpose) {
        setPurposeSuggestions([]);
        return;
      }
      
      setLoadingSuggestions(true);
      try {
        const suggestions = await TripPurposeAiService.getSuggestionsForRoute(
          formData.startLocation,
          formData.endLocation,
          currentEmployee.id
        );
        setPurposeSuggestions(suggestions);
      } catch (error) {
        console.error('Error loading purpose suggestions:', error);
        setPurposeSuggestions([]);
      } finally {
        setLoadingSuggestions(false);
      }
    };
    
    loadPurposeSuggestions();
  }, [formData.startLocation, formData.endLocation, formData.purpose, currentEmployee]);

  // Load trip chaining suggestions when both locations are entered
  useEffect(() => {
    const loadTripChainingSuggestions = async () => {
      if (!currentEmployee || !formData.startLocation || !formData.endLocation) {
        setTripChainingSuggestions([]);
        return;
      }
      
      setLoadingChainingSuggestions(true);
      try {
        const suggestions = await TripChainingAiService.analyzeTripForChaining(
          formData.startLocation,
          formData.endLocation,
          currentEmployee.id,
          formData.purpose
        );
        setTripChainingSuggestions(suggestions);
      } catch (error) {
        console.error('Error loading trip chaining suggestions:', error);
        setTripChainingSuggestions([]);
      } finally {
        setLoadingChainingSuggestions(false);
      }
    };
    
    loadTripChainingSuggestions();
  }, [formData.startLocation, formData.endLocation, currentEmployee]);

  const loadEmployee = async () => {
    try {
      const employees = await DatabaseService.getEmployees();
      const employee = employees.find(emp => emp.name === 'Greg Weisz') || employees[0]; // Use Greg Weisz or first employee
      setCurrentEmployee(employee);
      
      // Set employee for tips context and load mileage entry tips
      if (employee) {
        // Initialize cost center
        const costCenter = employee.defaultCostCenter || employee.selectedCostCenters?.[0] || '';
        setSelectedCostCenter(costCenter);
        
        setTipsEmployee(employee);
        if (showTips) {
          await loadTipsForScreen('MileageEntryScreen', 'on_load');
        }
      }
      
      // Set base address as default start location if available
      if (employee?.baseAddress) {
        setFormData(prev => ({
          ...prev,
          startLocation: employee.baseAddress
        }));
      }
      
      // Check if GPS has been started today
      await checkGpsTrackingStatus();
    } catch (error) {
      console.error('Error loading employee:', error);
    }
  };

  const checkGpsTrackingStatus = async () => {
    if (!currentEmployee) return;
    
    try {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const dateStr = today.toISOString().split('T')[0];
      
      const existingReading = await DatabaseService.getDailyOdometerReading(currentEmployee.id, today);
      
      if (existingReading) {
        setHasStartedGpsToday(true);
        // Set the odometer reading from the existing reading
        setFormData(prev => ({
          ...prev,
          odometerReading: existingReading.odometerReading.toString()
        }));
      } else {
        setHasStartedGpsToday(false);
      }
    } catch (error) {
      console.error('Error checking GPS tracking status:', error);
      setHasStartedGpsToday(false);
    }
  };

  const loadExistingEntry = async (entryId: string) => {
    try {
      const entries = await DatabaseService.getMileageEntries();
      const entry = entries.find(e => e.id === entryId);
      
      if (entry) {
        setFormData({
          date: entry.date,
          odometerReading: entry.odometerReading.toString(),
          startLocation: formatLocationForInput(entry.startLocation, entry.startLocationDetails),
          endLocation: formatLocationForInput(entry.endLocation, entry.endLocationDetails),
          purpose: entry.purpose,
          miles: entry.miles.toString(),
          notes: entry.notes || '',
          isGpsTracked: entry.isGpsTracked,
        });
      }
    } catch (error) {
      console.error('Error loading entry:', error);
      Alert.alert('Error', 'Failed to load entry');
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSelectStartLocation = (address: any) => {
    setFormData(prev => ({ ...prev, startLocation: address.name }));
  };

  const handleSelectEndLocation = (address: any) => {
    setFormData(prev => ({ ...prev, endLocation: address.name }));
  };

  const handleSaveStartLocationToFavorites = (name: string, address: string) => {
    setFormData(prev => ({ ...prev, startLocation: name }));
  };

  const handleSaveEndLocationToFavorites = (name: string, address: string) => {
    setFormData(prev => ({ ...prev, endLocation: name }));
  };

  const handleShowTripChainingSuggestions = () => {
    if (tripChainingSuggestions.length > 0) {
      setShowTripChainingModal(true);
    } else {
      Alert.alert(
        'No Suggestions',
        'No trip chaining opportunities found for this route. Try entering different start or end locations.',
        [{ text: 'OK' }]
      );
    }
  };

  const handleApplyTripChainingSuggestion = (suggestion: TripChainSuggestion) => {
    // Apply the suggested route
    if (suggestion.optimizedStops.length > 0) {
      // For multi-stop routes, we'll create a description that includes all stops
      const stopDescriptions = suggestion.optimizedStops.map(stop => 
        `${stop.house.name} for ${stop.purpose}`
      ).join(' to ');
      
      const newDescription = `${formData.startLocation} to ${stopDescriptions} to ${formData.endLocation}`;
      
      setFormData(prev => ({
        ...prev,
        purpose: suggestion.optimizedStops.map(stop => stop.purpose).join(', '),
        notes: `Multi-stop route: ${newDescription}`
      }));
    }
    
    // Show success message
    Alert.alert(
      'Route Applied',
      `Applied ${suggestion.title}. Review the purpose and notes fields.`,
      [{ text: 'OK' }]
    );
  };

  const handleDateChange = (event: any, date?: Date) => {
    console.log('📅 Date picker change:', { event, date });
    if (date) {
      setSelectedDate(date);
    }
  };

  const handleDatePickerConfirm = () => {
    setFormData(prev => ({ ...prev, date: selectedDate }));
    setShowDatePicker(false);
  };

  const handleDatePickerCancel = () => {
    setShowDatePicker(false);
  };

  const handleDatePickerOpen = () => {
    console.log('📅 Opening date picker with date:', formData.date);
    setSelectedDate(formData.date);
    setShowDatePicker(true);
  };

  const calculateDistance = async () => {
    if (!formData.startLocation.trim() || !formData.endLocation.trim()) {
      Alert.alert('Error', 'Please enter both start and end locations first');
      return;
    }

    setCalculatingDistance(true);
    try {
      const distance = await DistanceService.calculateDistance(
        formData.startLocation.trim(),
        formData.endLocation.trim()
      );
      
      setFormData(prev => ({ ...prev, miles: distance.toString() }));
      
      // Get info about the calculation method used
      const info = DistanceService.getDistanceCalculationInfo();
      const methodText = info.hasGoogleMapsApi ? 'Google Maps route' : 'estimated driving distance';
      
      Alert.alert('Success', `Distance calculated: ${distance} miles\n\nMethod: ${methodText}`);
    } catch (error) {
      console.error('Error calculating distance:', error);
      
      // Show more helpful error message
      const errorMessage = error instanceof Error ? error.message : 'Failed to calculate distance. Please check your addresses and try again.';
      
      Alert.alert(
        'Distance Calculation Failed', 
        `${errorMessage}\n\nTip: Try entering more specific addresses or enter the distance manually.`,
        [
          { text: 'OK', style: 'default' },
          { 
            text: 'Test System', 
            style: 'default',
            onPress: testDistanceSystem
          }
        ]
      );
    } finally {
      setCalculatingDistance(false);
    }
  };

  const testDistanceSystem = async () => {
    try {
      const result = await DistanceService.testDistanceCalculation();
      const info = DistanceService.getDistanceCalculationInfo();
      
      if (result.success) {
        Alert.alert(
          'Distance System Test',
          `✅ System working!\n\nMethod: ${info.description}\nTest distance: ${result.testDistance} miles\n\n${info.setupInstructions || 'Google Maps API is configured and working properly.'}`,
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert(
          'Distance System Test',
          `❌ System has issues\n\nError: ${result.error}\n\nMethod: ${info.description}\n\n${info.setupInstructions || 'Please check your internet connection and try again.'}`,
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      Alert.alert('Test Failed', 'Could not test distance calculation system');
    }
  };

  const validateForm = (): boolean => {
    if (!formData.startLocation.trim()) {
      Alert.alert('Validation Error', 'Start location is required');
      return false;
    }
    if (!formData.endLocation.trim()) {
      Alert.alert('Validation Error', 'End location is required');
      return false;
    }
    // Only validate odometer reading on first GPS session of the day
    if (!hasStartedGpsToday) {
      if (!formData.odometerReading.trim() || isNaN(Number(formData.odometerReading)) || Number(formData.odometerReading) < 0) {
        Alert.alert('Validation Error', 'Please enter a valid starting odometer reading');
        return false;
      }
    }
    if (!formData.purpose.trim()) {
      Alert.alert('Validation Error', 'Purpose is required');
      return false;
    }
    if (!formData.miles.trim() || isNaN(Number(formData.miles)) || Number(formData.miles) <= 0) {
      Alert.alert('Validation Error', 'Please calculate or enter a valid number of miles');
      return false;
    }
    return true;
  };

  const handleSave = async () => {
    if (!validateForm() || !currentEmployee) return;

    console.log('💾 Saving mileage entry for employee:', currentEmployee.name, currentEmployee.id);
    console.log('💾 Entry data:', {
      date: formData.date,
      startLocation: formData.startLocation,
      endLocation: formData.endLocation,
      purpose: formData.purpose,
      miles: formData.miles,
      odometerReading: formData.odometerReading
    });

    setLoading(true);
    try {
      // Check if this is the first mileage entry of the day
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const existingReading = await DatabaseService.getDailyOdometerReading(currentEmployee.id, today);
      
      // If no daily odometer reading exists, create one from the current odometer reading
      if (!existingReading && formData.odometerReading) {
        console.log('📝 Creating daily odometer reading from manual entry:', formData.odometerReading);
        await DatabaseService.createDailyOdometerReading({
          employeeId: currentEmployee.id,
          date: today,
          odometerReading: Number(formData.odometerReading),
          notes: 'Auto-captured from first manual mileage entry'
        });
      }

      const entryData = {
        employeeId: currentEmployee.id,
        oxfordHouseId: currentEmployee.oxfordHouseId,
        date: formData.date,
        odometerReading: Number(formData.odometerReading),
        startLocation: formData.startLocation.trim(),
        endLocation: formData.endLocation.trim(),
        startLocationDetails: startLocationDetails,
        endLocationDetails: endLocationDetails,
        purpose: formData.purpose.trim(),
        miles: Number(formData.miles),
        notes: formData.notes.trim(),
        isGpsTracked: formData.isGpsTracked,
        costCenter: selectedCostCenter,
      };

      if (isEditing && route.params?.entryId) {
        await DatabaseService.updateMileageEntry(route.params.entryId, entryData);
        Alert.alert('Success', 'Mileage entry updated successfully');
        navigation.goBack();
      } else {
        // Check for duplicates before saving
        const entryMonth = formData.date.getMonth() + 1;
        const entryYear = formData.date.getFullYear();
        const recentEntries = await DatabaseService.getMileageEntries(
          currentEmployee.id,
          entryMonth,
          entryYear
        );
        
        const duplicateCheck = await DuplicateDetectionService.checkForDuplicate(
          entryData,
          recentEntries
        );
        
        if (duplicateCheck.isDuplicate && duplicateCheck.matchingEntry) {
          // Show duplicate warning
          Alert.alert(
            '🔍 Possible Duplicate Detected',
            `${duplicateCheck.reason}\n\nExisting trip:\n• ${duplicateCheck.matchingEntry.startLocation} to ${duplicateCheck.matchingEntry.endLocation}\n• ${duplicateCheck.matchingEntry.miles} miles\n• ${duplicateCheck.matchingEntry.purpose}\n\nDo you want to save this as a separate trip?`,
            [
              {
                text: 'Cancel',
                style: 'cancel',
              },
              {
                text: 'Save Anyway',
                onPress: async () => {
                  await DatabaseService.createMileageEntry(entryData);
                  Alert.alert('Success', 'Mileage entry created successfully');
                  navigation.goBack();
                },
              },
            ]
          );
        } else {
          // No duplicate, save normally
          await DatabaseService.createMileageEntry(entryData);
          
          // Run anomaly detection BEFORE showing success alert
          let anomalyMessage = '';
          try {
            console.log('🔍 Running anomaly detection for new entry...');
            const anomalies = await AnomalyDetectionService.detectMileageAnomaly(
              currentEmployee.id,
              entryData as MileageEntry
            );
            
            if (anomalies.length > 0) {
              console.log('🚨 Anomalies detected:', anomalies.length);
              const alerts = AnomalyDetectionService.generateAlerts(
                currentEmployee.id,
                anomalies,
                'mileage'
              );
              
              // Build anomaly message for the success alert
              anomalyMessage = '\n\n⚠️ Smart Alert:\n' + alerts.map(alert => `• ${alert.message}`).join('\n');
              
              // Also show the detailed anomaly alert
              showAnomalyAlert(anomalies, 'Mileage');
            } else {
              console.log('✅ No anomalies detected');
            }
          } catch (error) {
            console.error('❌ Error running anomaly detection:', error);
          }
          
          // Remember the date for smart defaulting
          setLastSavedDate(formData.date);
          
          // Show success alert with anomaly info (if any)
          Alert.alert(
            'Success',
            `Mileage entry created successfully${anomalyMessage}`,
            [
              { text: 'Done', onPress: () => navigation.goBack() },
              {
                text: 'Add Another',
                onPress: () => {
                  // Calculate ending odometer for next trip
                  const lastOdometer = Number(formData.odometerReading) || 0;
                  const lastMiles = Number(formData.miles) || 0;
                  const nextOdometer = lastOdometer + lastMiles;
                  
                  // Reset form but keep date and use last ending location as new start
                  setFormData({
                    date: formData.date, // Keep same date
                    odometerReading: nextOdometer > 0 ? nextOdometer.toString() : '',
                    startLocation: formData.endLocation, // Previous end becomes new start!
                    endLocation: '',
                    purpose: '',
                    miles: '',
                    notes: '',
                    isGpsTracked: false,
                  });
                  // Previous end location details become new start location details
                  setStartLocationDetails(endLocationDetails);
                  setEndLocationDetails(null);
                },
              },
            ]
          );
        }
      }
    } catch (error) {
      console.error('Error saving entry:', error);
      Alert.alert('Error', 'Failed to save mileage entry');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = () => {
    if (!isEditing || !route.params?.entryId) return;

    Alert.alert(
      'Delete Entry',
      'Are you sure you want to delete this mileage entry?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await DatabaseService.deleteMileageEntry(route.params.entryId);
              Alert.alert('Success', 'Mileage entry deleted successfully');
              navigation.goBack();
            } catch (error) {
              console.error('Error deleting entry:', error);
              Alert.alert('Error', 'Failed to delete mileage entry');
            }
          },
        },
      ]
    );
  };

  const handleCancel = () => {
    // Check if there's unsaved data
    const hasData = formData.startLocation || formData.endLocation || 
                    formData.purpose || formData.miles || formData.odometerReading;
    
    if (hasData && !isEditing) {
      Alert.alert(
        'Discard Changes?',
        'You have unsaved data. Are you sure you want to go back?',
        [
          { text: 'Keep Editing', style: 'cancel' },
          { text: 'Discard', style: 'destructive', onPress: () => navigation.goBack() },
        ]
      );
    } else {
      navigation.goBack();
    }
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View style={styles.container}>
      <UnifiedHeader
        title={isEditing ? 'Edit Entry' : 'Add Mileage Entry'}
        showBackButton={true}
        onBackPress={handleCancel}
        rightButton={isEditing ? {
          icon: 'delete',
          onPress: handleDelete,
          color: '#fff'
        } : undefined}
      />

      <ScrollView 
        style={styles.content} 
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
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

        {/* Date Picker */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Date</Text>
          <TouchableOpacity
            style={styles.dateButton}
            onPress={handleDatePickerOpen}
          >
            <Text style={styles.dateText}>
              {formData.date.toLocaleDateString()}
            </Text>
            <MaterialIcons name="calendar-today" size={20} color="#666" />
          </TouchableOpacity>
        </View>

        {/* Date Picker Modal */}
        {showDatePicker && (
          <Modal
            visible={showDatePicker}
            transparent={true}
            animationType="slide"
            onRequestClose={handleDatePickerCancel}
          >
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Select Date</Text>
                  <TouchableOpacity onPress={handleDatePickerCancel}>
                    <MaterialIcons name="close" size={24} color="#666" />
                  </TouchableOpacity>
                </View>
                
                <View style={styles.datePickerContainer}>
                  <DateTimePicker
                    value={selectedDate}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={handleDateChange}
                    style={styles.datePicker}
                    themeVariant="light"
                    textColor="#000000"
                    accentColor="#2196F3"
                  />
                </View>
                
                <View style={styles.modalButtons}>
                  <TouchableOpacity 
                    style={styles.modalCancelButton} 
                    onPress={handleDatePickerCancel}
                  >
                    <Text style={styles.modalCancelButtonText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={styles.modalConfirmButton} 
                    onPress={handleDatePickerConfirm}
                  >
                    <Text style={styles.modalConfirmButtonText}>Done</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>
        )}

        {/* Odometer Reading - only show input on first session of day */}
        {!hasStartedGpsToday ? (
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Starting Odometer Reading *</Text>
            <TextInput
              ref={odometerInputRef}
              style={styles.input}
              value={formData.odometerReading}
              onChangeText={(value) => handleInputChange('odometerReading', value)}
              placeholder="e.g., 12345"
              keyboardType="numeric"
              placeholderTextColor="#999"
              returnKeyType="next"
              blurOnSubmit={false}
              onSubmitEditing={() => {
                purposeInputRef.current?.focus();
              }}
            />
            <Text style={styles.helpText}>
              Enter the odometer reading at the start of this trip
            </Text>
          </View>
        ) : (
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Daily Starting Odometer</Text>
            <View style={styles.odometerDisplay}>
              <Text style={styles.odometerValue}>{formData.odometerReading}</Text>
              <Text style={styles.odometerNote}>
                Set from first GPS session today
              </Text>
            </View>
          </View>
        )}

        {/* Start Location */}
        <EnhancedLocationInput
          value={formData.startLocation}
          onChangeText={(value) => handleInputChange('startLocation', value)}
          onLocationDetailsChange={setStartLocationDetails}
          placeholder="Enter start location..."
          label="Start Location"
          isRequired={true}
          showLocationDetails={true}
        />

        {/* End Location */}
        <EnhancedLocationInput
          value={formData.endLocation}
          onChangeText={(value) => handleInputChange('endLocation', value)}
          onLocationDetailsChange={setEndLocationDetails}
          placeholder="Enter end location..."
          label="End Location"
          isRequired={true}
          showLocationDetails={true}
        />

        {/* Purpose */}
        <View style={styles.inputGroup}>
          <View style={styles.purposeHeader}>
            <Text style={styles.label}>Purpose *</Text>
            {loadingSuggestions && (
              <View style={styles.loadingBadge}>
                <MaterialIcons name="auto-awesome" size={12} color="#2196F3" />
                <Text style={styles.loadingText}>Finding suggestions...</Text>
              </View>
            )}
          </View>
          
          <TextInput
            ref={purposeInputRef}
            style={styles.input}
            value={formData.purpose}
            onChangeText={(value) => handleInputChange('purpose', value)}
            placeholder="e.g., Client visit, Meeting, Training"
            placeholderTextColor="#999"
            returnKeyType="next"
            blurOnSubmit={false}
            onSubmitEditing={() => {
              milesInputRef.current?.focus();
            }}
          />
          
          {/* AI Purpose Suggestions */}
          {purposeSuggestions.length > 0 && !formData.purpose && (
            <View style={styles.purposeSuggestionsContainer}>
              <View style={styles.purposeSuggestionsHeader}>
                <MaterialIcons name="auto-awesome" size={16} color="#FF9800" />
                <Text style={styles.purposeSuggestionsTitle}>AI Suggestions</Text>
              </View>
              {purposeSuggestions.map((suggestion, index) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.purposeSuggestionItem,
                    index === 0 && styles.purposeSuggestionItemTop
                  ]}
                  onPress={() => {
                    handleInputChange('purpose', suggestion.purpose);
                    TripPurposeAiService.recordPurposeSelection(
                      formData.startLocation,
                      formData.endLocation,
                      suggestion.purpose,
                      true
                    );
                  }}
                >
                  <View style={styles.purposeSuggestionContent}>
                    <Text style={styles.purposeSuggestionText}>{suggestion.purpose}</Text>
                    <Text style={styles.purposeSuggestionReason}>{suggestion.reasoning}</Text>
                  </View>
                  <View style={[
                    styles.confidenceBadge,
                    index === 0 && styles.confidenceBadgeTop
                  ]}>
                    <Text style={styles.confidenceText}>
                      {Math.round(suggestion.confidence * 100)}%
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Miles */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Miles *</Text>
          <View style={styles.milesContainer}>
            <TextInput
              ref={milesInputRef}
              style={[styles.input, styles.milesInput]}
              value={formData.miles}
              onChangeText={(value) => handleInputChange('miles', value)}
              placeholder="0.0"
              keyboardType="numeric"
              placeholderTextColor="#999"
              returnKeyType="next"
              blurOnSubmit={false}
              onSubmitEditing={() => {
                notesInputRef.current?.focus();
              }}
            />
            <View style={styles.buttonContainer}>
              <TouchableOpacity
                style={[styles.calculateButton, calculatingDistance && styles.calculateButtonDisabled]}
                onPress={calculateDistance}
                disabled={calculatingDistance}
              >
                <MaterialIcons 
                  name="calculate" 
                  size={20} 
                  color={calculatingDistance ? "#999" : "#2196F3"} 
                />
                <Text style={[styles.calculateButtonText, calculatingDistance && styles.calculateButtonTextDisabled]}>
                  {calculatingDistance ? 'Calculating...' : 'Calculate'}
                </Text>
              </TouchableOpacity>
              
              {/* Trip Chaining Button */}
              {formData.startLocation && formData.endLocation && (
                <TouchableOpacity
                  style={[
                    styles.tripChainingButton,
                    loadingChainingSuggestions && styles.tripChainingButtonDisabled
                  ]}
                  onPress={handleShowTripChainingSuggestions}
                  disabled={loadingChainingSuggestions}
                >
                  <MaterialIcons 
                    name="route" 
                    size={20} 
                    color={loadingChainingSuggestions ? "#999" : "#4CAF50"} 
                  />
                  <Text style={[
                    styles.tripChainingButtonText,
                    loadingChainingSuggestions && styles.tripChainingButtonTextDisabled
                  ]}>
                    {loadingChainingSuggestions ? 'Analyzing...' : 
                     tripChainingSuggestions.length > 0 ? 
                     `Optimize (${tripChainingSuggestions.length})` : 'Optimize'}
                  </Text>
                </TouchableOpacity>
              )}
              
              <TouchableOpacity
                style={styles.testButton}
                onPress={testDistanceSystem}
              >
                <MaterialIcons 
                  name="bug-report" 
                  size={16} 
                  color="#FF9800" 
                />
                <Text style={styles.testButtonText}>Test</Text>
              </TouchableOpacity>
            </View>
          </View>
          <Text style={styles.helpText}>
            Enter miles manually or tap "Calculate" to auto-calculate using Google Maps
          </Text>
        </View>

        {/* Notes */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Notes (Optional)</Text>
          <TextInput
            ref={notesInputRef}
            style={[styles.input, styles.textArea]}
            value={formData.notes}
            onChangeText={(value) => handleInputChange('notes', value)}
            placeholder="Additional notes about this trip..."
            placeholderTextColor="#999"
            multiline
            numberOfLines={3}
            returnKeyType="done"
            blurOnSubmit={true}
          />
        </View>

        {/* Cost Center Selector - only show if user has multiple cost centers */}
        {currentEmployee && currentEmployee.selectedCostCenters && currentEmployee.selectedCostCenters.length > 1 && (
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Cost Center</Text>
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

        {/* Save Button */}
        <TouchableOpacity
          style={[styles.saveButton, loading && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={loading}
        >
          <Text style={styles.saveButtonText}>
            {loading ? 'Saving...' : (isEditing ? 'Update Entry' : 'Save Entry')}
          </Text>
        </TouchableOpacity>
      </ScrollView>
      
      {/* Trip Chaining Modal */}
      <TripChainingModal
        visible={showTripChainingModal}
        onClose={() => setShowTripChainingModal(false)}
        suggestions={tripChainingSuggestions}
        onApplySuggestion={handleApplyTripChainingSuggestion}
        startLocation={formData.startLocation}
        endLocation={formData.endLocation}
      />
      </View>
    </TouchableWithoutFeedback>
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
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#333',
    flex: 1,
  },
  inputWithButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  selectorButton: {
    marginLeft: 8,
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#e3f2fd',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  dateButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dateText: {
    fontSize: 16,
    color: '#333',
  },
  saveButton: {
    backgroundColor: '#4CAF50',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 40,
  },
  saveButtonDisabled: {
    backgroundColor: '#ccc',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  milesContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  milesInput: {
    flex: 1,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  calculateButton: {
    backgroundColor: '#E3F2FD',
    borderWidth: 1,
    borderColor: '#2196F3',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  calculateButtonDisabled: {
    backgroundColor: '#f5f5f5',
    borderColor: '#ddd',
  },
  calculateButtonText: {
    color: '#2196F3',
    fontSize: 14,
    fontWeight: '600',
  },
  calculateButtonTextDisabled: {
    color: '#999',
  },
  tripChainingButton: {
    backgroundColor: '#E8F5E8',
    borderWidth: 1,
    borderColor: '#4CAF50',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  tripChainingButtonDisabled: {
    backgroundColor: '#f5f5f5',
    borderColor: '#ddd',
  },
  tripChainingButtonText: {
    color: '#4CAF50',
    fontSize: 14,
    fontWeight: '600',
  },
  tripChainingButtonTextDisabled: {
    color: '#999',
  },
  testButton: {
    backgroundColor: '#FFF3E0',
    borderWidth: 1,
    borderColor: '#FF9800',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  testButtonText: {
    color: '#FF9800',
    fontSize: 12,
    fontWeight: '600',
  },
  helpText: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
    fontStyle: 'italic',
  },
  suggestionChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
    alignItems: 'center',
  },
  suggestionLabel: {
    fontSize: 13,
    color: '#666',
    fontWeight: '500',
    marginRight: 4,
  },
  suggestionChip: {
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  suggestionChipRecommended: {
    backgroundColor: '#FFF3E0',
    borderColor: '#FF9800',
  },
  suggestionChipText: {
    fontSize: 13,
    color: '#333',
    fontWeight: '500',
  },
  suggestionChipTextRecommended: {
    color: '#FF9800',
    fontWeight: '600',
  },
  purposeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  loadingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  loadingText: {
    fontSize: 11,
    color: '#2196F3',
    marginLeft: 4,
    fontWeight: '500',
  },
  purposeSuggestionsContainer: {
    marginTop: 12,
    backgroundColor: '#FFF9E6',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#FFE082',
    overflow: 'hidden',
  },
  purposeSuggestionsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#FFF3CD',
    borderBottomWidth: 1,
    borderBottomColor: '#FFE082',
  },
  purposeSuggestionsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#F57C00',
    marginLeft: 6,
  },
  purposeSuggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#FFE082',
    backgroundColor: '#fff',
  },
  purposeSuggestionItemTop: {
    backgroundColor: '#FFFBF0',
  },
  purposeSuggestionContent: {
    flex: 1,
  },
  purposeSuggestionText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  purposeSuggestionReason: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
  },
  confidenceBadge: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 12,
  },
  confidenceBadgeTop: {
    backgroundColor: '#FF9800',
  },
  confidenceText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  // Modal styles
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
    minHeight: 400,
    alignItems: 'center',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  datePickerContainer: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    marginVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
    width: '100%',
  },
  datePicker: {
    height: 200,
    width: '100%',
    backgroundColor: 'transparent',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
    gap: 10,
  },
  modalCancelButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
  },
  modalCancelButtonText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  modalConfirmButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#2196F3',
    alignItems: 'center',
  },
  modalConfirmButtonText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
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
  
  // Cost Center Selector Styles
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
  
  // Odometer Display Styles
  odometerDisplay: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  odometerValue: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
    marginBottom: 4,
  },
  odometerNote: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    fontStyle: 'italic',
  },
});
