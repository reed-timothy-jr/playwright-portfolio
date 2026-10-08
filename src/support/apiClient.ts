/**
 * PowerBase typed API client — thin, dependency-free wrapper over fetch.
 * Every request returns status + typed body + headers for assertions.
 *
 * Why not Playwright's `request` (see ADR-001): this client is
 * runtime-agnostic — usable in specs, scripts/ CLIs, and recon tooling,
 * anywhere Node runs. Tradeoffs vs the built-in: API calls don't appear
 * in the Playwright trace, and the client doesn't inherit the browser's
 * proxy config (pass one explicitly if needed).
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

	private async request<T>(
		method: string,
		path: string,
		body?: unknown,
	): Promise<ApiResponse<T>> {
		const controller = new AbortController();
		const timer = setTimeout(
			() => controller.abort(),
			this.opts.timeoutMs ?? 15_000,
		);
		try {
			// Normalize slashes: baseURL 'http://x/' + path '/y' must not
			// produce 'http://x//y'.
			const url = `${this.opts.baseURL.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
			const headers: Record<string, string> = {
				...(this.opts.headers ?? {}),
			};
			// Only claim JSON when actually sending JSON — some servers
			// reject a Content-Type on bodyless requests.
			const payload = body === undefined ? undefined : JSON.stringify(body);
			if (payload !== undefined) {
				headers['Content-Type'] = 'application/json';
			}
			const res = await fetch(url, {
				method,
				headers,
				body: payload,
				signal: controller.signal,
			});
			const resHeaders: Record<string, string> = {};
			res.headers.forEach((value, key) => {
				resHeaders[key] = value;
			});
			const text = await res.text();
			// Never lose the status: an HTML error page is still evidence.
			// Try JSON first, fall back to the raw text.
			let data: T;
			if (!text) {
				data = undefined as unknown as T;
			} else {
				try {
					data = JSON.parse(text) as T;
				} catch {
					data = text as unknown as T;
				}
			}
			return { status: res.status, data, headers: resHeaders };
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
		return new ApiClient({
			...this.opts,
			headers: { ...(this.opts.headers ?? {}), ...headers },
		});
	}
}
