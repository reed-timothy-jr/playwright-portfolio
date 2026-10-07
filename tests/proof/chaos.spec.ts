import { expect, test } from '../../src/fixtures';
import { LoginPage } from '../../src/pages/login.page';
import { attachJson } from '../../src/support/evidence';

/**
 * PROOF suite — executable evidence that bounded fault injection works.
 * Proves the app (and the suite) behaves sanely under real-world faults.
 */
test.describe('chaos engineering', () => {
	test('login survives 1.5s injected latency on the auth call', async ({
		page,
		appTarget,
		chaos,
	}, testInfo) => {
		await chaos.start({ latencyMs: 1500, urlPattern: '**/authenticate' });

		const login = new LoginPage(page, appTarget.url);
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
		appTarget,
		chaos,
	}, testInfo) => {
		await chaos.start({
			errorRate: 1,
			errorStatus: 500,
			urlPattern: '**/login',
		});

		await expect(page.goto(`${appTarget.url}/login`)).rejects.toThrow();

		const interceptions = chaos.getInterceptions();
		expect(
			interceptions.some((r) => r.action === 'aborted' && r.status === 500),
		).toBe(true);
		await attachJson(testInfo, 'chaos-interceptions', interceptions);
	});
});
