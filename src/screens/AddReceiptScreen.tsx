import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Image,
  Platform,
  Modal,
  FlatList,
  Dimensions,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import DateTimePicker from '@react-native-community/datetimepicker';
import { DatabaseService } from '../services/database';
import { PerDiemRulesService } from '../services/perDiemRulesService';
import EesRulesService from '../services/eesRulesService';
import { VendorSuggestion, NearbyVendor } from '../services/vendorIntelligenceService';
import { Employee, Receipt } from '../types';
import { useTips } from '../contexts/TipsContext';
import { TipCard } from '../components/TipCard';
import { AnomalyDetectionService } from '../services/anomalyDetectionService';
import { useNotifications } from '../contexts/NotificationContext';
import { CategoryAiService, CategorySuggestion } from '../services/categoryAiService';
import { PerDiemAiService, PerDiemEligibility } from '../services/perDiemAiService';

interface AddReceiptScreenProps {
  navigation: any;
}

const RECEIPT_CATEGORIES = [
  'EES',
  'Rental Car',
  'Rental Car Fuel',
  'Office Supplies',
  'Ground Transportation',
  'Phone/Internet/Fax',
  'Postage/Shipping',
  'Printing',
  'Airfare/Bus/Train',
  'Parking/Tolls',
  'Hotels/AirBnB',
  'Per Diem',
  'Other'
];

export default function AddReceiptScreen({ navigation }: AddReceiptScreenProps) {
  const { tips, loadTipsForScreen, dismissTip, markTipAsSeen, showTips, setCurrentEmployee: setTipsEmployee } = useTips();
  const { showAnomalyAlert } = useNotifications();
  const [formData, setFormData] = useState({
    date: new Date(),
    amount: '',
    vendor: '',
    category: 'Other',
    description: '',
  });
  
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [currentEmployee, setCurrentEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(false);

  // Vendor Intelligence state
  const [vendorSuggestions, setVendorSuggestions] = useState<VendorSuggestion[]>([]);
  const [nearbyVendors, setNearbyVendors] = useState<NearbyVendor[]>([]);
  const [showVendorSuggestions, setShowVendorSuggestions] = useState(false);
  const [showNearbyVendors, setShowNearbyVendors] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<{latitude: number, longitude: number} | null>(null);
  const [vendorSearchTimeout, setVendorSearchTimeout] = useState<NodeJS.Timeout | null>(null);
  const vendorInputRef = useRef<TextInput>(null);

  // Category AI state
  const [categorySuggestions, setCategorySuggestions] = useState<CategorySuggestion[]>([]);
  const [loadingCategorySuggestions, setLoadingCategorySuggestions] = useState(false);
  const [showCategorySuggestions, setShowCategorySuggestions] = useState(false);
  const [perDiemEligibility, setPerDiemEligibility] = useState<PerDiemEligibility | null>(null);
  const [autoPerDiemEnabled, setAutoPerDiemEnabled] = useState(true);

  useEffect(() => {
    loadEmployee();
    requestPermissions();
    requestLocationPermissions();
  }, []);

  // Load category suggestions when vendor and amount are entered
  useEffect(() => {
    const loadCategorySuggestions = async () => {
      if (!currentEmployee || !formData.vendor || !formData.amount || formData.category !== 'Other') {
        setCategorySuggestions([]);
        setShowCategorySuggestions(false);
        return;
      }
      
      setLoadingCategorySuggestions(true);
      try {
        const amount = parseFloat(formData.amount);
        if (!isNaN(amount)) {
          const suggestions = await CategoryAiService.getCategorySuggestions(
            formData.vendor,
            amount,
            formData.description,
            currentEmployee.id
          );
          setCategorySuggestions(suggestions);
          setShowCategorySuggestions(suggestions.length > 0);
        }
      } catch (error) {
        console.error('Error loading category suggestions:', error);
        setCategorySuggestions([]);
      } finally {
        setLoadingCategorySuggestions(false);
      }
    };
    
    loadCategorySuggestions();
  }, [formData.vendor, formData.amount, formData.description, formData.category, currentEmployee]);

  // Check per diem eligibility when category is "Per Diem"
  useEffect(() => {
    const checkPerDiemEligibility = async () => {
      if (!currentEmployee || formData.category !== 'Per Diem') {
        setPerDiemEligibility(null);
        return;
      }
      
      try {
        const eligibility = await PerDiemAiService.checkPerDiemEligibility(
          currentEmployee.id,
          formData.date
        );
        setPerDiemEligibility(eligibility);
        
        // Auto-set amount if eligible
        if (eligibility.isEligible && autoPerDiemEnabled) {
          setFormData(prev => ({ ...prev, amount: '35' }));
        }
      } catch (error) {
        console.error('Error checking per diem eligibility:', error);
      }
    };
    
    checkPerDiemEligibility();
  }, [formData.category, formData.date, currentEmployee, autoPerDiemEnabled]);

  const loadEmployee = async () => {
    try {
      const employees = await DatabaseService.getEmployees();
      const employee = employees[0]; // For demo, use first employee
      setCurrentEmployee(employee);
      
      // Set employee for tips context and load receipt tips
      if (employee) {
        setTipsEmployee(employee);
        if (showTips) {
          await loadTipsForScreen('AddReceiptScreen', 'on_load');
        }
      }
    } catch (error) {
      console.error('Error loading employee:', error);
    }
  };

  const requestPermissions = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Camera roll access is required to add receipts');
    }
  };

  const requestLocationPermissions = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const location = await Location.getCurrentPositionAsync({});
        setCurrentLocation({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude
        });
        
        // Load nearby vendors if we have location
        if (currentEmployee) {
          loadNearbyVendors();
        }
      }
    } catch (error) {
      console.log('Location permission denied or error:', error);
    }
  };

  const loadNearbyVendors = async () => {
    if (!currentEmployee || !currentLocation) return;
    
    try {
      // TODO: Implement getNearbyVendorSuggestions in DatabaseService
      // const nearby = await DatabaseService.getNearbyVendorSuggestions(
      //   currentEmployee.id,
      //   currentLocation.latitude,
      //   currentLocation.longitude
      // );
      const nearby: NearbyVendor[] = [];
      setNearbyVendors(nearby);
    } catch (error) {
      console.error('Error loading nearby vendors:', error);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Handle vendor search with debouncing
    if (field === 'vendor' && value.length >= 2 && currentEmployee) {
      if (vendorSearchTimeout) {
        clearTimeout(vendorSearchTimeout);
      }
      
      const timeout = setTimeout(async () => {
        try {
          // TODO: Implement getVendorSuggestions in DatabaseService
          // const suggestions = await DatabaseService.getVendorSuggestions(
          //   currentEmployee.id,
          //   value
          // );
          const suggestions: VendorSuggestion[] = [];
          setVendorSuggestions(suggestions);
          setShowVendorSuggestions(suggestions.length > 0);
        } catch (error) {
          console.error('Error getting vendor suggestions:', error);
        }
      }, 300); // 300ms debounce
      
      setVendorSearchTimeout(timeout);
    } else if (field === 'vendor' && value.length < 2) {
      setShowVendorSuggestions(false);
      setVendorSuggestions([]);
    }
  };

  const handleVendorSuggestionSelect = (suggestion: VendorSuggestion) => {
    setFormData(prev => ({
      ...prev,
      vendor: suggestion.vendorName,
      category: suggestion.suggestedCategory
      // Don't auto-fill amount - let user enter the actual receipt amount
    }));
    setShowVendorSuggestions(false);
    setVendorSuggestions([]);
  };

  const handleNearbyVendorSelect = (vendor: NearbyVendor) => {
    setFormData(prev => ({
      ...prev,
      vendor: vendor.vendorName,
      category: vendor.category
    }));
    setShowNearbyVendors(false);
  };

  const handleCategorySuggestionSelect = async (suggestion: CategorySuggestion) => {
    setFormData(prev => ({
      ...prev,
      category: suggestion.category
    }));
    setShowCategorySuggestions(false);
    
    // Learn from user's selection
    if (currentEmployee) {
      await CategoryAiService.learnFromSelection(
        formData.vendor,
        parseFloat(formData.amount),
        suggestion.category,
        currentEmployee.id
      );
    }
  };

  const handlePerDiemToggle = () => {
    setAutoPerDiemEnabled(!autoPerDiemEnabled);
  };

  const handleDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(false); // Close picker immediately after selection
    if (selectedDate) {
      setFormData(prev => ({ ...prev, date: selectedDate }));
    }
  };

  const takePicture = async () => {
    try {
      console.log('📸 Taking picture...');
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      console.log('📸 Camera permission status:', status);
      
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Camera access is required to take receipt photos');
        return;
      }

      console.log('📸 Launching camera...');
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true, // Enable built-in cropping
        aspect: [4, 3],
        quality: 0.8,
      });

      console.log('📸 Camera result:', result);

      if (!result.canceled && result.assets[0]) {
        const uri = result.assets[0].uri;
        console.log('📸 Image captured:', uri);
        setImageUri(uri);
      } else {
        console.log('📸 Camera was canceled or no image captured');
      }
    } catch (error) {
      console.error('❌ Error taking picture:', error);
      Alert.alert('Error', `Failed to take picture: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const selectFromGallery = async () => {
    try {
      console.log('📷 Selecting from gallery...');
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true, // Enable built-in cropping
        aspect: [4, 3],
        quality: 0.8,
      });

      console.log('📷 Gallery result:', result);

      if (!result.canceled && result.assets[0]) {
        const uri = result.assets[0].uri;
        console.log('📷 Image selected:', uri);
        setImageUri(uri);
      } else {
        console.log('📷 Gallery selection was canceled or no image selected');
      }
    } catch (error) {
      console.error('❌ Error selecting image:', error);
      Alert.alert('Error', `Failed to select image: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };


  const validateForm = async (): Promise<boolean> => {
    if (!imageUri) {
      Alert.alert('Validation Error', 'Please take or select a receipt photo');
      return false;
    }
    if (!formData.vendor.trim()) {
      Alert.alert('Validation Error', 'Vendor is required');
      return false;
    }
    if (!formData.amount.trim() || isNaN(Number(formData.amount)) || Number(formData.amount) <= 0) {
      Alert.alert('Validation Error', 'Please enter a valid amount');
      return false;
    }

    // Per Diem validation
    if (formData.category === 'Per Diem') {
      const isValidPerDiem = await validatePerDiemRules();
      if (!isValidPerDiem) {
        return false;
      }
    }

    // EES validation
    if (formData.category === 'EES') {
      const isValidEes = await validateEesRules();
      if (!isValidEes) {
        return false;
      }
    }

    return true;
  };

  const validatePerDiemRules = async (): Promise<boolean> => {
    if (!currentEmployee) return false;

    const amount = Number(formData.amount);
    const costCenter = currentEmployee.costCenters?.[0] || 'CC001';

    try {
      const validation = await PerDiemRulesService.validatePerDiem(
        currentEmployee.id,
        costCenter,
        amount,
        formData.date
      );

      return new Promise((resolve) => {
        Alert.alert(
          'Per Diem Rules',
          validation.message,
          [
            {
              text: 'Cancel',
              onPress: () => resolve(false),
              style: 'cancel'
            },
            {
              text: validation.isValid ? 'Continue' : 'Continue Anyway',
              onPress: () => resolve(true)
            }
          ],
          { cancelable: false }
        );
      });
    } catch (error) {
      console.error('Error validating per diem:', error);
      Alert.alert('Error', 'Failed to validate per diem rules');
      return false;
    }
  };

  const validateEesRules = async (): Promise<boolean> => {
    if (!currentEmployee) return false;

    const amount = Number(formData.amount);
    const costCenter = currentEmployee.costCenters?.[0] || 'CC001';

    try {
      const validation = await EesRulesService.validateEes(
        currentEmployee.id,
        costCenter,
        amount,
        formData.date
      );

      return new Promise((resolve) => {
        Alert.alert(
          'EES Rules',
          validation.message,
          [
            {
              text: 'Cancel',
              onPress: () => resolve(false),
              style: 'cancel'
            },
            {
              text: validation.isValid ? 'Continue' : 'Continue Anyway',
              onPress: () => resolve(true)
            }
          ],
          { cancelable: false }
        );
      });
    } catch (error) {
      console.error('Error validating EES:', error);
      Alert.alert('Error', 'Failed to validate EES rules');
      return false;
    }
  };

  const handleSave = async () => {
    const isValid = await validateForm();
    if (!isValid || !currentEmployee || !imageUri) return;

    setLoading(true);
    try {
      // For Car Rental Fuel, combine with existing Car Rental if it exists
      if (formData.category === 'Rental Car Fuel') {
        const existingCarRental = await DatabaseService.getReceiptsByCategoryAndDate(
          currentEmployee.id,
          'Rental Car',
          formData.date
        );

        if (existingCarRental.length > 0) {
          // Update the existing Car Rental receipt with combined amount
          const combinedAmount = existingCarRental[0].amount + Number(formData.amount);
          await DatabaseService.updateReceipt(existingCarRental[0].id, {
            ...existingCarRental[0],
            amount: combinedAmount,
            vendor: `${existingCarRental[0].vendor} + ${formData.vendor.trim()}`,
          });
          Alert.alert('Success', 'Rental car fuel combined with existing rental car receipt');
          navigation.goBack();
          return;
        } else {
          // No existing Car Rental, save as Car Rental instead
          const receiptData = {
            employeeId: currentEmployee.id,
            date: formData.date,
            amount: Number(formData.amount),
            vendor: formData.vendor.trim(),
            category: 'Rental Car', // Change category to Rental Car
            description: formData.description.trim(),
            imageUri,
          };
          await DatabaseService.createReceipt(receiptData);
          Alert.alert('Success', 'Rental car fuel saved as rental car receipt');
          navigation.goBack();
          return;
        }
      }

      // For regular Car Rental, check if there's existing fuel to combine
      if (formData.category === 'Rental Car') {
        const existingFuel = await DatabaseService.getReceiptsByCategoryAndDate(
          currentEmployee.id,
          'Rental Car Fuel',
          formData.date
        );

        if (existingFuel.length > 0) {
          // Combine with existing fuel
          const combinedAmount = Number(formData.amount) + existingFuel[0].amount;
          const receiptData = {
            employeeId: currentEmployee.id,
            date: formData.date,
            amount: combinedAmount,
            vendor: `${formData.vendor.trim()} + ${existingFuel[0].vendor}`,
            category: 'Rental Car',
            imageUri,
          };
          await DatabaseService.createReceipt(receiptData);
          // Delete the fuel receipt
          await DatabaseService.deleteReceipt(existingFuel[0].id);
          Alert.alert('Success', 'Rental car combined with existing fuel receipt');
          navigation.goBack();
          return;
        }
      }

      // Regular save for all other categories
      const receiptData = {
        employeeId: currentEmployee.id,
        date: formData.date,
        amount: Number(formData.amount),
        vendor: formData.vendor.trim(),
        category: formData.category,
        description: formData.description.trim(),
        imageUri,
      };

      await DatabaseService.createReceipt(receiptData);
      
      // Run anomaly detection BEFORE showing success alert
      let anomalyMessage = '';
      try {
        console.log('🔍 Running anomaly detection for new receipt...');
        const anomalies = await AnomalyDetectionService.detectReceiptAnomaly(
          currentEmployee.id,
          receiptData as Receipt
        );
        
        if (anomalies.length > 0) {
          console.log('🚨 Receipt anomalies detected:', anomalies.length);
          const alerts = AnomalyDetectionService.generateAlerts(
            currentEmployee.id,
            anomalies,
            'receipt'
          );
          
          // Build anomaly message for the success alert
          anomalyMessage = '\n\n⚠️ Smart Alert:\n' + alerts.map(alert => `• ${alert.message}`).join('\n');
          
          // Also show the detailed anomaly alert
          showAnomalyAlert(anomalies, 'Receipt');
        } else {
          console.log('✅ No receipt anomalies detected');
        }
      } catch (error) {
        console.error('❌ Error running receipt anomaly detection:', error);
      }
      
      Alert.alert('Success', `Receipt added successfully${anomalyMessage}`);
      navigation.goBack();
    } catch (error) {
      console.error('Error saving receipt:', error);
      Alert.alert('Error', 'Failed to save receipt');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar style="auto" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <MaterialIcons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Add Receipt</Text>
        <View style={{ width: 24 }} />
      </View>

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

        {/* Receipt Photo */}
        <View style={styles.photoContainer}>
          <View style={styles.labelRow}>
            <Text style={styles.label}>Receipt Photo *</Text>
          </View>
          
          {imageUri ? (
            <View style={styles.imageContainer}>
              <Image source={{ uri: imageUri }} style={styles.receiptImage} />
              
              
              <TouchableOpacity
                style={styles.changePhotoButton}
                onPress={() => {
                  Alert.alert(
                    'Change Photo',
                    'How would you like to change the photo?',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Take Photo', onPress: takePicture },
                      { text: 'Select from Gallery', onPress: selectFromGallery },
                      { text: 'Crop Photo', onPress: () => {
                        // Re-crop the existing photo
                        Alert.alert(
                          'Crop Photo',
                          'How would you like to crop the photo?',
                          [
                            { text: 'Cancel', style: 'cancel' },
                            { text: 'Take New Photo', onPress: takePicture },
                            { text: 'Select from Gallery', onPress: selectFromGallery },
                          ]
                        );
                      }},
                    ]
                  );
                }}
              >
                <MaterialIcons name="edit" size={20} color="#fff" />
                <Text style={styles.changePhotoText}>Change Photo</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.photoPlaceholder}>
              <MaterialIcons name="camera-alt" size={48} color="#ccc" />
              <Text style={styles.photoPlaceholderText}>No photo selected</Text>
              <View style={styles.photoButtons}>
                <TouchableOpacity style={styles.photoButton} onPress={takePicture}>
                  <MaterialIcons name="camera-alt" size={20} color="#2196F3" />
                  <Text style={styles.photoButtonText}>Take Photo</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.photoButton} onPress={selectFromGallery}>
                  <MaterialIcons name="photo-library" size={20} color="#2196F3" />
                  <Text style={styles.photoButtonText}>Select from Gallery</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        {/* Date */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Date</Text>
          <TouchableOpacity
            style={styles.dateButton}
            onPress={() => setShowDatePicker(true)}
          >
            <Text style={styles.dateText}>
              {formData.date.toLocaleDateString()}
            </Text>
            <MaterialIcons name="calendar-today" size={20} color="#666" />
          </TouchableOpacity>
        </View>

        {/* Date Picker Modal */}
        <Modal
          visible={showDatePicker}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setShowDatePicker(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Select Date</Text>
                <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                  <MaterialIcons name="close" size={24} color="#666" />
                </TouchableOpacity>
              </View>
              
              <DateTimePicker
                value={formData.date}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={handleDateChange}
                style={styles.datePicker}
              />
              
              <View style={styles.modalButtons}>
                <TouchableOpacity 
                  style={styles.modalCancelButton} 
                  onPress={() => setShowDatePicker(false)}
                >
                  <Text style={styles.modalCancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.modalConfirmButton} 
                  onPress={() => setShowDatePicker(false)}
                >
                  <Text style={styles.modalConfirmButtonText}>Done</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Vendor */}
        <View style={styles.inputGroup}>
          <View style={styles.vendorHeader}>
            <Text style={styles.label}>Vendor *</Text>
            {nearbyVendors.length > 0 && (
              <TouchableOpacity 
                style={styles.nearbyButton}
                onPress={() => setShowNearbyVendors(!showNearbyVendors)}
              >
                <MaterialIcons name="location-on" size={16} color="#2196F3" />
                <Text style={styles.nearbyButtonText}>
                  {showNearbyVendors ? 'Hide' : 'Nearby'} ({nearbyVendors.length})
                </Text>
              </TouchableOpacity>
            )}
          </View>
          
          <TextInput
            ref={vendorInputRef}
            style={styles.input}
            value={formData.vendor}
            onChangeText={(value) => handleInputChange('vendor', value)}
            placeholder="e.g., Shell Gas Station, McDonald's"
            placeholderTextColor="#999"
            onFocus={() => {
              if (vendorSuggestions.length > 0) {
                setShowVendorSuggestions(true);
              }
            }}
            onBlur={() => {
              // Delay hiding suggestions to allow for selection
              setTimeout(() => setShowVendorSuggestions(false), 200);
            }}
          />

          {/* Vendor Suggestions */}
          {showVendorSuggestions && vendorSuggestions.length > 0 && (
            <View style={styles.suggestionsContainer}>
              <Text style={styles.suggestionsTitle}>Smart Suggestions</Text>
              <FlatList
                data={vendorSuggestions}
                keyExtractor={(item, index) => `${item.vendorName}-${index}`}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.suggestionItem}
                    onPress={() => handleVendorSuggestionSelect(item)}
                  >
                    <View style={styles.suggestionContent}>
                      <Text style={styles.suggestionVendor}>{item.vendorName}</Text>
                      <Text style={styles.suggestionDetails}>
                        {item.suggestedCategory}
                      </Text>
                      <Text style={styles.suggestionReason}>{item.reason}</Text>
                    </View>
                    <View style={styles.confidenceBadge}>
                      <Text style={styles.confidenceText}>
                        {Math.round(item.confidence * 100)}%
                      </Text>
                    </View>
                  </TouchableOpacity>
                )}
                showsVerticalScrollIndicator={false}
                style={styles.suggestionsList}
              />
            </View>
          )}

          {/* Nearby Vendors */}
          {showNearbyVendors && nearbyVendors.length > 0 && (
            <View style={styles.suggestionsContainer}>
              <Text style={styles.suggestionsTitle}>Nearby Vendors</Text>
              <FlatList
                data={nearbyVendors}
                keyExtractor={(item, index) => `nearby-${item.vendorName}-${index}`}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.suggestionItem}
                    onPress={() => handleNearbyVendorSelect(item)}
                  >
                    <View style={styles.suggestionContent}>
                      <Text style={styles.suggestionVendor}>{item.vendorName}</Text>
                      <Text style={styles.suggestionDetails}>
                        {item.category} • {item.distance} miles away
                      </Text>
                      <Text style={styles.suggestionAddress}>{item.vendorAddress}</Text>
                    </View>
                    <MaterialIcons name="location-on" size={20} color="#666" />
                  </TouchableOpacity>
                )}
                showsVerticalScrollIndicator={false}
                style={styles.suggestionsList}
              />
            </View>
          )}
        </View>

        {/* Amount */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Amount *</Text>
          <TextInput
            style={styles.input}
            value={formData.amount}
            onChangeText={(value) => handleInputChange('amount', value)}
            placeholder="0.00"
            keyboardType="numeric"
            placeholderTextColor="#999"
          />
        </View>

        {/* Description/Notes */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Description (Optional)</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={formData.description}
            onChangeText={(value) => handleInputChange('description', value)}
            placeholder="Add notes about this receipt..."
            placeholderTextColor="#999"
            multiline
            numberOfLines={3}
          />
        </View>

        {/* Category */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Category</Text>
          <View style={styles.categoryContainer}>
            {RECEIPT_CATEGORIES.map((category) => (
              <TouchableOpacity
                key={category}
                style={[
                  styles.categoryButton,
                  formData.category === category && styles.categoryButtonSelected,
                ]}
                onPress={() => handleInputChange('category', category)}
              >
                <Text
                  style={[
                    styles.categoryButtonText,
                    formData.category === category && styles.categoryButtonTextSelected,
                  ]}
                >
                  {category}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Category AI Suggestions */}
        {showCategorySuggestions && categorySuggestions.length > 0 && (
          <View style={styles.inputGroup}>
            <View style={styles.aiSuggestionsHeader}>
              <MaterialIcons name="lightbulb" size={20} color="#FF9800" />
              <Text style={styles.aiSuggestionsTitle}>AI Category Suggestions</Text>
              {loadingCategorySuggestions && (
                <MaterialIcons name="refresh" size={16} color="#999" />
              )}
            </View>
            <View style={styles.categorySuggestionsContainer}>
              {categorySuggestions.map((suggestion, index) => (
                <TouchableOpacity
                  key={suggestion.category}
                  style={[
                    styles.categorySuggestionChip,
                    index === 0 && styles.categorySuggestionChipTop
                  ]}
                  onPress={() => handleCategorySuggestionSelect(suggestion)}
                >
                  <View style={styles.categorySuggestionContent}>
                    <Text style={styles.categorySuggestionText}>{suggestion.category}</Text>
                    <Text style={styles.categorySuggestionReason}>{suggestion.reasoning}</Text>
                  </View>
                  <View style={[
                    styles.confidenceBadge,
                    index === 0 && styles.confidenceBadgeTop
                  ]}>
                    <Text style={styles.confidenceText}>
                      {Math.round(suggestion.confidence)}%
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Per Diem Eligibility Check */}
        {formData.category === 'Per Diem' && perDiemEligibility && (
          <View style={styles.inputGroup}>
            <View style={styles.perDiemContainer}>
              <View style={styles.perDiemHeader}>
                <MaterialIcons 
                  name={perDiemEligibility.isEligible ? "check-circle" : "cancel"} 
                  size={20} 
                  color={perDiemEligibility.isEligible ? "#4CAF50" : "#F44336"} 
                />
                <Text style={styles.perDiemTitle}>
                  Per Diem Eligibility: {perDiemEligibility.isEligible ? 'Eligible' : 'Not Eligible'}
                </Text>
              </View>
              <Text style={styles.perDiemReason}>{perDiemEligibility.reason}</Text>
              
              {perDiemEligibility.isEligible && (
                <View style={styles.perDiemDetails}>
                  <Text style={styles.perDiemDetailsTitle}>Details:</Text>
                  <Text style={styles.perDiemDetailsText}>
                    • Hours Worked: {perDiemEligibility.details.hoursWorked.toFixed(1)}h
                  </Text>
                  <Text style={styles.perDiemDetailsText}>
                    • Miles Driven: {perDiemEligibility.details.milesDriven.toFixed(1)} mi
                  </Text>
                  <Text style={styles.perDiemDetailsText}>
                    • Distance from Base: {perDiemEligibility.details.distanceFromBase.toFixed(1)} mi
                  </Text>
                </View>
              )}
              
              <View style={styles.perDiemToggle}>
                <Text style={styles.perDiemToggleText}>Auto-set amount to $35</Text>
                <TouchableOpacity
                  style={[
                    styles.toggleButton,
                    autoPerDiemEnabled && styles.toggleButtonActive
                  ]}
                  onPress={handlePerDiemToggle}
                >
                  <MaterialIcons 
                    name={autoPerDiemEnabled ? "toggle-on" : "toggle-off"} 
                    size={24} 
                    color={autoPerDiemEnabled ? "#4CAF50" : "#999"} 
                  />
                </TouchableOpacity>
              </View>
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
            {loading ? 'Saving...' : 'Save Receipt'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
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
    padding: 20,
  },
  photoContainer: {
    marginBottom: 20,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  imageContainer: {
    position: 'relative',
  },
  receiptImage: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    backgroundColor: '#fff',
  },
  changePhotoButton: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
  },
  changePhotoText: {
    color: '#fff',
    fontSize: 12,
    marginLeft: 4,
  },
  photoPlaceholder: {
    backgroundColor: '#fff',
    padding: 40,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#ddd',
    borderStyle: 'dashed',
  },
  photoPlaceholderText: {
    fontSize: 16,
    color: '#666',
    marginTop: 8,
    marginBottom: 20,
  },
  photoButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  photoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
  },
  photoButtonText: {
    fontSize: 14,
    color: '#2196F3',
    marginLeft: 4,
  },
  inputGroup: {
    marginBottom: 20,
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
  categoryContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  categoryButtonSelected: {
    backgroundColor: '#2196F3',
    borderColor: '#2196F3',
  },
  categoryButtonText: {
    fontSize: 14,
    color: '#333',
  },
  categoryButtonTextSelected: {
    color: '#fff',
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
  datePicker: {
    marginVertical: 10,
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

  // Vendor Intelligence Styles
  vendorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  nearbyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#E3F2FD',
    borderRadius: 12,
  },
  nearbyButtonText: {
    color: '#2196F3',
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 4,
  },
  suggestionsContainer: {
    marginTop: 8,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    maxHeight: 200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  suggestionsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    padding: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  suggestionsList: {
    maxHeight: 150,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  suggestionContent: {
    flex: 1,
  },
  suggestionVendor: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  suggestionDetails: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  suggestionReason: {
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
  },
  suggestionAddress: {
    fontSize: 12,
    color: '#999',
  },
  confidenceBadge: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 8,
  },
  confidenceText: {
    color: '#fff',
    fontSize: 12,
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

  // Category AI Styles
  aiSuggestionsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  aiSuggestionsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginLeft: 8,
  },
  categorySuggestionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categorySuggestionChip: {
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    marginBottom: 8,
  },
  categorySuggestionChipTop: {
    backgroundColor: '#FFF3E0',
    borderColor: '#FF9800',
  },
  categorySuggestionContent: {
    flex: 1,
  },
  categorySuggestionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  categorySuggestionReason: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
  },
  confidenceBadgeTop: {
    backgroundColor: '#FF9800',
  },

  // Per Diem Styles
  perDiemContainer: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  perDiemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  perDiemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginLeft: 8,
  },
  perDiemReason: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
    lineHeight: 20,
  },
  perDiemDetails: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  perDiemDetailsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  perDiemDetailsText: {
    fontSize: 13,
    color: '#666',
    marginBottom: 4,
  },
  perDiemToggle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  perDiemToggleText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  toggleButton: {
    padding: 4,
  },
  toggleButtonActive: {
    // Additional styles for active state if needed
  },
});

