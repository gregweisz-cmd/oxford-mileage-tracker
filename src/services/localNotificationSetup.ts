import { Alert, Linking, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';

const NOTIFICATION_SETTINGS_PROMPT_KEY = '@gps_notification_settings_prompt_shown';

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

export async function hasLocalNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'web') return false;

  const existing = await Notifications.getPermissionsAsync();
  return existing.granted || existing.ios?.allowsAlert === true;
}

export async function requestLocalNotificationPermissions(): Promise<boolean> {
  if (Platform.OS === 'web') return false;

  if (await hasLocalNotificationPermission()) return true;

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

/** One-time alert when GPS starts without notification permission (lock screen / banner alerts). */
export async function promptForNotificationAccessIfNeeded(): Promise<void> {
  if (Platform.OS === 'web') return;
  if (await hasLocalNotificationPermission()) return;

  try {
    const alreadyPrompted = await AsyncStorage.getItem(NOTIFICATION_SETTINGS_PROMPT_KEY);
    if (alreadyPrompted === '1') return;
    await AsyncStorage.setItem(NOTIFICATION_SETTINGS_PROMPT_KEY, '1');
  } catch {
    // Still show the alert if storage fails.
  }

  Alert.alert(
    'Turn on notifications',
    'GPS trip reminders need notification permission to show on your lock screen, as banners, and in Notification Center. You can enable them in Settings.',
    [
      { text: 'Not now', style: 'cancel' },
      {
        text: 'Open Settings',
        onPress: () => {
          void Linking.openSettings();
        },
      },
    ]
  );
}

export async function ensureLocalNotificationChannels(): Promise<void> {
  if (Platform.OS === 'web' || channelsReady) return;

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
