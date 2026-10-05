import { expect, test as setup } from '@playwright/test';
import path from 'path';
import { LoginPage } from '../src/pages/login.page';

const authFile = path.join(__dirname, '../playwright/.auth/user.json');

/**
 * Auth setup: logs in once via the UI and saves the signed-in browser
 * state. The 'chromium-auth' project loads this state, so auth specs
 * start logged in — no repeated logins, no flaky login steps in every test.
 *
 * Swap the credentials for env vars (APP_USER / APP_PASSWORD) per target.
 */
setup('authenticate', async ({ page }) => {
	const login = new LoginPage(page);
	await login.login(
		process.env.APP_USER ?? 'tomsmith',
		process.env.APP_PASSWORD ?? 'SuperSecretPassword!',
	);
	await expect(login.flash).toContainText('You logged into a secure area!');
	await page.context().storageState({ path: authFile });
});
