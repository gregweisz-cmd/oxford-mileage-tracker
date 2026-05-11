const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://oxford-mileage-backend.onrender.com';

let installed = false;

function shouldAttachAuth(input: RequestInfo | URL): boolean {
  const rawUrl = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
  if (!rawUrl) return false;

  if (rawUrl.startsWith('/api/')) return true;
  return rawUrl.startsWith(`${API_BASE_URL}/api/`);
}

function hasAuthorization(headers: Headers): boolean {
  return headers.has('Authorization') || headers.has('authorization');
}

export function installAuthenticatedFetch() {
  if (installed || typeof window === 'undefined') return;
  installed = true;

  const originalFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const token = localStorage.getItem('authToken');
    if (!token || !shouldAttachAuth(input)) {
      return originalFetch(input, init);
    }

    const headers = new Headers(init?.headers || (input instanceof Request ? input.headers : undefined));
    if (!hasAuthorization(headers)) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    return originalFetch(input, { ...init, headers });
  };
}
