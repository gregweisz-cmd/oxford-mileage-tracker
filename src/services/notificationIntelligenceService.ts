import { getDatabaseConnection } from '../utils/databaseConnection';

/**
 * Notification Intelligence Service
 * 
 * This service manages smart notifications, learns user patterns,
 * and optimizes notification timing based on user behavior and preferences.
 */

export interface NotificationPreferences {
  employeeId: string;
  reportSubmissionReminders: {
    enabled: boolean;
    frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY';
    preferredDays: string[]; // ['MONDAY', 'TUESDAY', etc.]
    preferredTimes: string[]; // ['09:00', '17:00', etc.]
    advanceDays: number; // How many days before deadline to remind
  };
  receiptReminders: {
    enabled: boolean;
    frequency: 'DAILY' | 'WEEKLY';
    preferredDays: string[];
    preferredTimes: string[];
    maxDaysWithoutReceipt: number;
  };
  mileageReminders: {
    enabled: boolean;
    frequency: 'DAILY' | 'WEEKLY';
    preferredDays: string[];
    preferredTimes: string[];
    maxDaysWithoutEntry: number;
  };
  generalNotifications: {
    enabled: boolean;
    categories: string[]; // ['SYSTEM_UPDATES', 'POLICY_CHANGES', 'TRAINING', etc.]
    quietHours: {
      enabled: boolean;
      startTime: string; // '22:00'
      endTime: string; // '08:00'
    };
  };
  channelPreferences: {
    pushNotifications: boolean;
    emailNotifications: boolean;
    smsNotifications: boolean;
  };
}

export interface UserPattern {
  employeeId: string;
  patternType: 'REPORT_SUBMISSION' | 'RECEIPT_ENTRY' | 'MILEAGE_ENTRY' | 'APP_USAGE';
  dayOfWeek: string;
  timeOfDay: string; // Hour in 24h format
  frequency: number; // How often this pattern occurs
  confidence: number; // 0-1, how confident we are in this pattern
  lastObserved: Date;
  createdAt: Date;
}

export interface NotificationSchedule {
  id: string;
  employeeId: string;
  notificationType: 'REPORT_REMINDER' | 'RECEIPT_REMINDER' | 'MILEAGE_REMINDER' | 'GENERAL';
  title: string;
  message: string;
  scheduledFor: Date;
  isRecurring: boolean;
  recurringPattern?: string; // 'DAILY', 'WEEKLY', 'MONTHLY'
  isSent: boolean;
  sentAt?: Date;
  createdAt: Date;
}

export interface OptimalNotificationTime {
  employeeId: string;
  notificationType: string;
  optimalDay: string;
  optimalTime: string;
  confidence: number;
  reason: string;
  lastCalculated: Date;
}

export interface NotificationAnalytics {
  employeeId: string;
  totalNotifications: number;
  openedNotifications: number;
  actionTakenNotifications: number;
  dismissedNotifications: number;
  averageResponseTime: number; // in minutes
  preferredResponseTimes: string[];
  lastCalculated: Date;
}

export class NotificationIntelligenceService {
  private static readonly MIN_PATTERN_FREQUENCY = 3;
  private static readonly PATTERN_CONFIDENCE_THRESHOLD = 0.7;

  /**
   * Get notification preferences for an employee
   */
  static async getNotificationPreferences(employeeId: string): Promise<NotificationPreferences | null> {
    try {
      const db = await getDatabaseConnection();
      const result = await db.getFirstAsync(`
        SELECT * FROM notification_preferences WHERE employeeId = ?
      `, [employeeId]);

      if (!result) return null;

      return {
        employeeId: result.employeeId,
        reportSubmissionReminders: JSON.parse(result.reportSubmissionReminders),
        receiptReminders: JSON.parse(result.receiptReminders),
        mileageReminders: JSON.parse(result.mileageReminders),
        generalNotifications: JSON.parse(result.generalNotifications),
        channelPreferences: JSON.parse(result.channelPreferences)
      };
    } catch (error) {
      console.error('Error getting notification preferences:', error);
      return null;
    }
  }

  /**
   * Update notification preferences for an employee
   */
  static async updateNotificationPreferences(employeeId: string, preferences: NotificationPreferences): Promise<void> {
    try {
      const db = await getDatabaseConnection();
      const now = new Date().toISOString();

      await db.runAsync(`
        INSERT OR REPLACE INTO notification_preferences (
          employeeId, reportSubmissionReminders, receiptReminders, mileageReminders,
          generalNotifications, channelPreferences, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [
        employeeId,
        JSON.stringify(preferences.reportSubmissionReminders),
        JSON.stringify(preferences.receiptReminders),
        JSON.stringify(preferences.mileageReminders),
        JSON.stringify(preferences.generalNotifications),
        JSON.stringify(preferences.channelPreferences),
        now
      ]);
    } catch (error) {
      console.error('Error updating notification preferences:', error);
      throw error;
    }
  }

  /**
   * Analyze user activity and learn patterns
   */
  static async analyzeUserPatterns(employeeId: string): Promise<void> {
    try {
      console.log(`🧠 Analyzing user patterns for employee ${employeeId}`);

      // Analyze report submission patterns
      await this.analyzeReportSubmissionPatterns(employeeId);
      
      // Analyze receipt entry patterns
      await this.analyzeReceiptEntryPatterns(employeeId);
      
      // Analyze mileage entry patterns
      await this.analyzeMileageEntryPatterns(employeeId);
      
      // Analyze app usage patterns
      await this.analyzeAppUsagePatterns(employeeId);

      console.log(`✅ Pattern analysis completed for employee ${employeeId}`);
    } catch (error) {
      console.error('Error analyzing user patterns:', error);
    }
  }

  /**
   * Get optimal notification time for an employee and notification type
   */
  static async getOptimalNotificationTime(
    employeeId: string, 
    notificationType: string
  ): Promise<OptimalNotificationTime | null> {
    try {
      const db = await getDatabaseConnection();
      const result = await db.getFirstAsync(`
        SELECT * FROM optimal_notification_times 
        WHERE employeeId = ? AND notificationType = ?
      `, [employeeId, notificationType]);

      if (!result) return null;

      return {
        employeeId: result.employeeId,
        notificationType: result.notificationType,
        optimalDay: result.optimalDay,
        optimalTime: result.optimalTime,
        confidence: result.confidence,
        reason: result.reason,
        lastCalculated: new Date(result.lastCalculated)
      };
    } catch (error) {
      console.error('Error getting optimal notification time:', error);
      return null;
    }
  }

  /**
   * Calculate and store optimal notification times
   */
  static async calculateOptimalNotificationTimes(employeeId: string): Promise<void> {
    try {
      console.log(`📊 Calculating optimal notification times for employee ${employeeId}`);

      // Get user patterns
      const patterns = await this.getUserPatterns(employeeId);
      
      // Calculate optimal times for different notification types
      const notificationTypes = ['REPORT_REMINDER', 'RECEIPT_REMINDER', 'MILEAGE_REMINDER', 'GENERAL'];
      
      for (const notificationType of notificationTypes) {
        const optimalTime = await this.calculateOptimalTimeForType(employeeId, notificationType, patterns);
        
        if (optimalTime) {
          await this.storeOptimalNotificationTime(optimalTime);
        }
      }

      console.log(`✅ Optimal notification times calculated for employee ${employeeId}`);
    } catch (error) {
      console.error('Error calculating optimal notification times:', error);
    }
  }

  /**
   * Schedule smart notifications based on user patterns
   */
  static async scheduleSmartNotifications(employeeId: string): Promise<void> {
    try {
      console.log(`📅 Scheduling smart notifications for employee ${employeeId}`);

      // Get notification preferences
      const preferences = await this.getNotificationPreferences(employeeId);
      if (!preferences) return;

      // Get optimal notification times
      const optimalTimes = await this.getOptimalNotificationTimes(employeeId);
      
      // Schedule report submission reminders
      if (preferences.reportSubmissionReminders.enabled) {
        await this.scheduleReportSubmissionReminders(employeeId, preferences, optimalTimes);
      }

      // Schedule receipt reminders
      if (preferences.receiptReminders.enabled) {
        await this.scheduleReceiptReminders(employeeId, preferences, optimalTimes);
      }

      // Schedule mileage reminders
      if (preferences.mileageReminders.enabled) {
        await this.scheduleMileageReminders(employeeId, preferences, optimalTimes);
      }

      console.log(`✅ Smart notifications scheduled for employee ${employeeId}`);
    } catch (error) {
      console.error('Error scheduling smart notifications:', error);
    }
  }

  /**
   * Track notification interaction for analytics
   */
  static async trackNotificationInteraction(
    notificationId: string,
    interactionType: 'OPENED' | 'ACTION_TAKEN' | 'DISMISSED',
    responseTime?: number
  ): Promise<void> {
    try {
      const db = await getDatabaseConnection();
      const now = new Date().toISOString();

      await db.runAsync(`
        INSERT INTO notification_interactions (
          id, notificationId, interactionType, responseTime, createdAt
        ) VALUES (?, ?, ?, ?, ?)
      `, [
        `ni_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        notificationId,
        interactionType,
        responseTime || null,
        now
      ]);

      // Update notification analytics
      await this.updateNotificationAnalytics(notificationId, interactionType, responseTime);
    } catch (error) {
      console.error('Error tracking notification interaction:', error);
    }
  }

  /**
   * Get notification analytics for an employee
   */
  static async getNotificationAnalytics(employeeId: string): Promise<NotificationAnalytics | null> {
    try {
      const db = await getDatabaseConnection();
      const result = await db.getFirstAsync(`
        SELECT * FROM notification_analytics WHERE employeeId = ?
      `, [employeeId]);

      if (!result) return null;

      return {
        employeeId: result.employeeId,
        totalNotifications: result.totalNotifications,
        openedNotifications: result.openedNotifications,
        actionTakenNotifications: result.actionTakenNotifications,
        dismissedNotifications: result.dismissedNotifications,
        averageResponseTime: result.averageResponseTime,
        preferredResponseTimes: JSON.parse(result.preferredResponseTimes),
        lastCalculated: new Date(result.lastCalculated)
      };
    } catch (error) {
      console.error('Error getting notification analytics:', error);
      return null;
    }
  }

  /**
   * Initialize database tables for notification intelligence
   */
  static async initializeTables(): Promise<void> {
    try {
      const db = await getDatabaseConnection();
      
      // Create notification_preferences table
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS notification_preferences (
          employeeId TEXT PRIMARY KEY,
          reportSubmissionReminders TEXT NOT NULL,
          receiptReminders TEXT NOT NULL,
          mileageReminders TEXT NOT NULL,
          generalNotifications TEXT NOT NULL,
          channelPreferences TEXT NOT NULL,
          updatedAt TEXT NOT NULL,
          FOREIGN KEY (employeeId) REFERENCES employees (id) ON DELETE CASCADE
        );
      `);

      // Create user_patterns table
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS user_patterns (
          id TEXT PRIMARY KEY,
          employeeId TEXT NOT NULL,
          patternType TEXT NOT NULL,
          dayOfWeek TEXT NOT NULL,
          timeOfDay TEXT NOT NULL,
          frequency INTEGER NOT NULL,
          confidence REAL NOT NULL,
          lastObserved TEXT NOT NULL,
          createdAt TEXT NOT NULL,
          FOREIGN KEY (employeeId) REFERENCES employees (id) ON DELETE CASCADE
        );
      `);

      // Create notification_schedules table
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS notification_schedules (
          id TEXT PRIMARY KEY,
          employeeId TEXT NOT NULL,
          notificationType TEXT NOT NULL,
          title TEXT NOT NULL,
          message TEXT NOT NULL,
          scheduledFor TEXT NOT NULL,
          isRecurring INTEGER NOT NULL DEFAULT 0,
          recurringPattern TEXT,
          isSent INTEGER NOT NULL DEFAULT 0,
          sentAt TEXT,
          createdAt TEXT NOT NULL,
          FOREIGN KEY (employeeId) REFERENCES employees (id) ON DELETE CASCADE
        );
      `);

      // Create optimal_notification_times table
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS optimal_notification_times (
          employeeId TEXT NOT NULL,
          notificationType TEXT NOT NULL,
          optimalDay TEXT NOT NULL,
          optimalTime TEXT NOT NULL,
          confidence REAL NOT NULL,
          reason TEXT NOT NULL,
          lastCalculated TEXT NOT NULL,
          PRIMARY KEY (employeeId, notificationType),
          FOREIGN KEY (employeeId) REFERENCES employees (id) ON DELETE CASCADE
        );
      `);

      // Create notification_interactions table
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS notification_interactions (
          id TEXT PRIMARY KEY,
          notificationId TEXT NOT NULL,
          interactionType TEXT NOT NULL,
          responseTime INTEGER,
          createdAt TEXT NOT NULL,
          FOREIGN KEY (notificationId) REFERENCES notification_schedules (id) ON DELETE CASCADE
        );
      `);

      // Create notification_analytics table
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS notification_analytics (
          employeeId TEXT PRIMARY KEY,
          totalNotifications INTEGER NOT NULL DEFAULT 0,
          openedNotifications INTEGER NOT NULL DEFAULT 0,
          actionTakenNotifications INTEGER NOT NULL DEFAULT 0,
          dismissedNotifications INTEGER NOT NULL DEFAULT 0,
          averageResponseTime REAL NOT NULL DEFAULT 0,
          preferredResponseTimes TEXT NOT NULL DEFAULT '[]',
          lastCalculated TEXT NOT NULL,
          FOREIGN KEY (employeeId) REFERENCES employees (id) ON DELETE CASCADE
        );
      `);

      console.log('🔔 Notification Intelligence tables initialized');
    } catch (error) {
      console.error('Error initializing notification intelligence tables:', error);
    }
  }

  // Private helper methods
  private static async analyzeReportSubmissionPatterns(employeeId: string): Promise<void> {
    // Analyze when users typically submit reports
    console.log(`📊 Analyzing report submission patterns for employee ${employeeId}`);
    // Implementation would analyze actual report submission data
  }

  private static async analyzeReceiptEntryPatterns(employeeId: string): Promise<void> {
    // Analyze when users typically enter receipts
    console.log(`📊 Analyzing receipt entry patterns for employee ${employeeId}`);
    // Implementation would analyze actual receipt entry data
  }

  private static async analyzeMileageEntryPatterns(employeeId: string): Promise<void> {
    // Analyze when users typically enter mileage
    console.log(`📊 Analyzing mileage entry patterns for employee ${employeeId}`);
    // Implementation would analyze actual mileage entry data
  }

  private static async analyzeAppUsagePatterns(employeeId: string): Promise<void> {
    // Analyze when users typically use the app
    console.log(`📊 Analyzing app usage patterns for employee ${employeeId}`);
    // Implementation would analyze actual app usage data
  }

  private static async getUserPatterns(employeeId: string): Promise<UserPattern[]> {
    try {
      const db = await getDatabaseConnection();
      const result = await db.getAllAsync(`
        SELECT * FROM user_patterns 
        WHERE employeeId = ? AND confidence >= ?
        ORDER BY frequency DESC
      `, [employeeId, this.PATTERN_CONFIDENCE_THRESHOLD]);

      return result.map(row => ({
        ...row,
        lastObserved: new Date(row.lastObserved),
        createdAt: new Date(row.createdAt)
      }));
    } catch (error) {
      console.error('Error getting user patterns:', error);
      return [];
    }
  }

  private static async getOptimalNotificationTimes(employeeId: string): Promise<OptimalNotificationTime[]> {
    try {
      const db = await getDatabaseConnection();
      const result = await db.getAllAsync(`
        SELECT * FROM optimal_notification_times WHERE employeeId = ?
      `, [employeeId]);

      return result.map(row => ({
        ...row,
        lastCalculated: new Date(row.lastCalculated)
      }));
    } catch (error) {
      console.error('Error getting optimal notification times:', error);
      return [];
    }
  }

  private static async calculateOptimalTimeForType(
    employeeId: string, 
    notificationType: string, 
    patterns: UserPattern[]
  ): Promise<OptimalNotificationTime | null> {
    // Calculate optimal time based on patterns
    // This is a simplified implementation
    const relevantPatterns = patterns.filter(p => 
      (notificationType === 'REPORT_REMINDER' && p.patternType === 'REPORT_SUBMISSION') ||
      (notificationType === 'RECEIPT_REMINDER' && p.patternType === 'RECEIPT_ENTRY') ||
      (notificationType === 'MILEAGE_REMINDER' && p.patternType === 'MILEAGE_ENTRY') ||
      (notificationType === 'GENERAL' && p.patternType === 'APP_USAGE')
    );

    if (relevantPatterns.length === 0) {
      return null; // No patterns found
    }

    // Find most frequent pattern
    const mostFrequent = relevantPatterns.reduce((prev, current) => 
      prev.frequency > current.frequency ? prev : current
    );

    return {
      employeeId,
      notificationType,
      optimalDay: mostFrequent.dayOfWeek,
      optimalTime: mostFrequent.timeOfDay,
      confidence: mostFrequent.confidence,
      reason: `Based on ${mostFrequent.frequency} observed instances`,
      lastCalculated: new Date()
    };
  }

  private static async storeOptimalNotificationTime(optimalTime: OptimalNotificationTime): Promise<void> {
    try {
      const db = await getDatabaseConnection();
      const now = new Date().toISOString();

      await db.runAsync(`
        INSERT OR REPLACE INTO optimal_notification_times (
          employeeId, notificationType, optimalDay, optimalTime, 
          confidence, reason, lastCalculated
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [
        optimalTime.employeeId,
        optimalTime.notificationType,
        optimalTime.optimalDay,
        optimalTime.optimalTime,
        optimalTime.confidence,
        optimalTime.reason,
        now
      ]);
    } catch (error) {
      console.error('Error storing optimal notification time:', error);
    }
  }

  private static async scheduleReportSubmissionReminders(
    employeeId: string, 
    preferences: NotificationPreferences,
    optimalTimes: OptimalNotificationTime[]
  ): Promise<void> {
    // Schedule report submission reminders based on preferences and optimal times
    console.log(`📅 Scheduling report submission reminders for employee ${employeeId}`);
  }

  private static async scheduleReceiptReminders(
    employeeId: string, 
    preferences: NotificationPreferences,
    optimalTimes: OptimalNotificationTime[]
  ): Promise<void> {
    // Schedule receipt reminders based on preferences and optimal times
    console.log(`📅 Scheduling receipt reminders for employee ${employeeId}`);
  }

  private static async scheduleMileageReminders(
    employeeId: string, 
    preferences: NotificationPreferences,
    optimalTimes: OptimalNotificationTime[]
  ): Promise<void> {
    // Schedule mileage reminders based on preferences and optimal times
    console.log(`📅 Scheduling mileage reminders for employee ${employeeId}`);
  }

  private static async updateNotificationAnalytics(
    notificationId: string,
    interactionType: string,
    responseTime?: number
  ): Promise<void> {
    // Update notification analytics based on interaction
    console.log(`📊 Updating notification analytics for ${notificationId}: ${interactionType}`);
  }
}
