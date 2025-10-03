import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  FlatList,
  TextInput,
  Alert,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { DatabaseService } from '../services/database';
import { SavedAddress, Employee } from '../types';

interface AddressSelectorProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (address: SavedAddress) => void;
  onSaveToFavorites?: (name: string, address: string) => void;
  currentEmployee: Employee | null;
  placeholder?: string;
  showSaveOption?: boolean;
  currentValue?: string;
}

export default function AddressSelector({
  visible,
  onClose,
  onSelect,
  onSaveToFavorites,
  currentEmployee,
  placeholder = 'Select or enter address',
  showSaveOption = true,
  currentValue = '',
}: AddressSelectorProps) {
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
  const [searchText, setSearchText] = useState('');
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveFormData, setSaveFormData] = useState({
    name: '',
    address: '',
    category: 'Other',
  });

  const categories = ['Office', 'Client', 'Home', 'Other'];

  useEffect(() => {
    if (visible && currentEmployee) {
      loadSavedAddresses();
    }
  }, [visible, currentEmployee]);

  const loadSavedAddresses = async () => {
    try {
      if (!currentEmployee) return;
      
      const addresses = await DatabaseService.getSavedAddresses(currentEmployee.id);
      setSavedAddresses(addresses);
    } catch (error) {
      console.error('Error loading saved addresses:', error);
    }
  };

  const filteredAddresses = savedAddresses.filter(address =>
    address.name.toLowerCase().includes(searchText.toLowerCase()) ||
    address.address.toLowerCase().includes(searchText.toLowerCase())
  );

  const handleSelectAddress = (address: SavedAddress) => {
    onSelect(address);
    onClose();
  };

  const handleSaveToFavorites = () => {
    if (!currentValue.trim()) {
      Alert.alert('Error', 'Please enter an address first');
      return;
    }

    setSaveFormData({
      name: '',
      address: currentValue.trim(),
      category: 'Other',
    });
    setShowSaveModal(true);
  };

  const handleSaveAddress = async () => {
    if (!saveFormData.name.trim() || !currentEmployee) {
      Alert.alert('Validation Error', 'Please enter a name for this address');
      return;
    }

    try {
      await DatabaseService.createSavedAddress({
        employeeId: currentEmployee.id,
        name: saveFormData.name.trim(),
        address: saveFormData.address.trim(),
        category: saveFormData.category,
      });

      Alert.alert('Success', 'Address saved to favorites!');
      setShowSaveModal(false);
      setSaveFormData({ name: '', address: '', category: 'Other' });
      await loadSavedAddresses();
      
      if (onSaveToFavorites) {
        onSaveToFavorites(saveFormData.name.trim(), saveFormData.address.trim());
      }
    } catch (error) {
      console.error('Error saving address:', error);
      Alert.alert('Error', 'Failed to save address');
    }
  };

  const renderAddressItem = ({ item }: { item: SavedAddress }) => (
    <TouchableOpacity
      style={styles.addressItem}
      onPress={() => handleSelectAddress(item)}
    >
      <View style={styles.addressInfo}>
        <Text style={styles.addressName}>{item.name}</Text>
        <Text style={styles.addressText}>{item.address}</Text>
        {item.category && (
          <View style={styles.categoryBadge}>
            <Text style={styles.categoryText}>{item.category}</Text>
          </View>
        )}
      </View>
      <MaterialIcons name="chevron-right" size={24} color="#ccc" />
    </TouchableOpacity>
  );

  const renderSaveModal = () => (
    <Modal
      visible={showSaveModal}
      transparent
      animationType="slide"
      onRequestClose={() => setShowSaveModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Save to Favorites</Text>
          
          <TextInput
            style={styles.input}
            placeholder="Address Name (e.g., Main Office)"
            value={saveFormData.name}
            onChangeText={(value) => setSaveFormData(prev => ({ ...prev, name: value }))}
            placeholderTextColor="#999"
          />
          
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Full Address"
            value={saveFormData.address}
            onChangeText={(value) => setSaveFormData(prev => ({ ...prev, address: value }))}
            multiline
            numberOfLines={3}
            placeholderTextColor="#999"
          />
          
          <View style={styles.categoryContainer}>
            <Text style={styles.categoryLabel}>Category:</Text>
            <View style={styles.categoryButtons}>
              {categories.map((category) => (
                <TouchableOpacity
                  key={category}
                  style={[
                    styles.categoryButton,
                    saveFormData.category === category && styles.categoryButtonSelected,
                  ]}
                  onPress={() => setSaveFormData(prev => ({ ...prev, category }))}
                >
                  <Text
                    style={[
                      styles.categoryButtonText,
                      saveFormData.category === category && styles.categoryButtonTextSelected,
                    ]}
                  >
                    {category}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          
          <View style={styles.modalButtons}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => setShowSaveModal(false)}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.saveButton}
              onPress={handleSaveAddress}
            >
              <Text style={styles.saveButtonText}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  return (
    <>
      <Modal
        visible={visible}
        transparent
        animationType="slide"
        onRequestClose={onClose}
      >
        <View style={styles.overlay}>
          <View style={styles.container}>
            <View style={styles.header}>
              <Text style={styles.headerTitle}>{placeholder}</Text>
              <TouchableOpacity onPress={onClose}>
                <MaterialIcons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            <View style={styles.searchContainer}>
              <MaterialIcons name="search" size={20} color="#999" />
              <TextInput
                style={styles.searchInput}
                placeholder="Search addresses..."
                value={searchText}
                onChangeText={setSearchText}
                placeholderTextColor="#999"
              />
            </View>

            {showSaveOption && currentValue.trim() && (
              <TouchableOpacity
                style={styles.saveButton}
                onPress={handleSaveToFavorites}
              >
                <MaterialIcons name="favorite" size={20} color="#fff" />
                <Text style={styles.saveButtonText}>Save "{currentValue}" to Favorites</Text>
              </TouchableOpacity>
            )}

            <FlatList
              data={filteredAddresses}
              renderItem={renderAddressItem}
              keyExtractor={(item) => item.id}
              style={styles.list}
              showsVerticalScrollIndicator={false}
            />

            {filteredAddresses.length === 0 && (
              <View style={styles.emptyState}>
                <MaterialIcons name="location-on" size={48} color="#ccc" />
                <Text style={styles.emptyStateText}>No saved addresses found</Text>
                <Text style={styles.emptyStateSubtext}>
                  {showSaveOption ? 'Enter an address above and save it to favorites' : 'Add addresses in Settings > Saved Addresses'}
                </Text>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {renderSaveModal()}
    </>
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
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 20,
    marginBottom: 16,
    paddingVertical: 12,
    backgroundColor: '#2196F3',
    borderRadius: 8,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  list: {
    flex: 1,
  },
  addressItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  addressInfo: {
    flex: 1,
  },
  addressName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  addressText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  categoryBadge: {
    backgroundColor: '#e3f2fd',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  categoryText: {
    fontSize: 12,
    color: '#2196F3',
    fontWeight: '600',
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
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#333',
    backgroundColor: '#f9f9f9',
    marginBottom: 16,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  categoryContainer: {
    marginBottom: 20,
  },
  categoryLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  categoryButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#f9f9f9',
  },
  categoryButtonSelected: {
    backgroundColor: '#2196F3',
    borderColor: '#2196F3',
  },
  categoryButtonText: {
    fontSize: 14,
    color: '#666',
  },
  categoryButtonTextSelected: {
    color: '#fff',
    fontWeight: '600',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    color: '#666',
  },
});




