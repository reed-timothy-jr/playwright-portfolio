import { expect, test } from '../../src/fixtures';
import { attachJson } from '../../src/support/evidence';
import { heal } from '../../src/support/selfHealing';

/**
 * PROOF suite — executable evidence that the self-healing primitive works.
 * The primary locator is deliberately stale (mirrors a real-world class
 * rename); the framework heals through fallback strategies and logs the
 * event. Part of the defect-detection story: the audit record proves a
 * recovered test is never silently passed off as a clean one.
 */
test.describe('self-healing locators', () => {
	test('heals a stale submit-button locator via role fallback', async ({
		page,
		appTarget,
	}, testInfo) => {
		await page.goto(`${appTarget.url}/login`);

		const submit = heal(
			page,
			'login submit button',
			(p) => p.locator('button.submit-primary-btn'), // stale — no longer in the DOM
			[
				{
					name: 'role-button',
					locate: (p) => p.getByRole('button', { name: 'Login' }),
				},
				{
					name: 'css-submit',
					locate: (p) => p.locator('button[type="submit"]'),
				},
			],
		);

		const locator = await submit.resolve();
		await locator.click();

		await expect(page.locator('#flash')).toContainText(
			'Your username is invalid!',
		);

		const events = submit.getHealingEvents();
		expect(events).toHaveLength(1);
		expect(events[0].healedBy).toBe('role-button');
		await attachJson(testInfo, 'healing-events', events);
	});

	test('throws a descriptive error when every strategy fails', async ({
		page,
		appTarget,
	}) => {
		await page.goto(`${appTarget.url}/login`);
		const missing = heal(
			page,
			'ghost element',
			(p) => p.locator('#does-not-exist'),
			[
				{
					name: 'css-also-missing',
					locate: (p) => p.locator('.also-not-here'),
				},
			],
		);
		await expect(missing.resolve(1000)).rejects.toThrow(
			'all 2 strategies failed for "ghost element"',
		);
	});
});
