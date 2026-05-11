import * as SecureStore from 'expo-secure-store';
import { API_BASE_URL } from '../config/api';
import { DatabaseService } from './database';
import { AUTH_TOKEN_KEY } from './authHeaders';
import { debugLog, debugWarn } from '../config/debug';

function rootApiOrigin(): string {
  const base = (API_BASE_URL ?? '').replace(/\/api\/?$/, '').trim();
  return base || 'https://oxford-mileage-backend.onrender.com';
}

/**
 * Re-issue a JWT using the current employee row (email + password) when the app has no token
 * or the server returns 401 (expired session). Google-only accounts typically have no stored password.
 */
export async function refreshEmployeeJwtFromStoredCredentials(): Promise<boolean> {
  try {
    const employee = await DatabaseService.getCurrentEmployee();
    if (!employee?.email?.trim() || !employee.password?.trim()) {
      debugWarn('⚠️ Auth refresh: no stored email/password for current employee');
      return false;
    }
    const origin = rootApiOrigin();
    const response = await fetch(`${origin}/api/employee-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: employee.email.trim().toLowerCase(),
        password: employee.password,
      }),
    });
    const data = (await response.json().catch(() => ({}))) as { token?: string; error?: string };
    if (!response.ok || typeof data.token !== 'string' || !data.token) {
      debugWarn('⚠️ Auth refresh: employee-login failed', response.status, data?.error);
      return false;
    }
    await SecureStore.setItemAsync(AUTH_TOKEN_KEY, data.token);
    debugLog('✅ Auth refresh: stored new JWT from employee-login');
    return true;
  } catch (e) {
    debugWarn('⚠️ Auth refresh: error', e);
    return false;
  }
}
