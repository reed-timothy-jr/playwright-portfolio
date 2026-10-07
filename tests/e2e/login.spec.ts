import { expect, test } from '../../src/fixtures';
import { LoginPage } from '../../src/pages/login.page';

/**
 * E2E pillar — the critical user path, end to end through the UI.
 * Runs against the bundled fixture app by default (deterministic, no
 * network); point BASE_URL at your own app to run the same specs there.
 */
test.describe('login e2e', () => {
	test('valid credentials land in the secure area', async ({
		page,
		appTarget,
	}) => {
		const login = new LoginPage(page, appTarget.url);
		await login.login('tomsmith', 'SuperSecretPassword!');
		await expect(login.flash).toContainText('You logged into a secure area!');
	});

	test('invalid credentials show an error, not a silent failure', async ({
		page,
		appTarget,
	}) => {
		const login = new LoginPage(page, appTarget.url);
		await login.login('tomsmith', 'wrong-password');
		await expect(login.flash).toContainText('Your password is invalid!');
	});
});
