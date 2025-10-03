/**
 * Device Intelligence Service
 * 
 * This service stores device-specific settings, user preferences, and
 * learns from user behavior to provide personalized experiences.
 */

import { getDatabaseConnection } from '../utils/databaseConnection';
// Note: expo-haptics and expo-notifications removed to avoid dependency issues
// import { Haptics } from 'expo-haptics';
// import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

export interface DeviceSettings {
  id: string;
  deviceId: string;
  userId: string;
  theme: 'light' | 'dark' | 'auto';
  fontSize: 'small' | 'medium' | 'large';
  language: string;
  timezone: string;
  dateFormat: 'MM/DD/YYYY' | 'DD/MM/YYYY' | 'YYYY-MM-DD';
  timeFormat: '12h' | '24h';
  units: 'imperial' | 'metric';
  vibrationEnabled: boolean;
  soundEnabled: boolean;
  notificationsEnabled: boolean;
  autoSaveEnabled: boolean;
  showTips: boolean;
  gpsAccuracy: 'low' | 'medium' | 'high';
  batteryOptimization: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserInterfacePreferences {
  id: string;
  userId: string;
  preferredScreen: 'home' | 'tracking' | 'reports' | 'settings';
  dashboardLayout: 'compact' | 'detailed' | 'minimal';
  quickActions: string[]; // Array of preferred quick action IDs
  favoriteLocations: string[]; // Array of location IDs
  defaultMileagePurpose: string;
  defaultReceiptCategory: string;
  showTutorials: boolean;
  showTips: boolean;
  compactMode: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface OfflineSyncPattern {
  id: string;
  userId: string;
  syncFrequency: 'immediate' | 'every_5min' | 'every_15min' | 'hourly' | 'daily';
  syncOnWifi: boolean;
  syncOnCellular: boolean;
  maxOfflineDays: number;
  autoRetryFailed: boolean;
  retryAttempts: number;
  lastSyncTime: Date;
  syncHistory: {
    timestamp: Date;
    success: boolean;
    recordsCount: number;
    duration: number;
  }[];
  createdAt: Date;
  updatedAt: Date;
}

export interface InputMethodPreference {
  id: string;
  userId: string;
  preferredInputMethod: 'keyboard' | 'voice' | 'camera' | 'gps';
  voiceLanguage: string;
  voiceSpeed: 'slow' | 'normal' | 'fast';
  keyboardLayout: 'qwerty' | 'azerty' | 'qwertz';
  autoCompleteEnabled: boolean;
  swipeGesturesEnabled: boolean;
  hapticFeedbackEnabled: boolean;
  gestureSensitivity: 'low' | 'medium' | 'high';
  createdAt: Date;
  updatedAt: Date;
}

export class DeviceIntelligenceService {
  private static isInitialized = false;

  /**
   * Initialize the device intelligence tables
   */
  static async initializeTables(): Promise<void> {
    if (this.isInitialized) return;

    const db = await getDatabaseConnection();

    // Create device_settings table
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS device_settings (
        id TEXT PRIMARY KEY,
        device_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        theme TEXT DEFAULT 'auto',
        font_size TEXT DEFAULT 'medium',
        language TEXT DEFAULT 'en',
        timezone TEXT DEFAULT 'UTC',
        date_format TEXT DEFAULT 'MM/DD/YYYY',
        time_format TEXT DEFAULT '12h',
        units TEXT DEFAULT 'imperial',
        vibration_enabled INTEGER DEFAULT 1,
        sound_enabled INTEGER DEFAULT 1,
        notifications_enabled INTEGER DEFAULT 1,
        auto_save_enabled INTEGER DEFAULT 1,
        gps_accuracy TEXT DEFAULT 'medium',
        battery_optimization INTEGER DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(device_id, user_id)
      );
    `);

    // Create ui_preferences table
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS ui_preferences (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        preferred_screen TEXT DEFAULT 'home',
        dashboard_layout TEXT DEFAULT 'detailed',
        quick_actions TEXT DEFAULT '[]',
        favorite_locations TEXT DEFAULT '[]',
        default_mileage_purpose TEXT DEFAULT '',
        default_receipt_category TEXT DEFAULT '',
        show_tutorials INTEGER DEFAULT 1,
        show_tips INTEGER DEFAULT 1,
        compact_mode INTEGER DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(user_id)
      );
    `);

    // Create offline_sync_patterns table
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS offline_sync_patterns (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        sync_frequency TEXT DEFAULT 'hourly',
        sync_on_wifi INTEGER DEFAULT 1,
        sync_on_cellular INTEGER DEFAULT 0,
        max_offline_days INTEGER DEFAULT 7,
        auto_retry_failed INTEGER DEFAULT 1,
        retry_attempts INTEGER DEFAULT 3,
        last_sync_time TEXT,
        sync_history TEXT DEFAULT '[]',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(user_id)
      );
    `);

    // Create input_method_preferences table
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS input_method_preferences (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        preferred_input_method TEXT DEFAULT 'keyboard',
        voice_language TEXT DEFAULT 'en-US',
        voice_speed TEXT DEFAULT 'normal',
        keyboard_layout TEXT DEFAULT 'qwerty',
        auto_complete_enabled INTEGER DEFAULT 1,
        swipe_gestures_enabled INTEGER DEFAULT 1,
        haptic_feedback_enabled INTEGER DEFAULT 1,
        gesture_sensitivity TEXT DEFAULT 'medium',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(user_id)
      );
    `);

    this.isInitialized = true;
    console.log('✅ Device Intelligence tables initialized');
  }

  // Device Settings Methods
  static async getDeviceSettings(userId: string): Promise<DeviceSettings | null> {
    const db = await getDatabaseConnection();
    const result = await db.getFirstAsync(
      'SELECT * FROM device_settings WHERE user_id = ?',
      [userId]
    );

    if (!result) return null;

    return {
      id: result.id,
      deviceId: result.device_id,
      userId: result.user_id,
      theme: result.theme,
      fontSize: result.font_size,
      language: result.language,
      timezone: result.timezone,
      dateFormat: result.date_format,
      timeFormat: result.time_format,
      units: result.units,
      vibrationEnabled: Boolean(result.vibration_enabled),
      soundEnabled: Boolean(result.sound_enabled),
      notificationsEnabled: Boolean(result.notifications_enabled),
      autoSaveEnabled: Boolean(result.auto_save_enabled),
      showTips: Boolean(result.show_tips ?? true),
      gpsAccuracy: result.gps_accuracy,
      batteryOptimization: Boolean(result.battery_optimization),
      createdAt: new Date(result.created_at),
      updatedAt: new Date(result.updated_at)
    };
  }

  static async updateDeviceSettings(userId: string, settings: Partial<DeviceSettings>): Promise<DeviceSettings> {
    const db = await getDatabaseConnection();
    const now = new Date().toISOString();

    // Check if settings exist
    const existing = await this.getDeviceSettings(userId);
    
    if (existing) {
      // Update existing settings
      await db.runAsync(`
        UPDATE device_settings SET
          theme = COALESCE(?, theme),
          font_size = COALESCE(?, font_size),
          language = COALESCE(?, language),
          timezone = COALESCE(?, timezone),
          date_format = COALESCE(?, date_format),
          time_format = COALESCE(?, time_format),
          units = COALESCE(?, units),
          vibration_enabled = COALESCE(?, vibration_enabled),
          sound_enabled = COALESCE(?, sound_enabled),
          notifications_enabled = COALESCE(?, notifications_enabled),
          auto_save_enabled = COALESCE(?, auto_save_enabled),
          gps_accuracy = COALESCE(?, gps_accuracy),
          battery_optimization = COALESCE(?, battery_optimization),
          updated_at = ?
        WHERE user_id = ?
      `, [
        settings.theme || null,
        settings.fontSize || null,
        settings.language || null,
        settings.timezone || null,
        settings.dateFormat || null,
        settings.timeFormat || null,
        settings.units || null,
        settings.vibrationEnabled !== undefined ? (settings.vibrationEnabled ? 1 : 0) : null,
        settings.soundEnabled !== undefined ? (settings.soundEnabled ? 1 : 0) : null,
        settings.notificationsEnabled !== undefined ? (settings.notificationsEnabled ? 1 : 0) : null,
        settings.autoSaveEnabled !== undefined ? (settings.autoSaveEnabled ? 1 : 0) : null,
        settings.gpsAccuracy || null,
        settings.batteryOptimization !== undefined ? (settings.batteryOptimization ? 1 : 0) : null,
        now,
        userId
      ]);
    } else {
      // Create new settings
      const id = `dev_settings_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      await db.runAsync(`
        INSERT INTO device_settings (
          id, device_id, user_id, theme, font_size, language, timezone,
          date_format, time_format, units, vibration_enabled, sound_enabled,
          notifications_enabled, auto_save_enabled, gps_accuracy, battery_optimization,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        id,
        'default_device', // This could be enhanced to detect actual device ID
        userId,
        settings.theme || 'auto',
        settings.fontSize || 'medium',
        settings.language || 'en',
        settings.timezone || 'UTC',
        settings.dateFormat || 'MM/DD/YYYY',
        settings.timeFormat || '12h',
        settings.units || 'imperial',
        settings.vibrationEnabled !== undefined ? (settings.vibrationEnabled ? 1 : 0) : 1,
        settings.soundEnabled !== undefined ? (settings.soundEnabled ? 1 : 0) : 1,
        settings.notificationsEnabled !== undefined ? (settings.notificationsEnabled ? 1 : 0) : 1,
        settings.autoSaveEnabled !== undefined ? (settings.autoSaveEnabled ? 1 : 0) : 1,
        settings.gpsAccuracy || 'medium',
        settings.batteryOptimization !== undefined ? (settings.batteryOptimization ? 1 : 0) : 1,
        now,
        now
      ]);
    }

    return await this.getDeviceSettings(userId) as DeviceSettings;
  }

  // UI Preferences Methods
  static async getUIPreferences(userId: string): Promise<UserInterfacePreferences | null> {
    const db = await getDatabaseConnection();
    const result = await db.getFirstAsync(
      'SELECT * FROM ui_preferences WHERE user_id = ?',
      [userId]
    );

    if (!result) return null;

    return {
      id: result.id,
      userId: result.user_id,
      preferredScreen: result.preferred_screen,
      dashboardLayout: result.dashboard_layout,
      quickActions: JSON.parse(result.quick_actions || '[]'),
      favoriteLocations: JSON.parse(result.favorite_locations || '[]'),
      defaultMileagePurpose: result.default_mileage_purpose,
      defaultReceiptCategory: result.default_receipt_category,
      showTutorials: Boolean(result.show_tutorials),
      showTips: Boolean(result.show_tips),
      compactMode: Boolean(result.compact_mode),
      createdAt: new Date(result.created_at),
      updatedAt: new Date(result.updated_at)
    };
  }

  static async updateUIPreferences(userId: string, preferences: Partial<UserInterfacePreferences>): Promise<UserInterfacePreferences> {
    const db = await getDatabaseConnection();
    const now = new Date().toISOString();

    const existing = await this.getUIPreferences(userId);
    
    if (existing) {
      await db.runAsync(`
        UPDATE ui_preferences SET
          preferred_screen = COALESCE(?, preferred_screen),
          dashboard_layout = COALESCE(?, dashboard_layout),
          quick_actions = COALESCE(?, quick_actions),
          favorite_locations = COALESCE(?, favorite_locations),
          default_mileage_purpose = COALESCE(?, default_mileage_purpose),
          default_receipt_category = COALESCE(?, default_receipt_category),
          show_tutorials = COALESCE(?, show_tutorials),
          show_tips = COALESCE(?, show_tips),
          compact_mode = COALESCE(?, compact_mode),
          updated_at = ?
        WHERE user_id = ?
      `, [
        preferences.preferredScreen || null,
        preferences.dashboardLayout || null,
        preferences.quickActions ? JSON.stringify(preferences.quickActions) : null,
        preferences.favoriteLocations ? JSON.stringify(preferences.favoriteLocations) : null,
        preferences.defaultMileagePurpose || null,
        preferences.defaultReceiptCategory || null,
        preferences.showTutorials !== undefined ? (preferences.showTutorials ? 1 : 0) : null,
        preferences.showTips !== undefined ? (preferences.showTips ? 1 : 0) : null,
        preferences.compactMode !== undefined ? (preferences.compactMode ? 1 : 0) : null,
        now,
        userId
      ]);
    } else {
      const id = `ui_prefs_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      await db.runAsync(`
        INSERT INTO ui_preferences (
          id, user_id, preferred_screen, dashboard_layout, quick_actions,
          favorite_locations, default_mileage_purpose, default_receipt_category,
          show_tutorials, show_tips, compact_mode, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        id,
        userId,
        preferences.preferredScreen || 'home',
        preferences.dashboardLayout || 'detailed',
        JSON.stringify(preferences.quickActions || []),
        JSON.stringify(preferences.favoriteLocations || []),
        preferences.defaultMileagePurpose || '',
        preferences.defaultReceiptCategory || '',
        preferences.showTutorials !== undefined ? (preferences.showTutorials ? 1 : 0) : 1,
        preferences.showTips !== undefined ? (preferences.showTips ? 1 : 0) : 1,
        preferences.compactMode !== undefined ? (preferences.compactMode ? 1 : 0) : 0,
        now,
        now
      ]);
    }

    return await this.getUIPreferences(userId) as UserInterfacePreferences;
  }

  // Offline Sync Pattern Methods
  static async getOfflineSyncPattern(userId: string): Promise<OfflineSyncPattern | null> {
    const db = await getDatabaseConnection();
    const result = await db.getFirstAsync(
      'SELECT * FROM offline_sync_patterns WHERE user_id = ?',
      [userId]
    );

    if (!result) return null;

    return {
      id: result.id,
      userId: result.user_id,
      syncFrequency: result.sync_frequency,
      syncOnWifi: Boolean(result.sync_on_wifi),
      syncOnCellular: Boolean(result.sync_on_cellular),
      maxOfflineDays: result.max_offline_days,
      autoRetryFailed: Boolean(result.auto_retry_failed),
      retryAttempts: result.retry_attempts,
      lastSyncTime: result.last_sync_time ? new Date(result.last_sync_time) : new Date(),
      syncHistory: JSON.parse(result.sync_history || '[]'),
      createdAt: new Date(result.created_at),
      updatedAt: new Date(result.updated_at)
    };
  }

  static async updateOfflineSyncPattern(userId: string, pattern: Partial<OfflineSyncPattern>): Promise<OfflineSyncPattern> {
    const db = await getDatabaseConnection();
    const now = new Date().toISOString();

    const existing = await this.getOfflineSyncPattern(userId);
    
    if (existing) {
      await db.runAsync(`
        UPDATE offline_sync_patterns SET
          sync_frequency = COALESCE(?, sync_frequency),
          sync_on_wifi = COALESCE(?, sync_on_wifi),
          sync_on_cellular = COALESCE(?, sync_on_cellular),
          max_offline_days = COALESCE(?, max_offline_days),
          auto_retry_failed = COALESCE(?, auto_retry_failed),
          retry_attempts = COALESCE(?, retry_attempts),
          last_sync_time = COALESCE(?, last_sync_time),
          sync_history = COALESCE(?, sync_history),
          updated_at = ?
        WHERE user_id = ?
      `, [
        pattern.syncFrequency || null,
        pattern.syncOnWifi !== undefined ? (pattern.syncOnWifi ? 1 : 0) : null,
        pattern.syncOnCellular !== undefined ? (pattern.syncOnCellular ? 1 : 0) : null,
        pattern.maxOfflineDays || null,
        pattern.autoRetryFailed !== undefined ? (pattern.autoRetryFailed ? 1 : 0) : null,
        pattern.retryAttempts || null,
        pattern.lastSyncTime ? pattern.lastSyncTime.toISOString() : null,
        pattern.syncHistory ? JSON.stringify(pattern.syncHistory) : null,
        now,
        userId
      ]);
    } else {
      const id = `sync_pattern_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      await db.runAsync(`
        INSERT INTO offline_sync_patterns (
          id, user_id, sync_frequency, sync_on_wifi, sync_on_cellular,
          max_offline_days, auto_retry_failed, retry_attempts, last_sync_time,
          sync_history, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        id,
        userId,
        pattern.syncFrequency || 'hourly',
        pattern.syncOnWifi !== undefined ? (pattern.syncOnWifi ? 1 : 0) : 1,
        pattern.syncOnCellular !== undefined ? (pattern.syncOnCellular ? 1 : 0) : 0,
        pattern.maxOfflineDays || 7,
        pattern.autoRetryFailed !== undefined ? (pattern.autoRetryFailed ? 1 : 0) : 1,
        pattern.retryAttempts || 3,
        pattern.lastSyncTime ? pattern.lastSyncTime.toISOString() : null,
        JSON.stringify(pattern.syncHistory || []),
        now,
        now
      ]);
    }

    return await this.getOfflineSyncPattern(userId) as OfflineSyncPattern;
  }

  // Input Method Preference Methods
  static async getInputMethodPreferences(userId: string): Promise<InputMethodPreference | null> {
    const db = await getDatabaseConnection();
    const result = await db.getFirstAsync(
      'SELECT * FROM input_method_preferences WHERE user_id = ?',
      [userId]
    );

    if (!result) return null;

    return {
      id: result.id,
      userId: result.user_id,
      preferredInputMethod: result.preferred_input_method,
      voiceLanguage: result.voice_language,
      voiceSpeed: result.voice_speed,
      keyboardLayout: result.keyboard_layout,
      autoCompleteEnabled: Boolean(result.auto_complete_enabled),
      swipeGesturesEnabled: Boolean(result.swipe_gestures_enabled),
      hapticFeedbackEnabled: Boolean(result.haptic_feedback_enabled),
      gestureSensitivity: result.gesture_sensitivity,
      createdAt: new Date(result.created_at),
      updatedAt: new Date(result.updated_at)
    };
  }

  static async updateInputMethodPreferences(userId: string, preferences: Partial<InputMethodPreference>): Promise<InputMethodPreference> {
    const db = await getDatabaseConnection();
    const now = new Date().toISOString();

    const existing = await this.getInputMethodPreferences(userId);
    
    if (existing) {
      await db.runAsync(`
        UPDATE input_method_preferences SET
          preferred_input_method = COALESCE(?, preferred_input_method),
          voice_language = COALESCE(?, voice_language),
          voice_speed = COALESCE(?, voice_speed),
          keyboard_layout = COALESCE(?, keyboard_layout),
          auto_complete_enabled = COALESCE(?, auto_complete_enabled),
          swipe_gestures_enabled = COALESCE(?, swipe_gestures_enabled),
          haptic_feedback_enabled = COALESCE(?, haptic_feedback_enabled),
          gesture_sensitivity = COALESCE(?, gesture_sensitivity),
          updated_at = ?
        WHERE user_id = ?
      `, [
        preferences.preferredInputMethod || null,
        preferences.voiceLanguage || null,
        preferences.voiceSpeed || null,
        preferences.keyboardLayout || null,
        preferences.autoCompleteEnabled !== undefined ? (preferences.autoCompleteEnabled ? 1 : 0) : null,
        preferences.swipeGesturesEnabled !== undefined ? (preferences.swipeGesturesEnabled ? 1 : 0) : null,
        preferences.hapticFeedbackEnabled !== undefined ? (preferences.hapticFeedbackEnabled ? 1 : 0) : null,
        preferences.gestureSensitivity || null,
        now,
        userId
      ]);
    } else {
      const id = `input_prefs_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      await db.runAsync(`
        INSERT INTO input_method_preferences (
          id, user_id, preferred_input_method, voice_language, voice_speed,
          keyboard_layout, auto_complete_enabled, swipe_gestures_enabled,
          haptic_feedback_enabled, gesture_sensitivity, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        id,
        userId,
        preferences.preferredInputMethod || 'keyboard',
        preferences.voiceLanguage || 'en-US',
        preferences.voiceSpeed || 'normal',
        preferences.keyboardLayout || 'qwerty',
        preferences.autoCompleteEnabled !== undefined ? (preferences.autoCompleteEnabled ? 1 : 0) : 1,
        preferences.swipeGesturesEnabled !== undefined ? (preferences.swipeGesturesEnabled ? 1 : 0) : 1,
        preferences.hapticFeedbackEnabled !== undefined ? (preferences.hapticFeedbackEnabled ? 1 : 0) : 1,
        preferences.gestureSensitivity || 'medium',
        now,
        now
      ]);
    }

    return await this.getInputMethodPreferences(userId) as InputMethodPreference;
  }

  /**
   * Learn from user behavior to suggest optimal settings
   */
  static async learnFromUserBehavior(userId: string, behaviorData: {
    screenUsage: Record<string, number>; // Screen name -> time spent
    inputMethods: Record<string, number>; // Input method -> usage count
    syncPatterns: {
      wifiSyncs: number;
      cellularSyncs: number;
      failedSyncs: number;
    };
    performanceMetrics: {
      averageLoadTime: number;
      cacheHitRate: number;
      batteryUsage: number;
    };
  }): Promise<void> {
    try {
      // Analyze screen usage to suggest preferred screen
      const mostUsedScreen = Object.entries(behaviorData.screenUsage)
        .sort(([,a], [,b]) => b - a)[0]?.[0];
      
      if (mostUsedScreen) {
        await this.updateUIPreferences(userId, { preferredScreen: mostUsedScreen as any });
      }

      // Analyze input methods to suggest preferred method
      const mostUsedInputMethod = Object.entries(behaviorData.inputMethods)
        .sort(([,a], [,b]) => b - a)[0]?.[0];
      
      if (mostUsedInputMethod) {
        await this.updateInputMethodPreferences(userId, { 
          preferredInputMethod: mostUsedInputMethod as any 
        });
      }

      // Analyze sync patterns to optimize sync frequency
      const { wifiSyncs, cellularSyncs, failedSyncs } = behaviorData.syncPatterns;
      let suggestedFrequency: 'immediate' | 'every_5min' | 'every_15min' | 'hourly' | 'daily';
      
      if (failedSyncs > wifiSyncs + cellularSyncs * 0.5) {
        suggestedFrequency = 'daily'; // Reduce sync frequency if many failures
      } else if (cellularSyncs > wifiSyncs) {
        suggestedFrequency = 'hourly'; // Less frequent on cellular
      } else {
        suggestedFrequency = 'every_15min'; // More frequent on wifi
      }

      await this.updateOfflineSyncPattern(userId, { syncFrequency: suggestedFrequency });

      console.log('✅ Device Intelligence: Learned from user behavior and updated preferences');
    } catch (error) {
      console.error('❌ Device Intelligence: Error learning from user behavior:', error);
    }
  }

  /**
   * Get personalized recommendations based on user's device and usage patterns
   */
  static async getPersonalizedRecommendations(userId: string): Promise<{
    deviceOptimizations: string[];
    uiImprovements: string[];
    performanceTips: string[];
    batteryOptimizations: string[];
  }> {
    const deviceSettings = await this.getDeviceSettings(userId);
    const uiPreferences = await this.getUIPreferences(userId);
    const syncPattern = await this.getOfflineSyncPattern(userId);

    const recommendations = {
      deviceOptimizations: [] as string[],
      uiImprovements: [] as string[],
      performanceTips: [] as string[],
      batteryOptimizations: [] as string[]
    };

    // Device optimization recommendations
    if (deviceSettings?.batteryOptimization === false) {
      recommendations.deviceOptimizations.push('Enable battery optimization for better performance');
    }
    
    if (deviceSettings?.gpsAccuracy === 'high') {
      recommendations.deviceOptimizations.push('Consider reducing GPS accuracy to save battery');
    }

    // UI improvement recommendations
    if (uiPreferences?.showTutorials === false) {
      recommendations.uiImprovements.push('Re-enable tutorials to discover new features');
    }
    
    if (uiPreferences?.compactMode === false && uiPreferences?.dashboardLayout === 'detailed') {
      recommendations.uiImprovements.push('Try compact mode for a cleaner interface');
    }

    // Performance recommendations
    if (syncPattern?.syncFrequency === 'immediate') {
      recommendations.performanceTips.push('Consider reducing sync frequency to improve performance');
    }

    // Battery optimization recommendations
    if (deviceSettings?.vibrationEnabled === true && deviceSettings?.soundEnabled === true) {
      recommendations.batteryOptimizations.push('Consider disabling vibration or sound to save battery');
    }

    return recommendations;
  }
}
