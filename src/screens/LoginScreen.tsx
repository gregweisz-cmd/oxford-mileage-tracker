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
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { MaterialIcons } from '@expo/vector-icons';
import { Image } from 'react-native';
import { DatabaseService } from '../services/database';
import { Employee } from '../types';
import { API_BASE_URL } from '../config/api';

interface LoginScreenProps {
  navigation?: any;
  onLogin: (employee: Employee) => void;
}

export default function LoginScreen({ navigation, onLogin }: LoginScreenProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [stayLoggedIn, setStayLoggedIn] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const passwordInputRef = useRef<TextInput>(null);

  useEffect(() => {
    loadEmployees();
  }, []);

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
      const backendUrl = (API_BASE_URL ?? '').replace(/\/api\/?$/, '') || 'https://oxford-mileage-backend.onrender.com';
      
      try {
        const response = await fetch(`${backendUrl}/api/employee-login`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: email.toLowerCase(),
            password: password,
          }),
        });

        const data = await response.json();

        if (response.ok) {
          const employeeData = data;
          const existingEmployee = await DatabaseService.getEmployeeByEmail(employeeData.email);

          if (existingEmployee) {
            // Backend (Render) is source of truth: overwrite local with API data
            try {
              await DatabaseService.updateEmployee(existingEmployee.id, {
                name: employeeData.name,
                email: employeeData.email,
                password: password,
                oxfordHouseId: employeeData.oxfordHouseId ?? existingEmployee.oxfordHouseId ?? '',
                position: employeeData.position ?? existingEmployee.position ?? '',
                phoneNumber: employeeData.phoneNumber ?? existingEmployee.phoneNumber ?? '',
                baseAddress: employeeData.baseAddress ?? existingEmployee.baseAddress ?? '',
                costCenters: employeeData.costCenters ?? [],
                selectedCostCenters: (employeeData.selectedCostCenters?.length ? employeeData.selectedCostCenters : (employeeData.costCenters ?? [])),
                defaultCostCenter: employeeData.defaultCostCenter ?? employeeData.costCenters?.[0] ?? ''
              });
              
              const updatedEmployee = await DatabaseService.getEmployeeById(existingEmployee.id);
              if (!updatedEmployee) {
                Alert.alert('Error', 'Failed to load updated employee data');
                return;
              }
              
              // Set current employee with the existing employee ID
              await DatabaseService.setCurrentEmployee(existingEmployee.id, stayLoggedIn);
              console.log('✅ LoginScreen: Employee updated and logged in:', updatedEmployee.name);
              
              onLogin(updatedEmployee);
              return;
            } catch (updateError) {
              console.error('Failed to update employee:', updateError);
              Alert.alert('Error', 'Failed to update employee record');
              return;
            }
          } else {
            // Create new employee with backend data
            await DatabaseService.createEmployee({
              id: employeeData.id,
              name: employeeData.name,
              email: employeeData.email,
              password: password,
              oxfordHouseId: employeeData.oxfordHouseId || '',
              position: employeeData.position || '',
              phoneNumber: employeeData.phoneNumber || '',
              baseAddress: employeeData.baseAddress || '',
              costCenters: employeeData.costCenters || [],
              selectedCostCenters: employeeData.selectedCostCenters || employeeData.costCenters || [],
              defaultCostCenter: employeeData.defaultCostCenter || employeeData.costCenters?.[0] || ''
            });
            
            // Set current employee with the new employee ID
            await DatabaseService.setCurrentEmployee(employeeData.id, stayLoggedIn);
            
            onLogin(employeeData);
            return;
          }
        }
      } catch (backendError) {
        console.warn('Backend authentication failed, falling back to local:', backendError);
      }
      
      // Fallback to local authentication
      const employee = employees.find(emp => 
        emp.email.toLowerCase() === email.toLowerCase() &&
        emp.password === password
      );

      if (employee) {
        await DatabaseService.setCurrentEmployee(employee.id, stayLoggedIn);
        onLogin(employee);
      } else {
        Alert.alert(
          'Login Failed',
          'Invalid email or password. Please check your credentials and try again.',
          [{ text: 'OK', style: 'default' }]
        );
      }
    } catch (error) {
      console.error('Login error:', error);
      Alert.alert('Error', 'Failed to log in. Please try again.');
    } finally {
      setLoading(false);
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
    : { onPress: Keyboard.dismiss };

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar style="dark" />
      
      <WrapperComponent {...wrapperProps}>
        <ScrollView contentContainerStyle={styles.scrollContainer}>
        {/* Header */}
        <View style={styles.header}>
          <Image 
            source={require('../../assets/oxford-house-logo.png')}
            style={styles.logo}
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
            <Text style={styles.loginButtonText}>
              {loading ? 'Signing In...' : 'Sign In'}
            </Text>
          </TouchableOpacity>
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
    paddingTop: 60,
    paddingBottom: 40,
    paddingHorizontal: 20,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#D6D6D6',
  },
  logo: {
    width: 120,
    height: 120,
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
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 40,
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
});
