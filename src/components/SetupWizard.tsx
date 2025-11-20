import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  TouchableWithoutFeedback,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { DatabaseService } from '../services/database';
import { Employee } from '../types';
import * as Location from 'expo-location';

interface SetupWizardProps {
  employee: Employee;
  onComplete: () => void;
}

const SetupWizard: React.FC<SetupWizardProps> = ({ employee, onComplete }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [baseAddress, setBaseAddress] = useState(employee.baseAddress || '');
  const [defaultCostCenter, setDefaultCostCenter] = useState(
    employee.defaultCostCenter || ''
  );
  const [typicalWorkStartHour, setTypicalWorkStartHour] = useState<string>(
    employee.typicalWorkStartHour !== undefined && employee.typicalWorkStartHour !== null 
      ? String(employee.typicalWorkStartHour) 
      : '9'
  );
  const [typicalWorkEndHour, setTypicalWorkEndHour] = useState<string>(
    employee.typicalWorkEndHour !== undefined && employee.typicalWorkEndHour !== null
      ? String(employee.typicalWorkEndHour)
      : '17'
  );
  const [initialOdometer, setInitialOdometer] = useState('');
  const [costCenterSearchText, setCostCenterSearchText] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  
  // Refs for keyboard handling
  const scrollViewRef = useRef<ScrollView>(null);
  const baseAddressInputRef = useRef<TextInput>(null);
  const workStartHourInputRef = useRef<TextInput>(null);
  const workEndHourInputRef = useRef<TextInput>(null);
  const odometerInputRef = useRef<TextInput>(null);

  const steps = [
    {
      id: 'baseAddress',
      title: 'Set Your Base Address',
      description: 'This is your primary work location used for mileage calculations.',
      icon: 'home',
      color: '#2196F3',
    },
    {
      id: 'defaultCostCenter',
      title: 'Set Default Cost Center',
      description: 'Select your default cost center. This will be pre-selected for new entries.',
      icon: 'star',
      color: '#FF9800',
    },
    {
      id: 'workHours',
      title: 'Set Your Work Hours',
      description: 'Enter your typical work hours so notifications can be customized to your schedule.',
      icon: 'access-time',
      color: '#4CAF50',
    },
    {
      id: 'odometer',
      title: 'Initial Odometer Reading',
      description: 'Enter your current odometer reading (optional).',
      icon: 'speed',
      color: '#9C27B0',
    },
  ];
  

  const handleNext = () => {
    if (currentStep === 0) {
      // Validate base address
      if (!baseAddress.trim()) {
        Alert.alert('Required Field', 'Please enter your base address.');
        return;
      }
    } else if (currentStep === 1) {
      // Validate default cost center - only required if cost centers are assigned
      const availableCostCenters = employee.selectedCostCenters && employee.selectedCostCenters.length > 0
        ? employee.selectedCostCenters
        : [];
      if (availableCostCenters.length > 0 && !defaultCostCenter.trim()) {
        Alert.alert('Required Field', 'Please select a default cost center.');
        return;
      }
    } else if (currentStep === 2) {
      // Validate work hours
      const startHour = parseInt(typicalWorkStartHour, 10);
      const endHour = parseInt(typicalWorkEndHour, 10);
      if (isNaN(startHour) || startHour < 0 || startHour > 23) {
        Alert.alert('Invalid Input', 'Work start hour must be between 0 and 23.');
        return;
      }
      if (isNaN(endHour) || endHour < 0 || endHour > 23) {
        Alert.alert('Invalid Input', 'Work end hour must be between 0 and 23.');
        return;
      }
    }

    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSkip = () => {
    if (currentStep === steps.length - 1) {
      // Last step, complete setup
      handleComplete();
    } else {
      // Skip to next step
      setCurrentStep(currentStep + 1);
    }
  };

  const handleComplete = async () => {
    setIsSaving(true);
    try {
      // Update employee with base address and cost centers
      await DatabaseService.updateEmployee(employee.id, {
        baseAddress: baseAddress.trim(),
        defaultCostCenter: defaultCostCenter.trim(),
        typicalWorkStartHour: parseInt(typicalWorkStartHour, 10),
        typicalWorkEndHour: parseInt(typicalWorkEndHour, 10),
      });

      // Save initial odometer reading if provided
      if (initialOdometer.trim() && !isNaN(Number(initialOdometer))) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        // Check if reading already exists for today
        const existingReading = await DatabaseService.getDailyOdometerReading(
          employee.id,
          today
        );
        
        if (!existingReading) {
          await DatabaseService.createDailyOdometerReading({
            employeeId: employee.id,
            date: today,
            odometerReading: Number(initialOdometer),
          });
        }
      }

      // Mark setup as complete
      await DatabaseService.markSetupComplete(employee.id);

      // Mark Setup Wizard as completed (store in employees table for persistence)
      await DatabaseService.setCompletedSetupWizard(employee.id);

      onComplete();
    } catch (error) {
      console.error('Error completing setup:', error);
      Alert.alert('Error', 'Failed to save settings. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleGetCurrentLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Location permission is required to use your current location.'
        );
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      const reverseGeocode = await Location.reverseGeocodeAsync({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });

      if (reverseGeocode && reverseGeocode.length > 0) {
        const address = reverseGeocode[0];
        const addressString = [
          address.streetNumber,
          address.street,
          address.city,
          address.region,
          address.postalCode,
        ]
          .filter(Boolean)
          .join(', ');
        setBaseAddress(addressString);
      }
    } catch (error) {
      console.error('Error getting location:', error);
      Alert.alert('Error', 'Failed to get your current location.');
    }
  };

  const handleCostCenterToggle = (costCenter: string) => {
    setDefaultCostCenter(costCenter);
  };

  const renderBaseAddressStep = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepDescription}>
        Enter your primary work location. This will be used as the starting point for mileage
        calculations.
      </Text>
      <TextInput
        ref={baseAddressInputRef}
        style={styles.textInput}
        placeholder="Enter base address..."
        placeholderTextColor="#999"
        value={baseAddress}
        onChangeText={setBaseAddress}
        multiline
        numberOfLines={3}
        onFocus={() => {
          setTimeout(() => {
            scrollViewRef.current?.scrollToEnd({ animated: true });
          }, 300);
        }}
      />
      <TouchableOpacity style={styles.locationButton} onPress={handleGetCurrentLocation}>
        <MaterialIcons name="my-location" size={20} color="#2196F3" />
        <Text style={styles.locationButtonText}>Use Current Location</Text>
      </TouchableOpacity>
    </View>
  );

  const renderDefaultCostCenterStep = () => {
    // Filter to only show cost centers assigned to this employee
    const availableCostCenters = employee.selectedCostCenters && employee.selectedCostCenters.length > 0
      ? employee.selectedCostCenters
      : [];

    // Filter by search text
    const filteredCostCenters = availableCostCenters.filter((cc) =>
      cc.toLowerCase().includes(costCenterSearchText.toLowerCase())
    );

    return (
      <View style={styles.stepContent}>
        <Text style={styles.stepDescription}>
          Select your default cost center. This will be pre-selected for new entries.
        </Text>
        {availableCostCenters.length === 0 ? (
          <View style={styles.emptyStateContainer}>
            <MaterialIcons name="warning" size={48} color="#FF9800" />
            <Text style={styles.emptyStateText}>
              No cost centers have been assigned to you yet.
            </Text>
            <Text style={styles.emptyStateSubtext}>
              Please contact your administrator to assign cost centers to your account.
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.searchContainer}>
              <MaterialIcons name="search" size={20} color="#999" />
              <TextInput
                style={styles.searchInput}
                placeholder="Search cost centers..."
                placeholderTextColor="#999"
                value={costCenterSearchText}
                onChangeText={setCostCenterSearchText}
              />
              {costCenterSearchText.length > 0 && (
                <TouchableOpacity onPress={() => setCostCenterSearchText('')}>
                  <MaterialIcons name="close" size={20} color="#999" />
                </TouchableOpacity>
              )}
            </View>
            <ScrollView style={styles.costCenterList} showsVerticalScrollIndicator={false}>
              {filteredCostCenters.length === 0 ? (
                <View style={styles.emptyStateContainer}>
                  <Text style={styles.emptyStateText}>
                    No cost centers match your search.
                  </Text>
                </View>
              ) : (
                filteredCostCenters.map((costCenter) => (
                  <TouchableOpacity
                    key={costCenter}
                    style={[
                      styles.costCenterItem,
                      defaultCostCenter === costCenter && styles.selectedCostCenterItem,
                    ]}
                    onPress={() => handleCostCenterToggle(costCenter)}
                  >
                    <MaterialIcons
                      name={defaultCostCenter === costCenter ? 'star' : 'star-border'}
                      size={24}
                      color={defaultCostCenter === costCenter ? '#FFD700' : '#ccc'}
                    />
                    <Text
                      style={[
                        styles.costCenterText,
                        defaultCostCenter === costCenter && styles.selectedCostCenterText,
                      ]}
                    >
                      {costCenter}
                    </Text>
                    {defaultCostCenter === costCenter && (
                      <Text style={styles.defaultLabel}>Default</Text>
                    )}
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          </>
        )}
      </View>
    );
  };

  const renderWorkHoursStep = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepDescription}>
        Enter your typical work hours (24-hour format, 0-23). This will help the app understand your daily work schedule and customize notifications accordingly.
      </Text>
      <View style={styles.workHoursContainer}>
        <View style={styles.workHoursItem}>
          <Text style={styles.workHoursLabel}>Work Start Hour (0-23):</Text>
          <TextInput
            ref={workStartHourInputRef}
            style={styles.workHoursInput}
            placeholder="9"
            placeholderTextColor="#999"
            value={typicalWorkStartHour}
            onChangeText={setTypicalWorkStartHour}
            keyboardType="numeric"
            maxLength={2}
            onFocus={() => {
              setTimeout(() => {
                scrollViewRef.current?.scrollToEnd({ animated: true });
              }, 300);
            }}
          />
          {typicalWorkStartHour && !isNaN(parseInt(typicalWorkStartHour, 10)) && (
            <Text style={styles.workHoursDisplay}>
              ({parseInt(typicalWorkStartHour, 10) % 12 || 12}:00 {parseInt(typicalWorkStartHour, 10) >= 12 ? 'PM' : 'AM'})
            </Text>
          )}
        </View>
        <View style={styles.workHoursItem}>
          <Text style={styles.workHoursLabel}>Work End Hour (0-23):</Text>
          <TextInput
            ref={workEndHourInputRef}
            style={styles.workHoursInput}
            placeholder="17"
            placeholderTextColor="#999"
            value={typicalWorkEndHour}
            onChangeText={setTypicalWorkEndHour}
            keyboardType="numeric"
            maxLength={2}
            onFocus={() => {
              setTimeout(() => {
                scrollViewRef.current?.scrollToEnd({ animated: true });
              }, 300);
            }}
          />
          {typicalWorkEndHour && !isNaN(parseInt(typicalWorkEndHour, 10)) && (
            <Text style={styles.workHoursDisplay}>
              ({parseInt(typicalWorkEndHour, 10) % 12 || 12}:00 {parseInt(typicalWorkEndHour, 10) >= 12 ? 'PM' : 'AM'})
            </Text>
          )}
        </View>
      </View>
      <Text style={styles.hintText}>
        Example: 9 = 9:00 AM, 17 = 5:00 PM
      </Text>
    </View>
  );

  const renderOdometerStep = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepDescription}>
        Enter your current vehicle odometer reading. This step is optional and can be skipped.
      </Text>
      <TextInput
        ref={odometerInputRef}
        style={styles.textInput}
        placeholder="Enter odometer reading..."
        placeholderTextColor="#999"
        value={initialOdometer}
        onChangeText={setInitialOdometer}
        keyboardType="numeric"
        onFocus={() => {
          setTimeout(() => {
            scrollViewRef.current?.scrollToEnd({ animated: true });
          }, 300);
        }}
      />
      <Text style={styles.hintText}>
        You can add this later from the Home screen if needed.
      </Text>
    </View>
  );

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return renderBaseAddressStep();
      case 1:
        return renderDefaultCostCenterStep();
      case 2:
        return renderWorkHoursStep();
      case 3:
        return renderOdometerStep();
      default:
        return null;
    }
  };

  const currentStepInfo = steps[currentStep];

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.container}>
          <View style={[styles.header, { backgroundColor: currentStepInfo.color }]}>
            <MaterialIcons name={currentStepInfo.icon as any} size={48} color="#fff" />
            <Text style={styles.headerTitle}>{currentStepInfo.title}</Text>
            <Text style={styles.headerDescription}>{currentStepInfo.description}</Text>
          </View>

          {/* Progress Indicator */}
          <View style={styles.progressContainer}>
            {steps.map((step, index) => (
              <View key={step.id} style={styles.progressItem}>
                <View
                  style={[
                    styles.progressDot,
                    index <= currentStep && { backgroundColor: currentStepInfo.color },
                  ]}
                />
                {index < steps.length - 1 && (
                  <View
                    style={[
                      styles.progressLine,
                      index < currentStep && { backgroundColor: currentStepInfo.color },
                    ]}
                  />
                )}
              </View>
            ))}
          </View>

          <Text style={styles.stepIndicator}>
            Step {currentStep + 1} of {steps.length}
          </Text>

          <ScrollView
            ref={scrollViewRef}
            style={styles.content}
            contentContainerStyle={{ paddingBottom: 100 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {renderStepContent()}
          </ScrollView>

          <View style={styles.footer}>
            {currentStep > 0 && (
              <TouchableOpacity style={styles.backButton} onPress={handleBack}>
                <MaterialIcons name="arrow-back" size={20} color="#666" />
                <Text style={styles.backButtonText}>Back</Text>
              </TouchableOpacity>
            )}
            <View style={styles.footerRight}>
              {currentStep === steps.length - 1 && (
                <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
                  <Text style={styles.skipButtonText}>Skip</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[styles.nextButton, { backgroundColor: currentStepInfo.color }]}
                onPress={handleNext}
                disabled={isSaving}
              >
                {isSaving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Text style={styles.nextButtonText}>
                      {currentStep === steps.length - 1 ? 'Complete Setup' : 'Next'}
                    </Text>
                    <MaterialIcons name="arrow-forward" size={20} color="#fff" />
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    paddingTop: 60,
    paddingBottom: 30,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 16,
    textAlign: 'center',
  },
  headerDescription: {
    fontSize: 14,
    color: '#fff',
    marginTop: 8,
    textAlign: 'center',
    opacity: 0.9,
  },
  progressContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 20,
  },
  progressItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  progressDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#ccc',
  },
  progressLine: {
    width: 40,
    height: 2,
    backgroundColor: '#ccc',
    marginHorizontal: 4,
  },
  stepIndicator: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  stepContent: {
    flex: 1,
  },
  stepDescription: {
    fontSize: 16,
    color: '#666',
    marginBottom: 20,
    lineHeight: 22,
  },
  textInput: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#ddd',
    marginBottom: 16,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  locationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2196F3',
    marginBottom: 16,
  },
  locationButtonText: {
    marginLeft: 8,
    color: '#2196F3',
    fontSize: 16,
    fontWeight: '500',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingHorizontal: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  searchInput: {
    flex: 1,
    padding: 12,
    fontSize: 16,
  },
  costCenterList: {
    flex: 1,
    marginBottom: 16,
  },
  costCenterItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  selectedCostCenterItem: {
    borderColor: '#4CAF50',
    backgroundColor: '#f0f9f0',
  },
  costCenterText: {
    flex: 1,
    marginLeft: 12,
    fontSize: 16,
    color: '#333',
  },
  selectedCostCenterText: {
    fontWeight: '600',
    color: '#4CAF50',
  },
  defaultLabel: {
    fontSize: 12,
    color: '#FFD700',
    fontWeight: '600',
    marginLeft: 8,
  },
  selectedCount: {
    fontSize: 14,
    color: '#4CAF50',
    fontWeight: '600',
    marginTop: 8,
  },
  hintText: {
    fontSize: 14,
    color: '#999',
    fontStyle: 'italic',
    marginTop: 8,
  },
  workHoursContainer: {
    marginTop: 16,
  },
  workHoursItem: {
    marginBottom: 16,
  },
  workHoursLabel: {
    fontSize: 16,
    color: '#333',
    marginBottom: 8,
    fontWeight: '500',
  },
  workHoursInput: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#ddd',
    width: 80,
  },
  workHoursDisplay: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
    fontStyle: 'italic',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#ddd',
  },
  footerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  backButtonText: {
    marginLeft: 4,
    fontSize: 16,
    color: '#666',
  },
  skipButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    marginRight: 12,
  },
  skipButtonText: {
    fontSize: 16,
    color: '#666',
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  nextButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginRight: 8,
  },
  emptyStateContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginTop: 16,
    fontWeight: '500',
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
});

export default SetupWizard;
