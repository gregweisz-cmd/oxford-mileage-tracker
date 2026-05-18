import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import {
  canDeliverGpsNotifications,
  ensureLocalNotificationChannels,
  GPS_STATIONARY_NOTIFICATION_CATEGORY_ID,
  GPS_STATIONARY_NOTIFICATION_CHANNEL_ID,
} from './localNotificationSetup';

export {
  GPS_STATIONARY_NOTIFICATION_CHANNEL_ID,
  GPS_STATIONARY_NOTIFICATION_CATEGORY_ID,
  GPS_STATIONARY_ACTION_END,
  GPS_STATIONARY_ACTION_KEEP,
} from './localNotificationSetup';

/** Matches background-task cooldown so we never stack duplicate pushes. */
const MIN_REPEAT_ALERT_MS = 10 * 60 * 1000;
const STATIONARY_ALERT_SENT_KEY = '@gps_stationary_alert_sent_at';

let isInitialized = false;
let lastImmediateAlertAt = 0;

export class StationaryNotificationService {
  static async initialize(): Promise<void> {
    if (isInitialized || Platform.OS === 'web') return;

    await ensureLocalNotificationChannels();
    isInitialized = true;
  }

  /** Cancel every scheduled stationary alert (best-effort). */
  static async cancelAllStationaryAlerts(): Promise<void> {
    if (Platform.OS === 'web') return;
    try {
      const scheduled = await Notifications.getAllScheduledNotificationsAsync();
      await Promise.all(
        scheduled
          .filter((request) => (request.content.data as { type?: string })?.type === 'gps_stationary')
          .map((request) => Notifications.cancelScheduledNotificationAsync(request.identifier))
      );
    } catch {
      // Ignore cancellation errors for best-effort cleanup.
    }
  }

  static resetAlertThrottle(): void {
    lastImmediateAlertAt = 0;
    void AsyncStorage.removeItem(STATIONARY_ALERT_SENT_KEY).catch(() => {});
  }

  private static buildStationaryAlertContent(sessionId: string): Notifications.NotificationContentInput {
    const content: Notifications.NotificationContentInput = {
      title: 'GPS tracking is still running',
      body: 'We detected you stopped moving at driving speed. End this trip now?',
      sound: 'default',
      priority: Notifications.AndroidNotificationPriority.MAX,
      categoryIdentifier: GPS_STATIONARY_NOTIFICATION_CATEGORY_ID,
      data: {
        type: 'gps_stationary',
        sessionId,
      },
    };

    if (Platform.OS === 'ios') {
      content.interruptionLevel = 'active';
    }

    return content;
  }

  static async scheduleStationaryAlert(sessionId: string): Promise<void> {
    if (Platform.OS === 'web') return;

    if (!(await canDeliverGpsNotifications())) return;

    await this.initialize();

    const now = Date.now();
    if (now - lastImmediateAlertAt < MIN_REPEAT_ALERT_MS) {
      return;
    }

    try {
      const raw = await AsyncStorage.getItem(STATIONARY_ALERT_SENT_KEY);
      const lastSent = raw ? parseInt(raw, 10) : 0;
      if (Number.isFinite(lastSent) && now - lastSent < MIN_REPEAT_ALERT_MS) {
        return;
      }
      await AsyncStorage.setItem(STATIONARY_ALERT_SENT_KEY, String(now));
    } catch {
      // If storage fails, still try in-process throttle only.
    }

    lastImmediateAlertAt = now;

    await this.cancelAllStationaryAlerts();

    await Notifications.scheduleNotificationAsync({
      content: this.buildStationaryAlertContent(sessionId),
      trigger:
        Platform.OS === 'android'
          ? {
              channelId: GPS_STATIONARY_NOTIFICATION_CHANNEL_ID,
            }
          : null,
    });
  }

  static async cancelScheduledAlert(notificationId: string | null | undefined): Promise<void> {
    if (!notificationId || Platform.OS === 'web') return;
    try {
      await Notifications.cancelScheduledNotificationAsync(notificationId);
    } catch {
      // Ignore cancellation errors for best-effort cleanup.
    }
  }
}
