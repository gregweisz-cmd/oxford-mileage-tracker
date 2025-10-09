import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Modal,
  Alert,
  ScrollView,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { DatabaseService } from '../services/database';
import { OxfordHouseService } from '../services/oxfordHouseService';
import { LocationDetails } from '../types';

interface EnhancedLocationInputProps {
  value: string;
  onChangeText: (value: string) => void;
  onLocationDetailsChange: (details: LocationDetails | null) => void;
  placeholder: string;
  label: string;
  isRequired?: boolean;
  showLocationDetails?: boolean;
}

interface LocationSuggestion {
  name: string;
  address: string;
  type: 'saved' | 'recent' | 'oxford_house';
  lastUsed?: Date;
}

export default function EnhancedLocationInput({
  value,
  onChangeText,
  onLocationDetailsChange,
  placeholder,
  label,
  isRequired = false,
  showLocationDetails = true,
}: EnhancedLocationInputProps) {
  const [locationDetails, setLocationDetails] = useState<LocationDetails | null>(null);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [locationSuggestions, setLocationSuggestions] = useState<LocationSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSelectingSuggestion, setIsSelectingSuggestion] = useState(false);

  useEffect(() => {
    if (value) {
      // Parse existing location details if available
      const details = parseLocationDetails(value);
      setLocationDetails(details);
      onLocationDetailsChange(details);
    }
  }, [value]);

  const parseLocationDetails = (locationText: string): LocationDetails | null => {
    // Try to parse location details from the text
    // This could be enhanced to parse from saved locations or previous entries
    if (locationText.includes(' - ')) {
      const parts = locationText.split(' - ');
      return {
        name: parts[0] || '',
        address: parts[1] || '',
      };
    }
    return null;
  };

  const handleLocationInputChange = (text: string) => {
    console.log('Input changed to:', text);
    onChangeText(text);
    
    // Show suggestions if user is typing
    if (text.length >= 2) {
      loadLocationSuggestions(text);
      setShowSuggestions(true);
    } else {
      setShowSuggestions(false);
    }
  };

  const loadLocationSuggestions = async (searchText: string) => {
    try {
      // Get saved addresses for suggestions
      const savedAddresses = await DatabaseService.getSavedAddresses();
      const recentLocations = await DatabaseService.getRecentLocations();
      
      const suggestions: LocationSuggestion[] = [];
      
      // Add saved addresses
      savedAddresses.forEach(addr => {
        if (addr.name.toLowerCase().includes(searchText.toLowerCase()) ||
            addr.address.toLowerCase().includes(searchText.toLowerCase())) {
          suggestions.push({
            name: addr.name,
            address: addr.address,
            type: 'saved',
          });
        }
      });

      // Add recent locations from mileage entries
      recentLocations.forEach(location => {
        if (location.toLowerCase().includes(searchText.toLowerCase())) {
          const details = parseLocationDetails(location);
          if (details) {
            suggestions.push({
              name: details.name,
              address: details.address,
              type: 'recent',
            });
          }
        }
      });

      // Add Oxford Houses
      try {
        const oxfordHouses = await OxfordHouseService.searchOxfordHouses(searchText);
        oxfordHouses.forEach(house => {
          suggestions.push({
            name: house.name,
            address: OxfordHouseService.formatHouseAddress(house),
            type: 'oxford_house',
          });
        });
      } catch (error) {
        console.error('Error loading Oxford Houses:', error);
      }

      setLocationSuggestions(suggestions.slice(0, 8)); // Limit to 8 suggestions (increased to accommodate Oxford Houses)
    } catch (error) {
      console.error('Error loading location suggestions:', error);
    }
  };

  const handleSuggestionSelect = (suggestion: LocationSuggestion) => {
    console.log('Suggestion selected:', suggestion);
    const locationText = `${suggestion.name} - ${suggestion.address}`;
    console.log('Setting location text:', locationText);
    
    // Update text immediately
    onChangeText(locationText);
    
    const details: LocationDetails = {
      name: suggestion.name,
      address: suggestion.address,
    };
    
    setLocationDetails(details);
    onLocationDetailsChange(details);
    
    // Hide suggestions immediately
    setShowSuggestions(false);
    console.log('Suggestion selection completed');
  };

  const handleLocationDetailsEdit = () => {
    setShowLocationModal(true);
  };

  const handleLocationDetailsSave = (details: LocationDetails) => {
    const locationText = `${details.name} - ${details.address}`;
    onChangeText(locationText);
    setLocationDetails(details);
    onLocationDetailsChange(details);
    setShowLocationModal(false);
  };

  const getLocationIcon = () => {
    if (locationDetails?.name) {
      if (locationDetails.name.includes('Oxford House') || locationDetails.name.includes('OH')) {
        return 'home';
      } else if (locationDetails.name.includes('Office') || locationDetails.name.includes('Base')) {
        return 'business';
      } else {
        return 'location-on';
      }
    }
    return 'place';
  };

  // Helper function to filter out placeholder text
  const filterPlaceholderText = (value: string): string => {
    if (!value) return '';
    const placeholderTexts = ['to be updated', 'tbd', 'n/a', 'none', 'null', 'undefined'];
    const isPlaceholder = placeholderTexts.includes(value.toLowerCase().trim());
    return isPlaceholder ? '' : value;
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>
        {label} {isRequired && <Text style={styles.required}>*</Text>}
      </Text>
      
      <View style={styles.inputWrapper}>
      
      <View style={styles.inputContainer}>
        <MaterialIcons name={getLocationIcon()} size={20} color="#666" style={styles.inputIcon} />
        <TextInput
          style={styles.input}
          value={filterPlaceholderText(value)}
          onChangeText={handleLocationInputChange}
          placeholder={placeholder}
          placeholderTextColor="#999"
          onFocus={() => {
            if (value.length >= 2) {
              setShowSuggestions(true);
            }
          }}
        />
        {showLocationDetails && (
          <TouchableOpacity
            style={styles.editButton}
            onPress={handleLocationDetailsEdit}
          >
            <MaterialIcons name="edit" size={16} color="#2196F3" />
          </TouchableOpacity>
        )}
      </View>

      {/* Location Details Display */}
      {showLocationDetails && locationDetails && (
        <View style={styles.locationDetailsContainer}>
          <View style={styles.locationDetailsHeader}>
            <MaterialIcons name="info" size={16} color="#666" />
            <Text style={styles.locationDetailsTitle}>Location Details</Text>
          </View>
          <Text style={styles.locationName}>{locationDetails.name}</Text>
          <Text style={styles.locationAddress}>{locationDetails.address}</Text>
        </View>
      )}

      {/* Location Suggestions */}
      {showSuggestions && locationSuggestions.length > 0 && (
        <ScrollView 
          style={styles.suggestionsContainer}
          nestedScrollEnabled={true}
          showsVerticalScrollIndicator={true}
          keyboardShouldPersistTaps="handled"
        >
          {locationSuggestions.map((item, index) => (
            <TouchableOpacity
              key={`${item.name}-${index}`}
              style={styles.suggestionItem}
              onPress={() => {
                console.log('Suggestion pressed:', item);
                handleSuggestionSelect(item);
              }}
              activeOpacity={0.7}
            >
              <MaterialIcons 
                name={item.type === 'saved' ? 'bookmark' : item.type === 'oxford_house' ? 'home' : 'history'} 
                size={16} 
                color={item.type === 'saved' ? '#4CAF50' : item.type === 'oxford_house' ? '#2196F3' : '#FF9800'} 
              />
              <View style={styles.suggestionContent}>
                <Text style={styles.suggestionName}>{item.name}</Text>
                <Text style={styles.suggestionAddress}>{item.address}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
      
      </View>

      {/* Location Details Modal */}
      <LocationDetailsModal
        visible={showLocationModal}
        locationDetails={locationDetails}
        onSave={handleLocationDetailsSave}
        onCancel={() => setShowLocationModal(false)}
      />
    </View>
  );
}

interface LocationDetailsModalProps {
  visible: boolean;
  locationDetails: LocationDetails | null;
  onSave: (details: LocationDetails) => void;
  onCancel: () => void;
}

function LocationDetailsModal({ visible, locationDetails, onSave, onCancel }: LocationDetailsModalProps) {
  const [name, setName] = useState(locationDetails?.name || '');
  const [address, setAddress] = useState(locationDetails?.address || '');

  useEffect(() => {
    if (visible && locationDetails) {
      setName(locationDetails.name);
      setAddress(locationDetails.address);
    } else if (visible) {
      setName('');
      setAddress('');
    }
  }, [visible, locationDetails]);

  const handleSave = () => {
    if (!name.trim() || !address.trim()) {
      Alert.alert('Validation Error', 'Please enter both name and address');
      return;
    }

    onSave({
      name: name.trim(),
      address: address.trim(),
    });
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Location Details</Text>
            <TouchableOpacity onPress={onCancel}>
              <MaterialIcons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>

          <View style={styles.modalBody}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Location Name *</Text>
              <TextInput
                style={styles.modalInput}
                value={name}
                onChangeText={setName}
                placeholder="e.g., Oxford House Charlotte, Client Office"
                placeholderTextColor="#999"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Full Address *</Text>
              <TextInput
                style={[styles.modalInput, styles.addressInput]}
                value={address}
                onChangeText={setAddress}
                placeholder="e.g., 123 Main St, Charlotte, NC 28215"
                placeholderTextColor="#999"
                multiline
              />
            </View>
          </View>

          <View style={styles.modalActions}>
            <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
              <Text style={styles.saveButtonText}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  inputWrapper: {
    position: 'relative',
    zIndex: 1,
  },
  required: {
    color: '#F44336',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
  },
  inputIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    paddingVertical: 12,
  },
  editButton: {
    padding: 4,
  },
  locationDetailsContainer: {
    marginTop: 8,
    padding: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  locationDetailsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  locationDetailsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginLeft: 4,
  },
  locationName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  locationAddress: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  suggestionsContainer: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    marginTop: 4,
    height: 250,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 1000,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  suggestionContent: {
    flex: 1,
    marginLeft: 8,
  },
  suggestionName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  suggestionAddress: {
    fontSize: 14,
    color: '#666',
  },
  // Modal styles
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
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  modalBody: {
    marginBottom: 20,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  modalInput: {
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#333',
  },
  addressInput: {
    height: 80,
    textAlignVertical: 'top',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  cancelButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
  },
  cancelButtonText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  saveButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#2196F3',
  },
  saveButtonText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
});
