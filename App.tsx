import React, { useEffect, useState } from 'react';
import 'react-native-gesture-handler';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { StatusBar } from 'expo-status-bar';
import { Platform, View, Text } from 'react-native';
import { GpsTrackingProvider } from './src/contexts/GpsTrackingContext';
import { ThemeProvider } from './src/contexts/ThemeContext';
import { TipsProvider } from './src/contexts/TipsContext';
import { NotificationProvider } from './src/contexts/NotificationContext';
import GlobalGpsStopButton from './src/components/GlobalGpsStopButton';
import { AppInitializer } from './src/services/appInitializer';
import { DatabaseService } from './src/services/database';
import { TestDataService } from './src/services/testDataService';
import { DemoDataService } from './src/services/demoDataService';
import { Employee } from './src/types';
import LoginScreen from './src/screens/LoginScreen';
import EmployeeProfileScreen from './src/screens/EmployeeProfileScreen';
import LogoutService from './src/services/logoutService';
import HomeScreen from './src/screens/HomeScreen';
import MileageEntryScreen from './src/screens/MileageEntryScreen';
import ReportsScreen from './src/screens/ReportsScreen';
import GpsTrackingScreen from './src/screens/GpsTrackingScreen';
import ReceiptsScreen from './src/screens/ReceiptsScreen';
import AddReceiptScreen from './src/screens/AddReceiptScreen';
import HoursWorkedScreen from './src/screens/HoursWorkedScreen';
import DailyDescriptionScreen from './src/screens/DailyDescriptionScreen';
import CostCenterReportingScreen from './src/screens/CostCenterReportingScreen';
import AdminScreen from './src/screens/AdminScreen';
import ManagerDashboardScreen from './src/screens/ManagerDashboardScreen';
import SavedAddressesScreen from './src/screens/SavedAddressesScreen';
import DataSyncScreen from './src/screens/DataSyncScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import { RootStackParamList } from './src/types';

const Stack = createStackNavigator<RootStackParamList>();

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentEmployee, setCurrentEmployee] = useState<Employee | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    initializeApp();
    // Set the logout callback
    LogoutService.setLogoutCallback(handleLogout);
  }, []);

  const initializeApp = async () => {
    try {
      // Initialize the app
      await AppInitializer.initialize();
      
      // Initialize test data
      await TestDataService.initializeTestData();
      
      // Create Greg Weisz June 2024 demo data from actual expense report
      await DemoDataService.createGregJune2024Data();
      
      // Clean up old demo receipts (Comcast, Verizon, etc.)
      await DatabaseService.cleanupOldReceipts();
      
      // Check if user is already logged in and wants to stay logged in
      const currentSession = await DatabaseService.getCurrentEmployeeSession();
      
      if (currentSession && currentSession.stayLoggedIn) {
        const employee = await DatabaseService.getEmployeeById(currentSession.employeeId);
        if (employee) {
          setCurrentEmployee(employee);
          setIsAuthenticated(true);
        }
      }
    } catch (error) {
      console.error('Error initializing app:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = (employee: Employee) => {
    setCurrentEmployee(employee);
    setIsAuthenticated(true);
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

  if (isLoading) {
    return (
      <ThemeProvider>
        <TipsProvider>
          <GpsTrackingProvider>
            <StatusBar style="auto" />
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f5f5f5' }}>
              <Text>Loading...</Text>
            </View>
          </GpsTrackingProvider>
        </TipsProvider>
      </ThemeProvider>
    );
  }

  if (!isAuthenticated) {
    return (
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
    );
  }

  return (
    <ThemeProvider>
      <TipsProvider>
        <NotificationProvider currentEmployeeId={currentEmployee?.id}>
          <GpsTrackingProvider>
          <NavigationContainer>
          <StatusBar style="auto" />
          <Stack.Navigator
            initialRouteName="Home"
            screenOptions={{
              headerShown: false,
            }}
          >
            <Stack.Screen 
              name="Home" 
              component={HomeScreen}
            />
            <Stack.Screen name="MileageEntry" component={MileageEntryScreen} />
            <Stack.Screen name="Reports" component={ReportsScreen} />
            <Stack.Screen name="GpsTracking" component={GpsTrackingScreen} />
            <Stack.Screen name="Receipts" component={ReceiptsScreen} />
            <Stack.Screen name="AddReceipt" component={AddReceiptScreen} />
            <Stack.Screen name="HoursWorked" component={HoursWorkedScreen} />
            <Stack.Screen name="DailyDescription" component={DailyDescriptionScreen} />
            <Stack.Screen name="CostCenterReporting" component={CostCenterReportingScreen} />
            <Stack.Screen name="Admin" component={AdminScreen} />
            <Stack.Screen name="ManagerDashboard" component={ManagerDashboardScreen} />
            <Stack.Screen name="SavedAddresses" component={SavedAddressesScreen} />
            <Stack.Screen name="DataSync" component={DataSyncScreen} />
            <Stack.Screen 
              name="Settings" 
              component={SettingsScreen}
              initialParams={{
                currentEmployeeId: currentEmployee?.id
              } as any}
            />
          </Stack.Navigator>
          {Platform.OS === 'ios' && <GlobalGpsStopButton />}
        </NavigationContainer>
          </GpsTrackingProvider>
        </NotificationProvider>
      </TipsProvider>
    </ThemeProvider>
  );
}