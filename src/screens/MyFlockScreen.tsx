import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
  FlatList,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import UnifiedHeader from '../components/UnifiedHeader';
import { DatabaseService } from '../services/database';
import { Employee, OxfordHouse } from '../types';
import { FlockService, FlockHouseWithDetails, sortFlockHousesAlphabetically } from '../services/flockService';
import { OxfordHouseService } from '../services/oxfordHouseService';
import { ApiSyncService } from '../services/apiSyncService';
import { searchTextInputProps } from '../utils/keyboardDismiss';
import {
  filterOxfordHousesForPicker,
  getAvailableOxfordHouseStates,
  getDefaultOxfordHouseSelection,
} from '../utils/oxfordHousePicker';
import {
  completeAddressPickerReturn,
  setPendingGpsLocationPick,
  setPendingMileageLocationPick,
} from '../utils/pendingLocationSelection';

interface MyFlockScreenProps {
  navigation: any;
  route?: any;
}

export default function MyFlockScreen({ navigation, route }: MyFlockScreenProps) {
  const [flockEntries, setFlockEntries] = useState<FlockHouseWithDetails[]>([]);
  const [currentEmployee, setCurrentEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [addSearchQuery, setAddSearchQuery] = useState('');
  const [addSearchLoading, setAddSearchLoading] = useState(false);
  const [allOxfordHouses, setAllOxfordHouses] = useState<OxfordHouse[]>([]);
  const [addSelectedState, setAddSelectedState] = useState('');
  const [addAvailableStates, setAddAvailableStates] = useState<string[]>([]);
  const [isAddStatePickerVisible, setIsAddStatePickerVisible] = useState(false);

  const fromMileageEntry = route?.params?.fromMileageEntry;
  const locationType = route?.params?.locationType as 'start' | 'end' | undefined;
  const fromGpsTrackingStart = route?.params?.fromGpsTrackingStart === true;
  const fromGpsTrackingEnd = route?.params?.fromGpsTrackingEnd === true;
  const isPickerMode = fromMileageEntry || fromGpsTrackingStart || fromGpsTrackingEnd;

  const loadData = useCallback(async (options?: { pullFromBackend?: boolean }) => {
    try {
      setLoading(true);
      await DatabaseService.initDatabase();

      let employee = await DatabaseService.getCurrentEmployee();
      if (!employee) {
        await new Promise((resolve) => setTimeout(resolve, 300));
        employee = await DatabaseService.getCurrentEmployee();
      }
      if (!employee) {
        Alert.alert('Error', 'No employee logged in');
        navigation.goBack();
        return;
      }

      setCurrentEmployee(employee);

      if (options?.pullFromBackend !== false) {
        try {
          await ApiSyncService.syncFromBackend(employee.id);
        } catch (syncError) {
          console.warn('MyFlockScreen: backend sync failed before loading local list:', syncError);
        }
      }

      const entries = await FlockService.getFlockHousesWithDetails(employee.id);
      setFlockEntries(entries);
    } catch (error) {
      console.error('Error loading My Flock:', error);
      Alert.alert('Error', 'Failed to load My Flock');
    } finally {
      setLoading(false);
    }
  }, [navigation]);

  useEffect(() => {
    void loadData({ pullFromBackend: !isPickerMode });
  }, [loadData, isPickerMode]);

  const loadOxfordHousesForAdd = useCallback(async () => {
    setAddSearchLoading(true);
    try {
      await OxfordHouseService.initializeOxfordHouses();
      const houses = await OxfordHouseService.getAllOxfordHouses();
      setAllOxfordHouses(houses);
      setAddAvailableStates(getAvailableOxfordHouseStates(houses));

      const defaultSelection = getDefaultOxfordHouseSelection(
        houses,
        currentEmployee?.baseAddress
      );
      setAddSelectedState(defaultSelection.selectedState);
    } catch (error) {
      console.error('Error loading Oxford Houses for flock:', error);
      setAllOxfordHouses([]);
    } finally {
      setAddSearchLoading(false);
    }
  }, [currentEmployee?.baseAddress]);

  useEffect(() => {
    if (!showAddModal) return;
    void loadOxfordHousesForAdd();
  }, [showAddModal, loadOxfordHousesForAdd]);

  const flockHouseIds = useMemo(
    () => new Set(flockEntries.map((entry) => entry.oxfordHouseId)),
    [flockEntries]
  );

  const addSearchResults = useMemo(() => {
    if (!showAddModal || allOxfordHouses.length === 0) return [];
    return filterOxfordHousesForPicker(allOxfordHouses, addSelectedState, addSearchQuery)
      .filter((house) => !flockHouseIds.has(house.id))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
  }, [showAddModal, allOxfordHouses, addSelectedState, addSearchQuery, flockHouseIds]);

  const handleAddStateFilterChange = (state: string) => {
    setAddSelectedState(state);
    setIsAddStatePickerVisible(false);
  };

  const openAddModal = () => {
    setAddSearchQuery('');
    setShowAddModal(true);
  };

  const closeAddModal = () => {
    setShowAddModal(false);
    setAddSearchQuery('');
    setIsAddStatePickerVisible(false);
  };

  const refreshLocalFlock = async () => {
    if (!currentEmployee) return;
    const entries = await FlockService.getFlockHousesWithDetails(currentEmployee.id);
    setFlockEntries(entries);
  };

  const defaultFlockState = currentEmployee?.baseAddress
    ? OxfordHouseService.extractStateFromAddress(currentEmployee.baseAddress)
    : '';

  const filteredEntries = useMemo(() => {
    const filtered = flockEntries.filter((entry) => {
      const house = entry.house;
      if (!house) return false;

      if (defaultFlockState && !searchQuery.trim()) {
        const inState =
          OxfordHouseService.normalizeState(house.state) ===
          OxfordHouseService.normalizeState(defaultFlockState);
        if (!inState) return false;
      }

      const q = searchQuery.trim().toLowerCase();
      if (!q) return true;
      const address = OxfordHouseService.formatHouseAddress(house);
      return (
        house.name.toLowerCase().includes(q) ||
        address.toLowerCase().includes(q) ||
        house.city.toLowerCase().includes(q) ||
        house.state.toLowerCase().includes(q)
      );
    });
    return sortFlockHousesAlphabetically(filtered);
  }, [flockEntries, searchQuery, defaultFlockState]);

  const handleSelectHouse = (house: OxfordHouse) => {
    const details = FlockService.oxfordHouseToLocationDetails(house);

    if (fromMileageEntry) {
      setPendingMileageLocationPick({
        locationType: locationType ?? 'start',
        address: details,
      });
      completeAddressPickerReturn(navigation);
      return;
    }

    if (fromGpsTrackingStart) {
      setPendingGpsLocationPick({ kind: 'start', address: details });
      completeAddressPickerReturn(navigation);
      return;
    }

    if (fromGpsTrackingEnd) {
      setPendingGpsLocationPick({ kind: 'end', address: details });
      completeAddressPickerReturn(navigation);
      return;
    }
  };

  const handleAddToFlock = async (house: OxfordHouse) => {
    if (!currentEmployee) return;

    const added = await FlockService.addToFlock(currentEmployee.id, house.id);
    if (!added) {
      Alert.alert('Already in Flock', 'This Oxford House is already in your flock.');
      return;
    }

    await refreshLocalFlock();
    const { SyncIntegrationService } = await import('../services/syncIntegrationService');
    void SyncIntegrationService.processSyncQueue();
  };

  const handleRemoveFromFlock = (entry: FlockHouseWithDetails) => {
    const houseName = entry.house?.name || 'this house';
    Alert.alert('Remove from Flock', `Remove "${houseName}" from My Flock?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await FlockService.removeFromFlock(entry.id);
            await refreshLocalFlock();
            const { SyncIntegrationService } = await import('../services/syncIntegrationService');
            void SyncIntegrationService.processSyncQueue();
          } catch (error) {
            console.error('Error removing from flock:', error);
            Alert.alert('Error', 'Failed to remove house from flock');
          }
        },
      },
    ]);
  };

  const renderFlockItem = ({ item }: { item: FlockHouseWithDetails }) => {
    const house = item.house;
    if (!house) {
      return (
        <View style={styles.addressCard}>
          <Text style={styles.unresolvedText}>Oxford House no longer found ({item.oxfordHouseId})</Text>
          <TouchableOpacity onPress={() => handleRemoveFromFlock(item)}>
            <MaterialIcons name="delete" size={22} color="#f44336" />
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <TouchableOpacity
        style={styles.addressCard}
        onPress={isPickerMode ? () => handleSelectHouse(house) : undefined}
        activeOpacity={isPickerMode ? 0.7 : 1}
        disabled={!isPickerMode}
      >
        <View style={styles.addressInfo}>
          <View style={styles.titleRow}>
            <MaterialCommunityIcons name="sheep" size={22} color="#7CB342" />
            <Text style={styles.addressName}>{house.name}</Text>
          </View>
          <Text style={styles.addressText}>{OxfordHouseService.formatHouseAddress(house)}</Text>
          {house.phoneNumber ? (
            <Text style={styles.phoneText}>{house.phoneNumber}</Text>
          ) : null}
        </View>
        <View style={styles.addressActions}>
          {isPickerMode ? (
            <View style={styles.selectButton}>
              <MaterialIcons name="check-circle" size={20} color="#4CAF50" />
              <Text style={styles.selectButtonText}>
                {fromGpsTrackingEnd ? 'Use as end' : 'Select'}
              </Text>
            </View>
          ) : null}
          {!isPickerMode ? (
            <TouchableOpacity onPress={() => handleRemoveFromFlock(item)}>
              <MaterialIcons name="delete" size={22} color="#f44336" />
            </TouchableOpacity>
          ) : null}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <UnifiedHeader
        title={isPickerMode ? 'My Flock' : 'Manage My Flock'}
        showBackButton
        onBackPress={() => navigation.goBack()}
      />

      <View style={styles.searchContainer}>
        <MaterialIcons name="search" size={20} color="#999" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search your flock..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor="#999"
          {...searchTextInputProps}
        />
      </View>

      {!isPickerMode ? (
        <TouchableOpacity style={styles.addButton} onPress={openAddModal}>
          <MaterialCommunityIcons name="sheep" size={22} color="#fff" />
          <Text style={styles.addButtonText}>Add Oxford House to Flock</Text>
        </TouchableOpacity>
      ) : null}

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2196F3" />
        </View>
      ) : (
        <FlatList
          data={filteredEntries}
          keyExtractor={(item) => item.id}
          renderItem={renderFlockItem}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <MaterialCommunityIcons name="sheep" size={56} color="#ccc" />
              <Text style={styles.emptyTitle}>Your flock is empty</Text>
              <Text style={styles.emptySubtitle}>
                {isPickerMode
                  ? 'Add Oxford Houses in Manage My Flock from the home screen.'
                  : 'Pin Oxford Houses you visit often for one-tap location picking.'}
              </Text>
            </View>
          }
        />
      )}

      <Modal visible={showAddModal} animationType="slide" onRequestClose={closeAddModal}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Add to My Flock</Text>
            <TouchableOpacity onPress={closeAddModal}>
              <MaterialIcons name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>
          <View style={styles.modalSearchContainer}>
            <MaterialIcons name="search" size={20} color="#999" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search Oxford Houses..."
              value={addSearchQuery}
              onChangeText={setAddSearchQuery}
              autoFocus
              placeholderTextColor="#999"
              {...searchTextInputProps}
            />
          </View>

          {addAvailableStates.length > 0 ? (
            <View style={styles.stateFilterContainer}>
              <Text style={styles.stateFilterLabel}>Filter by State:</Text>
              <TouchableOpacity
                style={styles.statePickerButton}
                onPress={() => setIsAddStatePickerVisible(true)}
                activeOpacity={0.7}
              >
                <Text style={styles.statePickerText}>
                  {addSelectedState ? addSelectedState : 'All States'}
                </Text>
                <MaterialIcons name="arrow-drop-down" size={24} color="#666" />
              </TouchableOpacity>
            </View>
          ) : null}

          {addSearchLoading ? (
            <ActivityIndicator style={{ marginTop: 24 }} color="#2196F3" />
          ) : (
            <FlatList
              data={addSearchResults}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <View style={styles.addResultRow}>
                  <MaterialCommunityIcons name="sheep" size={22} color="#7CB342" />
                  <View style={styles.addResultText}>
                    <Text style={styles.addressName}>{item.name}</Text>
                    <Text style={styles.addressText}>
                      {OxfordHouseService.formatHouseAddress(item)}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => void handleAddToFlock(item)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <MaterialIcons name="add-circle" size={24} color="#2196F3" />
                  </TouchableOpacity>
                </View>
              )}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={
                <View style={styles.emptyState}>
                  <Text style={styles.emptySubtitle}>
                    No Oxford Houses match your search
                    {addSelectedState ? ` in ${addSelectedState}` : ''}.
                  </Text>
                </View>
              }
            />
          )}

          {isAddStatePickerVisible ? (
            <View style={styles.statePickerOverlay}>
              <View style={styles.statePickerOverlayContent}>
                <View style={styles.statePickerOverlayHeader}>
                  <Text style={styles.statePickerOverlayTitle}>Select State</Text>
                  <TouchableOpacity onPress={() => setIsAddStatePickerVisible(false)}>
                    <MaterialIcons name="close" size={24} color="#666" />
                  </TouchableOpacity>
                </View>
                <FlatList
                  data={['', ...addAvailableStates]}
                  keyExtractor={(item, index) => `${item || 'all'}-${index}`}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={[
                        styles.statePickerOverlayItem,
                        addSelectedState === item && styles.statePickerOverlayItemSelected,
                      ]}
                      onPress={() => handleAddStateFilterChange(item)}
                    >
                      <Text
                        style={[
                          styles.statePickerOverlayItemText,
                          addSelectedState === item && styles.statePickerOverlayItemTextSelected,
                        ]}
                      >
                        {item || 'All States'}
                      </Text>
                      {addSelectedState === item ? (
                        <MaterialIcons name="check" size={20} color="#2196F3" />
                      ) : null}
                    </TouchableOpacity>
                  )}
                />
              </View>
            </View>
          ) : null}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    margin: 16,
    marginBottom: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  searchInput: { flex: 1, paddingVertical: Platform.OS === 'ios' ? 12 : 10, marginLeft: 8, fontSize: 16, color: '#333' },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#7CB342',
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 14,
    borderRadius: 8,
    gap: 8,
  },
  addButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContent: { paddingHorizontal: 16, paddingBottom: 24 },
  addressCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 14,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e8e8e8',
  },
  addressInfo: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  addressName: { fontSize: 16, fontWeight: '600', color: '#333', flexShrink: 1 },
  addressText: { fontSize: 14, color: '#666' },
  phoneText: { fontSize: 13, color: '#888', marginTop: 2 },
  unresolvedText: { flex: 1, color: '#999', fontStyle: 'italic' },
  addressActions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  selectButton: { flexDirection: 'row', alignItems: 'center', gap: 4, marginRight: 4 },
  selectButtonText: { color: '#4CAF50', fontWeight: '600', fontSize: 13 },
  emptyState: { alignItems: 'center', paddingTop: 48, paddingHorizontal: 24 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: '#666', marginTop: 12 },
  emptySubtitle: { fontSize: 14, color: '#999', textAlign: 'center', marginTop: 8, lineHeight: 20 },
  modalContainer: { flex: 1, backgroundColor: '#fff', paddingTop: Platform.OS === 'ios' ? 56 : 24 },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#333' },
  modalSearchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 16,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  addResultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    gap: 10,
  },
  addResultText: { flex: 1 },
  stateFilterContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  stateFilterLabel: { fontSize: 14, color: '#666', fontWeight: '500' },
  statePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  statePickerText: { fontSize: 14, color: '#333', marginRight: 4 },
  statePickerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  statePickerOverlayContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '60%',
  },
  statePickerOverlayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  statePickerOverlayTitle: { fontSize: 18, fontWeight: '700', color: '#333' },
  statePickerOverlayItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  statePickerOverlayItemSelected: { backgroundColor: '#E3F2FD' },
  statePickerOverlayItemText: { fontSize: 16, color: '#333' },
  statePickerOverlayItemTextSelected: { color: '#2196F3', fontWeight: '600' },
});
