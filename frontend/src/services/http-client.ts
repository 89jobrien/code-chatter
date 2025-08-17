/**
 * HTTP Client with retry logic and error handling
 */

import { ApiError } from '@/types';
import { API_CONFIG, HTTP_STATUS } from './config';

interface RequestConfig extends RequestInit {
  timeout?: number;
  retries?: number;
  retryDelay?: number;
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Record<string, string>;
  body?: any;
  timeout?: number;
  retries?: number;
  retryDelay?: number;
}

class HttpClient {
  private baseUrl: string;
  private defaultTimeout: number;
  private defaultRetries: number;
  private defaultRetryDelay: number;

  constructor(baseUrl: string = API_CONFIG.BASE_URL) {
    this.baseUrl = baseUrl;
    this.defaultTimeout = API_CONFIG.TIMEOUT;
    this.defaultRetries = API_CONFIG.RETRY_ATTEMPTS;
    this.defaultRetryDelay = API_CONFIG.RETRY_DELAY;
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private createTimeoutSignal(timeout: number): AbortController {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), timeout);
    return controller;
  }

  private async handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
      let errorData = null;

      try {
        errorData = await response.json();
        errorMessage = errorData.detail || errorData.message || errorMessage;
      } catch {
        // If JSON parsing fails, use the default error message
      }

      throw new ApiError(errorMessage, response.status, errorData?.error_code);
    }

    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      return response.json();
    }

    return response.text() as unknown as T;
  }

  private async makeRequest<T>(
    url: string,
    options: RequestOptions = {}
  ): Promise<T> {
    const {
      method = 'GET',
      headers = {},
      body,
      timeout = this.defaultTimeout,
      retries = this.defaultRetries,
      retryDelay = this.defaultRetryDelay,
    } = options;

    const fullUrl = url.startsWith('http') ? url : `${this.baseUrl}${url}`;
    
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const controller = this.createTimeoutSignal(timeout);
        
        const requestInit: RequestInit = {
          method,
          headers: {
            'Content-Type': 'application/json',
            ...headers,
          },
          signal: controller.signal,
        };

        if (body) {
          if (body instanceof FormData) {
            // Remove Content-Type header for FormData to let browser set it
            delete (requestInit.headers as any)['Content-Type'];
            requestInit.body = body;
          } else if (typeof body === 'string') {
            requestInit.body = body;
          } else {
            requestInit.body = JSON.stringify(body);
          }
        }

        const response = await fetch(fullUrl, requestInit);
        return await this.handleResponse<T>(response);

      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        // Don't retry on client errors (4xx)
        if (error instanceof ApiError && 
            error.status && 
            error.status >= HTTP_STATUS.BAD_REQUEST && 
            error.status < HTTP_STATUS.INTERNAL_SERVER_ERROR) {
          throw error;
        }

        // Don't retry on the last attempt
        if (attempt === retries) {
          break;
        }

        // Wait before retrying
        await this.delay(retryDelay * Math.pow(2, attempt)); // Exponential backoff
      }
    }

    throw lastError || new Error('Request failed after retries');
  }

  async get<T>(url: string, options: Omit<RequestOptions, 'method' | 'body'> = {}): Promise<T> {
    return this.makeRequest<T>(url, { ...options, method: 'GET' });
  }

  async post<T>(url: string, data?: any, options: Omit<RequestOptions, 'method'> = {}): Promise<T> {
    return this.makeRequest<T>(url, { ...options, method: 'POST', body: data });
  }

  async put<T>(url: string, data?: any, options: Omit<RequestOptions, 'method'> = {}): Promise<T> {
    return this.makeRequest<T>(url, { ...options, method: 'PUT', body: data });
  }

  async patch<T>(url: string, data?: any, options: Omit<RequestOptions, 'method'> = {}): Promise<T> {
    return this.makeRequest<T>(url, { ...options, method: 'PATCH', body: data });
  }

  async delete<T>(url: string, options: Omit<RequestOptions, 'method' | 'body'> = {}): Promise<T> {
    return this.makeRequest<T>(url, { ...options, method: 'DELETE' });
  }

  // Streaming request for chat
  async stream(
    url: string,
    data: any,
    onChunk: (chunk: string) => void,
    options: Omit<RequestOptions, 'method'> = {}
  ): Promise<void> {
    const fullUrl = url.startsWith('http') ? url : `${this.baseUrl}${url}`;
    
    try {
      const response = await fetch(fullUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new ApiError(
          `HTTP ${response.status}: ${response.statusText}`,
          response.status
        );
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new ApiError('Response body is not readable');
      }

      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;
        
        const chunk = decoder.decode(value, { stream: true });
        onChunk(chunk);
      }

    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(
        error instanceof Error ? error.message : 'Streaming request failed'
      );
    }
  }
}

// Export a singleton instance
export const httpClient = new HttpClient();
export { HttpClient };
