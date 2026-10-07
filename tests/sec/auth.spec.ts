import { expect, test } from '../../src/fixtures';

/**
 * SEC pillar — authorization boundary checks.
 *
 * Baseline, not a pentest: proves the protected area rejects anonymous
 * and forged sessions. The sec project deliberately loads NO storage
 * state, so every test here starts unauthenticated.
 */
test.describe('authorization', () => {
	test('unauthenticated requests to /secure are bounced to login', async ({
		page,
		appTarget,
	}) => {
		await page.goto(`${appTarget.url}/secure`);
		await expect(page).toHaveURL(/\/login/);
		await expect(page.locator('#flash')).toContainText(/log in/i);
		// And the protected content is genuinely absent, not just hidden.
		await expect(page.locator('h2')).not.toContainText('Secure Area');
	});

	test('tampered session cookies are rejected', async ({
		page,
		appTarget,
	}) => {
		await page.context().addCookies([
			{
				name: 'pb_session',
				value: '1.forged-signature',
				url: appTarget.url,
			},
		]);
		await page.goto(`${appTarget.url}/secure`);
		await expect(page).toHaveURL(/\/login/);
		await expect(page.locator('h2')).not.toContainText('Secure Area');
	});
});
