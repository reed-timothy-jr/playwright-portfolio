import type { Page } from '@playwright/test';

/**
 * Base page: every page object gets navigation + a base URL.
 * The base URL is required and injectable — pass the appTarget fixture's
 * url so specs run against the bundled fixture app, a local dev server,
 * or a deployed environment via BASE_URL. There is deliberately no
 * default: a page object pointed at the wrong app is a silent lie.
 */
export abstract class BasePage {
	protected readonly baseURL: string;

	constructor(
		protected readonly page: Page,
		baseURL: string,
	) {
		if (!baseURL) {
			throw new Error(
				'BasePage: baseURL is required — pass appTarget.url (fixture app by default, BASE_URL override).',
			);
		}
		this.baseURL = baseURL.replace(/\/$/, '');
	}

	async goto(path: string): Promise<void> {
		await this.page.goto(`${this.baseURL}${path}`);
	}

	async title(): Promise<string> {
		return this.page.title();
	}
}
