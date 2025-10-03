import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  FlatList,
  TextInput,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { COST_CENTERS } from '../constants/costCenters';

interface CostCenterSelectorProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (costCenter: string) => void;
  currentValue?: string;
}

export default function CostCenterSelector({
  visible,
  onClose,
  onSelect,
  currentValue = '',
}: CostCenterSelectorProps) {
  const [searchText, setSearchText] = useState('');

  const filteredCostCenters = COST_CENTERS.filter(center =>
    center.toLowerCase().includes(searchText.toLowerCase())
  );

  // Debug logging
  React.useEffect(() => {
    if (visible) {
      console.log('🔍 CostCenterSelector opened');
      console.log('🔍 Total cost centers:', COST_CENTERS.length);
      console.log('🔍 Filtered cost centers:', filteredCostCenters.length);
      console.log('🔍 Current value:', currentValue);
    }
  }, [visible, filteredCostCenters.length, currentValue]);

  const handleSelect = (costCenter: string) => {
    console.log('🔍 Cost center selected:', costCenter);
    onSelect(costCenter);
    onClose();
  };

  const renderCostCenterItem = ({ item }: { item: string }) => (
    <TouchableOpacity
      style={styles.costCenterItem}
      onPress={() => handleSelect(item)}
    >
      <Text style={styles.costCenterText}>{item}</Text>
      {currentValue === item && (
        <MaterialIcons name="check" size={20} color="#2196F3" />
      )}
    </TouchableOpacity>
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Select Cost Center</Text>
            <TouchableOpacity onPress={onClose}>
              <MaterialIcons name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>

          <View style={styles.searchContainer}>
            <MaterialIcons name="search" size={20} color="#999" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search cost centers..."
              value={searchText}
              onChangeText={setSearchText}
              placeholderTextColor="#999"
            />
          </View>

          <FlatList
            data={filteredCostCenters}
            renderItem={renderCostCenterItem}
            keyExtractor={(item, index) => `${item}-${index}`}
            style={styles.list}
            showsVerticalScrollIndicator={false}
          />

          {filteredCostCenters.length === 0 && (
            <View style={styles.emptyState}>
              <MaterialIcons name="search-off" size={48} color="#ccc" />
              <Text style={styles.emptyStateText}>No cost centers found</Text>
              <Text style={styles.emptyStateSubtext}>
                Try a different search term
              </Text>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    minHeight: '60%',
    paddingBottom: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginVertical: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 16,
    color: '#333',
  },
  list: {
    flex: 1,
    minHeight: 200,
  },
  costCenterItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  costCenterText: {
    fontSize: 16,
    color: '#333',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  emptyStateText: {
    fontSize: 16,
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
});


