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

  static async scheduleStationaryAlert(sessionId: string): Promise<void> {
    if (Platform.OS === 'web') return;

    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'GPS tracking is still running',
        body: 'We detected you stopped moving at driving speed. End this trip now?',
        sound: 'default',
        priority: Notifications.AndroidNotificationPriority.HIGH,
        categoryIdentifier: GPS_STATIONARY_NOTIFICATION_CATEGORY_ID,
        data: {
          type: 'gps_stationary',
          sessionId,
        },
      },
      trigger: null,
    });
  }
}
