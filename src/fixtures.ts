import { test as base } from '@playwright/test';
import { ApiClient } from './support/apiClient';
import { ChaosInjector } from './support/chaos';
import { config } from './support/config';
import { type FixtureApp, startFixtureApp } from './support/fixtureApp';

export interface AppTarget {
	/**
	 * Effective base URL for web-app specs.
	 * - When BASE_URL is set: the external target, used as-is.
	 * - Otherwise: the bundled fixture demo app (deterministic, offline-safe).
	 */
	url: string;
	/**
	 * Direct handle on the fixture app's database — lets specs verify
	 * persistence independently of the HTTP layers. Null for external targets.
	 */
	db: FixtureApp['db'] | null;
	isFixture: boolean;
}

export interface PowerBaseFixtures {
	/** Typed API client pointed at API_BASE_URL. */
	api: ApiClient;
	/** Chaos injector bound to the test's page. Auto-stopped after each test. */
	chaos: ChaosInjector;
}

export interface PowerBaseWorkerFixtures {
	/** Where the web-app specs run: fixture app by default, BASE_URL override. */
	appTarget: AppTarget;
}

/**
 * PowerBase fixtures — every test gets a page (built-in), plus api + chaos.
 * appTarget is worker-scoped: one fixture-app instance per worker.
 */
export const test = base.extend<PowerBaseFixtures, PowerBaseWorkerFixtures>({
	// biome-ignore lint/correctness/noEmptyPattern: Playwright fixture signature
	api: async ({}, use) => {
		await use(new ApiClient({ baseURL: config.apiBaseURL }));
	},
	chaos: async ({ page }, use) => {
		const injector = new ChaosInjector(page);
		await use(injector);
		await injector.stop();
	},
	appTarget: [
		async ({}, use) => {
			if (process.env.BASE_URL) {
				// Explicit external target — the team owns its availability.
				console.log(`[target] using external BASE_URL=${process.env.BASE_URL}`);
				await use({ url: process.env.BASE_URL, db: null, isFixture: false });
				return;
			}
			const app = await startFixtureApp();
			console.log(`[target] fixture demo app at ${app.url}`);
			try {
				await use({ url: app.url, db: app.db, isFixture: true });
			} finally {
				await app.close();
			}
		},
		{ scope: 'worker' },
	],
});

export { expect } from '@playwright/test';
