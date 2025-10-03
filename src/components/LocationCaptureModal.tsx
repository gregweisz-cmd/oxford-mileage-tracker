import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { LocationDetails, Employee } from '../types';
import { DatabaseService } from '../services/database';

interface LocationCaptureModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (locationDetails: LocationDetails, endingOdometer?: number) => void;
  title: string;
  locationType: 'start' | 'end';
  currentEmployee?: Employee | null;
  startingOdometer?: number; // Starting odometer to calculate miles
}

export default function LocationCaptureModal({
  visible,
  onClose,
  onConfirm,
  title,
  locationType,
  currentEmployee,
  startingOdometer
}: LocationCaptureModalProps) {
  const [locationName, setLocationName] = useState('');
  const [locationAddress, setLocationAddress] = useState('');
  const [endingOdometer, setEndingOdometer] = useState('');
  const [currentLocation, setCurrentLocation] = useState<Location.LocationObject | null>(null);
  const [loading, setLoading] = useState(false);
  const [saveToFavorites, setSaveToFavorites] = useState(false);
  const [category, setCategory] = useState('Other');

  useEffect(() => {
    if (visible) {
      getCurrentLocation();
    }
  }, [visible]);

  const getCurrentLocation = async () => {
    try {
      setLoading(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required to capture your current location.');
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      
      setCurrentLocation(location);
      
      // Try to get address from coordinates
      try {
        const addressResponse = await Location.reverseGeocodeAsync({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });
        
        if (addressResponse.length > 0) {
          const address = addressResponse[0];
          const formattedAddress = `${address.street || ''} ${address.city || ''}, ${address.region || ''} ${address.postalCode || ''}`.trim();
          setLocationAddress(formattedAddress);
        }
      } catch (error) {
        console.log('Could not get address from coordinates:', error);
      }
    } catch (error) {
      console.error('Error getting location:', error);
      Alert.alert('Error', 'Could not get your current location. Please enter manually.');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (!locationName.trim()) {
      Alert.alert('Validation Error', 'Please enter a location name');
      return;
    }
    
    if (!locationAddress.trim()) {
      Alert.alert('Validation Error', 'Please enter or confirm the address');
      return;
    }

    // Validate ending odometer if this is an end location
    if (locationType === 'end') {
      if (!endingOdometer.trim()) {
        Alert.alert('Validation Error', 'Please enter the ending odometer reading');
        return;
      }
      
      const endingOdometerValue = Number(endingOdometer);
      if (isNaN(endingOdometerValue) || endingOdometerValue < 0) {
        Alert.alert('Validation Error', 'Please enter a valid ending odometer reading');
        return;
      }
      
      // Check if ending odometer is greater than starting odometer
      if (startingOdometer && endingOdometerValue < startingOdometer) {
        Alert.alert(
          'Invalid Odometer Reading', 
          `Ending odometer (${endingOdometerValue}) cannot be less than starting odometer (${startingOdometer})`
        );
        return;
      }
    }

    const locationDetails: LocationDetails = {
      name: locationName.trim(),
      address: locationAddress.trim(),
      latitude: currentLocation?.coords.latitude,
      longitude: currentLocation?.coords.longitude,
    };

    // Save to favorites if checkbox is checked
    if (saveToFavorites && currentEmployee) {
      try {
        await DatabaseService.createSavedAddress({
          employeeId: currentEmployee.id,
          name: locationName.trim(),
          address: locationAddress.trim(),
          latitude: currentLocation?.coords.latitude,
          longitude: currentLocation?.coords.longitude,
          category: category,
        });
        console.log('Location saved to favorites');
      } catch (error) {
        console.error('Error saving location to favorites:', error);
        // Don't block the main flow if saving to favorites fails
      }
    }

    const endingOdometerValue = locationType === 'end' && endingOdometer.trim() 
      ? Number(endingOdometer) 
      : undefined;

    onConfirm(locationDetails, endingOdometerValue);
    setLocationName('');
    setLocationAddress('');
    setEndingOdometer('');
    setCurrentLocation(null);
    setSaveToFavorites(false);
    setCategory('Other');
  };

  const handleCancel = () => {
    setLocationName('');
    setLocationAddress('');
    setEndingOdometer('');
    setCurrentLocation(null);
    setSaveToFavorites(false);
    setCategory('Other');
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={handleCancel}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>{title}</Text>
          
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Location Name *</Text>
            <TextInput
              style={styles.input}
              value={locationName}
              onChangeText={setLocationName}
              placeholder="e.g., Office, Client Site, Home"
              placeholderTextColor="#999"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Address *</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={locationAddress}
              onChangeText={setLocationAddress}
              placeholder="Enter or confirm the address..."
              placeholderTextColor="#999"
              multiline={true}
              numberOfLines={3}
            />
          </View>

          {/* Ending Odometer for end locations */}
          {locationType === 'end' && (
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Ending Odometer Reading *</Text>
              <TextInput
                style={styles.input}
                value={endingOdometer}
                onChangeText={setEndingOdometer}
                placeholder="e.g., 12450"
                keyboardType="numeric"
                placeholderTextColor="#999"
              />
              {startingOdometer && (
                <Text style={styles.helpText}>
                  Starting odometer: {startingOdometer}
                  {endingOdometer && !isNaN(Number(endingOdometer)) && Number(endingOdometer) > startingOdometer && (
                    ` • Miles: ${(Number(endingOdometer) - startingOdometer).toFixed(1)}`
                  )}
                </Text>
              )}
            </View>
          )}

          {loading && (
            <View style={styles.loadingContainer}>
              <Text style={styles.loadingText}>Getting your location...</Text>
            </View>
          )}

          <View style={styles.coordinatesContainer}>
            {currentLocation && (
              <Text style={styles.coordinatesText}>
                📍 {currentLocation.coords.latitude.toFixed(6)}, {currentLocation.coords.longitude.toFixed(6)}
              </Text>
            )}
          </View>

          {/* Save to Favorites Section */}
          <View style={styles.favoritesSection}>
            <TouchableOpacity
              style={styles.checkboxContainer}
              onPress={() => setSaveToFavorites(!saveToFavorites)}
            >
              <View style={[styles.checkbox, saveToFavorites && styles.checkboxChecked]}>
                {saveToFavorites && (
                  <MaterialIcons name="check" size={16} color="#fff" />
                )}
              </View>
              <Text style={styles.checkboxLabel}>Save to Favorites</Text>
            </TouchableOpacity>

            {saveToFavorites && (
              <View style={styles.categoryContainer}>
                <Text style={styles.categoryLabel}>Category:</Text>
                <View style={styles.categoryButtons}>
                  {['Office', 'Client', 'Home', 'Other'].map((cat) => (
                    <TouchableOpacity
                      key={cat}
                      style={[
                        styles.categoryButton,
                        category === cat && styles.categoryButtonSelected,
                      ]}
                      onPress={() => setCategory(cat)}
                    >
                      <Text
                        style={[
                          styles.categoryButtonText,
                          category === cat && styles.categoryButtonTextSelected,
                        ]}
                      >
                        {cat}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}
          </View>
          
          <View style={styles.modalButtons}>
            <TouchableOpacity
              style={styles.modalButtonSecondary}
              onPress={handleCancel}
            >
              <Text style={styles.modalButtonSecondaryText}>Cancel</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.modalButtonPrimary}
              onPress={handleConfirm}
            >
              <Text style={styles.modalButtonPrimaryText}>Confirm</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
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
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#f9f9f9',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#333',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  loadingContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  loadingText: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
  },
  coordinatesContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  coordinatesText: {
    fontSize: 12,
    color: '#666',
    fontFamily: 'monospace',
  },
  favoritesSection: {
    marginBottom: 20,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: '#2196F3',
    borderRadius: 4,
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#2196F3',
  },
  checkboxLabel: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  categoryContainer: {
    marginTop: 8,
  },
  categoryLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  categoryButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#f9f9f9',
  },
  categoryButtonSelected: {
    backgroundColor: '#2196F3',
    borderColor: '#2196F3',
  },
  categoryButtonText: {
    fontSize: 12,
    color: '#666',
  },
  categoryButtonTextSelected: {
    color: '#fff',
    fontWeight: '600',
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
  helpText: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
    fontStyle: 'italic',
  },
});

