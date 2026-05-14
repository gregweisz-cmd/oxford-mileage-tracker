/**
 * Headers for browser → Render API (matches rateLimitedApi.executeRequest).
 * Use on any manual `fetch` to the backend, or rely on installAuthenticatedFetch().
 */
export function getStaffPortalAuthHeaders(
  base: Record<string, string> = {}
): Record<string, string> {
  const headers = { ...base };
  try {
    const token = localStorage.getItem('authToken');
    if (token?.trim()) headers.Authorization = `Bearer ${token.trim()}`;
    const id = localStorage.getItem('currentEmployeeId');
    if (id?.trim()) headers['x-employee-id'] = id.trim();
  } catch {
    /* localStorage inaccessible */
  }
  return headers;
}

/** Overwrite Authorization / x-employee-id from localStorage when present (fixes callers sending `Bearer `). */
export function applyStaffPortalAuthToHeaders(headers: Headers): void {
  const extra = getStaffPortalAuthHeaders();
  if (extra.Authorization?.trim()) {
    headers.set('Authorization', extra.Authorization);
  }
  if (extra['x-employee-id']?.trim()) {
    headers.set('x-employee-id', extra['x-employee-id']);
  }
}
