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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { hapticLight } from '../utils/haptics';
import { useTheme } from '../contexts/ThemeContext';

interface UnifiedHeaderProps {
  title: string;
  subtitle?: string;
  showBackButton?: boolean;
  onBackPress?: () => void;
  /** Show home icon; use onHomePress to navigate to Home (e.g. from any screen). */
  showHomeButton?: boolean;
  onHomePress?: () => void;
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
  /** Override theme header background (default: from theme) */
  backgroundColor?: string;
}

export default function UnifiedHeader({
  title,
  subtitle = 'Oxford House Staff Tracker',
  showBackButton = false,
  onBackPress,
  showHomeButton = true,
  onHomePress,
  leftButton,
  rightButton,
  backgroundColor: backgroundColorProp,
}: UnifiedHeaderProps) {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const backgroundColor = backgroundColorProp ?? colors.headerBackground;
  const titleColor = colors.headerTitle;
  const subtitleColor = colors.headerSubtitle;
  const iconColor = colors.headerIcon;
  const iconButtonBg = colors.headerIconButtonBg;

  return (
    <>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={backgroundColor}
      />
      <View
        style={[
          styles.header,
          {
            backgroundColor,
            borderBottomColor: colors.headerBorder,
            paddingTop: Math.max(insets.top, 12),
          },
        ]}
      >
        <Image source={require('../../assets/icon.png')} style={styles.logo} resizeMode="contain" />
        <View style={styles.row}>
          <View style={styles.sideSection}>
            {showBackButton ? (
              <TouchableOpacity
                style={[styles.iconButton, { backgroundColor: iconButtonBg }]}
                onPress={() => {
                  void hapticLight();
                  onBackPress?.();
                }}
              >
                <MaterialIcons name="arrow-back" size={22} color={iconColor} />
              </TouchableOpacity>
            ) : leftButton ? (
              <TouchableOpacity
                style={[styles.iconButton, { backgroundColor: iconButtonBg }]}
                onPress={() => {
                  void hapticLight();
                  leftButton.onPress();
                }}
              >
                <MaterialIcons
                  name={leftButton.icon as any}
                  size={22}
                  color={leftButton.color || iconColor}
                />
              </TouchableOpacity>
            ) : (
              <View style={styles.iconPlaceholder} />
            )}
          </View>

          <View style={styles.centerSection}>
            <Text style={[styles.headerTitle, { color: titleColor }]}>{title}</Text>
            <Text style={[styles.headerSubtitle, { color: subtitleColor }]}>{subtitle}</Text>
          </View>

          <View style={[styles.sideSection, styles.rightRow]}>
            {showHomeButton && onHomePress ? (
              <TouchableOpacity
                style={[styles.iconButton, { backgroundColor: iconButtonBg }]}
                onPress={() => {
                  void hapticLight();
                  onHomePress();
                }}
              >
                <MaterialIcons name="home" size={22} color={iconColor} />
              </TouchableOpacity>
            ) : null}
            {rightButton ? (
              <TouchableOpacity
                style={[
                  rightButton.text ? styles.iconButtonWithText : styles.iconButton,
                  { backgroundColor: iconButtonBg },
                  showHomeButton && onHomePress && styles.rightButtonSpacing,
                ]}
                onPress={() => {
                  void hapticLight();
                  rightButton.onPress();
                }}
              >
                <MaterialIcons
                  name={rightButton.icon as any}
                  size={22}
                  color={rightButton.color || iconColor}
                />
                {rightButton.text ? (
                  <Text style={[styles.rightButtonText, { color: iconColor }]}>{rightButton.text}</Text>
                ) : null}
              </TouchableOpacity>
            ) : null}
            {!showHomeButton && !rightButton ? (
              <View style={styles.iconPlaceholder} />
            ) : null}
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
  rightRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    width: undefined,
    minWidth: 52,
  },
  rightButtonSpacing: {
    marginLeft: 0,
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButtonWithText: {
    width: 64,
    height: 56,
    borderRadius: 10,
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
    textAlign: 'center',
  },
  headerSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 2,
  },
  rightButtonText: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
});




