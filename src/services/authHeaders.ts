import * as SecureStore from 'expo-secure-store';

export const AUTH_TOKEN_KEY = 'auth_token_v1';

export async function getAuthHeaders(): Promise<Record<string, string>> {
  try {
    const token = await SecureStore.getItemAsync(AUTH_TOKEN_KEY);
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}
