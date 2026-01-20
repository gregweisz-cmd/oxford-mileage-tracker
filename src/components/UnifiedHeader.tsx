import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Image,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

interface UnifiedHeaderProps {
  title: string;
  subtitle?: string;
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
    text?: string;
  };
  backgroundColor?: string;
}

export default function UnifiedHeader({
  title,
  subtitle = 'Oxford House Staff Tracker',
  showBackButton = false,
  onBackPress,
  leftButton,
  rightButton,
  backgroundColor = '#E6E6E6',
}: UnifiedHeaderProps) {
  return (
    <>
      <StatusBar barStyle="dark-content" backgroundColor={backgroundColor} />
      <View style={[styles.header, { backgroundColor }]}>
        <Image source={require('../../assets/icon.png')} style={styles.logo} resizeMode="contain" />
        <View style={styles.row}>
          <View style={styles.sideSection}>
            {showBackButton ? (
              <TouchableOpacity style={styles.iconButton} onPress={onBackPress}>
                <MaterialIcons name="arrow-back" size={22} color="#1C75BC" />
              </TouchableOpacity>
            ) : leftButton ? (
              <TouchableOpacity style={styles.iconButton} onPress={leftButton.onPress}>
                <MaterialIcons
                  name={leftButton.icon as any}
                  size={22}
                  color={leftButton.color || '#1C75BC'}
                />
              </TouchableOpacity>
            ) : (
              <View style={styles.iconPlaceholder} />
            )}
          </View>

          <View style={styles.centerSection}>
            <Text style={styles.headerTitle}>{title}</Text>
            <Text style={styles.headerSubtitle}>{subtitle}</Text>
          </View>

          <View style={styles.sideSection}>
            {rightButton ? (
              <TouchableOpacity
                style={rightButton.text ? styles.iconButtonWithText : styles.iconButton}
                onPress={rightButton.onPress}
              >
                <MaterialIcons
                  name={rightButton.icon as any}
                  size={22}
                  color={rightButton.color || '#1C75BC'}
                />
                {rightButton.text ? (
                  <Text style={styles.rightButtonText}>{rightButton.text}</Text>
                ) : null}
              </TouchableOpacity>
            ) : (
              <View style={styles.iconPlaceholder} />
            )}
          </View>
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingTop: 12,
    paddingBottom: 10,
    paddingHorizontal: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#D6D6D6',
  },
  logo: {
    height: 46,
    width: 160,
    alignSelf: 'center',
    marginBottom: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sideSection: {
    width: 52,
    alignItems: 'center',
  },
  centerSection: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  iconButton: {
    width: 48,
    height: 48,
    borderRadius: 10,
    backgroundColor: '#DDE3EA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButtonWithText: {
    width: 64,
    height: 56,
    borderRadius: 10,
    backgroundColor: '#DDE3EA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconPlaceholder: {
    width: 48,
    height: 48,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1C75BC',
    textAlign: 'center',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#6CA6D9',
    textAlign: 'center',
    marginTop: 2,
  },
  rightButtonText: {
    color: '#1C75BC',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
});




