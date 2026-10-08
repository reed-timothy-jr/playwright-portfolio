import type { Page } from '@playwright/test';
import { BasePage } from './base.page';

/**
 * Login page object — targets the bundled fixture app by default
 * (see src/support/fixtureApp.ts); pass a baseURL for your own app.
 * Pattern (named locators, action methods that read like the user story)
 * stays the same — only selectors change per app.
 */
export class LoginPage extends BasePage {
	constructor(page: Page, baseURL: string) {
		super(page, baseURL);
	}

	private readonly path = '/login';

	get username() {
		return this.page.getByLabel('Username');
	}

	get password() {
		return this.page.getByLabel('Password');
	}

	get submit() {
		return this.page.getByRole('button', { name: 'Login' });
	}

	get flash() {
		// No accessible name on the flash div — CSS scoped to the form is
		// the honest last resort per docs/locator-strategy.md.
		return this.page.locator('#flash');
	}

	async open(): Promise<void> {
		await this.goto(this.path);
	}

	async login(username: string, password: string): Promise<void> {
		await this.open();
		await this.username.fill(username);
		await this.password.fill(password);
		await this.submit.click();
	}
}
