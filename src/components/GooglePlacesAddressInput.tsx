import React, { useEffect, useRef, useState } from 'react';
import { Keyboard, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import {
  AddressDetails,
  AddressPrediction,
  GooglePlacesService,
} from '../services/googlePlacesService';
import { ScrollToOnFocusView } from './KeyboardAwareScrollView';
import { toCanonicalAddress } from '../utils/locationSelection';

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
  const inputRef = useRef<TextInput | null>(null);
  const suppressNextLookupRef = useRef(false);
  const [isInputFocused, setIsInputFocused] = useState(false);

  useEffect(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    // When the user taps a suggestion, we set the chosen value into the input.
    // Skip one lookup cycle so the dropdown doesn't immediately reopen.
    if (suppressNextLookupRef.current) {
      suppressNextLookupRef.current = false;
      setPredictions([]);
      setShowPredictions(false);
      return;
    }

    if (!value || value.trim().length < 3) {
      setPredictions([]);
      setShowPredictions(false);
      return;
    }

    timeoutRef.current = setTimeout(async () => {
      try {
        const results = await GooglePlacesService.getAddressPredictions(value);
        setPredictions(results);
        // Never reopen suggestions unless the input is currently focused.
        setShowPredictions(isInputFocused && results.length > 0);
      } catch {
        setPredictions([]);
        setShowPredictions(false);
      }
    }, 250);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [value, isInputFocused]);

  const selectPrediction = async (item: AddressPrediction) => {
    suppressNextLookupRef.current = true;
    onChangeText(toCanonicalAddress(item.description));
    setShowPredictions(false);
    setPredictions([]);
    inputRef.current?.blur();
    Keyboard.dismiss();
    if (!onPlaceSelected) return;
    const details = await GooglePlacesService.getAddressDetails(item.placeId);
    if (details) {
      onPlaceSelected({
        ...details,
        formattedAddress: toCanonicalAddress(details.formattedAddress),
      });
    }
  };

  return (
    <View style={styles.container}>
      <ScrollToOnFocusView>
        <TextInput
          ref={inputRef}
          style={[styles.input, multiline && styles.textArea, style]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={placeholderTextColor}
          multiline={multiline}
          numberOfLines={numberOfLines}
          editable={editable}
          onFocus={() => {
            setIsInputFocused(true);
            setShowPredictions(predictions.length > 0);
          }}
          onBlur={() => {
            setIsInputFocused(false);
            setShowPredictions(false);
          }}
        />
      </ScrollToOnFocusView>
      {showPredictions ? (
        <View style={styles.dropdown}>
          {/*
            Do not use FlatList here: this component often sits inside a parent ScrollView
            (e.g. LocationCaptureModal). Nested VirtualizedList + ScrollView breaks suggestions on iOS.
          */}
          <ScrollView
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled={Platform.OS === 'android'}
            style={styles.dropdownScroll}
          >
            {predictions.map((item) => (
              <TouchableOpacity
                key={item.placeId}
                style={styles.item}
                onPress={() => void selectPrediction(item)}
              >
                <MaterialIcons name="place" size={16} color="#666" />
                <Text style={styles.itemText}>{item.description}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
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
  dropdownScroll: {
    maxHeight: 220,
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
