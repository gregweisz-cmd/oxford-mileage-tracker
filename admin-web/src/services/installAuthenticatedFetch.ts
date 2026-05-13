import { getStaffPortalAuthHeaders } from './staffPortalAuthHeaders';

const DEFAULT_API_BASE_URL = 'https://oxford-mileage-backend.onrender.com';

function resolveApiBaseUrl(): string {
  const configured = (process.env.REACT_APP_API_URL || DEFAULT_API_BASE_URL).replace(/\/+$/, '');
  try {
    const configuredUrl = new URL(configured);
    if (
      typeof window !== 'undefined' &&
      configuredUrl.hostname === window.location.hostname &&
      configuredUrl.pathname.replace(/\/+$/, '') === ''
    ) {
      return DEFAULT_API_BASE_URL;
    }
    if (configuredUrl.hostname.endsWith('.vercel.app')) {
      return DEFAULT_API_BASE_URL;
    }
  } catch {
    return DEFAULT_API_BASE_URL;
  }
  return configured;
}

const API_BASE_URL = resolveApiBaseUrl();

let installed = false;

function resolveUrlString(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

/**
 * True when the request targets our backend /api routes (absolute Render URL, or same-path /api on SPA).
 */
function shouldAttachAuth(urlStr: string): boolean {
  if (!urlStr) return false;
  if (urlStr.startsWith('/api/')) return true;
  try {
    const api = new URL(API_BASE_URL);
    const target = new URL(urlStr, typeof window !== 'undefined' ? window.location.href : `${api.protocol}//${api.host}`);
    if (target.hostname === api.hostname && target.pathname.startsWith('/api')) {
      return true;
    }
  } catch {
    /* fall through */
  }
  return urlStr.startsWith(`${API_BASE_URL}/api/`) || urlStr.includes(`${API_BASE_URL}//api/`);
}

/** Do not attach a session JWT to credential endpoints */
function isCredentialEndpoint(urlStr: string, method: string): boolean {
  try {
    const u = new URL(urlStr, typeof window !== 'undefined' ? window.location.href : 'https://local.invalid');
    const p = (u.pathname || '').replace(/\/+$/, '') || '/';
    const m = (method || 'GET').toUpperCase();
    if (m === 'POST' && (p === '/api/auth/login' || p === '/api/employee-login')) return true;
    return false;
  } catch {
    return false;
  }
}

function hasAuthorization(headers: Headers): boolean {
  return headers.has('Authorization') || headers.has('authorization');
}

function mergeBackendAuthHeaders(headers: Headers): void {
  const extra = getStaffPortalAuthHeaders();
  if (extra.Authorization && !hasAuthorization(headers)) {
    headers.set('Authorization', extra.Authorization);
  }
  if (extra['x-employee-id'] && !headers.has('x-employee-id') && !headers.has('X-Employee-Id')) {
    headers.set('x-employee-id', extra['x-employee-id']);
  }
}

function resolveBackendApiUrl(urlStr: string): string | null {
  if (!urlStr) return null;
  try {
    const fallbackBase = typeof window !== 'undefined' ? window.location.href : `${API_BASE_URL}/`;
    const target = new URL(urlStr, fallbackBase);
    const isSameOriginApi =
      typeof window !== 'undefined' &&
      target.origin === window.location.origin &&
      target.pathname.startsWith('/api/');
    if (!isSameOriginApi && !urlStr.startsWith('/api/')) {
      return null;
    }

    const backend = new URL(API_BASE_URL);
    backend.pathname = target.pathname;
    backend.search = target.search;
    backend.hash = target.hash;
    return backend.toString();
  } catch {
    return null;
  }
}

function rewriteApiRequest(input: RequestInfo | URL, rewrittenUrl: string): RequestInfo | URL {
  if (typeof input === 'string') return rewrittenUrl;
  if (input instanceof URL) return new URL(rewrittenUrl);
  return new Request(rewrittenUrl, input);
}

export function installAuthenticatedFetch() {
  if (installed || typeof window === 'undefined') return;
  installed = true;

  const originalFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const urlStr = resolveUrlString(input);
    const backendApiUrl = resolveBackendApiUrl(urlStr);
    const fetchInput = backendApiUrl ? rewriteApiRequest(input, backendApiUrl) : input;
    const effectiveUrlStr = backendApiUrl || urlStr;
    const method =
      init?.method ||
      (input instanceof Request ? input.method : undefined) ||
      'GET';

    let token: string | null = null;
    try {
      token = localStorage.getItem('authToken');
    } catch {
      token = null;
    }

    if (!token?.trim() || !shouldAttachAuth(effectiveUrlStr) || isCredentialEndpoint(effectiveUrlStr, method)) {
      return originalFetch(fetchInput, init);
    }

    const headers = new Headers(init?.headers || (input instanceof Request ? input.headers : undefined));
    mergeBackendAuthHeaders(headers);

    return originalFetch(fetchInput, { ...init, headers });
  };
}
