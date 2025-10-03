import React, { useState, useEffect } from 'react';
import {
  View,
  TextInput,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { OxfordHouse, SavedAddress } from '../types';
import { OxfordHouseService } from '../services/oxfordHouseService';
import { SavedAddressService } from '../services/savedAddressService';

interface OxfordHouseSearchInputProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  label?: string;
  onHouseSelected?: (house: OxfordHouse) => void;
  allowManualEntry?: boolean;
  employeeId?: string; // Added for saved addresses
}

export const OxfordHouseSearchInput: React.FC<OxfordHouseSearchInputProps> = ({
  value,
  onChangeText,
  placeholder = 'Search for Oxford House...',
  label = 'Location',
  onHouseSelected,
  allowManualEntry = true,
  employeeId, // Destructure employeeId
}) => {
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<OxfordHouse[]>([]);
  const [allHouses, setAllHouses] = useState<OxfordHouse[]>([]);
  const [loading, setLoading] = useState(false);
  const [isManualEntry, setIsManualEntry] = useState(false);
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]); // New state for saved addresses

  useEffect(() => {
    loadOxfordHouses();
    if (employeeId) {
      loadSavedAddresses(employeeId); // Load saved addresses on mount
    }
  }, [employeeId]);

  useEffect(() => {
    if (searchQuery.trim()) {
      performSearch(searchQuery);
    } else {
      setSearchResults(allHouses);
    }
  }, [searchQuery, allHouses]);

  const loadOxfordHouses = async () => {
    try {
      setLoading(true);
      await OxfordHouseService.initializeOxfordHouses();
      const houses = await OxfordHouseService.getAllOxfordHouses();
      setAllHouses(houses);
      setSearchResults(houses);
    } catch (error) {
      console.error('Error loading Oxford Houses:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadSavedAddresses = async (employeeId: string) => {
    try {
      const addresses = await SavedAddressService.getAllSavedAddresses(employeeId);
      setSavedAddresses(addresses);
    } catch (error) {
      console.error('Error loading saved addresses:', error);
    }
  };

  const performSearch = async (query: string) => {
    try {
      const oxfordResults = await OxfordHouseService.searchOxfordHouses(query);
      const savedResults = await SavedAddressService.searchSavedAddresses(query, employeeId);
      
      // Combine results with saved addresses first
      const combinedResults = [...savedResults.map(addr => ({
        id: addr.id,
        name: addr.name,
        address: addr.address,
        city: '',
        state: '',
        zipCode: '',
        phoneNumber: '',
        createdAt: addr.createdAt,
        updatedAt: addr.updatedAt,
        isSavedAddress: true // Flag to identify saved addresses
      })), ...oxfordResults];
      
      setSearchResults(combinedResults);
    } catch (error) {
      console.error('Error searching:', error);
    }
  };

  const handleHouseSelect = (house: OxfordHouse) => {
    const displayText = OxfordHouseService.formatHouseDisplay(house);
    onChangeText(displayText);
    setIsSearchVisible(false);
    setSearchQuery('');
    
    if (onHouseSelected) {
      onHouseSelected(house);
    }
  };

  const handleInputPress = () => {
    setIsSearchVisible(true);
    setSearchQuery(value);
    setIsManualEntry(false);
  };

  const handleCloseSearch = () => {
    setIsSearchVisible(false);
    setSearchQuery('');
    setIsManualEntry(false);
  };

  const handleManualEntry = () => {
    console.log('Manual entry button clicked');
    setIsManualEntry(true);
    setSearchQuery(value);
  };

  const handleManualEntrySave = () => {
    console.log('Manual entry save clicked, searchQuery:', searchQuery);
    onChangeText(searchQuery.trim());
    setIsSearchVisible(false);
    setSearchQuery('');
    setIsManualEntry(false);
  };

  const renderHouseItem = ({ item }: { item: any }) => (
    <TouchableOpacity
      style={styles.houseItem}
      onPress={() => handleHouseSelect(item)}
    >
      <MaterialIcons 
        name={item.isSavedAddress ? "star" : "home"} 
        size={24} 
        color={item.isSavedAddress ? "#FFD700" : "#2196F3"} 
      />
      <View style={styles.houseInfo}>
        <Text style={styles.houseName}>{item.name}</Text>
        <Text style={styles.houseAddress}>
          {item.isSavedAddress ? item.address : OxfordHouseService.formatHouseAddress(item)}
        </Text>
        {item.phoneNumber && !item.isSavedAddress && (
          <Text style={styles.housePhone}>{item.phoneNumber}</Text>
        )}
        {item.isSavedAddress && (
          <Text style={styles.savedAddressLabel}>⭐ Saved Address</Text>
        )}
      </View>
      <MaterialIcons name="chevron-right" size={24} color="#666" />
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}
      
      <TouchableOpacity
        style={styles.inputContainer}
        onPress={handleInputPress}
      >
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#999"
          editable={false}
          pointerEvents="none"
        />
        <MaterialIcons name="search" size={24} color="#666" style={styles.searchIcon} />
      </TouchableOpacity>

      <Modal
        visible={isSearchVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={handleCloseSearch}
      >
        <KeyboardAvoidingView 
          style={styles.modalContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Search Oxford Houses</Text>
                <TouchableOpacity onPress={handleCloseSearch} style={styles.closeButton}>
                  <MaterialIcons name="close" size={24} color="#666" />
                </TouchableOpacity>
              </View>

              <View style={styles.searchContainer}>
                <TextInput
                  style={styles.searchInput}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder={isManualEntry ? "Enter location manually..." : "Type house name, city, or address..."}
                  placeholderTextColor="#999"
                  autoFocus
                />
                <MaterialIcons name={isManualEntry ? "edit" : "search"} size={24} color="#666" style={styles.searchInputIcon} />
              </View>

              {allowManualEntry && !isManualEntry && (
                <View style={styles.manualEntryContainer}>
                  <TouchableOpacity
                    style={styles.manualEntryButton}
                    onPress={handleManualEntry}
                  >
                    <MaterialIcons name="edit" size={20} color="#2196F3" />
                    <Text style={styles.manualEntryText}>Enter location manually</Text>
                  </TouchableOpacity>
                </View>
              )}

              {isManualEntry ? (
                <View style={styles.manualEntryContent}>
                  <View style={styles.manualEntryInfo}>
                    <MaterialIcons name="edit" size={48} color="#2196F3" />
                    <Text style={styles.manualEntryTitle}>Manual Entry</Text>
                    <Text style={styles.manualEntryDescription}>
                      Enter any location manually in the search box above. This will be saved as entered.
                    </Text>
                  </View>
                  
                  <View style={styles.manualEntryActions}>
                    <TouchableOpacity
                      style={[styles.actionButton, styles.cancelButton]}
                      onPress={() => setIsManualEntry(false)}
                    >
                      <Text style={styles.cancelButtonText}>Back to Search</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity
                      style={[
                        styles.actionButton, 
                        styles.saveButton,
                        !searchQuery.trim() && styles.disabledButton
                      ]}
                      onPress={handleManualEntrySave}
                      disabled={!searchQuery.trim()}
                    >
                      <Text style={[
                        styles.saveButtonText,
                        !searchQuery.trim() && styles.disabledButtonText
                      ]}>
                        Save Location
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : loading ? (
                <View style={styles.loadingContainer}>
                  <Text style={styles.loadingText}>Loading Oxford Houses...</Text>
                </View>
              ) : (
                <FlatList
                  data={searchResults}
                  keyExtractor={(item) => item.id}
                  renderItem={renderHouseItem}
                  style={styles.resultsList}
                  showsVerticalScrollIndicator={false}
                  ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                      <MaterialIcons name="home" size={48} color="#ccc" />
                      <Text style={styles.emptyText}>No Oxford Houses found</Text>
                      <Text style={styles.emptySubtext}>Try a different search term or enter manually</Text>
                    </View>
                  }
                />
              )}
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    backgroundColor: '#fff',
  },
  input: {
    flex: 1,
    padding: 12,
    fontSize: 16,
    color: '#333',
  },
  searchIcon: {
    padding: 12,
  },
  modalContainer: {
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    minHeight: '60%',
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
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    padding: 4,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 20,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    backgroundColor: '#f9f9f9',
  },
  searchInput: {
    flex: 1,
    padding: 12,
    fontSize: 16,
    color: '#333',
  },
  searchInputIcon: {
    padding: 12,
  },
  resultsList: {
    flex: 1,
  },
  houseItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  houseInfo: {
    flex: 1,
  },
  houseName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  houseAddress: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  housePhone: {
    fontSize: 12,
    color: '#999',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
  },
  manualEntryContainer: {
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  manualEntryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f0f8ff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2196F3',
  },
  manualEntryText: {
    marginLeft: 8,
    fontSize: 16,
    color: '#2196F3',
    fontWeight: '500',
  },
  manualEntryContent: {
    flex: 1,
    padding: 20,
  },
  manualEntryInfo: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  manualEntryTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  manualEntryDescription: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
  },
  manualEntryActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
    gap: 12,
  },
  actionButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  saveButton: {
    backgroundColor: '#2196F3',
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  disabledButton: {
    backgroundColor: '#ccc',
  },
  disabledButtonText: {
    color: '#999',
  },
  savedAddressLabel: {
    fontSize: 12,
    color: '#FFD700',
    fontWeight: '600',
    marginTop: 2,
  },
});
