import React, { useEffect, useRef, useState } from 'react';
import { FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import {
  AddressDetails,
  AddressPrediction,
  GooglePlacesService,
} from '../services/googlePlacesService';

interface GooglePlacesAddressInputProps {
  value: string;
  onChangeText: (value: string) => void;
  onPlaceSelected?: (details: AddressDetails) => void;
  placeholder?: string;
  placeholderTextColor?: string;
  multiline?: boolean;
  numberOfLines?: number;
  editable?: boolean;
  style?: any;
}

export default function GooglePlacesAddressInput({
  value,
  onChangeText,
  onPlaceSelected,
  placeholder,
  placeholderTextColor = '#999',
  multiline = false,
  numberOfLines = 1,
  editable = true,
  style,
}: GooglePlacesAddressInputProps) {
  const [predictions, setPredictions] = useState<AddressPrediction[]>([]);
  const [showPredictions, setShowPredictions] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!GooglePlacesService.isConfigured()) {
      setPredictions([]);
      setShowPredictions(false);
      return;
    }

    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    if (!value || value.trim().length < 3) {
      setPredictions([]);
      setShowPredictions(false);
      return;
    }

    timeoutRef.current = setTimeout(async () => {
      try {
        const results = await GooglePlacesService.getAddressPredictions(value);
        setPredictions(results);
        setShowPredictions(results.length > 0);
      } catch {
        setPredictions([]);
        setShowPredictions(false);
      }
    }, 250);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [value]);

  const selectPrediction = async (item: AddressPrediction) => {
    onChangeText(item.description);
    setShowPredictions(false);
    setPredictions([]);
    if (!onPlaceSelected) return;
    const details = await GooglePlacesService.getAddressDetails(item.placeId);
    if (details) {
      onPlaceSelected(details);
    }
  };

  return (
    <View style={styles.container}>
      <TextInput
        style={[styles.input, multiline && styles.textArea, style]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={placeholderTextColor}
        multiline={multiline}
        numberOfLines={numberOfLines}
        editable={editable}
        onFocus={() => setShowPredictions(predictions.length > 0)}
      />
      {showPredictions ? (
        <View style={styles.dropdown}>
          <FlatList
            data={predictions}
            keyExtractor={(item) => item.placeId}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.item} onPress={() => void selectPrediction(item)}>
                <MaterialIcons name="place" size={16} color="#666" />
                <Text style={styles.itemText}>{item.description}</Text>
              </TouchableOpacity>
            )}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    zIndex: 5,
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
    minHeight: 80,
    textAlignVertical: 'top',
  },
  dropdown: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    marginTop: 4,
    maxHeight: 220,
    zIndex: 10,
    overflow: 'hidden',
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  itemText: {
    color: '#333',
    fontSize: 14,
    flex: 1,
  },
});
