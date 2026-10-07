import { expect, test } from '../../src/fixtures';

/**
 * Authenticated suite — runs in the 'chromium-auth' project, which loads
 * the storage state saved by tests/auth.setup.ts. Proves the session
 * works: the secure area loads without touching the login form.
 */
test.describe('authenticated area', () => {
	test('secure area loads with the saved session', async ({ page }) => {
		await page.goto('/secure');
		await expect(page.locator('h2')).toContainText('Secure Area');
	});

	test('logout ends the session', async ({ page }) => {
		await page.goto('/secure');
		await page.getByRole('link', { name: 'Logout' }).click();
		await expect(page).toHaveURL(/\/login$/);
	});
});
