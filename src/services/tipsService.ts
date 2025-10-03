/**
 * Tips Service
 * 
 * Manages contextual tips and help for new users throughout the app.
 * Provides smart tip suggestions based on user behavior and app usage patterns.
 */

import { getDatabaseConnection } from '../utils/databaseConnection';
import * as SQLite from 'expo-sqlite';

export interface AppTip {
  id: string;
  title: string;
  message: string;
  category: 'getting_started' | 'gps_tracking' | 'receipts' | 'mileage' | 'reports' | 'settings' | 'advanced';
  priority: 'low' | 'medium' | 'high';
  screen: string; // Which screen this tip appears on
  trigger: 'on_load' | 'after_action' | 'manual' | 'condition_met';
  condition?: string; // Optional condition for when to show this tip
  icon?: string; // Material icon name
  actionText?: string; // Optional action button text
  dismissible: boolean; // Whether user can dismiss this tip
  createdAt: Date;
}

export interface UserTipProgress {
  userId: string;
  tipId: string;
  hasSeen: boolean;
  hasDismissed: boolean;
  dismissedAt?: Date;
  lastShown?: Date;
  timesShown: number;
}

export class TipsService {
  private static instance: TipsService;
  private db: SQLite.SQLiteDatabase | null = null;

  static getInstance(): TipsService {
    if (!TipsService.instance) {
      TipsService.instance = new TipsService();
    }
    return TipsService.instance;
  }

  private async getDb(): Promise<SQLite.SQLiteDatabase> {
    if (!this.db) {
      this.db = await getDatabaseConnection();
    }
    return this.db;
  }

  /**
   * Initialize tips database tables
   */
  async initializeTables(): Promise<void> {
    try {
      const db = await this.getDb();
      
      // Create tips table
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS tips (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          message TEXT NOT NULL,
          category TEXT NOT NULL,
          priority TEXT NOT NULL,
          screen TEXT NOT NULL,
          trigger TEXT NOT NULL,
          condition TEXT,
          icon TEXT,
          action_text TEXT,
          dismissible INTEGER DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Create user tip progress table
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS user_tip_progress (
          id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4)))),
          user_id TEXT NOT NULL,
          tip_id TEXT NOT NULL,
          has_seen INTEGER DEFAULT 0,
          has_dismissed INTEGER DEFAULT 0,
          dismissed_at DATETIME,
          last_shown DATETIME,
          times_shown INTEGER DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES employees (id),
          UNIQUE(user_id, tip_id)
        )
      `);

      // Insert default tips if they don't exist
      await this.insertDefaultTips();

      console.log('✅ TipsService: Tables initialized successfully');
    } catch (error) {
      console.error('❌ TipsService: Error initializing tables:', error);
      throw error;
    }
  }

  /**
   * Insert default tips for new users
   */
  private async insertDefaultTips(): Promise<void> {
    const db = await this.getDb();
    const defaultTips: Omit<AppTip, 'createdAt'>[] = [
      // Getting Started Tips
      {
        id: 'welcome_tip',
        title: 'Welcome to Oxford House Staff Tracker! 🏠',
        message: 'This app helps you track mileage, receipts, and hours for expense reporting. Start by setting up your profile in Settings.',
        category: 'getting_started',
        priority: 'high',
        screen: 'HomeScreen',
        trigger: 'on_load',
        icon: 'home',
        dismissible: true
      },
      {
        id: 'gps_tracking_basics',
        title: 'GPS Tracking Made Easy 📍',
        message: 'Tap "Start GPS Tracking" to automatically track your trips. The app will record your route, distance, and time automatically.',
        category: 'getting_started',
        priority: 'high',
        screen: 'HomeScreen',
        trigger: 'on_load',
        icon: 'my-location',
        dismissible: true
      },
      {
        id: 'receipt_scanning',
        title: 'Scan Receipts Instantly 📸',
        message: 'Use the camera to scan receipts. The app will extract vendor info, amount, and date automatically. Just add the category!',
        category: 'getting_started',
        priority: 'medium',
        screen: 'HomeScreen',
        trigger: 'on_load',
        icon: 'camera-alt',
        dismissible: true
      },

      // GPS Tracking Tips
      {
        id: 'gps_permissions',
        title: 'GPS Permissions Required 📍',
        message: 'To track your trips accurately, please allow location access. This ensures precise mileage tracking for expense reports.',
        category: 'gps_tracking',
        priority: 'high',
        screen: 'GpsTrackingScreen',
        trigger: 'on_load',
        icon: 'location-on',
        dismissible: true
      },
      {
        id: 'gps_accuracy_tip',
        title: 'GPS Accuracy Matters 🎯',
        message: 'For best results, ensure you have a clear view of the sky when starting GPS tracking. This provides the most accurate distance calculations.',
        category: 'gps_tracking',
        priority: 'medium',
        screen: 'GpsTrackingScreen',
        trigger: 'after_action',
        icon: 'gps-fixed',
        dismissible: true
      },
      {
        id: 'trip_purpose_tip',
        title: 'Add Trip Purpose 📝',
        message: 'When you stop tracking, add a purpose like "Client visit" or "Office supplies". This helps with expense categorization.',
        category: 'gps_tracking',
        priority: 'medium',
        screen: 'GpsTrackingScreen',
        trigger: 'after_action',
        icon: 'edit-note',
        dismissible: true
      },

      // Receipt Tips
      {
        id: 'receipt_categories',
        title: 'Receipt Categories 🏷️',
        message: 'Choose the right category for your receipt: EES, Car Rental, Internet Bill, etc. This ensures proper expense classification.',
        category: 'receipts',
        priority: 'medium',
        screen: 'AddReceiptScreen',
        trigger: 'on_load',
        icon: 'label',
        dismissible: true
      },
      {
        id: 'receipt_cropping',
        title: 'Crop Your Receipts ✂️',
        message: 'After taking a photo, you can crop the receipt to focus on the important details. This improves text recognition accuracy.',
        category: 'receipts',
        priority: 'low',
        screen: 'AddReceiptScreen',
        trigger: 'after_action',
        icon: 'crop',
        dismissible: true
      },
      {
        id: 'vendor_suggestions',
        title: 'Smart Vendor Suggestions 🤖',
        message: 'The app learns your frequent vendors and suggests them automatically. This speeds up receipt entry!',
        category: 'receipts',
        priority: 'low',
        screen: 'AddReceiptScreen',
        trigger: 'on_load',
        icon: 'auto-awesome',
        dismissible: true
      },

      // Mileage Tips
      {
        id: 'manual_mileage',
        title: 'Manual Mileage Entry 📊',
        message: 'You can add mileage entries manually if GPS tracking wasn\'t used. Just enter the addresses and purpose.',
        category: 'mileage',
        priority: 'medium',
        screen: 'MileageEntryScreen',
        trigger: 'on_load',
        icon: 'add-road',
        dismissible: true
      },
      {
        id: 'odometer_readings',
        title: 'Track Odometer Readings 🚗',
        message: 'Record your odometer readings for accurate mileage tracking. Start and end readings help verify GPS data.',
        category: 'mileage',
        priority: 'low',
        screen: 'MileageEntryScreen',
        trigger: 'after_action',
        icon: 'speed',
        dismissible: true
      },

      // Reports Tips
      {
        id: 'monthly_reports',
        title: 'Monthly Expense Reports 📋',
        message: 'Generate monthly expense reports from the web portal. All your tracked data is automatically included.',
        category: 'reports',
        priority: 'medium',
        screen: 'HomeScreen',
        trigger: 'manual',
        icon: 'assessment',
        dismissible: true
      },
      {
        id: 'template_upload',
        title: 'Custom Report Templates 📄',
        message: 'Upload your company\'s expense report template to the web portal. The app will automatically populate it with your data.',
        category: 'reports',
        priority: 'low',
        screen: 'HomeScreen',
        trigger: 'manual',
        icon: 'upload-file',
        dismissible: true
      },

      // Settings Tips
      {
        id: 'profile_setup',
        title: 'Complete Your Profile 👤',
        message: 'Set up your cost centers, base address, and preferences in Settings. This ensures accurate expense allocation.',
        category: 'settings',
        priority: 'high',
        screen: 'SettingsScreen',
        trigger: 'on_load',
        icon: 'person',
        dismissible: true
      },
      {
        id: 'notification_settings',
        title: 'Customize Notifications 🔔',
        message: 'Configure notification preferences to get reminders about expense reports and receipt submissions.',
        category: 'settings',
        priority: 'low',
        screen: 'SettingsScreen',
        trigger: 'on_load',
        icon: 'notifications',
        dismissible: true
      },

      // Advanced Tips
      {
        id: 'location_intelligence',
        title: 'Smart Location Learning 🧠',
        message: 'The app learns your frequent locations and suggests them automatically. This saves time on repetitive entries.',
        category: 'advanced',
        priority: 'low',
        screen: 'MileageEntryScreen',
        trigger: 'after_action',
        icon: 'psychology',
        dismissible: true
      },
      {
        id: 'offline_sync',
        title: 'Offline Capability 📱',
        message: 'The app works offline! Your data syncs automatically when you\'re back online. Never lose your expense data.',
        category: 'advanced',
        priority: 'low',
        screen: 'HomeScreen',
        trigger: 'manual',
        icon: 'cloud-sync',
        dismissible: true
      }
    ];

    for (const tip of defaultTips) {
      try {
        await db.runAsync(`
          INSERT OR IGNORE INTO tips (id, title, message, category, priority, screen, trigger, condition, icon, action_text, dismissible)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          tip.id, tip.title, tip.message, tip.category, tip.priority, 
          tip.screen, tip.trigger, tip.condition || null, tip.icon || null, 
          tip.actionText || null, tip.dismissible ? 1 : 0
        ]);
      } catch (error) {
        console.error(`❌ TipsService: Error inserting tip ${tip.id}:`, error);
      }
    }

    console.log('✅ TipsService: Default tips inserted');
  }

  /**
   * Get tips for a specific screen and user
   */
  async getTipsForScreen(screen: string, userId: string, trigger?: string): Promise<AppTip[]> {
    try {
      const db = await this.getDb();
      
      let query = `
        SELECT t.*, utp.has_seen, utp.has_dismissed, utp.times_shown
        FROM tips t
        LEFT JOIN user_tip_progress utp ON t.id = utp.tip_id AND utp.user_id = ?
        WHERE t.screen = ?
      `;

      const params: any[] = [userId, screen];

      if (trigger) {
        query += ' AND t.trigger = ?';
        params.push(trigger);
      }

      // Only show tips that haven't been dismissed
      query += ' AND (utp.has_dismissed IS NULL OR utp.has_dismissed = 0)';

      // Order by priority (high first) and creation date
      query += ` ORDER BY 
        CASE t.priority 
          WHEN "high" THEN 1 
          WHEN "medium" THEN 2 
          WHEN "low" THEN 3 
        END, t.created_at ASC`;

      const result = await db.getAllAsync(query, params);
      
      return result.map((row: any) => ({
        id: row.id,
        title: row.title,
        message: row.message,
        category: row.category,
        priority: row.priority,
        screen: row.screen,
        trigger: row.trigger,
        condition: row.condition,
        icon: row.icon,
        actionText: row.action_text,
        dismissible: Boolean(row.dismissible),
        createdAt: new Date(row.created_at)
      }));
    } catch (error) {
      console.error('❌ TipsService: Error getting tips for screen:', error);
      return [];
    }
  }

  /**
   * Mark a tip as seen by user
   */
  async markTipAsSeen(userId: string, tipId: string): Promise<void> {
    try {
      const db = await this.getDb();
      await db.runAsync(`
        INSERT OR REPLACE INTO user_tip_progress 
        (user_id, tip_id, has_seen, times_shown, last_shown)
        VALUES (?, ?, 1, COALESCE((SELECT times_shown FROM user_tip_progress WHERE user_id = ? AND tip_id = ?), 0) + 1, CURRENT_TIMESTAMP)
      `, [userId, tipId, userId, tipId]);
    } catch (error) {
      console.error('❌ TipsService: Error marking tip as seen:', error);
    }
  }

  /**
   * Dismiss a tip for user
   */
  async dismissTip(userId: string, tipId: string): Promise<void> {
    try {
      const db = await this.getDb();
      await db.runAsync(`
        INSERT OR REPLACE INTO user_tip_progress 
        (user_id, tip_id, has_dismissed, dismissed_at, times_shown, last_shown)
        VALUES (?, ?, 1, CURRENT_TIMESTAMP, COALESCE((SELECT times_shown FROM user_tip_progress WHERE user_id = ? AND tip_id = ?), 0), CURRENT_TIMESTAMP)
      `, [userId, tipId, userId, tipId]);
    } catch (error) {
      console.error('❌ TipsService: Error dismissing tip:', error);
    }
  }

  /**
   * Get user's tip progress statistics
   */
  async getUserTipStats(userId: string): Promise<{
    totalTips: number;
    tipsSeen: number;
    tipsDismissed: number;
    completionRate: number;
  }> {
    try {
      const db = await this.getDb();
      
      const totalResult = await db.getFirstAsync('SELECT COUNT(*) as count FROM tips');
      const seenResult = await db.getFirstAsync(
        'SELECT COUNT(*) as count FROM user_tip_progress WHERE user_id = ? AND has_seen = 1', 
        [userId]
      );
      const dismissedResult = await db.getFirstAsync(
        'SELECT COUNT(*) as count FROM user_tip_progress WHERE user_id = ? AND has_dismissed = 1', 
        [userId]
      );

      const totalTips = totalResult?.count || 0;
      const tipsSeen = seenResult?.count || 0;
      const tipsDismissed = dismissedResult?.count || 0;
      const completionRate = totalTips > 0 ? (tipsSeen / totalTips) * 100 : 0;

      return {
        totalTips,
        tipsSeen,
        tipsDismissed,
        completionRate
      };
    } catch (error) {
      console.error('❌ TipsService: Error getting tip stats:', error);
      return { totalTips: 0, tipsSeen: 0, tipsDismissed: 0, completionRate: 0 };
    }
  }

  /**
   * Reset all tips for a user (useful for testing or if user wants to see tips again)
   */
  async resetUserTips(userId: string): Promise<void> {
    try {
      const db = await this.getDb();
      await db.runAsync('DELETE FROM user_tip_progress WHERE user_id = ?', [userId]);
      console.log('✅ TipsService: Reset tips for user:', userId);
    } catch (error) {
      console.error('❌ TipsService: Error resetting user tips:', error);
    }
  }
}
