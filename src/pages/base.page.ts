import type { Page } from '@playwright/test';
import { config } from '../support/config';

/**
 * Base page: every page object gets navigation + a base URL.
 * The base URL is injectable so specs can run against the bundled fixture
 * app, a local dev server, or a deployed environment via BASE_URL.
 */
export abstract class BasePage {
	protected readonly baseURL: string;

	constructor(
		protected readonly page: Page,
		baseURL: string = config.baseURL,
	) {
		this.baseURL = baseURL.replace(/\/$/, '');
	}

	async goto(path: string): Promise<void> {
		await this.page.goto(`${this.baseURL}${path}`);
	}

	async title(): Promise<string> {
		return this.page.title();
	}
}
