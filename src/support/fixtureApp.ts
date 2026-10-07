import { createHash, createHmac } from 'node:crypto';
import {
	createServer,
	type IncomingMessage,
	type Server,
	type ServerResponse,
} from 'node:http';
import { PGliteDatabase } from './db';

/**
 * PowerBase fixture demo app — a tiny, self-contained web app used as the
 * default target for the e2e pillar (and the flagship workflow).
 *
 * Why it exists: the e2e pillar must be deterministic and green on clone —
 * no network, no flaky free-tier demo apps, no credentials to manage.
 * It models the shape of a real enterprise login flow:
 *
 *   GET  /login              login form (#username, #password, submit, #flash)
 *   POST /authenticate       form post → 302 /secure (sets session cookie)
 *   GET  /secure              requires session → "Secure Area" + logout
 *   GET  /logout              clears session → 302 /login
 *   GET  /api/users           JSON list of { id, username }
 *   POST /api/users           create user → 201 { id, username }
 *   GET  /api/users/:id       fetch one → 200 | 404
 *   DELETE /api/users/:id     delete → 204 | 404
 *
 * Sessions are stateless HMAC-signed cookies (fixed demo secret), so any
 * fixture instance accepts a session created by any other — this is what
 * lets the auth-setup project and the e2e-auth project share state across
 * workers. Passwords are sha256-hashed; sessions are demo-only, never a
 * production pattern.
 *
 * Point BASE_URL at your own app to run the e2e pillar against a real
 * target instead (it must expose the same login flow shape).
 */

export interface FixtureApp {
	/** Base URL, e.g. http://127.0.0.1:3939 */
	url: string;
	/** Direct DB handle — lets specs verify persistence independently of HTTP. */
	db: PGliteDatabase;
	close(): Promise<void>;
}

/** Demo-only signing secret. Never use a hardcoded secret in production. */
const SESSION_SECRET = 'powerbase-fixture-demo-secret';
const SESSION_COOKIE = 'pb_session';

const SECURITY_HEADERS: Record<string, string> = {
	'X-Content-Type-Options': 'nosniff',
	'X-Frame-Options': 'SAMEORIGIN',
	'Referrer-Policy': 'strict-origin-when-cross-origin',
	// Deliberately no Server / X-Powered-By — the sec pillar asserts this.
};

function hashPassword(password: string): string {
	return createHash('sha256').update(password).digest('hex');
}

function signSession(userId: number): string {
	const payload = String(userId);
	const sig = createHmac('sha256', SESSION_SECRET)
		.update(payload)
		.digest('hex');
	return `${payload}.${sig}`;
}

function verifySession(cookieHeader: string | undefined): number | null {
	const match = new RegExp(`${SESSION_COOKIE}=([^;]+)`).exec(
		cookieHeader ?? '',
	);
	if (!match) return null;
	const [payload, sig] = match[1].split('.');
	if (!payload || !sig) return null;
	const expected = createHmac('sha256', SESSION_SECRET)
		.update(payload)
		.digest('hex');
	if (sig !== expected) return null;
	const id = Number(payload);
	return Number.isInteger(id) && id > 0 ? id : null;
}

function esc(s: string): string {
	return s
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

function readBody(req: IncomingMessage): Promise<string> {
	return new Promise((resolve, reject) => {
		const chunks: Buffer[] = [];
		req.on('data', (chunk: Buffer) => chunks.push(chunk));
		req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
		req.on('error', reject);
	});
}

function parseForm(body: string): Record<string, string> {
	const out: Record<string, string> = {};
	for (const pair of body.split('&')) {
		const [k, v] = pair.split('=');
		if (k) out[decodeURIComponent(k)] = decodeURIComponent(v ?? '');
	}
	return out;
}

function send(
	res: ServerResponse,
	status: number,
	body: string,
	contentType = 'text/html; charset=utf-8',
	extraHeaders: Record<string, string> = {},
): void {
	res.writeHead(status, {
		'Content-Type': contentType,
		...SECURITY_HEADERS,
		...extraHeaders,
	});
	res.end(body);
}

function sendJson(
	res: ServerResponse,
	status: number,
	data: unknown,
	extraHeaders: Record<string, string> = {},
): void {
	send(
		res,
		status,
		data === undefined ? '' : JSON.stringify(data),
		'application/json; charset=utf-8',
		extraHeaders,
	);
}

function redirect(
	res: ServerResponse,
	location: string,
	extraHeaders: Record<string, string> = {},
): void {
	res.writeHead(302, {
		Location: location,
		...SECURITY_HEADERS,
		...extraHeaders,
	});
	res.end();
}

function loginPage(flash: string): string {
	return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Login</title></head>
<body>
<h2>Login Page</h2>
<div id="flash">${esc(flash)}</div>
<form action="/authenticate" method="post">
<label for="username">Username</label>
<input id="username" name="username" type="text">
<label for="password">Password</label>
<input id="password" name="password" type="password">
<button type="submit">Login</button>
</form>
</body></html>`;
}

interface UserRow {
	id: number;
	username: string;
	password_hash: string;
}

export async function startFixtureApp(port = 0): Promise<FixtureApp> {
	const db = new PGliteDatabase();
	await db.query(`
		CREATE TABLE IF NOT EXISTS fixture_users (
			id SERIAL PRIMARY KEY,
			username TEXT UNIQUE NOT NULL,
			password_hash TEXT NOT NULL,
			created_at TIMESTAMPTZ DEFAULT now()
		)
	`);
	// Seed the canonical demo user (idempotent).
	await db.query(
		`INSERT INTO fixture_users (username, password_hash)
		 VALUES ('tomsmith', $1)
		 ON CONFLICT (username) DO NOTHING`,
		[hashPassword('SuperSecretPassword!')],
	);

	const server: Server = createServer(async (req, res) => {
		try {
			await handle(req, res, db);
		} catch (err) {
			send(res, 500, 'fixture app error', 'text/plain; charset=utf-8');
			console.error('[fixture-app]', err);
		}
	});

	await new Promise<void>((resolve) =>
		server.listen(port, '127.0.0.1', resolve),
	);
	const address = server.address();
	const actualPort =
		typeof address === 'object' && address ? address.port : port;

	return {
		url: `http://127.0.0.1:${actualPort}`,
		db,
		close: async () => {
			await new Promise<void>((resolve, reject) =>
				server.close((err) => (err ? reject(err) : resolve())),
			);
			await db.close();
		},
	};
}

async function handle(
	req: IncomingMessage,
	res: ServerResponse,
	db: PGliteDatabase,
): Promise<void> {
	const url = new URL(req.url ?? '/', 'http://127.0.0.1');
	const method = req.method ?? 'GET';
	const pathname = url.pathname;

	// ---- UI routes ----
	if (method === 'GET' && pathname === '/') {
		send(
			res,
			200,
			'<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Fixture App</title></head>' +
				'<body><h1>PowerBase fixture app</h1><p><a href="/login">Login</a></p></body></html>',
		);
		return;
	}

	if (method === 'GET' && pathname === '/login') {
		send(res, 200, loginPage(url.searchParams.get('flash') ?? ''));
		return;
	}

	if (method === 'POST' && pathname === '/authenticate') {
		const form = parseForm(await readBody(req));
		const rows = await db.query<UserRow>(
			'SELECT id, username, password_hash FROM fixture_users WHERE username = $1',
			[form.username ?? ''],
		);
		const user = rows[0];
		if (!user) {
			redirect(
				res,
				`/login?flash=${encodeURIComponent('Your username is invalid!')}`,
			);
			return;
		}
		if (user.password_hash !== hashPassword(form.password ?? '')) {
			redirect(
				res,
				`/login?flash=${encodeURIComponent('Your password is invalid!')}`,
			);
			return;
		}
		redirect(res, '/secure', {
			'Set-Cookie': `${SESSION_COOKIE}=${signSession(user.id)}; Path=/; HttpOnly; SameSite=Lax`,
		});
		return;
	}

	if (method === 'GET' && pathname === '/secure') {
		const userId = verifySession(req.headers.cookie);
		if (!userId) {
			redirect(
				res,
				'/login?flash=' +
					encodeURIComponent('You must log in to view the secure area!'),
			);
			return;
		}
		const rows = await db.query<{ username: string }>(
			'SELECT username FROM fixture_users WHERE id = $1',
			[userId],
		);
		const username = rows[0]?.username ?? 'unknown';
		send(
			res,
			200,
			'<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Secure Area</title></head>' +
				`<body><h2>Secure Area</h2><div id="flash">You logged into a secure area!</div>` +
				`<p>Logged in as ${esc(username)}</p><a href="/logout">Logout</a></body></html>`,
		);
		return;
	}

	if (method === 'GET' && pathname === '/logout') {
		redirect(res, '/login', {
			'Set-Cookie': `${SESSION_COOKIE}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT`,
		});
		return;
	}

	// ---- JSON API routes ----
	if (pathname === '/api/users' && method === 'GET') {
		const rows = await db.query<{ id: number; username: string }>(
			'SELECT id, username FROM fixture_users ORDER BY id',
		);
		sendJson(res, 200, rows);
		return;
	}

	if (pathname === '/api/users' && method === 'POST') {
		let payload: { username?: unknown; password?: unknown };
		try {
			payload = JSON.parse(await readBody(req)) as typeof payload;
		} catch {
			sendJson(res, 400, { error: 'invalid JSON body' });
			return;
		}
		if (typeof payload.username !== 'string' || payload.username.length < 3) {
			sendJson(res, 400, {
				error: 'username must be a string of at least 3 characters',
			});
			return;
		}
		if (typeof payload.password !== 'string' || payload.password.length < 8) {
			sendJson(res, 400, {
				error: 'password must be a string of at least 8 characters',
			});
			return;
		}
		try {
			const rows = await db.query<{ id: number; username: string }>(
				'INSERT INTO fixture_users (username, password_hash) VALUES ($1, $2) RETURNING id, username',
				[payload.username, hashPassword(payload.password)],
			);
			sendJson(res, 201, rows[0]);
		} catch {
			sendJson(res, 409, { error: 'username already exists' });
		}
		return;
	}

	const userIdMatch = /^\/api\/users\/(\d+)$/.exec(pathname);
	if (userIdMatch) {
		const id = Number(userIdMatch[1]);
		if (method === 'GET') {
			const rows = await db.query<{ id: number; username: string }>(
				'SELECT id, username FROM fixture_users WHERE id = $1',
				[id],
			);
			if (rows.length === 0) {
				sendJson(res, 404, { error: 'user not found' });
				return;
			}
			sendJson(res, 200, rows[0]);
			return;
		}
		if (method === 'DELETE') {
			const rows = await db.query<{ id: number }>(
				'DELETE FROM fixture_users WHERE id = $1 RETURNING id',
				[id],
			);
			if (rows.length === 0) {
				sendJson(res, 404, { error: 'user not found' });
				return;
			}
			sendJson(res, 204, undefined);
			return;
		}
	}

	sendJson(res, 404, { error: 'not found' });
}
