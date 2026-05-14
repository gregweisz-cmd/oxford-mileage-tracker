/**
 * Fired when the backend returns 401 on an authenticated API call so the SPA
 * can clear state and send the user back to login (expired JWT, rotated secret, etc.).
 */
let expiredDispatched = false;

export function dispatchStaffPortalSessionExpired(): void {
  if (typeof window === 'undefined' || expiredDispatched) return;
  expiredDispatched = true;
  window.dispatchEvent(new CustomEvent('oxford-staff-session-expired'));
}

export function resetStaffPortalSessionExpiredDispatch(): void {
  expiredDispatched = false;
}
