import { Alert, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Updates from 'expo-updates';

const DISMISSED_UPDATE_ID_KEY = '@ota_update_prompt_dismissed_id';

export class OtaUpdatePromptService {
  private static checkInProgress = false;

  static async checkAndPromptIfAvailable(): Promise<void> {
    if (Platform.OS === 'web' || __DEV__ || this.checkInProgress) {
      return;
    }

    this.checkInProgress = true;
    try {
      const updateCheck = await Updates.checkForUpdateAsync();
      if (!updateCheck.isAvailable) {
        return;
      }

      const fetched = await Updates.fetchUpdateAsync();
      const updateId =
        (fetched as any)?.manifest?.id ||
        (updateCheck as any)?.manifest?.id ||
        (fetched as any)?.manifestString ||
        null;

      if (!updateId) {
        return;
      }

      const dismissedUpdateId = await AsyncStorage.getItem(DISMISSED_UPDATE_ID_KEY);
      if (dismissedUpdateId === updateId) {
        return;
      }

      Alert.alert(
        'Update Ready',
        'A newer test build has been downloaded. Restart now to use the latest fixes?',
        [
          {
            text: 'Later',
            style: 'cancel',
            onPress: async () => {
              await AsyncStorage.setItem(DISMISSED_UPDATE_ID_KEY, updateId);
            },
          },
          {
            text: 'Restart Now',
            onPress: async () => {
              await AsyncStorage.removeItem(DISMISSED_UPDATE_ID_KEY);
              await Updates.reloadAsync();
            },
          },
        ],
        { cancelable: true }
      );
    } catch (error) {
      console.warn('OTA update check failed:', error);
    } finally {
      this.checkInProgress = false;
    }
  }
}
