import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  TouchableOpacity,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { LocationDetails, Employee } from '../types';
import { DatabaseService } from '../services/database';
import GooglePlacesAddressInput from './GooglePlacesAddressInput';
import { GooglePlacesService } from '../services/googlePlacesService';
import { KeyboardAwareScrollView, ScrollToOnFocusView } from './KeyboardAwareScrollView';
import { makeLocationDetails } from '../utils/locationSelection';

interface LocationCaptureModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (locationDetails: LocationDetails) => void;
  title: string;
  locationType: 'start' | 'end';
  currentEmployee?: Employee | null;
}

export default function LocationCaptureModal({
  visible,
  onClose,
  onConfirm,
  title,
  locationType,
  currentEmployee
}: LocationCaptureModalProps) {
  const [locationName, setLocationName] = useState('');
  const [locationAddress, setLocationAddress] = useState('');
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
      
      // Try fuller Google geocoding first, then fall back to Expo reverse geocode.
      try {
        const preciseAddress = await GooglePlacesService.getAddressFromCoordinates(
          location.coords.latitude,
          location.coords.longitude
        );
        if (preciseAddress) {
          setLocationAddress(preciseAddress);
        } else {
          const addressResponse = await Location.reverseGeocodeAsync({
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          });
          
          if (addressResponse.length > 0) {
            const address = addressResponse[0];
            const formattedAddress = `${address.street || ''} ${address.city || ''}, ${address.region || ''} ${address.postalCode || ''}`.trim();
            setLocationAddress(formattedAddress);
          }
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
    const trimmedName = locationName.trim();
    const trimmedAddress = locationAddress.trim();

    if (!trimmedName && !trimmedAddress) {
      Alert.alert('Validation Error', 'Please enter a location address');
      return;
    }

    // Allow address-only manual entry by deriving a display name from the address.
    const finalName = trimmedName || trimmedAddress.split(',')[0]?.trim() || 'Location';

    // If address is empty, use location name as fallback to ensure address is always populated
    // This prevents issues where reverse geocoding fails or returns incomplete addresses
    const finalAddress = trimmedAddress || finalName;

    const locationDetails: LocationDetails = makeLocationDetails({
      name: finalName,
      address: finalAddress,
      source: 'manual',
      latitude: currentLocation?.coords.latitude,
      longitude: currentLocation?.coords.longitude,
    });

    // Save to favorites if checkbox is checked
    if (saveToFavorites && currentEmployee) {
      try {
        await DatabaseService.createSavedAddress({
          employeeId: currentEmployee.id,
          name: finalName,
          address: finalAddress,
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

    onConfirm(locationDetails);
    setLocationName('');
    setLocationAddress('');
    setCurrentLocation(null);
    setSaveToFavorites(false);
    setCategory('Other');
  };

  const handleCancel = () => {
    setLocationName('');
    setLocationAddress('');
    setCurrentLocation(null);
    setSaveToFavorites(false);
    setCategory('Other');
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType={Platform.OS === 'ios' ? 'none' : 'slide'}
      presentationStyle="overFullScreen"
      onRequestClose={handleCancel}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.modalOverlay}
      >
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>{title}</Text>
          
          <KeyboardAwareScrollView
            style={styles.modalScrollView}
            contentContainerStyle={styles.modalScrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Location Name *</Text>
            <ScrollToOnFocusView>
              <TextInput
                style={styles.input}
                value={locationName}
                onChangeText={setLocationName}
                placeholder="e.g., Office, Client Site, Home"
                placeholderTextColor="#999"
              />
            </ScrollToOnFocusView>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Address *</Text>
            <ScrollToOnFocusView>
              <GooglePlacesAddressInput
                value={locationAddress}
                onChangeText={setLocationAddress}
                placeholder="Enter or confirm the address..."
                multiline={true}
                numberOfLines={3}
                onPlaceSelected={(details) => {
                  setLocationAddress(details.formattedAddress);
                  if (details.latitude && details.longitude) {
                    setCurrentLocation({
                      coords: {
                        latitude: details.latitude,
                        longitude: details.longitude,
                        altitude: null,
                        accuracy: null,
                        altitudeAccuracy: null,
                        heading: null,
                        speed: null,
                      },
                      timestamp: Date.now(),
                    } as any);
                  }
                }}
              />
            </ScrollToOnFocusView>
            <Text style={styles.helpText}>
              Confirm the street number before saving this location.
            </Text>
          </View>

          {/* Return to BA Quick Action - Only show for end locations */}
          {locationType === 'end' && currentEmployee?.baseAddress && (
            <TouchableOpacity
              style={styles.quickActionButton}
              onPress={() => {
                setLocationName('BA');
                setLocationAddress(currentEmployee.baseAddress || '');
              }}
            >
              <MaterialIcons name="home" size={24} color="#2196F3" />
              <Text style={styles.quickActionText}>Return to Base Address</Text>
            </TouchableOpacity>
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
          </KeyboardAwareScrollView>
          
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
      </KeyboardAvoidingView>
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
    maxHeight: '85%', // Allow modal to scroll on smaller screens
  },
  modalScrollView: {
    maxHeight: 400, // Limit scroll area height
  },
  modalScrollContent: {
    paddingBottom: 10,
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
  quickActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E3F2FD',
    borderWidth: 1,
    borderColor: '#2196F3',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    marginTop: 8,
  },
  quickActionText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2196F3',
    marginLeft: 8,
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

