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
			// Never proxy localhost — local stubs and dev servers bypass the egress proxy.
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
 * PowerBase Playwright Framework — central configuration.
 * Runs UI (Chromium/Firefox/WebKit), API, and resilience suites.
 * Override the target app with BASE_URL; API base with API_BASE_URL.
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
		baseURL: process.env.BASE_URL ?? 'https://the-internet.herokuapp.com',
		trace: 'on-first-retry',
		screenshot: 'only-on-failure',
		video: 'retain-on-failure',
		actionTimeout: 10_000,
		navigationTimeout: 30_000,
		// Respect corporate egress proxies — the browser doesn't read env vars on its own.
		proxy: proxyFromEnv(),
	},
	projects: [
		{ name: 'chromium', use: { ...devices['Desktop Chrome'] } },
		{ name: 'firefox', use: { ...devices['Desktop Firefox'] } },
		{ name: 'webkit', use: { ...devices['Desktop Safari'] } },
	],
});
