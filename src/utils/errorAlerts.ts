import { Alert } from 'react-native';

type NavigationLike = { goBack: () => void };

/**
 * Show an error alert with a "Go back" button so the user can return to the previous screen.
 * Use this for 403/404 or other API errors where showing a raw error page would be confusing.
 */
export function showErrorWithGoBack(
  navigation: NavigationLike,
  title: string,
  message: string
): void {
  Alert.alert(title, message, [
    { text: 'OK', style: 'cancel' },
    { text: 'Go back', onPress: () => navigation.goBack() },
  ]);
}

/**
 * Returns true if the error looks like an HTTP client error (403, 404, Forbidden, Not Found).
 */
export function isHttpClientError(error: unknown): boolean {
  if (error instanceof Error) {
    const msg = (error.message || '').toLowerCase();
    return (
      msg.includes('403') ||
      msg.includes('404') ||
      msg.includes('forbidden') ||
      msg.includes('not found')
    );
  }
  return false;
}
