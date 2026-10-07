import path from 'node:path';
import { expect, test as setup } from '../src/fixtures';
import { LoginPage } from '../src/pages/login.page';

const authFile = path.join(__dirname, '../playwright/.auth/user.json');

/**
 * Auth setup: logs in once via the UI and saves the signed-in browser
 * state. The 'e2e-auth' project loads this state, so auth specs start
 * logged in — no repeated logins, no flaky login steps in every test.
 *
 * Sessions are stateless HMAC-signed cookies, so the saved state works
 * against any fixture-app instance (each worker runs its own).
 * Swap the credentials for env vars (APP_USER / APP_PASSWORD) per target.
 */
setup('authenticate', async ({ page, appTarget }) => {
	const login = new LoginPage(page, appTarget.url);
	await login.login(
		process.env.APP_USER ?? 'tomsmith',
		process.env.APP_PASSWORD ?? 'SuperSecretPassword!',
	);
	await expect(login.flash).toContainText('You logged into a secure area!');
	await page.context().storageState({ path: authFile });
});
