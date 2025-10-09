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
import { DatabaseService } from '../services/database';
import { Employee } from '../types';

interface LoginScreenProps {
  navigation: any;
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
  const [showEmployeeList, setShowEmployeeList] = useState(false);

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
      // Try backend API authentication first
      const backendUrl = __DEV__ ? 'http://192.168.86.101:3002' : 'https://oxford-mileage-backend.onrender.com';
      
      try {
        const response = await fetch(`${backendUrl}/api/employee-login`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: email.toLowerCase(),
            password: password
          }),
        });

        if (response.ok) {
          const employeeData = await response.json();
          // Create or update employee in local database with backend ID
          const existingEmployee = await DatabaseService.getEmployeeByEmail(employeeData.email);
          
          if (existingEmployee) {
            // Delete old employee record and create new one with backend ID
            await DatabaseService.deleteEmployee(existingEmployee.id);
            
            // Create new employee with backend data
            try {
              await DatabaseService.createEmployee({
                id: employeeData.id,
                name: employeeData.name,
                email: employeeData.email,
                password: password, // Update password with new value
                oxfordHouseId: employeeData.oxfordHouseId || '',
                position: employeeData.position || '',
                phoneNumber: employeeData.phoneNumber || '',
                baseAddress: employeeData.baseAddress || '',
                costCenters: employeeData.costCenters || [],
                selectedCostCenters: employeeData.selectedCostCenters || employeeData.costCenters || [],
                defaultCostCenter: employeeData.defaultCostCenter || employeeData.costCenters?.[0] || ''
              });
              
              // Set current employee with the backend employee ID
              await DatabaseService.setCurrentEmployee(employeeData.id, stayLoggedIn);
              onLogin(employeeData);
              return;
            } catch (createError) {
              console.error('Failed to create employee:', createError);
              Alert.alert('Error', 'Failed to create employee record');
              return;
            }
          } else {
            // Create new employee with backend data
            await DatabaseService.createEmployee({
              id: employeeData.id,
              name: employeeData.name,
              email: employeeData.email,
              password: password, // Store password locally
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
        // Employee exists and password matches, log them in
        await DatabaseService.setCurrentEmployee(employee.id, stayLoggedIn);
        onLogin(employee);
      } else {
        // Employee doesn't exist or password is wrong
        Alert.alert(
          'Login Failed',
          'Invalid email or password. Please check your credentials and try again.',
          [
            { text: 'OK', style: 'default' },
            { 
              text: 'Select Existing Employee', 
              onPress: () => setShowEmployeeList(true)
            }
          ]
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
    // Navigate to employee creation screen or show modal
    Alert.alert(
      'Create Employee Profile',
      'Please contact your administrator to create your employee profile, or select an existing employee:',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Select Existing', 
          onPress: () => setShowEmployeeList(true)
        }
      ]
    );
  };

  const selectExistingEmployee = (employee: Employee) => {
    setEmail(employee.email);
    setPassword(employee.password);
    setShowEmployeeList(false);
  };

  const isValidEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar style="light" />
      
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <ScrollView contentContainerStyle={styles.scrollContainer}>
        {/* Header */}
        <View style={styles.header}>
          <MaterialIcons name="work" size={80} color="#fff" />
          <Text style={styles.title}>Oxford Mileage Tracker</Text>
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
              ref={(input) => {
                // Store ref for potential future use
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

          <TouchableOpacity
            style={styles.helpButton}
            onPress={() => setShowEmployeeList(true)}
          >
            <Text style={styles.helpButtonText}>
              Need Help? Select from existing employees
            </Text>
          </TouchableOpacity>
        </View>

        {/* Employee List Modal */}
        {showEmployeeList && (
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Select Employee</Text>
                <TouchableOpacity onPress={() => setShowEmployeeList(false)}>
                  <MaterialIcons name="close" size={24} color="#666" />
                </TouchableOpacity>
              </View>
              
              <ScrollView style={styles.employeeList}>
                {employees.map((employee) => (
                  <TouchableOpacity
                    key={employee.id}
                    style={styles.employeeItem}
                    onPress={() => selectExistingEmployee(employee)}
                  >
                    <View style={styles.employeeInfo}>
                      <Text style={styles.employeeName}>{employee.name}</Text>
                      <Text style={styles.employeeEmail}>{employee.email}</Text>
                      <Text style={styles.employeePosition}>{employee.position}</Text>
                    </View>
                    <MaterialIcons name="arrow-forward-ios" size={16} color="#666" />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>
        )}
        </ScrollView>
      </TouchableWithoutFeedback>
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
    backgroundColor: '#2196F3',
    paddingTop: 60,
    paddingBottom: 40,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 20,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#fff',
    marginTop: 8,
    opacity: 0.9,
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
  helpButton: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  helpButtonText: {
    color: '#666',
    fontSize: 14,
    textDecorationLine: 'underline',
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    width: '100%',
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  employeeList: {
    maxHeight: 400,
  },
  employeeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  employeeInfo: {
    flex: 1,
  },
  employeeName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  employeeEmail: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  employeePosition: {
    fontSize: 12,
    color: '#999',
  },
});
