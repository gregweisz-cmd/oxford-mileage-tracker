/**
 * User Preferences Service
 * Manages user-configurable app settings and preferences
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

export interface UserPreferences {
  // GPS Tracking Preferences
  showGpsDuration: boolean;
  showGpsSpeed: boolean;
  gpsUpdateInterval: number; // seconds
  
  // Display Preferences
  showRecentEntriesCount: number;
  defaultMapView: 'standard' | 'satellite' | 'hybrid';
  dashboardTileOrder: string[]; // Order of dashboard action tiles
  
  // Notification Preferences
  enableSyncNotifications: boolean;
  enablePerDiemWarnings: boolean;
  
  // Feature Toggles
  enableAutoPerDiem: boolean; // Keep disabled by default
  enableTips: boolean;
  
  // Data Preferences
  autoSyncEnabled: boolean;
  syncInterval: number; // seconds
}

const DEFAULT_PREFERENCES: UserPreferences = {
  // GPS defaults
  showGpsDuration: false, // Hidden by default per user feedback
  showGpsSpeed: false,
  gpsUpdateInterval: 3,
  
  // Display defaults
  showRecentEntriesCount: 5,
  defaultMapView: 'standard',
  dashboardTileOrder: [
    'gps-tracking',
    'add-receipt',
    'manual-entry',
    'view-receipts',
    'hours-worked',
    'daily-description',
    'cost-center-reports',
    'view-reports'
  ],
  
  // Notification defaults
  enableSyncNotifications: true,
  enablePerDiemWarnings: true,
  
  // Feature defaults
  enableAutoPerDiem: false, // KEEP DISABLED
  enableTips: true,
  
  // Data defaults
  autoSyncEnabled: true,
  syncInterval: 5,
};

const STORAGE_KEY = '@oxford_user_preferences';

export class PreferencesService {
  private static cachedPreferences: UserPreferences | null = null;

  /**
   * Get user preferences
   */
  static async getPreferences(): Promise<UserPreferences> {
    try {
      // Return cached if available
      if (this.cachedPreferences) {
        return this.cachedPreferences;
      }

      // Load from storage
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      
      if (stored) {
        const preferences = JSON.parse(stored);
        // Merge with defaults to ensure new preferences exist
        this.cachedPreferences = { ...DEFAULT_PREFERENCES, ...preferences };
        return this.cachedPreferences;
      }

      // No stored preferences, return defaults
      this.cachedPreferences = DEFAULT_PREFERENCES;
      return DEFAULT_PREFERENCES;
    } catch (error) {
      console.error('❌ Preferences: Error loading preferences:', error);
      return DEFAULT_PREFERENCES;
    }
  }

  /**
   * Get a specific preference value
   */
  static async getPreference<K extends keyof UserPreferences>(
    key: K
  ): Promise<UserPreferences[K]> {
    const preferences = await this.getPreferences();
    return preferences[key];
  }

  /**
   * Update preferences
   */
  static async updatePreferences(
    updates: Partial<UserPreferences>
  ): Promise<UserPreferences> {
    try {
      const current = await this.getPreferences();
      const updated = { ...current, ...updates };
      
      // Save to storage
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      
      // Update cache
      this.cachedPreferences = updated;
      
      console.log('✅ Preferences: Updated:', Object.keys(updates));
      return updated;
    } catch (error) {
      console.error('❌ Preferences: Error updating preferences:', error);
      throw error;
    }
  }

  /**
   * Reset preferences to defaults
   */
  static async resetPreferences(): Promise<UserPreferences> {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_PREFERENCES));
      this.cachedPreferences = DEFAULT_PREFERENCES;
      console.log('✅ Preferences: Reset to defaults');
      return DEFAULT_PREFERENCES;
    } catch (error) {
      console.error('❌ Preferences: Error resetting preferences:', error);
      throw error;
    }
  }

  /**
   * Clear cache (force reload from storage)
   */
  static clearCache(): void {
    this.cachedPreferences = null;
  }
}

