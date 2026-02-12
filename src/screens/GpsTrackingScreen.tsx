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
  Platform,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { GpsTrackingService } from '../services/gpsTrackingService';
import { DatabaseService } from '../services/database';
import { GpsTrackingSession, Employee, LocationDetails } from '../types';
import { useGpsTracking } from '../contexts/GpsTrackingContext';
import { formatLocation } from '../utils/locationFormatter';
import LocationCaptureModal from '../components/LocationCaptureModal';
import { TripPurposeAiService, PurposeSuggestion } from '../services/tripPurposeAiService';
import { CostCenterAiService, CostCenterSuggestion } from '../services/costCenterAiService';
import { getTravelReasons, TravelReason } from '../services/travelReasonsService';
import SimpleNavigationButton from '../components/SimpleNavigationButton';
import UnifiedHeader from '../components/UnifiedHeader';
import { OxfordHouseSearchInput } from '../components/OxfordHouseSearchInput';
import { useTips } from '../contexts/TipsContext';
import { TipCard } from '../components/TipCard';
import { useTheme } from '../contexts/ThemeContext';
import { COST_CENTERS } from '../constants/costCenters';
import { PreferencesService } from '../services/preferencesService';

interface GpsTrackingScreenProps {
  navigation: any;
  route?: any;
}

export default function GpsTrackingScreen({ navigation, route }: GpsTrackingScreenProps) {
  const { colors } = useTheme();
  const { isTracking, currentSession, currentDistance, setCurrentDistance, startTracking, stopTracking, shouldShowEndLocationModal, setShouldShowEndLocationModal } = useGpsTracking();
  const { tips, loadTipsForScreen, dismissTip, markTipAsSeen, showTips, setCurrentEmployee: setTipsEmployee } = useTips();
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
  const [showOxfordHouseSearchModal, setShowOxfordHouseSearchModal] = useState(false);
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
  const [isEditingOdometer, setIsEditingOdometer] = useState(false);
  const [travelReasons, setTravelReasons] = useState<TravelReason[]>([]);
  const [showPurposePickerModal, setShowPurposePickerModal] = useState(false);

  useEffect(() => {
    loadEmployee();
    loadPreferences();
    getTravelReasons().then(setTravelReasons);
    
    // Reset all states when component mounts to prevent stuck modals
    return () => {
      setShowLocationOptionsModal(false);
      setShowStartLocationModal(false);
      setShowEndLocationModal(false);
      setShowOxfordHouseSearchModal(false);
      setShowPurposeSuggestions(false);
    };
  }, []);

  // Load user preferences
  const loadPreferences = async () => {
    try {
      const prefs = await PreferencesService.getPreferences();
      setShowGpsDuration(prefs.showGpsDuration);
    } catch (error) {
      console.error('Error loading preferences:', error);
    }
  };

  // Reset modal states when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      // Check if we should show end modal (from route params)
      if (route?.params?.showEndModal && isTracking) {
        setShowEndLocationModal(true);
        // Clear the param so it doesn't show again on next focus
        navigation.setParams({ showEndModal: false });
      } else {
        // Reset all modal states when screen is focused (except if showEndModal param is set)
        setShowLocationOptionsModal(false);
        setShowStartLocationModal(false);
        if (!route?.params?.showEndModal) {
          setShowEndLocationModal(false);
        }
        setShowOxfordHouseSearchModal(false);
        setShowPurposeSuggestions(false);
      }
      
      // Refresh GPS tracking status in case it's a new day
      if (currentEmployee) {
        checkGpsTrackingStatus(currentEmployee.id);
      }
    }, [currentEmployee, route?.params?.showEndModal, isTracking, navigation])
  );

  // Watch for stop tracking request from global button
  useEffect(() => {
    if (shouldShowEndLocationModal && isTracking) {
      setShowEndLocationModal(true);
      setShouldShowEndLocationModal(false); // Reset the flag
    }
  }, [shouldShowEndLocationModal, isTracking, setShouldShowEndLocationModal]);

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
        }
      }
    };
    
    autoStartFromSavedAddress();
  }, [route?.params?.selectedAddress, currentEmployee, isTracking]);

  const loadEmployee = async () => {
    try {
      const employee = await DatabaseService.getCurrentEmployee();
      if (!employee) {
        console.error('❌ GPS: No current employee found');
        return;
      }
      setCurrentEmployee(employee);
      
      // Set employee for tips context and load GPS tracking tips
      if (employee) {
        // Initialize cost center
        const costCenter = employee.defaultCostCenter || employee.selectedCostCenters?.[0] || '';
        setSelectedCostCenter(costCenter);
        
        // Check if GPS tracking has been started today
        await checkGpsTrackingStatus(employee.id);
        
        setTipsEmployee(employee);
        if (showTips) {
          await loadTipsForScreen('GpsTrackingScreen', 'on_load');
        }
      }
      
      // Set base address as default start location if available
      if (employee?.baseAddress) {
        setStartLocationDetails({
          name: 'BA',
          address: employee.baseAddress,
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

    console.log('🔍 GPS: Starting GPS tracking, showing location options modal');
    // Show location options modal first
    setShowLocationOptionsModal(true);
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
        console.log('🔍 GPS: Using base address:', currentEmployee.baseAddress);
        // Use base address as starting point
        setStartLocationDetails({
          name: 'Base Address',
          address: currentEmployee.baseAddress
        });
        startGpsTracking();
      } else if (option === 'favoriteAddresses') {
        console.log('🔍 GPS: Navigating to favorite addresses');
        // Navigate to SavedAddressesScreen with fromGpsTracking flag
        navigation.navigate('SavedAddresses', { fromGpsTracking: true });
      } else if (option === 'oxfordHouse') {
        console.log('🔍 GPS: Showing Oxford House search modal');
        // Show Oxford House search modal
        setShowOxfordHouseSearchModal(true);
      } else if (option === 'newLocation') {
        console.log('🔍 GPS: Showing manual location entry modal');
        // Show manual location entry modal
        setShowStartLocationModal(true);
      }
    }, 100);
  };

  const startGpsTracking = async () => {
    try {
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
    }
  };

  const handleStartLocationConfirm = async (locationDetails: LocationDetails) => {
    setStartLocationDetails(locationDetails);
    setShowStartLocationModal(false);
    startGpsTracking();
  };

  const handleStopTracking = async () => {
    // Show end location capture modal first
    setShowEndLocationModal(true);
  };

  /** End tracking without saving; no mileage entry is created. */
  const handleCancelTracking = async () => {
    try {
      setShowEndLocationModal(false);
      setShouldShowEndLocationModal(false);
      await stopTracking();
      setTrackingTime(0);
      setStartLocationDetails(null);
      setEndLocationDetails(null);
      setShowLocationOptionsModal(false);
      setShowStartLocationModal(false);
      setShowOxfordHouseSearchModal(false);
      setShowPurposeSuggestions(false);
      setTrackingForm({ odometerReading: '', purpose: '', notes: '' });
      setSelectedCostCenter('');
    } catch (error) {
      console.error('Error cancelling tracking:', error);
      Alert.alert('Error', 'Failed to cancel tracking');
    }
  };

  const handleOxfordHouseSelected = (house: any) => {
    // Convert Oxford House to LocationDetails format
    const locationDetails: LocationDetails = {
      name: house.name,
      address: `${house.address}, ${house.city}, ${house.state} ${house.zipCode}`
    };
    
    setStartLocationDetails(locationDetails);
    setShowOxfordHouseSearchModal(false);
    startGpsTracking();
  };

  const handleEndLocationConfirm = async (locationDetails: LocationDetails) => {
    console.log('📍 End location confirmed:', locationDetails);
    setEndLocationDetails(locationDetails);
    setShowEndLocationModal(false);

    try {
      const completedSession = await stopTracking();
      
      // Use GPS-tracked miles
      const actualMiles = completedSession?.totalMiles || 0;
      
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

        await DatabaseService.createMileageEntry({
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
        });

        console.log('✅ GPS Trip saved successfully!');

        // Update last destination for next trip
        console.log('🔍 GPS: Updating last destination:', locationDetails.name);
        setLastDestination(locationDetails);

        Alert.alert(
          'Tracking Complete',
          `Trip completed!\nDistance: ${actualMiles.toFixed(1)} miles (GPS tracked)\nDuration: ${formatTime(trackingTime)}\nFrom: ${formatLocation(completedSession.startLocation || '', startLocationDetails || undefined)}\nTo: ${formatLocation(completedSession.endLocation || '', locationDetails)}`,
          [
            {
              text: 'OK',
              onPress: () => navigation.goBack(),
            },
          ]
        );
      }

      setTrackingTime(0);
      setStartLocationDetails(null);
      setEndLocationDetails(null);
      
      // Reset all modal states to ensure screen is responsive
      setShowLocationOptionsModal(false);
      setShowStartLocationModal(false);
      setShowEndLocationModal(false);
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
      Alert.alert('Error', 'Failed to stop GPS tracking');
    }
  };

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
    if (miles < 0.1) {
      return `${(miles * 5280).toFixed(0)} ft`;
    } else {
      return `${miles.toFixed(1)} mi`;
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <UnifiedHeader
        title="GPS Tracking"
        showBackButton={true}
        onBackPress={() => navigation.goBack()}
        onHomePress={() => navigation.navigate('Home')}
      />

      <ScrollView 
        style={styles.content} 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={true}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        scrollEventThrottle={16}
        nestedScrollEnabled={true}
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

        {/* Simple Navigation Button */}
        <SimpleNavigationButton 
          isTracking={isTracking}
          currentDistance={currentDistance}
        />

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
        {/* Tips Display - Memoized to prevent re-renders */}
        {useMemo(() => showTips && tips.length > 0 && (
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
        ), [showTips, tips, dismissTip, markTipAsSeen])}

        {!isTracking && (
          <View style={styles.formContainer}>
            <Text style={styles.sectionTitle}>Trip Details</Text>
            
            {/* Only show odometer input on first GPS session of the day */}
            {!hasStartedGpsToday && (
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Starting Odometer Reading *</Text>
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
                  onSubmitEditing={() => {
                    purposeInputRef.current?.focus();
                  }}
                />
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
                  </View>
                ) : (
                  <View style={styles.odometerEditContainer}>
                    <TextInput
                      style={styles.input}
                      value={trackingForm.odometerReading}
                      onChangeText={(value) => handleInputChange('odometerReading', value)}
                      placeholder="e.g., 12345"
                      keyboardType="numeric"
                      placeholderTextColor="#999"
                      autoFocus={true}
                    />
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
              <Modal
                visible={showPurposePickerModal}
                transparent
                animationType="slide"
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
                    </ScrollView>
                    <TouchableOpacity style={styles.purposeModalClose} onPress={() => setShowPurposePickerModal(false)}>
                      <Text style={styles.purposeModalCloseText}>Cancel</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </Modal>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Notes (Optional)</Text>
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
        <View style={styles.instructionsContainer}>
          <Text style={styles.instructionsTitle}>How GPS Tracking Works:</Text>
          <Text style={styles.instructionsText}>
            • Enter the purpose of your trip{'\n'}
            • Tap "Start GPS Tracking" and confirm your start location{'\n'}
            • The app will automatically track your route and distance{'\n'}
            • Tap "Stop Tracking" and confirm your end location{'\n'}
            • Your trip will be automatically saved with detailed location info{'\n'}
            • Vehicle is automatically set to "Personal Vehicle"{'\n'}
            • Make sure location services are enabled for accurate tracking
          </Text>
        </View>
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
            <Text style={styles.modalTitle}>Choose Starting Location</Text>
            <Text style={styles.modalSubtitle}>Where are you starting your trip from?</Text>

            <TouchableOpacity
              style={[styles.locationOptionButton, !lastDestination && styles.disabledButton]}
              onPress={() => {
                console.log('🔍 GPS: Last destination button pressed');
                handleLocationOption('lastDestination');
              }}
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
              onPress={() => {
                console.log('🔍 GPS: Base address button pressed');
                handleLocationOption('baseAddress');
              }}
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
                <Text style={styles.locationOptionTitle}>Enter New Starting Point</Text>
                <Text style={styles.locationOptionSubtitle}>Manually enter location name and address</Text>
              </View>
            </TouchableOpacity>

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

      {/* Start Location Capture Modal */}
      <LocationCaptureModal
        visible={showStartLocationModal}
        onClose={() => setShowStartLocationModal(false)}
        onConfirm={handleStartLocationConfirm}
        title="Capture Start Location"
        locationType="start"
        currentEmployee={currentEmployee}
      />

      {/* End Location Capture Modal */}
      <LocationCaptureModal
        visible={showEndLocationModal}
        onClose={() => {
          Alert.alert(
            'Cancel tracking?',
            'No mileage will be saved. End tracking without logging this trip?',
            [
              { text: 'Keep tracking', style: 'cancel' },
              { text: 'Cancel tracking', style: 'destructive', onPress: handleCancelTracking },
            ]
          );
        }}
        onConfirm={handleEndLocationConfirm}
        title="Capture End Location"
        locationType="end"
        currentEmployee={currentEmployee}
      />

      {/* Oxford House Search Modal */}
      <Modal
        visible={showOxfordHouseSearchModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowOxfordHouseSearchModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Oxford House</Text>
            <Text style={styles.modalSubtitle}>Choose your starting location from Oxford Houses</Text>
            
            <OxfordHouseSearchInput
              value=""
              onChangeText={() => {}}
              placeholder="Search for Oxford House..."
              label="Start Location"
              onHouseSelected={handleOxfordHouseSelected}
              allowManualEntry={true}
              employeeId={currentEmployee?.id}
            />

            <TouchableOpacity
              style={styles.modalButtonSecondary}
              onPress={() => setShowOxfordHouseSearchModal(false)}
            >
              <Text style={styles.modalButtonSecondaryText}>Cancel</Text>
            </TouchableOpacity>
          </View>
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
    marginBottom: 8,
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
    textAlign: 'center',
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
});
