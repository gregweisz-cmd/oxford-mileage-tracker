import React, { useEffect, useState } from 'react';
import 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer, useNavigationContainerRef } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { StatusBar } from 'expo-status-bar';
import { View, Text, ActivityIndicator, Platform } from 'react-native';
import { useFonts } from 'expo-font';
import { MaterialIcons } from '@expo/vector-icons';
import { useReactNavigationDevTools } from '@dev-plugins/react-navigation';
import { GpsTrackingProvider } from './src/contexts/GpsTrackingContext';
import { ThemeProvider } from './src/contexts/ThemeContext';
import { TipsProvider } from './src/contexts/TipsContext';
import { NotificationProvider } from './src/contexts/NotificationContext';
import GlobalGpsStopButton from './src/components/GlobalGpsStopButton';
import GlobalGpsReturnButton from './src/components/GlobalGpsReturnButton';
import { useGpsTracking } from './src/contexts/GpsTrackingContext';
import { AppInitializer } from './src/services/appInitializer';
import { DatabaseService } from './src/services/database';
// Removed: Using backend employee data only
// import { TestDataService } from './src/services/testDataService';
// import { DemoDataService } from './src/services/demoDataService';
import { Employee } from './src/types';
import LoginScreen from './src/screens/LoginScreen';
import EmployeeProfileScreen from './src/screens/EmployeeProfileScreen';
import LogoutService from './src/services/logoutService';
import HomeScreen from './src/screens/HomeScreen';
import MileageEntryScreen from './src/screens/MileageEntryScreen';
import GpsTrackingScreen from './src/screens/GpsTrackingScreen';
import ReceiptsScreen from './src/screens/ReceiptsScreen';
import AddReceiptScreen from './src/screens/AddReceiptScreen';
import ReceiptCropScreen from './src/screens/ReceiptCropScreen';
import DailyHoursScreen from './src/screens/DailyHoursScreen';
import AdminScreen from './src/screens/AdminScreen';
import ManagerDashboardScreen from './src/screens/ManagerDashboardScreen';
import SavedAddressesScreen from './src/screens/SavedAddressesScreen';
import DataSyncScreen from './src/screens/DataSyncScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import PreferencesScreen from './src/screens/PreferencesScreen';
import MileageEntriesScreen from './src/screens/MileageEntriesScreen';
import PerDiemScreen from './src/screens/PerDiemScreen';
import OnboardingScreen from './src/components/OnboardingScreen';
import SetupWizard from './src/components/SetupWizard';
import { RootStackParamList } from './src/types';

const Stack = createStackNavigator<RootStackParamList>();

/** Overlay for GPS buttons; uses pointerEvents="none" on GPS Start so scroll works */
function GlobalGpsOverlay({ currentRouteName }: { currentRouteName: string }) {
  const { isTracking } = useGpsTracking();
  const passThrough = currentRouteName === 'GpsTracking' && !isTracking;
  return (
    <View
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 9999,
        elevation: 9999,
      }}
      pointerEvents={passThrough ? 'none' : 'box-none'}
    >
      <GlobalGpsReturnButton currentRouteName={currentRouteName} />
      <GlobalGpsStopButton currentRouteName={currentRouteName} />
    </View>
  );
}

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentEmployee, setCurrentEmployee] = useState<Employee | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showSetupWizard, setShowSetupWizard] = useState(false);
  const [currentRouteName, setCurrentRouteName] = useState<string>('');
  
  // Navigation ref for devtools
  const navigationRef = useNavigationContainerRef();
  
  // Enable React Navigation devtools (only in development)
  useReactNavigationDevTools(navigationRef);
  
  // Load fonts using the useFonts hook
  const [fontsLoaded] = useFonts({
    ...MaterialIcons.font,
  });

  useEffect(() => {
    initializeApp();
    // Set the logout callback
    LogoutService.setLogoutCallback(handleLogout);
  }, []);

  const initializeApp = async () => {
    try {
      // Initialize the app
      await AppInitializer.initialize();
      
      // NO MORE TEST DATA OR DEMO DATA - using backend employee list only
      // Employees will be synced from backend on login
      
      // Clean up old demo receipts (Comcast, Verizon, etc.)
      await DatabaseService.cleanupOldReceipts();
      
      // Check if user is already logged in and wants to stay logged in
      const currentSession = await DatabaseService.getCurrentEmployeeSession();
      
      if (currentSession && currentSession.stayLoggedIn) {
        const employee = await DatabaseService.getEmployeeById(currentSession.employeeId);
        if (employee) {
          setCurrentEmployee(employee);
          setIsAuthenticated(true);
          
          // Check if user has completed onboarding
          const hasCompletedOnboarding = await DatabaseService.hasCompletedOnboarding(employee.id);
          if (!hasCompletedOnboarding) {
            setShowOnboarding(true);
          } else {
            // Check if user has completed the Setup Wizard
            const hasCompletedSetupWizard = await DatabaseService.hasCompletedSetupWizard(employee.id);
            if (!hasCompletedSetupWizard) {
              setShowSetupWizard(true);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error initializing app:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async (employee: Employee) => {
    setIsAuthenticated(true);
    
    // Always fetch fresh employee data from database to avoid stale cache issues
    const freshEmployee = await DatabaseService.getEmployeeById(employee.id);
    if (!freshEmployee) {
      console.error('❌ Could not fetch employee after login');
      setIsAuthenticated(false);
      return;
    }
    
    setCurrentEmployee(freshEmployee);
    
    // Check if user has completed onboarding
    const hasCompleted = await DatabaseService.hasCompletedOnboarding(freshEmployee.id);
    if (!hasCompleted) {
      setShowOnboarding(true);
      return;
    }
    
    // Check if user has completed the Setup Wizard
    // The wizard will show on first login regardless of backend data
    // Backend data (if exists) will be used to pre-populate the wizard fields
    const hasCompletedSetupWizard = await DatabaseService.hasCompletedSetupWizard(freshEmployee.id);
    console.log('🔍 Setup Wizard Check (with fresh data):', {
      employeeId: freshEmployee.id,
      hasCompletedSetupWizard,
      baseAddress: freshEmployee.baseAddress || '(will be pre-filled)',
      defaultCostCenter: freshEmployee.defaultCostCenter || '(will be pre-filled)',
    });
    if (!hasCompletedSetupWizard) {
      console.log('✅ Showing Setup Wizard (first login - will pre-populate with backend data if available)');
      setShowSetupWizard(true);
    } else {
      console.log('⏭️ Setup Wizard already completed, skipping');
    }
  };

  const handleLogout = async () => {
    setCurrentEmployee(null);
    setIsAuthenticated(false);
    // Clear current employee from database
    await DatabaseService.clearCurrentEmployee();
  };

  const handleEmployeeUpdate = (updatedEmployee: Employee) => {
    setCurrentEmployee(updatedEmployee);
  };

  if (isLoading || !fontsLoaded) {
    return (
      <SafeAreaProvider>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f5f5f5' }}>
          <ActivityIndicator size="large" color="#2196F3" />
          <Text style={{ marginTop: 16, fontSize: 16, color: '#666' }}>
            {!fontsLoaded ? 'Loading fonts...' : 'Loading...'}
          </Text>
        </View>
      </SafeAreaProvider>
    );
  }

  if (!isAuthenticated) {
    return (
      <SafeAreaProvider>
        <ThemeProvider>
          <TipsProvider>
            <GpsTrackingProvider>
              <StatusBar style="light" />
              <LoginScreen 
                navigation={null} 
                onLogin={handleLogin}
              />
            </GpsTrackingProvider>
          </TipsProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    );
  }

  // Show onboarding screen if needed
  if (showOnboarding && currentEmployee) {
    return (
      <SafeAreaProvider>
        <ThemeProvider>
          <TipsProvider>
            <GpsTrackingProvider>
              <StatusBar style="light" />
              <OnboardingScreen 
                employeeId={currentEmployee.id}
                onComplete={async () => {
                  setShowOnboarding(false);
                  // After onboarding, check if Setup Wizard is needed
                  if (currentEmployee) {
                    const hasCompletedSetupWizard = await DatabaseService.hasCompletedSetupWizard(currentEmployee.id);
                    if (!hasCompletedSetupWizard) {
                      setShowSetupWizard(true);
                    }
                  }
                }} 
              />
            </GpsTrackingProvider>
          </TipsProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    );
  }

  // Show setup wizard if needed
  if (showSetupWizard && currentEmployee) {
    return (
      <SafeAreaProvider>
        <ThemeProvider>
          <TipsProvider>
            <GpsTrackingProvider>
              <StatusBar style="light" />
              <SetupWizard 
                employee={currentEmployee} 
                onComplete={async () => {
                  setShowSetupWizard(false);
                  // Reload employee data after setup
                  const updatedEmployee = await DatabaseService.getEmployeeById(currentEmployee.id);
                  if (updatedEmployee) {
                    setCurrentEmployee(updatedEmployee);
                  }
                }} 
              />
            </GpsTrackingProvider>
          </TipsProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <TipsProvider>
          <NotificationProvider currentEmployeeId={currentEmployee?.id}>
            <GpsTrackingProvider>
          <NavigationContainer
            ref={navigationRef}
            onStateChange={(state) => {
              // Track current route name
              const route = state?.routes[state.index];
              if (route) {
                setCurrentRouteName(route.name);
              }
            }}
          >
          <StatusBar style="auto" />
          <Stack.Navigator
            initialRouteName="Home"
            screenOptions={{
              headerShown: false,
              cardStyle: {
                paddingBottom: Platform.OS === 'android' ? 48 : 30,
              },
            }}
          >
            <Stack.Screen 
              name="Home" 
              component={HomeScreen}
            />
            <Stack.Screen name="MileageEntry" component={MileageEntryScreen} />
            <Stack.Screen name="GpsTracking" component={GpsTrackingScreen} />
            <Stack.Screen name="Receipts" component={ReceiptsScreen} />
            <Stack.Screen name="AddReceipt" component={AddReceiptScreen} />
            <Stack.Screen name="ReceiptCrop" component={ReceiptCropScreen} />
            <Stack.Screen name="DailyHours" component={DailyHoursScreen} />
            <Stack.Screen name="Admin" component={AdminScreen} />
            <Stack.Screen name="ManagerDashboard" component={ManagerDashboardScreen} />
            <Stack.Screen name="SavedAddresses" component={SavedAddressesScreen} />
            <Stack.Screen name="DataSync" component={DataSyncScreen} />
            <Stack.Screen name="MileageEntries" component={MileageEntriesScreen} />
            <Stack.Screen name="PerDiem" component={PerDiemScreen} />
            <Stack.Screen 
              name="Settings" 
              component={SettingsScreen}
              initialParams={{
                currentEmployeeId: currentEmployee?.id
              } as any}
            />
            <Stack.Screen name="Preferences" component={PreferencesScreen} />
          </Stack.Navigator>
          <GlobalGpsOverlay currentRouteName={currentRouteName} />
        </NavigationContainer>
            </GpsTrackingProvider>
          </NotificationProvider>
        </TipsProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}