import { expect, test } from '../../src/fixtures';
import { heal } from '../../src/support/selfHealing';

/**
 * UNIT suite — focused tests for the self-healing primitive.
 * No network: pages are built with setContent. These pin the
 * hardening rules — ordering, ambiguity rejection, bounded attempts,
 * and the audit record that distinguishes a recovery from a clean pass.
 */
test.describe('self-healing unit', () => {
	test('tries fallbacks in order and heals with the first working one', async ({
		page,
	}) => {
		await page.setContent('<button type="submit">Login</button>');
		const h = heal(page, 'login button', (p) => p.locator('#stale-primary'), [
			{ name: 'also-stale', locate: (p) => p.locator('.missing-too') },
			{ name: 'css-submit', locate: (p) => p.locator('button[type="submit"]') },
		]);
		const locator = await h.resolve(2000);
		expect(await locator.count()).toBe(1);

		const log = h.getAttemptLog();
		expect(log.map((a) => a.strategy)).toEqual([
			'primary',
			'also-stale',
			'css-submit',
		]);
		expect(log.map((a) => a.outcome)).toEqual(['failed', 'failed', 'healed']);
		expect(h.getHealingEvents()).toHaveLength(1);
		expect(h.getHealingEvents()[0].healedBy).toBe('css-submit');
	});

	test('ambiguous fallbacks are rejected, never healed', async ({ page }) => {
		await page.setContent('<button>Login</button><button>Login</button>');
		const h = heal(page, 'login button', (p) => p.locator('#stale-primary'), [
			{ name: 'text-login', locate: (p) => p.getByText('Login') },
		]);
		await expect(h.resolve(2000)).rejects.toThrow(/strategies failed/);

		const log = h.getAttemptLog();
		const rejected = log.find((a) => a.strategy === 'text-login');
		expect(rejected?.outcome).toBe('ambiguous-rejected');
		expect(rejected?.detail).toContain('matched 2 elements');
		// Nothing healed — the audit log proves no silent recovery happened.
		expect(h.getHealingEvents()).toHaveLength(0);
	});

	test('strict mode fails fast on an ambiguous primary', async ({ page }) => {
		await page.setContent('<button>Login</button><button>Login</button>');
		const h = heal(
			page,
			'login button',
			(p) => p.getByText('Login'), // ambiguous contract
			[{ name: 'css-button', locate: (p) => p.locator('button').first() }],
			undefined,
			{ strict: true },
		);
		await expect(h.resolve(2000)).rejects.toThrow(/ambiguous primary/);
		// Fallbacks are never tried — fix the contract, don't guess.
		expect(h.getAttemptLog()).toHaveLength(1);
		expect(h.getAttemptLog()[0]).toMatchObject({
			strategy: 'primary',
			outcome: 'ambiguous-rejected',
		});
		expect(h.getHealingEvents()).toHaveLength(0);
	});

	test('maxAttempts bounds how many fallbacks are tried', async ({ page }) => {
		await page.setContent('<button type="submit">Login</button>');
		const h = heal(
			page,
			'login button',
			(p) => p.locator('#stale-primary'),
			[
				{ name: 'miss-1', locate: (p) => p.locator('.miss-1') },
				{ name: 'miss-2', locate: (p) => p.locator('.miss-2') },
				{ name: 'miss-3', locate: (p) => p.locator('.miss-3') },
			],
			undefined,
			{ maxAttempts: 1 },
		);
		await expect(h.resolve(1000)).rejects.toThrow(
			'all 2 strategies failed for "login button"',
		);
		expect(h.getAttemptLog().map((a) => a.strategy)).toEqual([
			'primary',
			'miss-1',
		]);
	});

	test('a clean primary resolve leaves no healing events (distinguishable)', async ({
		page,
	}) => {
		await page.setContent('<button id="go">Go</button>');
		const h = heal(page, 'go button', (p) => p.locator('#go'), [
			{ name: 'unused', locate: (p) => p.locator('.unused') },
		]);
		await h.resolve(2000);
		expect(h.getAttemptLog()).toEqual([
			{ strategy: 'primary', outcome: 'primary-ok' },
		]);
		expect(h.getHealingEvents()).toHaveLength(0);
	});
});
