import * as WebBrowser from 'expo-web-browser';
import * as SecureStore from 'expo-secure-store';
import { API_BASE_URL } from '../config/api';

WebBrowser.maybeCompleteAuthSession();

const AUTH_TOKEN_KEY = 'auth_token_v1';
const OAUTH_RETURN_URL = 'ohstafftracker://oauth/callback';

export interface GoogleUserInfo {
  id: string;
  email: string;
  name: string;
  picture?: string;
  token?: string;
  authorizationCode?: string;
}

function getBaseUrl(): string {
  const baseUrl = (API_BASE_URL ?? '').replace(/\/api\/?$/, '');
  return baseUrl || 'https://oxford-mileage-backend.onrender.com';
}

function parseOAuthCallbackUrl(url: string): GoogleUserInfo {
  const urlObj = new URL(url);
  const error = urlObj.searchParams.get('error');
  if (error) {
    throw new Error(decodeURIComponent(error));
  }

  const success = urlObj.searchParams.get('success');
  const token = urlObj.searchParams.get('token');
  const email = urlObj.searchParams.get('email');

  if (success === 'true' && token && email) {
    return {
      id: '',
      email: decodeURIComponent(email),
      name: '',
      token: decodeURIComponent(token),
    };
  }

  throw new Error('Google sign-in did not return a valid session. Please try again.');
}

async function pollForToken(authCode: string): Promise<GoogleUserInfo> {
  const baseUrl = getBaseUrl();
  const response = await fetch(
    `${baseUrl}/api/auth/google/mobile/poll?code=${encodeURIComponent(authCode)}`
  );
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error || 'Sign-in code expired or invalid');
  }
  const data = (await response.json()) as { token?: string; email?: string };
  if (!data.token || !data.email) {
    throw new Error('Invalid sign-in response from server');
  }
  return {
    id: '',
    email: data.email,
    name: '',
    token: data.token,
  };
}

export class GoogleAuthService {
  /**
   * Opens Google sign-in via the backend (same OAuth client as the staff portal).
   * Returns null if the user cancels.
   */
  static async signInWithGoogle(): Promise<GoogleUserInfo | null> {
    const baseUrl = getBaseUrl();
    const startUrl = `${baseUrl}/api/auth/google/mobile`;

    const result = await WebBrowser.openAuthSessionAsync(startUrl, OAUTH_RETURN_URL);

    if (result.type === 'cancel' || result.type === 'dismiss') {
      return null;
    }

    if (result.type !== 'success' || !result.url) {
      throw new Error('Google sign-in did not complete. Please try again.');
    }

    try {
      return parseOAuthCallbackUrl(result.url);
    } catch (parseError) {
      const urlObj = new URL(result.url);
      const pollCode = urlObj.searchParams.get('code');
      if (pollCode) {
        return pollForToken(pollCode);
      }
      throw parseError;
    }
  }

  /** Verify session token and return canonical employee record from the API. */
  static async verifyWithBackend(userInfo: GoogleUserInfo): Promise<any> {
    const baseUrl = getBaseUrl();
    let token = userInfo.token;

    if (!token) {
      throw new Error('No session token received from Google sign-in');
    }

    await SecureStore.setItemAsync(AUTH_TOKEN_KEY, token);

    const response = await fetch(`${baseUrl}/api/auth/verify`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      await SecureStore.deleteItemAsync(AUTH_TOKEN_KEY);
      const body = await response.json().catch(() => ({}));
      throw new Error((body as { error?: string }).error || 'Failed to verify Google sign-in');
    }

    const result = await response.json();
    const employee = result.employee;
    if (!employee?.id) {
      throw new Error('Employee record not found after Google sign-in');
    }

    return employee;
  }
}
