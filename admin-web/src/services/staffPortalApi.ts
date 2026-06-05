/**
 * Staff Portal API helpers — use rateLimitedApi paths (/api/...) so mutations
 * get rate limiting, auth headers, and automatic cache invalidation.
 */
import {
  apiDelete,
  apiFetch,
  apiGet,
  apiPost,
  apiPut,
  rateLimitedApi,
  type ApiGetOptions,
} from './rateLimitedApi';

export { apiDelete, apiFetch, apiGet, apiPost, apiPut, rateLimitedApi };

export type { ApiGetOptions };

export async function syncExpenseReportToSource(payload: {
  employeeId: string;
  month: number;
  year: number;
  reportData: unknown;
}): Promise<void> {
  await apiPost('/api/expense-reports/sync-to-source', payload);
}

export async function fetchMileageEntriesForMonth(
  employeeId: string,
  month: number,
  year: number,
  options?: ApiGetOptions
): Promise<any[]> {
  return apiGet<any[]>(
    `/api/mileage-entries?employeeId=${employeeId}&month=${month}&year=${year}`,
    options
  );
}

export async function fetchTimeTrackingForMonth(
  employeeId: string,
  month: number,
  year: number,
  options?: ApiGetOptions
): Promise<any[]> {
  return apiGet<any[]>(
    `/api/time-tracking?employeeId=${employeeId}&month=${month}&year=${year}`,
    options
  );
}

export async function saveDailyDescription(data: unknown): Promise<unknown> {
  return apiPost('/api/daily-descriptions', data);
}
