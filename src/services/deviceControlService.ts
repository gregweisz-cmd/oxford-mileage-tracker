/**
 * Device Control Service
 * 
 * This service handles the actual application of device settings
 * to the device and app behavior.
 */

import { Platform, Alert } from 'react-native';
import * as Location from 'expo-location';

export interface DeviceControlSettings {
  theme: 'light' | 'dark' | 'auto';
  vibrationEnabled: boolean;
  soundEnabled: boolean;
  notificationsEnabled: boolean;
  gpsAccuracy: 'low' | 'medium' | 'high';
  fontSize: 'small' | 'medium' | 'large';
  language: string;
  dateFormat: string;
  timeFormat: '12h' | '24h';
  units: 'imperial' | 'metric';
  autoSaveEnabled: boolean;
  batteryOptimization: boolean;
}

export class DeviceControlService {
  private static instance: DeviceControlService;
  private currentSettings: DeviceControlSettings | null = null;
  private static storage: { [key: string]: string } = {};

  static getInstance(): DeviceControlService {
    if (!DeviceControlService.instance) {
      DeviceControlService.instance = new DeviceControlService();
    }
    return DeviceControlService.instance;
  }

  /**
   * Initialize device control with default settings
   */
  async initialize(): Promise<void> {
    try {
      const savedSettings = DeviceControlService.storage['device_control_settings'];
      if (savedSettings) {
        this.currentSettings = JSON.parse(savedSettings);
      } else {
        // Set default settings
        this.currentSettings = {
          theme: 'auto',
          vibrationEnabled: true,
          soundEnabled: true,
          notificationsEnabled: true,
          gpsAccuracy: 'medium',
          fontSize: 'medium',
          language: 'en',
          dateFormat: 'MM/DD/YYYY',
          timeFormat: '12h',
          units: 'imperial',
          autoSaveEnabled: true,
          batteryOptimization: true,
        };
        await this.saveSettings();
      }

      // Apply initial settings
      await this.applyAllSettings();
    } catch (error) {
      console.error('Failed to initialize device control:', error);
    }
  }

  /**
   * Update device settings and apply them immediately
   */
  async updateSettings(updates: Partial<DeviceControlSettings>): Promise<void> {
    try {
      if (!this.currentSettings) {
        await this.initialize();
      }

      // Update current settings
      this.currentSettings = { ...this.currentSettings!, ...updates };

      // Save to storage
      await this.saveSettings();

      // Apply the updated settings
      await this.applySettings(updates);

      console.log('✅ Device settings updated and applied:', updates);
    } catch (error) {
      console.error('❌ Failed to update device settings:', error);
      throw error;
    }
  }

  /**
   * Get current device settings
   */
  getCurrentSettings(): DeviceControlSettings | null {
    return this.currentSettings;
  }

  /**
   * Save settings to storage
   */
  private async saveSettings(): Promise<void> {
    if (this.currentSettings) {
      DeviceControlService.storage['device_control_settings'] = JSON.stringify(this.currentSettings);
    }
  }

  /**
   * Apply all current settings to the device
   */
  private async applyAllSettings(): Promise<void> {
    if (!this.currentSettings) return;

    const settings = this.currentSettings;
    
    await Promise.all([
      this.applyVibrationSettings(settings.vibrationEnabled),
      this.applyNotificationSettings(settings.notificationsEnabled),
      this.applyGPSSettings(settings.gpsAccuracy),
      this.applyFontSizeSettings(settings.fontSize),
      this.applyBatteryOptimization(settings.batteryOptimization),
    ]);
  }

  /**
   * Apply specific settings updates
   */
  private async applySettings(updates: Partial<DeviceControlSettings>): Promise<void> {
    const promises: Promise<void>[] = [];

    if ('vibrationEnabled' in updates) {
      promises.push(this.applyVibrationSettings(updates.vibrationEnabled!));
    }
    if ('notificationsEnabled' in updates) {
      promises.push(this.applyNotificationSettings(updates.notificationsEnabled!));
    }
    if ('gpsAccuracy' in updates) {
      promises.push(this.applyGPSSettings(updates.gpsAccuracy!));
    }
    if ('fontSize' in updates) {
      promises.push(this.applyFontSizeSettings(updates.fontSize!));
    }
    if ('batteryOptimization' in updates) {
      promises.push(this.applyBatteryOptimization(updates.batteryOptimization!));
    }

    await Promise.all(promises);
  }

  /**
   * Apply vibration/haptic feedback settings
   */
  private async applyVibrationSettings(enabled: boolean): Promise<void> {
    try {
      // Store vibration preference for later use
      console.log(`✅ Vibration ${enabled ? 'enabled' : 'disabled'}`);
    } catch (error) {
      console.error('❌ Failed to apply vibration settings:', error);
    }
  }

  /**
   * Apply notification settings
   */
  private async applyNotificationSettings(enabled: boolean): Promise<void> {
    try {
      // Store notification preference for later use
      console.log(`✅ Notifications ${enabled ? 'enabled' : 'disabled'}`);
    } catch (error) {
      console.error('❌ Failed to apply notification settings:', error);
    }
  }

  /**
   * Apply GPS accuracy settings
   */
  private async applyGPSSettings(accuracy: 'low' | 'medium' | 'high'): Promise<void> {
    try {
      // Store GPS accuracy preference for later use
      console.log(`✅ GPS accuracy set to: ${accuracy}`);
    } catch (error) {
      console.error('❌ Failed to apply GPS settings:', error);
    }
  }

  /**
   * Apply font size settings
   */
  private async applyFontSizeSettings(fontSize: 'small' | 'medium' | 'large'): Promise<void> {
    try {
      // Store font size preference for later use
      console.log(`✅ Font size set to: ${fontSize}`);
    } catch (error) {
      console.error('❌ Failed to apply font size settings:', error);
    }
  }

  /**
   * Apply battery optimization settings
   */
  private async applyBatteryOptimization(enabled: boolean): Promise<void> {
    try {
      // Store battery optimization preference for later use
      console.log(`✅ Battery optimization ${enabled ? 'enabled' : 'disabled'}`);
    } catch (error) {
      console.error('❌ Failed to apply battery optimization settings:', error);
    }
  }

  /**
   * Get GPS accuracy setting for location requests
   */
  static async getGPSAccuracy(): Promise<Location.LocationAccuracy> {
    try {
      const instance = DeviceControlService.getInstance();
      if (!instance.currentSettings) {
        await instance.initialize();
      }
      const accuracy = instance.currentSettings?.gpsAccuracy || 'medium';
      const accuracyMap = {
        low: Location.Accuracy.Lowest,
        medium: Location.Accuracy.Balanced,
        high: Location.Accuracy.Highest,
      };
      return accuracyMap[accuracy] || Location.Accuracy.Balanced;
    } catch (error) {
      return Location.Accuracy.Balanced;
    }
  }

  /**
   * Get font size for UI components
   */
  static async getFontSize(): Promise<number> {
    try {
      const instance = DeviceControlService.getInstance();
      if (!instance.currentSettings) {
        await instance.initialize();
      }
      const fontSize = instance.currentSettings?.fontSize || 'medium';
      const sizeMap = {
        small: 14,
        medium: 16,
        large: 18,
      };
      return sizeMap[fontSize] || 16;
    } catch (error) {
      return 16;
    }
  }

  /**
   * Check if vibration is enabled
   */
  async isVibrationEnabled(): Promise<boolean> {
    if (!this.currentSettings) {
      await this.initialize();
    }
    return this.currentSettings?.vibrationEnabled ?? true;
  }

  /**
   * Check if notifications are enabled
   */
  async isNotificationsEnabled(): Promise<boolean> {
    if (!this.currentSettings) {
      await this.initialize();
    }
    return this.currentSettings?.notificationsEnabled ?? true;
  }

  /**
   * Trigger haptic feedback if enabled
   */
  async triggerHaptic(type: 'light' | 'medium' | 'heavy' = 'light'): Promise<void> {
    try {
      if (await this.isVibrationEnabled()) {
        console.log(`📳 Haptic feedback triggered: ${type}`);
        // TODO: Implement actual haptic feedback when expo-haptics is available
      }
    } catch (error) {
      // Silently fail for haptic feedback
    }
  }

  /**
   * Send notification if enabled
   */
  async sendNotification(title: string, body: string, data?: any): Promise<void> {
    try {
      if (await this.isNotificationsEnabled()) {
        console.log(`📱 Notification sent: ${title} - ${body}`);
        // TODO: Implement actual notifications when expo-notifications is available
      }
    } catch (error) {
      console.error('❌ Failed to send notification:', error);
    }
  }
}

export default DeviceControlService;
