import React, { createContext, useContext, useState, useEffect } from 'react';
import { useColorScheme } from 'react-native';
import { DatabaseService } from '../services/database';
import { DeviceIntelligenceService } from '../services/deviceIntelligenceService';

// Simple in-memory storage for theme preferences
const themeStorage: { [key: string]: string } = {};

interface ThemeContextType {
  theme: 'light' | 'dark' | 'auto';
  isDark: boolean;
  colors: {
    background: string;
    surface: string;
    primary: string;
    secondary: string;
    text: string;
    textSecondary: string;
    border: string;
    card: string;
  };
  setTheme: (theme: 'light' | 'dark' | 'auto') => void;
}

const lightColors = {
  background: '#f5f5f5',
  surface: '#ffffff',
  primary: '#2196F3',
  secondary: '#4CAF50',
  text: '#333333',
  textSecondary: '#666666',
  border: '#e0e0e0',
  card: '#ffffff',
};

const darkColors = {
  background: '#0a0a0a',
  surface: '#1a1a1a',
  primary: '#1565C0', // Darker blue
  secondary: '#2E7D32', // Darker green
  text: '#e0e0e0', // Light gray instead of pure white
  textSecondary: '#a0a0a0', // Darker gray
  border: '#2a2a2a', // Darker border
  card: '#2a2a2a', // Lighter gray for tiles - similar to border color
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
  const [currentEmployee, setCurrentEmployee] = useState<any>(null);

  // Load theme from storage and current employee
  useEffect(() => {
    loadTheme();
    loadCurrentEmployee();
  }, []);

  const loadTheme = async () => {
    try {
      const savedTheme = themeStorage['app_theme'];
      if (savedTheme && ['light', 'dark', 'auto'].includes(savedTheme)) {
        setThemeState(savedTheme as 'light' | 'dark' | 'auto');
      }
    } catch (error) {
      console.error('Failed to load theme:', error);
    }
  };

  const loadCurrentEmployee = async () => {
    try {
      const employee = await DatabaseService.getCurrentEmployee();
      setCurrentEmployee(employee);
    } catch (error) {
      console.error('Failed to load current employee:', error);
    }
  };

  const setTheme = async (newTheme: 'light' | 'dark' | 'auto') => {
    try {
      setThemeState(newTheme);
      themeStorage['app_theme'] = newTheme;
      
      // Also save to device intelligence if we have a current employee
      if (currentEmployee?.id) {
        await DeviceIntelligenceService.updateDeviceSettings(currentEmployee.id, { theme: newTheme });
      }
    } catch (error) {
      console.error('Failed to save theme:', error);
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
