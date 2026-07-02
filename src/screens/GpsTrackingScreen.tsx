import React, { useState, useEffect, useLayoutEffect, useRef, useMemo, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
  AppState,
  AppStateStatus,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import * as Location from 'expo-location';
import { GpsTrackingService } from '../services/gpsTrackingService';
import { DatabaseService } from '../services/database';
import { GpsTrackingSession, Employee, LocationDetails, OxfordHouse, SavedAddress, Vehicle } from '../types';
import { useGpsTracking } from '../contexts/GpsTrackingContext';
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
import { buildPartsFromGeocode } from '../utils/addressFormatter';
import { normalizeLocationDetails } from '../utils/locationName';
import {
  addressesStrictlyMatch,
  calculateDistanceMiles,
  findBestOxfordHouseMatch,
  findBestSavedAddressMatch,
  getGpsLocationConfidenceLabel,
  GPS_NEARBY_MATCH_MILES,
} from '../utils/gpsLocationMatch';
import { KeyboardAwareScrollView, ScrollToOnFocusView } from '../components/KeyboardAwareScrollView';
import { dismissKeyboardForSelection } from '../utils/formInteraction';
import { hapticMedium } from '../utils/haptics';
import { showGpsTripOptionsAlert } from '../utils/gpsTripOptionsAlert';
import { useEndTripFlow } from '../hooks/useEndTripFlow';
import {
  executeEndTripSave,
  finalizeEndTripNavigation,
  GPS_TRIP_UI_STATE_KEY,
} from '../services/endTripCoordinator';
import { makeLocationDetails, toCanonicalAddress } from '../utils/locationSelection';
import { consumePendingGpsLocationPick } from '../utils/pendingLocationSelection';
import { searchTextInputProps } from '../utils/keyboardDismiss';

interface GpsTrackingScreenProps {
  navigation: any;
  route?: any;
}

type StartLocationOption =
  | 'lastDestination'
  | 'baseAddress'
  | 'favoriteAddresses'
  | 'myFlock'
  | 'oxfordHouse'
  | 'newLocation';

type EndLocationOption =
  | 'baseAddress'
  | 'tripStart'
  | 'favoriteAddresses'
  | 'myFlock'
  | 'oxfordHouse'
  | 'newLocation';

const TRUSTED_END_LOCATION_SOURCES = new Set<NonNullable<LocationDetails['source']>>([
  'baseAddress',
  'baseAddress2',
]);

interface PersistedGpsTripUiState {
  employeeId: string;
  startLocationDetails: LocationDetails | null;
  selectedVehicleId: string;
  selectedCostCenter: string;
  trackingForm: { odometerReading: string; purpose: string; notes: string };
}

type StartLocationSuggestion = {
  details: LocationDetails;
  reason: string;
  confidenceLabel: 'Strong match' | 'Address match' | 'Nearby match';
};

export default function GpsTrackingScreen({ navigation, route }: GpsTrackingScreenProps) {
  const endTripOverlay = route?.params?.endTripOverlay === true;
  const { colors, isDark } = useTheme();

  const purposeThemedStyles = useMemo(
    () => ({
      dropdown: {
        backgroundColor: colors.card,
        borderColor: colors.border,
      },
      dropdownText: { color: colors.text },
      dropdownPlaceholder: { color: colors.textSecondary },
      modalTitle: { color: colors.text },
      modalItemText: { color: colors.text },
      modalEmpty: { color: colors.textSecondary },
      modalCloseText: { color: colors.primary },
      modalItemBorder: { borderBottomColor: colors.border },
      modalItemSelected: { backgroundColor: isDark ? 'rgba(76, 175, 80, 0.2)' : 'rgba(76, 175, 80, 0.08)' },
    }),
    [colors, isDark]
  );

  const formThemedStyles = useMemo(
    () => ({
      sectionTitle: { color: colors.text },
      label: { color: colors.text },
      helpText: { color: colors.textSecondary },
      input: {
        backgroundColor: colors.surface,
        borderColor: colors.border,
        color: colors.text,
      },
      statusCard: { backgroundColor: colors.surface },
      statusText: { color: colors.textSecondary },
      odometerDisplay: {
        backgroundColor: isDark ? colors.card : '#f8f9fa',
        borderColor: colors.border,
      },
      odometerDisplayLocked: {
        backgroundColor: isDark ? colors.surface : '#eceff1',
        borderColor: colors.border,
        opacity: 0.92,
      },
      odometerValue: { color: colors.text },
      odometerValueLocked: { color: colors.textSecondary },
      odometerNote: { color: colors.textSecondary },
      suggestionsTitle: { color: colors.text },
      suggestionText: { color: colors.text },
      suggestionReason: { color: colors.textSecondary },
      instructionsTitle: { color: colors.text },
      instructionsText: { color: colors.textSecondary },
      purposeOtherLabel: { color: colors.textSecondary },
    }),
    [colors, isDark]
  );
  const {
    isTracking,
    tripPaused,
    pauseTrip,
    resumeTrip,
    currentSession,
    currentDistance,
    startTracking,
    stopTracking,
    requestStopTracking,
    registerEndTripFlowHandler,
    setShouldShowEndLocationModal,
    clearEndTripUiState,
  } = useGpsTracking();
  const endTripFlow = useEndTripFlow({
    clearEndTripUiState,
    navigation,
    endTripOverlay,
  });
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
  const [isEditingStartLocationOptions, setIsEditingStartLocationOptions] = useState(false);
  const [isEditingEndLocationOptions, setIsEditingEndLocationOptions] = useState(false);
  const [startLocationOptionOrder, setStartLocationOptionOrder] = useState<StartLocationOption[]>([
    'lastDestination',
    'baseAddress',
    'favoriteAddresses',
    'myFlock',
    'oxfordHouse',
    'newLocation',
  ]);
  const [endLocationOptionOrder, setEndLocationOptionOrder] = useState<EndLocationOption[]>([
    'baseAddress',
    'tripStart',
    'favoriteAddresses',
    'myFlock',
    'oxfordHouse',
    'newLocation',
  ]);
  const [showOxfordHouseSearchModal, setShowOxfordHouseSearchModal] = useState(false);
  const [oxfordHousePickerRole, setOxfordHousePickerRole] = useState<'start' | 'end'>('start');
  const [manualStartInitialLocation, setManualStartInitialLocation] = useState<Partial<LocationDetails> | null>(null);
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
  /** Synchronous source of truth for chosen trip start (React setState can lag behind startGpsTracking). */
  const startLocationDetailsRef = useRef<LocationDetails | null>(null);
  const applyTripStartLocation = useCallback((details: LocationDetails) => {
    const normalized = normalizeLocationDetails(details) || details;
    startLocationDetailsRef.current = normalized;
    setStartLocationDetails(normalized);
  }, []);
  const clearTripStartLocation = useCallback(() => {
    startLocationDetailsRef.current = null;
    setStartLocationDetails(null);
  }, []);
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
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>('');
  const [hasStartedGpsToday, setHasStartedGpsToday] = useState(false);
  const [dailyStartingOdometer, setDailyStartingOdometer] = useState('');
  const [milesDrivenToday, setMilesDrivenToday] = useState(0);
  const [lastTravelDayEndingOdometerNote, setLastTravelDayEndingOdometerNote] = useState('');
  const [isEditingOdometer, setIsEditingOdometer] = useState(false);
  const [nextTripStartingOdometer, setNextTripStartingOdometer] = useState<number | null>(null);
  const [travelReasons, setTravelReasons] = useState<TravelReason[]>([]);
  const [showPurposePickerModal, setShowPurposePickerModal] = useState(false);
  const [showCustomPurposeInput, setShowCustomPurposeInput] = useState(false);
  const [isStartingTracking, setIsStartingTracking] = useState(false);
  const isStartingTrackingRef = useRef(false);
  isStartingTrackingRef.current = isStartingTracking;
  const gpsStatusCheckRef = useRef<Promise<void> | null>(null);
  // Ref so useFocusEffect does not depend on isTracking — when tracking stops, isTracking flips
  // false and would re-run the effect mid-end-trip, racing checkGpsTrackingStatus with save/goBack (iOS freeze).
  const isTrackingRef = useRef(isTracking);
  isTrackingRef.current = isTracking;
  const lastAppliedEndFromFavoritesRef = useRef<string | null>(null);
  const awaitingEndLocationPickerRef = useRef(false);
  const openEndLocationOptionsRef = useRef<() => void>(() => {});

  const canonicalBaseAddress = useMemo(
    () => toCanonicalAddress(currentEmployee?.baseAddress || ''),
    [currentEmployee?.baseAddress]
  );

  useEffect(() => {
    loadEmployee();
    loadPreferences();
    getTravelReasons().then(setTravelReasons);
    
    // Reset all states when component mounts to prevent stuck modals
    return () => {
      setShowLocationOptionsModal(false);
      setShowStartLocationModal(false);
      endTripFlow.dismissEndTrip();
      setShowOxfordHouseSearchModal(false);
      setShowPurposeSuggestions(false);
    };
  }, []);

  useEffect(() => {
    if (currentEmployee && selectedVehicleId && !isStartingTrackingRef.current) {
      void checkGpsTrackingStatus(currentEmployee.id, selectedVehicleId);
      void refreshLastTravelDayEndingOdometerNote(currentEmployee.id, selectedVehicleId);
    }
  }, [currentEmployee, selectedVehicleId]);

  // Load user preferences
  const loadPreferences = async () => {
    try {
      const prefs = await PreferencesService.getPreferences();
      setShowGpsDuration(prefs.showGpsDuration);
      setStartLocationOptionOrder(
        (prefs.gpsStartLocationOptionOrder?.filter((option): option is StartLocationOption =>
          ['lastDestination', 'baseAddress', 'favoriteAddresses', 'myFlock', 'oxfordHouse', 'newLocation'].includes(option)
        ) || ['lastDestination', 'baseAddress', 'favoriteAddresses', 'myFlock', 'oxfordHouse', 'newLocation']) as StartLocationOption[]
      );
      setEndLocationOptionOrder(
        (prefs.gpsEndLocationOptionOrder?.filter((option): option is EndLocationOption =>
          ['baseAddress', 'tripStart', 'favoriteAddresses', 'myFlock', 'oxfordHouse', 'newLocation'].includes(option)
        ) || ['baseAddress', 'tripStart', 'favoriteAddresses', 'myFlock', 'oxfordHouse', 'newLocation']) as EndLocationOption[]
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
      const wantsOverlayEnd = route?.params?.endTripOverlay === true;

      if (wantsOverlayEnd && !endTripFlow.endFlowOpenedThisFocusRef.current) {
        endTripFlow.endFlowOpenedThisFocusRef.current = true;
        if (isTrackingRef.current) {
          openEndLocationOptionsRef.current();
        } else {
          endTripFlow.endTripFlowPendingRef.current = true;
        }
      } else if (!wantsOverlayEnd && !endTripFlow.endFlowOpenedThisFocusRef.current) {
        // Never reset end-trip modals here — doing so closed the flow when deps changed mid-stop.
        setShowLocationOptionsModal(false);
        setShowStartLocationModal(false);
        setShowOxfordHouseSearchModal(false);
        setShowPurposeSuggestions(false);
      }

      if (currentEmployee && !isStartingTrackingRef.current) {
        void checkGpsTrackingStatus(currentEmployee.id, selectedVehicleId || undefined);
      }

      return () => {
        endTripFlow.endFlowOpenedThisFocusRef.current = false;
      };
    }, [currentEmployee, selectedVehicleId, route?.params?.endTripOverlay])
  );

  useEffect(() => {
    if (!endTripFlow.endTripFlowPendingRef.current || !isTracking) return;
    endTripFlow.endTripFlowPendingRef.current = false;
    openEndLocationOptionsRef.current();
  }, [isTracking]);

  const dismissAllEndTripModals = useCallback(() => {
    setShowLocationOptionsModal(false);
    setShowStartLocationModal(false);
    setShowOxfordHouseSearchModal(false);
    setShowPurposePickerModal(false);
    setShowPurposeSuggestions(false);
    setShouldShowEndLocationModal(false);
    endTripFlow.dismissEndTrip();
  }, [setShouldShowEndLocationModal, endTripFlow.dismissEndTrip]);

  const dismissStaleGpsModals = dismissAllEndTripModals;

  // After lock/unlock or incomplete end-trip, hidden modals can block the GPS start form.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (nextState !== 'active') return;
      if (!GpsTrackingService.isTracking() && !isTrackingRef.current) {
        dismissStaleGpsModals();
        // Don't pop the overlay while save/navigation is in flight — races with navigation.reset.
        if (endTripOverlay && !endTripFlow.isSavingRef.current) {
          navigation.goBack();
        }
      }
    });
    return () => sub.remove();
  }, [dismissStaleGpsModals, endTripOverlay, navigation]);

  useEffect(() => {
    if (!isTracking || !currentEmployee?.id) return;

    const payload: PersistedGpsTripUiState = {
      employeeId: currentEmployee.id,
      startLocationDetails: startLocationDetailsRef.current ?? startLocationDetails,
      selectedVehicleId,
      selectedCostCenter,
      trackingForm,
    };
    void AsyncStorage.setItem(GPS_TRIP_UI_STATE_KEY, JSON.stringify(payload));
  }, [
    isTracking,
    currentEmployee?.id,
    startLocationDetails,
    selectedVehicleId,
    selectedCostCenter,
    trackingForm,
  ]);

  useEffect(() => {
    if (!isTracking || !currentSession?.startLocationDetails) return;
    if (!startLocationDetailsRef.current) {
      applyTripStartLocation(currentSession.startLocationDetails);
    }
  }, [isTracking, currentSession?.id, currentSession?.startLocationDetails, applyTripStartLocation]);

  useLayoutEffect(() => {
    if (!endTripOverlay) return;

    void (async () => {
      try {
        const raw = await AsyncStorage.getItem(GPS_TRIP_UI_STATE_KEY);
        if (!raw) return;
        const saved: PersistedGpsTripUiState = JSON.parse(raw);
        if (saved.employeeId && currentEmployee?.id && saved.employeeId !== currentEmployee.id) {
          return;
        }
        if (currentSession?.startLocationDetails) {
          applyTripStartLocation(currentSession.startLocationDetails);
        } else if (saved.startLocationDetails) {
          applyTripStartLocation(saved.startLocationDetails);
        }
        if (saved.selectedVehicleId) {
          setSelectedVehicleId(saved.selectedVehicleId);
        }
        if (saved.selectedCostCenter) {
          setSelectedCostCenter(saved.selectedCostCenter);
        }
        if (saved.trackingForm) {
          setTrackingForm(saved.trackingForm);
        }
      } catch {
        // Best-effort restore for end-trip overlay from Home.
      }
    })();
  }, [endTripOverlay, currentEmployee?.id, currentSession?.startLocationDetails, applyTripStartLocation]);

  const effectiveTripStartLocation = useMemo(
    () =>
      startLocationDetailsRef.current ??
      startLocationDetails ??
      currentSession?.startLocationDetails ??
      null,
    [startLocationDetails, currentSession?.startLocationDetails]
  );

  const dismissEndTripOverlay = () => {
    endTripFlow.dismissEndTripOverlay();
  };

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

  const loadEmployee = async () => {
    try {
      const employee = await DatabaseService.getCurrentEmployee();
      if (!employee) {
        console.error('❌ GPS: No current employee found');
        return;
      }
      setCurrentEmployee(employee);
      
      if (employee) {
        const loadedVehicles = await DatabaseService.getVehicles(employee.id);
        setVehicles(loadedVehicles);
        const defaultVehicle = loadedVehicles.find((v) => v.isDefault) || loadedVehicles[0];
        setSelectedVehicleId(defaultVehicle?.id || '');

        // Initialize cost center
        const costCenter = employee.defaultCostCenter || employee.selectedCostCenters?.[0] || '';
        setSelectedCostCenter(costCenter);
        
        // Check if GPS tracking has been started today
        await checkGpsTrackingStatus(employee.id, defaultVehicle?.id);

        await refreshLastTravelDayEndingOdometerNote(employee.id, defaultVehicle?.id);
      }
      
      // Do not pre-fill trip start with base address — it leaked into "Start from last destination" saves.
      
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

  const refreshLastTravelDayEndingOdometerNote = async (employeeId: string, vehicleId?: string) => {
    const today = new Date();
    const lastTravelDay = await DatabaseService.getLastTravelDayEndingOdometer(
      employeeId,
      today,
      vehicleId
    );
    if (lastTravelDay) {
      const dateText = lastTravelDay.date.toLocaleDateString();
      setLastTravelDayEndingOdometerNote(
        `Ending odometer of last travel day (${dateText}): ${Math.round(lastTravelDay.endingOdometer)}`
      );
      return Math.round(lastTravelDay.endingOdometer);
    }
    setLastTravelDayEndingOdometerNote('');
    return null;
  };

  const checkGpsTrackingStatus = async (employeeId: string, vehicleId?: string) => {
    const run = async () => {
      if (isStartingTrackingRef.current) return;

      try {
        // Use device's local timezone instead of UTC
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        console.log('🚗 GPS: Checking GPS status for date:', today.toISOString().split('T')[0]);

        const existingReading = await DatabaseService.getDailyOdometerReading(
          employeeId,
          today,
          vehicleId
        );
        const entriesForDate = await DatabaseService.getMileageEntriesForVehicleOnDate(
          employeeId,
          today,
          vehicleId
        );
        const hasMileageToday = entriesForDate.length > 0;
        const totalMilesToday = await DatabaseService.getTotalMilesForVehicleOnDate(
          employeeId,
          today,
          vehicleId
        );
        setMilesDrivenToday(totalMilesToday);

        if (hasMileageToday && existingReading) {
          console.log('🚗 GPS: Mileage already recorded today; showing locked daily start odometer');
          setHasStartedGpsToday(true);
          setDailyStartingOdometer(existingReading.odometerReading.toString());
          setTrackingForm((prev) => ({
            ...prev,
            odometerReading: existingReading.odometerReading.toString(),
          }));
          const nextTripOdometer = await DatabaseService.resolveOdometerForNextTrip(
            employeeId,
            today,
            vehicleId
          );
          setNextTripStartingOdometer(nextTripOdometer);
        } else {
          const defaultStart = await DatabaseService.resolveDefaultStartingOdometer(
            employeeId,
            today,
            vehicleId
          );
          console.log('🚗 GPS: Suggested starting odometer from last travel day:', defaultStart);
          setHasStartedGpsToday(false);
          setDailyStartingOdometer('');
          setNextTripStartingOdometer(null);
          setTrackingForm((prev) => ({
            ...prev,
            odometerReading: defaultStart != null ? String(defaultStart) : '',
          }));
          await refreshLastTravelDayEndingOdometerNote(employeeId, vehicleId);
        }
      } catch (error) {
        console.error('Error checking GPS tracking status:', error);
        setHasStartedGpsToday(false);
        setDailyStartingOdometer('');
        setMilesDrivenToday(0);
      }
    };

    const previous = gpsStatusCheckRef.current;
    const next = (previous ?? Promise.resolve()).then(run, run);
    gpsStatusCheckRef.current = next.finally(() => {
      if (gpsStatusCheckRef.current === next) {
        gpsStatusCheckRef.current = null;
      }
    });
    await next;
  };

  const resolveOdometerForTripStart = async (): Promise<number> => {
    if (!currentEmployee) {
      throw new Error('No employee loaded');
    }
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const hasMileageToday =
      (await DatabaseService.getMileageEntriesForVehicleOnDate(
        currentEmployee.id,
        today,
        selectedVehicleId || undefined
      )).length > 0;
    if (hasMileageToday) {
      const nextTripOdometer = await DatabaseService.resolveOdometerForNextTrip(
        currentEmployee.id,
        today,
        selectedVehicleId || undefined
      );
      if (nextTripOdometer != null) {
        return nextTripOdometer;
      }
    }
    return Number(trackingForm.odometerReading);
  };

  const handleInputChange = (field: string, value: string) => {
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
      if (!currentEmployee || !trackingForm.odometerReading.trim()) {
        Alert.alert('Error', 'Please enter a valid odometer reading');
        return;
      }
      const parsed = Number(trackingForm.odometerReading);
      if (!Number.isFinite(parsed) || parsed < 0) {
        Alert.alert('Error', 'Please enter a valid odometer reading');
        return;
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

      await DatabaseService.updateDailyOdometerReadingByEmployeeAndDate(
        currentEmployee.id,
        dateStr,
        { odometerReading: parsed, notes: 'Updated by user' },
        selectedVehicleId || undefined
      );

      setIsEditingOdometer(false);
      setDailyStartingOdometer(String(parsed));
      Alert.alert('Success', 'Starting odometer reading updated successfully');
      await checkGpsTrackingStatus(currentEmployee.id, selectedVehicleId || undefined);
    } catch (error) {
      console.error('Error updating odometer reading:', error);
      Alert.alert('Error', 'Failed to update odometer reading');
    }
  };

  const handleCancelOdometerEdit = () => {
    setIsEditingOdometer(false);
    if (currentEmployee) {
      void checkGpsTrackingStatus(currentEmployee.id, selectedVehicleId || undefined);
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

  const handleLocationOption = (option: 'lastDestination' | 'baseAddress' | 'favoriteAddresses' | 'myFlock' | 'oxfordHouse' | 'newLocation') => {
    console.log('🔍 GPS: Location option selected:', option);
    console.log('🔍 GPS: Closing location options modal');
    setShowLocationOptionsModal(false);
    
    // Add a small delay to ensure modal closes before proceeding
    setTimeout(() => {
      if (option === 'lastDestination' && lastDestination) {
        console.log('🔍 GPS: Using last destination:', lastDestination.name);
        const normalized = normalizeLocationDetails(lastDestination) || lastDestination;
        void startGpsTracking(normalized);
      } else if (option === 'baseAddress' && currentEmployee?.baseAddress) {
        const suggested = startLocationSuggestions.baseAddress;
        const details = suggested?.details ?? {
          name: 'BA',
          address: canonicalBaseAddress,
          source: 'baseAddress' as const,
        };
        void startGpsTracking(details);
      } else if (option === 'favoriteAddresses') {
        const suggested = startLocationSuggestions.favoriteAddresses;
        if (suggested) {
          void startGpsTracking(suggested.details);
        } else {
          console.log('🔍 GPS: Navigating to favorite addresses');
          navigation.navigate('SavedAddresses', { fromGpsTrackingStart: true });
        }
      } else if (option === 'myFlock') {
        console.log('🔍 GPS: Navigating to My Flock');
        navigation.navigate('MyFlock', { fromGpsTrackingStart: true });
      } else if (option === 'oxfordHouse') {
        const suggested = startLocationSuggestions.oxfordHouse;
        if (suggested) {
          void startGpsTracking(suggested.details);
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
      });

      const currentLat = currentPosition.coords.latitude;
      const currentLon = currentPosition.coords.longitude;
      // End-location suggestions should not depend on Places API; keep this flow local/editable.
      let currentAddress = '';
      let geocodeParts: ReturnType<typeof buildPartsFromGeocode> | null = null;
      const geocode = await Location.reverseGeocodeAsync({
        latitude: currentLat,
        longitude: currentLon,
      });
      if (geocode.length > 0) {
        geocodeParts = buildPartsFromGeocode(geocode[0]);
        currentAddress = geocodeParts.oneLine;
      }

      if (
        currentEmployee.baseAddress &&
        currentAddress &&
        addressesStrictlyMatch(currentAddress, canonicalBaseAddress)
      ) {
        suggestions.baseAddress = {
          details: {
            name: 'BA',
            address: canonicalBaseAddress,
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

      const matchedSavedAddress = findBestSavedAddressMatch(
        savedAddresses,
        currentLat,
        currentLon,
        currentAddress
      );

      if (matchedSavedAddress) {
        suggestions.favoriteAddresses = {
          details: {
            name: matchedSavedAddress.item.name,
            address: matchedSavedAddress.item.address,
            latitude: matchedSavedAddress.item.latitude ?? currentLat,
            longitude: matchedSavedAddress.item.longitude ?? currentLon,
          },
          reason: `Looks like you're at saved address "${matchedSavedAddress.item.name}".`,
          confidenceLabel: getGpsLocationConfidenceLabel(
            matchedSavedAddress.distanceMatch,
            matchedSavedAddress.addressMatch
          ),
        };
      }

      const matchedOxfordHouse = findBestOxfordHouseMatch(oxfordHouses, currentAddress);

      if (matchedOxfordHouse) {
        suggestions.oxfordHouse = {
          details: {
            name: matchedOxfordHouse.name,
            address: `${matchedOxfordHouse.address}, ${matchedOxfordHouse.city}, ${matchedOxfordHouse.state} ${matchedOxfordHouse.zipCode}`,
            latitude: currentLat,
            longitude: currentLon,
            source: 'oxfordHouse',
            sourceId: matchedOxfordHouse.id,
          },
          reason: `Looks like you're at ${matchedOxfordHouse.name}.`,
          confidenceLabel: 'Address match',
        };
      }

      if (currentAddress && geocodeParts) {
        suggestions.newLocation = {
          details: {
            name: '',
            address: geocodeParts.oneLine || currentAddress,
            latitude: currentLat,
            longitude: currentLon,
            city: geocodeParts.city,
            state: geocodeParts.state,
            zipCode: geocodeParts.zipCode,
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
      });

      const currentLat = currentPosition.coords.latitude;
      const currentLon = currentPosition.coords.longitude;
      let currentAddress = '';
      let geocodeParts: ReturnType<typeof buildPartsFromGeocode> | null = null;
      const geocode = await Location.reverseGeocodeAsync({
        latitude: currentLat,
        longitude: currentLon,
      });
      if (geocode.length > 0) {
        geocodeParts = buildPartsFromGeocode(geocode[0]);
        currentAddress = geocodeParts.oneLine;
      }

      if (
        currentEmployee.baseAddress &&
        currentAddress &&
        addressesStrictlyMatch(currentAddress, canonicalBaseAddress)
      ) {
        suggestions.baseAddress = {
          details: {
            name: 'BA',
            address: canonicalBaseAddress,
            latitude: currentLat,
            longitude: currentLon,
          },
          reason: 'You appear to be at your Base Address.',
          confidenceLabel: 'Address match',
        };
      }

      const tripStartForSuggestions =
        startLocationDetailsRef.current ??
        startLocationDetails ??
        currentSession?.startLocationDetails ??
        null;

      if (tripStartForSuggestions) {
        const tripStartAddress = tripStartForSuggestions.address?.trim() || tripStartForSuggestions.name;
        const tripStartDistanceMatch =
          typeof tripStartForSuggestions.latitude === 'number' &&
          typeof tripStartForSuggestions.longitude === 'number' &&
          calculateDistanceMiles(
            currentLat,
            currentLon,
            tripStartForSuggestions.latitude,
            tripStartForSuggestions.longitude
          ) <= GPS_NEARBY_MATCH_MILES;
        const tripStartAddressMatch =
          !!currentAddress && addressesStrictlyMatch(currentAddress, tripStartAddress);

        if (tripStartDistanceMatch || tripStartAddressMatch) {
          suggestions.tripStart = {
            details: {
              name: tripStartForSuggestions.name,
              address: tripStartAddress,
              latitude: tripStartForSuggestions.latitude ?? currentLat,
              longitude: tripStartForSuggestions.longitude ?? currentLon,
            },
            reason: 'Looks like you are back at your trip start location.',
            confidenceLabel: getGpsLocationConfidenceLabel(
              tripStartDistanceMatch,
              tripStartAddressMatch
            ),
          };
        }
      }

      const [savedAddresses, oxfordHouses] = await Promise.all([
        DatabaseService.getSavedAddresses(currentEmployee.id),
        OxfordHouseService.getAllOxfordHouses(),
      ]);

      const matchedSavedAddress = findBestSavedAddressMatch(
        savedAddresses,
        currentLat,
        currentLon,
        currentAddress
      );

      if (matchedSavedAddress) {
        suggestions.favoriteAddresses = {
          details: {
            name: matchedSavedAddress.item.name,
            address: matchedSavedAddress.item.address,
            latitude: matchedSavedAddress.item.latitude ?? currentLat,
            longitude: matchedSavedAddress.item.longitude ?? currentLon,
          },
          reason: `Looks like you're at saved address "${matchedSavedAddress.item.name}".`,
          confidenceLabel: getGpsLocationConfidenceLabel(
            matchedSavedAddress.distanceMatch,
            matchedSavedAddress.addressMatch
          ),
        };
      }

      const matchedOxfordHouse = findBestOxfordHouseMatch(oxfordHouses, currentAddress);

      if (matchedOxfordHouse) {
        suggestions.oxfordHouse = {
          details: {
            name: matchedOxfordHouse.name,
            address: `${matchedOxfordHouse.address}, ${matchedOxfordHouse.city}, ${matchedOxfordHouse.state} ${matchedOxfordHouse.zipCode}`,
            latitude: currentLat,
            longitude: currentLon,
            source: 'oxfordHouse',
            sourceId: matchedOxfordHouse.id,
          },
          reason: `Looks like you're at ${matchedOxfordHouse.name}.`,
          confidenceLabel: 'Address match',
        };
      }

      if (currentAddress && geocodeParts) {
        suggestions.newLocation = {
          details: {
            name: '',
            address: geocodeParts.oneLine || currentAddress,
            latitude: currentLat,
            longitude: currentLon,
            city: geocodeParts.city,
            state: geocodeParts.state,
            zipCode: geocodeParts.zipCode,
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
    endTripFlow.openChoosing();
    setEndLocationSuggestions({});
    setIsDetectingEndSuggestions(true);
    void detectEndLocationSuggestions().finally(() => {
      setIsDetectingEndSuggestions(false);
    });
  };

  openEndLocationOptionsRef.current = openEndLocationOptions;

  const refreshEmployeeFromBackend = async (): Promise<Employee | null> => {
    const local = currentEmployee ?? (await DatabaseService.getCurrentEmployee());
    if (!local?.id) return null;

    try {
      const { ApiSyncService } = await import('../services/apiSyncService');
      const { API_BASE_URL } = await import('../config/api');
      const { getAuthHeaders } = await import('../services/authHeaders');
      const backendId = (await ApiSyncService.resolveBackendEmployeeId(local.id)) || local.id;
      const response = await fetch(`${API_BASE_URL}/employees/${encodeURIComponent(backendId)}`, {
        headers: await getAuthHeaders(),
      });
      if (!response.ok) return local;

      const emp = await response.json();
      const merged: Employee = {
        ...local,
        baseAddress: emp.baseAddress || local.baseAddress,
        baseAddress2: emp.baseAddress2 ?? local.baseAddress2,
      };
      setCurrentEmployee(merged);
      return merged;
    } catch (error) {
      console.warn('⚠️ GPS: Could not refresh employee profile from backend:', error);
      return local;
    }
  };

  const buildBaseAddressEndDetails = (
    employee: Employee,
    suggested?: StartLocationSuggestion
  ): LocationDetails =>
    makeLocationDetails({
      name: 'BA',
      address: employee.baseAddress,
      source: 'baseAddress',
      latitude: suggested?.details.latitude,
      longitude: suggested?.details.longitude,
    });

  useEffect(() => {
    registerEndTripFlowHandler(() => {
      if (isTrackingRef.current) {
        openEndLocationOptionsRef.current();
      }
    });
    return () => registerEndTripFlowHandler(null);
  }, [registerEndTripFlowHandler]);

  const openEndLocationModalWithDetails = (details: Partial<LocationDetails> | null) => {
    endTripFlow.hideChoosingForPicker();
    endTripFlow.openCapture(details);
  };

  const persistDailyOdometerForTripStart = async (
    employeeId: string,
    today: Date,
    odometerForTrip: number,
    vehicleId?: string
  ) => {
    const existingReading = await DatabaseService.getDailyOdometerReading(
      employeeId,
      today,
      vehicleId
    );
    if (!existingReading) {
      console.log('📝 Creating daily odometer reading from GPS tracking:', odometerForTrip);
      await DatabaseService.createDailyOdometerReading({
        employeeId,
        vehicleId,
        date: today,
        odometerReading: odometerForTrip,
        notes: 'Auto-captured from first GPS tracking session',
      });
      return;
    }
    if (Math.round(existingReading.odometerReading) !== Math.round(odometerForTrip)) {
      const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      await DatabaseService.updateDailyOdometerReadingByEmployeeAndDate(
        employeeId,
        dateStr,
        { odometerReading: odometerForTrip, notes: 'Confirmed from first GPS tracking session' },
        vehicleId
      );
    }
  };

  const startGpsTracking = async (chosenStart?: LocationDetails | null) => {
    const tripStart =
      chosenStart ??
      startLocationDetailsRef.current ??
      startLocationDetails;
    if (!tripStart) {
      Alert.alert('Missing start location', 'Please choose where this trip started before starting GPS tracking.');
      return;
    }

    try {
      setIsStartingTracking(true);
      applyTripStartLocation(tripStart);
      // Check if this is the first GPS tracking session of the day using device's local timezone
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      console.log('🚗 GPS: Starting GPS tracking for date:', today.toISOString().split('T')[0]);
      
      const hasMileageToday =
        (await DatabaseService.getMileageEntriesForVehicleOnDate(
          currentEmployee!.id,
          today,
          selectedVehicleId || undefined
        )).length > 0;

      const odometerForTrip = await resolveOdometerForTripStart();

      if (!hasMileageToday && odometerForTrip) {
        await persistDailyOdometerForTripStart(
          currentEmployee!.id,
          today,
          odometerForTrip,
          selectedVehicleId || undefined
        );
      }

      await startTracking(
        currentEmployee!.id,
        trackingForm.purpose,
        odometerForTrip,
        trackingForm.notes,
        tripStart
      );

      await checkGpsTrackingStatus(currentEmployee!.id, selectedVehicleId || undefined);

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

  const startGpsTrackingRef = useRef(startGpsTracking);
  startGpsTrackingRef.current = startGpsTracking;
  const openEndLocationModalWithDetailsRef = useRef(openEndLocationModalWithDetails);
  openEndLocationModalWithDetailsRef.current = openEndLocationModalWithDetails;
  const trackingFormRef = useRef(trackingForm);
  trackingFormRef.current = trackingForm;

  useFocusEffect(
    React.useCallback(() => {
      const pending = consumePendingGpsLocationPick();
      if (pending && currentEmployee) {
        awaitingEndLocationPickerRef.current = false;

        if (pending.kind === 'start' && !isTrackingRef.current) {
          if (!trackingFormRef.current.purpose.trim()) {
            Alert.alert('Missing Information', 'Please enter purpose before selecting a location.');
            return;
          }
          void startGpsTrackingRef.current(pending.address);
          return;
        }

        if (pending.kind === 'end' && isTrackingRef.current && currentSession?.id) {
          const dedupeKey = `${currentSession.id}|${pending.address.name}|${pending.address.address}`;
          if (lastAppliedEndFromFavoritesRef.current === dedupeKey) return;
          lastAppliedEndFromFavoritesRef.current = dedupeKey;
          openEndLocationModalWithDetailsRef.current(pending.address);
        }
        return;
      }

      if (awaitingEndLocationPickerRef.current && isTrackingRef.current) {
        awaitingEndLocationPickerRef.current = false;
        openEndLocationOptionsRef.current();
      }
    }, [currentEmployee, currentSession?.id])
  );

  const handleStartLocationConfirm = async (locationDetails: LocationDetails) => {
    const normalized = normalizeLocationDetails(locationDetails) || locationDetails;
    setShowStartLocationModal(false);
    setManualStartInitialLocation(null);
    void startGpsTracking(normalized);
  };

  const handleStopTrackingPress = () => {
    void hapticMedium();
    showGpsTripOptionsAlert({
      tripPaused,
      currentDistance,
      onResume: () => void resumeTrip(),
      onPause: () => void pauseTrip(),
      onEndAndSave: () => requestStopTracking(),
    });
  };

  const handleEndLocationOption = (
    option: 'baseAddress' | 'tripStart' | 'favoriteAddresses' | 'myFlock' | 'oxfordHouse' | 'newLocation'
  ) => {
    setTimeout(() => {
      const reopenChooseEndLocation = () => {
        if (isTrackingRef.current) {
          openEndLocationOptionsRef.current();
        }
      };

      if (option === 'baseAddress') {
        endTripFlow.hideChoosingForPicker();
        void (async () => {
          const employee = await refreshEmployeeFromBackend();
          if (!employee?.baseAddress?.trim()) {
            Alert.alert(
              'No base address',
              'Your profile does not have a base address on file. Add one in the web portal or choose another end location.'
            );
            reopenChooseEndLocation();
            return;
          }

          const suggested = endLocationSuggestions.baseAddress;
          const details = buildBaseAddressEndDetails(employee, suggested);
          await handleEndLocationConfirm(details);
        })();
        return;
      }

      endTripFlow.hideChoosingForPicker();

      if (option === 'tripStart') {
        const tripStart =
          startLocationDetailsRef.current ??
          startLocationDetails ??
          currentSession?.startLocationDetails ??
          null;
        if (!tripStart) {
          reopenChooseEndLocation();
          return;
        }
        const suggested = endLocationSuggestions.tripStart;
        if (suggested) {
          openEndLocationModalWithDetails(suggested.details);
        } else {
          openEndLocationModalWithDetails({
            name: tripStart.name,
            address: tripStart.address?.trim() || tripStart.name,
            latitude: tripStart.latitude,
            longitude: tripStart.longitude,
          });
        }
      } else if (option === 'favoriteAddresses') {
        const suggested = endLocationSuggestions.favoriteAddresses;
        if (suggested) {
          openEndLocationModalWithDetails(suggested.details);
        } else {
          awaitingEndLocationPickerRef.current = true;
          navigation.navigate('SavedAddresses', { fromGpsTrackingEnd: true });
        }
      } else if (option === 'myFlock') {
        awaitingEndLocationPickerRef.current = true;
        navigation.navigate('MyFlock', { fromGpsTrackingEnd: true });
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

  const endLocationMatchesStart = (end: LocationDetails): boolean => {
    const tripStart =
      startLocationDetailsRef.current ??
      startLocationDetails ??
      currentSession?.startLocationDetails ??
      null;
    if (!tripStart) return false;
    const start = normalizeLocationDetails(tripStart) || tripStart;

    // Coordinate proximity (~150 ft) is the strongest signal.
    if (
      typeof start.latitude === 'number' &&
      typeof start.longitude === 'number' &&
      typeof end.latitude === 'number' &&
      typeof end.longitude === 'number' &&
      calculateDistanceMiles(start.latitude, start.longitude, end.latitude, end.longitude) <= 0.03
    ) {
      return true;
    }

    // Otherwise fall back to text equality on name/address.
    const startName = (start.name || '').trim().toLowerCase();
    const endName = (end.name || '').trim().toLowerCase();
    const startAddr = normalizeAddress(start.address || '');
    const endAddr = normalizeAddress(end.address || '');
    const addrMatch = !!startAddr && startAddr === endAddr;
    const nameMatch = !!startName && startName === endName;
    return addrMatch || (nameMatch && !startAddr && !endAddr);
  };

  const handleEndLocationConfirm = async (
    locationDetails: LocationDetails,
    skipRoundTripCheck: boolean = false
  ) => {
    const normalizedDetails = normalizeLocationDetails(locationDetails) || locationDetails;
    // Trusted profile locations (e.g. End at Base Address) skip manual capture.
    if (
      normalizedDetails.source &&
      !TRUSTED_END_LOCATION_SOURCES.has(normalizedDetails.source) &&
      normalizedDetails.source !== 'manual'
    ) {
      openEndLocationModalWithDetails(normalizedDetails);
      return;
    }

    // Guard against the rare-but-painful bug where the end location is saved
    // identical to the start (e.g. an accidental "Same as Trip Start" tap, or a
    // stale prefill). Round trips back to the start are uncommon, so confirm.
    if (!skipRoundTripCheck && endLocationMatchesStart(normalizedDetails)) {
      Alert.alert(
        'End location same as start?',
        'This trip would be saved with the same end location as where you started. Round trips back to your starting point are uncommon — did you mean to end here?',
        [
          {
            text: 'Edit end location',
            style: 'cancel',
            onPress: () => openEndLocationModalWithDetails(null),
          },
          {
            text: 'Yes, end here',
            onPress: () => {
              void handleEndLocationConfirm(locationDetails, true);
            },
          },
        ]
      );
      return;
    }

    console.log('📍 End location confirmed:', normalizedDetails);
    setEndLocationDetails(normalizedDetails);
    endTripFlow.beginSaving();

    try {
      const effectiveStart =
        startLocationDetailsRef.current ??
        startLocationDetails ??
        currentSession?.startLocationDetails ??
        null;
      const normalizedStart = effectiveStart
        ? normalizeLocationDetails(effectiveStart) || effectiveStart
        : null;

      if (!currentEmployee) {
        throw new Error('No employee loaded');
      }

      const saveResult = await executeEndTripSave({
        normalizedDetails,
        normalizedStart,
        startLocationDetails: normalizedStart,
        currentEmployee,
        selectedVehicleId,
        selectedCostCenter,
        trackingTimeSeconds: trackingTime,
        stopTracking,
      });

      if (saveResult) {
        if (saveResult.mileageSaved) {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const updatedMilesToday = await DatabaseService.getTotalMilesForVehicleOnDate(
            currentEmployee.id,
            today,
            selectedVehicleId || undefined
          );
          setMilesDrivenToday(updatedMilesToday);
        }

        console.log('🔍 GPS: Updating last destination:', saveResult.endDisplay);
        setLastDestination(saveResult.normalizedDetails);

        setTrackingTime(0);
        clearTripStartLocation();
        setEndLocationDetails(null);
        setTrackingForm({
          odometerReading: '',
          purpose: '',
          notes: '',
        });
        setSelectedCostCenter('');

        dismissAllEndTripModals();
        await finalizeEndTripNavigation({
          navigation,
          alertMessage: saveResult.alertMessage,
        });
        endTripFlow.finishSaving();
        return;
      }

      setTrackingTime(0);
      clearTripStartLocation();
      setEndLocationDetails(null);
      setTrackingForm({
        odometerReading: '',
        purpose: '',
        notes: '',
      });
      setSelectedCostCenter('');
      endTripFlow.finishSaving();
    } catch (error) {
      console.error('Error stopping tracking:', error);
      endTripFlow.finishSaving();
      endTripFlow.dismissEndTrip();
      Alert.alert('Error', 'Failed to stop GPS tracking');
    }
  };

  const closeOxfordHouseSearchModal = (reopenEndLocationPicker = true) => {
    const wasEndPicker = oxfordHousePickerRole === 'end';
    setShowOxfordHouseSearchModal(false);
    setOxfordHousePickerRole('start');
    if (reopenEndLocationPicker && wasEndPicker && isTrackingRef.current) {
      openEndLocationOptionsRef.current();
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
      void startGpsTracking(locationDetails);
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
  const selectedVehicle = vehicles.find((v) => v.id === selectedVehicleId) || null;

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: endTripOverlay ? 'transparent' : colors.background },
        endTripOverlay && styles.endTripOverlayRoot,
      ]}
    >
      {endTripOverlay ? (
        <TouchableOpacity
          style={styles.endTripOverlayBackdrop}
          activeOpacity={1}
          onPress={dismissEndTripOverlay}
          accessibilityLabel="Dismiss end trip"
        />
      ) : null}

      {!endTripOverlay ? (
      <>
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
          <View
            style={[
              styles.statusCard,
              formThemedStyles.statusCard,
              isTracking && styles.statusCardActive,
              isTracking && tripPaused && styles.statusCardPaused,
            ]}
          >
            <MaterialIcons
              name={tripPaused ? 'pause-circle-filled' : isTracking ? 'gps-fixed' : 'gps-off'}
              size={32}
              color={tripPaused ? '#FF9800' : isTracking ? '#4CAF50' : '#666'}
            />
            <Text
              style={[
                styles.statusText,
                formThemedStyles.statusText,
                isTracking && !tripPaused && styles.statusTextActive,
                isTracking && tripPaused && styles.statusTextPaused,
              ]}
            >
              {tripPaused
                ? 'Mileage paused (trip still open)'
                : isTracking
                  ? 'GPS Tracking Active'
                  : 'GPS Tracking Inactive'}
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
            <Text style={[styles.sectionTitle, formThemedStyles.sectionTitle]}>Trip Details</Text>

            <View style={styles.inputGroup}>
              <Text style={[styles.label, formThemedStyles.label]}>Vehicle</Text>
              <View style={styles.vehicleSelector}>
                {vehicles.map((vehicle) => (
                  <TouchableOpacity
                    key={vehicle.id}
                    style={[
                      styles.vehicleOption,
                      selectedVehicleId === vehicle.id && styles.vehicleOptionSelected,
                    ]}
                    onPress={() => setSelectedVehicleId(vehicle.id)}
                  >
                    <Text
                      style={[
                        styles.vehicleOptionText,
                        selectedVehicleId === vehicle.id && styles.vehicleOptionTextSelected,
                      ]}
                    >
                      {vehicle.name}
                    </Text>
                    {vehicle.isDefault ? (
                      <Text
                        style={[
                          styles.vehicleOptionBadge,
                          selectedVehicleId === vehicle.id && styles.vehicleOptionBadgeSelected,
                        ]}
                      >
                        default
                      </Text>
                    ) : null}
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            
            {!hasStartedGpsToday ? (
              <View style={styles.inputGroup}>
                <Text style={[styles.label, formThemedStyles.label]}>Starting Odometer Reading *</Text>
                <ScrollToOnFocusView>
                  <TextInput
                    ref={odometerInputRef}
                    style={[styles.input, formThemedStyles.input]}
                    value={trackingForm.odometerReading}
                    onChangeText={(value) => handleInputChange('odometerReading', value)}
                    placeholder="e.g., 12345"
                    keyboardType="numeric"
                    placeholderTextColor={colors.textSecondary}
                    returnKeyType="next"
                    blurOnSubmit={false}
                    onSubmitEditing={handleOdometerSubmit}
                  />
                </ScrollToOnFocusView>
                {lastTravelDayEndingOdometerNote ? (
                  <Text style={[styles.helpText, formThemedStyles.helpText]}>{lastTravelDayEndingOdometerNote}</Text>
                ) : (
                  <Text style={[styles.helpText, formThemedStyles.helpText]}>
                    Prefilled from your last travel day when available — adjust if needed.
                  </Text>
                )}
              </View>
            ) : (
              <>
                <View style={styles.inputGroup}>
                  <Text style={[styles.label, formThemedStyles.label]}>Daily Starting Odometer</Text>
                  {!isEditingOdometer ? (
                    <View
                      style={[
                        styles.odometerDisplay,
                        styles.odometerDisplayLocked,
                        formThemedStyles.odometerDisplay,
                        formThemedStyles.odometerDisplayLocked,
                      ]}
                    >
                      <Text style={[styles.odometerValue, formThemedStyles.odometerValueLocked]}>
                        {dailyStartingOdometer}
                      </Text>
                      <Text style={[styles.odometerNote, formThemedStyles.odometerNote]}>
                        Daily starting odometer for today
                      </Text>
                      <TouchableOpacity style={styles.editOdometerButton} onPress={handleEditOdometer}>
                        <MaterialIcons name="edit" size={16} color="#2196F3" />
                        <Text style={styles.editOdometerButtonText}>Edit</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View style={styles.odometerEditContainer}>
                      <ScrollToOnFocusView>
                        <TextInput
                          style={[styles.input, formThemedStyles.input]}
                          value={trackingForm.odometerReading}
                          onChangeText={(value) => handleInputChange('odometerReading', value)}
                          placeholder="e.g., 12345"
                          keyboardType="numeric"
                          placeholderTextColor={colors.textSecondary}
                          autoFocus
                        />
                      </ScrollToOnFocusView>
                      <View style={styles.odometerEditButtons}>
                        <TouchableOpacity style={styles.saveOdometerButton} onPress={handleSaveOdometer}>
                          <MaterialIcons name="check" size={16} color="#fff" />
                          <Text style={styles.saveOdometerButtonText}>Save</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.cancelOdometerButton} onPress={handleCancelOdometerEdit}>
                          <MaterialIcons name="close" size={16} color="#666" />
                          <Text style={styles.cancelOdometerButtonText}>Cancel</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                </View>
                <View style={styles.inputGroup}>
                  <Text style={[styles.label, formThemedStyles.label]}>Miles Driven Today</Text>
                  <View
                    style={[
                      styles.odometerDisplay,
                      styles.odometerDisplayLocked,
                      formThemedStyles.odometerDisplay,
                      formThemedStyles.odometerDisplayLocked,
                    ]}
                  >
                    <Text style={[styles.odometerValue, formThemedStyles.odometerValueLocked]}>
                      {milesDrivenToday.toLocaleString()}
                    </Text>
                  </View>
                  {nextTripStartingOdometer != null ? (
                    <Text style={[styles.helpText, formThemedStyles.helpText]}>
                      This trip starts at {nextTripStartingOdometer.toLocaleString()}
                    </Text>
                  ) : null}
                </View>
              </>
            )}

            <View style={styles.inputGroup}>
              <Text style={[styles.label, formThemedStyles.label]}>Purpose *</Text>
              <TouchableOpacity
                style={[styles.purposeDropdown, purposeThemedStyles.dropdown]}
                onPress={() => setShowPurposePickerModal(true)}
              >
                <Text
                  style={[
                    styles.purposeDropdownText,
                    purposeThemedStyles.dropdownText,
                    !trackingForm.purpose && purposeThemedStyles.dropdownPlaceholder,
                  ]}
                >
                  {trackingForm.purpose || (travelReasons.length === 0 ? 'Loading...' : 'Select purpose...')}
                </Text>
                <MaterialIcons name="arrow-drop-down" size={24} color={colors.textSecondary} />
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
                  <View style={[styles.purposeModalContent, { backgroundColor: colors.surface }]}>
                    <Text style={[styles.purposeModalTitle, purposeThemedStyles.modalTitle]}>Purpose</Text>
                    <ScrollView style={styles.purposeModalList} keyboardShouldPersistTaps="handled">
                      {travelReasons.filter((r) => r.label !== 'Other').length === 0 ? (
                        <Text style={[styles.purposeModalEmpty, purposeThemedStyles.modalEmpty]}>
                          No options configured. Set up Travel Reasons in Admin Portal.
                        </Text>
                      ) : (
                        travelReasons.filter((r) => r.label !== 'Other').map((r) => (
                          <TouchableOpacity
                            key={r.id}
                            style={[
                              styles.purposeModalItem,
                              purposeThemedStyles.modalItemBorder,
                              trackingForm.purpose === r.label && purposeThemedStyles.modalItemSelected,
                            ]}
                            onPress={() => {
                              dismissKeyboardForSelection();
                              setTrackingForm(prev => ({ ...prev, purpose: r.label }));
                              setShowCustomPurposeInput(false);
                              setShowPurposePickerModal(false);
                            }}
                          >
                            <Text style={[styles.purposeModalItemText, purposeThemedStyles.modalItemText]}>
                              {r.label}
                            </Text>
                            {trackingForm.purpose === r.label && (
                              <MaterialIcons name="check" size={20} color="#4CAF50" />
                            )}
                          </TouchableOpacity>
                        ))
                      )}
                      <TouchableOpacity
                        style={[styles.purposeModalItem, purposeThemedStyles.modalItemBorder]}
                        onPress={() => {
                          setShowPurposePickerModal(false);
                          setShowCustomPurposeInput(true);
                          setTimeout(() => purposeInputRef.current?.focus(), 0);
                        }}
                      >
                        <Text style={[styles.purposeModalItemText, purposeThemedStyles.modalItemText]}>
                          Other (Type custom purpose)
                        </Text>
                      </TouchableOpacity>
                    </ScrollView>
                    <TouchableOpacity style={styles.purposeModalClose} onPress={() => setShowPurposePickerModal(false)}>
                      <Text style={[styles.purposeModalCloseText, purposeThemedStyles.modalCloseText]}>Cancel</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </Modal>
              )}
              {showCustomPurposeInput && (
                <ScrollToOnFocusView>
                  <TextInput
                    ref={purposeInputRef}
                    style={[styles.input, formThemedStyles.input, { marginTop: 8 }]}
                    value={trackingForm.purpose}
                    onChangeText={(value) => handleInputChange('purpose', value)}
                    placeholder="Type custom purpose..."
                    placeholderTextColor={colors.textSecondary}
                    returnKeyType="done"
                  />
                </ScrollToOnFocusView>
              )}
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.label, formThemedStyles.label]}>Notes (Optional)</Text>
              <ScrollToOnFocusView>
                <TextInput
                  ref={notesInputRef}
                  style={[styles.input, formThemedStyles.input, styles.textArea]}
                  value={trackingForm.notes}
                  onChangeText={(value) => handleInputChange('notes', value)}
                  placeholder="Additional notes about this trip..."
                  placeholderTextColor={colors.textSecondary}
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
                <Text style={[styles.label, formThemedStyles.label]}>Cost Center</Text>
                <View style={styles.costCenterSelector}>
                  {currentEmployee.selectedCostCenters.map((costCenter) => (
                    <TouchableOpacity
                      key={costCenter}
                      style={[
                        styles.costCenterOption,
                        selectedCostCenter === costCenter && styles.costCenterOptionSelected
                      ]}
                      onPress={() => {
                        dismissKeyboardForSelection();
                        setSelectedCostCenter(costCenter);
                      }}
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
                    <Text style={[styles.suggestionsTitle, formThemedStyles.suggestionsTitle]}>🤖 AI Cost Center Suggestions</Text>
                    {costCenterSuggestions.slice(0, 3).map((suggestion, index) => (
                      <TouchableOpacity
                        key={index}
                        style={styles.suggestionItem}
                        onPress={() => {
                          dismissKeyboardForSelection();
                          setSelectedCostCenter(suggestion.costCenter);
                          setShowCostCenterSuggestions(false);
                        }}
                      >
                        <View style={styles.suggestionContent}>
                          <Text style={[styles.suggestionText, formThemedStyles.suggestionText]}>{suggestion.costCenter}</Text>
                          <Text style={[styles.suggestionReason, formThemedStyles.suggestionReason]}>{suggestion.reasoning}</Text>
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
              <View style={[styles.trackingActiveCard, tripPaused && styles.trackingActiveCardPaused]}>
                <MaterialIcons
                  name={tripPaused ? 'pause-circle-filled' : 'gps-fixed'}
                  size={32}
                  color={tripPaused ? '#FF9800' : '#4CAF50'}
                />
                <Text style={[styles.trackingActiveText, tripPaused && styles.trackingActiveTextPaused]}>
                  {tripPaused ? 'Mileage is paused' : 'GPS Tracking Active'}
                </Text>
                <Text style={styles.trackingActiveDistance}>
                  Trip distance: {formatDistance(currentDistance)}
                </Text>
                <TouchableOpacity
                  style={[styles.pauseMileageButton, tripPaused && styles.pauseMileageButtonResume]}
                  onPress={() =>
                    Alert.alert(
                      tripPaused ? 'Resume mileage?' : 'Pause mileage?',
                      tripPaused
                        ? 'Mileage will count again toward this trip.'
                        : 'Use this for personal errands, gas, bank stops, etc. Miles will not accumulate until you resume.',
                      [
                        { text: 'Cancel', style: 'cancel' },
                        {
                          text: tripPaused ? 'Resume' : 'Pause',
                          onPress: () => {
                            void (tripPaused ? resumeTrip() : pauseTrip());
                          },
                        },
                      ]
                    )
                  }
                >
                  <MaterialIcons name={tripPaused ? 'play-arrow' : 'pause'} size={22} color="#fff" />
                  <Text style={styles.pauseMileageButtonText}>
                    {tripPaused ? 'Resume mileage' : 'Pause mileage'}
                  </Text>
                </TouchableOpacity>
                <Text style={styles.trackingActiveSubtext}>
                  {tripPaused
                    ? 'When you\'re driving again on this trip, tap Resume mileage. Stop Tracking below ends the trip and saves.'
                    : 'Tap Stop Tracking below to end your trip and save'}
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.stopButton, styles.stopButtonBelowCard]}
                onPress={handleStopTrackingPress}
                accessibilityRole="button"
                accessibilityLabel="Stop tracking"
              >
                <MaterialIcons name="stop" size={24} color="#fff" />
                <Text style={styles.stopButtonText}>Stop Tracking</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Instructions */}
        {!isTracking && (
          <View style={styles.instructionsContainer}>
            <Text style={[styles.instructionsTitle, formThemedStyles.instructionsTitle]}>How GPS Tracking Works:</Text>
            <Text style={[styles.instructionsText, formThemedStyles.instructionsText]}>
              • Enter the purpose of your trip{'\n'}
              • Tap "Start GPS Tracking" to auto-detect your current address{'\n'}
              • Confirm the address and choose a location name{'\n'}
              • The app will automatically track your route and distance{'\n'}
              • Use "Pause mileage" for errands or stops so those miles are not billed to this trip{'\n'}
              • Tap "Stop Tracking" and confirm your current end location{'\n'}
              • Your trip will be automatically saved with detailed location info{'\n'}
              • Select the vehicle you are driving above; odometer and miles today are tracked per vehicle{'\n'}
              • Make sure location services are enabled for accurate tracking
            </Text>
          </View>
        )}
      </KeyboardAwareScrollView>
      </>
      ) : null}

      {/* Location Options Modal */}
      {showLocationOptionsModal && !endTripOverlay && (
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

              {startLocationOptionOrder.map((option, index) => {
                const suggestion = startLocationSuggestions[option];
                const isDisabled =
                  (option === 'lastDestination' && !lastDestination) ||
                  (option === 'baseAddress' && !currentEmployee?.baseAddress);
                const iconName =
                  option === 'lastDestination' ? 'location-on' :
                  option === 'baseAddress' ? 'home' :
                  option === 'favoriteAddresses' ? 'star' :
                  option === 'myFlock' ? 'sheep' :
                  option === 'oxfordHouse' ? 'home' : 'add-location';
                const iconColor =
                  option === 'lastDestination' ? '#4CAF50' :
                  option === 'baseAddress' ? '#2196F3' :
                  option === 'favoriteAddresses' ? '#FFC107' :
                  option === 'myFlock' ? '#7CB342' :
                  option === 'oxfordHouse' ? '#9C27B0' : '#FF9800';
                const title =
                  option === 'lastDestination' ? 'Start from Last Destination' :
                  option === 'baseAddress' ? 'Start from Base Address' :
                  option === 'favoriteAddresses' ? 'Choose from Favorite Addresses' :
                  option === 'myFlock' ? 'Choose from My Flock' :
                  option === 'oxfordHouse' ? 'Search Oxford Houses' : 'Enter New Starting Point';
                const subtitle =
                  suggestion
                    ? suggestion.reason
                    : option === 'lastDestination'
                    ? (lastDestination ? `${lastDestination.name} (${lastDestination.address})` : 'No previous destination found')
                    : option === 'baseAddress'
                      ? (canonicalBaseAddress || 'No base address set')
                      : option === 'favoriteAddresses'
                        ? 'Select from your saved favorite locations'
                        : option === 'myFlock'
                          ? 'Quick pick from Oxford Houses in your flock'
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
                      {option === 'myFlock' ? (
                        <MaterialCommunityIcons name="sheep" size={24} color={iconColor} />
                      ) : (
                        <MaterialIcons name={iconName as any} size={24} color={iconColor} />
                      )}
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
      {endTripFlow.showOptionsModal && (
      <Modal
        visible
        transparent={true}
        animationType={Platform.OS === 'ios' ? 'none' : 'slide'}
        presentationStyle="overFullScreen"
        onRequestClose={dismissEndTripOverlay}
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
                  (option === 'tripStart' && !effectiveTripStartLocation);
                const iconName =
                  option === 'baseAddress' ? 'home' :
                  option === 'tripStart' ? 'replay' :
                  option === 'favoriteAddresses' ? 'star' :
                  option === 'myFlock' ? 'sheep' :
                  option === 'oxfordHouse' ? 'home' : 'add-location';
                const iconColor =
                  option === 'baseAddress' ? '#2196F3' :
                  option === 'tripStart' ? '#4CAF50' :
                  option === 'favoriteAddresses' ? '#FFC107' :
                  option === 'myFlock' ? '#7CB342' :
                  option === 'oxfordHouse' ? '#9C27B0' : '#FF9800';
                const title =
                  option === 'baseAddress' ? 'End at Base Address' :
                  option === 'tripStart' ? 'Same as Trip Start' :
                  option === 'favoriteAddresses' ? 'Choose from Favorite Addresses' :
                  option === 'myFlock' ? 'Choose from My Flock' :
                  option === 'oxfordHouse' ? 'Search Oxford Houses' : 'Enter Destination Manually';
                const subtitle =
                  suggestion
                    ? suggestion.reason
                    : option === 'baseAddress'
                    ? (canonicalBaseAddress || 'No base address set')
                    : option === 'tripStart'
                      ? (effectiveTripStartLocation
                        ? `${effectiveTripStartLocation.name} (${effectiveTripStartLocation.address || '—'})`
                        : 'Start location not recorded for this session')
                      : option === 'favoriteAddresses'
                        ? 'Select a saved location as your destination'
                        : option === 'myFlock'
                          ? 'Quick pick from Oxford Houses in your flock'
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
                      {option === 'myFlock' ? (
                        <MaterialCommunityIcons name="sheep" size={24} color={iconColor} />
                      ) : (
                        <MaterialIcons name={iconName as any} size={24} color={iconColor} />
                      )}
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
              onPress={dismissEndTripOverlay}
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
      {endTripFlow.showCaptureModal && <LocationCaptureModal
        visible={endTripFlow.showCaptureModal}
        onClose={() => {
          endTripFlow.dismissEndTrip();
        }}
        onConfirm={handleEndLocationConfirm}
        title="Capture End Location"
        locationType="end"
        currentEmployee={currentEmployee}
        initialLocation={endTripFlow.captureInitial}
      />}

      {/* Oxford House Search Modal - same experience as Manual Entry */}
      {showOxfordHouseSearchModal && (
        <Modal
          visible
          transparent={true}
          animationType="slide"
          onRequestClose={() => closeOxfordHouseSearchModal()}
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
                    onPress={() => closeOxfordHouseSearchModal()}
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
                    {...searchTextInputProps}
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
                      const wasEnd = oxfordHousePickerRole === 'end';
                      closeOxfordHouseSearchModal(false);
                      if (wasEnd) endTripFlow.openCapture(endTripFlow.captureInitial);
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
                      keyboardDismissMode="on-drag"
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
      {endTripFlow.isSaving && (
      <Modal
        visible
        transparent={true}
        animationType={Platform.OS === 'ios' ? 'none' : 'fade'}
        presentationStyle="overFullScreen"
        onRequestClose={() => {}}
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
        onRequestClose={() => {}}
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
  endTripOverlayRoot: {
    justifyContent: 'center',
  },
  endTripOverlayBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
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
  statusCardPaused: {
    borderColor: '#FF9800',
    backgroundColor: '#fff8e1',
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
  statusTextPaused: {
    color: '#E65100',
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
  helpText: {
    fontSize: 12,
    color: '#666',
    marginTop: 6,
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
  stopButtonBelowCard: {
    alignSelf: 'stretch',
    maxWidth: 340,
    width: '100%',
    marginTop: 12,
  },
  trackingActiveContainer: {
    alignItems: 'center',
    width: '100%',
  },
  trackingActiveCard: {
    backgroundColor: '#e8f5e8',
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#4CAF50',
    maxWidth: 340,
    width: '100%',
  },
  trackingActiveCardPaused: {
    backgroundColor: '#fff8e1',
    borderColor: '#FF9800',
  },
  trackingActiveText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginTop: 8,
    marginBottom: 6,
    textAlign: 'center',
  },
  trackingActiveTextPaused: {
    color: '#E65100',
  },
  trackingActiveDistance: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    marginBottom: 14,
  },
  pauseMileageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF9800',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    marginBottom: 12,
    alignSelf: 'stretch',
    maxWidth: 280,
  },
  pauseMileageButtonResume: {
    backgroundColor: '#4CAF50',
  },
  pauseMileageButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 6,
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
  vehicleSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  vehicleOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    backgroundColor: '#fff',
  },
  vehicleOptionSelected: {
    backgroundColor: '#2196F3',
    borderColor: '#2196F3',
  },
  vehicleOptionText: {
    fontSize: 14,
    color: '#333',
  },
  vehicleOptionTextSelected: {
    color: '#fff',
    fontWeight: '600',
  },
  vehicleOptionBadge: {
    marginLeft: 6,
    fontSize: 10,
    color: '#666',
  },
  vehicleOptionBadgeSelected: {
    color: '#e3f2fd',
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
  odometerDisplayLocked: {
    backgroundColor: '#eceff1',
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
    fontWeight: '500',
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
