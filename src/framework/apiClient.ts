/**
 * PowerBase typed API client — thin, dependency-free wrapper over fetch.
 * Every request returns status + typed body + headers for assertions.
 */

export interface ApiClientOptions {
  baseURL: string;
  headers?: Record<string, string>;
  timeoutMs?: number;
}

export interface ApiResponse<T> {
  status: number;
  data: T;
  headers: Record<string, string>;
}

export class ApiClient {
  constructor(private readonly opts: ApiClientOptions) {}

  private async request<T>(method: string, path: string, body?: unknown): Promise<ApiResponse<T>> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.opts.timeoutMs ?? 15_000);
    try {
      const res = await fetch(`${this.opts.baseURL}${path}`, {
        method,
        headers: { 'Content-Type': 'application/json', ...(this.opts.headers ?? {}) },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      });
      const headers: Record<string, string> = {};
      res.headers.forEach((value, key) => {
        headers[key] = value;
      });
      const text = await res.text();
      const data = text ? (JSON.parse(text) as T) : (undefined as unknown as T);
      return { status: res.status, data, headers };
    } finally {
      clearTimeout(timer);
    }
  }

  get<T>(path: string): Promise<ApiResponse<T>> {
    return this.request<T>('GET', path);
  }

  post<T>(path: string, body?: unknown): Promise<ApiResponse<T>> {
    return this.request<T>('POST', path, body);
  }

  put<T>(path: string, body?: unknown): Promise<ApiResponse<T>> {
    return this.request<T>('PUT', path, body);
  }

  patch<T>(path: string, body?: unknown): Promise<ApiResponse<T>> {
    return this.request<T>('PATCH', path, body);
  }

  delete<T>(path: string): Promise<ApiResponse<T>> {
    return this.request<T>('DELETE', path);
  }

  /** Return a client with additional/overridden headers (e.g. auth tokens). */
  withHeaders(headers: Record<string, string>): ApiClient {
    return new ApiClient({ ...this.opts, headers: { ...(this.opts.headers ?? {}), ...headers } });
  }
}
