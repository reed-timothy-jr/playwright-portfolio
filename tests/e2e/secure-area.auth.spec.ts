import { expect, test } from '../../src/fixtures';

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
		await page.goto(`${appTarget.url}/secure`);
		await page.getByRole('link', { name: 'Logout' }).click();
		await expect(page).toHaveURL(/\/login$/);
	});
});
