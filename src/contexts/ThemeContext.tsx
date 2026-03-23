import React, { createContext, useContext, useState, useEffect } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DatabaseService } from '../services/database';
import { DeviceIntelligenceService } from '../services/deviceIntelligenceService';
import { DeviceControlService } from '../services/deviceControlService';

const THEME_STORAGE_KEY = 'app_theme_preference';

export type ThemeColors = {
  background: string;
  surface: string;
  primary: string;
  secondary: string;
  text: string;
  textSecondary: string;
  border: string;
  card: string;
  /** Unified header strip (below status bar) */
  headerBackground: string;
  headerBorder: string;
  headerTitle: string;
  headerSubtitle: string;
  headerIcon: string;
  headerIconButtonBg: string;
  /** Start GPS Tracking — darker green on dark theme */
  gpsButton: string;
  /** Manual Travel, Receipts, etc. — medium gray on dark theme */
  dashboardSecondaryButton: string;
  dashboardSecondaryButtonBorder: string;
};

interface ThemeContextType {
  theme: 'light' | 'dark' | 'auto';
  isDark: boolean;
  colors: ThemeColors;
  /** Persists theme to storage, SQLite, and device control (single write path — avoids iOS SQLite races). */
  setTheme: (theme: 'light' | 'dark' | 'auto') => Promise<void>;
}

const lightColors: ThemeColors = {
  background: '#f5f5f5',
  surface: '#ffffff',
  primary: '#1C75BC',
  secondary: '#2BB673',
  text: '#333333',
  textSecondary: '#666666',
  border: '#e0e0e0',
  card: '#ffffff',
  headerBackground: '#D8D8D8',
  headerBorder: '#C8C8C8',
  headerTitle: '#1C75BC',
  headerSubtitle: '#6CA6D9',
  headerIcon: '#1C75BC',
  headerIconButtonBg: '#DDE3EA',
  gpsButton: '#2E7D32',
  dashboardSecondaryButton: '#ffffff',
  dashboardSecondaryButtonBorder: '#2196F3',
};

const darkColors: ThemeColors = {
  background: '#0a0a0a',
  surface: '#1a1a1a',
  primary: '#155A99',
  secondary: '#1F8F5A',
  text: '#e0e0e0',
  textSecondary: '#a0a0a0',
  border: '#2a2a2a',
  card: '#2a2a2a',
  headerBackground: '#121214',
  headerBorder: '#0a0a0c',
  headerTitle: '#7EC8F5',
  headerSubtitle: '#9aa0a8',
  headerIcon: '#7EC8F5',
  headerIconButtonBg: '#2c2c30',
  gpsButton: '#14532d',
  dashboardSecondaryButton: '#3d3d45',
  dashboardSecondaryButtonBorder: '#5a5a65',
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

interface ThemeProviderProps {
  children: React.ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const systemColorScheme = useColorScheme();
  const [theme, setThemeState] = useState<'light' | 'dark' | 'auto'>('auto');

  // Load theme from storage
  useEffect(() => {
    loadTheme();
  }, []);

  const loadTheme = async () => {
    try {
      // Primary source: persisted local storage (survives app restarts)
      const savedTheme = await AsyncStorage.getItem(THEME_STORAGE_KEY);
      if (savedTheme && ['light', 'dark', 'auto'].includes(savedTheme)) {
        setThemeState(savedTheme as 'light' | 'dark' | 'auto');
        return;
      }

      // Fallback source: employee device settings in SQLite
      const employee = await DatabaseService.getCurrentEmployee();
      if (employee?.id) {
        const settings = await DeviceIntelligenceService.getDeviceSettings(employee.id);
        if (settings?.theme && ['light', 'dark', 'auto'].includes(settings.theme)) {
          setThemeState(settings.theme);
        }
      }
    } catch (error) {
      console.error('Failed to load theme:', error);
    }
  };

  const setTheme = async (newTheme: 'light' | 'dark' | 'auto') => {
    try {
      setThemeState(newTheme);
      await AsyncStorage.setItem(THEME_STORAGE_KEY, newTheme);

      // Resolve employee at save time (avoids stale ThemeProvider state vs Settings screen)
      const employee = await DatabaseService.getCurrentEmployee();
      if (employee?.id) {
        await DeviceIntelligenceService.updateDeviceSettings(employee.id, { theme: newTheme });
      }

      // Keep DeviceControlService in sync (same path as Settings — no second concurrent SQLite write for theme)
      await DeviceControlService.getInstance().updateSettings({ theme: newTheme });
    } catch (error) {
      console.error('Failed to save theme:', error);
      throw error;
    }
  };

  // Determine if dark mode should be active
  const isDark = theme === 'dark' || (theme === 'auto' && systemColorScheme === 'dark');
  const colors = isDark ? darkColors : lightColors;

  const value: ThemeContextType = {
    theme,
    isDark,
    colors,
    setTheme,
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};
