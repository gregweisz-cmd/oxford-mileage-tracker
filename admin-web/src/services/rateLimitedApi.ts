/**
 * Rate-Limited API Service
 * Handles HTTP 429 errors, request throttling, and retry logic
 */

const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://oxford-mileage-backend.onrender.com';

interface RequestQueueItem {
  url: string;
  options: RequestInit;
  resolve: (value: Response) => void;
  reject: (error: Error) => void;
  retries: number;
}

class RateLimitedApiService {
  private requestQueue: RequestQueueItem[] = [];
  private isProcessing = false;
  private lastRequestTime = 0;
  private minRequestInterval = 100; // Minimum 100ms between requests
  private maxRetries = 3;
  private retryDelay = 1000; // Start with 1 second
  private cache: Map<string, { data: any; timestamp: number }> = new Map();
  private cacheTTL = 60000; // 60 seconds cache (increased to reduce API calls)

  /**
   * Add request to queue and process
   */
  async fetch(url: string, options: RequestInit = {}): Promise<Response> {
    // Check cache first (only for GET requests)
    if (!options.method || options.method === 'GET') {
      const cacheKey = `${url}-${JSON.stringify(options)}`;
      const cached = this.cache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
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
      
      this.processQueue();
    });
  }

  /**
   * Process request queue with throttling
   */
  private async processQueue() {
    if (this.isProcessing || this.requestQueue.length === 0) {
      return;
    }

    this.isProcessing = true;

    while (this.requestQueue.length > 0) {
      const item = this.requestQueue.shift();
      if (!item) break;

      // Throttle requests
      const timeSinceLastRequest = Date.now() - this.lastRequestTime;
      if (timeSinceLastRequest < this.minRequestInterval) {
        await new Promise(resolve => 
          setTimeout(resolve, this.minRequestInterval - timeSinceLastRequest)
        );
      }

      try {
        const response = await this.executeRequest(item);
        this.lastRequestTime = Date.now();
        
        // Cache successful GET requests
        if (item.options.method === 'GET' || !item.options.method) {
          try {
            const data = await response.clone().json();
            this.cache.set(`${item.url}-${JSON.stringify(item.options)}`, {
              data,
              timestamp: Date.now()
            });
          } catch {
            // If response isn't JSON, don't cache
          }
        }
        
        item.resolve(response);
      } catch (error) {
        // Handle rate limiting with exponential backoff
        if (error instanceof Error && error.message.includes('429')) {
          if (item.retries < this.maxRetries) {
            const delay = this.retryDelay * Math.pow(2, item.retries);
            console.warn(`Rate limited. Retrying in ${delay}ms... (attempt ${item.retries + 1}/${this.maxRetries})`);
            
            await new Promise(resolve => setTimeout(resolve, delay));
            
            // Re-queue with incremented retry count
            item.retries++;
            this.requestQueue.unshift(item);
            continue;
          } else {
            item.reject(new Error('Rate limit exceeded. Please wait a moment and try again.'));
          }
        } else {
          item.reject(error as Error);
        }
      }
    }

    this.isProcessing = false;
  }

  /**
   * Execute a single request
   */
  private async executeRequest(item: RequestQueueItem): Promise<Response> {
    const fullUrl = item.url.startsWith('http') ? item.url : `${API_BASE_URL}${item.url}`;
    
    const response = await fetch(fullUrl, {
      ...item.options,
      headers: {
        'Content-Type': 'application/json',
        ...item.options.headers,
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
}

// Export singleton instance
export const rateLimitedApi = new RateLimitedApiService();

// Export convenience methods
export const apiFetch = (url: string, options?: RequestInit) => 
  rateLimitedApi.fetch(url, options);

export const apiGet = async <T = any>(url: string): Promise<T> => {
  const response = await rateLimitedApi.fetch(url, { method: 'GET' });
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

