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
import { DatabaseService } from '../services/database';

type SearchResultItem = OxfordHouse & {
  isSavedAddress?: boolean;
  isRecentAddress?: boolean;
  isFrequentAddress?: boolean;
  sourceAddress?: string;
};

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
  const [searchResults, setSearchResults] = useState<SearchResultItem[]>([]);
  const [allHouses, setAllHouses] = useState<OxfordHouse[]>([]);
  const [loading, setLoading] = useState(false);
  const [isManualEntry, setIsManualEntry] = useState(false);
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]); // New state for saved addresses
  const [recentAddresses, setRecentAddresses] = useState<SearchResultItem[]>([]);
  const [frequentAddresses, setFrequentAddresses] = useState<SearchResultItem[]>([]);
  const [selectedState, setSelectedState] = useState<string>(''); // State filter
  const [availableStates, setAvailableStates] = useState<string[]>([]); // List of states
  const [isStatePickerVisible, setIsStatePickerVisible] = useState(false);

  useEffect(() => {
    loadOxfordHouses();
    if (employeeId) {
      loadSavedAddresses(employeeId); // Load saved addresses on mount
      loadFrequentAndRecentAddresses(employeeId);
    }
  }, [employeeId]);

  // Auto-open search interface if autoOpen prop is true
  useEffect(() => {
    if (autoOpen) {
      setIsSearchVisible(true);
    }
  }, [autoOpen]);

  useEffect(() => {
    performSearch(searchQuery);
  }, [searchQuery, allHouses, selectedState, recentAddresses, frequentAddresses]);


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

  const loadFrequentAndRecentAddresses = async (employeeId: string) => {
    try {
      const entries = await DatabaseService.getMileageEntries(employeeId);
      const recentMap = new Map<string, SearchResultItem>();
      const frequency = new Map<string, { count: number; item: SearchResultItem }>();

      const toResult = (name: string, address: string, kind: 'recent' | 'frequent'): SearchResultItem | null => {
        const n = (name || '').trim();
        const a = (address || '').trim();
        if (!a) return null;
        const title = n || a.split(',')[0] || 'Location';
        return {
          id: `${kind}-${title}-${a}`.toLowerCase().replace(/\s+/g, '-'),
          name: title,
          address: a,
          city: '',
          state: '',
          zipCode: '',
          phoneNumber: '',
          createdAt: new Date(),
          updatedAt: new Date(),
          sourceAddress: a,
          isRecentAddress: kind === 'recent',
          isFrequentAddress: kind === 'frequent',
        } as SearchResultItem;
      };

      const ingest = (name: string, address: string) => {
        const item = toResult(name, address, 'recent');
        if (!item) return;
        const key = item.sourceAddress!.toLowerCase();
        if (!recentMap.has(key)) {
          recentMap.set(key, item);
        }
        const prev = frequency.get(key);
        if (prev) {
          prev.count += 1;
        } else {
          frequency.set(key, { count: 1, item });
        }
      };

      entries.forEach((entry) => {
        ingest(entry.startLocationDetails?.name || '', entry.startLocationDetails?.address || entry.startLocation);
        ingest(entry.endLocationDetails?.name || '', entry.endLocationDetails?.address || entry.endLocation);
      });

      const recent = Array.from(recentMap.values()).slice(0, 10).map((item) => ({
        ...item,
        isRecentAddress: true,
        isFrequentAddress: false,
      }));
      const frequent = Array.from(frequency.values())
        .sort((a, b) => b.count - a.count)
        .slice(0, 10)
        .map(({ item }) => ({
          ...item,
          isRecentAddress: false,
          isFrequentAddress: true,
        }));

      setRecentAddresses(recent);
      setFrequentAddresses(frequent);
    } catch (error) {
      console.error('Error loading frequent/recent addresses:', error);
      setRecentAddresses([]);
      setFrequentAddresses([]);
    }
  };

  const performSearch = async (query: string) => {
    try {
      const oxfordResults = await OxfordHouseService.searchOxfordHouses(query, selectedState);
      const savedResults = await SavedAddressService.searchSavedAddresses(query, employeeId);
      const q = query.trim().toLowerCase();
      const filterHistory = (items: SearchResultItem[]) =>
        items.filter((item) =>
          !q ||
          item.name.toLowerCase().includes(q) ||
          (item.sourceAddress || item.address || '').toLowerCase().includes(q)
        );

      const recentResults = filterHistory(recentAddresses);
      const frequentResults = filterHistory(frequentAddresses);
      
      // Combine results with saved, recent/frequent, then Oxford Houses
      const combinedResults: SearchResultItem[] = [...savedResults.map(addr => ({
        id: addr.id,
        name: addr.name,
        address: addr.address,
        city: '',
        state: '',
        zipCode: '',
        phoneNumber: '',
        createdAt: addr.createdAt,
        updatedAt: addr.updatedAt,
        isSavedAddress: true, // Flag to identify saved addresses
        sourceAddress: addr.address,
      } as SearchResultItem)), ...recentResults, ...frequentResults, ...oxfordResults];

      const seen = new Set<string>();
      const deduped = combinedResults.filter((item) => {
        const key = (item.sourceAddress || item.address || '').trim().toLowerCase();
        if (!key) return true;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      setSearchResults(deduped);
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

  const handleSaveAddress = async (item: SearchResultItem) => {
    if (!employeeId) {
      Alert.alert('No Employee', 'Please select an employee first.');
      return;
    }
    const address = (item.sourceAddress || item.address || '').trim();
    if (!address) {
      Alert.alert('Missing Address', 'This location does not have a savable address.');
      return;
    }
    const exists = savedAddresses.some((a) => a.address.trim().toLowerCase() === address.toLowerCase());
    if (exists) {
      Alert.alert('Already Saved', 'This address is already in your Saved addresses.');
      return;
    }
    try {
      await SavedAddressService.createSavedAddress({
        employeeId,
        name: item.name || address.split(',')[0] || 'Saved Address',
        address,
        category: item.isFrequentAddress ? 'Client' : 'Other',
      });
      await loadSavedAddresses(employeeId);
      Alert.alert('Saved', 'Address added to Saved addresses.');
      if (searchQuery.trim()) {
        await performSearch(searchQuery);
      }
    } catch (error) {
      console.error('Error saving address from search results:', error);
      Alert.alert('Save Failed', 'Could not save this address.');
    }
  };

  const renderHouseItem = ({ item }: { item: SearchResultItem }) => (
    <TouchableOpacity
      style={styles.wazeHouseItem}
      onPress={() => handleHouseSelect(item)}
      activeOpacity={0.7}
    >
      <View style={styles.wazeHouseIconContainer}>
        <MaterialIcons 
          name={item.isSavedAddress ? "star" : "home"} 
          size={24} 
          color={item.isSavedAddress ? "#FFD700" : "#2196F3"} 
        />
      </View>
      <View style={styles.wazeHouseInfo}>
        <View style={styles.houseNameRow}>
          <Text style={styles.wazeHouseName} numberOfLines={1}>{item.name}</Text>
          {item.isSavedAddress && (
            <View style={styles.savedBadge}>
              <MaterialIcons name="star" size={14} color="#FFD700" />
              <Text style={styles.savedBadgeText}>Saved</Text>
            </View>
          )}
        </View>
        <View style={styles.addressRow}>
          <MaterialIcons name="location-on" size={14} color="#999" />
          <Text style={styles.wazeHouseAddress} numberOfLines={2}>
            {item.isSavedAddress ? item.address : OxfordHouseService.formatHouseAddress(item)}
          </Text>
        </View>
        {item.phoneNumber && !item.isSavedAddress && (
          <View style={styles.phoneRow}>
            <MaterialIcons name="phone" size={14} color="#999" />
            <Text style={styles.wazeHousePhone}>{item.phoneNumber}</Text>
          </View>
        )}
      </View>
      <View style={styles.itemActions}>
        {!item.isSavedAddress && (
          <TouchableOpacity
            onPress={() => handleSaveAddress(item)}
            style={styles.inlineSaveButton}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <MaterialIcons name="bookmark-add" size={22} color="#2196F3" />
          </TouchableOpacity>
        )}
        <MaterialIcons name="chevron-right" size={24} color="#2196F3" />
      </View>
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
                  <MaterialIcons name="search" size={22} color="#2196F3" style={styles.wazeSearchIcon} />
                  <TextInput
                    style={styles.wazeSearchInput}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    placeholder={isManualEntry ? "Enter location manually..." : "Search by name, city, or state..."}
                    placeholderTextColor="#999"
                    autoFocus
                  />
                  {searchQuery.length > 0 && (
                    <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearButton}>
                      <MaterialIcons name="close" size={22} color="#999" />
                    </TouchableOpacity>
                  )}
                </View>
                
                {/* Search Stats */}
                {!isManualEntry && searchResults.length > 0 && (
                  <View style={styles.searchStats}>
                    <Text style={styles.searchStatsText}>
                      {searchResults.length} {searchResults.length === 1 ? 'house' : 'houses'} found
                      {selectedState && ` in ${selectedState}`}
                    </Text>
                  </View>
                )}
              </View>

              {!isManualEntry && (
                <View style={styles.stateFilterContainer}>
                  <View style={styles.filterHeader}>
                    <MaterialIcons name="filter-list" size={18} color="#666" />
                    <Text style={styles.stateFilterLabel}>Filter by State</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.statePickerButton}
                    onPress={() => setIsStatePickerVisible(true)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.statePickerContent}>
                      <MaterialIcons name="location-on" size={20} color="#2196F3" />
                      <Text style={styles.statePickerText}>
                        {selectedState ? selectedState : 'All States'}
                      </Text>
                    </View>
                    <MaterialIcons name="arrow-drop-down" size={24} color="#2196F3" />
                  </TouchableOpacity>
                  
                  {selectedState && (
                    <TouchableOpacity 
                      style={styles.clearFilterButton}
                      onPress={() => handleStateFilterChange('')}
                    >
                      <MaterialIcons name="close" size={16} color="#666" />
                      <Text style={styles.clearFilterText}>Clear filter</Text>
                    </TouchableOpacity>
                  )}
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
                    <Text style={styles.manualEntryTitle}>Manual Travel Entry</Text>
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
                  <MaterialIcons name="home-work" size={56} color="#2196F3" />
                  <Text style={styles.loadingText}>Loading Oxford Houses...</Text>
                  <Text style={styles.loadingSubtext}>Please wait</Text>
                </View>
              ) : (
                <FlatList
                  data={searchResults}
                  keyExtractor={(item) => item.id}
                  renderItem={renderHouseItem}
                  style={styles.resultsList}
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={searchResults.length === 0 ? styles.emptyListContent : undefined}
                  ItemSeparatorComponent={() => <View style={styles.itemSeparator} />}
                  ListHeaderComponent={
                    searchResults.length > 0 && searchResults.some(r => r.isSavedAddress || r.isRecentAddress || r.isFrequentAddress) ? (
                      <View style={styles.sectionHeader}>
                        <MaterialIcons name="history" size={18} color="#666" />
                        <Text style={styles.sectionHeaderText}>Recent, Frequent & Saved</Text>
                      </View>
                    ) : null
                  }
                  ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                      <View style={styles.emptyIconContainer}>
                        <MaterialIcons name="search-off" size={64} color="#ccc" />
                      </View>
                      <Text style={styles.emptyText}>No Oxford Houses found</Text>
                      <Text style={styles.emptySubtext}>
                        {searchQuery ? 'Try a different search term' : 'Start typing to search'}
                      </Text>
                      {allowManualEntry && (
                        <TouchableOpacity
                          style={styles.emptyActionButton}
                          onPress={handleManualEntry}
                        >
                          <MaterialIcons name="edit" size={20} color="#2196F3" />
                          <Text style={styles.emptyActionText}>Enter location manually</Text>
                        </TouchableOpacity>
                      )}
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
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    minHeight: '65%',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
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
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#f8f9fa',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    gap: 8,
  },
  sectionHeaderText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  itemSeparator: {
    height: 0,
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
    gap: 12,
  },
  loadingText: {
    fontSize: 18,
    color: '#333',
    fontWeight: '600',
    marginTop: 16,
  },
  loadingSubtext: {
    fontSize: 14,
    color: '#999',
  },
  emptyListContent: {
    flexGrow: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    gap: 8,
  },
  emptyIconContainer: {
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 18,
    color: '#333',
    fontWeight: '600',
    marginTop: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    marginBottom: 16,
  },
  emptyActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f8ff',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: '#2196F3',
    gap: 8,
    marginTop: 8,
  },
  emptyActionText: {
    fontSize: 15,
    color: '#2196F3',
    fontWeight: '600',
  },
  manualEntryContainer: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#f8f9fa',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  manualEntryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#2196F3',
    elevation: 1,
    shadowColor: '#2196F3',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    gap: 8,
  },
  manualEntryText: {
    fontSize: 16,
    color: '#2196F3',
    fontWeight: '600',
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
    paddingVertical: 12,
    backgroundColor: '#f8f9fa',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  filterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 6,
  },
  stateFilterLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  clearFilterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    paddingVertical: 6,
    gap: 4,
  },
  clearFilterText: {
    fontSize: 13,
    color: '#666',
    fontWeight: '500',
  },
  statePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#e0e0e0',
    paddingHorizontal: 14,
    paddingVertical: 14,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  statePickerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  statePickerText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
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
    paddingBottom: 18,
    paddingHorizontal: 20,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  backButton: {
    padding: 8,
    marginRight: 10,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  wazeTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
    flex: 1,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  headerSpacer: {
    width: 40, // Same width as back button to center title
  },
  wazeSearchContainer: {
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingTop: 15,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  searchStats: {
    marginTop: 8,
    paddingHorizontal: 5,
  },
  searchStatsText: {
    fontSize: 13,
    color: '#666',
    fontWeight: '500',
  },
  wazeSearchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 28,
    paddingHorizontal: 16,
    paddingVertical: 14,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    borderWidth: 1,
    borderColor: '#e8e8e8',
  },
  wazeSearchIcon: {
    marginRight: 12,
  },
  wazeSearchInput: {
    flex: 1,
    fontSize: 17,
    color: '#333',
    fontWeight: '400',
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
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    backgroundColor: '#fff',
    minHeight: 80,
  },
  wazeHouseIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E3F2FD',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
    elevation: 1,
    shadowColor: '#2196F3',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  wazeHouseInfo: {
    flex: 1,
    gap: 4,
  },
  houseNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  wazeHouseName: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1a1a1a',
    flex: 1,
  },
  savedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF9E6',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    gap: 4,
    marginLeft: 8,
  },
  savedBadgeText: {
    fontSize: 11,
    color: '#FFD700',
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  wazeHouseAddress: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    flex: 1,
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  wazeHousePhone: {
    fontSize: 13,
    color: '#999',
  },
  itemActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  inlineSaveButton: {
    padding: 4,
    borderRadius: 14,
    backgroundColor: '#EAF4FF',
  },
  wazeSavedLabel: {
    fontSize: 12,
    color: '#FFD700',
    fontWeight: '600',
    marginTop: 2,
  },
});
