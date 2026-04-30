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
import { formatAddressParts, parseAddressParts } from '../utils/addressFormatter';

interface LocationCaptureModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (locationDetails: LocationDetails) => void;
  title: string;
  locationType: 'start' | 'end';
  currentEmployee?: Employee | null;
  initialLocation?: Partial<LocationDetails> | null;
}

export default function LocationCaptureModal({
  visible,
  onClose,
  onConfirm,
  title,
  locationType,
  currentEmployee,
  initialLocation
}: LocationCaptureModalProps) {
  const [locationName, setLocationName] = useState('');
  const [locationAddress, setLocationAddress] = useState('');
  const [locationCity, setLocationCity] = useState('');
  const [locationState, setLocationState] = useState('');
  const [locationZip, setLocationZip] = useState('');
  const [currentLocation, setCurrentLocation] = useState<Location.LocationObject | null>(null);
  const [loading, setLoading] = useState(false);
  const [saveToFavorites, setSaveToFavorites] = useState(false);
  const [category, setCategory] = useState('Other');
  const [hasUserEditedAddress, setHasUserEditedAddress] = useState(false);

  const applyParsedAddress = (addressText: string) => {
    const parsed = parseAddressParts(addressText);
    setLocationAddress(parsed.street || addressText || '');
    setLocationCity(parsed.city || '');
    setLocationState((parsed.state || '').toUpperCase().slice(0, 2));
    setLocationZip((parsed.zipCode || '').replace(/\D/g, '').slice(0, 10));
  };

  useEffect(() => {
    if (visible) {
      const hasInitialAddress = !!initialLocation?.address;
      setHasUserEditedAddress(false);

      if (initialLocation?.name) {
        setLocationName(initialLocation.name);
      }
      if (initialLocation?.address) {
        applyParsedAddress(initialLocation.address);
      }
      if (
        typeof initialLocation?.latitude === 'number' &&
        typeof initialLocation?.longitude === 'number'
      ) {
        setCurrentLocation({
          coords: {
            latitude: initialLocation.latitude,
            longitude: initialLocation.longitude,
            altitude: null,
            accuracy: null,
            altitudeAccuracy: null,
            heading: null,
            speed: null,
          },
          timestamp: Date.now(),
        } as any);
      }

      // Keep a fresh GPS fix, but never overwrite a prefilled/editing address.
      getCurrentLocation(hasInitialAddress);
    }
  }, [visible, initialLocation]);

  const getCurrentLocation = async (preserveAddress: boolean = false) => {
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
        if (preciseAddress && !preserveAddress && !hasUserEditedAddress) {
          applyParsedAddress(preciseAddress);
        } else {
          const addressResponse = await Location.reverseGeocodeAsync({
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          });
          
          if (addressResponse.length > 0) {
            const address = addressResponse[0];
            const formattedAddress = `${address.street || ''} ${address.city || ''}, ${address.region || ''} ${address.postalCode || ''}`.trim();
            if (!preserveAddress && !hasUserEditedAddress) {
              applyParsedAddress(formattedAddress);
            }
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

  const saveLocation = async () => {
    const trimmedName = locationName.trim();
    const trimmedAddress = locationAddress.trim();
    const trimmedCity = locationCity.trim();
    const trimmedState = locationState.trim().toUpperCase();
    const trimmedZip = locationZip.trim();
    const composedAddress = formatAddressParts({
      street: trimmedAddress,
      city: trimmedCity,
      state: trimmedState,
      zipCode: trimmedZip,
    });

    if (!trimmedName && !trimmedAddress && !composedAddress) {
      Alert.alert('Validation Error', 'Please enter a location name or address');
      return;
    }

    // Allow address-only manual entry by deriving a display name from the address.
    const finalName = trimmedName || trimmedAddress.split(',')[0]?.trim() || 'Location';

    // If address is empty, use location name as fallback to ensure address is always populated
    // This prevents issues where reverse geocoding fails or returns incomplete addresses
    const finalAddress = composedAddress || trimmedAddress || finalName;

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
    setLocationCity('');
    setLocationState('');
    setLocationZip('');
    setCurrentLocation(null);
    setSaveToFavorites(false);
    setCategory('Other');
  };

  const handleConfirm = async () => {
    await saveLocation();
  };

  const handleCancel = () => {
    setLocationName('');
    setLocationAddress('');
    setLocationCity('');
    setLocationState('');
    setLocationZip('');
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
              {locationType === 'end' ? (
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={locationAddress}
                  onChangeText={(value) => {
                    setHasUserEditedAddress(true);
                    setLocationAddress(value);
                  }}
                  placeholder="Enter or confirm the address..."
                  placeholderTextColor="#999"
                  multiline={true}
                  numberOfLines={3}
                />
              ) : (
                <GooglePlacesAddressInput
                  value={locationAddress}
                  onChangeText={(value) => {
                    setHasUserEditedAddress(true);
                    setLocationAddress(value);
                  }}
                  placeholder="Enter or confirm the address..."
                  multiline={true}
                  numberOfLines={3}
                  onPlaceSelected={(details) => {
                    applyParsedAddress(details.formattedAddress);
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
              )}
            </ScrollToOnFocusView>
            <Text style={styles.helpText}>
              Confirm the street number before saving this location.
            </Text>
          </View>

          <View style={styles.cityStateRow}>
            <View style={[styles.inputGroup, styles.cityInput]}>
              <Text style={styles.label}>City</Text>
              <ScrollToOnFocusView>
                <TextInput
                  style={styles.input}
                  value={locationCity}
                  onChangeText={setLocationCity}
                  placeholder="City"
                  placeholderTextColor="#999"
                />
              </ScrollToOnFocusView>
            </View>
            <View style={[styles.inputGroup, styles.stateInput]}>
              <Text style={styles.label}>State</Text>
              <ScrollToOnFocusView>
                <TextInput
                  style={styles.input}
                  value={locationState}
                  onChangeText={(value) => setLocationState(value.toUpperCase().slice(0, 2))}
                  placeholder="ST"
                  placeholderTextColor="#999"
                  autoCapitalize="characters"
                  maxLength={2}
                />
              </ScrollToOnFocusView>
            </View>
            <View style={[styles.inputGroup, styles.zipInput]}>
              <Text style={styles.label}>Zip</Text>
              <ScrollToOnFocusView>
                <TextInput
                  style={styles.input}
                  value={locationZip}
                  onChangeText={(value) => setLocationZip(value.replace(/\D/g, '').slice(0, 10))}
                  placeholder="Zip"
                  placeholderTextColor="#999"
                  keyboardType="numeric"
                />
              </ScrollToOnFocusView>
            </View>
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
              <Text style={styles.modalButtonPrimaryText}>Save</Text>
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
  cityStateRow: {
    flexDirection: 'row',
    gap: 8,
  },
  cityInput: {
    flex: 2,
  },
  stateInput: {
    flex: 1,
  },
  zipInput: {
    flex: 1.2,
  },
});

