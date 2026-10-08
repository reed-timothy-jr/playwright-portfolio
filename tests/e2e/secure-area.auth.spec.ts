import { expect, test } from '../../src/fixtures';
import { LoginPage } from '../../src/pages/login.page';

/**
 * E2E pillar (authenticated) — runs in the 'e2e-auth' project, which loads
 * the storage state saved by tests/auth.setup.ts. Proves the session
 * works: the secure area loads without touching the login form.
 */
test.describe('authenticated area', () => {
	test('secure area loads with the saved session', async ({
		page,
		appTarget,
	}) => {
		await page.goto(`${appTarget.url}/secure`);
		await expect(page.locator('h2')).toContainText('Secure Area');
	});

	test('logout ends the session', async ({ page, appTarget }) => {
		// Own session, not the shared setup state: against a real app with
		// server-side sessions, logging out here would invalidate the
		// session token sibling tests are using.
		const login = new LoginPage(page, appTarget.url);
		await login.login('tomsmith', 'SuperSecretPassword!');
		await page.goto(`${appTarget.url}/secure`);
		await expect(page.locator('h2')).toContainText('Secure Area');

		await page.getByRole('link', { name: 'Logout' }).click();
		await expect(page).toHaveURL(/\/login/);

		// The session is really dead: /secure bounces back to login.
		await page.goto(`${appTarget.url}/secure`);
		await expect(page).toHaveURL(/\/login/);
	});
});
