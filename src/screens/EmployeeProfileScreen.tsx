import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Modal,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { MaterialIcons } from '@expo/vector-icons';
import { DatabaseService } from '../services/database';
import { Employee } from '../types';

interface EmployeeProfileScreenProps {
  navigation: any;
  employee: Employee;
  onEmployeeUpdate: (employee: Employee) => void;
}

export default function EmployeeProfileScreen({ navigation, employee, onEmployeeUpdate }: EmployeeProfileScreenProps) {
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showCostCenterModal, setShowCostCenterModal] = useState(false);
  
  const [formData, setFormData] = useState({
    name: employee.name || '',
    email: employee.email || '',
    position: employee.position || '',
    phoneNumber: employee.phoneNumber || '',
    baseAddress: employee.baseAddress || '',
    costCenters: employee.costCenters || [],
  });

  const [newCostCenter, setNewCostCenter] = useState('');

  useEffect(() => {
    setFormData({
      name: employee.name || '',
      email: employee.email || '',
      position: employee.position || '',
      phoneNumber: employee.phoneNumber || '',
      baseAddress: employee.baseAddress || '',
      costCenters: employee.costCenters || [],
    });
  }, [employee]);

  const handleSave = async () => {
    if (!formData.name.trim()) {
      Alert.alert('Error', 'Name is required');
      return;
    }

    if (!formData.email.trim()) {
      Alert.alert('Error', 'Email is required');
      return;
    }

    if (!formData.baseAddress.trim()) {
      Alert.alert('Error', 'Base address is required');
      return;
    }

    setLoading(true);
    try {
      await DatabaseService.updateEmployee(employee.id, {
        name: formData.name.trim(),
        email: formData.email.trim(),
        position: formData.position.trim(),
        phoneNumber: formData.phoneNumber.trim(),
        baseAddress: formData.baseAddress.trim(),
        costCenters: formData.costCenters,
      });

      // Get the updated employee data
      const updatedEmployee = await DatabaseService.getEmployeeById(employee.id);
      if (updatedEmployee) {
        onEmployeeUpdate(updatedEmployee);
      }
      setEditing(false);
      Alert.alert('Success', 'Profile updated successfully');
    } catch (error) {
      console.error('Error updating employee:', error);
      Alert.alert('Error', 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setFormData({
      name: employee.name || '',
      email: employee.email || '',
      position: employee.position || '',
      phoneNumber: employee.phoneNumber || '',
      baseAddress: employee.baseAddress || '',
      costCenters: employee.costCenters || [],
    });
    setEditing(false);
  };

  const addCostCenter = () => {
    if (!newCostCenter.trim()) {
      Alert.alert('Error', 'Please enter a cost center');
      return;
    }

    if (formData.costCenters.includes(newCostCenter.trim())) {
      Alert.alert('Error', 'Cost center already exists');
      return;
    }

    setFormData(prev => ({
      ...prev,
      costCenters: [...prev.costCenters, newCostCenter.trim()]
    }));
    setNewCostCenter('');
    setShowCostCenterModal(false);
  };

  const removeCostCenter = (costCenter: string) => {
    Alert.alert(
      'Remove Cost Center',
      `Are you sure you want to remove ${costCenter}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            setFormData(prev => ({
              ...prev,
              costCenters: prev.costCenters.filter(cc => cc !== costCenter)
            }));
          }
        }
      ]
    );
  };

  const renderField = (
    label: string,
    value: string,
    onChangeText: (text: string) => void,
    placeholder: string,
    multiline: boolean = false
  ) => (
    <View style={styles.fieldContainer}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={[styles.fieldInput, multiline && styles.multilineInput]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#999"
        editable={editing}
        multiline={multiline}
        numberOfLines={multiline ? 3 : 1}
      />
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar style="auto" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <MaterialIcons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Employee Profile</Text>
        <TouchableOpacity
          onPress={editing ? handleSave : () => setEditing(true)}
          disabled={loading}
        >
          <Text style={styles.headerButton}>
            {editing ? (loading ? 'Saving...' : 'Save') : 'Edit'}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Profile Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Personal Information</Text>
          
          {renderField(
            'Full Name',
            formData.name,
            (text) => setFormData(prev => ({ ...prev, name: text })),
            'Enter your full name'
          )}
          
          {renderField(
            'Email',
            formData.email,
            (text) => setFormData(prev => ({ ...prev, email: text })),
            'Enter your work email'
          )}
          
          {renderField(
            'Position',
            formData.position,
            (text) => setFormData(prev => ({ ...prev, position: text })),
            'Enter your position/title'
          )}
          
          {renderField(
            'Phone Number',
            formData.phoneNumber,
            (text) => setFormData(prev => ({ ...prev, phoneNumber: text })),
            'Enter your phone number'
          )}
        </View>

        {/* Address Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Address Information</Text>
          
          {renderField(
            'Base Address',
            formData.baseAddress,
            (text) => setFormData(prev => ({ ...prev, baseAddress: text })),
            'Enter your base address (BA)',
            true
          )}
        </View>

        {/* Cost Centers */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Cost Centers</Text>
            {editing && (
              <TouchableOpacity
                style={styles.addButton}
                onPress={() => setShowCostCenterModal(true)}
              >
                <MaterialIcons name="add" size={20} color="#2196F3" />
                <Text style={styles.addButtonText}>Add</Text>
              </TouchableOpacity>
            )}
          </View>
          
          {formData.costCenters.length === 0 ? (
            <Text style={styles.emptyText}>No cost centers assigned</Text>
          ) : (
            formData.costCenters.map((costCenter, index) => (
              <View key={index} style={styles.costCenterItem}>
                <Text style={styles.costCenterText}>{costCenter}</Text>
                {editing && (
                  <TouchableOpacity
                    onPress={() => removeCostCenter(costCenter)}
                    style={styles.removeButton}
                  >
                    <MaterialIcons name="close" size={18} color="#f44336" />
                  </TouchableOpacity>
                )}
              </View>
            ))
          )}
        </View>

        {editing && (
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={handleCancel}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Add Cost Center Modal */}
      <Modal
        visible={showCostCenterModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCostCenterModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add Cost Center</Text>
            
            <TextInput
              style={styles.modalInput}
              value={newCostCenter}
              onChangeText={setNewCostCenter}
              placeholder="Enter cost center code"
              placeholderTextColor="#999"
              autoCapitalize="characters"
            />
            
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalButton}
                onPress={() => setShowCostCenterModal(false)}
              >
                <Text style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonPrimary]}
                onPress={addCostCenter}
              >
                <Text style={[styles.modalButtonText, styles.modalButtonPrimaryText]}>
                  Add
                </Text>
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
  header: {
    backgroundColor: '#2196F3',
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerButton: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  fieldContainer: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
    marginBottom: 8,
  },
  fieldInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#f9f9f9',
  },
  multilineInput: {
    height: 80,
    textAlignVertical: 'top',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#2196F3',
  },
  addButtonText: {
    color: '#2196F3',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 4,
  },
  costCenterItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    marginBottom: 8,
  },
  costCenterText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  removeButton: {
    padding: 4,
  },
  emptyText: {
    fontSize: 14,
    color: '#999',
    fontStyle: 'italic',
    textAlign: 'center',
    padding: 20,
  },
  buttonContainer: {
    marginTop: 20,
  },
  cancelButton: {
    backgroundColor: '#f44336',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    width: '100%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 20,
    textAlign: 'center',
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    marginHorizontal: 4,
  },
  modalButtonPrimary: {
    backgroundColor: '#2196F3',
    borderColor: '#2196F3',
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  modalButtonPrimaryText: {
    color: '#fff',
  },
});
