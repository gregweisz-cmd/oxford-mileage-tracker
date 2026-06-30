import React, { useState, useEffect, useCallback } from 'react';
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
import { FlockService, FlockHouseWithDetails } from '../services/flockService';
import { OxfordHouseService } from '../services/oxfordHouseService';
import { ApiSyncService } from '../services/apiSyncService';
import { searchTextInputProps } from '../utils/keyboardDismiss';
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
  const [addSearchResults, setAddSearchResults] = useState<OxfordHouse[]>([]);
  const [addSearchLoading, setAddSearchLoading] = useState(false);

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

  useEffect(() => {
    if (!showAddModal) return;

    const runSearch = async () => {
      setAddSearchLoading(true);
      try {
        await OxfordHouseService.initializeOxfordHouses();
        const results = await OxfordHouseService.searchOxfordHouses(addSearchQuery);
        setAddSearchResults(results.slice(0, 40));
      } catch (error) {
        console.error('Error searching Oxford Houses for flock:', error);
        setAddSearchResults([]);
      } finally {
        setAddSearchLoading(false);
      }
    };

    void runSearch();
  }, [addSearchQuery, showAddModal]);

  const refreshLocalFlock = async () => {
    if (!currentEmployee) return;
    const entries = await FlockService.getFlockHousesWithDetails(currentEmployee.id);
    setFlockEntries(entries);
  };

  const filteredEntries = flockEntries.filter((entry) => {
    if (!searchQuery.trim()) return true;
    const house = entry.house;
    if (!house) return false;
    const q = searchQuery.trim().toLowerCase();
    const address = OxfordHouseService.formatHouseAddress(house);
    return (
      house.name.toLowerCase().includes(q) ||
      address.toLowerCase().includes(q) ||
      house.city.toLowerCase().includes(q) ||
      house.state.toLowerCase().includes(q)
    );
  });

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
    Alert.alert('Added to Flock', `${house.name} is now in My Flock.`);
    setShowAddModal(false);
    setAddSearchQuery('');
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

  const handleMove = async (entry: FlockHouseWithDetails, direction: 'up' | 'down') => {
    if (!currentEmployee) return;
    await FlockService.moveFlockHouse(currentEmployee.id, entry.id, direction);
    await refreshLocalFlock();
    const { SyncIntegrationService } = await import('../services/syncIntegrationService');
    void SyncIntegrationService.processSyncQueue();
  };

  const renderFlockItem = ({ item, index }: { item: FlockHouseWithDetails; index: number }) => {
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
      <View style={styles.addressCard}>
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
            <TouchableOpacity
              style={styles.selectButton}
              onPress={() => handleSelectHouse(house)}
            >
              <MaterialIcons name="check-circle" size={20} color="#4CAF50" />
              <Text style={styles.selectButtonText}>
                {fromGpsTrackingEnd ? 'Use as end' : 'Select'}
              </Text>
            </TouchableOpacity>
          ) : null}
          {!isPickerMode ? (
            <>
              <TouchableOpacity
                style={styles.reorderButton}
                onPress={() => void handleMove(item, 'up')}
                disabled={index === 0}
              >
                <MaterialIcons name="arrow-upward" size={18} color={index === 0 ? '#ccc' : '#2196F3'} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.reorderButton}
                onPress={() => void handleMove(item, 'down')}
                disabled={index === filteredEntries.length - 1}
              >
                <MaterialIcons
                  name="arrow-downward"
                  size={18}
                  color={index === filteredEntries.length - 1 ? '#ccc' : '#2196F3'}
                />
              </TouchableOpacity>
            </>
          ) : null}
          <TouchableOpacity onPress={() => handleRemoveFromFlock(item)}>
            <MaterialIcons name="delete" size={22} color="#f44336" />
          </TouchableOpacity>
        </View>
      </View>
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
        <TouchableOpacity style={styles.addButton} onPress={() => setShowAddModal(true)}>
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

      <Modal visible={showAddModal} animationType="slide" onRequestClose={() => setShowAddModal(false)}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Add to My Flock</Text>
            <TouchableOpacity onPress={() => setShowAddModal(false)}>
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
          {addSearchLoading ? (
            <ActivityIndicator style={{ marginTop: 24 }} color="#2196F3" />
          ) : (
            <FlatList
              data={addSearchResults}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.addResultRow} onPress={() => void handleAddToFlock(item)}>
                  <MaterialCommunityIcons name="sheep" size={22} color="#7CB342" />
                  <View style={styles.addResultText}>
                    <Text style={styles.addressName}>{item.name}</Text>
                    <Text style={styles.addressText}>
                      {OxfordHouseService.formatHouseAddress(item)}
                    </Text>
                  </View>
                  <MaterialIcons name="add-circle" size={24} color="#2196F3" />
                </TouchableOpacity>
              )}
              keyboardShouldPersistTaps="handled"
            />
          )}
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
  reorderButton: { padding: 4 },
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
});
