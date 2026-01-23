import React, { useState, useEffect } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Modal,
  Image,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { MaterialIcons } from '@expo/vector-icons';
import { DatabaseService } from '../services/database';
import { Employee, Receipt } from '../types';
import UnifiedHeader from '../components/UnifiedHeader';
import * as ImagePicker from 'expo-image-picker';
import { PerDiemRulesService } from '../services/perDiemRulesService';
import { PerDiemAiService, PerDiemEligibility } from '../services/perDiemAiService';
import { PerDiemDashboardService } from '../services/perDiemDashboardService';
import { ApiSyncService } from '../services/apiSyncService';

interface PerDiemScreenProps {
  navigation: any;
}

interface PerDiemEntry {
  date: Date;
  amount: number;
  isEligible: boolean;
  receiptId?: string;
  imageUri?: string;
}

/**
 * Per Diem Screen Component
 * 
 * Dedicated screen for managing per diem entries with:
 * - Monthly per diem limit tracking
 * - Day-by-day eligibility selection
 * - Amount entry with limit enforcement
 * - Optional receipt attachment
 * - Monthly summary with progress bar
 * - Navigation to add receipt screen
 */
export default function PerDiemScreen({ navigation }: PerDiemScreenProps) {
  const [currentEmployee, setCurrentEmployee] = useState<Employee | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [perDiemEntries, setPerDiemEntries] = useState<Map<string, PerDiemEntry>>(new Map());
  const [loading, setLoading] = useState(true);
  const [currentPerDiemRule, setCurrentPerDiemRule] = useState<any>(null);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [showImagePicker, setShowImagePicker] = useState(false);
  const [monthlyTotal, setMonthlyTotal] = useState(0);
  const [monthlyLimit, setMonthlyLimit] = useState(350);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [saving, setSaving] = useState(false);

  // Reload data when month changes
  useEffect(() => {
    loadData();
  }, [currentMonth]);
  
  // Reload data when screen comes into focus (to sync with dashboard)
  useFocusEffect(
    React.useCallback(() => {
      loadData();
    }, [currentMonth])
  );

  /**
   * Loads per diem data for the current month including:
   * - Employee information
   * - Per diem rules and limits
   * - Existing per diem entries
   * - Monthly totals and statistics
   */
  const loadData = async () => {
    try {
      setLoading(true);
      
      const employee = await DatabaseService.getCurrentEmployee();
      if (!employee) {
        Alert.alert('Error', 'No employee data found. Please log in again.');
        setLoading(false);
        return;
      }
      
      setCurrentEmployee(employee);
      
      // Load per diem rule
      const costCenter = employee.defaultCostCenter || employee.selectedCostCenters?.[0] || '';
      let rule = null;
      if (costCenter) {
        rule = await PerDiemRulesService.getPerDiemRule(costCenter);
        setCurrentPerDiemRule(rule);
      }
      
      // Get monthly stats
      const stats = await PerDiemDashboardService.getPerDiemStats(
        employee,
        currentMonth.getMonth() + 1,
        currentMonth.getFullYear()
      );
      setMonthlyTotal(stats.currentMonthTotal);
      setMonthlyLimit(stats.monthlyLimit);
      
      // Load existing per diem receipts for the month
      const receipts = await DatabaseService.getReceipts(
        employee.id,
        currentMonth.getMonth() + 1,
        currentMonth.getFullYear()
      );
      
      const perDiemReceipts = receipts.filter(r => r.category === 'Per Diem');
      const entriesMap = new Map<string, PerDiemEntry>();
      
      // Initialize all days of the month
      const daysInMonth = new Date(
        currentMonth.getFullYear(),
        currentMonth.getMonth() + 1,
        0
      ).getDate();
      
      for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
        const dateKey = date.toISOString().split('T')[0];
        
        // Find existing per diem receipt for this day
        const existingReceipt = perDiemReceipts.find(r => {
          const receiptDate = new Date(r.date);
          return receiptDate.getDate() === day &&
                 receiptDate.getMonth() === currentMonth.getMonth() &&
                 receiptDate.getFullYear() === currentMonth.getFullYear();
        });
        
        if (existingReceipt) {
          entriesMap.set(dateKey, {
            date,
            amount: existingReceipt.amount,
            isEligible: true,
            receiptId: existingReceipt.id,
            imageUri: existingReceipt.imageUri || undefined,
          });
        } else {
          entriesMap.set(dateKey, {
            date,
            amount: currentPerDiemRule?.maxAmount || 35,
            isEligible: false,
          });
        }
      }
      
      setPerDiemEntries(entriesMap);
      
      // Recalculate monthly total from actual receipts (not from entries map)
      // This ensures consistency with dashboard
      const actualTotal = perDiemReceipts.reduce((sum, r) => sum + r.amount, 0);
      setMonthlyTotal(actualTotal);
      
      // Reset unsaved changes flag when data is loaded
      setHasUnsavedChanges(false);
      
    } catch (error) {
      Alert.alert('Error', 'Failed to load per diem data. Please try again.');
      if (__DEV__) {
        console.error('PerDiemScreen: Error loading data:', error);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleToggleEligible = (dateKey: string) => {
    const entry = perDiemEntries.get(dateKey);
    if (!entry) return;
    
    // If enabling, check if we would exceed monthly limit (based on current state)
    if (!entry.isEligible) {
      const currentTotal = Array.from(perDiemEntries.values())
        .filter(e => e.isEligible)
        .reduce((sum, e) => sum + e.amount, 0);
      
      const newTotal = currentTotal + entry.amount;
      if (newTotal > monthlyLimit) {
        Alert.alert(
          'Monthly Limit Reached',
          `Adding this day would exceed your monthly per diem limit of $${monthlyLimit}. You have $${(monthlyLimit - currentTotal).toFixed(2)} remaining.`,
          [{ text: 'OK' }]
        );
        return;
      }
    }
    
    const updatedEntry = {
      ...entry,
      isEligible: !entry.isEligible,
    };
    
    // Update state immediately for responsive UI (no save yet)
    const newMap = new Map(perDiemEntries);
    newMap.set(dateKey, updatedEntry);
    setPerDiemEntries(newMap);
    setHasUnsavedChanges(true);
    
    // Update monthly total preview (not from database, just from state)
    const previewTotal = Array.from(newMap.values())
      .filter(e => e.isEligible)
      .reduce((sum, e) => sum + e.amount, 0);
    setMonthlyTotal(previewTotal);
  };

  const handleAmountChange = (dateKey: string, amount: string) => {
    const entry = perDiemEntries.get(dateKey);
    if (!entry || !entry.isEligible) return;
    
    const numAmount = parseFloat(amount) || 0;
    
    // Check if new amount would exceed monthly limit
    const currentTotal = Array.from(perDiemEntries.values())
      .filter(e => e.isEligible && e.date.toISOString().split('T')[0] !== dateKey)
      .reduce((sum, e) => sum + e.amount, 0);
    
    const newTotal = currentTotal + numAmount;
    if (newTotal > monthlyLimit) {
      Alert.alert(
        'Monthly Limit Exceeded',
        `This amount would exceed your monthly per diem limit of $${monthlyLimit}. Maximum allowed: $${(monthlyLimit - currentTotal).toFixed(2)}`,
        [{ text: 'OK' }]
      );
      return;
    }
    
    const updatedEntry = {
      ...entry,
      amount: numAmount,
    };
    
    const newMap = new Map(perDiemEntries);
    newMap.set(dateKey, updatedEntry);
    setPerDiemEntries(newMap);
    setHasUnsavedChanges(true);
    
    // Update monthly total preview (not from database, just from state)
    const previewTotal = Array.from(newMap.values())
      .filter(e => e.isEligible)
      .reduce((sum, e) => sum + e.amount, 0);
    setMonthlyTotal(previewTotal);
  };

  const handleImagePicker = async (dateKey: string) => {
    setSelectedDay(perDiemEntries.get(dateKey)?.date || null);
    
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Please grant permission to access photos.');
      return;
    }
    
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });
    
    if (!result.canceled && result.assets[0]) {
      const entry = perDiemEntries.get(dateKey);
      if (!entry) return;
      
      const updatedEntry = {
        ...entry,
        imageUri: result.assets[0].uri,
      };
      
      const newMap = new Map(perDiemEntries);
      newMap.set(dateKey, updatedEntry);
      setPerDiemEntries(newMap);
      setHasUnsavedChanges(true);
      
      // Note: Image will be saved when user clicks Save button
    }
  };

  const handleSaveAll = async () => {
    if (!currentEmployee || !hasUnsavedChanges) return;
    
    try {
      setSaving(true);
      
      // Save all entries (only eligible ones will create/update receipts)
      const entriesToSave = Array.from(perDiemEntries.values());
      
      for (const entry of entriesToSave) {
        // Only save if eligible (creates/updates receipt) or if not eligible but has receiptId (needs deletion)
        if (entry.isEligible || entry.receiptId) {
          await savePerDiemEntry(entry, entry.imageUri);
        }
      }
      
      // Sync all receipts to backend at once
      const allReceipts = await DatabaseService.getReceipts(
        currentEmployee.id,
        currentMonth.getMonth() + 1,
        currentMonth.getFullYear()
      );
      const perDiemReceipts = allReceipts.filter(r => r.category === 'Per Diem');
      await ApiSyncService.syncToBackend({ receipts: perDiemReceipts });
      
      // Recalculate monthly total from actual receipts
      const newTotal = perDiemReceipts.reduce((sum, r) => sum + r.amount, 0);
      setMonthlyTotal(newTotal);
      
      // Reload data to ensure sync and reset unsaved changes flag
      await loadData();
      
      Alert.alert('Success', 'Per diem entries saved successfully');
      
    } catch (error) {
      Alert.alert('Error', 'Failed to save per diem entries. Please try again.');
      if (__DEV__) {
        console.error('Error saving all per diem entries:', error);
      }
    } finally {
      setSaving(false);
    }
  };

  const savePerDiemEntry = async (entry: PerDiemEntry, imageUri?: string) => {
    if (!currentEmployee) return;
    
    try {
      // If entry is not eligible, delete the receipt if it exists
      if (!entry.isEligible) {
        if (entry.receiptId) {
          await DatabaseService.deleteReceipt(entry.receiptId);
        }
        
        // Update the entry to ensure it's marked as not eligible and remove receiptId
        const newMap = new Map(perDiemEntries);
        const updatedEntry = {
          ...entry,
          isEligible: false,
          receiptId: undefined,
          imageUri: undefined,
        };
        newMap.set(entry.date.toISOString().split('T')[0], updatedEntry);
        setPerDiemEntries(newMap);
      } else {
        // Entry is eligible - create or update receipt
        // Check if receipt already exists for this date
        const receipts = await DatabaseService.getReceipts(
          currentEmployee.id,
          entry.date.getMonth() + 1,
          entry.date.getFullYear()
        );
        const existingReceipt = receipts.find(r => {
          if (r.category !== 'Per Diem') return false;
          const receiptDate = new Date(r.date);
          return receiptDate.getDate() === entry.date.getDate() &&
                 receiptDate.getMonth() === entry.date.getMonth() &&
                 receiptDate.getFullYear() === entry.date.getFullYear();
        });
        
        if (existingReceipt) {
          // Update existing receipt
          await DatabaseService.updateReceipt(existingReceipt.id, {
            amount: entry.amount,
            date: entry.date,
            imageUri: imageUri || entry.imageUri || existingReceipt.imageUri,
          });
          
          // Update entry with receiptId
          const newMap = new Map(perDiemEntries);
          const updatedEntry = {
            ...entry,
            receiptId: existingReceipt.id,
            imageUri: imageUri || entry.imageUri || existingReceipt.imageUri,
          };
          newMap.set(entry.date.toISOString().split('T')[0], updatedEntry);
          setPerDiemEntries(newMap);
        } else {
          // Create new receipt
          const receipt: Omit<Receipt, 'id' | 'createdAt' | 'updatedAt'> = {
            employeeId: currentEmployee.id,
            date: entry.date,
            amount: entry.amount,
            vendor: 'Per Diem',
            category: 'Per Diem',
            description: 'Per Diem',
            imageUri: imageUri || entry.imageUri || '',
          };
          
          const newReceipt = await DatabaseService.createReceipt(receipt);
          
          // Update entry with new receiptId
          const newMap = new Map(perDiemEntries);
          const updatedEntry = {
            ...entry,
            receiptId: newReceipt.id,
            imageUri: imageUri || entry.imageUri || '',
          };
          newMap.set(entry.date.toISOString().split('T')[0], updatedEntry);
          setPerDiemEntries(newMap);
        }
      }
      
      // Sync to backend
      const allReceipts = await DatabaseService.getReceipts(
        currentEmployee.id,
        entry.date.getMonth() + 1,
        entry.date.getFullYear()
      );
      const perDiemReceipts = allReceipts.filter(r => r.category === 'Per Diem');
      await ApiSyncService.syncToBackend({ receipts: perDiemReceipts });
      
      // Recalculate monthly total from actual receipts
      const newTotal = perDiemReceipts.reduce((sum, r) => sum + r.amount, 0);
      setMonthlyTotal(newTotal);
      
    } catch (error) {
      Alert.alert('Error', 'Failed to save per diem entry');
      if (__DEV__) {
        console.error('Error saving per diem entry:', error);
      }
    }
  };

  const handleDeletePerDiem = async (dateKey: string) => {
    const entry = perDiemEntries.get(dateKey);
    if (!entry || !entry.receiptId) return;
    
    Alert.alert(
      'Delete Per Diem',
      'Are you sure you want to delete this per diem entry?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await DatabaseService.deleteReceipt(entry.receiptId!);
              
              const newMap = new Map(perDiemEntries);
              const updatedEntry = {
                ...entry,
                isEligible: false,
                receiptId: undefined,
                imageUri: undefined,
              };
              newMap.set(dateKey, updatedEntry);
              setPerDiemEntries(newMap);
              
              // Sync to backend
              const receipts = await DatabaseService.getReceipts(
                currentEmployee!.id,
                entry.date.getMonth() + 1,
                entry.date.getFullYear()
              );
              await ApiSyncService.syncToBackend({ receipts });
              
              // Recalculate monthly total from actual receipts
              const perDiemReceipts = receipts.filter(r => r.category === 'Per Diem');
              const newTotal = perDiemReceipts.reduce((sum, r) => sum + r.amount, 0);
              setMonthlyTotal(newTotal);
              
              // Reload data to ensure sync
              await loadData();
              
            } catch (error) {
              Alert.alert('Error', 'Failed to delete per diem entry');
              if (__DEV__) {
                console.error('Error deleting per diem:', error);
              }
            }
          }
        }
      ]
    );
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

  const formatDate = (date: Date) => {
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const year = date.getFullYear().toString().slice(-2);
    return `${month}/${day}/${year}`;
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <UnifiedHeader
          title="Per Diem"
          showBackButton
          onBackPress={() => navigation.goBack()}
        />
        <View style={styles.loadingContainer}>
          <Text>Loading...</Text>
        </View>
      </View>
    );
  }

  const daysInMonth = new Date(
    currentMonth.getFullYear(),
    currentMonth.getMonth() + 1,
    0
  ).getDate();

  const daysArray = Array.from({ length: daysInMonth }, (_, i) => {
    const day = i + 1;
    const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
    const dateKey = date.toISOString().split('T')[0];
    return { day, date, dateKey, entry: perDiemEntries.get(dateKey) };
  });

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      
      <UnifiedHeader
        title="Per Diem"
        showBackButton
        onBackPress={() => navigation.goBack()}
      />

      {/* Month Navigation */}
      <View style={styles.monthNavigation}>
        <TouchableOpacity onPress={() => navigateMonth('prev')} style={styles.navButton}>
          <MaterialIcons name="chevron-left" size={24} color="#007AFF" />
        </TouchableOpacity>
        <Text style={styles.monthTitle}>{getMonthName(currentMonth)}</Text>
        <TouchableOpacity onPress={() => navigateMonth('next')} style={styles.navButton}>
          <MaterialIcons name="chevron-right" size={24} color="#007AFF" />
        </TouchableOpacity>
      </View>

      {/* Monthly Summary */}
      <View style={styles.summaryContainer}>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Monthly Total:</Text>
          <Text style={[styles.summaryAmount, monthlyTotal >= monthlyLimit && styles.summaryAmountWarning]}>
            ${monthlyTotal.toFixed(2)} / ${monthlyLimit.toFixed(2)}
          </Text>
        </View>
        <View style={styles.progressBarContainer}>
          <View style={styles.progressBarBackground}>
            <View 
              style={[
                styles.progressBarFill,
                {
                  width: `${Math.min((monthlyTotal / monthlyLimit) * 100, 100)}%`,
                  backgroundColor: monthlyTotal >= monthlyLimit ? '#f44336' : 
                                   monthlyTotal >= monthlyLimit * 0.85 ? '#FF9800' : '#4CAF50'
                }
              ]}
            />
          </View>
        </View>
        <Text style={styles.summaryRemaining}>
          Remaining: ${Math.max(0, monthlyLimit - monthlyTotal).toFixed(2)}
        </Text>
      </View>

      {/* Add Receipt Button */}
      <View style={styles.addReceiptContainer}>
        <TouchableOpacity
          style={styles.addReceiptButton}
          onPress={() => {
            navigation.navigate('Receipts', {
              filterCategory: 'Per Diem',
              selectedMonth: currentMonth.getMonth() + 1,
              selectedYear: currentMonth.getFullYear()
            });
          }}
        >
          <MaterialIcons name="receipt" size={20} color="#fff" />
          <Text style={styles.addReceiptText}>Add Receipt</Text>
        </TouchableOpacity>
      </View>

      {/* Per Diem Rules Reminder */}
      {currentPerDiemRule && (
        <View style={styles.rulesContainer}>
          <Text style={styles.rulesTitle}>Per Diem Rules</Text>
          <Text style={styles.rulesText}>
            • Amount: ${currentPerDiemRule.maxAmount}
            {currentPerDiemRule.minHours > 0 && ` • Min Hours: ${currentPerDiemRule.minHours}`}
            {currentPerDiemRule.minMiles > 0 && ` • Min Miles: ${currentPerDiemRule.minMiles}`}
            {currentPerDiemRule.minDistanceFromBase > 0 && ` • Min Distance from BA: ${currentPerDiemRule.minDistanceFromBase} mi`}
          </Text>
          <Text style={styles.rulesNote}>
            Note: Receipt photo is optional for per diem entries.
          </Text>
        </View>
      )}

      {/* Days List */}
      <ScrollView style={styles.daysList} showsVerticalScrollIndicator={false}>
        {daysArray.map(({ day, date, dateKey, entry }) => {
          const perDiemEntry = entry || {
            date,
            amount: currentPerDiemRule?.maxAmount || 35,
            isEligible: false,
          };
          
          return (
            <View key={dateKey} style={styles.dayCard}>
              <View style={styles.dayHeader}>
                <Text style={styles.dayDate}>{formatDate(date)}</Text>
                <TouchableOpacity
                  style={styles.checkbox}
                  onPress={() => handleToggleEligible(dateKey)}
                >
                  {perDiemEntry.isEligible && (
                    <MaterialIcons name="check" size={20} color="#007AFF" />
                  )}
                </TouchableOpacity>
              </View>
              
              {perDiemEntry.isEligible && (
                <View style={styles.dayContent}>
                  <View style={styles.amountRow}>
                    <Text style={styles.amountLabel}>Amount ($)</Text>
                    <TextInput
                      style={styles.amountInput}
                      value={perDiemEntry.amount.toString()}
                      onChangeText={(text) => handleAmountChange(dateKey, text)}
                      keyboardType="numeric"
                    />
                  </View>
                  
                  <View style={styles.imageRow}>
                    {perDiemEntry.imageUri ? (
                      <View style={styles.imageContainer}>
                        <Image source={{ uri: perDiemEntry.imageUri }} style={styles.image} />
                        <TouchableOpacity
                          style={styles.deleteImageButton}
                          onPress={() => handleDeletePerDiem(dateKey)}
                        >
                          <MaterialIcons name="delete" size={20} color="#FF3B30" />
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={styles.addImageButton}
                        onPress={() => handleImagePicker(dateKey)}
                      >
                        <MaterialIcons name="add-photo-alternate" size={24} color="#007AFF" />
                        <Text style={styles.addImageText}>Add Receipt (Optional)</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>

      {/* Floating Save Button */}
      {hasUnsavedChanges && (
        <View style={styles.saveButtonContainer}>
          <TouchableOpacity
            style={[styles.saveButton, saving && styles.saveButtonDisabled]}
            onPress={handleSaveAll}
            disabled={saving}
          >
            <MaterialIcons name="save" size={20} color="#fff" />
            <Text style={styles.saveButtonText}>
              {saving ? 'Saving...' : 'Save Changes'}
            </Text>
          </TouchableOpacity>
        </View>
      )}
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
  rulesContainer: {
    backgroundColor: '#E3F2FD',
    padding: 16,
    margin: 16,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3',
  },
  rulesTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1976D2',
    marginBottom: 8,
  },
  rulesText: {
    fontSize: 14,
    color: '#333',
    marginBottom: 8,
  },
  rulesNote: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
  },
  daysList: {
    flex: 1,
    padding: 16,
  },
  dayCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  dayDate: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: '#007AFF',
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayContent: {
    marginTop: 8,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  amountLabel: {
    fontSize: 14,
    color: '#666',
  },
  amountInput: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 16,
    minWidth: 100,
    textAlign: 'right',
  },
  imageRow: {
    marginTop: 8,
  },
  imageContainer: {
    position: 'relative',
  },
  image: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    resizeMode: 'cover',
  },
  deleteImageButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 20,
    padding: 8,
  },
  addImageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#007AFF',
    borderStyle: 'dashed',
    borderRadius: 8,
    padding: 16,
  },
  addImageText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#007AFF',
  },
  summaryContainer: {
    backgroundColor: '#fff',
    padding: 16,
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  summaryLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  summaryAmount: {
    fontSize: 18,
    fontWeight: '700',
    color: '#4CAF50',
  },
  summaryAmountWarning: {
    color: '#f44336',
  },
  progressBarContainer: {
    marginBottom: 8,
  },
  progressBarBackground: {
    height: 8,
    backgroundColor: '#e0e0e0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  summaryRemaining: {
    fontSize: 14,
    color: '#666',
    textAlign: 'right',
  },
  addReceiptContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  addReceiptButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    gap: 8,
  },
  addReceiptText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  saveButtonContainer: {
    position: 'absolute',
    bottom: 20,
    left: 16,
    right: 16,
    alignItems: 'center',
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#007AFF',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    gap: 8,
    minWidth: 200,
  },
  saveButtonDisabled: {
    backgroundColor: '#999',
    opacity: 0.7,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
