import React, { useState, useEffect } from 'react';
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
import { DemoDataService } from '../services/demoDataService';
import { PermissionService } from '../services/permissionService';
import { MileageEntry, Employee, Receipt } from '../types';
import { formatLocationRoute } from '../utils/locationFormatter';
import UnifiedHeader from '../components/UnifiedHeader';
import CostCenterSelector from '../components/CostCenterSelector';
import LogoutService from '../services/logoutService';
import { useTheme } from '../contexts/ThemeContext';
import { BaseAddressDetectionService } from '../services/baseAddressDetectionService';
import { CostCenterImportService } from '../services/costCenterImportService';
import { COST_CENTERS } from '../constants/costCenters';

interface HomeScreenProps {
  navigation: any;
  route?: {
    params?: {
      currentEmployeeId?: string;
    };
  };
}

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
  const [refreshing, setRefreshing] = useState(false);
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

  const handleManualSync = async () => {
    if (isSyncing) {
      Alert.alert('Sync in Progress', 'A sync operation is already running. Please wait...');
      return;
    }

    try {
      setIsSyncing(true);
      console.log('🔄 HomeScreen: Manual sync triggered');
      
      // Force immediate sync of pending changes
      const { SyncIntegrationService } = await import('../services/syncIntegrationService');
      const success = await SyncIntegrationService.forceSync();
      
      if (success) {
        setLastSyncTime(new Date());
        Alert.alert('Sync Complete', 'All data has been synced to the backend successfully!');
        console.log('✅ HomeScreen: Manual sync completed successfully');
        
        // Reload data to show any updates from backend
        await loadData();
      } else {
        Alert.alert('Sync Failed', 'Failed to sync data to backend. Please check your connection and try again.');
        console.error('❌ HomeScreen: Manual sync failed');
      }
    } catch (error) {
      console.error('❌ HomeScreen: Error during manual sync:', error);
      Alert.alert('Sync Error', 'An error occurred during sync: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Refresh data when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      loadData();
    }, [])
  );

  const loadEmployeeData = async (employeeId: string, employeeParam?: Employee) => {
    try {
      
      // Use provided employee parameter or fall back to currentEmployee
      const employee = employeeParam || currentEmployee;
      if (!employee || employee.id !== employeeId) {
        console.error('Employee not found or ID mismatch:', { employeeId, employee: employee?.name });
        return;
      }


      // Get all dashboard data using unified service
      const dashboardData = await DashboardService.getDashboardStats(employeeId);
      
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
      
      // Show warning if approaching or exceeding $350 monthly max
      if (perDiemFromReceipts >= 350) {
        console.warn('⚠️ Per Diem limit reached: $350 monthly maximum');
      } else if (perDiemFromReceipts >= 300) {
        console.warn(`⚠️ Approaching Per Diem limit: $${perDiemFromReceipts.toFixed(2)} / $350`);
      }

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

  const handleEditEntry = (entryId: string) => {
    // Navigate to MileageEntryScreen with the entry ID for editing
    navigation.navigate('MileageEntry', { 
      entryId: entryId,
      isEditing: true 
    });
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
      
      // Sync data from backend on app startup
      if (!HomeScreen.isSyncing) {
        HomeScreen.isSyncing = true;
        try {
          const { ApiSyncService } = await import('../services/apiSyncService');
          const syncResult = await ApiSyncService.syncFromBackend(employee.id);
          if (syncResult.success) {
            setLastSyncTime(new Date());
          }
        } catch (syncError) {
          console.error('❌ Error during backend sync:', syncError);
        } finally {
          HomeScreen.isSyncing = false;
        }
      }
      
      // Load data for the viewing employee
      await loadEmployeeData(employee.id, employee);
      
      // Check for base address suggestions
      await checkBaseAddressSuggestion(employee);
      
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

  const handleViewReports = () => {
    navigation.navigate('Reports');
  };

  const handleGpsTracking = () => {
    navigation.navigate('GpsTracking');
  };

  const handleAddReceipt = () => {
    navigation.navigate('AddReceipt');
  };

  const handleViewReceipts = () => {
    navigation.navigate('Receipts');
  };

  const handleViewHoursWorked = () => {
    navigation.navigate('HoursWorked');
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
      setSelectedCostCenters(currentEmployee.selectedCostCenters || []);
      setDefaultCostCenter(currentEmployee.defaultCostCenter || '');
      setShowCostCentersModal(true);
    }
  };

  const handleCostCenterToggle = (costCenter: string) => {
    setSelectedCostCenters(prev => 
      prev.includes(costCenter) 
        ? prev.filter(cc => cc !== costCenter)
        : [...prev, costCenter]
    );
  };

  const handleSaveCostCenters = async () => {
    if (!currentEmployee) return;

    try {
      await DatabaseService.updateEmployee(currentEmployee.id, {
        selectedCostCenters,
        defaultCostCenter: defaultCostCenter || (selectedCostCenters.length === 1 ? selectedCostCenters[0] : '')
      });
      
      setCurrentEmployee(prev => prev ? { 
        ...prev, 
        selectedCostCenters, 
        defaultCostCenter: defaultCostCenter || (selectedCostCenters.length === 1 ? selectedCostCenters[0] : '')
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
          ? `Welcome, ${currentEmployee?.name || 'User'}`
          : `Viewing: ${viewingEmployee?.name || 'Employee'}`
        }
        leftButton={{
          icon: 'settings',
          onPress: () => navigation.navigate('Settings', { currentEmployeeId: currentEmployee?.id }),
          color: '#fff'
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
          color: '#fff'
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
        {/* Tips Display */}
        
        {/* Quick Stats */}
        <View style={styles.statsContainer}>
          <TouchableOpacity style={dynamicStyles.statCard} onPress={() => navigation.navigate('Reports')}>
            <MaterialIcons name="attach-money" size={24} color="#FF9800" />
            <Text style={dynamicStyles.statValue}>${totalExpensesThisMonth.toFixed(2)}</Text>
            <Text style={dynamicStyles.statLabel}>Total Expenses</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={dynamicStyles.statCard} onPress={() => navigation.navigate('Reports')}>
            <MaterialIcons name="speed" size={24} color="#4CAF50" />
            <Text style={dynamicStyles.statValue}>{totalMilesThisMonth.toFixed(1)}</Text>
            <Text style={dynamicStyles.statLabel}>Miles This Month</Text>
          </TouchableOpacity>
        </View>

        {/* Secondary Stats */}
        <View style={styles.statsContainer}>
          <TouchableOpacity style={dynamicStyles.statCard} onPress={() => navigation.navigate('Receipts')}>
            <MaterialIcons 
              name="restaurant" 
              size={24} 
              color={perDiemThisMonth >= 350 ? "#f44336" : perDiemThisMonth >= 300 ? "#FF9800" : "#9C27B0"} 
            />
            <Text style={[
              dynamicStyles.statValue,
              perDiemThisMonth >= 350 && { color: '#f44336' },
              perDiemThisMonth >= 300 && perDiemThisMonth < 350 && { color: '#FF9800' }
            ]}>
              ${perDiemThisMonth.toFixed(2)}
            </Text>
            <Text style={dynamicStyles.statLabel}>
              Per Diem Receipts
              {perDiemThisMonth >= 350 && ' ⚠️'}
            </Text>
            {perDiemThisMonth >= 300 && (
              <Text style={{
                fontSize: 10,
                color: perDiemThisMonth >= 350 ? '#f44336' : '#FF9800',
                marginTop: 4,
                fontWeight: '600'
              }}>
                {perDiemThisMonth >= 350 ? 'LIMIT REACHED' : `$${(350 - perDiemThisMonth).toFixed(0)} left`}
              </Text>
            )}
          </TouchableOpacity>
          
          <TouchableOpacity style={dynamicStyles.statCard} onPress={() => navigation.navigate('Receipts')}>
            <MaterialIcons name="receipt" size={24} color="#E91E63" />
            <Text style={dynamicStyles.statValue}>${totalReceiptsThisMonth.toFixed(2)}</Text>
            <Text style={dynamicStyles.statLabel}>Receipts</Text>
          </TouchableOpacity>
        </View>

        {/* Tertiary Stats */}
        <View style={styles.statsContainer}>
          <TouchableOpacity style={dynamicStyles.statCard} onPress={() => navigation.navigate('HoursWorked')}>
            <MaterialIcons name="access-time" size={24} color="#FF5722" />
            <Text style={dynamicStyles.statValue}>{totalHoursThisMonth.toFixed(1)}h</Text>
            <Text style={dynamicStyles.statLabel}>Hours Worked</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={dynamicStyles.statCard} onPress={() => navigation.navigate('Reports')}>
            <MaterialIcons name="list" size={24} color="#2196F3" />
            <Text style={dynamicStyles.statValue}>{recentEntries.length}</Text>
            <Text style={dynamicStyles.statLabel}>Recent Entries</Text>
          </TouchableOpacity>
        </View>

        {/* Monthly Mileage Link */}
        <View style={styles.monthlyMileageContainer}>
          <TouchableOpacity 
            style={dynamicStyles.monthlyMileageButton}
            onPress={() => navigation.navigate('Reports')}
          >
            <View style={styles.monthlyMileageContent}>
              <View style={styles.monthlyMileageIconContainer}>
                <MaterialIcons name="speed" size={28} color={colors.primary} />
              </View>
              <View style={styles.monthlyMileageTextContainer}>
                <Text style={dynamicStyles.monthlyMileageTitle}>View Monthly Mileage</Text>
                <Text style={dynamicStyles.monthlyMileageSubtitle}>
                  {totalMilesThisMonth.toFixed(1)} miles • {recentEntries.length} entries • {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </Text>
              </View>
              <MaterialIcons name="chevron-right" size={24} color={colors.primary} />
            </View>
          </TouchableOpacity>
        </View>


        {/* Sync Status Indicator */}
        {lastSyncTime && (
          <View style={styles.syncStatusContainer}>
            <MaterialIcons name="cloud-done" size={16} color="#4CAF50" />
            <Text style={styles.syncStatusText}>
              Last synced: {lastSyncTime.toLocaleTimeString()}
            </Text>
          </View>
        )}

        {/* Quick Actions */}
        <View style={styles.actionsContainer}>
          <TouchableOpacity 
            style={[dynamicStyles.actionButton, isSyncing && { opacity: 0.6 }]} 
            onPress={handleManualSync}
            disabled={isSyncing}
          >
            <MaterialIcons name={isSyncing ? "sync" : "cloud-upload"} size={24} color="#2196F3" />
            <Text style={dynamicStyles.actionButtonText}>
              {isSyncing ? 'Syncing...' : 'Sync to Backend'}
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={dynamicStyles.actionButton} onPress={handleGpsTracking}>
            <MaterialIcons name="gps-fixed" size={24} color="#4CAF50" />
            <Text style={dynamicStyles.actionButtonText}>Start GPS Tracking</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={dynamicStyles.actionButtonSecondary} onPress={handleAddReceipt}>
            <MaterialIcons name="camera-alt" size={24} color={colors.primary} />
            <Text style={dynamicStyles.actionButtonSecondaryText}>Add Receipt</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={dynamicStyles.actionButtonSecondary} onPress={handleAddEntry}>
            <MaterialIcons name="add" size={24} color={colors.primary} />
            <Text style={dynamicStyles.actionButtonSecondaryText}>Manual Entry</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={dynamicStyles.actionButtonSecondary} onPress={handleViewReceipts}>
            <MaterialIcons name="receipt" size={24} color={colors.primary} />
            <Text style={dynamicStyles.actionButtonSecondaryText}>View Receipts</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={dynamicStyles.actionButtonSecondary} onPress={handleViewHoursWorked}>
            <MaterialIcons name="access-time" size={24} color={colors.primary} />
            <Text style={dynamicStyles.actionButtonSecondaryText}>Hours Worked</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={dynamicStyles.actionButtonSecondary} onPress={() => navigation.navigate('DailyDescription')}>
            <MaterialIcons name="description" size={24} color={colors.primary} />
            <Text style={dynamicStyles.actionButtonSecondaryText}>Daily Description</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={dynamicStyles.actionButtonSecondary} onPress={() => navigation.navigate('CostCenterReporting')}>
            <MaterialIcons name="assessment" size={24} color={colors.primary} />
            <Text style={dynamicStyles.actionButtonSecondaryText}>Cost Center Reports</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={dynamicStyles.actionButtonSecondary} onPress={handleViewReports}>
            <MaterialIcons name="assessment" size={24} color={colors.primary} />
            <Text style={dynamicStyles.actionButtonSecondaryText}>View Reports</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={dynamicStyles.actionButtonSecondary} onPress={handleEditBaseAddress}>
            <MaterialIcons name="location-on" size={24} color={colors.primary} />
            <Text style={dynamicStyles.actionButtonSecondaryText}>Edit Base Address</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={dynamicStyles.actionButtonSecondary} onPress={handleOpenNavigation}>
            <MaterialIcons name="navigation" size={24} color={colors.primary} />
                <Text style={dynamicStyles.actionButtonSecondaryText}>{getNavigationButtonText()}</Text>
          </TouchableOpacity>
          
          {/* Admin and Supervisor functions removed from mobile app */}
          {/* All management functions are available in the web portal only */}
          
          <TouchableOpacity style={dynamicStyles.actionButtonSecondary} onPress={handleViewSavedAddresses}>
            <MaterialIcons name="location-on" size={24} color={colors.primary} />
            <Text style={dynamicStyles.actionButtonSecondaryText}>Saved Addresses</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={dynamicStyles.actionButtonSecondary} onPress={() => navigation.navigate('DataSync')}>
            <MaterialIcons name="sync" size={24} color={colors.primary} />
            <Text style={dynamicStyles.actionButtonSecondaryText}>Data Sync</Text>
          </TouchableOpacity>
        </View>

        {/* Quick Access to Recent Entries */}
        <View style={styles.quickActionsContainer}>
          <View style={styles.quickActionsHeader}>
            <Text style={styles.quickActionsTitle}>Quick Actions</Text>
            <TouchableOpacity 
              style={styles.quickActionsViewAllButton}
              onPress={() => navigation.navigate('Reports')}
            >
              <Text style={styles.quickActionsViewAllText}>View All</Text>
              <MaterialIcons name="chevron-right" size={16} color="#2196F3" />
            </TouchableOpacity>
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
                {entry.isGpsTracked && (
                  <View style={styles.gpsBadge}>
                    <MaterialIcons name="gps-fixed" size={12} color="#4CAF50" />
                    <Text style={styles.gpsText}>GPS Tracked</Text>
                  </View>
                )}
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
              <Text style={dynamicStyles.modalTitle}>Select Cost Centers</Text>
              <TouchableOpacity onPress={() => setShowCostCentersModal(false)}>
                <MaterialIcons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            
            <Text style={styles.costCentersModalSubtitle}>
              Select all cost centers you can bill to. You can choose a default for new entries.
            </Text>
            
            {/* Search Bar */}
            <View style={styles.costCenterSearchContainer}>
              <MaterialIcons name="search" size={20} color="#999" />
              <TextInput
                style={styles.costCenterSearchInput}
                placeholder="Search cost centers..."
                value={costCenterSearchText}
                onChangeText={setCostCenterSearchText}
                placeholderTextColor="#999"
              />
              {costCenterSearchText.length > 0 && (
                <TouchableOpacity onPress={() => setCostCenterSearchText('')}>
                  <MaterialIcons name="close" size={20} color="#999" />
                </TouchableOpacity>
              )}
            </View>
            
            <ScrollView 
              style={styles.costCentersList} 
              showsVerticalScrollIndicator={false}
              removeClippedSubviews={true}
              scrollEventThrottle={16}
              nestedScrollEnabled={true}
            >
              {/* Selected Cost Centers Section */}
              {selectedCostCenters.filter(cc => 
                cc.toLowerCase().includes(costCenterSearchText.toLowerCase())
              ).length > 0 && (
                <View style={styles.costCentersSection}>
                  <Text style={styles.costCentersSectionTitle}>Selected Cost Centers</Text>
                  {selectedCostCenters
                    .filter(cc => cc.toLowerCase().includes(costCenterSearchText.toLowerCase()))
                    .map((costCenter) => (
                    <View key={costCenter} style={[styles.costCenterItem, styles.selectedCostCenterItem]}>
                      <TouchableOpacity
                        style={styles.costCenterCheckbox}
                        onPress={() => handleCostCenterToggle(costCenter)}
                      >
                        <MaterialIcons
                          name="check-box"
                          size={24}
                          color={colors.primary}
                        />
                        <Text style={[styles.costCenterItemText, styles.selectedCostCenterText]}>{costCenter}</Text>
                      </TouchableOpacity>
                      
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
                    </View>
                  ))}
                </View>
              )}

              {/* Available Cost Centers Section */}
              <View style={styles.costCentersSection}>
                <Text style={styles.costCentersSectionTitle}>
                  {selectedCostCenters.length > 0 ? 'Available Cost Centers' : 'All Cost Centers'}
                </Text>
                {COST_CENTERS
                  .filter(costCenter => 
                    !selectedCostCenters.includes(costCenter) &&
                    costCenter.toLowerCase().includes(costCenterSearchText.toLowerCase())
                  )
                  .map((costCenter) => (
                    <View key={costCenter} style={styles.costCenterItem}>
                      <TouchableOpacity
                        style={styles.costCenterCheckbox}
                        onPress={() => handleCostCenterToggle(costCenter)}
                      >
                        <MaterialIcons
                          name="check-box-outline-blank"
                          size={24}
                          color="#ccc"
                        />
                        <Text style={styles.costCenterItemText}>{costCenter}</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
              </View>
            </ScrollView>
            
            <View style={styles.costCentersModalButtons}>
              <TouchableOpacity 
                style={styles.costCentersModalCancelButton} 
                onPress={() => setShowCostCentersModal(false)}
              >
                <Text style={styles.costCentersModalCancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.costCentersModalConfirmButton} 
                onPress={handleSaveCostCenters}
                disabled={selectedCostCenters.length === 0}
              >
                <Text style={styles.costCentersModalConfirmButtonText}>Save</Text>
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
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#e8f5e9',
    borderRadius: 8,
    marginHorizontal: 20,
    marginBottom: 12,
  },
  syncStatusText: {
    fontSize: 12,
    color: '#2e7d32',
    marginLeft: 6,
    fontWeight: '500',
  },
});

// Static property to prevent concurrent syncs
(HomeScreen as any).isSyncing = false;

export default HomeScreen;
