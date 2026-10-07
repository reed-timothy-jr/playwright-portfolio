import { expect, test } from '../../src/fixtures';
import { LoginPage } from '../../src/pages/login.page';

/**
 * Smoke suite — the critical path. Fast, stable, runs on every PR.
 * Target: https://the-internet.herokuapp.com (swap BASE_URL for your app).
 */
test.describe('login smoke', () => {
	test('valid credentials land in the secure area', async ({ page }) => {
		const login = new LoginPage(page);
		await login.login('tomsmith', 'SuperSecretPassword!');
		await expect(login.flash).toContainText('You logged into a secure area!');
	});

	test('invalid credentials show an error, not a silent failure', async ({
		page,
	}) => {
		const login = new LoginPage(page);
		await login.login('tomsmith', 'wrong-password');
		await expect(login.flash).toContainText('Your password is invalid!');
	});
});
