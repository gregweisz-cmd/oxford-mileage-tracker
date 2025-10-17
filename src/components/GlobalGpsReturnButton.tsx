import React from 'react';
import { TouchableOpacity, Text, StyleSheet, Platform, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useGpsTracking } from '../contexts/GpsTrackingContext';
import { useNavigation } from '@react-navigation/native';

interface GlobalGpsReturnButtonProps {
  currentRouteName?: string;
}

export default function GlobalGpsReturnButton({ currentRouteName }: GlobalGpsReturnButtonProps) {
  const { isTracking, currentDistance } = useGpsTracking();
  const navigation = useNavigation<any>();

  // Only show if:
  // 1. GPS is tracking
  // 2. Not already on the GPS tracking screen
  const shouldShow = isTracking && currentRouteName !== 'GpsTracking';

  if (!shouldShow) {
    return null;
  }

  const formatDistance = (miles: number) => {
    if (miles < 0.1) {
      return `${Math.round(miles * 5280)} ft`;
    }
    return `${miles.toFixed(1)} mi`;
  };

  const handlePress = () => {
    navigation.navigate('GpsTracking');
  };

  return (
    <TouchableOpacity
      style={styles.floatingButton}
      onPress={handlePress}
      activeOpacity={0.8}
    >
      <View style={styles.buttonContent}>
        <MaterialIcons name="gps-fixed" size={20} color="#fff" />
        <View style={styles.textContainer}>
          <Text style={styles.buttonTitle}>GPS Tracking</Text>
          <Text style={styles.buttonSubtitle}>{formatDistance(currentDistance)}</Text>
        </View>
        <MaterialIcons name="chevron-right" size={20} color="#fff" />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  floatingButton: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 100 : 80,
    left: 20,
    right: 20,
    backgroundColor: '#4CAF50',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
  },
  textContainer: {
    flex: 1,
    marginLeft: 12,
  },
  buttonTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  buttonSubtitle: {
    color: '#E8F5E9',
    fontSize: 13,
    marginTop: 2,
  },
});

