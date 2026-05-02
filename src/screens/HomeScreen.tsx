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
  AppState,
  AppStateStatus,
  InteractionManager,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { MaterialIcons } from '@expo/vector-icons';
import { DatabaseService } from '../services/database';
import { DashboardService } from '../services/dashboardService';
import { PerDiemService } from '../services/perDiemService';
import { PreferencesService } from '../services/preferencesService';
import { DemoDataService } from '../services/demoDataService';
import { PermissionService } from '../services/permissionService';
import RealtimeSyncService from '../services/realtimeSyncService';
import { SyncIntegrationService } from '../services/syncIntegrationService';
import { MileageEntry, Employee, Receipt } from '../types';
import { API_BASE_URL } from '../config/api';
import { debugWarn } from '../config/debug';
import UnifiedHeader from '../components/UnifiedHeader';
import CostCenterSelector from '../components/CostCenterSelector';
import DashboardTile, { TileConfig } from '../components/DashboardTile';
import LogoutService from '../services/logoutService';
import { useTheme } from '../contexts/ThemeContext';
import { CostCenterImportService } from '../services/costCenterImportService';
import { costCenterApiService } from '../services/costCenterApiService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SmartNotificationService, SmartNotification } from '../services/smartNotificationService';
import { hapticLight } from '../utils/haptics';
import { setSyncMonthScope } from '../services/syncScopeService';
import GooglePlacesAddressInput from '../components/GooglePlacesAddressInput';
import { KeyboardAwareScrollView, ScrollToOnFocusView } from '../components/KeyboardAwareScrollView';

const DISMISSED_NOTIFICATIONS_KEY_PREFIX = 'smart_notifications_dismissed_';
const FIRST_LOGIN_PORTAL_TIP_KEY_PREFIX = 'first_login_portal_tip_shown:';

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
// Run heavy backend pull only once per app process; remounting Home after GPS should not
// trigger full employee/mileage re-sync (caused iOS freezes).
let homeInitialBackendSyncDone = false;

function HomeScreen({ navigation, route }: HomeScreenProps) {
  const { colors, isDark } = useTheme();
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
  const [baseAddressStreet, setBaseAddressStreet] = useState('');
  const [baseAddressCity, setBaseAddressCity] = useState('');
  const [baseAddressState, setBaseAddressState] = useState('');
  const [baseAddressZip, setBaseAddressZip] = useState('');
  const [showCostCenterSelector, setShowCostCenterSelector] = useState(false);
  const [showCostCentersModal, setShowCostCentersModal] = useState(false);
  const [selectedCostCenters, setSelectedCostCenters] = useState<string[]>([]);
  const [allCostCenterOptions, setAllCostCenterOptions] = useState<string[]>([]);
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
  const initialLoadDoneRef = useRef(false);
  const isRefreshingLocalRef = useRef(false);
  const isLoadingEmployeeDataRef = useRef(false);
  const realtimeListenersRegisteredRef = useRef(false);
  const dataUpdateListenerRef = useRef<((data: any) => void) | null>(null);
  const notificationListenerRef = useRef<((notification: any) => void) | null>(null);
  const connectionListenerRef = useRef<(() => void) | null>(null);
  const errorListenerRef = useRef<((error: any) => void) | null>(null);
  const [isEditingTiles, setIsEditingTiles] = useState(false);
  const [dashboardTiles, setDashboardTiles] = useState<TileConfig[]>([]);
  
  // Month/Year selector state
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [showMonthYearModal, setShowMonthYearModal] = useState(false);
  const selectedMonthRef = useRef(selectedMonth);
  const selectedYearRef = useRef(selectedYear);
  selectedMonthRef.current = selectedMonth;
  selectedYearRef.current = selectedYear;

  useEffect(() => {
    setSyncMonthScope(selectedMonth, selectedYear);
  }, [selectedMonth, selectedYear]);
  
  // Smart notifications state
  const [smartNotifications, setSmartNotifications] = useState<SmartNotification[]>([]);
  const [dismissedNotifications, setDismissedNotifications] = useState<Set<string>>(new Set());
  
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
      maxHeight: '88%',
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
      paddingVertical: 12,
      paddingHorizontal: 14,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
      borderLeftWidth: 4,
      borderLeftColor: colors.primary,
    },
    monthlyMileageTitle: {
      fontSize: 15,
      fontWeight: 'bold',
      color: colors.text,
    },
    quickActionsTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: colors.text,
    },
    rearrangeButtonThemed: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 8,
      backgroundColor: isDark ? colors.card : '#f0f0f0',
    },
    rearrangeButtonTextThemed: {
      fontSize: 14,
      fontWeight: '600',
      marginLeft: 4,
      color: colors.primary,
    },
    editHintThemed: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 12,
      borderRadius: 8,
      marginBottom: 12,
      backgroundColor: isDark ? 'rgba(33, 150, 243, 0.15)' : '#e3f2fd',
    },
    editHintTextThemed: {
      fontSize: 13,
      marginLeft: 8,
      color: isDark ? '#90CAF9' : '#1976d2',
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
        color: '#FFFFFF',
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
      'hours-description': {
        id: 'hours-description',
        icon: 'access-time',
        label: 'Hours & Description',
        color: colors.primary,
        onPress: handleViewHoursWorked,
      },
      'per-diem': {
        id: 'per-diem',
        icon: 'attach-money',
        label: 'Per Diem',
        color: colors.primary,
        onPress: () =>
          navigation.navigate({
            name: 'PerDiem',
            params: getSelectedMonthParams(),
            merge: true,
          }),
      },
      'saved-addresses': {
        id: 'saved-addresses',
        icon: 'place',
        label: 'Saved Addresses',
        color: colors.primary,
        onPress: () => navigation.navigate('SavedAddresses'),
      },
    };

    // Get saved order from preferences
    const prefs = await PreferencesService.getPreferences();
    const savedOrder = prefs.dashboardTileOrder;

    // Build tiles array in saved order; append any new tile ids not in saved order
    const allIds = Object.keys(allTiles);
    const order = [
      ...savedOrder.filter(id => allTiles[id]),
      ...allIds.filter(id => !savedOrder.includes(id)),
    ];
    const orderedTiles = order.map(id => allTiles[id]).filter((tile): tile is TileConfig => tile !== undefined);

    return orderedTiles;
  };

  useEffect(() => {
    loadData();
    initializeTiles().then(setDashboardTiles);
  }, []);

  /** Keep tile icon/text colors in sync when theme changes */
  useEffect(() => {
    setDashboardTiles(prev => {
      if (prev.length === 0) return prev;
      return prev.map(tile => ({
        ...tile,
        color: tile.isPrimary ? '#FFFFFF' : colors.primary,
      }));
    });
  }, [colors.primary, isDark]);

  // Reload data when selected month/year changes
  useEffect(() => {
    if (currentEmployee) {
      loadEmployeeData(currentEmployee.id, currentEmployee);
    }
  }, [selectedMonth, selectedYear]);

  // When returning to this screen, refresh dashboard stats so tiles show latest data after sync.
  // Defer until after navigation transition — running refresh immediately can freeze iOS when returning from GPS.
  useFocusEffect(
    React.useCallback(() => {
      if (!initialLoadDoneRef.current) return;
      const task = InteractionManager.runAfterInteractions(() => {
        const delay = Platform.OS === 'ios' ? 600 : 100;
        setTimeout(() => refreshLocalDataOnly(), delay);
      });
      return () => task.cancel();
    }, [])
  );

  // When app comes to foreground, refresh dashboard so stats stay in sync (e.g. after background sync).
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (nextState === 'active' && initialLoadDoneRef.current && currentEmployee?.id) {
        loadEmployeeData(currentEmployee.id, currentEmployee);
      }
    });
    return () => subscription.remove();
  }, [currentEmployee?.id]);

  // One-time tip after first login: explore the app, then use the web portal from a computer.
  useEffect(() => {
    if (loading || !currentEmployee?.id) return;
    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const interactionHandle = InteractionManager.runAfterInteractions(() => {
      timeoutId = setTimeout(async () => {
        if (cancelled) return;
        try {
          const key = `${FIRST_LOGIN_PORTAL_TIP_KEY_PREFIX}${currentEmployee.id}`;
          const shown = await AsyncStorage.getItem(key);
          if (shown === '1' || cancelled) return;
          Alert.alert(
            'Welcome',
            'Take a few minutes to explore the features in this app.\n\nWhen you can, open the Staff web portal from your computer\'s browser (monthly report, approvals, and more):\nhttps://oxford-mileage-tracker.vercel.app/login\n\nHow-to PDFs: https://oxford-mileage-tracker.vercel.app/support.html',
            [
              {
                text: 'OK',
                onPress: () => AsyncStorage.setItem(key, '1'),
              },
            ]
          );
        } catch {
          // ignore storage failures
        }
      }, 500);
    });
    return () => {
      cancelled = true;
      interactionHandle.cancel();
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [loading, currentEmployee?.id]);

  // Refresh only local data without syncing from backend
  const refreshLocalDataOnly = async () => {
    if (isRefreshingLocalRef.current) {
      return;
    }
    isRefreshingLocalRef.current = true;
    try {
      const employee = await DatabaseService.getCurrentEmployee();
      if (employee) {
        setCurrentEmployee(employee);
        setViewingEmployee(employee);
        await loadEmployeeData(employee.id, employee);
        // Check for smart notifications when refreshing
        await checkSmartNotifications(employee.id);
      }
    } catch (error) {
      console.error('Error refreshing local data:', error);
    } finally {
      isRefreshingLocalRef.current = false;
    }
  };

  const registerRealtimeListeners = (employee: Employee) => {
    if (realtimeListenersRegisteredRef.current) {
      return;
    }

    const realtimeSync = RealtimeSyncService.getInstance();

    dataUpdateListenerRef.current = (data: any) => {
      console.log('📡 Real-time data update received:', data);
      // Refresh dashboard data when updates are received
      void loadEmployeeData(employee.id, employee);
    };
    notificationListenerRef.current = (notification: any) => {
      console.log('📢 Real-time notification received:', notification);
      // Notifications are already shown by the service
    };
    connectionListenerRef.current = () => {
      console.log('✅ Real-time sync connected');
    };
    errorListenerRef.current = (error: any) => {
      console.error('❌ Real-time sync error:', error);
    };

    realtimeSync.on('data_update', dataUpdateListenerRef.current);
    realtimeSync.on('notification', notificationListenerRef.current);
    realtimeSync.on('connection_established', connectionListenerRef.current);
    realtimeSync.on('error', errorListenerRef.current);
    realtimeListenersRegisteredRef.current = true;
  };

  useEffect(() => {
    return () => {
      const realtimeSync = RealtimeSyncService.getInstance();
      if (dataUpdateListenerRef.current) {
        realtimeSync.off('data_update', dataUpdateListenerRef.current);
      }
      if (notificationListenerRef.current) {
        realtimeSync.off('notification', notificationListenerRef.current);
      }
      if (connectionListenerRef.current) {
        realtimeSync.off('connection_established', connectionListenerRef.current);
      }
      if (errorListenerRef.current) {
        realtimeSync.off('error', errorListenerRef.current);
      }
      realtimeListenersRegisteredRef.current = false;
    };
  }, []);

  /**
   * After user save/delete: push local changes to backend, then refresh UI from local only.
   * Backend is source of truth; we never pull immediately after a save (avoids overwriting what the user just did).
   */
  const refreshAfterLocalChange = async () => {
    try {
      await SyncIntegrationService.processSyncQueue();
      await refreshLocalDataOnly();
    } catch (error) {
      console.error('Error pushing changes and refreshing:', error);
    }
  };

  /** Manual sync (tap sync bar): push pending then pull from backend. Helps when server was unreachable (e.g. cold start on Android). */
  const handleManualSync = async () => {
    const employee = currentEmployee;
    if (!employee?.id || isSyncing || homeScreenIsSyncing) return;
    void hapticLight();
    homeScreenIsSyncing = true;
    setIsSyncing(true);
    try {
      const { ApiSyncService } = await import('../services/apiSyncService');
      await SyncIntegrationService.processSyncQueue();
      const syncResult = await ApiSyncService.syncFromBackend(employee.id);
      if (syncResult.success) {
        setLastSyncTime(new Date());
        await loadEmployeeData(employee.id, employee);
      } else {
        Alert.alert('Sync failed', syncResult.error || 'Could not reach server. Check connection and try again.');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      Alert.alert('Sync failed', msg);
    } finally {
      homeScreenIsSyncing = false;
      setIsSyncing(false);
    }
  };

  const loadEmployeeData = async (employeeId: string, employeeParam?: Employee) => {
    // Prevent concurrent dashboard loads. iOS was freezing when multiple triggers
    // (focus/appstate/realtime) fired close together after GPS completion.
    if (isLoadingEmployeeDataRef.current) {
      return;
    }
    isLoadingEmployeeDataRef.current = true;
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
      
      // Calculate total expenses
      const expenseBreakdown = PerDiemService.getExpenseBreakdown(
        dashboardData.monthlyStats.totalMiles,
        dashboardData.monthlyStats.totalReceipts,
        perDiemFromReceipts
      );
      
      setTotalExpensesThisMonth(expenseBreakdown.totalExpenses);
      
    } catch (error) {
      console.error('Error loading employee data:', error);
    } finally {
      isLoadingEmployeeDataRef.current = false;
    }
  };


  const checkSmartNotifications = async (
    employeeId: string,
    dismissedSet?: Set<string>
  ) => {
    try {
      const notifications = await SmartNotificationService.checkNotifications(employeeId);
      const dismissed = dismissedSet ?? dismissedNotifications;
      const activeNotifications = notifications.filter(
        notification => !dismissed.has(notification.id)
      );
      setSmartNotifications(activeNotifications);
    } catch (error) {
      console.error('Error checking smart notifications:', error);
    }
  };

  const loadDismissedNotificationIds = async (
    employeeId: string
  ): Promise<Set<string>> => {
    try {
      const key = `${DISMISSED_NOTIFICATIONS_KEY_PREFIX}${employeeId}`;
      const raw = await AsyncStorage.getItem(key);
      if (!raw) return new Set();
      const arr = JSON.parse(raw) as string[];
      return new Set(Array.isArray(arr) ? arr : []);
    } catch {
      return new Set();
    }
  };

  const persistDismissedNotificationIds = async (
    employeeId: string,
    ids: Set<string>
  ) => {
    try {
      const key = `${DISMISSED_NOTIFICATIONS_KEY_PREFIX}${employeeId}`;
      await AsyncStorage.setItem(key, JSON.stringify([...ids]));
    } catch (e) {
      console.error('Error persisting dismissed notifications:', e);
    }
  };

  const handleDismissNotification = (notificationId: string) => {
    const next = new Set(dismissedNotifications).add(notificationId);
    setDismissedNotifications(next);
    setSmartNotifications(prev => prev.filter(n => n.id !== notificationId));
    if (currentEmployee?.id) {
      persistDismissedNotificationIds(currentEmployee.id, next);
    }
  };

  const handleNotificationAction = (notification: SmartNotification) => {
    if (notification.actionRoute) {
      navigation.navigate(notification.actionRoute);
    }
    handleDismissNotification(notification.id);
  };

  /**
   * First load only: pull from backend (source of truth) then show data.
   * Do not call after user save/delete — use refreshAfterLocalChange (push only) instead.
   */
  const loadData = async () => {
    try {
      setLoading(true);
      initialLoadDoneRef.current = false;

      await new Promise(resolve => setTimeout(resolve, 200));

      let employee = await DatabaseService.getCurrentEmployee();
      if (!employee) {
        await new Promise(resolve => setTimeout(resolve, 500));
        employee = await DatabaseService.getCurrentEmployee();
      }
      if (!employee) {
        setLoading(false);
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
      registerRealtimeListeners(employee);

      // Sync from backend only once per app process (with timeout so app doesn't spin forever).
      // Re-running this on every Home remount after GPS end causes large DB churn and UI stalls on iOS.
      const INITIAL_SYNC_TIMEOUT_MS = Platform.OS === 'android' ? 35000 : 20000;
      if (!homeInitialBackendSyncDone && !homeScreenIsSyncing) {
        homeScreenIsSyncing = true;
        setIsSyncing(true);
        try {
          const { ApiSyncService } = await import('../services/apiSyncService');
          const syncPromise = ApiSyncService.syncFromBackend(employee.id);
          const timeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Initial sync timed out')), INITIAL_SYNC_TIMEOUT_MS)
          );
          const syncResult = await Promise.race([syncPromise, timeoutPromise]);
          if (syncResult?.success) {
            setLastSyncTime(new Date());
          } else if (syncResult && !syncResult.success) {
            debugWarn('⚠️ Initial sync completed with some errors (this is normal):', syncResult.error);
          }
        } catch (syncError) {
          const msg = syncError instanceof Error ? syncError.message : 'Unknown error';
          debugWarn('⚠️ Initial backend sync failed or timed out (showing local data):', msg);
        } finally {
          homeScreenIsSyncing = false;
          setIsSyncing(false);
        }
        homeInitialBackendSyncDone = true;
      }

      await loadEmployeeData(employee.id, employee);

      const loadedDismissed = await loadDismissedNotificationIds(employee.id);
      setDismissedNotifications(loadedDismissed);
      await checkSmartNotifications(employee.id, loadedDismissed);

      initialLoadDoneRef.current = true;
    } catch (error) {
      console.error('Error loading data:', error);
      if (currentEmployee) {
        Alert.alert('Error', 'Failed to load data');
      }
      initialLoadDoneRef.current = true;
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

  const getSelectedMonthParams = () => ({
    selectedMonth: selectedMonthRef.current,
    selectedYear: selectedYearRef.current,
  });

  const handleViewReceipts = () => {
    navigation.navigate({
      name: 'Receipts',
      params: getSelectedMonthParams(),
      merge: true,
    });
  };

  const handleViewHoursWorked = () => {
    navigation.navigate({
      name: 'DailyHours',
      params: getSelectedMonthParams(),
      merge: true,
    });
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
              await refreshAfterLocalChange();
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
    void hapticLight();
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

  const parseBaseAddressForMobile = (full: string): { street: string; city: string; state: string; zip: string } => {
    const raw = (full || '').trim();
    if (!raw) return { street: '', city: '', state: '', zip: '' };
    const parts = raw.split(',').map((p) => p.trim()).filter(Boolean);
    if (parts.length >= 3) {
      const last = parts[parts.length - 1];
      const match = last.match(/^([A-Za-z]{2})\s+(\d{5}(-\d{4})?)\s*$/);
      if (match) {
        return {
          street: parts.slice(0, -2).join(', '),
          city: parts[parts.length - 2],
          state: match[1],
          zip: match[2],
        };
      }
    }
    if (parts.length >= 2) {
      const last = parts[parts.length - 1];
      const match = last.match(/^([A-Za-z]{2})\s+(\d{5}(-\d{4})?)\s*$/);
      if (match) {
        return { street: parts[0], city: '', state: match[1], zip: match[2] };
      }
    }
    return { street: raw, city: '', state: '', zip: '' };
  };

  const handleEditBaseAddress = () => {
    if (currentEmployee) {
      const parsed = parseBaseAddressForMobile(filterPlaceholderText(currentEmployee.baseAddress || ''));
      setBaseAddressStreet(parsed.street);
      setBaseAddressCity(parsed.city);
      setBaseAddressState(parsed.state);
      setBaseAddressZip(parsed.zip);
      setShowBaseAddressModal(true);
    }
  };

  const handleEditCostCenters = async () => {
    if (currentEmployee) {
      const globalCostCenters = await costCenterApiService.getCostCenterNames();
      const fallbackAssigned = currentEmployee.costCenters || [];
      const options = globalCostCenters.length > 0 ? globalCostCenters : fallbackAssigned;
      setAllCostCenterOptions(options);

      const currentSelections = currentEmployee.selectedCostCenters || [];
      const validSelections = currentSelections.filter((cc) => options.includes(cc));
      const initialSelections = validSelections.length > 0 ? validSelections : (fallbackAssigned.length > 0 ? fallbackAssigned : options);
      setSelectedCostCenters(initialSelections);
      // Set default to current default, or first cost center if only one
      const currentDefault = currentEmployee.defaultCostCenter || '';
      setDefaultCostCenter(
        initialSelections.includes(currentDefault) 
          ? currentDefault 
          : (initialSelections.length === 1
            ? initialSelections[0]
            : '')
      );
      setShowCostCentersModal(true);
    }
  };

  const handleSaveCostCenters = async () => {
    if (!currentEmployee) return;

    try {
      const options = allCostCenterOptions.length > 0 ? allCostCenterOptions : (currentEmployee.costCenters || []);
      const validSelections = selectedCostCenters.filter((cc) => options.includes(cc));
      if (validSelections.length === 0) {
        Alert.alert('Selection required', 'Select at least one cost center.');
        return;
      }
      const newDefault = validSelections.length === 1
        ? validSelections[0]
        : (defaultCostCenter || '');
      const finalDefault = validSelections.includes(newDefault) ? newDefault : validSelections[0];
      
      await DatabaseService.updateEmployee(currentEmployee.id, {
        defaultCostCenter: finalDefault,
        selectedCostCenters: validSelections
      });
      
      setCurrentEmployee(prev => prev ? { 
        ...prev, 
        defaultCostCenter: finalDefault,
        selectedCostCenters: validSelections
      } : null);
      
      setShowCostCentersModal(false);
      Alert.alert('Success', 'Cost centers updated successfully');
    } catch (error) {
      console.error('Error updating cost centers:', error);
      Alert.alert('Error', 'Failed to update cost centers');
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
              await refreshAfterLocalChange();
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
              await refreshAfterLocalChange();
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
    const street = (baseAddressStreet || '').trim();
    if (!currentEmployee || !street) {
      Alert.alert('Error', 'Please enter at least a street address');
      return;
    }
    const city = (baseAddressCity || '').trim();
    const state = (baseAddressState || '').trim().toUpperCase().slice(0, 2);
    const zip = (baseAddressZip || '').trim().replace(/\D/g, '').slice(0, 10);
    const combined = city && state && zip
      ? `${street}, ${city}, ${state} ${zip}`
      : state && zip
        ? `${street}, ${state} ${zip}`
        : street;

    try {
      await DatabaseService.updateEmployee(currentEmployee.id, {
        baseAddress: combined
      });
      setCurrentEmployee({
        ...currentEmployee,
        baseAddress: combined
      });
      setShowBaseAddressModal(false);
      setBaseAddressStreet('');
      setBaseAddressCity('');
      setBaseAddressState('');
      setBaseAddressZip('');
      Alert.alert('Success', 'Base address updated successfully');
    } catch (error) {
      console.error('❌ HomeScreen: Error updating base address:', error);
      Alert.alert('Error', 'Failed to update base address');
    }
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
        showHomeButton={false}
        title={viewingEmployee?.id === currentEmployee?.id 
          ? `Welcome,\n${currentEmployee?.name || 'User'}`
          : `Viewing:\n${viewingEmployee?.name || 'Employee'}`
        }
        leftButton={{
          icon: 'settings',
          onPress: () => navigation.navigate('Settings', { currentEmployeeId: currentEmployee?.id }),
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
        }}
      />
      
      {/* Base Address Section - always show so user can set or edit */}
      <View style={dynamicStyles.baseAddressSection}>
        <TouchableOpacity onPress={handleEditBaseAddress} style={styles.baseAddressContainer}>
          <Text style={dynamicStyles.baseAddressText}>
            BA: {currentEmployee?.baseAddress?.trim() || 'Not set — tap to add'}
          </Text>
          <MaterialIcons name="edit" size={16} color={colors.primary} />
        </TouchableOpacity>
      </View>

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
        <TouchableOpacity onPress={() => { void hapticLight(); setShowMonthYearModal(true); }} style={styles.costCenterContainer}>
          <Text style={dynamicStyles.costCenterText}>
            Viewing: {new Date(selectedYear, selectedMonth - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </Text>
          <MaterialIcons name="edit" size={16} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Smart Notifications */}
      {smartNotifications.length > 0 ? (
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
                {notification.actionLabel ? (
                  <TouchableOpacity 
                    onPress={() => handleNotificationAction(notification)}
                    style={[styles.notificationAction, { backgroundColor: priorityColor }]}
                  >
                    <Text style={styles.notificationActionText}>{notification.actionLabel}</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            );
          })}
        </View>
      ) : null}

      {/* Batch Mode Indicator */}
      {isBatchMode ? (
        <View style={styles.batchModeIndicator}>
          <MaterialIcons name="checklist" size={20} color="#fff" />
          <Text style={styles.batchModeText}>Batch Selection Mode</Text>
          <Text style={styles.batchModeSubtext}>
            Tap checkboxes to select items, then use Delete button
          </Text>
        </View>
      ) : null}

      {/* Employee Selector */}
      {availableEmployees.length > 1 ? (
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
                {employee.position ? (
                  <Text style={[
                    styles.employeeOptionSubtext,
                    viewingEmployee?.id === employee.id && styles.employeeOptionSubtextSelected
                  ]}>
                    {employee.position}
                  </Text>
                ) : null}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ) : null}

      <View style={styles.contentContainer}>
        <ScrollView 
          style={styles.content}
          showsVerticalScrollIndicator={false}
          removeClippedSubviews={true}
          scrollEventThrottle={16}
          keyboardShouldPersistTaps="handled"
        >
        {/* Monthly Mileage Link */}
        <View style={styles.monthlyMileageContainer}>
          <TouchableOpacity 
            style={dynamicStyles.monthlyMileageButton}
            onPress={() => {
              void hapticLight();
              navigation.navigate({
                name: 'MileageEntries',
                params: { selectedMonth, selectedYear },
                merge: true,
              });
            }}
            activeOpacity={0.7}
          >
            <View style={styles.monthlyMileageContent}>
              <View style={styles.monthlyMileageIconContainer}>
                <MaterialIcons name="speed" size={28} color={colors.primary} />
              </View>
              <View style={styles.monthlyMileageTextContainer}>
                <Text style={dynamicStyles.monthlyMileageTitle}>Monthly Mileage Summary</Text>
              </View>
              <MaterialIcons name="chevron-right" size={24} color={colors.textSecondary} />
            </View>
          </TouchableOpacity>
        </View>


        {/* Sync status - tappable to retry when never synced or to refresh */}
        <TouchableOpacity
          style={[styles.syncStatusContainer, isSyncing && styles.syncStatusContainerSyncing]}
          onPress={handleManualSync}
          disabled={isSyncing}
          activeOpacity={0.7}
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
                  ? `Last synced: ${lastSyncTime.toLocaleTimeString()} • Tap to refresh` 
                  : "Tap to sync"}
            </Text>
          </View>
        </TouchableOpacity>

        {/* Quick Actions */}
        <View style={styles.actionsHeader}>
          <Text style={dynamicStyles.quickActionsTitle}>Quick Actions</Text>
          <TouchableOpacity
            style={dynamicStyles.rearrangeButtonThemed}
            onPress={() => {
              void hapticLight();
              setIsEditingTiles(!isEditingTiles);
            }}
          >
            <MaterialIcons 
              name={isEditingTiles ? 'check' : 'edit'} 
              size={20} 
              color={isEditingTiles ? colors.secondary : colors.primary} 
            />
            <Text style={[dynamicStyles.rearrangeButtonTextThemed, isEditingTiles && { color: colors.secondary }]}>
              {isEditingTiles ? 'Done' : 'Rearrange'}
            </Text>
          </TouchableOpacity>
        </View>

        {isEditingTiles ? (
          <View style={dynamicStyles.editHintThemed}>
            <MaterialIcons name="info" size={16} color={colors.primary} />
            <Text style={dynamicStyles.editHintTextThemed}>
              Use ↑ ↓ arrows to rearrange tiles
            </Text>
          </View>
        ) : null}

        <View style={styles.actionsContainer}>
          {dashboardTiles.map((tile, index) => (
            <View key={tile.id}>
              <DashboardTile tile={tile} isDragging={false} />
              {isEditingTiles && index < dashboardTiles.length - 1 ? (
                <View style={styles.reorderButtons}>
                  {index > 0 ? (
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
                  ) : null}
                  {index < dashboardTiles.length - 1 ? (
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
                  ) : null}
                </View>
              ) : null}
            </View>
          ))}
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
        <KeyboardAwareScrollView contentContainerStyle={styles.modalOverlay} keyboardShouldPersistTaps="handled">
          <View style={dynamicStyles.modalContent}>
            <Text style={dynamicStyles.modalTitle}>Edit Base Address</Text>
            
            <ScrollToOnFocusView>
              <GooglePlacesAddressInput
                value={baseAddressStreet}
                onChangeText={setBaseAddressStreet}
                placeholder="Street Address"
                style={dynamicStyles.textInput}
                onPlaceSelected={(details) => {
                  const parsed = parseBaseAddressForMobile(details.formattedAddress);
                  setBaseAddressStreet(parsed.street || details.formattedAddress);
                  setBaseAddressCity(parsed.city);
                  setBaseAddressState(parsed.state);
                  setBaseAddressZip(parsed.zip);
                }}
              />
            </ScrollToOnFocusView>
            <ScrollToOnFocusView>
              <TextInput
                style={dynamicStyles.textInput}
                value={baseAddressCity}
                onChangeText={setBaseAddressCity}
                placeholder="City"
              />
            </ScrollToOnFocusView>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <ScrollToOnFocusView>
                <TextInput
                  style={[dynamicStyles.textInput, { flex: 1 }]}
                  value={baseAddressState}
                  onChangeText={(t) => setBaseAddressState(t.toUpperCase().slice(0, 2))}
                  placeholder="State (e.g. NC)"
                  maxLength={2}
                />
              </ScrollToOnFocusView>
              <ScrollToOnFocusView>
                <TextInput
                  style={[dynamicStyles.textInput, { flex: 1 }]}
                  value={baseAddressZip}
                  onChangeText={(t) => setBaseAddressZip(t.replace(/\D/g, '').slice(0, 10))}
                  placeholder="ZIP Code"
                  keyboardType="number-pad"
                  maxLength={10}
                />
              </ScrollToOnFocusView>
            </View>
            
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
        </KeyboardAwareScrollView>
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
              Choose any cost centers you want to use, then pick your default for new entries.
            </Text>
            
            <ScrollView 
              style={styles.costCentersList} 
              showsVerticalScrollIndicator={false}
              removeClippedSubviews={true}
              scrollEventThrottle={16}
              nestedScrollEnabled={true}
            >
              {/* Assigned options from admin; selected ones appear first */}
              {allCostCenterOptions.length > 0 ? (
                <View style={styles.costCentersSection}>
                  <Text style={styles.costCentersSectionTitle}>Available Cost Centers (select all that apply)</Text>
                  {[...allCostCenterOptions]
                    .sort((a, b) => {
                      const aSelected = selectedCostCenters.includes(a) ? 0 : 1;
                      const bSelected = selectedCostCenters.includes(b) ? 0 : 1;
                      if (aSelected !== bSelected) return aSelected - bSelected;
                      return a.localeCompare(b);
                    })
                    .map((costCenter) => {
                      const isSelected = selectedCostCenters.includes(costCenter);
                      return (
                    <View key={costCenter} style={[styles.costCenterItem, isSelected && styles.selectedCostCenterItem]}>
                      <TouchableOpacity
                        style={styles.costCenterCheckbox}
                        onPress={() => {
                          setSelectedCostCenters((prev) => {
                            const next = prev.includes(costCenter)
                              ? prev.filter((cc) => cc !== costCenter)
                              : [...prev, costCenter];
                            if (!next.includes(defaultCostCenter)) {
                              setDefaultCostCenter(next[0] || '');
                            }
                            return next;
                          });
                        }}
                      >
                        <MaterialIcons
                          name={isSelected ? "check-box" : "check-box-outline-blank"}
                          size={24}
                          color={isSelected ? colors.primary : "#999"}
                        />
                        <Text style={[styles.costCenterItemText, isSelected && styles.selectedCostCenterText]}>{costCenter}</Text>
                      </TouchableOpacity>
                      
                      {/* Only show default selector if more than one cost center */}
                      {selectedCostCenters.length > 1 && isSelected ? (
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
                      ) : null}
                    </View>
                      );
                    })}
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
              <TouchableOpacity 
                style={styles.costCentersModalConfirmButton} 
                onPress={handleSaveCostCenters}
              >
                <Text style={styles.costCentersModalConfirmButtonText}>Save</Text>
              </TouchableOpacity>
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
  monthlyMileageContainer: {
    marginBottom: 20,
  },
  monthlyMileageButton: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
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
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#e3f2fd',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  monthlyMileageTextContainer: {
    flex: 1,
  },
  monthlyMileageTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#333',
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
  syncStatusText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 8,
    flex: 1,
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
