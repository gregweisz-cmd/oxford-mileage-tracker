/**
 * Rate-Limited API Service
 * Handles HTTP 429 errors, request throttling, and retry logic
 */

import { getStaffPortalAuthHeaders } from './staffPortalAuthHeaders';

const API_BASE_URL = (process.env.REACT_APP_API_URL || 'https://oxford-mileage-backend.onrender.com').replace(
  /\/+$/,
  ''
);

function flattenHeadersInit(h: HeadersInit | undefined): Record<string, string> {
  if (!h) return {};
  if (h instanceof Headers) {
    const o: Record<string, string> = {};
    h.forEach((value, key) => {
      if (value != null && value !== '') o[key] = value;
    });
    return o;
  }
  if (Array.isArray(h)) return Object.fromEntries(h);
  return { ...(h as Record<string, string>) };
}

interface RequestQueueItem {
  url: string;
  options: RequestInit;
  resolve: (value: Response) => void;
  reject: (error: Error) => void;
  retries: number;
}

class RateLimitedApiService {
  private requestQueue: RequestQueueItem[] = [];
  private activeCount = 0;
  // Allow several requests in flight at once so a portal's Promise.all batch actually runs in
  // parallel. The backend general limiter is ~1000 req / 15 min (~66/min), so a small concurrency
  // pool is well within budget, and the 429 backoff below remains a safety net.
  private maxConcurrent = 6;
  private maxRetries = 3;
  private retryDelay = 1000; // Start with 1 second
  private cache: Map<string, { data: any; timestamp: number }> = new Map();
  private cacheTTL = 60000; // Default 60s in-memory cache for GETs
  // Slow-changing resources can be cached longer so repeat portal switches reuse them.
  private longCacheTTL = 5 * 60 * 1000; // 5 minutes
  private longCachePatterns = [
    '/api/cost-centers',
    '/api/employees',
    '/supervisors/',
    '/senior-staff/',
    '/team',
    '/api/per-diem-rules',
  ];

  /** Canonical cache key so the same URL hits the same entry regardless of caller (apiGet vs apiFetch). */
  private cacheKey(url: string, options: RequestInit): string {
    const method = (options.method || 'GET').toUpperCase();
    const body = typeof options.body === 'string' ? options.body : '';
    return `${method}:${url}:${body}`;
  }

  private ttlForUrl(url: string): number {
    return this.longCachePatterns.some((p) => url.includes(p)) ? this.longCacheTTL : this.cacheTTL;
  }

  /**
   * Add request to queue and process
   */
  async fetch(url: string, options: RequestInit = {}): Promise<Response> {
    // Check cache first (only for GET requests)
    if (!options.method || options.method === 'GET') {
      const cacheKey = this.cacheKey(url, options);
      const cached = this.cache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < this.ttlForUrl(url)) {
        // Return cached response as a Response-like object
        return new Response(JSON.stringify(cached.data), {
          status: 200,
          statusText: 'OK',
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    return new Promise((resolve, reject) => {
      this.requestQueue.push({
        url,
        options,
        resolve,
        reject,
        retries: 0
      });

      this.pump();
    });
  }

  /**
   * Start as many queued requests as the concurrency budget allows. Each completion pumps again.
   */
  private pump() {
    while (this.activeCount < this.maxConcurrent && this.requestQueue.length > 0) {
      const item = this.requestQueue.shift();
      if (!item) break;
      this.activeCount++;
      void this.runItem(item).finally(() => {
        this.activeCount--;
        this.pump();
      });
    }
  }

  /**
   * Execute a single queued request, caching GETs and applying 429 backoff/retry.
   */
  private async runItem(item: RequestQueueItem): Promise<void> {
    try {
      const response = await this.executeRequest(item);

      const method = (item.options.method || 'GET').toUpperCase();

      // Cache successful GET requests
      if (method === 'GET') {
        try {
          const data = await response.clone().json();
          this.cache.set(this.cacheKey(item.url, item.options), {
            data,
            timestamp: Date.now()
          });
        } catch {
          // If response isn't JSON, don't cache
        }
      } else {
        invalidateCachesForMutation(item.url, method);
      }

      item.resolve(response);
    } catch (error) {
      // Handle rate limiting with exponential backoff
      if (error instanceof Error && error.message.includes('429') && item.retries < this.maxRetries) {
        const delay = this.retryDelay * Math.pow(2, item.retries);
        console.warn(`Rate limited. Retrying in ${delay}ms... (attempt ${item.retries + 1}/${this.maxRetries})`);
        item.retries++;
        setTimeout(() => {
          this.requestQueue.unshift(item);
          this.pump();
        }, delay);
        return;
      }

      if (error instanceof Error && error.message.includes('429')) {
        item.reject(new Error('Rate limit exceeded. Please wait a moment and try again.'));
      } else {
        item.reject(error as Error);
      }
    }
  }

  /**
   * Execute a single request
   */
  private async executeRequest(item: RequestQueueItem): Promise<Response> {
    const fullUrl = item.url.startsWith('http') ? item.url : `${API_BASE_URL}${item.url}`;

    const response = await fetch(fullUrl, {
      ...item.options,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...flattenHeadersInit(item.options.headers),
        ...getStaffPortalAuthHeaders(),
      },
    });

    // Handle rate limiting
    if (response.status === 429) {
      const retryAfter = response.headers.get('Retry-After');
      if (retryAfter) {
        const delay = parseInt(retryAfter, 10) * 1000;
        throw new Error(`429: Rate limited. Retry after ${delay}ms`);
      }
      throw new Error('429: Rate limit exceeded');
    }

    if (!response.ok && response.status !== 429) {
      const errorText = await response.text().catch(() => '');
      throw new Error(`HTTP ${response.status}: ${errorText || response.statusText}`);
    }

    return response;
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cache.clear();
  }

  /**
   * Clear cache for specific URL pattern
   */
  clearCacheFor(urlPattern: string) {
    const keysToDelete: string[] = [];
    this.cache.forEach((value, key) => {
      if (key.includes(urlPattern)) {
        keysToDelete.push(key);
      }
    });
    keysToDelete.forEach(key => this.cache.delete(key));
  }

  /** Drop cached supervisor/finance report lists after report workflow changes. */
  invalidateExpenseReportListCache() {
    this.clearCacheFor('/api/monthly-reports');
    this.clearCacheFor('/api/expense-reports');
  }

  /** Drop cached staff month data after edits to source tables or report sync. */
  invalidateStaffMonthDataCache() {
    this.invalidateExpenseReportListCache();
    [
      '/api/daily-descriptions',
      '/api/time-tracking',
      '/api/mileage-entries',
      '/api/receipts',
      '/api/daily-odometer-readings',
      '/api/daily-odometer',
    ].forEach((pattern) => this.clearCacheFor(pattern));
  }
}

function pathFromMutationUrl(url: string): string {
  try {
    if (url.startsWith('/')) return url.split('?')[0];
    return new URL(url).pathname;
  } catch {
    return url.split('?')[0];
  }
}

/**
 * Invalidate rateLimitedApi GET caches after a successful mutation.
 * Called from processQueue and installAuthenticatedFetch so raw fetch() and apiPost/apiPut/apiDelete stay in sync.
 */
export function invalidateCachesForMutation(url: string, method: string): void {
  const verb = (method || 'GET').toUpperCase();
  if (verb === 'GET' || verb === 'HEAD' || verb === 'OPTIONS') return;

  const path = pathFromMutationUrl(url);

  if (path.includes('/api/expense-reports')) {
    rateLimitedApi.invalidateExpenseReportListCache();
    const isStaffMonthMutation =
      path.includes('/sync-to-source') ||
      path.includes('/wipe-month') ||
      path.includes('/status') ||
      (verb === 'POST' && /\/api\/expense-reports\/?$/.test(path));
    if (isStaffMonthMutation) {
      rateLimitedApi.invalidateStaffMonthDataCache();
    }
  }

  const staffDataPatterns = [
    '/api/mileage-entries',
    '/api/receipts',
    '/api/time-tracking',
    '/api/daily-descriptions',
    '/api/daily-odometer-readings',
    '/api/daily-odometer',
  ];
  for (const pattern of staffDataPatterns) {
    if (path.includes(pattern)) {
      rateLimitedApi.clearCacheFor(pattern);
      rateLimitedApi.clearCacheFor('/api/expense-reports');
      break;
    }
  }

  if (path.includes('/api/employees')) {
    rateLimitedApi.clearCacheFor('/api/employees');
  }

  if (path.includes('/api/per-diem-rules')) {
    rateLimitedApi.clearCacheFor('/api/per-diem-rules');
  }

  if (path.includes('/api/cost-centers')) {
    rateLimitedApi.clearCacheFor('/api/cost-centers');
  }

  if (path.includes('/api/finance-cost-center-assignments')) {
    rateLimitedApi.clearCacheFor('/api/finance-cost-center-assignments');
  }

  if (path.includes('/api/notifications')) {
    rateLimitedApi.clearCacheFor('/api/notifications');
  }

  if (path.includes('/api/vehicles')) {
    rateLimitedApi.clearCacheFor('/api/vehicles');
  }

  if (path.includes('/api/supervisors')) {
    rateLimitedApi.clearCacheFor('/api/supervisors');
    rateLimitedApi.invalidateExpenseReportListCache();
  }
}

// Export singleton instance
export const rateLimitedApi = new RateLimitedApiService();

// Export convenience methods
export const apiFetch = (url: string, options?: RequestInit) => 
  rateLimitedApi.fetch(url, options);

export interface ApiGetOptions {
  /** Bypass the 60s in-memory cache (appends a cache-bust query param). */
  skipCache?: boolean;
}

export const apiGet = async <T = any>(url: string, options?: ApiGetOptions): Promise<T> => {
  const fetchUrl = options?.skipCache
    ? `${url}${url.includes('?') ? '&' : '?'}_t=${Date.now()}`
    : url;
  const response = await rateLimitedApi.fetch(fetchUrl, { method: 'GET' });
  return response.json();
};

export const apiPost = async <T = any>(url: string, data?: any): Promise<T> => {
  const response = await rateLimitedApi.fetch(url, {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return response.json();
};

export const apiPut = async <T = any>(url: string, data?: any): Promise<T> => {
  const response = await rateLimitedApi.fetch(url, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
  return response.json();
};

export const apiDelete = async <T = any>(url: string): Promise<T> => {
  const response = await rateLimitedApi.fetch(url, { method: 'DELETE' });
  return response.json();
};

