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
  Alert,
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
  employeeBaseAddress?: string; // Added for state filtering
  autoOpen?: boolean; // Automatically open search interface when component mounts
}

export const OxfordHouseSearchInput: React.FC<OxfordHouseSearchInputProps> = ({
  value,
  onChangeText,
  placeholder = 'Search for Oxford House...',
  label = 'Location',
  onHouseSelected,
  allowManualEntry = true,
  employeeId, // Destructure employeeId
  employeeBaseAddress, // Destructure employeeBaseAddress
  autoOpen = false, // Destructure autoOpen
}) => {
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<OxfordHouse[]>([]);
  const [allHouses, setAllHouses] = useState<OxfordHouse[]>([]);
  const [loading, setLoading] = useState(false);
  const [isManualEntry, setIsManualEntry] = useState(false);
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]); // New state for saved addresses
  const [selectedState, setSelectedState] = useState<string>(''); // State filter
  const [availableStates, setAvailableStates] = useState<string[]>([]); // List of states
  const [isStatePickerVisible, setIsStatePickerVisible] = useState(false);

  useEffect(() => {
    loadOxfordHouses();
    if (employeeId) {
      loadSavedAddresses(employeeId); // Load saved addresses on mount
    }
  }, [employeeId]);

  // Auto-open search interface if autoOpen prop is true
  useEffect(() => {
    if (autoOpen) {
      setIsSearchVisible(true);
    }
  }, [autoOpen]);

  useEffect(() => {
    if (searchQuery.trim()) {
      performSearch(searchQuery);
    } else if (selectedState) {
      // If no search query but state is selected, show only houses from that state
      const filteredByState = allHouses.filter(h => h.state === selectedState);
      setSearchResults(filteredByState);
    } else {
      setSearchResults(allHouses);
    }
  }, [searchQuery, allHouses, selectedState]);


  const loadOxfordHouses = async () => {
    try {
      setLoading(true);
      await OxfordHouseService.initializeOxfordHouses();
      const houses = await OxfordHouseService.getAllOxfordHouses();
      setAllHouses(houses);
      
      // Extract unique states from houses
      const states = Array.from(new Set(houses.map(h => h.state))).sort();
      setAvailableStates(states);
      
      // Set default state filter based on employee's base address
      let defaultState = '';
      if (employeeBaseAddress) {
        const extractedState = OxfordHouseService.extractStateFromAddress(employeeBaseAddress);
        if (extractedState && states.includes(extractedState)) {
          defaultState = extractedState;
          setSelectedState(extractedState);
          // Filter houses by default state
          const filteredHouses = houses.filter(h => h.state === extractedState);
          setSearchResults(filteredHouses);
        } else {
          setSearchResults(houses);
        }
      } else {
        setSearchResults(houses);
      }
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
      const oxfordResults = await OxfordHouseService.searchOxfordHouses(query, selectedState);
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
  
  const handleStateFilterChange = async (state: string) => {
    setSelectedState(state);
    try {
      const filteredResults = state 
        ? await OxfordHouseService.getOxfordHousesByState(state)
        : await OxfordHouseService.getAllOxfordHouses();
      setSearchResults(filteredResults);
    } catch (error) {
      console.error('Error filtering by state:', error);
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
      style={styles.wazeHouseItem}
      onPress={() => handleHouseSelect(item)}
      activeOpacity={0.7}
    >
      <View style={styles.wazeHouseIconContainer}>
        <MaterialIcons 
          name={item.isSavedAddress ? "star" : "place"} 
          size={28} 
          color={item.isSavedAddress ? "#FFD700" : "#2196F3"} 
        />
      </View>
      <View style={styles.wazeHouseInfo}>
        <Text style={styles.wazeHouseName}>{item.name}</Text>
        <Text style={styles.wazeHouseAddress}>
          {item.isSavedAddress ? item.address : OxfordHouseService.formatHouseAddress(item)}
        </Text>
        {item.phoneNumber && !item.isSavedAddress && (
          <Text style={styles.wazeHousePhone}>{item.phoneNumber}</Text>
        )}
        {item.isSavedAddress && (
          <Text style={styles.wazeSavedLabel}>⭐ Saved Address</Text>
        )}
      </View>
      <MaterialIcons name="chevron-right" size={24} color="#ccc" />
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
              {/* Waze-style Header */}
              <View style={styles.wazeHeader}>
                <TouchableOpacity onPress={handleCloseSearch} style={styles.backButton}>
                  <MaterialIcons name="arrow-back" size={24} color="#fff" />
                </TouchableOpacity>
                <Text style={styles.wazeTitle}>Where to?</Text>
                <View style={styles.headerSpacer} />
              </View>

              {/* Waze-style Search Bar */}
              <View style={styles.wazeSearchContainer}>
                <View style={styles.wazeSearchBar}>
                  <MaterialIcons name="search" size={20} color="#666" style={styles.wazeSearchIcon} />
                  <TextInput
                    style={styles.wazeSearchInput}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    placeholder={isManualEntry ? "Enter location manually..." : "Search Oxford Houses..."}
                    placeholderTextColor="#999"
                    autoFocus
                  />
                  {searchQuery.length > 0 && (
                    <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearButton}>
                      <MaterialIcons name="clear" size={20} color="#666" />
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              {!isManualEntry && (
                <View style={styles.stateFilterContainer}>
                  <Text style={styles.stateFilterLabel}>Filter by State:</Text>
                  <TouchableOpacity
                    style={styles.statePickerButton}
                    onPress={() => setIsStatePickerVisible(true)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.statePickerText}>
                      {selectedState ? selectedState : 'All States'}
                    </Text>
                    <MaterialIcons name="arrow-drop-down" size={24} color="#666" />
                  </TouchableOpacity>
                </View>
              )}

              {/* State Picker Overlay */}
              {isStatePickerVisible && (
                <View style={styles.statePickerOverlay}>
                  <View style={styles.statePickerOverlayContent}>
                    <View style={styles.statePickerOverlayHeader}>
                      <Text style={styles.statePickerOverlayTitle}>Select State</Text>
                      <TouchableOpacity 
                        onPress={() => setIsStatePickerVisible(false)}
                        style={styles.statePickerOverlayCloseButton}
                      >
                        <MaterialIcons name="close" size={24} color="#666" />
                      </TouchableOpacity>
                    </View>
                    
                    <FlatList
                      data={['', ...availableStates]}
                      keyExtractor={(item, index) => index.toString()}
                      renderItem={({ item }) => (
                        <TouchableOpacity
                          style={[
                            styles.statePickerOverlayItem,
                            selectedState === item && styles.statePickerOverlayItemSelected
                          ]}
                          onPress={() => {
                            handleStateFilterChange(item);
                            setIsStatePickerVisible(false);
                          }}
                        >
                          <Text style={[
                            styles.statePickerOverlayItemText,
                            selectedState === item && styles.statePickerOverlayItemTextSelected
                          ]}>
                            {item || 'All States'}
                          </Text>
                          {selectedState === item && (
                            <MaterialIcons name="check" size={20} color="#2196F3" />
                          )}
                        </TouchableOpacity>
                      )}
                      style={styles.statePickerOverlayList}
                      ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                          <Text style={styles.emptyText}>Loading states...</Text>
                        </View>
                      }
                    />
                  </View>
                </View>
              )}

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
  stateFilterContainer: {
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  stateFilterLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  statePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#2196F3',
    paddingHorizontal: 12,
    paddingVertical: 12,
    height: 50,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  statePickerText: {
    fontSize: 16,
    color: '#333',
    flex: 1,
  },
  // State Picker Overlay Styles
  statePickerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  statePickerOverlayContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    width: '90%',
    maxHeight: '85%',
    minHeight: '70%',
    height: '80%',
  },
  statePickerOverlayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  statePickerOverlayTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  statePickerOverlayCloseButton: {
    padding: 4,
  },
  statePickerOverlayList: {
    flex: 1,
  },
  statePickerOverlayItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    minHeight: 48,
  },
  statePickerOverlayItemSelected: {
    backgroundColor: '#f0f8ff',
  },
  statePickerOverlayItemText: {
    fontSize: 16,
    color: '#333',
    flex: 1,
  },
  statePickerOverlayItemTextSelected: {
    color: '#2196F3',
    fontWeight: '600',
  },
  // Waze-style styles
  wazeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2196F3',
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    paddingBottom: 15,
    paddingHorizontal: 20,
  },
  backButton: {
    padding: 8,
    marginRight: 10,
  },
  wazeTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
    flex: 1,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 40, // Same width as back button to center title
  },
  wazeSearchContainer: {
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  wazeSearchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 25,
    paddingHorizontal: 15,
    paddingVertical: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  wazeSearchIcon: {
    marginRight: 10,
  },
  wazeSearchInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  clearButton: {
    padding: 5,
    marginLeft: 10,
  },
  // Waze-style house item styles
  wazeHouseItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    backgroundColor: '#fff',
  },
  wazeHouseIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f8f9fa',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 15,
  },
  wazeHouseInfo: {
    flex: 1,
  },
  wazeHouseName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  wazeHouseAddress: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  wazeHousePhone: {
    fontSize: 12,
    color: '#999',
  },
  wazeSavedLabel: {
    fontSize: 12,
    color: '#FFD700',
    fontWeight: '600',
    marginTop: 2,
  },
});
