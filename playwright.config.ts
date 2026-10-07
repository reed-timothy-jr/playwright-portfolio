import { defineConfig, devices } from '@playwright/test';
import * as dotenv from 'dotenv';

dotenv.config();

/**
 * Build a Playwright proxy config from the environment.
 * Playwright does not parse embedded credentials out of the server URL,
 * so split them into username/password explicitly.
 */
function proxyFromEnv():
	| { server: string; username?: string; password?: string; bypass?: string }
	| undefined {
	const raw = process.env.HTTPS_PROXY ?? process.env.HTTP_PROXY;
	if (!raw) return undefined;
	try {
		const url = new URL(raw);
		const proxy: {
			server: string;
			username?: string;
			password?: string;
			bypass?: string;
		} = {
			server: `${url.protocol}//${url.host}`,
			// Never proxy localhost — the fixture app and dev servers bypass the egress proxy.
			bypass: 'localhost,127.0.0.1',
		};
		if (url.username) {
			proxy.username = decodeURIComponent(url.username);
			proxy.password = decodeURIComponent(url.password);
		}
		return proxy;
	} catch {
		return { server: raw };
	}
}

/**
 * PowerBase Playwright Framework — five-pillar project layout.
 *
 * Pillars (the five testing modules — run each independently):
 *   e2e / e2e-auth   UI critical path (+ authenticated specs via saved session)
 *   api              contract-level API checks (no browser needed)
 *   db               database-layer specs (PGlite by default)
 *   perf             performance budgets (Navigation Timing API)
 *   sec              baseline security checks (headers, authz, dependency audit)
 *
 * Supporting suites (nice-to-haves that serve the pillars):
 *   a11y / visual    accessibility + visual regression
 *   proof            defect-detection proof suite (run via `npm run test:proof`,
 *                    excluded from test:all — it demonstrates failures)
 *   unit             focused tests for the framework primitives themselves
 *
 * Web-app specs target the bundled fixture demo app by default
 * (see src/support/fixtureApp.ts); set BASE_URL to run them against
 * your own app instead.
 */
export default defineConfig({
	testDir: './tests',
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 0,
	workers: process.env.CI ? 2 : undefined,
	reporter: [
		['list'],
		['html', { open: 'never' }],
		['json', { outputFile: 'test-results/results.json' }],
	],
	use: {
		// Note: web-app specs navigate via absolute URLs from the appTarget
		// fixture (fixture demo app by default, BASE_URL override). baseURL
		// below is only a fallback for any relative navigations.
		baseURL: process.env.BASE_URL,
		trace: process.env.CI ? 'retain-on-failure' : 'on-first-retry',
		screenshot: 'only-on-failure',
		video: 'retain-on-failure',
		actionTimeout: 10_000,
		navigationTimeout: 30_000,
		// Respect corporate egress proxies — the browser doesn't read env vars on its own.
		proxy: proxyFromEnv(),
	},
	projects: [
		// Auth setup: logs in once, saves storage state for e2e-auth.
		{ name: 'setup', testMatch: /.*\.setup\.ts/ },

		// ---- Five pillars ----
		{
			name: 'e2e',
			testMatch: /tests\/e2e\/[^/]*\.spec\.ts/,
			testIgnore: /.*\.auth\.spec\.ts/,
			use: { ...devices['Desktop Chrome'] },
		},
		{
			name: 'e2e-auth',
			testMatch: /.*\.auth\.spec\.ts/,
			dependencies: ['setup'],
			use: {
				...devices['Desktop Chrome'],
				storageState: 'playwright/.auth/user.json',
			},
		},
		{ name: 'api', testMatch: /tests\/api\/.*/ },
		{ name: 'db', testMatch: /tests\/db\/.*/ },
		{
			name: 'perf',
			testMatch: /tests\/perf\/.*/,
			use: { ...devices['Desktop Chrome'] },
		},
		{ name: 'sec', testMatch: /tests\/sec\/.*/ },

		// ---- Supporting suites ----
		{
			name: 'a11y',
			testMatch: /tests\/a11y\/.*/,
			use: { ...devices['Desktop Chrome'] },
		},
		{
			name: 'visual',
			testMatch: /tests\/visual\/.*/,
			use: { ...devices['Desktop Chrome'] },
		},
		{ name: 'proof', testMatch: /tests\/proof\/.*/ },
		{ name: 'unit', testMatch: /tests\/unit\/.*/ },
	],
});
