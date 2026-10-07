import { test as base } from '@playwright/test';
import { ApiClient } from './support/apiClient';
import { ChaosInjector } from './support/chaos';
import { config } from './support/config';

export interface PowerBaseFixtures {
	/** Typed API client pointed at API_BASE_URL. */
	api: ApiClient;
	/** Chaos injector bound to the test's page. Auto-stopped after each test. */
	chaos: ChaosInjector;
}

/**
 * PowerBase fixtures — every test gets a page (built-in), plus api + chaos.
 * Extend here for DB, auth state, or per-suite setup.
 */
export const test = base.extend<PowerBaseFixtures>({
	// biome-ignore lint/correctness/noEmptyPattern: Playwright fixture signature
	api: async ({}, use) => {
		await use(new ApiClient({ baseURL: config.apiBaseURL }));
	},
	chaos: async ({ page }, use) => {
		const injector = new ChaosInjector(page);
		await use(injector);
		await injector.stop();
	},
});

export { expect } from '@playwright/test';
