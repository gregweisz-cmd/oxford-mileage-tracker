import React, { useState, useEffect, useRef } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
  Platform,
  Linking,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { MaterialIcons } from '@expo/vector-icons';
import { DatabaseService } from '../services/database';
import { DashboardService } from '../services/dashboardService';
import { PerDiemService } from '../services/perDiemService';
import { PerDiemDashboardService } from '../services/perDiemDashboardService';
import { PreferencesService } from '../services/preferencesService';
import { DemoDataService } from '../services/demoDataService';
import { PermissionService } from '../services/permissionService';
import RealtimeSyncService from '../services/realtimeSyncService';
import { SyncIntegrationService } from '../services/syncIntegrationService';
import { MileageEntry, Employee, Receipt } from '../types';
import { formatLocationRoute } from '../utils/locationFormatter';
import { API_BASE_URL } from '../config/api';
import { debugWarn } from '../config/debug';
import UnifiedHeader from '../components/UnifiedHeader';
import CostCenterSelector from '../components/CostCenterSelector';
import PerDiemWidget from '../components/PerDiemWidget';
import DashboardTile, { TileConfig } from '../components/DashboardTile';
import LogoutService from '../services/logoutService';
import { useTheme } from '../contexts/ThemeContext';
import { BaseAddressDetectionService } from '../services/baseAddressDetectionService';
import { CostCenterImportService } from '../services/costCenterImportService';
import { SmartNotificationService, SmartNotification } from '../services/smartNotificationService';
import { DistanceService } from '../services/distanceService';
import * as Location from 'expo-location';

interface HomeScreenProps {
  navigation: any;
  route?: {
    params?: {
      currentEmployeeId?: string;
    };
  };
}

// Module-level variable to prevent concurrent syncs
let homeScreenIsSyncing = false;

function HomeScreen({ navigation, route }: HomeScreenProps) {
  const { colors } = useTheme();
  const [recentEntries, setRecentEntries] = useState<MileageEntry[]>([]);
  const [recentReceipts, setRecentReceipts] = useState<Receipt[]>([]);
  const [currentEmployee, setCurrentEmployee] = useState<Employee | null>(null);
  const [totalMilesThisMonth, setTotalMilesThisMonth] = useState(0);
  const [totalReceiptsThisMonth, setTotalReceiptsThisMonth] = useState(0);
  const [perDiemThisMonth, setPerDiemThisMonth] = useState(0);
  const [totalExpensesThisMonth, setTotalExpensesThisMonth] = useState(0);
  const [totalHoursThisMonth, setTotalHoursThisMonth] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showBaseAddressModal, setShowBaseAddressModal] = useState(false);
  const [baseAddressInput, setBaseAddressInput] = useState('');
  const [showCostCenterSelector, setShowCostCenterSelector] = useState(false);
  const [showCostCentersModal, setShowCostCentersModal] = useState(false);
  const [selectedCostCenters, setSelectedCostCenters] = useState<string[]>([]);
  const [defaultCostCenter, setDefaultCostCenter] = useState<string>('');
  const [importingCostCenters, setImportingCostCenters] = useState(false);
  const [costCenterSearchText, setCostCenterSearchText] = useState<string>('');
  // Permission checks removed - mobile app is staff-only, admin functions in web portal
  // const [hasAdminPermissions, setHasAdminPermissions] = useState(false);
  // const [hasTeamDashboardPermissions, setHasTeamDashboardPermissions] = useState(false);
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [selectedMileageEntries, setSelectedMileageEntries] = useState<string[]>([]);
  const [selectedReceipts, setSelectedReceipts] = useState<string[]>([]);
  const [viewingEmployee, setViewingEmployee] = useState<Employee | null>(null);
  const [availableEmployees, setAvailableEmployees] = useState<Employee[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [perDiemStats, setPerDiemStats] = useState<any>(null);
  const [isEditingTiles, setIsEditingTiles] = useState(false);
  const [dashboardTiles, setDashboardTiles] = useState<TileConfig[]>([]);
  
  // Month/Year selector state
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [showMonthYearModal, setShowMonthYearModal] = useState(false);
  
  // Smart notifications state
  const [smartNotifications, setSmartNotifications] = useState<SmartNotification[]>([]);
  const [dismissedNotifications, setDismissedNotifications] = useState<Set<string>>(new Set());
  
  // Distance from BA state
  const [distanceFromBA, setDistanceFromBA] = useState<number | null>(null);
  const [calculatingDistance, setCalculatingDistance] = useState(false);
  const [distanceError, setDistanceError] = useState<string | null>(null);

  // Generate dynamic styles based on theme
  const dynamicStyles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    baseAddressSection: {
      backgroundColor: colors.card,
      paddingHorizontal: 20,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    baseAddressText: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: 'center',
      marginRight: 8,
    },
    costCenterSection: {
      backgroundColor: colors.card,
      paddingHorizontal: 20,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    costCenterText: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: 'center',
      marginRight: 8,
    },
    modalContent: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 20,
      width: '90%',
      maxWidth: 400,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: colors.text,
      marginBottom: 16,
      textAlign: 'center',
    },
    textInput: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      padding: 12,
      fontSize: 16,
      color: colors.text,
      backgroundColor: colors.background,
      marginBottom: 20,
      textAlignVertical: 'top',
    },
    modalButtonSecondary: {
      flex: 1,
      padding: 12,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.primary,
      marginRight: 8,
    },
    modalButtonSecondaryText: {
      color: colors.primary,
      fontSize: 16,
      fontWeight: '600',
      textAlign: 'center',
    },
    modalButtonPrimary: {
      flex: 1,
      padding: 12,
      borderRadius: 8,
      backgroundColor: colors.primary,
      marginLeft: 8,
    },
    modalButtonPrimaryText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: '600',
      textAlign: 'center',
    },
    statCard: {
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 16,
      alignItems: 'center',
      flex: 1,
      marginHorizontal: 8,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    statValue: {
      fontSize: 20,
      fontWeight: 'bold',
      color: colors.text,
      marginTop: 8,
    },
    statLabel: {
      fontSize: 12,
      color: colors.textSecondary,
      textAlign: 'center',
      marginTop: 4,
    },
    actionButton: {
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 16,
      alignItems: 'center',
      marginBottom: 12,
      flexDirection: 'row',
      justifyContent: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    actionButtonSecondary: {
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 16,
      alignItems: 'center',
      marginBottom: 12,
      flexDirection: 'row',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.border,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    actionButtonText: {
      color: colors.text,
      fontSize: 16,
      fontWeight: '600',
      marginLeft: 8,
    },
    actionButtonSecondaryText: {
      color: colors.text,
      fontSize: 16,
      fontWeight: '600',
      marginLeft: 8,
    },
    monthlyMileageButton: {
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 16,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
      borderLeftWidth: 4,
      borderLeftColor: colors.primary,
    },
    monthlyMileageTitle: {
      fontSize: 16,
      fontWeight: 'bold',
      color: colors.text,
      marginBottom: 2,
    },
    monthlyMileageSubtitle: {
      fontSize: 14,
      color: colors.textSecondary,
    },
  });

  const handleLogout = async () => {
    try {
      // Use the LogoutService to handle logout
      await LogoutService.logout();
    } catch (error) {
      console.error('❌ HomeScreen: Error during logout:', error);
    }
  };


  // Initialize dashboard tiles
  const initializeTiles = async (): Promise<TileConfig[]> => {
    const allTiles: Record<string, TileConfig> = {
      'gps-tracking': {
        id: 'gps-tracking',
        icon: 'gps-fixed',
        label: 'Start GPS Tracking',
        color: '#4CAF50',
        onPress: handleGpsTracking,
        isPrimary: true,
      },
      'add-receipt': {
        id: 'add-receipt',
        icon: 'camera-alt',
        label: 'Add Receipt',
        color: colors.primary,
        onPress: handleAddReceipt,
      },
      'manual-entry': {
        id: 'manual-entry',
        icon: 'add',
        label: 'Manual Travel Entry',
        color: colors.primary,
        onPress: handleAddEntry,
      },
      'view-receipts': {
        id: 'view-receipts',
        icon: 'receipt',
        label: 'View Receipts',
        color: colors.primary,
        onPress: handleViewReceipts,
      },
      'hours-worked': {
        id: 'hours-worked',
        icon: 'access-time',
        label: 'Hours Worked',
        color: colors.primary,
        onPress: handleViewHoursWorked,
      },
      'daily-description': {
        id: 'daily-description',
        icon: 'description',
        label: 'Daily Description',
        color: colors.primary,
        onPress: () => navigation.navigate('DailyHours'),
      },
      'per-diem': {
        id: 'per-diem',
        icon: 'attach-money',
        label: 'Per Diem',
        color: colors.primary,
        onPress: () => navigation.navigate('PerDiem'),
      },
    };

    // Get saved order from preferences
    const prefs = await PreferencesService.getPreferences();
    const savedOrder = prefs.dashboardTileOrder;

    // Build tiles array in saved order
    const orderedTiles = savedOrder
      .map(id => allTiles[id])
      .filter(tile => tile !== undefined);

    return orderedTiles;
  };

  useEffect(() => {
    loadData();
    initializeTiles().then(setDashboardTiles);
  }, []);

  // Reload data when selected month/year changes
  useEffect(() => {
    if (currentEmployee) {
      loadEmployeeData(currentEmployee.id, currentEmployee);
    }
  }, [selectedMonth, selectedYear]);

  // Refresh data when screen comes into focus (but DON'T sync again)
  useFocusEffect(
    React.useCallback(() => {
      // Only refresh local data, don't sync from backend
      refreshLocalDataOnly();
    }, [])
  );

  // Refresh only local data without syncing from backend
  const refreshLocalDataOnly = async () => {
    try {
      const employee = await DatabaseService.getCurrentEmployee();
      if (employee) {
        setCurrentEmployee(employee);
        setViewingEmployee(employee);
        await loadEmployeeData(employee.id, employee);
        // Check for smart notifications when refreshing
        await checkSmartNotifications(employee.id);
        // Calculate distance from BA
        calculateDistanceFromBA();
      }
    } catch (error) {
      console.error('Error refreshing local data:', error);
    }
  };

  const calculateDistanceFromBA = async () => {
    if (!currentEmployee || !currentEmployee.baseAddress) {
      setDistanceFromBA(null);
      return;
    }

    try {
      setCalculatingDistance(true);
      setDistanceError(null);

      // Request location permission
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setDistanceError('Location permission denied');
        setCalculatingDistance(false);
        return;
      }

      // Get current location
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      // Reverse geocode current location to get address
      const reverseGeocode = await Location.reverseGeocodeAsync({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });

      let currentAddress = '';
      if (reverseGeocode && reverseGeocode.length > 0) {
        const addr = reverseGeocode[0];
        currentAddress = [
          addr.street,
          addr.city,
          addr.region,
          addr.postalCode,
          addr.country
        ].filter(Boolean).join(', ');
      }

      // If reverse geocoding failed, use coordinates as fallback
      if (!currentAddress) {
        currentAddress = `${location.coords.latitude},${location.coords.longitude}`;
      }

      // Calculate distance using DistanceService
      const distance = await DistanceService.calculateDistance(
        currentAddress,
        currentEmployee.baseAddress
      );

      setDistanceFromBA(distance);
    } catch (error) {
      console.error('Error calculating distance from BA:', error);
      setDistanceError('Unable to calculate');
      setDistanceFromBA(null);
    } finally {
      setCalculatingDistance(false);
    }
  };

  const loadEmployeeData = async (employeeId: string, employeeParam?: Employee) => {
    try {
      
      // Use provided employee parameter or fall back to currentEmployee
      const employee = employeeParam || currentEmployee;
      if (!employee || employee.id !== employeeId) {
        console.error('Employee not found or ID mismatch:', { employeeId, employee: employee?.name });
        return;
      }


      // Get all dashboard data using unified service with selected month/year
      const dashboardData = await DashboardService.getDashboardStats(employeeId, selectedMonth, selectedYear);
      
      // Set recent entries and receipts
      setRecentEntries(dashboardData.recentMileageEntries);
      setRecentReceipts(dashboardData.recentReceipts);
      
      // Set monthly totals
      setTotalMilesThisMonth(dashboardData.monthlyStats.totalMiles);
      setTotalHoursThisMonth(dashboardData.monthlyStats.totalHours);
      setTotalReceiptsThisMonth(dashboardData.monthlyStats.totalReceipts);

      // Use Per Diem receipts total (from receipts with category "Per Diem")
      const perDiemFromReceipts = dashboardData.monthlyStats.totalPerDiemReceipts || 0;
      setPerDiemThisMonth(perDiemFromReceipts);
      
      // Load enhanced Per Diem statistics
      const stats = await PerDiemDashboardService.getPerDiemStats(
        employee,
        selectedMonth,
        selectedYear
      );
      setPerDiemStats(stats);

      // Calculate total expenses
      const expenseBreakdown = PerDiemService.getExpenseBreakdown(
        dashboardData.monthlyStats.totalMiles,
        dashboardData.monthlyStats.totalReceipts,
        perDiemFromReceipts
      );
      
      setTotalExpensesThisMonth(expenseBreakdown.totalExpenses);
      
    } catch (error) {
      console.error('Error loading employee data:', error);
    }
  };


  const checkBaseAddressSuggestion = async (employee: Employee) => {
    try {
      // Get all mileage entries for analysis
      const allEntries = await DatabaseService.getMileageEntries(employee.id);
      
      if (allEntries.length < 10) return; // Need at least 10 trips
      
      // Analyze for base address patterns
      const suggestion = await BaseAddressDetectionService.analyzeForBaseAddress(
        allEntries,
        employee.baseAddress
      );
      
      if (suggestion.shouldSuggest) {
        Alert.alert(
          '🏠 Base Address Suggestion',
          `We noticed you start ${suggestion.frequency}% of your trips from:\n\n"${suggestion.location}"\n\n${suggestion.reasoning}\n\nWould you like to set this as your Base Address? This will auto-fill the start location for future trips.`,
          [
            { text: 'Not Now', style: 'cancel' },
            {
              text: 'Set as Base Address',
              onPress: async () => {
                await DatabaseService.updateEmployee(employee.id, {
                  ...employee,
                  baseAddress: suggestion.location,
                });
                setCurrentEmployee({ ...employee, baseAddress: suggestion.location });
                Alert.alert('Success', 'Base address updated!');
              },
            },
          ]
        );
      }
    } catch (error) {
      console.error('Error checking base address:', error);
    }
  };

  const checkSmartNotifications = async (employeeId: string) => {
    try {
      const notifications = await SmartNotificationService.checkNotifications(employeeId);
      // Filter out dismissed notifications
      const activeNotifications = notifications.filter(
        notification => !dismissedNotifications.has(notification.id)
      );
      setSmartNotifications(activeNotifications);
    } catch (error) {
      console.error('Error checking smart notifications:', error);
    }
  };

  const handleDismissNotification = (notificationId: string) => {
    setDismissedNotifications(prev => new Set(prev).add(notificationId));
    setSmartNotifications(prev => prev.filter(n => n.id !== notificationId));
  };

  const handleNotificationAction = (notification: SmartNotification) => {
    if (notification.actionRoute) {
      navigation.navigate(notification.actionRoute);
    }
    handleDismissNotification(notification.id);
  };

  const handleEditEntry = (entryId: string) => {
    // Navigate to MileageEntryScreen with the entry ID for editing
    navigation.navigate('MileageEntry', { 
      entryId: entryId,
      isEditing: true 
    });
  };

  const handleSyncNow = async () => {
    if (!currentEmployee || isSyncing) return;
    setIsSyncing(true);
    try {
      console.log('🔄 HomeScreen: Starting bi-directional sync...');
      const { ApiSyncService } = await import('../services/apiSyncService');
      const { DatabaseService } = await import('../services/database');
      
      // Step 1: Sync local changes TO backend (one data type at a time to avoid rate limits)
      console.log('📤 HomeScreen: Syncing local data to backend...');
      let syncSuccesses = 0;
      let syncFailures = 0;
      const errors: string[] = [];
      
      // Sync daily descriptions
      try {
        const localDescriptions = await DatabaseService.getDailyDescriptions(currentEmployee.id);
        if (localDescriptions.length > 0) {
          const result = await ApiSyncService.syncToBackend({ dailyDescriptions: localDescriptions });
          if (result.success) {
            syncSuccesses++;
          } else {
            syncFailures++;
            if (result.error) errors.push(`Daily descriptions: ${result.error}`);
          }
          // Small delay between data types
          await new Promise(resolve => setTimeout(resolve, 300));
        }
      } catch (error) {
        syncFailures++;
        console.error('❌ HomeScreen: Error syncing daily descriptions:', error);
      }
      
      // Sync mileage entries
      try {
        const localMileage = await DatabaseService.getMileageEntries(currentEmployee.id);
        if (localMileage.length > 0) {
          const result = await ApiSyncService.syncToBackend({ mileageEntries: localMileage });
          if (result.success) {
            syncSuccesses++;
          } else {
            syncFailures++;
            if (result.error) errors.push(`Mileage entries: ${result.error}`);
          }
          await new Promise(resolve => setTimeout(resolve, 300));
        }
      } catch (error) {
        syncFailures++;
        console.error('❌ HomeScreen: Error syncing mileage entries:', error);
      }
      
      // Sync receipts
      try {
        const localReceipts = await DatabaseService.getReceipts(currentEmployee.id);
        if (localReceipts.length > 0) {
          const result = await ApiSyncService.syncToBackend({ receipts: localReceipts });
          if (result.success) {
            syncSuccesses++;
          } else {
            syncFailures++;
            if (result.error) errors.push(`Receipts: ${result.error}`);
          }
          // Longer delay after receipts (images take time)
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      } catch (error) {
        syncFailures++;
        console.error('❌ HomeScreen: Error syncing receipts:', error);
      }
      
      // Sync time tracking
      try {
        const allTimeTracking = await DatabaseService.getAllTimeTrackingEntries();
        const localTimeTracking = allTimeTracking.filter(t => t.employeeId === currentEmployee.id);
        if (localTimeTracking.length > 0) {
          const result = await ApiSyncService.syncToBackend({ timeTracking: localTimeTracking });
          if (result.success) {
            syncSuccesses++;
          } else {
            syncFailures++;
            if (result.error) errors.push(`Time tracking: ${result.error}`);
          }
          await new Promise(resolve => setTimeout(resolve, 300));
        }
      } catch (error) {
        syncFailures++;
        console.error('❌ HomeScreen: Error syncing time tracking:', error);
      }
      
      // Step 2: Sync FROM backend to get latest data
      console.log('📥 HomeScreen: Pulling updates from backend...');
      const syncFromResult = await ApiSyncService.syncFromBackend(currentEmployee.id);
      
      if (syncFromResult.success) {
        console.log('✅ HomeScreen: Sync from backend successful');
        setLastSyncTime(new Date());
        // Refresh data after sync
        await loadEmployeeData(currentEmployee.id, currentEmployee);
        
        // Show success/warning message
        if (syncFailures > 0 && syncSuccesses > 0) {
          Alert.alert('Sync Completed with Warnings', 
            `Some data synced successfully, but ${syncFailures} type(s) had errors:\n${errors.join('\n')}`);
        } else if (syncFailures === 0) {
          Alert.alert('Success', 'All data synced successfully!');
        } else {
          Alert.alert('Sync Completed', 
            `Pulled updates from server, but had issues syncing local changes:\n${errors.join('\n')}`);
        }
      } else {
        console.error('❌ HomeScreen: Sync from backend failed:', syncFromResult.error);
        if (syncSuccesses > 0) {
          Alert.alert('Partial Sync', 
            `Local changes synced, but couldn't pull updates from server. ${syncFromResult.error}`);
        } else {
          Alert.alert('Sync Failed', 
            syncFromResult.error || 'Unable to sync right now. Please try again.');
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      console.error('❌ HomeScreen: Error syncing now:', error);
      Alert.alert('Sync Failed', `Unable to sync right now: ${errorMessage}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      
      
      // Database should already be initialized by AppInitializer
      // Small delay to ensure any async operations from app startup are complete
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Get the current logged-in employee
      const employee = await DatabaseService.getCurrentEmployee();
      
      if (!employee) {
        return;
      }
      
      
      setCurrentEmployee(employee);
      
      // Permission checks removed - mobile app is staff-only, admin functions in web portal
      // setHasAdminPermissions(PermissionService.hasAdminPermissions(employee));
      // setHasTeamDashboardPermissions(PermissionService.hasTeamDashboardPermissions(employee));
      
      // Set viewing employee to current employee by default
      setViewingEmployee(employee);
      
      // Tips will be loaded on individual screens instead of home screen
      
      // Mobile app: Always show only the current employee's data
      // Admin/Supervisor functions are handled in the web portal only
      setAvailableEmployees([employee]); // Only show themselves
      
      // Initialize real-time sync
      const realtimeSync = RealtimeSyncService.getInstance();
      realtimeSync.connect(API_BASE_URL, employee.id);
      
      // Set up real-time sync event listeners
      realtimeSync.on('data_update', (data) => {
        console.log('📡 Real-time data update received:', data);
        // Refresh data when updates are received
        loadEmployeeData(employee.id, employee);
      });
      
      realtimeSync.on('notification', (notification) => {
        console.log('📢 Real-time notification received:', notification);
        // Notifications are already shown by the service
      });
      
      realtimeSync.on('connection_established', () => {
        console.log('✅ Real-time sync connected');
      });
      
      realtimeSync.on('error', (error) => {
        console.error('❌ Real-time sync error:', error);
      });

      // Sync data from backend on app startup
      // Make this non-blocking - don't show errors during initial sync
      if (!homeScreenIsSyncing) {
        homeScreenIsSyncing = true;
        // Run sync in background without blocking UI
        (async () => {
          try {
            const { ApiSyncService } = await import('../services/apiSyncService');
            const syncResult = await ApiSyncService.syncFromBackend(employee.id);
            if (syncResult.success) {
              setLastSyncTime(new Date());
            } else {
              // Only log errors during initial sync, don't show alerts
              debugWarn('⚠️ Initial sync completed with some errors (this is normal):', syncResult.error);
            }
          } catch (syncError) {
            // Silently log errors during initial sync - don't show alerts
            debugWarn('⚠️ Error during initial backend sync (non-blocking):', syncError instanceof Error ? syncError.message : 'Unknown error');
          } finally {
            homeScreenIsSyncing = false;
          }
        })();
      }
      
      // Load data for the viewing employee
      await loadEmployeeData(employee.id, employee);
      
      // Check for base address suggestions
      await checkBaseAddressSuggestion(employee);
      
      // Check for smart notifications
      await checkSmartNotifications(employee.id);
      
    } catch (error) {
      console.error('Error loading data:', error);
      // Don't show alert on initial load, just log the error
      if (currentEmployee) {
        Alert.alert('Error', 'Failed to load data');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAddEntry = () => {
    navigation.navigate('MileageEntry');
  };

  const handleGpsTracking = () => {
    navigation.navigate('GpsTracking');
  };

  const handleAddReceipt = () => {
    navigation.navigate('AddReceipt');
  };

  const handleViewReceipts = () => {
    navigation.navigate('Receipts', {
      selectedMonth,
      selectedYear,
    });
  };

  const handleViewHoursWorked = () => {
    navigation.navigate('DailyHours');
  };

  const handleViewAdmin = () => {
    navigation.navigate('Admin');
  };

  const handleViewManagerDashboard = () => {
    navigation.navigate('ManagerDashboard');
  };

  const handleViewSavedAddresses = () => {
    navigation.navigate('SavedAddresses');
  };

  const handleDeleteReceipt = async (id: string) => {
    Alert.alert(
      'Delete Receipt',
      'Are you sure you want to delete this receipt?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await DatabaseService.deleteReceipt(id);
              loadData();
            } catch (error) {
              console.error('Error deleting receipt:', error);
              Alert.alert('Error', 'Failed to delete receipt');
            }
          }
        }
      ]
    );
  };

  const handleEditReceipt = (id: string) => {
    navigation.navigate('ReceiptEntry', { receiptId: id });
  };

  const handleEmployeeChange = async (employeeId: string) => {
    const employee = availableEmployees.find(emp => emp.id === employeeId);
    if (employee) {
      setViewingEmployee(employee);
      await loadEmployeeData(employeeId);
      // Clear batch selections when switching employees
      setSelectedMileageEntries([]);
      setSelectedReceipts([]);
    }
  };

  // Dynamic button text based on platform
  const getNavigationButtonText = () => {
    return Platform.OS === 'ios' ? 'Open Apple Maps' : 'Open Google Maps';
  };

  const handleOpenNavigation = async () => {
    try {
      // List of popular navigation apps with their URL schemes
      const navigationApps = [
        // Apple Maps (iOS) - Use native app URL scheme
        { name: 'Apple Maps', url: 'maps://', ios: true },
        // Apple Maps Web (fallback)
        { name: 'Apple Maps Web', url: 'http://maps.apple.com/', ios: true },
        // Google Maps
        { name: 'Google Maps', url: 'https://maps.google.com/', universal: true },
        // Waze
        { name: 'Waze', url: 'waze://', universal: true },
        // HERE Maps
        { name: 'HERE Maps', url: 'here-location://', universal: true },
        // MapQuest
        { name: 'MapQuest', url: 'mapquest://', universal: true },
        // Sygic
        { name: 'Sygic', url: 'com.sygic.aura://', universal: true },
        // TomTom
        { name: 'TomTom', url: 'tomtomhome://', universal: true },
        // Android Maps (fallback for Android)
        { name: 'Android Maps', url: 'geo:0,0?q=', android: true },
      ];

      let selectedApp = null;

      // On iOS, try Apple Maps first, then others
      if (Platform.OS === 'ios') {
        // Check if we can open Apple Maps (native app)
        const canOpenAppleMaps = await Linking.canOpenURL('maps://');
        if (canOpenAppleMaps) {
          selectedApp = navigationApps.find(app => app.name === 'Apple Maps');
        } else {
          // Try Apple Maps Web as fallback
          const canOpenAppleMapsWeb = await Linking.canOpenURL('http://maps.apple.com/');
          if (canOpenAppleMapsWeb) {
            selectedApp = navigationApps.find(app => app.name === 'Apple Maps Web');
          } else {
            // Try Google Maps
            const canOpenGoogleMaps = await Linking.canOpenURL('https://maps.google.com/');
            if (canOpenGoogleMaps) {
              selectedApp = navigationApps.find(app => app.name === 'Google Maps');
            }
          }
        }
      } else {
        // On Android, try Google Maps first
        const canOpenGoogleMaps = await Linking.canOpenURL('https://maps.google.com/');
        if (canOpenGoogleMaps) {
          selectedApp = navigationApps.find(app => app.name === 'Google Maps');
        } else {
          // Fallback to Android Maps
          selectedApp = navigationApps.find(app => app.name === 'Android Maps');
        }
      }

      // If no app was selected, try to find any available navigation app
      if (!selectedApp) {
        for (const app of navigationApps) {
          if ((app.ios && Platform.OS === 'ios') || (app.android && Platform.OS === 'android') || app.universal) {
            const canOpen = await Linking.canOpenURL(app.url);
            if (canOpen) {
              selectedApp = app;
              break;
            }
          }
        }
      }

      if (selectedApp) {
        await Linking.openURL(selectedApp.url);
        console.log(`🗺️ Opened ${selectedApp.name} for navigation`);
      } else {
        // Show a list of available options
        const availableApps = [];
        for (const app of navigationApps) {
          if ((app.ios && Platform.OS === 'ios') || (app.android && Platform.OS === 'android') || app.universal) {
            const canOpen = await Linking.canOpenURL(app.url);
            if (canOpen) {
              availableApps.push(app.name);
            }
          }
        }

        if (availableApps.length > 0) {
          Alert.alert(
            'Choose Navigation App',
            `Available apps: ${availableApps.join(', ')}`,
            [
              ...availableApps.map(appName => ({
                text: appName,
                onPress: async () => {
                  const app = navigationApps.find(a => a.name === appName);
                  if (app) {
                    await Linking.openURL(app.url);
                  }
                }
              })),
              { text: 'Cancel', style: 'cancel' }
            ]
          );
        } else {
          Alert.alert(
            'No Navigation Apps Found',
            'Please install a navigation app like Google Maps, Apple Maps, or Waze to use this feature.',
            [{ text: 'OK' }]
          );
        }
      }
    } catch (error) {
      console.error('Error opening navigation app:', error);
      Alert.alert(
        'Navigation Error',
        'Unable to open navigation app. Please check if you have a navigation app installed.',
        [{ text: 'OK' }]
      );
    }
  };

  const filterPlaceholderText = (value: string): string => {
    if (!value) return '';
    const placeholderTexts = ['to be updated', 'tbd', 'n/a', 'none', 'null', 'undefined'];
    const isPlaceholder = placeholderTexts.includes(value.toLowerCase().trim());
    return isPlaceholder ? '' : value;
  };

  const handleEditBaseAddress = () => {
    if (currentEmployee) {
      setBaseAddressInput(filterPlaceholderText(currentEmployee.baseAddress || ''));
      setShowBaseAddressModal(true);
    }
  };

  const handleEditCostCenters = async () => {
    if (currentEmployee) {
      // Only show cost centers assigned by admin
      const assignedCostCenters = currentEmployee.costCenters || [];
      setSelectedCostCenters(assignedCostCenters);
      // Set default to current default, or first cost center if only one
      const currentDefault = currentEmployee.defaultCostCenter || '';
      setDefaultCostCenter(
        assignedCostCenters.includes(currentDefault) 
          ? currentDefault 
          : (assignedCostCenters.length === 1 ? assignedCostCenters[0] : '')
      );
      setShowCostCentersModal(true);
    }
  };

  const handleSaveCostCenters = async () => {
    if (!currentEmployee) return;

    try {
      // Only update defaultCostCenter - costCenters are assigned by admin and cannot be changed
      const assignedCostCenters = currentEmployee.costCenters || [];
      const newDefault = assignedCostCenters.length === 1 
        ? assignedCostCenters[0] 
        : (defaultCostCenter || '');
      
      await DatabaseService.updateEmployee(currentEmployee.id, {
        defaultCostCenter: newDefault,
        // Keep selectedCostCenters in sync with costCenters (assigned by admin)
        selectedCostCenters: assignedCostCenters
      });
      
      setCurrentEmployee(prev => prev ? { 
        ...prev, 
        defaultCostCenter: newDefault,
        selectedCostCenters: assignedCostCenters
      } : null);
      
      setShowCostCentersModal(false);
      Alert.alert('Success', 'Default cost center updated successfully');
    } catch (error) {
      console.error('Error updating cost centers:', error);
      Alert.alert('Error', 'Failed to update default cost center');
    }
  };

  const handleImportCostCenters = async () => {
    if (importingCostCenters) return;

    Alert.alert(
      'Import Cost Centers',
      'This will import all cost centers from the Google Sheet and update all employees. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Import',
          onPress: async () => {
            setImportingCostCenters(true);
            try {
              console.log('📊 HomeScreen: Starting cost center import...');
              const costCenters = await CostCenterImportService.importAndUpdateCostCenters();
              
              // Reload current employee data to get updated cost centers
              if (currentEmployee) {
                const updatedEmployee = await DatabaseService.getEmployeeById(currentEmployee.id);
                if (updatedEmployee) {
                  setCurrentEmployee(updatedEmployee);
                }
              }
              
              Alert.alert(
                'Import Complete', 
                `Successfully imported ${costCenters.length} cost centers from Google Sheet.`,
                [{ text: 'OK' }]
              );
            } catch (error) {
              console.error('❌ HomeScreen: Error importing cost centers:', error);
              Alert.alert(
                'Import Failed', 
                'Failed to import cost centers. Please check your internet connection and try again.',
                [{ text: 'OK' }]
              );
            } finally {
              setImportingCostCenters(false);
            }
          }
        }
      ]
    );
  };

  const toggleBatchMode = () => {
    console.log('Toggling batch mode from', isBatchMode, 'to', !isBatchMode);
    setIsBatchMode(!isBatchMode);
    setSelectedMileageEntries([]);
    setSelectedReceipts([]);
    console.log('Batch mode toggled, selections cleared');
  };

  const toggleMileageEntrySelection = (entryId: string) => {
    setSelectedMileageEntries(prev => 
      prev.includes(entryId) 
        ? prev.filter(id => id !== entryId)
        : [...prev, entryId]
    );
  };

  const toggleReceiptSelection = (receiptId: string) => {
    console.log('Toggling receipt selection:', receiptId);
    setSelectedReceipts(prev => {
      const newSelection = prev.includes(receiptId) 
        ? prev.filter(id => id !== receiptId)
        : [...prev, receiptId];
      console.log('New receipt selection:', newSelection);
      return newSelection;
    });
  };

  const selectAllMileageEntries = () => {
    setSelectedMileageEntries(recentEntries.map(entry => entry.id));
  };

  const selectAllReceipts = () => {
    setSelectedReceipts(recentReceipts.map(receipt => receipt.id));
  };

  const handleBatchDeleteMileageEntries = async () => {
    if (selectedMileageEntries.length === 0) return;

    Alert.alert(
      'Delete Selected Entries',
      `Are you sure you want to delete ${selectedMileageEntries.length} mileage entries? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              // Delete each mileage entry individually
              for (const entryId of selectedMileageEntries) {
                await DatabaseService.deleteMileageEntry(entryId);
              }
              setSelectedMileageEntries([]);
              loadData(); // Reload data to reflect changes
              Alert.alert('Success', 'Selected entries deleted successfully');
            } catch (error) {
              console.error('Error deleting entries:', error);
              Alert.alert('Error', 'Failed to delete selected entries');
            }
          }
        }
      ]
    );
  };

  const handleBatchDeleteReceipts = async () => {
    if (selectedReceipts.length === 0) return;

    Alert.alert(
      'Delete Selected Receipts',
      `Are you sure you want to delete ${selectedReceipts.length} receipts? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              // Delete each receipt individually
              for (const receiptId of selectedReceipts) {
                await DatabaseService.deleteReceipt(receiptId);
              }
              setSelectedReceipts([]);
              loadData(); // Reload data to reflect changes
              Alert.alert('Success', 'Selected receipts deleted successfully');
            } catch (error) {
              console.error('Error deleting receipts:', error);
              Alert.alert('Error', 'Failed to delete selected receipts');
            }
          }
        }
      ]
    );
  };

  const handleSaveBaseAddress = async () => {
    console.log('🏠 HomeScreen: Saving base address');
    console.log('🏠 HomeScreen: Current employee:', currentEmployee?.name);
    console.log('🏠 HomeScreen: Base address input:', baseAddressInput);
    
    if (!currentEmployee || !baseAddressInput.trim()) {
      console.log('❌ HomeScreen: Missing employee or base address');
      Alert.alert('Error', 'Please enter a valid base address');
      return;
    }

    try {
      console.log('💾 HomeScreen: Updating base address in database...');
      await DatabaseService.updateEmployee(currentEmployee.id, {
        baseAddress: baseAddressInput.trim()
      });
      
      // Update the local state
      setCurrentEmployee({
        ...currentEmployee,
        baseAddress: baseAddressInput.trim()
      });
      
      console.log('✅ HomeScreen: Base address updated successfully');
      setShowBaseAddressModal(false);
      Alert.alert('Success', 'Base address updated successfully');
    } catch (error) {
      console.error('❌ HomeScreen: Error updating base address:', error);
      Alert.alert('Error', 'Failed to update base address');
    }
  };

  const formatDate = (date: Date) => {
    // Dates are now properly parsed at storage time
    // Just display them normally
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  // formatLocationRoute is now imported from utils/locationFormatter

  const handleDeleteEntry = async (entryId: string) => {
    Alert.alert(
      'Delete Entry',
      'Are you sure you want to delete this mileage entry? This action cannot be undone.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await DatabaseService.deleteMileageEntry(entryId);
              Alert.alert('Success', 'Mileage entry deleted successfully');
              loadData(); // Refresh the data
            } catch (error) {
              console.error('Error deleting entry:', error);
              Alert.alert('Error', 'Failed to delete mileage entry');
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading...</Text>
        <StatusBar style="auto" />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <UnifiedHeader 
        title={viewingEmployee?.id === currentEmployee?.id 
          ? `Welcome,\n${currentEmployee?.name || 'User'}`
          : `Viewing:\n${viewingEmployee?.name || 'Employee'}`
        }
        leftButton={{
          icon: 'settings',
          onPress: () => navigation.navigate('Settings', { currentEmployeeId: currentEmployee?.id }),
          color: '#1C75BC'
        }}
        rightButton={{
          icon: 'logout',
          onPress: () => {
            Alert.alert(
              'Log Out',
              'Are you sure you want to log out?',
              [
                { text: 'Cancel', style: 'cancel' },
                { 
                  text: 'Log Out', 
                  style: 'destructive',
                  onPress: handleLogout
                }
              ]
            );
          },
          color: '#1C75BC'
        }}
      />
      
      {/* Base Address Section */}
      {currentEmployee?.baseAddress && (
        <View style={dynamicStyles.baseAddressSection}>
          <TouchableOpacity onPress={handleEditBaseAddress} style={styles.baseAddressContainer}>
            <Text style={dynamicStyles.baseAddressText}>
              Base Address (BA): {currentEmployee.baseAddress}
            </Text>
            <MaterialIcons name="edit" size={16} color={colors.primary} />
          </TouchableOpacity>
        </View>
      )}

      {/* Cost Centers Section */}
      <View style={dynamicStyles.costCenterSection}>
        <TouchableOpacity onPress={handleEditCostCenters} style={styles.costCenterContainer}>
          <Text style={dynamicStyles.costCenterText}>
            Cost Centers: {currentEmployee?.selectedCostCenters?.length || 0} selected
          </Text>
          <MaterialIcons name="edit" size={16} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Month/Year Selector */}
      <View style={dynamicStyles.costCenterSection}>
        <TouchableOpacity onPress={() => setShowMonthYearModal(true)} style={styles.costCenterContainer}>
          <Text style={dynamicStyles.costCenterText}>
            Viewing: {new Date(selectedYear, selectedMonth - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </Text>
          <MaterialIcons name="edit" size={16} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Smart Notifications */}
      {smartNotifications.length > 0 && (
        <View style={styles.notificationsContainer}>
          {smartNotifications.map((notification) => {
            const priorityColor = 
              notification.priority === 'high' ? '#F44336' :
              notification.priority === 'medium' ? '#FF9800' : '#2196F3';
            
            return (
              <View key={notification.id} style={[styles.notificationCard, { borderLeftColor: priorityColor }]}>
                <View style={styles.notificationHeader}>
                  <View style={styles.notificationTitleContainer}>
                    <MaterialIcons 
                      name={
                        notification.type === 'mileage' ? 'drive-eta' :
                        notification.type === 'receipt' ? 'receipt' :
                        notification.type === 'report' ? 'assessment' :
                        notification.type === 'per_diem' ? 'location-on' : 'info'
                      } 
                      size={20} 
                      color={priorityColor} 
                      style={styles.notificationIcon}
                    />
                    <Text style={[styles.notificationTitle, { color: colors.text }]}>
                      {notification.title}
                    </Text>
                  </View>
                  <TouchableOpacity 
                    onPress={() => handleDismissNotification(notification.id)}
                    style={styles.dismissButton}
                  >
                    <MaterialIcons name="close" size={18} color={colors.textSecondary} />
                  </TouchableOpacity>
                </View>
                <Text style={[styles.notificationMessage, { color: colors.textSecondary }]}>
                  {notification.message}
                </Text>
                {notification.actionLabel && (
                  <TouchableOpacity 
                    onPress={() => handleNotificationAction(notification)}
                    style={[styles.notificationAction, { backgroundColor: priorityColor }]}
                  >
                    <Text style={styles.notificationActionText}>{notification.actionLabel}</Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          })}
        </View>
      )}

      {/* Batch Mode Indicator */}
      {isBatchMode && (
        <View style={styles.batchModeIndicator}>
          <MaterialIcons name="checklist" size={20} color="#fff" />
          <Text style={styles.batchModeText}>Batch Selection Mode</Text>
          <Text style={styles.batchModeSubtext}>
            Tap checkboxes to select items, then use Delete button
          </Text>
        </View>
      )}

      {/* Employee Selector */}
      {availableEmployees.length > 1 && (
        <View style={styles.employeeSelectorSection}>
          <Text style={styles.employeeSelectorLabel}>Viewing Data For:</Text>
          <View style={styles.employeeSelectorContainer}>
            {availableEmployees.map((employee) => (
              <TouchableOpacity
                key={employee.id}
                style={[
                  styles.employeeOption,
                  viewingEmployee?.id === employee.id && styles.employeeOptionSelected
                ]}
                onPress={() => handleEmployeeChange(employee.id)}
              >
                <Text style={[
                  styles.employeeOptionText,
                  viewingEmployee?.id === employee.id && styles.employeeOptionTextSelected
                ]}>
                  {employee.name}
                </Text>
                {employee.position && (
                  <Text style={[
                    styles.employeeOptionSubtext,
                    viewingEmployee?.id === employee.id && styles.employeeOptionSubtextSelected
                  ]}>
                    {employee.position}
                  </Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      <View style={styles.contentContainer}>
        <ScrollView 
          style={styles.content}
          showsVerticalScrollIndicator={false}
          removeClippedSubviews={true}
          scrollEventThrottle={16}
          keyboardShouldPersistTaps="handled"
        >
        {/* Sync Status Indicator (for debugging) */}
        {__DEV__ && (
          <View style={styles.syncStatusBar}>
            <MaterialIcons 
              name={isSyncing ? "sync" : "cloud-done"} 
              size={16} 
              color={isSyncing ? "#2196F3" : "#4CAF50"} 
            />
            <Text style={styles.syncStatusText}>
              {isSyncing ? "Syncing..." : lastSyncTime ? `Last sync: ${lastSyncTime.toLocaleTimeString()}` : "Not synced yet"}
            </Text>
            <Text style={styles.syncStatusUrl}>
              {__DEV__ ? "192.168.86.101:3002" : "Production"}
            </Text>
          </View>
        )}
        
        {/* Tips Display */}
        
        {/* Quick Stats */}
        <View style={styles.statsContainer}>
          <View style={dynamicStyles.statCard}>
            <MaterialIcons name="attach-money" size={24} color="#FF9800" />
            <Text style={dynamicStyles.statValue}>${totalExpensesThisMonth.toFixed(2)}</Text>
            <Text style={dynamicStyles.statLabel}>Total Expenses</Text>
          </View>
          
          <View style={dynamicStyles.statCard}>
            <MaterialIcons name="speed" size={24} color="#4CAF50" />
            <Text style={dynamicStyles.statValue}>{totalMilesThisMonth.toFixed(1)}</Text>
            <Text style={dynamicStyles.statLabel}>Miles This Month</Text>
          </View>
        </View>

        {/* Enhanced Per Diem Widget - Always visible */}
        <PerDiemWidget
          currentTotal={perDiemStats?.currentMonthTotal || 0}
          monthlyLimit={perDiemStats?.monthlyLimit || 350}
          daysEligible={perDiemStats?.daysEligible || 0}
          daysClaimed={perDiemStats?.daysClaimed || 0}
          isEligibleToday={perDiemStats?.isEligibleToday || false}
          onPress={() => {
            // Navigate to Per Diem screen
            navigation.navigate('PerDiem');
          }}
          colors={{
            card: colors.card,
            text: colors.text,
            textSecondary: colors.textSecondary
          }}
        />

        {/* Secondary Stats */}
        <View style={styles.statsContainer}>
          <TouchableOpacity style={dynamicStyles.statCard} onPress={() => navigation.navigate('Receipts', { selectedMonth, selectedYear })}>
            <MaterialIcons name="receipt" size={24} color="#E91E63" />
            <Text style={dynamicStyles.statValue}>${totalReceiptsThisMonth.toFixed(2)}</Text>
            <Text style={dynamicStyles.statLabel}>Other Receipts</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={dynamicStyles.statCard} onPress={() => navigation.navigate('DailyHours')}>
            <MaterialIcons name="access-time" size={24} color="#FF5722" />
            <Text style={dynamicStyles.statValue}>{totalHoursThisMonth.toFixed(1)}h</Text>
            <Text style={dynamicStyles.statLabel}>Hours Worked</Text>
          </TouchableOpacity>
        </View>

        {/* Distance from BA Widget */}
        {currentEmployee?.baseAddress && (
          <View style={styles.distanceBAContainer}>
            <View style={dynamicStyles.statCard}>
              <MaterialIcons name="location-on" size={24} color="#2196F3" />
              {calculatingDistance ? (
                <Text style={dynamicStyles.statValue}>...</Text>
              ) : distanceError ? (
                <Text style={[dynamicStyles.statValue, { fontSize: 14, color: '#999' }]}>{distanceError}</Text>
              ) : distanceFromBA !== null ? (
                <Text style={dynamicStyles.statValue}>{distanceFromBA.toFixed(1)} mi</Text>
              ) : (
                <Text style={[dynamicStyles.statValue, { fontSize: 14, color: '#999' }]}>N/A</Text>
              )}
              <Text style={dynamicStyles.statLabel}>Distance from BA</Text>
              <TouchableOpacity 
                onPress={calculateDistanceFromBA}
                style={{ marginTop: 8 }}
              >
                <MaterialIcons name="refresh" size={16} color="#2196F3" />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Total Expenses Card */}
        <View style={styles.statsContainer}>
          <View style={dynamicStyles.statCard}>
            <MaterialIcons name="attach-money" size={24} color="#4CAF50" />
            <Text style={dynamicStyles.statValue}>${totalExpensesThisMonth.toFixed(2)}</Text>
            <Text style={dynamicStyles.statLabel}>Total Expenses</Text>
          </View>
          
          <View style={dynamicStyles.statCard}>
            <MaterialIcons name="list" size={24} color="#2196F3" />
            <Text style={dynamicStyles.statValue}>{recentEntries.length}</Text>
            <Text style={dynamicStyles.statLabel}>Recent Entries</Text>
          </View>
        </View>

        {/* Monthly Mileage Link */}
        <View style={styles.monthlyMileageContainer}>
          <TouchableOpacity 
            style={dynamicStyles.monthlyMileageButton}
            onPress={() => navigation.navigate('MileageEntries', { 
              selectedMonth, 
              selectedYear 
            })}
            activeOpacity={0.7}
          >
            <View style={styles.monthlyMileageContent}>
              <View style={styles.monthlyMileageIconContainer}>
                <MaterialIcons name="speed" size={28} color={colors.primary} />
              </View>
              <View style={styles.monthlyMileageTextContainer}>
                <Text style={dynamicStyles.monthlyMileageTitle}>Monthly Mileage Summary</Text>
                <Text style={dynamicStyles.monthlyMileageSubtitle}>
                  {totalMilesThisMonth.toFixed(1)} miles • {recentEntries.length} entries • {new Date(selectedYear, selectedMonth - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </Text>
              </View>
              <MaterialIcons name="chevron-right" size={24} color={colors.textSecondary} />
            </View>
          </TouchableOpacity>
        </View>


        {/* Sync Status Indicator */}
        <View 
          style={[styles.syncStatusContainer, isSyncing && styles.syncStatusContainerSyncing]}
        >
          <View style={styles.syncStatusLeft}>
            <MaterialIcons 
              name={isSyncing ? "sync" : (lastSyncTime ? "cloud-done" : "cloud-off")} 
              size={18} 
              color={isSyncing ? "#2196F3" : (lastSyncTime ? "#4CAF50" : "#999")} 
            />
            <Text style={[styles.syncStatusText, isSyncing && styles.syncStatusTextSyncing]}>
              {isSyncing 
                ? "Syncing..." 
                : lastSyncTime 
                  ? `Last synced: ${lastSyncTime.toLocaleTimeString()}` 
                  : "Never synced"}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.syncNowButton}
            onPress={handleSyncNow}
            disabled={isSyncing}
          >
            <MaterialIcons name="sync" size={18} color={isSyncing ? "#999" : "#2196F3"} />
            <Text style={[styles.syncNowText, isSyncing && { color: '#999' }]}>Sync Now</Text>
          </TouchableOpacity>
        </View>

        {/* Quick Actions */}
        <View style={styles.actionsHeader}>
          <Text style={styles.actionsTitle}>Quick Actions</Text>
          <TouchableOpacity
            style={styles.rearrangeButton}
            onPress={() => setIsEditingTiles(!isEditingTiles)}
          >
            <MaterialIcons 
              name={isEditingTiles ? 'check' : 'edit'} 
              size={20} 
              color={isEditingTiles ? '#4CAF50' : colors.primary} 
            />
            <Text style={[styles.rearrangeButtonText, isEditingTiles && { color: '#4CAF50' }]}>
              {isEditingTiles ? 'Done' : 'Rearrange'}
            </Text>
          </TouchableOpacity>
        </View>

        {isEditingTiles && (
          <View style={styles.editHint}>
            <MaterialIcons name="info" size={16} color="#2196F3" />
            <Text style={styles.editHintText}>
              Use ↑ ↓ arrows to rearrange tiles
            </Text>
          </View>
        )}

        <View style={styles.actionsContainer}>
          {dashboardTiles.map((tile, index) => (
            <View key={tile.id}>
              <DashboardTile tile={tile} isDragging={false} />
              {isEditingTiles && index < dashboardTiles.length - 1 && (
                <View style={styles.reorderButtons}>
                  {index > 0 && (
                    <TouchableOpacity
                      style={styles.reorderButton}
                      onPress={async () => {
                        const newTiles = [...dashboardTiles];
                        [newTiles[index], newTiles[index - 1]] = [newTiles[index - 1], newTiles[index]];
                        setDashboardTiles(newTiles);
                        await PreferencesService.updatePreferences({
                          dashboardTileOrder: newTiles.map(t => t.id)
                        });
                      }}
                    >
                      <MaterialIcons name="arrow-upward" size={16} color="#2196F3" />
                    </TouchableOpacity>
                  )}
                  {index < dashboardTiles.length - 1 && (
                    <TouchableOpacity
                      style={styles.reorderButton}
                      onPress={async () => {
                        const newTiles = [...dashboardTiles];
                        [newTiles[index], newTiles[index + 1]] = [newTiles[index + 1], newTiles[index]];
                        setDashboardTiles(newTiles);
                        await PreferencesService.updatePreferences({
                          dashboardTileOrder: newTiles.map(t => t.id)
                        });
                      }}
                    >
                      <MaterialIcons name="arrow-downward" size={16} color="#2196F3" />
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>
          ))}
        </View>

        {/* Quick Access to Recent Entries */}
        <View style={styles.quickActionsContainer}>
          <View style={styles.quickActionsHeader}>
            <Text style={styles.quickActionsTitle}>Quick Actions</Text>
            <View style={styles.quickActionsViewAllButton}>
              <Text style={styles.quickActionsViewAllText}>Recent Activity</Text>
            </View>
          </View>
          
          {recentEntries.filter(entry => {
            const entryDate = new Date(entry.date);
            const oneWeekAgo = new Date();
            oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
            return entryDate >= oneWeekAgo;
          }).length === 0 ? (
            <View style={styles.quickActionsEmptyState}>
              <MaterialIcons name="directions-car" size={48} color="#ccc" />
              <Text style={styles.quickActionsEmptyStateText}>No entries this week</Text>
              <Text style={styles.quickActionsEmptyStateSubtext}>
                Add a mileage entry to see it here
              </Text>
            </View>
          ) : (
            recentEntries
              .filter(entry => {
                const entryDate = new Date(entry.date);
                const oneWeekAgo = new Date();
                oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
                return entryDate >= oneWeekAgo;
              })
              .slice(0, 3)
              .map((entry) => (
              <View key={entry.id} style={styles.quickActionsEntryCard}>
                <View style={styles.quickActionsEntryContent}>
                  <View style={styles.quickActionsEntryInfo}>
                    <Text style={styles.quickActionsEntryDate}>{formatDate(entry.date)}</Text>
                    <Text style={styles.quickActionsEntryRoute}>
                      {formatLocationRoute(entry)}
                    </Text>
                    <Text style={styles.quickActionsEntryPurpose}>{entry.purpose}</Text>
                    <Text style={styles.quickActionsEntryMiles}>{entry.miles.toFixed(1)} mi</Text>
                    {entry.isGpsTracked && (
                      <View style={styles.quickActionsGpsBadge}>
                        <MaterialIcons name="gps-fixed" size={12} color="#4CAF50" />
                        <Text style={styles.quickActionsGpsText}>GPS Tracked</Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.quickActionsButtonContainer}>
                    <TouchableOpacity
                      style={styles.quickActionsEditButton}
                      onPress={() => handleEditEntry(entry.id)}
                    >
                      <MaterialIcons name="edit" size={18} color="#2196F3" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.quickActionsDeleteButton}
                      onPress={() => handleDeleteEntry(entry.id)}
                    >
                      <MaterialIcons name="delete" size={18} color="#f44336" />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            ))
          )}
        </View>

      </ScrollView>
      </View>

      {/* Modal for editing base address */}
      <Modal
        visible={showBaseAddressModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowBaseAddressModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={dynamicStyles.modalContent}>
            <Text style={dynamicStyles.modalTitle}>Edit Base Address</Text>
            
            <TextInput
              style={dynamicStyles.textInput}
              value={filterPlaceholderText(baseAddressInput)}
              onChangeText={setBaseAddressInput}
              placeholder="Enter your base address..."
              multiline={true}
              numberOfLines={3}
            />
            
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={dynamicStyles.modalButtonSecondary}
                onPress={() => setShowBaseAddressModal(false)}
              >
                <Text style={dynamicStyles.modalButtonSecondaryText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={dynamicStyles.modalButtonPrimary}
                onPress={handleSaveBaseAddress}
              >
                <Text style={dynamicStyles.modalButtonPrimaryText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Cost Centers Modal */}
      <Modal
        visible={showCostCentersModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowCostCentersModal(false)}
      >
        <View style={styles.costCentersModalOverlay}>
          <View style={dynamicStyles.modalContent}>
            <View style={styles.costCentersModalHeader}>
              <Text style={dynamicStyles.modalTitle}>Cost Centers</Text>
              <TouchableOpacity onPress={() => setShowCostCentersModal(false)}>
                <MaterialIcons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            
            <Text style={styles.costCentersModalSubtitle}>
              {currentEmployee && currentEmployee.costCenters && currentEmployee.costCenters.length > 1
                ? 'Your assigned cost centers. Select a default for new entries.'
                : 'Your assigned cost center. Contact an administrator to change your cost centers.'}
            </Text>
            
            <ScrollView 
              style={styles.costCentersList} 
              showsVerticalScrollIndicator={false}
              removeClippedSubviews={true}
              scrollEventThrottle={16}
              nestedScrollEnabled={true}
            >
              {/* Assigned Cost Centers - Only show what admin assigned */}
              {selectedCostCenters.length > 0 ? (
                <View style={styles.costCentersSection}>
                  <Text style={styles.costCentersSectionTitle}>Assigned Cost Centers</Text>
                  {selectedCostCenters.map((costCenter) => (
                    <View key={costCenter} style={[styles.costCenterItem, styles.selectedCostCenterItem]}>
                      <View style={styles.costCenterCheckbox}>
                        <MaterialIcons
                          name="check-circle"
                          size={24}
                          color={colors.primary}
                        />
                        <Text style={[styles.costCenterItemText, styles.selectedCostCenterText]}>{costCenter}</Text>
                      </View>
                      
                      {/* Only show default selector if more than one cost center */}
                      {selectedCostCenters.length > 1 && (
                        <TouchableOpacity
                          style={styles.defaultButton}
                          onPress={() => setDefaultCostCenter(
                            defaultCostCenter === costCenter ? '' : costCenter
                          )}
                        >
                          <MaterialIcons
                            name={defaultCostCenter === costCenter ? "star" : "star-border"}
                            size={20}
                            color={defaultCostCenter === costCenter ? "#FFD700" : "#ccc"}
                          />
                          <Text style={[
                            styles.defaultButtonText,
                            { color: defaultCostCenter === costCenter ? "#FFD700" : "#666" }
                          ]}>
                            Default
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  ))}
                </View>
              ) : (
                <View style={styles.costCentersSection}>
                  <Text style={styles.costCentersSectionTitle}>No Cost Centers Assigned</Text>
                  <Text style={[styles.costCenterItemText, { color: '#999', fontStyle: 'italic' }]}>
                    Contact an administrator to assign cost centers to your account.
                  </Text>
                </View>
              )}
            </ScrollView>
            
            <View style={styles.costCentersModalButtons}>
              <TouchableOpacity 
                style={styles.costCentersModalCancelButton} 
                onPress={() => setShowCostCentersModal(false)}
              >
                <Text style={styles.costCentersModalCancelButtonText}>Close</Text>
              </TouchableOpacity>
              {selectedCostCenters.length > 1 && (
                <TouchableOpacity 
                  style={styles.costCentersModalConfirmButton} 
                  onPress={handleSaveCostCenters}
                >
                  <Text style={styles.costCentersModalConfirmButtonText}>Save Default</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </Modal>

      {/* Month/Year Selector Modal */}
      <Modal
        visible={showMonthYearModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowMonthYearModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={dynamicStyles.modalContent}>
            <Text style={dynamicStyles.modalTitle}>Select Month and Year</Text>
            
            <View style={{ marginBottom: 20 }}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: 8 }}>Month</Text>
              <ScrollView style={{ maxHeight: 200 }}>
                {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
                  <TouchableOpacity
                    key={month}
                    style={{
                      paddingVertical: 12,
                      paddingHorizontal: 16,
                      backgroundColor: selectedMonth === month ? colors.primary : 'transparent',
                      borderRadius: 8,
                      marginBottom: 4,
                    }}
                    onPress={() => setSelectedMonth(month)}
                  >
                    <Text style={{
                      fontSize: 16,
                      color: selectedMonth === month ? '#fff' : colors.text,
                      fontWeight: selectedMonth === month ? '600' : '400',
                    }}>
                      {new Date(2024, month - 1, 1).toLocaleDateString('en-US', { month: 'long' })}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <View style={{ marginBottom: 20 }}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: 8 }}>Year</Text>
              <ScrollView style={{ maxHeight: 200 }}>
                {Array.from({ length: 10 }, (_, i) => now.getFullYear() - i).map((year) => (
                  <TouchableOpacity
                    key={year}
                    style={{
                      paddingVertical: 12,
                      paddingHorizontal: 16,
                      backgroundColor: selectedYear === year ? colors.primary : 'transparent',
                      borderRadius: 8,
                      marginBottom: 4,
                    }}
                    onPress={() => setSelectedYear(year)}
                  >
                    <Text style={{
                      fontSize: 16,
                      color: selectedYear === year ? '#fff' : colors.text,
                      fontWeight: selectedYear === year ? '600' : '400',
                    }}>
                      {year}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
            
            {/* Go to Current Month/Year Button */}
            <TouchableOpacity
              style={{
                paddingVertical: 12,
                paddingHorizontal: 16,
                backgroundColor: colors.primary,
                borderRadius: 8,
                marginBottom: 16,
                alignItems: 'center',
              }}
              onPress={() => {
                const currentDate = new Date();
                setSelectedMonth(currentDate.getMonth() + 1);
                setSelectedYear(currentDate.getFullYear());
              }}
            >
              <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>
                Go to Current
              </Text>
            </TouchableOpacity>
            
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={dynamicStyles.modalButtonSecondary} 
                onPress={() => setShowMonthYearModal(false)}
              >
                <Text style={dynamicStyles.modalButtonSecondaryText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={dynamicStyles.modalButtonPrimary} 
                onPress={() => {
                  setShowMonthYearModal(false);
                  // Data will reload automatically via useEffect dependency on selectedMonth/selectedYear
                }}
              >
                <Text style={dynamicStyles.modalButtonPrimaryText}>Done</Text>
              </TouchableOpacity>
            </View>
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
  contentContainer: {
    flex: 1,
    position: 'relative',
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
  baseAddressSection: {
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  baseAddressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  baseAddressText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginRight: 8,
  },
  costCenterSection: {
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  costCenterContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  costCenterText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginRight: 8,
  },
  batchModeIndicator: {
    backgroundColor: '#FF9800',
    paddingHorizontal: 20,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  batchModeText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  batchModeSubtext: {
    color: '#fff',
    fontSize: 12,
    marginLeft: 8,
    flex: 1,
  },
  employeeSelectorSection: {
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  employeeSelectorLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
    fontWeight: '600',
  },
  employeeSelectorContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  employeeOption: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    marginRight: 8,
    marginBottom: 8,
  },
  employeeOptionSelected: {
    backgroundColor: '#2196F3',
    borderColor: '#2196F3',
  },
  employeeOptionText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '600',
  },
  employeeOptionTextSelected: {
    color: '#fff',
  },
  employeeOptionSubtext: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  employeeOptionSubtextSelected: {
    color: '#e3f2fd',
  },
  content: {
    flex: 1,
    padding: 20,
    backgroundColor: 'transparent',
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
    fontSize: 24,
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
  actionsContainer: {
    marginBottom: 20,
  },
  actionButton: {
    backgroundColor: '#4CAF50',
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  actionButtonSecondary: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#2196F3',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  actionButtonSecondaryText: {
    color: '#2196F3',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  recentContainer: {
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  batchControls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  selectAllButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#f0f0f0',
    borderRadius: 6,
  },
  selectAllText: {
    fontSize: 14,
    color: '#2196F3',
    fontWeight: '600',
  },
  batchDeleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#f44336',
    borderRadius: 6,
    marginLeft: 12,
  },
  batchDeleteText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '600',
    marginLeft: 4,
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
  entryCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  selectedEntryCard: {
    backgroundColor: '#e3f2fd',
    borderWidth: 2,
    borderColor: '#2196F3',
  },
  checkboxContainer: {
    marginRight: 12,
    marginTop: 2,
  },
  entryContent: {
    flex: 1,
  },
  entryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  entryInfo: {
    flex: 1,
  },
  entryDate: {
    fontSize: 14,
    color: '#666',
  },
  entryMiles: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  entryActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  editButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#e3f2fd',
    marginRight: 8,
  },
  deleteButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#ffebee',
  },
  entryRoute: {
    fontSize: 16,
    color: '#333',
    marginBottom: 4,
  },
  entryPurpose: {
    fontSize: 14,
    color: '#666',
  },
  gpsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e8f5e8',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginTop: 8,
  },
  gpsText: {
    fontSize: 12,
    color: '#4CAF50',
    fontWeight: '600',
    marginLeft: 4,
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
    marginBottom: 16,
    textAlign: 'center',
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#333',
    backgroundColor: '#f9f9f9',
    marginBottom: 20,
    textAlignVertical: 'top',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalButtonSecondary: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2196F3',
    marginRight: 8,
  },
  modalButtonSecondaryText: {
    color: '#2196F3',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  modalButtonPrimary: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#2196F3',
    marginLeft: 8,
  },
  modalButtonPrimaryText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  odometerContainer: {
    marginBottom: 20,
  },
  odometerCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  odometerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  odometerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  odometerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginLeft: 8,
  },
  editOdometerButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#e3f2fd',
  },
  odometerContent: {
    alignItems: 'center',
  },
  odometerValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2196F3',
    marginBottom: 4,
  },
  odometerDate: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  odometerNotes: {
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
    textAlign: 'center',
  },
  odometerNoReading: {
    fontSize: 16,
    color: '#666',
    marginBottom: 12,
    textAlign: 'center',
  },
  addOdometerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2196F3',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addOdometerText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 4,
  },
  distanceBAContainer: {
    marginHorizontal: 20,
    marginBottom: 12,
  },
  monthlyMileageContainer: {
    marginBottom: 20,
  },
  monthlyMileageButton: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3',
  },
  monthlyMileageContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  monthlyMileageIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#e3f2fd',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  monthlyMileageTextContainer: {
    flex: 1,
  },
  monthlyMileageTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 2,
  },
  monthlyMileageSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  // Quick Actions Styles
  quickActionsContainer: {
    marginTop: 20,
  },
  quickActionsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  quickActionsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  quickActionsViewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  quickActionsViewAllText: {
    fontSize: 14,
    color: '#2196F3',
    fontWeight: '600',
    marginRight: 4,
  },
  quickActionsEntryCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  quickActionsEntryContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  quickActionsEntryInfo: {
    flex: 1,
    marginRight: 12,
  },
  quickActionsEntryDate: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  quickActionsEntryRoute: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
    lineHeight: 18,
  },
  quickActionsEntryPurpose: {
    fontSize: 13,
    color: '#888',
    fontStyle: 'italic',
  },
  quickActionsEntryActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  quickActionsEntryMiles: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginRight: 8,
  },
  quickActionsEditButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#e3f2fd',
  },
  quickActionsButtonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  quickActionsDeleteButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#ffebee',
  },
  quickActionsEmptyState: {
    alignItems: 'center',
    padding: 40,
    backgroundColor: '#fff',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  quickActionsEmptyStateText: {
    fontSize: 16,
    color: '#666',
    marginTop: 12,
    fontWeight: '600',
  },
  quickActionsEmptyStateSubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 4,
    textAlign: 'center',
    lineHeight: 20,
  },
  // Cost Centers Modal Styles
  costCentersModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  costCentersModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  costCentersModalSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
    lineHeight: 20,
  },
  costCenterSearchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 16,
  },
  costCenterSearchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 16,
    color: '#333',
  },
  costCentersList: {
    maxHeight: 300,
    marginBottom: 20,
  },
  costCenterItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    marginBottom: 8,
  },
  costCenterCheckbox: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  costCenterItemText: {
    fontSize: 16,
    color: '#333',
    marginLeft: 12,
    fontWeight: '500',
  },
  defaultButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  defaultButtonText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  costCentersModalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  costCentersModalCancelButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2196F3',
    marginRight: 8,
  },
  costCentersModalCancelButtonText: {
    color: '#2196F3',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  costCentersModalConfirmButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#2196F3',
    marginLeft: 8,
  },
  costCentersModalConfirmButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  importCostCentersButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4CAF50',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
  importCostCentersButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  costCentersSection: {
    marginBottom: 16,
  },
  costCentersSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  selectedCostCenterItem: {
    backgroundColor: '#e8f5e8',
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
  },
  selectedCostCenterText: {
    fontWeight: '600',
    color: '#2e7d32',
  },
  syncStatusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  syncStatusText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 8,
    flex: 1,
  },
  syncStatusUrl: {
    fontSize: 10,
    color: '#999',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  quickActionsGpsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e8f5e8',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  quickActionsGpsText: {
    fontSize: 10,
    color: '#4CAF50',
    fontWeight: '600',
    marginLeft: 4,
  },
  syncStatusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#e8f5e9',
    borderRadius: 8,
    marginHorizontal: 20,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#c8e6c9',
  },
  syncStatusContainerSyncing: {
    backgroundColor: '#e3f2fd',
    borderColor: '#90caf9',
  },
  syncStatusLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  syncStatusTextSyncing: {
    color: '#1976d2',
    fontWeight: '600',
  },
  syncNowButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#e3f2fd',
  },
  syncNowText: {
    marginLeft: 6,
    fontSize: 12,
    fontWeight: '600',
    color: '#2196F3',
  },
  // Draggable Tiles Styles
  actionsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  actionsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  rearrangeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
  },
  rearrangeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2196F3',
    marginLeft: 4,
  },
  editHint: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e3f2fd',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  editHintText: {
    fontSize: 13,
    color: '#1976d2',
    marginLeft: 8,
    flex: 1,
  },
  reorderButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginTop: -6,
    marginBottom: 6,
  },
  reorderButton: {
    backgroundColor: '#e3f2fd',
    padding: 8,
    borderRadius: 20,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Smart Notifications Styles
  notificationsContainer: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 12,
  },
  notificationCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  notificationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  notificationTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  notificationIcon: {
    marginRight: 8,
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  dismissButton: {
    padding: 4,
  },
  notificationMessage: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  notificationAction: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  notificationActionText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default HomeScreen;
