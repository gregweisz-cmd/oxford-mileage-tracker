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
