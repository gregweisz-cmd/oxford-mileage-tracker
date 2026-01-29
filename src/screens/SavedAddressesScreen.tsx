import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
  FlatList,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { MaterialIcons } from '@expo/vector-icons';
import { DatabaseService } from '../services/database';
import { SavedAddress, Employee } from '../types';
import UnifiedHeader from '../components/UnifiedHeader';
import { useGpsTracking } from '../contexts/GpsTrackingContext';

interface SavedAddressesScreenProps {
  navigation: any;
  route?: any;
}

export default function SavedAddressesScreen({ navigation, route }: SavedAddressesScreenProps) {
  const { startTracking, isTracking } = useGpsTracking();
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
  const [currentEmployee, setCurrentEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingAddress, setEditingAddress] = useState<SavedAddress | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    street: '',
    city: '',
    state: '',
    zip: '',
    category: 'Other',
  });

  // Check if coming from MileageEntryScreen for address selection
  const fromMileageEntry = route?.params?.fromMileageEntry;
  const locationType = route?.params?.locationType; // 'start' or 'end'

  const categories = ['Office', 'Client', 'Home', 'Other'];

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Initialize database first
      await DatabaseService.initDatabase();
      
      // Get current employee
      const employee = await DatabaseService.getCurrentEmployee();
      
      if (!employee) {
        Alert.alert('Error', 'No employee logged in');
        navigation.goBack();
        return;
      }
      
      setCurrentEmployee(employee);
      
      // Load saved addresses
      const addresses = await DatabaseService.getSavedAddresses(employee.id);
      setSavedAddresses(addresses);
      
    } catch (error) {
      console.error('Error loading saved addresses:', error);
      Alert.alert('Error', 'Failed to load saved addresses');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const resetForm = () => {
    setFormData({
      name: '',
      street: '',
      city: '',
      state: '',
      zip: '',
      category: 'Other',
    });
    setEditingAddress(null);
  };

  const buildAddressString = () => {
    const { street, city, state, zip } = formData;
    const s = street.trim();
    const c = city.trim();
    const st = state.trim();
    const z = zip.trim();
    if (!s) return '';
    const parts = [s];
    if (c) parts.push(c);
    if (st || z) parts.push([st, z].filter(Boolean).join(' '));
    return parts.join(', ');
  };

  const parseAddressToForm = (address: string) => {
    const parts = address.split(',').map((s) => s.trim()).filter(Boolean);
    if (parts.length === 0) return { street: '', city: '', state: '', zip: '' };
    if (parts.length === 1) return { street: parts[0], city: '', state: '', zip: '' };
    if (parts.length === 2) return { street: parts[0], city: parts[1], state: '', zip: '' };
    const last = parts[parts.length - 1];
    const stateZipMatch = last.match(/^([A-Za-z]{2})\s+(\d{5}(?:-\d{4})?)$/);
    const street = parts.slice(0, -2).join(', ');
    const city = parts[parts.length - 2];
    if (stateZipMatch) {
      return { street, city, state: stateZipMatch[1].toUpperCase(), zip: stateZipMatch[2] };
    }
    const lastSpace = last.lastIndexOf(' ');
    if (lastSpace > 0) {
      return { street, city, state: last.slice(0, lastSpace).trim().toUpperCase(), zip: last.slice(lastSpace + 1).trim() };
    }
    return { street, city, state: last, zip: '' };
  };

  const handleAddAddress = () => {
    resetForm();
    setShowAddModal(true);
  };

  const handleEditAddress = (address: SavedAddress) => {
    const { street, city, state, zip } = parseAddressToForm(address.address);
    setFormData({
      name: address.name,
      street,
      city,
      state,
      zip,
      category: address.category || 'Other',
    });
    setEditingAddress(address);
    setShowEditModal(true);
  };

  const handleSaveAddress = async () => {
    if (!formData.name.trim() || !formData.street.trim() || !currentEmployee) {
      Alert.alert('Validation Error', 'Please enter a name and street address');
      return;
    }
    const addressString = buildAddressString();

    try {
      if (editingAddress) {
        await DatabaseService.updateSavedAddress(editingAddress.id, {
          name: formData.name.trim(),
          address: addressString,
          category: formData.category,
        });
        Alert.alert('Success', 'Address updated successfully');
        setShowEditModal(false);
      } else {
        await DatabaseService.createSavedAddress({
          employeeId: currentEmployee.id,
          name: formData.name.trim(),
          address: addressString,
          category: formData.category,
        });
        Alert.alert('Success', 'Address saved successfully');
        setShowAddModal(false);
      }

      resetForm();
      await loadData();
    } catch (error) {
      console.error('Error saving address:', error);
      Alert.alert('Error', 'Failed to save address');
    }
  };

  const handleDeleteAddress = async (address: SavedAddress) => {
    Alert.alert(
      'Delete Address',
      `Are you sure you want to delete "${address.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await DatabaseService.deleteSavedAddress(address.id);
              Alert.alert('Success', 'Address deleted successfully');
              await loadData(); // Refresh the list
            } catch (error) {
              console.error('Error deleting address:', error);
              Alert.alert('Error', 'Failed to delete address');
            }
          },
        },
      ]
    );
  };

  const handleSelectForManualEntry = (address: SavedAddress) => {
    // Navigate back to MileageEntryScreen with the selected address
    navigation.navigate('MileageEntry', {
      selectedAddress: address,
      locationType: locationType, // 'start' or 'end'
    });
  };

  const handleSelectForGpsTracking = async (address: SavedAddress) => {
    if (!currentEmployee) {
      Alert.alert('Error', 'Employee information not available');
      return;
    }

    if (isTracking) {
      Alert.alert('GPS Tracking Active', 'GPS tracking is already active. Please stop the current session before starting a new one.');
      return;
    }

    try {
      // Show confirmation dialog
      Alert.alert(
        'Start GPS Tracking',
        `Start GPS tracking to "${address.name}"?\n\nAddress: ${address.address}`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Start Tracking',
            onPress: async () => {
              try {
                // Prompt for odometer reading
                Alert.prompt(
                  'Odometer Reading',
                  'Enter your current odometer reading:',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Start Tracking',
                      onPress: async (odometerText) => {
                        if (!odometerText || isNaN(Number(odometerText))) {
                          Alert.alert('Invalid Input', 'Please enter a valid odometer reading.');
                          return;
                        }

                        const odometerReading = Number(odometerText);
                        
                        try {
                          // Start GPS tracking with the selected address as destination
                          await startTracking(
                            currentEmployee.id,
                            `Trip to ${address.name}`,
                            odometerReading,
                            `Destination: ${address.address}`
                          );

                          // Navigate to GPS tracking screen to show the active session
                          navigation.navigate('GpsTracking', {
                            destinationAddress: {
                              name: address.name,
                              address: address.address,
                              latitude: address.latitude,
                              longitude: address.longitude
                            }
                          });

                          Alert.alert(
                            'GPS Tracking Started',
                            `Tracking started to ${address.name}. The app will now monitor your location.`,
                            [{ text: 'OK' }]
                          );
                        } catch (error) {
                          console.error('Error starting GPS tracking:', error);
                          Alert.alert('Error', 'Failed to start GPS tracking. Please try again.');
                        }
                      }
                    }
                  ],
                  'plain-text',
                  '123456'
                );
              } catch (error) {
                console.error('Error in odometer prompt:', error);
                Alert.alert('Error', 'An error occurred while starting GPS tracking.');
              }
            }
          }
        ]
      );
    } catch (error) {
      console.error('Error in handleSelectForGpsTracking:', error);
      Alert.alert('Error', 'An error occurred while preparing GPS tracking.');
    }
  };

  const renderAddressItem = ({ item }: { item: SavedAddress }) => (
    <View style={styles.addressCard}>
      <View style={styles.addressHeader}>
        <View style={styles.addressInfo}>
          <Text style={styles.addressName}>{item.name}</Text>
          <Text style={styles.addressText}>{item.address}</Text>
          {item.category && (
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryText}>{item.category}</Text>
            </View>
          )}
        </View>
        <View style={styles.addressActions}>
          {fromMileageEntry ? (
            // If coming from manual entry, show "Select" button
            <TouchableOpacity
              style={styles.selectButton}
              onPress={() => handleSelectForManualEntry(item)}
            >
              <MaterialIcons name="check-circle" size={20} color="#4CAF50" />
              <Text style={styles.selectButtonText}>Select</Text>
            </TouchableOpacity>
          ) : (
            // Otherwise show GPS tracking button
            <TouchableOpacity
              style={[styles.selectButton, isTracking && styles.disabledButton]}
              onPress={() => handleSelectForGpsTracking(item)}
              disabled={isTracking}
            >
              <MaterialIcons 
                name="gps-fixed" 
                size={20} 
                color={isTracking ? "#ccc" : "#4CAF50"} 
              />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.editButton}
            onPress={() => handleEditAddress(item)}
          >
            <MaterialIcons name="edit" size={20} color="#2196F3" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={() => handleDeleteAddress(item)}
          >
            <MaterialIcons name="delete" size={20} color="#f44336" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  const renderModal = () => (
    <Modal
      visible={showAddModal || showEditModal}
      transparent
      animationType="slide"
      onRequestClose={() => {
        setShowAddModal(false);
        setShowEditModal(false);
        resetForm();
      }}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>
            {editingAddress ? 'Edit Address' : 'Add New Address'}
          </Text>
          <ScrollView
            style={styles.modalScroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 8 }}
          >
          <TextInput
            style={styles.input}
            placeholder="Address Name (e.g., Main Office)"
            value={formData.name}
            onChangeText={(value) => handleInputChange('name', value)}
            placeholderTextColor="#999"
          />

          <Text style={styles.fieldLabel}>Street Address</Text>
          <TextInput
            style={styles.input}
            placeholder="123 Main St"
            value={formData.street}
            onChangeText={(value) => handleInputChange('street', value)}
            placeholderTextColor="#999"
          />

          <Text style={styles.fieldLabel}>City</Text>
          <TextInput
            style={styles.input}
            placeholder="City"
            value={formData.city}
            onChangeText={(value) => handleInputChange('city', value)}
            placeholderTextColor="#999"
          />

          <View style={styles.addressRow}>
            <View style={styles.addressHalf}>
              <Text style={styles.fieldLabel}>State</Text>
              <TextInput
                style={styles.input}
                placeholder="NC"
                value={formData.state}
                onChangeText={(value) => handleInputChange('state', value.toUpperCase().slice(0, 2))}
                placeholderTextColor="#999"
                maxLength={2}
                autoCapitalize="characters"
              />
            </View>
            <View style={styles.addressHalf}>
              <Text style={styles.fieldLabel}>Zip</Text>
              <TextInput
                style={styles.input}
                placeholder="28203"
                value={formData.zip}
                onChangeText={(value) => handleInputChange('zip', value.replace(/\D/g, '').slice(0, 10))}
                placeholderTextColor="#999"
                keyboardType="number-pad"
                maxLength={10}
              />
            </View>
          </View>

          <View style={styles.categoryContainer}>
            <Text style={styles.categoryLabel}>Category:</Text>
            <View style={styles.categoryButtons}>
              {categories.map((category) => (
                <TouchableOpacity
                  key={category}
                  style={[
                    styles.categoryButton,
                    formData.category === category && styles.categoryButtonSelected,
                  ]}
                  onPress={() => handleInputChange('category', category)}
                >
                  <Text
                    style={[
                      styles.categoryButtonText,
                      formData.category === category && styles.categoryButtonTextSelected,
                    ]}
                  >
                    {category}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          
          <View style={styles.modalButtons}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => {
                setShowAddModal(false);
                setShowEditModal(false);
                resetForm();
              }}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.saveButton}
              onPress={handleSaveAddress}
            >
              <Text style={styles.saveButtonText}>
                {editingAddress ? 'Update' : 'Save'}
              </Text>
            </TouchableOpacity>
          </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading saved addresses...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <UnifiedHeader
        title="Saved Addresses"
        showBackButton={true}
        onBackPress={() => navigation.goBack()}
        rightButton={{
          icon: 'add',
          onPress: handleAddAddress,
          color: '#fff'
        }}
      />

      {/* Address List */}
      {savedAddresses.length === 0 ? (
        <View style={styles.emptyState}>
          <MaterialIcons name="location-on" size={48} color="#ccc" />
          <Text style={styles.emptyStateText}>No saved addresses yet</Text>
          <Text style={styles.emptyStateSubtext}>
            Tap the + button to add your first address
          </Text>
        </View>
      ) : (
        <FlatList
          data={savedAddresses}
          renderItem={renderAddressItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
        />
      )}

      {renderModal()}
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
  loadingText: {
    fontSize: 16,
    color: '#666',
  },
  listContainer: {
    padding: 16,
  },
  addressCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  addressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  addressInfo: {
    flex: 1,
  },
  addressName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  addressText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  categoryBadge: {
    backgroundColor: '#e3f2fd',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  categoryText: {
    fontSize: 12,
    color: '#2196F3',
    fontWeight: '600',
  },
  addressActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  selectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#e8f5e8',
    marginRight: 8,
  },
  selectButtonText: {
    marginLeft: 4,
    fontSize: 14,
    fontWeight: '600',
    color: '#4CAF50',
  },
  disabledButton: {
    backgroundColor: '#f5f5f5',
    opacity: 0.6,
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
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyStateText: {
    fontSize: 18,
    color: '#666',
    marginTop: 16,
    textAlign: 'center',
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
    textAlign: 'center',
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
    maxHeight: '85%',
  },
  modalScroll: {
    maxHeight: 400,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#333',
    backgroundColor: '#f9f9f9',
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#555',
    marginBottom: 6,
  },
  addressRow: {
    flexDirection: 'row',
    gap: 12,
  },
  addressHalf: {
    flex: 1,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  categoryContainer: {
    marginBottom: 20,
  },
  categoryLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  categoryButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#f9f9f9',
  },
  categoryButtonSelected: {
    backgroundColor: '#2196F3',
    borderColor: '#2196F3',
  },
  categoryButtonText: {
    fontSize: 14,
    color: '#666',
  },
  categoryButtonTextSelected: {
    color: '#fff',
    fontWeight: '600',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    color: '#666',
  },
  saveButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#2196F3',
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
});
