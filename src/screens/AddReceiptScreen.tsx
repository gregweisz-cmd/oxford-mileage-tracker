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
  Keyboard,
  TouchableWithoutFeedback,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import DateTimePicker from '@react-native-community/datetimepicker';
import { DatabaseService } from '../services/database';
import { PerDiemRulesService } from '../services/perDiemRulesService';
import EesRulesService from '../services/eesRulesService';
import { CostCenterAutoSelectionService } from '../services/costCenterAutoSelectionService';
import { VendorSuggestion, NearbyVendor } from '../services/vendorIntelligenceService';
import { Employee, Receipt } from '../types';
import { useTips } from '../contexts/TipsContext';
import { TipCard } from '../components/TipCard';
import { AnomalyDetectionService } from '../services/anomalyDetectionService';
import { useNotifications } from '../contexts/NotificationContext';
import { CategoryAiService, CategorySuggestion } from '../services/categoryAiService';
import { PerDiemAiService, PerDiemEligibility } from '../services/perDiemAiService';
import { ReceiptOcrService } from '../services/receiptOcrService';
import { COST_CENTERS } from '../constants/costCenters';
import { ReceiptPhotoQualityService, PhotoQualityResult } from '../services/receiptPhotoQualityService';

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

const EES_NOTE_TEXT = 'Not for reimbursement';
const EES_NOTE_SUFFIX = ` - ${EES_NOTE_TEXT}`;

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
  const amountInputRef = useRef<TextInput>(null);
  const descriptionInputRef = useRef<TextInput>(null);

  // Category AI state
  const [categorySuggestions, setCategorySuggestions] = useState<CategorySuggestion[]>([]);
  const [loadingCategorySuggestions, setLoadingCategorySuggestions] = useState(false);
  const [showCategorySuggestions, setShowCategorySuggestions] = useState(false);
  const [perDiemEligibility, setPerDiemEligibility] = useState<PerDiemEligibility | null>(null);
  const [autoPerDiemEnabled, setAutoPerDiemEnabled] = useState(true);
  const [selectedCostCenter, setSelectedCostCenter] = useState<string>('');
  const [currentPerDiemRule, setCurrentPerDiemRule] = useState<any>(null);
  
  // OCR state
  const [processingOcr, setProcessingOcr] = useState(false);
  
  // Photo quality state
  const [photoQualityResult, setPhotoQualityResult] = useState<PhotoQualityResult | null>(null);
  const [dismissedQualityWarning, setDismissedQualityWarning] = useState(false);

  useEffect(() => {
    loadEmployee();
    requestPermissions();
    requestLocationPermissions();
  }, []);

  // Refresh employee data when screen comes into focus (to get updated cost centers)
  useFocusEffect(
    React.useCallback(() => {
      loadEmployee();
    }, [])
  );

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
        setCurrentPerDiemRule(null);
        return;
      }
      
      try {
        const eligibility = await PerDiemAiService.checkPerDiemEligibility(
          currentEmployee.id,
          formData.date
        );
        setPerDiemEligibility(eligibility);
        
        // Get the Per Diem rule for this employee's cost center
        const costCenter = currentEmployee.defaultCostCenter || currentEmployee.costCenters?.[0] || 'Program Services';
        const rule = await PerDiemRulesService.getPerDiemRule(costCenter);
        setCurrentPerDiemRule(rule);
        
        // Auto-set amount if eligible AND toggle is enabled AND NOT using actual amount
        if (eligibility.isEligible && autoPerDiemEnabled && rule && !rule.useActualAmount) {
          setFormData(prev => ({ ...prev, amount: rule.maxAmount.toString() }));
          console.log(`💰 AddReceipt: Auto-filled amount ${rule.maxAmount} based on eligibility check`);
        } else if (eligibility.isEligible && rule?.useActualAmount) {
          console.log(`💰 AddReceipt: Not auto-filling because rule uses actual amount`);
        }
      } catch (error) {
        console.error('Error checking per diem eligibility:', error);
      }
    };
    
    checkPerDiemEligibility();
  }, [formData.category, formData.date, currentEmployee, autoPerDiemEnabled]);

  const loadEmployee = async () => {
    try {
      console.log('📄 AddReceiptScreen: Loading current employee...');
      const employee = await DatabaseService.getCurrentEmployee();
      console.log('📄 AddReceiptScreen: Current employee loaded:', employee?.name, employee?.id);
      console.log('📄 AddReceiptScreen: Employee cost centers:', employee?.selectedCostCenters);
      setCurrentEmployee(employee);
      
      // Initialize cost center
      if (employee) {
        // Get most frequently used cost center from receipts, or use default
        let suggestedCostCenter = '';
        try {
          // Get all receipts to find most frequently used cost center
          const allReceipts = await DatabaseService.getReceipts(employee.id);
          const receiptsWithCostCenter = allReceipts.filter(r => r.costCenter && r.costCenter.trim());
          
          if (receiptsWithCostCenter.length > 0) {
            // Count cost center usage
            const costCenterCounts = new Map<string, number>();
            receiptsWithCostCenter.forEach(receipt => {
              if (receipt.costCenter) {
                const cc = receipt.costCenter.trim();
                costCenterCounts.set(cc, (costCenterCounts.get(cc) || 0) + 1);
              }
            });
            
            // Find most frequent
            let maxCount = 0;
            let mostFrequentCC = '';
            costCenterCounts.forEach((count, cc) => {
              if (count > maxCount) {
                maxCount = count;
                mostFrequentCC = cc;
              }
            });
            
            suggestedCostCenter = mostFrequentCC;
          }
          
          // Fall back to default if no receipts found
          if (!suggestedCostCenter) {
            suggestedCostCenter = employee.defaultCostCenter || 
                                 employee.selectedCostCenters?.[0] || 
                                 '';
          }
        } catch (error) {
          console.error('Error getting cost center suggestion:', error);
          // Fall back to default
          suggestedCostCenter = employee.defaultCostCenter || 
                               employee.selectedCostCenters?.[0] || 
                               '';
        }
        
        console.log('📄 AddReceiptScreen: Auto-selected cost center:', suggestedCostCenter);
        setSelectedCostCenter(suggestedCostCenter);
        
        // Set employee for tips context and load receipt tips
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

  const ensureEesNoteInDescription = (description: string): string => {
    const trimmed = description.trim();
    if (trimmed.length === 0) {
      return EES_NOTE_TEXT;
    }

    if (trimmed.toLowerCase().includes(EES_NOTE_TEXT.toLowerCase())) {
      return trimmed;
    }

    return `${trimmed}${EES_NOTE_SUFFIX}`;
  };

  const removeEesNoteFromDescription = (description: string): string => {
    const trimmed = description.trim();
    const noteLower = EES_NOTE_TEXT.toLowerCase();
    const legacySuffix = ` — ${EES_NOTE_TEXT}`;

    if (trimmed.toLowerCase() === noteLower) {
      return '';
    }

    if (trimmed.endsWith(EES_NOTE_SUFFIX)) {
      return trimmed.slice(0, trimmed.length - EES_NOTE_SUFFIX.length).trim();
    }

    if (trimmed.endsWith(legacySuffix)) {
      return trimmed.slice(0, trimmed.length - legacySuffix.length).trim();
    }

    return description;
  };

  const adjustDescriptionForCategory = (prevCategory: string, nextCategory: string, description: string): string => {
    if (nextCategory === 'EES') {
      return ensureEesNoteInDescription(description);
    }

    if (prevCategory === 'EES' && nextCategory !== 'EES') {
      return removeEesNoteFromDescription(description);
    }

    return description;
  };

  const handleInputChange = async (field: string, value: string) => {
    // Auto-set amount based on Per Diem rules when Per Diem is selected
    if (field === 'category' && value === 'Per Diem') {
      let defaultAmount = ''; // No default if using actual amount
      
      try {
        // Get the employee's cost center to determine Per Diem rule
        if (currentEmployee) {
          const costCenter = currentEmployee.defaultCostCenter || currentEmployee.costCenters?.[0] || 'Program Services';
          
          // Get Per Diem rule for this cost center
          const rule = await PerDiemRulesService.getPerDiemRule(costCenter);
          if (rule) {
            // Only auto-fill if NOT using actual amount
            if (!rule.useActualAmount) {
              defaultAmount = rule.maxAmount.toString();
              console.log(`💰 AddReceipt: Auto-filling fixed amount for ${costCenter}: $${defaultAmount}`);
            } else {
              console.log(`💰 AddReceipt: Using actual amount for ${costCenter}, max: $${rule.maxAmount} - user must enter amount`);
            }
          } else {
            // Default rule: auto-fill $35
            defaultAmount = '35';
            console.log(`💰 AddReceipt: No specific rule found for ${costCenter}, using default $35`);
          }
        }
      } catch (error) {
        console.error('❌ AddReceipt: Error getting Per Diem rule:', error);
      }
      
      setFormData(prev => {
        const description = adjustDescriptionForCategory(prev.category, value, prev.description);
        return { ...prev, [field]: value, amount: defaultAmount, description };
      });
    } else if (field === 'category') {
      setFormData(prev => {
        const description = adjustDescriptionForCategory(prev.category, value, prev.description);
        return { ...prev, [field]: value, description };
      });
    } else {
      setFormData(prev => ({ ...prev, [field]: value }));
    }
    
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
      
      setVendorSearchTimeout(timeout as any);
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

  const processOcrOnImage = async (uri: string) => {
    try {
      console.log('🔍 Starting OCR processing...');
      setProcessingOcr(true);
      
      const ocrResult = await ReceiptOcrService.processReceipt(uri);
      
      if (ocrResult.vendor || ocrResult.amount || ocrResult.date || ocrResult.suggestedCategory) {
        console.log('✅ OCR results:', ocrResult);
        
        // Update form with OCR results
        const updates: any = {
          vendor: ocrResult.vendor || formData.vendor,
          amount: ocrResult.amount ? ocrResult.amount.toString() : formData.amount,
          date: ocrResult.date || formData.date
        };
        
        // Set suggested category if available and category is empty or default
        if (ocrResult.suggestedCategory && 
            (!formData.category || formData.category === RECEIPT_CATEGORIES[0])) {
          // Only auto-set if category is empty or set to first category (likely default)
          if (RECEIPT_CATEGORIES.includes(ocrResult.suggestedCategory)) {
            updates.category = ocrResult.suggestedCategory;
          }
        }
        
        setFormData(prev => ({
          ...prev,
          ...updates
        }));
        
        // Build success message
        let message = 'Extracted:\n';
        if (ocrResult.vendor) message += `• Vendor: ${ocrResult.vendor}\n`;
        if (ocrResult.amount) message += `• Amount: $${ocrResult.amount.toFixed(2)}\n`;
        if (ocrResult.date) message += `• Date: ${ocrResult.date.toLocaleDateString()}\n`;
        if (ocrResult.suggestedCategory && updates.category) {
          message += `• Category: ${ocrResult.suggestedCategory} (suggested)\n`;
        }
        message += '\nPlease verify the information.';
        
        // Show success message
        Alert.alert('Auto-Fill Complete', message, [{ text: 'OK' }]);
      } else {
        console.log('⚠️ OCR: No useful data extracted');
        Alert.alert(
          'Unable to Auto-Fill',
          'Could not extract information from the receipt image. Please enter the details manually.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('❌ OCR error:', error);
      // Don't show error to user, just silently fail
      // OCR is a convenience feature, not essential
    } finally {
      setProcessingOcr(false);
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
        setDismissedQualityWarning(false); // Reset warning dismissal when new image is selected
        
        // Check photo quality
        const qualityResult = await ReceiptPhotoQualityService.analyzePhotoQuality(uri);
        console.log('📊 Photo quality analysis:', {
          score: qualityResult.score,
          issues: qualityResult.issues.length,
          warnings: qualityResult.warnings.length,
          isValid: qualityResult.isValid,
          issuesDetail: qualityResult.issues.map(i => `${i.type} (${i.severity})`)
        });
        setPhotoQualityResult(qualityResult);
        
        // Run OCR on the captured image
        await processOcrOnImage(uri);
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
        setDismissedQualityWarning(false); // Reset warning dismissal when new image is selected
        
        // Check photo quality
        const qualityResult = await ReceiptPhotoQualityService.analyzePhotoQuality(uri);
        console.log('📊 Photo quality analysis:', {
          score: qualityResult.score,
          issues: qualityResult.issues.length,
          warnings: qualityResult.warnings.length,
          isValid: qualityResult.isValid,
          issuesDetail: qualityResult.issues.map(i => `${i.type} (${i.severity})`)
        });
        setPhotoQualityResult(qualityResult);
        
        // Run OCR on the selected image
        await processOcrOnImage(uri);
      } else {
        console.log('📷 Gallery selection was canceled or no image selected');
      }
    } catch (error) {
      console.error('❌ Error selecting image:', error);
      Alert.alert('Error', `Failed to select image: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };


  const validateForm = async (): Promise<boolean> => {
    const isPerDiem = formData.category === 'Per Diem';
    
    // Photo is optional for Per Diem receipts
    if (!imageUri && !isPerDiem) {
      Alert.alert('Validation Error', 'Please take or select a receipt photo');
      return false;
    }
    // Vendor is optional for Per Diem receipts (when photo isn't required)
    if (!formData.vendor.trim() && !isPerDiem) {
      Alert.alert('Validation Error', 'Vendor is required');
      return false;
    }
    // Description is required for "Other" category
    if (formData.category === 'Other' && !formData.description.trim()) {
      Alert.alert('Validation Error', 'Description is required for Other Expenses so Finance knows what the money was spent on');
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
    const date = new Date(formData.date);
    const costCenter = currentEmployee.defaultCostCenter || currentEmployee.costCenters?.[0] || 'Program Services';

    try {
      // Get the Per Diem rule for validation
      const rule = await PerDiemRulesService.getPerDiemRule(costCenter);
      
      if (rule) {
        // Check if amount exceeds max
        if (amount > rule.maxAmount) {
          Alert.alert(
            'Per Diem Exceeds Maximum',
            `The amount $${amount.toFixed(2)} exceeds the maximum allowed Per Diem of $${rule.maxAmount.toFixed(2)} for ${costCenter}.\n\n${rule.useActualAmount ? 'Please enter your actual expenses up to the maximum amount.' : 'Please use the fixed Per Diem amount.'}`,
            [{ text: 'OK' }]
          );
          return false;
        }

        // If using actual amount, show info about the rule
        if (rule.useActualAmount && amount > 0) {
          return new Promise((resolve) => {
            Alert.alert(
              'Per Diem - Actual Amount',
              `You are entering actual expenses of $${amount.toFixed(2)} for ${costCenter}.\n\nMaximum allowed: $${rule.maxAmount.toFixed(2)}\n\nIs this correct?`,
              [
                {
                  text: 'Cancel',
                  onPress: () => resolve(false),
                  style: 'cancel'
                },
                {
                  text: 'Confirm',
                  onPress: () => resolve(true)
                }
              ],
              { cancelable: false }
            );
          });
        }
      }

      return true;
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
    if (!isValid || !currentEmployee) return;
    
    // Photo is optional for Per Diem receipts, required for others
    if (!imageUri && formData.category !== 'Per Diem') {
      return;
    }

    // Prevent duplicate saves by checking if already saving
    if (loading) {
      console.log('🚫 AddReceipt: Save already in progress, ignoring duplicate call');
      return;
    }

    setLoading(true);
    try {
      // Check for duplicate receipts (same vendor, amount, and date)
      // Get all receipts for the same date to check across all categories
      const receiptDate = new Date(formData.date);
      const month = receiptDate.getMonth() + 1;
      const year = receiptDate.getFullYear();
      
      const allReceiptsForDate = await DatabaseService.getReceipts(
        currentEmployee.id,
        month,
        year
      );
      
      // Filter to receipts on the exact same date
      const sameDateReceipts = allReceiptsForDate.filter(receipt => {
        const receiptDateObj = new Date(receipt.date);
        const formDateObj = new Date(formData.date);
        
        // Compare year, month, and day
        return receiptDateObj.getFullYear() === formDateObj.getFullYear() &&
               receiptDateObj.getMonth() === formDateObj.getMonth() &&
               receiptDateObj.getDate() === formDateObj.getDate();
      });
      
      // Check for duplicate (same vendor, amount, and date)
      // Normalize vendor for comparison (handle empty vendors, especially for Per Diem)
      const normalizedFormVendor = (formData.vendor || (formData.category === 'Per Diem' ? 'Per Diem' : '')).toLowerCase().trim();
      
      const duplicateReceipt = sameDateReceipts.find(receipt => {
        const normalizedReceiptVendor = (receipt.vendor || (receipt.category === 'Per Diem' ? 'Per Diem' : '')).toLowerCase().trim();
        const vendorMatch = normalizedReceiptVendor === normalizedFormVendor;
        const amountMatch = Math.abs(receipt.amount - Number(formData.amount)) < 0.01; // Allow for small rounding differences
        
        return vendorMatch && amountMatch;
      });
      
      if (duplicateReceipt) {
        const duplicateDate = new Date(duplicateReceipt.date).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        });
        
        Alert.alert(
          'Duplicate Receipt Detected',
          `A similar receipt already exists:\n\n` +
          `• Vendor: ${duplicateReceipt.vendor}\n` +
          `• Amount: $${duplicateReceipt.amount.toFixed(2)}\n` +
          `• Date: ${duplicateDate}\n` +
          `• Category: ${duplicateReceipt.category}\n\n` +
          `Do you want to add this receipt anyway?`,
          [
            { text: 'Cancel', style: 'cancel', onPress: () => setLoading(false) },
            { text: 'Add Anyway', onPress: () => proceedWithSave() }
          ],
          { cancelable: false }
        );
        return;
      }
      
      await proceedWithSave();
    } catch (error) {
      console.error('Error saving receipt:', error);
      Alert.alert('Error', 'Failed to save receipt');
    } finally {
      setLoading(false);
    }
  };

  const proceedWithSave = async () => {
    if (!currentEmployee) return;
    
    // Photo is optional for Per Diem receipts
    if (!imageUri && formData.category !== 'Per Diem') {
      return;
    }
    
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
            vendor: formData.vendor.trim() || 'Rental Car Fuel',
            category: 'Rental Car', // Change category to Rental Car
            description: formData.description.trim(),
            imageUri: imageUri || '',
            costCenter: selectedCostCenter,
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
            imageUri: imageUri || '',
            costCenter: selectedCostCenter,
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
      const finalDescription =
        formData.category === 'EES'
          ? ensureEesNoteInDescription(formData.description)
          : removeEesNoteFromDescription(formData.description).trim();

      const receiptData = {
        employeeId: currentEmployee.id,
        date: formData.date,
        amount: Number(formData.amount),
        vendor: formData.vendor.trim() || (formData.category === 'Per Diem' ? 'Per Diem' : ''),
        category: formData.category,
        description: finalDescription,
        imageUri: imageUri || '',
        costCenter: selectedCostCenter,
      };

      await DatabaseService.createReceipt(receiptData);
      
      // Note: Cost center usage is tracked automatically through receipt history
      // No need to explicitly save - it will be used for future suggestions
      
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
    }
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
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
            <Text style={styles.label}>
              Receipt Photo {formData.category === 'Per Diem' ? '(Optional)' : '*'}
            </Text>
          </View>
          
          {imageUri ? (
            <View style={styles.imageContainer}>
              <Image 
                source={{ uri: imageUri || '' }} 
                style={styles.receiptImage}
                onError={(error) => {
                  console.error('❌ Error loading receipt image:', error.nativeEvent.error);
                  Alert.alert('Image Error', 'Failed to load receipt image. Please try selecting a new image.');
                }}
              />
              
              {/* Photo Quality Warning - Only show for significant issues (score < 70) */}
              {photoQualityResult && !dismissedQualityWarning && photoQualityResult.score < 70 && (
                <View style={[
                  styles.qualityWarning,
                  photoQualityResult.score < 50 && styles.qualityWarningHigh
                ]}>
                  <View style={styles.qualityWarningContent}>
                    <MaterialIcons 
                      name={photoQualityResult.score < 50 ? "error" : "warning"} 
                      size={18} 
                      color={photoQualityResult.score < 50 ? "#F44336" : "#FF9800"} 
                    />
                    <View style={styles.qualityWarningText}>
                      <Text style={[
                        styles.qualityWarningTitle,
                        photoQualityResult.score < 50 && styles.qualityWarningTitleHigh
                      ]}>
                        {ReceiptPhotoQualityService.getQualityMessage(photoQualityResult) || 'Photo quality could be improved'}
                      </Text>
                      {ReceiptPhotoQualityService.getPrimarySuggestion(photoQualityResult) && (
                        <Text style={styles.qualityWarningSuggestion}>
                          {ReceiptPhotoQualityService.getPrimarySuggestion(photoQualityResult)}
                        </Text>
                      )}
                    </View>
                  </View>
                  <TouchableOpacity 
                    onPress={() => setDismissedQualityWarning(true)}
                    style={styles.qualityWarningDismiss}
                  >
                    <MaterialIcons name="close" size={18} color="#666" />
                  </TouchableOpacity>
                </View>
              )}
              
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
            <Text style={styles.label}>
              Vendor {formData.category === 'Per Diem' ? '(Optional)' : '*'}
            </Text>
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
            returnKeyType="next"
            blurOnSubmit={false}
            onSubmitEditing={() => {
              amountInputRef.current?.focus();
            }}
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
            ref={amountInputRef}
            style={styles.input}
            value={formData.amount}
            onChangeText={(value) => handleInputChange('amount', value)}
            placeholder="0.00"
            keyboardType="numeric"
            placeholderTextColor="#999"
            returnKeyType="next"
            blurOnSubmit={false}
            onSubmitEditing={() => {
              descriptionInputRef.current?.focus();
            }}
          />
        </View>

        {/* Description/Notes */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>
            Description {formData.category === 'Other' ? '*' : '(Optional)'}
          </Text>
          {formData.category === 'Other' && (
            <Text style={[styles.label, { fontSize: 12, color: '#666', marginTop: -5, marginBottom: 5 }]}>
              Required for Other Expenses so Finance knows what the money was spent on
            </Text>
          )}
          <TextInput
            ref={descriptionInputRef}
            style={[styles.input, styles.textArea]}
            value={formData.description}
            onChangeText={(value) => handleInputChange('description', value)}
            placeholder={formData.category === 'Other' ? 'Describe what this expense was for...' : 'Add notes about this receipt...'}
            placeholderTextColor="#999"
            multiline
            numberOfLines={3}
            returnKeyType="done"
            blurOnSubmit={true}
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
                onPress={async () => await handleInputChange('category', category)}
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

        {formData.category === 'EES' && (
          <View style={styles.inputGroup}>
            <View style={styles.eesNoticeContainer}>
              <MaterialIcons name="info" size={20} color="#d84315" style={styles.eesNoticeIcon} />
              <View style={styles.eesNoticeTextContainer}>
                <Text style={styles.eesNoticeTitle}>Not for reimbursement</Text>
                <Text style={styles.eesNoticeDescription}>
                  EES payments are required self-pay contributions. Log them here for tracking only - we do not reimburse these charges.
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Cost Center Selector - show if user has cost centers assigned */}
        {currentEmployee && currentEmployee.selectedCostCenters && currentEmployee.selectedCostCenters.length > 0 && (
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
              
              {/* Only show toggle if NOT using actual amount */}
              {currentPerDiemRule && !currentPerDiemRule.useActualAmount && (
                <View style={styles.perDiemToggle}>
                  <Text style={styles.perDiemToggleText}>
                    Auto-set amount to ${currentPerDiemRule.maxAmount}
                  </Text>
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
              )}
              
              {/* Show message if using actual amount */}
              {currentPerDiemRule && currentPerDiemRule.useActualAmount && (
                <View style={styles.perDiemToggle}>
                  <Text style={[styles.perDiemToggleText, { color: '#2196F3' }]}>
                    Enter your actual expenses (max ${currentPerDiemRule.maxAmount})
                  </Text>
                  <MaterialIcons 
                    name="info" 
                    size={24} 
                    color="#2196F3" 
                  />
                </View>
              )}
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
    </TouchableWithoutFeedback>
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
  qualityWarning: {
    marginTop: 8,
    padding: 12,
    backgroundColor: '#FFF3E0',
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#FF9800',
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  qualityWarningHigh: {
    backgroundColor: '#FFEBEE',
    borderLeftColor: '#F44336',
  },
  qualityWarningContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
    gap: 8,
  },
  qualityWarningText: {
    flex: 1,
    gap: 4,
  },
  qualityWarningTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FF9800',
  },
  qualityWarningTitleHigh: {
    color: '#F44336',
  },
  qualityWarningSuggestion: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  qualityWarningDismiss: {
    padding: 4,
    marginLeft: 8,
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

  // EES Notice Styles
  eesNoticeContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFF3E0',
    borderRadius: 12,
    padding: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#F57C00',
  },
  eesNoticeIcon: {
    marginRight: 12,
    marginTop: 2,
  },
  eesNoticeTextContainer: {
    flex: 1,
  },
  eesNoticeTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#BF360C',
    marginBottom: 4,
  },
  eesNoticeDescription: {
    fontSize: 13,
    color: '#5f6368',
    lineHeight: 18,
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
});

