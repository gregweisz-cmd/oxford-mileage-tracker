/**
 * User Preferences Service
 * Manages user-configurable app settings and preferences
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEFAULT_SYNC_INTERVAL, SyncInterval } from '../utils/syncIntervalConfig';

export interface UserPreferences {
  // GPS Tracking Preferences
  showGpsDuration: boolean;
  gpsUpdateInterval: number; // seconds
  
  // Display Preferences
  showRecentEntriesCount: number;
  defaultMapView: 'standard' | 'satellite' | 'hybrid';
  dashboardTileOrder: string[]; // Order of dashboard action tiles
  gpsStartLocationOptionOrder: string[]; // Order of start tracking location options
  gpsEndLocationOptionOrder: string[]; // Order of stop tracking location options
  
  // Notification Preferences
  enableSyncNotifications: boolean;
  enablePerDiemWarnings: boolean;
  
  // Feature Toggles
  enableAutoPerDiem: boolean; // Keep disabled by default
  enableTips: boolean;
  
  // Data Preferences
  autoSyncEnabled: boolean;
  syncInterval: SyncInterval;
}

const DEFAULT_PREFERENCES: UserPreferences = {
  // GPS defaults
  showGpsDuration: false, // Hidden by default per user feedback
  gpsUpdateInterval: 3,
  
  // Display defaults
  showRecentEntriesCount: 5,
  defaultMapView: 'standard',
  dashboardTileOrder: [
    'gps-tracking',
    'add-receipt',
    'manual-entry',
    'view-receipts',
    'hours-description',
    'per-diem',
    'saved-addresses',
    'my-flock',
  ],
  gpsStartLocationOptionOrder: [
    'lastDestination',
    'baseAddress',
    'favoriteAddresses',
    'myFlock',
    'oxfordHouse',
    'newLocation',
  ],
  gpsEndLocationOptionOrder: [
    'baseAddress',
    'tripStart',
    'favoriteAddresses',
    'myFlock',
    'oxfordHouse',
    'newLocation',
  ],
  
  // Notification defaults
  enableSyncNotifications: true,
  enablePerDiemWarnings: true,
  
  // Feature defaults
  enableAutoPerDiem: false, // KEEP DISABLED
  enableTips: true,
  
  // Data defaults
  autoSyncEnabled: true,
  syncInterval: DEFAULT_SYNC_INTERVAL,
};

const STORAGE_KEY = '@oxford_user_preferences';

/** Keep saved order but insert any new options at their default positions. */
export function mergeLocationOptionOrder<T extends string>(
  saved: string[] | undefined,
  defaults: readonly T[]
): T[] {
  const valid = new Set<string>(defaults);
  const order = (saved || []).filter((option): option is T => valid.has(option));
  if (order.length === 0) return [...defaults];

  for (const option of defaults) {
    if (order.includes(option)) continue;
    const defaultIdx = defaults.indexOf(option);
    const insertBefore = order.find((existing) => defaults.indexOf(existing) > defaultIdx);
    if (insertBefore !== undefined) {
      order.splice(order.indexOf(insertBefore), 0, option);
    } else {
      order.push(option);
    }
  }
  return order;
}

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
        const merged = { ...DEFAULT_PREFERENCES, ...preferences };
        merged.gpsStartLocationOptionOrder = mergeLocationOptionOrder(
          merged.gpsStartLocationOptionOrder,
          DEFAULT_PREFERENCES.gpsStartLocationOptionOrder
        );
        merged.gpsEndLocationOptionOrder = mergeLocationOptionOrder(
          merged.gpsEndLocationOptionOrder,
          DEFAULT_PREFERENCES.gpsEndLocationOptionOrder
        );
        this.cachedPreferences = merged;
        return this.cachedPreferences as UserPreferences;
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

