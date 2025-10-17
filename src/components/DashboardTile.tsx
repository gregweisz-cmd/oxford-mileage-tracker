import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

export interface TileConfig {
  id: string;
  icon: string;
  label: string;
  color: string;
  onPress: () => void;
  isPrimary?: boolean;
}

interface DashboardTileProps {
  tile: TileConfig;
  isDragging?: boolean;
}

export default function DashboardTile({ tile, isDragging }: DashboardTileProps) {
  return (
    <TouchableOpacity
      style={[
        tile.isPrimary ? styles.primaryTile : styles.secondaryTile,
        isDragging && styles.draggingTile,
      ]}
      onPress={tile.onPress}
      activeOpacity={0.7}
    >
      <MaterialIcons name={tile.icon as any} size={tile.isPrimary ? 28 : 24} color={tile.color} />
      <Text style={tile.isPrimary ? styles.primaryText : styles.secondaryText}>
        {tile.label}
      </Text>
      {isDragging && (
        <View style={styles.dragIndicator}>
          <MaterialIcons name="drag-indicator" size={20} color="#999" />
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  primaryTile: {
    backgroundColor: '#4CAF50',
    padding: 18,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  secondaryTile: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#2196F3',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  draggingTile: {
    opacity: 0.8,
    transform: [{ scale: 1.05 }],
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  primaryText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  secondaryText: {
    color: '#2196F3',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  dragIndicator: {
    position: 'absolute',
    right: 12,
    opacity: 0.5,
  },
});

