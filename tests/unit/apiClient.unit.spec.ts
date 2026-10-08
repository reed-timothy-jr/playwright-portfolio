import { createServer, type IncomingMessage, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { expect, test } from '../../src/fixtures';
import { ApiClient } from '../../src/support/apiClient';

/**
 * UNIT suite — focused tests for the typed API client.
 * A local HTTP server (ephemeral port, no external network) pins the
 * failure semantics: non-2xx, timeouts, malformed bodies, empty bodies.
 */

interface TestServer {
	url: string;
	close(): Promise<void>;
}

interface HandlerInput {
	body: string;
	headers: Record<string, string | string[] | undefined>;
}

async function startServer(
	handler: (input: HandlerInput) => {
		status: number;
		body: string;
		delayMs?: number;
	},
): Promise<TestServer> {
	const server: Server = createServer((req: IncomingMessage, res) => {
		const chunks: Buffer[] = [];
		req.on('data', (c: Buffer) => chunks.push(c));
		req.on('end', () => {
			const {
				status,
				body,
				delayMs = 0,
			} = handler({
				body: Buffer.concat(chunks).toString('utf8'),
				headers: req.headers,
			});
			setTimeout(() => {
				res.writeHead(status, { 'Content-Type': 'application/json' });
				res.end(body);
			}, delayMs);
		});
	});
	await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
	const port = (server.address() as AddressInfo).port;
	return {
		url: `http://127.0.0.1:${port}`,
		close: () =>
			new Promise<void>((resolve, reject) =>
				server.close((e) => (e ? reject(e) : resolve())),
			),
	};
}

test.describe('api client unit', () => {
	test('non-2xx responses return status without throwing', async () => {
		const srv = await startServer(() => ({
			status: 500,
			body: JSON.stringify({ error: 'boom' }),
		}));
		try {
			const api = new ApiClient({ baseURL: srv.url });
			const res = await api.get<{ error: string }>('/things');
			expect(res.status).toBe(500);
			expect(res.data.error).toBe('boom');
		} finally {
			await srv.close();
		}
	});

	test('timeouts abort the request instead of hanging', async () => {
		const srv = await startServer(() => ({
			status: 200,
			body: '{}',
			delayMs: 500,
		}));
		try {
			const api = new ApiClient({ baseURL: srv.url, timeoutMs: 100 });
			await expect(api.get('/slow')).rejects.toThrow(/abort/i);
		} finally {
			await srv.close();
		}
	});

	test('non-JSON bodies return status + raw text instead of throwing', async () => {
		const srv = await startServer(() => ({
			status: 502,
			body: '<html>bad gateway</html>',
		}));
		try {
			const api = new ApiClient({ baseURL: srv.url });
			// The old behavior threw SyntaxError here and LOST the 502.
			// A test client must never lose the status.
			const res = await api.get('/broken');
			expect(res.status).toBe(502);
			expect(res.data).toBe('<html>bad gateway</html>');
		} finally {
			await srv.close();
		}
	});

	test('empty bodies (204) resolve with undefined data', async () => {
		const srv = await startServer(() => ({ status: 204, body: '' }));
		try {
			const api = new ApiClient({ baseURL: srv.url });
			const res = await api.delete('/things/1');
			expect(res.status).toBe(204);
			expect(res.data).toBeUndefined();
		} finally {
			await srv.close();
		}
	});

	test('withHeaders sends custom headers (e.g. auth tokens)', async () => {
		let seenAuth: string | string[] | undefined;
		const srv = await startServer(({ headers }) => {
			seenAuth = headers.authorization;
			return { status: 200, body: '{}' };
		});
		try {
			const api = new ApiClient({ baseURL: srv.url }).withHeaders({
				authorization: 'Bearer test-token',
			});
			const res = await api.get('/secure');
			expect(res.status).toBe(200);
			expect(seenAuth).toBe('Bearer test-token');
		} finally {
			await srv.close();
		}
	});
});
