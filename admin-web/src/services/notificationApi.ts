import { getStaffPortalAuthHeaders } from './staffPortalAuthHeaders';
import { debugError } from '../config/debug';

const API_BASE_URL = (process.env.REACT_APP_API_URL || 'https://oxford-mileage-backend.onrender.com').replace(
  /\/+$/,
  ''
);

/** Logged-in viewer id — must match JWT sub for notification APIs. */
export function getNotificationRecipientId(fallbackEmployeeId?: string): string {
  try {
    const loggedIn = localStorage.getItem('currentEmployeeId')?.trim();
    if (loggedIn) return loggedIn;
  } catch {
    /* localStorage inaccessible */
  }
  return (fallbackEmployeeId || '').trim();
}

async function notificationRequest(path: string, init: RequestInit = {}): Promise<Response> {
  const url = path.startsWith('http') ? path : `${API_BASE_URL}${path}`;
  const headers = {
    ...getStaffPortalAuthHeaders(),
    ...((init.headers as Record<string, string>) || {}),
  };
  return fetch(url, { ...init, headers });
}

export async function fetchNotificationList(
  recipientId: string,
  options?: { limit?: number; portal?: string }
): Promise<unknown[]> {
  const query = new URLSearchParams();
  if (options?.limit) query.set('limit', String(options.limit));
  if (options?.portal) query.set('portal', options.portal);
  const queryString = query.toString();
  const response = await notificationRequest(
    `/api/notifications/${recipientId}${queryString ? `?${queryString}` : ''}`
  );
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(
      detail ? `HTTP ${response.status}: ${detail.slice(0, 120)}` : `HTTP ${response.status}`
    );
  }
  const data = await response.json();
  return Array.isArray(data) ? data : [];
}

export async function fetchNotificationUnreadCount(
  recipientId: string,
  options?: { portal?: string }
): Promise<number> {
  const portalQuery = options?.portal ? `?portal=${encodeURIComponent(options.portal)}` : '';
  const response = await notificationRequest(`/api/notifications/${recipientId}/count${portalQuery}`);
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(
      detail ? `HTTP ${response.status}: ${detail.slice(0, 120)}` : `HTTP ${response.status}`
    );
  }
  const data = await response.json();
  return typeof data?.count === 'number' ? data.count : 0;
}

export async function markNotificationRead(notificationId: string): Promise<void> {
  const response = await notificationRequest(`/api/notifications/${notificationId}/read`, {
    method: 'PUT',
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
}

export async function markAllNotificationsRead(recipientId: string): Promise<void> {
  const response = await notificationRequest(`/api/notifications/${recipientId}/read-all`, {
    method: 'PUT',
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
}

export async function deleteNotification(notificationId: string): Promise<void> {
  const response = await notificationRequest(`/api/notifications/${notificationId}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
}

export async function clearReadNotifications(recipientId: string): Promise<void> {
  const response = await notificationRequest(`/api/notifications/${recipientId}/clear-all`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
}

export function logNotificationApiError(context: string, error: unknown): void {
  debugError(context, error);
}
