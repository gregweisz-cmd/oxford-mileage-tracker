import * as SecureStore from 'expo-secure-store';

export const AUTH_TOKEN_KEY = 'auth_token_v1';

/** Best-effort employee id from stored session token (JWT `sub` or legacy `session_<id>_<ts>`). */
function employeeIdFromSessionToken(token: string): string | null {
  const parts = token.split('.');
  if (parts.length >= 2) {
    try {
      const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const padded = payload + '==='.slice((payload.length + 3) % 4);
      const json = JSON.parse(atob(padded)) as { sub?: string };
      if (json.sub && typeof json.sub === 'string') return json.sub;
    } catch {
      /* not a JWT */
    }
  }
  const legacy = /^session_(.+)_(\d+)$/.exec(token);
  return legacy?.[1] ?? null;
}

export async function getAuthHeaders(): Promise<Record<string, string>> {
  try {
    const token = await SecureStore.getItemAsync(AUTH_TOKEN_KEY);
    if (!token) return {};
    const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
    const employeeId = employeeIdFromSessionToken(token);
    if (employeeId) {
      headers['X-Employee-Id'] = employeeId;
    }
    return headers;
  } catch {
    return {};
  }
}
