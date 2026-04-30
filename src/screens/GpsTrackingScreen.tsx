import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  TextInput,
  ScrollView,
  Modal,
  ActivityIndicator,
  Platform,
  FlatList,
  KeyboardAvoidingView,
  Keyboard,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import * as Location from 'expo-location';
import { GpsTrackingService } from '../services/gpsTrackingService';
import { DatabaseService } from '../services/database';
import { GpsTrackingSession, Employee, LocationDetails, OxfordHouse, SavedAddress } from '../types';
import { useGpsTracking } from '../contexts/GpsTrackingContext';
import { formatLocation } from '../utils/locationFormatter';
import LocationCaptureModal from '../components/LocationCaptureModal';
import { TripPurposeAiService, PurposeSuggestion } from '../services/tripPurposeAiService';
import { CostCenterAiService, CostCenterSuggestion } from '../services/costCenterAiService';
import { getTravelReasons, TravelReason } from '../services/travelReasonsService';
import UnifiedHeader from '../components/UnifiedHeader';
import { useTheme } from '../contexts/ThemeContext';
import { COST_CENTERS } from '../constants/costCenters';
import { PreferencesService } from '../services/preferencesService';
import { OxfordHouseService } from '../services/oxfordHouseService';
import {
  filterOxfordHousesForPicker,
  getAvailableOxfordHouseStates,
  getDefaultOxfordHouseSelection,
} from '../utils/oxfordHousePicker';
import { KeyboardAwareScrollView, ScrollToOnFocusView } from '../components/KeyboardAwareScrollView';

interface GpsTrackingScreenProps {
  navigation: any;
  route?: any;
}

type StartLocationOption =
  | 'lastDestination'
  | 'baseAddress'
  | 'favoriteAddresses'
  | 'oxfordHouse'
  | 'newLocation';

type EndLocationOption =
  | 'baseAddress'
  | 'tripStart'
  | 'favoriteAddresses'
  | 'oxfordHouse'
  | 'newLocation';

type StartLocationSuggestion = {
  details: LocationDetails;
  reason: string;
  confidenceLabel: 'Strong match' | 'Address match' | 'Nearby match';
};

export default function GpsTrackingScreen({ navigation, route }: GpsTrackingScreenProps) {
  const { colors } = useTheme();
  const { isTracking, currentSession, startTracking, stopTracking, shouldShowEndLocationModal, setShouldShowEndLocationModal } = useGpsTracking();
  const [currentEmployee, setCurrentEmployee] = useState<Employee | null>(null);
  const [showGpsDuration, setShowGpsDuration] = useState(false);
  const [trackingForm, setTrackingForm] = useState({
    odometerReading: '',
    purpose: '',
    notes: '',
  });
  const [trackingTime, setTrackingTime] = useState(0);
  const [showLocationOptionsModal, setShowLocationOptionsModal] = useState(false);
  const [showStartLocationModal, setShowStartLocationModal] = useState(false);
  const [showEndLocationModal, setShowEndLocationModal] = useState(false);
  /** Same choices as starting a trip (BA, favorites, Oxford search, manual) — not only the free-form capture modal. */
  const [showEndLocationOptionsModal, setShowEndLocationOptionsModal] = useState(false);
  const [isEditingStartLocationOptions, setIsEditingStartLocationOptions] = useState(false);
  const [isEditingEndLocationOptions, setIsEditingEndLocationOptions] = useState(false);
  const [startLocationOptionOrder, setStartLocationOptionOrder] = useState<StartLocationOption[]>([
    'lastDestination',
    'baseAddress',
    'favoriteAddresses',
    'oxfordHouse',
    'newLocation',
  ]);
  const [endLocationOptionOrder, setEndLocationOptionOrder] = useState<EndLocationOption[]>([
    'baseAddress',
    'tripStart',
    'favoriteAddresses',
    'oxfordHouse',
    'newLocation',
  ]);
  const [showOxfordHouseSearchModal, setShowOxfordHouseSearchModal] = useState(false);
  const [oxfordHousePickerRole, setOxfordHousePickerRole] = useState<'start' | 'end'>('start');
  const [manualStartInitialLocation, setManualStartInitialLocation] = useState<Partial<LocationDetails> | null>(null);
  const [manualEndInitialLocation, setManualEndInitialLocation] = useState<Partial<LocationDetails> | null>(null);
  const [oxfordHouseSearchQuery, setOxfordHouseSearchQuery] = useState('');
  const [oxfordHouseResults, setOxfordHouseResults] = useState<any[]>([]);
  const [oxfordHouseAllHouses, setOxfordHouseAllHouses] = useState<any[]>([]);
  const [oxfordHouseLoading, setOxfordHouseLoading] = useState(false);
  const [oxfordHouseSelectedState, setOxfordHouseSelectedState] = useState<string>('');
  const [oxfordHouseAvailableStates, setOxfordHouseAvailableStates] = useState<string[]>([]);
  const [isOxfordHouseStatePickerVisible, setIsOxfordHouseStatePickerVisible] = useState(false);
  const [isDetectingStartSuggestions, setIsDetectingStartSuggestions] = useState(false);
  const [startLocationSuggestions, setStartLocationSuggestions] = useState<
    Partial<Record<StartLocationOption, StartLocationSuggestion>>
  >({});
  const [isDetectingEndSuggestions, setIsDetectingEndSuggestions] = useState(false);
  const [endLocationSuggestions, setEndLocationSuggestions] = useState<
    Partial<Record<EndLocationOption, StartLocationSuggestion>>
  >({});
  const [startLocationDetails, setStartLocationDetails] = useState<LocationDetails | null>(null);
  const [endLocationDetails, setEndLocationDetails] = useState<LocationDetails | null>(null);
  const [lastDestination, setLastDestination] = useState<LocationDetails | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const odometerInputRef = useRef<TextInput>(null);
  const purposeInputRef = useRef<TextInput>(null);
  const notesInputRef = useRef<TextInput>(null);
  const [purposeSuggestions, setPurposeSuggestions] = useState<PurposeSuggestion[]>([]);
  const [showPurposeSuggestions, setShowPurposeSuggestions] = useState(false);
  const [costCenterSuggestions, setCostCenterSuggestions] = useState<CostCenterSuggestion[]>([]);
  const [showCostCenterSuggestions, setShowCostCenterSuggestions] = useState(false);
  const [selectedCostCenter, setSelectedCostCenter] = useState<string>('');
  const [hasStartedGpsToday, setHasStartedGpsToday] = useState(false);
  const [lastTravelDayEndingOdometerNote, setLastTravelDayEndingOdometerNote] = useState('');
  const [isEditingOdometer, setIsEditingOdometer] = useState(false);
  const [travelReasons, setTravelReasons] = useState<TravelReason[]>([]);
  const [showPurposePickerModal, setShowPurposePickerModal] = useState(false);
  const [showCustomPurposeInput, setShowCustomPurposeInput] = useState(false);
  const [isEndingTracking, setIsEndingTracking] = useState(false);
  const [isStartingTracking, setIsStartingTracking] = useState(false);
  // Ref so useFocusEffect does not depend on isTracking — when tracking stops, isTracking flips
  // false and would re-run the effect mid-end-trip, racing checkGpsTrackingStatus with save/goBack (iOS freeze).
  const isTrackingRef = useRef(isTracking);
  isTrackingRef.current = isTracking;
  const lastAppliedEndFromFavoritesRef = useRef<string | null>(null);

  useEffect(() => {
    loadEmployee();
    loadPreferences();
    getTravelReasons().then(setTravelReasons);
    
    // Reset all states when component mounts to prevent stuck modals
    return () => {
      setShowLocationOptionsModal(false);
      setShowStartLocationModal(false);
      setShowEndLocationModal(false);
      setShowEndLocationOptionsModal(false);
      setShowOxfordHouseSearchModal(false);
      setShowPurposeSuggestions(false);
    };
  }, []);

  // Load user preferences
  const loadPreferences = async () => {
    try {
      const prefs = await PreferencesService.getPreferences();
      setShowGpsDuration(prefs.showGpsDuration);
      setStartLocationOptionOrder(
        (prefs.gpsStartLocationOptionOrder?.filter((option): option is StartLocationOption =>
          ['lastDestination', 'baseAddress', 'favoriteAddresses', 'oxfordHouse', 'newLocation'].includes(option)
        ) || ['lastDestination', 'baseAddress', 'favoriteAddresses', 'oxfordHouse', 'newLocation']) as StartLocationOption[]
      );
      setEndLocationOptionOrder(
        (prefs.gpsEndLocationOptionOrder?.filter((option): option is EndLocationOption =>
          ['baseAddress', 'tripStart', 'favoriteAddresses', 'oxfordHouse', 'newLocation'].includes(option)
        ) || ['baseAddress', 'tripStart', 'favoriteAddresses', 'oxfordHouse', 'newLocation']) as EndLocationOption[]
      );
    } catch (error) {
      console.error('Error loading preferences:', error);
    }
  };

  // Reset modal states when screen comes into focus.
  // Do NOT put isTracking in deps — when stopTracking() runs, isTracking becomes false and would
  // re-run this effect while still on this screen, starting checkGpsTrackingStatus in parallel with
  // createMileageEntry + goBack() and freezing iOS.
  useFocusEffect(
    React.useCallback(() => {
      // Check if we should show end modal (from route params)
      if (route?.params?.showEndModal) {
        if (isTrackingRef.current) {
          openEndLocationOptions();
        } else {
          // If tracking state is still hydrating after navigation, queue the end-flow flag.
          setShouldShowEndLocationModal(true);
        }
        // Clear the param so it doesn't show again on next focus
        navigation.setParams({ showEndModal: false });
      } else {
        // Reset all modal states when screen is focused (except if showEndModal param is set)
        setShowLocationOptionsModal(false);
        setShowStartLocationModal(false);
        if (!route?.params?.showEndModal) {
          setShowEndLocationModal(false);
          setShowEndLocationOptionsModal(false);
        }
        setShowOxfordHouseSearchModal(false);
        setShowPurposeSuggestions(false);
      }
      
      // Refresh GPS tracking status in case it's a new day
      if (currentEmployee) {
        checkGpsTrackingStatus(currentEmployee.id);
      }
    }, [currentEmployee, route?.params?.showEndModal, navigation, setShouldShowEndLocationModal])
  );

  // Watch for stop tracking request from global button
  useEffect(() => {
    if (shouldShowEndLocationModal && isTracking) {
      // End flow should mirror start flow: show location choices first.
      openEndLocationOptions();
      setShouldShowEndLocationModal(false); // Reset the flag
    }
  }, [shouldShowEndLocationModal, isTracking, setShouldShowEndLocationModal, currentEmployee, startLocationDetails]);

  // Separate effect for timer that only restarts when session ID changes
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (isTracking && currentSession) {
      // Check if this is a new session
      const isNewSession = sessionIdRef.current !== currentSession.id;
      
      if (isNewSession) {
        console.log('⏰ GPS Screen: New session detected, starting timer:', currentSession.id);
        sessionIdRef.current = currentSession.id;
        setTrackingTime(0); // Reset timer for new session
      }
      
      const startTime = currentSession.startTime.getTime(); // Capture start time
      
      interval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        setTrackingTime(elapsed);
      }, 1000) as any;
    } else {
      sessionIdRef.current = null;
      setTrackingTime(0);
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [isTracking, currentSession?.id]); // Only restart when tracking status or session ID changes

  // Removed: Poll for distance updates - now handled by GpsTrackingContext to avoid duplicate updates

  // Handle selected address from SavedAddressesScreen
  useEffect(() => {
    const autoStartFromSavedAddress = async () => {
      if (route?.params?.selectedAddress && currentEmployee && !isTracking) {
        const selectedAddress = route.params.selectedAddress;
        
        // Validate that we have the required form data
        if (!trackingForm.purpose.trim()) {
          Alert.alert('Missing Information', 'Please enter purpose before selecting a location.');
          navigation.setParams({ selectedAddress: undefined });
          return;
        }
        
        console.log('🚀 GPS: Auto-starting with saved address:', selectedAddress.name);
        console.log('🚀 GPS: Odometer:', trackingForm.odometerReading);
        console.log('🚀 GPS: Purpose:', trackingForm.purpose);
        
        // Set the start location
        const locationDetails = {
          name: selectedAddress.name,
          address: selectedAddress.address,
          latitude: selectedAddress.latitude,
          longitude: selectedAddress.longitude
        };
        setStartLocationDetails(locationDetails);
        
        // Clear the route params to avoid re-triggering
        navigation.setParams({ selectedAddress: undefined });
        
        try {
          setIsStartingTracking(true);
          // Check if this is the first GPS tracking session of the day
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          
          const existingReading = await DatabaseService.getDailyOdometerReading(currentEmployee.id, today);
          
          // If no daily odometer reading exists, create one from the current odometer reading
          if (!existingReading && trackingForm.odometerReading) {
            console.log('📝 Creating daily odometer reading from GPS tracking:', trackingForm.odometerReading);
            await DatabaseService.createDailyOdometerReading({
              employeeId: currentEmployee.id,
              date: today,
              odometerReading: Number(trackingForm.odometerReading),
              notes: 'Auto-captured from first GPS tracking session'
            });
          }

          console.log('🚀 GPS: Calling startTracking with saved address data...');
          await startTracking(
            currentEmployee.id,
            trackingForm.purpose,
            Number(trackingForm.odometerReading),
            trackingForm.notes
          );

          setTrackingTime(0);

          Alert.alert('GPS Tracking Started', 'Your location is now being tracked. Use the red Stop button in the header when you reach your destination.');
        } catch (error) {
          console.error('❌ GPS: Error starting tracking:', error);
          const errorMessage = error instanceof Error ? error.message : 'Failed to start GPS tracking. Please check location permissions.';
          Alert.alert('GPS Tracking Error', errorMessage);
        } finally {
          setIsStartingTracking(false);
        }
      }
    };
    
    autoStartFromSavedAddress();
  }, [route?.params?.selectedAddress, currentEmployee, isTracking]);

  // End trip using an address chosen from Saved Addresses while tracking
  useEffect(() => {
    const end = route?.params?.selectedEndAddress;
    if (!end || !isTracking || !currentEmployee || !currentSession?.id) return;
    const dedupeKey = `${currentSession.id}|${end.name}|${end.address}`;
    if (lastAppliedEndFromFavoritesRef.current === dedupeKey) return;
    lastAppliedEndFromFavoritesRef.current = dedupeKey;
    navigation.setParams({ selectedEndAddress: undefined });
    const details: LocationDetails = {
      name: end.name,
      address: end.address,
      latitude: end.latitude,
      longitude: end.longitude,
    };
    openEndLocationModalWithDetails(details);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- apply once per navigation param + session
  }, [route?.params?.selectedEndAddress, isTracking, currentEmployee, currentSession?.id]);

  const loadEmployee = async () => {
    try {
      const employee = await DatabaseService.getCurrentEmployee();
      if (!employee) {
        console.error('❌ GPS: No current employee found');
        return;
      }
      setCurrentEmployee(employee);
      
      if (employee) {
        // Initialize cost center
        const costCenter = employee.defaultCostCenter || employee.selectedCostCenters?.[0] || '';
        setSelectedCostCenter(costCenter);
        
        // Check if GPS tracking has been started today
        await checkGpsTrackingStatus(employee.id);

        const today = new Date();
        const lastTravelDay = await DatabaseService.getLastTravelDayEndingOdometer(employee.id, today);
        if (lastTravelDay) {
          const dateText = lastTravelDay.date.toLocaleDateString();
          setLastTravelDayEndingOdometerNote(
            `Ending odometer of last travel day (${dateText}): ${Math.round(lastTravelDay.endingOdometer)}`
          );
        } else {
          setLastTravelDayEndingOdometerNote('');
        }
      }
      
      // Set base address as default start location if available
      if (employee?.baseAddress) {
        setStartLocationDetails({
          name: 'BA',
          address: employee.baseAddress,
          source: 'baseAddress',
          latitude: undefined,
          longitude: undefined
        });
      }
      
      // Load last destination from recent entries
      if (employee) {
        console.log('🔍 GPS: Loading recent entries for employee:', employee.name);
        const recentEntries = await DatabaseService.getMileageEntries(employee.id);
        console.log('🔍 GPS: Found', recentEntries.length, 'recent entries');
        
        if (recentEntries.length > 0) {
          const lastEntry = recentEntries[0]; // Most recent entry
          console.log('🔍 GPS: Last entry:', {
            id: lastEntry.id,
            endLocation: lastEntry.endLocation,
            endLocationDetails: lastEntry.endLocationDetails
          });
          
          if (lastEntry.endLocationDetails) {
            console.log('🔍 GPS: Setting last destination:', lastEntry.endLocationDetails.name);
            setLastDestination(lastEntry.endLocationDetails);
          } else {
            console.log('🔍 GPS: No end location details found in last entry');
          }
        } else {
          console.log('🔍 GPS: No recent entries found');
        }
      }
    } catch (error) {
      console.error('Error loading employee:', error);
    }
  };

  const checkGpsTrackingStatus = async (employeeId: string) => {
    try {
      // Use device's local timezone instead of UTC
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      console.log('🚗 GPS: Checking GPS status for date:', today.toISOString().split('T')[0]);
      
      // Check if there's a daily odometer reading for today
      const existingReading = await DatabaseService.getDailyOdometerReading(employeeId, today);
      
      if (existingReading) {
        console.log('🚗 GPS: Daily odometer reading exists, GPS tracking has been started today');
        console.log('🚗 GPS: Current odometer reading:', existingReading.odometerReading);
        setHasStartedGpsToday(true);
        
        // Set the odometer reading from the existing reading
        setTrackingForm(prev => ({
          ...prev,
          odometerReading: existingReading.odometerReading.toString()
        }));
      } else {
        console.log('🚗 GPS: No daily odometer reading found, GPS tracking not started today');
        setHasStartedGpsToday(false);
      }
    } catch (error) {
      console.error('Error checking GPS tracking status:', error);
      setHasStartedGpsToday(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    // Prevent changes to odometer reading if GPS tracking has been started today
    if (field === 'odometerReading' && hasStartedGpsToday && !isEditingOdometer) {
      return;
    }
    
    setTrackingForm(prev => ({ ...prev, [field]: value }));
    
    // If purpose is being entered and we have location details, get AI suggestions
    if (field === 'purpose' && value.length > 2 && startLocationDetails && endLocationDetails) {
      getPurposeSuggestions();
    }
  };

  const handleOdometerSubmit = () => {
    // "Next" should move to the next textbox when one is visible;
    // otherwise dismiss keyboard so picker/buttons are immediately usable.
    if (showCustomPurposeInput && purposeInputRef.current) {
      purposeInputRef.current.focus();
      return;
    }
    Keyboard.dismiss();
  };

  const handleEditOdometer = () => {
    setIsEditingOdometer(true);
  };

  const handleSaveOdometer = async () => {
    try {
      if (!currentEmployee || !trackingForm.odometerReading) {
        Alert.alert('Error', 'Please enter a valid odometer reading');
        return;
      }

      const today = new Date();
      const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      
      console.log('🔧 GPS: Updating odometer reading to:', trackingForm.odometerReading);
      
      // Update the daily odometer reading
      await DatabaseService.updateDailyOdometerReadingByEmployeeAndDate(currentEmployee.id, dateStr, {
        odometerReading: parseFloat(trackingForm.odometerReading),
        notes: 'Updated by user'
      });
      
      console.log('✅ GPS: Odometer reading updated successfully');

      setIsEditingOdometer(false);
      Alert.alert('Success', 'Starting odometer reading updated successfully');
      
      // Refresh the GPS tracking status to get the updated odometer reading
      if (currentEmployee) {
        await checkGpsTrackingStatus(currentEmployee.id);
      }
    } catch (error) {
      console.error('Error updating odometer reading:', error);
      Alert.alert('Error', 'Failed to update odometer reading');
    }
  };

  const handleCancelOdometerEdit = () => {
    setIsEditingOdometer(false);
    // Reload the current odometer reading
    if (currentEmployee) {
      checkGpsTrackingStatus(currentEmployee.id);
    }
  };

  const getPurposeSuggestions = async () => {
    if (!currentEmployee || !startLocationDetails || !endLocationDetails) return;
    
    try {
      const [purposeSuggestions, costCenterSuggestions] = await Promise.all([
        TripPurposeAiService.getSuggestionsForRoute(
          startLocationDetails.name,
          endLocationDetails.name,
          currentEmployee.id
        ),
        CostCenterAiService.getSuggestionsForTrip(
          startLocationDetails.name,
          endLocationDetails.name,
          trackingForm.purpose,
          currentEmployee.id
        )
      ]);
      
      setPurposeSuggestions(purposeSuggestions);
      setShowPurposeSuggestions(purposeSuggestions.length > 0);
      
      setCostCenterSuggestions(costCenterSuggestions);
      setShowCostCenterSuggestions(costCenterSuggestions.length > 0);
    } catch (error) {
      console.error('Error getting AI suggestions:', error);
    }
  };

  const validateForm = (): boolean => {
    // Only validate odometer reading on first GPS session of the day
    if (!hasStartedGpsToday) {
      if (!trackingForm.odometerReading.trim() || isNaN(Number(trackingForm.odometerReading)) || Number(trackingForm.odometerReading) < 0) {
        Alert.alert('Validation Error', 'Please enter a valid starting odometer reading');
        return false;
      }
    }
    
    if (!trackingForm.purpose.trim()) {
      Alert.alert('Validation Error', 'Purpose is required');
      return false;
    }
    
    return true;
  };

  const handleStartTracking = async () => {
    if (!validateForm() || !currentEmployee) return;

    console.log('🔍 GPS: Starting GPS tracking, showing location options');
    openStartLocationOptions();
  };

  const handleLocationOption = (option: 'lastDestination' | 'baseAddress' | 'favoriteAddresses' | 'oxfordHouse' | 'newLocation') => {
    console.log('🔍 GPS: Location option selected:', option);
    console.log('🔍 GPS: Closing location options modal');
    setShowLocationOptionsModal(false);
    
    // Add a small delay to ensure modal closes before proceeding
    setTimeout(() => {
      if (option === 'lastDestination' && lastDestination) {
        console.log('🔍 GPS: Using last destination:', lastDestination.name);
        // Use last destination as starting point
        setStartLocationDetails(lastDestination);
        startGpsTracking();
      } else if (option === 'baseAddress' && currentEmployee?.baseAddress) {
        const suggested = startLocationSuggestions.baseAddress;
        if (suggested) {
          setStartLocationDetails(suggested.details);
        } else {
          console.log('🔍 GPS: Using base address:', currentEmployee.baseAddress);
          setStartLocationDetails({
            name: 'BA',
            address: currentEmployee.baseAddress,
            source: 'baseAddress',
          });
        }
        startGpsTracking();
      } else if (option === 'favoriteAddresses') {
        const suggested = startLocationSuggestions.favoriteAddresses;
        if (suggested) {
          setStartLocationDetails(suggested.details);
          startGpsTracking();
        } else {
          console.log('🔍 GPS: Navigating to favorite addresses');
          navigation.navigate('SavedAddresses', { fromGpsTrackingStart: true });
        }
      } else if (option === 'oxfordHouse') {
        const suggested = startLocationSuggestions.oxfordHouse;
        if (suggested) {
          setStartLocationDetails(suggested.details);
          startGpsTracking();
        } else {
          console.log('🔍 GPS: Showing Oxford House search modal');
          setOxfordHousePickerRole('start');
          setShowOxfordHouseSearchModal(true);
        }
      } else if (option === 'newLocation') {
        console.log('🔍 GPS: Showing manual location entry modal');
        // Show manual location entry modal
        const suggested = startLocationSuggestions.newLocation;
        setManualStartInitialLocation(suggested?.details || null);
        setShowStartLocationModal(true);
      }
    }, 100);
  };

  const moveStartLocationOption = async (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= startLocationOptionOrder.length) return;
    const newOrder = [...startLocationOptionOrder];
    [newOrder[index], newOrder[targetIndex]] = [newOrder[targetIndex], newOrder[index]];
    setStartLocationOptionOrder(newOrder);
    await PreferencesService.updatePreferences({
      gpsStartLocationOptionOrder: newOrder,
    });
  };

  const normalizeAddress = (value: string): string =>
    value
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\b(street|st|road|rd|avenue|ave|boulevard|blvd|drive|dr|lane|ln|court|ct)\b/g, '')
      .replace(/\s+/g, ' ')
      .trim();

  const toRadians = (degrees: number): number => degrees * (Math.PI / 180);

  const calculateDistanceMiles = (
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number => {
    const earthRadiusMiles = 3959;
    const dLat = toRadians(lat2 - lat1);
    const dLon = toRadians(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRadians(lat1)) *
        Math.cos(toRadians(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    return earthRadiusMiles * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
  };

  const addressesLikelyMatch = (first: string, second: string): boolean => {
    const a = normalizeAddress(first);
    const b = normalizeAddress(second);
    if (!a || !b) return false;
    if (a === b) return true;
    return a.includes(b) || b.includes(a);
  };

  const getConfidenceLabel = (distanceMatch: boolean, addressMatch: boolean): StartLocationSuggestion['confidenceLabel'] => {
    if (distanceMatch && addressMatch) return 'Strong match';
    if (addressMatch) return 'Address match';
    return 'Nearby match';
  };

  const detectStartLocationSuggestions = async () => {
    if (!currentEmployee) return;
    const suggestions: Partial<Record<StartLocationOption, StartLocationSuggestion>> = {};

    try {
      let permission = await Location.getForegroundPermissionsAsync();
      if (permission.status !== 'granted') {
        permission = await Location.requestForegroundPermissionsAsync();
      }
      if (permission.status !== 'granted') {
        setStartLocationSuggestions({});
        return;
      }

      const currentPosition = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
        timeout: 12000,
      });

      const currentLat = currentPosition.coords.latitude;
      const currentLon = currentPosition.coords.longitude;
      // End-location suggestions should not depend on Places API; keep this flow local/editable.
      let currentAddress = '';
      const geocode = await Location.reverseGeocodeAsync({
        latitude: currentLat,
        longitude: currentLon,
      });
      if (geocode.length > 0) {
        const first = geocode[0];
        currentAddress =
          `${first.street || ''} ${first.city || ''}, ${first.region || ''} ${first.postalCode || ''}`.trim();
      }

      if (
        currentEmployee.baseAddress &&
        currentAddress &&
        addressesLikelyMatch(currentAddress, currentEmployee.baseAddress)
      ) {
        suggestions.baseAddress = {
          details: {
            name: 'BA',
            address: currentEmployee.baseAddress,
            latitude: currentLat,
            longitude: currentLon,
          },
          reason: 'You appear to be at your Base Address.',
          confidenceLabel: 'Address match',
        };
      }

      const [savedAddresses, oxfordHouses] = await Promise.all([
        DatabaseService.getSavedAddresses(currentEmployee.id),
        OxfordHouseService.getAllOxfordHouses(),
      ]);

      const matchedSavedAddress = savedAddresses
        .map((saved: SavedAddress) => {
          const distanceMatch =
            typeof saved.latitude === 'number' &&
            typeof saved.longitude === 'number' &&
            calculateDistanceMiles(currentLat, currentLon, saved.latitude, saved.longitude) <= 0.12;
          const addressMatch = !!currentAddress && addressesLikelyMatch(currentAddress, saved.address);
          return { saved, distanceMatch, addressMatch };
        })
        .find((candidate) => candidate.distanceMatch || candidate.addressMatch);

      if (matchedSavedAddress) {
        suggestions.favoriteAddresses = {
          details: {
            name: matchedSavedAddress.saved.name,
            address: matchedSavedAddress.saved.address,
            latitude: matchedSavedAddress.saved.latitude ?? currentLat,
            longitude: matchedSavedAddress.saved.longitude ?? currentLon,
          },
          reason: `Looks like you're at saved address "${matchedSavedAddress.saved.name}".`,
          confidenceLabel: getConfidenceLabel(
            matchedSavedAddress.distanceMatch,
            matchedSavedAddress.addressMatch
          ),
        };
      }

      const matchedOxfordHouse = oxfordHouses.find((house: OxfordHouse) => {
        const houseAddress = `${house.address}, ${house.city}, ${house.state} ${house.zipCode}`;
        return !!currentAddress && addressesLikelyMatch(currentAddress, houseAddress);
      });

      if (matchedOxfordHouse) {
        suggestions.oxfordHouse = {
          details: {
            name: matchedOxfordHouse.name,
            address: `${matchedOxfordHouse.address}, ${matchedOxfordHouse.city}, ${matchedOxfordHouse.state} ${matchedOxfordHouse.zipCode}`,
            latitude: currentLat,
            longitude: currentLon,
          },
          reason: `Looks like you're at ${matchedOxfordHouse.name}.`,
          confidenceLabel: 'Address match',
        };
      }

      if (currentAddress) {
        suggestions.newLocation = {
          details: {
            name: currentAddress.split(',')[0]?.trim() || 'Current Location',
            address: currentAddress,
            latitude: currentLat,
            longitude: currentLon,
          },
          reason: 'Suggested from your current GPS location. Verify and edit if needed.',
          confidenceLabel: 'Address match',
        };
      }
    } catch (error) {
      console.log('Unable to detect start location suggestions:', error);
    }

    setStartLocationSuggestions(suggestions);
  };

  const openStartLocationOptions = () => {
    setShowLocationOptionsModal(true);
    setStartLocationSuggestions({});
    setIsDetectingStartSuggestions(true);
    void detectStartLocationSuggestions().finally(() => {
      setIsDetectingStartSuggestions(false);
    });
  };

  const orderedStartLocationOptions = useMemo(() => {
    if (isEditingStartLocationOptions) {
      return startLocationOptionOrder;
    }

    const suggested = startLocationOptionOrder.filter((option) => !!startLocationSuggestions[option]);
    const unsuggested = startLocationOptionOrder.filter((option) => !startLocationSuggestions[option]);
    return [...suggested, ...unsuggested];
  }, [isEditingStartLocationOptions, startLocationOptionOrder, startLocationSuggestions]);

  const detectEndLocationSuggestions = async () => {
    if (!currentEmployee) return;
    const suggestions: Partial<Record<EndLocationOption, StartLocationSuggestion>> = {};

    try {
      let permission = await Location.getForegroundPermissionsAsync();
      if (permission.status !== 'granted') {
        permission = await Location.requestForegroundPermissionsAsync();
      }
      if (permission.status !== 'granted') {
        setEndLocationSuggestions({});
        return;
      }

      const currentPosition = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
        timeout: 12000,
      });

      const currentLat = currentPosition.coords.latitude;
      const currentLon = currentPosition.coords.longitude;
      let currentAddress = '';
      const geocode = await Location.reverseGeocodeAsync({
        latitude: currentLat,
        longitude: currentLon,
      });
      if (geocode.length > 0) {
        const first = geocode[0];
        currentAddress =
          `${first.street || ''} ${first.city || ''}, ${first.region || ''} ${first.postalCode || ''}`.trim();
      }

      if (
        currentEmployee.baseAddress &&
        currentAddress &&
        addressesLikelyMatch(currentAddress, currentEmployee.baseAddress)
      ) {
        suggestions.baseAddress = {
          details: {
            name: 'BA',
            address: currentEmployee.baseAddress,
            latitude: currentLat,
            longitude: currentLon,
          },
          reason: 'You appear to be at your Base Address.',
          confidenceLabel: 'Address match',
        };
      }

      if (startLocationDetails) {
        const tripStartAddress = startLocationDetails.address?.trim() || startLocationDetails.name;
        const tripStartDistanceMatch =
          typeof startLocationDetails.latitude === 'number' &&
          typeof startLocationDetails.longitude === 'number' &&
          calculateDistanceMiles(
            currentLat,
            currentLon,
            startLocationDetails.latitude,
            startLocationDetails.longitude
          ) <= 0.12;
        const tripStartAddressMatch =
          !!currentAddress && addressesLikelyMatch(currentAddress, tripStartAddress);

        if (tripStartDistanceMatch || tripStartAddressMatch) {
          suggestions.tripStart = {
            details: {
              name: startLocationDetails.name,
              address: tripStartAddress,
              latitude: startLocationDetails.latitude ?? currentLat,
              longitude: startLocationDetails.longitude ?? currentLon,
            },
            reason: 'Looks like you are back at your trip start location.',
            confidenceLabel: getConfidenceLabel(tripStartDistanceMatch, tripStartAddressMatch),
          };
        }
      }

      const [savedAddresses, oxfordHouses] = await Promise.all([
        DatabaseService.getSavedAddresses(currentEmployee.id),
        OxfordHouseService.getAllOxfordHouses(),
      ]);

      const matchedSavedAddress = savedAddresses
        .map((saved: SavedAddress) => {
          const distanceMatch =
            typeof saved.latitude === 'number' &&
            typeof saved.longitude === 'number' &&
            calculateDistanceMiles(currentLat, currentLon, saved.latitude, saved.longitude) <= 0.12;
          const addressMatch = !!currentAddress && addressesLikelyMatch(currentAddress, saved.address);
          return { saved, distanceMatch, addressMatch };
        })
        .find((candidate) => candidate.distanceMatch || candidate.addressMatch);

      if (matchedSavedAddress) {
        suggestions.favoriteAddresses = {
          details: {
            name: matchedSavedAddress.saved.name,
            address: matchedSavedAddress.saved.address,
            latitude: matchedSavedAddress.saved.latitude ?? currentLat,
            longitude: matchedSavedAddress.saved.longitude ?? currentLon,
          },
          reason: `Looks like you're at saved address "${matchedSavedAddress.saved.name}".`,
          confidenceLabel: getConfidenceLabel(
            matchedSavedAddress.distanceMatch,
            matchedSavedAddress.addressMatch
          ),
        };
      }

      const matchedOxfordHouse = oxfordHouses.find((house: OxfordHouse) => {
        const houseAddress = `${house.address}, ${house.city}, ${house.state} ${house.zipCode}`;
        return !!currentAddress && addressesLikelyMatch(currentAddress, houseAddress);
      });

      if (matchedOxfordHouse) {
        suggestions.oxfordHouse = {
          details: {
            name: matchedOxfordHouse.name,
            address: `${matchedOxfordHouse.address}, ${matchedOxfordHouse.city}, ${matchedOxfordHouse.state} ${matchedOxfordHouse.zipCode}`,
            latitude: currentLat,
            longitude: currentLon,
          },
          reason: `Looks like you're at ${matchedOxfordHouse.name}.`,
          confidenceLabel: 'Address match',
        };
      }

      if (currentAddress) {
        suggestions.newLocation = {
          details: {
            name: currentAddress.split(',')[0]?.trim() || 'Current Location',
            address: currentAddress,
            latitude: currentLat,
            longitude: currentLon,
          },
          reason: 'Suggested from your current GPS location. Verify and edit if needed.',
          confidenceLabel: 'Address match',
        };
      }
    } catch (error) {
      console.log('Unable to detect end location suggestions:', error);
    }

    setEndLocationSuggestions(suggestions);
    return suggestions;
  };

  const openEndLocationOptions = () => {
    setShowEndLocationOptionsModal(true);
    setEndLocationSuggestions({});
    setIsDetectingEndSuggestions(true);
    void detectEndLocationSuggestions().finally(() => {
      setIsDetectingEndSuggestions(false);
    });
  };

  const openEndLocationModalWithDetails = (details: Partial<LocationDetails> | null) => {
    setShowEndLocationOptionsModal(false);
    setManualEndInitialLocation(details || null);
    setShowEndLocationModal(true);
  };

  const startGpsTracking = async () => {
    try {
      setIsStartingTracking(true);
      // Check if this is the first GPS tracking session of the day using device's local timezone
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      console.log('🚗 GPS: Starting GPS tracking for date:', today.toISOString().split('T')[0]);
      
      const existingReading = await DatabaseService.getDailyOdometerReading(currentEmployee!.id, today);
      
      // If no daily odometer reading exists, create one from the current odometer reading
      if (!existingReading && trackingForm.odometerReading) {
        console.log('📝 Creating daily odometer reading from GPS tracking:', trackingForm.odometerReading);
        await DatabaseService.createDailyOdometerReading({
          employeeId: currentEmployee!.id,
          date: today,
          odometerReading: Number(trackingForm.odometerReading),
          notes: 'Auto-captured from first GPS tracking session'
        });
      }

      await startTracking(
        currentEmployee!.id,
        trackingForm.purpose,
        Number(trackingForm.odometerReading),
        trackingForm.notes
      );

      setTrackingTime(0);

      Alert.alert('GPS Tracking Started', 'Your location is now being tracked. Tap "Stop Tracking" when you reach your destination.');
    } catch (error) {
      console.error('Error starting tracking:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to start GPS tracking. Please check location permissions.';
      Alert.alert('GPS Tracking Error', errorMessage);
    } finally {
      setIsStartingTracking(false);
    }
  };

  const handleStartLocationConfirm = async (locationDetails: LocationDetails) => {
    setStartLocationDetails(locationDetails);
    setShowStartLocationModal(false);
    setManualStartInitialLocation(null);
    startGpsTracking();
  };

  const handleStopTracking = async () => {
    // Match "start GPS" UX: prompt end-location options first instead of jumping to manual capture.
    openEndLocationOptions();
  };

  const handleEndLocationOption = (
    option: 'baseAddress' | 'tripStart' | 'favoriteAddresses' | 'oxfordHouse' | 'newLocation'
  ) => {
    setShowEndLocationOptionsModal(false);
    setTimeout(() => {
      if (option === 'baseAddress' && currentEmployee?.baseAddress) {
        const suggested = endLocationSuggestions.baseAddress;
        if (suggested) {
          openEndLocationModalWithDetails(suggested.details);
        } else {
          openEndLocationModalWithDetails({
            name: 'BA',
            address: currentEmployee.baseAddress,
          });
        }
      } else if (option === 'tripStart' && startLocationDetails) {
        const suggested = endLocationSuggestions.tripStart;
        if (suggested) {
          openEndLocationModalWithDetails(suggested.details);
        } else {
          openEndLocationModalWithDetails({
            name: startLocationDetails.name,
            address: startLocationDetails.address?.trim() || startLocationDetails.name,
            latitude: startLocationDetails.latitude,
            longitude: startLocationDetails.longitude,
          });
        }
      } else if (option === 'favoriteAddresses') {
        const suggested = endLocationSuggestions.favoriteAddresses;
        if (suggested) {
          openEndLocationModalWithDetails(suggested.details);
        } else {
          navigation.navigate('SavedAddresses', { fromGpsTrackingEnd: true });
        }
      } else if (option === 'oxfordHouse') {
        const suggested = endLocationSuggestions.oxfordHouse;
        if (suggested) {
          openEndLocationModalWithDetails(suggested.details);
        } else {
          setOxfordHousePickerRole('end');
          setShowOxfordHouseSearchModal(true);
        }
      } else if (option === 'newLocation') {
        const suggested = endLocationSuggestions.newLocation;
        openEndLocationModalWithDetails(suggested?.details || null);
      }
    }, 100);
  };

  const moveEndLocationOption = async (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= endLocationOptionOrder.length) return;
    const newOrder = [...endLocationOptionOrder];
    [newOrder[index], newOrder[targetIndex]] = [newOrder[targetIndex], newOrder[index]];
    setEndLocationOptionOrder(newOrder);
    await PreferencesService.updatePreferences({
      gpsEndLocationOptionOrder: newOrder,
    });
  };

  const withTimeout = async <T,>(
    task: Promise<T>,
    timeoutMs: number,
    label: string
  ): Promise<T> => {
    return await Promise.race([
      task,
      new Promise<T>((_, reject) => {
        setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
      }),
    ]);
  };

  const handleEndLocationConfirm = async (locationDetails: LocationDetails) => {
    // Safety guard: if any path tries to auto-submit a non-manual end location,
    // force the user back through the editable end-location modal first.
    if (locationDetails.source !== 'manual') {
      openEndLocationModalWithDetails(locationDetails);
      return;
    }

    console.log('📍 End location confirmed:', locationDetails);
    setEndLocationDetails(locationDetails);
    setShowEndLocationModal(false);
    setManualEndInitialLocation(null);
    setShowEndLocationOptionsModal(false);
    setIsEndingTracking(true);

    try {
      // Pass confirmed end location so we skip a slow post-stop GPS fix (avoids UI freeze on many devices)
      const completedSession = await withTimeout(
        stopTracking(locationDetails),
        12000,
        'Stop tracking'
      );
      
      // Use GPS-tracked miles
      const actualMiles = Math.round(completedSession?.totalMiles || 0);
      
      if (completedSession && currentEmployee) {
        console.log('🚗 GPS Trip completed, saving to database:', {
          employeeId: currentEmployee.id,
          employeeName: currentEmployee.name,
          date: completedSession.startTime,
          startLocation: startLocationDetails?.name || startLocationDetails?.address || completedSession.startLocation || 'Unknown',
          startAddress: startLocationDetails?.address,
          endLocation: locationDetails.name || locationDetails.address || completedSession.endLocation || 'Unknown',
          endAddress: locationDetails.address,
          purpose: completedSession.purpose,
          miles: actualMiles,
          odometerReading: completedSession.odometerReading,
          isGpsTracked: true
        });

        let mileageSaved = true;
        try {
          await withTimeout(
            DatabaseService.createMileageEntry({
              employeeId: currentEmployee.id,
              oxfordHouseId: currentEmployee.oxfordHouseId,
              date: completedSession.startTime,
              odometerReading: completedSession.odometerReading,
              startLocation: startLocationDetails?.name || startLocationDetails?.address || completedSession.startLocation || 'Unknown',
              endLocation: locationDetails.name || locationDetails.address || completedSession.endLocation || 'Unknown',
              startLocationDetails: startLocationDetails || undefined,
              endLocationDetails: locationDetails, // Use the parameter directly instead of state
              purpose: completedSession.purpose,
              miles: actualMiles, // Use calculated miles from odometer if available
              notes: completedSession.notes,
              isGpsTracked: true,
              costCenter: selectedCostCenter,
            }),
            12000,
            'Save trip data'
          );
        } catch (saveError) {
          mileageSaved = false;
          console.error('⚠️ GPS trip save timed out/faulted:', saveError);
        }

        if (mileageSaved) {
          console.log('✅ GPS Trip saved successfully!');
        }

        // Update last destination for next trip
        console.log('🔍 GPS: Updating last destination:', locationDetails.name);
        setLastDestination(locationDetails);

        setTrackingTime(0);
        setStartLocationDetails(null);
        setEndLocationDetails(null);
        setShowLocationOptionsModal(false);
        setShowStartLocationModal(false);
        setShowEndLocationModal(false);
        setShowEndLocationOptionsModal(false);
        setShowOxfordHouseSearchModal(false);
        setShowPurposeSuggestions(false);
        setTrackingForm({
          odometerReading: '',
          purpose: '',
          notes: '',
        });
        setSelectedCostCenter('');

        const saveWarning = mileageSaved
          ? ''
          : '\n\nWarning: Trip ended, but saving took too long. Please check your mileage list and refresh if needed.';
        const message = `Trip completed!\nDistance: ${actualMiles} miles (GPS tracked)\nDuration: ${formatTime(trackingTime)}\nFrom: ${formatLocation(completedSession.startLocation || '', startLocationDetails || undefined)}\nTo: ${formatLocation(completedSession.endLocation || '', locationDetails)}${saveWarning}`;
        // Auto-return to Home after save and show completion popup.
        navigation.reset({
          index: 0,
          routes: [{ name: 'Home' }],
        });
        setTimeout(() => {
          Alert.alert('Tracking Complete', message);
        }, Platform.OS === 'ios' ? 250 : 200);
        return;
      } else {
        setShowEndLocationOptionsModal(false);
      }

      setTrackingTime(0);
      setStartLocationDetails(null);
      setEndLocationDetails(null);
      
      // Reset all modal states to ensure screen is responsive
      setShowLocationOptionsModal(false);
      setShowStartLocationModal(false);
      setShowEndLocationModal(false);
      setShowEndLocationOptionsModal(false);
      setShowOxfordHouseSearchModal(false);
      setShowPurposeSuggestions(false);
      
      // Reset form state for next trip
      setTrackingForm({
        odometerReading: '',
        purpose: '',
        notes: '',
      });
      
      // Reset cost center selection
      setSelectedCostCenter('');
    } catch (error) {
      console.error('Error stopping tracking:', error);
      setShowEndLocationOptionsModal(false);
      Alert.alert('Error', 'Failed to stop GPS tracking');
    } finally {
      setIsEndingTracking(false);
    }
  };

  const handleOxfordHouseSelected = (house: any) => {
    const locationDetails: LocationDetails = {
      name: house.name,
      address: `${house.address}, ${house.city}, ${house.state} ${house.zipCode}`,
      source: 'oxfordHouse',
      sourceId: house.id,
    };
    setShowOxfordHouseSearchModal(false);
    const role = oxfordHousePickerRole;
    setOxfordHousePickerRole('start');
    if (role === 'end') {
      openEndLocationModalWithDetails(locationDetails);
    } else {
      setStartLocationDetails(locationDetails);
      startGpsTracking();
    }
  };

  // Oxford House search functions (same UX as Manual Entry screen)
  const loadOxfordHouses = async () => {
    try {
      setOxfordHouseLoading(true);
      await OxfordHouseService.initializeOxfordHouses();
      const houses = await OxfordHouseService.getAllOxfordHouses();

      setOxfordHouseAllHouses(houses);

      const states = getAvailableOxfordHouseStates(houses);
      setOxfordHouseAvailableStates(states);

      const defaultSelection = getDefaultOxfordHouseSelection(houses, currentEmployee?.baseAddress);
      setOxfordHouseSelectedState(defaultSelection.selectedState);
      setOxfordHouseResults(defaultSelection.results);
    } catch (error) {
      console.error('Error loading Oxford Houses:', error);
    } finally {
      setOxfordHouseLoading(false);
    }
  };

  const performOxfordHouseSearch = (query: string) => {
    setOxfordHouseResults(
      filterOxfordHousesForPicker(oxfordHouseAllHouses, oxfordHouseSelectedState, query)
    );
  };

  const handleOxfordHouseStateFilterChange = (state: string) => {
    setOxfordHouseSelectedState(state);
    setOxfordHouseResults(
      filterOxfordHousesForPicker(oxfordHouseAllHouses, state, oxfordHouseSearchQuery)
    );
  };

  useEffect(() => {
    if (showOxfordHouseSearchModal) {
      // Always start GPS picker from a clean search state.
      setOxfordHouseSearchQuery('');
      setIsOxfordHouseStatePickerVisible(false);
      loadOxfordHouses();
    }
  }, [showOxfordHouseSearchModal]);

  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  };

  const formatDistance = (miles: number): string => {
    return `${Math.round(miles)} mi`;
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <UnifiedHeader
        title="GPS Tracking"
        showBackButton={true}
        onBackPress={() => navigation.goBack()}
        onHomePress={() => navigation.navigate('Home')}
      />

      <KeyboardAwareScrollView
        style={styles.content} 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={true}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        scrollEventThrottle={16}
        nestedScrollEnabled={true}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
      >
        {/* Tracking Status */}
        <View style={styles.statusContainer}>
          <View style={[styles.statusCard, isTracking && styles.statusCardActive]}>
            <MaterialIcons 
              name={isTracking ? "gps-fixed" : "gps-off"} 
              size={32} 
              color={isTracking ? "#4CAF50" : "#666"} 
            />
            <Text style={[styles.statusText, isTracking && styles.statusTextActive]}>
              {isTracking ? 'GPS Tracking Active' : 'GPS Tracking Inactive'}
            </Text>
          </View>
        </View>

        {/* Current Stats */}
        {useMemo(() => isTracking && showGpsDuration && (
          <View style={styles.statsContainer}>
            <View style={styles.statCard}>
              <MaterialIcons name="timer" size={24} color="#2196F3" />
              <Text style={styles.statValue}>{formatTime(trackingTime)}</Text>
              <Text style={styles.statLabel}>Duration</Text>
            </View>
          </View>
        ), [isTracking, trackingTime, showGpsDuration])}

        {/* Tracking Form */}
        {!isTracking && (
          <View style={styles.formContainer}>
            <Text style={styles.sectionTitle}>Trip Details</Text>
            
            {/* Only show odometer input on first GPS session of the day */}
            {!hasStartedGpsToday && (
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Starting Odometer Reading *</Text>
                <ScrollToOnFocusView>
                  <TextInput
                    ref={odometerInputRef}
                    style={styles.input}
                    value={trackingForm.odometerReading}
                    onChangeText={(value) => handleInputChange('odometerReading', value)}
                    placeholder="e.g., 12345"
                    keyboardType="numeric"
                    placeholderTextColor="#999"
                    returnKeyType="next"
                    blurOnSubmit={false}
                    onSubmitEditing={handleOdometerSubmit}
                  />
                </ScrollToOnFocusView>
                {lastTravelDayEndingOdometerNote ? (
                  <Text style={styles.helpText}>{lastTravelDayEndingOdometerNote}</Text>
                ) : null}
              </View>
            )}
            
            {/* Show current odometer reading if GPS has been started today */}
            {hasStartedGpsToday && (
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Daily Starting Odometer</Text>
                {!isEditingOdometer ? (
                  <View style={styles.odometerDisplay}>
                    <Text style={styles.odometerValue}>{trackingForm.odometerReading}</Text>
                    <Text style={styles.odometerNote}>
                      Set from first GPS session today
                    </Text>
                    <TouchableOpacity
                      style={styles.editOdometerButton}
                      onPress={handleEditOdometer}
                    >
                      <MaterialIcons name="edit" size={16} color="#2196F3" />
                      <Text style={styles.editOdometerButtonText}>Edit</Text>
                    </TouchableOpacity>
                    {lastTravelDayEndingOdometerNote ? (
                      <Text style={styles.helpText}>{lastTravelDayEndingOdometerNote}</Text>
                    ) : null}
                  </View>
                ) : (
                  <View style={styles.odometerEditContainer}>
                    <ScrollToOnFocusView>
                      <TextInput
                        style={styles.input}
                        value={trackingForm.odometerReading}
                        onChangeText={(value) => handleInputChange('odometerReading', value)}
                        placeholder="e.g., 12345"
                        keyboardType="numeric"
                        placeholderTextColor="#999"
                        autoFocus={true}
                      />
                    </ScrollToOnFocusView>
                    <View style={styles.odometerEditButtons}>
                      <TouchableOpacity
                        style={styles.saveOdometerButton}
                        onPress={handleSaveOdometer}
                      >
                        <MaterialIcons name="check" size={16} color="#fff" />
                        <Text style={styles.saveOdometerButtonText}>Save</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.cancelOdometerButton}
                        onPress={handleCancelOdometerEdit}
                      >
                        <MaterialIcons name="close" size={16} color="#666" />
                        <Text style={styles.cancelOdometerButtonText}>Cancel</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>
            )}

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Purpose *</Text>
              <TouchableOpacity
                style={styles.purposeDropdown}
                onPress={() => setShowPurposePickerModal(true)}
              >
                <Text style={[styles.purposeDropdownText, !trackingForm.purpose && styles.purposeDropdownPlaceholder]}>
                  {trackingForm.purpose || (travelReasons.length === 0 ? 'Loading...' : 'Select purpose...')}
                </Text>
                <MaterialIcons name="arrow-drop-down" size={24} color="#666" />
              </TouchableOpacity>
              {showPurposePickerModal && (
              <Modal
                visible
                transparent
                animationType={Platform.OS === 'ios' ? 'none' : 'slide'}
                presentationStyle="overFullScreen"
                onRequestClose={() => setShowPurposePickerModal(false)}
              >
                <View style={styles.purposeModalOverlay}>
                  <TouchableOpacity
                    style={StyleSheet.absoluteFill}
                    activeOpacity={1}
                    onPress={() => setShowPurposePickerModal(false)}
                  />
                  <View style={[styles.purposeModalContent, { backgroundColor: colors.background }]}>
                    <Text style={styles.purposeModalTitle}>Purpose</Text>
                    <ScrollView style={styles.purposeModalList} keyboardShouldPersistTaps="handled">
                      {travelReasons.filter((r) => r.label !== 'Other').length === 0 ? (
                        <Text style={styles.purposeModalEmpty}>No options configured. Set up Travel Reasons in Admin Portal.</Text>
                      ) : (
                        travelReasons.filter((r) => r.label !== 'Other').map((r) => (
                          <TouchableOpacity
                            key={r.id}
                            style={[styles.purposeModalItem, trackingForm.purpose === r.label && styles.purposeModalItemSelected]}
                            onPress={() => {
                              setTrackingForm(prev => ({ ...prev, purpose: r.label }));
                              setShowCustomPurposeInput(false);
                              setShowPurposePickerModal(false);
                            }}
                          >
                            <Text style={styles.purposeModalItemText}>{r.label}</Text>
                            {trackingForm.purpose === r.label && (
                              <MaterialIcons name="check" size={20} color="#4CAF50" />
                            )}
                          </TouchableOpacity>
                        ))
                      )}
                      <TouchableOpacity
                        style={styles.purposeModalItem}
                        onPress={() => {
                          setShowPurposePickerModal(false);
                          setShowCustomPurposeInput(true);
                          setTimeout(() => purposeInputRef.current?.focus(), 0);
                        }}
                      >
                        <Text style={styles.purposeModalItemText}>Other (Type custom purpose)</Text>
                      </TouchableOpacity>
                    </ScrollView>
                    <TouchableOpacity style={styles.purposeModalClose} onPress={() => setShowPurposePickerModal(false)}>
                      <Text style={styles.purposeModalCloseText}>Cancel</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </Modal>
              )}
              {showCustomPurposeInput && (
                <ScrollToOnFocusView>
                  <TextInput
                    ref={purposeInputRef}
                    style={[styles.input, { marginTop: 8 }]}
                    value={trackingForm.purpose}
                    onChangeText={(value) => handleInputChange('purpose', value)}
                    placeholder="Type custom purpose..."
                    placeholderTextColor="#999"
                    returnKeyType="done"
                  />
                </ScrollToOnFocusView>
              )}
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Notes (Optional)</Text>
              <ScrollToOnFocusView>
                <TextInput
                  ref={notesInputRef}
                  style={[styles.input, styles.textArea]}
                  value={trackingForm.notes}
                  onChangeText={(value) => handleInputChange('notes', value)}
                  placeholder="Additional notes about this trip..."
                  placeholderTextColor="#999"
                  multiline
                  numberOfLines={3}
                  returnKeyType="done"
                  blurOnSubmit={true}
                />
              </ScrollToOnFocusView>
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
                
                {/* AI Cost Center Suggestions */}
                {showCostCenterSuggestions && costCenterSuggestions.length > 0 && (
                  <View style={styles.suggestionsContainer}>
                    <Text style={styles.suggestionsTitle}>🤖 AI Cost Center Suggestions</Text>
                    {costCenterSuggestions.slice(0, 3).map((suggestion, index) => (
                      <TouchableOpacity
                        key={index}
                        style={styles.suggestionItem}
                        onPress={() => {
                          setSelectedCostCenter(suggestion.costCenter);
                          setShowCostCenterSuggestions(false);
                        }}
                      >
                        <View style={styles.suggestionContent}>
                          <Text style={styles.suggestionText}>{suggestion.costCenter}</Text>
                          <Text style={styles.suggestionReason}>{suggestion.reasoning}</Text>
                        </View>
                        <View style={styles.confidenceBadge}>
                          <Text style={styles.confidenceText}>
                            {Math.round(suggestion.confidence * 100)}%
                          </Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            )}
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.actionsContainer}>
          {!isTracking ? (
            <TouchableOpacity
              style={styles.startButton}
              onPress={handleStartTracking}
            >
              <MaterialIcons name="play-arrow" size={24} color="#fff" />
              <Text style={styles.startButtonText}>Start GPS Tracking</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.trackingActiveContainer}>
              <View style={styles.trackingActiveCard}>
                <MaterialIcons name="gps-fixed" size={32} color="#4CAF50" />
                <Text style={styles.trackingActiveText}>GPS Tracking Active</Text>
                <Text style={styles.trackingActiveSubtext}>
                  Use the "Stop Tracking" button in the top-right corner to end tracking
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* Instructions */}
        {!isTracking && (
          <View style={styles.instructionsContainer}>
            <Text style={styles.instructionsTitle}>How GPS Tracking Works:</Text>
            <Text style={styles.instructionsText}>
              • Enter the purpose of your trip{'\n'}
              • Tap "Start GPS Tracking" to auto-detect your current address{'\n'}
              • Confirm the address and choose a location name{'\n'}
              • The app will automatically track your route and distance{'\n'}
              • Tap "Stop Tracking" and confirm your current end location{'\n'}
              • Your trip will be automatically saved with detailed location info{'\n'}
              • Vehicle is automatically set to "Personal Vehicle"{'\n'}
              • Make sure location services are enabled for accurate tracking
            </Text>
          </View>
        )}
      </KeyboardAwareScrollView>

      {/* Location Options Modal */}
      {showLocationOptionsModal && (
      <Modal
        visible
        transparent={true}
        animationType={Platform.OS === 'ios' ? 'none' : 'slide'}
        presentationStyle="overFullScreen"
        onRequestClose={() => setShowLocationOptionsModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Choose Starting Location</Text>
            <Text style={styles.modalSubtitle}>Where are you starting your trip from?</Text>

            <View style={styles.modalTopActionRow}>
              <TouchableOpacity
                style={styles.rearrangeButton}
                onPress={() => setIsEditingStartLocationOptions(!isEditingStartLocationOptions)}
              >
                <MaterialIcons name={isEditingStartLocationOptions ? 'check' : 'edit'} size={18} color="#2196F3" />
                <Text style={styles.rearrangeButtonText}>
                  {isEditingStartLocationOptions ? 'Done' : 'Rearrange'}
                </Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.modalScrollArea}
              contentContainerStyle={styles.modalScrollContent}
              showsVerticalScrollIndicator
            >
              {isEditingStartLocationOptions ? (
                <View style={styles.editHintContainer}>
                  <MaterialIcons name="info" size={16} color="#2196F3" />
                  <Text style={styles.editHintText}>Use ↑ ↓ to rearrange options</Text>
                </View>
              ) : null}
              {isDetectingStartSuggestions ? (
                <View style={styles.startSuggestionHintContainer}>
                  <ActivityIndicator size="small" color="#2196F3" />
                  <Text style={styles.startSuggestionHintText}>
                    Checking your current location for smart suggestions...
                  </Text>
                </View>
              ) : null}

              {orderedStartLocationOptions.map((option) => {
                const index = startLocationOptionOrder.indexOf(option);
                const suggestion = startLocationSuggestions[option];
                const isDisabled =
                  (option === 'lastDestination' && !lastDestination) ||
                  (option === 'baseAddress' && !currentEmployee?.baseAddress);
                const iconName =
                  option === 'lastDestination' ? 'location-on' :
                  option === 'baseAddress' ? 'home' :
                  option === 'favoriteAddresses' ? 'star' :
                  option === 'oxfordHouse' ? 'home' : 'add-location';
                const iconColor =
                  option === 'lastDestination' ? '#4CAF50' :
                  option === 'baseAddress' ? '#2196F3' :
                  option === 'favoriteAddresses' ? '#FFC107' :
                  option === 'oxfordHouse' ? '#9C27B0' : '#FF9800';
                const title =
                  option === 'lastDestination' ? 'Start from Last Destination' :
                  option === 'baseAddress' ? 'Start from Base Address' :
                  option === 'favoriteAddresses' ? 'Choose from Favorite Addresses' :
                  option === 'oxfordHouse' ? 'Search Oxford Houses' : 'Enter New Starting Point';
                const subtitle =
                  suggestion
                    ? suggestion.reason
                    : option === 'lastDestination'
                    ? (lastDestination ? `${lastDestination.name} (${lastDestination.address})` : 'No previous destination found')
                    : option === 'baseAddress'
                      ? (currentEmployee?.baseAddress || 'No base address set')
                      : option === 'favoriteAddresses'
                        ? 'Select from your saved favorite locations'
                        : option === 'oxfordHouse'
                          ? 'Search and select from Oxford House locations'
                          : 'Manually enter location name and address';

                return (
                  <View key={option}>
                    <TouchableOpacity
                      style={[styles.locationOptionButton, isDisabled && styles.disabledButton]}
                      onPress={() => handleLocationOption(option)}
                      disabled={isDisabled}
                    >
                      <MaterialIcons name={iconName as any} size={24} color={iconColor} />
                      <View style={styles.locationOptionText}>
                        <Text style={styles.locationOptionTitle}>{title}</Text>
                        <Text style={styles.locationOptionSubtitle}>{subtitle}</Text>
                        {suggestion ? (
                          <View style={styles.startSuggestionBadge}>
                            <Text style={styles.startSuggestionBadgeText}>
                              Suggested • {suggestion.confidenceLabel}
                            </Text>
                          </View>
                        ) : null}
                      </View>
                    </TouchableOpacity>
                    {isEditingStartLocationOptions ? (
                      <View style={styles.reorderButtons}>
                        {index > 0 ? (
                          <TouchableOpacity
                            style={styles.reorderButton}
                            onPress={() => void moveStartLocationOption(index, 'up')}
                          >
                            <MaterialIcons name="arrow-upward" size={16} color="#2196F3" />
                          </TouchableOpacity>
                        ) : null}
                        {index < startLocationOptionOrder.length - 1 ? (
                          <TouchableOpacity
                            style={styles.reorderButton}
                            onPress={() => void moveStartLocationOption(index, 'down')}
                          >
                            <MaterialIcons name="arrow-downward" size={16} color="#2196F3" />
                          </TouchableOpacity>
                        ) : null}
                      </View>
                    ) : null}
                  </View>
                );
              })}
            </ScrollView>

            <TouchableOpacity
              style={styles.modalButtonSecondary}
              onPress={() => {
                console.log('🔍 GPS: Cancel button pressed');
                setShowLocationOptionsModal(false);
              }}
            >
              <Text style={styles.modalButtonSecondaryText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      )}

      {/* End location: same discovery paths as start (BA, favorites, Oxford search, manual) */}
      {showEndLocationOptionsModal && (
      <Modal
        visible
        transparent={true}
        animationType={Platform.OS === 'ios' ? 'none' : 'slide'}
        presentationStyle="overFullScreen"
        onRequestClose={() => setShowEndLocationOptionsModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Choose End Location</Text>
            <Text style={styles.modalSubtitle}>Where did this trip end?</Text>

            <View style={styles.modalTopActionRow}>
              <TouchableOpacity
                style={styles.rearrangeButton}
                onPress={() => setIsEditingEndLocationOptions(!isEditingEndLocationOptions)}
              >
                <MaterialIcons name={isEditingEndLocationOptions ? 'check' : 'edit'} size={18} color="#2196F3" />
                <Text style={styles.rearrangeButtonText}>
                  {isEditingEndLocationOptions ? 'Done' : 'Rearrange'}
                </Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.modalScrollArea}
              contentContainerStyle={styles.modalScrollContent}
              showsVerticalScrollIndicator
            >
              {isEditingEndLocationOptions ? (
                <View style={styles.editHintContainer}>
                  <MaterialIcons name="info" size={16} color="#2196F3" />
                  <Text style={styles.editHintText}>Use ↑ ↓ to rearrange options</Text>
                </View>
              ) : null}
              {isDetectingEndSuggestions ? (
                <View style={styles.startSuggestionHintContainer}>
                  <ActivityIndicator size="small" color="#2196F3" />
                  <Text style={styles.startSuggestionHintText}>
                    Checking your current location for smart suggestions...
                  </Text>
                </View>
              ) : null}

              {endLocationOptionOrder.map((option, index) => {
                const suggestion = endLocationSuggestions[option];
                const isDisabled =
                  (option === 'baseAddress' && !currentEmployee?.baseAddress) ||
                  (option === 'tripStart' && !startLocationDetails);
                const iconName =
                  option === 'baseAddress' ? 'home' :
                  option === 'tripStart' ? 'replay' :
                  option === 'favoriteAddresses' ? 'star' :
                  option === 'oxfordHouse' ? 'home' : 'add-location';
                const iconColor =
                  option === 'baseAddress' ? '#2196F3' :
                  option === 'tripStart' ? '#4CAF50' :
                  option === 'favoriteAddresses' ? '#FFC107' :
                  option === 'oxfordHouse' ? '#9C27B0' : '#FF9800';
                const title =
                  option === 'baseAddress' ? 'End at Base Address' :
                  option === 'tripStart' ? 'Same as Trip Start' :
                  option === 'favoriteAddresses' ? 'Choose from Favorite Addresses' :
                  option === 'oxfordHouse' ? 'Search Oxford Houses' : 'Enter Destination Manually';
                const subtitle =
                  suggestion
                    ? suggestion.reason
                    : option === 'baseAddress'
                    ? (currentEmployee?.baseAddress || 'No base address set')
                    : option === 'tripStart'
                      ? (startLocationDetails
                        ? `${startLocationDetails.name} (${startLocationDetails.address || '—'})`
                        : 'Start location not recorded for this session')
                      : option === 'favoriteAddresses'
                        ? 'Select a saved location as your destination'
                        : option === 'oxfordHouse'
                          ? 'Search and select from Oxford House locations'
                          : 'Use GPS + name/address (same as manual mileage)';

                return (
                  <View key={option}>
                    <TouchableOpacity
                      style={[styles.locationOptionButton, isDisabled && styles.disabledButton]}
                      onPress={() => handleEndLocationOption(option)}
                      disabled={isDisabled}
                    >
                      <MaterialIcons name={iconName as any} size={24} color={iconColor} />
                      <View style={styles.locationOptionText}>
                        <Text style={styles.locationOptionTitle}>{title}</Text>
                        <Text style={styles.locationOptionSubtitle}>{subtitle}</Text>
                        {suggestion ? (
                          <View style={styles.startSuggestionBadge}>
                            <Text style={styles.startSuggestionBadgeText}>
                              Suggested • {suggestion.confidenceLabel}
                            </Text>
                          </View>
                        ) : null}
                      </View>
                    </TouchableOpacity>
                    {isEditingEndLocationOptions ? (
                      <View style={styles.reorderButtons}>
                        {index > 0 ? (
                          <TouchableOpacity
                            style={styles.reorderButton}
                            onPress={() => void moveEndLocationOption(index, 'up')}
                          >
                            <MaterialIcons name="arrow-upward" size={16} color="#2196F3" />
                          </TouchableOpacity>
                        ) : null}
                        {index < endLocationOptionOrder.length - 1 ? (
                          <TouchableOpacity
                            style={styles.reorderButton}
                            onPress={() => void moveEndLocationOption(index, 'down')}
                          >
                            <MaterialIcons name="arrow-downward" size={16} color="#2196F3" />
                          </TouchableOpacity>
                        ) : null}
                      </View>
                    ) : null}
                  </View>
                );
              })}
            </ScrollView>

            <TouchableOpacity
              style={styles.modalButtonSecondary}
              onPress={() => setShowEndLocationOptionsModal(false)}
            >
              <Text style={styles.modalButtonSecondaryText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      )}

      {/* Start Location Capture Modal */}
      {showStartLocationModal && <LocationCaptureModal
        visible={showStartLocationModal}
        onClose={() => {
          setShowStartLocationModal(false);
          setManualStartInitialLocation(null);
        }}
        onConfirm={handleStartLocationConfirm}
        title="Capture Start Location"
        locationType="start"
        currentEmployee={currentEmployee}
        initialLocation={manualStartInitialLocation}
      />}

      {/* End Location Capture Modal - no "Cancel tracking" option; closing just returns to map and keeps tracking */}
      {showEndLocationModal && <LocationCaptureModal
        visible={showEndLocationModal}
        onClose={() => {
          setShowEndLocationModal(false);
          setManualEndInitialLocation(null);
        }}
        onConfirm={handleEndLocationConfirm}
        title="Capture End Location"
        locationType="end"
        currentEmployee={currentEmployee}
        initialLocation={manualEndInitialLocation}
      />}

      {/* Oxford House Search Modal - same experience as Manual Entry */}
      {showOxfordHouseSearchModal && (
        <Modal
          visible
          transparent={true}
          animationType="slide"
          onRequestClose={() => {
            setShowOxfordHouseSearchModal(false);
            setOxfordHousePickerRole('start');
          }}
        >
          <KeyboardAvoidingView
            style={styles.modalContainer}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          >
            <View style={styles.modalOverlay}>
              <View style={styles.oxfordHouseModalContent}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>
                    {oxfordHousePickerRole === 'end' ? 'Select End Location' : 'Search Oxford Houses'}
                  </Text>
                  <TouchableOpacity
                    onPress={() => {
                      setShowOxfordHouseSearchModal(false);
                      setOxfordHousePickerRole('start');
                    }}
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
                  />
                  <MaterialIcons name="search" size={24} color="#666" style={styles.searchInputIcon} />
                </View>

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

                <View style={styles.manualEntryContainer}>
                  <TouchableOpacity
                    style={styles.manualEntryButton}
                    onPress={() => {
                      setShowOxfordHouseSearchModal(false);
                      if (oxfordHousePickerRole === 'end') setShowEndLocationModal(true);
                      else setShowStartLocationModal(true);
                    }}
                  >
                    <MaterialIcons name="edit" size={20} color="#2196F3" />
                    <Text style={styles.manualEntryText}>Enter location manually</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.oxfordHouseResultsContainer}>
                  {oxfordHouseLoading ? (
                    <View style={styles.loadingContainer}>
                      <Text style={styles.oxfordHouseLoadingText}>Loading Oxford Houses...</Text>
                    </View>
                  ) : (
                    <FlatList
                      data={oxfordHouseResults}
                      keyExtractor={(item) => item.id}
                      renderItem={({ item }) => (
                        <TouchableOpacity
                          style={styles.houseItem}
                          onPress={() => handleOxfordHouseSelected(item)}
                        >
                          <View style={styles.houseInfo}>
                            <Text style={styles.houseName}>{item.name}</Text>
                            <Text style={styles.houseAddress} numberOfLines={2} ellipsizeMode="tail">
                              {item.address}, {item.city}, {item.state} {item.zipCode}
                            </Text>
                          </View>
                          <MaterialIcons name="chevron-right" size={24} color="#666" />
                        </TouchableOpacity>
                      )}
                      style={styles.resultsList}
                      contentContainerStyle={oxfordHouseResults.length === 0 ? styles.resultsEmptyContainer : undefined}
                      keyboardShouldPersistTaps="handled"
                      showsVerticalScrollIndicator={false}
                      ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                          <MaterialIcons name="search-off" size={48} color="#ccc" />
                          <Text style={styles.emptyText}>No Oxford Houses found</Text>
                          <Text style={styles.emptySubtext}>Try a different search term or state</Text>
                        </View>
                      }
                    />
                  )}
                </View>

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
                        style={styles.statePickerOverlayList}
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
                            <Text
                              style={[
                                styles.statePickerOverlayItemText,
                                oxfordHouseSelectedState === item && styles.statePickerOverlayItemTextSelected
                              ]}
                            >
                              {item || 'All States'}
                            </Text>
                            {oxfordHouseSelectedState === item && (
                              <MaterialIcons name="check" size={20} color="#2196F3" />
                            )}
                          </TouchableOpacity>
                        )}
                      />
                    </View>
                  </View>
                )}
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      )}

      {/* Ending Tracking Loading Overlay */}
      {isEndingTracking && (
      <Modal
        visible
        transparent={true}
        animationType={Platform.OS === 'ios' ? 'none' : 'fade'}
        presentationStyle="overFullScreen"
      >
        <View style={styles.endingTrackingOverlay}>
          <View style={styles.endingTrackingCard}>
            <ActivityIndicator size="large" color="#2196F3" />
            <Text style={styles.endingTrackingText}>Ending tracking...</Text>
            <Text style={styles.endingTrackingSubtext}>Saving your trip data</Text>
          </View>
        </View>
      </Modal>
      )}

      {/* Starting Tracking Loading Overlay */}
      {isStartingTracking && (
      <Modal
        visible
        transparent={true}
        animationType={Platform.OS === 'ios' ? 'none' : 'fade'}
        presentationStyle="overFullScreen"
      >
        <View style={styles.endingTrackingOverlay}>
          <View style={styles.endingTrackingCard}>
            <ActivityIndicator size="large" color="#2196F3" />
            <Text style={styles.endingTrackingText}>GPS Tracking starting...</Text>
            <Text style={styles.endingTrackingSubtext}>Getting location and preparing trip</Text>
          </View>
        </View>
      </Modal>
      )}
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
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  statusContainer: {
    marginBottom: 20,
  },
  statusCard: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statusCardActive: {
    borderWidth: 2,
    borderColor: '#4CAF50',
  },
  statusText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
    marginTop: 8,
  },
  statusTextActive: {
    color: '#4CAF50',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 20,
  },
  statCard: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    minWidth: 120,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
    textAlign: 'center',
  },
  formContainer: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 16,
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
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  purposeDropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
  },
  purposeDropdownText: {
    fontSize: 16,
    color: '#333',
  },
  purposeDropdownPlaceholder: {
    color: '#999',
  },
  purposeModalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  purposeModalContent: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
    maxHeight: '70%',
  },
  purposeModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  purposeModalList: {
    maxHeight: 320,
  },
  purposeModalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  purposeModalItemSelected: {
    backgroundColor: 'rgba(76, 175, 80, 0.08)',
  },
  purposeModalItemText: {
    fontSize: 16,
    color: '#333',
  },
  purposeModalEmpty: {
    fontSize: 14,
    color: '#666',
    paddingVertical: 16,
    paddingHorizontal: 12,
    textAlign: 'center',
  },
  purposeModalClose: {
    marginTop: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  purposeModalCloseText: {
    fontSize: 16,
    color: '#666',
  },
  purposeOtherContainer: {
    paddingVertical: 8,
  },
  purposeOtherLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  purposeOtherActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
    gap: 12,
  },
  purposeOtherBack: {
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  purposeOtherBackText: {
    fontSize: 16,
    color: '#666',
  },
  purposeOtherDone: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: '#2196F3',
    borderRadius: 8,
  },
  purposeOtherDoneDisabled: {
    backgroundColor: '#ccc',
  },
  purposeOtherDoneText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
  actionsContainer: {
    marginBottom: 20,
  },
  startButton: {
    backgroundColor: '#4CAF50',
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  startButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  stopButton: {
    backgroundColor: '#f44336',
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  stopButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  trackingActiveContainer: {
    alignItems: 'center',
  },
  trackingActiveCard: {
    backgroundColor: '#e8f5e8',
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#4CAF50',
    maxWidth: 300,
  },
  trackingActiveText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginTop: 8,
    marginBottom: 8,
  },
  trackingActiveSubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
  instructionsContainer: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  instructionsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  instructionsText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
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
    maxHeight: '88%',
  },
  oxfordHouseModalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    width: '90%',
    maxWidth: 400,
    maxHeight: '88%',
    minHeight: 420,
    overflow: 'hidden',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  closeButton: {
    padding: 4,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 10,
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
  },
  statePickerText: {
    fontSize: 16,
    color: '#333',
    flex: 1,
  },
  manualEntryContainer: {
    paddingBottom: 10,
  },
  oxfordHouseResultsContainer: {
    marginTop: 2,
    minHeight: 180,
    maxHeight: 280,
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
    width: '100%',
    marginTop: 6,
  },
  resultsEmptyContainer: {
    flexGrow: 1,
  },
  houseItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
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
    lineHeight: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  oxfordHouseLoadingText: {
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
  modalTopActionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 10,
    marginBottom: 6,
  },
  modalScrollArea: {
    flexGrow: 0,
    maxHeight: '68%',
  },
  modalScrollContent: {
    paddingBottom: 4,
  },
  rearrangeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2196F3',
    marginLeft: 10,
  },
  rearrangeButtonText: {
    color: '#2196F3',
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 4,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
    marginBottom: 8,
    textAlign: 'center',
  },
  editHintContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E3F2FD',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 10,
  },
  editHintText: {
    marginLeft: 6,
    color: '#1565C0',
    fontSize: 13,
    fontWeight: '500',
  },
  startSuggestionHintContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E3F2FD',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 10,
  },
  startSuggestionHintText: {
    marginLeft: 8,
    color: '#1565C0',
    fontSize: 13,
    fontWeight: '500',
  },
  startSuggestionBadge: {
    marginTop: 6,
    alignSelf: 'flex-start',
    backgroundColor: '#E8F5E9',
    borderWidth: 1,
    borderColor: '#4CAF50',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  startSuggestionBadgeText: {
    color: '#2E7D32',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  locationOptionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#f8f9fa',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  disabledButton: {
    backgroundColor: '#f0f0f0',
    borderColor: '#d0d0d0',
    opacity: 0.6,
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
    lineHeight: 18,
  },
  modalButtonSecondary: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2196F3',
    alignItems: 'center',
    marginTop: 8,
  },
  modalButtonSecondaryText: {
    color: '#2196F3',
    fontSize: 16,
    fontWeight: '600',
  },
  reorderButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: -6,
    marginBottom: 10,
    gap: 12,
  },
  reorderButton: {
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#2196F3',
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
  inputDisabled: {
    backgroundColor: '#f5f5f5',
    color: '#999',
    borderColor: '#e0e0e0',
  },
  disabledText: {
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
    marginTop: 4,
  },
  
  // AI Purpose Suggestions Styles
  suggestionsContainer: {
    marginTop: 8,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12,
  },
  suggestionsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#fff',
    borderRadius: 6,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  suggestionContent: {
    flex: 1,
    marginRight: 8,
  },
  suggestionText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 2,
  },
  suggestionReason: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
  },
  confidenceBadge: {
    backgroundColor: '#2196F3',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  confidenceText: {
    fontSize: 12,
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
  
  // Odometer Edit Styles
  editOdometerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    marginTop: 8,
    alignSelf: 'center',
  },
  editOdometerButtonText: {
    color: '#2196F3',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 4,
  },
  odometerEditContainer: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  odometerEditButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    gap: 12,
  },
  saveOdometerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4CAF50',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 6,
    flex: 1,
  },
  saveOdometerButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 4,
  },
  cancelOdometerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 6,
    flex: 1,
  },
  cancelOdometerButtonText: {
    color: '#666',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 4,
  },
  endingTrackingOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  endingTrackingCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    minWidth: 200,
  },
  endingTrackingText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
  },
  endingTrackingSubtext: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
  },
});
