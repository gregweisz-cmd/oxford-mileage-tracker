import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

interface UnifiedHeaderProps {
  title: string;
  showBackButton?: boolean;
  onBackPress?: () => void;
  leftButton?: {
    icon: string;
    onPress: () => void;
    color?: string;
  };
  rightButton?: {
    icon: string;
    onPress: () => void;
    color?: string;
  };
  backgroundColor?: string;
}

export default function UnifiedHeader({
  title,
  showBackButton = false,
  onBackPress,
  leftButton,
  rightButton,
  backgroundColor = '#2196F3',
}: UnifiedHeaderProps) {
  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor={backgroundColor} />
      <View style={[styles.header, { backgroundColor }]}>
        <View style={styles.leftSection}>
          {showBackButton ? (
            <TouchableOpacity
              style={styles.backButton}
              onPress={onBackPress}
            >
              <MaterialIcons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
          ) : leftButton ? (
            <TouchableOpacity
              style={styles.leftButton}
              onPress={leftButton.onPress}
            >
              <MaterialIcons 
                name={leftButton.icon as any} 
                size={24} 
                color={leftButton.color || '#fff'} 
              />
            </TouchableOpacity>
          ) : (
            <View style={styles.logoContainer}>
              <MaterialIcons name="directions-car" size={24} color="#fff" />
            </View>
          )}
        </View>

        <View style={styles.centerSection}>
          <Text style={styles.headerTitle}>{title}</Text>
          <Text style={styles.headerSubtitle}>Oxford House Staff Tracker</Text>
        </View>

        <View style={styles.rightSection}>
          {rightButton ? (
            <TouchableOpacity
              style={[
                styles.rightButton,
                rightButton.icon === 'stop' && styles.stopButton
              ]}
              onPress={rightButton.onPress}
            >
              <MaterialIcons 
                name={rightButton.icon as any} 
                size={28} 
                color={rightButton.color || '#fff'} 
              />
            </TouchableOpacity>
          ) : (
            <View style={styles.placeholder} />
          )}
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  leftSection: {
    width: 40,
    alignItems: 'flex-start',
  },
  centerSection: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  rightSection: {
    width: 40,
    alignItems: 'flex-end',
  },
  backButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  leftButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  logoContainer: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
  },
  headerSubtitle: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    marginTop: 2,
  },
  rightButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  stopButton: {
    backgroundColor: '#f44336',
    padding: 10,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  placeholder: {
    width: 40,
  },
});




