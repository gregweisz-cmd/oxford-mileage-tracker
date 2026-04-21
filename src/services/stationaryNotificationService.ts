import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

export const GPS_STATIONARY_NOTIFICATION_CHANNEL_ID = 'gps-stationary-alerts';
export const GPS_STATIONARY_NOTIFICATION_CATEGORY_ID = 'GPS_STATIONARY_ACTIONS';
export const GPS_STATIONARY_ACTION_END = 'GPS_STATIONARY_END_TRACKING';
export const GPS_STATIONARY_ACTION_KEEP = 'GPS_STATIONARY_KEEP_TRACKING';

let isInitialized = false;

export class StationaryNotificationService {
  static async initialize(): Promise<void> {
    if (isInitialized || Platform.OS === 'web') return;

    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let status = existingStatus;
    if (status !== 'granted') {
      const requested = await Notifications.requestPermissionsAsync();
      status = requested.status;
    }

    if (status !== 'granted') {
      return;
    }

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(GPS_STATIONARY_NOTIFICATION_CHANNEL_ID, {
        name: 'GPS Stationary Alerts',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 350, 150, 350],
        enableVibrate: true,
        sound: 'default',
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      });
    }

    await Notifications.setNotificationCategoryAsync(GPS_STATIONARY_NOTIFICATION_CATEGORY_ID, [
      {
        identifier: GPS_STATIONARY_ACTION_END,
        buttonTitle: 'End Tracking',
        options: {
          opensAppToForeground: true,
        },
      },
      {
        identifier: GPS_STATIONARY_ACTION_KEEP,
        buttonTitle: 'Keep Tracking',
        options: {
          opensAppToForeground: false,
        },
      },
    ]);

    isInitialized = true;
  }

  private static buildStationaryAlertContent(sessionId: string): Notifications.NotificationContentInput {
    return {
      title: 'GPS tracking is still running',
      body: 'We detected you stopped moving at driving speed. End this trip now?',
      sound: 'default',
      priority: Notifications.AndroidNotificationPriority.HIGH,
      channelId: GPS_STATIONARY_NOTIFICATION_CHANNEL_ID,
      categoryIdentifier: GPS_STATIONARY_NOTIFICATION_CATEGORY_ID,
      data: {
        type: 'gps_stationary',
        sessionId,
      },
    };
  }

  static async scheduleStationaryAlert(sessionId: string): Promise<void> {
    if (Platform.OS === 'web') return;

    await Notifications.scheduleNotificationAsync({
      content: this.buildStationaryAlertContent(sessionId),
      trigger: null,
    });
  }

  static async scheduleDelayedStationaryAlert(sessionId: string, delayMs: number): Promise<string | null> {
    if (Platform.OS === 'web') return null;
    const delaySeconds = Math.max(1, Math.ceil(delayMs / 1000));

    return Notifications.scheduleNotificationAsync({
      content: this.buildStationaryAlertContent(sessionId),
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: delaySeconds,
      },
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
