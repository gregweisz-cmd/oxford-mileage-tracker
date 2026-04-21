import React, { useEffect, useState, useRef } from 'react';
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
  InteractionManager,
  ActivityIndicator,
  Keyboard,
  Platform,
  BackHandler,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { MaterialIcons } from '@expo/vector-icons';
import { DatabaseService } from '../services/database';
import { Employee, Receipt } from '../types';
import UnifiedHeader from '../components/UnifiedHeader';
import * as ImagePicker from 'expo-image-picker';
import { PerDiemRulesService } from '../services/perDiemRulesService';
import { PerDiemAiService } from '../services/perDiemAiService';
import { ApiSyncService } from '../services/apiSyncService';
import { API_BASE_URL } from '../config/api';
import { setSyncMonthScope } from '../services/syncScopeService';

// Helper function to resolve image URI (handles both local files and backend URLs)
function resolveImageUri(imageUri: string | undefined | null): string {
  if (!imageUri || imageUri.trim() === '') return '';
  
  // If it's already a full URL (http/https), return as-is
  if (imageUri.startsWith('http://') || imageUri.startsWith('https://')) {
    return imageUri;
  }
  
  // If it's a data URI, return as-is
  if (imageUri.startsWith('data:')) {
    return imageUri;
  }
  
  // If it's a file:// or other local URI, return as-is
  if (imageUri.startsWith('file://') || imageUri.startsWith('content://') || imageUri.startsWith('ph://')) {
    return imageUri;
  }
  
  // Backend serves images from /uploads/ directory (not /api/uploads/)
  const baseUrl = API_BASE_URL.replace(/\/api\/?$/, '');
  
  // Handle different URI formats:
  // - "/uploads/filename.jpg" -> use as-is with baseUrl
  // - "uploads/filename.jpg" -> add leading slash  
  // - "filename.jpg" -> prepend /uploads/
  if (imageUri.startsWith('/uploads/')) {
    return `${baseUrl}${imageUri}`;
  } else if (imageUri.startsWith('uploads/')) {
    return `${baseUrl}/${imageUri}`;
  } else {
    const filename = imageUri.startsWith('/') ? imageUri.substring(1) : imageUri;
    return `${baseUrl}/uploads/${filename}`;
  }
}

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

/** Local YYYY-MM-DD so keys match PerDiemAiService.getEligibilityForMonth (no UTC shift). */
function toLocalDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Stable YYYY-MM-DD key from Date/string without timezone day-shift. */
function toDateKey(value: Date | string | undefined | null): string {
  if (!value) return '';
  if (value instanceof Date) return toLocalDateKey(value);
  const raw = String(value);
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) return `${match[1]}-${match[2]}-${match[3]}`;
  const parsed = new Date(raw);
  if (isNaN(parsed.getTime())) return '';
  return toLocalDateKey(parsed);
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
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const androidKeyboardHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Per-day eligibility: 8+ hours AND (100+ mi OR Daily Hours "out of town" checkbox) */
  const [eligibilityByDay, setEligibilityByDay] = useState<Map<string, { isEligible: boolean; reason: string }>>(new Map());
  /** True after eligibility map has been computed for the current month (avoids blocking on Android) */
  const [eligibilityReady, setEligibilityReady] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);
  const scrollToTodayPendingRef = useRef(false);
  /** Incremented so stale eligibility results are ignored if user changes month quickly */
  const eligibilityLoadGenerationRef = useRef(0);

  useEffect(() => {
    setSyncMonthScope(currentMonth.getMonth() + 1, currentMonth.getFullYear());
  }, [currentMonth]);

  /** Block Android hardware back while save is in progress (modal must stay until done). */
  useEffect(() => {
    if (!saving) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, [saving]);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, () => {
      if (Platform.OS === 'android' && androidKeyboardHideTimerRef.current != null) {
        clearTimeout(androidKeyboardHideTimerRef.current);
        androidKeyboardHideTimerRef.current = null;
      }
      setIsKeyboardVisible(true);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      if (Platform.OS === 'ios') {
        setIsKeyboardVisible(false);
        return;
      }
      if (androidKeyboardHideTimerRef.current != null) {
        clearTimeout(androidKeyboardHideTimerRef.current);
      }
      androidKeyboardHideTimerRef.current = setTimeout(() => {
        androidKeyboardHideTimerRef.current = null;
        InteractionManager.runAfterInteractions(() => {
          setIsKeyboardVisible(false);
        });
      }, 140);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
      if (androidKeyboardHideTimerRef.current != null) {
        clearTimeout(androidKeyboardHideTimerRef.current);
        androidKeyboardHideTimerRef.current = null;
      }
    };
  }, []);

  // Load when screen is focused or month changes (single path — avoids double load on mount)
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
    const loadGen = ++eligibilityLoadGenerationRef.current;
    try {
      setLoading(true);
      setEligibilityReady(false);
      setEligibilityByDay(new Map());

      const employee = await DatabaseService.getCurrentEmployee();
      if (!employee) {
        Alert.alert('Error', 'No employee data found. Please log in again.');
        setLoading(false);
        return;
      }

      setCurrentEmployee(employee);

      const costCenter = employee.defaultCostCenter || employee.selectedCostCenters?.[0] || '';
      const month = currentMonth.getMonth() + 1;
      const year = currentMonth.getFullYear();

      // Phase 1: rule + receipts only (fast — no distance API storm)
      const [rule, receipts] = await Promise.all([
        costCenter ? PerDiemRulesService.getPerDiemRule(costCenter) : Promise.resolve(null),
        DatabaseService.getReceipts(employee.id, month, year),
      ]);

      if (loadGen !== eligibilityLoadGenerationRef.current) return;

      setCurrentPerDiemRule(rule);

      const limit = (rule as any)?.monthlyLimit || 350;
      setMonthlyLimit(limit);

      const maxPerDay = (rule as any)?.maxAmount ?? 35;

      const perDiemReceipts = receipts.filter(r => r.category === 'Per Diem');
      const entriesMap = new Map<string, PerDiemEntry>();

      const daysInMonth = new Date(
        currentMonth.getFullYear(),
        currentMonth.getMonth() + 1,
        0
      ).getDate();

      for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
        const dateKey = toLocalDateKey(date);

        const existingReceipt = perDiemReceipts.find(r => toDateKey(r.date) === dateKey);

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
            amount: maxPerDay,
            isEligible: false,
          });
        }
      }

      setPerDiemEntries(entriesMap);

      const actualTotal = perDiemReceipts.reduce((sum, r) => sum + r.amount, 0);
      setMonthlyTotal(actualTotal);

      setHasUnsavedChanges(false);
      setLoading(false);

      // Phase 2: eligibility (distance lookups). Same path on iOS and Android — defer until after first paint.
      const runEligibility = () => {
        PerDiemAiService.getEligibilityForMonth(employee.id, month, year)
          .then((eligibilityMap) => {
            if (loadGen !== eligibilityLoadGenerationRef.current) return;
            setEligibilityByDay(eligibilityMap);
            setEligibilityReady(true);
          })
          .catch(() => {
            if (loadGen !== eligibilityLoadGenerationRef.current) return;
            setEligibilityReady(true);
          });
      };

      InteractionManager.runAfterInteractions(() => {
        if (loadGen !== eligibilityLoadGenerationRef.current) return;
        runEligibility();
      });
    } catch (error) {
      Alert.alert('Error', 'Failed to load per diem data. Please try again.');
      if (__DEV__) {
        console.error('PerDiemScreen: Error loading data:', error);
      }
      setLoading(false);
      setEligibilityReady(true);
    }
  };

  const handleToggleEligible = (dateKey: string) => {
    if (saving) return;
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
    if (saving) return;
    const entry = perDiemEntries.get(dateKey);
    if (!entry || !entry.isEligible) return;
    
    const numAmount = parseFloat(amount) || 0;
    
    // Check if new amount would exceed monthly limit
    const currentTotal = Array.from(perDiemEntries.values())
      .filter(e => e.isEligible && toLocalDateKey(e.date) !== dateKey)
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
    if (saving) return;
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

      navigation.navigate('Home');
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
        newMap.set(toLocalDateKey(entry.date), updatedEntry);
        setPerDiemEntries(newMap);
      } else {
        // Entry is eligible - create or update receipt
        // Check if receipt already exists for this date
        const receipts = await DatabaseService.getReceipts(
          currentEmployee.id,
          entry.date.getMonth() + 1,
          entry.date.getFullYear()
        );
        const targetDateKey = toLocalDateKey(entry.date);
        const existingReceipt = receipts.find(r => {
          if (r.category !== 'Per Diem') return false;
          return toDateKey(r.date) === targetDateKey;
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
          newMap.set(toLocalDateKey(entry.date), updatedEntry);
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
          newMap.set(toLocalDateKey(entry.date), updatedEntry);
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

  const formatWeekday = (date: Date) => {
    return date.toLocaleDateString('en-US', { weekday: 'long' });
  };

  const isViewingCurrentMonth =
    currentMonth.getMonth() === new Date().getMonth() &&
    currentMonth.getFullYear() === new Date().getFullYear();

  const scrollToToday = () => {
    const now = new Date();
    if (!isViewingCurrentMonth) {
      setCurrentMonth(new Date(now.getFullYear(), now.getMonth(), 1));
      scrollToTodayPendingRef.current = true;
      return;
    }
    const dayIndex = now.getDate() - 1;
    const estimatedRowHeight = 100;
    scrollViewRef.current?.scrollTo({
      y: Math.max(0, dayIndex * estimatedRowHeight),
      animated: true,
    });
  };

  useEffect(() => {
    if (!scrollToTodayPendingRef.current || loading) return;
    const now = new Date();
    const isCurrent =
      currentMonth.getMonth() === now.getMonth() &&
      currentMonth.getFullYear() === now.getFullYear();
    if (!isCurrent) return;
    scrollToTodayPendingRef.current = false;
    const dayIndex = now.getDate() - 1;
    const id = setTimeout(() => {
      scrollViewRef.current?.scrollTo({
        y: Math.max(0, dayIndex * 100),
        animated: true,
      });
    }, 200);
    return () => clearTimeout(id);
  }, [loading, currentMonth]);

  if (loading) {
    return (
      <View style={styles.container}>
        <UnifiedHeader
          title="Per Diem"
          showBackButton
          onBackPress={() => navigation.goBack()}
          onHomePress={() => navigation.navigate('Home')}
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
    const dateKey = toLocalDateKey(date);
    return { day, date, dateKey, entry: perDiemEntries.get(dateKey) };
  });

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      
      <UnifiedHeader
        title="Per Diem"
        showBackButton
        onBackPress={() => navigation.goBack()}
        onHomePress={() => navigation.navigate('Home')}
      />

      {/* Month Navigation */}
      <View style={styles.monthNavigation}>
        <TouchableOpacity onPress={() => navigateMonth('prev')} style={styles.navButton}>
          <MaterialIcons name="chevron-left" size={24} color="#007AFF" />
        </TouchableOpacity>
        <Text style={styles.monthTitle}>{getMonthName(currentMonth)}</Text>
        <View style={styles.monthActionsRow}>
          <TouchableOpacity onPress={scrollToToday} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 6, paddingHorizontal: 10, backgroundColor: '#007AFF', borderRadius: 8 }}>
            <MaterialIcons name="today" size={18} color="#fff" style={{ marginRight: 6 }} />
            <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>Go to today</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigateMonth('next')} style={[styles.navButton, styles.navButtonNext]}>
            <MaterialIcons name="chevron-right" size={24} color="#007AFF" />
          </TouchableOpacity>
        </View>
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
        {!eligibilityReady && !loading && (
          <View style={styles.eligibilityBanner}>
            <ActivityIndicator size="small" color="#007AFF" />
            <Text style={styles.eligibilityBannerText}>Calculating day eligibility (hours, miles, distance)…</Text>
          </View>
        )}
      </View>

      {/* Days List */}
      <ScrollView
        ref={scrollViewRef}
        style={styles.daysList}
        contentContainerStyle={{
          paddingBottom: hasUnsavedChanges && !isKeyboardVisible ? 100 : 24,
        }}
        showsVerticalScrollIndicator={false}
      >
        {daysArray.map(({ day, date, dateKey, entry }) => {
          const perDiemEntry = entry || {
            date,
            amount: currentPerDiemRule?.maxAmount || 35,
            isEligible: false,
          };
          const dayEligibility = eligibilityByDay.get(dateKey);
          const isEligibleByRule = dayEligibility?.isEligible ?? false;
          
          return (
            <View key={dateKey} style={styles.dayCard}>
              <View style={styles.dayHeader}>
                <View>
                  <Text style={styles.dayDate}>{formatDate(date)}</Text>
                  <Text style={styles.dayWeekday}>{formatWeekday(date)}</Text>
                  <Text style={[styles.eligibilityLabel, !eligibilityReady ? styles.eligibilityLabelPending : (isEligibleByRule ? styles.eligibilityLabelEligible : styles.eligibilityLabelNotEligible)]}>
                    {!eligibilityReady ? '…' : (isEligibleByRule ? 'Eligible' : 'Not eligible')}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.checkbox}
                  onPress={() => handleToggleEligible(dateKey)}
                  disabled={saving}
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
                      editable={!saving}
                    />
                  </View>
                  
                  <View style={styles.imageRow}>
                    {perDiemEntry.imageUri ? (
                      <View style={styles.imageContainer}>
                        <Image source={{ uri: resolveImageUri(perDiemEntry.imageUri) }} style={styles.image} />
                        <TouchableOpacity
                          style={styles.deleteImageButton}
                          onPress={() => handleDeletePerDiem(dateKey)}
                          disabled={saving}
                        >
                          <MaterialIcons name="delete" size={20} color="#FF3B30" />
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={styles.addImageButton}
                        onPress={() => handleImagePicker(dateKey)}
                        disabled={saving}
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

      {/* Floating Save Button — always visible when unsaved (not hidden at list bottom). */}
      {hasUnsavedChanges && !isKeyboardVisible && (
        <View style={styles.saveButtonContainer} pointerEvents="box-none">
          <TouchableOpacity
            style={[styles.saveButton, saving && styles.saveButtonDisabled]}
            onPress={handleSaveAll}
            disabled={saving}
          >
            <MaterialIcons name="save" size={20} color="#fff" style={styles.saveButtonIcon} />
            <Text style={styles.saveButtonText}>
              {saving ? 'Saving...' : 'Save'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Blocks all interaction while save runs; prevents taps that loadData would wipe. */}
      <Modal visible={saving} transparent animationType="fade" statusBarTranslucent>
        <View style={styles.savingOverlay} pointerEvents="auto">
          <View style={styles.savingCard}>
            <ActivityIndicator size="large" color="#007AFF" />
            <Text style={styles.savingTitle}>Saving per diem</Text>
            <Text style={styles.savingSubtitle}>Please wait — do not leave this screen.</Text>
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
  navButtonNext: {
    marginLeft: 8,
  },
  monthActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  monthTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
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
  dayWeekday: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  eligibilityLabel: {
    fontSize: 12,
    marginTop: 2,
  },
  eligibilityLabelEligible: {
    color: '#2E7D32',
    fontWeight: '600',
  },
  eligibilityLabelNotEligible: {
    color: '#666',
  },
  eligibilityLabelPending: {
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
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
  eligibilityBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e0e0e0',
  },
  eligibilityBannerText: {
    flex: 1,
    marginLeft: 10,
    fontSize: 13,
    color: '#666',
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
    minWidth: 200,
  },
  saveButtonIcon: {
    marginRight: 8,
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
  savingOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  savingCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 28,
    paddingHorizontal: 24,
    alignItems: 'center',
    minWidth: 260,
    maxWidth: '90%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  savingTitle: {
    marginTop: 16,
    fontSize: 17,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
  },
  savingSubtitle: {
    marginTop: 8,
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
});
