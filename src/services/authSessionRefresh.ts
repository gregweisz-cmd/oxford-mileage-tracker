import * as SecureStore from 'expo-secure-store';
import { API_BASE_URL } from '../config/api';
import { DatabaseService } from './database';
import { AUTH_TOKEN_KEY } from './authHeaders';
import { Employee } from '../types';
import { debugLog, debugWarn } from '../config/debug';

export const GOOGLE_LAST_EMAIL_KEY = 'google_last_email_v1';

function rootApiOrigin(): string {
  const base = (API_BASE_URL ?? '').replace(/\/api\/?$/, '').trim();
  return base || 'https://oxford-mileage-backend.onrender.com';
}

async function applyApiEmployeeToLocal(employeeData: any, stayLoggedIn: boolean): Promise<Employee | null> {
  if (!employeeData?.id || !employeeData?.email) {
    return null;
  }

  const existingEmployee = await DatabaseService.getEmployeeByEmail(employeeData.email);
  if (existingEmployee) {
    const canonicalId = employeeData.id;
    if (existingEmployee.id !== canonicalId) {
      await DatabaseService.realignEmployeeIdWithBackend(existingEmployee.id, canonicalId);
    }
    await DatabaseService.updateEmployee(canonicalId, {
      name: employeeData.name,
      email: employeeData.email,
      password: existingEmployee.password || '',
      oxfordHouseId: employeeData.oxfordHouseId ?? existingEmployee.oxfordHouseId ?? '',
      position: employeeData.position ?? existingEmployee.position ?? '',
      phoneNumber: employeeData.phoneNumber ?? existingEmployee.phoneNumber ?? '',
      baseAddress: employeeData.baseAddress ?? existingEmployee.baseAddress ?? '',
      costCenters: employeeData.costCenters ?? [],
      selectedCostCenters: employeeData.selectedCostCenters?.length
        ? employeeData.selectedCostCenters
        : employeeData.costCenters ?? [],
      defaultCostCenter:
        employeeData.defaultCostCenter ?? employeeData.costCenters?.[0] ?? '',
    });
    await DatabaseService.setCurrentEmployee(canonicalId, stayLoggedIn);
    return (await DatabaseService.getEmployeeById(canonicalId)) ?? null;
  }

  await DatabaseService.createEmployee({
    id: employeeData.id,
    name: employeeData.name,
    email: employeeData.email,
    password: '',
    oxfordHouseId: employeeData.oxfordHouseId || '',
    position: employeeData.position || '',
    phoneNumber: employeeData.phoneNumber || '',
    baseAddress: employeeData.baseAddress || '',
    costCenters: employeeData.costCenters || [],
    selectedCostCenters: employeeData.selectedCostCenters || employeeData.costCenters || [],
    defaultCostCenter: employeeData.defaultCostCenter || employeeData.costCenters?.[0] || '',
  });
  await DatabaseService.setCurrentEmployee(employeeData.id, stayLoggedIn);
  return employeeData as Employee;
}

/**
 * Restore session on app launch: valid JWT, or silent Google renew via server-stored refresh token.
 */
export async function tryRestoreSessionOnLaunch(): Promise<Employee | null> {
  const origin = rootApiOrigin();

  try {
    const token = await SecureStore.getItemAsync(AUTH_TOKEN_KEY);
    if (token) {
      const response = await fetch(`${origin}/api/auth/verify`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const verified = await response.json();
        const employee = await applyApiEmployeeToLocal(verified.employee, true);
        if (employee) {
          debugLog('✅ Session restored from stored JWT');
          return employee;
        }
      }
    }
  } catch (e) {
    debugWarn('⚠️ JWT session restore failed:', e);
  }

  try {
    const lastEmail = await SecureStore.getItemAsync(GOOGLE_LAST_EMAIL_KEY);
    if (!lastEmail?.trim()) {
      return null;
    }

    const renewResponse = await fetch(`${origin}/api/auth/google/renew-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: lastEmail.trim().toLowerCase() }),
    });

    if (renewResponse.ok) {
      const data = await renewResponse.json();
      if (data.token) {
        await SecureStore.setItemAsync(AUTH_TOKEN_KEY, data.token);
      }
      const employee = await applyApiEmployeeToLocal(data.employee, true);
      if (employee) {
        debugLog('✅ Session restored via Google renew-session');
        return employee;
      }
    }
  } catch (e) {
    debugWarn('⚠️ Google renew-session failed:', e);
  }

  return null;
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
