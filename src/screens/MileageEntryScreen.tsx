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
  KeyboardAvoidingView,
  FlatList,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { MaterialIcons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { DatabaseService } from '../services/database';
import { DistanceService } from '../services/distanceService';
import { MileageEntry, Employee, LocationDetails } from '../types';
import LocationCaptureModal from '../components/LocationCaptureModal';
import { formatLocationForInput } from '../utils/locationFormatter';
import UnifiedHeader from '../components/UnifiedHeader';
import { OxfordHouseSearchInput } from '../components/OxfordHouseSearchInput';
import { OxfordHouseService } from '../services/oxfordHouseService';
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
  const [hasExistingEntriesToday, setHasExistingEntriesToday] = useState(false);
  
  // Location selection modal states
  const [showLocationOptionsModal, setShowLocationOptionsModal] = useState(false);
  const [showStartLocationModal, setShowStartLocationModal] = useState(false);
  const [showEndLocationModal, setShowEndLocationModal] = useState(false);
  const [showOxfordHouseSearchModal, setShowOxfordHouseSearchModal] = useState(false);
  const [currentLocationType, setCurrentLocationType] = useState<'start' | 'end'>('start');
  const [savedAddresses, setSavedAddresses] = useState<any[]>([]);
  const [lastDestination, setLastDestination] = useState<LocationDetails | null>(null);
  
  // Oxford House search states
  const [oxfordHouseSearchQuery, setOxfordHouseSearchQuery] = useState('');
  const [oxfordHouseResults, setOxfordHouseResults] = useState<any[]>([]);
  const [oxfordHouseAllHouses, setOxfordHouseAllHouses] = useState<any[]>([]); // Store full list separately
  const [oxfordHouseLoading, setOxfordHouseLoading] = useState(false);
  const [oxfordHouseSelectedState, setOxfordHouseSelectedState] = useState<string>('');
  const [oxfordHouseAvailableStates, setOxfordHouseAvailableStates] = useState<string[]>([]);
  const [isOxfordHouseStatePickerVisible, setIsOxfordHouseStatePickerVisible] = useState(false);
  
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
        
        // Check if a saved address was selected
        if (route.params?.selectedAddress) {
          const address = route.params.selectedAddress;
          const locType = route.params.locationType;
          
          if (locType === 'start') {
            setFormData(prev => ({ ...prev, startLocation: address.name }));
            setStartLocationDetails({
              name: address.name,
              address: address.address,
              latitude: address.latitude,
              longitude: address.longitude
            });
          } else if (locType === 'end') {
            setFormData(prev => ({ ...prev, endLocation: address.name }));
            setEndLocationDetails({
              name: address.name,
              address: address.address,
              latitude: address.latitude,
              longitude: address.longitude
            });
          }
          
          // Clear the route params to prevent re-applying on next render
          navigation.setParams({ selectedAddress: undefined, locationType: undefined });
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
      const currentEmployee = await DatabaseService.getCurrentEmployee();
      if (currentEmployee) {
        setCurrentEmployee(currentEmployee);
        
        // Initialize cost center
        const costCenter = currentEmployee.defaultCostCenter || currentEmployee.selectedCostCenters?.[0] || '';
        setSelectedCostCenter(costCenter);
        
        setTipsEmployee(currentEmployee);
        if (showTips) {
          await loadTipsForScreen('MileageEntryScreen', 'on_load');
        }
        
        // Set base address as default start location if available
        if (currentEmployee.baseAddress) {
          setFormData(prev => ({
            ...prev,
            startLocation: currentEmployee.baseAddress
          }));
        }
        
        // Check if GPS has been started today
        await checkGpsTrackingStatus();
        
        // Check for existing entries on the current date
        await checkExistingEntriesForDate(formData.date);
        
        // Load saved addresses and last destination
        await loadAddressesAndLastDestination(currentEmployee);
      }
    } catch (error) {
      console.error('Error loading current employee:', error);
    }
  };

  const loadAddressesAndLastDestination = async (employee: Employee) => {
    try {
      // Load saved addresses
      const addresses = await DatabaseService.getSavedAddresses(employee.id);
      setSavedAddresses(addresses);
      
      // Get last destination from recent mileage entries
      const recentEntries = await DatabaseService.getMileageEntries(employee.id, 1); // Get last 1 entry
      if (recentEntries.length > 0) {
        const lastEntry = recentEntries[0];
        if (lastEntry.endLocationDetails) {
          setLastDestination(lastEntry.endLocationDetails);
        }
      }
    } catch (error) {
      console.error('Error loading addresses and last destination:', error);
    }
  };

  const checkExistingEntriesForDate = async (date: Date) => {
    if (!currentEmployee) return;
    
    try {
      const dateStr = date.toISOString().split('T')[0];
      const entries = await DatabaseService.getMileageEntries(currentEmployee.id);
      
      // Filter entries for the selected date
      const entriesForDate = entries.filter(entry => {
        const entryDate = new Date(entry.date);
        const entryDateStr = entryDate.toISOString().split('T')[0];
        return entryDateStr === dateStr;
      });
      
      setHasExistingEntriesToday(entriesForDate.length > 0);
      
      // If there are existing entries and we're not editing, set the odometer reading from the first entry
      if (entriesForDate.length > 0 && !isEditing) {
        const firstEntry = entriesForDate[0];
        setFormData(prev => ({
          ...prev,
          odometerReading: firstEntry.odometerReading?.toString() || ''
        }));
      }
    } catch (error) {
      console.error('Error checking existing entries for date:', error);
      setHasExistingEntriesToday(false);
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

  // Helper function to filter out placeholder text
  const filterPlaceholderText = (value: string): string => {
    if (!value) return '';
    const placeholderTexts = ['to be updated', 'tbd', 'n/a', 'none', 'null', 'undefined'];
    const isPlaceholder = placeholderTexts.includes(value.toLowerCase().trim());
    return isPlaceholder ? '' : value;
  };

  const loadExistingEntry = async (entryId: string) => {
    try {
      const entries = await DatabaseService.getMileageEntries();
      const entry = entries.find(e => e.id === entryId);
      
      if (entry) {
        setFormData({
          date: entry.date,
          odometerReading: entry.odometerReading.toString(),
          startLocation: filterPlaceholderText(formatLocationForInput(entry.startLocation, entry.startLocationDetails)),
          endLocation: filterPlaceholderText(formatLocationForInput(entry.endLocation, entry.endLocationDetails)),
          purpose: entry.purpose,
          miles: entry.miles.toString(),
          notes: filterPlaceholderText(entry.notes || ''),
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

  // Location selection handlers
  const handleLocationSelection = (locationType: 'start' | 'end') => {
    setCurrentLocationType(locationType);
    setShowLocationOptionsModal(true);
  };

  const handleLocationOption = (option: 'lastDestination' | 'baseAddress' | 'favoriteAddresses' | 'oxfordHouse' | 'newLocation') => {
    setShowLocationOptionsModal(false);
    
    setTimeout(() => {
      if (option === 'lastDestination' && lastDestination) {
        // Use last destination
        if (currentLocationType === 'start') {
          setFormData(prev => ({ ...prev, startLocation: lastDestination.name }));
          setStartLocationDetails(lastDestination);
        } else {
          setFormData(prev => ({ ...prev, endLocation: lastDestination.name }));
          setEndLocationDetails(lastDestination);
        }
      } else if (option === 'baseAddress' && currentEmployee?.baseAddress) {
        // Use base address - format as "BA" for display
        if (currentLocationType === 'start') {
          setFormData(prev => ({ ...prev, startLocation: 'BA' }));
          setStartLocationDetails({
            name: 'BA',
            address: currentEmployee.baseAddress
          });
        } else {
          setFormData(prev => ({ ...prev, endLocation: 'BA' }));
          setEndLocationDetails({
            name: 'BA',
            address: currentEmployee.baseAddress
          });
        }
      } else if (option === 'favoriteAddresses') {
        // Navigate to saved addresses screen with context
        navigation.navigate('SavedAddresses', { 
          fromMileageEntry: true,
          locationType: currentLocationType 
        });
      } else if (option === 'oxfordHouse') {
        // Show Oxford House search modal
        setShowOxfordHouseSearchModal(true);
      } else if (option === 'newLocation') {
        // Show manual location entry modal
        if (currentLocationType === 'start') {
          setShowStartLocationModal(true);
        } else {
          setShowEndLocationModal(true);
        }
      }
    }, 100);
  };

  const handleLocationConfirm = (locationDetails: LocationDetails) => {
    if (currentLocationType === 'start') {
      setFormData(prev => ({ ...prev, startLocation: locationDetails.name }));
      setStartLocationDetails(locationDetails);
    } else {
      setFormData(prev => ({ ...prev, endLocation: locationDetails.name }));
      setEndLocationDetails(locationDetails);
    }
    
    setShowStartLocationModal(false);
    setShowEndLocationModal(false);
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
    // Check for existing entries on the selected date
    checkExistingEntriesForDate(selectedDate);
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
                  
                  // Note: Auto-sync service will handle syncing to backend automatically
                  console.log('✅ Mileage entry saved locally (duplicate override), auto-sync will handle backend');
                  
                  Alert.alert('Success', 'Mileage entry created successfully');
                  navigation.goBack();
                },
              },
            ]
          );
        } else {
          // No duplicate, save normally
          await DatabaseService.createMileageEntry(entryData);
          
          // Note: Auto-sync service will handle syncing to backend automatically
          console.log('✅ Mileage entry saved locally, auto-sync will handle backend');
          
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

  // Oxford House search functions
  const loadOxfordHouses = async () => {
    try {
      setOxfordHouseLoading(true);
      await OxfordHouseService.initializeOxfordHouses();
      const houses = await OxfordHouseService.getAllOxfordHouses();
      
      // Store the full list of houses
      setOxfordHouseAllHouses(houses);
      
      // Extract unique states from houses
      const states = Array.from(new Set(houses.map(h => h.state))).sort();
      setOxfordHouseAvailableStates(states);
      
      // Set default state filter based on employee's base address
      if (currentEmployee?.baseAddress) {
        const extractedState = OxfordHouseService.extractStateFromAddress(currentEmployee.baseAddress);
        if (extractedState && states.includes(extractedState)) {
          setOxfordHouseSelectedState(extractedState);
          const filteredHouses = houses.filter(h => h.state === extractedState);
          setOxfordHouseResults(filteredHouses);
        } else {
          setOxfordHouseResults(houses);
        }
      } else {
        setOxfordHouseResults(houses);
      }
    } catch (error) {
      console.error('Error loading Oxford Houses:', error);
    } finally {
      setOxfordHouseLoading(false);
    }
  };

  const performOxfordHouseSearch = (query: string) => {
    if (!query.trim()) {
      // If no query, show all houses or filtered by state
      if (oxfordHouseSelectedState) {
        const filtered = oxfordHouseAllHouses.filter(h => h.state === oxfordHouseSelectedState);
        setOxfordHouseResults(filtered);
      } else {
        setOxfordHouseResults(oxfordHouseAllHouses);
      }
      return;
    }

    const searchLower = query.toLowerCase().trim();
    // Always search from the full list of houses
    let housesToSearch = oxfordHouseSelectedState
      ? oxfordHouseAllHouses.filter(h => h.state === oxfordHouseSelectedState)
      : oxfordHouseAllHouses;

    const filtered = housesToSearch.filter(house =>
      house.name.toLowerCase().includes(searchLower) ||
      house.address.toLowerCase().includes(searchLower) ||
      house.city.toLowerCase().includes(searchLower) ||
      house.state.toLowerCase().includes(searchLower) ||
      house.zipCode.includes(searchLower)
    );
    setOxfordHouseResults(filtered);
  };

  const handleOxfordHouseStateFilterChange = (state: string) => {
    setOxfordHouseSelectedState(state);
    performOxfordHouseSearch(oxfordHouseSearchQuery);
  };

  const handleOxfordHouseSelect = (house: any) => {
    // Format as "Name (Address, City, State Zip)"
    const formattedLocation = `${house.name} (${house.address}, ${house.city}, ${house.state} ${house.zipCode})`;
    
    if (currentLocationType === 'start') {
      setFormData(prev => ({ ...prev, startLocation: formattedLocation }));
      setStartLocationDetails({
        name: house.name,
        address: house.address,
        city: house.city,
        state: house.state,
        zipCode: house.zipCode,
        latitude: house.latitude,
        longitude: house.longitude
      });
    } else {
      setFormData(prev => ({ ...prev, endLocation: formattedLocation }));
      setEndLocationDetails({
        name: house.name,
        address: house.address,
        city: house.city,
        state: house.state,
        zipCode: house.zipCode,
        latitude: house.latitude,
        longitude: house.longitude
      });
    }
    setShowOxfordHouseSearchModal(false);
  };

  // Load Oxford Houses when modal opens
  useEffect(() => {
    if (showOxfordHouseSearchModal) {
      loadOxfordHouses();
    }
  }, [showOxfordHouseSearchModal]);

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
        removeClippedSubviews={true}
        scrollEventThrottle={16}
        keyboardDismissMode="on-drag"
      >
        {/* Tips Display */}
        {showTips && tips.length > 0 && (
          <View style={styles.tipsContainer}>
            <ScrollView 
              style={styles.tipsScrollView} 
              showsVerticalScrollIndicator={false}
              nestedScrollEnabled={true}
              removeClippedSubviews={true}
              scrollEventThrottle={16}
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
        {!hasStartedGpsToday && !hasExistingEntriesToday ? (
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
                {hasStartedGpsToday 
                  ? 'GPS tracking started today - odometer reading captured automatically'
                  : 'Odometer reading from existing entry for this date'
                }
              </Text>
            </View>
          </View>
        )}

        {/* Start Location */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Start Location *</Text>
          <TouchableOpacity
            style={styles.locationButton}
            onPress={() => handleLocationSelection('start')}
          >
            <View style={styles.locationButtonContent}>
              <MaterialIcons name="location-on" size={20} color="#2196F3" />
              <Text style={styles.locationButtonText}>
                {formData.startLocation || 'Select start location...'}
              </Text>
              <MaterialIcons name="arrow-drop-down" size={20} color="#666" />
            </View>
          </TouchableOpacity>
        </View>

        {/* End Location */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>End Location *</Text>
          <TouchableOpacity
            style={styles.locationButton}
            onPress={() => handleLocationSelection('end')}
          >
            <View style={styles.locationButtonContent}>
              <MaterialIcons name="location-on" size={20} color="#2196F3" />
              <Text style={styles.locationButtonText}>
                {formData.endLocation || 'Select end location...'}
              </Text>
              <MaterialIcons name="arrow-drop-down" size={20} color="#666" />
            </View>
          </TouchableOpacity>
        </View>

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
          <TextInput
            ref={milesInputRef}
            style={styles.input}
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
          
          {/* Action Buttons */}
          <View style={styles.milesButtonContainer}>
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
      
      {/* Location Options Modal */}
      <Modal
        visible={showLocationOptionsModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowLocationOptionsModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              Choose {currentLocationType === 'start' ? 'Starting' : 'Ending'} Location
            </Text>
            <Text style={styles.modalSubtitle}>
              Where are you {currentLocationType === 'start' ? 'starting' : 'ending'} your trip?
            </Text>

            <TouchableOpacity
              style={[styles.locationOptionButton, !lastDestination && styles.disabledButton]}
              onPress={() => handleLocationOption('lastDestination')}
              disabled={!lastDestination}
            >
              <MaterialIcons name="location-on" size={24} color="#4CAF50" />
              <View style={styles.locationOptionText}>
                <Text style={styles.locationOptionTitle}>Start from Last Destination</Text>
                <Text style={styles.locationOptionSubtitle}>
                  {lastDestination ? `${lastDestination.name} (${lastDestination.address})` : 'No previous destination found'}
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.locationOptionButton, !currentEmployee?.baseAddress && styles.disabledButton]}
              onPress={() => handleLocationOption('baseAddress')}
              disabled={!currentEmployee?.baseAddress}
            >
              <MaterialIcons name="home" size={24} color="#2196F3" />
              <View style={styles.locationOptionText}>
                <Text style={styles.locationOptionTitle}>Start from Base Address</Text>
                <Text style={styles.locationOptionSubtitle}>
                  {currentEmployee?.baseAddress || 'No base address set'}
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.locationOptionButton}
              onPress={() => handleLocationOption('favoriteAddresses')}
            >
              <MaterialIcons name="star" size={24} color="#FFC107" />
              <View style={styles.locationOptionText}>
                <Text style={styles.locationOptionTitle}>Choose from Favorite Addresses</Text>
                <Text style={styles.locationOptionSubtitle}>Select from your saved favorite locations</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.locationOptionButton}
              onPress={() => handleLocationOption('oxfordHouse')}
            >
              <MaterialIcons name="home" size={24} color="#9C27B0" />
              <View style={styles.locationOptionText}>
                <Text style={styles.locationOptionTitle}>Search Oxford Houses</Text>
                <Text style={styles.locationOptionSubtitle}>Search and select from Oxford House locations</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.locationOptionButton}
              onPress={() => handleLocationOption('newLocation')}
            >
              <MaterialIcons name="add-location" size={24} color="#FF9800" />
              <View style={styles.locationOptionText}>
                <Text style={styles.locationOptionTitle}>Enter New Location</Text>
                <Text style={styles.locationOptionSubtitle}>Manually enter location name and address</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.modalButtonSecondary}
              onPress={() => setShowLocationOptionsModal(false)}
            >
              <Text style={styles.modalButtonSecondaryText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Start Location Capture Modal */}
      <LocationCaptureModal
        visible={showStartLocationModal}
        onClose={() => setShowStartLocationModal(false)}
        onConfirm={handleLocationConfirm}
        title="Capture Start Location"
        locationType="start"
        currentEmployee={currentEmployee}
      />

      {/* End Location Capture Modal */}
      <LocationCaptureModal
        visible={showEndLocationModal}
        onClose={() => setShowEndLocationModal(false)}
        onConfirm={handleLocationConfirm}
        title="Capture End Location"
        locationType="end"
        currentEmployee={currentEmployee}
      />

      {/* Oxford House Search Modal - Direct Search Interface */}
      <Modal
        visible={showOxfordHouseSearchModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowOxfordHouseSearchModal(false)}
      >
        <KeyboardAvoidingView 
          style={styles.modalContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Search Oxford Houses</Text>
                <TouchableOpacity 
                  onPress={() => setShowOxfordHouseSearchModal(false)}
                  style={styles.closeButton}
                >
                  <MaterialIcons name="close" size={24} color="#666" />
                </TouchableOpacity>
              </View>

              <View style={styles.searchContainer}>
                <TextInput
                  style={styles.searchInput}
                  value={oxfordHouseSearchQuery}
                  onChangeText={(text) => {
                    setOxfordHouseSearchQuery(text);
                    performOxfordHouseSearch(text);
                  }}
                  placeholder="Type house name, city, or address..."
                  placeholderTextColor="#999"
                  autoFocus
                />
                <MaterialIcons name="search" size={24} color="#666" style={styles.searchInputIcon} />
              </View>

              {/* State Filter */}
              {oxfordHouseAvailableStates.length > 0 && (
                <View style={styles.stateFilterContainer}>
                  <Text style={styles.stateFilterLabel}>Filter by State:</Text>
                  <TouchableOpacity
                    style={styles.statePickerButton}
                    onPress={() => setIsOxfordHouseStatePickerVisible(true)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.statePickerText}>
                      {oxfordHouseSelectedState ? oxfordHouseSelectedState : 'All States'}
                    </Text>
                    <MaterialIcons name="arrow-drop-down" size={24} color="#666" />
                  </TouchableOpacity>
                </View>
              )}

              {/* Manual Entry Option */}
              <View style={styles.manualEntryContainer}>
                <TouchableOpacity
                  style={styles.manualEntryButton}
                  onPress={() => {
                    // Handle manual entry - could open a simple text input modal
                    Alert.alert('Manual Entry', 'Manual location entry feature coming soon!');
                  }}
                >
                  <MaterialIcons name="edit" size={20} color="#2196F3" />
                  <Text style={styles.manualEntryText}>Enter location manually</Text>
                </TouchableOpacity>
              </View>

              {/* Results List */}
              {oxfordHouseLoading ? (
                <View style={styles.loadingContainer}>
                  <Text style={styles.loadingText}>Loading Oxford Houses...</Text>
                </View>
              ) : (
                <FlatList
                  data={oxfordHouseResults}
                  keyExtractor={(item) => item.id}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={styles.houseItem}
                      onPress={() => handleOxfordHouseSelect(item)}
                    >
                      <View style={styles.houseInfo}>
                        <Text style={styles.houseName}>{item.name}</Text>
                        <Text style={styles.houseAddress}>{item.address}, {item.city}, {item.state} {item.zipCode}</Text>
                      </View>
                      <MaterialIcons name="chevron-right" size={24} color="#666" />
                    </TouchableOpacity>
                  )}
                  style={styles.resultsList}
                  showsVerticalScrollIndicator={false}
                  ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                      <MaterialIcons name="home" size={48} color="#ccc" />
                      <Text style={styles.emptyText}>No Oxford Houses found</Text>
                      <Text style={styles.emptySubtext}>Try a different search term or enter manually</Text>
                    </View>
                  }
                />
              )}

              {/* State Picker Overlay */}
              {isOxfordHouseStatePickerVisible && (
                <View style={styles.statePickerOverlay}>
                  <View style={styles.statePickerOverlayContent}>
                    <View style={styles.statePickerOverlayHeader}>
                      <Text style={styles.statePickerOverlayTitle}>Select State</Text>
                      <TouchableOpacity 
                        onPress={() => setIsOxfordHouseStatePickerVisible(false)}
                        style={styles.statePickerOverlayCloseButton}
                      >
                        <MaterialIcons name="close" size={24} color="#666" />
                      </TouchableOpacity>
                    </View>
                    
                    <FlatList
                      data={['', ...oxfordHouseAvailableStates]}
                      keyExtractor={(item, index) => index.toString()}
                      renderItem={({ item }) => (
                        <TouchableOpacity
                          style={[
                            styles.statePickerOverlayItem,
                            oxfordHouseSelectedState === item && styles.statePickerOverlayItemSelected
                          ]}
                          onPress={() => {
                            handleOxfordHouseStateFilterChange(item);
                            setIsOxfordHouseStatePickerVisible(false);
                          }}
                        >
                          <Text style={[
                            styles.statePickerOverlayItemText,
                            oxfordHouseSelectedState === item && styles.statePickerOverlayItemTextSelected
                          ]}>
                            {item || 'All States'}
                          </Text>
                          {oxfordHouseSelectedState === item && (
                            <MaterialIcons name="check" size={20} color="#2196F3" />
                          )}
                        </TouchableOpacity>
                      )}
                      style={styles.statePickerOverlayList}
                      ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                          <Text style={styles.emptyText}>Loading states...</Text>
                        </View>
                      }
                    />
                  </View>
                </View>
              )}
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

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
  milesButtonContainer: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
    flexWrap: 'wrap',
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
    height: '80%',
    maxHeight: '80%',
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
  
  // Location Button Styles
  locationButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
  },
  locationButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  locationButtonText: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    marginLeft: 8,
    marginRight: 8,
  },
  
  // Location Options Modal Styles
  modalSubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
  locationOptionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    marginBottom: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  disabledButton: {
    opacity: 0.5,
  },
  locationOptionText: {
    flex: 1,
    marginLeft: 12,
  },
  locationOptionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  locationOptionSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  modalButtonSecondary: {
    marginTop: 20,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2196F3',
    alignItems: 'center',
  },
  modalButtonSecondaryText: {
    color: '#2196F3',
    fontSize: 16,
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
  
  // Oxford House Search Modal Styles
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 20,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    backgroundColor: '#f9f9f9',
  },
  searchInput: {
    flex: 1,
    padding: 12,
    fontSize: 16,
    color: '#333',
  },
  searchInputIcon: {
    padding: 12,
  },
  stateFilterContainer: {
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  stateFilterLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  statePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#2196F3',
    paddingHorizontal: 12,
    paddingVertical: 12,
    height: 50,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  statePickerText: {
    fontSize: 16,
    color: '#333',
    flex: 1,
  },
  manualEntryContainer: {
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  manualEntryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f0f8ff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2196F3',
  },
  manualEntryText: {
    marginLeft: 8,
    fontSize: 16,
    color: '#2196F3',
    fontWeight: '500',
  },
  resultsList: {
    flex: 1,
    width: '100%',
    marginTop: 10,
  },
  houseItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  houseInfo: {
    flex: 1,
  },
  houseName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  houseAddress: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
  },
  closeButton: {
    padding: 4,
  },
  
  // State Picker Overlay Styles
  statePickerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  statePickerOverlayContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    width: '90%',
    maxHeight: '85%',
    minHeight: '70%',
    height: '80%',
  },
  statePickerOverlayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  statePickerOverlayTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  statePickerOverlayCloseButton: {
    padding: 4,
  },
  statePickerOverlayList: {
    flex: 1,
  },
  statePickerOverlayItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    minHeight: 48,
  },
  statePickerOverlayItemSelected: {
    backgroundColor: '#f0f8ff',
  },
  statePickerOverlayItemText: {
    fontSize: 16,
    color: '#333',
    flex: 1,
  },
  statePickerOverlayItemTextSelected: {
    color: '#2196F3',
    fontWeight: '600',
  },
});
