import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Keyboard,
  TouchableWithoutFeedback,
  Linking,
  useWindowDimensions,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Image } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { DatabaseService } from '../services/database';
import { Employee } from '../types';
import { API_BASE_URL } from '../config/api';

interface LoginScreenProps {
  navigation?: any;
  onLogin: (employee: Employee) => void;
}

export default function LoginScreen({ navigation, onLogin }: LoginScreenProps) {
  const insets = useSafeAreaInsets();
  const { fontScale } = useWindowDimensions();
  const logoSize = Math.round(Math.max(88, Math.min(120, 120 / Math.max(1, fontScale))));
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [biometricLoading, setBiometricLoading] = useState(false);
  const [stayLoggedIn, setStayLoggedIn] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [savedBiometricCredentials, setSavedBiometricCredentials] = useState(false);
  const [biometricLabel, setBiometricLabel] = useState('Biometrics');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const passwordInputRef = useRef<TextInput>(null);
  const CREDENTIALS_KEY = 'biometric_login_credentials_v1';

  useEffect(() => {
    loadEmployees();
    initializeBiometricStatus();
  }, []);

  const initializeBiometricStatus = async () => {
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      const supportedTypes = await LocalAuthentication.supportedAuthenticationTypesAsync();
      const hasSaved = !!(await SecureStore.getItemAsync(CREDENTIALS_KEY));

      setBiometricAvailable(hasHardware && isEnrolled);
      setSavedBiometricCredentials(hasSaved);

      if (supportedTypes.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
        setBiometricLabel('Face ID');
      } else if (supportedTypes.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
        setBiometricLabel('Touch ID');
      } else {
        setBiometricLabel('Biometrics');
      }
    } catch (error) {
      console.warn('Biometric availability check failed:', error);
      setBiometricAvailable(false);
      setSavedBiometricCredentials(false);
    }
  };

  const saveBiometricCredentials = async (loginEmail: string, loginPassword: string) => {
    await SecureStore.setItemAsync(
      CREDENTIALS_KEY,
      JSON.stringify({
        email: loginEmail.toLowerCase().trim(),
        password: loginPassword,
      })
    );
    setSavedBiometricCredentials(true);
  };

  const maybePromptEnableBiometric = async (loginEmail: string, loginPassword: string) => {
    if (!biometricAvailable || savedBiometricCredentials) return;
    Alert.alert(
      `Enable ${biometricLabel}?`,
      `Save your login securely so you can sign in with ${biometricLabel} next time.`,
      [
        { text: 'Not now', style: 'cancel' },
        {
          text: 'Enable',
          onPress: async () => {
            try {
              const authResult = await LocalAuthentication.authenticateAsync({
                promptMessage: `Enable ${biometricLabel}`,
                cancelLabel: 'Cancel',
                disableDeviceFallback: true,
              });
              if (!authResult.success) return;
              await saveBiometricCredentials(loginEmail, loginPassword);
            } catch (error) {
              console.error('Failed to enable biometric login:', error);
            }
          },
        },
      ]
    );
  };

  const performLogin = async (loginEmail: string, loginPassword: string) => {
    const backendUrl = (API_BASE_URL ?? '').replace(/\/api\/?$/, '') || 'https://oxford-mileage-backend.onrender.com';
    
    try {
      const response = await fetch(`${backendUrl}/api/employee-login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: loginEmail.toLowerCase(),
          password: loginPassword,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        const employeeData = data;
        const existingEmployee = await DatabaseService.getEmployeeByEmail(employeeData.email);

        if (existingEmployee) {
          const canonicalId = employeeData.id;
          try {
            if (existingEmployee.id !== canonicalId) {
              await DatabaseService.realignEmployeeIdWithBackend(existingEmployee.id, canonicalId);
            }
            await DatabaseService.updateEmployee(canonicalId, {
              name: employeeData.name,
              email: employeeData.email,
              password: loginPassword,
              oxfordHouseId: employeeData.oxfordHouseId ?? existingEmployee.oxfordHouseId ?? '',
              position: employeeData.position ?? existingEmployee.position ?? '',
              phoneNumber: employeeData.phoneNumber ?? existingEmployee.phoneNumber ?? '',
              baseAddress: employeeData.baseAddress ?? existingEmployee.baseAddress ?? '',
              costCenters: employeeData.costCenters ?? [],
              selectedCostCenters: (employeeData.selectedCostCenters?.length ? employeeData.selectedCostCenters : (employeeData.costCenters ?? [])),
              defaultCostCenter: employeeData.defaultCostCenter ?? employeeData.costCenters?.[0] ?? ''
            });
            
            const updatedEmployee = await DatabaseService.getEmployeeById(canonicalId);
            if (!updatedEmployee) {
              Alert.alert('Error', 'Failed to load updated employee data');
              return false;
            }
            
            await DatabaseService.setCurrentEmployee(canonicalId, stayLoggedIn);
            await maybePromptEnableBiometric(loginEmail, loginPassword);
            onLogin(updatedEmployee);
            return true;
          } catch (updateError) {
            console.error('Failed to update employee:', updateError);
            Alert.alert('Error', 'Failed to update employee record');
            return false;
          }
        } else {
          await DatabaseService.createEmployee({
            id: employeeData.id,
            name: employeeData.name,
            email: employeeData.email,
            password: loginPassword,
            oxfordHouseId: employeeData.oxfordHouseId || '',
            position: employeeData.position || '',
            phoneNumber: employeeData.phoneNumber || '',
            baseAddress: employeeData.baseAddress || '',
            costCenters: employeeData.costCenters || [],
            selectedCostCenters: employeeData.selectedCostCenters || employeeData.costCenters || [],
            defaultCostCenter: employeeData.defaultCostCenter || employeeData.costCenters?.[0] || ''
          });
          
          await DatabaseService.setCurrentEmployee(employeeData.id, stayLoggedIn);
          await maybePromptEnableBiometric(loginEmail, loginPassword);
          onLogin(employeeData);
          return true;
        }
      }
    } catch (backendError) {
      console.warn('Backend authentication failed, falling back to local:', backendError);
    }
    
    const employee = employees.find(emp => 
      emp.email.toLowerCase() === loginEmail.toLowerCase() &&
      emp.password === loginPassword
    );

    if (employee) {
      await DatabaseService.setCurrentEmployee(employee.id, stayLoggedIn);
      await maybePromptEnableBiometric(loginEmail, loginPassword);
      onLogin(employee);
      return true;
    }

    Alert.alert(
      'Login Failed',
      'Invalid email or password. Please check your credentials and try again.',
      [{ text: 'OK', style: 'default' }]
    );
    return false;
  };

  const loadEmployees = async () => {
    try {
      const allEmployees = await DatabaseService.getAllEmployees();
      setEmployees(allEmployees);
    } catch (error) {
      console.error('Error loading employees:', error);
    }
  };

  const handleLogin = async () => {
    if (!email.trim()) {
      Alert.alert('Error', 'Please enter your work email');
      return;
    }

    if (!password.trim()) {
      Alert.alert('Error', 'Please enter your password');
      return;
    }

    if (!isValidEmail(email)) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }

    setLoading(true);
    try {
      await performLogin(email, password);
    } catch (error) {
      console.error('Login error:', error);
      Alert.alert('Error', 'Failed to log in. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleBiometricLogin = async () => {
    setBiometricLoading(true);
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      const credentialsJson = await SecureStore.getItemAsync(CREDENTIALS_KEY);

      if (!hasHardware || !isEnrolled) {
        setBiometricAvailable(false);
        Alert.alert(
          'Biometric Login',
          `${biometricLabel} is not available right now. Please sign in with email and password.`
        );
        return;
      }

      if (!credentialsJson) {
        setSavedBiometricCredentials(false);
        Alert.alert(
          'Biometric Login',
          'No saved biometric credentials found. Please sign in manually once and re-enable biometrics.'
        );
        return;
      }

      const authResult = await LocalAuthentication.authenticateAsync({
        promptMessage: `Sign in with ${biometricLabel}`,
        cancelLabel: 'Cancel',
        disableDeviceFallback: true,
      });

      if (!authResult.success) {
        if (authResult.error !== 'user_cancel' && authResult.error !== 'system_cancel') {
          const code = authResult.error || 'unknown';
          const openSettingsCodes = new Set([
            'not_available',
            'not_enrolled',
            'passcode_not_set',
            'user_fallback',
            'lockout',
          ]);
          const needsSettings = openSettingsCodes.has(code);
          const detailsByCode: Record<string, string> = {
            not_available: `${biometricLabel} is not available for this app on this device.`,
            not_enrolled: `No ${biometricLabel} enrollment was found.`,
            passcode_not_set: 'A device passcode is required before biometrics can be used.',
            lockout: `${biometricLabel} is temporarily locked due to failed attempts.`,
            user_fallback: `${biometricLabel} could not continue.`,
            authentication_failed: `${biometricLabel} did not match.`,
            timeout: `${biometricLabel} timed out.`,
          };
          Alert.alert(
            'Biometric Login',
            `${detailsByCode[code] || `Unable to verify ${biometricLabel}.`}\n\nError: ${code}`,
            needsSettings
              ? [
                  { text: 'Use Password', style: 'cancel' },
                  {
                    text: 'Open Settings',
                    onPress: () => {
                      void Linking.openSettings();
                    },
                  },
                ]
              : [{ text: 'OK', style: 'default' }]
          );
          await initializeBiometricStatus();
        }
        return;
      }

      const credentials = JSON.parse(credentialsJson);
      if (!credentials?.email || !credentials?.password) {
        Alert.alert('Biometric Login', 'Saved credentials are invalid. Please sign in manually once.');
        return;
      }
      setEmail(credentials.email);
      setPassword(credentials.password);
      await performLogin(credentials.email, credentials.password);
    } catch (error) {
      console.error('Biometric login failed:', error);
      Alert.alert('Biometric Login', 'Unable to sign in with biometrics. Please use email and password.');
    } finally {
      setBiometricLoading(false);
    }
  };

  const createNewEmployee = (emailAddress: string) => {
    Alert.alert(
      'Create Employee Profile',
      'Please contact your administrator to create your employee profile.',
      [{ text: 'OK', style: 'default' }]
    );
  };

  const isValidEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const WrapperComponent = Platform.OS === 'web' ? View : TouchableWithoutFeedback;
  const wrapperProps = Platform.OS === 'web' 
    ? {} 
    : { onPress: Keyboard.dismiss, accessible: false as const };

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar style="dark" />
      
      <WrapperComponent {...wrapperProps}>
        <ScrollView
          contentContainerStyle={[
            styles.scrollContainer,
            { paddingBottom: Math.max(insets.bottom, 24) + 24 },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator
        >
        {/* Header */}
        <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) + 24 }]}>
          <Image 
            source={require('../../assets/oxford-house-logo.png')}
            style={[styles.logo, { width: logoSize, height: logoSize }]}
            resizeMode="contain"
          />
          <Text style={styles.title}>Oxford House Expense Tracker</Text>
          <Text style={styles.subtitle}>Employee Login</Text>
        </View>

        {/* Login Form */}
        <View style={styles.formContainer}>
          <View style={styles.inputContainer}>
            <MaterialIcons name="email" size={24} color="#666" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Enter your work email"
              placeholderTextColor="#999"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="next"
              blurOnSubmit={false}
              onSubmitEditing={() => {
                // Focus password input
                passwordInputRef.current?.focus();
              }}
            />
          </View>

          <View style={styles.inputContainer}>
            <MaterialIcons name="lock" size={24} color="#666" style={styles.inputIcon} />
            <TextInput
              ref={passwordInputRef}
              style={styles.input}
              placeholder="Enter your password"
              placeholderTextColor="#999"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="done"
              blurOnSubmit={true}
              onSubmitEditing={handleLogin}
            />
            <TouchableOpacity
              style={styles.showPasswordButton}
              onPress={() => setShowPassword(!showPassword)}
            >
              <MaterialIcons 
                name={showPassword ? "visibility-off" : "visibility"} 
                size={24} 
                color="#666" 
              />
            </TouchableOpacity>
          </View>

          {/* Stay Logged In Checkbox */}
          <TouchableOpacity
            style={styles.checkboxContainer}
            onPress={() => setStayLoggedIn(!stayLoggedIn)}
          >
            <View style={styles.checkbox}>
              {stayLoggedIn && (
                <MaterialIcons name="check" size={20} color="#2196F3" />
              )}
            </View>
            <Text style={styles.checkboxLabel}>Stay logged in</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.loginButton, loading && styles.loginButtonDisabled]}
            onPress={handleLogin}
            disabled={loading}
          >
            <Text style={styles.loginButtonText} numberOfLines={1}>
              {loading ? 'Signing In...' : 'Sign In'}
            </Text>
          </TouchableOpacity>

          {biometricAvailable && savedBiometricCredentials && (
            <TouchableOpacity
              style={[styles.biometricButton, biometricLoading && styles.loginButtonDisabled]}
              onPress={handleBiometricLogin}
              disabled={biometricLoading || loading}
            >
              <MaterialIcons name="fingerprint" size={22} color="#1C75BC" />
              <Text style={styles.biometricButtonText} numberOfLines={1}>
                {biometricLoading ? `Checking ${biometricLabel}...` : `Use ${biometricLabel}`}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        </ScrollView>
      </WrapperComponent>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollContainer: {
    flexGrow: 1,
  },
  header: {
    backgroundColor: '#E6E6E6',
    paddingBottom: 32,
    paddingHorizontal: 20,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#D6D6D6',
  },
  logo: {
    marginBottom: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: '600',
    color: '#1C75BC',
    marginTop: 20,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#6CA6D9',
    marginTop: 8,
  },
  formContainer: {
    paddingHorizontal: 20,
    paddingTop: 32,
    paddingBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 20,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    paddingVertical: 16,
    fontSize: 16,
    color: '#333',
  },
  showPasswordButton: {
    padding: 8,
    marginLeft: 8,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: '#2196F3',
    borderRadius: 4,
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  checkboxLabel: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
    flexShrink: 1,
  },
  loginButton: {
    backgroundColor: '#2196F3',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  loginButtonDisabled: {
    backgroundColor: '#ccc',
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  biometricButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#1C75BC',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: '#fff',
    minHeight: 52,
  },
  biometricButtonText: {
    marginLeft: 8,
    color: '#1C75BC',
    fontSize: 16,
    fontWeight: '600',
    flexShrink: 1,
  },
});
