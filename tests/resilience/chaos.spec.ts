import { expect, test } from '../../src/fixtures';
import { attachJson } from '../../src/framework/evidence';
import { LoginPage } from '../../src/pages/login.page';

/**
 * Chaos engineering — bounded fault injection against a test target.
 * Proves the app (and the suite) behaves sanely under real-world faults.
 */
test.describe('chaos engineering', () => {
	test('login survives 1.5s injected latency on the auth call', async ({
		page,
		chaos,
	}, testInfo) => {
		await chaos.start({ latencyMs: 1500, urlPattern: '**/authenticate' });

		const login = new LoginPage(page);
		await login.login('tomsmith', 'SuperSecretPassword!');

		await expect(login.flash).toContainText('You logged into a secure area!', {
			timeout: 20_000,
		});

		const interceptions = chaos.getInterceptions();
		expect(interceptions.some((r) => r.action === 'delayed')).toBe(true);
		await attachJson(testInfo, 'chaos-interceptions', interceptions);
	});

	test('aborted requests surface as observable failures, not hangs', async ({
		page,
		chaos,
	}, testInfo) => {
		await chaos.start({
			errorRate: 1,
			errorStatus: 500,
			urlPattern: '**/login',
		});

		await expect(page.goto('/login')).rejects.toThrow();

		const interceptions = chaos.getInterceptions();
		expect(
			interceptions.some((r) => r.action === 'aborted' && r.status === 500),
		).toBe(true);
		await attachJson(testInfo, 'chaos-interceptions', interceptions);
	});
});
