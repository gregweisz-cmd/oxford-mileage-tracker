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

/**
 * If the sync error is an auth failure, append short guidance (sign out / sign in online).
 */
export function formatSyncUnauthorizedMessage(detail: string): string {
  const d = (detail || '').toLowerCase();
  if (!d.includes('401') && !d.includes('authentication required')) {
    return detail;
  }
  return `${detail}\n\nTo fix this: sign out, then sign in again while you have internet (use the same password as the staff portal, or Google if you use that). If you once signed in with no connection, the app may never have received a cloud session—signing in online fixes that.`;
}
