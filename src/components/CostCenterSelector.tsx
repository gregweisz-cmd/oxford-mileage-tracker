import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  FlatList,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { getCostCenters } from '../constants/costCenters';

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
  const [costCenters, setCostCenters] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filteredCostCenters = costCenters.filter(center =>
    center.toLowerCase().includes(searchText.toLowerCase())
  );

  // Load cost centers when modal opens
  useEffect(() => {
    if (visible) {
      loadCostCenters();
    }
  }, [visible]);

  const loadCostCenters = async () => {
    setLoading(true);
    setError(null);
    try {
      const centers = await getCostCenters();
      setCostCenters(centers);
    } catch (err) {
      setError('Failed to load cost centers');
      console.error('Error loading cost centers:', err);
    } finally {
      setLoading(false);
    }
  };

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

          {loading ? (
            <View style={styles.loadingState}>
              <ActivityIndicator size="large" color="#2196F3" />
              <Text style={styles.loadingText}>Loading cost centers...</Text>
            </View>
          ) : error ? (
            <View style={styles.errorState}>
              <MaterialIcons name="error-outline" size={48} color="#f44336" />
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity style={styles.retryButton} onPress={loadCostCenters}>
                <Text style={styles.retryButtonText}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <FlatList
                data={filteredCostCenters}
                renderItem={renderCostCenterItem}
                keyExtractor={(item, index) => `${item}-${index}`}
                style={styles.list}
                showsVerticalScrollIndicator={false}
              />

              {filteredCostCenters.length === 0 && !loading && (
                <View style={styles.emptyState}>
                  <MaterialIcons name="search-off" size={48} color="#ccc" />
                  <Text style={styles.emptyStateText}>No cost centers found</Text>
                  <Text style={styles.emptyStateSubtext}>
                    Try a different search term
                  </Text>
                </View>
              )}
            </>
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
  loadingState: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
    marginTop: 16,
    textAlign: 'center',
  },
  errorState: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#f44336',
    marginTop: 16,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: '#2196F3',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 16,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});


