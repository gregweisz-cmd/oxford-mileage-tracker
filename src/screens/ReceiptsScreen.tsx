import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Image,
  Modal,
  TextInput,
  Platform,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { DatabaseService } from '../services/database';
import { PdfService } from '../services/pdfService';
import { Receipt, Employee } from '../types';
import { API_BASE_URL } from '../config/api';
import * as ImagePicker from 'expo-image-picker';

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

interface ReceiptsScreenProps {
  navigation: any;
  route?: {
    params?: {
      selectedMonth?: number;
      selectedYear?: number;
      filterCategory?: string;
    };
  };
}

export default function ReceiptsScreen({ navigation, route }: ReceiptsScreenProps) {
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [currentEmployee, setCurrentEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedReceipt, setSelectedReceipt] = useState<Receipt | null>(null);
  const [showImageModal, setShowImageModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [multiSelectMode, setMultiSelectMode] = useState(false);
  const [selectedReceiptIds, setSelectedReceiptIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [allReceipts, setAllReceipts] = useState<Receipt[]>([]);
  
  // Filter states
  const [showFilters, setShowFilters] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string>('');
  const [filterCostCenter, setFilterCostCenter] = useState<string>('');
  const [filterDateStart, setFilterDateStart] = useState<Date | null>(null);
  const [filterDateEnd, setFilterDateEnd] = useState<Date | null>(null);
  const [filterAmountMin, setFilterAmountMin] = useState<string>('');
  const [filterAmountMax, setFilterAmountMax] = useState<string>('');
  const [showDateStartPicker, setShowDateStartPicker] = useState(false);
  const [showDateEndPicker, setShowDateEndPicker] = useState(false);

  // Get month/year from route params, default to current month/year
  const now = new Date();
  const selectedMonth = route?.params?.selectedMonth ?? (now.getMonth() + 1);
  const selectedYear = route?.params?.selectedYear ?? now.getFullYear();
  const routeFilterCategory = route?.params?.filterCategory;
  
  // Initialize filter category from route if provided
  useEffect(() => {
    if (routeFilterCategory && !filterCategory) {
      setFilterCategory(routeFilterCategory);
    }
  }, [routeFilterCategory]);

  useEffect(() => {
    loadData();
  }, [selectedMonth, selectedYear]);

  // Filter receipts based on search query and all filters
  useEffect(() => {
    let filtered = [...allReceipts];

    // Apply search query filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(receipt => {
        const vendor = receipt.vendor?.toLowerCase() || '';
        const description = receipt.description?.toLowerCase() || '';
        const category = receipt.category?.toLowerCase() || '';
        const costCenter = receipt.costCenter?.toLowerCase() || '';
        const amount = receipt.amount.toString();
        
        return (
          vendor.includes(query) ||
          description.includes(query) ||
          category.includes(query) ||
          costCenter.includes(query) ||
          amount.includes(query)
        );
      });
    }

    // Apply category filter
    if (filterCategory) {
      filtered = filtered.filter(receipt => receipt.category === filterCategory);
    }

    // Apply cost center filter
    if (filterCostCenter) {
      filtered = filtered.filter(receipt => receipt.costCenter === filterCostCenter);
    }

    // Apply date range filter
    if (filterDateStart) {
      filtered = filtered.filter(receipt => {
        const receiptDate = new Date(receipt.date);
        return receiptDate >= filterDateStart;
      });
    }
    if (filterDateEnd) {
      filtered = filtered.filter(receipt => {
        const receiptDate = new Date(receipt.date);
        // Set end date to end of day for inclusive filtering
        const endDate = new Date(filterDateEnd);
        endDate.setHours(23, 59, 59, 999);
        return receiptDate <= endDate;
      });
    }

    // Apply amount range filter
    if (filterAmountMin) {
      const minAmount = parseFloat(filterAmountMin);
      if (!isNaN(minAmount)) {
        filtered = filtered.filter(receipt => receipt.amount >= minAmount);
      }
    }
    if (filterAmountMax) {
      const maxAmount = parseFloat(filterAmountMax);
      if (!isNaN(maxAmount)) {
        filtered = filtered.filter(receipt => receipt.amount <= maxAmount);
      }
    }
    
    setReceipts(filtered);
  }, [searchQuery, allReceipts, filterCategory, filterCostCenter, filterDateStart, filterDateEnd, filterAmountMin, filterAmountMax]);

  // Refresh data when screen comes into focus (e.g., after adding a receipt)
  useFocusEffect(
    React.useCallback(() => {
      console.log('📄 ReceiptsScreen: Screen focused, refreshing data');
      loadData();
    }, [selectedMonth, selectedYear, filterCategory])
  );

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Get the current logged-in employee instead of the first employee
      const employee = await DatabaseService.getCurrentEmployee();
      
      if (employee) {
        setCurrentEmployee(employee);
        
        // Get receipts for the selected month/year
        const employeeReceipts = await DatabaseService.getReceipts(
          employee.id,
          selectedMonth,
          selectedYear
        );
        
        // Store all receipts - filters will be applied in useEffect
        setAllReceipts(employeeReceipts);
        console.log(`📄 ReceiptsScreen: Loaded ${employeeReceipts.length} receipts for ${employee.name} (${selectedMonth}/${selectedYear})`);
      } else {
        console.log('📄 ReceiptsScreen: No current employee found');
        setReceipts([]);
      }
    } catch (error) {
      console.error('Error loading receipts:', error);
      Alert.alert('Error', 'Failed to load receipts');
    } finally {
      setLoading(false);
    }
  };

  const generateMonthlyReceiptsPdf = async () => {
    if (!currentEmployee) {
      Alert.alert('Error', 'No employee selected');
      return;
    }

    try {
      console.log('Starting PDF generation for employee:', currentEmployee.name);

      console.log(`Getting receipts for ${selectedMonth}/${selectedYear}`);

      // Get receipts for selected month/year
      const monthlyReceipts = await DatabaseService.getReceipts(
        currentEmployee.id,
        selectedMonth,
        selectedYear
      );

      console.log('Found receipts:', monthlyReceipts.length);

      if (monthlyReceipts.length === 0) {
        Alert.alert('No Data', 'No receipts found for this month');
        return;
      }

      // Validate employee data
      if (!currentEmployee.baseAddress) {
        Alert.alert('Missing Data', 'Employee base address is required for PDF generation. Please update employee profile.');
        return;
      }

      console.log('Generating PDF...');

      // Generate PDF
      const pdfUri = await PdfService.generateMonthlyReceiptsPdf(
        monthlyReceipts,
        currentEmployee,
        selectedMonth,
        selectedYear
      );

      console.log('PDF generated successfully, sharing...');

      // Share PDF
      await PdfService.shareReceiptsPdf(pdfUri, currentEmployee, selectedMonth, selectedYear);

      Alert.alert('Success', 'Monthly receipts PDF generated and shared successfully');
    } catch (error) {
      console.error('Error generating PDF:', error);
      
      // Provide more specific error messages
      let errorMessage = 'Failed to generate receipts PDF';
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      Alert.alert('Error', errorMessage);
    }
  };

  const testPdfGeneration = async () => {
    try {
      console.log('Testing PDF generation...');
      const success = await PdfService.testPdfGeneration();
      
      if (success) {
        Alert.alert('Test Success', 'PDF generation is working correctly');
      } else {
        Alert.alert('Test Failed', 'PDF generation is not working. Check device compatibility.');
      }
    } catch (error) {
      console.error('Test PDF generation error:', error);
      Alert.alert('Test Error', `PDF test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const deleteReceipt = (receipt: Receipt) => {
    Alert.alert(
      'Delete Receipt',
      `Are you sure you want to delete this receipt from ${receipt.vendor}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await DatabaseService.deleteReceipt(receipt.id);
              Alert.alert('Success', 'Receipt deleted successfully');
              loadData(); // Refresh the list
            } catch (error) {
              console.error('Error deleting receipt:', error);
              Alert.alert('Error', 'Failed to delete receipt');
            }
          },
        },
      ]
    );
  };

  // Helper function to resolve image URI (handles both local files and backend URLs)
  const resolveImageUri = (imageUri: string | undefined | null): string => {
    if (!imageUri || imageUri.trim() === '') return '';
    
    // If it's already a full URL (http/https), return as-is
    if (imageUri.startsWith('http://') || imageUri.startsWith('https://')) {
      return imageUri;
    }
    
    // If it's a file:// URI, return as-is
    if (imageUri.startsWith('file://') || imageUri.startsWith('content://') || imageUri.startsWith('ph://')) {
      return imageUri;
    }
    
    // If it's just a filename (from backend), construct the full URL
    // Backend serves images from /uploads/ directory
    // Remove leading slash if present
    const filename = imageUri.startsWith('/') ? imageUri.substring(1) : imageUri;
    return `${API_BASE_URL}/uploads/${filename}`;
  };
  
  // State for image loading errors
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set());
  
  const handleImageError = (receiptId: string) => {
    setImageErrors(prev => new Set(prev).add(receiptId));
  };
  
  const handleImageLoad = (receiptId: string) => {
    setImageErrors(prev => {
      const newSet = new Set(prev);
      newSet.delete(receiptId);
      return newSet;
    });
  };

  const viewReceiptImage = (receipt: Receipt) => {
    setSelectedReceipt(receipt);
    setShowImageModal(true);
  };

  const viewReceiptDetails = (receipt: Receipt) => {
    setSelectedReceipt(receipt);
    setShowDetailsModal(true);
  };
  
  const handleEditReceiptImage = async (receipt: Receipt) => {
    try {
      // Request permissions
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please grant permission to access your photo library.');
        return;
      }
      
      // Show options: Take Photo, Choose from Library, Cancel
      Alert.alert(
        'Edit Receipt Image',
        'Choose an option',
        [
          {
            text: 'Take Photo',
            onPress: async () => {
              const cameraStatus = await ImagePicker.requestCameraPermissionsAsync();
              if (cameraStatus.status !== 'granted') {
                Alert.alert('Permission Required', 'Please grant camera permission.');
                return;
              }
              const result = await ImagePicker.launchCameraAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                quality: 0.8,
                aspect: [4, 3],
              });
              
              if (!result.canceled && result.assets[0]) {
                await updateReceiptImage(receipt, result.assets[0].uri);
              }
            },
          },
          {
            text: 'Choose from Library',
            onPress: async () => {
              const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                quality: 0.8,
                aspect: [4, 3],
              });
              
              if (!result.canceled && result.assets[0]) {
                await updateReceiptImage(receipt, result.assets[0].uri);
              }
            },
          },
          {
            text: 'Cancel',
            style: 'cancel',
          },
        ]
      );
    } catch (error) {
      console.error('Error editing receipt image:', error);
      Alert.alert('Error', 'Failed to edit receipt image.');
    }
  };
  
  const updateReceiptImage = async (receipt: Receipt, newImageUri: string) => {
    try {
      setLoading(true);
      
      // Update receipt in database
      await DatabaseService.updateReceipt(receipt.id, {
        ...receipt,
        imageUri: newImageUri,
      });
      
      // Refresh receipts list
      await loadData();
      
      // Update selected receipt if it's the one being edited
      if (selectedReceipt && selectedReceipt.id === receipt.id) {
        setSelectedReceipt({ ...selectedReceipt, imageUri: newImageUri });
        // Clear error state for this receipt
        setImageErrors(prev => {
          const newSet = new Set(prev);
          newSet.delete(receipt.id);
          return newSet;
        });
      }
      
      Alert.alert('Success', 'Receipt image updated successfully.');
    } catch (error) {
      console.error('Error updating receipt image:', error);
      Alert.alert('Error', 'Failed to update receipt image.');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getTotalAmount = () => {
    return receipts.reduce((sum, receipt) => sum + receipt.amount, 0);
  };

  const getCategoryTotals = () => {
    return receipts.reduce((totals, receipt) => {
      totals[receipt.category] = (totals[receipt.category] || 0) + receipt.amount;
      return totals;
    }, {} as Record<string, number>);
  };

  // Get available cost centers from receipts
  const getAvailableCostCenters = () => {
    const costCenters = new Set<string>();
    allReceipts.forEach(receipt => {
      if (receipt.costCenter) {
        costCenters.add(receipt.costCenter);
      }
    });
    return Array.from(costCenters).sort();
  };

  // Count active filters
  const getActiveFilterCount = () => {
    let count = 0;
    if (filterCategory) count++;
    if (filterCostCenter) count++;
    if (filterDateStart) count++;
    if (filterDateEnd) count++;
    if (filterAmountMin) count++;
    if (filterAmountMax) count++;
    return count;
  };

  // Clear all filters
  const clearAllFilters = () => {
    setFilterCategory('');
    setFilterCostCenter('');
    setFilterDateStart(null);
    setFilterDateEnd(null);
    setFilterAmountMin('');
    setFilterAmountMax('');
  };

  const hasActiveFilters = getActiveFilterCount() > 0;

  // Multi-select functions
  const toggleMultiSelectMode = () => {
    setMultiSelectMode(!multiSelectMode);
    setSelectedReceiptIds(new Set());
  };

  const toggleReceiptSelection = (receiptId: string) => {
    const newSelectedIds = new Set(selectedReceiptIds);
    if (newSelectedIds.has(receiptId)) {
      newSelectedIds.delete(receiptId);
    } else {
      newSelectedIds.add(receiptId);
    }
    setSelectedReceiptIds(newSelectedIds);
  };

  const selectAllReceipts = () => {
    const allIds = new Set(receipts.map(receipt => receipt.id));
    setSelectedReceiptIds(allIds);
  };

  const clearSelection = () => {
    setSelectedReceiptIds(new Set());
  };

  const deleteSelectedReceipts = () => {
    if (selectedReceiptIds.size === 0) {
      Alert.alert('No Selection', 'Please select receipts to delete');
      return;
    }

    const selectedCount = selectedReceiptIds.size;
    const selectedReceipts = receipts.filter(receipt => selectedReceiptIds.has(receipt.id));
    const totalAmount = selectedReceipts.reduce((sum, receipt) => sum + receipt.amount, 0);
    
    // Build summary of what will be deleted
    const categorySummary = selectedReceipts.reduce((summary, receipt) => {
      summary[receipt.category] = (summary[receipt.category] || 0) + 1;
      return summary;
    }, {} as Record<string, number>);
    
    const categoryBreakdown = Object.entries(categorySummary)
      .map(([category, count]) => `  • ${category}: ${count} receipt${count > 1 ? 's' : ''}`)
      .join('\n');

    Alert.alert(
      'Delete Selected Receipts',
      `Are you sure you want to delete ${selectedCount} receipt${selectedCount > 1 ? 's' : ''}?\n\n` +
      `Total Amount: $${totalAmount.toFixed(2)}\n\n` +
      `Breakdown by Category:\n${categoryBreakdown}\n\n` +
      `This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              
              // Delete receipts one by one to track successes and failures
              const deleteResults = await Promise.allSettled(
                Array.from(selectedReceiptIds).map(id => DatabaseService.deleteReceipt(id))
              );
              
              const successCount = deleteResults.filter(result => result.status === 'fulfilled').length;
              const failureCount = deleteResults.filter(result => result.status === 'rejected').length;
              
              // Log any failures for debugging
              deleteResults.forEach((result, index) => {
                if (result.status === 'rejected') {
                  const receiptId = Array.from(selectedReceiptIds)[index];
                  console.error(`Failed to delete receipt ${receiptId}:`, result.reason);
                }
              });
              
              if (failureCount === 0) {
                Alert.alert(
                  'Success', 
                  `${successCount} receipt${successCount > 1 ? 's' : ''} deleted successfully`
                );
              } else if (successCount > 0) {
                Alert.alert(
                  'Partial Success',
                  `${successCount} receipt${successCount > 1 ? 's' : ''} deleted successfully.\n` +
                  `${failureCount} receipt${failureCount > 1 ? 's' : ''} could not be deleted.`
                );
              } else {
                Alert.alert(
                  'Error',
                  `Failed to delete ${failureCount} receipt${failureCount > 1 ? 's' : ''}. Please try again.`
                );
              }
              
              setMultiSelectMode(false);
              setSelectedReceiptIds(new Set());
              loadData(); // Refresh the list
            } catch (error) {
              console.error('Error deleting receipts:', error);
              Alert.alert('Error', 'Failed to delete receipts. Please try again.');
            } finally {
              setLoading(false);
            }
          },
        },
      ],
      { cancelable: true }
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading receipts...</Text>
        <StatusBar style="auto" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="auto" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <MaterialIcons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {multiSelectMode 
            ? `Select Receipts (${selectedReceiptIds.size})` 
            : `Receipts${filterCategory ? ` - ${filterCategory}` : ''} (${new Date(selectedYear, selectedMonth - 1, 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })})`}
        </Text>
        <View style={styles.headerRight}>
          {multiSelectMode && (
            <>
              <TouchableOpacity onPress={clearSelection} style={styles.headerButton}>
                <MaterialIcons name="clear" size={24} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity onPress={deleteSelectedReceipts} style={styles.headerButton}>
                <MaterialIcons name="delete" size={24} color="#fff" />
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <MaterialIcons name="search" size={20} color="#999" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search receipts by vendor, description, amount, category..."
            placeholderTextColor="#999"
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearchQuery('')}
              style={styles.clearSearchButton}
            >
              <MaterialIcons name="close" size={20} color="#999" />
            </TouchableOpacity>
          )}
        </View>

        {/* Filter Button */}
        <View style={styles.filterHeader}>
          <TouchableOpacity
            style={[styles.filterButton, hasActiveFilters && styles.filterButtonActive]}
            onPress={() => setShowFilters(!showFilters)}
          >
            <MaterialIcons 
              name={showFilters ? "filter-list" : "filter-list"} 
              size={20} 
              color={hasActiveFilters ? "#fff" : "#2196F3"} 
            />
            <Text style={[styles.filterButtonText, hasActiveFilters && styles.filterButtonTextActive]}>
              Filters {hasActiveFilters ? `(${getActiveFilterCount()})` : ''}
            </Text>
          </TouchableOpacity>
          {hasActiveFilters && (
            <TouchableOpacity
              style={styles.clearFiltersButton}
              onPress={clearAllFilters}
            >
              <MaterialIcons name="clear" size={18} color="#666" />
              <Text style={styles.clearFiltersText}>Clear</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Filters Panel */}
        {showFilters && (
          <View style={styles.filtersPanel}>
            {/* Category Filter */}
            <View style={styles.filterSection}>
              <Text style={styles.filterLabel}>Category</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterChips}>
                <TouchableOpacity
                  style={[styles.filterChip, !filterCategory && styles.filterChipActive]}
                  onPress={() => setFilterCategory('')}
                >
                  <Text style={[styles.filterChipText, !filterCategory && styles.filterChipTextActive]}>
                    All
                  </Text>
                </TouchableOpacity>
                {RECEIPT_CATEGORIES.map((category) => (
                  <TouchableOpacity
                    key={category}
                    style={[styles.filterChip, filterCategory === category && styles.filterChipActive]}
                    onPress={() => setFilterCategory(category)}
                  >
                    <Text style={[styles.filterChipText, filterCategory === category && styles.filterChipTextActive]}>
                      {category}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* Cost Center Filter */}
            {getAvailableCostCenters().length > 0 && (
              <View style={styles.filterSection}>
                <Text style={styles.filterLabel}>Cost Center</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterChips}>
                  <TouchableOpacity
                    style={[styles.filterChip, !filterCostCenter && styles.filterChipActive]}
                    onPress={() => setFilterCostCenter('')}
                  >
                    <Text style={[styles.filterChipText, !filterCostCenter && styles.filterChipTextActive]}>
                      All
                    </Text>
                  </TouchableOpacity>
                  {getAvailableCostCenters().map((costCenter) => (
                    <TouchableOpacity
                      key={costCenter}
                      style={[styles.filterChip, filterCostCenter === costCenter && styles.filterChipActive]}
                      onPress={() => setFilterCostCenter(costCenter)}
                    >
                      <Text style={[styles.filterChipText, filterCostCenter === costCenter && styles.filterChipTextActive]}>
                        {costCenter}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            {/* Date Range Filter */}
            <View style={styles.filterSection}>
              <Text style={styles.filterLabel}>Date Range</Text>
              <View style={styles.dateRangeContainer}>
                <TouchableOpacity
                  style={styles.dateButton}
                  onPress={() => setShowDateStartPicker(true)}
                >
                  <MaterialIcons name="calendar-today" size={18} color="#666" />
                  <Text style={styles.dateButtonText}>
                    {filterDateStart ? formatDate(filterDateStart) : 'Start Date'}
                  </Text>
                </TouchableOpacity>
                <Text style={styles.dateRangeSeparator}>to</Text>
                <TouchableOpacity
                  style={styles.dateButton}
                  onPress={() => setShowDateEndPicker(true)}
                >
                  <MaterialIcons name="calendar-today" size={18} color="#666" />
                  <Text style={styles.dateButtonText}>
                    {filterDateEnd ? formatDate(filterDateEnd) : 'End Date'}
                  </Text>
                </TouchableOpacity>
                {(filterDateStart || filterDateEnd) && (
                  <TouchableOpacity
                    style={styles.clearDateButton}
                    onPress={() => {
                      setFilterDateStart(null);
                      setFilterDateEnd(null);
                    }}
                  >
                    <MaterialIcons name="close" size={18} color="#666" />
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Amount Range Filter */}
            <View style={styles.filterSection}>
              <Text style={styles.filterLabel}>Amount Range</Text>
              <View style={styles.amountRangeContainer}>
                <TextInput
                  style={styles.amountInput}
                  placeholder="Min"
                  placeholderTextColor="#999"
                  value={filterAmountMin}
                  onChangeText={setFilterAmountMin}
                  keyboardType="numeric"
                />
                <Text style={styles.amountRangeSeparator}>to</Text>
                <TextInput
                  style={styles.amountInput}
                  placeholder="Max"
                  placeholderTextColor="#999"
                  value={filterAmountMax}
                  onChangeText={setFilterAmountMax}
                  keyboardType="numeric"
                />
                {(filterAmountMin || filterAmountMax) && (
                  <TouchableOpacity
                    style={styles.clearDateButton}
                    onPress={() => {
                      setFilterAmountMin('');
                      setFilterAmountMax('');
                    }}
                  >
                    <MaterialIcons name="close" size={18} color="#666" />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>
        )}

        {/* Summary Stats */}
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <MaterialIcons name="receipt" size={24} color="#4CAF50" />
            <Text style={styles.statValue}>{receipts.length}</Text>
            <Text style={styles.statLabel}>Total Receipts</Text>
          </View>
          
          <View style={styles.statCard}>
            <MaterialIcons name="attach-money" size={24} color="#FF9800" />
            <Text style={styles.statValue}>${getTotalAmount().toFixed(2)}</Text>
            <Text style={styles.statLabel}>Total Amount</Text>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtonsContainer}>
          <TouchableOpacity
            style={styles.addReceiptButton}
            onPress={() => navigation.navigate('AddReceipt')}
          >
            <MaterialIcons name="add-circle" size={24} color="#fff" />
            <Text style={styles.addReceiptButtonText}>Add Receipt</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.generateButton}
            onPress={generateMonthlyReceiptsPdf}
          >
            <MaterialIcons name="picture-as-pdf" size={24} color="#fff" />
            <Text style={styles.generateButtonText}>Generate Monthly PDF</Text>
          </TouchableOpacity>
        </View>

        {/* Category Breakdown */}
        {Object.keys(getCategoryTotals()).length > 0 && (
          <View style={styles.categoryContainer}>
            <Text style={styles.sectionTitle}>Category Breakdown</Text>
            {Object.entries(getCategoryTotals()).map(([category, amount]) => (
              <View key={category} style={styles.categoryItem}>
                <Text style={styles.categoryName}>{category}</Text>
                <Text style={styles.categoryAmount}>${amount.toFixed(2)}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Multi-select Controls */}
        {receipts.length > 0 && (
          <View style={styles.multiSelectContainer}>
            <View style={styles.multiSelectHeader}>
              <Text style={styles.sectionTitle}>All Receipts</Text>
              <TouchableOpacity
                style={styles.multiSelectButton}
                onPress={toggleMultiSelectMode}
              >
                <MaterialIcons 
                  name={multiSelectMode ? "close" : "checklist"} 
                  size={20} 
                  color="#2196F3" 
                />
                <Text style={styles.multiSelectButtonText}>
                  {multiSelectMode ? 'Cancel' : 'Select'}
                </Text>
              </TouchableOpacity>
            </View>
            
            {multiSelectMode && (
              <View style={styles.multiSelectActions}>
                <TouchableOpacity
                  style={styles.selectAllButton}
                  onPress={selectAllReceipts}
                >
                  <MaterialIcons name="select-all" size={16} color="#2196F3" />
                  <Text style={styles.selectAllButtonText}>Select All</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={styles.clearAllButton}
                  onPress={clearSelection}
                >
                  <MaterialIcons name="clear" size={16} color="#666" />
                  <Text style={styles.clearAllButtonText}>Clear All</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* Receipts List */}
        <View style={styles.receiptsContainer}>
          {!multiSelectMode && <Text style={styles.sectionTitle}>All Receipts</Text>}
          
          {receipts.length === 0 ? (
            <View style={styles.emptyState}>
              <MaterialIcons name="receipt" size={48} color="#ccc" />
              <Text style={styles.emptyStateText}>
                {hasActiveFilters || searchQuery.trim() 
                  ? 'No receipts found matching your filters' 
                  : 'No receipts added yet'}
              </Text>
              <Text style={styles.emptyStateSubtext}>
                {hasActiveFilters || searchQuery.trim() 
                  ? 'Try adjusting your filters or search terms' 
                  : 'Tap the + button to add your first receipt'}
              </Text>
            </View>
          ) : (
            receipts.map((receipt) => (
              <View key={receipt.id} style={[
                styles.receiptCard,
                multiSelectMode && selectedReceiptIds.has(receipt.id) && styles.receiptCardSelected
              ]}>
                {multiSelectMode && (
                  <TouchableOpacity
                    style={styles.checkboxContainer}
                    onPress={() => toggleReceiptSelection(receipt.id)}
                  >
                    <MaterialIcons
                      name={selectedReceiptIds.has(receipt.id) ? "check-box" : "check-box-outline-blank"}
                      size={24}
                      color={selectedReceiptIds.has(receipt.id) ? "#2196F3" : "#ccc"}
                    />
                  </TouchableOpacity>
                )}
                
                <TouchableOpacity
                  style={styles.receiptImageContainer}
                  onPress={() => multiSelectMode ? toggleReceiptSelection(receipt.id) : viewReceiptImage(receipt)}
                >
                  {imageErrors.has(receipt.id) || !receipt.imageUri ? (
                    <View style={[styles.receiptThumbnail, styles.imagePlaceholder]}>
                      <MaterialIcons name="receipt" size={30} color="#999" />
                    </View>
                  ) : (
                    <Image 
                      source={{ uri: resolveImageUri(receipt.imageUri) }} 
                      style={styles.receiptThumbnail}
                      onError={() => handleImageError(receipt.id)}
                      onLoad={() => handleImageLoad(receipt.id)}
                    />
                  )}
                  <View style={styles.imageOverlay}>
                    <MaterialIcons name="zoom-in" size={20} color="#fff" />
                  </View>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={styles.receiptInfo}
                  onPress={() => viewReceiptDetails(receipt)}
                >
                  <View style={styles.receiptHeader}>
                    <Text style={styles.receiptVendor} numberOfLines={1} ellipsizeMode="tail">
                      {receipt.vendor}
                    </Text>
                    <Text style={styles.receiptAmount}>${receipt.amount.toFixed(2)}</Text>
                  </View>
                  
                  <Text style={styles.receiptDescription}>{receipt.description}</Text>
                  
                  <View style={styles.receiptDetails}>
                    <View style={styles.categoryBadge}>
                      <Text style={styles.categoryText}>{receipt.category}</Text>
                    </View>
                    <Text style={styles.receiptDate}>{formatDate(receipt.date)}</Text>
                  </View>
                  
                  {receipt.costCenter && (
                    <View style={styles.costCenterBadge}>
                      <MaterialIcons name="business" size={14} color="#2196F3" />
                      <Text style={styles.costCenterText}>{receipt.costCenter}</Text>
                    </View>
                  )}
                </TouchableOpacity>

                {!multiSelectMode && (
                  <TouchableOpacity
                    style={styles.deleteButton}
                    onPress={() => deleteReceipt(receipt)}
                  >
                    <MaterialIcons name="delete" size={20} color="#f44336" />
                  </TouchableOpacity>
                )}
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* Image Modal */}
      <Modal
        visible={showImageModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowImageModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setShowImageModal(false)}
            >
              <MaterialIcons name="close" size={24} color="#fff" />
            </TouchableOpacity>
            
            {selectedReceipt && (
              <>
                {imageErrors.has(selectedReceipt.id) || !selectedReceipt.imageUri ? (
                  <View style={styles.imageErrorContainer}>
                    <MaterialIcons name="broken-image" size={64} color="#999" />
                    <Text style={styles.imageErrorText}>Image not available</Text>
                    <Text style={styles.imageErrorSubtext}>The receipt image may have been deleted or moved.</Text>
                  </View>
                ) : (
                  <Image
                    source={{ uri: resolveImageUri(selectedReceipt.imageUri) }}
                    style={styles.fullImage}
                    resizeMode="contain"
                    onError={() => {
                      handleImageError(selectedReceipt.id);
                      Alert.alert('Image Error', 'Failed to load receipt image. The image may have been deleted or moved.');
                    }}
                    onLoad={() => handleImageLoad(selectedReceipt.id)}
                  />
                )}
                <View style={styles.imageInfo}>
                  <Text style={styles.imageVendor}>{selectedReceipt.vendor}</Text>
                  <Text style={styles.imageAmount}>${selectedReceipt.amount.toFixed(2)}</Text>
                </View>
                <TouchableOpacity
                  style={styles.editImageButton}
                  onPress={() => handleEditReceiptImage(selectedReceipt)}
                >
                  <MaterialIcons name="edit" size={20} color="#fff" />
                  <Text style={styles.editImageButtonText}>Edit Image</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Date Picker Modals */}
      {showDateStartPicker && (
        <>
          {Platform.OS === 'ios' && (
            <Modal
              visible={showDateStartPicker}
              transparent={true}
              animationType="slide"
              onRequestClose={() => setShowDateStartPicker(false)}
            >
              <View style={styles.modalContainer}>
                <View style={styles.datePickerModalContent}>
                  <View style={styles.datePickerHeader}>
                    <Text style={styles.datePickerTitle}>Select Start Date</Text>
                    <TouchableOpacity onPress={() => setShowDateStartPicker(false)}>
                      <MaterialIcons name="close" size={24} color="#666" />
                    </TouchableOpacity>
                  </View>
                  <DateTimePicker
                    value={filterDateStart || new Date()}
                    mode="date"
                    display="spinner"
                    onChange={(event, selectedDate) => {
                      if (event.type === 'set' && selectedDate) {
                        setFilterDateStart(selectedDate);
                      }
                      setShowDateStartPicker(false);
                    }}
                  />
                </View>
              </View>
            </Modal>
          )}
          {Platform.OS === 'android' && (
            <DateTimePicker
              value={filterDateStart || new Date()}
              mode="date"
              display="default"
              onChange={(event, selectedDate) => {
                setShowDateStartPicker(false);
                if (event.type === 'set' && selectedDate) {
                  setFilterDateStart(selectedDate);
                }
              }}
            />
          )}
        </>
      )}

      {showDateEndPicker && (
        <>
          {Platform.OS === 'ios' && (
            <Modal
              visible={showDateEndPicker}
              transparent={true}
              animationType="slide"
              onRequestClose={() => setShowDateEndPicker(false)}
            >
              <View style={styles.modalContainer}>
                <View style={styles.datePickerModalContent}>
                  <View style={styles.datePickerHeader}>
                    <Text style={styles.datePickerTitle}>Select End Date</Text>
                    <TouchableOpacity onPress={() => setShowDateEndPicker(false)}>
                      <MaterialIcons name="close" size={24} color="#666" />
                    </TouchableOpacity>
                  </View>
                  <DateTimePicker
                    value={filterDateEnd || new Date()}
                    mode="date"
                    display="spinner"
                    onChange={(event, selectedDate) => {
                      if (event.type === 'set' && selectedDate) {
                        setFilterDateEnd(selectedDate);
                      }
                      setShowDateEndPicker(false);
                    }}
                  />
                </View>
              </View>
            </Modal>
          )}
          {Platform.OS === 'android' && (
            <DateTimePicker
              value={filterDateEnd || new Date()}
              mode="date"
              display="default"
              onChange={(event, selectedDate) => {
                setShowDateEndPicker(false);
                if (event.type === 'set' && selectedDate) {
                  setFilterDateEnd(selectedDate);
                }
              }}
            />
          )}
        </>
      )}

      {/* Receipt Details Modal */}
      <Modal
        visible={showDetailsModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowDetailsModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.detailsModalContent}>
            <View style={styles.detailsHeader}>
              <Text style={styles.detailsTitle}>Receipt Details</Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setShowDetailsModal(false)}
              >
                <MaterialIcons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
            
            {selectedReceipt && (
              <ScrollView style={styles.detailsContent}>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Vendor:</Text>
                  <Text style={styles.detailValue}>{selectedReceipt.vendor}</Text>
                </View>
                
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Amount:</Text>
                  <Text style={styles.detailValue}>${selectedReceipt.amount.toFixed(2)}</Text>
                </View>
                
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Category:</Text>
                  <Text style={styles.detailValue}>{selectedReceipt.category}</Text>
                </View>
                
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Cost Center:</Text>
                  <Text style={styles.detailValue}>{selectedReceipt.costCenter || 'Not assigned'}</Text>
                </View>
                
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Date:</Text>
                  <Text style={styles.detailValue}>{formatDate(selectedReceipt.date)}</Text>
                </View>
                
                {selectedReceipt.description && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Description:</Text>
                    <Text style={styles.detailValue}>{selectedReceipt.description}</Text>
                  </View>
                )}
                
                <TouchableOpacity
                  style={styles.viewImageButton}
                  onPress={() => {
                    setShowDetailsModal(false);
                    setShowImageModal(true);
                  }}
                >
                  <MaterialIcons name="image" size={20} color="#fff" />
                  <Text style={styles.viewImageButtonText}>View Receipt Image</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.viewImageButton, { backgroundColor: '#2196F3', marginTop: 10 }]}
                  onPress={() => {
                    // Navigate to edit receipt screen with the selected receipt
                    navigation.navigate('AddReceipt', { receipt: selectedReceipt, mode: 'edit' });
                    setShowDetailsModal(false);
                  }}
                >
                  <MaterialIcons name="edit" size={20} color="#fff" />
                  <Text style={styles.viewImageButtonText}>Edit Receipt</Text>
                </TouchableOpacity>
              </ScrollView>
            )}
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#ddd',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
    color: '#333',
  },
  clearSearchButton: {
    padding: 4,
    marginLeft: 8,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    marginHorizontal: 5,
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
  actionButtonsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  addReceiptButton: {
    backgroundColor: '#4CAF50',
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  addReceiptButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  generateButton: {
    backgroundColor: '#f44336',
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  generateButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  categoryContainer: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  categoryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  categoryName: {
    fontSize: 14,
    color: '#333',
  },
  categoryAmount: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#2196F3',
  },
  receiptsContainer: {
    marginBottom: 20,
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
    backgroundColor: '#fff',
    borderRadius: 12,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#666',
    marginTop: 12,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 4,
    textAlign: 'center',
  },
  receiptCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  receiptImageContainer: {
    position: 'relative',
    marginRight: 12,
  },
  receiptThumbnail: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
  },
  imageOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  receiptInfo: {
    flex: 1,
  },
  receiptHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  receiptVendor: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    flex: 1, // Allow vendor to take available space
    marginRight: 8, // Space between vendor and amount
  },
  receiptAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4CAF50',
    flexShrink: 0, // Prevent amount from shrinking
    minWidth: 70, // Ensure amount has enough space
  },
  receiptDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  receiptDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  categoryBadge: {
    backgroundColor: '#e8f5e8',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  categoryText: {
    fontSize: 12,
    color: '#4CAF50',
    fontWeight: '600',
  },
  receiptDate: {
    fontSize: 12,
    color: '#999',
  },
  deleteButton: {
    padding: 8,
    marginLeft: 8,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '90%',
    height: '80%',
    position: 'relative',
  },
  closeButton: {
    position: 'absolute',
    top: 20,
    right: 20,
    zIndex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 20,
    padding: 8,
  },
  fullImage: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
  },
  imageInfo: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 12,
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  imageVendor: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  imageAmount: {
    color: '#4CAF50',
    fontSize: 16,
    fontWeight: 'bold',
  },
  imagePlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
  },
  imageErrorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 20,
  },
  imageErrorText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#666',
    marginTop: 16,
  },
  imageErrorSubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
    textAlign: 'center',
  },
  editImageButton: {
    position: 'absolute',
    bottom: 80,
    left: 20,
    right: 20,
    backgroundColor: '#2196F3',
    padding: 12,
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  editImageButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  
  // Multi-select styles
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerButton: {
    marginLeft: 12,
  },
  multiSelectContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  multiSelectHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  multiSelectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#2196F3',
  },
  multiSelectButtonText: {
    color: '#2196F3',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 4,
  },
  multiSelectActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  selectAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: '#e3f2fd',
  },
  selectAllButtonText: {
    color: '#2196F3',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 4,
  },
  clearAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: '#f5f5f5',
  },
  clearAllButtonText: {
    color: '#666',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 4,
  },
  checkboxContainer: {
    padding: 8,
    marginRight: 8,
  },
  receiptCardSelected: {
    backgroundColor: '#e3f2fd',
    borderColor: '#2196F3',
    borderWidth: 2,
  },
  
  // Cost center badge styles
  costCenterBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  costCenterText: {
    color: '#2196F3',
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 4,
  },
  
  // Details modal styles
  detailsModalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    margin: 20,
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  detailsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  detailsTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  detailsContent: {
    padding: 20,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  detailLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
    flex: 1,
  },
  detailValue: {
    fontSize: 16,
    color: '#333',
    flex: 2,
    textAlign: 'right',
  },
  viewImageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2196F3',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginTop: 20,
  },
  viewImageButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  // Filter styles
  filterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2196F3',
    backgroundColor: '#fff',
  },
  filterButtonActive: {
    backgroundColor: '#2196F3',
    borderColor: '#2196F3',
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2196F3',
    marginLeft: 8,
  },
  filterButtonTextActive: {
    color: '#fff',
  },
  clearFiltersButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  clearFiltersText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 4,
  },
  filtersPanel: {
    backgroundColor: '#fff',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  filterSection: {
    marginBottom: 20,
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  filterChips: {
    flexDirection: 'row',
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  filterChipActive: {
    backgroundColor: '#2196F3',
    borderColor: '#2196F3',
  },
  filterChipText: {
    fontSize: 14,
    color: '#666',
  },
  filterChipTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  dateRangeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dateButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    marginRight: 8,
  },
  dateButtonText: {
    fontSize: 14,
    color: '#333',
    marginLeft: 8,
  },
  dateRangeSeparator: {
    fontSize: 14,
    color: '#666',
    marginHorizontal: 8,
  },
  clearDateButton: {
    padding: 8,
  },
  amountRangeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  amountInput: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    fontSize: 14,
    color: '#333',
    marginRight: 8,
  },
  amountRangeSeparator: {
    fontSize: 14,
    color: '#666',
    marginHorizontal: 8,
  },
  datePickerModalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
    paddingBottom: 40,
    maxHeight: '50%',
  },
  datePickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  datePickerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
});

