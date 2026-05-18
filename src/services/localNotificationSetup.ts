import { Alert, Linking, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import DeviceControlService from './deviceControlService';

export const GPS_STATIONARY_NOTIFICATION_CHANNEL_ID = 'gps-stationary-alerts';
export const GPS_STATIONARY_NOTIFICATION_CATEGORY_ID = 'GPS_STATIONARY_ACTIONS';
export const GPS_STATIONARY_ACTION_END = 'GPS_STATIONARY_END_TRACKING';
export const GPS_STATIONARY_ACTION_KEEP = 'GPS_STATIONARY_KEEP_TRACKING';

let channelsReady = false;

/**
 * Must run before React mounts so foreground notifications show banner + list.
 * @see https://docs.expo.dev/push-notifications/receiving-notifications/
 */
export function configureNotificationPresentation(): void {
  if (Platform.OS === 'web') return;

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

export async function hasOsNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'web') return false;

  const existing = await Notifications.getPermissionsAsync();
  return existing.granted || existing.ios?.allowsAlert === true;
}

/** App Settings toggle + OS permission both required for GPS trip alerts. */
export async function canDeliverGpsNotifications(): Promise<boolean> {
  if (Platform.OS === 'web') return false;

  const appEnabled = await DeviceControlService.getInstance().isNotificationsEnabled();
  if (!appEnabled) return false;

  return hasOsNotificationPermission();
}

export async function requestLocalNotificationPermissions(): Promise<boolean> {
  if (Platform.OS === 'web') return false;

  if (await hasOsNotificationPermission()) return true;

  const requested = await Notifications.requestPermissionsAsync({
    ios: {
      allowAlert: true,
      allowBadge: false,
      allowSound: true,
      allowProvisional: false,
    },
  });

  return requested.granted || requested.ios?.allowsAlert === true;
}

/** Prompt when GPS starts but trip alerts cannot be delivered. */
export async function promptForNotificationAccessIfNeeded(): Promise<void> {
  if (Platform.OS === 'web') return;

  const appEnabled = await DeviceControlService.getInstance().isNotificationsEnabled();
  const osEnabled = await hasOsNotificationPermission();

  if (appEnabled && osEnabled) return;

  let message: string;
  if (!appEnabled && !osEnabled) {
    message =
      'GPS trip reminders are turned off in this app and on your phone. Turn on Notifications in App Settings, then allow alerts in your phone Settings so reminders appear on your lock screen and as banners.';
  } else if (!appEnabled) {
    message =
      'GPS trip reminders are turned off in App Settings. Turn on the Notifications switch in Settings so you can receive lock-screen and banner alerts while tracking.';
  } else {
    message =
      'GPS trip reminders need notification permission on your phone. Allow notifications in Settings so alerts appear on your lock screen, as banners, and in Notification Center.';
  }

  const buttons: Array<{ text: string; style?: 'cancel' | 'default'; onPress?: () => void }> = [];

  if (!appEnabled) {
    buttons.push({
      text: 'Enable in app',
      onPress: () => {
        void (async () => {
          await DeviceControlService.getInstance().updateSettings({ notificationsEnabled: true });
          await requestLocalNotificationPermissions();
        })();
      },
    });
  }

  if (!osEnabled) {
    buttons.push({
      text: 'Phone settings',
      onPress: () => {
        void Linking.openSettings();
      },
    });
  }

  buttons.push({ text: 'Not now', style: 'cancel' });

  Alert.alert('Turn on notifications', message, buttons);
}

export async function ensureLocalNotificationChannels(): Promise<void> {
  if (Platform.OS === 'web' || channelsReady) return;

  if (!(await canDeliverGpsNotifications())) {
    return;
  }

  const granted = await requestLocalNotificationPermissions();
  if (!granted) return;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(GPS_STATIONARY_NOTIFICATION_CHANNEL_ID, {
      name: 'GPS trip alerts',
      description: 'Alerts when mileage tracking may still be running in the background',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 350, 150, 350],
      enableVibrate: true,
      sound: 'default',
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      showBadge: true,
    });
  }

  await Notifications.setNotificationCategoryAsync(GPS_STATIONARY_NOTIFICATION_CATEGORY_ID, [
    {
      identifier: GPS_STATIONARY_ACTION_END,
      buttonTitle: 'End Tracking',
      options: { opensAppToForeground: true },
    },
    {
      identifier: GPS_STATIONARY_ACTION_KEEP,
      buttonTitle: 'Keep Tracking',
      options: { opensAppToForeground: false },
    },
  ]);

  channelsReady = true;
}
